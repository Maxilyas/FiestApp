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
import { contrasteDeLaPage } from './a-l-ecran'

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

/** Le contraste de chaque texte à l'écran sur ce qui est vraiment peint derrière lui (`contrasteDeLaPage`), et ce qui reste sous le seuil. */
async function mesurerContraste(page: any) {
  const resultats = await contrasteDeLaPage(page)
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
          // Sa ligne en tête du profil l'ouvre : le bouton « Ma carte » de l'identité encadrée n'existe plus.
          await telephone.click('button.identite-ligne')
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
