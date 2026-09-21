import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

export type DB = Database.Database

/**
 * Les tables de la soirée en cours. Chacune porte l'espace (le compte) à qui
 * la ligne appartient : plusieurs animateurs font leur soirée sur le même
 * serveur, chacun ne lit que les siennes.
 */
const PARTY_TABLES = ['players', 'teams', 'team_bonus', 'answer_log', 'score_entries', 'sessions'] as const

export function initDb(dbPath: string): DB {
  mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      avatar     TEXT NOT NULL,
      token      TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      team_id    TEXT,
      space_id   TEXT
    );

    -- Les équipes de la soirée : le quiz est individuel, mais le tableau des
    -- trois jeux se joue par équipe.
    CREATE TABLE IF NOT EXISTS teams (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      emoji      TEXT NOT NULL,
      position   INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      space_id   TEXT
    );

    -- Prix remis par l'animateur à une équipe, sur l'échelle du barème.
    CREATE TABLE IF NOT EXISTS team_bonus (
      id         TEXT PRIMARY KEY,
      team_id    TEXT NOT NULL,
      points     INTEGER NOT NULL,
      reason     TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      space_id   TEXT
    );

    -- Journal des réponses : une ligne par joueur et par question posée, y
    -- compris quand il n'a pas répondu. Le classement seul ne dit rien des
    -- temps de réponse ni des erreurs — c'est ici que vivent les statistiques.
    CREATE TABLE IF NOT EXISTS answer_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT NOT NULL,
      quiz_title  TEXT NOT NULL,
      q_index     INTEGER NOT NULL,
      kind        TEXT NOT NULL,
      player_id   TEXT NOT NULL,
      answered    INTEGER NOT NULL,
      correct     INTEGER,
      choice      INTEGER,
      value       REAL,
      target      REAL,
      ms          INTEGER,
      changes     INTEGER NOT NULL,
      points      INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      observed    INTEGER NOT NULL,
      created_at  INTEGER NOT NULL,
      space_id    TEXT
    );

    -- Ledger append-only : le score d'un joueur = SUM(points).
    CREATE TABLE IF NOT EXISTS score_entries (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id  TEXT NOT NULL,
      session_id TEXT,
      points     INTEGER NOT NULL,
      reason     TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      space_id   TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id              TEXT PRIMARY KEY,
      status          TEXT NOT NULL,
      participant_ids TEXT NOT NULL,
      state           TEXT NOT NULL,
      timers          TEXT NOT NULL DEFAULT '{}',
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL,
      space_id        TEXT
    );
  `)

  // Les équipes, puis les espaces, sont arrivés après les premiers essais :
  // une base déjà remplie n'a pas ces colonnes, et un ALTER sur une base
  // neuve échouerait.
  addColumn(db, 'players', 'team_id', 'TEXT')
  for (const table of PARTY_TABLES) {
    addColumn(db, table, 'space_id', 'TEXT')
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_space ON ${table}(space_id)`)
  }

  return db
}

function addColumn(db: DB, table: string, column: string, type: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!columns.some(c => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
}

/**
 * Les lignes d'avant les espaces — une soirée en cours au moment de la mise
 * à jour — sont rattachées à l'espace par défaut, celui de l'administrateur.
 * Idempotent : une ligne déjà rattachée n'est pas touchée.
 */
export function stampLegacySpace(db: DB, spaceId: string): number {
  let stamped = 0
  for (const table of PARTY_TABLES) {
    stamped += db.prepare(`UPDATE ${table} SET space_id = ? WHERE space_id IS NULL`).run(spaceId).changes
  }
  return stamped
}

/**
 * Efface tout ce que la soirée d'un espace a laissé ici — la partie en cours
 * comprise : son compte est supprimé. Rend le nombre de lignes parties.
 */
export function wipeSpace(db: DB, spaceId: string): number {
  return db.transaction(() => {
    let removed = 0
    for (const table of PARTY_TABLES) {
      removed += db.prepare(`DELETE FROM ${table} WHERE space_id = ?`).run(spaceId).changes
    }
    return removed
  })()
}
