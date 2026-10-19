// Le bandeau et la maintenance, que l'administrateur règle au QG
// (`/admin#maintenance`). Le souhait du propriétaire du 19 octobre 2026, le
// jour où le quiz du jour et les défis ne s'ouvraient plus en production :
// « avertir les utilisateurs des problèmes avec un bandeau rouge », et
// « mettre en maintenance certaines pages […] pour pas que les gens tentent
// d'accéder à quelque chose qui ne marche pas ».
//
// Le serveur tient l'état (`server/src/core/maintenance.ts`), l'écrit dans
// chaque page qu'il sert — le bandeau en clair au-dessus de la page, les
// pages fermées dans une balise (`ecrireLeService`, `server/src/core/page.ts`)
// — et ferme les routes qui y commencent quelque chose
// (`server/src/maintenance.ts`). Ici, ce que les deux côtés lisent de la même
// façon : quelles pages, sous quels noms, quelle adresse ouvre quelle page,
// et où se montre le bandeau. Rien d'importé : le premier script de chaque
// page le lit.

import type { Route } from './adresses'

/** Les pages qui se mettent en maintenance, dans l'ordre où le QG les montre. */
export const PAGES_EN_MAINTENANCE = ['jour', 'campagne', 'defi', 'duels', 'expedition', 'boutique'] as const
export type PageEnMaintenance = (typeof PAGES_EN_MAINTENANCE)[number]

export const estUnePageEnMaintenance = (x: unknown): x is PageEnMaintenance => (PAGES_EN_MAINTENANCE as readonly unknown[]).includes(x)

/**
 * Chaque page, telle que le QG la nomme (`nom`), ce que sa fermeture ferme
 * (`ferme`), et le titre de l'écran qui la remplace (`titre`). Le défi de la
 * semaine n'a pas d'adresse à lui : c'est un onglet de la campagne, qu'il
 * ferme seul.
 */
export const PAGES_FERMABLES: Record<PageEnMaintenance, { nom: string; ferme: string; titre: string }> = {
  jour: { nom: 'Le quiz du jour', ferme: 'Sa page et « Commencer » ; le rappel du soir se tait', titre: 'Le quiz du jour est en maintenance' },
  campagne: {
    nom: 'La campagne',
    ferme: 'Les séries, les sentiers, le carnet et les parcours de thème — le défi de la semaine avec',
    titre: 'La campagne est en maintenance',
  },
  defi: { nom: 'Le défi de la semaine', ferme: 'Son onglet de la campagne, seul', titre: 'Le défi de la semaine est en maintenance' },
  duels: { nom: 'Les duels', ferme: 'Les duels classés, le dé contre Automate et les défis entre amis', titre: 'Les duels sont en maintenance' },
  expedition: { nom: 'L’Expédition', ferme: 'Sa page et le départ', titre: 'L’Expédition est en maintenance' },
  boutique: { nom: 'La boutique', ferme: 'Sa page et ses achats : thèmes, compagnons, fonds de carte', titre: 'La boutique est en maintenance' },
}

/** Ce que dit l'écran d'une page fermée, sous son titre, et le bouton de l'accueil qui y mène. */
export const ON_REPARE = 'Une réparation est en cours : reviens un peu plus tard. Rien de ce que tu as gagné n’est perdu.'
export const BOUTON_EN_MAINTENANCE = 'En maintenance : reviens un peu plus tard'

/**
 * Les classes des bandeaux, que le serveur écrit dans la page et que la page
 * mesure (`main.tsx`) : une seule orthographe des deux côtés. Le second est
 * celui que l'administrateur lit sur une page qu'il a fermée.
 */
export const CLASSE_DU_BANDEAU = 'bandeau-du-service'
export const CLASSE_POUR_L_ADMINISTRATEUR = 'bandeau-administrateur'

/** Ce que lit l'administrateur sur une page qu'il a fermée : il y entre encore, et sans un mot ne verrait pas qu'elle l'est. */
export const pourLAdministrateur = (page: PageEnMaintenance): string => `${PAGES_FERMABLES[page].titre} pour les joueurs : toi seul y entres, pour vérifier la réparation.`

/**
 * Le bandeau, en caractères : il dit le problème en une phrase ou deux, et
 * se lit au téléphone au-dessus de la page — au-delà, quatre lignes en
 * 360 de large repoussaient les gros boutons de l'accueil.
 */
export const BANDEAU_MAX = 140

/**
 * La page qu'ouvre une adresse, quand elle se met en maintenance. Le défi n'y
 * est jamais : son onglet se dit dans le fragment (`#defi`), que le serveur ne
 * reçoit pas — la campagne le ferme elle-même.
 */
export function pageDeLAdresse(route: Route): PageEnMaintenance | null {
  if (route.kind !== 'account') return null
  switch (route.page) {
    case 'jour':
    case 'campagne':
    case 'duels':
    case 'expedition':
    case 'boutique':
      return route.page
    default:
      return null
  }
}

/**
 * Où se montre le bandeau : partout hors d'une soirée. Ni le téléphone d'un
 * invité — il prendrait la place des réponses, en 360 × 640 —, ni l'écran
 * commun, qui le projetterait à toute la salle, ni les pages publiques d'une
 * soirée, qu'on rouvre longtemps après.
 */
export function montreLeBandeau(route: Route): boolean {
  if (route.kind === 'join' || route.kind === 'public') return false
  return !(route.kind === 'account' && (route.page === 'host' || route.page === 'tele'))
}

/** Les pages fermées telles que la page servie les écrit (`<meta name="maintenance">`), dans l'ordre du QG. */
export function ecrireLesFermees(fermees: Iterable<PageEnMaintenance>): string {
  const lesQuelles = new Set(fermees)
  return PAGES_EN_MAINTENANCE.filter(p => lesQuelles.has(p)).join(' ')
}

/** Et relues : ce qui n'est pas une page connue se tait — une page d'avant, une balise abîmée. */
export function lireLesFermees(contenu: string | null | undefined): PageEnMaintenance[] {
  return (contenu ?? '').split(/\s+/).filter(estUnePageEnMaintenance)
}

/** Ce que le QG lit de la maintenance (`GET /api/admin/maintenance`). */
export interface EtatDeLaMaintenance {
  maintenant: number
  /** Le bandeau affiché, et depuis quand ; null s'il n'y en a pas. */
  bandeau: { texte: string; depuis: number } | null
  /** Chaque page : depuis quand elle est fermée, ou null si elle est ouverte. */
  pages: Record<PageEnMaintenance, number | null>
}

/** Ce qui est posé — les pages fermées, et le bandeau : la pastille de la page au QG. */
export function ceQuiEstPose(etat: Pick<EtatDeLaMaintenance, 'bandeau' | 'pages'>): number {
  return PAGES_EN_MAINTENANCE.filter(p => etat.pages[p] !== null).length + (etat.bandeau ? 1 : 0)
}
