import { clientDistant, type Client } from './distante'
import type { AnswerRow } from './answers'
import type { PlayerRec } from './party'
import type { TeamRec } from './teams'
import type { ScoreEntry } from './scores'
import { buildRecap } from './recap'
import { buildReview, resolvePacks, type PlayedPack } from './review'
import { questionsDesEquipes, teamScores, vainqueursDuQuiz, type QuestionDEquipe } from '../../../shared/teams'
import { nomAffiche, nomsAffiches } from '../../../shared/homonymes'
import { vainqueurs } from '../../../shared/classement'
import { tronquer } from '../../../shared/avatars'
import type { PublicPlayer, Recap, TeamBonus } from '../../../shared/types'
import type { Review } from '../../../shared/review'
import type { ArchiveSummary, DerniereSoiree, PartyArchive } from '../../../shared/archive'

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
 * invité, figées une fois pour toutes (voir `Soiree`) : archiver deux fois la
 * même soirée met l'archive à jour, sans doublon.
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

/**
 * Une soirée : son nom et son heure de début. C'est sous ce nom qu'elle
 * s'archive, que l'expérience du soir se crédite et que ses prix se rangent
 * — il ne doit donc plus bouger une fois tiré, jusqu'à « Nouvelle soirée ».
 */
export interface Soiree {
  id: string
  heldAt: number
}

/**
 * Le nom qu'on donne à une soirée : l'arrivée du plus ancien invité présent.
 *
 * C'est ainsi qu'on le recalculait à chaque besoin, et c'était le piège :
 * exclure ce premier arrivé — le téléphone d'essai de l'animateur, presque
 * toujours — rebaptisait la soirée en cours de route. On ne l'appelle donc
 * plus qu'une fois par soirée, pour le tirer ; et c'est aussi elle qui rend
 * son nom à une soirée commencée avant qu'on le range.
 */
export function soireeDesInvites(players: { createdAt: number }[]): Soiree | null {
  if (players.length === 0) return null
  const heldAt = Math.min(...players.map(p => p.createdAt))
  return { id: archiveIdOf(heldAt), heldAt }
}

// ── Construire l'archive de la soirée en cours ───────────────────────────

export interface LiveParty {
  /** Son nom, déjà tiré : c'est lui qui fait d'un second archivage une mise à jour. */
  soiree: Soiree
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
  const packs: PartyArchive['packs'] = {}
  for (const [sessionId, pack] of resolvePacks(live.answers, live.packsBySession, live.library)) {
    packs[sessionId] = pack
  }
  return {
    // Lu, pas recalculé : les invités présents ne sont plus forcément ceux
    // de la première sauvegarde, et l'archive doit garder son nom.
    id: live.soiree.id,
    heldAt: live.soiree.heldAt,
    archive: {
      version: 1,
      // Le jeton de reconnexion reste sur le serveur : il n'a rien à faire
      // dans une archive qui se relit publiquement.
      players: live.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        teamId: p.teamId,
        // Le rattachement survit à la soirée : une archive relue des années
        // plus tard sait encore à quel profil créditer ce qui s'y est joué.
        profileId: p.profileId,
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
  // Les marques d'homonymie se recalculent à la relecture, dans l'ordre
  // d'arrivée : une soirée rangée avant que cette règle existe les gagne donc
  // elle aussi, sans qu'on ait réécrit une seule archive.
  const marques = nomsAffiches([...a.players].sort((x, y) => x.createdAt - y.createdAt))
  return a.players.map(p => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    connected: false,
    score: totals.get(p.id) ?? 0,
    teamId: p.teamId,
    ...(marques.has(p.id) && { nomAffiche: marques.get(p.id) }),
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

// ── Le résumé de l'historique ────────────────────────────────────────────

type MetaSoiree = { id: string; title: string; heldAt: number; archivedAt: number }

/**
 * Ce que l'historique garde de chaque soirée pour la lister sans ouvrir son
 * archive : des faits bruts — qui est venu, dans quel ordre, sous quel
 * prénom, avec combien de points — et aucune conclusion.
 *
 * L'ancien résumé rangeait des conclusions, figées à l'archivage : le
 * vainqueur sous son prénom nu (« camille » là où le souvenir dit
 * « camille (2) »), l'équipe gagnante sans les prix (pas celle de l'écran de
 * victoire). Aucune amélioration ne les atteignait. La fiche, elle, se relit
 * avec le code du jour, comme le souvenir, et la marque d'homonymie n'est
 * jamais écrite en base.
 *
 * Et la liste reste légère : une archive pèse jusqu'à plusieurs Mo — le
 * journal des réponses —, une fiche quelques Ko. Relire les archives à chaque
 * affichage de l'historique, c'était télécharger toute la base distante.
 */
interface FicheSoiree {
  /**
   * 3 depuis que la moyenne d'une équipe se lit question par question : une
   * fiche 2 n'en dit pas assez, et se refait une fois depuis son archive,
   * comme un résumé d'avant les fiches.
   */
  v: 3
  /** Tous les invités, dans l'ordre d'arrivée : celui des marques d'homonymie. */
  invites: { id: string; name: string; avatar: string; teamId: string | null; points: number; joue: boolean }[]
  /**
   * `questions` : pour chaque question que l'équipe a jouée, combien de ses
   * membres y étaient et ce qu'ils y ont gagné — `[présents, points]`. Des
   * faits bruts, rangés par la composition de l'archive, que la règle du
   * jour (`moyenneAuProrata`) relit ; quelques octets par question.
   */
  equipes: { id: string; name: string; emoji: string; position: number; questions: [number, number][] }[]
  prix: { teamId: string; points: number }[]
  quiz: number
  questions: number
}

/** Les faits bruts d'une archive, ceux que la liste relira. */
function ficheDe(a: PartyArchive): FicheSoiree {
  const totals = new Map<string, number>()
  for (const s of a.scores) totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.points)
  const joue = new Set(a.answers.map(r => r.playerId))
  const parEquipe = questionsDesEquipes(a.players, a.answers)
  return {
    v: 3,
    invites: [...a.players]
      .sort((x, y) => x.createdAt - y.createdAt)
      .map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        teamId: p.teamId,
        points: totals.get(p.id) ?? 0,
        joue: joue.has(p.id),
      })),
    equipes: a.teams.map(t => ({
      id: t.id,
      name: t.name,
      emoji: t.emoji,
      position: t.position,
      questions: (parEquipe.get(t.id) ?? []).map(q => [q.presents, q.points] as [number, number]),
    })),
    prix: a.bonuses.map(b => ({ teamId: b.teamId, points: b.points })),
    quiz: new Set(a.answers.map(r => r.sessionId)).size,
    questions: new Set(a.answers.map(r => `${r.sessionId}#${r.qIndex}`)).size,
  }
}

/** Une fiche relue en base ; null pour un résumé d'avant les fiches. */
function lireFiche(texte: string): FicheSoiree | null {
  try {
    const f = JSON.parse(texte) as Partial<FicheSoiree> | null
    return f && f.v === 3 && Array.isArray(f.invites) ? (f as FicheSoiree) : null
  } catch {
    return null
  }
}

/**
 * Le résumé d'une soirée, dérivé de sa fiche avec les règles du jour : les
 * marques d'homonymie du souvenir, les ex æquo de la règle commune, et pour
 * les équipes la règle de l'écran de victoire — prix compris.
 */
function resumer(meta: MetaSoiree, fiche: FicheSoiree): ArchiveSummary {
  const marques = nomsAffiches(fiche.invites)
  const joueurs: PublicPlayer[] = fiche.invites.map(i => ({
    id: i.id,
    name: i.name,
    avatar: i.avatar,
    connected: false,
    score: i.points,
    teamId: i.teamId,
    ...(marques.has(i.id) && { nomAffiche: marques.get(i.id) }),
  }))
  const joue = new Set(fiche.invites.filter(i => i.joue).map(i => i.id))
  const enTete = vainqueurs(
    joueurs.filter(p => joue.has(p.id)),
    p => p.score,
    nomAffiche,
    p => p.id,
  )
  return {
    ...meta,
    players: joue.size,
    quizzes: fiche.quiz,
    questions: fiche.questions,
    winners: enTete.map(p => ({ name: nomAffiche(p), avatar: p.avatar, points: p.score })),
    teamWinners: vainqueursDuQuiz(teamScores(fiche.equipes, joueurs, fiche.prix, questionsDeLaFiche(fiche))).map(t => ({
      name: t.name,
      emoji: t.emoji,
      points: t.finalPoints,
    })),
  }
}

function questionsDeLaFiche(fiche: FicheSoiree): Map<string, QuestionDEquipe[]> {
  return new Map(fiche.equipes.map(e => [e.id, e.questions.map(([presents, points]) => ({ presents, points }))]))
}

/** Ce que la liste de l'historique montre d'une soirée — ici, archive en main. */
export function summarize(meta: MetaSoiree, a: PartyArchive): ArchiveSummary {
  return resumer(meta, ficheDe(a))
}

/** Une archive que l'on ne sait plus lire se résume comme une soirée vide. */
const ARCHIVE_VIDE: PartyArchive = { version: 1, players: [], teams: [], bonuses: [], scores: [], answers: [], packs: {} }

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
    this.client = clientDistant(url, authToken)
  }

  /**
   * Crée la table ; si elle date d'avant les espaces (identifiant seul pour
   * clé), elle est reconstruite en une transaction et ses soirées rattachées
   * à l'espace par défaut. Les identifiants — donc les liens déjà partagés —
   * ne changent pas.
   *
   * La forme de la table se LIT dans le schéma, elle ne se devine pas à
   * l'échec d'une requête. On prenait n'importe quelle erreur d'un `SELECT
   * space_id` pour « table d'avant les espaces » : une base qui décrochait à
   * cet instant-là, et toutes les archives de tous les espaces partaient chez
   * l'espace par défaut — sans retour. Désormais, une erreur fait échouer le
   * démarrage, et rien n'est migré.
   */
  async init(defaultSpace: string) {
    await this.client.execute(`CREATE TABLE IF NOT EXISTS soirees (${SOIREES_COLUMNS})`)
    const colonnes = (await this.client.execute('PRAGMA table_info(soirees)')).rows.map(c => String(c.name))
    if (colonnes.includes('space_id')) return
    // Une table qu'on vient de créer et dont le schéma revient vide : la base
    // dit n'importe quoi, et migrer sur cette foi serait tout miser sur elle.
    if (colonnes.length === 0) throw new Error('Historique illisible : la table des soirées n’a renvoyé aucune colonne')
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

  /**
   * La plus récente des soirées rangées, hors `sauf` — la soirée en cours,
   * qui se range après chaque quiz. Trois colonnes et une ligne : les pages
   * d'un espace la demandent à chaque rafraîchissement entre deux soirées.
   */
  async derniere(spaceId: string, sauf: string | null): Promise<DerniereSoiree | null> {
    const res = await this.client.execute(
      sauf
        ? {
            sql: 'SELECT id, title, held_at FROM soirees WHERE space_id = ? AND id != ? ORDER BY held_at DESC LIMIT 1',
            args: [spaceId, sauf],
          }
        : { sql: 'SELECT id, title, held_at FROM soirees WHERE space_id = ? ORDER BY held_at DESC LIMIT 1', args: [spaceId] },
    )
    const r = res.rows[0]
    return r ? { id: String(r.id), title: String(r.title), heldAt: Number(r.held_at) } : null
  }

  /**
   * De la plus récente à la plus ancienne. Ne lit que les fiches : jamais les
   * archives elles-mêmes, sauf une fois pour une soirée rangée avant les
   * fiches.
   */
  async list(spaceId: string): Promise<ArchiveSummary[]> {
    const res = await this.client.execute({
      sql: 'SELECT id, title, held_at, archived_at, summary FROM soirees WHERE space_id = ? ORDER BY held_at DESC',
      args: [spaceId],
    })
    const lignes = res.rows.map(r => ({
      meta: { id: String(r.id), title: String(r.title), heldAt: Number(r.held_at), archivedAt: Number(r.archived_at) },
      stocke: String(r.summary),
      fiche: lireFiche(String(r.summary)),
    }))
    const anciennes = lignes.filter(l => !l.fiche)
    if (anciennes.length > 0) {
      const fiches = await this.refaireFiches(spaceId, anciennes)
      for (const l of anciennes) l.fiche = fiches.get(l.meta.id) ?? ficheDe(ARCHIVE_VIDE)
    }
    return lignes.map(l => resumer(l.meta, l.fiche!))
  }

  /**
   * Les soirées rangées avant les fiches n'ont qu'un résumé figé, qu'on ne
   * peut pas relire avec les règles du jour : on relit leur archive, une
   * fois, et la fiche prend la place du résumé. La mise à jour ne vaut que si
   * le résumé est toujours l'ancien — un archivage passé entre-temps a écrit
   * une fiche plus récente, qu'on n'écrase pas.
   */
  private async refaireFiches(
    spaceId: string,
    anciennes: { meta: MetaSoiree; stocke: string }[],
  ): Promise<Map<string, FicheSoiree>> {
    const res = await this.client.execute({
      sql: `SELECT id, data FROM soirees WHERE space_id = ? AND id IN (${anciennes.map(() => '?').join(', ')})`,
      args: [spaceId, ...anciennes.map(l => l.meta.id)],
    })
    const fiches = new Map<string, FicheSoiree>()
    /** Les archives illisibles : listées vides, mais jamais réécrites. */
    const illisibles = new Set<string>()
    for (const r of res.rows) {
      let archive = ARCHIVE_VIDE
      try {
        archive = JSON.parse(String(r.data)) as PartyArchive
      } catch (e) {
        // Illisible : une archive abîmée ne doit pas emporter tout
        // l'historique, elle se liste comme une soirée vide. Mais la panne
        // se dit au journal — c'est là qu'on la répare —, et son résumé
        // d'origine reste en base : le remplacer par une fiche vide
        // effacerait la dernière trace de ce qu'elle contenait.
        console.error(`[historique] archive illisible « ${String(r.id)} » :`, e)
        illisibles.add(String(r.id))
      }
      fiches.set(String(r.id), ficheDe(archive))
    }
    const majs = anciennes
      .filter(l => fiches.has(l.meta.id) && !illisibles.has(l.meta.id))
      .map(l => ({
        sql: 'UPDATE soirees SET summary = ? WHERE space_id = ? AND id = ? AND summary = ?',
        args: [JSON.stringify(fiches.get(l.meta.id)), spaceId, l.meta.id, l.stocke],
      }))
    // Retirées entre les deux lectures : il n'y a plus rien à réécrire.
    if (majs.length > 0) await this.client.batch(majs, 'write')
    return fiches
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
    const clean = tronquer((title ?? '').trim(), 80)
    const finalTitle = clean || kept || archiveTitle(heldAt)
    const archivedAt = Date.now()
    // La colonne `summary` porte la fiche, pas le résumé : des faits bruts,
    // que la liste relira avec les règles du jour.
    const fiche = ficheDe(archive)
    await this.client.execute({
      sql: `INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(space_id, id) DO UPDATE SET title = excluded.title, held_at = excluded.held_at,
              archived_at = excluded.archived_at, summary = excluded.summary, data = excluded.data`,
      args: [spaceId, id, finalTitle, heldAt, archivedAt, JSON.stringify(fiche), JSON.stringify(archive)],
    })
    return resumer({ id, title: finalTitle, heldAt, archivedAt }, fiche)
  }

  async rename(spaceId: string, id: string, title: unknown): Promise<ArchiveSummary | null> {
    const clean = tronquer(String(title ?? '').trim(), 80)
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

  /** Toutes les soirées rangées, tous espaces confondus : le recalcul de l'expérience les relit une à une. */
  async toutes(): Promise<{ spaceId: string; id: string }[]> {
    const res = await this.client.execute('SELECT space_id, id FROM soirees ORDER BY held_at')
    return res.rows.map(r => ({ spaceId: String(r.space_id), id: String(r.id) }))
  }

  /** Efface toutes les soirées d'un espace : son compte est supprimé. Rend leur nombre. */
  async removeSpace(spaceId: string): Promise<number> {
    const res = await this.client.execute({ sql: 'DELETE FROM soirees WHERE space_id = ?', args: [spaceId] })
    return res.rowsAffected
  }

  close() {
    this.client.close()
  }
}
