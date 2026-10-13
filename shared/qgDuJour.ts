// Le quiz du jour au QG (`/admin#jour`) : ce que la page montre à côté de la
// réserve et des signalements — le tirage d'aujourd'hui question par
// question, le classement du mois, les séries qui tiennent encore, le rappel
// du soir (le choix du 13 octobre 2026, sur maquettes). Les dérivations sont
// pures : le serveur les applique, la page et les tests les relisent.

import type { LigneDuJour } from './jour'

/** Une question du tirage d'aujourd'hui, et ce que les joueurs y ont répondu. */
export interface QuestionDuSuivi {
  index: number
  reserveId: string
  texte: string
  categorie: string | null
  /** Ses réponses, dans l'ordre du tirage : le même pour tous. */
  reponses: string[]
  bonne: number
  /** Les réponses données, choix par choix, dans l'ordre de `reponses`. */
  parReponse: number[]
  /** Posée sans réponse : le temps écoulé, ou une réponse arrivée après la fin. */
  sansReponse: number
  /** Le temps moyen d'une réponse donnée, en millisecondes ; null sans réponse. */
  msMoyen: number | null
  annulee: boolean
  /** Ses signalements pas encore traités. */
  signalements: number
}

/** Des bonnes réponses, et sur combien de questions posées. */
export interface PartDesBonnes {
  justes: number
  sur: number
}

/** Ce qu'une tournée du rappel du soir a fait, un soir : des nombres, jamais un nom. */
export interface TourneeDuRappel {
  jour: string
  envoyes: number
  /** Ceux qui avaient déjà fini leur partie : rien à leur rappeler. */
  finis: number
  /** Les abonnements défaits : session close, ou le service les dit morts. */
  retires: number
  echecs: number
}

/**
 * Les longueurs qu'on lit d'une série : la semaine, le mois, la centaine. Une
 * série d'un jour est une série : elle tient jusqu'à minuit.
 */
export const TRANCHES_DE_SERIE = [
  { nom: '1 à 6 jours', de: 1 },
  { nom: '7 à 29 jours', de: 7 },
  { nom: '30 à 99 jours', de: 30 },
  { nom: '100 jours et plus', de: 100 },
] as const

/** Les plus longues séries que la page nomme. */
export const SERIES_NOMMEES = 3

export interface SerieNommee {
  profileId: string
  nom: string
  avatar: string
  serie: number
  /** Aujourd'hui déjà joué. */
  tenue: boolean
}

export interface SeriesEnCours {
  /** Les joueurs dont la série tient encore, tranche par tranche (`TRANCHES_DE_SERIE`). */
  parTranche: number[]
  total: number
  plusLongues: SerieNommee[]
  /** Les sabliers achetés depuis le premier du mois. */
  sabliersDuMois: number
}

export interface SuiviDuJour {
  maintenant: number
  /** Le jour de Paris. */
  jour: string
  parties: { commencees: number; finies: number }
  /** Aujourd'hui, sur les questions qui comptent encore — les annulées écartées —, et hier. */
  bonnes: { aujourdhui: PartDesBonnes; hier: PartDesBonnes | null }
  /** Le tirage d'aujourd'hui ; vide tant que personne ne l'a demandé. */
  questions: QuestionDuSuivi[]
  /** Le classement du mois, tel que les joueurs le voient : les masqués écartés, comptés à part. */
  mois: { mois: string; joueurs: number; lignes: LigneDuJour[]; masques: number }
  series: SeriesEnCours
  rappel: { telephones: number; profils: number; tournees: TourneeDuRappel[] }
}

/** Les premiers du mois que la page montre ; la page du quiz du jour en a cinquante pour les joueurs. */
export const LIGNES_DU_MOIS_AU_QG = 10

/** Les soirs du rappel que la page relit. */
export const TOURNEES_MONTREES = 7

/** Les séries, tranche par tranche : une série nulle ne tient pas, elle n'est comptée nulle part. */
export function repartirLesSeries(series: readonly number[]): number[] {
  const parTranche = TRANCHES_DE_SERIE.map(() => 0)
  for (const n of series) {
    if (n < 1) continue
    let i = TRANCHES_DE_SERIE.length - 1
    while (i > 0 && n < TRANCHES_DE_SERIE[i].de) i--
    parTranche[i]++
  }
  return parTranche
}

/**
 * Les bonnes réponses d'un tirage, sur les questions posées qui comptent
 * encore : une question annulée ne compte plus pour personne, ni au
 * numérateur ni au dénominateur ; une question laissée au temps compte comme
 * une faute — le joueur l'a vue.
 */
export function partDesBonnes(questions: readonly Pick<QuestionDuSuivi, 'parReponse' | 'sansReponse' | 'bonne' | 'annulee'>[]): PartDesBonnes {
  let justes = 0
  let sur = 0
  for (const q of questions) {
    if (q.annulee) continue
    justes += q.parReponse[q.bonne] ?? 0
    sur += q.parReponse.reduce((n, x) => n + x, 0) + q.sansReponse
  }
  return { justes, sur }
}

/** Une part en pour cent entiers ; null quand rien ne la fonde. */
export function enPourcents(p: PartDesBonnes): number | null {
  return p.sur > 0 ? Math.round((p.justes / p.sur) * 100) : null
}

/**
 * Ce qu'une question a recueilli, des lignes de `jour_reponses` groupées par
 * choix : `[choix, n, ms, chronometrees]`, `choix` nul pour une question
 * posée sans réponse, `ms` la somme des temps des réponses données et
 * `chronometrees` combien en avaient un. Un choix hors des réponses ne se
 * compte nulle part : la page ne saurait pas où le mettre.
 */
export function recueilDeLaQuestion(
  nReponses: number,
  lignes: readonly (readonly [number | null, number, number | null, number])[],
): Pick<QuestionDuSuivi, 'parReponse' | 'sansReponse' | 'msMoyen'> {
  const parReponse = Array.from({ length: nReponses }, () => 0)
  let sansReponse = 0
  let ms = 0
  let chronometrees = 0
  for (const [choix, n, somme, avecTemps] of lignes) {
    if (choix === null) {
      sansReponse += n
      continue
    }
    if (!Number.isInteger(choix) || choix < 0 || choix >= nReponses) continue
    parReponse[choix] += n
    if (somme !== null && avecTemps > 0) {
      ms += somme
      chronometrees += avecTemps
    }
  }
  return { parReponse, sansReponse, msMoyen: chronometrees > 0 ? Math.round(ms / chronometrees) : null }
}
