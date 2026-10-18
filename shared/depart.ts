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
import type { PublicProfile } from './profil'
import type { PartySnapshot } from './types'

export const DEPART = {
  /** La console ouverte sur ce navigateur (`currentMe`). */
  console: '/api/auth/me',
  /** Le profil en détail : sa page et la boutique. */
  moi: '/api/joueur/moi',
  /** L'en-tête du profil, sa série, ses sentiers : l'accueil. */
  moiAccueil: '/api/joueur/moi?accueil',
  /**
   * Ses missions du jour, sous son identité : l'accueil. Demandées une fois
   * l'accueil lu, elles arrivaient un aller-retour après lui, et leur ligne
   * attendait vide sous les yeux (le 15 octobre 2026).
   */
  missions: '/api/joueur/missions',
  /** Prénom, niveau, thème : les pages de jeu. */
  moiLeger: '/api/joueur/moi?leger',
  /** Le thème seul, pour les pages qui ne lisent pas le profil (`confirmerTheme`). */
  theme: '/api/joueur/theme',
  /** La partie du jour — sa réponse remesure l'heure (`avecLHeure`, `client/src/api.ts`). */
  jour: '/api/jour',
  campagne: '/api/campagne',
  /** La page des duels : sa cote, sa ligue, sa semaine, le classement. */
  duels: '/api/duels',
  /** L'expédition en route, sinon la prochaine et ses gardiens. */
  expedition: '/api/expedition',
  /** Les sentiers du savoir — préchargés par la page, pas par le serveur (`donneesDuFragment`). */
  sentiers: '/api/campagne/sentiers',
  /** Le carnet de révision, en tête de l'onglet « Apprendre » — préchargé comme les sentiers. */
  carnet: '/api/campagne/carnet',
  /** Les parcours de thème, sous le carnet — préchargés avec lui. */
  sujets: '/api/campagne/sujets',
  /** Les quiz de l'espace (« Mes quiz »). */
  quiz: '/api/quizzes',
} as const

/** Ce qu'une page de soirée lit sous `/s/<espace>/…`. */
export type FichierDeSoiree = 'recap.json' | 'bilan.json' | 'soirees.json' | 'space.json' | 'entree.json'

/**
 * L'entrée d'un invité telle que `party:watch` la lui dirait — l'instantané
 * des téléphones, et le profil que le cookie reconnaît —, servie par
 * `/s/<espace>/entree.json` et préchargée avec la page. Son code arrivé,
 * l'entrée attendait encore la liaison temps réel : la poignée de main et
 * deux échanges, une demi-seconde en 4G, une seconde en 4G lente, sur la
 * page que toute la salle ouvre en même temps.
 */
export interface EntreeDeDepart {
  snapshot: PartySnapshot
  profile?: PublicProfile
}

/**
 * L'entrée préchargée ne sert qu'au téléphone qui n'a rien à reprendre. Un
 * jeton attend sa re-présentation — la fiche du serveur fait foi (invariant
 * 9), et l'instantané seul montrait la salle d'attente d'un invité qui n'est
 * peut-être plus de la soirée —, une fin de soirée gardée passe d'abord, et
 * ce que la liaison a déjà dit est plus frais que la page.
 */
export function entreeUtilisable(t: { jeton: boolean; fin: boolean; liaison: boolean }): boolean {
  return !t.jeton && !t.fin && !t.liaison
}

/** D'où une page tire ses chiffres : la soirée en cours, ou une soirée archivée. */
export function adresseDesDonnees(slug: string, fichier: FichierDeSoiree, archiveId: string | null = null): string {
  return `/s/${slug}${archiveId ? `/soirees/${archiveId}` : ''}/${fichier}`
}

/**
 * Ce que la page d'une adresse demande dès son code arrivé, quel que soit le
 * visiteur : elle le demande aussi sans cookie (un invité reçoit `null` ou
 * 401), alors le serveur le précharge pour tous. L'entrée d'un invité, son
 * état de départ (`EntreeDeDepart`) — demandé par tout téléphone, même celui
 * qui ne s'en sert pas (`entreeUtilisable`). Une page qui cesse de demander
 * une adresse d'ici la laisse préchargée pour rien — le navigateur le dit
 * dans sa console, et `npm run mesure -- --cascade` le montre.
 */
export function donneesDeDepart(route: Route): string[] {
  if (route.kind === 'landing') return [DEPART.console, DEPART.moiAccueil, DEPART.missions]
  if (route.kind === 'join') return [adresseDesDonnees(route.slug, 'entree.json')]
  if (route.kind === 'account') {
    switch (route.page) {
      case 'profil':
      case 'boutique':
        return [DEPART.console, DEPART.moi]
      case 'jour':
        return [DEPART.jour, DEPART.moiLeger]
      case 'campagne':
        return [DEPART.campagne, DEPART.moiLeger]
      case 'duels':
        return [DEPART.duels, DEPART.moiLeger]
      case 'expedition':
        return [DEPART.expedition, DEPART.moiLeger]
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

/**
 * L'adresse des sentiers — `#sentiers`, ou l'un d'eux, `#sentier-foret` —,
 * où la campagne s'ouvre sur ses sentiers (`modeDe`, `CampagneApp`). Un
 * sentier inconnu en est aussi : il ouvre les sentiers sur leur carte, et
 * la règle n'a pas à connaître les branches, que le premier script de
 * chaque page n'emporte pas.
 */
export function versLesSentiers(hash: string): boolean {
  return hash === '#sentiers' || hash.startsWith('#sentier-')
}

/** L'adresse de l'onglet « Apprendre » — le carnet, puis les parcours de thème (`ADRESSE_DU_CARNET`, `Carnet.tsx`). */
export const ADRESSE_D_APPRENDRE = '#carnet'

/**
 * Ce que la page demandera dès son code arrivé, et que le serveur ne peut pas
 * précharger : le fragment de l'adresse (`#…`) ne lui parvient pas. Le
 * premier script le précharge (`main.tsx`), une demi-seconde avant que le
 * code de la page n'arrive pour le demander (4G) ; la page le demande au même
 * fragment, par la même règle — sinon la réponse préchargée attendrait un
 * `fetch` plus tardif, et lui rendrait celle d'avant.
 *
 * Les sentiers seuls ; l'onglet « Apprendre », son carnet et ses parcours de
 * thème ensemble — sa page les demande à son ouverture, quel que soit le
 * visiteur. Les parcours partaient avec les sentiers quand ils vivaient sous
 * eux (jusqu'au 12 octobre 2026) : demandés au montage, ils revenaient un
 * aller-retour après la carte et la redessinaient en entier.
 */
export function donneesDuFragment(route: Route, hash: string): string[] {
  if (route.kind !== 'account' || route.page !== 'campagne') return []
  if (versLesSentiers(hash)) return [DEPART.sentiers]
  return hash === ADRESSE_D_APPRENDRE ? [DEPART.carnet, DEPART.sujets] : []
}
