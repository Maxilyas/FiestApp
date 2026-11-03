// Ce qu'un appel d'API coûte à la production, lu en lecture seule dans le
// relevé de l'heure (`qg_sante`) : son processeur et les lignes qu'il fait lire
// au quota de Turso, version par version.
//
// Le banc dit ce que coûte une requête sur sa machine, plus rapide que celle
// de l'hébergeur ; seule la production dit ce qu'elle coûte là-bas. Le
// processeur de l'heure rapporté à ses appels mêle le travail de fond — la
// mesure, le modèle, le réveil —, qui ne dépend pas d'eux : à une heure calme,
// il faisait passer un appel pour trois fois plus cher qu'il n'est. D'où une
// droite par version, heure par heure : processeur = fond + coût × appels — la
// pente est ce que chaque appel de plus coûte, ce qui borne le nombre de
// joueurs (docs/exploitation/capacite.md). De même pour les lignes lues, que
// le quota mensuel de Turso borne.
//
// Rien qu'agrégé : des versions, des comptes, des pentes — jamais un nom.
//
//   cd server && NODE_USE_ENV_PROXY=1 node --import tsx ../retours/2026-11-03/reproductions/cout-d-un-appel.ts [jours]
//
// Jamais `QUIZ_DB_URL` : `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN`, un jeton en lecture seule.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HeureDeSante } from '../../../shared/santeDuServeur.ts'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(path.join(RACINE, 'server/package.json'))
const { createClient } = require('@libsql/client')

const url = process.env.PROD_LECTURE_URL
const authToken = process.env.PROD_LECTURE_TOKEN
if (!url || !authToken) throw new Error('PROD_LECTURE_URL et PROD_LECTURE_TOKEN, un jeton en lecture seule — jamais QUIZ_DB_URL')
const jours = Number(process.argv[2] ?? 8)
const db = createClient({ url: url.replace(/^libsql:/, 'https:'), authToken })
const { rows } = await db.execute({
  sql: `SELECT s.releve, d.version FROM qg_sante s JOIN qg_demarrages d ON d.id = s.demarrage
        WHERE d.env = 'production' AND s.heure >= ? ORDER BY s.heure`,
  args: [Date.now() - jours * 86_400_000],
})

interface Heure {
  appels: number
  processeurMs: number
  lues: number
}
const parVersion = new Map<string, Heure[]>()
for (const r of rows as Record<string, unknown>[]) {
  const releve = JSON.parse(String(r.releve)) as Partial<HeureDeSante>
  const charge = releve.charge
  // Une heure pleine seulement : la charge se relève toutes les dix secondes, une heure entière en compte 360 ;
  // une heure à peine commencée — un réveil, une mise en ligne — n'a ni son fond ni ses appels.
  if (!charge || charge.n < 300 || !releve.quota) continue
  const version = String(r.version ?? '')
  // `processeur` : en pour cent d'un cœur, en moyenne sur les relevés de l'heure.
  const heure = { appels: releve.routes?.n ?? 0, processeurMs: (charge.processeur / 100) * charge.n * 10_000, lues: releve.quota.lues }
  parVersion.set(version, [...(parVersion.get(version) ?? []), heure])
}

/** La droite des moindres carrés : y = fond + pente × x. */
function droite(points: readonly { x: number; y: number }[]): { fond: number; pente: number } {
  const n = points.length
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  const pente = sxx ? points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx : 0
  return { fond: my - pente * mx, pente }
}

console.log(`Production, ${jours} derniers jours, heures pleines seulement — par version :\n`)
for (const [version, heures] of parVersion) {
  const appels = heures.reduce((s, h) => s + h.appels, 0)
  // Moins de cinq heures, ou des heures qui se ressemblent toutes : la pente ne dirait rien.
  if (heures.length < 5) {
    console.log(`  ${version}  ${heures.length} heure(s), ${appels} appels — trop peu pour une pente`)
    continue
  }
  const processeur = droite(heures.map(h => ({ x: h.appels, y: h.processeurMs })))
  const lues = droite(heures.map(h => ({ x: h.appels, y: h.lues })))
  console.log(
    `  ${version}  ${String(heures.length).padStart(3)} heures, ${String(appels).padStart(6)} appels  ` +
      `processeur : ${processeur.pente.toFixed(1)} ms par appel, fond ${Math.round(processeur.fond / 1000)} s par heure  ·  ` +
      `Turso : ${Math.round(lues.pente)} lignes lues par appel, fond ${Math.round(lues.fond / 1000)} k par heure`,
  )
}
