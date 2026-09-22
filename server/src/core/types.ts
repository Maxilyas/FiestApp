import type { Server } from 'socket.io'
import type { ActionRefusal, ClientToServerEvents, ServerToClientEvents } from '../../../shared/events'
import type { PublicPlayer } from '../../../shared/types'
import type { AnswerRow } from './answers'

export interface SocketData {
  playerId?: string
  isHost?: boolean
  /**
   * L'espace que suit cette connexion, fixé à la première présentation
   * (invité ou écran commun) et jamais changé ensuite.
   */
  spaceId?: string
  /** L'animateur connecté derrière cet écran commun, et sa session. */
  accountId?: string
  authSessionId?: string
}

export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>

export interface GameSessionRec<S = unknown> {
  id: string
  /** L'espace où se joue la partie — c'est sa bibliothèque qui compte. */
  spaceId: string
  status: 'running' | 'ended'
  participantIds: string[]
  state: S
}

/** Capacités offertes au module pendant le traitement d'une action/commande/timer. */
export interface GameContext {
  award(playerId: string, points: number, reason: string): void
  /**
   * Journalise une question : une ligne par participant, y compris ceux qui
   * n'ont pas répondu. Le classement ne garde que les gains positifs — sans
   * ce journal, ni les erreurs ni les temps de réponse n'existeraient.
   */
  logAnswers(rows: Omit<AnswerRow, 'sessionId' | 'createdAt'>[]): void
  /** Retire une question du journal — points annulés, ou question reposée. */
  dropAnswers(qIndex: number): void
  setTimer(timerId: string, ms: number): void
  clearTimer(timerId: string): void
  /** Termine la partie (appliqué après le handler courant). */
  end(): void
  participants(): PublicPlayer[]
  playerName(playerId: string): string
  now(): number
}

/** Capacités offertes aux fonctions de vue (lecture seule). */
export interface ViewContext {
  playerName(playerId: string): string
  player(playerId: string): PublicPlayer | undefined
  /**
   * Ce qui ne dépend pas du destinataire — un classement, un podium — ne se
   * calcule qu'une fois par diffusion, pas une fois par téléphone.
   *
   * Chaque vue de joueur triait tous les totaux pour y trouver son rang, et
   * reconstruisait le podium pour elle seule : à 500 invités, une question
   * coûtait une demi-minute de processeur et le podium plus d'une, sur un
   * hébergeur qui n'en a qu'un dixième. Le mémo naît au début d'une diffusion
   * et meurt avec elle : rien ne survit d'un état au suivant. Hors diffusion,
   * `compute` est simplement appelé.
   */
  memo<T>(key: string, compute: () => T): T
}

/**
 * Contrat du module de jeu. Toute la logique tourne côté serveur ; les clients
 * ne reçoivent que des vues filtrées (playerView/hostView), jamais l'état brut —
 * sinon les bonnes réponses arriveraient dans le téléphone avant la révélation.
 */
export interface GameModule<S = any> {
  createInitialState(spaceId: string, participantIds: string[], config: unknown): S
  /** Appelé juste après le lancement — pour démarrer une phase avec timer. */
  onLaunch?(session: GameSessionRec<S>, ctx: GameContext): void
  /**
   * Traite une réponse d'invité. Rend le motif du refus, ou rien si elle est
   * retenue : c'est ce motif que le téléphone reçoit en accusé de réception.
   * Une réponse identique à la précédente est retenue, pas refusée — le joueur
   * qui retape pour vérifier doit être rassuré, pas éconduit.
   */
  onPlayerAction(
    session: GameSessionRec<S>,
    playerId: string,
    action: any,
    ctx: GameContext,
  ): ActionRefusal | void
  onHostCommand?(session: GameSessionRec<S>, command: any, ctx: GameContext): void
  onTimer?(session: GameSessionRec<S>, timerId: string, ctx: GameContext): void
  /** Appelé quand un invité rejoint une partie déjà lancée. */
  onPlayerJoin?(session: GameSessionRec<S>, playerId: string, ctx: GameContext): void
  playerView(session: GameSessionRec<S>, playerId: string, vctx: ViewContext): unknown
  hostView(session: GameSessionRec<S>, vctx: ViewContext): unknown
}
