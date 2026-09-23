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

    -- Les équipes de la soirée : chacun joue le quiz pour soi, et ses points
    -- font aussi ceux de son équipe.
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

    -- Le nom de la soirée en cours, une ligne par espace. On le recalculait
    -- depuis le plus ancien invité présent : exclure le premier arrivé
    -- rebaptisait la soirée, et l'expérience comme l'archive se
    -- dédoublaient. Tiré une fois, il reste là jusqu'à « Nouvelle soirée ».
    CREATE TABLE IF NOT EXISTS soiree (
      space_id TEXT PRIMARY KEY,
      id       TEXT NOT NULL,
      held_at  INTEGER NOT NULL
    );
  `)

  // Les équipes, puis les espaces, sont arrivés après les premiers essais :
  // une base déjà remplie n'a pas ces colonnes, et un ALTER sur une base
  // neuve échouerait.
  addColumn(db, 'players', 'team_id', 'TEXT')
  // Le profil d'un joueur récurrent, s'il en a un. NULL = invité anonyme,
  // c'est-à-dire tout le monde jusqu'ici : quand elle est vide, rien ne change.
  addColumn(db, 'players', 'profile_id', 'TEXT')
  for (const table of PARTY_TABLES) {
    addColumn(db, table, 'space_id', 'TEXT')
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_space ON ${table}(space_id)`)
  }

  // L'identifiant d'un gain ou d'une réponse dans le miroir, tiré ICI, à
  // l'écriture locale. Il l'était au moment de l'envoi : une recopie
  // rejouée — après une panne, un arrêt, une resynchronisation — tirait un
  // nouvel identifiant, et le gain comptait deux fois au réveil.
  //
  // Les lignes d'avant la mise à jour le gardent vide, exprès : l'ancien
  // miroir les a déjà recopiées sous un identifiant qu'on ne connaît pas, et
  // les renvoyer sous un nouveau les doublerait. Rien ne les renvoie donc.
  addColumn(db, 'score_entries', 'uid', 'TEXT')
  addColumn(db, 'answer_log', 'uid', 'TEXT')
  // La catégorie de la question (`shared/categories.ts`) : la fiche d'un
  // joueur en tire sa réussite par catégorie. Vide pour les questions d'avant.
  addColumn(db, 'answer_log', 'category', 'TEXT')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_score_entries_uid ON score_entries(uid)')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_answer_log_uid ON answer_log(uid)')

  return db
}

/**
 * Tout ce que la base locale sait de la soirée d'un espace, lu d'un seul
 * tenant : c'est la source d'une resynchronisation du miroir. Les lignes
 * brutes, telles que les tables les rangent.
 */
export interface SoireeLocale {
  players: Record<string, unknown>[]
  teams: Record<string, unknown>[]
  bonuses: Record<string, unknown>[]
  sessions: Record<string, unknown>[]
  soiree: { id: string; held_at: number } | null
  /** Seulement celles qui ont un identifiant stable — voir `uid` plus haut. */
  scores: Record<string, unknown>[]
  answers: Record<string, unknown>[]
}

export function lireSoireeLocale(db: DB, spaceId: string): SoireeLocale {
  const tout = (sql: string) => db.prepare(sql).all(spaceId) as Record<string, unknown>[]
  return db.transaction(() => ({
    players: tout('SELECT * FROM players WHERE space_id = ?'),
    teams: tout('SELECT * FROM teams WHERE space_id = ?'),
    bonuses: tout('SELECT * FROM team_bonus WHERE space_id = ?'),
    sessions: tout('SELECT * FROM sessions WHERE space_id = ? ORDER BY created_at'),
    soiree: (db.prepare('SELECT id, held_at FROM soiree WHERE space_id = ?').get(spaceId) ?? null) as SoireeLocale['soiree'],
    scores: tout('SELECT * FROM score_entries WHERE space_id = ? AND uid IS NOT NULL ORDER BY id'),
    answers: tout('SELECT * FROM answer_log WHERE space_id = ? AND uid IS NOT NULL ORDER BY id'),
  }))()
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
    // Hors de la liste du dessus, qui sert aussi à rattacher les lignes
    // d'avant les espaces : cette table-là est née avec eux.
    removed += db.prepare('DELETE FROM soiree WHERE space_id = ?').run(spaceId).changes
    return removed
  })()
}
