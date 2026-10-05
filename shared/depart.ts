// Ce qu'une page demande au serveur dès que son code est arrivé — et que le
// serveur, qui sert la page, lui fait demander d'avance.
//
// Une page attendait son code (le script d'entrée, puis celui de sa vue) pour
// demander ses données : un aller-retour de plus, l'un derrière l'autre, à
// chaque ouverture, cache plein compris — 0,2 s en 4G, 0,6 s en 4G lente
// (`retours/2026-10-05/affichage-des-pages.md`). Le serveur connaît
// l'adresse quand il sert la page : il y pose `<link rel="preload"
// as="fetch">` pour chaque donnée de départ (`server/src/core/page.ts`), le
// navigateur la demande avec le script, et le `fetch` de la page reprend la
// réponse déjà arrivée.
//
// Le préchargement ne sert que si l'adresse est exactement celle que la page
// demande : une lettre de différence, et il partait pour rien. Les deux côtés
// la lisent donc ici.

import type { Route } from './adresses'

export const DEPART = {
  /** La console ouverte sur ce navigateur (`currentMe`). */
  console: '/api/auth/me',
  /** Le profil en détail : sa page et la boutique. */
  moi: '/api/joueur/moi',
  /** L'en-tête du profil, sa série, ses sentiers : l'accueil. */
  moiAccueil: '/api/joueur/moi?accueil',
  /** Prénom, niveau, thème : les pages de jeu. */
  moiLeger: '/api/joueur/moi?leger',
  /** Le thème seul, pour les pages qui ne lisent pas le profil (`confirmerTheme`). */
  theme: '/api/joueur/theme',
  /** La partie du jour — sa réponse remesure l'heure (`avecLHeure`, `client/src/api.ts`). */
  jour: '/api/jour',
  campagne: '/api/campagne',
  /** Les quiz de l'espace (« Mes quiz »). */
  quiz: '/api/quizzes',
} as const

/** Ce qu'une page de soirée lit sous `/s/<espace>/…`. */
export type FichierDeSoiree = 'recap.json' | 'bilan.json' | 'soirees.json' | 'space.json'

/** D'où une page tire ses chiffres : la soirée en cours, ou une soirée archivée. */
export function adresseDesDonnees(slug: string, fichier: FichierDeSoiree, archiveId: string | null = null): string {
  return `/s/${slug}${archiveId ? `/soirees/${archiveId}` : ''}/${fichier}`
}

/**
 * Ce que la page d'une adresse demande dès son code arrivé, quel que soit le
 * visiteur : elle le demande aussi sans cookie (un invité reçoit `null` ou
 * 401), alors le serveur le précharge pour tous. Rien pour l'entrée d'un
 * invité : elle attend la liaison temps réel, pas une donnée. Une page qui
 * cesse de demander une adresse d'ici la laisse préchargée pour rien — le
 * navigateur le dit dans sa console, et `npm run mesure -- --cascade` le
 * montre.
 */
export function donneesDeDepart(route: Route): string[] {
  if (route.kind === 'landing') return [DEPART.console, DEPART.moiAccueil]
  if (route.kind === 'account') {
    switch (route.page) {
      case 'profil':
      case 'boutique':
        return [DEPART.console, DEPART.moi]
      case 'jour':
        return [DEPART.jour, DEPART.moiLeger]
      case 'campagne':
        return [DEPART.campagne, DEPART.moiLeger]
      case 'edit':
        return [DEPART.quiz, DEPART.console, DEPART.theme]
      default:
        return []
    }
  }
  if (route.kind === 'public') {
    const { slug, archiveId } = route
    // Les fiches du bilan s'impriment en Ivoire : pas de thème à confirmer
    // (`main.tsx`). Le bilan reconnaît son animateur avant de savoir qu'il
    // montre les fiches (`useIsHost`) : la console, si.
    if (route.page === 'bilan/fiches') return [adresseDesDonnees(slug, 'bilan.json', archiveId), DEPART.console]
    if (route.page === 'bilan') return [adresseDesDonnees(slug, 'bilan.json', archiveId), DEPART.console, DEPART.theme]
    if (route.page === 'soirees') return [adresseDesDonnees(slug, 'soirees.json'), DEPART.console, DEPART.theme]
    return [adresseDesDonnees(slug, 'recap.json', archiveId), DEPART.console, DEPART.theme]
  }
  return []
}
