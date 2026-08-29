import type { DB } from './db'
import type { PartyBackup } from './backup'

/**
 * Une réponse (ou une absence de réponse) d'un joueur à une question.
 *
 * Le classement ne retient que les gains positifs : ni les erreurs, ni les
 * questions laissées passer, ni les temps de réponse n'y laissent de trace.
 * Ce journal les enregistre — c'est la seule source possible pour les
 * statistiques de fin de soirée et les prix qu'on en tire.
 */
export interface AnswerRow {
  sessionId: string
  quizTitle: string
  qIndex: number
  kind: 'choice' | 'number'
  playerId: string
  answered: boolean
  /** QCM : juste ou faux. Une estimation n'est ni l'un ni l'autre. */
  correct: boolean | null
  choice: number | null
  value: number | null
  target: number | null
  /** Temps de réponse depuis l'affichage de la question, en ms. */
  ms: number | null
  /** Nombre de fois où il s'est ravisé avant la révélation. */
  changes: number
  points: number
  /** Temps alloué à la question, pour repérer les réponses de dernière seconde. */
  durationMs: number
  /** La question portait une photo « mémoire ». */
  observed: boolean
  createdAt: number
}

const COLUMNS =
  'session_id, quiz_title, q_index, kind, player_id, answered, correct, choice, value, target, ms, changes, points, duration_ms, observed, created_at'

export class AnswerLog {
  private insertStmt

  constructor(
    private db: DB,
    private backup?: PartyBackup,
  ) {
    this.insertStmt = db.prepare(
      `INSERT INTO answer_log (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
  }

  /** Toutes les lignes d'une question d'un coup — une transaction, une recopie. */
  write(rows: AnswerRow[]) {
    if (rows.length === 0) return
    this.db.transaction(() => {
      for (const r of rows) {
        this.insertStmt.run(
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
    this.backup?.saveAnswers(rows)
  }

  /** Le journal complet, dans l'ordre où les questions ont été posées. */
  all(): AnswerRow[] {
    const rows = this.db
      .prepare(`SELECT ${COLUMNS} FROM answer_log ORDER BY created_at, q_index`)
      .all() as any[]
    return rows.map(toRow)
  }

  /**
   * Efface une question du journal. L'animateur peut annuler les points d'une
   * question mal posée, ou la reposer : dans les deux cas elle ne doit pas
   * peser sur les statistiques, et une question reposée ne doit pas compter
   * deux fois.
   */
  dropQuestion(sessionId: string, qIndex: number) {
    this.db
      .prepare('DELETE FROM answer_log WHERE session_id = ? AND q_index = ?')
      .run(sessionId, qIndex)
    this.backup?.dropAnswers(sessionId, qIndex)
  }

  clearAll() {
    this.db.prepare('DELETE FROM answer_log').run()
  }

  /** Un invité exclu ne doit plus peser sur les statistiques. */
  removePlayer(playerId: string) {
    this.db.prepare('DELETE FROM answer_log WHERE player_id = ?').run(playerId)
  }
}

export function toRow(r: any): AnswerRow {
  return {
    sessionId: String(r.session_id),
    quizTitle: String(r.quiz_title),
    qIndex: Number(r.q_index),
    kind: r.kind === 'number' ? 'number' : 'choice',
    playerId: String(r.player_id),
    answered: Number(r.answered) === 1,
    correct: r.correct === null || r.correct === undefined ? null : Number(r.correct) === 1,
    choice: r.choice === null || r.choice === undefined ? null : Number(r.choice),
    value: r.value === null || r.value === undefined ? null : Number(r.value),
    target: r.target === null || r.target === undefined ? null : Number(r.target),
    ms: r.ms === null || r.ms === undefined ? null : Number(r.ms),
    changes: Number(r.changes ?? 0),
    points: Number(r.points ?? 0),
    durationMs: Number(r.duration_ms ?? 0),
    observed: Number(r.observed) === 1,
    createdAt: Number(r.created_at),
  }
}
