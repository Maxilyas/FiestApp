import type { ArchiveSummary } from '../../../shared/archive'
import { formatDay } from '../../../shared/archive'
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
  // « Soirée du 24 septembre 2026 · 24 septembre 2026 » : un titre qui porte
  // déjà sa date ne la répète pas.
  const jour = formatDay(archive.heldAt)
  return (
    <p className="archive-banner">
      <Icon name="book" />
      <span>
        {archiveId ? 'Soirée archivée' : 'La dernière soirée'} : <strong>{archive.title}</strong>
        {!archive.title.includes(jour) && ` · ${jour}`}
      </span>
      {/* « Historique » : la même page s'appelait aussi Soirées, Mes soirées,
          Les soirées et Toutes les soirées. */}
      <a href={spacePath(slug, 'soirees')}>Historique</a>
    </p>
  )
}
