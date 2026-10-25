// Le bandeau et la maintenance, que l'administrateur règle au QG
// (`/admin#maintenance`). Le souhait du propriétaire du 19 octobre 2026, le
// jour où le quiz du jour et les défis ne s'ouvraient plus en production :
// « avertir les utilisateurs des problèmes avec un bandeau rouge », et
// « mettre en maintenance certaines pages […] pour pas que les gens tentent
// d'accéder à quelque chose qui ne marche pas ».
//
// Puis, le même jour : « mettre une fonctionnalité en “bientôt disponible” »
// — l'Expédition, qu'il essayait encore —, « cependant pouvoir autoriser
// l'accès à des personnes si je veux qu'ils testent ». Une page est donc
// ouverte, en maintenance, ou bientôt disponible : fermée à tous sauf à ses
// testeurs, des profils qu'il choisit au QG, et à lui.
//
// Le serveur tient l'état (`server/src/core/maintenance.ts`), l'écrit dans
// chaque page qu'il sert — le bandeau en clair au-dessus de la page, les
// pages fermées dans des balises (`ecrireLeService`, `server/src/core/page.ts`)
// — et ferme les routes qui y commencent quelque chose
// (`server/src/maintenance.ts`). Ici, ce que les deux côtés lisent de la même
// façon : quelles pages, sous quels noms, quelle adresse ouvre quelle page,
// où se montre le bandeau, et à qui une page est fermée. Rien d'importé : le
// premier script de chaque page le lit.

import type { Route } from './adresses'

/** Les pages qui se mettent en maintenance, dans l'ordre où le QG les montre. */
export const PAGES_EN_MAINTENANCE = ['jour', 'campagne', 'defi', 'duels', 'expedition', 'cabinet', 'boutique'] as const
export type PageEnMaintenance = (typeof PAGES_EN_MAINTENANCE)[number]

export const estUnePageEnMaintenance = (x: unknown): x is PageEnMaintenance => (PAGES_EN_MAINTENANCE as readonly unknown[]).includes(x)

/**
 * Ce que devient une page au QG : ouverte à tous, en maintenance — fermée le
 * temps d'une réparation, à tous sauf à l'administrateur —, ou bientôt
 * disponible — fermée à tous sauf à ses testeurs et à lui. Une page n'est
 * jamais deux à la fois.
 */
export const ETATS_D_UNE_PAGE = ['ouverte', 'maintenance', 'bientot'] as const
export type EtatDUnePage = (typeof ETATS_D_UNE_PAGE)[number]

export const estUnEtatDePage = (x: unknown): x is EtatDUnePage => (ETATS_D_UNE_PAGE as readonly unknown[]).includes(x)

/**
 * Chaque page, telle que le QG la nomme (`nom`), ce que sa fermeture ferme
 * (`ferme`), et le titre de l'écran qui la remplace — en maintenance
 * (`titre`), bientôt disponible (`bientot`). Le défi de la semaine n'a pas
 * d'adresse à lui : c'est un onglet de la campagne, qu'il ferme seul.
 */
export const PAGES_FERMABLES: Record<PageEnMaintenance, { nom: string; ferme: string; titre: string; bientot: string }> = {
  jour: {
    nom: 'Le quiz du jour',
    ferme: 'Sa page et « Commencer » ; le rappel du soir se tait',
    titre: 'Le quiz du jour est en maintenance',
    bientot: 'Le quiz du jour arrive bientôt',
  },
  campagne: {
    nom: 'La campagne',
    ferme: 'Les séries, les sentiers, le carnet et les parcours de thème — le défi de la semaine avec',
    titre: 'La campagne est en maintenance',
    bientot: 'La campagne arrive bientôt',
  },
  defi: { nom: 'Le défi de la semaine', ferme: 'Sa page et sa tuile de l’accueil, seules', titre: 'Le défi de la semaine est en maintenance', bientot: 'Le défi de la semaine arrive bientôt' },
  duels: {
    nom: 'Les duels',
    ferme: 'Les duels classés, le dé contre Automate et les défis entre amis',
    titre: 'Les duels sont en maintenance',
    bientot: 'Les duels arrivent bientôt',
  },
  expedition: { nom: 'L’Expédition', ferme: 'Sa page et le départ', titre: 'L’Expédition est en maintenance', bientot: 'L’Expédition arrive bientôt' },
  cabinet: {
    nom: 'Le Cabinet de curiosités',
    ferme: 'Sa page, le départ d’une partie, les achats et l’échange d’un jeu ; la partie en cours se finit',
    titre: 'Le Cabinet de curiosités est en maintenance',
    bientot: 'Le Cabinet de curiosités arrive bientôt',
  },
  boutique: {
    nom: 'La boutique',
    ferme: 'Sa page et ses achats : thèmes, compagnons, fonds de carte',
    titre: 'La boutique est en maintenance',
    bientot: 'La boutique arrive bientôt',
  },
}

/** Ce que dit l'écran d'une page fermée, sous son titre, et le bouton de l'accueil qui y mène. */
export const ON_REPARE = 'Une réparation est en cours : reviens un peu plus tard. Rien de ce que tu as gagné n’est perdu.'
export const BOUTON_EN_MAINTENANCE = 'En maintenance : reviens un peu plus tard'

/**
 * Et d'une page bientôt disponible : rien n'y est cassé, elle n'est pas
 * encore prête — « réparation » ferait croire à une panne.
 */
export const EN_AVANT_PREMIERE = 'Quelques testeurs l’essaient avant tout le monde : reviens dans quelques jours.'
export const BOUTON_BIENTOT = 'Bientôt disponible'
/**
 * Sur le bouton de l'accueil d'un testeur : il y entre avant tout le monde, et
 * le sait. Court : la pastille prend la place du chevron, et « Avant-première »
 * laissait sa ligne sur quatre lignes en 360 de large.
 */
export const PASTILLE_AVANT_PREMIERE = 'En test'

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
 * est jamais : sa page se dit dans le fragment de la campagne (`#defi`), que
 * le serveur ne reçoit pas — la campagne la ferme elle-même.
 */
export function pageDeLAdresse(route: Route): PageEnMaintenance | null {
  if (route.kind !== 'account') return null
  switch (route.page) {
    case 'jour':
    case 'campagne':
    case 'duels':
    case 'expedition':
    case 'cabinet':
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

/**
 * Des pages telles que la page servie les écrit (`<meta name="maintenance">`,
 * `<meta name="bientot">`, `<meta name="avant-premiere">`), dans l'ordre du QG.
 */
export function ecrireLesFermees(fermees: Iterable<PageEnMaintenance>): string {
  const lesQuelles = new Set(fermees)
  return PAGES_EN_MAINTENANCE.filter(p => lesQuelles.has(p)).join(' ')
}

/** Et relues : ce qui n'est pas une page connue se tait — une page d'avant, une balise abîmée. */
export function lireLesFermees(contenu: string | null | undefined): PageEnMaintenance[] {
  return (contenu ?? '').split(/\s+/).filter(estUnePageEnMaintenance)
}

/**
 * Ce que la page servie dit du service à qui la demande : les pages en
 * maintenance et les pages bientôt disponibles, pour tous ; s'il est
 * l'administrateur, qui entre partout ; et, parmi les bientôt disponibles,
 * celles qu'il essaie avant tout le monde — il en est testeur. Jamais la
 * liste des testeurs : chacun ne sait que ce qui le regarde.
 */
export interface VuDuService {
  fermees: readonly PageEnMaintenance[]
  bientot: readonly PageEnMaintenance[]
  admin: boolean
  avantPremiere: readonly PageEnMaintenance[]
}

/**
 * Une page est-elle fermée à qui regarde, et pourquoi ; null s'il y entre.
 * Une seule règle pour le serveur, qui sert la page sans rien précharger, et
 * pour la page, qui se remplace par l'écran qui le dit (`main.tsx`).
 */
export function fermeePour(vu: VuDuService, page: PageEnMaintenance): 'maintenance' | 'bientot' | null {
  if (vu.admin) return null
  if (vu.fermees.includes(page)) return 'maintenance'
  return vu.bientot.includes(page) && !vu.avantPremiere.includes(page) ? 'bientot' : null
}

/** Ce que le bouton d'une page dit sur l'accueil (`boutonDeLaPage`). */
export type BoutonDeLaPage = 'maintenance' | 'bientot' | 'avant-premiere'

/**
 * Ce que l'accueil dit d'une page sur son bouton ; null s'il n'en dit rien.
 * En maintenance, il s'éteint pour tous, l'administrateur compris : il y
 * entre pour vérifier, mais ce qui ne marche pas ne s'offre à personne.
 * Bientôt disponible, il s'éteint pour qui attend, et dit à un testeur — à
 * l'administrateur aussi — qu'il y entre avant tout le monde.
 */
export function boutonDeLaPage(vu: VuDuService, page: PageEnMaintenance): BoutonDeLaPage | null {
  if (vu.fermees.includes(page)) return 'maintenance'
  if (!vu.bientot.includes(page)) return null
  return vu.admin || vu.avantPremiere.includes(page) ? 'avant-premiere' : 'bientot'
}

/**
 * Un testeur, tel que le QG le montre : son prénom et son identifiant, qui
 * le distingue d'un homonyme — pas son avatar, qu'il faudrait montrer tel
 * qu'il le porte (`un-seul-avatar.test.ts`) pour une ligne qui ne fait que
 * le nommer.
 */
export interface TesteurDUnePage {
  id: string
  nom: string
  login: string
  /** Depuis quand il teste la page. */
  depuis: number
}

/** Ce que le QG lit de la maintenance (`GET /api/admin/maintenance`). */
export interface EtatDeLaMaintenance {
  maintenant: number
  /** Le bandeau affiché, et depuis quand ; null s'il n'y en a pas. */
  bandeau: { texte: string; depuis: number } | null
  /** Chaque page : depuis quand elle est fermée, ou null si elle ne l'est pas. */
  pages: Record<PageEnMaintenance, number | null>
  /** Chaque page : depuis quand elle est bientôt disponible, ou null. Jamais une page à la fois ici et dans `pages`. */
  bientot: Record<PageEnMaintenance, number | null>
  /**
   * Ses testeurs, du premier venu au dernier : ils y entrent tant qu'elle est
   * bientôt disponible. Ouverte à tous ou en maintenance, elle les garde pour
   * la fois suivante.
   */
  testeurs: Record<PageEnMaintenance, TesteurDUnePage[]>
}

/**
 * Ce qui est posé — les pages fermées, et le bandeau : la pastille rouge de
 * la page au QG. Une page bientôt disponible n'en est pas : rien n'y est
 * cassé, et elle peut attendre des semaines sans rien demander.
 */
export function ceQuiEstPose(etat: Pick<EtatDeLaMaintenance, 'bandeau' | 'pages'>): number {
  return PAGES_EN_MAINTENANCE.filter(p => etat.pages[p] !== null).length + (etat.bandeau ? 1 : 0)
}
