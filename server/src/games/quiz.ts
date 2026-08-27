import type { GameContext, GameModule, GameSessionRec, ViewContext } from '../core/types'
import { playableQuestions, type PlayableQuestion, type QuizDef } from '../../../shared/library'
import type {
  QuizAction,
  QuizCommand,
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

interface QuizState {
  phase: 'pickPack' | 'getReady' | 'question' | 'reveal' | 'finished'
  packs: QuizPackInfo[]
  /** Le quiz joué est copié dans l'état : l'éditer pendant la partie ne change rien. */
  pack: QuizPack | null
  qIndex: number
  questionStartAt: number
  deadline: number
  answers: Record<string, { choice: number; ms: number }>
  lastAwards: Record<string, number>
  totals: Record<string, number>
}

const READY_MS = 3000
const GRACE_MS = 400 // marge réseau : le timer serveur coupe un peu après le deadline affiché

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
  st.answers = {}
  st.lastAwards = {}
  st.questionStartAt = ctx.now()
  st.deadline = st.questionStartAt + q.duration * 1000
  ctx.setTimer('question', q.duration * 1000 + GRACE_MS)
}

function reveal(sess: GameSessionRec<QuizState>, ctx: GameContext) {
  const st = sess.state
  const q = st.pack!.questions[st.qIndex]
  ctx.clearTimer('question')
  st.phase = 'reveal'
  st.lastAwards = {}
  for (const [playerId, a] of Object.entries(st.answers)) {
    if (a.choice !== q.correct) {
      st.lastAwards[playerId] = 0
      continue
    }
    // 100 pts + bonus de rapidité jusqu'à 100 pts (linéaire sur le temps restant)
    const remaining = Math.max(0, q.duration * 1000 - a.ms)
    const points = 100 + Math.round((100 * remaining) / (q.duration * 1000))
    st.lastAwards[playerId] = points
    st.totals[playerId] = (st.totals[playerId] ?? 0) + points
    ctx.award(playerId, points, `Quiz « ${st.pack!.title} » — Q${st.qIndex + 1}`)
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
      answers: {},
      lastAwards: {},
      totals: {},
    }
  },

  onPlayerAction(sess, playerId, action: QuizAction, ctx) {
    const st = sess.state
    if (action?.type !== 'answer' || st.phase !== 'question' || !st.pack) return
    if (st.answers[playerId]) return
    const q = st.pack.questions[st.qIndex]
    const choice = Number(action.choice)
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.answers.length) return
    st.answers[playerId] = { choice, ms: ctx.now() - st.questionStartAt }
    // Tout le monde a répondu → révélation immédiate
    if (Object.keys(st.answers).length >= sess.participantIds.length) reveal(sess, ctx)
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

  onTimer(sess, timerId, ctx) {
    if (timerId === 'ready' && sess.state.phase === 'getReady') startQuestion(sess, 0, ctx)
    if (timerId === 'question' && sess.state.phase === 'question') reveal(sess, ctx)
  },

  playerView(sess, playerId, vctx): QuizPlayerView {
    const st = sess.state
    const base = {
      phase: st.phase,
      qIndex: st.qIndex,
      qCount: st.pack?.questions.length ?? 0,
      yourChoice: st.answers[playerId]?.choice ?? null,
    }
    if (st.phase === 'getReady') return { ...base, deadline: st.deadline }
    if ((st.phase === 'question' || st.phase === 'reveal') && st.pack) {
      const q = st.pack.questions[st.qIndex]
      const rank = sortedTotals(sess).findIndex(r => r.playerId === playerId) + 1
      return {
        ...base,
        text: q.text,
        answers: q.answers,
        image: q.image,
        deadline: st.deadline,
        ...(st.phase === 'reveal' && {
          correct: q.correct,
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
        text: q.text,
        answers: q.answers,
        image: q.image,
        deadline: st.deadline,
        answeredCount: Object.keys(st.answers).length,
        participantCount: sess.participantIds.length,
      }
      if (st.phase === 'reveal') {
        const counts = q.answers.map((_, i) => Object.values(st.answers).filter(a => a.choice === i).length)
        let fastest: { name: string; ms: number } | null = null
        for (const [playerId, a] of Object.entries(st.answers)) {
          if (a.choice === q.correct && (!fastest || a.ms < fastest.ms)) {
            fastest = { name: vctx.playerName(playerId), ms: a.ms }
          }
        }
        view.correct = q.correct
        view.counts = counts
        view.fastest = fastest
        view.standings = standings(sess, vctx, 5)
      }
      return view
    }
    // finished
    return { ...base, standings: standings(sess, vctx) }
  },
}
