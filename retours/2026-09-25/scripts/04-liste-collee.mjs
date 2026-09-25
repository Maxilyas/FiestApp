// Un quiz « Années 90 » écrit dans ses notes, collé par « Coller une liste »
// depuis Mes quiz, photos jointes. Ce qui entre, ce qui est dit, ce qui manque.
import { readFileSync } from 'node:fs'
import { chromium, nouveauContexte, connecter, capture, hauteur, PORTABLE, SCR } from './outils.mjs'

const browser = await chromium.launch()

// Deux « photos » fabriquées pour l'essai.
const atelier = await browser.newPage({ viewport: { width: 800, height: 600 } })
for (const [nom, fond, texte] of [
  ['tamagotchi', '#f3c6d8', '🥚 Tamagotchi'],
  ['chambre-ado', '#c6d8f3', '🖼️ 🖼️ 🖼️ 🖼️ — la chambre'],
]) {
  await atelier.setContent(`<body style="margin:0;background:${fond};display:grid;place-items:center;height:600px;font:48px sans-serif">${texte}</body>`)
  await atelier.screenshot({ path: `${SCR}/${nom}.jpg`, type: 'jpeg', quality: 80 })
}
await atelier.close()

const ctx = await nouveauContexte(browser, PORTABLE)
const page = await ctx.newPage()
await connecter(page, '/edit')
await page.getByRole('button', { name: 'Coller une liste' }).first().click()
await page.waitForSelector('.import-panel')
await page.waitForTimeout(400)
await capture(page, '04a-coller-une-liste-vide')

const texte = readFileSync(new URL('./liste-annees-90.txt', import.meta.url), 'utf8')
await page.locator('.import-area').fill(texte)
await page.waitForTimeout(400)
const resume = await page.locator('.import-panel > p.warn, .import-panel > p.muted').last().innerText()
console.log('résumé du panneau :', resume)
await page.locator('.import-panel input[type="file"]').setInputFiles([`${SCR}/tamagotchi.jpg`, `${SCR}/chambre-ado.jpg`])
await page.waitForTimeout(400)
await capture(page, '04b-liste-collee-panneau', true)

await page.getByRole('button', { name: 'Ajouter au quiz' }).click()
await page.waitForTimeout(2500)
await page.getByLabel('Titre du quiz').fill('Soirée années 90')
const pretes = await page.locator('.editor-header .muted').first().innerText()
console.log('après ajout :', pretes)
const problemes = await page.locator('.question-card p.warn').allInnerTexts()
console.log('avertissements sur les cartes :', JSON.stringify(problemes, null, 1))
console.log('hauteur de l’éditeur (16 questions) :', await hauteur(page), 'px =', ((await hauteur(page)) / 768).toFixed(1), 'écrans')
await capture(page, '04c-apres-ajout')
// La question à cinq réponses : que reste-t-il ?
const joey = page.locator('.question-card').filter({ hasText: 'Joey' })
const reponsesJoey = await joey.locator('.answers-edit input.input').evaluateAll(els => els.map(e => e.value))
console.log('Joey, réponses gardées :', JSON.stringify(reponsesJoey))
// La question à deux étoiles.
const spice = page.locator('.question-card').filter({ hasText: 'Lesquels de ces prénoms' })
await spice.scrollIntoViewIfNeeded()
await capture(page, '04d-deux-etoiles')
// L'emoji récent : rien ne le signale ?
const emoji = page.locator('.question-card').filter({ hasText: 'Toy' })
console.log('question à emoji récent, avertissement :', JSON.stringify(await emoji.locator('p.warn').allInnerTexts()))
await page.getByRole('button', { name: 'Enregistrer' }).click()
await page.waitForTimeout(1000)
await browser.close()
