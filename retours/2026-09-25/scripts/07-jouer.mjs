// Jouer « Soirée années 90 » à l'écran commun avec le robot : trouver le quiz
// parmi quarante, puis regarder la révélation d'une question.
import { chromium, nouveauContexte, connecter, capture, PORTABLE } from './outils.mjs'

const browser = await chromium.launch()
const page = await (await nouveauContexte(browser, PORTABLE)).newPage()
await connecter(page, '/host')
await page.waitForTimeout(1000)
await page.getByRole('button', { name: /Lancer un quiz/ }).first().click()
await page.waitForTimeout(800)
// Où est « Soirée années 90 » dans la liste ?
const titres = await page.locator('.game-card h3').allInnerTexts()
console.log('rang de « Soirée années 90 » dans le choix :', titres.indexOf('Soirée années 90') + 1, 'sur', titres.length)
console.log('les six premiers :', titres.slice(0, 6).join(' | '))
const carte = page.locator('.game-card').filter({ hasText: 'Soirée années 90' })
await carte.scrollIntoViewIfNeeded()
await carte.getByRole('button', { name: /C'est parti/ }).click()
// 3-2-1, puis la question 1 ; le robot répond ; on révèle.
await page.waitForTimeout(5000)
await capture(page, '07a-question-1366')
await page.getByRole('button', { name: /Révéler/ }).first().click().catch(() => {})
await page.waitForTimeout(1800)
await capture(page, '07b-revelation-1366')
await browser.close()
