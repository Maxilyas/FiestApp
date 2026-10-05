// Le quiz du jour : dix questions, les mêmes pour tous les profils, tirées à
// minuit (heure de Paris) et figées. Un seul essai, qu'on reprend si le
// téléphone sonne ; la bonne réponse et son anecdote arrivent après chaque
// réponse — c'est là qu'on apprend.
//
// Il ne remplace pas la soirée, il en est l'entre-deux : on y joue seul, pour
// apprendre et pour avancer. Il rapporte de l'expérience — le barème d'un
// quiz de soirée de dix questions, 75 au plus, à proportion des points
// (l'option B, choisie le 26 septembre 2026) —, et son podium, figé à minuit,
// 25, 15 et 10, comme celui d'un quiz. Il a ses récompenses à lui : trois
// paliers (L'Assidu, Le Champion du jour, Le Sans-Faute), le Sphinx, et les
// jours de saison qui ouvrent la Citrouille, le Sapin, le Bouquet final. Les
// hauts faits de soirée, les paliers de carrière et l'Éclat restent aux
// soirées.
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

/**
 * Les minutes qui restent avant minuit à Paris : le rendez-vous des
 * questions de demain. Lues à l'heure de Paris, pas à celle du téléphone —
 * un joueur à Montréal attend le même minuit que tout le monde. Comptées
 * jusqu'à l'instant où le jour de Paris change, et non sur l'heure
 * affichée : la nuit du passage à l'heure d'été n'a que vingt-trois heures.
 */
export function minutesAvantMinuit(instant: number): number {
  const aujourdhui = jourDe(instant)
  let avant = instant
  let apres = instant + 26 * 3_600_000
  while (apres - avant > 1000) {
    const milieu = Math.floor((avant + apres) / 2)
    if (jourDe(milieu) === aujourdhui) avant = milieu
    else apres = milieu
  }
  return Math.max(1, Math.round((apres - instant) / 60_000))
}

// ── Le rappel du soir ─────────────────────────────────────────────────────

/**
 * Le rappel du soir : une notification, une seule par téléphone et par jour,
 * vers 18 h à Paris, aux profils qui l'ont demandée dans l'application
 * installée et n'ont pas fini leur partie (`server/src/core/rappels.ts`).
 * Assez tôt pour jouer avant minuit ; assez tard pour ne rappeler que ce
 * qu'on a oublié.
 */
export const HEURE_DU_RAPPEL = 18

/**
 * Passé 22 h, il ne part plus : un serveur qui redémarre tard — un
 * déploiement, une panne — ne fait pas sonner les téléphones à l'heure de
 * dormir. Ce jour-là, pas de rappel.
 */
export const FIN_DU_RAPPEL = 22

const FORMAT_DE_L_HEURE = new Intl.DateTimeFormat('en-GB', { timeZone: FUSEAU_DU_JOUR, hour: '2-digit', hourCycle: 'h23' })

/** L'heure qu'il est à Paris, de 0 à 23 — changements d'heure compris. */
export function heureDeParis(instant: number): number {
  return Number(FORMAT_DE_L_HEURE.formatToParts(new Date(instant)).find(p => p.type === 'hour')?.value ?? 0)
}

const FORMAT_DES_MINUTES = new Intl.DateTimeFormat('en-GB', { timeZone: FUSEAU_DU_JOUR, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Les minutes passées depuis minuit à Paris, de 0 à 1439. */
export function minutesDeParis(instant: number): number {
  const parts = FORMAT_DES_MINUTES.formatToParts(new Date(instant))
  return Number(parts.find(p => p.type === 'hour')?.value ?? 0) * 60 + Number(parts.find(p => p.type === 'minute')?.value ?? 0)
}

/** Le Lève-tôt : une partie finie avant huit heures, à Paris. */
export const AVANT_LE_LEVE_TOT = 8 * 60

/** Le Dernier Métro : une partie commencée dans la dernière demi-heure avant minuit, à Paris. */
export const DEPUIS_LE_DERNIER_METRO = 23 * 60 + 30

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

/** « de septembre 2026 », « d’octobre 2026 » : l'élision devant avril, août, octobre. */
export function duMois(mois: string): string {
  const nom = moisEnToutesLettres(mois)
  return /^[aeiouéâ]/.test(nom) ? `d’${nom}` : `de ${nom}`
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
  /** Il a gagné le quiz du jour d'hier : l'allure de son laurier (`niveauDuLaurier`) — ou l'argent du défi de la semaine. */
  laurier?: LaurierPorte
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
  /** La série en cours et la plus longue, soirées et sabliers compris, comme sur la carte du jour. */
  serie: number
  record: number
  /** Les sabliers qui attendent un jour manqué (`serieAvecSabliers`). */
  sabliers: number
  medailles: Record<Medaille, number>
  meilleurScore: number
  /** Les marches de podium payées, et les victoires — tous les ex æquo en tête gagnent. */
  podiums: number
  victoires: number
  /** Les trente derniers jours joués, le plus récent d'abord. */
  jours: JourJoue[]
}

/** Un palier du quiz du jour qui vient de tomber, tel qu'on l'annonce : « 📆 L'Assidu · Bronze ». */
export interface PalierTombe {
  key: string
  emoji: string
  title: string
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
  /** Pas de quiz aujourd'hui (`aucun`) : la réserve en a-t-elle de quoi demain ? */
  revientDemain?: boolean
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
   * Aujourd'hui compte déjà dans la série — une partie, ou une soirée : minuit
   * ne la cassera pas. Sinon, elle tient jusqu'à minuit, et la page le dit.
   */
  serieTenue?: boolean
  /**
   * Qui a gagné hier — tous les ex æquo en tête (invariant 15) —, vide sans
   * podium.
   */
  vainqueursDHier: { nom: string; avatar: string }[]
  /**
   * Hier, pour lui : sa place et ce qu'elle lui a rapporté — le lendemain le
   * raconte —, avec le palier du Champion du jour que la nuit lui a donné.
   */
  sonHier?: {
    rang: number
    joueurs: number
    points: number
    xpPodium: number
    medaille: Medaille | null
    paliers?: PalierTombe[]
    /** Ce que la nuit lui a décerné, en plus de ses paliers : le Laurier, le Triomphe, Seul au monde, la Lanterne du jour… */
    hautsFaits?: PalierTombe[]
    /** Et les légendaires que la nuit lui a ouverts : l'Aigle au trentième laurier, le Lion, Janus… */
    legendaires?: string[]
  } | null
  /** La partie finie : les paliers du quiz du jour qu'elle a fait tomber (L'Assidu, Le Sans-Faute, L'Infatigable). */
  paliers?: PalierTombe[]
  /** Les hauts faits du jour qu'elle a fait tomber : le Lève-tôt, le Dernier Métro. */
  hautsFaits?: PalierTombe[]
  /** La page du calendrier qu'elle a ouverte, au vingtième jour joué du mois (« 10 » pour octobre). */
  page?: string
  /** Le Divin qui est descendu sur elle — à lui seul, avec son récit (invariant 21). */
  divins?: { key: string; legende: string; ton: 'eclat' | 'ombre' }[]
  /** Et le légendaire que l'un d'eux ouvre : le Sphinx, au centième jour ou au dixième sans-faute — ou celui de la saison. */
  legendaires?: string[]
  /**
   * La partie finie : ce qui a éclaté pour lui ce jour-là — l'emoji qu'il
   * porte, ou son légendaire (`CHANCE_ECLAT_DU_JOUR`).
   */
  eclat?: string
  /** Les sabliers qui gardent sa série : ils attendent un jour manqué (`serieAvecSabliers`). */
  sabliers?: number
  /**
   * Les sept premiers jours d'un mois, le mois d'avant : sa place au
   * classement du mois, et ce que la clôture du mois lui a décerné — un titre
   * de champion, le Mois complet, et ce qu'ils ouvrent.
   */
  moisDernier?: { mois: string; rang: number; joueurs: number; points: number; recompenses: PalierTombe[]; legendaires?: string[] }
  /**
   * La partie finie : son niveau avant elle, et après — ce qu'elle a ouvert
   * se dit comme en fin de soirée (« Niveau 2 ! », la finition, l'emoji de
   * collection à porter).
   */
  niveauAvant?: number
  niveauApres?: number
  /**
   * Pendant une saison (Halloween, Noël, le Nouvel An), tant que son
   * légendaire n'est pas à lui : ses jours joués dans la période, et combien
   * il en faut.
   */
  saison?: { nom: string; legendaire: string; joues: number; requis: number; periode: string }
}

// ── Le laurier qui grandit ────────────────────────────────────────────────

/**
 * Le laurier du lendemain change d'allure avec ses victoires, toutes
 * comptées : vert à la première, d'or à cinq, serti à vingt, couronne
 * étoilée à cinquante — les paliers du Champion du jour, et le thème de
 * L'Horloge astronomique pour le dernier. Il ne se porte toujours que le
 * lendemain d'une victoire : la salle reconnaît un champion habituel sans
 * qu'une marque de plus suive son prénom.
 */
export const SEUILS_DU_LAURIER = [1, 5, 20, 50] as const

export type NiveauDeLaurier = 1 | 2 | 3 | 4

/**
 * Le laurier qu'on porte à côté de son prénom : celui du quiz du jour (1 à
 * 4, l'allure de ses victoires), ou le laurier d'argent du défi de la
 * semaine (`'argent'`, la campagne). Qui a les deux porte celui d'hier : il
 * ne dure qu'un jour, l'argent une semaine.
 */
export type LaurierPorte = NiveauDeLaurier | 'argent'

/** Le laurier de qui a gagné tant de fois — au moins le premier : il vient de gagner. */
export function niveauDuLaurier(victoires: number): NiveauDeLaurier {
  let n = 1
  for (let i = 1; i < SEUILS_DU_LAURIER.length; i++) if (victoires >= SEUILS_DU_LAURIER[i]) n = i + 1
  return n as NiveauDeLaurier
}

export const NOM_DU_LAURIER: Record<NiveauDeLaurier, string> = {
  1: 'Laurier',
  2: 'Laurier d’or',
  3: 'Laurier d’or serti',
  4: 'Couronne étoilée',
}

// ── Le champion du mois ───────────────────────────────────────────────────

/**
 * Le champion d'un mois : le premier du classement du mois, rang partagé —
 * les points de tous ses jours additionnés. Le mois récompense la
 * régularité autant que le talent : un joueur de tous les jours passe devant
 * un génie de trois jours. Sa clé est datée (`mois:2026-10`), une par mois
 * gagné : un titre qu'on collectionne (« Champion d’octobre 2026 »).
 */
export const PREFIXE_DU_CHAMPION = 'mois:'

export const cleDuChampion = (mois: string) => `${PREFIXE_DU_CHAMPION}${mois}`

/** Le mois d'une clé de champion (`mois:2026-10` → `2026-10`), null pour toute autre clé. */
export function moisDuChampion(cle: string | null | undefined): string | null {
  if (!cle?.startsWith(PREFIXE_DU_CHAMPION)) return null
  const mois = cle.slice(PREFIXE_DU_CHAMPION.length)
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mois) ? mois : null
}

/** Le titre daté d'un champion du mois : « Champion d’octobre 2026 ». */
export function titreDuChampion(cle: string): string | null {
  const mois = moisDuChampion(cle)
  return mois ? `Champion ${duMois(mois)}` : null
}

/** Ses titres de champion du mois, du plus récent au plus ancien. */
export function titresDeChampion(recompenses: ReadonlyMap<string, number>): string[] {
  return [...recompenses.keys()].filter(k => (recompenses.get(k) ?? 0) > 0 && moisDuChampion(k)).sort().reverse()
}

// ── La série et ses sabliers ──────────────────────────────────────────────

/** Un sablier : il couvre un jour manqué, et la série tient. Le prix d'un, en confettis. */
export const PRIX_D_UN_SABLIER = 50

/** Deux au plus dans la réserve : de quoi partir en week-end, pas de quoi oublier le quiz un mois. */
export const SABLIERS_MAX = 2

/** La série d'un profil, ses sabliers comptés : ce que sa page et ses paliers lisent. */
export interface SerieDuJour {
  /** Les jours joués d'affilée jusqu'à aujourd'hui — ou hier, tant qu'aujourd'hui n'est pas joué. */
  serie: number
  /** La plus longue de sa vie. */
  record: number
  /** Aujourd'hui compte déjà. */
  tenue: boolean
  /** Les sabliers qui l'attendent. */
  sabliers: number
  /** Les jours manqués qu'un sablier a couverts, du plus ancien au plus récent. */
  couverts: string[]
}

/**
 * La série, ses sabliers comptés : on parcourt les jours, du premier joué à
 * aujourd'hui. Un sablier acheté rejoint la réserve le jour de l'achat (deux
 * au plus) ; un jour manqué au milieu d'une série en prend un s'il y en a,
 * et la série tient — sans compter ce jour-là : un sablier garde la série,
 * il ne joue pas à sa place. Sans sablier, elle se casse. Aujourd'hui, tant
 * qu'il n'est pas joué, ne coûte rien : minuit seul casse une série.
 *
 * Rien ne s'écrit : les sabliers pris se relisent ainsi des jours joués et
 * des achats, comme les vies des sentiers (`viesDe`) — un hoquet de la base
 * ne fausse rien, et une soirée retirée de l'historique rend le sablier
 * qu'elle avait épargné.
 */
export function serieAvecSabliers(joues: ReadonlySet<string>, achats: readonly string[], aujourdhui: string): SerieDuJour {
  const tries = [...joues].filter(j => j <= aujourdhui).sort()
  const parJour = new Map<string, number>()
  for (const a of achats) if (a <= aujourdhui) parJour.set(a, (parJour.get(a) ?? 0) + 1)
  const premier = [tries[0], [...parJour.keys()].sort()[0]].filter(Boolean).sort()[0]
  let reserve = 0
  let serie = 0
  let record = 0
  const couverts: string[] = []
  if (premier) {
    for (let jour = premier; jour <= aujourdhui; jour = jourAvant(jour, -1)) {
      reserve = Math.min(SABLIERS_MAX, reserve + (parJour.get(jour) ?? 0))
      if (joues.has(jour)) {
        serie++
        record = Math.max(record, serie)
      } else if (jour === aujourdhui) {
        // Pas encore joué : la journée n'est pas finie.
      } else if (serie > 0 && reserve > 0) {
        reserve--
        couverts.push(jour)
      } else serie = 0
    }
  }
  return { serie, record, tenue: joues.has(aujourdhui), sabliers: reserve, couverts }
}
