// L'axe 7 de la tablée du 9 novembre 2026 : Karim a répondu réseau coupé, et lu au retour ses points ET « Trop tard — la
// question était finie » (`../synthese.md`). Ce script rejoue ses gestes dans Chromium et écrit ce qui passe sur la liaison :
// chaque `player:action` parti, chaque accusé revenu, chaque message à l'écran.
//
// Ce qu'il montre : hors ligne, Chromium garde la première réponse dans l'ancienne liaison et la livre au retour du réseau
// — le serveur l'inscrit, elle clôt la question (le dernier attendu), et son accusé repart vers une liaison que la page a
// déjà abandonnée. Le renvoi, lui, arrive par la liaison neuve, après la révélation : il recevait `too-late`, et l'écran
// disait « +188 pts » et « arrivée trop tard » ensemble. Depuis `dejaInscrite` (`server/src/games/quiz.ts`), il est
// confirmé : « Ta réponse est bien arrivée ». À deux ou cinq secondes de coupure, l'ancienne liaison rend encore l'accusé.
//
//   npm run build, puis : cd server && node --import tsx ../retours/2026-11-09/reproductions/reponse-reseau-coupe.mts [secondes hors ligne]
import { createRequire } from 'node:module'
import { attendre, connexionAnimateur, creerQuiz, demarrer, ecranCommun, emitAck, invite, lancerQuiz, qcm } from '../../../server/test/banc.ts'

const { chromium } = createRequire(import.meta.url)('playwright')
const horsLigne = Number(process.argv[2] ?? 9) * 1000
const banc = await demarrer({ clientDist: new URL('../../../client/dist', import.meta.url).pathname })
const navigateur = await chromium.launch()
const t0 = Date.now()
const dire = (quoi: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s  ${quoi}`)
try {
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Qu’est-ce qui a emporté les dinosaures ?', ['Le froid', 'L’extinction', 'La faim', 'Un virus'], 1, 60), qcm('Et après ?', ['Oui', 'Non'], 0, 60)])
  const sofia = await invite(banc.url, 'Sofia', '👑')
  const contexte = await navigateur.newContext({ viewport: { width: 360, height: 640 } })
  const karim = await contexte.newPage()
  // Les trames de la liaison, dans les deux sens : seules celles d'une réponse et de son accusé.
  karim.on('websocket', (ws: any) => {
    dire(`liaison ouverte`)
    ws.on('framesent', (f: any) => typeof f.payload === 'string' && f.payload.includes('player:action') && dire(`→ parti    ${f.payload.slice(0, 4)}… player:action`))
    ws.on('framereceived', (f: any) => typeof f.payload === 'string' && /^43\d*\[\{"ok"/.test(f.payload) && dire(`← accusé   ${f.payload.slice(0, 90)}`))
    ws.on('close', () => dire('liaison fermée'))
  })
  await karim.goto(`${banc.url}/banc`)
  await karim.getByRole('button', { name: 'Jouer sans compte' }).click()
  await karim.locator('#join-name').fill('Karim')
  await karim.getByRole('button', { name: 'Rejoindre la soirée' }).click()
  await karim.locator('.player-shell').waitFor()
  // Ce que l'écran lui dit, à chaque changement.
  await karim.exposeFunction('ditALEcran', (texte: string) => dire(`écran : ${texte}`))
  await karim.evaluate(() => {
    let avant = ''
    new MutationObserver(() => {
      const lu = [...document.querySelectorAll('.toast, .result-banner, .hint')].map(e => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ')
      if (lu && lu !== avant) (window as any).ditALEcran((avant = lu))
    }).observe(document.body, { childList: true, subtree: true, characterData: true })
  })

  const host = await ecranCommun(banc.url, cookie)
  const posee = attendre<any>(sofia.socket, 'session:view', p => p.view.phase === 'question', 'la question')
  const sessionId = await lancerQuiz(host, quiz)
  const { view } = await posee
  await karim.locator('.ans-btn').first().waitFor({ timeout: 15_000 })
  dire('la question est posée')
  await emitAck(sofia.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 1, qIndex: 0, round: view.round } })
  dire('Sofia a répondu : Karim est le dernier attendu')

  // Les gestes de Karim, tels que la régie les fait (`reseau coupe`, toucher, `reseau retabli`).
  await contexte.setOffline(true)
  dire('📵 réseau coupé')
  await karim.waitForTimeout(2500)
  await karim.locator('.ans-btn').nth(1).click()
  dire('Karim touche « L’extinction »')
  await karim.waitForTimeout(horsLigne)
  await contexte.setOffline(false)
  dire('📶 réseau rétabli')
  await karim.waitForTimeout(6000)
  const page = (await karim.locator('.player-shell').innerText()).replace(/\s+/g, ' ')
  dire(`à la fin, sa page dit : ${(page.match(/\+\d+ pts[^.]*|Trop tard[^.]*\.|Pas de réponse[^.]*\.|pas arrivée[^.]*\./) ?? ['?'])[0]}`)
} finally {
  await navigateur.close()
  await banc.close()
}
