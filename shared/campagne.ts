// La campagne solo : une série de questions qui montent en difficulté, trois
// vies, sans chronomètre. Elle se joue seul, avec son profil, quand on veut
// — l'entre-deux des soirées, comme le quiz du jour, mais sans rendez-vous.
//
// Une bonne réponse y rapporte l'expérience d'une bonne réponse en soirée,
// sans plafond — chacun monte à son rythme —, et un confetti.
//
// Ses questions sont celles que le quiz du jour a déjà posées : elles ont
// été relues, et leurs réponses disent leur difficulté — la part des joueurs
// qui les ont trouvées. Jamais une question de la réserve qui n'est pas
// encore sortie : la campagne gâcherait le quiz du jour de demain.

import { XP } from './profil'

/** Les vies d'une série : la troisième erreur la termine. */
export const VIES = 3

/** Au plus, les questions d'une série : au-delà, on a tout gagné. */
export const QUESTIONS_PAR_SERIE = 60

/** Combien de questions par marche avant que la difficulté monte. */
export const QUESTIONS_PAR_MARCHE = 5

export type Niveau = 'facile' | 'moyen' | 'difficile' | 'expert'

export const NIVEAUX: readonly Niveau[] = ['facile', 'moyen', 'difficile', 'expert']

export const NOM_NIVEAU: Record<Niveau, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
  expert: 'Expert',
}

/**
 * Sous ce nombre de réponses, une question n'a pas de difficulté mesurée :
 * trois joueurs ne disent rien de la France entière. Elle passe pour moyenne.
 */
export const REPONSES_POUR_MESURER = 5

/**
 * La difficulté d'une question, lue sur la part de ceux qui l'ont trouvée.
 * Les seuils sont ceux de la consigne du quiz du jour : une facile, presque
 * tout le monde ; une moyenne, une personne sur deux ; une difficile, une
 * sur quatre au plus.
 */
export function niveauMesure(justes: number, total: number): Niveau | null {
  if (total < REPONSES_POUR_MESURER) return null
  const part = justes / total
  if (part >= 0.7) return 'facile'
  if (part >= 0.4) return 'moyen'
  if (part >= 0.2) return 'difficile'
  return 'expert'
}

/**
 * L'ordre d'une série : cinq de chaque marche, de la plus facile à la plus
 * dure, puis tout ce qui reste au plus dur. Chaque marche a déjà été battue
 * (mélangée) par l'appelant : la fonction ne tire rien, elle range.
 */
export function ordreDeSerie<T>(parNiveau: Record<Niveau, readonly T[]>, max = QUESTIONS_PAR_SERIE): { question: T; niveau: Niveau }[] {
  const pris = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
  const serie: { question: T; niveau: Niveau }[] = []
  const prendre = (n: Niveau, combien: number) => {
    const reste = parNiveau[n].slice(pris[n], pris[n] + combien)
    pris[n] += reste.length
    for (const question of reste) serie.push({ question, niveau: n })
  }
  for (const n of NIVEAUX) prendre(n, QUESTIONS_PAR_MARCHE)
  // Le reste, en montant : les plus dures d'abord n'auraient plus de sens
  // après l'expert ; on reprend où chaque marche s'était arrêtée.
  for (const n of [...NIVEAUX].reverse()) prendre(n, Infinity)
  return serie.slice(0, max)
}

/**
 * L'expérience d'une bonne réponse en campagne : celle d'une bonne réponse
 * en soirée (`XP.juste`), sans la présence ni le réflexe — rien ne presse,
 * il n'y a pas de chronomètre. Choisie le 3 octobre 2026.
 */
export const XP_PAR_JUSTE = XP.juste

/**
 * L'expérience d'une journée de campagne (à l'heure de Paris) : chaque bonne
 * réponse paie, sans plafond. Elle en avait un, quinze bonnes réponses par
 * jour, pour que la campagne, qui se rejoue sans fin, n'avale pas les
 * soirées ; le propriétaire l'a levé le 3 octobre 2026 : « que les gens
 * puissent augmenter à leur rythme ». Les journées d'avant se relisent sans
 * lui à la bonne réponse suivante, la ligne étant relue en entier.
 */
export function xpDuJourDeCampagne(justes: number): number {
  return Math.max(0, Math.floor(justes)) * XP_PAR_JUSTE
}

/** Toute l'expérience de campagne, journée par journée. */
export function xpDeCampagne(justesParJour: Iterable<number>): number {
  let xp = 0
  for (const n of justesParJour) xp += xpDuJourDeCampagne(n)
  return xp
}

/** Une question de la série, telle que le téléphone la reçoit : sans la bonne réponse. */
export interface QuestionDeCampagne {
  index: number
  texte: string
  reponses: string[]
  categorie: string | null
  niveau: Niveau
}

/** Ce que dit une réponse : juste ou non, la bonne, l'anecdote — et la suite. */
export interface ReponseDeCampagne {
  juste: boolean
  bonne: number
  anecdote: string | null
  vies: number
  justes: number
  finie: boolean
  /** Un record battu à la fin de la série. */
  record?: boolean
  /** L'expérience que cette réponse rapporte : celle d'une bonne réponse, 0 pour une fausse. */
  xp: number
  suivante?: QuestionDeCampagne
}

/** Une série, telle que sa page la reprend. */
export interface SerieDeCampagne {
  id: string
  vies: number
  justes: number
  total: number
  finie: boolean
  question?: QuestionDeCampagne
}

/** La page de la campagne : le record, la série en cours, ce qu'on peut viser. */
export interface EtatDeCampagne {
  record: number
  series: number
  /** L'expérience de campagne gagnée aujourd'hui (Paris). */
  xpAujourdhui: number
  enCours: SerieDeCampagne | null
  /** Les catégories qui ont des questions à jouer, et combien. */
  categories: { categorie: string; questions: number }[]
  /** Toutes catégories, les questions jouables : sous dix, la campagne attend que le quiz du jour en ait posé. */
  questions: number
}

/** Une question corrigée, à la fin d'une série : « Mes réponses ». */
export interface CorrectionDeCampagne {
  texte: string
  reponses: string[]
  bonne: number
  choix: number | null
  juste: boolean
  niveau: Niveau
  anecdote: string | null
}
