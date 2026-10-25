// Le chrono d'une manche du Cabinet, à l'heure du serveur (invariant 6) : le
// pli y juge si un geste arrive dans les temps, la vue y lit l'échéance qu'elle
// montre, la page la dessine à `echeance − serverNow()`. Pur : aucune
// minuterie au serveur — une manche expirée se juge au geste suivant, et rien
// n'est à réarmer au redémarrage (invariant 5, tenu par construction).
//
// Une étape s'ouvre à l'heure d'arrivée du geste qui l'ouvre (`ouvrir`,
// « Parier », le mot de la Réplique), écrite avec lui : un rechargement, un
// réveil du serveur ou une mise en ligne la retrouvent telle qu'elle a couru
// (D2). Le Pari et la Réplique ont un chrono par étape ; entre « Juste ! » et
// « Garder » ou « Parier », aucun ne court.
//
// La pause de « Quitter ? » recule l'échéance du temps passé sous la
// confirmation, trente secondes au plus par manche (`PAUSE_MAX_MS`), la manche
// voilée : la confirmation ne s'achète pas du temps de recherche. Au-delà, le
// chrono reprend sous le voile ; une pause oubliée — un téléphone qui s'endort
// sur la confirmation — n'est qu'une pause de trente secondes.
//
// La grâce et la pause sont des chiffres du barème : la page les importe de
// `bareme.ts`, elle ne les recopie pas.

import { GRACE_D_UNE_MANCHE_MS, PAUSE_MAX_MS } from './bareme'

/** Une pause de « Quitter ? » : de la confirmation ouverte à « Continuer » ; sans fin, elle dure encore. */
export interface PauseDUneEtape {
  depuis: number
  jusqua?: number
}

/** Le chrono d'une étape : quand elle s'est ouverte, ce qu'elle dure, ses pauses. */
export interface EtapeChronometree {
  ouverteLe: number
  /** Sa durée, « Prendre son temps » compris. */
  dureeMs: number
  pauses: readonly PauseDUneEtape[]
  /**
   * Ce qui restait, à son ouverture, des trente secondes de pause de la
   * manche : la seconde étape du Pari ou de la Réplique a ce que la première
   * n'a pas pris. Toute la pause, à la première étape.
   */
  pauseDisponibleMs: number
}

/** Une étape qui s'ouvre à `t`, avec ce qui reste de la pause de sa manche. */
export function etapeOuverte(t: number, dureeMs: number, pauseDisponibleMs: number = PAUSE_MAX_MS): EtapeChronometree {
  return { ouverteLe: t, dureeMs, pauses: [], pauseDisponibleMs: Math.max(0, Math.min(PAUSE_MAX_MS, pauseDisponibleMs)) }
}

/**
 * Le temps de pause que l'étape compte à `t` : chaque pause, celle qui dure
 * comptée jusqu'à `t`, bornées ensemble à ce qui était disponible. Au-delà,
 * le chrono reprend : la confirmation laissée ouverte ne recule plus rien.
 */
export function pauseCompteeMs(e: EtapeChronometree, t: number): number {
  let compte = 0
  for (const p of e.pauses) compte += Math.max(0, Math.min(p.jusqua ?? t, t) - p.depuis)
  return Math.min(compte, e.pauseDisponibleMs)
}

/** L'échéance de l'étape à `t` : son ouverture, sa durée, et la pause comptée — elle recule tant que la pause dure, dans sa borne. */
export function echeanceDe(e: EtapeChronometree, t: number): number {
  return e.ouverteLe + e.dureeMs + pauseCompteeMs(e, t)
}

/**
 * Un geste arrivé à `t` est-il dans les temps ? Jusqu'à l'échéance et la
 * grâce (`GRACE_D_UNE_MANCHE_MS`) : le réseau d'un téléphone. Après, la manche
 * se juge expirée — ce qu'un geste en retard portait ne compte pas.
 */
export const dansLesTemps = (e: EtapeChronometree, t: number): boolean => t <= echeanceDe(e, t) + GRACE_D_UNE_MANCHE_MS

/**
 * L'instant où l'étape cesse d'attendre : son échéance et sa grâce, la pause
 * qui dure encore comptée jusqu'au bout de sa borne. Quand une étape expire
 * sans qu'aucun geste ne le dise — un téléphone éteint —, le pli la tient pour
 * tranchée là : c'est l'heure de sa pièce, et celle où la seconde étape de la
 * Réplique s'ouvre.
 */
export function limiteDe(e: EtapeChronometree): number {
  return echeanceDe(e, Number.POSITIVE_INFINITY) + GRACE_D_UNE_MANCHE_MS
}

/** La pause en cours, s'il y en a une. */
export const pauseEnCours = (e: EtapeChronometree): PauseDUneEtape | undefined => e.pauses.find(p => p.jusqua === undefined)

/** Ce qui reste de pause à `t`, tant que la confirmation est ouverte : le chrono figé, la page le dessine ; à zéro, il reprend sous le voile. */
export function pauseResteMs(e: EtapeChronometree, t: number): number {
  return pauseEnCours(e) ? Math.max(0, e.pauseDisponibleMs - pauseCompteeMs(e, t)) : 0
}

/** Ce que l'étape laisse de pause à la suivante de sa manche. */
export const pauseLaisseeMs = (e: EtapeChronometree, t: number): number => Math.max(0, e.pauseDisponibleMs - pauseCompteeMs(e, t))
