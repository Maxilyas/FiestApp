// Lit les notes du panel d'un lot (`panel.consigne.md`) et les verse à `../../../2026-11-09/panel-du-vivier.json` : la passe `p<N>`
// d'un lot se recale sur la première par les vingt étalons du lot (mêmes formules que `panel-du-vivier.mts`).
//
//   cd server && ICI=/chemin node --import tsx ../retours/2026-11-12/reproductions/acte-i/lire-le-panel.mts <N> <panel-K-lu.json> [--verser]
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NEUF = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../2026-11-09')
const SORTIE = process.env.ICI ?? path.join(os.tmpdir(), 'acte-i-du-filet')
const [passe, fichier, ...options] = process.argv.slice(2)
const p = Number(passe)
const etalons = JSON.parse(fs.readFileSync(path.join(SORTIE, 'panel-etalons.json'), 'utf8')) as Record<string, number>
const lus = JSON.parse(fs.readFileSync(fichier, 'utf8')) as { id: string; qcm: number; estimation: number }[]
const chemin = path.join(NEUF, 'panel-du-vivier.json')
const notes = JSON.parse(fs.readFileSync(chemin, 'utf8')) as any[]
const moyenne = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length
const ecartType = (x: number[]) => Math.sqrt(moyenne(x.map(v => (v - moyenne(x)) ** 2)))
const ets = lus.filter(r => etalons[r.id] !== undefined)
const a = ets.map(r => etalons[r.id]), b = ets.map(r => r.estimation)
const k = ecartType(a) / ecartType(b)
const recale = (x: number) => Math.max(0, Math.min(100, Math.round(moyenne(a) + k * (x - moyenne(b)))))
const r = moyenne(a.map((x, i) => (x - moyenne(a)) * (b[i] - moyenne(b)))) / (ecartType(a) * ecartType(b))
const acte = (x: number) => (x >= 50 ? 'I' : x >= 25 ? 'II' : 'III')
console.log(`${ets.length} étalons : la première ${moyenne(a).toFixed(1)} en moyenne, la passe ${p} ${moyenne(b).toFixed(1)} (corrélation ${r.toFixed(2)}) ; même acte ${ets.filter((e, i) => acte(a[i]) === acte(b[i])).length}/${ets.length}, ${ets.filter((e, i) => acte(a[i]) === acte(recale(b[i]))).length} recalée`)
console.log(`recalée = ${moyenne(a).toFixed(1)} + ${k.toFixed(3)} × (brute − ${moyenne(b).toFixed(1)})`)
const neuves = lus.filter(x => etalons[x.id] === undefined)
console.log(`${neuves.length} notes neuves, recalées : moyenne ${moyenne(neuves.map(x => recale(x.estimation))).toFixed(1)}, ${neuves.filter(x => recale(x.estimation) >= 50).length} à 50 et plus, ${neuves.filter(x => recale(x.estimation) >= 25 && recale(x.estimation) < 50).length} de 25 à 49`)
if (options.includes('--verser')) {
  const parId = new Map(notes.map(n => [n.id, n]))
  for (const x of ets) {
    const n = parId.get(x.id)
    if (n) { n[`p${p}`] = { qcm: x.qcm, estimation: x.estimation }; n[`etalon${p}`] = true }
  }
  for (const x of neuves) {
    if (parId.has(x.id)) continue
    const ligne = { id: x.id, [`p${p}`]: { qcm: x.qcm, estimation: x.estimation }, estimation: recale(x.estimation) }
    notes.push(ligne as any)
  }
  notes.sort((u, v) => (u.id < v.id ? -1 : 1))
  fs.writeFileSync(chemin, `[\n${notes.map(n => JSON.stringify(n)).join(',\n')}\n]\n`)
  console.log(`versé : ${notes.length} notes en tout`)
}
