// Le quiz du jour : dix questions, les mêmes pour tous les profils, tirées à
// minuit (heure de Paris) et figées. Un seul essai, qu'on reprend si le
// téléphone sonne ; la bonne réponse et son anecdote arrivent après chaque
// réponse — c'est là qu'on apprend.
//
// Il ne remplace pas la soirée, il en est l'entre-deux : on y joue seul, pour
// apprendre et pour avancer. Il rapporte de l'expérience — le barème d'un
// quiz de soirée de dix questions, 75 au plus, à proportion des points
// (l'option B, choisie le 26 septembre 2026) —, et son podium, figé à minuit,
// 25, 15 et 10, comme celui d'un quiz. Tout ce qui ne se gagne qu'en soirée y
// reste : hauts faits, paliers de carrière, légendaires, Divins, Éclat.
//
// Réservé aux profils. Un invité anonyme n'y voit rien qui lui manque
// (invariant 8) : la porte d'entrée reste celle des soirées.
//
// Ce fichier est pur et partagé ; la réserve, le tirage, la partie et la
// clôture de la nuit vivent dans `server/src/core/jour.ts`.

import { XP, type Finition } from './profil'

/** Le quiz d'un jour : dix questions — moins si la réserve est à sec. */
export const QUESTIONS_PAR_JOUR = 10

/** Minuit à Paris, pour tout le monde : le serveur, lui, tourne en UTC. */
export const FUSEAU_DU_JOUR = 'Europe/Paris'

/**
 * L'expérience d'un quiz du jour parfait : ce que rapporte un quiz de soirée
 * de dix questions, toutes justes et rapides — dix fois une réponse, une
 * bonne réponse et un réflexe, plus le sans-faute : 75. Elle se gagne à
 * proportion des points (`xpDuJour`). Plus, et le quiz du jour avalait les
 * soirées : à une soirée par mois, 255 par jour les réduisait à 4 % du
 * niveau d'un joueur assidu.
 */
export const XP_MAX_DU_JOUR = QUESTIONS_PAR_JOUR * (XP.reponse + XP.juste + XP.reflexe) + XP.sansFaute

/** Le podium du jour, figé à minuit : celui d'un quiz de soirée. */
export const XP_PODIUM_DU_JOUR: readonly number[] = XP.podiumQuiz

/**
 * L'expérience d'une partie du jour : la part des points possibles, ramenée
 * aux 75 d'un quiz parfait, arrondie en dessous — 1 240 points sur 2 000
 * font 46.
 */
export function xpDuJour(points: number, pointsPossibles: number): number {
  if (!(pointsPossibles > 0) || !(points > 0)) return 0
  return Math.floor((XP_MAX_DU_JOUR * Math.min(points, pointsPossibles)) / pointsPossibles)
}

/**
 * Le podium du jour, rang partagé, et une marche de moins que la salle comme
 * en soirée : seul, on ne monte sur rien ; à deux, seul le premier.
 */
export function xpDuPodium(rang: number, joueurs: number): number {
  const marches = Math.min(XP_PODIUM_DU_JOUR.length, joueurs - 1)
  return rang >= 1 && rang <= marches ? XP_PODIUM_DU_JOUR[rang - 1] : 0
}

// ── Les médailles ─────────────────────────────────────────────────────────

export type Medaille = 'or' | 'argent' | 'bronze'

export const NOM_MEDAILLE: Record<Medaille, string> = { or: 'Médaille d’or', argent: 'Médaille d’argent', bronze: 'Médaille de bronze' }

/**
 * La médaille d'une partie, au nombre de bonnes réponses : l'or pour un
 * sans-faute, l'argent à huit sur dix, le bronze à six. Une question annulée
 * ne compte pas : les seuils suivent le nombre de questions qui restent.
 */
export function medailleDe(justes: number, questions: number): Medaille | null {
  if (questions <= 0) return null
  if (justes >= questions) return 'or'
  if (justes >= Math.ceil(questions * 0.8)) return 'argent'
  if (justes >= Math.ceil(questions * 0.6)) return 'bronze'
  return null
}

/** « Six bonnes réponses ou plus. L'argent à huit, l'or à dix. » */
export function seuilsDesMedailles(questions: number): { or: number; argent: number; bronze: number } {
  return { or: questions, argent: Math.ceil(questions * 0.8), bronze: Math.ceil(questions * 0.6) }
}

// ── Les jours ─────────────────────────────────────────────────────────────

const FORMAT_DU_JOUR = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSEAU_DU_JOUR,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Le jour de Paris d'un instant, écrit « 2026-09-26 » : la clé de tout ce qui
 * se range au jour — le tirage, les parties, le classement, la série. Écrit
 * ainsi, il se trie comme une chaîne.
 */
export function jourDe(instant: number): string {
  const parts = Object.fromEntries(FORMAT_DU_JOUR.formatToParts(new Date(instant)).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/

/** Un jour bien écrit, et qui existe au calendrier. */
export function jourValide(jour: unknown): jour is string {
  if (typeof jour !== 'string') return false
  const m = JOUR.exec(jour)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.getUTCFullYear() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3])
}

/** Le jour d'avant, ou d'après (`n` négatif) — au calendrier, sans fuseau : « 2026-03-01 » → « 2026-02-28 ». */
export function jourAvant(jour: string, n = 1): string {
  const m = JOUR.exec(jour)
  if (!m) return jour
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - n))
  return d.toISOString().slice(0, 10)
}

/** Le mois d'un jour, « 2026-09 » : le classement du mois. */
export const moisDe = (jour: string) => jour.slice(0, 7)

const NOMS_DES_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const NOMS_DES_MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

/** « vendredi 26 septembre », « 1er octobre » avec `court`. */
export function jourEnToutesLettres(jour: string, court = false): string {
  const m = JOUR.exec(jour)
  if (!m) return jour
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  const quantieme = d.getUTCDate() === 1 ? '1er' : String(d.getUTCDate())
  const date = `${quantieme} ${NOMS_DES_MOIS[d.getUTCMonth()]}`
  return court ? date : `${NOMS_DES_JOURS[d.getUTCDay()]} ${date}`
}

/** « septembre 2026 ». */
export function moisEnToutesLettres(mois: string): string {
  const [annee, m] = mois.split('-').map(Number)
  return `${NOMS_DES_MOIS[(m || 1) - 1]} ${annee}`
}

/**
 * La série : les jours d'affilée où il a joué — au quiz du jour, ou en
 * soirée : la fête ne casse jamais une série. Elle court jusqu'à hier tant
 * qu'il n'a pas encore joué aujourd'hui : un matin sans quiz ne l'a pas
 * encore perdue, minuit seul la casse.
 */
export function serieDe(joues: ReadonlySet<string>, aujourdhui: string): number {
  let jour = joues.has(aujourdhui) ? aujourdhui : jourAvant(aujourdhui)
  let n = 0
  while (joues.has(jour)) {
    n++
    jour = jourAvant(jour)
  }
  return n
}

/** La plus longue série de sa vie : les jours d'affilée joués, au quiz du jour ou en soirée. */
export function plusLongueSerie(joues: ReadonlySet<string>): number {
  let record = 0
  for (const jour of joues) {
    // Seul le premier jour d'une série la compte : les suivants la liraient à moitié.
    if (joues.has(jourAvant(jour))) continue
    let n = 1
    for (let suivant = jourAvant(jour, -1); joues.has(suivant); suivant = jourAvant(suivant, -1)) n++
    record = Math.max(record, n)
  }
  return record
}

// ── Ce que le téléphone reçoit ────────────────────────────────────────────

/**
 * Une question du jour telle que le téléphone la reçoit : ni la bonne
 * réponse, ni l'anecdote — elles n'arrivent qu'avec la réponse
 * (invariant 1). L'échéance est une heure du serveur (invariant 6).
 */
export interface QuestionDuJour {
  jour: string
  /** Son numéro, à partir de 0, et combien la partie en compte. */
  index: number
  total: number
  texte: string
  reponses: string[]
  categorie: string | null
  /** Secondes laissées, et l'instant du serveur où elles s'achèvent. */
  duree: number
  echeance: number
}

/** Ce que le téléphone apprend après sa réponse — ou après l'échéance. */
export interface RevelationDuJour {
  jour: string
  index: number
  total: number
  texte: string
  reponses: string[]
  /** La bonne réponse, en index de `reponses`. */
  bonne: number
  /** Ce qu'il a touché — null : rien, le temps a passé. */
  choix: number | null
  juste: boolean
  points: number
  /** Ses points du jour, cette question comprise. */
  cumul: number
  anecdote: string | null
  /**
   * La part des joueurs du jour qui l'ont trouvée, lui compris — null tant
   * qu'ils sont moins de trois : « trouvée par 100 % » d'un seul joueur ne
   * dit rien.
   */
  trouveePar: number | null
  /** L'administrateur a annulé ses points, pour tous. */
  annulee?: boolean
  /** Sa réponse est arrivée après l'échéance : elle ne compte pas. */
  tropTard?: boolean
  /** C'était la dernière. */
  derniere: boolean
}

/** Une ligne du classement du jour, du mois : ce que la salle verrait d'un profil. */
export interface LigneDuJour {
  profileId: string
  /** Le prénom de son profil, marque d'homonymie comprise (« Camille (2) »). */
  nom: string
  avatar: string
  niveau: number
  finition?: Finition
  legendaire?: string
  eclat?: true
  points: number
  rang: number
  /** Sa partie n'est pas finie : ses points peuvent encore monter. */
  enCours?: true
}

/** Le classement d'un jour ou d'un mois. */
export interface ClassementDuJour {
  /** Le jour (« 2026-09-26 ») ou le mois (« 2026-09 »). */
  periode: string
  joueurs: number
  lignes: LigneDuJour[]
  /** Sa ligne à lui, s'il n'est pas dans celles qu'on montre. */
  moi?: LigneDuJour
  /** Qui regarde, s'il est classé : sa ligne se distingue. */
  sienne?: string
  /** Figé : la nuit l'a clos, et son podium a été payé. */
  fige: boolean
}

/** Un jour joué, tel que le profil le relit : « Vendredi 26 · 1 240 pts · 7ᵉ sur 23 · +46 XP ». */
export interface JourJoue {
  jour: string
  points: number
  /** Sa place ce jour-là, rang partagé (invariant 15), et combien avaient joué. */
  rang: number
  joueurs: number
  /** Ce que le jour lui a rapporté : la partie et le podium. */
  xp: number
  medaille: Medaille | null
  /** Pour les courbes : les questions qui comptaient, ses bonnes réponses, et leur temps. */
  comptees: number
  justes: number
  tempsJustesMs: number
}

/**
 * Le quiz du jour d'un profil, pour sa page : ce qu'il y a gagné, et ses
 * derniers jours. Rien qu'il ne puisse déjà lire ailleurs — le classement
 * de chaque jour est public —, rassemblé.
 */
export interface CarriereDuJour {
  /** Jours joués, en tout. */
  joues: number
  /** La série en cours et la plus longue, soirées comprises, comme sur la carte du jour. */
  serie: number
  record: number
  medailles: Record<Medaille, number>
  meilleurScore: number
  /** Les marches de podium payées, et les victoires — tous les ex æquo en tête gagnent. */
  podiums: number
  victoires: number
  /** Les trente derniers jours joués, le plus récent d'abord. */
  jours: JourJoue[]
}

/** La partie du jour d'un profil, vue de son téléphone. */
export interface PartieDuJour {
  jour: string
  /**
   * L'heure du serveur quand il a répondu : le téléphone y recale son
   * chrono (invariant 6) — il n'a pas de liaison temps réel pour la mesurer.
   */
  maintenant: number
  total: number
  /** Les catégories du jour, pour la carte de l'accueil. */
  categories: string[]
  /** Où il en est. */
  etat: 'a-jouer' | 'en-cours' | 'finie' | 'aucun'
  /** En cours : la question à laquelle répondre, si elle est montrée. */
  question?: QuestionDuJour
  /** En cours, entre deux questions : ce qu'il vient d'apprendre. */
  revelation?: RevelationDuJour
  points: number
  justes: number
  /** Ce que la partie lui a rapporté, jusqu'ici. */
  xp: number
  medaille: Medaille | null
  /** Sa place pour l'instant, et combien ont joué. */
  rang: number
  joueurs: number
  /** Celui qui le précède, et de combien : « à 70 pts de Lucas ». */
  devant?: { nom: string; ecart: number }
  /** Les points possibles — 200 par question qui compte —, et combien de questions comptent. */
  pointsPossibles: number
  comptees: number
  serie: number
  /**
   * Qui a gagné hier — tous les ex æquo en tête (invariant 15) —, vide sans
   * podium.
   */
  vainqueursDHier: { nom: string; avatar: string }[]
  /** Hier, pour lui : sa place et ce qu'elle lui a rapporté — le lendemain le raconte. */
  sonHier?: { rang: number; joueurs: number; points: number; xpPodium: number; medaille: Medaille | null } | null
}
