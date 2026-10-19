import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { espacesFines } from '../format'
import { ON_REPARE, PAGES_FERMABLES, type PageEnMaintenance } from '../../../shared/maintenance'

/**
 * Ce que montre une page fermée pour maintenance (`shared/maintenance.ts`) :
 * qu'on la répare, que rien n'est perdu, et de quoi repartir. Une page
 * entière passe par `MaintenanceApp`, l'onglet du défi de la semaine par lui
 * seul. Le bandeau de l'administrateur, quand il en a posé un, est déjà
 * au-dessus : c'est lui qui dit le problème.
 */
export function EnMaintenance({ page, children }: { page: PageEnMaintenance; children?: ReactNode }) {
  return (
    <section className="en-maintenance" aria-labelledby="en-maintenance-titre">
      <span className="en-maintenance-icone" aria-hidden="true">
        <Icon name="alert" />
      </span>
      <h1 id="en-maintenance-titre">{PAGES_FERMABLES[page].titre}</h1>
      <p className="muted">{espacesFines(ON_REPARE)}</p>
      {children}
    </section>
  )
}
