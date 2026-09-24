import type { ArchiveSummary } from '../../../shared/archive'
import { pageContext, spacePath } from '../routes'
import { Icon } from './Icon'

/**
 * En tête d'une page qui relit une soirée archivée : laquelle, et le chemin
 * vers les autres. Sous l'adresse de l'espace, c'est la dernière soirée close
 * qui s'affiche entre deux soirées (`lecteurDePage`) : le bandeau le dit,
 * pour qu'on ne la prenne pas pour celle qui va commencer.
 */
export function ArchiveBanner({ archive }: { archive: ArchiveSummary }) {
  const { slug, archiveId } = pageContext()
  return (
    <p className="archive-banner">
      <Icon name="book" />
      <span>
        {/* Sans la date : l'en-tête de la page la dit juste en dessous, et le
            bilan d'une archive l'écrivait trois fois. */}
        {archiveId ? 'Soirée archivée' : 'La dernière soirée'} : <strong>{archive.title}</strong>
      </span>
      <a href={spacePath(slug, 'soirees')}>Toutes les soirées</a>
    </p>
  )
}
