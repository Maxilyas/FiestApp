// Ce que partagent le Détail et la Frise : la lecture de ce que la page
// envoie, le hasard rejoué de la graine, le refus d'Éclairer quand il ne reste
// rien à souffler, et le contrat avec le pli.
//
// Le contrat, le même qu'aux autres jeux du Cabinet : `tranche` dit d'abord où
// va un geste — à `juger`, qui rend le verdict, ou à `apresLeGeste`, qui rend
// l'état d'après ou son refus en mots. Un geste qui tranche ne passe jamais
// par `apresLeGeste` : s'il s'y perd, il s'y refuse (`GESTE_A_JUGER`) sans
// rien changer, plutôt que d'être compté deux fois.
//
// Les autres jeux ont ces outils sous les mêmes noms, au même sens, mot pour
// mot : le registre des neuf jeux les rassemblera en une seule copie.

import { refusDuPouvoir } from '../pouvoirs'
import type { CleDeJeu, RegleDuJeu } from './regle'

/**
 * La règle d'un jeu, et ce qui dit au pli si un geste tranche la manche :
 * « Reculer » au Détail ne la tranche pas, une réponse si.
 */
export type RegleQuiTranche<Tiree, Etat, Geste, Montree, Revelee> = RegleDuJeu<Tiree, Etat, Geste, Montree, Revelee> & {
  tranche(t: Tiree, e: Etat, g: Geste): boolean
}

/** Ce que rend `apresLeGeste` d'un geste qui tranche : il se juge, et rien ne change. Le pli ne l'y envoie pas. */
export const GESTE_A_JUGER = 'Ce geste se juge avec sa manche : recharge la page'

/**
 * Le refus d'Éclairer quand la manche n'a plus rien à souffler, dit par la
 * seule règle des pouvoirs (`refusDuPouvoir`) : ses comptes à zéro, il n'y
 * reste que `aEclairer: false`. Le pli sait ainsi, en demandant Éclairer à la
 * règle du jeu, s'il sert encore — la page grise sans rien recopier.
 */
export function rienAEclairer(jeu: CleDeJeu): string {
  const refus = refusDuPouvoir({ pouvoir: 'eclairer', force: 1, jeu, servi: 0, aEclairer: false })
  // Sans refus, le pli prendrait la réponse pour un état : une règle des pouvoirs changée doit se voir.
  if (refus === null) throw new TypeError('refusDuPouvoir ne refuse plus Éclairer quand il ne reste rien à éclairer')
  return refus
}

/**
 * Un élément tiré du hasard rejoué de la graine (`hasardDe`) : la même graine
 * redonne le même — recharger ne change pas le titre effacé. Le dernier si le
 * hasard rend 1, qu'un hasard d'essai peut rendre.
 */
export function auHasard<T>(liste: readonly T[], hasard: () => number): T {
  return liste[Math.min(liste.length - 1, Math.floor(hasard() * liste.length))]
}

/** Fisher-Yates, sur le hasard qu'on lui donne : celui de la graine de la partie, qu'une reprise rejoue. */
export function battre<T>(tas: readonly T[], hasard: () => number): T[] {
  const battu = [...tas]
  for (let i = battu.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(hasard() * (i + 1)))
    ;[battu[i], battu[j]] = [battu[j], battu[i]]
  }
  return battu
}

const estObjet = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === 'object' && x !== null && !Array.isArray(x)

/**
 * Le geste tel que la page l'envoie — `{ quoi: 'repondre', reponse: { detail:
 * { titre } } }`, `{ quoi: 'reculer' }` —, réduit à ses champs ; la manche et
 * le rang, le pli les a déjà lus. Null : ce n'est pas un geste.
 */
export function champsDuGeste(brut: unknown): (Readonly<Record<string, unknown>> & { quoi: string }) | null {
  return estObjet(brut) && typeof brut.quoi === 'string' ? (brut as Readonly<Record<string, unknown>> & { quoi: string }) : null
}

/**
 * Ce qu'un `repondre` porte, rangé sous la clé de son jeu (`reponse.frise`).
 * Undefined : rien n'est parti — la page envoie d'elle-même à l'échéance ce
 * qu'elle a sous les yeux, et parfois rien ; null : illisible, ou d'un autre jeu.
 */
export function reponseEnvoyee(g: Readonly<Record<string, unknown>>, jeu: CleDeJeu): Readonly<Record<string, unknown>> | null | undefined {
  if (g.reponse === undefined || g.reponse === null) return undefined
  if (!estObjet(g.reponse)) return null
  // Sa propre clé seulement : un objet répond aussi de son prototype.
  const siens = Object.hasOwn(g.reponse, jeu) ? g.reponse[jeu] : undefined
  return estObjet(siens) ? siens : null
}

/** Un index que la page envoie : un entier parmi tant de propositions. */
export const estUnIndex = (x: unknown, propositions: number): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) < propositions
