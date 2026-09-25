// La bibliothèque de quiz : ce qu'on édite dans le navigateur et qu'on stocke
// en base. Distinct des vues de jeu (shared/games/quiz.ts), qui sont ce que
// les téléphones reçoivent pendant une partie.
import { categorieDe } from './categories'
import { tronquer } from './avatars'
import { lireNombreEnTete } from './nombres'
import type { ReglagesDuQuiz } from './hasard'

export const MIN_ANSWERS = 2
export const MAX_ANSWERS = 4
export const MIN_DURATION = 5
export const MAX_DURATION = 120
export const DEFAULT_DURATION = 20

/**
 * La bonne réponse d'un QCM qui n'en a pas encore. Une liste collée sans
 * étoile prenait la première réponse pour la bonne, et le quiz se disait
 * « prêt » : la salle le découvrait à la révélation. Rien de coché, plutôt.
 */
export const SANS_BONNE_REPONSE = -1

/**
 * Les bornes d'un quiz, en caractères et en questions : l'éditeur, la liste
 * collée et le serveur les appliquent, et le format qu'on donne à écrire
 * (`shared/liste.ts`) les annonce — il ne peut pas en promettre d'autres.
 */
export const MAX_TEXT = 300
/** Le titre d'un quiz : il s'affiche dans le bandeau de l'écran commun. */
export const MAX_TITRE = 80
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
  /**
   * QCM : index de la bonne réponse dans `answers`, à partir de 0 — ou
   * `SANS_BONNE_REPONSE` quand une liste collée n'en désignait aucune : la
   * question attend qu'on la choisisse sur sa carte, et ne se joue pas d'ici là.
   */
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
  /**
   * QCM : les réponses gardent l'ordre écrit, même quand le quiz les mélange
   * à chaque partie — « Aucune de ces réponses » reste la dernière. Absent
   * (le cas courant) : elles suivent le réglage du quiz.
   */
  ordreFixe?: boolean
}

export interface QuizDef {
  id: string
  title: string
  questions: QuizQuestionDef[]
  updatedAt: number
  /**
   * Rangé à l'écart : hors de « Mes quiz » et du choix de la soirée, sans
   * disparaître. Null ou absent : dans la bibliothèque.
   */
  archivedAt?: number | null
  /** Ce que le quiz demande au hasard : l'ordre de ses réponses, de ses questions (`shared/hasard.ts`). */
  reglages?: ReglagesDuQuiz
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
  /** Archivé : hors de la liste et du choix de la soirée (voir `QuizDef.archivedAt`). */
  archivedAt?: number | null
  /**
   * Ce qui se dérive des questions, pour trier et filtrer sans rien saisir :
   * une bibliothèque se range toute seule par ce qu'elle contient — les
   * douze catégories fixes valent des étiquettes que personne n'a à poser.
   */
  photos?: number
  estimations?: number
  /** Les catégories présentes, de la plus fréquente à la moins. */
  categories?: string[]
  /** Le temps de jeu estimé, en secondes (`dureeEstimeeS`). */
  dureeS?: number
  /** L'intitulé qui a fait trouver ce quiz à une recherche, s'il ne l'a pas été par son titre. */
  trouve?: string
}

/** Le résumé d'un quiz, tel que « Mes quiz » le liste. */
export function resumerQuiz(quiz: QuizDef): QuizSummary {
  const parCategorie = new Map<string, number>()
  for (const q of quiz.questions) if (q.category) parCategorie.set(q.category, (parCategorie.get(q.category) ?? 0) + 1)
  return {
    id: quiz.id,
    title: quiz.title,
    questionCount: quiz.questions.length,
    readyCount: playableQuestions(quiz).length,
    updatedAt: quiz.updatedAt,
    archivedAt: quiz.archivedAt ?? null,
    // Les photos jointes : une photo seulement annoncée rend la question « à compléter », pas illustrée.
    photos: quiz.questions.filter(q => q.image).length,
    estimations: quiz.questions.filter(q => q.kind === 'number').length,
    categories: [...parCategorie.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).map(([c]) => c),
    dureeS: dureeEstimeeS(quiz.questions),
  }
}

/** Sans accent ni casse, espaces réduits : ce que la recherche compare. */
export function pourChercher(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ce qu'une recherche trouve dans un quiz : `true` pour son titre, l'intitulé
 * de la question qui contient les mots cherchés — dans son texte ou ses
 * réponses —, ou null. « Macarena » trouve le quiz des années 90 qui la
 * cite, sans qu'on ait à se souvenir de son titre. Chaque mot doit y être,
 * dans n'importe quel ordre.
 */
export function rechercherDans(quiz: Pick<QuizDef, 'title' | 'questions'>, recherche: string): true | string | null {
  const mots = pourChercher(recherche).split(' ').filter(Boolean)
  if (mots.length === 0) return true
  const contient = (texte: string) => {
    const t = pourChercher(texte)
    return mots.every(m => t.includes(m))
  }
  if (contient(quiz.title)) return true
  for (const q of quiz.questions) {
    const textes = [q.text, ...(q.kind === 'number' ? [q.unit] : q.answers)].join(' ')
    // Une question sans intitulé trouve son quiz sans rien pouvoir en citer.
    if (contient(textes)) return q.text.trim() || true
  }
  return null
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
      /** Ses réponses ne se mélangent pas (voir `QuizQuestionDef.ordreFixe`). */
      ordreFixe?: true
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

// ── Les trous d'un modèle à personnaliser ────────────────────────────────
//
// Le modèle « Qui connaît le mieux [Prénom] ? » s'ouvrait « 8/8 prêtes » avec
// ses vingt-quatre réponses « Ville A ✏️ » : il se jouait tel quel, et une
// seule réponse oubliée faisait lire « Métier C ✏️ » à toute la salle comme
// bonne réponse. Un crayon ou un prénom à écrire rend la question « à
// personnaliser », comme une photo attendue.

/** Le crayon qu'un modèle pose sur ce qu'on doit remplacer (avec ou sans sélecteur de variante). */
const CRAYON = /✏️?/u
/** Un prénom à écrire : « [Prénom] », « [Prénom 2] ». Les autres crochets — « Je [...] la vie en rose » — ne sont pas des trous. */
export const PRENOM_A_ECRIRE = /\[\s*pr[ée]nom(?:\s*(\d))?\s*\]/giu

/** Ce qui reste à personnaliser dans ces textes, dit comme on le corrige, ou null. */
export function trouDans(...textes: (string | null | undefined)[]): string | null {
  const presents = textes.filter((t): t is string => typeof t === 'string' && t.length > 0)
  const prenom = presents.map(t => t.match(PRENOM_A_ECRIRE)?.[0]).find(Boolean)
  if (prenom) return `Écris le prénom à la place de « ${prenom} »`
  if (presents.some(t => CRAYON.test(t))) return 'Remplace ce qui est marqué ✏️'
  return null
}

/** Le trou d'une question : son intitulé, ses réponses, son unité. */
function trouDeLaQuestion(q: QuizQuestionDef): string | null {
  return trouDans(q.text, ...(q.kind === 'number' ? [q.unit] : (q.answers ?? [])))
}

// ── La durée d'un quiz ───────────────────────────────────────────────────

/**
 * Ce qu'une révélation prend, en moyenne : lire la bonne réponse, commenter,
 * passer à la suite — le palier « 10 s » de l'enchaînement, un peu moins
 * quand on clique.
 */
const REVELATION_S = 8
/** Le compte à rebours du départ, puis le podium. */
const DEPART_ET_PODIUM_S = 3 + 15

/**
 * Le temps qu'un quiz prend à jouer, en secondes : ses questions jouables,
 * leur observation, et une révélation chacune. Combien de manches tiennent
 * entre le dessert et minuit, c'est ce que l'animateur se demande en
 * préparant — et rien ne le lui disait.
 */
export function dureeEstimeeS(questions: readonly QuizQuestionDef[]): number {
  const jouables = questions.map(toPlayable).filter((q): q is PlayableQuestion => q !== null)
  if (jouables.length === 0) return 0
  return jouables.reduce((s, q) => s + q.duration + (q.image && q.observeSeconds ? q.observeSeconds : 0) + REVELATION_S, DEPART_ET_PODIUM_S)
}

/** « ≈ 9 min », « ≈ 1 h 05 », pour une durée en secondes. */
export function ecrireDuree(secondes: number): string {
  const minutes = Math.max(1, Math.round(secondes / 60))
  if (minutes < 60) return `≈ ${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `≈ ${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`
}

// ── Le quiz qu'on ouvre et qu'on quitte sans rien y écrire ───────────────

/** Le titre d'un quiz qu'on vient de créer, avant qu'on le nomme. */
export const TITRE_PAR_DEFAUT = 'Nouveau quiz'

/**
 * Vrai pour un quiz resté tel qu'on l'a créé : aucune question, et le titre
 * par défaut. « Nouveau quiz » puis retour, ou « Coller une liste » puis
 * « Annuler », laissaient chaque fois un « Nouveau quiz · 0 question prête »
 * en tête de la bibliothèque. L'éditeur efface celui qu'il vient de créer,
 * s'il le quitte ainsi — jamais un quiz plus ancien, qu'on a pu garder vide
 * exprès.
 */
export function quizAbandonne(quiz: Pick<QuizDef, 'title' | 'questions'>): boolean {
  const titre = quiz.title.trim()
  return quiz.questions.length === 0 && (titre === '' || titre === TITRE_PAR_DEFAUT)
}

/** Les deux réponses d'un vrai ou faux : un QCM à deux cases, rien de plus pour la partie. */
export const VRAI_FAUX = ['Vrai', 'Faux'] as const

/** Un QCM qui n'a que « Vrai » et « Faux » pour réponses — dans cet ordre ou l'autre. */
export function estVraiFaux(q: Pick<QuizQuestionDef, 'kind' | 'answers'>): boolean {
  if (q.kind !== 'choice') return false
  const remplies = (q.answers ?? []).map(a => (a ?? '').trim().toLowerCase()).filter(Boolean)
  return remplies.length === 2 && remplies.includes('vrai') && remplies.includes('faux')
}

/**
 * La bonne réponse est-elle trop souvent la première ? Une liste se tape la
 * bonne réponse d'abord : 6 QCM sur 9 chez Nadia, et la salle finit par
 * répondre ▲ sans lire. Les vrai ou faux, dont l'ordre est fixé, ne comptent
 * pas. Null quand il n'y a rien à dire.
 */
export function bonneEnPremier(questions: QuizQuestionDef[]): { premiers: number; qcm: number } | null {
  const qcm = questions.filter(q => !estVraiFaux(q)).map(toPlayable).filter(q => q?.kind === 'choice')
  const premiers = qcm.filter(q => q?.kind === 'choice' && q.correct === 0).length
  return qcm.length >= 4 && premiers / qcm.length >= 0.6 ? { premiers, qcm: qcm.length } : null
}

/** Un temps de réponse que la partie jouera tel quel : un entier, dans les bornes. */
export const tempsDansLesBornes = (secondes: unknown): boolean =>
  typeof secondes === 'number' && Number.isFinite(secondes) && secondes >= MIN_DURATION && secondes <= MAX_DURATION

/**
 * Le temps de réponse ou d'observation hors de ses bornes, dit comme on le
 * corrige, ou null. Ramené en silence, « 2045 » (un « 20 » revenu tout seul
 * dans le champ, et le 45 tapé derrière) se jouait en deux minutes, la
 * question comptée « prête » ; arrêté sur le « 4 », en cinq secondes.
 */
function horsBornes(q: QuizQuestionDef): string | null {
  if (!tempsDansLesBornes(q.duration)) return `Le temps de réponse va de ${MIN_DURATION} à ${MAX_DURATION} s`
  // Sans photo, l'observation est ignorée (voir tempsDObservation) : rien à reprocher.
  const obs = q.observeSeconds
  if (q.image && obs !== null && obs !== undefined && !(Number.isFinite(obs) && obs >= MIN_OBSERVE && obs <= MAX_OBSERVE)) {
    return `Le temps d’observation va de ${MIN_OBSERVE} à ${MAX_OBSERVE} s`
  }
  return null
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
  // Un modèle pas encore personnalisé : « Ville A ✏️ » ne part pas au mur.
  if (trouDeLaQuestion(q)) return null
  // Hors bornes, la question attend qu'on la corrige : elle le dit sur sa
  // carte (`questionProblem`), la partie ne la ramène pas en silence.
  if (horsBornes(q)) return null
  const duration = Math.round(q.duration)
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
  return {
    kind: 'choice',
    text,
    answers: kept.map(a => a.text),
    correct,
    duration,
    image,
    observeSeconds,
    category,
    ...(q.ordreFixe === true && { ordreFixe: true as const }),
  }
}

/** Ce qui manque à une question pour être jouable — message affiché dans l'éditeur. */
export function questionProblem(q: QuizQuestionDef): string | null {
  if (!(q.text ?? '').trim()) return 'Il manque l’intitulé de la question'
  const trou = trouDeLaQuestion(q)
  if (trou) return trou
  if (q.kind === 'number') {
    if (typeof q.target !== 'number' || !Number.isFinite(q.target)) {
      return 'Il manque la bonne réponse (un nombre)'
    }
  } else {
    const filled = (q.answers ?? []).filter(a => (a ?? '').trim().length > 0)
    if (filled.length < MIN_ANSWERS) return `Il faut au moins ${MIN_ANSWERS} réponses`
    if (q.correct === SANS_BONNE_REPONSE) return 'Choisis la bonne réponse'
    if (!((q.answers ?? [])[q.correct] ?? '').trim()) return 'La bonne réponse désignée est vide'
  }
  const photo = photoManquante(q)
  if (photo) return `Il manque la photo « ${photo} »`
  return horsBornes(q)
}

export function playableQuestions(quiz: QuizDef): PlayableQuestion[] {
  return quiz.questions.map(toPlayable).filter((q): q is PlayableQuestion => q !== null)
}

// ── Ce qui arrive du navigateur ──────────────────────────────────────────
//
// Le serveur borne ainsi tout ce qu'il enregistre, et l'éditeur un brouillon
// qu'il retrouve dans le navigateur (`shared/brouillon.ts`) : ce qu'on
// reprend est exactement ce qu'« Enregistrer » aurait gardé.

/** Identifiants de question acceptés tels quels — le reste en reçoit un neuf. */
const QUESTION_ID = /^[\w-]{1,48}$/

export function cleanTitle(title: unknown): string {
  const clean = tronquer(String(title ?? '').trim(), MAX_TITRE)
  return clean || 'Quiz sans titre'
}

/**
 * Ce titre, ou le premier « Titre (2) », « Titre (3) »… qu'aucun de ces
 * titres ne porte déjà. Importé deux fois, un quiz faisait deux homonymes,
 * et « Supprimer « Spécial agence » ? » ne disait pas lequel.
 */
export function titreLibre(titre: string, pris: Iterable<string>): string {
  const cle = (t: string) => t.trim().toLowerCase()
  const occupes = new Set(Array.from(pris, cle))
  const propre = cleanTitle(titre)
  if (!occupes.has(cle(propre))) return propre
  for (let n = 2; ; n++) {
    const suffixe = ` (${n})`
    const candidat = `${tronquer(propre, MAX_TITRE - suffixe.length).trim()}${suffixe}`
    if (!occupes.has(cle(candidat))) return candidat
  }
}

/**
 * Le premier temps ou la première cible qu'`normalizeQuestions` changerait en
 * silence, dit comme on le corrige, ou null. Le serveur le refuse à l'éditeur
 * d'aujourd'hui (la requête porte `base`) : son champ borne en le quittant,
 * et un « 4 » qui arrivait quand même partait en base à 5 s sans que
 * personne le lise. Une page d'avant, elle, garde le bornage silencieux.
 */
export function horsBornesALEnvoi(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null
  const dans = (v: number, min: number, max: number) => Number.isFinite(v) && Math.round(v) >= min && Math.round(v) <= max
  for (const [i, q] of raw.slice(0, MAX_QUESTIONS).entries()) {
    const ou = `Question ${i + 1} : `
    if (q?.duration !== undefined && !dans(Number(q.duration), MIN_DURATION, MAX_DURATION)) {
      return `${ou}le temps de réponse va de ${MIN_DURATION} à ${MAX_DURATION} s. Corrige-le, puis enregistre.`
    }
    if (q?.observeSeconds !== undefined && q.observeSeconds !== null && !dans(Number(q.observeSeconds), MIN_OBSERVE, MAX_OBSERVE)) {
      return `${ou}le temps d’observation va de ${MIN_OBSERVE} à ${MAX_OBSERVE} s. Corrige-le, puis enregistre.`
    }
    if (q?.target !== undefined && q.target !== null && !(typeof q.target === 'number' && Number.isFinite(q.target))) {
      return `${ou}la bonne réponse n’est pas un nombre lisible. Corrige-la, puis enregistre.`
    }
  }
  return null
}

/**
 * Borne ce qui arrive du navigateur sans rien jeter : un brouillon incomplet
 * reste enregistré tel quel (on ne perd jamais une saisie), c'est `toPlayable`
 * qui décidera au lancement du quiz s'il est jouable.
 */
export function normalizeQuestions(raw: unknown): QuizQuestionDef[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_QUESTIONS).map((q: any): QuizQuestionDef => {
    const answers: string[] = []
    for (let i = 0; i < MAX_ANSWERS; i++) {
      const a = Array.isArray(q?.answers) ? q.answers[i] : ''
      answers.push(typeof a === 'string' ? tronquer(a, MAX_ANSWER_TEXT) : '')
    }
    const correct = Number(q?.correct)
    const duration = Number(q?.duration)
    const target = Number(q?.target)
    const observe = Number(q?.observeSeconds)
    // Une URL d'image ne peut venir que du serveur (/media/…) : on refuse le reste.
    const image = typeof q?.image === 'string' && q.image.startsWith('/media/') ? q.image : null
    const photoAttendue = typeof q?.photoAttendue === 'string' ? tronquer(q.photoAttendue.trim(), MAX_PHOTO_ATTENDUE).trim() : ''
    return {
      // L'éditeur s'appuie sur cet identifiant pour suivre chaque carte ; les
      // quiz écrits avant en reçoivent un ici, une fois pour toutes.
      id: typeof q?.id === 'string' && QUESTION_ID.test(q.id) ? q.id : newQuestionId(),
      // Les quiz écrits avant l'arrivée des estimations n'ont pas de `kind`.
      kind: q?.kind === 'number' ? 'number' : 'choice',
      text: typeof q?.text === 'string' ? tronquer(q.text, MAX_TEXT) : '',
      answers,
      target: q?.target === null || q?.target === undefined || !Number.isFinite(target) ? null : target,
      unit: typeof q?.unit === 'string' ? tronquer(q.unit, MAX_UNIT) : '',
      // « À choisir » survit à l'enregistrement : rangée en 0, la question
      // redevenait prête avec la première réponse pour bonne.
      correct: Number.isInteger(correct) && correct >= SANS_BONNE_REPONSE && correct < MAX_ANSWERS ? correct : 0,
      // Une page d'avant, qui lisait « 2045 », l'envoie encore : on le range
      // dans les bornes. L'éditeur d'aujourd'hui ne l'envoie plus — son champ
      // borne en le quittant, sous les yeux de l'animateur (`ChampNombre`).
      duration: Number.isFinite(duration)
        ? Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(duration)))
        : DEFAULT_DURATION,
      image,
      // Absent des quiz écrits avant la photo « mémoire » : elle reste alors
      // affichée. Comme pour `target`, le null explicite doit être testé avant
      // la conversion — `Number(null)` vaut 0, pas NaN.
      observeSeconds:
        q?.observeSeconds === null || q?.observeSeconds === undefined || !Number.isFinite(observe)
          ? null
          : Math.min(MAX_OBSERVE, Math.max(MIN_OBSERVE, Math.round(observe))),
      // Prise dans la liste fixe, ou rien : c'est ce qui permet à la carrière
      // d'un joueur d'additionner les catégories d'un hôte à l'autre.
      category: categorieDe(q?.category),
      // La photo annoncée par une liste collée, le temps qu'elle arrive : la
      // question ne se joue pas sans elle. Jointe, elle n'a plus rien à dire.
      photoAttendue: photoAttendue && !image ? photoAttendue : null,
      // Seulement quand il est posé : absent, il ne pèse rien, et les quiz
      // d'avant se relisent à l'identique.
      ...(q?.ordreFixe === true && { ordreFixe: true }),
    }
  })
}

/** Résultat d'un import en masse : ce qui est entré, et ce qui mérite un œil. */
export interface ImportResult {
  questions: QuizQuestionDef[]
  /** Questions sans bonne réponse marquée d'une étoile : à vérifier. */
  unmarked: number
  /** Blocs ignorés faute de contenu exploitable. */
  ignored: number
  /**
   * Le début de chacun de ces blocs : « 1 bloc ignoré » ne disait pas
   * lequel, et sur trente blocs on cherchait.
   */
  ignores: string[]
  /** Les réponses au-delà de la quatrième, que la question n'a pas gardées — effacées sans un mot jusqu'ici. */
  enTrop: { question: string; reponse: string }[]
  /** Le titre annoncé en tête de la liste (« Titre : Soirée années 90 »), s'il y en a un. */
  titre: string | null
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
type Reglage = 'temps' | 'photo' | 'observation' | 'ordre'
const REGLAGES = new Map<string, Reglage>([
  ['temps', 'temps'],
  ['duree', 'temps'],
  ['photo', 'photo'],
  ['image', 'photo'],
  ['observation', 'observation'],
  ['memoire', 'observation'],
  ['ordre', 'ordre'],
])

/**
 * Une ligne que la liste collée lit comme un réglage (« Photo : … », « Temps
 * : … ») ou comme la bonne réponse désignée (« Réponse : … ») : sous un
 * intitulé, elle ne compte pas parmi les choix. « Copier en liste » la fait
 * précéder d'une puce quand c'est un choix (`ecrireListe`).
 */
export function luCommeReglage(ligne: string): boolean {
  return lireReglage(ligne) !== null || REPONSE_DESIGNEE.test(ligne)
}

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

// ── La mise en forme d'une liste « bavarde » ─────────────────────────────
//
// Le format demande du texte brut, mais une IA « met en forme » sa réponse,
// et un ami numérote : `**1. Quelle… ?**`, `- Canberra *`, `B) *1989`. Lu
// tel quel, l'intitulé gardait ses `**`, les réponses leurs puces, l'étoile
// en fin de ligne n'était pas vue — et la première réponse devenait la
// bonne. On retire ce qui ne se lit pas comme un doute : le gras, les puces,
// un numéro suivi d'un point, des lettres qui se suivent (A, B, C).

/** `**gras**` et `__gras__`, où qu'ils soient dans la ligne. */
const sansGras = (l: string) => l.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1')

/**
 * Le numéro d'un intitulé : « 1. », « 2) », « Q3 : », « Question 4 - », et
 * le « ## » d'un titre. Un nombre sans point ni parenthèse n'en est pas un
 * (« 1984 est un roman de ? »), ni un point sans espace (« 3.14, c'est pi ? »).
 * Un « Q » seul veut son séparateur : « Q7 est une voiture de quelle
 * marque ? » et « Q2 2024 : quel trimestre ? » perdaient leur début.
 */
const TITRE_MARKDOWN = /^#{2,}\s*/
const NUMERO_D_INTITULE =
  /^(?:question\s*(?:n°\s*)?\d{1,3}\s*[.):–—-]?\s+|q\s*(?:n°\s*)?\d{1,3}\s*[.):–—-]\s+|\d{1,3}\s*[.)]\s+)/i
/**
 * Une ligne qui n'est qu'un en-tête : « ### Question 1 », « Q3 : », « 2. ».
 * L'intitulé vient à la ligne suivante — lu comme intitulé, l'en-tête faisait
 * une question « prête » nommée « Question 1 », son vrai texte parmi les choix.
 */
const ENTETE_SEUL =
  /^(?:#{2,}\s*(?:(?:question|q)\s*(?:n°\s*)?)?\d{1,3}\s*[.):–—-]?|(?:question|q)\s*(?:n°\s*)?\d{1,3}\s*[.):–—-]?|\d{1,3}\s*[.)])$/i

/**
 * Une puce. L'étoile n'en est pas une — c'est la marque de la bonne
 * réponse —, ni un tiret collé : « -41 °C » est un nombre négatif. Ni un
 * tiret suivi d'un chiffre : « - 30 °C » est un signe, qu'on retirait ; une
 * liste à puces de nombres garde donc ses tirets, qui se retouchent sur la
 * carte, plutôt qu'une réponse ne change de signe en silence.
 */
const PUCE = /^[-•–—+·▪◦]\s+(?![\d.,])/
/** La bonne réponse, marquée devant — « * », « ✓ » — ou derrière, comme on l'écrit aussi. */
// Les coches d'emoji comprises, « ✔️ » (avec son sélecteur U+FE0F) et
// « ✅ » : une IA les met volontiers, et la question restait sans bonne
// réponse, la coche collée au texte.
const MARQUE_DEVANT = /^(?:\*|[✓✔☑✅]\uFE0F?)\s*/
const MARQUE_DERRIERE = /\s*(?:\*|[✓✔☑✅]\uFE0F?|\(\s*\*\s*\)|\(\s*bonne\s+r[ée]ponse\s*\))$/i
/** « A) », « b. », « 1) » : l'étiquette d'une réponse, qui ne se retire que si toutes se suivent. */
const ETIQUETTE = /^\(?([a-h]|\d)[.)]\s+/i
const SUITE_D_ETIQUETTES = 'abcdefgh'
/** « Réponse : Canberra », « Bonne réponse : B » : la bonne, désignée sous les choix. */
const REPONSE_DESIGNEE = /^(?:la\s+)?(?:bonne\s+)?r[ée]ponse(?:\s+correcte)?\s*:\s*(.+)$/i

interface ReponseLue {
  /** Le texte, sans puce ni marque ; `etiquette` le précède encore. */
  texte: string
  /** Le même, sans son étiquette. */
  nu: string
  etiquette: string | null
  marquee: boolean
}

function lireReponse(ligne: string): ReponseLue {
  let l = ligne.replace(PUCE, '')
  let marquee = MARQUE_DEVANT.test(l)
  l = l.replace(MARQUE_DEVANT, '')
  const m = ETIQUETTE.exec(l)
  let nu = m ? l.slice(m[0].length) : l
  // « B) *1989 » : la marque après l'étiquette.
  if (m && MARQUE_DEVANT.test(nu)) {
    marquee = true
    nu = nu.replace(MARQUE_DEVANT, '')
    l = `${m[0]}${nu}`
  }
  if (MARQUE_DERRIERE.test(nu)) {
    marquee = true
    nu = nu.replace(MARQUE_DERRIERE, '')
    l = l.replace(MARQUE_DERRIERE, '')
  }
  return { texte: l.trim(), nu: nu.trim(), etiquette: m ? m[1].toLowerCase() : null, marquee }
}

/** Pour comparer une réponse désignée à un choix : sans casse, sans accent, sans ponctuation finale. */
const comparable = (s: string) => sansAccents(s).toLowerCase().replace(/[.!]+$/, '').trim()

/** « Titre : Soirée années 90 » : le titre du quiz, en tête de la liste. */
const TITRE_DE_LISTE = /^titre\s*:\s*(.+)$/i

function titreSeul(ligne: string): string | null {
  const m = TITRE_DE_LISTE.exec(ligne)
  const titre = m ? tronquer(m[1].trim(), MAX_TITRE).trim() : ''
  return titre || null
}

/** Une ligne « Temps : 45 s » lisible, ou null : elle peut alors précéder un intitulé. */
function tempsSeul(ligne: string): number | null {
  const lu = lireReglage(ligne)
  return lu?.reglage === 'temps' ? lireSecondes(lu.valeur) : null
}

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
 * l'intitulé, « Photo » et « Observation » règlent la question ; « Temps »
 * la règle, elle et les suivantes, comme une catégorie. `modele`, la voisine
 * de l'endroit où la liste arrive, prête son temps et sa catégorie à ce qui
 * n'en dit rien (voir emptyQuestion).
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
  const ignores: string[] = []
  const enTrop: ImportResult['enTrop'] = []
  let titre: string | null = null
  /** Un bloc qu'on ne sait pas lire : compté, et nommé par son début. */
  const ignorer = (debut: string) => {
    ignored++
    ignores.push(tronquer(debut.replace(/\s+/g, ' ').trim(), 60))
  }

  // La catégorie en cours : une ligne « # Cinéma » range les questions qui
  // suivent, jusqu'à la prochaine. « # » tout seul les laisse sans catégorie.
  // Collé au dièse, seul un nom de la liste en est une : « #1 des ventes en
  // 1985 ? » est une question, qu'on aurait prise pour une catégorie inconnue.
  const estCategorie = (l: string) => /^#(\s|$)/.test(l) || (l.startsWith('#') && categorieDe(l.slice(1)) !== null)
  // Sans dièse, la liste collée reprend la catégorie de sa voisine, comme une
  // question ajoutée à la main (voir emptyQuestion) ; « # » seul l'efface.
  let categorie: string | null = categorieDe(modele?.category)
  // Le temps court comme la catégorie : « Temps : 50 s » sous la première
  // question valait pour elle seule, et les huit suivantes de Léa sont
  // arrivées à 20 s — l'aide promettait l'inverse. Sans ligne, la voisine.
  let temps = emptyQuestion(modele).duration
  let premierBloc = true
  for (const block of blocks) {
    const lines = block
      .split(SEPARATEUR_LIGNES)
      .map(l => sansGras(l).trim())
      .filter(l => l.length > 0)
    if (lines.length === 0) continue
    // Le titre du quiz, tout en haut : « Titre : Soirée années 90 ». Seulement
    // seul sur sa ligne en tête de la liste, ou suivi de catégories et de
    // temps — « Titre : quel film… ? » suivi de ses choix est une question.
    if (premierBloc) {
      premierBloc = false
      const lu = titreSeul(lines[0])
      if (lu && lines.slice(1).every(l => estCategorie(l) || tempsSeul(l) !== null)) {
        titre = lu
        lines.shift()
      }
    }
    // En tête de bloc, ou seules : les catégories, et un temps pour la suite.
    while (lines.length > 0 && (estCategorie(lines[0]) || tempsSeul(lines[0]) !== null)) {
      const ligne = lines.shift()!
      const secondes = tempsSeul(ligne)
      if (secondes !== null) {
        temps = borner(secondes, MIN_DURATION, MAX_DURATION)
        continue
      }
      const nom = ligne.slice(1).trim()
      categorie = nom ? categorieDe(nom) : null
      // Une catégorie qu'on ne connaît pas se signale, comme un bloc illisible.
      if (nom && !categorie) ignorer(ligne)
    }
    if (lines.length < 2) {
      if (lines.length === 1) ignorer(lines[0])
      continue
    }

    const question = emptyQuestion(modele)
    question.category = categorie
    // Coupé par caractère, jamais au milieu d'un emoji.
    // Un en-tête seul sur sa ligne : l'intitulé est la suivante.
    if (lines.length > 2 && ENTETE_SEUL.test(lines[0])) lines.shift()
    question.text = tronquer(lines[0].replace(TITRE_MARKDOWN, '').replace(NUMERO_D_INTITULE, '').trim() || lines[0], MAX_TEXT)

    // Les réglages d'abord, où qu'ils soient sous l'intitulé : ce qui reste
    // est la réponse — le « = » d'une estimation, ou les choix d'un QCM.
    const rest: string[] = []
    let observation: number | null = null
    let designee: string | null = null
    for (const line of lines.slice(1)) {
      const lu = lireReglage(line)
      const reponse = REPONSE_DESIGNEE.exec(line)
      if (reponse) {
        designee = reponse[1]
      } else if (!lu) {
        rest.push(line)
      } else if (lu.reglage === 'temps') {
        // Illisible, le temps reste celui qui court : il se corrige sur la
        // carte, et ne vaut pas qu'on perde la question.
        const secondes = lireSecondes(lu.valeur)
        if (secondes !== null) temps = borner(secondes, MIN_DURATION, MAX_DURATION)
      } else if (lu.reglage === 'ordre') {
        // « Ordre : fixe » : les réponses gardent l'ordre écrit, même dans un
        // quiz qui les mélange. Toute autre valeur laisse le réglage du quiz.
        if (/^(fixe|tel quel|telle quelle|garde|garder|ecrit)$/.test(sansAccents(lu.valeur).toLowerCase().trim())) question.ordreFixe = true
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
    question.duration = temps
    // Sans photo, rien à observer (voir tempsDObservation).
    question.observeSeconds = question.photoAttendue ? observation : null

    const numberLine = rest.map(l => l.replace(PUCE, '')).find(l => l.startsWith('='))
    if (numberLine) {
      const lue = lireEstimation(numberLine.slice(1).trim())
      if (!lue) {
        ignorer(question.text)
        continue
      }
      question.kind = 'number'
      question.target = lue.target
      question.unit = lue.unit
      questions.push(question)
      continue
    }

    const lues = rest.map(lireReponse).filter(r => r.texte.length > 0)
    // « A. Lincoln » seul n'est pas une liste lettrée : les étiquettes ne se
    // retirent que si toutes se suivent, depuis A ou 1.
    const etiquetees =
      lues.length >= MIN_ANSWERS &&
      lues.every((r, i) => r.etiquette === SUITE_D_ETIQUETTES[i] || r.etiquette === String(i + 1))
    let correct = -1
    let marques = 0
    const answers: string[] = []
    for (const r of lues) {
      const answer = etiquetees ? r.nu : r.texte
      if (!answer) continue
      if (r.marquee) marques++
      // Au-delà de quatre, la réponse est coupée — et sa marque avec : la
      // question attend alors qu'on choisisse, plutôt qu'une autre ne gagne.
      // Elle se dit, au lieu de disparaître en silence.
      if (answers.length >= MAX_ANSWERS) {
        enTrop.push({ question: question.text, reponse: tronquer(answer, MAX_ANSWER_TEXT) })
        continue
      }
      if (r.marquee && correct < 0) correct = answers.length
      answers.push(tronquer(answer, MAX_ANSWER_TEXT))
    }
    if (answers.length < MIN_ANSWERS) {
      ignorer(question.text)
      continue
    }
    // « Réponse : Canberra » ou « Bonne réponse : B », quand aucune n'est marquée.
    if (marques === 0 && designee) {
      const cherchee = comparable(lireReponse(designee).texte)
      const i = lues.findIndex(
        (r, n) => n < MAX_ANSWERS && (comparable(r.nu) === cherchee || comparable(r.texte) === cherchee || (etiquetees && r.etiquette === cherchee)),
      )
      if (i >= 0) {
        correct = i
        marques = 1
      }
    }
    // Sans marque, ou avec plusieurs, la question attend qu'on choisisse sur
    // sa carte : prendre la première, c'était un quiz faux découvert devant
    // cinquante personnes — le panneau le disait, puis se refermait.
    if (marques !== 1 || correct < 0) {
      correct = SANS_BONNE_REPONSE
      unmarked++
    }
    question.correct = correct
    for (let i = 0; i < MAX_ANSWERS; i++) question.answers[i] = answers[i] ?? ''
    questions.push(question)
  }

  return { questions, unmarked, ignored, ignores, enTrop, titre }
}
