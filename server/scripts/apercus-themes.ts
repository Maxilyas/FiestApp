// Les aperçus de la boutique des thèmes : l'écran d'une question, photographié
// au téléphone (360 × 640) sous chaque thème, rogné à la question et à ses
// réponses, réduit en vignette WebP dans client/src/themes/apercus/.
//
//   npm run build -w client && cd server && npx tsx scripts/apercus-themes.ts [clé…]
//
// Un serveur jetable, un quiz, et Camille qui porte les thèmes tour à tour :
// la vignette est l'application elle-même, polices et décor compris — jamais
// une maquette qui aurait dérivé. Sans clé, les trente ; avec, ceux-là (un
// thème retouché). Le décor y est immobile, comme pour qui demande moins de
// mouvement : une vignette ne doit pas dépendre de l'instant de la photo.
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
} from '../test/banc'
import { SERVEUR } from '../src/racine'
import { THEMES } from '../../shared/themes'

const sortie = path.resolve(SERVEUR, '../client/src/themes/apercus')
mkdirSync(sortie, { recursive: true })
const voulus = process.argv.slice(2)
const themes = THEMES.filter(t => voulus.length === 0 || voulus.includes(t.key))
if (themes.length === 0) throw new Error(`aucun thème ne s’appelle ${voulus.join(', ')}`)

/** Le haut de l'écran, que la case de la boutique montre (9:13), réduit aux trois cinquièmes. */
const LARGEUR = 360
const HAUTEUR = 520
const ECHELLE = 0.6

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'apercus.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const banc = await demarrer()
const url = banc.url
try {
  const cookie = await connexionAnimateur(url)
  const quiz = await creerQuiz(
    url,
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
    'Les aperçus',
  )

  // Camille a tous les thèmes : achetés d'avance, pour rien, dans la base jetable.
  const profil = await inscrireProfil(url, 'camille', 'Camille', '🦊')
  {
    const base = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    const id = (base.prepare('SELECT id FROM profiles WHERE login = ?').get('camille') as { id: string }).id
    const achat = base.prepare('INSERT INTO profile_achats (profile_id, theme, prix, created_at) VALUES (?, ?, 0, 1)')
    for (const t of THEMES) if (t.rarete !== 'offert') achat.run(id, t.key)
    base.close()
  }

  // Son téléphone, dans un vrai navigateur : son jeton lui est remis comme
  // s'il s'était déjà inscrit, et le cookie de son profil l'accompagne.
  const camille = await invite(url, 'Camille', '', { cookie: profil })
  camille.socket.close()
  const host = await ecranCommun(url, cookie)
  let vue: any = null
  host.on('session:view', (p: any) => (vue = p))

  const navigateur = await chromium.launch({ headless: true })
  const contexte = await navigateur.newContext({
    viewport: { width: LARGEUR, height: 640 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
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
  const atelier = await navigateur.newPage()

  /** Une question ouverte pour un moment encore : sinon, on relance le quiz. */
  const enQuestion = async () => {
    const ouverte = () => vue?.view.phase === 'question' && vue.view.qIndex === 0 && vue.view.deadline - Date.now() > 20_000
    if (ouverte()) return
    if (vue?.sessionId) (host as any).emit('host:endSession', { sessionId: vue.sessionId })
    await patienter(300)
    const prete = attendre<any>(host, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === 0, 'la question', 15_000)
    await lancerQuiz(host, quiz)
    vue = await prete
  }

  for (const t of themes) {
    await enQuestion()
    const r = await ecrire(url, '/api/joueur/moi', { theme: t.key === 'velours' ? null : t.key }, profil, 'PUT')
    if (!r.ok) throw new Error(`Camille ne porte pas ${t.key} (${r.status})`)
    await telephone.goto(`${url}/${ADMIN.slug}`)
    // Une fonction, pas un texte : la politique de sécurité de la page refuse
    // `eval`. `globalThis` : le serveur se compile sans les types du navigateur.
    await telephone.waitForFunction(
      (cle: string) => ((globalThis as any).document.documentElement.dataset.theme ?? 'velours') === cle,
      t.key,
      { timeout: 15_000 },
    )
    await telephone.locator('.ans-btn').first().waitFor({ timeout: 15_000 })
    await telephone.evaluate('document.fonts.ready')
    await patienter(400)
    const png: Buffer = await telephone.screenshot({ type: 'png', clip: { x: 0, y: 0, width: LARGEUR, height: HAUTEUR } })
    const webp = (await atelier.evaluate(
      `(async () => {
        const img = new Image()
        img.src = 'data:image/png;base64,${png.toString('base64')}'
        await img.decode()
        const c = document.createElement('canvas')
        c.width = ${Math.round(LARGEUR * ECHELLE)}
        c.height = ${Math.round(HAUTEUR * ECHELLE)}
        const g = c.getContext('2d')
        g.imageSmoothingQuality = 'high'
        g.drawImage(img, 0, 0, c.width, c.height)
        return c.toDataURL('image/webp', 0.82).split(',')[1]
      })()`,
    )) as string
    const fichier = path.join(sortie, `${t.key}.webp`)
    writeFileSync(fichier, Buffer.from(webp, 'base64'))
    console.log(`  ${t.key.padEnd(14)} ${Math.round(Buffer.from(webp, 'base64').length / 1024)} Ko`)
  }
  await navigateur.close()
} finally {
  await banc.close()
}
