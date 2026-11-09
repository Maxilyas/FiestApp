// Reproduction de la tablée du 9 novembre 2026 : des équipes créées quand des
// invités sont déjà en salle d'attente — leur téléphone le leur propose-t-il,
// et que reste-t-il de ce choix une fois le quiz lancé, puis au podium ?
// Verdict : en salle d'attente, la carte « Les équipes » et « Choisir mon
// équipe » paraissent ; à la révélation, plus de bouton ; au podium, plus
// rien ; le bouton ne revient qu'une fois le quiz terminé.
// Depuis server/, client construit : node --import tsx <ce fichier>
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { attendre, connexionAnimateur, creerQuiz, demarrer, ecranCommun, lancerQuiz, qcm } from '../../../server/test/banc.ts'

const { chromium } = createRequire(import.meta.url)('playwright')
const banc = await demarrer({ clientDist: fileURLToPath(new URL('../../../client/dist', import.meta.url)) })
const navigateur = await chromium.launch()
try {
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Une ?', ['Oui', 'Non'], 0, 30)])
  const host = await ecranCommun(banc.url, cookie)
  const page = await navigateur.newPage({ viewport: { width: 412, height: 915 } })
  await page.goto(`${banc.url}/banc`)
  await page.getByRole('button', { name: 'Jouer sans compte' }).click()
  await page.locator('#join-name').fill('Jeanne')
  await page.getByRole('button', { name: 'Rejoindre la soirée' }).click()
  await page.locator('.player-shell').waitFor()
  const dit = async (quand: string) => {
    const texte = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
    const bouton = await page.getByRole('button', { name: /Choisir mon équipe|Changer/ }).count()
    console.log(`${quand} — carte « Les équipes » : ${/Les équipes/i.test(texte) ? 'oui' : 'non'} ; bouton pour choisir : ${bouton ? 'oui' : 'non'}`)
  }
  await dit('en salle d’attente, sans équipes')
  ;(host as any).emit('host:seedTeams', { count: 2 })
  await page.waitForTimeout(1200)
  await dit('en salle d’attente, les équipes créées après son entrée')

  const question = attendre<any>(host, 'session:view', p => p.view.phase === 'question', 'la question', 15_000)
  const sessionId = await lancerQuiz(host, quiz)
  const q = (await question).view
  await page.locator('.ans-btn').first().waitFor()
  await page.locator('.ans-btn').first().click()
  const revelee = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'la révélation', 15_000)
  const r = (await revelee).view
  await page.waitForTimeout(800)
  await dit('à la révélation')
  const podium = attendre<any>(host, 'session:view', p => p.view.phase === 'finished', 'le podium', 15_000)
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: 0, round: r.round } }, () => {})
  await podium
  await page.waitForTimeout(1200)
  await dit('au podium du quiz')
  ;(host as any).emit('host:endSession', { sessionId })
  await page.waitForTimeout(1500)
  await dit('de retour en salle d’attente, le quiz terminé')
  void q
} finally {
  await navigateur.close()
  await banc.close()
}
