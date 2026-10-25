// Ce que partagent les trois jeux du Cabinet qui posent le contenu neuf — des
// lieux datés à l'Épingle, des fiches « Qui suis-je ? » aux Indices, des
// répliques à la Réplique (`shared/cabinet/contenu.ts`) : la pièce qu'ils
// laissent au journal des réponses, hors de la base, et la lecture de ce que
// la page envoie.
//
// Le contrat avec le pli, le même qu'aux jeux de la base : `tranche` dit
// d'abord où va un geste — à `juger`, qui rend le verdict, ou à
// `apresLeGeste`, qui rend l'état d'après ou son refus en mots. Un geste qui
// tranche ne passe jamais par `apresLeGeste` : s'il s'y perd, il s'y refuse
// (`GESTE_A_JUGER`) sans rien changer, plutôt que d'être compté deux fois. Et
// l'état reste celui d'avant le geste qui tranche : la révélation relit ce
// qu'il portait dans le verdict (`choix`, `composee`), que le journal garde
// aussi — une partie finie se révèle par le même chemin que la manche en
// cours (invariant 14).
//
// Les outils de lecture (`champsDuGeste`, `reponseEnvoyee`, `rienAEclairer`,
// `battre`…) ont les noms et le sens de ceux des jeux de la base : le registre
// des neuf jeux les rassemblera en une seule copie.
//
// Aucun des trois ne tire Éclairer du hasard que le pli lui passe, rejoué de
// la graine de la partie : la page sait la refaire (son profil, sa partie, le
// rang qu'elle envoie), et ce qu'Éclairer en aurait tiré — le centre de la
// zone, le mot effacé — l'aurait menée à la réponse. Ce qu'il dévoile se tire
// au départ, du hasard du tireur, et se fige dans le plan, qui ne part jamais.

import type { PieceDuCabinet } from '../pieces'
import { refusDuPouvoir } from '../pouvoirs'
import type { CleDeJeu, RegleDuJeu, VerdictDUneManche } from './regle'

/** Les trois jeux du contenu neuf. */
export type JeuDuContenu = Extract<CleDeJeu, 'epingle' | 'indices' | 'replique'>

/**
 * La règle d'un jeu dont un geste tranche ou non selon l'état : un nom juste
 * aux Indices, ou faux au dernier indice ; « Qui l'a dit ? » à la seconde
 * étape de la Réplique ; une épingle plantée en France. Le pli le demande
 * avant tout, comme aux jeux de la base.
 */
export type RegleQuiTranche<Tiree, Etat, Geste, Montree, Revelee> = RegleDuJeu<Tiree, Etat, Geste, Montree, Revelee> & {
  tranche(t: Tiree, e: Etat, g: Geste): boolean
}

/** Ce que rend `apresLeGeste` d'un geste qui tranche : il se juge, et rien ne change. Le pli ne l'y envoie pas. */
export const GESTE_A_JUGER = 'Ce geste se juge avec sa manche : recharge la page'

/** Ce qu'une `composee` écrit à la place d'une réponse qui n'est pas venue — comme une affirmation pas répondue à l'Éclair. */
export const SANS_REPONSE = '.'

/** Les étoiles naturelles d'un barème — un chiffre de `bareme.ts`, typé `number` — bornées à ce qu'une manche vaut. */
export function naturelDe(etoiles: number): VerdictDUneManche['naturel'] {
  return Math.max(0, Math.min(3, Math.round(etoiles))) as VerdictDUneManche['naturel']
}

/**
 * La colonne `choix` d'une pièce du contenu neuf : 0 juste, −1 fausse, null
 * quand rien n'a été répondu — il l'a vue, elle compte aux vues, sans réponse.
 */
export const choixDe = (repondue: boolean, juste: boolean): 0 | -1 | null => (!repondue ? null : juste ? 0 : -1)

/**
 * Fisher-Yates, sur le hasard qu'on lui donne : celui du tireur, au départ — la
 * reprise relit le plan battu, elle ne rebat rien. Borné au dernier si le
 * hasard rend 1, qu'un hasard d'essai peut rendre.
 */
export function battre<T>(tas: readonly T[], hasard: () => number): T[] {
  const battu = [...tas]
  for (let i = battu.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(hasard() * (i + 1)))
    ;[battu[i], battu[j]] = [battu[j], battu[i]]
  }
  return battu
}

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

const estObjet = (x: unknown): x is Readonly<Record<string, unknown>> => typeof x === 'object' && x !== null && !Array.isArray(x)

/**
 * Le geste tel que la page l'envoie — `{ quoi: 'repondre', reponse: { epingle:
 * { lat, lon } } }`, `{ quoi: 'nom', texte }`, `{ quoi: 'mot', choix }` —,
 * réduit à ses champs ; la manche et le rang, le pli les a déjà lus. Null : ce
 * n'est pas un geste.
 */
export function champsDuGeste(brut: unknown): (Readonly<Record<string, unknown>> & { quoi: string }) | null {
  return estObjet(brut) && typeof brut.quoi === 'string' ? (brut as Readonly<Record<string, unknown>> & { quoi: string }) : null
}

/**
 * Ce qu'un `repondre` porte, rangé sous la clé de son jeu (`reponse.epingle`).
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

/** Ce que la pièce d'un contenu neuf dit d'elle : ce qu'elle demandait, sa réponse en clair, d'où vient sa catégorie. */
export interface ContenuDUnePiece {
  /** L'identifiant préfixé (`idDuLieu`, `idDeLaFiche`, `idDeLaReplique`) : hors de la base, ni carnet, ni signalement, ni mesure. */
  id: string
  texte: string
  /** La réponse dite (« Orléans (Loiret), 1429 ») : le cartel et « Mes réponses » la relisent. */
  reponse: string
  categorie: string
  /** « Le savais-tu ? » du contenu. */
  anecdote: string | null
}

/**
 * La pièce d'un contenu neuf, telle que `campagne_series.questions` la garde à
 * la position de sa réponse : la réponse dite pour seule réponse, et la marche
 * `moyen` — un contenu neuf n'a pas de marche mesurée. Elle porte toujours la
 * forme de son jeu : jamais nue, elle ne compte ni à la mesure ni à L'Érudit.
 */
export function pieceDuContenu(c: ContenuDUnePiece, jeu: JeuDuContenu, i: { manche: 0 | 1 | 2; tirage: number }): PieceDuCabinet {
  return {
    id: c.id,
    texte: c.texte,
    reponses: [c.reponse],
    bonne: 0,
    categorie: c.categorie,
    anecdote: c.anecdote,
    niveau: 'moyen',
    forme: jeu,
    cabinet: { jeu, manche: i.manche, tirage: i.tirage },
  }
}
