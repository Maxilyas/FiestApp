// Ce que la base lit pour les requêtes les plus lourdes du quiz du jour et du
// profil (Turso facture et sert à la ligne lue) : le plan de SQLite, et le
// nombre de lignes que chaque plan parcourt sur un serveur de 500 profils et
// trente jours.
//   cd server && nice -n 10 node --import tsx --test ../export/evaluations/perf-serveur/plans.test.ts
import { test } from 'node:test'
import { writeFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { peupler } from './peupler'
import { ADMIN, demarrer } from '../../../server/test/banc'

test('les plans des requêtes lourdes', async () => {
  const banc = await demarrer()
  try {
    const fichier = banc.quizDbUrl.replace(/^file:/, '')
    const spaceId = (new Database(fichier, { readonly: true }).prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
    const pop = peupler(fichier, { spaceId, aujourdhui: '2026-09-27' })
    const db = new Database(fichier, { readonly: true })
    const moi = pop.ids[0]
    const jours = (db.prepare('SELECT jour FROM jour_parties WHERE profile_id = ? ORDER BY jour DESC LIMIT 30').all(moi) as { jour: string }[]).map(r => r.jour)
    const requetes: { nom: string; sql: string; args: unknown[] }[] = [
      {
        nom: 'clorePasses — les jours à clore (core/jour.ts:1193)',
        sql: `SELECT DISTINCT jour FROM jour_parties WHERE jour < ? AND jour NOT IN (SELECT jour FROM jour_clotures) ORDER BY jour`,
        args: ['2026-09-27'],
      },
      {
        nom: 'joursJoues — les points de tous, ses 30 jours (core/jour.ts:1112)',
        sql: `SELECT jour, points FROM jour_parties WHERE jour IN (${jours.map(() => '?').join(', ')})
              AND profile_id IN (SELECT id FROM profiles WHERE disabled_at IS NULL)
              AND (profile_id = ? OR profile_id NOT IN (SELECT profile_id FROM jour_masques))`,
        args: [...jours, moi],
      },
      {
        nom: 'classementDuMois (core/jour.ts:900)',
        sql: `SELECT profile_id, SUM(points) AS points, MIN(commencee_le) AS commencee_le FROM jour_parties WHERE jour >= ? AND jour <= ? GROUP BY profile_id`,
        args: ['2026-09-01', '2026-09-31'],
      },
      {
        nom: 'categoriesDe (core/jour.ts:1025)',
        sql: `SELECT json_extract(t.questions, '$[' || r.question || '].categorie') AS categorie, COUNT(*) AS questions, SUM(r.juste) AS justes
              FROM jour_reponses r JOIN jour_tirages t ON t.jour = r.jour
              WHERE r.profile_id = ? AND NOT EXISTS (SELECT 1 FROM json_each(t.annulees) a WHERE a.value = r.question) GROUP BY categorie`,
        args: [moi],
      },
      {
        nom: 'populationBadges (auth/profiles.ts:1612)',
        sql: 'SELECT badge, COUNT(DISTINCT profile_id) AS n FROM profile_badges GROUP BY badge',
        args: [],
      },
    ]
    const sortie = requetes.map(q => {
      const plan = (db.prepare(`EXPLAIN QUERY PLAN ${q.sql}`).all(...q.args) as { detail: string }[]).map(r => r.detail)
      const stmt = db.prepare(q.sql)
      const t0 = performance.now()
      const rendues = stmt.all(...q.args).length
      return { nom: q.nom, plan, rendues, ms: +(performance.now() - t0).toFixed(1) }
    })
    const tailles = Object.fromEntries(
      ['jour_parties', 'jour_reponses', 'jour_tirages', 'profile_badges', 'profile_xp', 'profiles'].map(t => [t, (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n]),
    )
    db.close()
    console.log(JSON.stringify({ tailles, sortie }, null, 1))
    writeFileSync(new URL('./mesures-plans.json', import.meta.url), JSON.stringify({ tailles, sortie }, null, 1))
  } finally {
    await banc.close()
  }
})
