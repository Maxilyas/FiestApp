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

import type { QuizDef, QuizQuestionDef } from './library'
import { titreLibre } from './library'
import { normaliserReglages, type ReglagesDuQuiz } from './hasard'

/** Ce qui dit, en tête du fichier, que c'est bien un quiz de l'application. */
export const FORMAT_QUIZ = 'fiestapp-quiz'
/** La version du fichier : un fichier plus récent que l'application ne se lit pas à moitié. */
export const VERSION_QUIZ = 1
/** Au-delà, le navigateur peinerait à le lire, et aucun quiz raisonnable n'y arrive. */
export const POIDS_MAX_FICHIER = 40 * 1024 * 1024

/** Une photo telle qu'elle voyage : en clair, dans un format que le serveur accepte. */
const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/

export interface QuizEmporte {
  format: typeof FORMAT_QUIZ
  version: number
  titre: string
  /** Les questions, leur photo en clair (`data:image/…`) au lieu de son adresse. */
  questions: (Omit<QuizQuestionDef, 'id' | 'image'> & { image: string | null })[]
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
    if (q.image && !enClair.has(q.image)) enClair.set(q.image, await lirePhoto(q.image).catch(() => null))
  }
  return {
    format: FORMAT_QUIZ,
    version: VERSION_QUIZ,
    titre: quiz.title,
    questions: quiz.questions.map(({ id: _id, image, ...q }) => ({ ...q, image: image ? (enClair.get(image) ?? null) : null })),
    ...(quiz.reglages && Object.keys(quiz.reglages).length > 0 && { reglages: quiz.reglages }),
  }
}

export interface QuizDeballe {
  titre: string
  /** Les questions sans leur photo : elle ne vaut qu'une fois envoyée au serveur. */
  questions: Record<string, unknown>[]
  /** La photo en clair de chaque question, dans le même ordre, ou null. */
  photos: (string | null)[]
  /** Les photos qu'on n'a pas su reprendre : ni JPEG, ni PNG, ni WebP. */
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
  for (const q of f.questions) {
    const question = q && typeof q === 'object' ? { ...(q as Record<string, unknown>) } : {}
    const image = question.image
    delete question.image
    delete question.id
    if (typeof image === 'string' && PHOTO.test(image)) photos.push(image)
    else {
      if (image !== null && image !== undefined) photosIgnorees++
      photos.push(null)
    }
    questions.push(question)
  }
  return { titre, questions, photos, photosIgnorees, reglages: normaliserReglages(f.reglages) }
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
  for (const photo of deballe.photos) {
    if (photo && !adresses.has(photo)) adresses.set(photo, await portes.envoyerPhoto(photo))
  }
  const questions = deballe.questions.map((q, i) => {
    const photo = deballe.photos[i]
    return { ...q, image: photo ? adresses.get(photo)! : null }
  })
  const quiz = await portes.creer(titreLibre(deballe.titre, portes.titresPris ?? []), questions, deballe.reglages)
  return { quiz, questions: questions.length, photos: adresses.size, photosIgnorees: deballe.photosIgnorees }
}
