// L'axe 13 de la tablée du 9 novembre 2026 : « une estimation avalée » chez Lucas, tapée 1,8 s après l'ouverture au profil
// iPhone (`../synthese.md`). Ce script rejoue ses gestes tels que le journal de la tablée les donne — la réponse à la
// question 2, « retour » 0,4 s plus tard, puis `repondre 450` comme la régie le faisait : toucher le champ, le vider, taper,
// Entrée — et écrit ce qui part sur la liaison et ce que le serveur compte.
//
// Ce qu'il montre : aucune réponse perdue. « retour » ouvre « Quitter la soirée ? » (`client/src/retour.ts`), restée sans
// réponse ; la question suivante arrive dessous, inerte. Le toucher n'atteint pas le champ, la frappe n'y entre pas, et
// « Entrée » ferme la fenêtre (« Rester ») : rien n'est parti, le serveur attend toujours Lucas. Sans le « retour », les
// mêmes gestes à 1,8 s inscrivent 450. La régie lisait le téléphone par ses classes, sous la fenêtre, et avalait le refus
// du toucher : c'est elle qui est corrigée (`server/scripts/tablee/gestes.ts`, `LIRE_LA_FENETRE`).
//
//   npm run build, puis : cd server && node --import tsx ../retours/2026-11-09/reproductions/estimation-sous-une-fenetre.mts [retour|sans-retour]
import { createRequire } from 'node:module'
import { attendre, connexionAnimateur, creerQuiz, demarrer, ecranCommun, estimation, invite, lancerQuiz, qcm } from '../../../server/test/banc.ts'

const { chromium } = createRequire(import.meta.url)('playwright')
const avecRetour = (process.argv[2] ?? 'retour') === 'retour'
const banc = await demarrer({ clientDist: new URL('../../../client/dist', import.meta.url).pathname })
const navigateur = await chromium.launch()
const t0 = Date.now()
const dire = (quoi: string) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s  ${quoi}`)
// L'iPhone de la régie (`APPAREILS.iphone`, `server/scripts/tablee/regie.ts`).
const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
}
const FENETRE = `(() => { const f = document.querySelector('[role="dialog"][aria-modal="true"]'); return f ? f.innerText.replace(/\\s+/g, ' ') : null })()`
try {
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [
    qcm('Quel film ?', ['My Fair Lady', 'La Mélodie du bonheur', 'Grease', 'Cabaret'], 1, 60),
    estimation('Combien pèse un ballon de football ?', 450, 'g', 60),
  ])
  const host = await ecranCommun(banc.url, cookie)
  await invite(banc.url, 'Nadia', '🦉') // ne répond jamais : les questions restent ouvertes
  let derniere: any = null
  ;(host as any).on('session:view', (p: any) => (derniere = p.view))
  const vue = (pred: (v: any) => boolean, label: string) =>
    derniere && pred(derniere) ? Promise.resolve(derniere) : attendre<any>(host, 'session:view', p => pred(p.view), label, 20_000).then(p => p.view)
  const commande = (sessionId: string, command: unknown) => (host as any).emit('host:command', { sessionId, command })

  const contexte = await navigateur.newContext(IPHONE)
  contexte.setDefaultTimeout(5000)
  const lucas = await contexte.newPage()
  lucas.on('websocket', (ws: any) => {
    ws.on('framesent', (f: any) => typeof f.payload === 'string' && f.payload.includes('player:action') && dire(`→ parti    ${(/"action":\{[^}]*\}/.exec(f.payload) ?? [''])[0]}`))
  })
  await lucas.goto(`${banc.url}/banc`)
  await lucas.getByRole('button', { name: 'Jouer sans compte' }).tap()
  await lucas.locator('#join-name').fill('Lucas')
  await lucas.getByRole('button', { name: 'Rejoindre la soirée' }).tap()
  await lucas.locator('.player-shell').waitFor()

  const sessionId = await lancerQuiz(host, quiz)
  let v = await vue(x => x.phase === 'question' && x.qIndex === 0, 'la question 1')
  await lucas.locator('.ans-btn').first().waitFor({ timeout: 15_000 })
  await lucas.waitForTimeout(1500)
  await lucas.locator('.ans-btn').nth(1).tap()
  await lucas.waitForTimeout(450)
  if (avecRetour) {
    await lucas.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {})
    await lucas.waitForTimeout(800)
    dire(`« retour » — une fenêtre s'ouvre : ${await lucas.evaluate(FENETRE)}`)
  }
  commande(sessionId, { type: 'next', phase: 'question', qIndex: 0, round: v.round })
  v = await vue(x => x.phase === 'reveal', 'la révélation')
  await lucas.waitForTimeout(2500)
  commande(sessionId, { type: 'next', phase: 'reveal', qIndex: 0, round: v.round })
  await vue(x => x.phase === 'question' && x.qIndex === 1, 'l’estimation')
  const champ = lucas.locator('.quiz-player .guess-form input')
  await champ.waitFor({ timeout: 15_000 })
  dire(`l'estimation est posée — une fenêtre la couvre ? ${(await lucas.evaluate(FENETRE)) ?? 'non'} — la question est-elle inerte ? ${await lucas.evaluate(`!!document.querySelector('.guess-form').closest('[inert]')`)}`)
  await lucas.waitForTimeout(1800)

  // « repondre 450 », geste pour geste : la régie avalait le refus du toucher.
  await champ.tap({ timeout: 4000 }).catch((e: Error) => dire(`le toucher n'arrive pas au champ : ${e.message.split('\n')[0]}`))
  await champ.fill('')
  await champ.pressSequentially('450')
  dire(`tapé — le champ affiche « ${await champ.inputValue()} »`)
  await champ.press('Enter')
  await lucas.waitForTimeout(3000)
  const ecran = await vue(x => x.phase === 'question' && x.qIndex === 1, 'l’estimation, à l’écran commun')
  dire(`après « Entrée » — une fenêtre ? ${(await lucas.evaluate(FENETRE)) ?? 'non'} ; le serveur compte ${ecran.answeredCount} réponse sur ${ecran.participantCount}, et attend : ${(ecran.attendus ?? []).map((a: any) => a.name).join(', ')}`)
  dire(`le téléphone dit : ${(await lucas.locator('.guess-form').innerText()).replace(/\s+/g, ' ')}`)
} finally {
  await navigateur.close()
  await banc.close()
}
