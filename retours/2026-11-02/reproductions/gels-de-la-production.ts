// Ce que la sonde des gels a relevé en production (`server/src/core/gels.ts`),
// lu en lecture seule dans le relevé de l'heure (`qg_sante`) : les gels de
// plus d'une demi-seconde de la semaine, ce qui a couvert le plus de gel, les
// plus longs, et heure par heure. Rien que ce que la page « Le serveur » du QG
// montre déjà — des modèles de route, des noms de tâches, des durées —, jamais
// un nom ni un identifiant ; et ce que chaque heure a servi d'appels d'API,
// pour lire ce qui tournait au regard de ce qui tourne d'habitude : une route
// de l'accueil est de tous les gels parce qu'elle est de toutes les heures.
//
//   cd server && NODE_USE_ENV_PROXY=1 node --import tsx ../retours/2026-11-02/reproductions/gels-de-la-production.ts [jours]
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
const jours = Number(process.argv[2] ?? 7)
const db = createClient({ url: url.replace(/^libsql:/, 'https:'), authToken })
const depuis = Date.now() - jours * 86_400_000
const { rows } = await db.execute({
  sql: `SELECT s.heure, s.releve, d.version FROM qg_sante s JOIN qg_demarrages d ON d.id = s.demarrage
        WHERE d.env = 'production' AND s.heure >= ? ORDER BY s.heure`,
  args: [depuis],
})
const heures = rows.map((r: Record<string, unknown>) => {
  const releve = JSON.parse(String(r.releve)) as Partial<HeureDeSante>
  return { heure: Number(r.heure), version: String(r.version ?? ''), gels: releve.gels, appels: releve.routes?.n ?? 0, invites: releve.charge?.invitesMax ?? 0 }
})
const avecLeurs = heures.filter(h => h.gels)
if (avecLeurs.length === 0) {
  console.log(`Aucune heure de ces ${jours} jours ne relève ses gels : la version qui les relève n'est pas encore en ligne.`)
  process.exit(0)
}
const semaine = gelsDeLaSemaine(avecLeurs.map(h => ({ heure: h.heure, gels: h.gels })))!
const paris = (t: number) => new Date(t).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' })
console.log(`Depuis ${paris(semaine.depuis)} : ${semaine.n} gel(s) de plus d’une demi-seconde, ${Math.round(semaine.totalMs / 100) / 10} s en tout ; ${semaine.sansRien} sans rien de nommé.`)
console.log('\nCe qui a couvert le plus de gel :')
for (const c of semaine.parCe) console.log(`  ${String(c.ms).padStart(7)} ms en ${String(c.n).padStart(3)} gel(s)  ${c.quoi}`)
console.log('\nLes plus longs :')
for (const g of semaine.plusLongs) {
  const enCours = g.enCours.map(c => (c.n > 1 ? `${c.quoi} ×${c.n}` : c.quoi)).join(', ') || 'rien de nommé'
  console.log(`  ${paris(g.a)}  ${String(g.dureeMs).padStart(5)} ms  processeur ${String(g.processeurMs).padStart(4)}  ramasse-miettes ${String(g.ramasseMiettesMs).padStart(4)}  — ${enCours}`)
}
console.log('\nHeure par heure (celles qui ont gelé) :')
for (const h of avecLeurs.filter(h => (h.gels?.n ?? 0) > 0)) {
  const g = h.gels!
  console.log(`  ${paris(h.heure)}  ${h.version}  ${String(h.appels).padStart(5)} appels  ${String(h.invites).padStart(3)} invités  ${String(g.n).padStart(3)} gel(s), ${Math.round(g.totalMs / 100) / 10} s — ${g.parCe.slice(0, 4).map(c => c.quoi).join(', ')}`)
}
