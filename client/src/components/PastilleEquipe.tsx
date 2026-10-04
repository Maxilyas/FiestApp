import type { PublicTeam } from '../../../shared/types'

/**
 * L'emoji de son équipe, à côté d'un prénom dans un classement : on y voit
 * qui joue avec soi, et où il en est (le propriétaire du dépôt, le
 * 4 octobre 2026). Rien sans équipe — l'absence, pas une case vide.
 */
export function PastilleEquipe({ equipe, avecMoi }: { equipe: PublicTeam | undefined; avecMoi?: boolean }) {
  if (!equipe) return null
  return (
    <span className={'pastille-equipe' + (avecMoi ? ' pastille-equipe-moi' : '')} title={equipe.name}>
      <span aria-hidden="true">{equipe.emoji}</span>
      <span className="sr-only">, équipe {equipe.name}</span>
    </span>
  )
}
