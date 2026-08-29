import { randomUUID } from 'node:crypto'
import type { Socket } from 'socket.io'
import type { DB } from './db'
import type { GameContext, GameModule, GameSessionRec, IoServer, ViewContext } from './types'
import type { Party } from './party'
import type { ScoreLedger } from './scores'
import type { AnswerLog } from './answers'
import type { SessionSummary } from '../../../shared/types'

interface LiveSession extends GameSessionRec {
  createdAt: number
  timers: Map<string, { deadline: number; handle: NodeJS.Timeout }>
}

interface EngineDeps {
  db: DB
  io: IoServer
  party: Party
  ledger: ScoreLedger
  answers: AnswerLog
  onScoresChanged: () => void
  onSessionChanged: () => void
}

/**
 * Moteur de partie : il ne connaît aucune règle. Il route les actions joueurs,
 * les commandes de l'animateur et les timers vers le module de jeu, persiste
 * l'état après chaque changement (reprise après crash) et rediffuse les vues
 * filtrées. Une seule partie tourne à la fois.
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

  private vctx: ViewContext = {
    playerName: id => this.deps.party.get(id)?.name ?? '???',
    player: id => this.deps.party.publicOne(id, this.deps.ledger.total(id)),
  }

  constructor(private deps: EngineDeps, private module: GameModule) {}

  /** Recharge la partie en cours depuis la base (reprise après redémarrage). */
  restore() {
    const rows = this.deps.db
      .prepare("SELECT * FROM sessions WHERE status = 'running' ORDER BY created_at DESC")
      .all() as any[]
    const [row, ...stale] = rows
    // Une seule partie à la fois : si la base en contient plusieurs (vieilles
    // données), on ne reprend que la dernière et on solde les autres.
    for (const old of stale) {
      this.deps.db.prepare("UPDATE sessions SET status = 'ended' WHERE id = ?").run(old.id)
    }
    if (!row) return
    const sess: LiveSession = {
      id: row.id,
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
      status: 'running',
      participantIds,
      state: this.module.createInitialState(participantIds, config),
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

  handlePlayerAction(sessionId: string, playerId: string, action: unknown) {
    const sess = this.requireRunning(sessionId)
    if (!sess.participantIds.includes(playerId)) {
      throw new Error('Tu ne participes pas à cette partie')
    }
    this.run(sess, ctx => this.module.onPlayerAction(sess, playerId, action, ctx))
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
    this.deps.io.emit('session:ended', { sessionId })
    this.deps.onSessionChanged()
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

  /** Un invité exclu quitte aussi la partie en cours. */
  dropParticipant(playerId: string) {
    const sess = this.session
    if (!sess || !sess.participantIds.includes(playerId)) return
    sess.participantIds = sess.participantIds.filter(id => id !== playerId)
    this.lastSent.delete(`player:${playerId}`)
    this.persist(sess)
    this.fanout(sess)
    this.deps.onSessionChanged()
  }

  /** Renvoie sa vue à un joueur qui (re)vient — reconnexion transparente. */
  resendViews(playerId: string) {
    const sess = this.session
    if (!sess || sess.status !== 'running' || !sess.participantIds.includes(playerId)) return
    const view = this.module.playerView(sess, playerId, this.vctx)
    // Toujours envoyer : le téléphone qui revient d'une coupure a un écran
    // vide, même si sa vue n'a pas changé entre-temps.
    this.changed(`player:${playerId}`, view)
    this.deps.io.to(`player:${playerId}`).emit('session:view', { sessionId: sess.id, view })
  }

  /** Renvoie la vue host à un écran commun qui (re)vient. */
  resendHostViews(socket: Socket) {
    const sess = this.session
    if (!sess || sess.status !== 'running') return
    socket.emit('session:view', {
      sessionId: sess.id,
      view: this.module.hostView(sess, this.vctx),
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

  /** Exécute un handler du module puis persiste + rediffuse. */
  private run(sess: LiveSession, fn: (ctx: GameContext) => void) {
    if (sess.status !== 'running') return
    let scoresChanged = false
    let shouldEnd = false
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
      participants: () =>
        sess.participantIds
          .map(id => this.deps.party.publicOne(id, this.deps.ledger.total(id)))
          .filter((p): p is NonNullable<typeof p> => !!p),
      playerName: id => this.vctx.playerName(id),
      now: () => Date.now(),
    }
    fn(ctx)
    if (shouldEnd) {
      this.endSession(sess.id)
    } else {
      this.persist(sess)
      this.fanout(sess)
    }
    if (scoresChanged) this.deps.onScoresChanged()
  }

  private armTimer(sess: LiveSession, timerId: string, ms: number) {
    this.disarmTimer(sess, timerId)
    const handle = setTimeout(() => {
      sess.timers.delete(timerId)
      if (this.module.onTimer) this.run(sess, ctx => this.module.onTimer!(sess, timerId, ctx))
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
      this.deps.io.to('hosts').emit('session:view', { sessionId: sess.id, view: hostView })
    }
  }

  /** Vrai si la vue diffère de la dernière envoyée (et mémorise la nouvelle). */
  private changed(key: string, view: unknown): boolean {
    const serialized = JSON.stringify(view)
    if (this.lastSent.get(key) === serialized) return false
    this.lastSent.set(key, serialized)
    return true
  }

  private persist(sess: LiveSession) {
    const timers: Record<string, number> = {}
    for (const [id, t] of sess.timers) timers[id] = t.deadline
    this.deps.db
      .prepare(
        `INSERT INTO sessions (id, status, participant_ids, state, timers, created_at, updated_at)
         VALUES (@id, @status, @participantIds, @state, @timers, @createdAt, @updatedAt)
         ON CONFLICT(id) DO UPDATE SET status = @status, participant_ids = @participantIds,
           state = @state, timers = @timers, updated_at = @updatedAt`,
      )
      .run({
        id: sess.id,
        status: sess.status,
        participantIds: JSON.stringify(sess.participantIds),
        state: JSON.stringify(sess.state),
        timers: JSON.stringify(timers),
        createdAt: sess.createdAt,
        updatedAt: Date.now(),
      })
  }
}
