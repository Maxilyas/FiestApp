import { useEffect, useState } from 'react'
import { currentMe } from '../api'
import { pageContext, spacePath } from '../routes'
import { Icon } from './Icon'

/**
 * Le fil des pages publiques d'un espace, sous l'en-tête de chacune :
 * jouer, souvenir, bilan, soirées. Une page qui relit une archive garde son
 * archive sous le pied ; « Soirées » ramène toujours à la liste. L'animateur de
 * l'espace, connecté, y retrouve aussi le chemin de son compte.
 *
 * Des étiquettes, pas des pilules : les pilules, plus bas sur le bilan, sont
 * les commandes de la page (« Mon bilan » / « La soirée »).
 */
export type SpaceTab = 'souvenir' | 'bilan' | 'soirees'

const TABS: { tab: SpaceTab; label: string }[] = [
  { tab: 'souvenir', label: 'Souvenir' },
  { tab: 'bilan', label: 'Bilan' },
  { tab: 'soirees', label: 'Historique' },
]

/** Vrai si le visiteur est l'animateur de cet espace, connecté. Un invité : faux, sans bruit. */
export function useIsHost(slug: string): boolean {
  const [host, setHost] = useState(false)
  useEffect(() => {
    let alive = true
    currentMe().then(me => {
      if (alive) setHost(me?.account.slug === slug)
    })
    return () => {
      alive = false
    }
  }, [slug])
  return host
}

export function SpaceNav({ current }: { current: SpaceTab }) {
  const { slug, archiveId } = pageContext()
  const host = useIsHost(slug)
  return (
    <nav className="space-nav" aria-label="Pages de la soirée">
      <div className="space-nav-tabs">
        {/* De la page publique au jeu : rien n'y menait, et « La soirée n'a
            pas encore commencé » était une impasse. Toujours la soirée en
            cours — une archive ne se rejoue pas. */}
        <a href={spacePath(slug)}>Jouer</a>
        {TABS.map(({ tab, label }) => (
          <a
            key={tab}
            className={tab === current ? 'active' : undefined}
            aria-current={tab === current ? 'page' : undefined}
            href={spacePath(slug, tab, tab === 'soirees' ? null : archiveId)}
          >
            {label}
          </a>
        ))}
      </div>
      {host && (
        <a className="space-nav-account" href="/compte">
          <Icon name="users" />
          Mon compte
        </a>
      )}
    </nav>
  )
}

/** Le motif d'une page d'espace dont l'adresse ne mène à rien — pas une panne. */
export const INTROUVABLE = 'Il n’y a pas de soirée à cette adresse — ou plus. Vérifie le lien avec ton hôte.'

/** Vrai si la lecture a échoué parce que la soirée n'existe pas (un 404), et non sur une panne. */
export function estIntrouvable(e: unknown): boolean {
  return e instanceof Error && e.message === '404'
}

/**
 * Une page publique qui n'a pas pu se charger : le message, et le fil pour
 * aller ailleurs. Introuvable, le fil de l'espace menait trois fois à la même
 * erreur : on propose plutôt la liste de ses soirées (depuis une soirée
 * archivée) et l'accueil.
 */
export function SpaceError({ current, message }: { current: SpaceTab; message: string }) {
  if (message === INTROUVABLE) {
    const { slug, archiveId } = pageContext()
    return (
      <div className="recap">
        <p className="warn center">{message}</p>
        <p className="row center-row">
          {archiveId && (
            <a className="btn" href={spacePath(slug, 'soirees')}>
              Les soirées de cet espace
            </a>
          )}
          <a className="btn btn-ghost" href="/">
            L’accueil
          </a>
        </p>
      </div>
    )
  }
  return (
    <div className="recap">
      <SpaceNav current={current} />
      <main className="page-corps">
      <p className="error center">{message}</p>
      </main>
    </div>
  )
}
