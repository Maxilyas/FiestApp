// Dit si une énigme qu'on veut écrire recoupe la réserve du Sphinx — sans jamais rien en montrer.
//   node recoupe.mjs loup,chevre  maris,barque  "pont,lanterne"
// Chaque argument est une signature : des mots qui, tous ensemble dans un même problème ou une
// même énigme de la réserve, disent que le Sphinx la pose déjà. La réponse tient en un mot par
// signature : « libre » ou « recoupe ». Le propriétaire joue aussi au Sphinx : c'est la seule
// lecture de sa réserve qu'un outil de la maquette s'autorise, et elle n'imprime ni un intitulé,
// ni une réponse, ni un numéro.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const plat = s => String(s ?? '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '')
const mots = s => new Set(plat(s).split(/[^a-z0-9]+/).filter(Boolean))
const lire = (fichier, cle) => { try { return JSON.parse(readFileSync(join(racine, 'server/content/sphinx', fichier), 'utf8'))[cle] ?? [] } catch { return [] } }

const pieces = [
  ...lire('problemes.json', 'problemes').map(p => mots([p.titre, p.recit, p.question, p.aide].flat().join(' '))),
  ...lire('enigmes.json', 'enigmes').map(e => mots([e.vers, e.solution, e.acceptees, e.presque].flat().join(' '))),
]
if (!pieces.length) { console.error('La réserve ne se lit pas d’ici.'); process.exit(2) }
const signatures = process.argv.slice(2)
if (!signatures.length) { console.error('usage : node recoupe.mjs mot,mot [mot,mot …]'); process.exit(2) }
for (const s of signatures) {
  const voulus = plat(s).split(',').map(x => x.trim()).filter(Boolean)
  console.log(`${s} : ${pieces.some(p => voulus.every(v => p.has(v))) ? 'recoupe' : 'libre'}`)
}
