import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, JoinAck, ServerToClientEvents } from '../../shared/events'
import { getState, setState, showToast } from './state'

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
  autoConnect: false,
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
  localStorage.removeItem('quizz.me')
  localStorage.removeItem('quizz.profile')
  setState({ me: null, views: {} })
  showToast({ kind: 'info', message: "L'animateur t'a retiré de la soirée" })
})

socket.on('toast', showToast)

export function joinAsPlayer(name: string, avatar: string, token?: string): Promise<JoinAck> {
  return new Promise(resolve => socket.emit('player:join', { name, avatar, token }, resolve))
}

export function helloHost(key: string): Promise<{ ok: boolean }> {
  return new Promise(resolve => socket.emit('host:hello', { key }, resolve))
}

// En dev, un hot-reload de ce module créerait une 2e connexion socket branchée
// sur un store neuf → UI figée jusqu'au F5. On force un vrai rechargement.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
