// Les duels au QG (`/admin#duels`) : ce que la page montre — les duels joués
// aujourd'hui, ceux contre Automate et ceux classés entre joueurs jour par
// jour, les ligues et le classement — et son « Masquer » —, les duels classés
// qui attendent leur adversaire — et les annuler (le choix du 13 octobre 2026,
// sur maquettes). Les dérivations sont pures : le serveur les applique, la
// page et les tests les relisent.

import { compteDuJour, jourDeLInstant, joursDesMinuits, type CompteDuJour } from './qg'
import type { CleDeLigue, LigneDesDuels } from './duels'

/** Les duels dans la vue d'ensemble : tirés des séries qu'elle a déjà lues, comme la campagne. */
export interface DuelsDeLaVue {
  /** Les parties de duel commencées chaque jour : contre Automate (`rencontre`), contre un joueur (`duel`). */
  parJour: { jour: string; automate: number; contre: number }[]
  /** Ceux qui ont joué un duel aujourd'hui, comparés à la même heure des sept jours d'avant. */
  joueurs: CompteDuJour
}

/**
 * Ce que la vue d'ensemble dit des duels : les parties commencées chaque
 * jour, contre Automate — une rencontre — ou contre un joueur — un duel
 * classé, ou un défi entre amis d'avant —, et ceux qui en ont joué.
 */
export function duelsDeLaVue(series: readonly { quand: number; qui: string; mode: string | null }[], minuits: readonly number[], maintenant: number): DuelsDeLaVue {
  const jours = joursDesMinuits(minuits)
  const parJour = minuits.map(() => ({ automate: 0, contre: 0 }))
  const duels: { quand: number; qui: string }[] = []
  for (const s of series) {
    if ((s.mode !== 'rencontre' && s.mode !== 'duel') || s.quand > maintenant) continue
    const i = jourDeLInstant(minuits, s.quand)
    if (i < 0) continue
    duels.push(s)
    if (s.mode === 'rencontre') parJour[i].automate++
    else parJour[i].contre++
  }
  return {
    parJour: jours.map((jour, i) => ({ jour, ...parJour[i] })),
    joueurs: compteDuJour(duels, minuits, maintenant, { distincts: true }),
  }
}

/** Le classement que le QG montre : ses premiers, tels que les joueurs les voient. */
export const LIGNES_DU_CLASSEMENT_AU_QG = 10
/** Les duels en attente que la page nomme : les plus près d'expirer d'abord. */
export const DUELS_EN_ATTENTE_MONTRES = 20

/** Un joueur d'un duel, nommé pour l'administrateur. */
export interface JoueurDuDuel {
  id: string
  nom: string
  avatar: string
}

/**
 * Un duel classé parti à celui qu'il défie, qu'il n'a pas commencé : il
 * attend. Fermé ainsi, il ne compte pour personne — c'est ce qu'« Annuler »
 * fait plus tôt.
 */
export interface DuelEnAttente {
  code: string
  auteur: JoueurDuDuel
  adversaire: JoueurDuDuel
  /** Quand il est parti à l'adversaire : à la dernière réponse de qui l'a lancé. */
  envoyeLe: number
  fermeLe: number
}

export interface SuiviDesDuels {
  maintenant: number
  /** Les trente jours, le plus ancien d'abord, aujourd'hui en dernier. */
  jours: string[]
  /** Les duels classés lancés chaque jour, et, sur les trente jours, ceux joués des deux côtés. */
  lances: number[]
  jouesDesDeuxCotes: number
  /** Ceux qui ont fini un duel classé ces quatre dernières semaines, par ligue, des bronzes aux maîtres — comme le classement : ni les masqués ni les suspendus. */
  ligues: { cle: CleDeLigue; joueurs: number }[]
  /** La semaine dernière : ceux que leurs duels ont payés en confettis de ligue, et combien. */
  semainePassee: { semaine: string; payes: number; confettis: number }
  /** Le classement tel que les joueurs le voient, ses premiers, et combien il en classe. */
  classement: { joueurs: number; lignes: LigneDesDuels[] }
  /** Les duels qui attendent leur adversaire, les plus près d'expirer d'abord ; et ceux fermés sans réponse ces sept derniers jours. */
  attente: { duels: DuelEnAttente[]; total: number; plusAncien: number | null; fermesSansReponse: number }
}

/** Les joueurs classés, par ligue : la clé de chacun, rangée dans l'ordre des ligues. */
export function joueursParLigue(cles: readonly CleDeLigue[], ordre: readonly CleDeLigue[]): { cle: CleDeLigue; joueurs: number }[] {
  return ordre.map(cle => ({ cle, joueurs: cles.filter(c => c === cle).length }))
}
