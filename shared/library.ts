// La bibliothèque de quiz : ce qu'on édite dans le navigateur et qu'on stocke
// en base. Distinct des vues de jeu (shared/games/quiz.ts), qui sont ce que
// les téléphones reçoivent pendant une partie.
import { categorieDe } from './categories'
import { tronquer } from './avatars'
import { lireNombreEnTete } from './nombres'

export const MIN_ANSWERS = 2
export const MAX_ANSWERS = 4
export const MIN_DURATION = 5
export const MAX_DURATION = 120
export const DEFAULT_DURATION = 20

/**
 * Les bornes d'un quiz, en caractères et en questions : l'éditeur, la liste
 * collée et le serveur les appliquent, et le format qu'on donne à écrire
 * (`shared/liste.ts`) les annonce — il ne peut pas en promettre d'autres.
 */
export const MAX_TEXT = 300
export const MAX_ANSWER_TEXT = 120
export const MAX_UNIT = 12
export const MAX_QUESTIONS = 100
/** Le nom ou la description d'une photo annoncée, le temps qu'elle arrive. */
export const MAX_PHOTO_ATTENDUE = 200

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
  /**
   * Sa catégorie, prise dans la liste fixe (`shared/categories.ts`), ou null.
   * Absente des quiz écrits avant les catégories.
   */
  category?: string | null
  /**
   * La photo qu'une liste collée annonçait (« Photo : tour-eiffel.jpg ») et
   * qui n'est pas encore jointe : son nom de fichier, ou ce qu'elle montre.
   * Une liste écrite par un ami ou par une IA arrive sans ses photos : sans
   * cette note, on ne savait plus laquelle allait à quelle question. Tant
   * qu'elle attend, la question ne se joue pas — « Quel est ce monument ? »
   * sans son monument. La photo jointe l'efface. Absente des quiz d'avant.
   */
  photoAttendue?: string | null
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
      category?: string | null
    }
  | {
      kind: 'number'
      text: string
      target: number
      unit: string
      duration: number
      image: string | null
      observeSeconds: number | null
      category?: string | null
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

/**
 * Une question vierge. Donnée, `modele` — sa voisine — lui prête son temps et
 * sa catégorie : un quiz se règle d'un bloc, 45 s partout, une manche de
 * cinéma. Repartir à 20 s sans catégorie à chaque ajout, c'était corriger
 * les deux, une question après l'autre, sur tout le quiz. Le reste — type,
 * réponses, photo — est propre à chaque question et ne se reprend pas ;
 * c'est le rôle de la duplication.
 */
export function emptyQuestion(modele?: QuizQuestionDef | null): QuizQuestionDef {
  const temps = Number(modele?.duration)
  return {
    id: newQuestionId(),
    kind: 'choice',
    text: '',
    answers: ['', '', '', ''],
    correct: 0,
    target: null,
    unit: '',
    // Un temps tapé hors bornes (le champ l'accepte, la partie le recale) ne
    // se propage pas : la voisine le garde, la nouvelle repart d'un temps sûr.
    duration:
      Number.isFinite(temps) && temps >= MIN_DURATION && temps <= MAX_DURATION ? Math.round(temps) : DEFAULT_DURATION,
    image: null,
    observeSeconds: null,
    category: categorieDe(modele?.category),
    photoAttendue: null,
  }
}

/**
 * La voisine dont une question neuve, arrivant au numéro `number`, reprend
 * les réglages : celle qui la précédera — c'est elle qu'on vient de régler —,
 * ou, arrivée en tête, celle qui la suivra. Le numéro se borne comme dans
 * `insertQuestions`.
 */
export function voisineDe<T>(questions: T[], number: number): T | undefined {
  const at = Number.isFinite(number)
    ? Math.min(questions.length, Math.max(0, Math.trunc(number) - 1))
    : questions.length
  return questions[at - 1] ?? questions[at]
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
 * Les secondes pendant lesquelles la photo passe seule, telles que la partie
 * les jouera, ou null si elle reste affichée. L'aperçu de l'éditeur les lit
 * ici, même sur un brouillon : il joue la même observation que la salle.
 */
export function tempsDObservation(q: QuizQuestionDef): number | null {
  // Un temps d'observation sans photo à observer n'a aucun sens : on l'ignore
  // plutôt que de faire patienter la salle devant un carré vide.
  // `Number(null)` vaut 0, pas NaN : sans ce test explicite, une photo sans
  // observation se verrait attribuer le minimum et disparaîtrait toute seule.
  return q.image && typeof q.observeSeconds === 'number' && Number.isFinite(q.observeSeconds)
    ? Math.min(MAX_OBSERVE, Math.max(MIN_OBSERVE, Math.round(q.observeSeconds)))
    : null
}

/** La photo que la question attend encore — annoncée, pas jointe —, ou null. */
export function photoManquante(q: Pick<QuizQuestionDef, 'image' | 'photoAttendue'>): string | null {
  const note = typeof q.photoAttendue === 'string' ? q.photoAttendue.trim() : ''
  return note && !q.image ? note : null
}

/**
 * Convertit une question éditée en question jouable, ou null si elle n'est pas
 * prête. Pour un QCM, retirer les réponses vides décale les index : on retrouve
 * la bonne réponse par sa position d'origine, jamais par son numéro final.
 */
export function toPlayable(q: QuizQuestionDef): PlayableQuestion | null {
  const text = (q.text ?? '').trim()
  if (!text) return null
  if (photoManquante(q)) return null
  const duration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, Number(q.duration) || DEFAULT_DURATION))
  const image = q.image ?? null
  const observeSeconds = tempsDObservation(q)
  const category = categorieDe(q.category)

  if (q.kind === 'number') {
    if (typeof q.target !== 'number' || !Number.isFinite(q.target)) return null
    return {
      kind: 'number',
      text,
      target: q.target,
      // Coupée par caractère, comme à l'import : « parts de 🍕🍕🍕🍕 » coupé
      // en unités UTF-16 gardait une moitié de pizza, affichée « � » sur le
      // mur à côté de la bonne réponse.
      unit: tronquer((q.unit ?? '').trim(), MAX_UNIT),
      duration,
      image,
      observeSeconds,
      category,
    }
  }

  const kept = (q.answers ?? [])
    .map((a, i) => ({ text: (a ?? '').trim(), index: i }))
    .filter(a => a.text.length > 0)
    .slice(0, MAX_ANSWERS)
  if (kept.length < MIN_ANSWERS) return null
  const correct = kept.findIndex(a => a.index === q.correct)
  if (correct < 0) return null // la bonne réponse pointe une case vide
  return { kind: 'choice', text, answers: kept.map(a => a.text), correct, duration, image, observeSeconds, category }
}

/** Ce qui manque à une question pour être jouable — message affiché dans l'éditeur. */
export function questionProblem(q: QuizQuestionDef): string | null {
  if (!(q.text ?? '').trim()) return 'Il manque l’intitulé de la question'
  if (q.kind === 'number') {
    if (typeof q.target !== 'number' || !Number.isFinite(q.target)) {
      return 'Il manque la bonne réponse (un nombre)'
    }
  } else {
    const filled = (q.answers ?? []).filter(a => (a ?? '').trim().length > 0)
    if (filled.length < MIN_ANSWERS) return `Il faut au moins ${MIN_ANSWERS} réponses`
    if (!((q.answers ?? [])[q.correct] ?? '').trim()) return 'La bonne réponse désignée est vide'
  }
  const photo = photoManquante(q)
  return photo ? `Il manque la photo « ${photo} »` : null
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
 * Les clôtures d'un bloc de code (« ``` », « ```text ») : une IA y range
 * volontiers sa réponse, et le bouton qui copie sa réponse les emporte. Lue
 * comme le reste, la première devenait l'intitulé de la première question.
 */
const CLOTURE = /^\s*(```|~~~)/

const sansAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/**
 * « = 10 935 mètres » : le nombre, lu comme partout ailleurs (`lireNombreEnTete`),
 * puis l'unité éventuelle. Ce qui ne se lit pas sans ambiguïté — « = 10 93
 * mètres », « = 1,000,000 » — est compté parmi les blocs ignorés, que
 * l'aperçu signale, plutôt que mal lu en silence.
 */
function lireEstimation(texte: string): { target: number; unit: string } | null {
  const lu = lireNombreEnTete(texte)
  return lu && { target: lu.valeur, unit: tronquer(lu.reste.trim(), MAX_UNIT) }
}

/**
 * Les réglages d'une question, chacun sur sa ligne sous l'intitulé —
 * « Temps : 30 s », « Photo : tour-eiffel.jpg », « Observation : 5 s » —,
 * reconnus à leur mot, sans accent ni majuscule. Jamais en tête du bloc : la
 * première ligne reste l'intitulé, fût-ce « Photo : qui est-ce ? ».
 */
type Reglage = 'temps' | 'photo' | 'observation'
const REGLAGES = new Map<string, Reglage>([
  ['temps', 'temps'],
  ['duree', 'temps'],
  ['photo', 'photo'],
  ['image', 'photo'],
  ['observation', 'observation'],
  ['memoire', 'observation'],
])

function lireReglage(ligne: string): { reglage: Reglage; valeur: string } | null {
  const deuxPoints = ligne.indexOf(':')
  if (deuxPoints < 0) return null
  // `trim` retire aussi l'insécable qu'un traitement de texte glisse avant
  // les deux-points.
  const reglage = REGLAGES.get(sansAccents(ligne.slice(0, deuxPoints)).trim().toLowerCase())
  return reglage ? { reglage, valeur: ligne.slice(deuxPoints + 1).trim() } : null
}

/**
 * Des secondes, écrites comme on les écrit : « 30 », « 30 s », « 45
 * secondes », « 1 min ». Null si ça ne se lit pas, ou si ça ne dure rien.
 */
function lireSecondes(texte: string): number | null {
  const lu = lireNombreEnTete(texte)
  if (!lu || !(lu.valeur > 0)) return null
  const unite = sansAccents(lu.reste).toLowerCase().replace(/\.$/, '').trim()
  if (/^(s|sec|secondes?)?$/.test(unite)) return lu.valeur
  if (/^(mn|min|minutes?)$/.test(unite)) return lu.valeur * 60
  return null
}

/** « Photo : aucune » : une ligne remplie pour la forme, sans photo derrière. */
const SANS_PHOTO = /^(aucune?|non|sans|rien|pas de photo|[-–—/])$/

const borner = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)))

/**
 * Analyse un bloc de texte collé dans l'éditeur. Saisir cinquante questions
 * une par une est long ; les taper dans un carnet puis coller l'ensemble
 * l'est beaucoup moins — ou les faire écrire à quelqu'un d'autre, à qui l'on
 * donne le format complet (`shared/liste.ts`).
 *
 *   Quelle est la capitale de l'Australie ?
 *   Sydney
 *   * Canberra
 *   Melbourne
 *
 *   Quel est ce monument ?
 *   Photo : tour-eiffel.jpg
 *   Temps : 30 s
 *   * La tour Eiffel
 *   Big Ben
 *
 *   Combien de pays composent l'Union européenne ?
 *   = 42 cours
 *
 * Une ligne vide sépare deux questions. L'étoile marque la bonne réponse ;
 * le signe égal transforme la question en estimation chiffrée. Sous
 * l'intitulé, « Temps », « Photo » et « Observation » règlent la question.
 * `modele`, la voisine de l'endroit où la liste arrive, lui prête son temps
 * et sa catégorie (voir emptyQuestion).
 */
export function parseImportedQuestions(text: string, modele?: QuizQuestionDef | null): ImportResult {
  // Une clôture devient une ligne vide : elle sépare, elle ne se lit pas.
  const blocks = text
    .split(SEPARATEUR_LIGNES)
    .map(l => (CLOTURE.test(l) ? '' : l))
    .join('\n')
    .split(SEPARATEUR_BLOCS)
  const questions: QuizQuestionDef[] = []
  let unmarked = 0
  let ignored = 0

  // La catégorie en cours : une ligne « # Cinéma » range les questions qui
  // suivent, jusqu'à la prochaine. « # » tout seul les laisse sans catégorie.
  // Collé au dièse, seul un nom de la liste en est une : « #1 des ventes en
  // 1985 ? » est une question, qu'on aurait prise pour une catégorie inconnue.
  const estCategorie = (l: string) => /^#(\s|$)/.test(l) || (l.startsWith('#') && categorieDe(l.slice(1)) !== null)
  // Sans dièse, la liste collée reprend la catégorie de sa voisine, comme une
  // question ajoutée à la main (voir emptyQuestion) ; « # » seul l'efface.
  let categorie: string | null = categorieDe(modele?.category)
  for (const block of blocks) {
    const lines = block
      .split(SEPARATEUR_LIGNES)
      .map(l => l.trim())
      .filter(l => l.length > 0)
    while (lines.length > 0 && estCategorie(lines[0])) {
      const nom = lines.shift()!.slice(1).trim()
      categorie = nom ? categorieDe(nom) : null
      // Une catégorie qu'on ne connaît pas se signale, comme un bloc illisible.
      if (nom && !categorie) ignored++
    }
    if (lines.length < 2) {
      if (lines.length === 1) ignored++
      continue
    }

    const question = emptyQuestion(modele)
    question.category = categorie
    // Coupé par caractère, jamais au milieu d'un emoji.
    question.text = tronquer(lines[0], MAX_TEXT)

    // Les réglages d'abord, où qu'ils soient sous l'intitulé : ce qui reste
    // est la réponse — le « = » d'une estimation, ou les choix d'un QCM.
    const rest: string[] = []
    let observation: number | null = null
    for (const line of lines.slice(1)) {
      const lu = lireReglage(line)
      if (!lu) {
        rest.push(line)
      } else if (lu.reglage === 'temps') {
        // Illisible, le temps reste celui de la voisine : il se corrige sur
        // la carte, et ne vaut pas qu'on perde la question.
        const secondes = lireSecondes(lu.valeur)
        if (secondes !== null) question.duration = borner(secondes, MIN_DURATION, MAX_DURATION)
      } else if (lu.reglage === 'photo') {
        const photo = tronquer(lu.valeur, MAX_PHOTO_ATTENDUE).trim()
        question.photoAttendue = photo && !SANS_PHOTO.test(sansAccents(photo).toLowerCase()) ? photo : null
      } else {
        // Illisible — « Observation : aucune » —, la photo reste affichée :
        // une photo qui disparaît sans qu'on l'ait voulu gâche la question.
        const secondes = lireSecondes(lu.valeur)
        observation = secondes === null ? null : borner(secondes, MIN_OBSERVE, MAX_OBSERVE)
      }
    }
    // Sans photo, rien à observer (voir tempsDObservation).
    question.observeSeconds = question.photoAttendue ? observation : null

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
      answers.push(tronquer(answer, MAX_ANSWER_TEXT))
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
