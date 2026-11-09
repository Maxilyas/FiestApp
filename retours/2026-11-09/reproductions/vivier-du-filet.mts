// Le vivier du Filet, question par question (`../le-nouveau-filet.md`, § 4.3) : les 1 780 questions de la base que le
// Filet peut poser, chacune classée (`../vivier-du-filet.json`) — chaque Français la sait-il placer, son sujet est-il
// français, du monde ou de l'étranger, se calcule-t-elle. Plus d'échantillon : ce qu'on a, exactement, catégorie par
// catégorie, et ce que l'acte I en tirerait. Le propriétaire, au matin du 9 novembre 2026 : « classer les questions déjà
// jouables au Filet, dans un fichier à part, pour savoir exactement ce qu'on a » — la base n'en est pas touchée.
//
//   cd server && node --import tsx ../retours/2026-11-09/reproductions/vivier-du-filet.mts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase } from '../../../server/src/core/baseCampagne.ts'
import { valeurDuFilet } from '../../../server/src/core/cabinet/tirages/tas.ts'
import { seTendAuFilet } from '../../../shared/cabinet/jeux/filet.ts'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const classe = new Map((JSON.parse(fs.readFileSync(path.resolve(ICI, '../vivier-du-filet.json'), 'utf8')) as any[]).map(a => [a.id, a]))
const vivier = ((lireLaBase() as any).questions as any[]).filter(q => !(q.meta.aRelire ?? []).length && valeurDuFilet(q))
const sans = vivier.filter(q => !classe.has(q.id))
console.log(`${vivier.length} questions jouables au Filet, ${vivier.length - sans.length} classées${sans.length ? ` — ${sans.length} sans classement` : ''}\n`)

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : '—').padStart(5)
// Ce que le tireur du Filet pose vraiment, par sa règle même (`seTendAuFilet`) : une année avec quarante-six ans de
// recul, une grandeur dès dix. À l'année de ces mesures, 2026, et non celle du jour où l'on relance — le compte doit
// redonner celui du cahier.
const ANNEE = 2026
const posable = (q: any) => { const v = valeurDuFilet(q)!; return seTendAuFilet(v.valeur, v.annee, ANNEE) }
const acteI = (q: any) => { const a = classe.get(q.id); return a?.chacun && !a.calcul && posable(q) }

const tout = vivier.filter(q => classe.has(q.id)), c = (q: any) => classe.get(q.id)
console.log(`Chaque Français la sait placer : ${tout.filter(q => c(q).chacun).length} (${pct(tout.filter(q => c(q).chacun).length, tout.length).trim()}) — posables à l'acte I, ${tout.filter(acteI).length}`)
console.log(`Se calculent (le nouveau Filet ne les pose pas) : ${tout.filter(q => c(q).calcul).length}`)
for (const anc of ['france', 'monde', 'etranger']) {
  const qs = tout.filter(q => c(q).ancrage === anc)
  console.log(`  un sujet ${anc.padEnd(9)} ${String(qs.length).padStart(4)} questions, dont ${qs.filter(q => c(q).chacun).length} que chaque Français sait placer (${pct(qs.filter(q => c(q).chacun).length, qs.length).trim()})`)
}
const annees = tout.filter(q => valeurDuFilet(q)!.annee), grandeurs = tout.filter(q => !valeurDuFilet(q)!.annee)
console.log(`  années     ${String(annees.length).padStart(4)}, dont ${annees.filter(q => c(q).chacun).length} que chaque Français sait placer, ${annees.filter(acteI).length} posables — le recul en écarte ${annees.filter(q => c(q).chacun && !posable(q)).length} (${annees.filter(q => !posable(q)).length} années en tout)`)
console.log(`  grandeurs  ${String(grandeurs.length).padStart(4)}, dont ${grandeurs.filter(q => c(q).chacun).length} que chaque Français sait placer, ${grandeurs.filter(acteI).length} posables (dès dix)`)
const sources: Record<string, number> = {}
for (const q of tout) if (c(q).chacun) sources[c(q).source] = (sources[c(q).source] ?? 0) + 1
console.log(`  d'où chaque Français le sait : ${Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(' · ')}`)
// Le Filet ne pose jamais deux fois la même valeur dans une partie : des valeurs qui reviennent (1789, 1945) font moins
// de manches différentes qu'elles n'ont de questions.
const valeurs = new Set(tout.filter(acteI).map(q => `${valeurDuFilet(q)!.valeur}|${valeurDuFilet(q)!.annee ? 'an' : valeurDuFilet(q)!.unite ?? ''}`))
console.log(`  valeurs distinctes à l'acte I : ${valeurs.size}`)

console.log('\ncatégorie              au Filet  chaque Français  posables à l\'acte I')
for (const cat of [...new Set(tout.map(q => q.meta.categorie))].sort()) {
  const qs = tout.filter(q => q.meta.categorie === cat)
  console.log(`  ${cat.padEnd(20)} ${String(qs.length).padStart(8)}  ${String(qs.filter(q => c(q).chacun).length).padStart(7)} ${pct(qs.filter(q => c(q).chacun).length, qs.length)}  ${String(qs.filter(acteI).length).padStart(8)}`)
}
