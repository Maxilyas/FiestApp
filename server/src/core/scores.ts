import { randomUUID } from 'node:crypto'
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
  /**
   * Monte à chaque écriture du journal des gains : les pages publiques
   * (`core/pages.ts`) s'en servent pour savoir si leur calcul tient encore,
   * sans relire le journal.
   */
  revision = 0

  constructor(
    private db: DB,
    private spaceId: string,
    private backup?: PartyMirror,
  ) {
    this.insertStmt = db.prepare(
      'INSERT INTO score_entries (uid, player_id, session_id, points, reason, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    const rows = db
      .prepare('SELECT player_id, SUM(points) AS total FROM score_entries WHERE space_id = ? GROUP BY player_id')
      .all(spaceId) as { player_id: string; total: number }[]
    for (const row of rows) this.totals.set(row.player_id, row.total)
  }

  award(playerId: string, points: number, reason: string, sessionId?: string) {
    const createdAt = Date.now()
    // L'identifiant du gain naît ici, avec la ligne locale, et c'est lui que
    // le miroir reprend : une recopie rejouée ne peut plus compter deux fois.
    const uid = randomUUID()
    this.insertStmt.run(uid, playerId, sessionId ?? null, points, reason, createdAt, this.spaceId)
    this.totals.set(playerId, (this.totals.get(playerId) ?? 0) + points)
    this.backup?.saveScore({ uid, playerId, sessionId: sessionId ?? null, points, reason, createdAt })
    this.revision++
  }

  /**
   * Après une remise à zéro de la soirée : le journal de l'espace, et ses
   * totaux en mémoire. Le miroir, lui, s'efface d'un bloc (`PartyMirror.reset`).
   */
  clearAll() {
    this.db.prepare('DELETE FROM score_entries WHERE space_id = ?').run(this.spaceId)
    this.totals.clear()
    this.revision++
  }

  /**
   * Un invité exclu : ses gains partent avec lui, ici, dans le total gardé en
   * mémoire, et au miroir.
   *
   * Le registre des gains est le seul propriétaire de ses lignes. `Party`
   * les effaçait aussi, ici et — par l'effacement de l'invité — au miroir,
   * mais pas le total en mémoire : deux propriétaires pour un même
   * effacement, dont chacun croyait l'autre inutile, et un journal qui ne
   * disait plus la même chose que son agrégat.
   */
  removePlayer(playerId: string) {
    const { changes } = this.db
      .prepare('DELETE FROM score_entries WHERE player_id = ? AND space_id = ?')
      .run(playerId, this.spaceId)
    this.totals.delete(playerId)
    this.backup?.deletePlayerScores(playerId)
    // Un invité qui n'avait rien gagné ne change pas le journal.
    if (changes > 0) this.revision++
  }

  /**
   * Vrai s'il a au moins une ligne au journal des gains — un prix annulé
   * compris : le total peut revenir à zéro, pas l'histoire.
   */
  aGagne(playerId: string): boolean {
    return !!this.db
      .prepare('SELECT 1 FROM score_entries WHERE player_id = ? AND space_id = ? LIMIT 1')
      .get(playerId, this.spaceId)
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
