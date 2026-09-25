// Un quiz qu'on emporte : exporté d'une bibliothèque, importé dans une autre.
//
// Deux animateurs amis ne pouvaient se passer un quiz qu'en le recopiant —
// photos comprises, une à une. Le fichier porte tout ce qu'il faut pour le
// rejouer ailleurs : les questions telles qu'elles sont écrites, et leurs
// photos dedans, en clair, parce qu'une adresse `/media/image/…` ne veut rien
// dire sur un autre serveur.
//
// À l'import, rien n'entre sans repasser par les portes habituelles : chaque
// photo par l'envoi d'image (formats et poids vérifiés), le quiz par sa
// création (questions bornées, nettoyées, rangées dans l'espace de celui qui
// importe). Ce module ne fait qu'emballer et déballer ; l'orchestration prend
// ses appels réseau en paramètre, pour que le navigateur et les tests passent
// par le même chemin.

import type { PieceDeQuestion, QuizDef, QuizQuestionDef } from './library'
import { PIECES_DE_QUESTION, SON_MIMES, titreLibre } from './library'
import { normaliserReglages, type ReglagesDuQuiz } from './hasard'

/** Ce qui dit, en tête du fichier, que c'est bien un quiz de l'application. */
export const FORMAT_QUIZ = 'fiestapp-quiz'
/** La version du fichier : un fichier plus récent que l'application ne se lit pas à moitié. */
export const VERSION_QUIZ = 1

/**
 * Au-delà, le navigateur peinerait à le lire. Un quiz seul n'en approche
 * jamais ; toute une bibliothèque — quarante quiz et leurs photos en clair —
 * dépassait les 40 Mo d'avant.
 */
export const POIDS_MAX_FICHIER = 200 * 1024 * 1024

/** Une photo telle qu'elle voyage : en clair, dans un format que le serveur accepte. */
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/
/** Un extrait du blind test, de même. */
const SON = new RegExp(`^data:(${SON_MIMES.map(m => m.replace(/[/+.-]/g, '\\$&')).join('|')});base64,[A-Za-z0-9+/=]+$`)
/** Ce qu'une pièce doit être pour être reprise. */
const FORME: Record<PieceDeQuestion, RegExp> = { image: PHOTO, imageRevelation: PHOTO, son: SON }

export interface QuizEmporte {
  format: typeof FORMAT_QUIZ
  version: number
  titre: string
  /**
   * Les questions, leurs pièces en clair (`data:image/…`, `data:audio/…`) au
   * lieu de leur adresse : la photo, celle de la révélation, l'extrait. Une
   * version d'avant qui lit ce fichier garde la photo et laisse les deux
   * autres : elles ne passent pas sa relecture des questions.
   */
  questions: (Omit<QuizQuestionDef, 'id' | PieceDeQuestion> & { image: string | null } & { [k in Exclude<PieceDeQuestion, 'image'>]?: string | null })[]
  /** Les réglages du quiz — absents d'un fichier d'avant, qui se joue alors tel qu'écrit. */
  reglages?: ReglagesDuQuiz
}

/** « Culture générale » → `culture-generale.quiz.json`. */
export function nomDeFichier(titre: string): string {
  const base = titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'quiz'}.quiz.json`
}

/**
 * Emballe un quiz. `lirePhoto` rend une photo en clair, ou null si elle ne se
 * lit plus : le quiz part alors sans elle plutôt que de ne pas partir.
 */
export async function emporterQuiz(
  quiz: Pick<QuizDef, 'title' | 'questions' | 'reglages'>,
  lirePhoto: (adresse: string) => Promise<string | null>,
): Promise<QuizEmporte> {
  // Une même photo peut servir à plusieurs questions : on ne la lit qu'une fois.
  const enClair = new Map<string, string | null>()
  for (const q of quiz.questions) {
    for (const champ of PIECES_DE_QUESTION) {
      const adresse = q[champ]
      if (adresse && !enClair.has(adresse)) enClair.set(adresse, await lirePhoto(adresse).catch(() => null))
    }
  }
  return {
    format: FORMAT_QUIZ,
    version: VERSION_QUIZ,
    titre: quiz.title,
    questions: quiz.questions.map(({ id: _id, image, imageRevelation, son, ...q }) => ({
      ...q,
      image: image ? (enClair.get(image) ?? null) : null,
      ...(imageRevelation && { imageRevelation: enClair.get(imageRevelation) ?? null }),
      ...(son && { son: enClair.get(son) ?? null }),
    })),
    ...(quiz.reglages && Object.keys(quiz.reglages).length > 0 && { reglages: quiz.reglages }),
  }
}

export interface QuizDeballe {
  titre: string
  /** Les questions sans leurs pièces : elles ne valent qu'une fois envoyées au serveur. */
  questions: Record<string, unknown>[]
  /** La photo en clair de chaque question, dans le même ordre, ou null. */
  photos: (string | null)[]
  /** Ses autres pièces en clair, dans le même ordre : la photo de la révélation, l'extrait. */
  autresPieces: { [k in Exclude<PieceDeQuestion, 'image'>]?: string }[]
  /** Les pièces qu'on n'a pas su reprendre : ni JPEG, ni PNG, ni WebP — ni un extrait qu'on sache jouer. */
  photosIgnorees: number
  reglages: ReglagesDuQuiz
}

/** Déballe un fichier lu : le quiz qu'il porte, ou ce qui ne va pas, en une phrase. */
export function deballerQuiz(brut: unknown): QuizDeballe | { erreur: string } {
  const f = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : null
  if (!f || f.format !== FORMAT_QUIZ) {
    return { erreur: 'Ce fichier n’est pas un quiz exporté de l’application' }
  }
  if (typeof f.version !== 'number' || f.version > VERSION_QUIZ) {
    return { erreur: 'Ce quiz vient d’une version plus récente de l’application : il faut la mettre à jour pour l’importer' }
  }
  if (!Array.isArray(f.questions) || f.questions.length === 0) return { erreur: 'Ce quiz n’a aucune question' }
  const titre = typeof f.titre === 'string' && f.titre.trim() ? f.titre.trim() : 'Quiz importé'
  let photosIgnorees = 0
  const questions: Record<string, unknown>[] = []
  const photos: (string | null)[] = []
  const autresPieces: QuizDeballe['autresPieces'] = []
  for (const q of f.questions) {
    const question = q && typeof q === 'object' ? { ...(q as Record<string, unknown>) } : {}
    delete question.id
    const pieces: Partial<Record<PieceDeQuestion, string>> = {}
    for (const champ of PIECES_DE_QUESTION) {
      const piece = question[champ]
      delete question[champ]
      if (typeof piece === 'string' && FORME[champ].test(piece)) pieces[champ] = piece
      else if (piece !== null && piece !== undefined) photosIgnorees++
    }
    const { image, ...autres } = pieces
    photos.push(image ?? null)
    autresPieces.push(autres)
    questions.push(question)
  }
  return { titre, questions, photos, autresPieces, photosIgnorees, reglages: normaliserReglages(f.reglages) }
}

/**
 * Importe un fichier lu : chaque photo repasse par l'envoi d'image, puis le
 * quiz se crée avec leurs nouvelles adresses. Rend le quiz créé — ou jette
 * une erreur à montrer telle quelle.
 */
export async function importerQuiz<T>(
  brut: unknown,
  portes: {
    envoyerPhoto: (enClair: string) => Promise<string>
    creer: (titre: string, questions: Record<string, unknown>[], reglages: ReglagesDuQuiz) => Promise<T>
    /** Les titres de la bibliothèque : un quiz importé sous l'un d'eux arrive « (2) ». */
    titresPris?: Iterable<string>
  },
): Promise<{ quiz: T; questions: number; photos: number; photosIgnorees: number }> {
  const deballe = deballerQuiz(brut)
  if ('erreur' in deballe) throw new Error(deballe.erreur)
  // Une à une, et une seule fois chacune : cinquante photos envoyées d'un
  // coup satureraient la connexion, et le serveur gratuit avec.
  const adresses = new Map<string, string>()
  const aEnvoyer = [...deballe.photos, ...deballe.autresPieces.flatMap(p => Object.values(p))]
  for (const piece of aEnvoyer) {
    if (piece && !adresses.has(piece)) adresses.set(piece, await portes.envoyerPhoto(piece))
  }
  const questions = deballe.questions.map((q, i) => {
    const photo = deballe.photos[i]
    const { imageRevelation, son } = deballe.autresPieces[i]
    return {
      ...q,
      image: photo ? adresses.get(photo)! : null,
      ...(imageRevelation && { imageRevelation: adresses.get(imageRevelation)! }),
      ...(son && { son: adresses.get(son)! }),
    }
  })
  const quiz = await portes.creer(titreLibre(deballe.titre, portes.titresPris ?? []), questions, deballe.reglages)
  return { quiz, questions: questions.length, photos: adresses.size, photosIgnorees: deballe.photosIgnorees }
}

// ── Toute la bibliothèque ────────────────────────────────────────────────
//
// Un animateur ne pouvait sauvegarder ses quiz qu'un par un ; la sauvegarde
// de la base est à l'administrateur. Un seul fichier les emporte tous — le
// même format de quiz, en liste —, et « Importer » le relit comme un quiz.

export const FORMAT_BIBLIOTHEQUE = 'fiestapp-bibliotheque'

export interface BibliothequeEmportee {
  format: typeof FORMAT_BIBLIOTHEQUE
  version: number
  quiz: QuizEmporte[]
}

/** Emballe plusieurs quiz, chacun comme `emporterQuiz`, photos en clair. */
export async function emporterBibliotheque(
  quizzes: Pick<QuizDef, 'title' | 'questions' | 'reglages'>[],
  lirePhoto: (adresse: string) => Promise<string | null>,
  avancer?: (faits: number, total: number) => void,
): Promise<BibliothequeEmportee> {
  const quiz: QuizEmporte[] = []
  for (const q of quizzes) {
    quiz.push(await emporterQuiz(q, lirePhoto))
    avancer?.(quiz.length, quizzes.length)
  }
  return { format: FORMAT_BIBLIOTHEQUE, version: VERSION_QUIZ, quiz }
}

/**
 * Importe un fichier lu — un quiz, ou une bibliothèque entière —, chaque quiz
 * par les portes de `importerQuiz`. Un quiz illisible dans une bibliothèque
 * se compte, sans arrêter les autres.
 */
export async function importerFichier<T>(
  brut: unknown,
  portes: Parameters<typeof importerQuiz<T>>[1],
): Promise<{ quiz: T[]; questions: number; photos: number; photosIgnorees: number; illisibles: number }> {
  const f = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : null
  if (f?.format !== FORMAT_BIBLIOTHEQUE) {
    const un = await importerQuiz(brut, portes)
    return { quiz: [un.quiz], questions: un.questions, photos: un.photos, photosIgnorees: un.photosIgnorees, illisibles: 0 }
  }
  if (typeof f.version !== 'number' || f.version > VERSION_QUIZ) {
    throw new Error('Cette bibliothèque vient d’une version plus récente de l’application : il faut la mettre à jour pour l’importer')
  }
  const tous = Array.isArray(f.quiz) ? f.quiz : []
  if (tous.length === 0) throw new Error('Cette bibliothèque n’a aucun quiz')
  // Les titres pris grandissent de chaque quiz créé — deux « Blind test »
  // dans le même fichier arrivent « (2) » et « (3) » —, et une photo qui
  // sert à deux quiz ne s'envoie qu'une fois.
  const pris = [...(portes.titresPris ?? [])]
  const envoyees = new Map<string, Promise<string>>()
  const envoyerPhoto = (enClair: string) => {
    let adresse = envoyees.get(enClair)
    if (!adresse) envoyees.set(enClair, (adresse = portes.envoyerPhoto(enClair)))
    return adresse
  }
  const creer: typeof portes.creer = (titre, questions, reglages) => {
    pris.push(titre)
    return portes.creer(titre, questions, reglages)
  }
  const bilan = { quiz: [] as T[], questions: 0, photos: 0, photosIgnorees: 0, illisibles: 0 }
  for (const un of tous) {
    try {
      const fait = await importerQuiz(un, { envoyerPhoto, creer, titresPris: pris })
      bilan.quiz.push(fait.quiz)
      bilan.questions += fait.questions
      bilan.photosIgnorees += fait.photosIgnorees
    } catch {
      bilan.illisibles++
    }
  }
  bilan.photos = envoyees.size
  if (bilan.quiz.length === 0) throw new Error('Aucun quiz de cette bibliothèque ne se lit')
  return bilan
}

/** « Mes quiz » du 25 septembre 2026 → `mes-quiz-2026-09-25.bibliotheque.json`. */
export function nomDeBibliotheque(date: Date): string {
  const j = (n: number) => String(n).padStart(2, '0')
  return `mes-quiz-${date.getFullYear()}-${j(date.getMonth() + 1)}-${j(date.getDate())}.bibliotheque.json`
}
