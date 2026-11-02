// Les questions du public : ce qu'un joueur propose pour le quiz du jour, et
// ce que le QG en fait. Pures : le téléphone conseille avec les règles mêmes
// que le serveur applique — un conseil qui laisserait passer ce que le
// serveur refuse ferait écrire pour rien.
//
// Le circuit (le choix du propriétaire du 2 novembre 2026) : le joueur écrit
// sa question dans « Ta question » (la plume), le QG la relit — l'accepte,
// retouchée s'il le faut, ou la refuse en disant pourquoi —, et une question
// acceptée passe au quiz du jour, une par jour au plus, signée de son
// auteur. Lui ne la joue pas : elle lui compte à sa moyenne sur les autres
// (`partDeLAuteur`). Le quiz du jour d'abord ; le défi de la semaine attend.

import { sansAccent } from './homonymes'

/** Une question tient sur l'écran d'un téléphone ; une réponse, sur un bouton. */
export const QUESTION_DU_PUBLIC_MAX = 200
export const REPONSE_DU_PUBLIC_MAX = 60
/** Une question du public a quatre réponses : les quatre formes du quiz. */
export const REPONSES_DU_PUBLIC = 4
/** En deçà, ce n'est pas encore une question : « Qui ? » ne se joue pas. */
const QUESTION_DU_PUBLIC_MIN = 15

/**
 * Les questions qu'un joueur peut avoir en relecture à la fois : de quoi
 * proposer plusieurs idées, pas de quoi noyer le QG — la suivante attend
 * qu'une soit relue. Un choix de produit.
 */
export const PROPOSITIONS_EN_RELECTURE_MAX = 3

/** Ce que le QG dit d'un refus, au plus : une phrase, que le joueur lit sur son accueil. */
export const MOTIF_DE_REFUS_MAX = 140

/**
 * Les questions du public d'un même jour, au plus (le choix du propriétaire
 * du 2 novembre 2026 : une par quiz du jour pour commencer). Le quiz reste
 * calibré — une question du public n'a pas encore de difficulté mesurée —,
 * il n'y a qu'un auteur à traiter à part, et la rareté rend la signature
 * précieuse. Un choix de produit.
 */
export const QUESTIONS_DU_PUBLIC_PAR_JOUR = 1

/**
 * Les bonnes réponses qui font paraître la plume — l'invitation à proposer
 * sa question —, au bout du quiz du jour comme du défi : après un beau
 * résultat, « écris la tienne » se lit comme un compliment ; après un
 * mauvais, comme une leçon. Un choix de produit.
 */
export const JUSTES_POUR_LA_PLUME = 7

/**
 * Ce que sa question rapporte à son auteur, en confettis : à son
 * acceptation, puis le jour où elle est jouée (le choix du 2 novembre 2026) —
 * une question qui tient la relecture vaut une journée de missions. Comptés
 * dans ses confettis du quiz du jour (`JourStore.justesDe`) : un solde se
 * relit à chaque lecture, et une règle changée vaut pour tout le passé, d'un
 * coup. Ni l'un ni l'autre pour une question refusée. Des choix de produit.
 */
export const CONFETTIS_D_UNE_QUESTION_ACCEPTEE = 25
export const CONFETTIS_D_UNE_QUESTION_JOUEE = 25

/** Les motifs d'un refus qui reviennent, proposés d'un toucher au QG — un autre s'écrit à la main. */
export const MOTIFS_DE_REFUS = [
  'Elle est déjà dans le quiz du jour',
  'Sa réponse se discute',
  'Trop facile pour le quiz du jour',
  'Trop difficile pour le quiz du jour',
] as const

/**
 * Où en est une question proposée : relue ou non, et ce qui en a été fait.
 * Posée, elle est passée au quiz du jour — le jour le dit.
 */
export type StatutDUneProposition = 'en-relecture' | 'acceptee' | 'refusee' | 'posee'

/** Une question du public, telle que le joueur l'écrit : l'intitulé, quatre réponses, l'index de la bonne. */
export interface QuestionProposee {
  texte: string
  reponses: string[]
  bonne: number
}

/** Une proposition telle que son auteur la relit, sous sa carte à écrire (« Tes questions »). */
export interface PropositionDuJoueur extends QuestionProposee {
  id: string
  statut: StatutDUneProposition
  proposeeLe: number
  /** Refusée : pourquoi, en une phrase du QG. */
  motif?: string
  /** Posée : le jour du quiz qui l'a jouée. */
  jour?: string
}

/** Une proposition au QG : la question, qui l'a écrite — par son profil, jamais deviné —, et ce qu'on en a fait. */
export interface PropositionAuQg extends QuestionProposee {
  id: string
  proposeeLe: number
  statut: StatutDUneProposition
  /** Son auteur ; null : son profil a été supprimé. */
  auteur: { id: string; nom: string; login: string } | null
  motif?: string
  relueLe?: number
}

/** La page du QG : ce qui attend, le plus ancien d'abord, et ce qui a été relu ces derniers jours. */
export interface PropositionsAuQg {
  aRelire: PropositionAuQg[]
  relues: PropositionAuQg[]
  /** Acceptées, pas encore posées : la file du quiz du jour, une par jour. */
  enAttente: number
}

/** Sans casse, accents ni article : « La Loire » et « loire » sont la même réponse. */
const reconnaissable = (x: string) => sansAccent(x).replace(/^(les |le |la |l’|l')/, '')

/** Les espaces d'un texte tapé au téléphone : ni au bord, ni deux de suite. */
const net = (x: unknown) => (typeof x === 'string' ? x.trim().replace(/\s+/g, ' ') : '')

/**
 * Ce qui manque encore, en une phrase — la première qui compte —, ou null :
 * la question est prête. Le téléphone le dit comme le prochain geste
 * (« Encore 2 réponses. ») ; le serveur refuse avec la même phrase.
 */
export function conseilDeLaProposition(texte: string, reponses: readonly string[], bonne: number | null): string | null {
  const t = texte.trim()
  const reps = reponses.map(r => r.trim())
  const manquent = reps.filter(r => !r).length
  if (!t) return 'Écris ta question, puis ses quatre réponses.'
  if (t.length < QUESTION_DU_PUBLIC_MIN) return 'Un peu courte : précise-la.'
  if (!t.endsWith('?')) return 'Finis-la par un point d’interrogation.'
  // Les emojis récents s'affichent en carré vide sous Windows 10, où tourne l'écran commun.
  if (/\p{Extended_Pictographic}/u.test(t + reps.join(''))) return 'Sans emoji : certains écrans ne l’affichent pas.'
  if (manquent === reps.length) return 'À toi : ses quatre réponses.'
  if (manquent > 0) return manquent === 1 ? 'Encore une réponse.' : `Encore ${manquent} réponses.`
  if (new Set(reps.map(reconnaissable)).size < reps.length) return 'Deux réponses sont pareilles.'
  if (bonne === null) return 'Touche une forme : c’est la bonne réponse.'
  const juste = reconnaissable(reps[bonne])
  // Trois lettres au moins : « Ré » se lit dans bien des questions sans les souffler.
  if (juste.length >= 3 && sansAccent(t).includes(juste)) return 'Ta réponse se lit dans la question.'
  return null
}

/**
 * Ce qu'envoie le téléphone, relu : la question prête, ou la phrase qui dit
 * ce qui manque — celle du conseil, ou la limite dépassée. Rien ne se coupe
 * en silence : coupée, une question dirait autre chose.
 */
export function lireLaProposition(brut: unknown): QuestionProposee | string {
  const o = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {}
  const texte = net(o.texte)
  const reponses = Array.isArray(o.reponses) ? o.reponses.map(net) : []
  if (reponses.length !== REPONSES_DU_PUBLIC) return 'Une question du public a quatre réponses.'
  if (Array.from(texte).length > QUESTION_DU_PUBLIC_MAX) return `Trop longue : ${QUESTION_DU_PUBLIC_MAX} caractères au plus.`
  if (reponses.some(r => Array.from(r).length > REPONSE_DU_PUBLIC_MAX)) return `Une réponse tient en ${REPONSE_DU_PUBLIC_MAX} caractères.`
  const bonne = typeof o.bonne === 'number' && Number.isInteger(o.bonne) && o.bonne >= 0 && o.bonne < REPONSES_DU_PUBLIC ? o.bonne : null
  const conseil = conseilDeLaProposition(texte, reponses, bonne)
  return conseil ?? { texte, reponses, bonne: bonne! }
}

/** Le motif d'un refus, relu : une phrase, ni vide ni trop longue — refusée trop longue, jamais coupée. */
export function lireLeMotif(brut: unknown): string | { erreur: string } {
  const motif = net(brut)
  if (!motif) return { erreur: 'Dis au joueur pourquoi, en une phrase' }
  if (Array.from(motif).length > MOTIF_DE_REFUS_MAX) return { erreur: `Le motif tient en ${MOTIF_DE_REFUS_MAX} caractères` }
  return motif
}

/**
 * Ce que sa propre question rapporte à son auteur, qui ne la joue pas : sa
 * moyenne sur les autres questions qui comptent, en points comme en bonnes
 * réponses (le choix du propriétaire du 2 novembre 2026, « moyenne
 * personnelle »). Il en connaît la réponse : jouée, elle lui donnait la
 * question d'office — et le podium, le laurier ; sautée, elle lui en retirait
 * une. Sa moyenne ne le pousse ni ne le retient. En cours de partie, ce qu'il
 * a déjà gagné ramené à toutes les autres : sa part grandit avec lui, et vaut
 * sa moyenne à la dernière.
 */
export function partDeLAuteur(gagne: number, autres: number): number {
  return autres > 0 ? Math.round(gagne / autres) : 0
}
