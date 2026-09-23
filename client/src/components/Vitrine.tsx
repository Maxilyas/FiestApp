import type { BadgePorte } from '../../../shared/badges'
import { NOM_RARETE } from '../../../shared/badges'

/**
 * L'étagère à badges d'un profil.
 *
 * Un badge dit d'où l'on vient, pas ce qu'on vaut ce soir : rien ici ne
 * change quoi que ce soit au déroulé d'une partie. Les prix de soirée se
 * regagnent (le compteur le dit), les badges de carrière ne tombent qu'une
 * fois.
 *
 * La rareté est **calculée**, pas décrétée : c'est la part des profils qui
 * portent le badge. Elle se tait tant qu'il n'y a pas assez de monde pour
 * qu'elle veuille dire quelque chose — à cinq inscrits, « légendaire » ne
 * signifierait que « une seule personne l'a », ce qui est vrai de presque tout.
 */
export function Vitrine({ badges }: { badges: BadgePorte[] }) {
  // Vide, la section du profil ne montre que son titre et son zéro.
  if (badges.length === 0) return null
  return (
    <div className="vitrine">
      {badges.map(b => (
        <div key={b.key} className={'badge' + (b.rarete ? ` rarete-${b.rarete}` : '')} title={b.title}>
          <span className="badge-emoji">{b.emoji}</span>
          <span className="badge-titre">{b.title}</span>
          <span className="badge-pied">
            {b.rarete ? NOM_RARETE[b.rarete] : `${b.porteurs} ${b.porteurs > 1 ? 'porteurs' : 'porteur'}`}
            {b.fois > 1 && ` · ×${b.fois}`}
          </span>
        </div>
      ))}
    </div>
  )
}
