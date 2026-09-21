import type { DB } from './db'
import type { PartyMirror } from './backup'

/**
 * Ledger de scores append-only. On n'écrase jamais un total : chaque gain est
 * une ligne (joueur, points, raison, partie), et les totaux sont des agrégats.
 * Ça donne gratuitement l'historique et le classement général de la soirée.
 */
export interface ScoreEntry {
  playerId: string
  sessionId: string | null
  points: number
  reason: string
  createdAt: number
}

export class ScoreLedger {
  private totals = new Map<string, number>()
  private insertStmt

  constructor(
    private db: DB,
    private spaceId: string,
    private backup?: PartyMirror,
  ) {
    this.insertStmt = db.prepare(
      'INSERT INTO score_entries (player_id, session_id, points, reason, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)',
    )
    const rows = db
      .prepare('SELECT player_id, SUM(points) AS total FROM score_entries WHERE space_id = ? GROUP BY player_id')
      .all(spaceId) as { player_id: string; total: number }[]
    for (const row of rows) this.totals.set(row.player_id, row.total)
  }

  award(playerId: string, points: number, reason: string, sessionId?: string) {
    const createdAt = Date.now()
    this.insertStmt.run(playerId, sessionId ?? null, points, reason, createdAt, this.spaceId)
    this.totals.set(playerId, (this.totals.get(playerId) ?? 0) + points)
    this.backup?.saveScore({ playerId, sessionId, points, reason, createdAt })
  }

  /** Après une remise à zéro de la soirée : les totaux en mémoire aussi. */
  clearAll() {
    this.totals.clear()
  }

  total(playerId: string): number {
    return this.totals.get(playerId) ?? 0
  }

  /** Tout le journal de l'espace, dans l'ordre : la page souvenir et l'archive en vivent. */
  all(): ScoreEntry[] {
    const rows = this.db
      .prepare(
        'SELECT player_id, session_id, points, reason, created_at FROM score_entries WHERE space_id = ? ORDER BY created_at, id',
      )
      .all(this.spaceId) as any[]
    return rows.map(r => ({
      playerId: String(r.player_id),
      sessionId: r.session_id === null || r.session_id === undefined ? null : String(r.session_id),
      points: Number(r.points),
      reason: String(r.reason),
      createdAt: Number(r.created_at),
    }))
  }

  allTotals(): Map<string, number> {
    return this.totals
  }
}
