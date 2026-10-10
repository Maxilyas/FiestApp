import { sujetParCle } from '../../shared/sujets'

// Ce que joue une série, en mots : la page de la campagne et celle d'un défi
// entre amis le disent toutes deux.

/** Les catégories d'une série, en quelques mots : « Culture générale », « Histoire et Sport », « 4 catégories » ; rien pour toutes. */
export function nomDesCategories(categories: readonly string[]): string | null {
  if (categories.length === 0) return null
  if (categories.length <= 2) return categories.join(' et ')
  return `${categories.length} catégories`
}

/** Ce que joue une série, ou un défi entre amis, en quelques mots : son sujet, ou ses catégories ; rien pour toutes. */
export function nomDuChoix(categories: readonly string[], sujet: string | null | undefined): string | null {
  return (sujet && sujetParCle(sujet)?.nom) || nomDesCategories(categories)
}
