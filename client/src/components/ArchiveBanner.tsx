import type { ArchiveSummary } from '../../../shared/archive'
import { formatDay } from '../../../shared/archive'
import { Icon } from './Icon'

/** En tête d'une page qui relit une soirée archivée : laquelle, et le chemin vers les autres. */
export function ArchiveBanner({ archive }: { archive: ArchiveSummary }) {
  return (
    <p className="archive-banner">
      <Icon name="book" />
      <span>
        Soirée archivée : <strong>{archive.title}</strong> · {formatDay(archive.heldAt)}
      </span>
      <a href="/soirees">Toutes les soirées</a>
    </p>
  )
}
