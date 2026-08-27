import type { DB } from './db'

/**
 * Ledger de scores append-only. On n'écrase jamais un total : chaque gain est
 * une ligne (joueur, points, raison, partie), et les totaux sont des agrégats.
 * Ça donne gratuitement l'historique et le classement général de la soirée.
 */
export class ScoreLedger {
  private totals = new Map<string, number>()
  private insertStmt

  constructor(private db: DB) {
    this.insertStmt = db.prepare(
      'INSERT INTO score_entries (player_id, session_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    const rows = db
      .prepare('SELECT player_id, SUM(points) AS total FROM score_entries GROUP BY player_id')
      .all() as { player_id: string; total: number }[]
    for (const row of rows) this.totals.set(row.player_id, row.total)
  }

  award(playerId: string, points: number, reason: string, sessionId?: string) {
    this.insertStmt.run(playerId, sessionId ?? null, points, reason, Date.now())
    this.totals.set(playerId, (this.totals.get(playerId) ?? 0) + points)
  }

  total(playerId: string): number {
    return this.totals.get(playerId) ?? 0
  }

  allTotals(): Map<string, number> {
    return this.totals
  }
}
