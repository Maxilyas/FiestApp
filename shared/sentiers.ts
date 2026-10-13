// Les sentiers du savoir : le second mode de la campagne solo, où se gagnent
// les avatars du savoir (`shared/branches.ts`).
//
// Un sentier par branche, douze paliers chacun. Un palier pose seize
// questions de sa catégorie, et se valide à dix bonnes réponses : la même
// règle partout, ce sont les questions qui durcissent, des faciles du premier
// palier aux difficiles du douzième. Un portrait tous les deux paliers. Après
// le sommet, un palier de maître, facultatif : seize expertes, neuf à
// trouver, un titre au bout (le choix du 5 octobre 2026 — les expertes, dont
// moins d'un joueur sur cinq trouve la réponse, feraient d'un palier à avatar
// une loterie qu'on gagne à l'usure).
//
// Un palier raté coûte une vie. Douze par jour, pour tous les sentiers,
// rendues à minuit (Paris) ; au-delà, des vies achetées en confettis, qui
// attendent dans une réserve. Rejouer un palier validé ne coûte rien.
//
// Tout ici est pur et partagé : le serveur l'applique (`core/campagne.ts`),
// la page le montre. Les seuils, les mélanges et le prix d'une vie sont des
// choix de produit : mesurés avant d'être changés, et dits. Les mélanges se
// règlent aussi au QG, palier par palier (`MelangesRegles`), sur les vraies
// épreuves — le seuil, jamais.

import { BRANCHES, branche, deLaBranche, type Branche, type CleDeBranche, type Paliers } from './branches'
import { hautFait } from './hautsfaits'
import { titreDuChampion } from './jour'
import type { Niveau, QuestionDeCampagne } from './campagne'

/** Les paliers d'un sentier ; le treizième est celui du maître. */
export const PALIERS_DU_SENTIER = 12
export const PALIER_DU_MAITRE = 13

/** Les questions d'une épreuve : assez pour qu'un palier se mérite, pas plus que cinq minutes. */
export const QUESTIONS_PAR_EPREUVE = 16

/**
 * Les vies du jour, pour tous les sentiers : autant que de sentiers. Elles
 * reviennent à minuit, heure de Paris, et ne s'additionnent pas d'un jour à
 * l'autre (le choix du 5 octobre 2026).
 */
export const VIES_PAR_JOUR = BRANCHES.length

/** Le prix d'une vie, en confettis : une série ou deux en rapportent autant. Un choix de produit. */
export const PRIX_D_UNE_VIE = 25

/** Ce qu'un achat porte au plus : de quoi tenir une soirée de sentiers, pas une réserve sans fond d'un toucher. */
export const VIES_PAR_ACHAT_MAX = 10

export type Melange = Readonly<Partial<Record<Niveau, number>>>

export interface RegleDuPalier {
  /** De 1 à 13 ; 13 est le palier de maître. */
  n: number
  /** Les seize questions, par niveau (`niveauDeQuestion`). */
  melange: Melange
  /** Les bonnes réponses qu'il faut sur seize. */
  seuil: number
  /** Le rang du portrait qu'il ouvre dans sa branche (0 à 5), ou null. */
  avatar: number | null
  maitre: boolean
  /** Pas de vrai ou faux : une chance sur deux au hasard, qu'on laisse aux premiers paliers. */
  sansVraiFaux: boolean
  /** Chaque sous-thème de la catégorie a sa question : le football seul ne fait pas le stade. */
  touteLaCategorie: boolean
}

/**
 * Les mélanges des douze paliers, du plus facile au sommet : quatorze
 * faciles et deux moyennes au deuxième, trois moyennes et treize difficiles
 * au douzième. Mesurés pour que la difficulté monte sans à-coup : à 10 sur
 * 16, un joueur moyen dans la catégorie valide le premier presque toujours,
 * le cinquième 79 fois sur cent, le huitième 23, le douzième 2 ; un bon
 * joueur, 46 fois sur cent au sommet ; un spécialiste, 96
 * (`server/scripts/calibrage-sentiers.ts`).
 */
const MELANGES: readonly Melange[] = [
  { facile: 16 },
  { facile: 14, moyen: 2 },
  { facile: 12, moyen: 4 },
  { facile: 10, moyen: 6 },
  { facile: 7, moyen: 9 },
  { facile: 4, moyen: 12 },
  { moyen: 16 },
  { moyen: 13, difficile: 3 },
  { moyen: 10, difficile: 6 },
  { moyen: 7, difficile: 9 },
  { moyen: 5, difficile: 11 },
  { moyen: 3, difficile: 13 },
]

/**
 * Dix bonnes réponses sur seize, à chaque palier : la règle se retient en
 * une phrase. Il en fallait douze : les vraies épreuves butaient du
 * cinquième au huitième palier — le calcul y donnait au joueur moyen 38,
 * 21, 9 puis 4 chances sur cent du premier coup, 79, 61, 37 et 23 à dix —,
 * et le propriétaire l'a baissé de deux crans le 5 octobre 2026. Une
 * épreuve commencée garde le seuil de son départ (`campagne_series.seuil`),
 * un palier validé ne se reprend pas.
 */
export const SEUIL_DES_PALIERS = 10
/** Neuf expertes sur seize : plus de la moitié de questions que presque personne ne trouve. */
export const SEUIL_DU_MAITRE = 9
/** À partir de ce palier, pas de vrai ou faux. */
export const SANS_VRAI_FAUX_DES = 5
/** À partir de ce palier, toute la catégorie ; avant, les chapitres et leur thème (`shared/chapitres.ts`). */
export const TOUTE_LA_CATEGORIE_DES = 9

export const PALIERS: readonly RegleDuPalier[] = [
  ...MELANGES.map((melange, i) => {
    const n = i + 1
    return {
      n,
      melange,
      seuil: SEUIL_DES_PALIERS,
      avatar: n % 2 === 0 ? n / 2 - 1 : null,
      maitre: false,
      sansVraiFaux: n >= SANS_VRAI_FAUX_DES,
      touteLaCategorie: n >= TOUTE_LA_CATEGORIE_DES,
    }
  }),
  { n: PALIER_DU_MAITRE, melange: { expert: QUESTIONS_PAR_EPREUVE }, seuil: SEUIL_DU_MAITRE, avatar: null, maitre: true, sansVraiFaux: true, touteLaCategorie: true },
]

/**
 * Les mélanges réglés depuis le QG (le choix du 13 octobre 2026 : « régler
 * la difficulté des paliers en fonction de ce que je vois ») : un par palier
 * réglé, pour les douze sentiers ensemble ; celui du code sinon. Le seuil,
 * lui, reste dix partout — la règle se dit en une phrase.
 */
export type MelangesRegles = Readonly<Partial<Record<number, Melange>>>

/**
 * Un mélange réglé, tel que le QG le montre : quand, et ce que les épreuves
 * commencées depuis en disent — trois mois de chiffres mêlent l'ancien
 * mélange et le nouveau, et le réglage ne s'y verrait pas avant longtemps.
 */
export interface ReglageDuMelange {
  palier: number
  melange: Melange
  regleLe: number
  /** Les épreuves commencées depuis, hors rejeu et sur trois mois au plus, et celles validées. */
  essais: number
  validees: number
}

/** Les mélanges en vigueur, palier par palier, lus dans les réglages. */
export const melangesDesReglages = (reglages: readonly ReglageDuMelange[]): MelangesRegles => Object.fromEntries(reglages.map(r => [r.palier, r.melange]))

/** La règle d'un palier, son mélange réglé s'il en a un (`MelangesRegles`). */
export function regleDuPalier(n: unknown, regles?: MelangesRegles): RegleDuPalier | null {
  const regle = typeof n === 'number' && Number.isInteger(n) ? (PALIERS[n - 1] ?? null) : null
  const melange = regle && regles?.[regle.n]
  return regle && melange ? { ...regle, melange } : regle
}

/** Les marches qu'un des douze paliers pose : jamais d'experte, le maître seul en pose. */
export const MARCHES_D_UN_PALIER = ['facile', 'moyen', 'difficile'] as const

/** Pourquoi ce mélange ne se règle pas sur le palier `n` ; null s'il se règle. */
export function refusDuMelange(n: unknown, melange: unknown): string | null {
  const regle = regleDuPalier(n)
  if (!regle) return 'Ce palier n’existe pas'
  if (regle.maitre) return 'Le palier de maître garde ses seize expertes : seuls les douze paliers se règlent'
  if (!melange || typeof melange !== 'object' || Array.isArray(melange)) return 'Dis combien de questions de chaque marche'
  let total = 0
  for (const [niveau, k] of Object.entries(melange as Record<string, unknown>)) {
    if (typeof k !== 'number' || !Number.isInteger(k) || k < 0) return 'Un nombre de questions est un entier, zéro ou plus'
    if (k === 0) continue
    if (niveau === 'expert') return 'Pas d’experte sur un palier : le maître les garde'
    if (!(MARCHES_D_UN_PALIER as readonly string[]).includes(niveau)) return 'Une marche se dit facile, moyenne ou difficile'
    total += k
  }
  if (total !== QUESTIONS_PAR_EPREUVE) return `Un palier pose ${QUESTIONS_PAR_EPREUVE} questions : ce mélange en a ${total}`
  return null
}

/** Un mélange tel qu'il se garde : ses marches dans l'ordre, sans celles qu'il ne pose pas. */
export function melangePropre(m: Melange): Melange {
  return Object.fromEntries(MARCHES_D_UN_PALIER.flatMap(niveau => ((m[niveau] ?? 0) > 0 ? [[niveau, m[niveau]]] : [])))
}

/** Deux mélanges qui posent les mêmes questions. */
export function memeMelange(a: Melange, b: Melange): boolean {
  return (['facile', 'moyen', 'difficile', 'expert'] as const).every(n => (a[n] ?? 0) === (b[n] ?? 0))
}

/** Les niveaux d'une épreuve, au féminin : ce sont des questions. */
const NIVEAU_DES_QUESTIONS: Record<Niveau, [string, string]> = {
  facile: ['facile', 'faciles'],
  moyen: ['moyenne', 'moyennes'],
  difficile: ['difficile', 'difficiles'],
  expert: ['experte', 'expertes'],
}

/** « 14 faciles et 2 moyennes » : la fiche d'un palier, et le journal du QG qui en règle un. */
export function texteDuMelange(m: Melange): string {
  const parts = (Object.entries(m) as [Niveau, number][]).filter(([, n]) => n > 0).map(([niveau, n]) => `${n} ${NIVEAU_DES_QUESTIONS[niveau][n > 1 ? 1 : 0]}`)
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} et ${parts.at(-1)}` : (parts[0] ?? '')
}

/** L'ordre des marches, pour lire un mélange : facile, moyenne, difficile, experte. */
const RANG_DES_MARCHES: Readonly<Record<Niveau, number>> = { facile: 0, moyen: 1, difficile: 2, expert: 3 }

/**
 * La difficulté d'un palier en un mot, lue sur son mélange : la marche
 * moyenne de ses questions. La tuile d'un sentier et son bloc disaient ce
 * qu'il pose, jamais à quel point (le souhait du propriétaire du 11 octobre
 * 2026 : « savoir direct contre quoi on joue, et la difficulté »). Des
 * paliers au maître : facile deux fois, facile à moyen trois fois, moyen
 * trois fois, moyen à difficile trois fois, difficile, puis expert.
 */
export function difficulteDuMelange(melange: Melange): string {
  const m = marcheMoyenne(melange)
  return m < 0.25 ? 'facile' : m < 0.75 ? 'facile à moyen' : m < 1.25 ? 'moyen' : m < 1.75 ? 'moyen à difficile' : m < 2.5 ? 'difficile' : 'expert'
}

/** La marche moyenne d'un mélange, de 0 (facile) à 3 (experte) : sa difficulté, et de quoi dire qu'un palier devient plus facile que celui d'avant. */
export function marcheMoyenne(melange: Melange): number {
  let questions = 0
  let marches = 0
  for (const [niveau, k] of Object.entries(melange) as [Niveau, number][]) {
    questions += k
    marches += RANG_DES_MARCHES[niveau] * k
  }
  return questions > 0 ? marches / questions : 0
}

/**
 * L'expérience d'un palier validé en jouant, une fois par palier : il ne
 * rapportait que ses bonnes réponses, et l'épreuve qui ouvrait un portrait
 * passait sans un point de plus que la série d'à côté (le choix du 6 octobre
 * 2026). Le double s'il ouvre un portrait, bien plus pour le maître. Un palier
 * repris des portraits d'avant (`sentier_acquis`) ne paie qu'une fois rejoué
 * et validé : ses portraits avaient déjà payé leurs bonnes réponses.
 */
export const XP_D_UN_PALIER = 50
export const XP_D_UN_PALIER_A_PORTRAIT = 100
export const XP_DU_MAITRE = 250

/** Ce que rapporte le palier `n` validé pour la première fois. */
export function xpDuPalier(n: number): number {
  const regle = regleDuPalier(n)
  if (!regle) return 0
  if (regle.maitre) return XP_DU_MAITRE
  return regle.avatar !== null ? XP_D_UN_PALIER_A_PORTRAIT : XP_D_UN_PALIER
}

/**
 * Les étoiles d'une épreuve validée : une au seuil, deux à mi-chemin du
 * sans-faute (13 sur 16 quand il en faut 10), trois pour le sans-faute. Elles
 * ne rapportaient rien, et les deux dernières se jouaient pour rien ; elles
 * paient maintenant en confettis (`CONFETTIS_DES_ETOILES`).
 */
export function etoilesDe(justes: number, seuil: number): 0 | 1 | 2 | 3 {
  if (justes < seuil) return 0
  if (justes >= QUESTIONS_PAR_EPREUVE) return 3
  return justes >= seuil + Math.ceil((QUESTIONS_PAR_EPREUVE - seuil) / 2) ? 2 : 1
}

/**
 * Les confettis de la meilleure note d'un palier (le choix du 10 octobre
 * 2026, un choix de produit : les deuxième et troisième étoiles ne
 * rapportaient rien) — deux étoiles, dix ; trois, vingt-cinq, le prix d'une
 * vie. La première valide le palier, que son expérience paie déjà. Une fois
 * par palier : rejouer pour la même note ne rapporte rien de plus, et une
 * meilleure ne paie que la différence. Comme tous les confettis, relus à
 * chaque lecture (`confettisDesEtoiles`) : la règle vaut aussi pour les
 * étoiles d'avant elle.
 */
export const CONFETTIS_DES_ETOILES: Readonly<Record<0 | 1 | 2 | 3, number>> = { 0: 0, 1: 0, 2: 10, 3: PRIX_D_UNE_VIE }

const confettisDeLaNote = (etoiles: number): number => CONFETTIS_DES_ETOILES[Math.max(0, Math.min(3, Math.floor(etoiles))) as 0 | 1 | 2 | 3]

/** Ce que rapportent ses étoiles : la meilleure note de chaque palier de chaque sentier. */
export function confettisDesEtoiles(sentiers: readonly { etoiles: readonly number[] }[]): number {
  return sentiers.reduce((n, s) => n + s.etoiles.reduce((m, e) => m + confettisDeLaNote(e), 0), 0)
}

/** Ce qu'une note nouvelle rapporte sur un palier qui en avait déjà une : la différence, jamais moins que rien. */
export function confettisDeLaNouvelleNote(avant: number, apres: number): number {
  return Math.max(0, confettisDeLaNote(apres) - confettisDeLaNote(avant))
}

/** Ses étoiles sur un sentier, ou sur tous : la somme des meilleures notes. */
export const etoilesDuSentier = (s: { etoiles: readonly number[] }): number => s.etoiles.reduce((n, e) => n + e, 0)

export type IssueDEpreuve = 'validee' | 'ratee'

/**
 * Où en est une épreuve : validée dès le seuil atteint — elle continue
 * jusqu'à la seizième question, pour les étoiles —, ratée dès que les
 * erreurs dépassent ce que le seuil permet ; l'épreuve s'arrête alors.
 */
export function issueDe(justes: number, repondues: number, seuil: number): IssueDEpreuve | null {
  if (justes >= seuil) return 'validee'
  if (repondues - justes > QUESTIONS_PAR_EPREUVE - seuil) return 'ratee'
  return null
}

/** Une épreuve s'arrête à la seizième question, ou dès qu'elle est ratée. */
export function epreuveFinie(justes: number, repondues: number, seuil: number): boolean {
  return repondues >= QUESTIONS_PAR_EPREUVE || issueDe(justes, repondues, seuil) === 'ratee'
}

/**
 * Les vies qui restent : celles du jour — douze, moins les échecs
 * d'aujourd'hui —, et la réserve — les vies achetées, moins celles prises
 * au-delà des douze, chaque jour. Dérivées du journal des épreuves à chaque
 * lecture : aucun compteur à tenir à côté, qu'un hoquet de la base aurait
 * faussé.
 */
export function viesDe(echecsParJour: ReadonlyMap<string, number>, achetees: number, aujourdhui: string): { jour: number; reserve: number } {
  let prises = 0
  for (const n of echecsParJour.values()) prises += Math.max(0, n - VIES_PAR_JOUR)
  return { jour: Math.max(0, VIES_PAR_JOUR - (echecsParJour.get(aujourdhui) ?? 0)), reserve: Math.max(0, achetees - prises) }
}

/**
 * Les paliers que valent des portraits gagnés avant les sentiers : le palier
 * de leur dernier portrait. Celui qui avait le lynx (le troisième) reprend
 * au septième palier.
 */
export const paliersDesPortraits = (portraits: number): number => 2 * Math.max(0, Math.min(6, Math.floor(portraits)))

// ── Les maîtres et leurs titres ─────────────────────────────────────────────

/** La clé du titre d'un maître : `maitre:foret`. Un titre se porte sous le prénom, comme le nom d'un haut fait. */
export const cleDeMaitre = (b: CleDeBranche): string => `maitre:${b}`

/** La branche derrière une clé de maître, s'il en est une. */
export function brancheDuMaitre(cle: unknown): Branche | undefined {
  return typeof cle === 'string' && cle.startsWith('maitre:') ? branche(cle.slice(7)) : undefined
}

/** « Maître de la forêt », « Maître du stade ». */
export const titreDeMaitre = (b: Branche): string => `Maître ${deLaBranche(b)}`

/** Les branches dont il a validé le palier de maître. */
export function maitresDe(paliers: Paliers): CleDeBranche[] {
  return BRANCHES.filter(b => (paliers[b.key] ?? 0) >= PALIER_DU_MAITRE).map(b => b.key)
}

/**
 * Le nom d'un titre porté : celui d'un haut fait (« L'Oracle »), ou d'un
 * maître (« Maître de la forêt ») ; null pour une clé inconnue. Tout ce qui
 * écrit un titre passe par ici.
 */
export function nomDuTitre(cle: string | null | undefined): string | null {
  if (!cle) return null
  const h = hautFait(cle)
  if (h) return h.title
  const champion = titreDuChampion(cle)
  if (champion) return champion
  const b = brancheDuMaitre(cle)
  return b ? titreDeMaitre(b) : null
}

// ── Ce que la page reçoit ───────────────────────────────────────────────────

export interface VieDesSentiers {
  /** Celles du jour qui restent, de 0 à `VIES_PAR_JOUR`. */
  jour: number
  /** Les vies achetées qui restent : elles servent après celles du jour, et ne périment pas. */
  reserve: number
  parJour: number
  prix: number
  /** Le prochain minuit de Paris, quand celles du jour reviennent. */
  renouveleesLe: number
}

export interface SentierDuJoueur {
  branche: CleDeBranche
  /** Les paliers validés, de 0 à 13 (le maître). */
  paliers: number
  /** Ceux qu'il tenait de ses portraits d'avant les sentiers : validés sans épreuve, donc sans étoiles. */
  acquis: number
  /** La meilleure note de chaque palier (1 à 13), en étoiles ; 0 pour un palier jamais validé en épreuve. */
  etoiles: number[]
}

/** Une épreuve, telle que sa page la reprend : jamais la bonne réponse de la question en cours. */
export interface EpreuveDeSentier {
  id: string
  branche: CleDeBranche
  palier: number
  /** Un palier déjà validé, rejoué : sans risque. */
  rejeu: boolean
  seuil: number
  justes: number
  fausses: number
  total: number
  issue: IssueDEpreuve | null
  finie: boolean
  question?: QuestionDeCampagne
}

export interface EtatDesSentiers {
  vies: VieDesSentiers
  sentiers: SentierDuJoueur[]
  /** L'épreuve en cours, s'il en a laissé une : une seule à la fois. */
  epreuve: EpreuveDeSentier | null
  /** Son solde de confettis, pour racheter des vies ; absent si la base s'est tue. */
  confettis?: number
  /** Les mélanges réglés depuis le QG : la difficulté d'un palier se lit dessus. Absent : ceux du code. */
  melanges?: MelangesRegles
}

/** Le sentier qu'on avance, et le palier qui l'y attend. */
export interface SentierQuOnAvance {
  branche: CleDeBranche
  /** Celui de l'épreuve laissée, sinon le suivant du sentier. */
  palier: number
  /** Une épreuve laissée en cours, sur ce palier. */
  laissee: boolean
}

/**
 * Le sentier qu'on avance : l'épreuve laissée d'abord, sinon le plus haut
 * qui n'est pas au sommet — le maître est facultatif, un sentier au sommet
 * n'attend plus rien. La carte des sentiers et l'accueil le disent pareil :
 * à égalité, le premier dans l'ordre des branches.
 */
export function sentierQuOnAvance(
  sentiers: readonly SentierDuJoueur[],
  laissee: { branche: CleDeBranche; palier: number } | null,
): SentierQuOnAvance | null {
  if (laissee) return { branche: laissee.branche, palier: laissee.palier, laissee: true }
  const haut = sentiers
    .filter(s => s.paliers > 0 && s.paliers < PALIERS_DU_SENTIER)
    .reduce<SentierDuJoueur | null>((m, s) => (m && m.paliers >= s.paliers ? m : s), null)
  return haut ? { branche: haut.branche, palier: haut.paliers + 1, laissee: false } : null
}

/**
 * Ce que l'accueil d'un profil dit de ses sentiers, sur le bouton de la
 * campagne — et du défi de la semaine. Les défis que ses amis lui envoient
 * vont aux duels (`DuelsDAccueil`), qui ont quitté la campagne.
 */
export interface SentiersDAccueil {
  /** Ses vies : celles du jour et sa réserve ensemble. */
  vies: number
  avance: SentierQuOnAvance | null
  /** Les questions que son carnet a à revoir aujourd'hui (`shared/revision.ts`) ; absent : rien. */
  aRevoir?: number
  /**
   * Le défi de la semaine, tant qu'il ne l'a pas fini — à qui a déjà joué la
   * campagne : ceux qui l'ont relevé (une réponse au moins), le sien s'il l'a
   * ouvert, s'il en a relevé un une semaine passée, et si c'est lundi, le
   * jour où il est neuf. Absent : fini, ou rien joué.
   */
  defi?: DefiDAccueil
}

export interface DefiDAccueil {
  joueurs: number
  commence?: true
  habitue?: true
  neuf?: true
}

/** Ce que dit une réponse d'épreuve : la bonne, l'anecdote, et l'épreuve d'après. */
export interface ReponseDEpreuve {
  juste: boolean
  bonne: number
  anecdote: string | null
  /** L'expérience que cette réponse rapporte (celle d'une bonne réponse en série). */
  xp: number
  /** Le palier vient d'être validé pour la première fois : ce qu'il rapporte en plus (`xpDuPalier`). */
  xpPalier?: number
  epreuve: EpreuveDeSentier
  /** Finie et validée : ses étoiles, et si c'est sa meilleure note sur ce palier. */
  etoiles?: number
  record?: boolean
  /** Une meilleure note qui paie (`CONFETTIS_DES_ETOILES`) : les confettis qu'elle ajoute. */
  confettisDesEtoiles?: number
  /** Le portrait que ce palier vient d'ouvrir — la première fois seulement. */
  avatar?: string
  /** Le titre de maître que le palier de maître vient de donner. */
  maitre?: string
  /** Après un échec : les vies qui restent. */
  vies?: VieDesSentiers
  /** Finie : les paliers de la campagne qu'elle a fait tomber (Le Marathonien, L'Érudit), et ce qu'ils ouvrent. */
  recompenses?: { key: string; emoji: string; title: string }[]
  legendaires?: string[]
}

/**
 * Ce que la fin d'une épreuve montre : sa dernière réponse, ou — arrêtée là
 * une fois validée (`POST /api/campagne/epreuve/:id/abandon`, `fin`) — rien
 * qu'elle-même, ses étoiles et ce qu'elle ouvre.
 */
export type FinDEpreuve = Omit<ReponseDEpreuve, 'juste' | 'bonne' | 'anecdote' | 'xp'>

/**
 * Un palier, côté administrateur : ce que les vraies épreuves en disent, sur
 * les trois derniers mois, rejeux à part. Le compte se tient par joueur et
 * par sentier — tous sentiers confondus, celui qui tente la forêt et le
 * stade compte sur chacun —, et ceux qui n'ont pas validé y gardent leur
 * place : « 0,0 vie perdue avant de valider » se lisait sur un palier où le
 * seul qui avait validé l'avait fait du premier coup, pendant que les autres
 * y avaient laissé cinq vies chacun (la remarque du propriétaire du
 * 5 octobre 2026). `lectureDuPalier` en tire les parts.
 */
export interface StatsDuPalier {
  palier: number
  /** Ceux qui l'ont tenté, hors rejeu. */
  joueurs: number
  /** Ceux d'entre eux qui l'ont validé ; et parmi eux, ceux du premier coup. */
  valides: number
  premierCoup: number
  /** Les épreuves jouées, hors rejeu : une validée par joueur au plus, chacune des autres a coûté une vie. */
  essais: number
  /** Les échecs de ceux qui ne l'ont pas validé : ce qu'ils y ont laissé, que la moyenne des autres ne cache plus. */
  echecsDesBloques: number
  /** Ceux des échecs qui étaient des abandons : l'épreuve quittée avant la faute de trop. */
  abandons: number
  /** Les questions répondues en épreuve, hors rejeu, et les bonnes : la difficulté du palier, sans son seuil. */
  questions: number
  justes: number
  /**
   * Ses essais par seuil, du plus haut au plus bas : un seuil changé ne vaut
   * que pour les épreuves d'après, et les deux se comparent — douze sur
   * seize jusqu'au 5 octobre 2026.
   */
  seuils: { seuil: number; essais: number; validees: number }[]
  /**
   * Ceux qui l'attendent sans l'avoir jamais tenté : le palier d'avant
   * validé, celui-ci jamais joué — sur toutes leurs épreuves, pas seulement
   * les trois derniers mois. Un joueur qui ne revient pas s'y voit, pas
   * dans les échecs.
   */
  enAttente: number
  /**
   * Ses rejeux terminés, comptés à part : un palier déjà validé — ou repris
   * des portraits d'avant (`sentier_acquis`) —, rejoué sans risquer de vie,
   * ne dit rien d'un premier essai. Mais sans eux, le joueur qui rejouait
   * les premiers paliers repris ne paraissait nulle part.
   */
  rejeux: number
  /** Ceux de ces rejeux qui ont atteint le seuil. */
  rejeuxValides: number
}

/** Ce qu'une ligne de palier se lit : des parts et des moyennes, null quand rien ne les fonde. */
export interface LectureDuPalier {
  /** Ceux qui l'ont tenté sans le valider. */
  bloques: number
  /** Validé, sur tenté. */
  passent: number | null
  /** Validé du premier coup, sur tenté. */
  premierEssai: number | null
  /** Épreuves validées sur épreuves jouées : la chance d'un essai, celle que le calibrage annonce. */
  parEssai: number | null
  /** Les essais qu'il a fallu, en moyenne, à ceux qui l'ont validé — le dernier, réussi, compris. */
  essaisPourValider: number | null
  /** Les échecs, en moyenne, de ceux qui ne l'ont pas validé. */
  echecsParBloque: number | null
  /** Toutes les vies qu'il a coûtées : chaque essai qui n'a pas validé. */
  viesPerdues: number
  /** Les bonnes réponses, sur les questions répondues. */
  bonnesReponses: number | null
}

export function lectureDuPalier(p: StatsDuPalier): LectureDuPalier {
  const part = (n: number, sur: number) => (sur > 0 ? n / sur : null)
  const bloques = Math.max(0, p.joueurs - p.valides)
  return {
    bloques,
    passent: part(p.valides, p.joueurs),
    premierEssai: part(p.premierCoup, p.joueurs),
    parEssai: part(p.valides, p.essais),
    essaisPourValider: part(p.essais - p.echecsDesBloques, p.valides),
    echecsParBloque: part(p.echecsDesBloques, bloques),
    viesPerdues: Math.max(0, p.essais - p.valides),
    bonnesReponses: part(p.justes, p.questions),
  }
}

/**
 * La part des joueurs qui trouvent une question de chaque marche, telle que
 * le calibrage la suppose (`server/scripts/calibrage-sentiers.ts`) : le
 * milieu de chaque marche de `niveauDuTaux`. L'administration la met à côté
 * de ce que les vraies épreuves disent — une marche plus dure qu'annoncé
 * fait un mur que le calcul ne voyait pas.
 */
export const TAUX_DU_CALIBRAGE: Readonly<Record<Niveau, number>> = { facile: 0.85, moyen: 0.55, difficile: 0.3, expert: 0.1 }

/** Les réponses d'épreuve qu'il faut sur un palier pour estimer un autre mélange : dix épreuves. */
export const REPONSES_POUR_ESTIMER = 10 * QUESTIONS_PAR_EPREUVE

const logit = (p: number) => Math.log(p / (1 - p))
const sigmoide = (x: number) => 1 / (1 + Math.exp(-x))

/**
 * La chance d'au moins `seuil` bonnes réponses, chaque question trouvée avec
 * la chance de sa marche : la loi de leur somme, question par question — le
 * calcul de `calibrage-sentiers.ts`.
 */
export function chanceDeValider(melange: Melange, seuil: number, taux: Readonly<Record<Niveau, number>>): number {
  let loi = [1]
  for (const [niveau, k] of Object.entries(melange) as [Niveau, number][]) {
    const p = taux[niveau]
    for (let i = 0; i < k; i++) {
      const suite = new Array<number>(loi.length + 1).fill(0)
      loi.forEach((q, j) => {
        suite[j] += q * (1 - p)
        suite[j + 1] += q * p
      })
      loi = suite
    }
  }
  return Math.min(1, loi.slice(seuil).reduce((a, b) => a + b, 0))
}

/**
 * Ce que trouvent, marche par marche, ceux qui jouent un palier. Le calibrage
 * suppose un joueur moyen (`TAUX_DU_CALIBRAGE`) ; les vraies épreuves disent
 * ce que ce palier-là trouve. Un seul décalage pour toutes ses marches — en
 * logit, comme `calibrage-sentiers.ts` décale un joueur fort ou faible —,
 * celui qui fait coller le calcul à ses bonnes réponses mesurées : une marche
 * qu'il ne pose pas encore s'en déduit. Null sous dix épreuves : rien ne le
 * fonde.
 */
export function tauxDuPalier(mesures: readonly { niveau: Niveau; questions: number; justes: number }[]): Record<Niveau, number> | null {
  const questions = mesures.reduce((n, m) => n + m.questions, 0)
  if (questions < REPONSES_POUR_ESTIMER) return null
  const visees = mesures.reduce((n, m) => n + m.justes, 0)
  const predites = (decalage: number) => mesures.reduce((n, m) => n + m.questions * sigmoide(logit(TAUX_DU_CALIBRAGE[m.niveau]) + decalage), 0)
  // Plus le décalage monte, plus il en trouve : une bissection le trouve.
  let bas = -8
  let haut = 8
  for (let i = 0; i < 60; i++) {
    const milieu = (bas + haut) / 2
    if (predites(milieu) < visees) bas = milieu
    else haut = milieu
  }
  const decalage = (bas + haut) / 2
  return Object.fromEntries((Object.keys(TAUX_DU_CALIBRAGE) as Niveau[]).map(n => [n, sigmoide(logit(TAUX_DU_CALIBRAGE[n]) + decalage)])) as Record<Niveau, number>
}

/** Les essais qu'il faut pour croire une chance mesurée : ceux qu'il faut déjà pour dire qu'un palier remonte. */
export const ESSAIS_POUR_CROIRE = 10

export interface EstimationDuMelange {
  /** La chance d'un essai, estimée avec ce mélange. */
  chance: number
  /** Sur quoi elle se fonde : les épreuves de ce palier, ou le calcul seul, pour un joueur moyen. */
  sur: 'mesures' | 'calcul'
}

/**
 * La chance d'un essai qu'un autre mélange donnerait à un palier. Sur assez
 * d'épreuves, elle part de la chance mesurée sous le mélange qu'elles ont
 * joué (`reference`), et le calcul n'y ajoute que ce que le mélange change,
 * en cote (logit), avec ce que les joueurs de ce palier trouvent vraiment à
 * chaque marche (`tauxDuPalier`) : le calcul seul supposait des joueurs tous
 * pareils, et annonçait pour un mélange inchangé une autre chance que celle
 * qu'on voyait. Un même mélange redonne donc la chance mesurée. Sans assez
 * d'épreuves, le calcul seul, pour un joueur moyen (`TAUX_DU_CALIBRAGE`).
 */
export function estimationDuMelange(
  reference: { melange: Melange; parEssai: number | null; essais: number },
  melange: Melange,
  seuil: number,
  reponses: readonly { niveau: Niveau; questions: number; justes: number }[],
): EstimationDuMelange {
  const taux = tauxDuPalier(reponses)
  const { parEssai, essais } = reference
  if (taux && parEssai !== null && essais >= ESSAIS_POUR_CROIRE) {
    if (memeMelange(melange, reference.melange)) return { chance: parEssai, sur: 'mesures' }
    // Une chance de 0 ou de 1 n'a pas de cote : une demi-épreuve de marge, la mesure ne dit rien de plus fin.
    const borne = (p: number, marge: number) => Math.min(1 - marge, Math.max(marge, p))
    const ecart = logit(borne(chanceDeValider(melange, seuil, taux), 1e-9)) - logit(borne(chanceDeValider(reference.melange, seuil, taux), 1e-9))
    return { chance: sigmoide(logit(borne(parEssai, 0.5 / essais)) + ecart), sur: 'mesures' }
  }
  return { chance: chanceDeValider(melange, seuil, TAUX_DU_CALIBRAGE), sur: 'calcul' }
}

/** Un joueur bloqué, côté administrateur : le palier qui l'attend, et ce qu'il y a laissé. */
export interface JoueurBloque {
  profileId: string
  /** Son prénom ; absent si le profil ne se lit plus. */
  prenom?: string
  branche: CleDeBranche
  palier: number
  /** Ses échecs sur ce palier, abandons compris : autant de vies. */
  echecs: number
  /** Son dernier essai. */
  dernier: number
}

export interface AdminDesSentiers {
  /** Les sept derniers jours. */
  semaine: { joueurs: number; epreuves: number; viesAchetees: number; viesPerdues: number; paliersValides: number }
  /** La branche lue, ou null pour toutes. */
  branche: CleDeBranche | null
  paliers: StatsDuPalier[]
  /** Les bonnes réponses en épreuve, hors rejeu, par marche de question — trois derniers mois. */
  niveaux: { niveau: Niveau; questions: number; justes: number }[]
  /** Les mêmes, palier par palier : de quoi estimer un autre mélange (`tauxDuPalier`). */
  niveauxParPalier: { palier: number; niveau: Niveau; questions: number; justes: number }[]
  /** Les mélanges réglés depuis le QG, en vigueur pour les épreuves qui commencent (`melangesDesReglages`). */
  reglages: ReglageDuMelange[]
  /**
   * Ceux qui ont le plus d'échecs sur le palier qui les attend — deux au
   * moins, le maître à part : il est facultatif, et seize expertes en font
   * un mur voulu. Les plus bloqués d'abord, puis les plus récents.
   */
  bloques: JoueurBloque[]
}
