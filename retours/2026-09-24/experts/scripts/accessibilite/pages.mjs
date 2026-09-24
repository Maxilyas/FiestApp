// axe-core et un tour au clavier (Tab) sur les pages fixes, invité et
// animateur, dans les deux habillages quand la page en a deux.
//   AXE=…/axe.min.js BASE=http://localhost:42211 IDENT=iris MDP=… node pages.mjs > pages.txt
import { navigateur, contexte, axe, focus, resumerAxe, mesurer, BASE } from './commun.mjs'

const b = await navigateur()
const sortie = []
const tabuler = async (page, n = 40) => {
  const arrets = []
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0) })
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab')
    const f = await focus(page)
    arrets.push(f)
    if (f.element === 'body' && i > 0) break
  }
  const sansIndicateur = arrets.filter(f => f.element !== 'body' && f.outline === 'aucun' && f.boxShadow === 'non')
  return { arrets: arrets.length, sansIndicateur }
}

async function auditer(page, etiquette, { clavier = true } = {}) {
  await page.waitForTimeout(800)
  const r = await axe(page, etiquette)
  sortie.push(resumerAxe(r))
  const titre = await page.title()
  const h1 = await page.locator('h1').allInnerTexts()
  sortie.push(`  titre : « ${titre} » · h1 : ${JSON.stringify(h1)}`)
  const petits = await page.evaluate(() => [...document.querySelectorAll('button, a, input[type=radio], input[type=checkbox], select')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.width < 24 || r.height < 24) }).map(e => `${(e.getAttribute('aria-label') || e.innerText || e.tagName).trim().slice(0, 30)} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`))
  if (petits.length) sortie.push(`  cibles < 24 px (2.5.8) : ${petits.length} — ${petits.slice(0, 6).join(' · ')}`)
  const faibles = await mesurer(page)
  if (faibles.length) sortie.push(`  contrastes sous le seuil : ${JSON.stringify(faibles.slice(0, 6))}`)
  if (clavier) {
    const t = await tabuler(page)
    sortie.push(`  Tab : ${t.arrets} arrêts, ${t.sansIndicateur.length} sans indicateur visible (ni outline ni ombre)`)
    for (const f of t.sansIndicateur.slice(0, 8)) sortie.push(`      ${f.element} « ${f.nom} » (bord ${f.bord})`)
  }
}

// ── L'invité, 360 × 640
const tel = await contexte(b, { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const p = await tel.newPage()
await p.goto(BASE + '/'); await auditer(p, 'accueil / (360)')
await p.goto(BASE + '/chez-iris'); await auditer(p, 'entrée /chez-iris (360)')
await p.getByRole('button', { name: 'Jouer sans compte' }).click(); await auditer(p, 'entrée · jouer sans compte (360)')
await p.getByRole('button', { name: 'Créer un profil' }).click().catch(() => {})
await p.goto(BASE + '/chez-iris'); await p.getByRole('button', { name: 'Créer un profil' }).click(); await auditer(p, 'entrée · créer un profil (360)')
await p.goto(BASE + '/chez-iris/soirees'); await auditer(p, 'historique public (360)')
await p.goto(BASE + '/chez-iris/souvenir'); await auditer(p, 'souvenir de la soirée (360)')
await p.goto(BASE + '/chez-iris/bilan'); await auditer(p, 'bilan de la soirée (360)')

// ── L'animateur, 1366 × 768
const pc = await contexte(b, { viewport: { width: 1366, height: 768 } })
const h = await pc.newPage()
await h.goto(BASE + '/connexion'); await auditer(h, 'connexion animateur (1366)')
await h.fill('#login', process.env.IDENT ?? 'iris'); await h.fill('#password', process.env.MDP ?? 'irisiris1')
await h.keyboard.press('Enter'); await h.waitForURL(u => !u.pathname.startsWith('/connexion'), { timeout: 10000 }).catch(() => sortie.push('(connexion ratée)'))
await h.goto(BASE + '/compte'); await auditer(h, 'compte (1366)')
await h.goto(BASE + '/edit'); await auditer(h, 'mes quiz (1366)')
const ouvrir = h.getByText("Quiz d'Iris").first()
if (await ouvrir.count()) { await ouvrir.click(); await auditer(h, 'éditeur, quiz ouvert (1366)', { clavier: true }) }
await h.goto(BASE + '/host'); await auditer(h, 'écran commun · Velours (1366)')
await h.evaluate(() => { localStorage.setItem('quizz.theme', 'ivoire') }); await h.reload(); await auditer(h, 'écran commun · Ivoire (1366)', { clavier: false })
await h.evaluate(() => { localStorage.setItem('quizz.theme', 'velours') })
await h.goto(BASE + '/admin'); await auditer(h, 'admin (1366)', { clavier: false })
console.log(sortie.join('\n'))
await b.close()
