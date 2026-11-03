// Ce qui lit le plus au quota de Turso, et ce qui gèle, version par version,
// lu en lecture seule dans le relevé de l'heure de la production (`qg_sante`) :
// les lignes lues et écrites, les requêtes lourdes — cent lignes ou plus d'un
// coup, nommées par leur texte sans ses valeurs (`familleDeLaRequete`) — avec
// leur part, et les gels de plus d'une demi-seconde avec ce qui tournait
// pendant. Rien que ce que la page « Le serveur » du QG montre déjà : des
// textes de requêtes, des modèles de route, des noms de tâches, des comptes —
// jamais un nom ni un identifiant. De quoi lire, après une mise en ligne, ce
// qu'elle a changé : `VERSIONS` garde les seules versions nommées (le début
// de leur empreinte, séparées par des virgules).
//
//   cd server && NODE_USE_ENV_PROXY=1 node --import tsx ../retours/2026-11-03/reproductions/ce-qui-lit-le-plus.ts [jours] [versions]
//
// Jamais `QUIZ_DB_URL` : `PROD_LECTURE_URL` et `PROD_LECTURE_TOKEN`, un jeton en lecture seule.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gelsDeLaSemaine, type HeureDeSante } from '../../../shared/santeDuServeur.ts'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(path.join(RACINE, 'server/package.json'))
const { createClient } = require('@libsql/client')

const url = process.env.PROD_LECTURE_URL
const authToken = process.env.PROD_LECTURE_TOKEN
if (!url || !authToken) throw new Error('PROD_LECTURE_URL et PROD_LECTURE_TOKEN, un jeton en lecture seule — jamais QUIZ_DB_URL')
const jours = Number(process.argv[2] ?? 3)
const versions = (process.argv[3] ?? '').split(',').filter(Boolean)
const db = createClient({ url: url.replace(/^libsql:/, 'https:'), authToken })
const { rows } = await db.execute({
  sql: `SELECT s.heure, s.releve, d.version FROM qg_sante s JOIN qg_demarrages d ON d.id = s.demarrage
        WHERE d.env = 'production' AND s.heure >= ? ORDER BY s.heure`,
  args: [Date.now() - jours * 86_400_000],
})
const heures = (rows as Record<string, unknown>[])
  .filter(r => versions.length === 0 || versions.some(v => String(r.version).startsWith(v)))
  .map(r => ({ heure: Number(r.heure), version: String(r.version ?? ''), releve: JSON.parse(String(r.releve)) as Partial<HeureDeSante> }))
const paris = (t: number) => new Date(t).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })
console.log(`Production, ${jours} jour(s)${versions.length > 0 ? `, versions ${versions.join(', ')}` : ''} : ${heures.length} heure(s) relevée(s), de ${heures[0] ? paris(heures[0].heure) : '—'} à ${heures.at(-1) ? paris(heures.at(-1)!.heure) : '—'}.`)

// Le quota : les lignes lues et écrites, et les lourdes, fondues par leur texte.
let lues = 0
let ecrites = 0
let allers = 0
const lourdes = new Map<string, { n: number; lues: number }>()
for (const { releve } of heures) {
  const q = releve.quota
  if (!q) continue
  lues += q.lues
  ecrites += q.ecrites
  allers += q.appels
  for (const l of q.lourdes) {
    const avant = lourdes.get(l.requete) ?? { n: 0, lues: 0 }
    lourdes.set(l.requete, { n: avant.n + l.n, lues: avant.lues + l.lues })
  }
}
const nommees = [...lourdes.values()].reduce((s, l) => s + l.lues, 0)
console.log(`\nLe quota : ${lues} lignes lues, ${ecrites} écrites, ${allers} allers-retours ; les lourdes nommées en font ${lues ? ((100 * nommees) / lues).toFixed(1) : 0} %, le reste en petites lectures.`)
for (const [requete, l] of [...lourdes].sort((a, b) => b[1].lues - a[1].lues).slice(0, 20)) {
  console.log(`  ${String(l.lues).padStart(9)}  ${((100 * l.lues) / lues).toFixed(1).padStart(5)} %  ×${String(l.n).padStart(5)}  ${String(Math.round(l.lues / l.n)).padStart(6)} par appel  ${requete.slice(0, 150)}`)
}

// Les gels : ce qui a couvert le plus de gel, et les plus longs.
const avecLeurs = heures.filter(h => h.releve.gels)
const semaine = avecLeurs.length > 0 ? gelsDeLaSemaine(avecLeurs.map(h => ({ heure: h.heure, gels: h.releve.gels! }))) : null
if (!semaine) {
  console.log('\nAucune heure de ces versions ne relève ses gels.')
} else {
  const sur = avecLeurs.length
  console.log(`\nLes gels depuis ${paris(semaine.depuis)} : ${semaine.n} de plus d’une demi-seconde en ${sur} heure(s), ${(semaine.totalMs / 1000).toFixed(1)} s en tout ; ${semaine.sansRien} sans rien de nommé.`)
  for (const c of semaine.parCe) console.log(`  ${String(c.ms).padStart(7)} ms en ${String(c.n).padStart(3)} gel(s)  ${c.quoi}`)
  console.log('Les plus longs :')
  for (const g of semaine.plusLongs) {
    const enCours = g.enCours.map(c => (c.n > 1 ? `${c.quoi} ×${c.n}` : c.quoi)).join(', ') || 'rien de nommé'
    console.log(`  ${paris(g.a)}  ${String(g.dureeMs).padStart(5)} ms  processeur ${String(g.processeurMs).padStart(4)}  ramasse-miettes ${String(g.ramasseMiettesMs).padStart(4)}  — ${enCours}`)
  }
}
