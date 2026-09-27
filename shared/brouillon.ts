// Le brouillon d'un quiz : ce que l'éditeur garde dans le navigateur tant que
// le serveur ne l'a pas enregistré.
//
// Tout ce qu'on tape vit dans l'onglet jusqu'à « Enregistrer ». Fermer
// l'onglet, recharger la page pendant un réveil de l'hébergeur, laisser le
// téléphone le décharger en arrière-plan : tout ce qui avait été écrit depuis
// le dernier enregistrement partait. Le navigateur en garde désormais une
// copie, que l'éditeur propose de reprendre en rouvrant le quiz.
//
// Pur et sans navigateur : le client range et relit (`client/src/brouillon.ts`),
// `server/test/brouillon.test.ts` vérifie.
import { PIECES_DE_QUESTION, cleanTitle, normalizeQuestions, type PieceDeQuestion, type QuizDef, type QuizQuestionDef } from './library'
import { normaliserReglages, type ReglagesDuQuiz } from './hasard'

/** Un brouillon d'un autre format est ignoré, jamais mal lu. */
const FORMAT = 1

export interface Brouillon {
  id: string
  title: string
  questions: QuizQuestionDef[]
  /** Les réglages du quiz — l'ordre des réponses, des questions. Absent d'un brouillon d'avant. */
  reglages?: ReglagesDuQuiz
  /**
   * `updatedAt` de la version du serveur d'où ces modifications sont parties :
   * s'il a bougé depuis, le quiz a été enregistré ailleurs entre-temps.
   */
  base: number
  /** Quand ce navigateur les a gardées pour la dernière fois — à sa propre horloge. */
  at: number
}

/** Un brouillon par quiz : son identifiant ne se retrouve dans aucun autre espace. */
export const cleDuBrouillon = (id: string) => `quizz.brouillon.${id}`

export function emballerBrouillon(quiz: Pick<QuizDef, 'id' | 'title' | 'questions' | 'reglages'>, base: number, at: number): string {
  return JSON.stringify({ v: FORMAT, id: quiz.id, title: quiz.title, questions: quiz.questions, reglages: quiz.reglages, base, at })
}

const nombre = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null)

/**
 * Le brouillon de ce quiz, ou null. Relu comme le serveur relit ce qu'on lui
 * envoie : un brouillon abîmé, ou d'une version d'avant, ne fait pas tomber
 * l'éditeur — et ce qu'on reprend est ce qu'« Enregistrer » aurait gardé.
 */
export function lireBrouillon(brut: string | null, id: string): Brouillon | null {
  if (!brut) return null
  let lu: unknown
  try {
    lu = JSON.parse(brut)
  } catch {
    return null
  }
  if (!lu || typeof lu !== 'object') return null
  const b = lu as Record<string, unknown>
  const base = nombre(b.base)
  const at = nombre(b.at)
  if (b.v !== FORMAT || b.id !== id || !Array.isArray(b.questions) || base === null || at === null) return null
  return {
    id,
    title: cleanTitle(b.title),
    // Toutes, même au-delà de cent : l'enregistrement refusera le trop-plein
    // en le disant, et l'animateur choisira quoi retirer.
    questions: normalizeQuestions(b.questions, Infinity),
    ...(b.reglages !== undefined && { reglages: normaliserReglages(b.reglages) }),
    base,
    at,
  }
}

const contenu = (quiz: Pick<QuizDef, 'title' | 'questions' | 'reglages'>) =>
  JSON.stringify([cleanTitle(quiz.title), normalizeQuestions(quiz.questions, Infinity), normaliserReglages(quiz.reglages)])

/**
 * Le brouillon apporte-t-il quelque chose à la version du serveur ? Un
 * enregistrement dont la réponse s'est perdue en route laisse un brouillon
 * identique à ce que le serveur a gardé : il s'efface sans rien demander.
 */
export function brouillonUtile(brouillon: Brouillon, serveur: Pick<QuizDef, 'title' | 'questions' | 'reglages'>): boolean {
  return contenu(brouillon) !== contenu(serveur)
}

/**
 * Le quiz a-t-il été enregistré depuis que ces modifications sont parties —
 * d'un autre onglet, d'un autre appareil ? Les reprendre remplacerait cette
 * version-là : l'animateur doit le savoir avant de choisir.
 */
export const brouillonDepasse = (brouillon: Brouillon, serveur: Pick<QuizDef, 'updatedAt'>) =>
  serveur.updatedAt > brouillon.base

/**
 * Les pièces du brouillon que la version enregistrée ne cite pas : envoyées,
 * jamais enregistrées. Le serveur n'en garde une qu'aucun quiz ne cite
 * qu'une heure (`IMAGE_GRACE_MS`) : un brouillon repris le lendemain peut en
 * citer une que le ménage a effacée entre-temps, et une pièce morte ne se
 * voyait qu'en pleine soirée. Celles que la version enregistrée cite, le
 * ménage ne les touche pas.
 *
 * Les trois pièces d'une question (`PIECES_DE_QUESTION`) : seule la photo
 * se vérifiait, et le ménage efface aussi celle de la révélation et
 * l'extrait — une révélation cassée, un blind test muet, sur une question
 * « prête ».
 */
export function photosAVerifier(brouillon: Brouillon, serveur: Pick<QuizDef, 'questions'>): string[] {
  const pieces = (qs: QuizQuestionDef[]) => qs.flatMap(q => PIECES_DE_QUESTION.map(champ => q[champ]))
  const enregistrees = new Set(pieces(serveur.questions))
  const aVerifier = pieces(brouillon.questions).filter((i): i is string => !!i && !enregistrees.has(i))
  return [...new Set(aVerifier)]
}

/**
 * Les questions sans les pièces disparues du serveur, et les identifiants de
 * celles qui en ont perdu une — elles le diront, jusqu'à la suivante.
 */
export function sansPhotosDisparues(
  questions: QuizQuestionDef[],
  disparues: ReadonlySet<string>,
): { questions: QuizQuestionDef[]; privees: string[]; pieces: Record<string, PieceDeQuestion[]> } {
  const privees: string[] = []
  const pieces: Record<string, PieceDeQuestion[]> = {}
  const gardees = questions.map(q => {
    const perdues = PIECES_DE_QUESTION.filter(champ => {
      const piece = q[champ]
      return !!piece && disparues.has(piece)
    })
    if (perdues.length === 0) return q
    if (q.id) {
      privees.push(q.id)
      pieces[q.id] = perdues
    }
    const sans: QuizQuestionDef = { ...q }
    for (const champ of perdues) sans[champ] = null
    // Comme « Retirer la photo » : sans photo, la photo « mémoire » n'a plus rien à montrer.
    if (perdues.includes('image')) sans.observeSeconds = null
    return sans
  })
  return { questions: gardees, privees, pieces }
}

const NOM_DE_LA_PIECE: Record<PieceDeQuestion, string> = {
  image: 'la photo',
  imageRevelation: 'la photo de la révélation',
  son: 'l’extrait',
}

/** Ce qu'une question dit des pièces qu'elle a perdues : « La photo de la révélation de cette question n'existe plus… ». */
export function piecesPerdues(pieces: readonly PieceDeQuestion[]): string {
  const noms = pieces.map(p => NOM_DE_LA_PIECE[p])
  const liste = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : noms[0]
  const phrase =
    noms.length > 1
      ? `${liste} de cette question n’existent plus sur le serveur : ajoute-les de nouveau.`
      : `${liste} de cette question n’existe plus sur le serveur : ajoute-la de nouveau.`
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}
