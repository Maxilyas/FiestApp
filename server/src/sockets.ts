import type { Socket } from 'socket.io'
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
  /** Derrière le proxy de l'hébergeur, l'adresse du client est dans un en-tête. */
  trustProxy: boolean
  /** Inscriptions au-delà desquelles la soirée est déclarée complète. */
  maxPlayers: number
  /** L'instantané complet pour l'écran commun, expurgé du wifi pour les autres. */
  buildSnapshot: (forHost: boolean) => PartySnapshot
  broadcastSnapshot: () => void
  resetParty: () => Promise<void>
}

// ── Garde-fous ───────────────────────────────────────────────────────────
//
// Mesuré avant ces limites : 41 000 clés par seconde testables sur une seule
// connexion, et 200 inscriptions en moins d'une seconde depuis une même
// adresse. Une clé courte tombait en quelques minutes, et un plaisantin
// remplissait la mémoire et la base distante de faux invités en pleine fête.

/** Clés fausses tolérées par connexion avant de la couper. */
const HELLO_MAX_FAILURES = 5
/** Identités qu'une même connexion peut créer (une reconnexion n'en crée pas). */
const JOINS_PER_SOCKET = 3
/**
 * Inscriptions par adresse : une réserve qui se recharge. Le seuil est large
 * parce qu'en 4G, des dizaines d'invités peuvent partager la même adresse
 * publique chez leur opérateur — ils doivent tous passer, pas un robot.
 */
const JOIN_BURST = 25
const JOIN_REFILL_PER_MINUTE = 30

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/**
 * L'adresse du client. Derrière le proxy de l'hébergeur, on lit la dernière
 * entrée de `x-forwarded-for` : c'est celle que le proxy a écrite lui-même,
 * un client ne peut pas la falsifier en envoyant son propre en-tête.
 */
function clientIp(socket: Socket, trustProxy: boolean): string {
  const forwarded = socket.handshake.headers['x-forwarded-for']
  if (trustProxy && typeof forwarded === 'string' && forwarded.trim()) {
    const hops = forwarded.split(',')
    return hops[hops.length - 1].trim()
  }
  return socket.handshake.address
}

/** Réserve d'inscriptions par adresse (seau à jetons). */
class JoinBudget {
  private buckets = new Map<string, { tokens: number; at: number }>()

  take(ip: string): boolean {
    // Les tests et les essais à la maison passent par l'adresse locale : ils
    // inscrivent cinquante invités d'un coup, et c'est voulu.
    if (LOOPBACK.has(ip)) return true
    const now = Date.now()
    const b = this.buckets.get(ip) ?? { tokens: JOIN_BURST, at: now }
    b.tokens = Math.min(JOIN_BURST, b.tokens + ((now - b.at) / 60_000) * JOIN_REFILL_PER_MINUTE)
    b.at = now
    if (b.tokens < 1) {
      this.buckets.set(ip, b)
      return false
    }
    b.tokens -= 1
    this.buckets.set(ip, b)
    if (this.buckets.size > 2000) this.prune(now)
    return true
  }

  private prune(now: number) {
    for (const [ip, b] of this.buckets) if (now - b.at > 10 * 60_000) this.buckets.delete(ip)
  }
}

export function wireSockets(io: IoServer, deps: SocketDeps) {
  const joinBudget = new JoinBudget()

  /** Une équipe inconnue (supprimée entre-temps) vaut « pas d'équipe ». */
  const validTeam = (teamId?: string | null): string | null =>
    teamId && deps.teams.has(teamId) ? teamId : null

  io.on('connection', socket => {
    let helloFailures = 0
    let identitiesCreated = 0
    const ip = clientIp(socket, deps.trustProxy)

    // Snapshot immédiat : la page d'accueil peut afficher "X déjà connectés".
    socket.emit('party:snapshot', deps.buildSnapshot(false))

    socket.on('player:join', (payload, ack) => {
      try {
        const token = typeof payload?.token === 'string' ? payload.token : undefined
        const reconnecting = !!token && !!deps.party.findByToken(token)
        if (!reconnecting) {
          // Une nouvelle identité, donc : elle passe par les garde-fous.
          if (deps.party.count() >= deps.maxPlayers) {
            return ack({ ok: false, error: 'La soirée est complète !' })
          }
          if (identitiesCreated >= JOINS_PER_SOCKET || !joinBudget.take(ip)) {
            return ack({ ok: false, error: 'Trop d’inscriptions d’un coup — réessaie dans une minute' })
          }
        }
        // Un téléphone qui se reconnecte n'envoie pas d'équipe : il garde la
        // sienne. C'est bien `undefined`, et pas `null`, qui dit « ne touche à rien ».
        const teamId = payload?.teamId === undefined ? undefined : validTeam(payload.teamId)
        const res = deps.party.join(payload?.name ?? '', payload?.avatar ?? '', token, teamId)
        if ('error' in res) return ack({ ok: false, error: res.error })
        if (!reconnecting) identitiesCreated++
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
      if (payload?.key !== deps.hostKey) {
        // Cinq essais, pas cinq mille : au-delà, la connexion est coupée et
        // il faut en rouvrir une — ce qui ramène la force brute à la vitesse
        // d'une poignée de main réseau.
        if (++helloFailures >= HELLO_MAX_FAILURES) socket.disconnect(true)
        return ack({ ok: false })
      }
      socket.data.isHost = true
      socket.join('hosts')
      ack({ ok: true })
      socket.emit('party:snapshot', deps.buildSnapshot(true))
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
