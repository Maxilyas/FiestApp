// L'éditeur au téléphone (360 × 640) : une carte de question, ses commandes,
// et le chemin jusqu'à la question « à compléter ».
import { chromium, nouveauContexte, connecter, api, capture, hauteur, TELEPHONE, PORTABLE, BASE } from './outils.mjs'

const browser = await chromium.launch()
const ctx = await nouveauContexte(browser, TELEPHONE, true)
const page = await ctx.newPage()
await connecter(page, '/edit')
const liste = (await api(page, '/api/quizzes')).json
const q90 = liste.find(q => q.title === 'Soirée années 90')
await page.goto(`${BASE}/edit?quiz=${q90.id}`)
await page.waitForSelector('.question-card')
await page.waitForTimeout(500)
await capture(page, '05a-editeur-360-haut')
const h = await hauteur(page)
console.log('éditeur au téléphone, 15 questions :', h, 'px =', (h / 640).toFixed(1), 'écrans')
const carte = page.locator('.question-card').first()
const box = await carte.boundingBox()
console.log('une carte au téléphone :', Math.round(box.height), 'px')
const commandes = await carte.locator('button:visible, input:visible, select:visible, textarea:visible').count()
console.log('commandes dans une carte QCM :', commandes)
await carte.scrollIntoViewIfNeeded()
await page.evaluate(() => window.scrollTo(0, document.querySelector('.question-card').getBoundingClientRect().top + window.scrollY - 70))
await page.waitForTimeout(300)
await capture(page, '05b-editeur-360-carte')

// Au portable, même quiz : une carte, ses commandes.
const ctxP = await nouveauContexte(browser, PORTABLE)
const p = await ctxP.newPage()
await connecter(p, `/edit?quiz=${q90.id}`)
await p.waitForSelector('.question-card')
const boxP = await p.locator('.question-card').first().boundingBox()
console.log('une carte au portable :', Math.round(boxP.height), 'px')
// Le panneau « Régler tout le quiz »
await p.getByRole('button', { name: 'Régler tout le quiz' }).click()
await p.waitForTimeout(300)
await capture(p, '05c-regler-tout-le-quiz')
// L'aperçu de la question à photo mémoire
const poster = p.locator('.question-card').filter({ hasText: 'posters' })
await poster.scrollIntoViewIfNeeded()
await capture(p, '05d-carte-photo-memoire')
await poster.getByRole('button', { name: /Aperçu/ }).click()
await p.waitForTimeout(800)
await capture(p, '05e-apercu-observation')
await p.waitForTimeout(5200)
await capture(p, '05f-apercu-question')
await browser.close()
