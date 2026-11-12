// Contrôle d'un lot pour l'acte I du Filet : chaque question se pose-t-elle (valeurDuFilet, recul de 2026),
// et sa valeur est-elle neuve dans sa catégorie (acte I déjà posé + autres questions des lots donnés) ?
//   cd server && node --import tsx ../retours/2026-11-12/reproductions/acte-i/filet-check.mts <lot.json> …
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase, lireQuestionDeLaBase } from '../../../../server/src/core/baseCampagne.ts'
import { valeurDuFilet } from '../../../../server/src/core/cabinet/tirages/tas.ts'
import { lireLEstimation } from '../../../../server/src/core/estimation.ts'
import { seTendEnDeuxTemps, sePoseALActe } from '../../../../shared/cabinet/jeux/filetEnDeuxTemps.ts'
const ANNEE = 2026
const filet = new Map((JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../server/content/cabinet/filet.json'), 'utf8')) as any[]).map(e => [e.id, e]))
const pris = new Map<string, Set<number>>()
for (const q of (lireLaBase() as any).questions as any[]) {
  const e = filet.get(q.id); if (!e || !sePoseALActe(e, 0)) continue
  const v = valeurDuFilet(q); if (!v || !seTendEnDeuxTemps(v.valeur, v.annee, ANNEE)) continue
  const s = pris.get(q.meta.categorie) ?? new Set(); s.add(v.valeur); pris.set(q.meta.categorie, s)
}
// Les questions rangées depuis le contenu du Filet et pas encore classées (elles ne sont pas dans `filet.json`) : leurs valeurs sont prises aussi.
for (const q of (lireLaBase() as any).questions as any[]) {
  if (filet.has(q.id)) continue
  const v = valeurDuFilet(q); if (!v || !seTendEnDeuxTemps(v.valeur, v.annee, ANNEE)) continue
  const s = pris.get(q.meta.categorie) ?? new Set(); s.add(v.valeur); pris.set(q.meta.categorie, s)
}
let ok = 0, mal = 0
const dansLots = new Map<string, Map<number, string>>()
for (const f of process.argv.slice(2)) {
  const lot = JSON.parse(fs.readFileSync(f, 'utf8')) as any[]
  lot.forEach((brut, i) => {
    const lu = lireQuestionDeLaBase(brut, { sansId: true })
    if ('refus' in lu) { console.log(`${f.split('/').pop()}#${i} REFUSÉE par le juge : ${lu.refus}`); mal++; return }
    const q = lu.question
    const v = valeurDuFilet(q)
    const nom = `${f.split('/').pop()}#${i}`
    if (!v) { console.log(`${nom} NE SE POSE PAS au Filet : ${'refus' in lireLEstimation(q) ? (lireLEstimation(q) as any).refus : 'forme d’année non demandée, ou valeur écrite dans l’intitulé'} — ${q.texte.slice(0, 70)}`); mal++; return }
    if (!seTendEnDeuxTemps(v.valeur, v.annee, ANNEE)) { console.log(`${nom} HORS RECUL/PLANCHER (${v.valeur}${v.annee ? ' an' : ''}) — ${q.texte.slice(0, 70)}`); mal++; return }
    const cat = q.meta.categorie
    if (pris.get(cat)?.has(v.valeur)) { console.log(`${nom} VALEUR DÉJÀ PRISE à l'acte I en ${cat} : ${v.valeur} — ${q.texte.slice(0, 70)}`); mal++; return }
    const m = dansLots.get(cat) ?? new Map(); dansLots.set(cat, m)
    if (m.has(v.valeur)) { console.log(`${nom} MÊME VALEUR que ${m.get(v.valeur)} (${v.valeur}) — ${q.texte.slice(0, 60)}`); mal++; return }
    m.set(v.valeur, nom); ok++
  })
}
console.log(`${ok} posables à valeur neuve, ${mal} à corriger ou remplacer`)
process.exitCode = mal ? 1 : 0
