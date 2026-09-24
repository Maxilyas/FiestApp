// Les classes de styles.css qu'aucun fichier du client (ni de shared/) ne
// nomme : ni en entier dans une chaîne, ni par un préfixe construit
// (`av-${finition}`, `rarete-${r}`…). « Probablement mortes » : un nom
// assemblé de façon plus retorse échapperait à la recherche — chaque
// candidate se vérifie à la main.
// Usage, depuis la racine du dépôt :
//   node retours/2026-09-24/experts/scripts/design-systeme/css-mort.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync('client/src/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
// Les sélecteurs seulement : ce qui précède une accolade ouvrante.
const selecteurs = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1]).filter((s) => !s.trim().startsWith('@'))
const classes = new Set()
for (const s of selecteurs) for (const m of s.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classes.add(m[1])

const fichiers = []
const parcourir = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) parcourir(p)
    else if (/\.(tsx?|html)$/.test(f)) fichiers.push(p)
  }
}
parcourir('client/src')
parcourir('shared')
fichiers.push('client/index.html')
const source = fichiers.map((f) => readFileSync(f, 'utf8')).join('\n')

// Les morceaux de noms dans les chaînes et gabarits : `lg-${x}` donne « lg- ».
const prefixes = new Set([...source.matchAll(/[`'" ]([a-z][\w-]*-)\$\{/g)].map((m) => m[1]))
const motEntier = (c) => new RegExp(`(^|[^\\w-])${c.replace(/[-]/g, '\\-')}($|[^\\w-])`).test(source)

const mortes = []
const parPrefixe = []
for (const c of [...classes].sort()) {
  if (motEntier(c)) continue
  const p = [...prefixes].find((x) => c.startsWith(x))
  if (p) parPrefixe.push(`${c}  (${p}…)`)
  else mortes.push(c)
}
console.log(`classes dans styles.css : ${classes.size}`)
console.log(`nommées par un préfixe construit : ${parPrefixe.length}`)
console.log(`introuvables (probablement mortes) : ${mortes.length}\n`)
for (const c of mortes) {
  console.log(c)
}
if (process.argv.includes('--prefixes')) console.log('\n' + parPrefixe.join('\n'))
