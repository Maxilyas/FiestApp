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

// Le recul des années (le cahier, § 8) : ce qu'un recul plus court rendrait, et ce qu'il coûterait. Les quatre époques
// du nouveau Filet (25 ans depuis 1800) ne passent jamais dans l'avenir : la dernière finit au plus en 2024. Une réponse
// de 2000 à 2024 ne peut donc être que dans la quatrième, une de 1975 à 1999 que dans les deux dernières, une de 1950 à
// 1974 dans les trois dernières — et qui choisit toujours la dernière époque l'a une fois sur un, deux ou trois, au lieu
// d'une sur quatre. Le compte suppose la place tirée au hasard parmi celles qui restent.
const dernierePossible = (an: number) => {
  if (an < 1800) return 0.25 // avant 1800, les époques de 50 et 100 ans finissent loin d'aujourd'hui
  // La dernière époque permise finit au plus l'année du départ (2000–2024 en 2026) ; on compte les époques de la
  // réponse à elle : 2000–2024 : 0, 1975–1999 : 1…
  const recul = Math.floor((ANNEE - 1824) / 25) - Math.floor((an - 1800) / 25)
  return 1 / Math.min(4, Math.max(1, recul + 1))
}
console.log('\nrecul   années posables   dont chaque Français   « toujours la dernière époque » les gagne')
for (const recul of [46, 35, 25, 20]) {
  const ans = annees.filter(q => valeurDuFilet(q)!.valeur >= 1000 && valeurDuFilet(q)!.valeur <= ANNEE - recul)
  const gain = ans.reduce((s, q) => s + dernierePossible(valeurDuFilet(q)!.valeur), 0) / ans.length
  console.log(`${String(recul).padStart(4)} ans  ${String(ans.length).padStart(15)}  ${String(ans.filter(q => c(q).chacun).length).padStart(20)}   ${pct(Math.round(1000 * gain), 1000).trim()} des fois (25 % au hasard)`)
}

console.log('\ncatégorie              au Filet  chaque Français  posables à l\'acte I')
for (const cat of [...new Set(tout.map(q => q.meta.categorie))].sort()) {
  const qs = tout.filter(q => q.meta.categorie === cat)
  console.log(`  ${cat.padEnd(20)} ${String(qs.length).padStart(8)}  ${String(qs.filter(q => c(q).chacun).length).padStart(7)} ${pct(qs.filter(q => c(q).chacun).length, qs.length)}  ${String(qs.filter(acteI).length).padStart(8)}`)
}
