// Les adresses de l'application, lues de la même façon des deux côtés : le
// client y choisit sa page, le serveur y décide du statut, des balises
// d'aperçu et de l'indexation (`server/src/core/apercus.ts`). Deux lectures
// divergeaient vite : une adresse que le client ouvre et que le serveur
// déclare introuvable, ou l'inverse.
import { RESERVED_SLUGS, SLUG, normalizeSlug } from './space'

export type PublicPage = 'souvenir' | 'stats' | 'bilan' | 'bilan/fiches' | 'soirees'
/**
 * Les pages qui ne portent pas d'espace dans leur adresse. « profil » est la
 * seule qui ne soit pas réservée aux animateurs : c'est celle des joueurs, et
 * c'est aussi l'accueil — demander « quelle soirée ? » avant même de savoir
 * qui est là n'avait aucun sens pour celui qui revient.
 */
export type AccountPage = 'host' | 'edit' | 'connexion' | 'activer' | 'compte' | 'admin' | 'profil'

export type Route =
  | { kind: 'landing' }
  | { kind: 'account'; page: AccountPage }
  | { kind: 'join'; slug: string }
  | { kind: 'public'; slug: string; page: PublicPage; archiveId: string | null }
  | { kind: 'unknown' }

export const ACCOUNT_PAGES: AccountPage[] = ['host', 'edit', 'connexion', 'activer', 'compte', 'admin', 'profil']
const PUBLIC_PAGES: PublicPage[] = ['souvenir', 'stats', 'bilan', 'bilan/fiches', 'soirees']
const ARCHIVE_ID = /^[\w-]{1,64}$/

/**
 * Le nom d'espace qu'un humain a voulu taper dans l'adresse : « Chez-Bruno »,
 * « chez%20bruno » ou « chèz-bruno » mènent à « chez-bruno ». Refusée pour
 * une majuscule, l'adresse dictée à l'oreille ne pardonnait rien.
 */
export function slugTape(segment: string): string {
  let brut = segment
  try {
    brut = decodeURIComponent(segment)
  } catch {
    // Un « % » isolé : on lit le segment tel quel.
  }
  return normalizeSlug(brut)
}

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return { kind: 'landing' }
  const [brut, ...rest] = parts
  if ((ACCOUNT_PAGES as string[]).includes(brut)) return { kind: 'account', page: brut as AccountPage }
  const first = SLUG.test(brut) ? brut : slugTape(brut)
  if (!SLUG.test(first) || RESERVED_SLUGS.has(first)) return { kind: 'unknown' }
  if (rest.length === 0) return { kind: 'join', slug: first }
  let archiveId: string | null = null
  let tail = rest
  if (rest[0] === 'soirees' && rest.length >= 2 && ARCHIVE_ID.test(rest[1])) {
    archiveId = rest[1]
    tail = rest.slice(2)
  }
  // « /demo/soirees/<id> » tout court ouvre le souvenir de cette soirée.
  const page = (tail.join('/') || (archiveId ? 'souvenir' : '')) as PublicPage
  if (!PUBLIC_PAGES.includes(page) || (archiveId && page === 'soirees')) return { kind: 'unknown' }
  return { kind: 'public', slug: first, page, archiveId }
}
