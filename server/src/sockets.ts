import type { Socket } from 'socket.io'
import type { ActionAck, ActionRefusal } from '../../shared/events'
import type { IoServer } from './core/types'
import type { SpaceRegistry, SpaceRuntime } from './core/space'
import type { AccountRec, AuthStore } from './auth/store'
import { readSessionToken } from './auth/http'
import { Budget } from './core/budget'

interface SocketDeps {
  /** Les soirées en cours, une par espace. */
  registry: SpaceRegistry
  /** Les comptes des animateurs : l'écran commun se présente avec sa session, les invités avec un nom d'espace. */
  auth: AuthStore
  /** Derrière le proxy de l'hébergeur, l'adresse du client est dans un en-tête. */
  trustProxy: boolean
}

// ── Garde-fous ───────────────────────────────────────────────────────────
//
// Mesuré avant ces limites : 41 000 clés par seconde testables sur une seule
// connexion, et 200 inscriptions en moins d'une seconde depuis une même
// adresse. Une clé courte tombait en quelques minutes, et un plaisantin
// remplissait la mémoire et la base distante de faux invités en pleine fête.

/** Présentations refusées tolérées par connexion avant de la couper. */
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

const NO_SUCH_SPACE = 'Cette adresse ne mène à aucune soirée'
const OTHER_SPACE = 'Cette connexion suit déjà une autre soirée'

/**
 * Ce qu'on dit à l'invité dont la réponse n'est pas passée. Le silence était
 * le pire des messages : il laissait croire que la réponse était partie.
 */
const REFUSAL_MESSAGE: Record<ActionRefusal, string> = {
  'no-party': 'Ta réponse n’est pas partie — reconnexion en cours, retente',
  'unknown-player': 'Ta réponse n’est pas partie — reconnexion en cours, retente',
  ended: 'Ce quiz est terminé',
  'not-participant': 'Tu n’es pas dans cette partie — tu joues à la prochaine question',
  'too-late': 'Trop tard — la question était finie',
  paused: 'Le quiz est en pause — regarde l’écran commun',
  invalid: 'Réponse non comprise — retente',
  error: 'Erreur serveur — retente',
  timeout: 'Ta réponse n’est pas partie — vérifie ta connexion',
}

const refuse = (reason: ActionRefusal): ActionAck => ({
  ok: false,
  reason,
  error: REFUSAL_MESSAGE[reason],
})

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

export function wireSockets(io: IoServer, deps: SocketDeps) {
  // Réserve d'inscriptions par adresse. Les tests et les essais à la maison
  // passent par l'adresse locale : ils inscrivent cinquante invités d'un
  // coup, et c'est voulu.
  const joinBudget = new Budget(JOIN_BURST, JOIN_REFILL_PER_MINUTE, { skipLoopback: true })

  /** L'espace derrière un nom d'adresse — s'il existe et n'est pas fermé. */
  const spaceOf = (slug: unknown): AccountRec | null => {
    const account = deps.auth.bySlug(slug)
    return account && !account.disabledAt ? account : null
  }

  // Une session révoquée — déconnexion, mot de passe changé, compte
  // désactivé — emporte les écrans communs qu'elle avait ouverts.
  deps.auth.onRevoke(sessionId => {
    for (const s of io.sockets.sockets.values()) {
      if (s.data.authSessionId === sessionId) s.disconnect(true)
    }
  })

  io.on('connection', socket => {
    let helloFailures = 0
    let identitiesCreated = 0
    const ip = clientIp(socket, deps.trustProxy)

    // Rien n'est envoyé à la connexion : on ne sait pas encore quelle soirée
    // la connexion suit. Elle le dit avec `party:watch`, `player:join` ou
    // `host:hello` — et ne peut plus en changer ensuite : une connexion qui
    // s'est présentée pour la soirée A ne lira jamais la soirée B.

    /** Rattache la connexion à un espace, une fois pour toutes. Null si elle en suit déjà un autre. */
    const bindSpace = (spaceId: string): SpaceRuntime | null => {
      if (socket.data.spaceId && socket.data.spaceId !== spaceId) return null
      if (!socket.data.spaceId) {
        socket.data.spaceId = spaceId
        socket.join(`space:${spaceId}`)
      }
      return deps.registry.get(spaceId)
    }

    /** La soirée que suit cette connexion, si elle s'est présentée. */
    const runtime = (): SpaceRuntime | null =>
      socket.data.spaceId ? deps.registry.get(socket.data.spaceId) : null

    /** Une équipe inconnue (supprimée entre-temps) vaut « pas d'équipe ». */
    const validTeam = (rt: SpaceRuntime, teamId?: string | null): string | null =>
      teamId && rt.teams.has(teamId) ? teamId : null

    // La page d'accueil des invités : « X déjà connectés », avant même l'inscription.
    socket.on('party:watch', (payload, ack) => {
      const account = spaceOf(payload?.slug)
      if (!account) return ack({ ok: false, error: NO_SUCH_SPACE })
      const rt = bindSpace(account.id)
      if (!rt) return ack({ ok: false, error: OTHER_SPACE })
      ack({ ok: true })
      socket.emit('party:snapshot', rt.buildSnapshot(false))
    })

    socket.on('player:join', (payload, ack) => {
      try {
        const account = spaceOf(payload?.slug)
        if (!account) return ack({ ok: false, error: NO_SUCH_SPACE })
        const rt = bindSpace(account.id)
        if (!rt) return ack({ ok: false, error: OTHER_SPACE })
        const token = typeof payload?.token === 'string' ? payload.token : undefined
        const reconnecting = !!token && !!rt.party.findByToken(token)
        if (!reconnecting) {
          // Une nouvelle identité, donc : elle passe par les garde-fous.
          if (rt.party.count() >= rt.maxPlayers) {
            return ack({ ok: false, error: 'La soirée est complète !' })
          }
          if (identitiesCreated >= JOINS_PER_SOCKET || !joinBudget.take(ip)) {
            return ack({ ok: false, error: 'Trop d’inscriptions d’un coup — réessaie dans une minute' })
          }
        }
        // Un téléphone qui se reconnecte n'envoie pas d'équipe : il garde la
        // sienne. C'est bien `undefined`, et pas `null`, qui dit « ne touche à rien ».
        const teamId = payload?.teamId === undefined ? undefined : validTeam(rt, payload.teamId)
        const res = rt.party.join(payload?.name ?? '', payload?.avatar ?? '', token, teamId)
        if ('error' in res) return ack({ ok: false, error: res.error })
        if (!reconnecting) identitiesCreated++
        socket.data.playerId = res.id
        socket.join(`player:${res.id}`)
        rt.party.socketConnected(res.id)
        ack({ ok: true, playerId: res.id, token: res.token })
        rt.broadcastSnapshot()
        // Arrivé en cours de quiz : on l'y intègre pour les questions à venir.
        rt.engine.joinLate(res.id)
        rt.engine.resendViews(res.id)
      } catch {
        ack({ ok: false, error: 'Erreur serveur' })
      }
    })

    /**
     * Une réponse d'invité, et l'accusé de réception qui va avec.
     *
     * Deux coupures silencieuses vivaient ici. La première : un téléphone qui
     * sort d'une veille ou d'un trou de réseau arrive sur un socket tout neuf,
     * sans espace ni identité, et socket.io vide sa file d'attente avant même
     * que la page ait pu se re-présenter — la réponse tapée pendant la coupure
     * tombait donc sur une connexion anonyme. On la rattache maintenant à son
     * espace et à son joueur avec ce que la réponse porte elle-même.
     * La seconde : aucun retour n'était renvoyé, donc une réponse refusée
     * disparaissait sans un mot. Chaque issue a désormais son accusé.
     */
    socket.on('player:action', ({ sessionId, action, slug, token }, ack) => {
      // Les scripts d'essai et les téléphones restés sur l'ancienne page
      // n'attendent pas de réponse : on ne leur en impose pas.
      const reply = typeof ack === 'function' ? ack : () => {}

      let rt = runtime()
      if (!rt && typeof slug === 'string') {
        const account = spaceOf(slug)
        if (account) rt = bindSpace(account.id)
      }
      if (!rt) return reply(refuse('no-party'))

      let playerId = socket.data.playerId
      if (!playerId && typeof token === 'string') {
        const known = rt.party.findByToken(token)
        if (known) {
          // On rebranche l'identité séance tenante : sans le salon, la vue
          // mise à jour repartirait vers une connexion qui ne l'écoute pas,
          // et le joueur resterait devant une case sans coche. Ce n'est pas
          // une inscription — les garde-fous du `join` n'ont rien à dire ici.
          socket.data.playerId = known.id
          socket.join(`player:${known.id}`)
          rt.party.socketConnected(known.id)
          playerId = known.id
        }
      }
      if (!playerId) return reply(refuse('unknown-player'))

      try {
        // Le moteur de l'espace ne connaît que sa partie : l'identifiant
        // d'une partie voisine vaut « terminée », et la voisine n'en sait rien.
        const refusal = rt.engine.handlePlayerAction(sessionId, playerId, action)
        reply(refusal ? refuse(refusal) : { ok: true })
      } catch (e) {
        // L'accusé porte déjà le message : un toast en plus en ferait deux.
        // Et le détail d'une panne du serveur ne regarde pas les invités.
        console.warn(`[partie] réponse impossible à traiter : ${(e as Error).message}`)
        reply(refuse('error'))
      }
    })

    // Changer d'équipe emporte ses points : en pleine partie, ça permettrait
    // de déménager un gros score d'une équipe à l'autre entre deux questions.
    // Hors quiz, c'est juste une correction d'inattention.
    socket.on('player:setTeam', ({ teamId }, ack) => {
      const playerId = socket.data.playerId
      const rt = runtime()
      if (!playerId || !rt) return ack({ ok: false, error: 'Rejoins la soirée d’abord' })
      if (rt.engine.activeSessionId) {
        return ack({ ok: false, error: 'Pas pendant un quiz — on verra à la fin !' })
      }
      rt.party.assign(playerId, validTeam(rt, teamId))
      rt.broadcastSnapshot()
      ack({ ok: true })
    })

    // L'écran commun se présente avec sa session : le cookie posé à la
    // connexion voyage dans la poignée de main, rien ne transite par la page.
    // C'est la session qui dit l'espace — jamais la page.
    socket.on('host:hello', (_payload, ack) => {
      const token = readSessionToken(socket.handshake.headers.cookie)
      const found = token ? deps.auth.resolveSession(token) : null
      if (!found) {
        // Cinq essais, pas cinq mille : au-delà, la connexion est coupée et
        // il faut en rouvrir une — ce qui ramène la force brute à la vitesse
        // d'une poignée de main réseau.
        if (++helloFailures >= HELLO_MAX_FAILURES) socket.disconnect(true)
        return ack({ ok: false })
      }
      const rt = bindSpace(found.account.id)
      if (!rt) return ack({ ok: false })
      socket.data.isHost = true
      socket.data.accountId = found.account.id
      socket.data.authSessionId = found.session.id
      socket.join(`hosts:${found.account.id}`)
      ack({ ok: true, slug: found.account.slug, name: found.account.name })
      socket.emit('party:snapshot', rt.buildSnapshot(true))
      rt.engine.resendHostViews(socket)
    })

    /** La soirée de l'animateur — s'il s'est présenté. */
    const requireHost = (): SpaceRuntime | null => (socket.data.isHost ? runtime() : null)

    socket.on('host:launch', () => {
      const rt = requireHost()
      if (!rt) return
      try {
        rt.engine.launch()
      } catch (e) {
        socket.emit('toast', { kind: 'error', message: (e as Error).message })
      }
    })

    socket.on('host:command', ({ sessionId, command }) => {
      const rt = requireHost()
      if (!rt) return
      try {
        rt.engine.handleHostCommand(sessionId, command)
      } catch (e) {
        socket.emit('toast', { kind: 'error', message: (e as Error).message })
      }
    })

    socket.on('host:endSession', ({ sessionId }) => {
      const rt = requireHost()
      if (!rt) return
      rt.engine.endSession(sessionId)
    })

    socket.on('host:renamePlayer', ({ playerId, name }) => {
      const rt = requireHost()
      if (!rt) return
      if (rt.party.rename(playerId, name)) rt.broadcastSnapshot()
    })

    socket.on('host:removePlayer', ({ playerId }) => {
      const rt = requireHost()
      if (!rt) return
      // Un invité d'une autre soirée n'est pas dans cette liste : rien ne se passe.
      if (!rt.party.remove(playerId)) return
      // Ses réponses partent avec lui : il ne doit plus peser sur les prix.
      rt.answers.removePlayer(playerId)
      rt.engine.dropParticipant(playerId)
      rt.broadcastSnapshot()
      // Son téléphone repart sur l'écran d'inscription.
      io.to(`player:${playerId}`).emit('player:removed')
    })

    // ── Équipes ────────────────────────────────────
    socket.on('host:createTeam', ({ name, emoji }) => {
      const rt = requireHost()
      if (!rt) return
      const res = rt.teams.create(name ?? '', emoji ?? '')
      if ('error' in res) return socket.emit('toast', { kind: 'error', message: res.error })
      rt.broadcastSnapshot()
    })

    socket.on('host:updateTeam', ({ teamId, name, emoji }) => {
      const rt = requireHost()
      if (!rt) return
      if (rt.teams.update(teamId, { name, emoji })) rt.broadcastSnapshot()
    })

    socket.on('host:removeTeam', ({ teamId }) => {
      const rt = requireHost()
      if (!rt) return
      if (!rt.teams.remove(teamId)) return
      // Personne n'est exclu : les membres repassent simplement « sans équipe ».
      rt.party.clearTeam(teamId)
      rt.broadcastSnapshot()
    })

    socket.on('host:seedTeams', () => {
      const rt = requireHost()
      if (!rt) return
      if (rt.teams.seedDefaults() > 0) rt.broadcastSnapshot()
    })

    socket.on('host:assignPlayer', ({ playerId, teamId }) => {
      const rt = requireHost()
      if (!rt) return
      if (rt.party.assign(playerId, validTeam(rt, teamId))) rt.broadcastSnapshot()
    })

    socket.on('host:awardTeam', ({ teamId, points, reason }) => {
      const rt = requireHost()
      if (!rt) return
      const res = rt.teams.awardBonus(teamId, points, reason ?? '')
      if ('error' in res) return socket.emit('toast', { kind: 'error', message: res.error })
      rt.broadcastSnapshot()
    })

    socket.on('host:removeBonus', ({ bonusId }) => {
      const rt = requireHost()
      if (!rt) return
      if (rt.teams.removeBonus(bonusId)) rt.broadcastSnapshot()
    })

    socket.on('host:resetParty', () => {
      const rt = requireHost()
      if (!rt) return
      rt.resetParty()
        .then(archived => {
          if (archived) {
            socket.emit('toast', { kind: 'info', message: `« ${archived.title} » est dans l’historique — soirée vierge` })
          }
        })
        .catch(e => {
          socket.emit('toast', { kind: 'error', message: `Rien n’a été effacé : ${(e as Error).message}` })
        })
    })

    // Sauvegarder la soirée sans repartir de zéro : pour l'avoir à l'abri
    // avant la fin, ou lui donner son nom.
    socket.on('host:archiveParty', ({ title }) => {
      const rt = requireHost()
      if (!rt) return
      rt.archiveParty(typeof title === 'string' ? title : undefined)
        .then(archived => {
          socket.emit(
            'toast',
            archived
              ? { kind: 'info', message: `« ${archived.title} » est dans l’historique` }
              : { kind: 'error', message: 'Rien à ranger : aucune question n’a encore été jouée' },
          )
        })
        .catch(e => {
          socket.emit('toast', { kind: 'error', message: (e as Error).message })
        })
    })

    socket.on('disconnect', () => {
      const playerId = socket.data.playerId
      const rt = socket.data.spaceId ? deps.registry.peek(socket.data.spaceId) : undefined
      if (playerId && rt) {
        rt.party.socketDisconnected(playerId)
        rt.broadcastSnapshot()
      }
    })
  })
}
