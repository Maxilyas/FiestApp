// Les lectures des séries (`SERIES`, `core/campagne.ts`) — le record, l'état
// de la page, les records par catégorie, la série en cours, la série laissée
// qui s'arrête, l'abandon, la fin, la relecture des séries — ne parcourent
// que les séries. Écrit `COALESCE(mode, 'serie') = 'serie'`, le filtre ne
// pouvait servir aucun index : chacune partait de l'index du profil
// (`idx_campagne_series_profil`) et relisait toutes ses parties, de tous les
// modes — les épreuves, les révisions, les duels, les expéditions, et demain
// les parties du Cabinet de curiosités, une dizaine par jour et par joueur
// (la conception du Cabinet, § 1.2). Écrit `mode = 'serie'`, il prend l'index
// des sentiers `(profile_id, mode, …)`, qui ne mène qu'aux séries du profil.
//
// La base de production n'a pas de statistiques (`ANALYZE`) : SQLite y choisit
// ses index à l'aveugle — la série en cours, triée par sa date, lui faisait
// préférer l'index du profil pour s'épargner le tri. Le fichier `file:` qui
// tient lieu de Turso n'en a pas non plus : on y lit le plan de chaque lecture
// telle que le magasin l'a envoyée (le gabarit de `duels-index.test.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { Sqlite3Client } from '@libsql/client/sqlite3'
import { baseDEssai } from './banc'
import { CampagneStore, type RecompensesDeCampagne } from '../src/core/campagne'

/** Le filtre des séries, sous ses deux écritures : le test rougit sur l'ancienne au lieu de ne rien trouver. */
const FILTRE_DES_SERIES = /(?:COALESCE\(mode, 'serie'\)|\bmode) = 'serie'/

/** Chaque lecture des séries, avec ses arguments : le plan se lit tel que le magasin l'a demandé. */
const lectures = new Map<string, unknown[]>()

const proto = Sqlite3Client.prototype as unknown as Record<'execute' | 'batch', (...args: unknown[]) => Promise<unknown>>
for (const methode of ['execute', 'batch'] as const) {
  const origine = proto[methode]
  proto[methode] = function (this: unknown, ...args: unknown[]) {
    const instructions = methode === 'batch' ? (args[0] as unknown[]) : [typeof args[0] === 'string' ? { sql: args[0], args: args[1] } : args[0]]
    for (const i of instructions) {
      const { sql, args: valeurs } = typeof i === 'string' ? { sql: i, args: [] } : (i as { sql: string; args?: unknown })
      if (/\bcampagne_series\b/.test(sql) && FILTRE_DES_SERIES.test(sql)) lectures.set(sql, Array.isArray(valeurs) ? valeurs : [])
    }
    return origine.apply(this, args)
  }
}

/** Rien à ranger : la relecture des séries n'a besoin que d'un magasin de récompenses pour partir. */
const RIEN: RecompensesDeCampagne = {
  ranger: async () => [],
  recompensesOf: () => new Map(),
  accorderPaliersDeCampagne: async () => [],
  legendairesOuverts: () => [],
  tirerUnEclat: async () => null,
}

/** Une ligne du plan (`EXPLAIN QUERY PLAN`). */
interface Etape {
  id: number
  parent: number
  detail: string
}

test('les lectures des séries ne parcourent que les séries — par l’index des sentiers, sans statistiques', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-series-'))
  const fichier = path.join(dir, 'permanente.db')
  const horloge = { t: Date.UTC(2026, 9, 25, 9) }
  const campagne = new CampagneStore(`file:${fichier.replace(/\\/g, '/')}`, undefined, { base: baseDEssai(30), maintenant: () => horloge.t, recompenses: RIEN })
  const db = new Database(fichier)
  try {
    await campagne.init()
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name LIKE 'sqlite_stat%'").get() as { n: number }).n, 0, 'sans statistiques, comme la production')

    // Chaque chemin qui lit les séries : la page, les paliers, une série
    // commencée puis abandonnée, une autre jusqu'à sa troisième faute — sa fin
    // relit le record d'avant —, puis la relecture des séries.
    const lea = 'profil-lea'
    await campagne.etat(lea)
    await campagne.statsDe(lea)
    const abandonnee = await campagne.commencer(lea)
    await campagne.abandonnerSerie(lea, abandonnee.id)
    const serie = await campagne.commencer(lea)
    let question = serie.question
    for (let fautes = 0; question && fautes < 3; fautes++) {
      horloge.t += 10_000
      const r = await campagne.repondre(lea, serie.id, question.index, question.reponses.findIndex(x => !x.startsWith('Bonne')))
      question = r.finie ? undefined : r.suivante
    }
    await campagne.relireLesSeries()

    // Le compte de la page, ses records par catégorie, la série en cours, ses
    // paliers, la série laissée qui s'arrête, le record d'avant — l'abandon et
    // la fin l'écrivent pareil —, la relecture : sans eux tous, le test ne
    // dirait rien.
    assert.ok(lectures.size >= 7, `${lectures.size} lectures des séries seulement :\n${[...lectures.keys()].map(s => s.replace(/\s+/g, ' ')).join('\n')}`)
    for (const [sql, args] of lectures) {
      const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args) as Etape[]
      const dit = `${plan.map(e => `${e.id}<${e.parent} ${e.detail}`).join('\n')}\n— ${sql.replace(/\s+/g, ' ')}`
      const series = plan.filter(e => /^(SCAN|SEARCH) campagne_series\b/.test(e.detail))
      assert.ok(series.length > 0, `les séries absentes du plan :\n${dit}`)
      for (const e of series) {
        if (/\bprofile_id = \?/.test(sql)) {
          // Les séries d'un profil : par le profil ET le mode, jamais toutes ses parties.
          assert.match(e.detail, /^SEARCH campagne_series USING (COVERING )?INDEX idx_campagne_series_sentiers \(profile_id=\? AND mode=\?\)/, `ses parties de tous les modes relues :\n${dit}`)
        } else {
          // Toutes les séries, une fois par version des séries : par le mode, jamais la table entière.
          assert.match(e.detail, /^SEARCH campagne_series USING (COVERING )?INDEX \w+ \(mode=\?\)/, `toute la table relue :\n${dit}`)
        }
      }
    }
  } finally {
    db.close()
    campagne.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
