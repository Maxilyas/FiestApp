import { randomUUID } from 'node:crypto'
import type { Socket } from 'socket.io'
import type { DB } from './db'
import type { GameContext, GameModule, GameSessionRec, IoServer, ViewContext } from './types'
import type { Party } from './party'
import type { ScoreLedger } from './scores'
import type { AnswerLog } from './answers'
import type { PartyMirror, SessionRow } from './backup'
import type { SessionSummary } from '../../../shared/types'
import type { ActionRefusal } from '../../../shared/events'

/**
 * Cadence du miroir distant de la partie, pour le simple va-et-vient des
 * réponses en cours de question. Chaque réponse d'invité change l'état ;
 * cinquante réponses en quinze secondes ne méritent pas cinquante écritures
 * dans la base distante. Une au début, puis une toutes les deux secondes
 * tant que ça bouge : au pire, un redémarrage perd deux secondes de réponses
 * — que leurs auteurs peuvent retaper, la question étant encore ouverte.
 *
 * Tout le reste part sans attendre : voir `run()`.
 */
const MIRROR_INTERVAL_MS = 2000

/**
 * Ce qui, dans une partie, décide d'une recopie immédiate : sa phase, et les
 * chronomètres armés. Le moteur ne connaît pas les règles ; il sait qu'une
 * partie qui change de phase ou de chronomètres (une révélation, une
 * question qui s'ouvre, une pause) n'est plus celle qu'un réveil devrait
 * reprendre. La phase se lit dans l'état s'il en porte une.
 */
function empreinte(sess: LiveSession): string {
  const phase = (sess.state as { phase?: unknown } | null)?.phase
  return `${String(phase)}|${[...sess.timers.keys()].sort().join(',')}`
}

interface LiveSession extends GameSessionRec {
  createdAt: number
  timers: Map<string, { deadline: number; handle: NodeJS.Timeout }>
}

interface EngineDeps {
  db: DB
  io: IoServer
  /** L'espace dont c'est le moteur : ses salons, ses parties, sa bibliothèque. */
  spaceId: string
  party: Party
  ledger: ScoreLedger
  answers: AnswerLog
  /** Miroir distant de la partie en cours — absent dans les tests unitaires. */
  backup?: PartyMirror
  onScoresChanged: () => void
  onSessionChanged: () => void
  /**
   * Une partie vient de se terminer. C'est là que l'expérience du soir se
   * crédite : attendre l'archivage de la soirée, c'est ne rien donner à
   * celui qui vient de gagner un quiz — et repartir sans jamais voir son
   * niveau bouger.
   */
  onSessionEnded: () => void
  /**
   * Le podium est à l'écran, la partie n'est pas encore refermée : même
   * crédit qu'à la fin, et c'est l'idempotence du crédit — la ligne
   * (profil, soirée) est remplacée — qui permet de le faire deux fois.
   */
  onVerdict: () => void
}

/**
 * Moteur de partie : il ne connaît aucune règle. Il route les actions joueurs,
 * les commandes de l'animateur et les timers vers le module de jeu, persiste
 * l'état après chaque changement (reprise après crash) et rediffuse les vues
 * filtrées. Une seule partie tourne à la fois par espace.
 */
export class GameEngine {
  private session: LiveSession | null = null

  /**
   * Dernière vue envoyée à chacun. Sans ce garde-fou, chaque réponse d'un
   * joueur rediffuserait la vue complète aux 49 autres — 2 500 messages par
   * question à 50 invités, pour un contenu identique. En 4G ça se paie en
   * batterie et en latence, alors qu'une vue de joueur ne change que quand
   * il répond lui-même.
   */
  private lastSent = new Map<string, string>()

  /** Écriture distante en attente, et s'il y a eu du nouveau depuis. */
  private mirrorTimer: ReturnType<typeof setTimeout> | null = null
  private mirrorDirty = false
  /** Dernier état écrit localement — celui à envoyer si on coupe pendant l'attente. */
  private lastRow: SessionRow | null = null

  /**
   * Le mémo de la diffusion en cours — voir `ViewContext.memo`. Null entre
   * deux diffusions : une vue calculée à un autre moment ne lit jamais un
   * classement resté d'un état précédent.
   */
  private memo: Map<string, unknown> | null = null

  private vctx: ViewContext = {
    // `nomAffiche` et pas `name` : c'est ce nom-là qui part sur l'écran
    // commun, et il doit être celui du classement — « Camille (2) » aussi.
    playerName: id => this.deps.party.nomAffiche(id) ?? '???',
    player: id => this.deps.party.publicOne(id, this.deps.ledger.total(id)),
    connected: id => this.deps.party.isConnected(id),
    memo: <T>(key: string, compute: () => T): T => {
      const memo = this.memo
      if (!memo) return compute()
      if (!memo.has(key)) memo.set(key, compute())
      return memo.get(key) as T
    },
  }

  constructor(private deps: EngineDeps, private module: GameModule) {}

  /**
   * Recharge la partie en cours de l'espace depuis la base (reprise après
   * redémarrage). Les parties terminées, revenues du miroir avec la copie
   * exacte de leur quiz, restent où elles sont : rien ne les reprend.
   */
  restore() {
    const rows = this.deps.db
      .prepare("SELECT * FROM sessions WHERE status = 'running' AND space_id = ? ORDER BY created_at DESC")
      .all(this.deps.spaceId) as any[]
    const [row, ...stale] = rows
    // Une seule partie à la fois : si la base en contient plusieurs (vieilles
    // données), on ne reprend que la dernière et on solde les autres — miroir
    // compris, qui les rendrait « en cours » au prochain réveil.
    for (const old of stale) {
      const updatedAt = Date.now()
      this.deps.db.prepare("UPDATE sessions SET status = 'ended', updated_at = ? WHERE id = ?").run(updatedAt, old.id)
      this.deps.backup?.saveSession({
        id: old.id,
        spaceId: this.deps.spaceId,
        status: 'ended',
        participantIds: old.participant_ids,
        state: old.state,
        timers: old.timers,
        createdAt: old.created_at,
        updatedAt,
      })
    }
    if (!row) return
    const sess: LiveSession = {
      id: row.id,
      spaceId: this.deps.spaceId,
      status: 'running',
      participantIds: JSON.parse(row.participant_ids),
      state: JSON.parse(row.state),
      createdAt: row.created_at,
      timers: new Map(),
    }
    this.session = sess
    const timers = JSON.parse(row.timers) as Record<string, number>
    for (const [timerId, deadline] of Object.entries(timers)) {
      this.armTimer(sess, timerId, Math.max(50, deadline - Date.now()))
    }
  }

  get activeSessionId(): string | null {
    return this.session?.id ?? null
  }

  summary(): SessionSummary | null {
    if (!this.session) return null
    return { id: this.session.id, participantIds: this.session.participantIds }
  }

  launch(config?: unknown): string {
    if (this.session) this.endSession(this.session.id)
    this.lastSent.clear()
    const participantIds = this.deps.party.connectedPlayerIds()
    const sess: LiveSession = {
      id: randomUUID(),
      spaceId: this.deps.spaceId,
      status: 'running',
      participantIds,
      state: this.module.createInitialState(this.deps.spaceId, participantIds, config),
      createdAt: Date.now(),
      timers: new Map(),
    }
    this.session = sess
    if (this.module.onLaunch) {
      this.run(sess, ctx => this.module.onLaunch!(sess, ctx))
    } else {
      this.persist(sess)
      this.fanout(sess)
    }
    this.deps.onSessionChanged()
    return sess.id
  }

  /**
   * Route une réponse d'invité vers le module de jeu. Rend le motif du refus,
   * ou null si elle est retenue — l'appelant en fait l'accusé de réception du
   * téléphone. Rien ne remonte par exception ici : une réponse refusée est un
   * cas ordinaire de soirée (question passée, quiz en pause), pas une panne.
   */
  handlePlayerAction(sessionId: string, playerId: string, action: unknown): ActionRefusal | null {
    const sess = this.session
    if (!sess || sess.id !== sessionId || sess.status !== 'running') return 'ended'
    if (!sess.participantIds.includes(playerId)) return 'not-participant'
    let refusal: ActionRefusal | null = null
    this.run(sess, ctx => {
      refusal = this.module.onPlayerAction(sess, playerId, action, ctx) ?? null
    })
    return refusal
  }

  handleHostCommand(sessionId: string, command: unknown) {
    const sess = this.requireRunning(sessionId)
    if (!this.module.onHostCommand) return
    this.run(sess, ctx => this.module.onHostCommand!(sess, command, ctx))
  }

  endSession(sessionId: string) {
    const sess = this.session
    if (!sess || sess.id !== sessionId) return
    for (const t of sess.timers.values()) clearTimeout(t.handle)
    sess.timers.clear()
    sess.status = 'ended'
    this.persist(sess)
    this.session = null
    this.lastSent.clear()
    this.deps.io.to(`space:${this.deps.spaceId}`).emit('session:ended', { sessionId })
    this.deps.onSessionChanged()
    this.deps.onSessionEnded()
  }

  /**
   * À l'extinction : ce qui attendait la prochaine fenêtre rejoint tout de
   * suite la file du miroir — que l'arrêt vide ensuite —, et plus rien ne
   * partira après coup.
   *
   * Les chronomètres de la partie s'éteignent avec le reste. Sans ça, celui
   * d'une question en cours sonnait après la fermeture de la base et révélait
   * dans le vide — « The database connection is not open », et le processus
   * emporté avec. Leurs échéances, elles, restent dans la ligne persistée :
   * c'est elle qui les réarme au redémarrage, et on ne vide donc pas la table.
   */
  stop() {
    if (this.session) for (const t of this.session.timers.values()) clearTimeout(t.handle)
    if (this.mirrorTimer) clearTimeout(this.mirrorTimer)
    this.mirrorTimer = null
    if (this.mirrorDirty && this.lastRow && this.session?.status === 'running') {
      this.deps.backup?.saveSession(this.lastRow)
    }
    this.mirrorDirty = false
  }

  /**
   * Un invité arrivé après le lancement entre dans la partie en cours. Il ne
   * récupère rien sur les questions déjà passées (aucun point ne lui a été
   * attribué) mais il joue les suivantes — mieux que d'attendre le quiz d'après.
   * Sans effet pour quelqu'un qui participe déjà : une reconnexion n'est pas
   * une arrivée.
   */
  joinLate(playerId: string) {
    const sess = this.session
    if (!sess || sess.status !== 'running' || sess.participantIds.includes(playerId)) return
    sess.participantIds.push(playerId)
    if (this.module.onPlayerJoin) {
      this.run(sess, ctx => this.module.onPlayerJoin!(sess, playerId, ctx))
    } else {
      this.persist(sess)
      this.fanout(sess)
    }
    this.deps.onSessionChanged()
  }

  /**
   * Un invité exclu quitte aussi la partie en cours, avec tout ce qu'il y
   * avait laissé. Le module fait le ménage dans son état en passant par
   * `run()`, pour que la partie soit persistée et rediffusée comme après
   * n'importe quel autre changement.
   */
  dropParticipant(playerId: string) {
    const sess = this.session
    if (!sess || !sess.participantIds.includes(playerId)) return
    sess.participantIds = sess.participantIds.filter(id => id !== playerId)
    this.lastSent.delete(`player:${playerId}`)
    if (this.module.onPlayerLeave) {
      this.run(sess, ctx => this.module.onPlayerLeave!(sess, playerId, ctx))
    } else {
      this.persist(sess)
      this.fanout(sess)
    }
    this.deps.onSessionChanged()
  }

  /** Cet invité a-t-il une réponse que la partie en cours n'a pas encore jugée ? */
  reponseEnSuspens(playerId: string): boolean {
    const sess = this.session
    if (!sess || sess.status !== 'running' || !this.module.reponseEnSuspens) return false
    return this.module.reponseEnSuspens(sess, playerId)
  }

  /** Renvoie sa vue à un joueur qui (re)vient — reconnexion transparente. */
  resendViews(playerId: string) {
    const sess = this.session
    if (!sess || sess.status !== 'running' || !sess.participantIds.includes(playerId)) return
    const view = this.broadcast(() => this.module.playerView(sess, playerId, this.vctx))
    // Toujours envoyer : le téléphone qui revient d'une coupure a un écran
    // vide, même si sa vue n'a pas changé entre-temps.
    this.changed(`player:${playerId}`, view)
    this.deps.io.to(`player:${playerId}`).emit('session:view', { sessionId: sess.id, view })
  }

  /**
   * Rediffuse les vues de la partie en cours, à qui elles ont changé. Un
   * niveau gagné au podium change la pastille de son porteur sans que la
   * partie ait bougé : le podium affiché gardait sinon l'ancien niveau, sous
   * le bandeau qui annonçait le nouveau.
   */
  rafraichirVues() {
    const sess = this.session
    if (!sess || sess.status !== 'running') return
    this.fanout(sess)
  }

  /**
   * Un téléphone vient de tomber ou de revenir : la console le montre dans
   * la liste de ceux qu'on attend (« hors ligne »). Rien d'autre n'a bougé,
   * les téléphones n'ont rien à recevoir — seule la vue de l'animateur se
   * recalcule, et ne part que si elle a changé.
   */
  rafraichirAnimateur() {
    const sess = this.session
    if (!sess || sess.status !== 'running') return
    this.broadcast(() => {
      const hostView = this.module.hostView(sess, this.vctx)
      if (this.changed('__host__', hostView)) {
        this.deps.io.to(`hosts:${this.deps.spaceId}`).emit('session:view', { sessionId: sess.id, view: hostView })
      }
    })
  }

  /** Renvoie la vue host à un écran commun qui (re)vient. */
  resendHostViews(socket: Socket) {
    const sess = this.session
    if (!sess || sess.status !== 'running') return
    socket.emit('session:view', {
      sessionId: sess.id,
      view: this.broadcast(() => this.module.hostView(sess, this.vctx)),
    })
  }

  // ── Internes ────────────────────────────────────────────────────────────

  private requireRunning(sessionId: string): LiveSession {
    const sess = this.session
    if (!sess || sess.id !== sessionId || sess.status !== 'running') {
      throw new Error('Cette partie est terminée')
    }
    return sess
  }

  /**
   * Exécute un handler du module puis persiste + rediffuse.
   *
   * Tout ce que le passage écrit — gains, réponses, questions retirées du
   * journal — part au miroir d'un seul tenant AVEC l'état de la partie, dans
   * une seule transaction, et sans attendre la cadence du va-et-vient. Les
   * gains partaient tout de suite et l'état deux secondes plus tard : un
   * processus tué entre les deux laissait au miroir la question encore
   * ouverte, et ses gains déjà payés — au réveil, elle se révélait une
   * seconde fois, et 177 points devenaient 354.
   */
  private run(sess: LiveSession, fn: (ctx: GameContext) => void) {
    if (sess.status !== 'running') return
    const avant = empreinte(sess)
    let scoresChanged = false
    let shouldEnd = false
    let verdict = false
    const ctx: GameContext = {
      award: (playerId, points, reason) => {
        this.deps.ledger.award(playerId, points, reason, sess.id)
        scoresChanged = true
      },
      logAnswers: rows => {
        const createdAt = Date.now()
        this.deps.answers.write(rows.map(r => ({ ...r, sessionId: sess.id, createdAt })))
      },
      dropAnswers: qIndex => this.deps.answers.dropQuestion(sess.id, qIndex),
      setTimer: (timerId, ms) => this.armTimer(sess, timerId, ms),
      clearTimer: timerId => this.disarmTimer(sess, timerId),
      end: () => {
        shouldEnd = true
      },
      verdict: () => {
        verdict = true
      },
      participants: () =>
        sess.participantIds
          .map(id => this.deps.party.publicOne(id, this.deps.ledger.total(id)))
          .filter((p): p is NonNullable<typeof p> => !!p),
      playerName: id => this.vctx.playerName(id),
      connected: id => this.deps.party.isConnected(id),
      now: () => Date.now(),
    }
    const backup = this.deps.backup
    backup?.ouvrirLot()
    try {
      fn(ctx)
      if (shouldEnd) {
        this.endSession(sess.id)
      } else {
        this.persist(sess, empreinte(sess) !== avant)
        this.fanout(sess)
      }
    } finally {
      // Même quand le handler lève une exception : ce qu'il a écrit en local
      // doit atteindre le miroir.
      backup?.fermerLot()
    }
    if (scoresChanged) this.deps.onScoresChanged()
    // Après la fermeture du lot : ce que le crédit relit a déjà pris le
    // chemin du miroir.
    if (verdict && !shouldEnd) this.deps.onVerdict()
  }

  private armTimer(sess: LiveSession, timerId: string, ms: number) {
    this.disarmTimer(sess, timerId)
    const handle = setTimeout(() => {
      sess.timers.delete(timerId)
      // Un chronomètre sonne hors de toute requête : une exception pendant la
      // révélation qu'il déclenche remontait jusqu'au processus, et emportait
      // les soirées de tous les espaces avec elle. Elle s'arrête ici, dans le
      // journal. Une révélation ratée vaut mieux qu'un serveur éteint : les
      // autres chronomètres continuent, et l'animateur garde la main pour
      // passer à la suite.
      try {
        if (this.module.onTimer) this.run(sess, ctx => this.module.onTimer!(sess, timerId, ctx))
      } catch (e) {
        console.error(`[partie] le chronomètre « ${timerId} » a échoué :`, e)
      }
    }, ms)
    sess.timers.set(timerId, { deadline: Date.now() + ms, handle })
  }

  private disarmTimer(sess: LiveSession, timerId: string) {
    const existing = sess.timers.get(timerId)
    if (existing) {
      clearTimeout(existing.handle)
      sess.timers.delete(timerId)
    }
  }

  private fanout(sess: LiveSession) {
    this.broadcast(() => {
      for (const playerId of sess.participantIds) {
        const view = this.module.playerView(sess, playerId, this.vctx)
        if (this.changed(`player:${playerId}`, view)) {
          this.deps.io.to(`player:${playerId}`).emit('session:view', { sessionId: sess.id, view })
        }
      }
      // L'écran commun, lui, bouge à chaque réponse (le compteur « 12/50 ont
      // répondu ») : sa vue change vraiment, on la renvoie.
      const hostView = this.module.hostView(sess, this.vctx)
      if (this.changed('__host__', hostView)) {
        this.deps.io.to(`hosts:${this.deps.spaceId}`).emit('session:view', { sessionId: sess.id, view: hostView })
      }
    })
  }

  /**
   * Calcule les vues d'une diffusion : elles partagent un mémo neuf, oublié à
   * la fin — le classement se trie une fois pour toute la salle, et jamais
   * sur un état qui a changé depuis.
   */
  private broadcast<T>(fn: () => T): T {
    const outer = this.memo
    this.memo = new Map()
    try {
      return fn()
    } finally {
      this.memo = outer
    }
  }

  /** Vrai si la vue diffère de la dernière envoyée (et mémorise la nouvelle). */
  private changed(key: string, view: unknown): boolean {
    const serialized = JSON.stringify(view)
    if (this.lastSent.get(key) === serialized) return false
    this.lastSent.set(key, serialized)
    return true
  }

  /** Écrit la partie en local, puis la recopie — tout de suite si `urgent`, à la cadence du va-et-vient sinon. */
  private persist(sess: LiveSession, urgent = false) {
    const timers: Record<string, number> = {}
    for (const [id, t] of sess.timers) timers[id] = t.deadline
    const row: SessionRow = {
      id: sess.id,
      spaceId: sess.spaceId,
      status: sess.status,
      participantIds: JSON.stringify(sess.participantIds),
      state: JSON.stringify(sess.state),
      timers: JSON.stringify(timers),
      createdAt: sess.createdAt,
      updatedAt: Date.now(),
    }
    this.deps.db
      .prepare(
        `INSERT INTO sessions (id, status, participant_ids, state, timers, created_at, updated_at, space_id)
         VALUES (@id, @status, @participantIds, @state, @timers, @createdAt, @updatedAt, @spaceId)
         ON CONFLICT(id) DO UPDATE SET status = @status, participant_ids = @participantIds,
           state = @state, timers = @timers, updated_at = @updatedAt`,
      )
      .run(row)
    this.lastRow = sess.status === 'running' ? row : null
    this.mirror(sess, row, urgent)
  }

  /**
   * Recopie la partie dans la base distante.
   *
   * Des gains ou des réponses dans le lot, une phase qui change, une partie
   * qui se termine : l'état part tout de suite, et dans le même envoi qu'eux.
   * Le reste — une réponse de plus en cours de question — au plus une fois
   * par intervalle.
   *
   * Une partie terminée RESTE au miroir, avec son statut : son état garde la
   * copie exacte du quiz joué. Elle en sortait, et après une mise en veille
   * l'archive reprenait la bibliothèque du jour — une question réécrite
   * entre-temps passait pour posée. « Nouvelle soirée » la purge.
   */
  private mirror(sess: LiveSession, row: SessionRow, urgent: boolean) {
    const backup = this.deps.backup
    if (!backup) return
    if (urgent || sess.status === 'ended' || backup.lotCharge()) {
      if (this.mirrorTimer) clearTimeout(this.mirrorTimer)
      this.mirrorTimer = null
      this.mirrorDirty = false
      backup.saveSession(row)
      // Les réponses qui suivent une révélation ou une nouvelle question
      // reprennent la cadence : la fenêtre repart d'ici.
      if (sess.status === 'running') this.armerMiroir(sess)
      return
    }
    if (this.mirrorTimer) {
      this.mirrorDirty = true
      return
    }
    backup.saveSession(row)
    this.armerMiroir(sess)
  }

  private armerMiroir(sess: LiveSession) {
    this.mirrorTimer = setTimeout(() => {
      this.mirrorTimer = null
      if (!this.mirrorDirty) return
      this.mirrorDirty = false
      // Encore en cours ? On renvoie l'état tel qu'il est maintenant.
      if (this.session?.id === sess.id && sess.status === 'running') this.persist(sess)
    }, MIRROR_INTERVAL_MS)
  }
}
