// Les pages souvenir, statistiques et bilan servent aussi bien la soirée en
// cours (`/bilan`) qu'une soirée archivée (`/soirees/<id>/bilan`). Ici, ce qui
// les distingue : d'où viennent les chiffres, et où mènent les liens.

const ARCHIVED = /^\/soirees\/([\w-]+)(?:\/|$)/

/** L'identifiant de la soirée archivée que la page relit, ou null pour la soirée en cours. */
export function archiveId(): string | null {
  const m = ARCHIVED.exec(window.location.pathname)
  return m ? m[1] : null
}

/** D'où la page tire ses chiffres. */
export function dataUrl(file: 'recap.json' | 'bilan.json'): string {
  const id = archiveId()
  return id ? `/soirees/${id}/${file}` : `/${file}`
}

/** Où mène un lien vers une autre page de la même soirée. */
export function pageUrl(page: 'souvenir' | 'stats' | 'bilan' | 'bilan/fiches'): string {
  const id = archiveId()
  return id ? `/soirees/${id}/${page}` : `/${page}`
}
