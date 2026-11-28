// Joue la maquette d'un bout à l'autre comme un joueur, photographie chaque
// écran et mesure ce qui déborde : `node jouer.mjs <dossier construit> <sortie> [LxH]`.
// Playwright n'est pas une dépendance du dépôt : il vient des modules globaux.
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const require = createRequire(join(execSync('npm root -g').toString().trim(), '_'))
const { chromium } = require('playwright')

const [dossier, sortie, taille = '360x640'] = process.argv.slice(2)
const [w, h] = taille.split('x').map(Number)
mkdirSync(sortie, { recursive: true })

const navigateur = await chromium.launch()
const p = await navigateur.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
const erreurs = []
p.on('pageerror', e => erreurs.push(e.message))
p.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()) })
await p.goto('file://' + resolve(dossier, 'local.html'))

let n = 0
const mesures = []
// Ce qui ne doit jamais arriver : le haut qui défile, la boîte qui grandit, la page plus large que l'écran.
async function photo(nom) {
  await p.waitForTimeout(700)
  const m = await p.evaluate(() => {
    const haut = document.getElementById('haut'), boite = document.getElementById('boite')
    return { deborde: haut.scrollHeight - haut.clientHeight, boite: Math.round(boite.getBoundingClientRect().height), large: document.documentElement.scrollWidth - innerWidth }
  })
  if (m.deborde || m.large || m.boite > 150) mesures.push({ nom, ...m })
  await p.screenshot({ path: join(sortie, `${String(++n).padStart(2, '0')}-${nom}-${taille}.png`) })
}
// Toucher le texte de la boîte, jamais un bouton : finir la réplique qui s'écrit, puis passer à la suivante.
const attend = async () => (await p.locator('#boite.attend').count()) > 0
async function finir() { if (!(await attend())) await p.locator('#texte').click(); await p.waitForTimeout(80) }
async function suite() { await finir(); await p.waitForSelector('#boite.attend', { timeout: 6000 }); await p.locator('#texte').click(); await p.waitForTimeout(150) }
async function repondre(salle, mot) { await p.fill(`#reponse-${salle}`, mot); await p.click(`#reponse-${salle} + button`); await p.waitForTimeout(250) }
const tuile = nom => p.locator('.salle', { hasText: nom })
const menu = libelle => p.locator('#choix button', { hasText: libelle }).click()

await p.waitForSelector('#boite.attend', { timeout: 8000 })
await photo('arrivee')
for (let i = 0; i < 4; i++) await suite()
await finir(); await photo('etage')

await tuile('Les vers').click(); await p.waitForTimeout(3200); await finir(); await photo('vers')
await repondre('vers', 'un chameau'); await finir(); await photo('vers-faux')
await repondre('vers', 'le mirage'); await finir(); await photo('vers-brule')
await repondre('vers', "c'est l'Oasis"); await finir(); await photo('vers-gagne')
await suite(); await finir()

await tuile('Les mots').click(); await p.waitForTimeout(3000); await finir(); await photo('mots')
await repondre('mots', 'Étoile'); await suite(); await finir()

await tuile('Les problèmes').click(); await p.waitForTimeout(3400); await finir(); await photo('probleme')
await repondre('probleme', 'beaucoup'); await finir(); await photo('probleme-illisible')
await repondre('probleme', '22'); await finir()
await repondre('probleme', 'dix jours'); await suite(); await finir(); await photo('probleme-menu')
await menu('Montre-moi')
for (let i = 0; i < 3; i++) await suite()
await finir(); await photo('probleme-solution'); await suite(); await finir(); await photo('etage-trois')

await tuile('Les codes').click(); await p.waitForTimeout(600); await finir(); await photo('codes')
for (let i = 0; i < 10; i++) await p.click('.molette button[aria-label="Un cran de plus"]')
await photo('codes-lu')
await repondre('codes', 'papyrus'); await suite(); await finir()

await tuile('Les menteurs').click(); await p.waitForTimeout(600); await finir(); await photo('menteurs')
await p.locator('.accuses button', { hasText: 'Imhotep' }).click(); await suite()
await menu('Pas la peine'); await finir()

await tuile('Les machines').click(); await p.waitForTimeout(600); await finir(); await photo('dalles')
// Le joint entre la dalle i et la suivante : la stèle se pose à cheval dessus.
const viser = async i => { const r = await p.locator('.plateau').boundingBox(); await p.mouse.click(r.x + (i + 1) * r.width / 10, r.y + r.height / 2) }
const libres = () => p.evaluate(() => {
  const prises = new Array(10).fill(0)
  document.querySelectorAll('.stele:not(.vise)').forEach(s => { const c = parseInt(s.style.gridColumnStart) - 1; prises[c] = prises[c + 1] = 1 })
  return prises.flatMap((o, i) => (i < 9 && !o && !prises[i + 1] ? [i] : []))
})
const dernierDuSphinx = () => p.evaluate(() => { const l = [...document.querySelectorAll('.stele.lui')]; return parseInt(l[l.length - 1].style.gridColumnStart) - 1 })
const poser = async () => { await p.click('.pose button'); await p.waitForTimeout(1100) }
// Une partie perdue d'abord, ouverte au bord : le Sphinx ne se trompe pas.
await viser(0); await photo('dalles-vise'); await poser()
for (let tour = 0; tour < 6; tour++) { const l = await libres(); if (!l.length) break; await viser(l[0]); await poser() }
await photo('dalles-perdu'); await p.waitForTimeout(2200)
// Puis la bonne : le milieu, et chaque coup du Sphinx en miroir.
await viser(4); await poser()
for (let tour = 0; tour < 6 && (await p.locator('.plateau').count()) && (await libres()).length; tour++) {
  await viser(8 - (await dernierDuSphinx())); if (tour === 0) await photo('dalles-miroir'); await poser()
}
await finir(); await photo('dalles-gagne'); await suite()
await menu('Pas la peine'); await finir(); await photo('etage-six')

await p.click('.porte'); await p.waitForTimeout(700); await suite(); await suite(); await finir(); await photo('gardien')
await repondre('gardien', 'Thèbes'); await finir(); await photo('gardien-brule')
await repondre('gardien', 'Œdipe'); await p.waitForTimeout(500); await suite(); await suite(); await finir(); await photo('fin')
await p.click('.fin .bouton'); await finir(); await photo('etage-franchi')

await navigateur.close()
console.log(`${n} photos dans ${sortie}`)
console.log(erreurs.length ? `Erreurs de la page :\n${erreurs.join('\n')}` : 'Aucune erreur de la page.')
console.log(mesures.length ? `Ce qui déborde :\n${mesures.map(m => JSON.stringify(m)).join('\n')}` : 'Rien ne déborde.')
if (erreurs.length || mesures.length) process.exit(1)
