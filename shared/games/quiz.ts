// Vues et actions du Quiz (QCM style Kahoot + estimation chiffrée).
import type { QuestionKind } from '../library'
import type { Distinctions } from '../profil'

/**
 * `observe` : la photo est projetée seule, sans la question ni les réponses.
 * C'est ce qui rend le jeu de mémoire possible — sans cette phase, il suffirait
 * de répondre pendant que la photo est encore à l'écran.
 */
export type QuizPhase = 'pickPack' | 'getReady' | 'observe' | 'question' | 'reveal' | 'finished'

export interface QuizPackInfo {
  id: string
  title: string
  questionCount: number
}

export interface QuizPodiumRow extends Distinctions {
  name: string
  avatar: string
  points: number
}

/** Estimation : ce que chacun a proposé, du plus proche au plus loin. */
export interface QuizGuessRow extends Distinctions {
  name: string
  avatar: string
  value: number
  points: number
}

export interface QuizPlayerView {
  phase: QuizPhase
  qIndex: number
  /**
   * Le tour : il avance chaque fois qu'une question est posée, « Reposer »
   * compris. Même numéro, autre tour — c'est ce qui distingue une question
   * reposée de sa première fois. Les réponses le renvoient (voir `Visee`).
   * Absent d'une partie lancée avant qu'il existe.
   */
  round?: number
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
  /** La photo a été observée puis retirée : à répondre de mémoire. */
  photoGone?: boolean
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
  /** Le tour de la question — voir `QuizPlayerView.round`. Les commandes le renvoient. */
  round?: number
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
  /** La photo a été observée puis retirée : à répondre de mémoire. */
  photoGone?: boolean
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

/**
 * La question à laquelle s'adresse une réponse : son numéro, et son tour.
 *
 * Sans elle, une réponse tapée sur la question 1 et retenue par une coupure
 * s'inscrivait sur la question 2, que l'invité n'avait jamais vue — chrono
 * compté depuis le début de la 2, et parfois « le plus rapide ». Le serveur la
 * refuse maintenant comme « trop tard ».
 *
 * Facultative : un téléphone resté sur une page d'avant ne l'envoie pas, et
 * garde l'ancien comportement.
 */
export interface QuestionVisee {
  qIndex?: number
  round?: number
}

/**
 * Le moment qu'une commande de l'animateur visait : la question, et la phase
 * qu'il avait sous les yeux.
 *
 * « Suivant » se lisait selon la phase COURANTE : un « Révéler » arrivé juste
 * après la révélation automatique devenait « Question suivante », et la salle
 * ne voyait ni la bonne réponse ni le classement. Une commande qui ne vise
 * plus le moment présent — double clic, deux écrans, enchaînement automatique
 * qui croise le clic — est ignorée sans un mot : c'est un doublon, pas un ordre.
 */
export interface Visee extends QuestionVisee {
  phase?: QuizPhase
}

export type QuizAction =
  | ({ type: 'answer'; choice: number } & QuestionVisee)
  | ({ type: 'guess'; value: number } & QuestionVisee)

export type QuizCommand =
  /** `multiplier` : 1 par défaut, 2 ou 3 pour un quiz qui compte double ou triple. */
  | { type: 'selectPack'; packId: string; multiplier?: number }
  | ({ type: 'next' } & Visee)
  /** Fige le chronomètre (discours, gâteau qui arrive…) et le repart. */
  | { type: 'pause' }
  | { type: 'resume' }
  /** Retire les points de la question révélée — quand la réponse était fausse. */
  | ({ type: 'cancel' } & Visee)
  /** Annule et repose la même question. */
  | ({ type: 'replay' } & Visee)
  /** Enchaîne les questions tout seul après N secondes ; null = manuel. */
  | { type: 'autoNext'; seconds: number | null }
