import type { GameContext, GameModule, GameSessionRec, ViewContext } from '../core/types'
import { playableQuestions, type PlayableQuestion, type QuizDef } from '../../../shared/library'
import type {
  QuizAction,
  QuizCommand,
  QuizGuessRow,
  QuizHostView,
  QuizPackInfo,
  QuizPlayerView,
  QuizPodiumRow,
} from '../../../shared/games/quiz'

interface QuizPack {
  id: string
  title: string
  questions: PlayableQuestion[]
}

/** Ce qu'un joueur a envoyé pour la question en cours. */
interface Response {
  ms: number
  /** QCM : index choisi. */
  choice: number | null
  /** Estimation : nombre proposé. */
  value: number | null
}

interface QuizState {
  phase: 'pickPack' | 'getReady' | 'question' | 'reveal' | 'finished'
  packs: QuizPackInfo[]
  /** Le quiz joué est copié dans l'état : l'éditer pendant la partie ne change rien. */
  pack: QuizPack | null
  qIndex: number
  questionStartAt: number
  deadline: number
  responses: Record<string, Response>
  lastAwards: Record<string, number>
  totals: Record<string, number>
  /** Arrivé en cours de route : première question qu'il pourra jouer. */
  playFrom: Record<string, number>
}

const READY_MS = 3000
const GRACE_MS = 400 // marge réseau : le timer serveur coupe un peu après le deadline affiché

// QCM : bonne réponse + bonus de rapidité.
const CHOICE_POINTS = 100
const SPEED_BONUS = 100

// Estimation : on récompense d'abord la participation, puis la proximité
// relative au groupe (une erreur de 3 ans sur une date n'a pas le même sens
// qu'une erreur de 3 km sur une distance — seul le classement du groupe le dit).
const GUESS_POINTS = 30
const PROXIMITY_POINTS = 120
const CLOSEST_BONUS = 50

// ── Bibliothèque ─────────────────────────────────────────────────────────
//
// Le moteur de jeu est synchrone alors que la bibliothèque vit dans une base
// asynchrone (potentiellement distante). On garde donc une copie en mémoire,
// rafraîchie au démarrage et après chaque édition — jamais pendant une partie.

let library: QuizPack[] = []

export function setQuizLibrary(quizzes: QuizDef[]) {
  library = quizzes
    .map(q => ({ id: q.id, title: q.title, questions: playableQuestions(q) }))
    .filter(p => p.questions.length > 0)
}

// ── Déroulé ──────────────────────────────────────────────────────────────

function startQuestion(sess: GameSessionRec<QuizState>, index: number, ctx: GameContext) {
  const st = sess.state
  const q = st.pack!.questions[index]
  st.phase = 'question'
  st.qIndex = index
  st.responses = {}
  st.lastAwards = {}
  st.questionStartAt = ctx.now()
  st.deadline = st.questionStartAt + q.duration * 1000
  ctx.setTimer('question', q.duration * 1000 + GRACE_MS)
}

function award(sess: GameSessionRec<QuizState>, playerId: string, points: number, ctx: GameContext) {
  const st = sess.state
  st.lastAwards[playerId] = points
  if (points <= 0) return
  st.totals[playerId] = (st.totals[playerId] ?? 0) + points
  ctx.award(playerId, points, `Quiz « ${st.pack!.title} » — Q${st.qIndex + 1}`)
}

function reveal(sess: GameSessionRec<QuizState>, ctx: GameContext) {
  const st = sess.state
  const q = st.pack!.questions[st.qIndex]
  ctx.clearTimer('question')
  st.phase = 'reveal'
  st.lastAwards = {}

  if (q.kind === 'choice') {
    for (const [playerId, r] of Object.entries(st.responses)) {
      if (r.choice !== q.correct) {
        award(sess, playerId, 0, ctx)
        continue
      }
      // 100 pts + bonus de rapidité (linéaire sur le temps restant)
      const remaining = Math.max(0, q.duration * 1000 - r.ms)
      award(sess, playerId, CHOICE_POINTS + Math.round((SPEED_BONUS * remaining) / (q.duration * 1000)), ctx)
    }
    return
  }

  const guesses = Object.entries(st.responses)
    .filter(([, r]) => r.value !== null)
    .map(([playerId, r]) => ({ playerId, error: Math.abs(r.value! - q.target), ms: r.ms }))
  if (guesses.length === 0) return

  const best = Math.min(...guesses.map(g => g.error))
  const worst = Math.max(...guesses.map(g => g.error))
  // À égalité d'écart, le plus rapide est déclaré le plus proche.
  const closest = [...guesses].sort((a, b) => a.error - b.error || a.ms - b.ms)[0].playerId
  for (const g of guesses) {
    // Tout le monde à égalité (ou un seul joueur) : personne n'est pénalisé.
    const ratio = worst === best ? 1 : (worst - g.error) / (worst - best)
    const points =
      GUESS_POINTS + Math.round(PROXIMITY_POINTS * ratio) + (g.playerId === closest ? CLOSEST_BONUS : 0)
    award(sess, g.playerId, points, ctx)
  }
}

function sortedTotals(sess: GameSessionRec<QuizState>): { playerId: string; points: number }[] {
  return sess.participantIds
    .map(id => ({ playerId: id, points: sess.state.totals[id] ?? 0 }))
    .sort((a, b) => b.points - a.points)
}

function standings(sess: GameSessionRec<QuizState>, vctx: ViewContext, limit?: number): QuizPodiumRow[] {
  const rows = sortedTotals(sess).map(r => {
    const p = vctx.player(r.playerId)
    return { name: p?.name ?? vctx.playerName(r.playerId), avatar: p?.avatar ?? '🎉', points: r.points }
  })
  return limit ? rows.slice(0, limit) : rows
}

/** Les propositions d'une question « estimation », de la plus proche à la plus loin. */
function guessRows(sess: GameSessionRec<QuizState>, target: number, vctx: ViewContext): QuizGuessRow[] {
  const st = sess.state
  return Object.entries(st.responses)
    .filter(([, r]) => r.value !== null)
    .map(([playerId, r]) => {
      const p = vctx.player(playerId)
      return {
        name: p?.name ?? vctx.playerName(playerId),
        avatar: p?.avatar ?? '🎉',
        value: r.value!,
        points: st.lastAwards[playerId] ?? 0,
        error: Math.abs(r.value! - target),
        ms: r.ms,
      }
    })
    .sort((a, b) => a.error - b.error || a.ms - b.ms)
    .map(({ name, avatar, value, points }) => ({ name, avatar, value, points }))
}

// ── Module ───────────────────────────────────────────────────────────────

export const quizModule: GameModule<QuizState> = {
  createInitialState(): QuizState {
    if (library.length === 0) {
      throw new Error('Aucun quiz prêt à jouer — créez-en un dans l’espace animateur (/edit)')
    }
    return {
      phase: 'pickPack',
      packs: library.map(p => ({ id: p.id, title: p.title, questionCount: p.questions.length })),
      pack: null,
      qIndex: 0,
      questionStartAt: 0,
      deadline: 0,
      responses: {},
      lastAwards: {},
      totals: {},
      playFrom: {},
    }
  },

  onPlayerAction(sess, playerId, action: QuizAction, ctx) {
    const st = sess.state
    if (st.phase !== 'question' || !st.pack) return
    const q = st.pack.questions[st.qIndex]

    if (action?.type === 'answer' && q.kind === 'choice') {
      if (st.responses[playerId]) return // un QCM ne se corrige pas
      const choice = Number(action.choice)
      if (!Number.isInteger(choice) || choice < 0 || choice >= q.answers.length) return
      st.responses[playerId] = { choice, value: null, ms: ctx.now() - st.questionStartAt }
    } else if (action?.type === 'guess' && q.kind === 'number') {
      const value = Number(action.value)
      if (!Number.isFinite(value)) return
      // Une estimation se corrige tant que tout le monde n'a pas répondu :
      // on ne veut pas pénaliser un doigt qui glisse sur un clavier numérique.
      st.responses[playerId] = { choice: null, value, ms: ctx.now() - st.questionStartAt }
    } else {
      return
    }

    // Tout le monde a répondu → révélation immédiate
    if (Object.keys(st.responses).length >= sess.participantIds.length) reveal(sess, ctx)
  },

  onHostCommand(sess, command: QuizCommand, ctx) {
    const st = sess.state
    switch (command?.type) {
      case 'selectPack': {
        if (st.phase !== 'pickPack') return
        const pack = library.find(p => p.id === command.packId)
        if (!pack) throw new Error('Quiz introuvable')
        st.pack = pack
        st.phase = 'getReady'
        st.deadline = ctx.now() + READY_MS
        ctx.setTimer('ready', READY_MS)
        break
      }
      case 'next':
        if (st.phase === 'question') {
          reveal(sess, ctx) // l'animateur force la fin de la question
        } else if (st.phase === 'reveal' && st.pack) {
          if (st.qIndex + 1 < st.pack.questions.length) startQuestion(sess, st.qIndex + 1, ctx)
          else st.phase = 'finished'
        }
        break
    }
  },

  onPlayerJoin(sess, playerId) {
    const st = sess.state
    // Arrivé pendant une question : il peut encore répondre (avec moins de
    // temps). Arrivé pendant une révélation : il démarre à la suivante.
    st.playFrom[playerId] = st.phase === 'reveal' ? st.qIndex + 1 : st.qIndex
  },

  onTimer(sess, timerId, ctx) {
    if (timerId === 'ready' && sess.state.phase === 'getReady') startQuestion(sess, 0, ctx)
    if (timerId === 'question' && sess.state.phase === 'question') reveal(sess, ctx)
  },

  playerView(sess, playerId, vctx): QuizPlayerView {
    const st = sess.state
    const mine = st.responses[playerId]
    const base = {
      phase: st.phase,
      qIndex: st.qIndex,
      qCount: st.pack?.questions.length ?? 0,
      yourChoice: mine?.choice ?? null,
      yourGuess: mine?.value ?? null,
    }
    if (st.phase === 'getReady') return { ...base, deadline: st.deadline }
    if ((st.phase === 'question' || st.phase === 'reveal') && st.pack) {
      const q = st.pack.questions[st.qIndex]
      const rank = sortedTotals(sess).findIndex(r => r.playerId === playerId) + 1
      return {
        ...base,
        kind: q.kind,
        text: q.text,
        answers: q.kind === 'choice' ? q.answers : undefined,
        unit: q.kind === 'number' ? q.unit : undefined,
        image: q.image,
        deadline: st.deadline,
        duration: q.duration,
        ...(st.phase === 'reveal' && {
          justArrived: (st.playFrom[playerId] ?? 0) > st.qIndex,
          correct: q.kind === 'choice' ? q.correct : undefined,
          target: q.kind === 'number' ? q.target : undefined,
          yourPoints: playerId in st.lastAwards ? st.lastAwards[playerId] : null,
          yourQuizTotal: st.totals[playerId] ?? 0,
          yourQuizRank: rank,
        }),
      }
    }
    if (st.phase === 'finished') {
      const rank = sortedTotals(sess).findIndex(r => r.playerId === playerId) + 1
      return {
        ...base,
        yourQuizTotal: st.totals[playerId] ?? 0,
        yourQuizRank: rank,
        podium: standings(sess, vctx, 3),
      }
    }
    return base
  },

  hostView(sess, vctx): QuizHostView {
    const st = sess.state
    const base = {
      phase: st.phase,
      qIndex: st.qIndex,
      qCount: st.pack?.questions.length ?? 0,
      packTitle: st.pack?.title,
    }
    if (st.phase === 'pickPack') return { ...base, packs: st.packs }
    if (st.phase === 'getReady') return { ...base, deadline: st.deadline }
    if ((st.phase === 'question' || st.phase === 'reveal') && st.pack) {
      const q = st.pack.questions[st.qIndex]
      const view: QuizHostView = {
        ...base,
        kind: q.kind,
        text: q.text,
        answers: q.kind === 'choice' ? q.answers : undefined,
        unit: q.kind === 'number' ? q.unit : undefined,
        image: q.image,
        deadline: st.deadline,
        duration: q.duration,
        answeredCount: Object.keys(st.responses).length,
        participantCount: sess.participantIds.length,
      }
      if (st.phase === 'reveal') {
        if (q.kind === 'choice') {
          view.correct = q.correct
          view.counts = q.answers.map(
            (_, i) => Object.values(st.responses).filter(r => r.choice === i).length,
          )
          let fastest: { name: string; ms: number } | null = null
          for (const [playerId, r] of Object.entries(st.responses)) {
            if (r.choice === q.correct && (!fastest || r.ms < fastest.ms)) {
              fastest = { name: vctx.playerName(playerId), ms: r.ms }
            }
          }
          view.fastest = fastest
        } else {
          view.target = q.target
          view.guesses = guessRows(sess, q.target, vctx).slice(0, 8)
        }
        view.standings = standings(sess, vctx, 5)
      }
      return view
    }
    // finished
    return { ...base, standings: standings(sess, vctx) }
  },
}
