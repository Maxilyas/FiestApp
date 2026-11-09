// Reproduction de la tablée du 9 novembre 2026 : une question révélée trop
// tôt, puis reposée — revient-elle sur le téléphone des invités ?
// Verdict : elle revient sur les deux téléphones, celui qui n'avait pas
// répondu compris — le constat venait du geste `question` de la régie.
// Depuis server/, client construit : node --import tsx <ce fichier>
import os from 'node:os'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { attendre, connexionAnimateur, creerQuiz, demarrer, ecranCommun, lancerQuiz, qcm } from '../../../server/test/banc.ts'

const { chromium } = createRequire(import.meta.url)('playwright')
const sortie = os.tmpdir()

const banc = await demarrer({ clientDist: fileURLToPath(new URL('../../../client/dist', import.meta.url)) })
const navigateur = await chromium.launch()
const etat = async (page: any) =>
  page.evaluate(() => ({
    reponses: document.querySelectorAll('.ans-btn').length,
    bandeau: !!document.querySelector('.result-banner'),
    texte: (document.querySelector('.player-shell') as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').slice(0, 160),
  }))
try {
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Combien de poumons ?', ['1', '2', '3', '4'], 1, 50), qcm('Deux ?')])
  const host = await ecranCommun(banc.url, cookie)
  const entrer = async (prenom: string) => {
    const page = await navigateur.newPage({ viewport: { width: 412, height: 915 } })
    await page.goto(`${banc.url}/banc`)
    await page.getByRole('button', { name: 'Jouer sans compte' }).click()
    await page.locator('#join-name').fill(prenom)
    await page.getByRole('button', { name: 'Rejoindre la soirée' }).click()
    await page.locator('.player-shell').waitFor()
    return page
  }
  const alice = await entrer('Alice')
  const bob = await entrer('Bob')
  await new Promise(r => setTimeout(r, 500))

  const question = attendre<any>(host, 'session:view', p => p.view.phase === 'question', 'la question', 15_000)
  const sessionId = await lancerQuiz(host, quiz)
  const q = (await question).view
  await alice.locator('.ans-btn').first().waitFor()
  await bob.locator('.ans-btn').first().waitFor()
  // Alice répond, Bob non ; l'animatrice révèle trop tôt.
  await alice.locator('.ans-btn').nth(0).click()
  await new Promise(r => setTimeout(r, 400))
  const revelee = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'la révélation', 15_000)
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', qIndex: 0, round: q.round } }, () => {})
  const r = (await revelee).view
  await new Promise(r => setTimeout(r, 1500))
  console.log('à la révélation — Alice :', JSON.stringify(await etat(alice)))
  console.log('à la révélation — Bob   :', JSON.stringify(await etat(bob)))

  const reposee = attendre<any>(host, 'session:view', p => p.view.phase === 'question' && p.view.round !== q.round, 'la question reposée', 15_000)
  ;(host as any).emit('host:command', { sessionId, command: { type: 'replay', phase: 'reveal', qIndex: 0, round: r.round } }, () => {})
  await reposee
  await new Promise(r => setTimeout(r, 2500))
  const a = await etat(alice)
  const b = await etat(bob)
  console.log('reposée — Alice :', JSON.stringify(a))
  console.log('reposée — Bob   :', JSON.stringify(b))
  await alice.screenshot({ path: `${sortie}/reposee-alice.png` })
  await bob.screenshot({ path: `${sortie}/reposee-bob.png` })
} finally {
  await navigateur.close()
  await banc.close()
}
