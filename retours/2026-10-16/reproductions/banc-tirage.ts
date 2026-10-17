// Le banc du tirage et des sujets, sur la vraie base (l'étape 2) : ce que
// coûtent les sujets de chaque question, à froid et à chaud, la préparation
// d'un tirage, puis chaque tirage pour un joueur lourd, moyen et neuf.
//
// Sous tsx, chaque fonction fléchée d'un module passe par `__name` (esbuild,
// keepNames) : le paquet de production n'en a pas, et les fermetures des
// boucles chaudes y coûtent moins. Pour mesurer comme en production, le
// script se compile d'abord, depuis `server/` :
//
//   npx esbuild ../retours/2026-10-16/reproductions/banc-tirage.ts --bundle --platform=node \
//     --format=esm --packages=external --outfile=../export/banc/banc-tirage.mjs && node ../export/banc/banc-tirage.mjs
//
// (`export/` est ignoré par git ; `DOSSIER` dit où lire la base, par défaut
// `content/campagne` depuis `server/`.)
import path from 'node:path'
import { lireLaBase } from '../../../server/src/core/baseCampagne'
import { PreparationDuTirage } from '../../../server/src/core/campagne'
import { sujetsDe } from '../../../shared/sujets'

const { questions } = lireLaBase(path.resolve(process.env.DOSSIER ?? 'content/campagne'))
console.log(`la base : ${questions.length} questions`)

/** Le premier passage, à froid, puis le meilleur de dix. */
function mesurer(nom: string, f: () => unknown, fois = 10) {
  const temps: number[] = []
  for (let i = 0; i < fois; i++) {
    const t = performance.now()
    f()
    temps.push(performance.now() - t)
  }
  const tries = [...temps].sort((a, b) => a - b)
  console.log(`${nom.padEnd(36)} premier ${temps[0].toFixed(2).padStart(7)} ms · médiane ${tries[Math.floor(fois / 2)].toFixed(2).padStart(7)} ms`)
}

mesurer('sujets de toute la base', () => questions.map(q => sujetsDe(q.meta)))

// Une mesure comme la production : un quart des questions jouées, une à sept réponses chacune.
let graine = 7
const hasard = () => (graine = (graine * 16807) % 2147483647) / 2147483647
const mesure = new Map<string, { justes: number; total: number; depart?: number }>()
for (const q of questions) {
  if (hasard() >= 0.25) continue
  const total = 1 + Math.floor(hasard() * 7)
  mesure.set(q.id, { justes: Math.floor(hasard() * (total + 1)), total, depart: 0.3 + hasard() * 0.6 })
}
const maintenant = Date.UTC(2026, 9, 16, 18)
const vuesDe = (combien: number) => {
  const vues = new Map<string, number>()
  while (vues.size < combien) vues.set(questions[Math.floor(hasard() * questions.length)].id, maintenant - Math.floor(hasard() * 12 * 86_400_000))
  return vues
}

let preparee: PreparationDuTirage | null = null
mesurer('préparation du tirage', () => (preparee = new PreparationDuTirage(questions, mesure)), 5)
mesurer('préparation, la mesure suivante', () => new PreparationDuTirage(questions, new Map(mesure), preparee!), 5)
for (const [nom, vues] of [
  ['tirage, joueur lourd (3 000 vues)', vuesDe(3000)],
  ['tirage, joueur moyen (500 vues)', vuesDe(500)],
  ['tirage, joueur neuf', new Map<string, number>()],
] as const) {
  mesurer(nom, () => preparee!.tirer(vues, maintenant), 30)
}
