// Le panel sur tout le vivier du Filet (`../le-nouveau-filet.md`, § 4.4 et § 5.5) : la note de chaque question —
// la part des joueurs qui placeraient sa valeur à 5 % près (une année : à 5 ans près) —, et ce que chaque acte en tire,
// exactement, par la règle de pose du nouveau Filet (`seTendEnDeuxTemps` : 25 ans de recul). La base n'est pas touchée :
// les notes vivent à part (`../panel-du-vivier.json`).
//
// Quatre passes. La première, celle de la maquette (`../maquette-filet/panel-ia.json`), notait 604 questions du
// vivier ; la seconde, le 9 novembre 2026, les 1 194 autres, en huit lots de 159 ou 160, chacun avec dix étalons de
// la première — 80 en tout, pour mesurer sa dérive. Elle note plus haut, surtout au milieu : autour de 50, sept points
// de plus. Elle se recale sur la première par les seuls étalons — même moyenne, même dispersion — avant de servir :
// c'est la première que les vrais lancers ont validée (AUC 0,78 pour « il savait », § 5.2). Le même panel, deux fois,
// classe 70 % des étalons au même acte : c'est le bruit d'une note seule, que les lancers corrigeront (§ 5.6). La
// troisième et la quatrième, le soir du même jour, notent les questions neuves écrites pour l'acte I (§ 4.6).
//
//   cd server && node --import tsx ../retours/2026-11-09/reproductions/panel-du-vivier.mts
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase } from '../../../server/src/core/baseCampagne.ts'
import { valeurDuFilet } from '../../../server/src/core/cabinet/tirages/tas.ts'
import { seTendEnDeuxTemps } from '../../../shared/cabinet/jeux/filetEnDeuxTemps.ts'

const ICI = path.dirname(fileURLToPath(import.meta.url))
type Passe = { qcm: number; estimation: number }
// Les passes d'après la deuxième portent chacune leurs champs (`p3`… `p12`, `etalon3`…) : une clé par passe, jamais plus
// de dix-sept champs fixes (le 12 novembre 2026, les passes 5 et suivantes notent les questions neuves de l'acte I,
// `../../2026-11-12/reproductions/acte-i/`).
type Note = { id: string; p1?: Passe; p2?: Passe; etalon?: true; estimation: number; [cle: string]: Passe | true | string | number | undefined }
const notes = JSON.parse(fs.readFileSync(path.resolve(ICI, '../panel-du-vivier.json'), 'utf8')) as Note[]
const classe = new Map((JSON.parse(fs.readFileSync(path.resolve(ICI, '../vivier-du-filet.json'), 'utf8')) as any[]).map(a => [a.id, a]))

// ── La dérive, et le recalage ───────────────────────────────────────────
const etalons = notes.filter(n => n.etalon && n.p1 && n.p2)
const moyenne = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length
const ecartType = (x: number[]) => Math.sqrt(moyenne(x.map(v => (v - moyenne(x)) ** 2)))
const a = etalons.map(n => n.p1!.estimation)
const b = etalons.map(n => n.p2!.estimation)
const k = ecartType(a) / ecartType(b)
const recale = (x: number) => Math.max(0, Math.min(100, Math.round(moyenne(a) + k * (x - moyenne(b)))))
const acte = (x: number) => (x >= 50 ? 'I' : x >= 25 ? 'II' : 'III')
const correlation = moyenne(a.map((x, i) => (x - moyenne(a)) * (b[i] - moyenne(b)))) / (ecartType(a) * ecartType(b))
console.log(`${etalons.length} étalons : la première passe ${moyenne(a).toFixed(1)} en moyenne, la seconde ${moyenne(b).toFixed(1)} (corrélation ${correlation.toFixed(2)})`)
const autour = etalons.filter(n => n.p1!.estimation >= 35 && n.p1!.estimation <= 65)
console.log(`  autour de 50 (${autour.length} étalons de 35 à 65) : ${moyenne(autour.map(n => n.p2!.estimation - n.p1!.estimation)).toFixed(1)} points de plus`)
console.log(`  le même acte, d'une passe à l'autre : ${etalons.filter(n => acte(n.p1!.estimation) === acte(n.p2!.estimation)).length} sur ${etalons.length}, ${etalons.filter(n => acte(n.p1!.estimation) === acte(recale(n.p2!.estimation))).length} recalée`)
console.log(`  recalée = ${moyenne(a).toFixed(1)} + ${k.toFixed(3)} × (brute − ${moyenne(b).toFixed(1)})`)
// La troisième et la quatrième passe : les questions neuves écrites pour l'acte I (`../le-nouveau-filet.md`, § 4.6),
// chacune en un lot, avec vingt étalons de la première passe pris sur toute son échelle — un recalage est une droite,
// qui se tient aux deux bouts. Chacune se recale de même, sur ses seuls étalons (`etalon3`, `etalon4`) : deux appels
// au panel ont chacun leur dérive.
const PASSES_D_APRES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const
const NOMS: Record<(typeof PASSES_D_APRES)[number], string> = { 3: 'troisième', 4: 'quatrième', 5: 'cinquième', 6: 'sixième', 7: 'septième', 8: 'huitième', 9: 'neuvième', 10: 'dixième', 11: 'onzième', 12: 'douzième' }
const sa = (n: Note, p: (typeof PASSES_D_APRES)[number]) => n[`p${p}`] as Passe | undefined
const recalages = new Map<number, (x: number) => number>()
for (const p of PASSES_D_APRES) {
  const ets = notes.filter(n => n[`etalon${p}`] && n.p1 && sa(n, p))
  if (!ets.length) continue
  const ap = ets.map(n => n.p1!.estimation)
  const bp = ets.map(n => sa(n, p)!.estimation)
  const kp = ecartType(ap) / ecartType(bp)
  const recaleP = (x: number) => Math.max(0, Math.min(100, Math.round(moyenne(ap) + kp * (x - moyenne(bp)))))
  recalages.set(p, recaleP)
  const r = moyenne(ap.map((x, i) => (x - moyenne(ap)) * (bp[i] - moyenne(bp)))) / (ecartType(ap) * ecartType(bp))
  console.log(`${ets.length} étalons de la ${NOMS[p]} passe : la première ${moyenne(ap).toFixed(1)} en moyenne, la ${NOMS[p]} ${moyenne(bp).toFixed(1)} (corrélation ${r.toFixed(2)})`)
  console.log(`  le même acte : ${ets.filter((n, i) => acte(ap[i]) === acte(bp[i])).length} sur ${ets.length}, ${ets.filter((n, i) => acte(ap[i]) === acte(recaleP(bp[i]))).length} recalée`)
  console.log(`  recalée = ${moyenne(ap).toFixed(1)} + ${kp.toFixed(3)} × (brute − ${moyenne(bp).toFixed(1)})`)
}
const passeDApres = (n: Note) => PASSES_D_APRES.find(p => sa(n, p) && !n[`etalon${p}`])
const refaite = (n: Note) => {
  if (n.p1) return n.p1.estimation
  if (n.p2) return recale(n.p2.estimation)
  const p = passeDApres(n)
  return p ? recalages.get(p)!(sa(n, p)!.estimation) : NaN
}
const fausses = notes.filter(n => n.estimation !== refaite(n))
if (fausses.length) throw new Error(`${fausses.length} notes retenues ne se refont pas : ${fausses.slice(0, 3).map(n => n.id).join(', ')}`)
const dApres = PASSES_D_APRES.map(p => [p, notes.filter(n => !n.p1 && !n.p2 && passeDApres(n) === p).length] as const).filter(([, c]) => c)
console.log(`  ${notes.length} notes : ${notes.filter(n => n.p1).length} de la première passe, ${notes.filter(n => !n.p1 && n.p2).length} recalées de la seconde${dApres.map(([p, c]) => `, ${c} de la ${NOMS[p]}`).join('')}\n`)

// ── Les trois actes ─────────────────────────────────────────────────────
// L'acte I : ce que chaque Français sait placer, ou le panel à 50 et plus (§ 4.5, la sévérité réglée) ; l'acte II, le
// panel de 25 à 49 ; l'acte III, sous 25. Jamais ce qui se calcule (§ 5.4).
const ANNEE = 2026
const note = new Map(notes.map(n => [n.id, n.estimation]))
const vivier = ((lireLaBase() as any).questions as any[]).filter(q => !(q.meta.aRelire ?? []).length && valeurDuFilet(q) && classe.has(q.id))
const posables = vivier.filter(q => {
  const v = valeurDuFilet(q)!
  return !classe.get(q.id).calcul && seTendEnDeuxTemps(v.valeur, v.annee, ANNEE)
})
const acteDe = (q: any) => (classe.get(q.id).chacun || (note.get(q.id) ?? 0) >= 50 ? 'I' : (note.get(q.id) ?? 0) >= 25 ? 'II' : 'III')
const valeurs = (qs: any[]) => new Set(qs.map(q => `${valeurDuFilet(q)!.valeur}|${valeurDuFilet(q)!.annee ? 'an' : (valeurDuFilet(q)!.unite ?? '')}`)).size
console.log(`${vivier.length} questions du vivier, ${posables.length} posables au nouveau Filet (sans calcul, une année avec 25 ans de recul)`)
console.log('acte   questions   années   grandeurs   valeurs distinctes   dont chaque Français')
for (const x of ['I', 'II', 'III']) {
  const qs = posables.filter(q => acteDe(q) === x)
  const an = qs.filter(q => valeurDuFilet(q)!.annee)
  console.log(`${x.padEnd(5)} ${String(qs.length).padStart(10)} ${String(an.length).padStart(8)} ${String(qs.length - an.length).padStart(11)} ${String(valeurs(qs)).padStart(20)} ${String(qs.filter(q => classe.get(q.id).chacun).length).padStart(22)}`)
}
// Sans recalage : les passes d'après la première telles qu'elles ont noté.
const brute = new Map(notes.map(n => [n.id, (n.p1 ?? n.p2 ?? sa(n, passeDApres(n) ?? 3))!.estimation]))
const acteBrut = posables.filter(q => classe.get(q.id).chacun || (brute.get(q.id) ?? 0) >= 50).length
console.log(`  sans recalage, l'acte I en aurait ${acteBrut}, ${acteBrut - posables.filter(q => acteDe(q) === 'I').length} de plus`)
console.log('\ncatégorie              acte I   acte II   acte III')
for (const cat of [...new Set(posables.map(q => q.meta.categorie))].sort()) {
  const qs = posables.filter(q => q.meta.categorie === cat)
  const n = (x: string) => String(qs.filter(q => acteDe(q) === x).length).padStart(8)
  console.log(`  ${cat.padEnd(20)} ${n('I')}  ${n('II')}  ${n('III')}`)
}
