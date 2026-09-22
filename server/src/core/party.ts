import { randomUUID } from 'node:crypto'
import type { DB } from './db'
import type { PartyMirror } from './backup'
import type { PublicPlayer } from '../../../shared/types'
import type { Finition } from '../../../shared/profil'
import { DEFAULT_AVATAR, cleanAvatar, cleanName } from '../../../shared/avatars'
import { nomsAffiches } from '../../../shared/homonymes'

export interface PlayerRec {
  id: string
  name: string
  avatar: string
  token: string
  teamId: string | null
  /** Son profil de joueur récurrent, s'il en a un. Null = invité anonyme. */
  profileId: string | null
  createdAt: number
}

/** Ce qu'un profil ajoute à un joueur sur les écrans. */
export interface ProfileBadge {
  niveau: number
  finition: Finition
  /** Cet emoji-là a éclaté pour lui. */
  eclat: boolean
}

/**
 * De quoi décorer un joueur rattaché. Injecté plutôt que lu : le registre des
 * joueurs n'a pas à connaître la base des profils, et cette lecture doit être
 * synchrone — elle sert à chaque diffusion à toute la salle.
 */
export type BadgeLookup = (profileId: string, avatar: string) => ProfileBadge | undefined

/**
 * Registre des joueurs d'un espace. L'identité survit aux déconnexions : le
 * token (stocké côté téléphone) permet de retrouver son joueur après un
 * refresh, une coupure réseau ou un redémarrage du serveur — indispensable à
 * 50 invités. Un jeton ne vaut que dans l'espace où il a été délivré.
 */
export class Party {
  private players = new Map<string, PlayerRec>()
  /**
   * playerId -> les connexions qui l'incarnent (multi-onglets, téléphone et
   * tablette). Un ensemble d'identifiants et non un compteur : le même socket
   * se rattachait deux fois — par sa réponse tapée pendant la coupure, puis
   * par la re-présentation de la page — et ne se décomptait qu'une fois à la
   * déconnexion. Le joueur parti restait « connecté » pour toujours, devenait
   * participant du quiz suivant, et la salle attendait le chronomètre complet
   * à chaque question.
   */
  private connections = new Map<string, Set<string>>()
  /** Les marques d'homonymie, tant que personne n'arrive, ne part ni ne change de prénom ou d'avatar. */
  private marquesCache: Map<string, string> | null = null

  constructor(
    private db: DB,
    private spaceId: string,
    private backup?: PartyMirror,
    private badgeOf?: BadgeLookup,
  ) {
    for (const row of db.prepare('SELECT * FROM players WHERE space_id = ?').all(spaceId) as any[]) {
      this.players.set(row.id, {
        id: row.id,
        name: row.name,
        avatar: row.avatar,
        token: row.token,
        teamId: row.team_id ?? null,
        profileId: row.profile_id ?? null,
        createdAt: row.created_at,
      })
    }
  }

  /**
   * Inscrit un invité, ou retrouve celui du jeton. Pour un invité retrouvé,
   * un prénom ou un avatar vide laisse ceux de sa fiche : c'est ce que
   * `sockets.ts` envoie quand un téléphone se re-présente tout seul, et la
   * fiche du serveur fait alors foi.
   */
  join(
    name: string,
    avatar: string,
    token?: string,
    teamId?: string | null,
  ): PlayerRec | { error: string } {
    // Rien de ce qui vient du téléphone n'est pris tel quel : un avatar de
    // cinq mille caractères a été accepté un jour, et rediffusé à toute la salle.
    const clean = cleanName(name)
    const nice = typeof avatar === 'string' && avatar ? cleanAvatar(avatar) : ''
    if (token) {
      const existing = this.findByToken(token)
      if (existing) {
        if ((clean && clean !== existing.name) || (nice && nice !== existing.avatar)) this.marquesCache = null
        if (clean) existing.name = clean
        if (nice) existing.avatar = nice
        // `undefined` = le téléphone se reconnecte sans rien dire de l'équipe :
        // on garde la sienne. `null` serait un retrait volontaire.
        if (teamId !== undefined) existing.teamId = teamId
        // Réécrite même inchangée. La file du miroir insiste jusqu'au succès,
        // mais un arrêt trop court peut abandonner ce qu'elle attendait
        // encore : cette réécriture recopie alors la fiche au retour du
        // téléphone — sans elle, un redémarrage sur disque effacé perdrait
        // cet invité. Elle part avec ce qui attend déjà, en un seul envoi.
        this.db
          .prepare('UPDATE players SET name = ?, avatar = ?, team_id = ? WHERE id = ?')
          .run(existing.name, existing.avatar, existing.teamId, existing.id)
        this.backup?.savePlayer(existing, existing.createdAt)
        return existing
      }
    }
    if (!clean) return { error: 'Il faut un prénom !' }
    const rec: PlayerRec = {
      id: randomUUID(),
      name: clean,
      avatar: nice || DEFAULT_AVATAR,
      token: randomUUID(),
      teamId: teamId ?? null,
      profileId: null,
      createdAt: Date.now(),
    }
    this.players.set(rec.id, rec)
    this.marquesCache = null
    this.db
      .prepare(
        'INSERT INTO players (id, name, avatar, token, team_id, profile_id, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(rec.id, rec.name, rec.avatar, rec.token, rec.teamId, rec.profileId, rec.createdAt, this.spaceId)
    this.backup?.savePlayer(rec, rec.createdAt)
    return rec
  }

  get(id: string): PlayerRec | undefined {
    return this.players.get(id)
  }

  /** Tous les invités, dans l'ordre d'arrivée. */
  all(): PlayerRec[] {
    return [...this.players.values()].sort((a, b) => a.createdAt - b.createdAt)
  }

  /** Inscrits, connectés ou non — c'est ce chiffre que plafonne l'inscription. */
  count(): number {
    return this.players.size
  }

  /** Le joueur derrière un jeton de téléphone : une reconnexion, pas une inscription. */
  findByToken(token: string): PlayerRec | undefined {
    for (const p of this.players.values()) if (p.token === token) return p
    return undefined
  }

  /**
   * Le joueur de ce profil dans cette soirée, s'il y est déjà. Un profil ne
   * doit tenir qu'un seul joueur par soirée : deux téléphones connectés au
   * même profil reprennent la même identité, sinon l'expérience du soir se
   * compterait deux fois.
   */
  findByProfile(profileId: string): PlayerRec | undefined {
    return [...this.players.values()].find(p => p.profileId === profileId)
  }

  /**
   * Rattache un joueur à un profil. Rend faux si rien ne change — un joueur
   * qui se reconnecte est déjà rattaché, inutile de réécrire.
   */
  bindProfile(playerId: string, profileId: string): boolean {
    const rec = this.players.get(playerId)
    if (!rec || rec.profileId === profileId) return false
    rec.profileId = profileId
    this.db.prepare('UPDATE players SET profile_id = ? WHERE id = ?').run(profileId, playerId)
    this.backup?.savePlayer(rec, rec.createdAt)
    return true
  }

  /** Cette connexion incarne ce joueur. Idempotent : la redire ne compte pas double. */
  socketConnected(playerId: string, socketId: string) {
    let sockets = this.connections.get(playerId)
    if (!sockets) this.connections.set(playerId, (sockets = new Set()))
    sockets.add(socketId)
  }

  /** Cette connexion ne l'incarne plus : fermée, ou passée à une autre identité. */
  socketDisconnected(playerId: string, socketId: string) {
    const sockets = this.connections.get(playerId)
    if (!sockets) return
    sockets.delete(socketId)
    if (sockets.size === 0) this.connections.delete(playerId)
  }

  isConnected(playerId: string): boolean {
    return this.connections.has(playerId)
  }

  connectedPlayerIds(): string[] {
    return [...this.connections.keys()]
  }

  /** Un pseudo malheureux projeté sur le mur, ça se corrige en deux secondes. */
  rename(playerId: string, name: string): boolean {
    const rec = this.players.get(playerId)
    const clean = cleanName(name)
    if (!rec || !clean) return false
    rec.name = clean
    this.marquesCache = null
    this.db.prepare('UPDATE players SET name = ? WHERE id = ?').run(clean, playerId)
    this.backup?.savePlayer(rec, rec.createdAt)
    return true
  }

  /**
   * Change l'équipe d'un joueur. Ses points le suivent : le score d'une équipe
   * est toujours celui de ses membres du moment, donc corriger une erreur
   * d'aiguillage remet aussi les points au bon endroit.
   */
  assign(playerId: string, teamId: string | null): boolean {
    const rec = this.players.get(playerId)
    if (!rec || rec.teamId === teamId) return false
    rec.teamId = teamId
    this.db.prepare('UPDATE players SET team_id = ? WHERE id = ?').run(teamId, playerId)
    this.backup?.savePlayer(rec, rec.createdAt)
    return true
  }

  /** Après la suppression d'une équipe : ses membres redeviennent sans équipe. */
  clearTeam(teamId: string): number {
    let moved = 0
    for (const rec of this.players.values()) {
      if (rec.teamId === teamId && this.assign(rec.id, null)) moved++
    }
    return moved
  }

  /** Exclut un invité et efface ses points — y compris dans la sauvegarde. */
  remove(playerId: string): boolean {
    if (!this.players.delete(playerId)) return false
    this.marquesCache = null
    this.connections.delete(playerId)
    this.db.prepare('DELETE FROM score_entries WHERE player_id = ?').run(playerId)
    this.db.prepare('DELETE FROM players WHERE id = ?').run(playerId)
    this.backup?.deletePlayer(playerId)
    return true
  }

  /** Vide la soirée de cet espace : on repart de zéro invité, zéro point. */
  clearAll() {
    this.db.prepare('DELETE FROM score_entries WHERE space_id = ?').run(this.spaceId)
    this.db.prepare('DELETE FROM players WHERE space_id = ?').run(this.spaceId)
    this.players.clear()
    this.marquesCache = null
    this.connections.clear()
  }

  /**
   * Les marques d'homonymie du moment — « Camille (2) ».
   *
   * Une dérivation, jamais rangée en base : elle s'efface d'elle-même quand
   * l'homonyme s'en va ou quand l'animateur renomme. `all()` rend les invités
   * dans l'ordre d'arrivée, et c'est cet ordre qui décide qui garde son
   * prénom nu.
   *
   * Gardée en mémoire entre deux changements de la salle : elle était
   * recalculée — un tri et une normalisation par invité — à chaque ligne de
   * chaque vue. Le podium de fin de quiz, qui en demande une par invité et
   * par téléphone, devenait cubique : 2,9 s à 150 invités, 110 s à 500, le
   * serveur figé pendant ce temps. Tout ce qui change un prénom, un avatar
   * ou la composition de la salle (arrivée, renommage, exclusion, remise à
   * zéro) remet la mémoire à zéro ; un rechargement part d'une mémoire vide.
   */
  private marques(): Map<string, string> {
    return (this.marquesCache ??= nomsAffiches(this.all()))
  }

  /**
   * Le prénom d'un invité tel qu'on l'affiche. C'est lui que le moteur écrit
   * dans les vues de partie (« le plus rapide : … ») : sans ça, l'écran
   * commun appellerait « Camille » celle que le classement juste en dessous
   * appelle « Camille (2) ».
   */
  nomAffiche(playerId: string): string | undefined {
    const rec = this.players.get(playerId)
    if (!rec) return undefined
    return this.marques().get(playerId) ?? rec.name
  }

  publicPlayers(totals: Map<string, number>): PublicPlayer[] {
    const marques = this.marques()
    return [...this.players.values()].map(p => this.toPublic(p, totals.get(p.id) ?? 0, marques))
  }

  publicOne(playerId: string, score: number): PublicPlayer | undefined {
    const p = this.players.get(playerId)
    return p ? this.toPublic(p, score, this.marques()) : undefined
  }

  private toPublic(p: PlayerRec, score: number, marques: Map<string, string>): PublicPlayer {
    const badge = p.profileId ? this.badgeOf?.(p.profileId, p.avatar) : undefined
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      connected: this.connections.has(p.id),
      score,
      teamId: p.teamId,
      // Rien du tout pour un invité anonyme : ces champs sont absents, pas à
      // zéro, et l'instantané qui part à toute la salle n'en porte pas le poids.
      ...(badge && { niveau: badge.niveau, finition: badge.finition }),
      ...(badge?.eclat && { eclat: true }),
      // Même raison : absent tant qu'aucun homonyme ne porte le même avatar.
      ...(marques.has(p.id) && { nomAffiche: marques.get(p.id) }),
    }
  }
}
