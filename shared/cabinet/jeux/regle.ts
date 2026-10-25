// Le moule des neuf jeux du Cabinet : ce que chacun dit de lui à l'annonce
// (`JEUX`), et la forme que prend sa règle (`RegleDuJeu`). Chaque jeu vit dans
// son module pur, à côté de celui-ci ; un registre les rassemble, typé par
// `CleDeJeu` : un jeu de plus qui oublie une pièce ne compile pas.
//
// Ici, pas une règle de jugement : les noms, les gestes, les barèmes dits, ce
// qu'Éclairer fait à chaque jeu. La page les lit pour l'annonce sans tirer les
// jeux eux-mêmes — elle n'en importe que ce qui ne juge pas (invariant 1). Les
// barèmes dits se composent des chiffres de `bareme.ts` : un barème changé
// change aussi ce que l'annonce promet.

import type { PieceDuCabinet } from '../pieces'
import {
  AFFIRMATIONS_DE_L_ECLAIR,
  DUREES_DES_JEUX,
  ESSAIS_DES_ETOILES,
  ESSAIS_DU_MOT,
  ETOILES_D_UNE_JUSTE,
  INDICES_DES_ETOILES,
  JUSTES_DE_L_ECLAIR,
  KM_DE_L_EPINGLE,
  RAYON_D_ECLAIRER_KM,
} from '../bareme'
import { INDICES_D_UNE_FICHE } from '../contenu'

/** Les neuf jeux. Une clé ne change jamais : elle est la forme des réponses au journal, et le jeu de chaque œuvre. */
export type CleDeJeu = 'epingle' | 'frise' | 'mot' | 'detail' | 'filet' | 'pari' | 'eclair' | 'indices' | 'replique'

/** Leur ordre, partout où la page les range. */
export const CLES_DES_JEUX: readonly CleDeJeu[] = ['epingle', 'frise', 'mot', 'detail', 'filet', 'pari', 'eclair', 'indices', 'replique']

/** Ce qu'un jeu dit de lui, sans rien juger. */
export interface DescriptionDUnJeu {
  cle: CleDeJeu
  /** « L’Épingle ». */
  nom: string
  /** « à l’Épingle » : « Cette œuvre se trouve à l’Épingle ». */
  a: string
  /** Le geste, en une phrase. */
  geste: string
  /** Le barème d'une manche, dit en étoiles. */
  bareme: string
  /** Ce qu'Éclairer y fait. */
  eclairer: string
  /**
   * Changer y sert-il ? La Frise se construit d'un bout à l'autre : remplacer
   * une manche défairait les deux autres. Une seule source — l'annonce, le
   * refus du pouvoir et le pli la lisent.
   */
  changeable: boolean
}

/** « 1 ou 2 », « 3 », « 4 ou 5 » : les essais ou les indices de chaque étoile, de l'un à l'autre. */
function deA(de: number, a: number): string {
  if (de === a) return String(de)
  return a === de + 1 ? `${de} ou ${a}` : `${de} à ${a}`
}

/** Un barème qui compte, ses bornes lues dans `bareme.ts` : « en 1 ou 2 essais ★★★ · 3 ou 4 ★★ · 5 ★ ». */
function baremeCompte(bornes: readonly number[], dernier: number, mot: string): string {
  const tranches = [...bornes, dernier].slice(0, 3).map((a, i, t) => deA(i === 0 ? 1 : t[i - 1] + 1, a))
  return tranches.map((t, i) => `${i === 0 ? `en ${t} ${mot}` : t} ${'★'.repeat(3 - i)}`).join(' · ')
}

export const JEUX: Readonly<Record<CleDeJeu, DescriptionDUnJeu>> = {
  epingle: {
    cle: 'epingle',
    nom: 'L’Épingle',
    a: 'à l’Épingle',
    geste: 'Un récit, puis « Où ? » : plante ton épingle sur la carte de France.',
    bareme: `à moins de ${KM_DE_L_EPINGLE[0]} km ★★★ · ${KM_DE_L_EPINGLE[1]} km ★★ · ${KM_DE_L_EPINGLE[2]} km ★`,
    eclairer: `entoure une grande zone (${RAYON_D_ECLAIRER_KM} km) qui contient le lieu`,
    changeable: true,
  },
  frise: {
    cle: 'frise',
    nom: 'La Frise',
    a: 'à la Frise',
    geste: 'Range les événements du plus ancien au plus récent : à chaque manche, la frise s’allonge.',
    bareme: 'sans faute ★★★ · une erreur ★★ · deux ★',
    eclairer: 'dévoile l’année d’un nouveau venu',
    changeable: false,
  },
  mot: {
    cle: 'mot',
    nom: 'Le Mot mystère',
    a: 'au Mot mystère',
    geste: `Trouve le mot, avec la question pour indice : ${ESSAIS_DU_MOT} essais.`,
    bareme: baremeCompte(ESSAIS_DES_ETOILES.slice(0, 2), ESSAIS_DES_ETOILES[2], 'essais'),
    eclairer: 'souffle une lettre à sa place',
    changeable: true,
  },
  detail: {
    cle: 'detail',
    nom: 'Le Détail',
    a: 'au Détail',
    geste: 'Reconnais le tableau : chaque pas en arrière en montre plus, et vaut une étoile de moins.',
    bareme: 'au premier coup d’œil ★★★ · un pas ★★ · deux ★',
    eclairer: 'efface un mauvais titre',
    changeable: true,
  },
  filet: {
    cle: 'filet',
    nom: 'Le Filet',
    a: 'au Filet',
    geste: 'Place ton curseur, puis choisis ton filet : petit, il rapporte plus.',
    bareme: 'petit filet ★★★ · moyen ★★ · grand ★',
    eclairer: 'montre une zone où est la réponse',
    changeable: true,
  },
  pari: {
    cle: 'pari',
    nom: 'Le Pari',
    a: 'au Pari',
    geste: 'Juste : garde une étoile, ou parie-la sur une question plus difficile.',
    bareme: 'garder ★ · parier et réussir ★★★',
    eclairer: 'efface une mauvaise réponse',
    changeable: true,
  },
  eclair: {
    cle: 'eclair',
    nom: 'L’Éclair',
    a: 'à l’Éclair',
    geste: `${AFFIRMATIONS_DE_L_ECLAIR} affirmations en ${DUREES_DES_JEUX.eclair} secondes : vraies ou fausses ?`,
    bareme: JUSTES_DE_L_ECLAIR.map((n, i) => `${i === 0 ? `${n} justes` : n} ${'★'.repeat(3 - i)}`).join(' · '),
    eclairer: 'souffle la réponse de l’affirmation en cours',
    changeable: true,
  },
  indices: {
    cle: 'indices',
    nom: 'Les Indices',
    a: 'aux Indices',
    geste: 'Qui suis-je ? Réponds avec le moins d’indices possible.',
    bareme: baremeCompte(INDICES_DES_ETOILES, INDICES_D_UNE_FICHE, 'indices'),
    eclairer: 'un indice gratuit',
    changeable: true,
  },
  replique: {
    cle: 'replique',
    nom: 'La Réplique',
    a: 'à la Réplique',
    geste: 'Complète la réplique, puis dis qui l’a dite.',
    bareme: 'le bon mot ★★ · la bonne personne ★',
    eclairer: 'efface une mauvaise proposition',
    changeable: true,
  },
}

/**
 * Ce que le verdict d'une manche rend : ses étoiles naturelles — avant les
 * pouvoirs, que le pli applique ensuite — et la pièce, ou les deux pièces du
 * Pari parié, que le journal écrit.
 */
export interface VerdictDUneManche {
  naturel: 0 | 1 | 2 | 3
  pieces: { juste: boolean; choix: number | null; composee: string | null; etape?: 1 | 2 }[]
}

/**
 * La forme de la règle d'un jeu. Pure : le contenu est tiré au départ par le
 * serveur (`Tiree`), l'état d'une manche se replie de ses gestes (`Etat`), et
 * la vue ne montre que ce que `montrer` choisit (invariant 1).
 */
export interface RegleDuJeu<Tiree, Etat, Geste, Montree, Revelee> {
  cle: CleDeJeu
  /** Le Pari et la Réplique ont deux étapes, chacune son chrono. */
  etapes: 1 | 2
  /** La durée d'une étape, « Prendre son temps » à part (`DUREES_DES_JEUX`). */
  dureeMs: (etape: 1 | 2) => number
  /** L'état d'une manche qui s'ouvre. */
  ouvrir(t: Tiree): Etat
  /** Relit ce que la page envoie pour ce jeu ; null : illisible. */
  lireLeGeste(brut: unknown, t: Tiree): Geste | null
  /** Un geste qui ne tranche pas (un essai, reculer, un indice, garder, le mot…) ; une chaîne : son refus, en mots. */
  apresLeGeste(t: Tiree, e: Etat, g: Geste): Etat | string
  /** Les étoiles naturelles et ce que la pièce écrit ; « expiree » : rien de ce qu'elle portait ne compte. */
  juger(t: Tiree, e: Etat, reponse: Geste | 'expiree' | 'quittee'): VerdictDUneManche
  /** Éclairer, propre au jeu : son effet, tiré du hasard rejoué de la graine, ou son refus. */
  eclairer(t: Tiree, e: Etat, hasard: () => number, cible?: number): Etat | string
  /** Ce que la manche montre, sans la réponse ; la vue n'en ajoute rien. */
  montrer(t: Tiree, e: Etat): Montree
  /** La révélation : la réponse entière, et « Le savais-tu ? ». */
  reveler(t: Tiree, e: Etat, v: VerdictDUneManche): Revelee
  /** Ce que la pièce garde au journal : son identifiant, sa forme, `composee`. */
  piece(t: Tiree, e: Etat, v: VerdictDUneManche, i: { manche: 0 | 1 | 2; tirage: number; etape?: 1 | 2 }): PieceDuCabinet
  /** Ce que le cartel d'une œuvre gagnée dit de cette manche. */
  cartel(t: Tiree, v: VerdictDUneManche): { sujet: string; reponse: string; anecdote: string | null }
}

/**
 * Une pièce est-elle juste ? Dès deux étoiles naturelles (`ETOILES_D_UNE_JUSTE`)
 * — jamais les étoiles après les pouvoirs : Protéger qui porte une manche de ★
 * à ★★ ne paie pas un confetti de plus. Le Pari rend null : chacune de ses
 * pièces est juste à sa bonne réponse.
 */
export const justeDeLaPiece = (naturel: number, jeu: CleDeJeu): boolean | null => (jeu === 'pari' ? null : naturel >= ETOILES_D_UNE_JUSTE)
