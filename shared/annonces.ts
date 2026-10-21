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

/**
 * Une question jointe à l'annonce (le souhait du propriétaire du 21 octobre
 * 2026 : « demander aux gens des choses spécifiques, un vote par exemple, pour
 * avoir des retours »). Le message de l'annonce EST la question ; la réponse
 * est une par profil, et peut rapporter des confettis (`recompense`).
 * - `vote` : un choix parmi deux à cinq ;
 * - `note` : de 1 à 5 ;
 * - `mot` : quelques mots libres.
 */
export type SorteDeQuestion = 'vote' | 'note' | 'mot'
export const SORTES_DE_QUESTION: readonly SorteDeQuestion[] = ['vote', 'note', 'mot']

/** Les choix d'un vote : de deux à cinq, de quarante caractères au plus — ils tiennent en un bouton, au téléphone. */
export const CHOIX_MIN = 2
export const CHOIX_MAX = 5
export const CHOIX_LONGUEUR_MAX = 40
/** La note la plus haute (la plus basse est 1). */
export const NOTE_MAX = 5
/** Le mot libre d'un joueur, au plus. */
export const MOT_MAX = 200

/** La question telle que l'administrateur la pose. */
export interface QuestionDAnnonce {
  sorte: SorteDeQuestion
  /** Les choix d'un vote ; vide pour une note et un mot. */
  choix: string[]
  /** Les confettis que rapporte la réponse, de 0 à `CONFETTIS_PAR_DON_MAX` ; un don par profil, comme l'annonce. */
  recompense: number
}

/**
 * La question d'une annonce telle que le serveur la garde. Absente, l'annonce
 * est un message seul. Refusée plutôt que corrigée : des choix coupés ou des
 * doublons changeraient ce que les joueurs lisent.
 */
export function lireLaQuestion(brut: unknown): QuestionDAnnonce | null {
  if (brut === undefined || brut === null) return null
  if (typeof brut !== 'object' || Array.isArray(brut)) throw new Error('La question est mal formée : recharge la page')
  const b = brut as Record<string, unknown>
  const sorte = SORTES_DE_QUESTION.find(s => s === b.sorte)
  if (!sorte) throw new Error('Choisis une sorte de question : vote, note ou mot libre')
  const recompense = lireLesConfettis(b.recompense)
  if (sorte !== 'vote') return { sorte, choix: [], recompense }
  const brutes = Array.isArray(b.choix) ? b.choix : []
  const choix = brutes.map(c => (typeof c === 'string' ? messageNet(c) : ''))
  if (choix.some(c => !c)) throw new Error('Un choix est vide : remplis-le ou retire-le')
  if (choix.length < CHOIX_MIN) throw new Error(`Un vote demande au moins ${CHOIX_MIN} choix`)
  if (choix.length > CHOIX_MAX) throw new Error(`Un vote tient en ${CHOIX_MAX} choix au plus`)
  if (choix.some(c => tronquer(c, CHOIX_LONGUEUR_MAX) !== c)) throw new Error(`Un choix tient en ${CHOIX_LONGUEUR_MAX} caractères : raccourcis-le`)
  if (new Set(choix.map(c => c.toLocaleLowerCase('fr'))).size !== choix.length) throw new Error('Deux choix sont les mêmes : change l’un des deux')
  return { sorte, choix, recompense }
}

/**
 * La réponse d'un joueur, telle que le serveur la garde : l'indice du choix
 * pour un vote (le texte d'un choix ne sert pas de clé), la note pour une
 * note, le mot resserré pour un mot libre.
 */
export function lireLaReponse(question: Pick<QuestionDAnnonce, 'sorte' | 'choix'>, brut: unknown): string {
  if (question.sorte === 'vote') {
    if (typeof brut !== 'number' || !Number.isInteger(brut) || brut < 0 || brut >= question.choix.length) throw new Error('Choisis une des réponses')
    return String(brut)
  }
  if (question.sorte === 'note') {
    if (typeof brut !== 'number' || !Number.isInteger(brut) || brut < 1 || brut > NOTE_MAX) throw new Error(`Donne une note de 1 à ${NOTE_MAX}`)
    return String(brut)
  }
  const net = typeof brut === 'string' ? messageNet(brut) : ''
  if (!net) throw new Error('Écris ta réponse')
  if (tronquer(net, MOT_MAX) !== net) throw new Error(`Ta réponse tient en ${MOT_MAX} caractères : raccourcis-la`)
  return net
}

/** Ce qu'on demande à un joueur sur son accueil : la question, tant qu'il n'a pas répondu et qu'elle est ouverte. */
export type QuestionAPoser = QuestionDAnnonce

/** Ce que la réponse a donné : les confettis de la récompense (0 sans récompense). */
export interface AccuseDeReponse {
  confettis: number
}

/** Les réponses reçues, telles que le QG les lit. */
export interface ResultatsDeQuestion {
  reponses: number
  /** Un vote : le compte de chaque choix, dans l'ordre. Une note : les comptes des notes 1 à 5. Un mot : vide. */
  comptes: number[]
  /** La moyenne des notes ; null sans note. */
  moyenne: number | null
  /** Les mots libres, le plus récent d'abord (`MOTS_MONTRES` au plus), chacun avec le prénom de qui l'a écrit. */
  mots: { prenom: string; texte: string; le: number }[]
}

/** Les mots libres que le QG lit par annonce, au plus. */
export const MOTS_MONTRES = 100

/** La question d'une annonce faite, avec ce qu'elle a récolté. */
export interface QuestionAuQg extends QuestionDAnnonce {
  /** Close, elle ne se montre plus aux joueurs ; les résultats restent. */
  fermeeLe: number | null
  resultats: ResultatsDeQuestion
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
  /** Sa question, si elle en pose une. */
  question: QuestionAuQg | null
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
