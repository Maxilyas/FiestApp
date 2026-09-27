// Les écussons de savoir : une catégorie maîtrisée, au bronze, à l'argent,
// à l'or.
//
// Ils comptent les bonnes réponses d'une catégorie, en soirée comme au quiz
// du jour — aux QCM seulement : une estimation n'est jamais « juste ». C'est
// ce qu'on sait, pas ce qu'on a gagné : ils ne rapportent aucune expérience,
// et ne se perdent qu'avec les réponses qui les avaient faits (une soirée
// retirée de l'historique). Une dérivation pure de ce que la carrière compte
// déjà : rien ne s'écrit.
//
// La carte en montre trois, les plus hauts ; la page du profil, les douze,
// avec ce qui manque au suivant.

import { CATEGORIES } from './categories'

/** Les bonnes réponses qu'il faut dans une catégorie : le bronze, l'argent, l'or. */
export const SEUILS_ECUSSON = [20, 75, 200] as const

export const NOM_ECUSSON = ['', 'Bronze', 'Argent', 'Or'] as const

export interface Ecusson {
  categorie: string
  /** Ses bonnes réponses dans la catégorie : soirées et quiz du jour. */
  justes: number
  /** 0 tant que le bronze n'est pas atteint ; 1, 2, 3 : bronze, argent, or. */
  palier: 0 | 1 | 2 | 3
}

/** Le palier que valent tant de bonnes réponses. */
export function palierEcusson(justes: number): 0 | 1 | 2 | 3 {
  return SEUILS_ECUSSON.filter(s => justes >= s).length as 0 | 1 | 2 | 3
}

/** Les bonnes réponses qu'il faut pour le palier suivant ; null à l'or. */
export function prochainSeuil(palier: 0 | 1 | 2 | 3): number | null {
  return palier < 3 ? SEUILS_ECUSSON[palier as 0 | 1 | 2] : null
}

/**
 * Ses bonnes réponses par catégorie, sources additionnées — la carrière des
 * soirées, le quiz du jour. Les écussons et les avatars des branches
 * (`shared/branches.ts`) comptent ici, et nulle part ailleurs : l'écusson
 * d'argent et l'avatar de 75 bonnes réponses tombent ensemble, ou la page
 * du profil se contredirait.
 */
export function justesParCategorie(...sources: Readonly<Record<string, { justes: number }>>[]): Record<string, number> {
  return Object.fromEntries(CATEGORIES.map(c => [c, sources.reduce((n, s) => n + (s[c]?.justes ?? 0), 0)]))
}

/**
 * Ses écussons, catégorie par catégorie, dans l'ordre de la liste fixe : les
 * bonnes réponses de chaque source s'additionnent — la carrière des soirées,
 * le quiz du jour.
 */
export function ecussonsDe(...sources: Readonly<Record<string, { justes: number }>>[]): Ecusson[] {
  const justes = justesParCategorie(...sources)
  return CATEGORIES.map(categorie => ({ categorie, justes: justes[categorie], palier: palierEcusson(justes[categorie]) }))
}

/**
 * Les plus beaux, pour la carte : le plus haut palier d'abord, puis le plus
 * de bonnes réponses ; à égalité, l'ordre de la liste fixe. Un écusson qu'il
 * n'a pas ne s'y montre jamais.
 */
export function plusBeauxEcussons(ecussons: readonly Ecusson[], n = 3): Ecusson[] {
  const rang = (e: Ecusson) => (CATEGORIES as readonly string[]).indexOf(e.categorie)
  return ecussons
    .filter(e => e.palier > 0)
    .sort((a, b) => b.palier - a.palier || b.justes - a.justes || rang(a) - rang(b))
    .slice(0, n)
}
