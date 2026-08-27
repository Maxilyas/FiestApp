// La bibliothèque de quiz : ce qu'on édite dans le navigateur et qu'on stocke
// en base. Distinct des vues de jeu (shared/games/quiz.ts), qui sont ce que
// les téléphones reçoivent pendant une partie.

export const MIN_ANSWERS = 2
export const MAX_ANSWERS = 4
export const MIN_DURATION = 5
export const MAX_DURATION = 120
export const DEFAULT_DURATION = 20

/**
 * Une question telle qu'elle est éditée : elle peut être un brouillon
 * incomplet (texte vide, réponses manquantes). On ne perd jamais la saisie
 * d'Antoine — c'est au lancement du quiz qu'on ne garde que le jouable.
 */
export interface QuizQuestionDef {
  text: string
  /** Toujours MAX_ANSWERS cases dans l'éditeur ; les vides sont ignorées en jeu. */
  answers: string[]
  /** Index de la bonne réponse dans `answers`, à partir de 0. */
  correct: number
  /** Secondes laissées aux joueurs. */
  duration: number
  /** URL de l'image servie par le serveur, ou null. */
  image: string | null
}

export interface QuizDef {
  id: string
  title: string
  questions: QuizQuestionDef[]
  updatedAt: number
}

/** Ligne de la liste des quiz (sans les questions). */
export interface QuizSummary {
  id: string
  title: string
  /** Nombre de questions saisies, brouillons compris. */
  questionCount: number
  /** Nombre de questions réellement jouables. */
  readyCount: number
  updatedAt: number
}

/** Une question prête à être jouée : réponses vides retirées, index recalés. */
export interface PlayableQuestion {
  text: string
  answers: string[]
  correct: number
  duration: number
  image: string | null
}

export function emptyQuestion(): QuizQuestionDef {
  return { text: '', answers: ['', '', '', ''], correct: 0, duration: DEFAULT_DURATION, image: null }
}

/**
 * Convertit une question éditée en question jouable, ou null si elle n'est pas
 * prête. Retirer les réponses vides décale les index : on retrouve la bonne
 * réponse par sa position d'origine, jamais par son numéro final.
 */
export function toPlayable(q: QuizQuestionDef): PlayableQuestion | null {
  const text = (q.text ?? '').trim()
  if (!text) return null
  const kept = (q.answers ?? [])
    .map((a, i) => ({ text: (a ?? '').trim(), index: i }))
    .filter(a => a.text.length > 0)
    .slice(0, MAX_ANSWERS)
  if (kept.length < MIN_ANSWERS) return null
  const correct = kept.findIndex(a => a.index === q.correct)
  if (correct < 0) return null // la bonne réponse pointe une case vide
  const duration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, Number(q.duration) || DEFAULT_DURATION))
  return { text, answers: kept.map(a => a.text), correct, duration, image: q.image ?? null }
}

/** Ce qui manque à une question pour être jouable — message affiché dans l'éditeur. */
export function questionProblem(q: QuizQuestionDef): string | null {
  if (!(q.text ?? '').trim()) return 'Il manque l’intitulé de la question'
  const filled = (q.answers ?? []).filter(a => (a ?? '').trim().length > 0)
  if (filled.length < MIN_ANSWERS) return `Il faut au moins ${MIN_ANSWERS} réponses`
  if (!((q.answers ?? [])[q.correct] ?? '').trim()) return 'La bonne réponse désignée est vide'
  return null
}

export function playableQuestions(quiz: QuizDef): PlayableQuestion[] {
  return quiz.questions.map(toPlayable).filter((q): q is PlayableQuestion => q !== null)
}
