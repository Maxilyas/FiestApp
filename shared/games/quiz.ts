// Vues et actions du Quiz (QCM style Kahoot, points de rapidité).

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

export interface QuizPlayerView {
  phase: QuizPhase
  qIndex: number
  qCount: number
  yourChoice: number | null
  // question + reveal
  text?: string
  answers?: string[]
  image?: string | null
  deadline?: number
  // reveal
  correct?: number
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
  // pickPack
  packs?: QuizPackInfo[]
  // question + reveal
  text?: string
  answers?: string[]
  image?: string | null
  deadline?: number
  answeredCount?: number
  participantCount?: number
  // reveal + finished
  correct?: number
  counts?: number[]
  fastest?: { name: string; ms: number } | null
  standings?: QuizPodiumRow[]
}

export type QuizAction = { type: 'answer'; choice: number }

export type QuizCommand =
  | { type: 'selectPack'; packId: string }
  | { type: 'next' }
