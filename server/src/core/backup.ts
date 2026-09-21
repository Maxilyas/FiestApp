import { randomUUID } from 'node:crypto'
import { createClient, type Client } from '@libsql/client'
import type { DB } from './db'
import type { PlayerRec } from './party'
import type { TeamRec } from './teams'
import { toRow, type AnswerRow } from './answers'
import type { TeamBonus } from '../../../shared/types'

/** Une partie telle qu'elle est écrite dans la table `sessions` locale. */
export interface SessionRow {
  id: string
  spaceId: string
  status: 'running' | 'ended'
  participantIds: string
  state: string
  timers: string
  createdAt: number
  updatedAt: number
}

/** Le miroir vu depuis un espace : chaque écriture porte son identifiant. */
export interface PartyMirror {
  savePlayer(rec: PlayerRec, createdAt: number): void
  saveTeam(rec: TeamRec): void
  saveBonus(rec: TeamBonus): void
  dropAnswers(sessionId: string, qIndex: number): void
  deleteBonus(bonusId: string): void
  saveAnswers(rows: AnswerRow[]): void
  saveSession(row: SessionRow): void
  deleteSession(id: string): void
  saveScore(entry: { playerId: string; sessionId?: string; points: number; reason: string; createdAt: number }): void
  deletePlayer(playerId: string): void
  deleteTeam(teamId: string): void
  /** Repart d'une soirée vierge — pour cet espace seulement. */
  reset(): Promise<void>
}

/** Les six tables du miroir, celles qui portent l'espace. */
const MIRROR_TABLES = ['party_players', 'party_teams', 'party_bonus', 'party_answers', 'party_scores', 'party_sessions']

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
 *
 * Chaque ligne porte l'espace (le compte) dont elle est la soirée : les
 * soirées de plusieurs animateurs cohabitent dans les mêmes tables.
 */
export class PartyBackup {
  private client: Client
  /** Écritures en cours — attendues seulement à l'extinction. */
  private pending = new Set<Promise<unknown>>()
  private defaultSpace = ''

  constructor(url: string, authToken?: string) {
    this.client = createClient({ url, authToken })
  }

  /**
   * Crée les tables, puis rattache à l'espace par défaut les lignes d'avant
   * les espaces. Idempotent : rien n'est copié ni effacé.
   */
  async init(defaultSpace: string) {
    this.defaultSpace = defaultSpace
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS party_players (
           id         TEXT PRIMARY KEY,
           name       TEXT NOT NULL,
           avatar     TEXT NOT NULL,
           token      TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           team_id    TEXT,
           space_id   TEXT
         )`,
        `CREATE TABLE IF NOT EXISTS party_teams (
           id         TEXT PRIMARY KEY,
           name       TEXT NOT NULL,
           emoji      TEXT NOT NULL,
           position   INTEGER NOT NULL,
           created_at INTEGER NOT NULL,
           space_id   TEXT
         )`,
        `CREATE TABLE IF NOT EXISTS party_bonus (
           id         TEXT PRIMARY KEY,
           team_id    TEXT NOT NULL,
           points     INTEGER NOT NULL,
           reason     TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           space_id   TEXT
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
           created_at  INTEGER NOT NULL,
           space_id    TEXT
         )`,
        `CREATE TABLE IF NOT EXISTS party_scores (
           id         TEXT PRIMARY KEY,
           player_id  TEXT NOT NULL,
           session_id TEXT,
           points     INTEGER NOT NULL,
           reason     TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           space_id   TEXT
         )`,
        // La partie en cours, question et réponses comprises. Sans elle, un
        // redémarrage de l'hébergeur en plein quiz gardait les points mais
        // renvoyait tout le monde en salle d'attente.
        `CREATE TABLE IF NOT EXISTS party_sessions (
           id              TEXT PRIMARY KEY,
           status          TEXT NOT NULL,
           participant_ids TEXT NOT NULL,
           state           TEXT NOT NULL,
           timers          TEXT NOT NULL,
           created_at      INTEGER NOT NULL,
           updated_at      INTEGER NOT NULL,
           space_id        TEXT
         )`,
      ],
      'write',
    )
    // Les équipes, puis les espaces, sont arrivés après les premiers essais :
    // une base distante créée avant eux n'a pas ces colonnes. libsql n'a pas
    // d'« ADD COLUMN IF NOT EXISTS », alors on tente et on ignore le refus.
    await this.addColumn('party_players', 'team_id TEXT')
    for (const table of MIRROR_TABLES) await this.addColumn(table, 'space_id TEXT')
    await this.client.batch(
      [
        ...MIRROR_TABLES.map(table => `CREATE INDEX IF NOT EXISTS idx_${table}_space ON ${table}(space_id)`),
        ...MIRROR_TABLES.map(table => ({ sql: `UPDATE ${table} SET space_id = ? WHERE space_id IS NULL`, args: [defaultSpace] })),
      ],
      'write',
    )
  }

  private async addColumn(table: string, definition: string) {
    try {
      await this.client.execute(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
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

  /** Le miroir d'un espace : les mêmes écritures, chacune signée de l'espace. */
  forSpace(spaceId: string): PartyMirror {
    const run = (sql: string, args: (string | number | null | Buffer)[]) =>
      this.fireAndForget(this.client.execute({ sql, args }))
    return {
      savePlayer: (rec, createdAt) =>
        run(
          `INSERT INTO party_players (id, name, avatar, token, team_id, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, team_id = excluded.team_id`,
          [rec.id, rec.name, rec.avatar, rec.token, rec.teamId, createdAt, spaceId],
        ),
      saveTeam: rec =>
        run(
          `INSERT INTO party_teams (id, name, emoji, position, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, emoji = excluded.emoji`,
          [rec.id, rec.name, rec.emoji, rec.position, rec.createdAt, spaceId],
        ),
      saveBonus: rec =>
        run(
          `INSERT INTO party_bonus (id, team_id, points, reason, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO NOTHING`,
          [rec.id, rec.teamId, rec.points, rec.reason, rec.createdAt, spaceId],
        ),
      // Les identifiants de partie, de prix, d'invité et d'équipe sont des
      // UUID, uniques entre tous les espaces : les effacements visent la
      // ligne, pas l'espace.
      dropAnswers: (sessionId, qIndex) =>
        run('DELETE FROM party_answers WHERE session_id = ? AND q_index = ?', [sessionId, qIndex]),
      deleteBonus: bonusId => run('DELETE FROM party_bonus WHERE id = ?', [bonusId]),
      /**
       * Le journal d'une question part en un seul lot : cinquante requêtes
       * séparées par question saturent la liaison avec la base distante pour
       * rien, alors qu'elles arrivent toutes au même instant.
       */
      saveAnswers: rows => {
        if (rows.length === 0) return
        this.fireAndForget(
          this.client.batch(
            rows.map(r => ({
              sql: `INSERT INTO party_answers (id, session_id, quiz_title, q_index, kind, player_id, answered,
                      correct, choice, value, target, ms, changes, points, duration_ms, observed, created_at, space_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                spaceId,
              ],
            })),
            'write',
          ),
        )
      },
      /** La partie en cours, telle que le moteur la persiste localement. */
      saveSession: row =>
        run(
          `INSERT INTO party_sessions (id, status, participant_ids, state, timers, created_at, updated_at, space_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET status = excluded.status,
             participant_ids = excluded.participant_ids, state = excluded.state,
             timers = excluded.timers, updated_at = excluded.updated_at`,
          [row.id, row.status, row.participantIds, row.state, row.timers, row.createdAt, row.updatedAt, spaceId],
        ),
      /** Une partie terminée n'a plus rien à reprendre : elle sort du miroir. */
      deleteSession: id => run('DELETE FROM party_sessions WHERE id = ?', [id]),
      saveScore: entry =>
        run(
          `INSERT INTO party_scores (id, player_id, session_id, points, reason, created_at, space_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), entry.playerId, entry.sessionId ?? null, entry.points, entry.reason, entry.createdAt, spaceId],
        ),
      deletePlayer: playerId =>
        this.fireAndForget(
          this.client.batch(
            [
              { sql: 'DELETE FROM party_scores WHERE player_id = ?', args: [playerId] },
              { sql: 'DELETE FROM party_answers WHERE player_id = ?', args: [playerId] },
              { sql: 'DELETE FROM party_players WHERE id = ?', args: [playerId] },
            ],
            'write',
          ),
        ),
      /** L'équipe disparaît ; ses membres sont mis à jour séparément par `Party`. */
      deleteTeam: teamId => run('DELETE FROM party_teams WHERE id = ?', [teamId]),
      /** Repart d'une soirée vierge — les essais d'avant la fête ne doivent pas y traîner. */
      reset: async () => {
        await this.client.batch(
          MIRROR_TABLES.map(table => ({ sql: `DELETE FROM ${table} WHERE space_id = ?`, args: [spaceId] })),
          'write',
        )
      },
    }
  }

  /**
   * Recharge les soirées dans la base locale si celle-ci est vide — c'est-à-dire
   * après un redémarrage qui a effacé le disque. Une base locale déjà peuplée
   * fait autorité : on ne veut pas écraser une partie en cours. Tous les
   * espaces reviennent d'un coup, chaque ligne avec le sien.
   */
  async restoreInto(
    db: DB,
  ): Promise<{ players: number; teams: number; scores: number; answers: number; sessions: number; spaces: number }> {
    const none = { players: 0, teams: 0, scores: 0, answers: 0, sessions: 0, spaces: 0 }
    const local = db.prepare('SELECT COUNT(*) AS n FROM players').get() as { n: number }
    const localTeams = db.prepare('SELECT COUNT(*) AS n FROM teams').get() as { n: number }
    if (local.n > 0 || localTeams.n > 0) return none

    const teams = await this.client.execute('SELECT * FROM party_teams ORDER BY position')
    const players = await this.client.execute('SELECT * FROM party_players')
    const scores = await this.client.execute('SELECT * FROM party_scores ORDER BY created_at')
    const bonuses = await this.client.execute('SELECT * FROM party_bonus ORDER BY created_at')
    const answers = await this.client.execute('SELECT * FROM party_answers ORDER BY created_at, q_index')
    const sessions = await this.client.execute("SELECT * FROM party_sessions WHERE status = 'running'")
    if (players.rows.length === 0 && teams.rows.length === 0) return none

    const spaceOf = (r: Record<string, unknown>) =>
      r.space_id === null || r.space_id === undefined ? this.defaultSpace : String(r.space_id)
    const spaces = new Set<string>()

    const insertTeam = db.prepare(
      'INSERT OR IGNORE INTO teams (id, name, emoji, position, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)',
    )
    const insertPlayer = db.prepare(
      'INSERT OR IGNORE INTO players (id, name, avatar, token, team_id, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    const insertScore = db.prepare(
      'INSERT INTO score_entries (player_id, session_id, points, reason, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)',
    )
    const insertBonus = db.prepare(
      'INSERT OR IGNORE INTO team_bonus (id, team_id, points, reason, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)',
    )
    const insertAnswer = db.prepare(
      `INSERT INTO answer_log (session_id, quiz_title, q_index, kind, player_id, answered, correct,
         choice, value, target, ms, changes, points, duration_ms, observed, created_at, space_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insertSession = db.prepare(
      `INSERT OR IGNORE INTO sessions (id, status, participant_ids, state, timers, created_at, updated_at, space_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    db.transaction(() => {
      for (const r of sessions.rows) {
        insertSession.run(
          String(r.id),
          String(r.status),
          String(r.participant_ids),
          String(r.state),
          String(r.timers),
          Number(r.created_at),
          Number(r.updated_at),
          spaceOf(r),
        )
      }
      for (const r of teams.rows) {
        spaces.add(spaceOf(r))
        insertTeam.run(String(r.id), String(r.name), String(r.emoji), Number(r.position), Number(r.created_at), spaceOf(r))
      }
      for (const r of players.rows) {
        spaces.add(spaceOf(r))
        insertPlayer.run(
          String(r.id),
          String(r.name),
          String(r.avatar),
          String(r.token),
          r.team_id === null || r.team_id === undefined ? null : String(r.team_id),
          Number(r.created_at),
          spaceOf(r),
        )
      }
      for (const r of scores.rows) {
        insertScore.run(
          String(r.player_id),
          r.session_id === null ? null : String(r.session_id),
          Number(r.points),
          String(r.reason),
          Number(r.created_at),
          spaceOf(r),
        )
      }
      for (const r of bonuses.rows) {
        insertBonus.run(String(r.id), String(r.team_id), Number(r.points), String(r.reason), Number(r.created_at), spaceOf(r))
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
          spaceOf(raw),
        )
      }
    })()
    return {
      players: players.rows.length,
      teams: teams.rows.length,
      scores: scores.rows.length,
      answers: answers.rows.length,
      sessions: sessions.rows.length,
      spaces: spaces.size,
    }
  }

  async close() {
    await Promise.allSettled([...this.pending])
    this.client.close()
  }
}
