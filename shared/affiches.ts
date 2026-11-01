import { tronquer } from './avatars'
import { CONFETTIS_PAR_DON_MAX } from './profil'
import { messageNet } from './annonces'
import type { PageEnMaintenance } from './maintenance'

/**
 * L'affiche d'une nouveauté (`/admin#affiches`, sous « Animer ») — le souhait
 * du propriétaire du 1er novembre 2026, à la veille d'ouvrir le Cabinet de
 * curiosités à tous : « un bandeau super joli, lorsque j'ai des nouvelles
 * fonctionnalités qui sortent […] je pense que beaucoup de gens n'utilisent pas
 * des fonctionnalités car ils ne sont pas au courant ». Les deux propositions
 * retenues : une affiche en haut de l'accueil de chaque profil, et une
 * pastille « Nouveau » sur le gros bouton de la page qu'elle montre.
 *
 * Elle se tait d'elle-même quand elle a servi : le serveur note la visite de la
 * page qu'elle montre — la page servie à ce profil, d'où qu'il vienne, le lien
 * de l'affiche, son gros bouton ou un favori —, et l'accueil suivant n'a plus
 * ni l'affiche ni la pastille. « Plus tard » ne range que l'affiche : la
 * pastille reste, discrète, jusqu'à la visite. Et sa date de fin, choisie au
 * QG, la tait pour tous.
 *
 * Une annonce (`shared/annonces.ts`) se lit une fois et parle d'un fait passé ;
 * l'affiche, elle, pousse vers une page tant qu'on n'y est pas allé — un
 * profil né après elle la voit aussi.
 */

/**
 * Les pages qu'une affiche peut montrer, dans l'ordre où le QG les propose :
 * celles qui ont leur adresse, que le serveur reconnaît en servant la page
 * (`pageDeLAdresse`). Le défi de la semaine n'en a pas — sa page se dit dans
 * le fragment de la campagne, que le serveur ne reçoit pas : sa visite ne se
 * noterait jamais.
 */
export const PAGES_A_L_AFFICHE = ['cabinet', 'campagne', 'jour', 'duels', 'boutique'] as const satisfies readonly PageEnMaintenance[]
export type PageALAffiche = (typeof PAGES_A_L_AFFICHE)[number]

export const estUnePageALAffiche = (x: unknown): x is PageALAffiche => (PAGES_A_L_AFFICHE as readonly unknown[]).includes(x)

/**
 * Chaque page qu'une affiche montre : son nom au QG, la préposition qui la dit
 * dans une phrase (« ta première visite au Cabinet de curiosités »), son
 * adresse, le bouton de l'affiche, et le titre et la phrase que le QG propose
 * d'office — l'administrateur les réécrit à sa guise. Le bouton tient sur une
 * ligne en 360 de large, « Plus tard » à côté : « Entrer dans le Cabinet »
 * passait sur deux, et l'affiche repoussait les gros boutons sous le pli.
 */
export interface DestinationDUneAffiche {
  nom: string
  a: string
  chemin: string
  bouton: string
  titre: string
  phrase: string
}

export const DESTINATIONS: Record<PageALAffiche, DestinationDUneAffiche> = {
  cabinet: {
    nom: 'Le Cabinet de curiosités',
    a: 'au Cabinet de curiosités',
    chemin: '/cabinet',
    bouton: 'Visiter le Cabinet',
    titre: 'Le Cabinet de curiosités ouvre ses portes',
    phrase: 'Trois actes, trois gardiens à vaincre : l’un d’eux deviendra ton avatar légendaire.',
  },
  campagne: {
    nom: 'La campagne',
    a: 'à la campagne',
    chemin: '/campagne',
    bouton: 'Ouvrir la campagne',
    titre: 'Du nouveau dans la campagne',
    phrase: 'Des séries sans fin, des sentiers à gravir et des portraits à gagner, à ton rythme.',
  },
  jour: {
    nom: 'Le quiz du jour',
    a: 'au quiz du jour',
    chemin: '/jour',
    bouton: 'Jouer aujourd’hui',
    titre: 'Du nouveau au quiz du jour',
    phrase: 'Dix questions, les mêmes pour tous, chaque jour : garde ta série et vise le podium.',
  },
  duels: {
    nom: 'Les duels',
    a: 'aux duels',
    chemin: '/duels',
    bouton: 'Ouvrir les duels',
    titre: 'Du nouveau dans les duels',
    phrase: 'Défie qui tu veux, ou Automate, et monte de ligue semaine après semaine.',
  },
  boutique: {
    nom: 'La boutique',
    a: 'à la boutique',
    chemin: '/boutique',
    bouton: 'Ouvrir la boutique',
    titre: 'Du nouveau en boutique',
    phrase: 'Des thèmes, des compagnons et des fonds de carte à découvrir avec tes confettis.',
  },
}

/** Ce que dit la pastille du gros bouton d'une page à l'affiche, tant qu'il n'y est pas allé. */
export const PASTILLE_NOUVEAU = 'Nouveau'

/**
 * Le titre d'une affiche, au plus : deux lignes de la serif en 360 de large —
 * au-delà, l'affiche repoussait les gros boutons sous le pli.
 */
export const TITRE_D_AFFICHE_MAX = 48
/** Sa phrase, au plus : trois lignes au téléphone, sous le titre. */
export const PHRASE_D_AFFICHE_MAX = 140

/** Combien de jours une affiche reste, au choix du QG ; deux semaines d'office. */
export const JOURS_A_L_AFFICHE = [7, 14, 21, 28] as const
export const JOURS_D_OFFICE = 14

const JOUR_MS = 24 * 3_600_000

/** Ce qu'une affiche demandée au QG devient, une fois lue. */
export interface DemandeDAffiche {
  page: PageALAffiche
  titre: string
  phrase: string
  jours: (typeof JOURS_A_L_AFFICHE)[number]
  /** Ce que la première visite de la page rapporte à chaque profil, de 0 à `CONFETTIS_PAR_DON_MAX`. */
  confettis: number
}

/** Un texte de l'affiche : ses blancs resserrés, refusé vide ou trop long — jamais coupé, il dirait autre chose. */
function lireUnTexte(brut: unknown, max: number, vide: string, long: string): string {
  const net = typeof brut === 'string' ? messageNet(brut) : ''
  if (!net) throw new Error(vide)
  if (tronquer(net, max) !== net) throw new Error(long)
  return net
}

/** L'affiche telle que le serveur la garde, ou un refus en mots (un 400). */
export function lireLAffiche(brut: unknown): DemandeDAffiche {
  const b = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>
  if (!estUnePageALAffiche(b.page)) throw new Error('Choisis la page que l’affiche montre')
  const titre = lireUnTexte(b.titre, TITRE_D_AFFICHE_MAX, 'Écris le titre de l’affiche', `Le titre tient en ${TITRE_D_AFFICHE_MAX} caractères : raccourcis-le`)
  const phrase = lireUnTexte(b.phrase, PHRASE_D_AFFICHE_MAX, 'Écris la phrase de l’affiche', `La phrase tient en ${PHRASE_D_AFFICHE_MAX} caractères : raccourcis-la`)
  const jours = JOURS_A_L_AFFICHE.find(j => j === b.jours)
  if (!jours) throw new Error(`Choisis combien de jours elle reste : ${JOURS_A_L_AFFICHE.join(', ')}`)
  const confettis = b.confettis ?? 0
  if (typeof confettis !== 'number' || !Number.isInteger(confettis) || confettis < 0 || confettis > CONFETTIS_PAR_DON_MAX) {
    throw new Error(`Entre 0 et ${CONFETTIS_PAR_DON_MAX} confettis pour la première visite`)
  }
  return { page: b.page, titre, phrase, jours, confettis }
}

/** La fin d'une affiche posée à `le` pour `jours` jours. */
export const finDeLAffiche = (le: number, jours: number) => le + jours * JOUR_MS

/**
 * Le mot du don de sa première visite, dit une fois sur son accueil avec les
 * confettis (`CarteDeLAdministrateur`) : « Pour ta première visite au Cabinet
 * de curiosités ».
 */
export const motDeLaPremiereVisite = (page: PageALAffiche) => `Pour ta première visite ${DESTINATIONS[page].a}`

/** Une affiche telle que l'accueil d'un profil la reçoit : en cours, et lui pas encore allé sur sa page. */
export interface AfficheDAccueil {
  id: string
  page: PageALAffiche
  titre: string
  phrase: string
  /** Ce que sa première visite lui rapportera ; 0, rien. */
  confettis: number
  /** Rangée par « Plus tard » : l'affiche se tait, la pastille de son bouton reste. */
  rangee: boolean
}

/**
 * Ce que l'accueil en montre : la plus récente qu'il n'a pas rangée, en grand,
 * et la pastille « Nouveau » sur le bouton de chaque page à l'affiche — les
 * rangées comprises. `ouverte` dit si la page lui est ouverte : une page en
 * maintenance, bientôt disponible sans qu'il l'essaie, ou un Cabinet fermé sur
 * ce serveur ne se montre pas — l'affiche mènerait à un écran qui le dit.
 */
export function ceQueMontreLAccueil(
  affiches: readonly AfficheDAccueil[],
  ouverte: (page: PageALAffiche) => boolean,
  rangeesIci: ReadonlySet<string> = new Set(),
): { grande: AfficheDAccueil | null; nouvelles: PageALAffiche[] } {
  const montrables = affiches.filter(a => estUnePageALAffiche(a.page) && ouverte(a.page))
  return {
    grande: montrables.find(a => !a.rangee && !rangeesIci.has(a.id)) ?? null,
    nouvelles: [...new Set(montrables.map(a => a.page))],
  }
}

/** Les affiches que la page du QG liste, au plus. */
export const AFFICHES_MONTREES = 50

/** Une affiche, telle que le QG la liste. */
export interface AfficheAuQg {
  id: string
  page: PageALAffiche
  titre: string
  phrase: string
  confettis: number
  le: number
  fin: number
  /** Retirée avant sa fin : l'accueil la tait à tous. */
  retireeLe: number | null
  /** Les profils allés sur sa page depuis qu'elle est posée — chacun a reçu ses confettis. */
  ouvertes: number
  /** Ceux qui l'ont rangée par « Plus tard » sans y être allés (encore). */
  rangees: number
}

/** Elle se montre encore : ni retirée, ni passée. */
export const afficheEnCours = (a: Pick<AfficheAuQg, 'retireeLe' | 'fin'>, maintenant: number) => a.retireeLe === null && maintenant < a.fin

/** La page des affiches au QG. */
export interface PageDesAffiches {
  maintenant: number
  /** Les affiches posées, de la plus récente à la plus ancienne. */
  affiches: AfficheAuQg[]
}
