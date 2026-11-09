// Les questions du public : ce qu'un joueur propose pour le quiz du jour, et
// ce que le QG en fait. Pures : le téléphone conseille avec les règles mêmes
// que le serveur applique — un conseil qui laisserait passer ce que le
// serveur refuse ferait écrire pour rien.
//
// Le circuit (le choix du propriétaire du 2 novembre 2026) : le joueur écrit
// sa question dans « Ta question » (la plume), le QG la relit — l'accepte,
// retouchée s'il le faut, ou la refuse en disant pourquoi —, et une question
// acceptée passe au quiz du jour, une par jour au plus, signée de son
// auteur. Le quiz du jour d'abord ; le défi de la semaine attend.
//
// Depuis le 8 novembre 2026 (le choix du propriétaire, « 1 + 2 + 4 »), elle
// ne se mêle plus aux dix : elle vient après elles, la question bonus, dans
// une carte à part et signée dès qu'elle paraît. Mêlée aux autres, on la
// jouait à la course sans voir qu'un joueur l'avait écrite ; et
// l'administrateur, qui l'avait relue, la jouait en en sachant la réponse —
// des points d'avance au classement. Elle ne compte donc ni aux points, ni au
// classement, ni aux étoiles : trouvée, elle rapporte des confettis et de
// l'expérience (`CONFETTIS_DE_LA_QUESTION_BONUS`, `XP_DE_LA_QUESTION_BONUS`).
// Son auteur et celui qui l'a relue ne la jouent pas, sans rien y perdre ;
// la salle la note d'un pouce, et son auteur gagne de plus à l'avoir bien
// dosée — ni évidente, ni impossible (`dosageDe`). Les jours d'avant, où elle
// était l'une des dix, gardent leur règle : son auteur ne la jouait pas, elle
// lui comptait sa moyenne sur les autres (`partDeLAuteur`).
//
// Depuis le 9 novembre 2026 (le choix du propriétaire, « confiance aux
// auteurs connus ») : le QG ne relit plus que la première question de chaque
// joueur. Un auteur dont une question a été acceptée est de confiance
// (`estDeConfiance`) : les suivantes passent d'office dans la file — c'est
// lui qui choisit leur catégorie, que le QG choisissait à l'acceptation. Il
// fallait tout relire, et l'administrateur, qui joue le quiz du jour, en
// savait chaque question bonus d'avance. Le QG les montre dans la file sans
// leur texte, qu'il lit s'il veut (la lire, c'est ne pas la jouer), les
// retire avant leur jour, et annule pour tous la question bonus du jour qui
// se révèle fausse. Une question retirée ou annulée rend son auteur à la
// relecture, jusqu'à ce que le QG en accepte une autre.

import { CATEGORIES } from './categories'
import { sansAccent } from './homonymes'

/** Une question tient sur l'écran d'un téléphone ; une réponse, sur un bouton. */
export const QUESTION_DU_PUBLIC_MAX = 200
export const REPONSE_DU_PUBLIC_MAX = 60
/**
 * Son anecdote, « Le saviez-vous ? », facultative : la limite de toute
 * anecdote (`MAX_ANECDOTE`, `shared/library.ts`, que l'acceptation relit),
 * recopiée plutôt qu'importée — la bibliothèque des quiz serait venue avec,
 * dans chaque page qui lit un profil ; `jour-propositions.test.ts` les tient
 * ensemble.
 */
export const ANECDOTE_DU_PUBLIC_MAX = 280
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

/**
 * Les questions d'un auteur de confiance qui attendent leur jour, au plus,
 * pour qu'une de plus passe d'office : la file avance d'une par jour pour
 * tous, et un auteur prolifique y aurait fait attendre les autres des
 * semaines. Au-delà, la suivante attend que l'une passe. Un choix de produit.
 */
export const QUESTIONS_D_OFFICE_EN_FILE_MAX = 3

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
 * mauvais, comme une leçon. Un choix de produit. À la fin seulement : le
 * jour joué, la page qu'on retrouve en revenant, la montre à tous — elle n'y
 * répond plus à la partie qu'on vient de finir.
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

// ── La question bonus ─────────────────────────────────────────────────────

/**
 * Ce que la question bonus rapporte à qui la trouve — rien à qui la rate :
 * des confettis, comptés avec ceux du quiz du jour (`JourStore.justesDe`) et
 * relus à chaque lecture, et de l'expérience, figée avec la partie
 * (`jour_parties.xp_bonus`), en plus de ses 200 — comme le bonus de série.
 * Ni points, ni place au classement, ni étoile : elle se joue pour le
 * plaisir. Des choix de produit (le 8 novembre 2026).
 */
export const CONFETTIS_DE_LA_QUESTION_BONUS = 10
export const XP_DE_LA_QUESTION_BONUS = 20

/**
 * Son chrono : plus long que les dix — la course est finie, on la lit. Une
 * question du public a 20 secondes (`DEFAULT_DURATION`) ; elle en garde
 * davantage si on lui en a donné plus.
 */
export const DUREE_DE_LA_QUESTION_BONUS = 30

/**
 * Le défi de l'auteur : sa question est bien dosée quand la salle la trouve
 * sans qu'elle soit évidente — de 20 % à 80 % de ceux qui l'ont jouée, à
 * cinq au moins (en deçà, la part ne dit rien). Jugée à la nuit, une fois le
 * jour clos ; elle lui rapporte alors des confettis de plus. Trop facile ou
 * trop dure, rien ne se retire : ses confettis d'acceptée et de jouée
 * restent. Des choix de produit (le 8 novembre 2026).
 */
export const CONFETTIS_D_UNE_QUESTION_BIEN_DOSEE = 25
export const JOUEURS_POUR_LE_DOSAGE = 5
export const DOSAGE_DES_POUR_CENT = 20
export const DOSAGE_JUSQU_A_POUR_CENT = 80

/** Ce que la salle en a fait : ceux qui l'ont jouée — trouvée, ratée ou laissée au temps —, ceux qui l'ont trouvée, et les pouces. */
export interface SalleDuBonus {
  joueurs: number
  trouvees: number
  pour: number
  contre: number
}

/**
 * Le dosage d'une question bonus jouée : bien dosée, trop facile, trop dure
 * — ou null, trop peu de joueurs pour en juger. Les mêmes bornes que le SQL
 * des confettis (`BIEN_DOSEE`, `core/jour.ts`), en entiers : la virgule
 * flottante aurait pu séparer 20 % d'un cinquième.
 */
export function dosageDe(joueurs: number, trouvees: number): 'bien' | 'facile' | 'dure' | null {
  if (joueurs < JOUEURS_POUR_LE_DOSAGE) return null
  if (trouvees * 100 > joueurs * DOSAGE_JUSQU_A_POUR_CENT) return 'facile'
  if (trouvees * 100 < joueurs * DOSAGE_DES_POUR_CENT) return 'dure'
  return 'bien'
}

/** Un pouce de la salle sur une question bonus : levé, baissé. */
export type VoteDuBonus = 1 | -1

/** Un vote envoyé par le téléphone, relu : un pouce, ou rien. */
export function lireLeVote(brut: unknown): VoteDuBonus | null {
  return brut === 1 || brut === -1 ? brut : null
}

/** Les motifs d'un refus qui reviennent, proposés d'un toucher au QG — un autre s'écrit à la main. */
export const MOTIFS_DE_REFUS = [
  'Elle est déjà dans le quiz du jour',
  'Sa réponse se discute',
  'Trop facile pour le quiz du jour',
  'Trop difficile pour le quiz du jour',
] as const

/**
 * Où en est une question proposée : relue ou non, et ce qui en a été fait.
 * Posée, elle est passée au quiz du jour — le jour le dit. Retirée : acceptée,
 * puis ôtée de la file par le QG avant son jour, son motif dit.
 */
export type StatutDUneProposition = 'en-relecture' | 'acceptee' | 'refusee' | 'retiree' | 'posee'

/** Une question du public, telle que le joueur l'écrit : l'intitulé, quatre réponses, l'index de la bonne — son anecdote, s'il en écrit une, et sa catégorie. */
export interface QuestionProposee {
  texte: string
  reponses: string[]
  bonne: number
  /** « Le saviez-vous ? » : le QG la reçoit dans « Accepter », qui la garde, la retouche ou l'efface. */
  anecdote?: string
  /**
   * Sa catégorie, l'une des douze (`CATEGORIES`), que le joueur choisit depuis
   * le 9 novembre 2026 : sa question peut passer d'office, sans personne pour
   * la classer. Absente d'une proposition d'avant — ou d'une page d'avant,
   * qui ne la demande pas : celle-là part en relecture, et le QG la choisit.
   */
  categorie?: string
}

/** Une proposition telle que son auteur la relit, sous sa carte à écrire (« Tes questions »). */
export interface PropositionDuJoueur extends QuestionProposee {
  id: string
  statut: StatutDUneProposition
  proposeeLe: number
  /** Refusée ou retirée : pourquoi, en une phrase du QG. */
  motif?: string
  /** Posée : le jour du quiz qui l'a jouée. */
  jour?: string
  /** Posée en question bonus : ce que la salle en a fait, jusqu'ici. */
  salle?: SalleDuBonus
  /** Acceptée d'office, sans relecture : son auteur est de confiance (`estDeConfiance`). */
  dOffice?: true
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
  /** Posée en question bonus : ce que la salle en a fait — de quoi repérer les auteurs qui écrivent bien. */
  salle?: SalleDuBonus
  /** Acceptée d'office, sans relecture. */
  dOffice?: true
  /** Posée en question bonus, puis annulée pour tous. */
  annulee?: true
}

/**
 * Une question acceptée qui attend son jour, au QG : qui l'a écrite, sa
 * catégorie, quand elle est entrée dans la file — et la question elle-même
 * seulement si l'administrateur la connaît déjà (il l'a acceptée, ou lue d'un
 * « La lire ») : passée d'office, elle reste close tant qu'il ne l'ouvre pas,
 * et l'ouvrir, c'est ne pas la jouer (`jour_reserve.relecteur`). Sinon, chaque
 * question bonus à venir se serait lue d'avance en passant sur la page.
 */
export interface QuestionEnFile {
  /** La proposition. */
  id: string
  auteur: { id: string; nom: string; login: string } | null
  categorie: string | null
  proposeeLe: number
  accepteeLe: number
  /** Acceptée d'office, sans relecture : son auteur était de confiance. */
  dOffice: boolean
  /** Telle qu'elle se jouera — la réserve, retouches comprises ; absente : pas encore lue. */
  question?: QuestionProposee
}

/** La page du QG : ce qui attend sa relecture, le plus ancien d'abord, la file des acceptées, et ce qui a été relu ces derniers jours. */
export interface PropositionsAuQg {
  aRelire: PropositionAuQg[]
  /** Acceptées, pas encore posées : la file du quiz du jour, une par jour, dans l'ordre où elles passeront. */
  enFile: QuestionEnFile[]
  /** Refusées, retirées, jouées ces derniers jours. */
  relues: PropositionAuQg[]
}

/**
 * Un auteur est de confiance quand sa dernière question acceptée — par le
 * QG, ou d'office — est plus récente que la dernière qu'on lui a retirée de
 * la file ou annulée pour tous. Jamais acceptée : pas encore. Retirée ou
 * annulée : la suivante repasse par la relecture, et une acceptation du QG
 * lui rend la confiance. Des instants du serveur, en millisecondes.
 */
export function estDeConfiance(derniereAcceptee: number | null, dernierRetrait: number | null, derniereAnnulation: number | null): boolean {
  if (derniereAcceptee === null) return false
  return derniereAcceptee > Math.max(dernierRetrait ?? 0, derniereAnnulation ?? 0)
}

/** Une catégorie choisie au téléphone, relue : l'une des douze, ou null. */
export function lireLaCategorie(brut: unknown): string | null {
  return typeof brut === 'string' && (CATEGORIES as readonly string[]).includes(brut) ? brut : null
}

/** Sans casse, accents ni article : « La Loire » et « loire » sont la même réponse. */
const reconnaissable = (x: string) => sansAccent(x).replace(/^(les |le |la |l’|l')/, '')

/** Les espaces d'un texte tapé au téléphone : ni au bord, ni deux de suite. */
const net = (x: unknown) => (typeof x === 'string' ? x.trim().replace(/\s+/g, ' ') : '')

/**
 * Ce qui manque encore, en une phrase — la première qui compte —, ou null :
 * la question est prête. Le téléphone le dit comme le prochain geste
 * (« Encore 2 réponses. ») ; le serveur refuse avec la même phrase.
 * `categorie` : celle qu'il a choisie, vide tant qu'il n'en a pas choisi —
 * le dernier geste, la carte prête par ailleurs ; absente (`undefined`), une
 * page d'avant qui ne la demande pas : elle n'est pas exigée.
 */
export function conseilDeLaProposition(texte: string, reponses: readonly string[], bonne: number | null, anecdote = '', categorie?: string | null): string | null {
  const t = texte.trim()
  const reps = reponses.map(r => r.trim())
  const manquent = reps.filter(r => !r).length
  if (!t) return 'Écris ta question, puis ses quatre réponses.'
  if (t.length < QUESTION_DU_PUBLIC_MIN) return 'Un peu courte : précise-la.'
  if (!t.endsWith('?')) return 'Finis-la par un point d’interrogation.'
  // Les emojis récents s'affichent en carré vide sous Windows 10, où tourne l'écran commun — l'anecdote comprise.
  if (/\p{Extended_Pictographic}/u.test(t + reps.join('') + anecdote)) return 'Sans emoji : certains écrans ne l’affichent pas.'
  if (manquent === reps.length) return 'À toi : ses quatre réponses.'
  if (manquent > 0) return manquent === 1 ? 'Encore une réponse.' : `Encore ${manquent} réponses.`
  if (new Set(reps.map(reconnaissable)).size < reps.length) return 'Deux réponses sont pareilles.'
  if (bonne === null) return 'Touche une forme : c’est la bonne réponse.'
  const juste = reconnaissable(reps[bonne])
  // Trois lettres au moins : « Ré » se lit dans bien des questions sans les souffler.
  if (juste.length >= 3 && sansAccent(t).includes(juste)) return 'Ta réponse se lit dans la question.'
  // En dernier : elle se choisit en haut de la carte, comme le quiz l'écrit au-dessus de la question.
  if (categorie !== undefined && !lireLaCategorie(categorie)) return 'Dernier geste : sa catégorie, en haut de la carte.'
  return null
}

/**
 * Ce qu'envoie le téléphone, relu : la question prête, ou la phrase qui dit
 * ce qui manque — celle du conseil, ou la limite dépassée. Rien ne se coupe
 * en silence : coupée, une question dirait autre chose. Sa catégorie, si la
 * page l'envoie, est l'une des douze ; une page d'avant n'en envoie pas, et
 * sa question part en relecture (`JourStore.proposer`).
 */
export function lireLaProposition(brut: unknown): QuestionProposee | string {
  const o = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {}
  const texte = net(o.texte)
  const reponses = Array.isArray(o.reponses) ? o.reponses.map(net) : []
  if (reponses.length !== REPONSES_DU_PUBLIC) return 'Une question du public a quatre réponses.'
  if (Array.from(texte).length > QUESTION_DU_PUBLIC_MAX) return `Trop longue : ${QUESTION_DU_PUBLIC_MAX} caractères au plus.`
  if (reponses.some(r => Array.from(r).length > REPONSE_DU_PUBLIC_MAX)) return `Une réponse tient en ${REPONSE_DU_PUBLIC_MAX} caractères.`
  const anecdote = net(o.anecdote)
  if (Array.from(anecdote).length > ANECDOTE_DU_PUBLIC_MAX) return `L’anecdote tient en ${ANECDOTE_DU_PUBLIC_MAX} caractères.`
  const bonne = typeof o.bonne === 'number' && Number.isInteger(o.bonne) && o.bonne >= 0 && o.bonne < REPONSES_DU_PUBLIC ? o.bonne : null
  const categorie = o.categorie === undefined ? undefined : (lireLaCategorie(o.categorie) ?? '')
  const conseil = conseilDeLaProposition(texte, reponses, bonne, anecdote, categorie)
  // Vide, elle n'existe pas : ni la carte du QG ni la réserve n'ont à la lire.
  return conseil ?? { texte, reponses, bonne: bonne!, ...(anecdote && { anecdote }), ...(categorie && { categorie }) }
}

/** Le motif d'un refus, relu : une phrase, ni vide ni trop longue — refusée trop longue, jamais coupée. */
export function lireLeMotif(brut: unknown): string | { erreur: string } {
  const motif = net(brut)
  if (!motif) return { erreur: 'Dis au joueur pourquoi, en une phrase' }
  if (Array.from(motif).length > MOTIF_DE_REFUS_MAX) return { erreur: `Le motif tient en ${MOTIF_DE_REFUS_MAX} caractères` }
  return motif
}

/**
 * Ce que sa propre question rapportait à son auteur, qui ne la joue pas,
 * quand elle était l'une des dix — les tirages d'avant le 8 novembre 2026,
 * que la correction et le jour en cours relisent encore : sa
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
