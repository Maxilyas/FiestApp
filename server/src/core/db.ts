import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

export type DB = Database.Database

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
      created_at INTEGER NOT NULL
    );

    -- Les équipes de la soirée : le quiz est individuel, mais le tableau des
    -- trois jeux se joue par équipe.
    CREATE TABLE IF NOT EXISTS teams (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      emoji      TEXT NOT NULL,
      position   INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Prix remis par l'animateur à une équipe, sur l'échelle du barème.
    CREATE TABLE IF NOT EXISTS team_bonus (
      id         TEXT PRIMARY KEY,
      team_id    TEXT NOT NULL,
      points     INTEGER NOT NULL,
      reason     TEXT NOT NULL,
      created_at INTEGER NOT NULL
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
      created_at  INTEGER NOT NULL
    );

    -- Ledger append-only : le score d'un joueur = SUM(points).
    CREATE TABLE IF NOT EXISTS score_entries (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id  TEXT NOT NULL,
      session_id TEXT,
      points     INTEGER NOT NULL,
      reason     TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id              TEXT PRIMARY KEY,
      status          TEXT NOT NULL,
      participant_ids TEXT NOT NULL,
      state           TEXT NOT NULL,
      timers          TEXT NOT NULL DEFAULT '{}',
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );
  `)

  // Les équipes sont arrivées après les premiers essais : une base déjà
  // remplie n'a pas la colonne, et un ALTER sur une base neuve échouerait.
  const columns = db.prepare('PRAGMA table_info(players)').all() as { name: string }[]
  if (!columns.some(c => c.name === 'team_id')) {
    db.exec('ALTER TABLE players ADD COLUMN team_id TEXT')
  }

  return db
}
