// Ce que partagent les quatre jeux du Cabinet qui posent une question de la
// base de la campagne — le Pari, l'Éclair, le Mot mystère, le Filet : la
// question telle que la partie l'a tirée, la pièce qu'elle laisse au journal
// des réponses, et la lecture de ce que la page envoie.
//
// Le contrat avec le pli, le même pour les quatre : `trancheLaManche`
// (`regle.ts`) dit d'abord où va un geste — à `juger`, qui rend le verdict, ou
// à `apresLeGeste`, qui rend l'état d'après ou son refus en mots. Un geste qui
// tranche ne passe jamais par `apresLeGeste` : s'il s'y perd, il s'y refuse
// (`GESTE_A_JUGER`) sans rien changer, plutôt que d'être compté deux fois. Et
// l'état reste celui d'avant le geste qui tranche : la révélation relit ce
// qu'il portait dans le verdict (`choix`, `composee`), que le journal garde
// aussi.

import type { PieceDuCabinet } from '../pieces'
import { refusDuPouvoir } from '../pouvoirs'
import type { CleDeJeu, RegleDuJeu, VerdictDUneManche } from './regle'

/**
 * Une question de la base telle que la partie l'a tirée au départ : le cœur
 * d'une question de série — ses réponses mélangées, sa bonne, son anecdote, sa
 * marche mesurée —, celui que la pièce garde au journal. Elle ne part jamais
 * entière au téléphone (invariant 1) : chaque jeu en montre ce qu'il veut.
 */
export type QuestionTiree = Omit<PieceDuCabinet, 'forme' | 'cabinet'>

/** Les étoiles naturelles d'un barème — un chiffre de `bareme.ts`, typé `number` — bornées à ce qu'une manche vaut. */
export function naturelDe(etoiles: number): VerdictDUneManche['naturel'] {
  return Math.max(0, Math.min(3, Math.round(etoiles))) as VerdictDUneManche['naturel']
}

/**
 * La pièce d'une question de la base, telle que la partie l'a tirée : ses
 * réponses copiées — le plan figé du départ ne bouge pas avec elle —, sa forme
 * si elle en a une. Sans forme, la ligne est nue : elle mesure (seul le Pari
 * en écrit, sur sa première question).
 */
export function pieceDeLaQuestion(q: QuestionTiree, cabinet: PieceDuCabinet['cabinet'], forme?: string): PieceDuCabinet {
  return { ...q, reponses: [...q.reponses], ...(forme !== undefined && { forme }), cabinet: { ...cabinet } }
}

/**
 * Un élément tiré d'un hasard rejoué (`hasardDe`) : la même graine redonne le
 * même — recharger ne change ni la réponse effacée, ni la lettre soufflée. Le
 * dernier si le hasard rend 1, qu'un hasard d'essai peut rendre. La graine ne
 * doit rien à ce que la page connaît : qui la rejouerait saurait, de la
 * mauvaise réponse effacée, où est la bonne (`RegleDuJeu.eclairer`).
 */
export function auHasard<T>(liste: readonly T[], hasard: () => number): T {
  return liste[Math.min(liste.length - 1, Math.floor(hasard() * liste.length))]
}

/**
 * Le refus d'Éclairer quand la manche n'a plus rien à souffler, dit par la
 * seule règle des pouvoirs (`refusDuPouvoir`) : ses comptes à zéro, il n'y
 * reste que `aEclairer`. Chaque jeu le rend d'abord, quelle que soit la cible
 * — d'où `eclairerSertEncore`, la page grise sans rien recopier.
 */
export function rienAEclairer(jeu: CleDeJeu): string {
  const refus = refusDuPouvoir({ pouvoir: 'eclairer', force: 1, jeu, servi: 0, aEclairer: false })
  // Sans refus, le pli prendrait la réponse pour un état : une règle des pouvoirs changée doit se voir.
  if (refus === null) throw new TypeError('refusDuPouvoir ne refuse plus Éclairer quand il ne reste rien à éclairer')
  return refus
}

/**
 * Éclairer sert-il encore dans cette manche ? Ce que le pli pose dans
 * `UsageDUnPouvoir.aEclairer`. Le jeu le dit en refusant mot pour mot
 * `rienAEclairer` ; tout autre refus — « Choisis l'affirmation à éclairer » à
 * l'Éclair, appelé sans cible — laisse Éclairer jouable. Un essai pur, au
 * hasard nul : rien ne s'en garde.
 */
export function eclairerSertEncore<T, E>(r: Pick<RegleDuJeu<T, E, never, unknown, unknown>, 'cle' | 'eclairer'>, t: T, e: E): boolean {
  return r.eclairer(t, e, () => 0) !== rienAEclairer(r.cle)
}

/** Ce que rend `apresLeGeste` d'un geste qui tranche : il se juge, et rien ne change. Le pli ne l'y envoie pas. */
export const GESTE_A_JUGER = 'Ce geste se juge avec sa manche : recharge la page'

const estObjet = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === 'object' && x !== null && !Array.isArray(x)

/**
 * Le geste tel que la page l'envoie — `{ quoi: 'repondre', reponse: { pari: {
 * choix } } }`, `{ quoi: 'garder' }`, `{ quoi: 'essai', lettres }` —, réduit à
 * ses champs ; la manche et le rang, le pli les a déjà lus. Null : ce n'est pas
 * un geste.
 */
export function champsDuGeste(brut: unknown): (Readonly<Record<string, unknown>> & { quoi: string }) | null {
  return estObjet(brut) && typeof brut.quoi === 'string' ? (brut as Readonly<Record<string, unknown>> & { quoi: string }) : null
}

/**
 * Ce qu'un `repondre` porte, rangé sous la clé de son jeu (`reponse.filet`).
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

/** Un index de réponse que la page envoie : un entier parmi tant de propositions. */
export const estUnIndex = (x: unknown, propositions: number): x is number => Number.isInteger(x) && (x as number) >= 0 && (x as number) < propositions
