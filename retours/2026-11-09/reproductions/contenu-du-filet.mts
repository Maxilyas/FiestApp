// Le contenu du Filet en deux temps (`server/content/cabinet/filet.json`), refait de ses sources : le classement du
// vivier (`../vivier-du-filet.json` : chaque Français la sait-elle placer, se calcule-t-elle), la note du panel
// (`../panel-du-vivier.json`), et les indices jugés — ceux de la maquette (`../maquette-filet/indices.json`,
// `recentes.json`) et ceux des vagues (`../indices-du-vivier.json`). Une entrée par question que le Filet en deux temps
// peut poser, une par ligne ; ce qui se calcule n'y entre pas (le cahier, § 5.4).
//
//   cd server && node --import tsx ../retours/2026-11-09/reproductions/contenu-du-filet.mts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const lire = (f: string) => JSON.parse(fs.readFileSync(path.resolve(ICI, f), 'utf8'))
const vivier = lire('../vivier-du-filet.json') as { id: string; chacun: boolean; calcul: boolean }[]
const panel = new Map((lire('../panel-du-vivier.json') as { id: string; estimation: number }[]).map(n => [n.id, n.estimation]))
const indices = new Map<string, { indice: string | null; repere: string | null }>()
for (const f of ['../maquette-filet/indices.json', '../maquette-filet/recentes.json', '../indices-du-vivier.json']) {
  if (!fs.existsSync(path.resolve(ICI, f))) continue
  // Un indice vide de la maquette — l'énoncé donnait déjà l'époque, le Lusitania — n'en est pas un.
  for (const x of lire(f) as { id: string; indice: string | null; repere?: string | null }[]) indices.set(x.id, { indice: x.indice || null, repere: x.repere || null })
}
const lignes: string[] = []
for (const v of vivier) {
  if (v.calcul) continue
  const n = panel.get(v.id)
  if (n === undefined) throw new Error(`${v.id} : pas de note du panel`)
  const i = indices.get(v.id)
  lignes.push(JSON.stringify({ id: v.id, chacun: v.chacun, panel: n, indice: i?.indice ?? null, repere: i?.repere ?? null }))
}
const sortie = path.resolve(ICI, '../../../server/content/cabinet/filet.json')
fs.writeFileSync(sortie, `[\n${lignes.join(',\n')}\n]\n`)
console.log(`${lignes.length} questions, ${[...lignes].filter(l => !l.includes('"indice":null')).length} avec un indice → ${path.relative(process.cwd(), sortie)}`)
