// « Nouveau quiz » puis « Mes quiz » sans rien écrire ; « Coller une liste »
// puis « Annuler » : que reste-t-il dans la bibliothèque ?
import { chromium, nouveauContexte, connecter, api, PORTABLE } from './outils.mjs'

const browser = await chromium.launch()
const page = await (await nouveauContexte(browser, PORTABLE)).newPage()
await connecter(page, '/edit')
const avant = (await api(page, '/api/quizzes')).json.length
await page.getByRole('button', { name: 'Nouveau quiz', exact: true }).click()
await page.waitForSelector('.editor-header.is-collant')
await page.getByRole('button', { name: 'Mes quiz', exact: true }).click()
await page.waitForSelector('.quiz-list')
await page.getByRole('button', { name: 'Coller une liste', exact: true }).first().click()
await page.waitForSelector('.import-panel')
await page.getByRole('button', { name: 'Annuler', exact: true }).click()
await page.getByRole('button', { name: 'Mes quiz', exact: true }).click()
await page.waitForSelector('.quiz-list')
const apres = (await api(page, '/api/quizzes')).json
console.log(`quiz avant : ${avant} · après deux abandons : ${apres.length}`)
console.log('les deux premiers :', apres.slice(0, 2).map(q => `${q.title} (${q.questionCount})`).join(' · '))
await browser.close()
