import type { IoServer } from './core/types'
import type { Party } from './core/party'
import type { GameEngine } from './core/engine'
import type { PartySnapshot } from '../../shared/types'

interface SocketDeps {
  party: Party
  engine: GameEngine
  hostKey: string
  buildSnapshot: () => PartySnapshot
  broadcastSnapshot: () => void
}

export function wireSockets(io: IoServer, deps: SocketDeps) {
  io.on('connection', socket => {
    // Snapshot immédiat : la page d'accueil peut afficher "X déjà connectés".
    socket.emit('party:snapshot', deps.buildSnapshot())

    socket.on('player:join', (payload, ack) => {
      try {
        const res = deps.party.join(payload?.name ?? '', payload?.avatar ?? '', payload?.token)
        if ('error' in res) return ack({ ok: false, error: res.error })
        socket.data.playerId = res.id
        socket.join('players')
        socket.join(`player:${res.id}`)
        deps.party.socketConnected(res.id)
        ack({ ok: true, playerId: res.id, token: res.token })
        deps.broadcastSnapshot()
        // Arrivé en cours de quiz : on l'y intègre pour les questions à venir.
        deps.engine.joinLate(res.id)
        deps.engine.resendViews(res.id)
      } catch {
        ack({ ok: false, error: 'Erreur serveur' })
      }
    })

    socket.on('player:action', ({ sessionId, action }) => {
      const playerId = socket.data.playerId
      if (!playerId) return
      try {
        deps.engine.handlePlayerAction(sessionId, playerId, action)
      } catch (e) {
        socket.emit('toast', { kind: 'error', message: (e as Error).message })
      }
    })

    socket.on('host:hello', (payload, ack) => {
      if (payload?.key !== deps.hostKey) return ack({ ok: false })
      socket.data.isHost = true
      socket.join('hosts')
      ack({ ok: true })
      socket.emit('party:snapshot', deps.buildSnapshot())
      deps.engine.resendHostViews(socket)
    })

    const requireHost = () => socket.data.isHost === true

    socket.on('host:launch', () => {
      if (!requireHost()) return
      try {
        deps.engine.launch()
      } catch (e) {
        socket.emit('toast', { kind: 'error', message: (e as Error).message })
      }
    })

    socket.on('host:command', ({ sessionId, command }) => {
      if (!requireHost()) return
      try {
        deps.engine.handleHostCommand(sessionId, command)
      } catch (e) {
        socket.emit('toast', { kind: 'error', message: (e as Error).message })
      }
    })

    socket.on('host:endSession', ({ sessionId }) => {
      if (!requireHost()) return
      deps.engine.endSession(sessionId)
    })

    socket.on('disconnect', () => {
      const playerId = socket.data.playerId
      if (playerId) {
        deps.party.socketDisconnected(playerId)
        deps.broadcastSnapshot()
      }
    })
  })
}
