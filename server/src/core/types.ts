import type { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '../../../shared/events'
import type { PublicPlayer } from '../../../shared/types'

export interface SocketData {
  playerId?: string
  isHost?: boolean
}

export type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>

export interface GameSessionRec<S = unknown> {
  id: string
  status: 'running' | 'ended'
  participantIds: string[]
  state: S
}

/** Capacités offertes au module pendant le traitement d'une action/commande/timer. */
export interface GameContext {
  award(playerId: string, points: number, reason: string): void
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
}

/**
 * Contrat du module de jeu. Toute la logique tourne côté serveur ; les clients
 * ne reçoivent que des vues filtrées (playerView/hostView), jamais l'état brut —
 * sinon les bonnes réponses arriveraient dans le téléphone avant la révélation.
 */
export interface GameModule<S = any> {
  createInitialState(participantIds: string[], config: unknown): S
  /** Appelé juste après le lancement — pour démarrer une phase avec timer. */
  onLaunch?(session: GameSessionRec<S>, ctx: GameContext): void
  onPlayerAction(session: GameSessionRec<S>, playerId: string, action: any, ctx: GameContext): void
  onHostCommand?(session: GameSessionRec<S>, command: any, ctx: GameContext): void
  onTimer?(session: GameSessionRec<S>, timerId: string, ctx: GameContext): void
  playerView(session: GameSessionRec<S>, playerId: string, vctx: ViewContext): unknown
  hostView(session: GameSessionRec<S>, vctx: ViewContext): unknown
}
