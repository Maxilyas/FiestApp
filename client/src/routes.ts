// Les adresses de l'application, côté client.
//
//   /                         l'accueil : mon profil — et de quoi animer ou rejoindre
//   /host /edit /compte …     les pages de l'animateur — son espace vient de sa session
//   /profil                   la même page que l'accueil, à son adresse d'origine
//   /jour                     le quiz du jour, pour les profils
//   /<espace>                 le téléphone des invités de cet espace (la valeur du QR)
//   /<espace>/souvenir        les pages publiques de sa soirée en cours…
//   /<espace>/soirees/<id>/…  …et de ses soirées archivées, avec les mêmes pages
//   /<espace>/stats           l'ancienne adresse des chiffres : elle ouvre le souvenir sur son tableau
//   /s/<espace>/recap.json    les données que ces pages lisent
//
// Le serveur redirige les adresses d'avant les espaces (`/bilan`, `/soirees`…)
// vers l'espace de l'administrateur : les liens déjà partagés restent bons.
import { parseRoute, type AccountPage, type PublicPage, type Route } from '../../shared/adresses'

export { parseRoute }
export type { AccountPage, PublicPage, Route }
export type DataFile = 'recap.json' | 'bilan.json' | 'soirees.json' | 'space.json'

/** La route de la page ouverte, lue une fois pour toutes. */
export const route: Route = parseRoute(window.location.pathname)

// « /Chez-Bruno » s'ouvre sous le nom que l'espace porte vraiment : l'adresse
// qu'on recopie ou qu'on partage ensuite est la bonne. En ligne, le serveur a
// déjà redirigé ; ceci sert au serveur de développement.
// Des segments filtrés, comme `parseRoute` : « //banc » devenait « /banc/banc ».
if (route.kind === 'join' || route.kind === 'public') {
  const segs = window.location.pathname.split('/').filter(Boolean)
  const voulu = '/' + [route.slug, ...segs.slice(1)].join('/')
  if (window.location.pathname !== voulu) {
    history.replaceState(null, '', `${voulu}${window.location.search}${window.location.hash}`)
  }
}

/** Le nom de l'espace dans l'adresse de la page ouverte, s'il y en a un. */
export function currentSlug(): string | null {
  return route.kind === 'join' || route.kind === 'public' ? route.slug : null
}

/** L'espace et, le cas échéant, la soirée archivée dont parle la page ouverte. */
export function pageContext(): { slug: string; archiveId: string | null } {
  if (route.kind === 'public') return { slug: route.slug, archiveId: route.archiveId }
  return { slug: route.kind === 'join' ? route.slug : '', archiveId: null }
}

/** Où mène un lien vers une page d'un espace — la soirée en cours, ou une soirée archivée. */
export function spacePath(slug: string, page: PublicPage | '' = '', archiveId: string | null = null): string {
  let path = `/${slug}`
  if (archiveId) path += `/soirees/${archiveId}`
  if (page) path += `/${page}`
  return path
}

/** D'où une page tire ses chiffres. */
export function dataUrl(slug: string, file: DataFile, archiveId: string | null = null): string {
  return `/s/${slug}${archiveId ? `/soirees/${archiveId}` : ''}/${file}`
}
