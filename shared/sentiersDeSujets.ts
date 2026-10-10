// Les sentiers à thème : un sujet de la campagne (`shared/sujets.ts`) — une
// époque, un fil rouge — monté en six paliers de dix questions, des plus
// faciles aux plus pointues. Le propriétaire voulait des sentiers « orientés
// sur un thème précis » sans que ce soit compliqué (le 10 octobre 2026) :
// après les chapitres des douze sentiers (`shared/chapitres.ts`), ceux-ci
// prennent les sujets que la base pose déjà — cent questions chacun au
// moins, de sept catégories —, sans une question de plus à écrire.
//
// Leur règle tient en une ligne : six paliers de dix questions, sept bonnes
// réponses pour passer, sans vies — on y apprend, on n'y perd rien. Ni
// portrait ni titre : chaque bonne réponse paie comme en série, et les
// étoiles disent la meilleure note de chaque palier.

import type { IssueDEpreuve, Melange, RegleDuPalier } from './sentiers'
import type { QuestionDeCampagne } from './campagne'

export const PALIERS_D_UN_SUJET = 6
export const QUESTIONS_D_UN_PALIER_DE_SUJET = 10
/** Sept sur dix : la même exigence que dix sur seize, sur une épreuve plus courte. */
export const SEUIL_D_UN_SUJET = 7

/**
 * Sous ce nombre de questions, un sujet n'a pas de sentier : six paliers en
 * posent soixante, et une épreuve ratée se rejoue sur d'autres questions.
 */
export const QUESTIONS_POUR_UN_SENTIER_DE_SUJET = 60

/** Des faciles aux difficiles, sans experte : un sujet se monte, il ne se gagne pas à l'usure. */
const MELANGES: readonly Melange[] = [
  { facile: 10 },
  { facile: 7, moyen: 3 },
  { facile: 4, moyen: 6 },
  { moyen: 8, difficile: 2 },
  { moyen: 5, difficile: 5 },
  { moyen: 2, difficile: 8 },
]

/**
 * Les paliers d'un sentier à thème, dans la forme de ceux des sentiers :
 * le tirage d'une épreuve les lit pareil (`tirerUneEpreuve`). Chaque palier
 * pose tout le sujet — ses sous-thèmes servis à tour de rôle —, sans vrai ou
 * faux dès le troisième.
 */
export const PALIERS_DES_SUJETS: readonly RegleDuPalier[] = MELANGES.map((melange, i) => ({
  n: i + 1,
  melange,
  seuil: SEUIL_D_UN_SUJET,
  avatar: null,
  maitre: false,
  sansVraiFaux: i + 1 >= 3,
  touteLaCategorie: true,
}))

export function regleDuPalierDeSujet(n: unknown): RegleDuPalier | null {
  return typeof n === 'number' && Number.isInteger(n) ? (PALIERS_DES_SUJETS[n - 1] ?? null) : null
}

// Les épreuves des sentiers comptent sur seize questions (`issueDe`) ; celles-ci
// sur dix : la même règle, à leur mesure.

/** Où en est une épreuve de sujet : validée dès sept, ratée dès que sept ne sont plus possibles. */
export function issueDuSujet(justes: number, repondues: number, seuil = SEUIL_D_UN_SUJET): IssueDEpreuve | null {
  if (justes >= seuil) return 'validee'
  if (repondues - justes > QUESTIONS_D_UN_PALIER_DE_SUJET - seuil) return 'ratee'
  return null
}

/** Elle s'arrête à la dixième question, ou dès qu'elle est ratée ; validée, elle continue pour les étoiles. */
export function epreuveDeSujetFinie(justes: number, repondues: number, seuil = SEUIL_D_UN_SUJET): boolean {
  return repondues >= QUESTIONS_D_UN_PALIER_DE_SUJET || issueDuSujet(justes, repondues, seuil) === 'ratee'
}

/** Ses étoiles : une à sept, deux à neuf, trois sans faute. */
export function etoilesDuSujet(justes: number, seuil = SEUIL_D_UN_SUJET): 0 | 1 | 2 | 3 {
  if (justes < seuil) return 0
  if (justes >= QUESTIONS_D_UN_PALIER_DE_SUJET) return 3
  return justes >= seuil + Math.ceil((QUESTIONS_D_UN_PALIER_DE_SUJET - seuil) / 2) ? 2 : 1
}

/** Un sentier à thème, tel que sa tuile le montre. */
export interface SentierDeSujet {
  sujet: string
  /** Les paliers validés, de 0 à 6. */
  paliers: number
  /** La meilleure note de chaque palier (1 à 6), en étoiles ; 0 : jamais validé. */
  etoiles: number[]
}

/** Une épreuve de sujet, telle que sa page la reprend : jamais la bonne réponse de la question en cours. */
export interface EpreuveDeSujet {
  id: string
  sujet: string
  palier: number
  /** Un palier déjà validé, rejoué. */
  rejeu: boolean
  seuil: number
  justes: number
  fausses: number
  total: number
  issue: IssueDEpreuve | null
  finie: boolean
  question?: QuestionDeCampagne
}

/** Les sentiers à thème (`GET /api/campagne/sujets`) : ceux que la base sert, et l'épreuve laissée en route. */
export interface EtatDesSujets {
  sujets: SentierDeSujet[]
  epreuve: EpreuveDeSujet | null
}

/** Ce que dit une réponse d'épreuve de sujet : la bonne, l'anecdote, et la suite. */
export interface ReponseDuSujet {
  juste: boolean
  bonne: number
  anecdote: string | null
  /** L'expérience de cette réponse, celle d'une bonne réponse en série. */
  xp: number
  epreuve: EpreuveDeSujet
  /** Finie et validée : ses étoiles, et si c'est sa meilleure note sur ce palier. */
  etoiles?: number
  record?: boolean
  /** Finie : les paliers de la campagne qu'elle a fait tomber (Le Marathonien), et ce qu'ils ouvrent. */
  recompenses?: { key: string; emoji: string; title: string }[]
  legendaires?: string[]
}
