// Le Filet : une année ou une estimation de la base, sur une piste ; il place
// son curseur, choisit la taille de son filet — petit, il rapporte plus — et le
// lance. La valeur ne part qu'avec le verdict (invariant 1).
//
// La piste se tire au départ (`pisteDuFilet`) : la réponse tombe n'importe où
// entre 8 et 92 % de sa longueur, et le curseur part du milieu. Dans la
// maquette d'avant les tests, la réponse était au milieu : rester au centre
// payait toujours.
//
// Dedans se juge par `ecartEstimation` (invariant 15), contre une demi-largeur
// arrondie à ce que ses chiffres écrivent : en virgule flottante, 0,09 × 20 vaut
// 1,7999999999999998 et 14 − 12,2 vaut 1,8000000000000007, et un lancer pile
// au bord du filet moyen tombait dehors.

import {
  ANNEE_MIN_DU_FILET,
  DUREES_DES_JEUX,
  ETOILES_DU_FILET,
  LARGEURS_DU_FILET,
  PAS_DE_LA_PISTE,
  PISTE_DES_ANNEES,
  POSITION_DE_LA_REPONSE,
  VALEUR_MIN_DU_FILET,
  ZONE_DU_FILET,
} from '../bareme'
import { decimales, ecartEstimation } from '../../classement'
import { GESTE_A_JUGER, champsDuGeste, naturelDe, pieceDeLaQuestion, reponseEnvoyee, rienAEclairer, type QuestionTiree } from './deLaBase'
import { justeDeLaPiece, type RegleDuJeu } from './regle'

export type TailleDuFilet = keyof typeof LARGEURS_DU_FILET
/** Les trois filets, du plus petit au plus grand. */
export const TAILLES_DU_FILET = Object.keys(LARGEURS_DU_FILET) as TailleDuFilet[]
const estUneTaille = (x: unknown): x is TailleDuFilet => typeof x === 'string' && (TAILLES_DU_FILET as string[]).includes(x)

/** La piste : ses bornes, et le pas du curseur et des boutons − et +. */
export interface PisteDuFilet {
  min: number
  max: number
  pas: number
}

/** La question de la base, sa valeur, et la piste tirée au départ. */
export interface FiletTire {
  jeu: 'filet'
  question: QuestionTiree
  valeur: number
  /** Une année : la piste se dit sans unité, un an par pas. */
  annee: boolean
  /** L'unité d'une estimation (« km », « habitants »), si elle en a une. */
  unite?: string
  piste: PisteDuFilet
}

/** Ce que le serveur sait avant le lancer : la zone qu'Éclairer a dorée. Le curseur et la taille, la page les tient. */
export interface EtatDuFilet {
  zone: { de: number; a: number } | null
}

/** Le lancer, ou rien — l'envoi de l'échéance d'une page qui n'a rien à lancer. */
export type GesteDuFilet = { quoi: 'repondre'; lancer: { x: number; taille: TailleDuFilet } | null }

export interface FiletMontre {
  jeu: 'filet'
  categorie: string | null
  /** L'intitulé, sans ses réponses : l'une d'elles est la valeur. */
  texte: string
  annee: boolean
  unite?: string
  piste: PisteDuFilet
  zone: { de: number; a: number } | null
}

export interface FiletRevele {
  jeu: 'filet'
  /** « Dans le filet », « À côté », « Pas de lancer ». */
  titre: string
  dedans: boolean
  valeur: number
  /** La bonne réponse telle que la base l'écrit (« 1 845 km »). */
  reponse: string
  lancer: { x: number; taille: TailleDuFilet } | null
  annee: boolean
  unite?: string
  piste: PisteDuFilet
  zone: { de: number; a: number } | null
  texte: string
  savais: string | null
}

/** Ce que le Filet pose : une année entière dès `ANNEE_MIN_DU_FILET`, une estimation dès `VALEUR_MIN_DU_FILET` — sous dix, la piste n'a pas de quoi tendre un filet. */
export function seTendAuFilet(valeur: number, annee: boolean): boolean {
  return annee ? Number.isInteger(valeur) && valeur >= ANNEE_MIN_DU_FILET : Number.isFinite(valeur) && valeur >= VALEUR_MIN_DU_FILET
}

/** Un entier tiré entre deux bornes comprises, du hasard rejoué de la graine. */
const entreDeux = (de: number, a: number, hasard: () => number) => Math.min(a, de + Math.floor(hasard() * (a - de + 1)))

/**
 * La borne haute d'une piste d'estimation : la piste brute arrondie à deux
 * chiffres significatifs — 8 848 m sur une piste de 0 à 13 000, pas à
 * 12 637,4 —, au-dessus, ou au-dessous si l'arrondi au-dessus faisait tomber la
 * réponse sous sa place la plus basse. Des bornes qui se lisent.
 */
function borneRonde(valeur: number, brute: number): number {
  const ordre = 10 ** Math.max(0, Math.floor(Math.log10(brute)) - 1)
  const dessus = Math.ceil(brute / ordre) * ordre
  return valeur / dessus >= POSITION_DE_LA_REPONSE[0] ? dessus : Math.floor(brute / ordre) * ordre
}

/**
 * La piste d'une valeur, tirée au départ du hasard du tirage : la réponse y
 * tombe entre `POSITION_DE_LA_REPONSE`, jamais au milieu d'office. Une année :
 * une piste de `PISTE_DES_ANNEES` ans, an par an, la réponse à un an entier de
 * sa borne basse. Une estimation : de zéro à une borne ronde, en
 * `PAS_DE_LA_PISTE` pas. Null : le Filet ne la pose pas.
 */
export function pisteDuFilet(valeur: number, annee: boolean, hasard: () => number): PisteDuFilet | null {
  if (!seTendAuFilet(valeur, annee)) return null
  const [bas, haut] = POSITION_DE_LA_REPONSE
  if (annee) {
    const longueur = entreDeux(PISTE_DES_ANNEES[0], PISTE_DES_ANNEES[1], hasard)
    // Le nombre d'années entre la borne basse et la réponse : toutes ses places possibles, au même poids.
    const avant = entreDeux(Math.ceil(bas * longueur), Math.floor(haut * longueur), hasard)
    return { min: valeur - avant, max: valeur - avant + longueur, pas: 1 }
  }
  const max = borneRonde(valeur, valeur / (bas + hasard() * (haut - bas)))
  return { min: 0, max, pas: Math.max(1, Math.round(max / PAS_DE_LA_PISTE)) }
}

/** Où le curseur part : le milieu de la piste, sur un pas. */
export const milieuDeLaPiste = (p: PisteDuFilet): number => p.min + Math.round((p.max - p.min) / 2 / p.pas) * p.pas

/**
 * La demi-largeur d'un filet sur une piste, arrondie à ce que ses deux
 * chiffres écrivent (0,09 × 20 : deux décimales, 1,8) — la virgule flottante
 * la mettait un cheveu en deçà.
 */
export function demiLargeur(taille: TailleDuFilet, p: PisteDuFilet): number {
  const part = LARGEURS_DU_FILET[taille]
  const longueur = p.max - p.min
  return Number((part * longueur).toFixed(Math.min(12, decimales(part) + decimales(longueur))))
}

/** La réponse est-elle dans le filet lancé là ? Pile au bord, elle y est. */
export function dansLeFilet(x: number, taille: TailleDuFilet, valeur: number, p: PisteDuFilet): boolean {
  return ecartEstimation(x, valeur) <= demiLargeur(taille, p)
}

/** « 1852|moyen » : le lancer, que le journal garde et que la révélation relit. */
const composeeDu = (l: { x: number; taille: TailleDuFilet }) => `${l.x}|${l.taille}`
function lancerDe(composee: string | null | undefined): { x: number; taille: TailleDuFilet } | null {
  const [x, taille] = (composee ?? '').split('|')
  // Écrit par `composeeDu`, jamais tapé par un humain : il se relit tel que `String` l'a écrit.
  const n = Number(x)
  return composee && Number.isFinite(n) && estUneTaille(taille) ? { x: n, taille } : null
}

/** Son unité, si elle en a une : une piste d'années n'en dit aucune. */
const sonUnite = (t: FiletTire) => (t.unite === undefined ? {} : { unite: t.unite })

export const REGLE_DU_FILET: RegleDuJeu<FiletTire, EtatDuFilet, GesteDuFilet, FiletMontre, FiletRevele> = {
  cle: 'filet',
  etapes: 1,
  dureeMs: () => DUREES_DES_JEUX.filet * 1000,

  ouvrir: () => ({ zone: null }),

  lireLeGeste(brut, t) {
    const g = champsDuGeste(brut)
    if (!g || g.quoi !== 'repondre') return null
    const r = reponseEnvoyee(g, 'filet')
    if (r === undefined) return { quoi: 'repondre', lancer: null }
    if (r === null) return null
    const { x, taille } = r
    if (typeof x !== 'number' || !Number.isFinite(x) || x < t.piste.min || x > t.piste.max || !estUneTaille(taille)) return null
    return { quoi: 'repondre', lancer: { x, taille } }
  },

  // Un seul geste au Filet, le lancer : il tranche toujours.
  tranche: () => true,
  apresLeGeste: () => GESTE_A_JUGER,

  juger(t, _e, reponse) {
    const lancer = typeof reponse === 'object' ? reponse.lancer : null
    if (!lancer) return { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] }
    const naturel = dansLeFilet(lancer.x, lancer.taille, t.valeur, t.piste) ? naturelDe(ETOILES_DU_FILET[lancer.taille]) : 0
    // Juste dans le petit ou le moyen : le grand rapporte une étoile, pas une juste.
    const juste = justeDeLaPiece(naturel, 'filet') === true
    return { naturel, pieces: [{ juste, choix: juste ? 0 : -1, composee: composeeDu(lancer) }] }
  },

  eclairer(t, e, hasard) {
    if (e.zone) return rienAEclairer('filet')
    // Une zone de trente pour cent de la piste, la réponse n'importe où dedans, puis ramenée sur la piste :
    // décalée vers l'intérieur, elle la contient encore — elle était à gauche du bord droit, à droite du gauche.
    const largeur = ZONE_DU_FILET * (t.piste.max - t.piste.min)
    const de = Math.min(Math.max(t.valeur - hasard() * largeur, t.piste.min), t.piste.max - largeur)
    return { zone: { de, a: de + largeur } }
  },

  montrer(t, e) {
    return {
      jeu: 'filet',
      categorie: t.question.categorie,
      texte: t.question.texte,
      annee: t.annee,
      ...sonUnite(t),
      piste: { ...t.piste },
      zone: e.zone && { ...e.zone },
    }
  },

  reveler(t, e, v) {
    const lancer = lancerDe(v.pieces[0]?.composee)
    return {
      jeu: 'filet',
      titre: !lancer ? 'Pas de lancer' : v.naturel > 0 ? 'Dans le filet' : 'À côté',
      dedans: v.naturel > 0,
      valeur: t.valeur,
      reponse: t.question.reponses[t.question.bonne],
      lancer,
      annee: t.annee,
      ...sonUnite(t),
      piste: { ...t.piste },
      zone: e.zone && { ...e.zone },
      texte: t.question.texte,
      savais: t.question.anecdote,
    }
  },

  piece: (t, _e, _v, i) => pieceDeLaQuestion(t.question, { jeu: 'filet', manche: i.manche, tirage: i.tirage }, 'filet'),

  cartel: t => ({ sujet: t.question.texte, reponse: t.question.reponses[t.question.bonne], anecdote: t.question.anecdote }),
}
