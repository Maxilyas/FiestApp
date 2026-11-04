// Ce que la production a dit des latences du Cabinet, le 4 novembre 2026
// (`../latences-du-cabinet.md`) — en lecture seule, des totaux : des modèles de
// route, des noms de tâches, des durées, des comptes ; jamais un nom, un
// identifiant, ni l'adresse de la base.
//
//   cd server && NODE_USE_ENV_PROXY=1 node --import tsx ../retours/2026-11-04/reproductions/lecture-de-la-production.ts <quoi> [n]
//
//   heures [40]   le relevé de chaque heure (`qg_sante`) : Turso, les routes, la charge, les connexions, les gels
//   detail [3]    les dernières heures en détail : tranches de cinq minutes, chaque route, les requêtes lourdes, les gels
//   gels [8]      les gels de chaque jour, ceux où une route du Cabinet tournait, ceux sans rien de nommé
//   volumes       ce que le Cabinet garde des plus assidus — traversées, parties, gestes, réponses —, en totaux
//   pauses [14]   les écarts entre deux gestes du Cabinet d'un même joueur, en durées seulement
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
const db = createClient({ url: url.replace(/^libsql:/, 'https:'), authToken })
const quoi = process.argv[2] ?? 'heures'
const n = process.argv[3] === undefined ? null : Number(process.argv[3])
const H = 3_600_000
const paris = (t: number, avecLesSecondes = false) =>
  new Date(t).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: avecLesSecondes ? 'medium' : 'short' })
const r1 = (x: number | null | undefined) => (x == null ? '—' : String(Math.round(x * 10) / 10))

/** Les heures de la production depuis tant d'heures, avec la version qui tournait. */
async function heuresDepuis(heures: number): Promise<{ heure: number; version: string; h: HeureDeSante }[]> {
  const { rows } = await db.execute({
    sql: `SELECT s.heure, d.version, s.releve FROM qg_sante s JOIN qg_demarrages d ON d.id = s.demarrage
          WHERE d.env = 'production' AND s.heure >= ? ORDER BY s.heure`,
    args: [Date.now() - heures * H],
  })
  return rows.map((r: Record<string, unknown>) => ({ heure: Number(r.heure), version: String(r.version ?? '?'), h: JSON.parse(String(r.releve)) as HeureDeSante }))
}

if (quoi === 'heures') {
  const heures = n ?? 40
  const demarrages = await db.execute({
    sql: `SELECT demarre_le, pret_en_ms, version, vu_le, arrete_le FROM qg_demarrages WHERE env = 'production' AND demarre_le >= ? ORDER BY demarre_le`,
    args: [Date.now() - heures * H - 24 * H],
  })
  console.log('== Démarrages')
  for (const d of demarrages.rows) {
    console.log(`  ${paris(Number(d.demarre_le))}  ${d.version}  prêt en ${d.pret_en_ms} ms  vu ${paris(Number(d.vu_le))}  arrêté ${d.arrete_le ? paris(Number(d.arrete_le)) : '—'}`)
  }
  console.log('\n== Heure par heure')
  for (const { heure, version, h } of await heuresDepuis(heures)) {
    const b = h.base, rt = h.routes, c = h.charge, cx = h.connexions, g = h.gels
    console.log(
      `${paris(heure)} ${version} | base n=${b?.n ?? 0} p50=${b?.p50 ?? '—'} p95=${b?.p95 ?? '—'} max=${b?.max ?? '—'}` +
        ` | routes n=${rt?.n ?? 0} p50=${rt?.p50 ?? '—'} p95=${rt?.p95 ?? '—'}` +
        ` | cpu=${r1(c?.processeur)}% gelé=${r1(c?.gelePct)}%/${r1(c?.geleMaxPct)} boucle=${c?.boucleMaxMs ?? '—'} mem=${c?.memoireMaxMo ?? '—'}` +
        ` | connexions ouvertes=${cx?.ouvertes ?? '—'} battements=${cx?.battements ?? '—'} | gels ${g?.n ?? '—'}${g ? ` (${Math.round(g.totalMs)} ms)` : ''}`,
    )
  }
} else if (quoi === 'detail') {
  for (const { heure, version, h } of await heuresDepuis(n ?? 3)) {
    console.log(`\n######## ${paris(heure)} ${version}`)
    console.log('base', JSON.stringify(h.base), 'routes', JSON.stringify(h.routes))
    console.log('connexions', JSON.stringify(h.connexions))
    console.log('charge', JSON.stringify(h.charge))
    console.log('quota', h.quota ? `appels=${h.quota.appels} lues=${h.quota.lues} ecrites=${h.quota.ecrites}` : '—')
    for (const l of h.quota?.lourdes ?? []) console.log(`  lourde n=${l.n} lues=${l.lues} ${l.requete.slice(0, 140)}`)
    for (const t of h.tranches ?? []) {
      console.log(`  ${paris(t.debut, true)} routes=${JSON.stringify(t.routes)} base=${JSON.stringify(t.base)} gels=${JSON.stringify(t.gels)} cpu=${r1(t.charge?.processeur)}%`)
    }
    for (const p of h.parRoute ?? []) console.log(`  ${p.route.padEnd(60)} n=${p.n} p50=${p.p50} p95=${p.p95} max=${p.max} total=${p.totalMs}`)
    for (const g of h.gels?.plusLongs ?? []) {
      console.log(`  gel ${paris(g.a, true)} ${g.dureeMs} ms cpu ${g.processeurMs} gc ${g.ramasseMiettesMs} — ${g.enCours.map(e => e.quoi + (e.n > 1 ? '×' + e.n : '')).join(', ') || 'rien de nommé'}`)
    }
  }
} else if (quoi === 'gels') {
  const parJour = new Map<string, { tous: number; ms: number; cabinet: number; cabinetMs: number; sansRien: number; versions: Set<string> }>()
  for (const { heure, version, h } of await heuresDepuis((n ?? 8) * 24)) {
    const jour = paris(heure).slice(0, 10)
    const j = parJour.get(jour) ?? { tous: 0, ms: 0, cabinet: 0, cabinetMs: 0, sansRien: 0, versions: new Set<string>() }
    j.versions.add(version)
    if (h.gels) {
      j.tous += h.gels.n
      j.ms += h.gels.totalMs
      j.sansRien += h.gels.sansRien
      for (const c of h.gels.parCe) if (c.quoi.includes('cabinet')) (j.cabinet += c.n), (j.cabinetMs += c.ms)
      for (const g of h.gels.plusLongs) {
        const enCours = g.enCours.map(e => e.quoi + (e.n > 1 ? '×' + e.n : '')).join(', ')
        if (enCours.includes('cabinet') || enCours === '') console.log(`${paris(g.a, true)} ${version} ${String(g.dureeMs).padStart(5)} ms cpu ${String(g.processeurMs).padStart(4)} gc ${String(g.ramasseMiettesMs).padStart(4)} — ${enCours || 'rien de nommé'}`)
      }
    }
    parJour.set(jour, j)
  }
  console.log('\nJour        gels (s)        dont Cabinet (s)    sans rien de nommé   versions')
  for (const [jour, j] of parJour) {
    console.log(`${jour}  ${String(j.tous).padStart(4)} (${(j.ms / 1000).toFixed(1).padStart(5)})   ${String(j.cabinet).padStart(4)} (${(j.cabinetMs / 1000).toFixed(1).padStart(5)})        ${String(j.sansRien).padStart(4)}            ${[...j.versions].join(' ')}`)
  }
} else if (quoi === 'volumes') {
  const lire = async (titre: string, sql: string) => {
    console.log(`\n== ${titre}`)
    for (const r of (await db.execute(sql)).rows) console.log('  ', JSON.stringify(r))
  }
  await lire('Traversées', `SELECT COUNT(*) AS toutes, SUM(finie_le IS NOT NULL) AS finies, COUNT(DISTINCT profile_id) AS profils FROM cabinet_traversees`)
  await lire('Traversées des cinq plus assidus', `SELECT COUNT(*) AS n, SUM(finie_le IS NOT NULL) AS finies FROM cabinet_traversees GROUP BY profile_id ORDER BY n DESC LIMIT 5`)
  await lire('Parties du Cabinet des cinq plus assidus', `SELECT COUNT(*) AS parties FROM campagne_series WHERE mode = 'cabinet' GROUP BY profile_id ORDER BY parties DESC LIMIT 5`)
  await lire('Réponses de campagne des cinq plus assidus', `SELECT COUNT(*) AS n FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id GROUP BY s.profile_id ORDER BY n DESC LIMIT 5`)
  await lire('Réponses de campagne en tout', `SELECT COUNT(*) AS n FROM campagne_reponses`)
} else if (quoi === 'pauses') {
  const depuis = Date.now() - (n ?? 14) * 24 * H
  const { rows } = await db.execute({
    sql: `WITH gestes AS (
            SELECT s.profile_id AS qui, g.fait_le AS le FROM cabinet_gestes g JOIN campagne_series s ON s.id = g.serie_id WHERE g.fait_le >= ?
            UNION ALL
            SELECT t.profile_id, g.fait_le FROM cabinet_traversee_gestes g JOIN cabinet_traversees t ON t.id = g.traversee_id WHERE g.fait_le >= ?
          ),
          ecarts AS (SELECT le - LAG(le) OVER (PARTITION BY qui ORDER BY le) AS ecart FROM gestes)
          SELECT ecart FROM ecarts WHERE ecart IS NOT NULL AND ecart >= 0`,
    args: [depuis, depuis],
  })
  const ecarts = rows.map((r: Record<string, unknown>) => Number(r.ecart)).sort((a: number, b: number) => a - b)
  console.log(`${ecarts.length} écarts entre deux gestes du Cabinet d'un même joueur, sur ${n ?? 14} jours`)
  for (const q of [0.5, 0.75, 0.9, 0.95, 0.99]) console.log(`  ${Math.round(q * 100)}ᵉ centile : ${(ecarts[Math.floor(q * (ecarts.length - 1))] / 1000).toFixed(1)} s`)
  // Une session : une pause de plus de trente minutes, il est parti et revient plus tard.
  const enSession = ecarts.filter((e: number) => e <= 30 * 60_000)
  for (const s of [60, 90, 120, 180, 300, 600]) {
    const au = enSession.filter((e: number) => e > s * 1000).length
    console.log(`  plus de ${String(s).padStart(3)} s : ${String(au).padStart(5)}  (${((100 * au) / enSession.length).toFixed(1)} % des écarts d'une session)`)
  }
} else {
  throw new Error(`« ${quoi} » : heures, detail, gels, volumes ou pauses`)
}
