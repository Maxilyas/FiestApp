// L'historique des soirées.
//
// Une soirée archivée est une copie complète de ce qui s'est joué : les
// invités, les équipes, les points, les prix remis, le journal des réponses
// et les quiz tels qu'ils ont été posés. Les pages souvenir, statistiques et
// bilan se relisent dessus des années plus tard, même si la bibliothèque de
// quiz a changé entre-temps — et la soirée suivante peut repartir de zéro
// sans rien effacer.
import type { PlayableQuestion, QuestionKind } from './library'
import type { PublicSpace } from './space'
import type { TeamBonus } from './types'

export interface ArchivedPlayer {
  id: string
  name: string
  avatar: string
  teamId: string | null
  /** Son profil de joueur récurrent, s'il en avait un ce soir-là. */
  profileId?: string | null
  createdAt: number
}

export interface ArchivedTeam {
  id: string
  name: string
  emoji: string
  position: number
  createdAt: number
}

/** Une ligne du classement : un gain (ou un retrait), sa raison, sa partie. */
export interface ArchivedScore {
  playerId: string
  sessionId: string | null
  points: number
  reason: string
  createdAt: number
}

/** Une ligne du journal des réponses — la même que sur le serveur. */
export interface ArchivedAnswer {
  sessionId: string
  quizTitle: string
  qIndex: number
  kind: QuestionKind
  playerId: string
  answered: boolean
  correct: boolean | null
  choice: number | null
  value: number | null
  target: number | null
  ms: number | null
  changes: number
  points: number
  durationMs: number
  observed: boolean
  /** La catégorie de la question, si elle en portait une. Absente des archives d'avant. */
  category?: string | null
  createdAt: number
}

/** Un quiz tel qu'il a été joué dans une partie. */
export interface ArchivedPack {
  title: string
  questions: PlayableQuestion[]
  /**
   * Copie exacte gardée par le moteur, ou reconstituée depuis la bibliothèque
   * au moment de l'archivage — auquel cas le bilan vérifie encore qu'elle
   * colle au journal.
   */
  exact: boolean
}

export interface PartyArchive {
  version: 1
  players: ArchivedPlayer[]
  teams: ArchivedTeam[]
  bonuses: TeamBonus[]
  scores: ArchivedScore[]
  answers: ArchivedAnswer[]
  /** Par identifiant de partie. */
  packs: Record<string, ArchivedPack>
}

/**
 * Une soirée dans la liste de l'historique — ce qu'on lit sans ouvrir
 * l'archive. Dérivé à chaque lecture, comme le souvenir : les prénoms portent
 * leur marque d'homonymie, et les vainqueurs suivent la règle du jour.
 */
export interface ArchiveSummary {
  id: string
  title: string
  /** Le début de la soirée : l'arrivée du premier invité. */
  heldAt: number
  archivedAt: number
  players: number
  quizzes: number
  questions: number
  /** Les vainqueurs de la soirée : plusieurs s'ils finissent ex æquo, aucun si personne n'a marqué. */
  winners: { name: string; avatar: string; points: number }[]
  /** Les équipes qui remportent le quiz, prix compris — la règle de l'écran de victoire. */
  teamWinners: { name: string; emoji: string; points: number }[]
}

export interface ArchiveList {
  /**
   * La soirée en cours, s'il s'y est déjà passé quelque chose. Elle se range
   * toute seule dans l'historique après chaque quiz : `title` est le titre
   * sous lequel elle y est déjà, `id` son identifiant — absents tant qu'aucun
   * quiz n'est fini.
   */
  current: {
    players: number
    quizzes: number
    questions: number
    since: number | null
    id?: string
    title?: string
  } | null
  /** De la plus récente à la plus ancienne. */
  archives: ArchiveSummary[]
  /** L'espace dont c'est l'historique. */
  space?: PublicSpace
}

/** « 14 mars 2027 » */
export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
