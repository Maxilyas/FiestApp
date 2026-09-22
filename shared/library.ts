// La bibliothèque de quiz : ce qu'on édite dans le navigateur et qu'on stocke
// en base. Distinct des vues de jeu (shared/games/quiz.ts), qui sont ce que
// les téléphones reçoivent pendant une partie.
import { tronquer } from './avatars'

export const MIN_ANSWERS = 2
export const MAX_ANSWERS = 4
export const MIN_DURATION = 5
export const MAX_DURATION = 120
export const DEFAULT_DURATION = 20

/** Temps d'observation d'une photo avant qu'elle disparaisse. */
export const MIN_OBSERVE = 2
export const MAX_OBSERVE = 30
export const DEFAULT_OBSERVE = 5

/**
 * 'choice' : QCM classique (2 à 4 réponses, une bonne).
 * 'number' : estimation chiffrée — le plus proche marque le plus de points,
 *            et personne ne reste bloqué faute de connaître la réponse.
 */
export type QuestionKind = 'choice' | 'number'

/**
 * Une question telle qu'elle est éditée : elle peut être un brouillon
 * incomplet (texte vide, réponses manquantes). On ne perd jamais la saisie
 * d'Antoine — c'est au lancement du quiz qu'on ne garde que le jouable.
 */
export interface QuizQuestionDef {
  /**
   * Identifiant stable, propre à l'éditeur : React s'en sert pour suivre une
   * carte quand on réordonne ou supprime. Sans lui, l'aperçu ouvert ou l'erreur
   * de photo d'une question glissaient sur sa voisine. Absent des quiz écrits
   * avant : le serveur en attribue un au chargement.
   */
  id?: string
  kind: QuestionKind
  text: string
  /** QCM : toujours MAX_ANSWERS cases dans l'éditeur, les vides sont ignorées. */
  answers: string[]
  /** QCM : index de la bonne réponse dans `answers`, à partir de 0. */
  correct: number
  /** Estimation : la bonne valeur. */
  target: number | null
  /** Estimation : unité affichée (« ans », « km », « € »…). */
  unit: string
  /** Secondes laissées aux joueurs. */
  duration: number
  /** URL de l'image servie par le serveur, ou null. */
  image: string | null
  /**
   * Photo « mémoire » : nombre de secondes pendant lesquelles la photo est
   * montrée seule, avant de disparaître et de laisser place à la question.
   * `null` (le cas courant) = la photo reste affichée pendant la question.
   */
  observeSeconds: number | null
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
export type PlayableQuestion =
  | {
      kind: 'choice'
      text: string
      answers: string[]
      correct: number
      duration: number
      image: string | null
      observeSeconds: number | null
    }
  | {
      kind: 'number'
      text: string
      target: number
      unit: string
      duration: number
      image: string | null
      observeSeconds: number | null
    }

/**
 * Identifiant de question. `crypto.randomUUID` n'existe que dans un contexte
 * sécurisé : sur le wifi de repli, l'éditeur est ouvert en http, il faut donc
 * un secours qui marche partout.
 */
export function newQuestionId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c?.randomUUID) return c.randomUUID()
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function emptyQuestion(): QuizQuestionDef {
  return {
    id: newQuestionId(),
    kind: 'choice',
    text: '',
    answers: ['', '', '', ''],
    correct: 0,
    target: null,
    unit: '',
    duration: DEFAULT_DURATION,
    image: null,
    observeSeconds: null,
  }
}

/**
 * Copie d'une question, avec un identifiant à elle : l'éditeur suit chaque
 * carte par cet identifiant, deux cartes ne peuvent donc pas le partager.
 */
export function cloneQuestion(q: QuizQuestionDef, id = newQuestionId()): QuizQuestionDef {
  return { ...q, id, answers: [...q.answers] }
}

// ── Réordonner ───────────────────────────────────────────────────────────
//
// Les numéros sont ceux que l'éditeur affiche, à partir de 1, brouillons
// compris. Les deux fonctions bornent ce qu'on leur donne — un numéro trop
// grand veut dire « à la fin », trop petit « en tête » — et rendent le tableau
// tel quel quand rien ne change : l'éditeur s'en sert pour ne pas marquer le
// quiz « à enregistrer » pour rien.

/**
 * Déplace la question en place `from` (index) pour qu'elle porte le numéro
 * demandé. Retirée puis réinsérée, elle porte exactement ce numéro à
 * l'arrivée, qu'elle monte ou qu'elle descende — c'est la seule règle qui ne
 * surprend jamais : « la 3 en 45 », et elle est la 45.
 */
export function moveQuestion<T>(questions: T[], from: number, number: number): T[] {
  if (from < 0 || from >= questions.length || !Number.isFinite(number)) return questions
  const to = Math.min(questions.length, Math.max(1, Math.trunc(number))) - 1
  if (to === from) return questions
  const next = [...questions]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Insère des questions de façon que la première porte le numéro demandé ; les suivantes se décalent. */
export function insertQuestions<T>(questions: T[], number: number, items: T[]): T[] {
  if (items.length === 0) return questions
  const at = Number.isFinite(number)
    ? Math.min(questions.length, Math.max(0, Math.trunc(number) - 1))
    : questions.length
  return [...questions.slice(0, at), ...items, ...questions.slice(at)]
}

/**
 * Convertit une question éditée en question jouable, ou null si elle n'est pas
 * prête. Pour un QCM, retirer les réponses vides décale les index : on retrouve
 * la bonne réponse par sa position d'origine, jamais par son numéro final.
 */
export function toPlayable(q: QuizQuestionDef): PlayableQuestion | null {
  const text = (q.text ?? '').trim()
  if (!text) return null
  const duration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, Number(q.duration) || DEFAULT_DURATION))
  const image = q.image ?? null
  // Un temps d'observation sans photo à observer n'a aucun sens : on l'ignore
  // plutôt que de faire patienter la salle devant un carré vide.
  // `Number(null)` vaut 0, pas NaN : sans ce test explicite, une photo sans
  // observation se verrait attribuer le minimum et disparaîtrait toute seule.
  const observeSeconds =
    image && typeof q.observeSeconds === 'number' && Number.isFinite(q.observeSeconds)
      ? Math.min(MAX_OBSERVE, Math.max(MIN_OBSERVE, Math.round(q.observeSeconds)))
      : null

  if (q.kind === 'number') {
    if (typeof q.target !== 'number' || !Number.isFinite(q.target)) return null
    return {
      kind: 'number',
      text,
      target: q.target,
      unit: (q.unit ?? '').trim().slice(0, 12),
      duration,
      image,
      observeSeconds,
    }
  }

  const kept = (q.answers ?? [])
    .map((a, i) => ({ text: (a ?? '').trim(), index: i }))
    .filter(a => a.text.length > 0)
    .slice(0, MAX_ANSWERS)
  if (kept.length < MIN_ANSWERS) return null
  const correct = kept.findIndex(a => a.index === q.correct)
  if (correct < 0) return null // la bonne réponse pointe une case vide
  return { kind: 'choice', text, answers: kept.map(a => a.text), correct, duration, image, observeSeconds }
}

/** Ce qui manque à une question pour être jouable — message affiché dans l'éditeur. */
export function questionProblem(q: QuizQuestionDef): string | null {
  if (!(q.text ?? '').trim()) return 'Il manque l’intitulé de la question'
  if (q.kind === 'number') {
    if (typeof q.target !== 'number' || !Number.isFinite(q.target)) {
      return 'Il manque la bonne réponse (un nombre)'
    }
    return null
  }
  const filled = (q.answers ?? []).filter(a => (a ?? '').trim().length > 0)
  if (filled.length < MIN_ANSWERS) return `Il faut au moins ${MIN_ANSWERS} réponses`
  if (!((q.answers ?? [])[q.correct] ?? '').trim()) return 'La bonne réponse désignée est vide'
  return null
}

export function playableQuestions(quiz: QuizDef): PlayableQuestion[] {
  return quiz.questions.map(toPlayable).filter((q): q is PlayableQuestion => q !== null)
}

/** Résultat d'un import en masse : ce qui est entré, et ce qui mérite un œil. */
export interface ImportResult {
  questions: QuizQuestionDef[]
  /** Questions sans bonne réponse marquée d'une étoile : à vérifier. */
  unmarked: number
  /** Blocs ignorés faute de contenu exploitable. */
  ignored: number
}

/** Une ligne vide sépare deux questions ; chaque ligne porte un élément. */
const SEPARATEUR_BLOCS = /\r?\n\s*\r?\n/
const SEPARATEUR_LIGNES = /\r?\n/

/**
 * « = 10 935 mètres » : le nombre, puis l'unité éventuelle.
 *
 * Le nombre s'écrit comme on l'écrit en France : virgule décimale (le point
 * passe aussi), milliers séparés par une espace — simple, insécable, ou fine,
 * celle que les traitements de texte glissent d'office — ou par une
 * apostrophe à la suisse, et signe moins typographique « − », qu'ils
 * substituent au tiret. L'ancien lecteur s'arrêtait au premier groupe de
 * chiffres : « = 10 935 mètres » visait 10, avec « 935 mètres » pour unité, et
 * la révélation affichait « 10 935 mètres » — l'air juste — en classant tout
 * le monde sur son écart à 10.
 */
const NOMBRE = /^([+\-\u2212]?)(\d{1,3}(?:[ \u00a0\u202f'\u2019]\d{3})+|\d+)(?:[.,](\d+))?\s*(.*)$/u

/**
 * Ce qui suit le nombre repart sur un chiffre : « = 10 93 mètres »,
 * « = 1,000,000 ». On ne sait pas lire ; on ne devine pas. Le bloc est compté
 * parmi les ignorés, que l'aperçu signale, plutôt que mal lu en silence.
 */
const SUITE_AMBIGUE = /^[.,'\u2019]?\d/

/** La cible et l'unité d'une ligne « = … », ou null si elle ne se lit pas sans ambiguïté. */
function lireEstimation(texte: string): { target: number; unit: string } | null {
  const m = NOMBRE.exec(texte)
  if (!m) return null
  const [, signe, entier, decimales, reste] = m
  if (SUITE_AMBIGUE.test(reste)) return null
  const negatif = signe === '-' || signe === '\u2212'
  const target = Number(`${negatif ? '-' : ''}${entier.replace(/\D/g, '')}${decimales ? `.${decimales}` : ''}`)
  if (!Number.isFinite(target)) return null
  return { target, unit: tronquer(reste.trim(), 12) }
}

/**
 * Analyse un bloc de texte collé dans l'éditeur. Saisir cinquante questions
 * une par une est long ; les taper dans un carnet puis coller l'ensemble
 * l'est beaucoup moins.
 *
 *   Quelle danse Romane préfère-t-elle ?
 *   * La salsa
 *   Le tango
 *   La bachata
 *
 *   Combien de cours a-t-elle pris cette année ?
 *   = 42 cours
 *
 * Une ligne vide sépare deux questions. L'étoile marque la bonne réponse ;
 * le signe égal transforme la question en estimation chiffrée.
 */
export function parseImportedQuestions(text: string): ImportResult {
  const blocks = text.split(SEPARATEUR_BLOCS)
  const questions: QuizQuestionDef[] = []
  let unmarked = 0
  let ignored = 0

  for (const block of blocks) {
    const lines = block
      .split(SEPARATEUR_LIGNES)
      .map(l => l.trim())
      .filter(l => l.length > 0)
    if (lines.length < 2) {
      if (lines.length === 1) ignored++
      continue
    }

    const question = emptyQuestion()
    // Coupé par caractère, jamais au milieu d'un emoji.
    question.text = tronquer(lines[0], 300)
    const rest = lines.slice(1)

    const numberLine = rest.find(l => l.startsWith('='))
    if (numberLine) {
      const lue = lireEstimation(numberLine.slice(1).trim())
      if (!lue) {
        ignored++
        continue
      }
      question.kind = 'number'
      question.target = lue.target
      question.unit = lue.unit
      questions.push(question)
      continue
    }

    let correct = -1
    const answers: string[] = []
    for (const line of rest) {
      const marked = line.startsWith('*') || line.startsWith('✓')
      const answer = (marked ? line.slice(1) : line).trim()
      if (!answer || answers.length >= MAX_ANSWERS) continue
      if (marked && correct < 0) correct = answers.length
      answers.push(tronquer(answer, 120))
    }
    if (answers.length < MIN_ANSWERS) {
      ignored++
      continue
    }
    // Sans étoile, on garde la première réponse mais on le signale : mieux
    // vaut une alerte qu'un quiz faux découvert devant cinquante personnes.
    if (correct < 0) {
      correct = 0
      unmarked++
    }
    question.correct = correct
    for (let i = 0; i < MAX_ANSWERS; i++) question.answers[i] = answers[i] ?? ''
    questions.push(question)
  }

  return { questions, unmarked, ignored }
}
