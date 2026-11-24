// Photographie la maquette au téléphone, étape par étape, en jouant la visite
// comme un joueur : `node photographier.mjs <dossier construit> <sortie> [LxH]`.
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
const page = await navigateur.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const erreurs = []
page.on('pageerror', e => erreurs.push(e.message))
page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()) })
await page.goto('file://' + resolve(dossier, 'local.html'))
await page.evaluate(() => document.fonts.ready)

let n = 0
const photo = async nom => { await page.screenshot({ path: join(sortie, `${String(++n).padStart(2, '0')}-${nom}-${taille}.png`) }) }
const enAttente = () => page.waitForSelector('.boite.attend', { timeout: 20000 })
// Toucher la boîte : jamais un bouton.
const suivant = async () => { await page.mouse.click(60, h - 50); await page.waitForTimeout(120) }
const ligne = async nom => { await enAttente(); await page.waitForTimeout(150); if (nom) await photo(nom); await suivant() }

await page.waitForTimeout(900)
await photo('accueil')
await page.waitForTimeout(1500)
await photo('arrivee')
await ligne('psst')
await ligne('je-suis')
await page.waitForTimeout(900)
await ligne('divins')
await ligne(null)
await ligne('personne-ne-sait')
await ligne('chronos')
await page.waitForSelector('.choix:not([hidden])')
await page.waitForTimeout(200)
await photo('choix')
await page.click('.choix button')
await page.waitForFunction(() => document.querySelectorAll('.vers span.la').length === 4, null, { timeout: 15000 })
await page.waitForTimeout(1200)
await photo('enigme')
await page.fill('#champ', 'tonnerre')
await page.click('.reponse button')
await page.waitForTimeout(1600)
await photo('presque')
await page.fill('#champ', 'la pluie')
await page.click('.reponse button')
await page.waitForTimeout(300)
await photo('faux')
await page.fill('#champ', "l'éclair")
await page.click('.reponse button')
await page.waitForTimeout(2600)
await photo('exact')
await page.waitForSelector('.mot-vole.montre', { timeout: 15000 })
await page.waitForTimeout(1400)
await photo('le-mot')
await page.waitForFunction(() => document.querySelector('#compte-focus')?.textContent.startsWith('1 mot'), null, { timeout: 15000 })
await ligne('mot-range')
await ligne(null)
await page.waitForSelector('.album:not([hidden])', { timeout: 15000 })
await page.waitForTimeout(1500)
await photo('album')
await page.evaluate(() => { document.querySelector('#album').scrollTop = 9999 })
await page.waitForTimeout(200)
await photo('album-bas')

// L'autre chemin : « Pas aujourd'hui ».
await page.click('#rejouer')
for (let i = 0; i < 6; i++) await ligne(null)
await page.waitForSelector('.choix:not([hidden])')
await page.click('.choix button:nth-child(2)')
await ligne('plus-tard')
await page.waitForSelector('.epingle:not([hidden])', { timeout: 15000 })
await page.waitForTimeout(600)
await photo('epingle')

const debord = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
console.log(`${n} photos dans ${sortie}${debord > 0 ? ` · la page déborde de ${debord} px` : ''}`)
if (erreurs.length) console.log('Erreurs :\n' + erreurs.join('\n'))
await navigateur.close()
