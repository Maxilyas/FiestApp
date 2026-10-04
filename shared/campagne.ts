// La campagne solo : une série de questions qui montent en difficulté, trois
// vies, sans chronomètre. Elle se joue seul, avec son profil, quand on veut
// — l'entre-deux des soirées, comme le quiz du jour, mais sans rendez-vous.
//
// Une bonne réponse y rapporte l'expérience d'une bonne réponse en soirée,
// sans plafond — chacun monte à son rythme —, et un confetti.
//
// Ses questions viennent de sa base à elle (`server/src/core/baseCampagne.ts`),
// écrite et étiquetée d'avance, jamais de la réserve du quiz du jour : elle
// en reposait les questions, vues et corrigées chaque matin (le choix du
// propriétaire du 3 octobre 2026). Un joueur n'y revoit une question
// qu'une fois toutes les autres de sa marche passées.

import { XP } from './profil'

/** Les vies d'une série : la troisième erreur la termine. */
export const VIES = 3

/** Au plus, les questions d'une série : au-delà, on a tout gagné. */
export const QUESTIONS_PAR_SERIE = 60

/** Combien de questions par marche avant que la difficulté monte. */
export const QUESTIONS_PAR_MARCHE = 5

/** Sous ce nombre de questions jouables, la campagne attend : une série de trois questions n'en est pas une. */
export const QUESTIONS_POUR_JOUER = 10

export type Niveau = 'facile' | 'moyen' | 'difficile' | 'expert'

export const NIVEAUX: readonly Niveau[] = ['facile', 'moyen', 'difficile', 'expert']

export const NOM_NIVEAU: Record<Niveau, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
  expert: 'Expert',
}

/**
 * Sous ce nombre de réponses, une question du quiz du jour n'a pas de
 * difficulté mesurée : trois joueurs ne disent rien de la France entière.
 */
export const REPONSES_POUR_MESURER = 5

/**
 * Le niveau d'une part de joueurs qui trouvent. Les seuils sont ceux de la
 * consigne du quiz du jour : une facile, presque tout le monde ; une
 * moyenne, une personne sur deux ; une difficile, une sur quatre au plus.
 */
export function niveauDuTaux(part: number): Niveau {
  if (part >= 0.7) return 'facile'
  if (part >= 0.4) return 'moyen'
  if (part >= 0.2) return 'difficile'
  return 'expert'
}

/** La difficulté d'une question du quiz du jour, lue sur la part de ceux qui l'ont trouvée (la consigne de la réserve). */
export function niveauMesure(justes: number, total: number): Niveau | null {
  return total < REPONSES_POUR_MESURER ? null : niveauDuTaux(justes / total)
}

/**
 * La part de joueurs qu'on attend d'une question avant toute réponse : sa
 * difficulté estimée à l'écriture (de 1 à 5, `shared/etiquettes.ts`). Par
 * les seuils de `niveauDuTaux`, 1 et 2 sont faciles, 3 moyenne, 4 difficile,
 * 5 experte.
 */
export const TAUX_A_PRIORI: Readonly<Record<number, number>> = { 1: 0.9, 2: 0.8, 3: 0.55, 4: 0.3, 5: 0.1 }

/**
 * Ce que pèse l'a priori, en réponses fictives : « 3 sur 4 » ne dit rien,
 * « 300 sur 400 », si. À vingt, il faut trois réponses contraires d'affilée
 * pour qu'une question au bord de sa marche en change — une 2 que trois
 * joueurs ratent, une 5 que trois joueurs trouvent —, et une centaine
 * pour que l'estimation ne compte presque plus. À dix, une seule réponse
 * suffisait : la question qu'un seul joueur fort trouvait quittait l'expert.
 */
export const REPONSES_FICTIVES = 20

/**
 * La part lissée de joueurs qui trouvent une question de campagne : ses
 * vraies réponses mêlées à des réponses fictives tirées de son a priori,
 * qui s'effacent à mesure que les vraies arrivent. Sans elle, une question
 * jamais jouée passait pour moyenne, et une série où presque rien n'était
 * mesuré ne montait pas (l'état des lieux du 3 octobre 2026).
 */
export function tauxLisse(difficulte: number, justes = 0, total = 0): number {
  const a = TAUX_A_PRIORI[difficulte] ?? TAUX_A_PRIORI[3]
  return (justes + REPONSES_FICTIVES * a) / (total + REPONSES_FICTIVES)
}

/** Le niveau d'une question de la base : son a priori, corrigé par les réponses de campagne. */
export function niveauDeQuestion(difficulte: number, mesure?: { justes: number; total: number }): Niveau {
  return niveauDuTaux(tauxLisse(difficulte, mesure?.justes, mesure?.total))
}

/** Un signalement tient en une phrase : celle de l'écran, comme au quiz du jour. */
export const SIGNALEMENT_MAX = 280

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
 * puissent augmenter à leur rythme ». La journée ne sert plus qu'à dire ce
 * qu'aujourd'hui a rapporté.
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
  /** À la fin de la série : le record d'avant elle — « L'ancien était de 12 ». */
  recordAvant?: number
  /** À la fin de la série : la marche la plus haute qu'elle a atteinte. */
  niveauAtteint?: Niveau
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
  /** Toutes catégories, les questions que la campagne peut poser : sous dix, elle attend. */
  questions: number
}

/** Une question que des joueurs ont signalée, pour l'administrateur (`/admin#campagne`). */
export interface SignalementDeCampagne {
  questionId: string
  texte: string
  reponses: string[]
  bonne: number
  anecdote: string | null
  categorie: string
  sousTheme: string
  /** Combien de joueurs la signalent, et ce que disent les trois derniers. */
  joueurs: number
  textes: string[]
  dernier: number
}

/** La campagne, côté administrateur : sa base, et ce que les joueurs y signalent. */
export interface AdminDeLaCampagne {
  /** Toute la base, et ce que la campagne peut en poser : moins les questions retirées, et celles du quiz du jour. */
  questions: number
  jouables: number
  retirees: number
  parCategorie: { categorie: string; questions: number }[]
  signalements: SignalementDeCampagne[]
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
