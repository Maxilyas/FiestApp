import { tronquer } from './avatars'
import { CONFETTIS_PAR_DON_MAX } from './profil'

/**
 * Les annonces de l'administrateur à tous les profils (`/admin#annonces`, sous
 * « Animer ») — le souhait du propriétaire du 19 octobre 2026, le soir où le
 * quiz du jour et les défis s'étaient rouverts en production : « une annonce
 * pour dire que l'incident est résolu, et envoyer des confettis à tous pour
 * le dédommagement ». Un message, lu une fois en haut de l'accueil de chaque
 * profil — ce que le bandeau rouge ne fait pas : il se lit en passant, et se
 * retire avec la panne —, et, si on veut, des confettis pour chacun : un don
 * par profil, qui ne se reprend pas.
 */

/** Le message, au plus : il tient en quatre lignes sur la carte de l'accueil, au téléphone. */
export const ANNONCE_MAX = 200

/** Le message tel qu'il partira : ses blancs resserrés. */
export const messageNet = (texte: string) => texte.replace(/\s+/g, ' ').trim()

/**
 * Le message d'une annonce tel que le serveur le garde. Vide ou trop long,
 * il se refuse : coupé au milieu d'un mot, il dirait à tout le monde autre
 * chose que ce que l'administrateur a écrit — comme le bandeau.
 */
export function lireLeMessage(brut: unknown): string {
  const net = typeof brut === 'string' ? messageNet(brut) : ''
  if (!net) throw new Error('Écris le message de l’annonce')
  if (tronquer(net, ANNONCE_MAX) !== net) throw new Error(`L’annonce tient en ${ANNONCE_MAX} caractères : raccourcis-la`)
  return net
}

/**
 * Ce que chaque profil reçoit avec elle : rien — un message seul — ou des
 * confettis, au plus ce qu'un don offre (`CONFETTIS_PAR_DON_MAX`). Une
 * annonce n'est pas une économie à côté des dons : multipliée par tous les
 * profils, elle en est déjà une.
 */
export function lireLesConfettis(brut: unknown): number {
  if (brut === undefined || brut === null) return 0
  if (typeof brut !== 'number' || !Number.isInteger(brut) || brut < 0 || brut > CONFETTIS_PAR_DON_MAX) {
    throw new Error(`Entre 0 et ${CONFETTIS_PAR_DON_MAX} confettis par profil`)
  }
  return brut
}

/** Les annonces que la page du QG liste, au plus : elles se comptent par mois, pas par jour. */
export const ANNONCES_MONTREES = 50

/** Une annonce faite, telle que le QG la liste. */
export interface AnnonceAuQg {
  id: string
  message: string
  /** Ce que chaque profil a reçu avec elle ; 0, un message seul. */
  confettis: number
  /** Les profils qui l'ont reçue : ceux qui existaient à son envoi, sans les suspendus. */
  destinataires: number
  le: number
  /** Retirée : l'accueil la tait à qui ne l'avait pas encore lue ; les confettis offerts restent. */
  retireeLe: number | null
}

/** La page des annonces au QG. */
export interface PageDesAnnonces {
  maintenant: number
  /** Les profils qui la recevraient, si elle partait maintenant : ni les suspendus, ni ceux qui viendront après. */
  profils: number
  /** Les annonces faites, de la plus récente à la plus ancienne. */
  annonces: AnnonceAuQg[]
}
