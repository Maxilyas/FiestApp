// Le carnet de révision : ce qu'on a raté en campagne revient, à intervalles
// qui s'allongent, jusqu'à ce qu'on le sache. Un retour de joueur du
// 10 octobre 2026 cherchait « un mode qui incite à l'apprentissage, où l'on
// gagne toujours quelque chose, où l'on progresse sans frustration » : la
// série punit l'erreur — une vie de moins —, le carnet en fait un rendez-vous.
//
// Rien ne se tient à côté : le carnet se relit dans le journal des réponses
// de campagne (`campagne_reponses`), séries, épreuves, défis et révisions
// ensemble, comme l'expérience et les confettis. Une règle changée ici vaut
// donc aussitôt pour tout ce qui a été joué avant elle.

import { jourAvant, jourDe } from './jour'
import type { SerieDeCampagne } from './campagne'

/**
 * Les rendez-vous d'une question ratée, en jours : le lendemain, trois jours
 * après, puis une semaine (le choix du 10 octobre 2026, un choix de produit).
 * Retrouvée à chacun, elle est apprise. Un rendez-vous se compte au jour de
 * Paris, comme les vies des sentiers : « reviens demain » se comprend, « dans
 * vingt-quatre heures » se calcule.
 */
export const INTERVALLES_DE_REVISION: readonly number[] = [1, 3, 7]

/** Une révision pose au plus dix questions : cinq minutes, pas une corvée. */
export const QUESTIONS_PAR_REVISION = 10

/**
 * Où en est une question ratée : à revoir — ses rendez-vous réussis, et le
 * jour du prochain —, ou apprise, et quand.
 */
export type SuiviDeRevision = { apprise: false; etape: number; revientLe: string } | { apprise: true; le: string }

/**
 * Une réponse de plus à une question, et ce qu'il en reste. Une erreur la
 * remet au premier rendez-vous, même apprise : on l'a oubliée. Une bonne
 * réponse ne compte que le jour du rendez-vous ou après — trouvée cinq
 * minutes après l'avoir ratée, en série, elle ne prouve rien —, et une
 * question jamais ratée n'entre pas au carnet.
 */
export function apresUnPassage(suivi: SuiviDeRevision | null, jour: string, juste: boolean): SuiviDeRevision | null {
  if (!juste) return { apprise: false, etape: 0, revientLe: jourAvant(jour, -INTERVALLES_DE_REVISION[0]) }
  if (!suivi || suivi.apprise || jour < suivi.revientLe) return suivi
  const etape = suivi.etape + 1
  return etape >= INTERVALLES_DE_REVISION.length ? { apprise: true, le: jour } : { apprise: false, etape, revientLe: jourAvant(jour, -INTERVALLES_DE_REVISION[etape]) }
}

/** Le suivi d'une question, de toutes ses réponses dans l'ordre où elles sont venues ; null : jamais ratée. */
export function suiviDeLaQuestion(passages: readonly { le: number; juste: boolean }[]): SuiviDeRevision | null {
  let suivi: SuiviDeRevision | null = null
  for (const p of passages) suivi = apresUnPassage(suivi, jourDe(p.le), p.juste)
  return suivi
}

/** La page du carnet (`GET /api/campagne/carnet`). */
export interface EtatDuCarnet {
  /** Les questions dont le rendez-vous est arrivé, ou passé. */
  aRevoir: number
  /** Celles qui attendent le leur : demain, puis plus tard. */
  demain: number
  plusTard: number
  /** Le premier jour, après aujourd'hui, où l'une revient ; null : rien en route. */
  prochainJour: string | null
  /** Ce qu'il a appris : retrouvé à chaque rendez-vous. */
  appris: number
  /** La révision laissée en route : elle se reprend. */
  enCours: SerieDeCampagne | null
}

/** Un fait appris, tel que le carnet le redonne : la question, sa réponse, son anecdote. */
export interface FaitAppris {
  texte: string
  reponse: string
  anecdote: string | null
  categorie: string
  /** Le jour où il l'a retrouvé pour la dernière fois. */
  le: string
}

/** Ce qu'une réponse de révision dit de sa question : apprise, ou dans combien de jours elle revient. */
export interface SuiteDeLaRevision {
  /** Ses rendez-vous réussis, après cette réponse. */
  etape: number
  apprise?: true
  /** Dans combien de jours elle revient ; absent : apprise. */
  dans?: number
}

/** Ce que la page dit d'une question après sa réponse en révision : le suivi d'avant, la réponse, et la suite. */
export function suiteDeLaRevision(etapeAvant: number, juste: boolean): SuiteDeLaRevision {
  if (!juste) return { etape: 0, dans: INTERVALLES_DE_REVISION[0] }
  const etape = etapeAvant + 1
  return etape >= INTERVALLES_DE_REVISION.length ? { etape, apprise: true } : { etape, dans: INTERVALLES_DE_REVISION[etape] }
}
