// Ce que la base de la campagne pèse dans le tas, et ce que coûte sa lecture
// — ce que chaque réveil du serveur repaie (`lectureDeLaBase`) —, puis ce
// qu'elle pèserait sans les champs que le jeu ne lit pas.
//
//   cd server && node --expose-gc --import tsx ../retours/2026-10-16/reproductions/tas-de-la-base.ts
import { lireLaBase } from '../../../server/src/core/baseCampagne.ts'

const gc = (globalThis as unknown as { gc: () => void }).gc
gc()
gc()
const avant = process.memoryUsage().heapUsed
const cpu = process.cpuUsage()
const { questions } = lireLaBase()
const c = process.cpuUsage(cpu)
gc()
gc()
const lue = process.memoryUsage().heapUsed
console.log(`${questions.length} questions : ${Math.round((lue - avant) / 1048576)} Mo de tas, lues en ${Math.round((c.user + c.system) / 1000)} ms de processeur`)
// Sans l'explication, la source, `aRelire`, ni la description des entités (l'audit du 14 octobre, perf-turso-1).
const allegees = questions.map(q => ({
  ...q,
  meta: { ...q.meta, explication: undefined, source: undefined, aRelire: undefined, entites: q.meta.entites.map(e => ({ nom: e.nom, type: e.type })) },
}))
;(questions as unknown[]).length = 0
gc()
gc()
console.log(`allégée : ${Math.round((process.memoryUsage().heapUsed - avant) / 1048576)} Mo de tas (${allegees.length} questions)`)
