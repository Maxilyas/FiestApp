// Une partie jouée de bout en bout : l'écran commun (1366 × 768) lance le
// quiz d'Iris, un téléphone (360 × 640) y joue au clavier seul. À chaque
// écran nouveau : axe sur les deux, ce que les régions live ont annoncé
// depuis l'écran d'avant, et où est le focus du téléphone.
//   AXE=… BASE=… node partie.mjs > partie.txt   (des fantômes dans le salon aident)
import { navigateur, contexte, axe, focus, resumerAxe, BASE } from './commun.mjs'
import { writeFileSync } from 'node:fs'

const b = await navigateur()
const out = []
const log = (...a) => { const l = a.join(' '); out.push(l); console.error(l) }
const pc = await contexte(b, { viewport: { width: 1366, height: 768 } })
const h = await pc.newPage()
await h.goto(BASE + '/connexion?next=/host')
await h.fill('#login', 'iris'); await h.fill('#password', 'irisiris1'); await h.keyboard.press('Enter')
await h.waitForURL(u => u.pathname === '/host')

const tel = await contexte(b, { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true })
const p = await tel.newPage()
await p.goto(BASE + '/chez-iris')
await p.getByRole('button', { name: 'Jouer sans compte' }).click()
await p.getByLabel('Ton prénom').fill('Clavier')
// Au clavier : Entrée dans le champ du prénom
await p.getByLabel('Ton prénom').press('Enter')
await p.waitForTimeout(1500)
log('téléphone après Entrée dans le prénom :', JSON.stringify(await focus(p)), '·', (await p.locator('body').innerText()).slice(0, 120).replace(/\s+/g, ' '))
const rejoindre = p.getByRole('button', { name: /Rejoindre|Continuer/ })
if (await rejoindre.count()) { await rejoindre.first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(1000) }
log('téléphone en salle d\'attente, focus :', JSON.stringify(await focus(p)))

// L'animateur lance le quiz, au clavier aussi
await h.reload(); await h.waitForTimeout(1500)
const lancer = h.getByRole('button', { name: 'Lancer un quiz' })
if (await lancer.count()) { await lancer.focus(); await h.keyboard.press('Enter'); await h.waitForTimeout(800) }
log('écran commun après « Lancer un quiz » : focus', JSON.stringify(await focus(h)))
const parti = h.getByRole('button', { name: "C'est parti !" }).first()
await parti.focus(); await h.keyboard.press('Enter'); await h.waitForTimeout(500)
log('écran commun après « C\'est parti ! » : focus', JSON.stringify(await focus(h)))

let derniere = '', immobile = 0, n = 0
const debut = Date.now()
const signature = async () => {
  const hs = await h.locator('.host-top, header').first().innerText().catch(() => '')
  const ps = await p.locator('body').innerText().catch(() => '')
  return (hs.split('\n').slice(0, 3).join('|') + ' // ' + ps.split('\n').slice(0, 2).join('|')).replace(/\d+ ?s\b|\b\d{1,2}\b(?= *$)/g, '')
}
while (Date.now() - debut < 6 * 60_000) {
  await p.waitForTimeout(700)
  const s = await signature()
  if (s !== derniere) {
    derniere = s; immobile = 0; n++
    await p.waitForTimeout(400)
    const ann = await p.evaluate(() => window.__annonces.splice(0))
    const annH = await h.evaluate(() => window.__annonces.splice(0))
    log(`\n=== écran ${n} · ${s}`)
    log('  focus téléphone :', JSON.stringify(await focus(p)))
    for (const a of ann) log(`  🔊 tél [${a.region}] (${a.longueur} car.) ${a.texte.slice(0, 220)}`)
    for (const a of annH) log(`  🔊 télé [${a.region}] (${a.longueur} car.) ${a.texte.slice(0, 160)}`)
    for (const [pg, nom] of [[p, 'tél'], [h, 'télé']]) {
      const r = await axe(pg, `${nom} écran ${n}`)
      const v = r.violations.filter(x => !['region', 'landmark-one-main', 'page-has-heading-one'].includes(x.id))
      if (v.length) log(resumerAxe({ ...r, violations: v }).replace(/^/gm, '  '))
    }
    await p.screenshot({ path: `${process.env.CAPTURES ?? '.'}/tel-${n}.png` })
    await h.screenshot({ path: `${process.env.CAPTURES ?? '.'}/tele-${n}.png` })
    // Jouer au clavier : Tab jusqu'à une réponse, Entrée
    const guess = p.locator('.guess-form input')
    if (await guess.count() && await guess.isEnabled()) {
      await guess.focus(); await p.keyboard.type('8000'); await p.keyboard.press('Enter')
      await p.waitForTimeout(600); log('  → estimation tapée, Entrée ; focus', JSON.stringify(await focus(p)))
    } else if (await p.locator('.ans-btn:not([disabled])').count()) {
      let tabs = 0
      await p.evaluate(() => document.activeElement?.blur())
      for (; tabs < 15; tabs++) { await p.keyboard.press('Tab'); if ((await focus(p)).element.startsWith('button.ans-btn')) break }
      await p.keyboard.press('Enter'); await p.waitForTimeout(600)
      log(`  → réponse au clavier après ${tabs + 1} Tab ; focus`, JSON.stringify(await focus(p)))
    }
  } else if (++immobile > 18) {
    // L'animateur avance, au clavier : le bouton principal de la console
    const btn = h.locator('.host-console .btn-primary, footer .btn-primary').first()
    if (await btn.count()) { const t = await btn.innerText(); await btn.focus(); await h.keyboard.press('Enter'); log(`  ⏭ animateur : « ${t.trim()} »`) }
    immobile = 0
  }
  if (/Clore|clôtur/i.test(derniere) && n > 20) break
}
writeFileSync(process.env.SORTIE ?? 'partie.txt', out.join('\n'))
await b.close()
