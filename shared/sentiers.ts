// Les sentiers du savoir : le second mode de la campagne solo, où se gagnent
// les avatars du savoir (`shared/branches.ts`).
//
// Un sentier par branche, douze paliers chacun. Un palier pose seize
// questions de sa catégorie, et se valide à douze bonnes réponses : la même
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
// choix de produit : mesurés avant d'être changés, et dits.

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
 * au douzième. Mesurés à 12 sur 16 pour que la difficulté monte sans à-coup :
 * un joueur moyen dans la catégorie valide le premier 92 fois sur cent, le
 * douzième presque jamais ; un spécialiste, 76 fois sur cent au sommet.
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

/** Douze bonnes réponses sur seize, à chaque palier : la règle se retient en une phrase. */
export const SEUIL_DES_PALIERS = 12
/** Neuf expertes sur seize : plus de la moitié de questions que presque personne ne trouve. */
export const SEUIL_DU_MAITRE = 9
/** À partir de ce palier, pas de vrai ou faux. */
export const SANS_VRAI_FAUX_DES = 5
/** À partir de ce palier, toute la catégorie. */
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

export function regleDuPalier(n: unknown): RegleDuPalier | null {
  return typeof n === 'number' && Number.isInteger(n) ? (PALIERS[n - 1] ?? null) : null
}

/**
 * Les étoiles d'une épreuve validée : une au seuil, deux à mi-chemin du
 * sans-faute (14 sur 16 quand il en faut 12), trois pour le sans-faute.
 * Purement pour le plaisir : elles ne rapportent rien, et donnent une raison
 * de rejouer.
 */
export function etoilesDe(justes: number, seuil: number): 0 | 1 | 2 | 3 {
  if (justes < seuil) return 0
  if (justes >= QUESTIONS_PAR_EPREUVE) return 3
  return justes >= seuil + Math.ceil((QUESTIONS_PAR_EPREUVE - seuil) / 2) ? 2 : 1
}

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

/** Ce que l'accueil d'un profil dit de ses sentiers, sur le bouton de la campagne. */
export interface SentiersDAccueil {
  /** Ses vies : celles du jour et sa réserve ensemble. */
  vies: number
  avance: SentierQuOnAvance | null
}

/** Ce que dit une réponse d'épreuve : la bonne, l'anecdote, et l'épreuve d'après. */
export interface ReponseDEpreuve {
  juste: boolean
  bonne: number
  anecdote: string | null
  /** L'expérience que cette réponse rapporte (celle d'une bonne réponse en série). */
  xp: number
  epreuve: EpreuveDeSentier
  /** Finie et validée : ses étoiles, et si c'est sa meilleure note sur ce palier. */
  etoiles?: number
  record?: boolean
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

/** Un palier, côté administrateur : ce que les vraies réponses en disent. */
export interface StatsDuPalier {
  palier: number
  /** Ceux qui l'ont tenté, au moins une fois, hors rejeu. */
  joueurs: number
  /** Les épreuves jouées, hors rejeu. */
  essais: number
  /** La part de ceux qui l'ont validé du premier coup, sur ceux qui l'ont tenté ; null sans essai. */
  premierEssai: number | null
  /** Les vies perdues en moyenne avant de le valider, sur ceux qui l'ont validé ; null si personne. */
  viesAvantDeValider: number | null
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

export interface AdminDesSentiers {
  /** Les sept derniers jours. */
  semaine: { joueurs: number; epreuves: number; viesAchetees: number }
  /** La branche lue, ou null pour toutes. */
  branche: CleDeBranche | null
  paliers: StatsDuPalier[]
}
