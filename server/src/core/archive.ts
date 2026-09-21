import { createClient, type Client } from '@libsql/client'
import type { AnswerRow } from './answers'
import type { PlayerRec } from './party'
import type { TeamRec } from './teams'
import type { ScoreEntry } from './scores'
import { buildRecap } from './recap'
import { buildReview, resolvePacks, type PlayedPack } from './review'
import { rankTeams, teamScores } from '../../../shared/teams'
import type { PublicPlayer, Recap, TeamBonus } from '../../../shared/types'
import type { Review } from '../../../shared/review'
import type { ArchiveSummary, PartyArchive } from '../../../shared/archive'

/**
 * L'historique des soirées.
 *
 * Une soirée archivée est une copie complète de ce qui s'est joué — invités,
 * équipes, points, prix, journal des réponses, et les quiz tels qu'ils ont
 * été posés — rangée dans la base permanente, à côté de la bibliothèque.
 * Rien n'est recalculé à l'archivage : le souvenir, les statistiques et le
 * bilan se relisent depuis ces données brutes, avec le code du jour. Une
 * amélioration des prix ou du bilan profite donc aussi aux soirées passées.
 *
 * L'identifiant d'une soirée est sa date et l'heure d'arrivée du premier
 * invité : archiver deux fois la même soirée met l'archive à jour, sans
 * doublon.
 */

/** Le fuseau de la fête, pour nommer les soirées par leur date. */
const TIMEZONE = 'Europe/Paris'

export function archiveTitle(heldAt: number): string {
  const day = new Date(heldAt).toLocaleDateString('fr-FR', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return `Soirée du ${day}`
}

export function archiveIdOf(heldAt: number): string {
  // « 2026-09-19-k7x2q » : lisible dans une adresse, unique à la seconde près.
  const day = new Date(heldAt).toLocaleDateString('fr-CA', { timeZone: TIMEZONE })
  return `${day}-${heldAt.toString(36).slice(-5)}`
}

// ── Construire l'archive de la soirée en cours ───────────────────────────

export interface LiveParty {
  players: PlayerRec[]
  teams: TeamRec[]
  bonuses: TeamBonus[]
  scores: ScoreEntry[]
  answers: AnswerRow[]
  /** Les copies exactes des quiz des parties terminées, quand le disque les a encore. */
  packsBySession: Map<string, PlayedPack>
  library: PlayedPack[]
}

/** Null tant qu'aucune question n'a été jouée : il n'y a rien à garder. */
export function buildArchive(live: LiveParty): { id: string; heldAt: number; archive: PartyArchive } | null {
  if (live.answers.length === 0 || live.players.length === 0) return null
  const heldAt = Math.min(...live.players.map(p => p.createdAt))
  const packs: PartyArchive['packs'] = {}
  for (const [sessionId, pack] of resolvePacks(live.answers, live.packsBySession, live.library)) {
    packs[sessionId] = pack
  }
  return {
    id: archiveIdOf(heldAt),
    heldAt,
    archive: {
      version: 1,
      // Le jeton de reconnexion reste sur le serveur : il n'a rien à faire
      // dans une archive qui se relit publiquement.
      players: live.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        teamId: p.teamId,
        createdAt: p.createdAt,
      })),
      teams: live.teams,
      bonuses: live.bonuses,
      scores: live.scores,
      answers: live.answers,
      packs,
    },
  }
}

// ── Relire une archive ───────────────────────────────────────────────────

function archivePlayers(a: PartyArchive): PublicPlayer[] {
  const totals = new Map<string, number>()
  for (const s of a.scores) totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.points)
  return a.players.map(p => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    connected: false,
    score: totals.get(p.id) ?? 0,
    teamId: p.teamId,
  }))
}

export function recapOfArchive(a: PartyArchive): Recap {
  return buildRecap({
    players: archivePlayers(a),
    teams: a.teams,
    bonuses: a.bonuses,
    scores: a.scores,
    answers: a.answers,
  })
}

export function reviewOfArchive(a: PartyArchive): Review {
  // Une copie exacte fait foi ; un quiz reconstitué depuis la bibliothèque
  // repasse par la vérification de cohérence, comme au moment de l'archivage.
  const packsBySession = new Map<string, PlayedPack>()
  const library: PlayedPack[] = []
  for (const [sessionId, pack] of Object.entries(a.packs)) {
    if (pack.exact) packsBySession.set(sessionId, pack)
    else library.push(pack)
  }
  return buildReview({
    rows: a.answers,
    players: archivePlayers(a),
    teams: a.teams,
    bonuses: a.bonuses,
    packsBySession,
    library,
  })
}

/** Ce que la liste de l'historique montre d'une soirée, sans ouvrir l'archive. */
export function summarize(
  meta: { id: string; title: string; heldAt: number; archivedAt: number },
  a: PartyArchive,
): ArchiveSummary {
  const players = archivePlayers(a)
  const played = new Set(a.answers.map(r => r.playerId))
  const top = [...players].filter(p => played.has(p.id)).sort((a, b) => b.score - a.score)[0]
  const teams = rankTeams(teamScores(a.teams, players, a.bonuses))
  const teamWinner = teams[0] && teams[0].average > 0 ? teams[0] : null
  return {
    ...meta,
    players: played.size,
    quizzes: new Set(a.answers.map(r => r.sessionId)).size,
    questions: new Set(a.answers.map(r => `${r.sessionId}#${r.qIndex}`)).size,
    winner: top && top.score > 0 ? { name: top.name, avatar: top.avatar, points: top.score } : null,
    teamWinner: teamWinner ? { name: teamWinner.name, emoji: teamWinner.emoji } : null,
  }
}

// ── Le rangement ─────────────────────────────────────────────────────────

const ID = /^[\w-]{1,64}$/

/** La table telle qu'elle est depuis les espaces : une soirée par espace et par identifiant. */
const SOIREES_COLUMNS = `
  space_id    TEXT NOT NULL,
  id          TEXT NOT NULL,
  title       TEXT NOT NULL,
  held_at     INTEGER NOT NULL,
  archived_at INTEGER NOT NULL,
  summary     TEXT NOT NULL,
  data        TEXT NOT NULL,
  PRIMARY KEY (space_id, id)`

/**
 * L'historique de chaque espace. La clé est le couple (espace, identifiant) :
 * deux animateurs peuvent avoir fait leur soirée le même soir à la même
 * seconde sans que l'un écrase l'autre — et un identifiant étranger vaut
 * « introuvable », au niveau du stockage lui-même.
 */
export class ArchiveStore {
  private client: Client

  constructor(url: string, authToken?: string) {
    this.client = createClient({ url, authToken })
  }

  /**
   * Crée la table ; si elle date d'avant les espaces (identifiant seul pour
   * clé), elle est reconstruite en une transaction et ses soirées rattachées
   * à l'espace par défaut. Les identifiants — donc les liens déjà partagés —
   * ne changent pas.
   */
  async init(defaultSpace: string) {
    await this.client.execute(`CREATE TABLE IF NOT EXISTS soirees (${SOIREES_COLUMNS})`)
    let hasSpace = true
    try {
      await this.client.execute('SELECT space_id FROM soirees LIMIT 1')
    } catch {
      hasSpace = false
    }
    if (hasSpace) return
    await this.client.batch(
      [
        `CREATE TABLE soirees_v2 (${SOIREES_COLUMNS})`,
        {
          sql: `INSERT INTO soirees_v2 (space_id, id, title, held_at, archived_at, summary, data)
                SELECT ?, id, title, held_at, archived_at, summary, data FROM soirees`,
          args: [defaultSpace],
        },
        'DROP TABLE soirees',
        'ALTER TABLE soirees_v2 RENAME TO soirees',
      ],
      'write',
    )
  }

  /** De la plus récente à la plus ancienne. */
  async list(spaceId: string): Promise<ArchiveSummary[]> {
    const res = await this.client.execute({
      sql: 'SELECT id, title, held_at, archived_at, summary FROM soirees WHERE space_id = ? ORDER BY held_at DESC',
      args: [spaceId],
    })
    return res.rows.map(r => ({
      ...(JSON.parse(String(r.summary)) as ArchiveSummary),
      id: String(r.id),
      title: String(r.title),
      heldAt: Number(r.held_at),
      archivedAt: Number(r.archived_at),
    }))
  }

  async get(spaceId: string, id: string): Promise<{ summary: ArchiveSummary; archive: PartyArchive } | null> {
    if (!ID.test(id)) return null
    const res = await this.client.execute({
      sql: 'SELECT * FROM soirees WHERE space_id = ? AND id = ?',
      args: [spaceId, id],
    })
    const r = res.rows[0]
    if (!r) return null
    const archive = JSON.parse(String(r.data)) as PartyArchive
    const meta = { id: String(r.id), title: String(r.title), heldAt: Number(r.held_at), archivedAt: Number(r.archived_at) }
    return { summary: summarize(meta, archive), archive }
  }

  /**
   * Range une soirée. Une archive déjà là est mise à jour et garde son titre,
   * sauf si on en donne un nouveau.
   */
  async save(spaceId: string, id: string, heldAt: number, archive: PartyArchive, title?: string): Promise<ArchiveSummary> {
    const existing = await this.client.execute({
      sql: 'SELECT title FROM soirees WHERE space_id = ? AND id = ?',
      args: [spaceId, id],
    })
    const kept = existing.rows[0] ? String(existing.rows[0].title) : null
    const clean = (title ?? '').trim().slice(0, 80)
    const finalTitle = clean || kept || archiveTitle(heldAt)
    const archivedAt = Date.now()
    const summary = summarize({ id, title: finalTitle, heldAt, archivedAt }, archive)
    await this.client.execute({
      sql: `INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(space_id, id) DO UPDATE SET title = excluded.title, held_at = excluded.held_at,
              archived_at = excluded.archived_at, summary = excluded.summary, data = excluded.data`,
      args: [spaceId, id, finalTitle, heldAt, archivedAt, JSON.stringify(summary), JSON.stringify(archive)],
    })
    return summary
  }

  async rename(spaceId: string, id: string, title: unknown): Promise<ArchiveSummary | null> {
    const clean = String(title ?? '').trim().slice(0, 80)
    if (!ID.test(id) || !clean) return null
    const res = await this.client.execute({
      sql: 'UPDATE soirees SET title = ? WHERE space_id = ? AND id = ?',
      args: [clean, spaceId, id],
    })
    if (res.rowsAffected === 0) return null
    return (await this.list(spaceId)).find(s => s.id === id) ?? null
  }

  async remove(spaceId: string, id: string): Promise<boolean> {
    if (!ID.test(id)) return false
    const res = await this.client.execute({
      sql: 'DELETE FROM soirees WHERE space_id = ? AND id = ?',
      args: [spaceId, id],
    })
    return res.rowsAffected > 0
  }

  close() {
    this.client.close()
  }
}
