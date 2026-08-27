import { randomUUID } from 'node:crypto'
import type { DB } from './db'
import type { PublicPlayer } from '../../../shared/types'

export interface PlayerRec {
  id: string
  name: string
  avatar: string
  token: string
}

/**
 * Registre des joueurs. L'identité survit aux déconnexions : le token (stocké
 * côté téléphone) permet de retrouver son joueur après un refresh, une coupure
 * réseau ou un redémarrage du serveur — indispensable à 50 invités.
 */
export class Party {
  private players = new Map<string, PlayerRec>()
  /** playerId -> nombre de sockets ouvertes (multi-onglets). */
  private connections = new Map<string, number>()

  constructor(private db: DB) {
    for (const row of db.prepare('SELECT * FROM players').all() as any[]) {
      this.players.set(row.id, {
        id: row.id,
        name: row.name,
        avatar: row.avatar,
        token: row.token,
      })
    }
  }

  join(name: string, avatar: string, token?: string): PlayerRec | { error: string } {
    const clean = name.trim().slice(0, 24)
    if (token) {
      const existing = [...this.players.values()].find(p => p.token === token)
      if (existing) {
        if (clean) existing.name = clean
        if (avatar) existing.avatar = avatar
        this.db
          .prepare('UPDATE players SET name = ?, avatar = ? WHERE id = ?')
          .run(existing.name, existing.avatar, existing.id)
        return existing
      }
    }
    if (!clean) return { error: 'Il faut un prénom !' }
    const rec: PlayerRec = {
      id: randomUUID(),
      name: clean,
      avatar: avatar || '🎉',
      token: randomUUID(),
    }
    this.players.set(rec.id, rec)
    this.db
      .prepare('INSERT INTO players (id, name, avatar, token, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(rec.id, rec.name, rec.avatar, rec.token, Date.now())
    return rec
  }

  get(id: string): PlayerRec | undefined {
    return this.players.get(id)
  }

  socketConnected(playerId: string) {
    this.connections.set(playerId, (this.connections.get(playerId) ?? 0) + 1)
  }

  socketDisconnected(playerId: string) {
    const n = (this.connections.get(playerId) ?? 1) - 1
    if (n <= 0) this.connections.delete(playerId)
    else this.connections.set(playerId, n)
  }

  isConnected(playerId: string): boolean {
    return this.connections.has(playerId)
  }

  connectedPlayerIds(): string[] {
    return [...this.connections.keys()]
  }

  publicPlayers(totals: Map<string, number>): PublicPlayer[] {
    return [...this.players.values()].map(p => this.toPublic(p, totals.get(p.id) ?? 0))
  }

  publicOne(playerId: string, score: number): PublicPlayer | undefined {
    const p = this.players.get(playerId)
    return p ? this.toPublic(p, score) : undefined
  }

  private toPublic(p: PlayerRec, score: number): PublicPlayer {
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      connected: this.connections.has(p.id),
      score,
    }
  }
}
