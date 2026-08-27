import type { DB } from './db'
import type { PartyBackup } from './backup'

/**
 * Ledger de scores append-only. On n'écrase jamais un total : chaque gain est
 * une ligne (joueur, points, raison, partie), et les totaux sont des agrégats.
 * Ça donne gratuitement l'historique et le classement général de la soirée.
 */
export class ScoreLedger {
  private totals = new Map<string, number>()
  private insertStmt

  constructor(
    private db: DB,
    private backup?: PartyBackup,
  ) {
    this.insertStmt = db.prepare(
      'INSERT INTO score_entries (player_id, session_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    const rows = db
      .prepare('SELECT player_id, SUM(points) AS total FROM score_entries GROUP BY player_id')
      .all() as { player_id: string; total: number }[]
    for (const row of rows) this.totals.set(row.player_id, row.total)
  }

  award(playerId: string, points: number, reason: string, sessionId?: string) {
    const createdAt = Date.now()
    this.insertStmt.run(playerId, sessionId ?? null, points, reason, createdAt)
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

  allTotals(): Map<string, number> {
    return this.totals
  }
}
