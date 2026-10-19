import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { espacesFines } from '../format'
import { EN_AVANT_PREMIERE, ON_REPARE, PAGES_FERMABLES, type PageEnMaintenance } from '../../../shared/maintenance'

/**
 * Ce que montre une page fermée (`shared/maintenance.ts`) : en maintenance,
 * qu'on la répare, que rien n'est perdu ; bientôt disponible, qu'elle arrive
 * — et de quoi repartir. Une page entière passe par `MaintenanceApp`,
 * l'onglet du défi de la semaine par lui seul. Le bandeau de
 * l'administrateur, quand il en a posé un, est déjà au-dessus : c'est lui
 * qui dit le problème.
 */
export function EnMaintenance({
  page,
  pourquoi = 'maintenance',
  children,
}: {
  page: PageEnMaintenance
  pourquoi?: 'maintenance' | 'bientot'
  children?: ReactNode
}) {
  const bientot = pourquoi === 'bientot'
  return (
    <section className={'en-maintenance' + (bientot ? ' en-bientot' : '')} aria-labelledby="en-maintenance-titre">
      <span className="en-maintenance-icone" aria-hidden="true">
        <Icon name={bientot ? 'clock' : 'alert'} />
      </span>
      <h1 id="en-maintenance-titre">{bientot ? PAGES_FERMABLES[page].bientot : PAGES_FERMABLES[page].titre}</h1>
      <p className="muted">{espacesFines(bientot ? EN_AVANT_PREMIERE : ON_REPARE)}</p>
      {children}
    </section>
  )
}
