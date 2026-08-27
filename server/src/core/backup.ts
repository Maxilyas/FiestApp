import { randomUUID } from 'node:crypto'
import { createClient, type Client } from '@libsql/client'
import type { DB } from './db'
import type { PlayerRec } from './party'

/**
 * Recopie des invités et de leurs points dans la base distante.
 *
 * Sur un hébergeur gratuit, le disque est effacé à chaque redémarrage : sans
 * ce miroir, une coupure en pleine soirée ramènerait tout le monde à zéro
 * point, sans que personne comprenne pourquoi. Le moteur de jeu, lui, reste
 * synchrone et rapide — les écritures distantes partent en arrière-plan et
 * ne bloquent jamais une réponse de joueur.
 *
 * Le classement est un journal en ajout seul : chaque ligne porte un
 * identifiant unique, donc la recopie peut être rejouée sans rien dupliquer.
 */
export class PartyBackup {
  private client: Client
  /** Écritures en cours — attendues seulement à l'extinction. */
  private pending = new Set<Promise<unknown>>()

  constructor(url: string, authToken?: string) {
    this.client = createClient({ url, authToken })
  }

  async init() {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS party_players (
           id         TEXT PRIMARY KEY,
           name       TEXT NOT NULL,
           avatar     TEXT NOT NULL,
           token      TEXT NOT NULL,
           created_at INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS party_scores (
           id         TEXT PRIMARY KEY,
           player_id  TEXT NOT NULL,
           session_id TEXT,
           points     INTEGER NOT NULL,
           reason     TEXT NOT NULL,
           created_at INTEGER NOT NULL
         )`,
      ],
      'write',
    )
  }

  /** Lance une écriture sans bloquer l'appelant, et sans jamais faire tomber le serveur. */
  private fireAndForget(promise: Promise<unknown>) {
    const tracked = promise.catch((e: Error) => {
      console.warn(`[sauvegarde] écriture distante impossible : ${e.message}`)
    })
    this.pending.add(tracked)
    tracked.finally(() => this.pending.delete(tracked))
  }

  savePlayer(rec: PlayerRec, createdAt: number) {
    this.fireAndForget(
      this.client.execute({
        sql: `INSERT INTO party_players (id, name, avatar, token, created_at) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar`,
        args: [rec.id, rec.name, rec.avatar, rec.token, createdAt],
      }),
    )
  }

  saveScore(entry: {
    playerId: string
    sessionId?: string
    points: number
    reason: string
    createdAt: number
  }) {
    this.fireAndForget(
      this.client.execute({
        sql: `INSERT INTO party_scores (id, player_id, session_id, points, reason, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          randomUUID(),
          entry.playerId,
          entry.sessionId ?? null,
          entry.points,
          entry.reason,
          entry.createdAt,
        ],
      }),
    )
  }

  /**
   * Recharge la soirée dans la base locale si celle-ci est vide — c'est-à-dire
   * après un redémarrage qui a effacé le disque. Une base locale déjà peuplée
   * fait autorité : on ne veut pas écraser une partie en cours.
   */
  async restoreInto(db: DB): Promise<{ players: number; scores: number }> {
    const local = db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number }
    if (local.n > 0) return { players: 0, scores: 0 }

    const players = await this.client.execute('SELECT * FROM party_players')
    const scores = await this.client.execute('SELECT * FROM party_scores ORDER BY created_at')
    if (players.rows.length === 0) return { players: 0, scores: 0 }

    const insertPlayer = db.prepare(
      'INSERT OR IGNORE INTO players (id, name, avatar, token, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    const insertScore = db.prepare(
      'INSERT INTO score_entries (player_id, session_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    db.transaction(() => {
      for (const r of players.rows) {
        insertPlayer.run(String(r.id), String(r.name), String(r.avatar), String(r.token), Number(r.created_at))
      }
      for (const r of scores.rows) {
        insertScore.run(
          String(r.player_id),
          r.session_id === null ? null : String(r.session_id),
          Number(r.points),
          String(r.reason),
          Number(r.created_at),
        )
      }
    })()
    return { players: players.rows.length, scores: scores.rows.length }
  }

  deletePlayer(playerId: string) {
    this.fireAndForget(
      this.client.batch(
        [
          { sql: 'DELETE FROM party_scores WHERE player_id = ?', args: [playerId] },
          { sql: 'DELETE FROM party_players WHERE id = ?', args: [playerId] },
        ],
        'write',
      ),
    )
  }

  /** Repart d'une soirée vierge — les essais d'avant la fête ne doivent pas y traîner. */
  async reset() {
    await this.client.batch(['DELETE FROM party_scores', 'DELETE FROM party_players'], 'write')
  }

  async close() {
    await Promise.allSettled([...this.pending])
    this.client.close()
  }
}
