// Les paliers de tous, que le relevé des collectionneurs lit d'un lot
// (`CampagneStore.paliersDeTous`) : leurs seules épreuves validées, par l'index
// partiel qui les tient (`idx_campagne_series_validees`). La base de production
// n'a pas de statistiques ; sans elles, filtrées sur le mode seul
// (`WHERE mode = 'sentier' AND issue = 'validee'`), SQLite prenait l'index des
// duels et relisait toutes les épreuves, ratées comprises — et sous celles
// d'une production, il basculait ailleurs : un plan qui ne tient pas. Un
// `CROSS JOIN` qui part des profils cherche, profil par profil, ses validées
// dans l'index partiel, sous les deux (le gabarit de `campagne-index.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai } from './banc'
import { DE_LA_PRODUCTION, RIEN, sousCesStatistiques } from './statistiques'
import { CampagneStore } from '../src/core/campagne'
import { ProfileStore } from '../src/auth/profiles'

/** Ce que le relevé envoie pour les épreuves validées de tous, tel qu'il l'envoie. */
const envoyees: string[] = []
const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    const instructions = methode === 'batch' ? (args[0] as unknown[]) : [args[0]]
    for (const i of instructions) {
      const sql = typeof i === 'string' ? i : (i as { sql: string }).sql
      if (/^\s*SELECT\b/.test(sql) && /\bcampagne_series\b/.test(sql) && /issue = 'validee'/.test(sql) && !/profile_id = \?/.test(sql)) envoyees.push(sql)
    }
    return origine.apply(this, args)
  }
}

interface Etape {
  id: number
  parent: number
  detail: string
}

const unPlan = (db: Database.Database, sql: string) => db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as Etape[]
const ditLePlan = (plan: Etape[], sql: string) => `${plan.map(e => `${e.id}<${e.parent} ${e.detail}`).join('\n')}\n— ${sql.replace(/\s+/g, ' ')}`

/** Profil par profil, ses validées dans l'index partiel — jamais un parcours de la table des parties, ni l'index d'un autre. */
function lireLePlan(db: Database.Database, sql: string, quand: string) {
  const plan = unPlan(db, sql)
  const parties = plan.filter(e => /\bcampagne_series\b|\bs\b USING/.test(e.detail) || /^(SCAN|SEARCH) s\b/.test(e.detail))
  assert.ok(parties.length > 0, `${quand} :\n${ditLePlan(plan, sql)}`)
  for (const e of parties) assert.match(e.detail, /^SEARCH s USING COVERING INDEX idx_campagne_series_validees \(profile_id=\?\)$/, `${quand} :\n${ditLePlan(plan, sql)}`)
}

test('les paliers de tous se lisent par l’index des seules épreuves validées, sans statistiques comme sous celles d’une production', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-collectionneurs-'))
  const fichier = path.join(dir, 'permanente.db')
  const url = `file:${fichier.replace(/\\/g, '/')}`
  const profils = new ProfileStore(url)
  const campagne = new CampagneStore(url, undefined, { base: baseDEssai(30), recompenses: RIEN })
  envoyees.length = 0
  try {
    await profils.init()
    await campagne.init()
    assert.deepEqual(await campagne.paliersDeTous(), new Map(), 'personne n’a de palier')
    assert.equal(envoyees.length, 1, `ses validées, une instruction :\n${envoyees.join('\n')}`)
    const db = new Database(fichier)
    try {
      assert.equal((db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'sqlite_stat%'").get() as { n: number }).n, 0, 'sans statistiques, comme la production')
      lireLePlan(db, envoyees[0], 'sans statistiques')
    } finally {
      db.close()
    }
    const sous = await sousCesStatistiques(DE_LA_PRODUCTION)
    try {
      lireLePlan(sous.db, envoyees[0], 'sous les statistiques d’une production')
    } finally {
      sous.fermer()
    }
  } finally {
    campagne.close()
    profils.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
