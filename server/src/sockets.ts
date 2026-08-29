import type { IoServer } from './core/types'
import type { Party } from './core/party'
import type { Teams } from './core/teams'
import type { AnswerLog } from './core/answers'
import type { GameEngine } from './core/engine'
import type { PartySnapshot } from '../../shared/types'

interface SocketDeps {
  party: Party
  teams: Teams
  answers: AnswerLog
  engine: GameEngine
  hostKey: string
  buildSnapshot: () => PartySnapshot
  broadcastSnapshot: () => void
  resetParty: () => Promise<void>
}

export function wireSockets(io: IoServer, deps: SocketDeps) {
  /** Une équipe inconnue (supprimée entre-temps) vaut « pas d'équipe ». */
  const validTeam = (teamId?: string | null): string | null =>
    teamId && deps.teams.has(teamId) ? teamId : null

  io.on('connection', socket => {
    // Snapshot immédiat : la page d'accueil peut afficher "X déjà connectés".
    socket.emit('party:snapshot', deps.buildSnapshot())

    socket.on('player:join', (payload, ack) => {
      try {
        // Un téléphone qui se reconnecte n'envoie pas d'équipe : il garde la
        // sienne. C'est bien `undefined`, et pas `null`, qui dit « ne touche à rien ».
        const teamId = payload?.teamId === undefined ? undefined : validTeam(payload.teamId)
        const res = deps.party.join(payload?.name ?? '', payload?.avatar ?? '', payload?.token, teamId)
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

    // Changer d'équipe emporte ses points : en pleine partie, ça permettrait
    // de déménager un gros score d'une équipe à l'autre entre deux questions.
    // Hors quiz, c'est juste une correction d'inattention.
    socket.on('player:setTeam', ({ teamId }, ack) => {
      const playerId = socket.data.playerId
      if (!playerId) return ack({ ok: false, error: 'Rejoins la soirée d’abord' })
      if (deps.engine.activeSessionId) {
        return ack({ ok: false, error: 'Pas pendant un quiz — on verra à la fin !' })
      }
      deps.party.assign(playerId, validTeam(teamId))
      deps.broadcastSnapshot()
      ack({ ok: true })
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

    socket.on('host:renamePlayer', ({ playerId, name }) => {
      if (!requireHost()) return
      if (deps.party.rename(playerId, name)) deps.broadcastSnapshot()
    })

    socket.on('host:removePlayer', ({ playerId }) => {
      if (!requireHost()) return
      if (!deps.party.remove(playerId)) return
      // Ses réponses partent avec lui : il ne doit plus peser sur les prix.
      deps.answers.removePlayer(playerId)
      deps.engine.dropParticipant(playerId)
      deps.broadcastSnapshot()
      // Son téléphone repart sur l'écran d'inscription.
      io.to(`player:${playerId}`).emit('player:removed')
    })

    // ── Équipes ────────────────────────────────────
    socket.on('host:createTeam', ({ name, emoji }) => {
      if (!requireHost()) return
      const res = deps.teams.create(name ?? '', emoji ?? '')
      if ('error' in res) return socket.emit('toast', { kind: 'error', message: res.error })
      deps.broadcastSnapshot()
    })

    socket.on('host:updateTeam', ({ teamId, name, emoji }) => {
      if (!requireHost()) return
      if (deps.teams.update(teamId, { name, emoji })) deps.broadcastSnapshot()
    })

    socket.on('host:removeTeam', ({ teamId }) => {
      if (!requireHost()) return
      if (!deps.teams.remove(teamId)) return
      // Personne n'est exclu : les membres repassent simplement « sans équipe ».
      deps.party.clearTeam(teamId)
      deps.broadcastSnapshot()
    })

    socket.on('host:seedTeams', () => {
      if (!requireHost()) return
      if (deps.teams.seedDefaults() > 0) deps.broadcastSnapshot()
    })

    socket.on('host:assignPlayer', ({ playerId, teamId }) => {
      if (!requireHost()) return
      if (deps.party.assign(playerId, validTeam(teamId))) deps.broadcastSnapshot()
    })

    socket.on('host:awardTeam', ({ teamId, points, reason }) => {
      if (!requireHost()) return
      const res = deps.teams.awardBonus(teamId, points, reason ?? '')
      if ('error' in res) return socket.emit('toast', { kind: 'error', message: res.error })
      deps.broadcastSnapshot()
    })

    socket.on('host:removeBonus', ({ bonusId }) => {
      if (!requireHost()) return
      if (deps.teams.removeBonus(bonusId)) deps.broadcastSnapshot()
    })

    socket.on('host:resetParty', () => {
      if (!requireHost()) return
      deps.resetParty().catch(e => {
        socket.emit('toast', { kind: 'error', message: (e as Error).message })
      })
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
