import type { ReactNode } from 'react'

// La plaque : la part d'un thème que les autres voient (`shared/plaques.ts`).
// Sans catalogue ni état : la clé seule choisit la règle de la feuille
// (`.plaque-<clé>`, `styles.css`), ses couleurs et son emblème — rien ici ne
// tire `shared/themes.ts`, le quiz du jour l'importe.
//
// Depuis le soir du 18 novembre 2026 (trois propositions reparties de zéro,
// `retours/2026-11-18/plaques/trois-propositions/` : « L'écrin combiné au
// podium est une bonne idée », le propriétaire), deux pièces : **l'écrin** —
// l'avatar posé sur une tuile à ses couleurs, son emblème en filigrane —,
// partout où un joueur se montre hors d'une soirée ; et, en tête d'un
// classement, **le podium**, chacun sur sa marche à ses couleurs
// (`PodiumDuClassement.tsx`). Le prénom, le niveau et le score restent ceux de
// tous. Avant lui, la ligne entière à ses couleurs au podium et un trait sous
// le prénom plus bas : une mosaïque là où l'œil arrive, et un trait qui disait
// peu.

/**
 * La clé d'une plaque, si elle a la forme d'une clé de thème — suivie de son
 * camp, pour un thème qui en a deux (`bannieres-royaume`) : une feuille d'un
 * client d'avant ne connaît pas la sienne.
 */
export function cleDeLaPlaque(plaque: string | null | undefined): string | null {
  return plaque && /^[a-z]+(?:-[a-z]+)?$/.test(plaque) ? plaque : null
}

/** Les classes qu'une plaque ajoute à ce qu'elle habille — rien sans plaque. */
export function classeDeLaPlaque(plaque: string | null | undefined): string {
  const cle = cleDeLaPlaque(plaque)
  return cle ? ` plaque plaque-${cle}` : ''
}

/**
 * L'écrin d'un avatar : une tuile à ses couleurs, son double filet, son
 * emblème en filigrane — sans plaque, la même place, vide : les avatars d'une
 * liste restent alignés, et rien ne dit qu'il en manque une (l'absence, pas
 * l'infériorité — invariant 8). Rien ne passe sous un texte.
 */
export function Ecrin({ plaque, petit, children }: { plaque?: string | null; petit?: boolean; children: ReactNode }) {
  return <span className={'ecrin' + (petit ? ' ecrin-petit' : '') + classeDeLaPlaque(plaque)}>{children}</span>
}

/**
 * L'emblème d'une plaque en pièce : au bout d'un nom écrit sur sa plaque, aux
 * écrans d'un duel (`Duel.tsx`), et sur l'échantillon de la loge.
 */
export function EmblemeDeLaPlaque({ plaque }: { plaque: string | null | undefined }) {
  return classeDeLaPlaque(plaque) ? <span className="plaque-embleme" aria-hidden="true" /> : null
}
