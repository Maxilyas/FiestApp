// Joue toute la maquette comme un joueur, en 360 × 640 : `node jouer.mjs <dossier construit> <sortie>`.
// L'arrivée, le puits, une corde ; puis chaque énigme de l'atelier, ouverte une à une — celles
// dont le programme tient la solution sont jouées jusqu'au bout, par le chemin même du joueur.
// Il photographie chaque écran et sort en erreur si la page en lève une, si une solution ne
// gagne pas, ou si un plateau fait déborder l'écran.
// Playwright n'est pas une dépendance du dépôt : il vient des modules globaux.
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const require = createRequire(join(execSync('npm root -g').toString().trim(), '_'))
const { chromium } = require('playwright')

const [dossier, sortie] = process.argv.slice(2)
mkdirSync(sortie, { recursive: true })
const navigateur = await chromium.launch()
const p = await navigateur.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 })
const erreurs = []
p.on('pageerror', e => erreurs.push('la page lève : ' + e.message))
p.on('console', m => { if (m.type() === 'error') erreurs.push('console : ' + m.text()) })
await p.goto('file://' + resolve(dossier, 'local.html'))

let n = 0
// Ce qui ne doit jamais arriver : la page plus large que l'écran ; un plateau qui pousse l'énigme hors du cadre.
async function photo(nom, { plateau = false } = {}) {
  await p.waitForTimeout(450)
  const m = await p.evaluate(() => {
    const haut = document.getElementById('haut')
    return { deborde: haut.scrollHeight - haut.clientHeight, large: document.documentElement.scrollWidth - innerWidth }
  })
  if (m.large > 0) erreurs.push(`${nom} : la page déborde de ${m.large} px en largeur`)
  if (plateau && m.deborde > 0) erreurs.push(`${nom} : l’énigme déborde de ${m.deborde} px en hauteur`)
  await p.screenshot({ path: join(sortie, `${String(++n).padStart(3, '0')}-${nom}.png`) })
}
// Toucher le texte de la boîte, jamais un bouton : finir la réplique qui s'écrit, puis passer à la suivante.
const attend = async () => (await p.locator('#boite.attend').count()) > 0
async function finir() { if (!(await attend())) await p.locator('#texte').click(); await p.waitForTimeout(80) }
async function suite() { await finir(); await p.waitForSelector('#boite.attend', { timeout: 6000 }); await p.locator('#texte').click(); await p.waitForTimeout(150) }

await p.waitForSelector('#boite.attend', { timeout: 8000 })
await photo('arrivee')
for (let i = 0; i < 4; i++) await suite()
await finir(); await photo('puits')

// Une corde, avec son récit : le chemin du joueur.
await p.locator('.corde').first().click(); await p.waitForTimeout(500); await photo('recit')
for (let i = 0; i < 8 && (await p.evaluate(() => !window.maquette.partie())); i++) await suite()
await finir(); await photo('corde-en-jeu', { plateau: true })
await p.locator('.retour').click(); await p.waitForTimeout(400); await finir()
await p.locator('.porte-atelier').first().click(); await p.waitForTimeout(500); await finir(); await photo('atelier')

// Chaque énigme écrite, puis une tirée de chaque moule qui en tire.
const fiches = await p.evaluate(() => window.maquette.fiches())
let jouees = 0
for (const f of fiches) {
  await p.evaluate(id => window.maquette.ouvrir(id), f.id)
  await p.waitForTimeout(350); await finir()
  await photo(`${f.moule}-${f.id}`, { plateau: true })
  if (!f.solution) continue
  await p.evaluate(() => window.maquette.resoudre())
  await p.waitForTimeout(1300)
  const vue = await p.evaluate(() => window.maquette.vue())
  if (!/gain/.test(vue) || /de-sable/.test(vue)) erreurs.push(`${f.id} : sa solution ne mène pas à la victoire (écran : ${vue || 'vide'})`)
  else jouees++
  await finir()
}
const tireurs = await p.evaluate(() => Object.values(P.moules).filter(m => m.tirer).map(m => m.cle))
for (const moule of tireurs) {
  for (const niveau of [1, 3, 5]) {
    await p.evaluate(([m, v]) => window.maquette.tirer(m, v, 4242 + v), [moule, niveau])
    await p.waitForTimeout(350); await finir()
    await photo(`${moule}-tiree-${niveau}`, { plateau: true })
  }
}

await navigateur.close()
console.log(`${n} photos dans ${sortie} · ${fiches.length} énigmes ouvertes, ${jouees} jouées jusqu’au bout, ${tireurs.length} moules qui en tirent`)
console.log(erreurs.length ? `\n${erreurs.length} défauts :\n${erreurs.join('\n')}` : 'Aucune erreur, aucune solution en panne, rien ne déborde.')
if (erreurs.length) process.exit(1)
