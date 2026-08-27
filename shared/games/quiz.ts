// Vues et actions du Quiz (QCM style Kahoot + estimation chiffrée).
import type { QuestionKind } from '../library'

export type QuizPhase = 'pickPack' | 'getReady' | 'question' | 'reveal' | 'finished'

export interface QuizPackInfo {
  id: string
  title: string
  questionCount: number
}

export interface QuizPodiumRow {
  name: string
  avatar: string
  points: number
}

/** Estimation : ce que chacun a proposé, du plus proche au plus loin. */
export interface QuizGuessRow {
  name: string
  avatar: string
  value: number
  points: number
}

export interface QuizPlayerView {
  phase: QuizPhase
  qIndex: number
  qCount: number
  kind?: QuestionKind
  yourChoice: number | null
  /** Estimation : le nombre proposé, modifiable tant que tout le monde n'a pas répondu. */
  yourGuess?: number | null
  // question + reveal
  text?: string
  answers?: string[]
  unit?: string
  image?: string | null
  deadline?: number
  /** Secondes allouées à la question — pour la barre de temps qui se vide. */
  duration?: number
  /** Points multipliés pour ce quiz (1, 2 ou 3) — annoncé à toute la salle. */
  multiplier?: number
  /** L'animateur a figé le chronomètre : plus personne ne peut répondre. */
  paused?: boolean
  /** Temps restant figé, en millisecondes (uniquement en pause). */
  remainingMs?: number
  // reveal
  /** Vrai si le joueur vient d'arriver : il n'a pas raté la question, il n'était pas là. */
  justArrived?: boolean
  correct?: number
  target?: number
  yourPoints?: number | null
  yourQuizTotal?: number
  yourQuizRank?: number
  // finished
  podium?: QuizPodiumRow[]
}

export interface QuizHostView {
  phase: QuizPhase
  qIndex: number
  qCount: number
  packTitle?: string
  /** Points multipliés pour ce quiz (1, 2 ou 3). */
  multiplier?: number
  kind?: QuestionKind
  // pickPack
  packs?: QuizPackInfo[]
  // question + reveal
  text?: string
  answers?: string[]
  unit?: string
  image?: string | null
  deadline?: number
  /** Secondes allouées à la question — pour la barre de temps qui se vide. */
  duration?: number
  paused?: boolean
  remainingMs?: number
  /** Secondes avant la question suivante, ou null si l'animateur pilote. */
  autoNextSeconds?: number | null
  /** Échéance de l'enchaînement automatique, pendant une révélation. */
  autoNextAt?: number
  answeredCount?: number
  participantCount?: number
  // reveal + finished
  correct?: number
  target?: number
  counts?: number[]
  guesses?: QuizGuessRow[]
  fastest?: { name: string; ms: number } | null
  standings?: QuizPodiumRow[]
}

export type QuizAction =
  | { type: 'answer'; choice: number }
  | { type: 'guess'; value: number }

export type QuizCommand =
  /** `multiplier` : 1 par défaut, 2 ou 3 pour un quiz qui compte double ou triple. */
  | { type: 'selectPack'; packId: string; multiplier?: number }
  | { type: 'next' }
  /** Fige le chronomètre (discours, gâteau qui arrive…) et le repart. */
  | { type: 'pause' }
  | { type: 'resume' }
  /** Retire les points de la question révélée — quand la réponse était fausse. */
  | { type: 'cancel' }
  /** Annule et repose la même question. */
  | { type: 'replay' }
  /** Enchaîne les questions tout seul après N secondes ; null = manuel. */
  | { type: 'autoNext'; seconds: number | null }
