// Les adresses de l'application, côté client.
//
//   /                         l'accueil : « quelle soirée ? »
//   /host /edit /compte …     les pages de l'animateur — son espace vient de sa session
//   /<espace>                 le téléphone des invités de cet espace (la valeur du QR)
//   /<espace>/souvenir        les pages publiques de sa soirée en cours…
//   /<espace>/soirees/<id>/…  …et de ses soirées archivées, avec les mêmes pages
//   /s/<espace>/recap.json    les données que ces pages lisent
//
// Le serveur redirige les adresses d'avant les espaces (`/bilan`, `/soirees`…)
// vers l'espace de l'administrateur : les liens déjà partagés restent bons.
import { RESERVED_SLUGS, SLUG } from '../../shared/space'

export type PublicPage = 'souvenir' | 'stats' | 'bilan' | 'bilan/fiches' | 'soirees'
export type AccountPage = 'host' | 'edit' | 'connexion' | 'activer' | 'compte' | 'admin'
export type DataFile = 'recap.json' | 'bilan.json' | 'soirees.json' | 'space.json'

export type Route =
  | { kind: 'landing' }
  | { kind: 'account'; page: AccountPage }
  | { kind: 'join'; slug: string }
  | { kind: 'public'; slug: string; page: PublicPage; archiveId: string | null }
  | { kind: 'unknown' }

const ACCOUNT_PAGES: AccountPage[] = ['host', 'edit', 'connexion', 'activer', 'compte', 'admin']
const PUBLIC_PAGES: PublicPage[] = ['souvenir', 'stats', 'bilan', 'bilan/fiches', 'soirees']
const ARCHIVE_ID = /^[\w-]{1,64}$/

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return { kind: 'landing' }
  const [first, ...rest] = parts
  if ((ACCOUNT_PAGES as string[]).includes(first)) return { kind: 'account', page: first as AccountPage }
  if (!SLUG.test(first) || RESERVED_SLUGS.has(first)) return { kind: 'unknown' }
  if (rest.length === 0) return { kind: 'join', slug: first }
  let archiveId: string | null = null
  let tail = rest
  if (rest[0] === 'soirees' && rest.length >= 2 && ARCHIVE_ID.test(rest[1])) {
    archiveId = rest[1]
    tail = rest.slice(2)
  }
  // « /romane/soirees/<id> » tout court ouvre le souvenir de cette soirée.
  const page = (tail.join('/') || (archiveId ? 'souvenir' : '')) as PublicPage
  if (!PUBLIC_PAGES.includes(page) || (archiveId && page === 'soirees')) return { kind: 'unknown' }
  return { kind: 'public', slug: first, page, archiveId }
}

/** La route de la page ouverte, lue une fois pour toutes. */
export const route: Route = parseRoute(window.location.pathname)

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
