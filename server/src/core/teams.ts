import { randomUUID } from 'node:crypto'
import type { DB } from './db'
import type { PartyBackup } from './backup'

export interface TeamRec {
  id: string
  name: string
  emoji: string
  position: number
  createdAt: number
}

/**
 * Les six équipes proposées en un clic, sur le thème de la soirée. Elles se
 * renomment ensuite : ce n'est qu'un point de départ pour éviter de taper six
 * noms au moment où les invités arrivent.
 */
export const DEFAULT_TEAMS = [
  { name: 'Les Salseras', emoji: '💃' },
  { name: 'Les Rumberos', emoji: '🕺' },
  { name: 'Les Micros', emoji: '🎤' },
  { name: 'Les Facettes', emoji: '🪩' },
  { name: 'Les Congas', emoji: '🥁' },
  { name: 'Les Piments', emoji: '🌶️' },
]

/** Au-delà, le choix d'équipe ne tient plus sur un écran de téléphone. */
const MAX_TEAMS = 10

/**
 * Registre des équipes. Volontairement séparé des joueurs : une équipe vit
 * toute la soirée, alors que ses membres vont et viennent. Supprimer une
 * équipe ne supprime personne — ses membres se retrouvent simplement sans
 * équipe, et l'animateur les replace.
 */
export class Teams {
  private teams = new Map<string, TeamRec>()

  constructor(
    private db: DB,
    private backup?: PartyBackup,
  ) {
    for (const row of db.prepare('SELECT * FROM teams').all() as any[]) {
      this.teams.set(row.id, {
        id: row.id,
        name: row.name,
        emoji: row.emoji,
        position: row.position,
        createdAt: row.created_at,
      })
    }
  }

  /** Toujours dans l'ordre de création : le choix ne doit pas bouger sous le doigt. */
  all(): TeamRec[] {
    return [...this.teams.values()].sort((a, b) => a.position - b.position)
  }

  has(id: string): boolean {
    return this.teams.has(id)
  }

  count(): number {
    return this.teams.size
  }

  create(name: string, emoji: string): TeamRec | { error: string } {
    if (this.teams.size >= MAX_TEAMS) return { error: `Pas plus de ${MAX_TEAMS} équipes` }
    const clean = name.trim().slice(0, 20)
    if (!clean) return { error: "Il faut un nom d'équipe" }
    const rec: TeamRec = {
      id: randomUUID(),
      name: clean,
      emoji: emoji?.trim().slice(0, 4) || '🎈',
      position: this.nextPosition(),
      createdAt: Date.now(),
    }
    this.teams.set(rec.id, rec)
    this.db
      .prepare('INSERT INTO teams (id, name, emoji, position, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(rec.id, rec.name, rec.emoji, rec.position, rec.createdAt)
    this.backup?.saveTeam(rec)
    return rec
  }

  update(id: string, patch: { name?: string; emoji?: string }): boolean {
    const rec = this.teams.get(id)
    if (!rec) return false
    const name = patch.name?.trim().slice(0, 20)
    const emoji = patch.emoji?.trim().slice(0, 4)
    if (name) rec.name = name
    if (emoji) rec.emoji = emoji
    this.db.prepare('UPDATE teams SET name = ?, emoji = ? WHERE id = ?').run(rec.name, rec.emoji, id)
    this.backup?.saveTeam(rec)
    return true
  }

  remove(id: string): boolean {
    if (!this.teams.delete(id)) return false
    this.db.prepare('DELETE FROM teams WHERE id = ?').run(id)
    this.backup?.deleteTeam(id)
    return true
  }

  /** Les six équipes par défaut — seulement s'il n'y en a aucune. */
  seedDefaults(): number {
    if (this.teams.size > 0) return 0
    for (const t of DEFAULT_TEAMS) this.create(t.name, t.emoji)
    return DEFAULT_TEAMS.length
  }

  clearAll() {
    this.db.prepare('DELETE FROM teams').run()
    this.teams.clear()
  }

  private nextPosition(): number {
    return this.teams.size === 0
      ? 0
      : Math.max(...[...this.teams.values()].map(t => t.position)) + 1
  }
}
