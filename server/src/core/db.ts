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
  return db
}
