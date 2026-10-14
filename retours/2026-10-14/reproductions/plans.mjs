// Les plans des requêtes qui parcourent une table entière, et ceux de leur
// réécriture, sur la base peuplée par `routes.ts`. Sans `ANALYZE` — ni ici,
// ni chez Turso —, SQLite choisit son plan sans rien savoir du volume : celui
// qu'on lit ici est celui de la production, quelle que soit la taille.
//
//   node retours/2026-10-14/reproductions/plans.mjs [export/perf-turso/permanente-aujourdhui.db]
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const require = createRequire(path.join(racine, 'server/package.json'))
const Database = require('better-sqlite3')
const db = new Database(process.argv[2] ?? path.join(racine, 'export/perf-turso/permanente-aujourdhui.db'), { readonly: true })
const plan = (titre, sql, args) => console.log(`\n${titre}\n  ` + db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(r => r.detail).join(' | '))

const H = 3_600_000
const HORS_LIGNES_A_PART = "soiree_id NOT IN ('#paliers', '#jour', '#campagne', '#rattrapage')"
const maintenant = Date.now()

// 1. Le carnet (`CampagneStore.suivisDe`) : l'accueil de chaque profil, le carnet, ce qu'il a appris.
const carnet = filtre => `WITH miennes AS (
    SELECT r.reserve_id AS id, r.juste AS juste, r.repondue_le AS le, r.serie_id AS serie, r.position AS position
    FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id
    WHERE s.profile_id = ? AND NOT (s.mode = 'defi' AND s.semaine >= ?) AND ${filtre}
  ) SELECT id, juste, le FROM miennes WHERE id IN (SELECT id FROM miennes WHERE juste = 0) ORDER BY le, serie, position`
plan('carnet — aujourd’hui : la liste de tous les duels ouverts', carnet("NOT (s.mode = 'duel' AND s.duel IN (SELECT code FROM campagne_duels WHERE ferme_le > ?))"), ['x', '2026-10-12', maintenant])
plan('carnet — réécrit : son duel, par sa clé', carnet("NOT (s.mode = 'duel' AND EXISTS (SELECT 1 FROM campagne_duels d WHERE d.code = s.duel AND d.ferme_le > ?))"), ['x', '2026-10-12', maintenant])

// 2. L'économie du QG (`CampagneStore.economieDepuis`) : le planificateur préfère parcourir les réponses.
const economie = jointure => `SELECT r.repondue_le / ${H} AS heure, COUNT(*) AS n FROM campagne_series s ${jointure} campagne_reponses r ON r.serie_id = s.id
  WHERE s.commencee_le >= ? AND r.repondue_le >= ? AND r.juste = 1 GROUP BY heure`
plan('économie — aujourd’hui (JOIN)', economie('JOIN'), [maintenant - 7 * 24 * H, maintenant - 24 * H])
plan('économie — réécrit (CROSS JOIN : les séries d’abord, par leur date)', economie('CROSS JOIN'), [maintenant - 7 * 24 * H, maintenant - 24 * H])

// 3. Les séries du QG (`JourStore.seriesEnCours`) : l'UNION se fusionne par profil, en parcourant les deux tables.
const candidats = union => `WITH candidats AS (
    SELECT c.profile_id FROM (
      SELECT profile_id FROM jour_parties WHERE jour >= ?
      ${union} SELECT profile_id FROM profile_xp WHERE created_at >= ? AND ${HORS_LIGNES_A_PART}
    ) c JOIN profiles pr ON pr.id = c.profile_id AND pr.disabled_at IS NULL)
  SELECT profile_id, json_group_array(jour) AS dates FROM jour_parties WHERE profile_id IN (SELECT profile_id FROM candidats) GROUP BY profile_id`
plan('séries du QG — aujourd’hui (UNION)', candidats('UNION'), ['2026-10-10', maintenant - 4 * 24 * H])
plan('séries du QG — réécrit (UNION ALL : IN ne demande pas de doublons écartés)', candidats('UNION ALL'), ['2026-10-10', maintenant - 4 * 24 * H])

// 4. `/healthz`, toutes les dix minutes (`JourStore.etatDeLaReserve`), et ce que la vue d'ensemble lit déjà.
plan('/healthz — aujourd’hui (etatDeLaReserve)', 'SELECT SUM(CASE WHEN retiree_le IS NULL AND posee_le IS NULL THEN 1 ELSE 0 END) AS pretes FROM jour_reserve', [])
plan('/healthz — avanceDeLaReserve (existe déjà)', 'SELECT COUNT(*) AS n FROM jour_reserve WHERE posee_le IS NULL AND retiree_le IS NULL', [])

// 5. La mesure des difficultés (`CampagneStore.mesures`, toutes les dix minutes) et le modèle du savoir (`LECTURE_DU_SAVOIR`, toutes les demi-heures et à chaque réveil).
plan('mesures — aujourd’hui : toutes les réponses de campagne', `SELECT json_group_object(reserve_id, json_array(justes, total)) AS mesures FROM (
    SELECT reserve_id, SUM(juste) AS justes, COUNT(*) AS total FROM campagne_reponses
    WHERE serie_id NOT IN (SELECT id FROM campagne_series WHERE mode = 'revision') GROUP BY reserve_id)`, [])
plan('savoir — aujourd’hui : toutes les premières réponses', `SELECT profile_id, json_group_object(reserve_id, juste) AS premieres FROM (
    SELECT s.profile_id AS profile_id, r.reserve_id AS reserve_id, MIN(r.repondue_le * 2 + r.juste) % 2 AS juste
    FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id GROUP BY s.profile_id, r.reserve_id) GROUP BY profile_id`, [])
plan('l’une ou l’autre en delta : ce qui est venu depuis la dernière lecture', 'SELECT r.rowid, r.reserve_id, r.juste, r.repondue_le, s.profile_id, s.mode FROM campagne_reponses r JOIN campagne_series s ON s.id = r.serie_id WHERE r.rowid > ?', [1000])
