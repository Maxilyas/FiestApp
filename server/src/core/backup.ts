import { randomUUID } from 'node:crypto'
import { createClient, type Client } from '@libsql/client'
import type { DB } from './db'
import type { PlayerRec } from './party'
import type { TeamRec } from './teams'
import { toRow, type AnswerRow } from './answers'
import type { TeamBonus } from '../../../shared/types'

/**
 * Recopie des invités, des équipes et de leurs points dans la base distante.
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
        `CREATE TABLE IF NOT EXISTS party_teams (
           id         TEXT PRIMARY KEY,
           name       TEXT NOT NULL,
           emoji      TEXT NOT NULL,
           position   INTEGER NOT NULL,
           created_at INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS party_bonus (
           id         TEXT PRIMARY KEY,
           team_id    TEXT NOT NULL,
           points     INTEGER NOT NULL,
           reason     TEXT NOT NULL,
           created_at INTEGER NOT NULL
         )`,
        `CREATE TABLE IF NOT EXISTS party_answers (
           id          TEXT PRIMARY KEY,
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
    // Les équipes sont arrivées après les premiers essais : une base distante
    // créée avant elles n'a pas la colonne. libsql n'a pas d'« ADD COLUMN IF
    // NOT EXISTS », alors on tente et on ignore le refus.
    try {
      await this.client.execute('ALTER TABLE party_players ADD COLUMN team_id TEXT')
    } catch {
      // Colonne déjà là : c'est le cas normal après le premier démarrage.
    }
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
        sql: `INSERT INTO party_players (id, name, avatar, token, team_id, created_at) VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, team_id = excluded.team_id`,
        args: [rec.id, rec.name, rec.avatar, rec.token, rec.teamId, createdAt],
      }),
    )
  }

  saveTeam(rec: TeamRec) {
    this.fireAndForget(
      this.client.execute({
        sql: `INSERT INTO party_teams (id, name, emoji, position, created_at) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET name = excluded.name, emoji = excluded.emoji`,
        args: [rec.id, rec.name, rec.emoji, rec.position, rec.createdAt],
      }),
    )
  }

  saveBonus(rec: TeamBonus) {
    this.fireAndForget(
      this.client.execute({
        sql: `INSERT INTO party_bonus (id, team_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO NOTHING`,
        args: [rec.id, rec.teamId, rec.points, rec.reason, rec.createdAt],
      }),
    )
  }

  dropAnswers(sessionId: string, qIndex: number) {
    this.fireAndForget(
      this.client.execute({
        sql: 'DELETE FROM party_answers WHERE session_id = ? AND q_index = ?',
        args: [sessionId, qIndex],
      }),
    )
  }

  deleteBonus(bonusId: string) {
    this.fireAndForget(
      this.client.execute({ sql: 'DELETE FROM party_bonus WHERE id = ?', args: [bonusId] }),
    )
  }

  /**
   * Le journal d'une question part en un seul lot : cinquante requetes
   * separees par question saturent la liaison avec la base distante pour
   * rien, alors qu'elles arrivent toutes au meme instant.
   */
  saveAnswers(rows: AnswerRow[]) {
    if (rows.length === 0) return
    this.fireAndForget(
      this.client.batch(
        rows.map(r => ({
          sql: `INSERT INTO party_answers (id, session_id, quiz_title, q_index, kind, player_id, answered,
                  correct, choice, value, target, ms, changes, points, duration_ms, observed, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            randomUUID(),
            r.sessionId,
            r.quizTitle,
            r.qIndex,
            r.kind,
            r.playerId,
            r.answered ? 1 : 0,
            r.correct === null ? null : r.correct ? 1 : 0,
            r.choice,
            r.value,
            r.target,
            r.ms,
            r.changes,
            r.points,
            r.durationMs,
            r.observed ? 1 : 0,
            r.createdAt,
          ],
        })),
        'write',
      ),
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
  async restoreInto(db: DB): Promise<{ players: number; teams: number; scores: number; answers: number }> {
    const local = db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number }
    const localTeams = db.prepare('SELECT COUNT(*) AS n FROM teams').get() as { n: number }
    if (local.n > 0 || localTeams.n > 0) return { players: 0, teams: 0, scores: 0, answers: 0 }

    const teams = await this.client.execute('SELECT * FROM party_teams ORDER BY position')
    const players = await this.client.execute('SELECT * FROM party_players')
    const scores = await this.client.execute('SELECT * FROM party_scores ORDER BY created_at')
    const bonuses = await this.client.execute('SELECT * FROM party_bonus ORDER BY created_at')
    const answers = await this.client.execute('SELECT * FROM party_answers ORDER BY created_at, q_index')
    if (players.rows.length === 0 && teams.rows.length === 0) {
      return { players: 0, teams: 0, scores: 0, answers: 0 }
    }

    const insertTeam = db.prepare(
      'INSERT OR IGNORE INTO teams (id, name, emoji, position, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    const insertPlayer = db.prepare(
      'INSERT OR IGNORE INTO players (id, name, avatar, token, team_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    const insertScore = db.prepare(
      'INSERT INTO score_entries (player_id, session_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    const insertBonus = db.prepare(
      'INSERT OR IGNORE INTO team_bonus (id, team_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    const insertAnswer = db.prepare(
      `INSERT INTO answer_log (session_id, quiz_title, q_index, kind, player_id, answered, correct,
         choice, value, target, ms, changes, points, duration_ms, observed, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    db.transaction(() => {
      for (const r of teams.rows) {
        insertTeam.run(String(r.id), String(r.name), String(r.emoji), Number(r.position), Number(r.created_at))
      }
      for (const r of players.rows) {
        insertPlayer.run(
          String(r.id),
          String(r.name),
          String(r.avatar),
          String(r.token),
          r.team_id === null || r.team_id === undefined ? null : String(r.team_id),
          Number(r.created_at),
        )
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
      for (const r of bonuses.rows) {
        insertBonus.run(String(r.id), String(r.team_id), Number(r.points), String(r.reason), Number(r.created_at))
      }
      for (const raw of answers.rows) {
        const r = toRow(raw)
        insertAnswer.run(
          r.sessionId,
          r.quizTitle,
          r.qIndex,
          r.kind,
          r.playerId,
          r.answered ? 1 : 0,
          r.correct === null ? null : r.correct ? 1 : 0,
          r.choice,
          r.value,
          r.target,
          r.ms,
          r.changes,
          r.points,
          r.durationMs,
          r.observed ? 1 : 0,
          r.createdAt,
        )
      }
    })()
    return {
      players: players.rows.length,
      teams: teams.rows.length,
      scores: scores.rows.length,
      answers: answers.rows.length,
    }
  }

  deletePlayer(playerId: string) {
    this.fireAndForget(
      this.client.batch(
        [
          { sql: 'DELETE FROM party_scores WHERE player_id = ?', args: [playerId] },
          { sql: 'DELETE FROM party_answers WHERE player_id = ?', args: [playerId] },
          { sql: 'DELETE FROM party_players WHERE id = ?', args: [playerId] },
        ],
        'write',
      ),
    )
  }

  /** L'équipe disparaît ; ses membres sont mis à jour séparément par `Party`. */
  deleteTeam(teamId: string) {
    this.fireAndForget(
      this.client.execute({ sql: 'DELETE FROM party_teams WHERE id = ?', args: [teamId] }),
    )
  }

  /** Repart d'une soirée vierge — les essais d'avant la fête ne doivent pas y traîner. */
  async reset() {
    await this.client.batch(
      [
        'DELETE FROM party_scores',
        'DELETE FROM party_answers',
        'DELETE FROM party_bonus',
        'DELETE FROM party_players',
        'DELETE FROM party_teams',
      ],
      'write',
    )
  }

  async close() {
    await Promise.allSettled([...this.pending])
    this.client.close()
  }
}
