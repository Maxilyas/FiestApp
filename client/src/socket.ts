import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, JoinAck, ServerToClientEvents } from '../../shared/events'
import { forgetMe, getState, setState, showToast } from './state'
import { currentSlug } from './routes'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
  // WebSocket d'abord : la négociation par défaut ouvre une liaison en
  // « long-polling » puis la remplace, soit deux ou trois allers-retours de
  // plus par téléphone au moment du scan. Le repli reste là pour les réseaux
  // qui bloquent le WebSocket.
  transports: ['websocket', 'polling'],
  tryAllTransports: true,
})

socket.on('connect', () => setState({ connected: true }))
socket.on('disconnect', () => setState({ connected: false }))
socket.on('party:snapshot', snapshot => setState({ snapshot }))
socket.on('session:view', payload =>
  setState({ views: { ...getState().views, [payload.sessionId]: payload } }),
)
socket.on('session:ended', ({ sessionId }) => {
  const views = { ...getState().views }
  delete views[sessionId]
  setState({ views })
})
socket.on('player:removed', () => {
  // On oublie l'identité : le téléphone revient à l'écran d'inscription.
  const slug = currentSlug()
  if (slug) forgetMe(slug)
  else setState({ me: null, views: {} })
  showToast({ kind: 'info', message: "L'animateur t'a retiré de la soirée" })
})

socket.on('toast', showToast)

/**
 * Suivre une soirée sans y jouer encore : la page d'inscription reçoit alors
 * ses instantanés — les équipes, « X déjà connectés ». Refusé si le nom de
 * l'espace ne mène nulle part.
 */
export function watchParty(slug: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise(resolve => socket.emit('party:watch', { slug }, resolve))
}

export function joinAsPlayer(
  slug: string,
  name: string,
  avatar: string,
  token?: string,
  // Omis à la reconnexion : le serveur garde alors l'équipe déjà choisie.
  teamId?: string | null,
): Promise<JoinAck> {
  return new Promise(resolve =>
    socket.emit('player:join', { slug, name, avatar, token, teamId }, resolve),
  )
}

export function setMyTeam(teamId: string | null): Promise<{ ok: boolean; error?: string }> {
  return new Promise(resolve => socket.emit('player:setTeam', { teamId }, resolve))
}

/**
 * L'écran commun se présente. Rien à envoyer : la session de l'animateur est
 * dans le cookie, que le navigateur joint à la poignée de main. En retour,
 * son espace — ou un refus s'il n'est pas connecté.
 */
export function helloHost(): Promise<{ ok: boolean; slug?: string; name?: string }> {
  return new Promise(resolve => socket.emit('host:hello', {}, resolve))
}

// En dev, un hot-reload de ce module créerait une 2e connexion socket branchée
// sur un store neuf → UI figée jusqu'au F5. On force un vrai rechargement.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
