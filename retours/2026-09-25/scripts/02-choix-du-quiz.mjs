// Le choix du quiz à l'écran commun (1366 × 768) et à la télécommande (360 × 640),
// avec une bibliothèque de quarante quiz.
import { chromium, nouveauContexte, connecter, capture, hauteur, PORTABLE, TELEPHONE } from './outils.mjs'

const browser = await chromium.launch()
const ctx = await nouveauContexte(browser, PORTABLE)
const page = await ctx.newPage()
await connecter(page, '/host')
await page.waitForTimeout(1500)
await capture(page, '02a-host-accueil-1366')
const lancer = page.getByRole('button', { name: /Lancer un quiz/ })
await lancer.first().click()
await page.waitForTimeout(1200)
await capture(page, '02b-host-choix-quiz-1366')
// Combien de cartes de quiz, et combien à l'écran sans défiler ?
const cartes = page.locator('.game-card')
const n = await cartes.count()
let visibles = 0
for (let i = 0; i < n; i++) {
  const b = await cartes.nth(i).boundingBox()
  if (b && b.y + b.height <= 768) visibles++
}
console.log('cartes de quiz :', n, '· entièrement visibles sans défiler :', visibles)
console.log('hauteur de la page de choix :', await hauteur(page))
// Le cadre qui défile ?
const defile = await page.evaluate(() => {
  const g = document.querySelector('.game-cards')
  if (!g) return null
  const cs = getComputedStyle(g)
  let el = g
  while (el && el !== document.body) {
    const s = getComputedStyle(el)
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) return { tag: el.className, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }
    el = el.parentElement
  }
  return { grille: cs.display, cols: cs.gridTemplateColumns }
})
console.log('défilement :', JSON.stringify(defile))
await capture(page, '02c-host-choix-quiz-1366-page-entiere', true)

// La télécommande : /host au téléphone.
const ctxTel = await nouveauContexte(browser, TELEPHONE, true)
const tel = await ctxTel.newPage()
await connecter(tel, '/host')
await tel.waitForTimeout(1500)
await capture(tel, '02d-telecommande-accueil-360')
console.log('hauteur télécommande (choix en cours) :', await hauteur(tel))
await capture(tel, '02e-telecommande-choix-360', false)
await capture(tel, '02f-telecommande-choix-360-page-entiere', true)

// Annuler le choix pour laisser la soirée propre.
await page.getByRole('button', { name: 'Annuler' }).first().click().catch(() => {})
await browser.close()
