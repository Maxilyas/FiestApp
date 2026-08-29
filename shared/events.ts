// Protocole Socket.io typé, partagé entre client et serveur.
import type { PartySnapshot } from './types'

export type JoinAck =
  | { ok: true; playerId: string; token: string }
  | { ok: false; error: string }

export interface ClientToServerEvents {
  'player:join': (
    payload: { name: string; avatar: string; token?: string; teamId?: string | null },
    ack: (res: JoinAck) => void,
  ) => void
  'player:action': (payload: { sessionId: string; action: unknown }) => void
  /** Changer d'équipe depuis la salle d'attente — refusé pendant un quiz. */
  'player:setTeam': (
    payload: { teamId: string | null },
    ack: (res: { ok: boolean; error?: string }) => void,
  ) => void

  'host:hello': (payload: { key: string }, ack: (res: { ok: boolean }) => void) => void
  /** Démarre une partie de quiz (l'animateur choisit ensuite le quiz à jouer). */
  'host:launch': () => void
  'host:command': (payload: { sessionId: string; command: unknown }) => void
  'host:endSession': (payload: { sessionId: string }) => void
  /** Efface invités, équipes et points pour repartir d'une soirée vierge. */
  'host:resetParty': () => void
  /** Corrige un pseudo affiché sur l'écran commun. */
  'host:renamePlayer': (payload: { playerId: string; name: string }) => void
  /** Exclut un invité et efface ses points. */
  'host:removePlayer': (payload: { playerId: string }) => void

  /** Crée une équipe. */
  'host:createTeam': (payload: { name: string; emoji: string }) => void
  /** Renomme une équipe ou change son emoji. */
  'host:updateTeam': (payload: { teamId: string; name?: string; emoji?: string }) => void
  /** Supprime une équipe — ses membres se retrouvent sans équipe. */
  'host:removeTeam': (payload: { teamId: string }) => void
  /** Crée d'un coup les six équipes par défaut (écran vierge seulement). */
  'host:seedTeams': () => void
  /** Déplace un invité vers une autre équipe (ou l'en sort avec null). */
  'host:assignPlayer': (payload: { playerId: string; teamId: string | null }) => void

  /** Remet un prix à une équipe : des points, et le motif annoncé à la salle. */
  'host:awardTeam': (payload: { teamId: string; points: number; reason: string }) => void
  /** Retire un prix mal attribué. */
  'host:removeBonus': (payload: { bonusId: string }) => void
}

export interface ServerToClientEvents {
  'party:snapshot': (snapshot: PartySnapshot) => void
  /** Vue filtrée de la partie : chaque joueur reçoit SA vue, l'écran commun la sienne. */
  'session:view': (payload: { sessionId: string; view: unknown }) => void
  'session:ended': (payload: { sessionId: string }) => void
  /** L'animateur a exclu ce joueur : son téléphone repart à l'inscription. */
  'player:removed': () => void
  'toast': (payload: { kind: 'info' | 'error'; message: string }) => void
}
