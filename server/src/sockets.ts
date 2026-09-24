import type { Socket } from 'socket.io'
import type { ActionAck, ActionRefusal, ClientToServerEvents } from '../../shared/events'
import type { IoServer } from './core/types'
import type { SpaceRegistry, SpaceRuntime } from './core/space'
import type { AccountRec, AuthStore } from './auth/store'
import type { ProfileRec, ProfileStore } from './auth/profiles'
import { readPlayerToken, readSessionToken } from './auth/http'
import { Budget } from './core/budget'
import { messagePourEcran } from './core/http'

interface SocketDeps {
  /** Les soirées en cours, une par espace. */
  registry: SpaceRegistry
  /** Les comptes des animateurs : l'écran commun se présente avec sa session, les invités avec un nom d'espace. */
  auth: AuthStore
  /** Les profils des joueurs récurrents — reconnus par leur propre cookie. */
  profiles: ProfileStore
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
 * Inscriptions par adresse : une réserve qui se recharge.
 *
 * Toute une salle peut n'avoir qu'une adresse : le wifi de la fête sort sur
 * Internet par une seule box — c'est l'écran commun lui-même qui en projette
 * le QR —, et en 4G des dizaines d'invités partagent celle de leur opérateur.
 * À 25 d'un coup, la vague de scans qui suit l'apparition du QR prenait des
 * refus. Soixante d'un coup la laissent passer, et soixante par minute font
 * entrer une salle de 150 (le plafond par défaut d'un espace) en moins de
 * deux minutes, retardataires compris. L'attaque mesurée — 200 inscriptions
 * en moins d'une seconde depuis une même adresse — n'en place plus que
 * soixante, puis une par seconde, et le plafond de la soirée borne le reste.
 */
const JOIN_BURST = 60
const JOIN_REFILL_PER_MINUTE = 60

const NO_SUCH_SPACE = 'Cette adresse ne mène à aucune soirée'
const OTHER_SPACE = 'Cette connexion suit déjà une autre soirée'
const SERVER_ERROR = 'Erreur serveur — retente'
/**
 * Le jeton du téléphone ne désigne plus personne : exclu, « Nouvelle
 * soirée », ou un miroir qui n'avait pas encore sa fiche au redémarrage. Le
 * message vaut pour les trois, et l'entrée qui suit est pré-remplie.
 */
const UNKNOWN_TOKEN = 'On ne te retrouve plus dans cette soirée — rejoins-la'
/** Le jeton d'une soirée qu'on vient de clore : le téléphone montre sa fin de soirée. */
const SOIREE_CLOSE = 'Cette soirée est close — voici la tienne'

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
  error: SERVER_ERROR,
  timeout: 'Ta réponse n’est pas partie — vérifie ta connexion',
}

const refuse = (reason: ActionRefusal): ActionAck => ({
  ok: false,
  reason,
  error: REFUSAL_MESSAGE[reason],
})

// ── Ce que le réseau envoie ──────────────────────────────────────────────
//
// Le contrat de `shared/events.ts` dit ce qu'un client honnête envoie. Un
// script, une page d'une ancienne version ou un plaisantin envoient ce qu'ils
// veulent : une charge absente, `null`, un nombre là où on attend un
// identifiant, pas de fonction d'accusé. Chaque champ se vérifie donc avant
// usage, et ces types-là ne promettent que des noms de champs.

type Evenement = keyof ClientToServerEvents
type Arguments<E extends Evenement> = Parameters<ClientToServerEvents[E]>
/** Les champs qu'annonce le contrat — mais rien n'est garanti dedans. */
type Charge<E extends Evenement> = Arguments<E> extends [infer P, ...unknown[]]
  ? { [K in keyof P]?: unknown }
  : Record<string, never>
/** L'accusé qu'attend le client. Toujours une fonction : vide s'il n'en a pas donné. */
type Accuse<E extends Evenement> = Arguments<E> extends [unknown, infer A] ? A : () => void
/** Ce que porte cet accusé. */
type Reponse<E extends Evenement> = Accuse<E> extends (res: infer R) => void ? R : never

/** Une chaîne, ou rien : ce n'est pas au réseau de décider du type d'un champ. */
const texte = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

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

    /**
     * Pose un écouteur que rien de ce qui arrive du réseau ne peut faire tomber.
     *
     * socket.io appelle ses écouteurs hors de toute promesse, et le serveur n'a
     * pas de filet global : une seule exception y arrêtait le processus — donc
     * toutes les soirées de tous les espaces. Il suffisait d'un `player:action`
     * sans charge, d'un `host:removeBonus` à `null` (la charge était
     * déstructurée avant même de savoir qui parlait), ou d'un `party:watch`
     * sans fonction d'accusé : « ack is not a function ».
     *
     * Ici, la charge devient toujours un objet, l'accusé toujours une fonction
     * (vide si le client n'en attend pas), et toute exception — synchrone ou
     * dans la promesse de l'écouteur — finit dans le journal avec le nom de
     * l'événement. Un client qui attend un accusé reçoit `enPanne` : un
     * téléphone qui a tapé sa réponse ne doit jamais rester sans nouvelles.
     */
    const ecouter = <E extends Evenement>(
      event: E,
      traiter: (charge: Charge<E>, repondre: Accuse<E>) => unknown,
      enPanne?: Reponse<E>,
    ) => {
      const on = socket.on.bind(socket) as unknown as (ev: string, fn: (...args: unknown[]) => void) => void
      on(event, (...args) => {
        // L'accusé est toujours le dernier argument — le premier, donc, quand
        // la charge a été oubliée.
        const dernier = args[args.length - 1]
        const accuse = typeof dernier === 'function' ? (dernier as (res: unknown) => void) : null
        const brute = accuse && args.length === 1 ? undefined : args[0]
        const charge = brute !== null && typeof brute === 'object' && !Array.isArray(brute) ? brute : {}
        let repondu = false
        const repondre = (res: unknown) => {
          if (repondu) return
          repondu = true
          accuse?.(res)
        }
        const panne = (e: unknown) => {
          console.error(`[socket] « ${event} » a échoué :`, e)
          if (enPanne !== undefined) repondre(enPanne)
        }
        try {
          const suite = traiter(charge as Charge<E>, repondre as Accuse<E>)
          if (suite instanceof Promise) suite.catch(panne)
        } catch (e) {
          panne(e)
        }
      })
    }

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

    /**
     * Cette connexion devient le téléphone de cet invité.
     *
     * Idempotent : une même connexion se rattache souvent deux fois — par la
     * réponse tapée pendant la coupure, puis par la re-présentation de la
     * page —, et elle ne compte qu'une fois. Une connexion n'incarne qu'un
     * invité à la fois : restée dans le salon de l'ancien, elle recevait
     * encore ses vues, et son exclusion renvoyait à l'entrée celui qu'elle
     * était devenue.
     */
    const incarner = (rt: SpaceRuntime, playerId: string) => {
      const avant = socket.data.playerId
      if (avant && avant !== playerId) {
        socket.leave(`player:${avant}`)
        rt.party.socketDisconnected(avant, socket.id)
      }
      socket.data.playerId = playerId
      socket.join(`player:${playerId}`)
      rt.party.socketConnected(playerId, socket.id)
    }

    // L'heure du serveur. Sans identité ni espace : un écran doit pouvoir
    // caler son chronomètre avant même de savoir quelle soirée il suit.
    ecouter('time:sync', (_charge, repondre) => repondre({ serverNow: Date.now() }))

    /** Le profil derrière le cookie de ce téléphone, s'il en porte un. */
    const profileOfSocket = (): Promise<ProfileRec | null> => {
      const token = readPlayerToken(socket.handshake.headers.cookie)
      return token ? deps.profiles.bySession(token) : Promise.resolve(null)
    }

    // La page d'accueil des invités : « X déjà connectés », avant même l'inscription.
    ecouter(
      'party:watch',
      async (charge, repondre) => {
        const account = spaceOf(charge.slug)
        if (!account) return repondre({ ok: false, error: NO_SUCH_SPACE })
        const rt = bindSpace(account.id)
        if (!rt) return repondre({ ok: false, error: OTHER_SPACE })
        // L'écran d'inscription salue un profil connecté avant même qu'il
        // rejoigne — c'est là qu'on lui dit son niveau.
        const profile = await profileOfSocket().catch(() => null)
        repondre({ ok: true, ...(profile && { profile: deps.profiles.toPublic(profile) }) })
        socket.emit('party:snapshot', rt.buildSnapshot(false))
      },
      { ok: false, error: SERVER_ERROR },
    )

    ecouter(
      'player:join',
      async (charge, repondre) => {
        // Le profil se résout d'abord : il peut demander la base permanente.
        // Tout ce qui touche au registre de la soirée vient ensuite, d'un seul
        // tenant — les garde-fous ne doivent pas s'entrelacer avec une attente.
        const profile = await profileOfSocket().catch(() => null)
        // La connexion a pu se fermer pendant l'attente : rattachée maintenant,
        // elle laisserait l'invité « connecté » par un socket qui n'existe plus.
        if (socket.disconnected) return
        const account = spaceOf(charge.slug)
        if (!account) return repondre({ ok: false, error: NO_SUCH_SPACE })
        const rt = bindSpace(account.id)
        if (!rt) return repondre({ ok: false, error: OTHER_SPACE })

        const token = texte(charge.token) || undefined
        const porteur = token ? rt.party.findByToken(token) : undefined
        // Ce téléphone porte le joueur de quelqu'un d'autre — un ami à qui
        // on l'a prêté, un autre profil : on ne le lui prend pas, celui qui
        // se présente repart d'un joueur neuf.
        const autrui = !!porteur && !!profile && !!porteur.profileId && porteur.profileId !== profile.id
        // Le profil déjà présent ce soir l'emporte sur le jeton. Un profil ne
        // tient qu'un joueur par soirée : une tablette entrée sans compte puis
        // connectée au profil de celle qui jouait déjà sur son téléphone lui
        // rattachait un second joueur, et l'expérience de l'un écrasait celle
        // de l'autre — 50 au lieu de 128.
        const known = (profile && rt.party.findByProfile(profile.id)) || (autrui ? undefined : porteur)

        if (token && !porteur && !known) {
          // Un invité de la soirée qu'on vient de clore : son téléphone
          // dormait pendant la clôture. Il reçoit sa fin de soirée, comme
          // s'il avait été là.
          const fin = rt.finDe(token)
          if (fin) {
            repondre({ ok: false, reason: 'soiree-close', error: SOIREE_CLOSE, fin })
            // Une page d'avant ne lit ni ce motif ni ce message : ce signal-là
            // la ramène au moins à l'entrée.
            socket.emit('player:removed', { reason: 'soiree-close' })
            return
          }
          // Le jeton ne désigne plus personne. On recréait l'invité en silence
          // avec le prénom retenu par le téléphone : l'exclu dont le téléphone
          // dormait revenait, et l'habitué d'avant « Nouvelle soirée »
          // atterrissait sans équipe, sans jamais revoir l'écran d'équipe. Le
          // téléphone apprend maintenant qu'il doit repasser par l'entrée.
          repondre({ ok: false, reason: 'unknown-token', error: UNKNOWN_TOKEN })
          // Une page restée sur l'ancienne version ne lit pas ce motif, et
          // resterait devant un en-tête vide : ce signal-là est le seul qui la
          // ramène à l'entrée. Le message qui suit corrige le sien, « L'animateur
          // t'a retiré », faux quand c'est la soirée qui a changé.
          socket.emit('player:removed', { reason: 'unknown-token' })
          socket.emit('toast', { kind: 'info', message: UNKNOWN_TOKEN })
          return
        }
        if (!known) {
          // Une nouvelle identité, donc : elle passe par les garde-fous.
          if (rt.party.count() >= rt.maxPlayers) {
            return repondre({ ok: false, error: 'La soirée est complète !' })
          }
          if (identitiesCreated >= JOINS_PER_SOCKET || !joinBudget.take(ip)) {
            return repondre({ ok: false, error: 'Trop d’inscriptions d’un coup — réessaie dans une minute' })
          }
        }
        // Un téléphone qui se reconnecte n'envoie pas d'équipe : il garde la
        // sienne. C'est bien `undefined`, et pas `null`, qui dit « ne touche à rien ».
        const teamId = charge.teamId === undefined ? undefined : validTeam(rt, texte(charge.teamId))
        // Qui se déclare, et qui se re-présente ? Sans jeton, c'est l'écran
        // d'entrée qui parle : un nouvel invité, ou le profil qui arrive sur
        // un second appareil — son prénom et son avatar sont ceux qu'il vient
        // de confirmer, ou ceux de son profil s'il n'a rien retapé. Avec un
        // jeton, c'est un téléphone qui se re-présente tout seul, au réveil
        // ou après une coupure : ce qu'il renvoie n'est qu'un souvenir,
        // peut-être d'avant que l'animateur ne renomme « GrosLourd » en
        // « Marc », ou que le profil ne change d'avatar. La fiche du serveur
        // fait foi.
        const declare = !known || !token
        const name = declare ? texte(charge.name) || profile?.name || '' : ''
        const avatar = declare ? texte(charge.avatar) || profile?.avatar || '' : ''
        const res = rt.party.join(name, avatar, known?.token, teamId)
        if ('error' in res) return repondre({ ok: false, error: res.error })
        if (!known) identitiesCreated++
        // Le rattachement, enfin : c'est lui qui fera compter la soirée dans
        // l'expérience du profil.
        if (profile) rt.party.bindProfile(res.id, profile.id)
        incarner(rt, res.id)
        repondre({
          ok: true,
          playerId: res.id,
          token: res.token,
          // L'identité retenue : quand c'est le profil qui l'a fournie, le
          // téléphone ne la connaissait pas, et quand il se re-présente c'est
          // elle qui fait foi.
          name: res.name,
          avatar: res.avatar,
          ...(profile && { profile: deps.profiles.toPublic(profile) }),
        })
        // Arrivé en cours de quiz : on l'y intègre pour les questions à venir.
        // Celui qui vient de faire le geste ne passe pas par le regroupement :
        // sa page ne montre la question que si l'instantané le compte parmi
        // les participants, et la fenêtre des téléphones grandit avec la
        // salle — une seconde à 500 invités, à lire « tu entres à la
        // prochaine question » en pleine question. Un téléphone qui se
        // re-présente, lui, ne change même pas la salle des téléphones (qui
        // dort et qui veille n'y figure plus) : le regroupement ne lui
        // renverrait rien du tout. L'instantané part une fois l'invité
        // compté dans la partie, et avant sa première vue.
        rt.engine.joinLate(res.id, () => socket.emit('party:snapshot', rt.buildSnapshot(false)))
        rt.broadcastSnapshot()
        rt.engine.resendViews(res.id)
      },
      { ok: false, error: SERVER_ERROR },
    )

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
     * disparaissait sans un mot. Chaque issue a désormais son accusé — une
     * panne comprise : c'est `refuse('error')` que l'enrobage renvoie alors,
     * et le détail de la panne reste dans le journal, pas chez les invités.
     */
    ecouter(
      'player:action',
      (charge, repondre) => {
        let rt = runtime()
        const slug = texte(charge.slug)
        if (!rt && slug) {
          const account = spaceOf(slug)
          if (account) rt = bindSpace(account.id)
        }
        if (!rt) return repondre(refuse('no-party'))

        let playerId = socket.data.playerId
        const token = texte(charge.token)
        if (!playerId && token) {
          const known = rt.party.findByToken(token)
          if (known) {
            // On rebranche l'identité séance tenante : sans le salon, la vue
            // mise à jour repartirait vers une connexion qui ne l'écoute pas,
            // et le joueur resterait devant une case sans coche. Ce n'est pas
            // une inscription — les garde-fous du `join` n'ont rien à dire ici.
            incarner(rt, known.id)
            playerId = known.id
            rt.broadcastSnapshot()
          }
        }
        if (!playerId) return repondre(refuse('unknown-player'))

        // Le moteur de l'espace ne connaît que sa partie : l'identifiant
        // d'une partie voisine vaut « terminée », et la voisine n'en sait rien.
        const refusal = rt.engine.handlePlayerAction(texte(charge.sessionId) ?? '', playerId, charge.action)
        repondre(refusal ? refuse(refusal) : { ok: true })
      },
      refuse('error'),
    )

    // Changer d'équipe emporte ses points : en pleine partie, ça permettrait
    // de déménager un gros score d'une équipe à l'autre entre deux questions.
    // Hors quiz, c'est juste une correction d'inattention.
    ecouter(
      'player:setTeam',
      (charge, repondre) => {
        const playerId = socket.data.playerId
        const rt = runtime()
        if (!playerId || !rt) return repondre({ ok: false, error: 'Rejoins la soirée d’abord' })
        if (rt.engine.activeSessionId) {
          return repondre({ ok: false, error: 'Pas pendant un quiz — on verra à la fin !' })
        }
        rt.party.assign(playerId, validTeam(rt, texte(charge.teamId)))
        // Sa nouvelle équipe, à lui d'abord et avant l'accusé : la page qui
        // le reçoit relit son en-tête dans l'instantané, pas dans l'accusé.
        socket.emit('party:snapshot', rt.buildSnapshot(false))
        rt.broadcastSnapshot()
        repondre({ ok: true })
      },
      { ok: false, error: SERVER_ERROR },
    )

    // L'écran commun se présente avec sa session : le cookie posé à la
    // connexion voyage dans la poignée de main, rien ne transite par la page.
    // C'est la session qui dit l'espace — jamais la page.
    ecouter(
      'host:hello',
      (_charge, repondre) => {
        const token = readSessionToken(socket.handshake.headers.cookie)
        const found = token ? deps.auth.resolveSession(token) : null
        if (!found) {
          // Cinq essais, pas cinq mille : au-delà, la connexion est coupée et
          // il faut en rouvrir une — ce qui ramène la force brute à la vitesse
          // d'une poignée de main réseau.
          if (++helloFailures >= HELLO_MAX_FAILURES) socket.disconnect(true)
          return repondre({ ok: false })
        }
        const rt = bindSpace(found.account.id)
        if (!rt) return repondre({ ok: false })
        socket.data.isHost = true
        socket.data.accountId = found.account.id
        socket.data.authSessionId = found.session.id
        socket.join(`hosts:${found.account.id}`)
        repondre({ ok: true, slug: found.account.slug, name: found.account.name })
        socket.emit('party:snapshot', rt.buildSnapshot(true))
        rt.engine.resendHostViews(socket)
      },
      { ok: false },
    )

    /** La soirée de l'animateur — s'il s'est présenté. */
    const requireHost = (): SpaceRuntime | null => (socket.data.isHost ? runtime() : null)

    ecouter('host:launch', () => {
      const rt = requireHost()
      if (!rt) return
      try {
        rt.engine.launch()
      } catch (e) {
        socket.emit('toast', { kind: 'error', message: messagePourEcran(e, 'host:launch') })
      }
    })

    ecouter('host:command', charge => {
      const rt = requireHost()
      const sessionId = texte(charge.sessionId)
      if (!rt || !sessionId) return
      try {
        rt.engine.handleHostCommand(sessionId, charge.command)
      } catch (e) {
        socket.emit('toast', { kind: 'error', message: messagePourEcran(e, 'host:command') })
      }
    })

    ecouter('host:endSession', charge => {
      const rt = requireHost()
      const sessionId = texte(charge.sessionId)
      if (!rt || !sessionId) return
      rt.engine.endSession(sessionId)
    })

    ecouter('host:renamePlayer', charge => {
      const rt = requireHost()
      const playerId = texte(charge.playerId)
      const name = texte(charge.name)
      if (!rt || !playerId || name === undefined) return
      if (!rt.party.rename(playerId, name)) return
      rt.broadcastSnapshot()
      // Le prénom s'écrit aussi dans les vues de la partie — le podium, le
      // plus rapide de l'écran commun (`ViewContext.playerName`). Rien ne
      // les recalculait : c'était le geste égaré d'un autre invité, et une
      // réponse ne recalcule plus que la vue de son auteur.
      rt.engine.rafraichirVues()
    })

    ecouter('host:removePlayer', charge => {
      const rt = requireHost()
      const playerId = texte(charge.playerId)
      if (!rt || !playerId) return
      rt.exclure(playerId)
    })

    // ── Équipes ────────────────────────────────────
    ecouter('host:createTeam', charge => {
      const rt = requireHost()
      if (!rt) return
      const res = rt.teams.create(texte(charge.name) ?? '', texte(charge.emoji) ?? '')
      if ('error' in res) return socket.emit('toast', { kind: 'error', message: res.error })
      rt.broadcastSnapshot()
    })

    ecouter('host:updateTeam', charge => {
      const rt = requireHost()
      const teamId = texte(charge.teamId)
      if (!rt || !teamId) return
      if (rt.teams.update(teamId, { name: texte(charge.name), emoji: texte(charge.emoji) })) rt.broadcastSnapshot()
    })

    ecouter('host:removeTeam', charge => {
      const rt = requireHost()
      const teamId = texte(charge.teamId)
      if (!rt || !teamId) return
      if (!rt.teams.remove(teamId)) return
      // Personne n'est exclu : les membres repassent simplement « sans équipe ».
      rt.party.clearTeam(teamId)
      rt.broadcastSnapshot()
    })

    ecouter('host:seedTeams', () => {
      const rt = requireHost()
      if (!rt) return
      if (rt.teams.seedDefaults() > 0) rt.broadcastSnapshot()
    })

    ecouter('host:assignPlayer', charge => {
      const rt = requireHost()
      const playerId = texte(charge.playerId)
      if (!rt || !playerId) return
      const teamId = validTeam(rt, texte(charge.teamId))
      if (!rt.party.assign(playerId, teamId)) return
      rt.broadcastSnapshot()
      // L'invité déplacé l'apprenait en relisant son en-tête, s'il le
      // relisait : son téléphone le lui dit, à lui seul — pas à la salle.
      const hote = rt.publicSpace().name
      const equipe = rt.teams.all().find(t => t.id === teamId)
      io.to(`player:${playerId}`).emit('toast', {
        kind: 'info',
        message: equipe
          ? `${hote} t'a placé·e dans l'équipe ${equipe.emoji} ${equipe.name}`
          : `${hote} t'a sorti·e de ton équipe`,
      })
    })

    ecouter('host:awardTeam', charge => {
      const rt = requireHost()
      const teamId = texte(charge.teamId)
      if (!rt || !teamId) return
      const res = rt.teams.awardBonus(teamId, Number(charge.points), texte(charge.reason) ?? '')
      if ('error' in res) return socket.emit('toast', { kind: 'error', message: res.error })
      rt.broadcastSnapshot()
    })

    ecouter('host:removeBonus', charge => {
      const rt = requireHost()
      const bonusId = texte(charge.bonusId)
      if (!rt || !bonusId) return
      if (rt.teams.removeBonus(bonusId)) rt.broadcastSnapshot()
    })

    /**
     * Clôt la soirée — le seul geste de fin. « Nouvelle soirée », resté sur
     * une page d'avant, y mène aussi : la soirée est rangée, créditée, et la
     * suivante part de zéro.
     */
    const clore = (title?: string) => {
      const rt = requireHost()
      if (!rt) return
      return rt
        .closeParty(title)
        .then(archived => {
          socket.emit(
            'toast',
            archived
              ? { kind: 'info', message: `« ${archived.title} » est close — la soirée suivante peut commencer` }
              : { kind: 'info', message: 'Soirée vierge — rien n’avait été joué' },
          )
        })
        .catch(e => {
          socket.emit('toast', { kind: 'error', message: `Rien n’a été effacé : ${messagePourEcran(e, 'host:closeParty')}` })
        })
    }
    ecouter('host:closeParty', charge => clore(texte(charge.title)))
    ecouter('host:resetParty', () => clore())

    // C'était un essai : tout s'efface, archive et crédits compris.
    ecouter('host:discardParty', () => {
      const rt = requireHost()
      if (!rt) return
      return rt
        .discardParty()
        .then(() => socket.emit('toast', { kind: 'info', message: 'Essai effacé — rien n’a été gardé' }))
        .catch(e => {
          socket.emit('toast', { kind: 'error', message: `Rien n’a été effacé : ${messagePourEcran(e, 'host:discardParty')}` })
        })
    })

    // Ranger la soirée sous un titre sans la clore — l'ancien « Sauvegarder ».
    // Elle se range toute seule après chaque quiz ; ce geste ne sert plus qu'à
    // une page d'avant.
    ecouter('host:archiveParty', charge => {
      const rt = requireHost()
      if (!rt) return
      return rt
        .archiveParty(texte(charge.title))
        .then(archived => {
          socket.emit(
            'toast',
            archived
              ? { kind: 'info', message: `« ${archived.title} » est dans l’historique` }
              : { kind: 'error', message: 'Rien à ranger : aucune question n’a encore été jouée' },
          )
        })
        .catch(e => {
          socket.emit('toast', { kind: 'error', message: messagePourEcran(e, 'host:archiveParty') })
        })
    })

    // Un événement de socket.io, pas du client — mais une exception y
    // emporterait le processus tout autant.
    socket.on('disconnect', () => {
      try {
        const playerId = socket.data.playerId
        const rt = socket.data.spaceId ? deps.registry.peek(socket.data.spaceId) : undefined
        if (playerId && rt) {
          rt.party.socketDisconnected(playerId, socket.id)
          rt.broadcastSnapshot()
        }
      } catch (e) {
        console.error('[socket] « disconnect » a échoué :', e)
      }
    })
  })
}
