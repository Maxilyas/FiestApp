// Le bilan de la soirée : ce que chacun a répondu à chaque question, et ce
// que son équipe et la salle ont répondu en regard. Tout dérive du journal
// des réponses, recroisé avec les questions telles qu'elles ont été posées.
//
// Distinct des statistiques (shared/types.ts, PartyStats) : celles-ci
// résument chaque joueur en dix-huit chiffres, le bilan garde le détail
// question par question — c'est lui qu'on relit le lendemain.
import type { ArchiveSummary, DerniereSoiree } from './archive'
import type { QuestionKind } from './library'
import type { PublicSpace } from './space'
import type { PlayerStat, PublicTeam, TeamBonus } from './types'

/** Ce qu'une équipe a fait sur une question. */
export interface TeamOnQuestion {
  teamId: string
  /** Membres qui pouvaient répondre. */
  asked: number
  answered: number
  /** QCM : bonnes réponses. */
  correct: number
  /** QCM : répartition par réponse, dans l'ordre des réponses affichées. */
  counts: number[]
  /** Temps moyen des réponses données, en ms. */
  avgMs: number | null
  /** Points marqués par l'équipe sur cette question. */
  points: number
}

export interface ReviewQuestion {
  /** `${sessionId}#${qIndex}` — la clé que portent les réponses. */
  key: string
  sessionId: string
  /** Rang du quiz dans la soirée, à partir de 1. */
  quizNumber: number
  quizTitle: string
  /** Position dans le quiz, à partir de 0. */
  qIndex: number
  /** Rang dans la soirée, toutes parties confondues, à partir de 1. */
  order: number
  kind: QuestionKind
  text: string
  /** QCM : les réponses telles qu'affichées. Vide pour une estimation. */
  answers: string[]
  /** QCM : index de la bonne réponse. */
  correct: number | null
  /** Estimation : la bonne valeur. */
  target: number | null
  unit: string
  image: string | null
  /** « Le saviez-vous ? », si la question en racontait un. */
  anecdote?: string
  durationMs: number
  /** La photo avait disparu avant la question. */
  observed: boolean
  /**
   * L'intitulé et les réponses ont été retrouvés — dans la copie de la partie
   * ou dans la bibliothèque. Sinon, on n'a que les numéros.
   */
  resolved: boolean
  /**
   * Retrouvé dans la bibliothèque, mais ce que le journal dit de la question
   * (type, bonne réponse, nombre de réponses) ne colle pas : le quiz a sans
   * doute été modifié depuis la soirée.
   */
  uncertain: boolean
  /** Participants qui pouvaient répondre. */
  asked: number
  answered: number
  /** QCM : bonnes réponses dans la salle. */
  correctCount: number
  /** QCM : répartition des réponses dans la salle. */
  counts: number[]
  byTeam: TeamOnQuestion[]
  /** QCM : la bonne réponse la plus rapide de la salle. */
  fastest: { playerId: string; ms: number } | null
  /** Temps moyen des réponses données, en ms. */
  avgMs: number | null
  /** Estimation : les propositions les plus proches — plusieurs quand elles sont à égalité d'écart, vide sans proposition. */
  closest: { playerId: string; value: number }[]
  /** Estimation : nombre de propositions. */
  guesses: number
  /** Le meneur du classement cumulé a changé après cette question. */
  newLeader: string | null
  /** Changements d'avis cumulés sur la question. */
  changes: number
}

/** Ce qu'un joueur a fait sur une question. */
export interface ReviewAnswer {
  questionKey: string
  answered: boolean
  /** QCM : juste ou faux. Une estimation n'est ni l'un ni l'autre. */
  correct: boolean | null
  choice: number | null
  value: number | null
  ms: number | null
  changes: number
  points: number
  /** Estimation : rang de proximité dans la salle, 1 = le plus proche, partagé à égalité d'écart. */
  proximityRank: number | null
}

export type HighlightKind =
  | 'onlyRight'
  | 'onlyWrong'
  | 'fastest'
  | 'saviour'
  | 'exact'
  | 'closest'

/** Un moment fort de la soirée pour un joueur, rattaché à une question. */
export interface ReviewHighlight {
  kind: HighlightKind
  questionKey: string
  text: string
}

export interface ReviewPlayer {
  id: string
  name: string
  avatar: string
  teamId: string | null
  points: number
  /** Rang dans la salle, partagé à égalité. */
  rank: number
  /** Rang dans son équipe, partagé à égalité ; null sans équipe. */
  teamRank: number | null
  /** Le détail chiffré, le même que sur la page des statistiques. */
  stat: PlayerStat
  /** Une entrée par question où il était dans la partie, dans l'ordre. */
  answers: ReviewAnswer[]
  /** Les prix de la soirée dont il est le lauréat proposé. */
  /** `exAequo` : ceux que le prénom a départagés de lui (voir `Award`). */
  awards: { emoji: string; title: string; detail: string; exAequo?: string[] }[]
  highlights: ReviewHighlight[]
  /** Ses points et son rang sur chaque quiz, dans l'ordre des quiz. */
  perQuiz: { sessionId: string; points: number; rank: number | null }[]
}

export interface ReviewTeamQuiz {
  sessionId: string
  /** La moyenne de l'équipe sur ce quiz seul, avec la règle de la salle (`moyenneAuProrata`). */
  average: number
  total: number
  /** Taux de bonnes réponses aux QCM. */
  accuracy: number | null
  avgMs: number | null
  /** Rang parmi les équipes sur ce quiz seul. */
  rank: number
}

export interface ReviewTeam extends PublicTeam {
  /** Rang au quiz (par la moyenne), partagé à égalité. */
  rank: number
  gamePoints: number
  finalPoints: number
  /** Taux de bonnes réponses aux QCM, tous membres confondus. */
  accuracy: number | null
  /** Le coup d'œil de ses estimations, toutes mises ensemble : la part de la salle que chacune bat ou égale. */
  coupDOeil: number | null
  avgMs: number | null
  /** Le membre qui a le plus marqué. */
  best: { playerId: string; points: number } | null
  perQuiz: ReviewTeamQuiz[]
}

export interface ReviewQuiz {
  sessionId: string
  number: number
  title: string
  questionCount: number
  startedAt: number
  /** Participants, retardataires compris. */
  players: number
  /**
   * Les vainqueurs du quiz : tous ceux qui partagent la première place, dans
   * l'ordre commun (shared/classement.ts), et personne si personne n'a marqué.
   * Le bilan n'en nommait qu'un quand le souvenir et l'expérience les
   * couronnaient tous.
   */
  winners: { playerId: string; points: number }[]
  /** Les équipes en tête du quiz, à la moyenne — plusieurs si elles finissent ex æquo. */
  teamWinners: { teamId: string; average: number }[]
  /**
   * Le premier de chaque liste : ce que lisent les pages d'avant les listes,
   * restées ouvertes pendant une mise à jour.
   */
  winner: { playerId: string; points: number } | null
  teamWinner: { teamId: string; average: number } | null
}

/** Les questions qui ont marqué la soirée — chacune par sa clé, ou null. */
export interface ReviewRecords {
  /** QCM le plus raté. */
  hardest: string | null
  easiest: string | null
  /** Les réponses les plus dispersées. */
  mostDivisive: string | null
  /** Le plus de changements d'avis. */
  mostHesitant: string | null
  /** Le temps de réponse moyen le plus court. */
  quickest: string | null
  slowest: string | null
}

export interface Review {
  generatedAt: number
  questions: ReviewQuestion[]
  /** Du premier au dernier du classement. */
  players: ReviewPlayer[]
  /** Dans l'ordre du classement d'équipe. */
  teams: ReviewTeam[]
  quizzes: ReviewQuiz[]
  records: ReviewRecords
  /** Les prix remis à l'écran, du premier au dernier — comme au souvenir. */
  bonuses: TeamBonus[]
  /** Questions dont l'intitulé n'a pas été retrouvé. */
  unresolved: number
  /** Présent quand la page relit une soirée archivée plutôt que celle en cours. */
  archive?: ArchiveSummary
  /** Présent quand la soirée en cours n'a rien joué : la dernière soirée close, à montrer à sa place. */
  derniere?: DerniereSoiree
  /** L'espace dont la page parle — ses titres, sa date. */
  space?: PublicSpace
}

// ── Petites aides, les mêmes côté page et côté export ────────────────────

/** « Q3 » — la position dans le quiz, à lire par un humain. */
export const questionLabel = (q: Pick<ReviewQuestion, 'qIndex'>) => `Q${q.qIndex + 1}`

/** Le libellé d'une réponse choisie ; une réponse inconnue garde son numéro. */
export function answerLabel(q: Pick<ReviewQuestion, 'answers'>, choice: number | null): string {
  if (choice === null) return ''
  return q.answers[choice] ?? `Réponse ${choice + 1}`
}

/** « 1,8 s » — un temps de réponse, à la française. */
export const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`

/** « 62 % » */
export const formatPercent = (ratio: number) => `${Math.round(ratio * 100)} %`

/** Un rang partagé : l'index du premier à égalité, plus un. */
export function sharedRank<T>(sorted: T[], item: T, value: (t: T) => number): number {
  return sorted.findIndex(o => value(o) === value(item)) + 1
}
