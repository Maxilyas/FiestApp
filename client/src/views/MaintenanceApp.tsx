import type { ComponentType } from 'react'
import { EnMaintenance } from '../components/EnMaintenance'
import { Icon } from '../components/Icon'
import type { PageEnMaintenance } from '../../../shared/maintenance'

/**
 * Une page en maintenance, à la place de la page même (`main.tsx`) : son
 * code ne se télécharge pas, elle ne demande rien au serveur. On rentre à
 * l'accueil, ou l'on réessaie — rouverte entre-temps, la page revient.
 */
export function MaintenanceApp({ page }: { page: PageEnMaintenance }) {
  return (
    <div className="center-page">
      <EnMaintenance page={page}>
        <div className="en-maintenance-gestes">
          <a className="btn btn-primary btn-big btn-block" href="/">
            <Icon name="home" />
            Retour à l’accueil
          </a>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => window.location.reload()}>
            <Icon name="rotate" />
            Réessayer
          </button>
        </div>
      </EnMaintenance>
    </div>
  )
}

/** La page de `main.tsx`, qui rend ses vues sans rien leur passer : celle d'une page fermée, déjà nommée. */
export function pageFermee(page: PageEnMaintenance): ComponentType {
  return function PageFermee() {
    return <MaintenanceApp page={page} />
  }
}
