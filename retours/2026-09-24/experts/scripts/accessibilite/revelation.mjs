// La révélation et la pause, mesurées : contrastes de l'écran commun (Velours
// puis Ivoire) et du téléphone, annonces du téléphone pendant une pause, et
// les dialogues de la console au clavier (focus à l'ouverture, piège de Tab,
// Échap, retour du focus). Des fantômes dans le salon, un quiz prêt.
import { navigateur, contexte, focus, mesurer, BASE } from './commun.mjs'

const CAP = process.env.CAPTURES ?? '.'
const b = await navigateur()
const log = (...a) => console.log(...a)
const h = await (await contexte(b, { viewport: { width: 1366, height: 768 } })).newPage()
await h.goto(BASE + '/connexion?next=/host')
await h.fill('#login', 'iris'); await h.fill('#password', 'irisiris1'); await h.keyboard.press('Enter')
await h.waitForURL(u => u.pathname === '/host'); await h.waitForTimeout(1200)

const p = await (await contexte(b, { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true })).newPage()
await p.goto(BASE + '/chez-iris')
await p.getByRole('button', { name: 'Jouer sans compte' }).click()
await p.getByLabel('Ton prénom').fill('Oreille'); await p.getByRole('button', { name: /Rejoindre|Continuer/ }).click()
await p.waitForTimeout(1500)

// Dialogue « Exclure » au clavier, en salle d'attente
const dialogue = async nom => {
  const d = await h.evaluate(() => { const x = document.querySelector('[role=dialog],[role=alertdialog],dialog[open]'); return x ? { role: x.getAttribute('role') || 'dialog', modal: x.getAttribute('aria-modal'), nom: x.getAttribute('aria-labelledby') ? document.getElementById(x.getAttribute('aria-labelledby'))?.innerText : x.getAttribute('aria-label') } : null })
  const f0 = await focus(h)
  const tour = []
  for (let i = 0; i < 8; i++) { await h.keyboard.press('Tab'); tour.push(await h.evaluate(() => !!document.activeElement?.closest('[role=dialog],[role=alertdialog],dialog'))) }
  await h.keyboard.press('Escape'); await h.waitForTimeout(300)
  log(`${nom} : ${JSON.stringify(d)} · focus à l'ouverture ${JSON.stringify(f0)} · 8 Tab restés dedans : ${tour.every(Boolean)} · après Échap, focus ${JSON.stringify(await focus(h))}`)
}
const excl = h.getByRole('button', { name: /^Exclure Oreille/ })
if (await excl.count()) { await excl.focus(); await h.keyboard.press('Enter'); await h.waitForTimeout(400); await dialogue('Dialogue « Exclure »') }
const surnom = h.getByRole('button', { name: /^Donner un surnom à Oreille/ })
if (await surnom.count()) { await surnom.focus(); await h.keyboard.press('Enter'); await h.waitForTimeout(400); await dialogue('Dialogue « surnom »') }

// Lancer
const lancer = h.getByRole('button', { name: 'Lancer un quiz' })
if (await lancer.count()) { await lancer.click(); await h.waitForTimeout(600) }
await h.getByRole('button', { name: "C'est parti !" }).first().click()

// Question 1 ouverte
await p.locator('.ans-btn:not([disabled])').first().waitFor({ timeout: 30000 })
await p.waitForTimeout(800)
log('\nQuestion ouverte — téléphone, textes sous le seuil :', JSON.stringify(await mesurer(p)))
log('Question ouverte — écran commun Velours :', JSON.stringify(await mesurer(h)))
// Pause par l'animateur
const pause = h.getByRole('button', { name: 'Pause' })
await p.evaluate(() => window.__annonces.splice(0))
await pause.click(); await h.waitForTimeout(1500)
log('Pendant la pause — annonces du téléphone :', JSON.stringify(await p.evaluate(() => window.__annonces.splice(0).map(a => a.texte.slice(0, 200)))))
log('   boutons de réponse désactivés ?', await p.locator('.ans-btn[disabled], .ans-btn[aria-disabled=true]').count(), '/', await p.locator('.ans-btn').count(), '· texte visible :', (await p.locator('.quiz-player').innerText()).replace(/\s+/g, ' ').slice(0, 200))
await p.screenshot({ path: `${CAP}/pause-tel.png` })
await h.getByRole('button', { name: 'Reprendre' }).click()
await p.locator('.ans-btn:not([disabled])').nth(1).click()

// Révélation
await p.getByText('La bonne réponse').waitFor({ timeout: 90000 })
await h.waitForTimeout(1200)
log('\nRévélation — téléphone :', JSON.stringify(await mesurer(p)))
log('Révélation — écran commun Velours :', JSON.stringify(await mesurer(h)))
await h.screenshot({ path: `${CAP}/revelation-velours.png` })
await h.getByRole('button', { name: 'Passer sur fond clair' }).click(); await h.waitForTimeout(600)
log('Révélation — écran commun Ivoire :', JSON.stringify(await mesurer(h)))
await h.screenshot({ path: `${CAP}/revelation-ivoire.png` })
const sons = h.locator('button[aria-label*="sons"]')
log('Bouton du son :', JSON.stringify(await sons.evaluate(e => ({ nom: e.getAttribute('aria-label'), pressed: e.getAttribute('aria-pressed') }))))
const theme = h.locator('button[aria-label*="fond"]')
log('Bouton du thème :', JSON.stringify(await theme.evaluate(e => ({ nom: e.getAttribute('aria-label'), pressed: e.getAttribute('aria-pressed') }))))
await theme.click()

// Terminer le quiz puis clore la soirée : le dialogue au clavier
const terminer = h.getByRole('button', { name: 'Terminer' })
await terminer.focus(); await h.keyboard.press('Enter'); await h.waitForTimeout(500)
if (await h.locator('[role=dialog],[role=alertdialog]').count()) await dialogue('Dialogue « Terminer »')
log('\nfin du script')
await b.close()
