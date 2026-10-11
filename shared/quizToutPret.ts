// Un quiz tout prêt (le 11 octobre 2026). Les soirées n'avaient que les onze
// quiz livrés — cent dix-huit questions — quand la base de la campagne en
// compte plus de dix mille, relues, chacune avec son anecdote : un animateur
// qui n'avait pas le temps d'écrire rejouait les mêmes. Il choisit ses
// catégories ou un sujet, la difficulté, le nombre de questions, si des
// enfants jouent ; le serveur tire les questions (`core/quizToutPret.ts`) et
// range le quiz dans sa bibliothèque — une copie à lui, qu'il retouche comme
// un modèle.

import type { Categorie } from './categories'
import { DEFAULT_DURATION, dureeDeQuestionsS } from './library'

/** La difficulté d'un quiz tout prêt : que des faciles, une montée, ou de quoi départager des connaisseurs. */
export type DifficulteDuQuiz = 'facile' | 'progressive' | 'corsee'

export const DIFFICULTES_DU_QUIZ: readonly { cle: DifficulteDuQuiz; nom: string; detail: string }[] = [
  { cle: 'facile', nom: 'Facile', detail: 'Des questions que la plupart trouvent' },
  { cle: 'progressive', nom: 'Progressive', detail: 'Des faciles d’abord, puis ça monte' },
  { cle: 'corsee', nom: 'Corsée', detail: 'De quoi départager des connaisseurs' },
]

/** Les longueurs proposées : dix questions font un apéritif, trente une manche entière. */
export const NOMBRES_DU_QUIZ: readonly number[] = [10, 15, 20, 30]
export const NOMBRE_DU_QUIZ_PAR_DEFAUT = 15

/**
 * « Des enfants jouent » : les questions qu'un enfant de dix ans peut
 * connaître, lues dans l'âge minimum que la base donne à chacune (`ageMin`).
 */
export const AGE_DES_ENFANTS = 10

/**
 * « Des estimations » : une question sur cinq se joue au plus près — une
 * année, une distance, un nombre —, comme dans les quiz livrés, où elles
 * font parler la salle. Elles se tirent parmi les questions de la base dont
 * la bonne réponse est ce nombre (`core/quizToutPret.ts`).
 */
export const UNE_ESTIMATION_SUR = 5
/** Taper un nombre prend plus longtemps que toucher une réponse : les estimations livrées laissent trente secondes. */
export const DUREE_D_UNE_ESTIMATION = 30

/**
 * Ce que le quiz composé durera à jouer, à peu près : la feuille le dit
 * avant de composer — l'animatrice se demande d'abord « combien de temps
 * ça dure », et seul l'éditeur le disait, après (l'expert du quiz tout
 * prêt, le 11 octobre 2026).
 */
export function dureeDuQuizToutPretS(nombre: number, estimations: boolean): number {
  const e = estimations ? Math.round(nombre / UNE_ESTIMATION_SUR) : 0
  return dureeDeQuestionsS([
    { n: nombre - e, secondes: DEFAULT_DURATION },
    { n: e, secondes: DUREE_D_UNE_ESTIMATION },
  ])
}

/** Ce que l'animateur demande (`POST /api/quiz-tout-pret`). */
export interface ChoixDuQuiz {
  /** Vide : toutes les catégories. */
  categories: Categorie[]
  /** Un sujet de la campagne (`shared/sujets.ts`) — une époque, un fil rouge, un thème — au lieu des catégories. */
  sujet: string | null
  difficulte: DifficulteDuQuiz
  nombre: number
  enfants: boolean
  /** Une question sur cinq en estimation (`UNE_ESTIMATION_SUR`), si la base en a. */
  estimations: boolean
}

/** Ce que la base offre (`GET /api/quiz-tout-pret`) : son total, les catégories et les sujets qui ont de quoi faire un quiz. */
export interface BaseDuQuizToutPret {
  total: number
  categories: Categorie[]
  /** Les clés des sujets, dans l'ordre de `SUJETS`. */
  sujets: string[]
}
