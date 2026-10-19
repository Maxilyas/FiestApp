import type { ComponentType } from 'react'
import { EnMaintenance } from '../components/EnMaintenance'
import { Icon } from '../components/Icon'
import type { PageEnMaintenance } from '../../../shared/maintenance'

/**
 * Une page fermée, à la place de la page même (`main.tsx`) : son code ne se
 * télécharge pas, elle ne demande rien au serveur. On rentre à l'accueil ; en
 * maintenance, on réessaie aussi — rouverte entre-temps, la page revient.
 * Bientôt disponible, réessayer ne changerait rien avant des jours.
 */
export function MaintenanceApp({ page, pourquoi }: { page: PageEnMaintenance; pourquoi: 'maintenance' | 'bientot' }) {
  return (
    <div className="center-page">
      <EnMaintenance page={page} pourquoi={pourquoi}>
        <div className="en-maintenance-gestes">
          <a className="btn btn-primary btn-big btn-block" href="/">
            <Icon name="home" />
            Retour à l’accueil
          </a>
          {pourquoi === 'maintenance' && (
            <button type="button" className="btn btn-ghost btn-block" onClick={() => window.location.reload()}>
              <Icon name="rotate" />
              Réessayer
            </button>
          )}
        </div>
      </EnMaintenance>
    </div>
  )
}

/** La page de `main.tsx`, qui rend ses vues sans rien leur passer : celle d'une page fermée, déjà nommée. */
export function pageFermee(page: PageEnMaintenance, pourquoi: 'maintenance' | 'bientot'): ComponentType {
  return function PageFermee() {
    return <MaintenanceApp page={page} pourquoi={pourquoi} />
  }
}
