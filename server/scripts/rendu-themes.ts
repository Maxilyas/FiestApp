// Les thèmes photographiés dans l'application, au téléphone (360 × 640) :
// l'accueil d'un profil, sa page, une question de soirée, la boutique et sa
// carte — et, pour les thèmes peints qui suivent l'heure de Paris, aux
// heures qu'on veut (`HEURES=07:30,13:00,19:30,23:00`).
//
//   npm run build -w client && cd server && npx tsx scripts/rendu-themes.ts horloge ciel [--fond=triomphe]
//
// Les photos vont dans le dossier `SORTIE` (par défaut ../export/rendus).
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { ADMIN, attendre, connexionAnimateur, creerQuiz, ecranCommun, ecrire, inscrireProfil, invite, lancerQuiz, patienter, demarrer } from '../test/banc'
import { SERVEUR } from '../src/racine'
import { THEMES } from '../../shared/themes'
import { BRANCHES } from '../../shared/branches'
import { PAGES, cleDeLaPage } from '../../shared/calendrier'

const args = process.argv.slice(2)
const voulus = args.filter(a => !a.startsWith('--'))
const option = (nom: string) => args.find(a => a.startsWith(`--${nom}=`))?.slice(nom.length + 3)
const ecrans = (option('ecrans') ?? 'accueil,profil,question').split(',')
const fond = option('fond')
const heures = (process.env.HEURES ?? '').split(',').filter(Boolean)
const date = process.env.DATE ?? '2026-10-05'
const sortie = path.resolve(process.env.SORTIE ?? path.resolve(SERVEUR, '../export/rendus'))
mkdirSync(sortie, { recursive: true })

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}
const { chromium } = chargerPlaywright()

/**
 * Le contraste de chaque texte à l'écran sur ce qui est vraiment peint
 * derrière lui : les lignes de texte sont relevées, puis le texte devient
 * transparent — son halo reste, il fait partie de ce que l'œil lit — et la
 * photo dit, sous chaque ligne, le pixel le plus clair (pour un texte clair)
 * ou le plus sombre (pour un texte sombre), au 95ᵉ centile. Seuils WCAG :
 * 4,5:1, ou 3:1 pour un grand texte.
 */
async function mesurerContraste(page: any) {
  const lignes: any[] = await page.evaluate(`(() => {
    const out = []
    const marcheur = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      const texte = n.textContent.trim()
      if (!texte || !n.parentElement) continue
      // Ce qui ne se lit qu'à l'oreille ne se mesure pas.
      if (n.parentElement.closest('.sr-only')) continue
      const s = getComputedStyle(n.parentElement)
      if (s.visibility !== 'visible' || Number(s.opacity) === 0) continue
      const r = document.createRange()
      r.selectNodeContents(n)
      for (const b of r.getClientRects()) {
        if (b.width < 4 || b.height < 4 || b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) continue
        // Recouvert (la barre du menu, un dialogue) : on ne le voit pas, on ne le mesure pas.
        const dessus = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, b.left + b.width / 2)), Math.min(innerHeight - 1, Math.max(0, b.top + b.height / 2)))
        if (dessus && !n.parentElement.contains(dessus) && !dessus.contains(n.parentElement)) continue
        const taille = parseFloat(s.fontSize), gras = Number(s.fontWeight) >= 700
        out.push({ texte: texte.slice(0, 30), couleur: s.color, grand: taille >= 24 || (gras && taille >= 18.66), x: b.left, y: b.top, l: b.width, h: b.height })
      }
    }
    return out
  })()`)
  await page.addStyleTag({ content: '* { color: transparent !important; caret-color: transparent !important; } img, svg, video { visibility: hidden !important; }' })
  await patienter(150)
  const png: Buffer = await page.screenshot({ type: 'png' })
  const resultats: any[] = await page.evaluate(
    `(async ({ src, lignes, dpr }) => {
      const i = new Image(); i.src = src; await i.decode()
      const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0)
      const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      return lignes.map(l => {
        const [r, g, b, a = 1] = l.couleur.match(/[\\d.]+/g).map(Number)
        if (a < 0.5) return null
        const Lt = lum(r, g, b)
        const d = x.getImageData(Math.max(0, Math.round(l.x * dpr)), Math.max(0, Math.round(l.y * dpr)), Math.max(1, Math.round(l.l * dpr)), Math.max(1, Math.round(l.h * dpr))).data
        const fonds = []
        for (let k = 0; k < d.length; k += 4) fonds.push(lum(d[k], d[k + 1], d[k + 2]))
        fonds.sort((p, q) => p - q)
        const clair = Lt > 0.18
        const pire = clair ? fonds[Math.floor(fonds.length * 0.95)] : fonds[Math.floor(fonds.length * 0.05)]
        const ratio = (Math.max(Lt, pire) + 0.05) / (Math.min(Lt, pire) + 0.05)
        return { texte: l.texte, ratio: Math.round(ratio * 100) / 100, seuil: l.grand ? 3 : 4.5 }
      }).filter(Boolean)
    })(${JSON.stringify({ src: `data:image/png;base64,${png.toString('base64')}`, lignes, dpr: 2 })})`,
  )
  const faibles = resultats.filter(r => r.ratio < r.seuil)
  const min = resultats.reduce((m, r) => Math.min(m, r.ratio / r.seuil), Infinity)
  console.log(`    ${resultats.length} lignes, ${faibles.length} sous le seuil (pire : ${(min * 100).toFixed(0)} % du seuil)`)
  for (const f of faibles.slice(0, 12)) console.log(`      ${f.ratio}:1 < ${f.seuil} « ${f.texte} »`)
}

const banc = await demarrer()
try {
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(
    banc.url,
    cookie,
    [
      {
        kind: 'choice',
        text: 'Quel fleuve traverse Paris avant de se jeter dans la Manche ?',
        answers: ['La Loire', 'La Seine', 'Le Rhône', 'La Garonne'],
        correct: 1,
        duration: 120,
        image: null,
        category: 'Géographie',
      },
      { kind: 'choice', text: 'Combien de pattes a une araignée ?', answers: ['Six', 'Huit'], correct: 1, duration: 120, image: null },
    ],
    'Les rendus',
  )
  // Camille a tout : les thèmes achetés, ceux qui se gagnent (les badges qui
  // les ouvrent), les fonds peints — puis le serveur redémarre pour les relire.
  const profil = await inscrireProfil(banc.url, 'camille', 'Camille', '🦊')
  {
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const id = (base.prepare('SELECT id FROM profiles WHERE login = ?').get('camille') as { id: string }).id
    const achat = base.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 1)')
    for (const t of THEMES) if (t.rarete !== 'offert' && !t.gagne) achat.run(id, t.key)
    const maitre = base.prepare('INSERT INTO sentier_acquis (profile_id, branche, paliers, retenu_le) VALUES (?, ?, 13, 1)')
    for (const b of BRANCHES) maitre.run(id, b.key)
    const badge = base.prepare(`INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, '', '🏅', ?, 1)`)
    for (let i = 0; i < 50; i++) badge.run(id, 'hf:laurier', `#jour:2026-01-${i}`, 'Laurier')
    for (const cle of ['hf:infatigable:2', 'hf:alpiniste:3', 'hf:elite:2', 'mois:2026-09']) badge.run(id, cle, '#jour:2026-09-30', cle)
    for (const p of PAGES) badge.run(id, cleDeLaPage(p.mois), `#jour:2026-${p.mois}-24`, p.nom)
    base.close()
  }
  await banc.redemarrer()
  const url = banc.url
  if (fond) {
    const r = await ecrire(url, '/api/joueur/moi', { fond }, profil, 'PUT')
    if (!r.ok) throw new Error(`Camille ne porte pas le fond ${fond} (${r.status} ${await r.text()})`)
  }

  const camille = await invite(url, 'Camille', '', { cookie: profil })
  camille.socket.close()
  const host = await ecranCommun(url, cookie)
  let vue: any = null
  host.on('session:view', (p: any) => (vue = p))

  const navigateur = await chromium.launch({ headless: true })
  // `ECRAN=1280x800` : un ordinateur, où les mesures en largeur d'écran ne doivent rien faire de démesuré.
  const [largeur, hauteur] = (process.env.ECRAN ?? '360x640').split('x').map(Number)
  const contexte = await navigateur.newContext({
    viewport: { width: largeur, height: hauteur },
    deviceScaleFactor: largeur > 600 ? 1 : 2,
    isMobile: largeur <= 600,
    hasTouch: largeur <= 600,
    reducedMotion: process.env.CALME ? 'reduce' : 'no-preference',
  })
  const [nom, valeur] = profil.split('=')
  await contexte.addCookies([{ name: nom, value: valeur, url }])
  await contexte.addInitScript(
    ([cle, me]: string[]) => {
      localStorage.setItem(cle, me)
      localStorage.setItem('quizz.muted', '1')
    },
    [`quizz.me.${ADMIN.slug}`, JSON.stringify({ playerId: camille.playerId, token: camille.token })],
  )
  const telephone = await contexte.newPage()

  const enQuestion = async () => {
    const ouverte = () => vue?.view.phase === 'question' && vue.view.qIndex === 0 && vue.view.deadline - Date.now() > 20_000
    if (ouverte()) return
    if (vue?.sessionId) (host as any).emit('host:endSession', { sessionId: vue.sessionId })
    await patienter(300)
    const prete = attendre<any>(host, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === 0, 'la question', 15_000)
    await lancerQuiz(host, quiz)
    vue = await prete
  }

  const themes = THEMES.filter(t => voulus.includes(t.key))
  for (const t of themes) {
    const r = await ecrire(url, '/api/joueur/moi', { theme: t.key === 'velours' ? null : t.key }, profil, 'PUT')
    if (!r.ok) throw new Error(`Camille ne porte pas ${t.key} (${r.status})`)
    for (const heure of heures.length ? heures : ['']) {
      if (heure) await telephone.clock.setFixedTime(new Date(`${date}T${heure}:00+02:00`))
      for (const ecran of ecrans) {
        const adresse = { accueil: '/', profil: '/profil', boutique: '/boutique', question: `/${ADMIN.slug}`, carte: '/profil', jour: '/jour', campagne: '/campagne' }[ecran]
        if (!adresse) throw new Error(`écran inconnu : ${ecran}`)
        if (ecran === 'question') await enQuestion()
        await telephone.goto(`${url}${adresse}`)
        await telephone.waitForFunction(
          (cle: string) => ((globalThis as any).document.documentElement.dataset.theme ?? 'velours') === cle,
          t.key,
          { timeout: 15_000 },
        )
        if (ecran === 'question') await telephone.locator('.ans-btn').first().waitFor({ timeout: 15_000 })
        if (ecran === 'carte') {
          await telephone.getByRole('button', { name: /Ma carte/ }).first().click()
          await telephone.locator('.carte-joueur').waitFor({ timeout: 15_000 })
        }
        await telephone.evaluate('document.fonts.ready')
        await patienter(Number(process.env.ATTENTE ?? 1200))
        const fichier = path.join(sortie, `${t.key}-${ecran}${heure ? '-' + heure.replace(':', 'h') : ''}${fond ? '-' + fond : ''}.png`)
        await telephone.screenshot({ path: fichier, fullPage: process.env.PLEIN === '1' })
        console.log(fichier)
        if (args.includes('--contraste')) await mesurerContraste(telephone)
      }
    }
  }
  await navigateur.close()
} finally {
  await banc.close()
}
