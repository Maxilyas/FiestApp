import type { BadgePorte } from '../../../shared/badges'
import { NOM_RARETE } from '../../../shared/badges'
import { Icon } from './Icon'

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
  if (badges.length === 0) {
    return (
      <p className="muted small">
        Pas encore de badge. Ils tombent en fin de soirée, quand l'application remet ses prix — le plus
        rapide, le plus têtu, le plus à côté de la plaque…
      </p>
    )
  }
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

/** Le pavé « ce que tu n'as pas encore », pour donner envie de revenir. */
export function VitrineVide({ manquants }: { manquants: { emoji: string; title: string; rule: string }[] }) {
  if (manquants.length === 0) return null
  return (
    <details className="a-decrocher">
      <summary>
        <Icon name="sparkles" /> Encore {manquants.length} à décrocher
      </summary>
      <ul className="a-decrocher-liste">
        {manquants.map(m => (
          <li key={m.title}>
            <span className="badge-emoji muted">{m.emoji}</span>
            <span>
              <strong>{m.title}</strong> — {m.rule}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
