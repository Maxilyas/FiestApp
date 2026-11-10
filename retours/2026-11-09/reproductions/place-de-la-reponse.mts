// La place de la réponse parmi les quatre époques (`../le-nouveau-filet.md`, § 3.2 et décision 10). Les époques ne
// passent jamais dans l'avenir : une réponse de 2000 à 2024 ne peut être que dans la quatrième, une de 1975 à 1999
// que dans les deux dernières, une de 1950 à 1974 dans les trois dernières. Tirée au hasard parmi les places qui
// restent, la place se devine — d'autant plus que le recul des années est court. Tirée avec des poids, elle ne se
// devine plus : les réponses anciennes vont moins souvent dans la dernière époque, autant que les récentes y vont
// d'office.
//
// Les poids : l'ajustement proportionnel itératif (chaque place reçoit un quart des réponses, chaque réponse garde sa
// probabilité entière), sur les années du vivier que le Filet peut poser. Deux façons de jouer sans rien savoir de
// la question : « toujours la dernière époque », et le joueur qui connaît la base et lit la frise — il prend l'époque
// la plus probable pour les quatre qu'il voit. Le hasard pur fait 25 %.
//
//   cd server && node --import tsx ../retours/2026-11-09/reproductions/place-de-la-reponse.mts
//
// La maquette tire avec les mêmes poids (`../maquette-filet/extraire.mts` importe `poidsDesPlaces`).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { lireLaBase } from '../../../server/src/core/baseCampagne.ts'
import { valeurDuFilet } from '../../../server/src/core/cabinet/tirages/tas.ts'

const ANNEE = 2026
/** Les années du vivier depuis 1800 — les époques de 25 ans, les seules que l'avenir contraint. */
export function anneesDuVivier(): number[] {
  const vivier = ((lireLaBase() as any).questions as any[]).filter(q => !(q.meta.aRelire ?? []).length && valeurDuFilet(q)?.annee)
  return vivier.map(q => valeurDuFilet(q)!.valeur as number).filter(v => v >= 1800)
}

/** Les places (0 à 3, de gauche à droite) où l'époque de la réponse peut tomber sans que la frise passe dans l'avenir. */
export function places(v: number): number[] {
  const base = Math.floor(v / 25) * 25
  return [0, 1, 2, 3].filter(i => base - i * 25 + 99 <= ANNEE)
}

/** Les poids d'une réponse selon le nombre de places qui lui restent : un quart des réponses à chaque place. */
export function poidsDesPlaces(vs: number[]): Record<number, number[]> {
  const groupes = [1, 2, 3, 4].map(m => ({ m, part: vs.filter(v => places(v).length === m).length / vs.length }))
  const Q: Record<number, number[]> = {}
  for (const { m } of groupes) Q[m] = [0, 1, 2, 3].map(i => (i >= 4 - m ? 1 / m : 0))
  for (let tour = 0; tour < 500; tour++) {
    for (let i = 0; i < 4; i++) {
      const masse = groupes.reduce((s, g) => s + g.part * Q[g.m][i], 0)
      if (masse > 0) for (const g of groupes) Q[g.m][i] *= 0.25 / masse
    }
    for (const g of groupes) { const t = Q[g.m].reduce((a, b) => a + b, 0); Q[g.m] = Q[g.m].map(x => x / t) }
  }
  return Q
}

function mesurer(vs: number[], tirage: (v: number) => number[]) {
  // P(dernière époque), et le joueur qui lit la frise : pour chaque frise (sa dernière époque), l'époque la plus
  // probable parmi les quatre.
  let derniere = 0
  const parFrise = new Map<number, Map<number, number>>()
  for (const v of vs) {
    const e = Math.floor(v / 25), p = tirage(v)
    derniere += p[3]
    for (let i = 0; i < 4; i++) {
      if (!p[i]) continue
      const derniereDeLaFrise = e - i + 3
      const m = parFrise.get(derniereDeLaFrise) ?? new Map<number, number>()
      m.set(e, (m.get(e) ?? 0) + p[i])
      parFrise.set(derniereDeLaFrise, m)
    }
  }
  const lecteur = [...parFrise.values()].reduce((s, m) => s + Math.max(...m.values()), 0)
  return { derniere: derniere / vs.length, lecteur: lecteur / vs.length }
}

/**
 * Plus loin que les poids par place : équilibrer chaque frise. Pour chaque frise possible (sa dernière époque), les
 * réponses de ses quatre époques devraient y paraître autant les unes que les autres — alors la frise ne dit plus rien,
 * même à qui connaît la base. On le cherche par itérations : dans chaque frise, chaque époque est rapprochée de la
 * moyenne des quatre, puis chaque époque garde toutes ses réponses. Les poids se lisent ensuite par époque.
 */
export function poidsEquilibres(vs: number[], aussiLesPlaces = false): Map<number, number[]> {
  const parEpoque = new Map<number, number>()
  for (const v of vs) parEpoque.set(Math.floor(v / 25), (parEpoque.get(Math.floor(v / 25)) ?? 0) + 1)
  const w = new Map<number, number[]>()
  for (const [e] of parEpoque) { const pl = places(e * 25); w.set(e, [0, 1, 2, 3].map(i => (pl.includes(i) ? 1 / pl.length : 0))) }
  const frises = new Set<number>()
  for (const [e, p] of w) p.forEach((x, i) => x > 0 && frises.add(e - i + 3))
  for (let tour = 0; tour < 2000; tour++) {
    for (const L of frises) {
      const cellules = [0, 1, 2, 3].map(i => ({ e: L - 3 + i, i })).filter(({ e, i }) => (w.get(e)?.[i] ?? 0) > 0)
      if (cellules.length < 2) continue
      const masses = cellules.map(({ e, i }) => parEpoque.get(e)! * w.get(e)![i])
      const moyenne = masses.reduce((a, b) => a + b, 0) / masses.length
      cellules.forEach(({ e, i }, k) => { w.get(e)![i] *= Math.sqrt(moyenne / masses[k]) })
    }
    // Et, si on le demande, un quart des réponses à chaque place : « toujours la dernière » ne paie plus.
    if (aussiLesPlaces) {
      const total = [...parEpoque.values()].reduce((a, b) => a + b, 0)
      for (let i = 0; i < 4; i++) {
        const masse = [...w].reduce((s, [e, p]) => s + parEpoque.get(e)! * p[i], 0) / total
        if (masse > 0) for (const [, p] of w) p[i] *= Math.sqrt(0.25 / masse)
      }
    }
    for (const [e, p] of w) { const t = p.reduce((a, b) => a + b, 0); w.set(e, p.map(x => x / t)) }
  }
  return w
}

const pct = (x: number) => `${Math.round(100 * x)} %`
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
const annees = anneesDuVivier()
console.log(`${annees.length} années du vivier depuis 1800\n`)
console.log('recul   années   tirage               « toujours la dernière »   le joueur qui lit la frise')
for (const recul of [46, 25]) {
  const vs = annees.filter(v => v <= ANNEE - recul)
  const auHasard = (v: number) => { const pl = places(v); return [0, 1, 2, 3].map(i => (pl.includes(i) ? 1 / pl.length : 0)) }
  const W = poidsDesPlaces(vs)
  const pondere = (v: number) => W[places(v).length]
  const E = poidsEquilibres(vs), EP = poidsEquilibres(vs, true)
  const equilibre = (v: number) => E.get(Math.floor(v / 25))!
  const lesDeux = (v: number) => EP.get(Math.floor(v / 25))!
  for (const [nom, t] of [['au hasard', auHasard], ['pondéré', pondere], ['frises équilibrées', equilibre], ['les deux à la fois', lesDeux]] as const) {
    const r = mesurer(vs, t)
    console.log(`${String(recul).padStart(4)} ans ${String(vs.length).padStart(7)}   ${nom.padEnd(20)} ${pct(r.derniere).padStart(24)}   ${pct(r.lecteur).padStart(26)}`)
  }
  if (recul === 25) console.log(`\nLes poids à 25 ans, par nombre de places qui restent (de gauche à droite) :\n${[1, 2, 3, 4].map(m => `  ${m} : ${W[m].map(x => x.toFixed(3)).join(' · ')}`).join('\n')}`)
}
// L'acte I : ses années sont celles que chaque Français sait placer, et les récentes y pèsent bien plus que dans tout
// le vivier — les poids calculés sur tout le vivier y laissent deviner la place. Le tirage les calcule donc par acte,
// sur les années que l'acte peut poser ; et quand les réponses forcées dépassent le quart, la fuite ne se referme
// qu'en partie.
const classe = new Map((JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../vivier-du-filet.json'), 'utf8')) as any[]).map(a => [a.id, a]))
const vivierI = ((lireLaBase() as any).questions as any[]).filter(q => !(q.meta.aRelire ?? []).length && valeurDuFilet(q)?.annee && classe.get(q.id)?.chacun && !classe.get(q.id)?.calcul)
const anneesI = vivierI.map(q => valeurDuFilet(q)!.valeur as number).filter(v => v >= 1800)
console.log('\nL’acte I : les années que chaque Français sait placer')
console.log('recul   années   tirage                          « toujours la dernière »   le joueur qui lit la frise')
for (const recul of [46, 25]) {
  const vs = anneesI.filter(v => v <= ANNEE - recul)
  const auHasard = (v: number) => { const pl = places(v); return [0, 1, 2, 3].map(i => (pl.includes(i) ? 1 / pl.length : 0)) }
  const tout = poidsDesPlaces(annees.filter(v => v <= ANNEE - recul)), parActe = poidsDesPlaces(vs)
  for (const [nom, t] of [['au hasard', auHasard], ['poids de tout le vivier', (v: number) => tout[places(v).length]], ['poids de l’acte I', (v: number) => parActe[places(v).length]]] as const) {
    const r = mesurer(vs, t)
    console.log(`${String(recul).padStart(4)} ans ${String(vs.length).padStart(7)}   ${nom.padEnd(31)} ${pct(r.derniere).padStart(24)}   ${pct(r.lecteur).padStart(26)}`)
  }
}
}
