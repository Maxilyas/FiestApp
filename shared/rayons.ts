// Les rayons de la boutique, en grilles (la refonte du 10 novembre 2026, la
// maquette validée par le propriétaire — `retours/2026-11-10/boutique/` :
// « J'ai l'impression que les utilisateurs ont du mal et ne voient pas
// grand-chose sur leur téléphone »). La boutique d'avant montrait un article
// entier à l'arrivée en 360 × 640, et faisait six écrans de haut : cinq
// étagères de thèmes qui glissaient de côté, deux cartes visibles sur cinq.
// Celle-ci met tout ce qui se vend sous les yeux, en tuiles serrées, et un
// seul présentoir — une feuille qui monte du bas — pour les quatre rayons.
//
// Ici, ce qui ne dépend ni du navigateur ni du serveur : ce que chaque rayon
// met en vente pour lui, ce qu'il en dit en une ligne, le voisin d'un article
// dans son rayon, et les gestes du présentoir, étape par étape — l'achat en
// deux touchers, « L'acheter » puis « Confirmer », à la place d'un dialogue
// posé par-dessus la feuille. Pur : la page le rend, l'épreuve le rejoue.

import { PRIX_D_UN_COMPAGNON } from './compagnons'
import type { SorteDEnvie } from './envie'
import { FONDS_EN_BOUTIQUE, PRIX_D_UN_FOND, type Fond } from './fonds'
import { THEMES, enBoutique, prixDe, type Theme } from './themes'
import { formatNumber } from './typographie'

export type Rayon = 'themes' | 'compagnons' | 'fonds' | 'objets'

/** Les quatre rayons, dans l'ordre de la page ; le comptoir se nomme « Objets » sur sa puce, « Le comptoir » en titre. */
export const RAYONS: readonly { id: Rayon; nom: string; titre: string }[] = [
  { id: 'themes', nom: 'Thèmes', titre: 'Thèmes' },
  { id: 'compagnons', nom: 'Compagnons', titre: 'Compagnons' },
  { id: 'fonds', nom: 'Fonds', titre: 'Fonds' },
  { id: 'objets', nom: 'Objets', titre: 'Le comptoir' },
]

/** Le rayon d'une sorte d'article. */
export const RAYON_DE: Readonly<Record<SorteDEnvie, Rayon>> = { theme: 'themes', compagnon: 'compagnons', fond: 'fonds', objet: 'objets' }

/** « 🎊 400 », le prix collé à son confetti. */
export const enConfettis = (n: number): string => `🎊 ${formatNumber(n)}`

/**
 * Les thèmes en rayon : ce qu'il n'a pas et que la saison permet, dans
 * l'ordre du catalogue — du moins cher au plus cher. Ceux qui se gagnent n'y
 * sont jamais (`enBoutique`) : « Ma collection » dit où.
 */
export function themesEnRayon(possedes: readonly string[], jour: string): Theme[] {
  return THEMES.filter(t => t.rarete !== 'offert' && !possedes.includes(t.key) && enBoutique(t, jour))
}

/** Les fonds en rayon : les douze des savoirs, moins les siens — gagnés, tirés ou achetés. */
export function fondsEnRayon(siens: readonly string[]): Fond[] {
  return FONDS_EN_BOUTIQUE.filter(f => !siens.includes(f.key))
}

/**
 * Ce que le rayon des thèmes dit en une ligne, à droite de son nom : combien
 * il en reste, et combien son solde en paie déjà — la question de chaque
 * visite (« qu'est-ce que je peux m'offrir ? »), qu'un paragraphe sur ce
 * qu'est un thème ne disait pas. Sans rien à sa portée, le premier prix : ce
 * qu'il vise.
 */
export function ligneDesThemes(enRayon: readonly Theme[], solde: number): string {
  const n = enRayon.length
  if (n === 0) return 'tu les as tous'
  const portee = enRayon.filter(t => prixDe(t) <= solde).length
  if (portee === n) return n === 1 ? '1, à ta portée' : `${n}, tous à ta portée`
  if (portee > 0) return `${n}, dont ${portee} à ta portée`
  return `${n} · le premier à ${formatNumber(Math.min(...enRayon.map(prixDe)))}`
}

/** Celle des compagnons : leur prix, le même pour tous, et ceux qu'il a. */
export function ligneDesCompagnons(aLui: number): string {
  return `${formatNumber(PRIX_D_UN_COMPAGNON)} chacun${aLui > 0 ? ` · ${aLui} à toi` : ''}`
}

/** Celle des fonds : leur prix, et où ils se voient. */
export const LIGNE_DES_FONDS = `${formatNumber(PRIX_D_UN_FOND)} chacun · derrière ta carte`

/** Celle du comptoir. */
export const LIGNE_DU_COMPTOIR = 'ce qui sert en jeu'

/** Où est cet article dans son rayon : « 3 sur 22 » ; null s'il n'y est pas — ouvert par son adresse, hors saison ou déjà à lui. */
export function rangDansLeRayon(cles: readonly string[], cle: string): { rang: number; sur: number } | null {
  const i = cles.indexOf(cle)
  return i < 0 ? null : { rang: i + 1, sur: cles.length }
}

/** Le voisin d'un article dans son rayon, en boucle : après le dernier, le premier. Null hors du rayon, ou seul. */
export function voisinDansLeRayon(cles: readonly string[], cle: string, pas: 1 | -1): string | null {
  const i = cles.indexOf(cle)
  if (i < 0 || cles.length < 2) return null
  return cles[(i + pas + cles.length) % cles.length]
}

/**
 * Où en est le présentoir : la fiche de l'article ; « Confirmer », le second
 * toucher de l'achat ; puis ce qu'on vient d'acheter, et ce qu'on en fait.
 */
export type EtapeDuPresentoir = 'fiche' | 'confirmer' | 'achete'

/**
 * Ce qu'est l'article pour lui : à vendre et à sa portée, trop cher pour
 * l'instant, déjà à lui, ou fermé — hors de sa saison, un thème qui se gagne,
 * un sablier de trop : rien ne s'y achète, la fiche dit pourquoi.
 */
export type EtatDeLArticle = 'a-vendre' | 'trop-cher' | 'a-toi' | 'ferme'

export interface GesteDuPresentoir {
  geste: 'essayer' | 'acheter' | 'envie' | 'annuler' | 'confirmer' | 'porter' | 'fermer'
  nom: string
  /** L'or plein : le geste que l'étape attend. Un seul par étape. */
  principal?: boolean
  /** Un interrupteur — son nom ne change pas, `aria-pressed` dit son état. */
  presse?: boolean
  /** Éteint : il dit ce qui manque, et ne fait rien. */
  eteint?: boolean
}

/** Ce qui s'essaie avant de s'acheter : un thème sur toute la page, un compagnon dans sa niche. Un fond se voit sur sa carte, dans sa fiche même. */
export const S_ESSAIE: readonly SorteDEnvie[] = ['theme', 'compagnon']

/** « Le porter », pour chaque sorte : un compagnon s'installe dans sa niche, un fond se pose derrière sa carte. */
const PORTER: Readonly<Record<SorteDEnvie, string>> = { theme: 'Le porter', compagnon: 'L’installer', fond: 'Le poser', objet: 'Le porter' }

/**
 * Les gestes au pied du présentoir, pour cette étape — deux au plus, le
 * principal à droite, sous le pouce.
 *
 * La fiche : « L'essayer » pour ce qui s'essaie, et « L'acheter » — ou, trop
 * cher, « J'en ai envie » à sa place : un bouton éteint qui disait « Encore
 * 580 confettis » n'offrait rien à faire de sa visite. « L'acheter » ne
 * dépense rien : il mène à « Confirmer », au même endroit, qui dépense. Puis
 * ce qu'on en fait : le porter, ou plus tard — un seul bouton quand il n'y a
 * rien à choisir (un objet, un compagnon que sa niche vide a déjà accueilli).
 */
export function gestesDuPresentoir(a: {
  sorte: SorteDEnvie
  etape: EtapeDuPresentoir
  etat: EtatDeLArticle
  /** Ce que coûte ce qu'il s'apprête à prendre — plusieurs vies comptées. */
  prix: number
  /** Ce qui manque à son solde pour ce prix ; zéro s'il a de quoi. */
  manque?: number
  aLEssai?: boolean
  sonEnvie?: boolean
  /** Acheté : il reste à le porter — sinon, rien à choisir. */
  aPorter?: boolean
}): GesteDuPresentoir[] {
  if (a.etape === 'achete') {
    if (!a.aPorter) return [{ geste: 'fermer', nom: 'Fermer', principal: true }]
    return [
      { geste: 'fermer', nom: 'Plus tard' },
      { geste: 'porter', nom: PORTER[a.sorte], principal: true },
    ]
  }
  if (a.etat === 'a-toi' || a.etat === 'ferme') return [{ geste: 'fermer', nom: 'Fermer' }]
  if (a.etape === 'confirmer' && a.etat === 'a-vendre' && !a.manque) {
    return [
      { geste: 'annuler', nom: 'Annuler' },
      { geste: 'confirmer', nom: `Confirmer · ${enConfettis(a.prix)}`, principal: true },
    ]
  }
  const gestes: GesteDuPresentoir[] = []
  if (S_ESSAIE.includes(a.sorte)) gestes.push({ geste: 'essayer', nom: 'L’essayer', presse: !!a.aLEssai })
  if (a.etat === 'trop-cher') {
    gestes.push({ geste: 'envie', nom: 'J’en ai envie', presse: !!a.sonEnvie, principal: !a.sonEnvie })
  } else if (a.manque) {
    // À sa portée à l'unité, pas à ce nombre : plusieurs vies d'un coup.
    gestes.push({ geste: 'acheter', nom: `Il te manque ${formatNumber(a.manque)} confetti${a.manque > 1 ? 's' : ''}`, eteint: true })
  } else {
    gestes.push({ geste: 'acheter', nom: `${a.sorte === 'compagnon' ? 'L’adopter' : a.sorte === 'objet' ? 'Acheter' : 'L’acheter'} · ${enConfettis(a.prix)}`, principal: true })
  }
  return gestes
}
