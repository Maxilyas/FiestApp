import { useSyncExternalStore } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/events'
import type { QuizHostView } from '../../shared/games/quiz'
import type { PartySnapshot } from '../../shared/types'

// La seconde liaison du téléphone du chef : celle de l'animateur, à côté de
// celle du joueur (`socket.ts`). Le chef qui joue tient les deux rôles sur
// un même téléphone, et une seule liaison ne s'y prête pas : les vues de
// partie (`session:view`) arriveraient en double, sans dire à quel rôle elles
// s'adressent, et une session d'animateur qui tombe couperait aussi le
// joueur. Deux liaisons, deux poignées de main : le serveur n'a rien à
// apprendre. Ce module ne se charge que sur le téléphone du chef — avec la
// barre (`BarreDuChef`), à la demande.

export interface EtatDuChef {
  /** null tant que l'écran ne s'est pas présenté ; false : la console n'est pas ouverte ici. */
  presente: boolean | null
  connecte: boolean
  snapshot: PartySnapshot | null
  /** La partie en cours, et la vue d'animateur qu'elle envoie. */
  sessionId: string | null
  vue: QuizHostView | null
  /** Un refus du serveur, montré sous la barre. */
  message: string | null
}

let etat: EtatDuChef = { presente: null, connecte: false, snapshot: null, sessionId: null, vue: null, message: null }
const abonnes = new Set<() => void>()
const poser = (patch: Partial<EtatDuChef>) => {
  etat = { ...etat, ...patch }
  abonnes.forEach(a => a())
}

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

/** Ouvre la liaison de l'animateur, une fois. La session vient du cookie, comme pour l'écran commun. */
export function brancherLeChef() {
  if (socket) return
  const s: Socket<ServerToClientEvents, ClientToServerEvents> = io({ forceNew: true, transports: ['websocket', 'polling'], tryAllTransports: true })
  socket = s
  s.on('connect', () => {
    poser({ connecte: true })
    s.emit('host:hello', {}, res => poser({ presente: res.ok }))
  })
  s.on('disconnect', () => poser({ connecte: false }))
  s.on('party:snapshot', snapshot => poser({ snapshot }))
  s.on('session:view', ({ sessionId, view }) => poser({ sessionId, vue: view as QuizHostView }))
  s.on('session:ended', ({ sessionId }) => {
    if (etat.sessionId === sessionId) poser({ sessionId: null, vue: null })
  })
  s.on('toast', t => {
    if (t.kind === 'error') poser({ message: t.message })
  })
}

export function useChef(): EtatDuChef {
  return useSyncExternalStore(
    a => {
      abonnes.add(a)
      return () => abonnes.delete(a)
    },
    () => etat,
  )
}

/**
 * Un geste de la partie. Il porte le moment qu'il visait (invariant 12) :
 * un double toucher, ou l'enchaînement automatique qui croise le doigt, ne
 * joue qu'une fois.
 */
export function commande(command: Record<string, unknown>) {
  const v = etat.vue
  if (!socket || !etat.sessionId || !v) return
  poser({ message: null })
  socket.emit('host:command', { sessionId: etat.sessionId, command: { phase: v.phase, qIndex: v.qIndex, round: v.round, ...command } }, () => {})
}

/** Lance un quiz : la partie qui se joue encore — le podium d'avant — est celle qu'il remplace. */
export function lancer() {
  if (!socket) return
  poser({ message: null })
  socket.emit('host:launch', { depuis: etat.snapshot?.session?.id ?? null })
}

/** Les équipes par défaut, quand le chef a choisi de jouer en équipes. */
export function equipesParDefaut() {
  socket?.emit('host:seedTeams', {})
}

/** Termine le quiz en cours : son podium, puis la salle d'attente. */
export function terminer() {
  if (socket && etat.sessionId) socket.emit('host:endSession', { sessionId: etat.sessionId })
}
