// Agrandir : un téléphone de 320 px, un autre de 360 px au texte à 200 %
// (zoom CSS, comme `zoom 200` du pilote), et l'écran commun à 200 %
// (683 × 384 CSS). Sur la question ouverte et la révélation : défilement
// horizontal, boutons hors de l'écran, focus caché sous un bandeau fixe.
import { navigateur, contexte, BASE } from './commun.mjs'
const CAP = process.env.CAPTURES ?? '.'
const b = await navigateur()
const etat = async (page, nom) => {
  const r = await page.evaluate(() => {
    const d = document.documentElement, W = innerWidth
    const coupes = [...document.querySelectorAll('button, a, input, h1, h2, h3, p, .ans-btn')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > W + 1 || r.left < -1) }).map(e => (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30))
    return { largeurPage: d.scrollWidth, fenetre: W, hauteurPage: d.scrollHeight, hauteurFenetre: innerHeight, horsCadre: coupes.slice(0, 8) }
  })
  console.log(nom, JSON.stringify(r))
  await page.screenshot({ path: `${CAP}/reflow-${nom}.png` })
}
const h = await (await contexte(b, { viewport: { width: 683, height: 384 }, deviceScaleFactor: 2 })).newPage()
await h.goto(BASE + '/connexion?next=/host')
await h.fill('#login', 'iris'); await h.fill('#password', 'irisiris1'); await h.keyboard.press('Enter')
await h.waitForURL(u => u.pathname === '/host'); await h.waitForTimeout(1000)
const tels = []
for (const [nom, w, zoom] of [['t320', 320, 100], ['t360z200', 360, 200]]) {
  const ctx = await contexte(b, { viewport: { width: w, height: 640 }, isMobile: true, hasTouch: true })
  if (zoom !== 100) await ctx.addInitScript(z => { const f = () => { document.documentElement.style.zoom = z + '%' }; f(); document.addEventListener('DOMContentLoaded', f) }, zoom)
  const p = await ctx.newPage()
  await p.goto(BASE + '/chez-iris'); await p.waitForTimeout(800)
  await etat(p, `${nom}-entree`)
  await p.getByRole('button', { name: 'Jouer sans compte' }).click(); await p.waitForTimeout(400)
  await etat(p, `${nom}-prenom`)
  await p.getByLabel('Ton prénom').fill(nom); await p.getByRole('button', { name: /Rejoindre|Continuer/ }).click()
  tels.push([nom, p])
}
await h.reload(); await h.waitForTimeout(1200)
await etat(h, 'tele200-attente')
const lancer = h.getByRole('button', { name: 'Lancer un quiz' })
if (await lancer.count()) { await lancer.click(); await h.waitForTimeout(600) }
await h.getByRole('button', { name: "C'est parti !" }).first().click()
await tels[0][1].locator('.ans-btn:not([disabled])').first().waitFor({ timeout: 30000 }); await h.waitForTimeout(600)
for (const [nom, p] of tels) await etat(p, `${nom}-question`)
await etat(h, 'tele200-question')
// focus sur le premier bouton de réponse : caché sous la console fixe ?
for (const [nom, p] of tels) { await p.locator('.ans-btn').first().click() }
await tels[0][1].getByText('La bonne réponse').waitFor({ timeout: 90000 }); await h.waitForTimeout(800)
for (const [nom, p] of tels) await etat(p, `${nom}-revelation`)
await etat(h, 'tele200-revelation')
await b.close()
