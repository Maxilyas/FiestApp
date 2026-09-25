// Partir du modèle « Qui connaît le mieux [Prénom] ? » et le personnaliser
// pour Julie, comme un animateur : on compte les gestes et les frappes.
import { chromium, nouveauContexte, connecter, capture, hauteur, PORTABLE } from './outils.mjs'

const browser = await chromium.launch()
const ctx = await nouveauContexte(browser, PORTABLE)
const page = await ctx.newPage()
await connecter(page, '/edit')
let gestes = 0
let frappes = 0
const g = () => gestes++

await page.getByRole('button', { name: "Partir d'un modèle" }).click(); g()
await page.waitForTimeout(500)
await capture(page, '03a-partir-d-un-modele')
await page.getByRole('button', { name: /Partir de « ⭐ Qui connaît/ }).click(); g()
await page.waitForSelector('.question-card')
await page.waitForTimeout(500)
await capture(page, '03b-modele-ouvert-1366')
console.log('hauteur de l’éditeur (8 questions) :', await hauteur(page), 'px')

// Le titre.
const titre = page.getByLabel('Titre du quiz')
await titre.fill('Qui connaît le mieux Julie ? 🎂'); g(); frappes += 31

// Chaque intitulé : remplacer [Prénom], il/elle, né·e.
const cartes = page.locator('.question-card')
const n = await cartes.count()
for (let i = 0; i < n; i++) {
  const zone = page.getByLabel(`Intitulé de la question ${i + 1}`)
  const avant = await zone.inputValue()
  const apres = avant
    .replaceAll('[Prénom]', 'Julie')
    .replaceAll('il/elle', 'elle')
    .replaceAll('né·e', 'née')
  if (apres !== avant) {
    await zone.fill(apres); g(); frappes += apres.length
  }
  // Les réponses « Ville A ✏️ »… : quatre champs par QCM.
  for (let r = 0; r < 4; r++) {
    const champ = cartes.nth(i).getByLabel(`Réponse ${r + 1}`, { exact: true })
    if (!(await champ.count())) continue
    const v = await champ.inputValue()
    if (v.includes('✏️')) {
      const nouveau = `Choix ${r + 1}`
      await champ.fill(nouveau); g(); frappes += nouveau.length
    }
  }
}
console.log(`personnaliser le modèle : ${gestes} gestes, ~${frappes} caractères tapés (sans réfléchir aux réponses)`)
// La bonne réponse est-elle restée la première partout ?
await page.waitForTimeout(300)
const alerte = await page.locator('text=La bonne réponse est la première').count()
console.log('alerte « bonne réponse en premier » :', alerte > 0)
await capture(page, '03c-modele-perso-apres')
await page.getByRole('button', { name: 'Enregistrer' }).click()
await page.waitForTimeout(800)
await capture(page, '03d-modele-enregistre')
await browser.close()
