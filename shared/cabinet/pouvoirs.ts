// Les cartes-bonus du Cabinet : avant chaque partie, on emporte une œuvre
// qu'on possède — ou un gardien réveillé —, et son pouvoir. Il vient de sa
// famille ; sa rareté le rend plus fort ; il ne s'use jamais. Cinq pouvoirs
// en tout : seul Éclairer s'écrit jeu par jeu, les quatre autres valent
// partout — un jeu de plus ne leur demande rien.
//
// Ce qu'on a gagné ne sert qu'ici, qu'on joue seul (invariant 8) : ni
// soirée, ni quiz du jour, ni défi, ni duel ne connaissent ces pouvoirs, et
// aucun joker de l'Expédition n'entre au Cabinet. Un Divin n'en a aucun
// (invariant 21).
//
// Ici, pur : à qui va quel pouvoir, à quelle force, ce que chaque force fait,
// pourquoi un pouvoir ne sert pas (une seule règle, que le pli applique et que
// la page lit sans la recopier), ce qu'Éclairer peut effacer d'une étape, et
// les étoiles après Protéger et Miser.

import {
  BONUS_DE_MISE,
  BONUS_DE_PROTECTION,
  CHANGEMENTS_PAR_PARTIE,
  ECLAIRAGES_PAR_PARTIE,
  EFFACES_AU_PLUS,
  ETOILES_D_UNE_PARTIE,
  FORCES_DES_RARETES,
  PROPOSITIONS_LAISSEES,
  SECONDES_PAR_FORCE,
} from './bareme'
import { JEUX, type CleDeJeu } from './jeux/regle'
import { oeuvre, type CleDuVestibule } from './oeuvres'
import { pouvoirDuGardien, type CleDeFamille } from './salles'

export type CleDePouvoir = 'eclairer' | 'proteger' | 'temps' | 'miser' | 'changer'
/** La force d'une carte-bonus : 1 pour une commune, 2 pour une rare ou une maudite, 3 pour une épique ou un gardien. */
export type Force = 1 | 2 | 3

export interface Pouvoir {
  nom: string
  /** Ce qu'il fait, en une phrase. */
  dit: string
  /** Un geste le joue (Éclairer, Changer, Miser) ; Protéger et Prendre son temps agissent seuls. */
  actif: boolean
}

/**
 * Ce que dit chacun, à l'annonce et dans les règles : ce qu'il fait, et ce
 * qu'on ignorerait sans le lire. Prendre son temps allonge chaque question —
 * deux par manche au Pari et à la Réplique — et ne compte, cadre doré compris,
 * que si la réponse arrive dans le temps en plus ; la mise a le plafond de la
 * partie (`ETOILES_D_UNE_PARTIE`), et manquée, sa manche ne vaut plus rien.
 * La tablée du 25 octobre 2026 misait à l'aveugle : « sinon, rien » ne disait
 * pas que la manche imparfaite tombait à zéro, ni que neuf étoiles bornaient
 * le gain.
 */
export const POUVOIRS: Readonly<Record<CleDePouvoir, Pouvoir>> = {
  eclairer: { nom: 'Éclairer', dit: 'Un indice, propre à chaque jeu.', actif: true },
  proteger: { nom: 'Protéger', dit: 'Ta première manche imparfaite gagne des étoiles.', actif: false },
  temps: { nom: 'Prendre son temps', dit: 'Du temps en plus à chaque question ; il ne compte que si tu t’en sers.', actif: false },
  miser: {
    nom: 'Miser',
    dit: `Avant une manche, sans l’avoir vue : parfaite, elle rapporte des étoiles en plus, jusqu’à ${ETOILES_D_UNE_PARTIE} sur la partie ; sinon, elle ne vaut rien.`,
    actif: true,
  },
  changer: { nom: 'Changer', dit: 'Remplace la manche par une autre, avant de répondre ; le chrono continue.', actif: true },
}

/** Le pouvoir de chaque famille : la façon de jouer de son style, à l'Expédition, devenue un coup de pouce. */
export const POUVOIR_DE_LA_FAMILLE: Readonly<Record<CleDeFamille, CleDePouvoir>> = {
  erudit: 'eclairer',
  devin: 'eclairer',
  rempart: 'proteger',
  elan: 'temps',
  metamorphe: 'changer',
  flambeur: 'miser',
  sophiste: 'changer',
  temeraire: 'miser',
}

/**
 * Au Vestibule, chaque carte a le sien, d'après ce qu'elle faisait dans les
 * rencontres : cinq éclairent, cinq protègent, cinq prennent leur temps, deux
 * changent, et les trois maudites misent.
 */
export const POUVOIR_DU_NEUTRE: Readonly<Record<CleDuVestibule, CleDePouvoir>> = {
  'coup-d-oeil': 'eclairer',
  repere: 'eclairer',
  lettre: 'eclairer',
  initiale: 'eclairer',
  evidence: 'eclairer',
  prudence: 'proteger',
  sursis: 'proteger',
  'double-chance': 'proteger',
  panacee: 'proteger',
  'sang-froid': 'proteger',
  concentration: 'temps',
  'arret-sur-image': 'temps',
  meditation: 'temps',
  maitrise: 'temps',
  pioche: 'temps',
  echange: 'changer',
  detour: 'changer',
  'tout-ou-rien': 'miser',
  'quitte-ou-double': 'miser',
  surmenage: 'miser',
}

/**
 * Le pouvoir d'une carte-bonus — une œuvre, ou un gardien ; null pour tout le
 * reste (un Divin, un légendaire sans joker, ce que le téléphone invente).
 */
export function pouvoirDe(cle: unknown): CleDePouvoir | null {
  const o = oeuvre(cle)
  if (o) return o.salle === 'vestibule' ? POUVOIR_DU_NEUTRE[o.cle as CleDuVestibule] : POUVOIR_DE_LA_FAMILLE[o.salle]
  return pouvoirDuGardien(cle) ?? null
}

/** La force d'une carte-bonus : celle de sa rareté ; un gardien, la plus haute. */
export function forceDe(cle: unknown): Force | null {
  const o = oeuvre(cle)
  if (o) return FORCES_DES_RARETES[o.rarete]
  return pouvoirDuGardien(cle) ? FORCES_DES_RARETES.legendaire : null
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/** Ce que fait un pouvoir à sa force, en mots : l'annonce le dit sous la carte-bonus emportée. */
export function forceDite(pouvoir: CleDePouvoir, force: Force): string {
  switch (pouvoir) {
    case 'eclairer':
      return `${pluriel(ECLAIRAGES_PAR_PARTIE[force], 'indice')} par partie`
    case 'proteger':
      return `+${pluriel(BONUS_DE_PROTECTION[force], 'étoile')}, une fois par partie`
    case 'temps':
      // L'échéance s'allonge à chaque étape : « à chaque manche » promettait dix secondes au Pari, qui en donne vingt.
      return `+${SECONDES_PAR_FORCE * force} s à chaque question`
    case 'miser':
      return `+${pluriel(BONUS_DE_MISE[force], 'étoile')} si la manche misée est parfaite`
    case 'changer':
      return `${CHANGEMENTS_PAR_PARTIE[force]} fois par partie`
  }
}

/**
 * Ce que la carte-bonus emportée fait à ce jeu, en une ligne — l'annonce et la
 * partie la disent sous elle : Éclairer, ce qu'il éclaire ici ; Changer, s'il
 * sert à ce jeu ; les autres, leur force. « Éclairer : efface une mauvaise
 * réponse — 2 indices par partie ».
 */
export function ceQueFaitLaCarte(pouvoir: CleDePouvoir, force: Force, jeu: CleDeJeu): string {
  if (pouvoir === 'eclairer') return `${POUVOIRS.eclairer.nom} : ${JEUX[jeu].eclairer} — ${forceDite(pouvoir, force)}`
  if (pouvoir === 'changer' && !JEUX[jeu].changeable) return `Changer ne sert pas ${JEUX[jeu].a}`
  return `${POUVOIRS[pouvoir].nom} : ${forceDite(pouvoir, force)}`
}

/** Ce qu'il faut savoir d'une partie pour dire si un pouvoir sert maintenant — le pli le tient. */
export interface UsageDUnPouvoir {
  pouvoir: CleDePouvoir
  force: Force
  jeu: CleDeJeu
  /** Les fois qu'il a déjà servi dans la partie. */
  servi: number
  /** Changer : un geste a déjà été fait dans la manche — on change avant de répondre. */
  aJoue?: boolean
  /** Changer : les rechanges qui restent au plan de la partie. */
  rechanges?: number
  /** Éclairer : la règle du jeu a encore quelque chose à souffler dans cette manche. */
  aEclairer?: boolean
}

const FOIS = ['', 'une fois', 'deux fois', 'trois fois']
const fois = (n: number) => FOIS[n] ?? `${n} fois`

/**
 * Pourquoi ce pouvoir ne sert pas maintenant ; null : il sert. La seule règle
 * — le pli l'applique, le serveur la renvoie en refus, la vue la porte, la
 * page grise sans rien recopier. Ce qui tient à la manche elle-même (le temps
 * écoulé, la pause, une manche déjà tranchée) se refuse avec les autres
 * gestes, dans le pli.
 */
export function refusDuPouvoir(u: UsageDUnPouvoir): string | null {
  switch (u.pouvoir) {
    case 'eclairer':
      if (u.servi >= ECLAIRAGES_PAR_PARTIE[u.force]) return `Éclairer a déjà servi ${fois(u.servi)}`
      if (u.aEclairer === false) return 'Ce jeu n’a plus rien à éclairer'
      return null
    case 'changer':
      if (!JEUX[u.jeu].changeable) return `Changer ne sert pas ${JEUX[u.jeu].a}`
      if (u.servi >= CHANGEMENTS_PAR_PARTIE[u.force] || (u.rechanges ?? 0) <= 0) return 'Plus de rechange pour cette partie'
      if (u.aJoue) return 'Change avant de répondre'
      return null
    case 'miser':
      return u.servi >= 1 ? 'La mise a déjà servi' : null
    case 'proteger':
    case 'temps':
      return `${POUVOIRS[u.pouvoir].nom} agit tout seul`
    // Le typage dit qu'on n'arrive pas ici ; un départ relu de travers, si. Une
    // garde qui rendrait `undefined` laisserait servir le pouvoir : elle refuse.
    default:
      return 'Cette carte-bonus n’a pas de pouvoir'
  }
}

/**
 * Ce qu'Éclairer peut effacer, au plus, d'une étape de tant de propositions —
 * le Détail, le Pari, la Réplique. Deux au plus, et toujours deux qui restent :
 * une seule serait la réponse, donnée par la carte-bonus. Les quatre titres du
 * Détail, les quatre réponses du Pari et les quatre mots de la Réplique en
 * perdent deux ; ses trois personnes, une.
 */
export function effacablesAuPlus(propositions: number): number {
  return Math.max(0, Math.min(EFFACES_AU_PLUS, propositions - PROPOSITIONS_LAISSEES))
}

/** La carte-bonus d'une partie, figée au départ. */
export interface CarteEnJeu {
  pouvoir: CleDePouvoir
  force: Force
}

/**
 * La manche que Protéger porte : la première jugée à moins de trois étoiles
 * naturelles, zéro compris ; null sans protection, ou tant qu'aucune n'est
 * imparfaite. Les manches se jugent dans l'ordre : celle-là ne change plus.
 */
export function mancheProtegee(naturel: readonly (number | null)[], carte: CarteEnJeu | null): number | null {
  if (carte?.pouvoir !== 'proteger') return null
  const m = naturel.findIndex(n => n !== null && n < 3)
  return m < 0 ? null : m
}

/**
 * Les étoiles de chaque manche après les pouvoirs ; null pour une manche pas
 * encore jugée. Miser : la manche misée, parfaite, vaut trois plus le bonus,
 * sinon zéro. Protéger : la première imparfaite gagne son bonus, jamais
 * au-delà de trois. Les trois autres pouvoirs ne touchent pas aux étoiles.
 * La juste d'une pièce, le cadre doré et le seuil lisent ce qu'en dit le pli :
 * la juste, toujours les naturelles.
 */
export function etoilesApresLesPouvoirs(naturel: readonly (number | null)[], carte: CarteEnJeu | null, misee: number | null = null): (number | null)[] {
  const protegee = mancheProtegee(naturel, carte)
  return naturel.map((n, m) => {
    if (n === null) return null
    if (carte?.pouvoir === 'miser' && misee === m) return n === 3 ? 3 + BONUS_DE_MISE[carte.force] : 0
    if (m === protegee && carte) return Math.min(3, n + BONUS_DE_PROTECTION[carte.force])
    return n
  })
}
