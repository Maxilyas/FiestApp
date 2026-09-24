import type { SoireeGardee } from '../state'
import { spacePath } from '../routes'
import { Icon } from './Icon'

/** « Mon bilan » d'une soirée close, ouvert sur son invité quand on sait qui il était. */
export function lienBilan(g: Pick<SoireeGardee, 'soiree' | 'joueurId'>): string {
  const bilan = spacePath(g.soiree.slug, 'bilan', g.soiree.id)
  return g.joueurId ? `${bilan}#p=${g.joueurId}` : bilan
}

/**
 * « La dernière soirée : le souvenir · mon bilan ».
 *
 * Le lendemain, rien ne menait à la soirée d'hier : l'entrée de l'espace était
 * celle de la suivante, préremplie, et l'invitée qui revenait « voir les
 * résultats » y entrait — datant la soirée suivante de son passage. Une ligne,
 * pas une carte : « Rejoindre la soirée » doit rester visible sans défiler en
 * 360 × 640. Les adresses sont celles de l'archive, qui ne changent jamais.
 */
export function Lendemain({ gardee, titre = false }: { gardee: SoireeGardee; titre?: boolean }) {
  return (
    <p className="lendemain">
      <Icon name="book" />
      <span>
        {titre ? (
          <>
            {gardee.soiree.titre}
            {' : '}
          </>
        ) : (
          'La dernière soirée : '
        )}
        <a className="link-inline" href={spacePath(gardee.soiree.slug, 'souvenir', gardee.soiree.id)}>
          le souvenir
        </a>
        {' · '}
        <a className="link-inline" href={lienBilan(gardee)}>
          {gardee.joueurId ? 'mon bilan' : 'les bilans'}
        </a>
      </span>
    </p>
  )
}
