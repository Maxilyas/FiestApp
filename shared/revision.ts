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

/** Ce que le carnet tient d'une catégorie, ou d'un sujet. */
export interface PartDuCarnet {
  /** Ses questions dont le rendez-vous est arrivé, ou passé. */
  aRevoir: number
  /** Tout ce qu'il en tient — à revoir, en route, appris : ce que « Tout revoir » y reprendrait. */
  enTout: number
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
  /**
   * Ce qu'il tient de chaque catégorie, dans l'ordre de la liste fixe —
   * celles où il a quelque chose seulement : de quoi viser une révision, et
   * savoir combien attendent dans chacune (le retour d'un joueur du 14 octobre
   * 2026 : « cibler un thème à revoir, et savoir combien de questions »).
   */
  categories: ({ categorie: string } & PartDuCarnet)[]
  /**
   * De même par sujet — thème, époque, fil rouge (`shared/sujets.ts`) —, dans
   * l'ordre de `SUJETS`. Une question en a plusieurs, ou aucun : leurs comptes
   * ne s'additionnent pas.
   */
  sujets: ({ sujet: string } & PartDuCarnet)[]
}

/** Ce qu'une révision vise : des catégories — aucune, tout le carnet —, ou un sujet qui les traverse. */
export interface ViseeDuCarnet {
  categories: readonly string[]
  sujet: string | null
}

/** Tout le carnet : la visée d'office. */
export const TOUT_LE_CARNET: ViseeDuCarnet = { categories: [], sujet: null }

/**
 * Ce que le carnet tient de ce qu'on vise : ce qui est à revoir aujourd'hui,
 * et tout ce qu'il en a. Plusieurs catégories s'additionnent — une question
 * n'en a qu'une ; un sujet se lit seul.
 */
export function partVisee(carnet: Pick<EtatDuCarnet, 'aRevoir' | 'demain' | 'plusTard' | 'appris' | 'categories' | 'sujets'>, visee: ViseeDuCarnet): PartDuCarnet {
  if (visee.sujet) {
    const s = carnet.sujets.find(x => x.sujet === visee.sujet)
    return { aRevoir: s?.aRevoir ?? 0, enTout: s?.enTout ?? 0 }
  }
  if (visee.categories.length === 0) return { aRevoir: carnet.aRevoir, enTout: carnet.aRevoir + carnet.demain + carnet.plusTard + carnet.appris }
  const part = { aRevoir: 0, enTout: 0 }
  for (const c of carnet.categories) {
    if (!visee.categories.includes(c.categorie)) continue
    part.aRevoir += c.aRevoir
    part.enTout += c.enTout
  }
  return part
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
  /** Revue en avance (« Revoir tout mon carnet ») et retrouvée : rien ne bouge, elle garde son rendez-vous ou reste apprise. */
  enAvance?: true
}

/**
 * Où en était une question qu'une révision reprend en avance : pas encore à
 * son rendez-vous, ou déjà apprise. Rien : elle y était.
 */
export type EnAvance = { apprise: true } | { revientLe: string }

/**
 * Ce que la page dit d'une question après sa réponse en révision : le suivi
 * d'avant, la réponse, et la suite. Revue en avance, une bonne réponse ne la
 * fait pas avancer (`apresUnPassage` : trouvée avant son rendez-vous, elle ne
 * prouve rien) — elle garde sa place ; une erreur la remet au premier
 * rendez-vous, même apprise, comme toujours.
 */
export function suiteDeLaRevision(etapeAvant: number, juste: boolean, enAvance?: EnAvance, aujourdhui?: string): SuiteDeLaRevision {
  if (!juste) return { etape: 0, dans: INTERVALLES_DE_REVISION[0] }
  if (enAvance && 'apprise' in enAvance) return { etape: INTERVALLES_DE_REVISION.length, apprise: true, enAvance: true }
  if (enAvance && aujourdhui && aujourdhui < enAvance.revientLe) return { etape: etapeAvant, dans: joursEntre(aujourdhui, enAvance.revientLe), enAvance: true }
  const etape = etapeAvant + 1
  return etape >= INTERVALLES_DE_REVISION.length ? { etape, apprise: true } : { etape, dans: INTERVALLES_DE_REVISION[etape] }
}

/** Les jours du calendrier de `de` à `a` (« 2026-10-11 » → « 2026-10-14 » : 3) : des jours de Paris, comptés sur leurs dates. */
export function joursEntre(de: string, a: string): number {
  const date = (j: string) => Date.UTC(Number(j.slice(0, 4)), Number(j.slice(5, 7)) - 1, Number(j.slice(8, 10)))
  return Math.round((date(a) - date(de)) / 86_400_000)
}
