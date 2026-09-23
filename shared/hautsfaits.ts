// Les hauts faits : ce qu'on décroche en jouant — les coups d'éclat, et les
// coups de malchance.
//
// Deux familles, qui ne se gagnent pas pareil.
//
// · Les hauts faits **de soirée** se jugent sur une soirée entière, à sa
//   clôture : un sans-faute, une remontée, une série noire. Ils se regagnent
//   d'une soirée à l'autre, et l'étagère compte les fois (« ×3 »).
// · Les hauts faits **de carrière** additionnent toutes les soirées : trois
//   paliers — bronze, argent, or —, qui ne tombent qu'une fois chacun.
//
// Chacun a un ton. Les **éclats** récompensent un exploit ; les **ombres**,
// un coup de malchance — un prix, pas une punition. Le bas du classement a
// ainsi quelque chose à chasser, lui aussi : trois avatars légendaires ne se
// gagnent qu'en jouant mal (`shared/legendaires.ts`).
//
// Le catalogue est ici, pur et partagé : la page profil montre les règles, le
// serveur les applique (`server/src/core/hautsfaits.ts`). Chaque haut fait
// décroché garde une copie de son emoji et de son titre : une étagère se
// relit des années plus tard, même si un titre a changé entre-temps.
//
// Comme le reste du profil, un haut fait ne donne AUCUN avantage de jeu. Il
// dit d'où l'on vient, pas ce qu'on vaut ce soir.

import type { Carriere } from './profil'
import type { Rarete } from './badges'

export type Ton = 'eclat' | 'ombre'

export interface HautFaitDeSoiree {
  key: string
  famille: 'soiree'
  emoji: string
  title: string
  /** La règle, telle qu'on l'annonce. */
  rule: string
  ton: Ton
  /** L'expérience qu'il rapporte, chaque fois. */
  xp: number
}

export interface HautFaitDeCarriere {
  key: string
  famille: 'carriere'
  emoji: string
  title: string
  /** Ce qu'on compte, tel qu'on l'écrit sous la jauge : « réponses envoyées ». */
  mesure: string
  /** La même, au singulier — « 1 réponse envoyée », et « 0 » aussi, en français. */
  mesureUne: string
  /** Bronze, argent, or. */
  paliers: readonly [number, number, number]
  valeur: (c: Carriere) => number
}

export type HautFait = HautFaitDeSoiree | HautFaitDeCarriere

export const NOM_PALIER = ['Bronze', 'Argent', 'Or'] as const
/** L'expérience de chaque palier de carrière, une seule fois. */
export const XP_PALIER = [10, 25, 50] as const

/** La clé sous laquelle un palier de carrière se range : `hf:bavard:2` pour l'argent. */
export const clePalier = (key: string, palier: number) => `${key}:${palier}`

export const HAUTS_FAITS_DE_SOIREE: HautFaitDeSoiree[] = [
  // ── Les éclats ──
  {
    key: 'hf:grand-chelem',
    famille: 'soiree',
    emoji: '🎯',
    title: 'Grand Chelem',
    rule: 'Toutes les questions à choix d’un quiz justes, huit au moins',
    ton: 'eclat',
    xp: 40,
  },
  {
    key: 'hf:foudre',
    famille: 'soiree',
    emoji: '⚡',
    title: 'La Foudre',
    rule: 'Le plus rapide à trouver sur trois questions d’un même quiz',
    ton: 'eclat',
    xp: 25,
  },
  {
    key: 'hf:phenix',
    famille: 'soiree',
    emoji: '🔥',
    title: 'Le Phénix',
    rule: 'Gagner un quiz après avoir fini dans la moitié basse du précédent',
    ton: 'eclat',
    xp: 40,
  },
  {
    key: 'hf:seul-contre-tous',
    famille: 'soiree',
    emoji: '🦄',
    title: 'Seul contre tous',
    rule: 'Seul de la salle à trouver une question, six réponses au moins',
    ton: 'eclat',
    xp: 25,
  },
  {
    key: 'hf:oracle',
    famille: 'soiree',
    emoji: '🔮',
    title: 'L’Oracle',
    rule: 'Deux estimations au chiffre près dans la même soirée',
    ton: 'eclat',
    xp: 50,
  },
  {
    key: 'hf:double',
    famille: 'soiree',
    emoji: '🥇',
    title: 'Le Doublé',
    rule: 'Deux quiz gagnés dans la même soirée',
    ton: 'eclat',
    xp: 25,
  },
  {
    key: 'hf:triple',
    famille: 'soiree',
    emoji: '🐉',
    title: 'Le Triplé',
    rule: 'Trois quiz gagnés dans la même soirée',
    ton: 'eclat',
    xp: 60,
  },
  {
    key: 'hf:roi',
    famille: 'soiree',
    emoji: '👑',
    title: 'Le Roi de la soirée',
    rule: 'Premier de la soirée, devant sept joueurs au moins',
    ton: 'eclat',
    xp: 40,
  },
  {
    key: 'hf:increvable',
    famille: 'soiree',
    emoji: '🛡️',
    title: 'L’Increvable',
    rule: 'Dix bonnes réponses d’affilée',
    ton: 'eclat',
    xp: 30,
  },
  {
    key: 'hf:buzzer-or',
    famille: 'soiree',
    emoji: '⏰',
    title: 'Le Buzzer d’Or',
    rule: 'Trois bonnes réponses dans la dernière seconde',
    ton: 'eclat',
    xp: 20,
  },
  {
    key: 'hf:flair',
    famille: 'soiree',
    emoji: '🧭',
    title: 'Le Flair',
    rule: 'Trois fois juste quand la majorité de la salle se trompait',
    ton: 'eclat',
    xp: 25,
  },
  // ── Les ombres ──
  {
    key: 'hf:lanterne-rouge',
    famille: 'soiree',
    emoji: '🏮',
    title: 'La Lanterne Rouge',
    rule: 'Dernier d’un quiz, en ayant répondu à tout',
    ton: 'ombre',
    xp: 5,
  },
  {
    key: 'hf:ascenseur',
    famille: 'soiree',
    emoji: '🎢',
    title: 'L’Ascenseur Émotionnel',
    rule: 'Premier après un quiz, dans la moitié basse à la fin de la soirée',
    ton: 'ombre',
    xp: 5,
  },
  {
    key: 'hf:kamikaze',
    famille: 'soiree',
    emoji: '💥',
    title: 'Le Kamikaze',
    rule: 'Cinq mauvaises réponses données en moins de deux secondes',
    ton: 'ombre',
    xp: 5,
  },
  {
    key: 'hf:girouette',
    famille: 'soiree',
    emoji: '🌀',
    title: 'La Girouette',
    rule: 'Trois revirements sur une même question… pour finir faux',
    ton: 'ombre',
    xp: 5,
  },
  {
    key: 'hf:cosmique',
    famille: 'soiree',
    emoji: '🌌',
    title: 'L’Estimation Cosmique',
    rule: 'Se tromper d’un facteur dix sur une estimation',
    ton: 'ombre',
    xp: 5,
  },
  {
    key: 'hf:presque',
    famille: 'soiree',
    emoji: '🥈',
    title: 'Le Presque',
    rule: 'Deuxième d’un quiz, à moins de vingt points du premier',
    ton: 'ombre',
    xp: 10,
  },
  {
    key: 'hf:somnambule',
    famille: 'soiree',
    emoji: '😴',
    title: 'Le Somnambule',
    rule: 'Cinq questions d’affilée laissées passer',
    ton: 'ombre',
    xp: 5,
  },
  {
    key: 'hf:zero-pointe',
    famille: 'soiree',
    emoji: '🥚',
    title: 'Le Zéro Pointé',
    rule: 'Zéro point sur un quiz de cinq questions, en ayant répondu à tout',
    ton: 'ombre',
    xp: 5,
  },
  {
    key: 'hf:contre-courant',
    famille: 'soiree',
    emoji: '🐟',
    title: 'Le Contre-Courant',
    rule: 'Seul de la salle sur sa réponse… et faux, trois fois',
    ton: 'ombre',
    xp: 5,
  },
]

export const HAUTS_FAITS_DE_CARRIERE: HautFaitDeCarriere[] = [
  {
    key: 'hf:habitue',
    famille: 'carriere',
    emoji: '🎟️',
    title: 'L’Habitué',
    mesure: 'soirées jouées',
    mesureUne: 'soirée jouée',
    paliers: [3, 10, 25],
    valeur: c => c.soirees,
  },
  {
    key: 'hf:bavard',
    famille: 'carriere',
    emoji: '💬',
    title: 'Le Bavard',
    mesure: 'réponses envoyées',
    mesureUne: 'réponse envoyée',
    paliers: [100, 500, 2000],
    valeur: c => c.reponses,
  },
  {
    key: 'hf:encyclopedie',
    famille: 'carriere',
    emoji: '📚',
    title: 'L’Encyclopédie',
    mesure: 'bonnes réponses',
    mesureUne: 'bonne réponse',
    paliers: [50, 300, 1000],
    valeur: c => c.justes,
  },
  {
    key: 'hf:reflexe',
    famille: 'carriere',
    emoji: '🏎️',
    title: 'Le Réflexe',
    mesure: 'bonnes réponses parmi les plus rapides',
    mesureUne: 'bonne réponse parmi les plus rapides',
    paliers: [20, 100, 400],
    valeur: c => c.reflexes,
  },
  {
    key: 'hf:devin',
    famille: 'carriere',
    emoji: '🔮',
    title: 'Le Devin',
    mesure: 'estimations au chiffre près',
    mesureUne: 'estimation au chiffre près',
    paliers: [3, 10, 25],
    valeur: c => c.estimationsExactes,
  },
  {
    key: 'hf:globe-trotteur',
    famille: 'carriere',
    emoji: '🧳',
    title: 'Le Globe-trotteur',
    mesure: 'hôtes différents',
    mesureUne: 'hôte différent',
    paliers: [2, 4, 8],
    valeur: c => c.hotes,
  },
  {
    key: 'hf:podium',
    famille: 'carriere',
    emoji: '🥉',
    title: 'L’Habitué du Podium',
    mesure: 'podiums de quiz',
    mesureUne: 'podium de quiz',
    paliers: [3, 15, 50],
    valeur: c => c.podiumsQuiz,
  },
  {
    key: 'hf:collection',
    famille: 'carriere',
    emoji: '🎨',
    title: 'Le Collectionneur',
    mesure: 'avatars différents joués',
    mesureUne: 'avatar différent joué',
    paliers: [5, 12, 24],
    valeur: c => c.avatars,
  },
  {
    key: 'hf:eclats',
    famille: 'carriere',
    emoji: '✨',
    title: 'La Pluie d’Éclats',
    mesure: 'avatars éclatés',
    mesureUne: 'avatar éclaté',
    paliers: [1, 3, 6],
    valeur: c => c.eclats,
  },
  {
    key: 'hf:legende',
    famille: 'carriere',
    emoji: '🎖️',
    title: 'La Légende',
    mesure: 'niveau',
    mesureUne: 'niveau',
    paliers: [10, 20, 30],
    valeur: c => c.niveau,
  },
]

const PAR_CLE = new Map<string, HautFait>([...HAUTS_FAITS_DE_SOIREE, ...HAUTS_FAITS_DE_CARRIERE].map(h => [h.key, h]))

export function hautFait(key: string): HautFait | undefined {
  return PAR_CLE.get(key)
}

/** Le haut fait de soirée derrière cette clé, s'il en est un. */
export function hautFaitDeSoiree(key: string): HautFaitDeSoiree | undefined {
  const h = PAR_CLE.get(key)
  return h?.famille === 'soiree' ? h : undefined
}

/** Le palier de carrière derrière une clé rangée (`hf:bavard:2`), s'il en est un. */
export function palierDe(cle: string): { hautFait: HautFaitDeCarriere; palier: number } | null {
  const m = /^(.+):([123])$/.exec(cle)
  if (!m) return null
  const h = PAR_CLE.get(m[1])
  return h?.famille === 'carriere' ? { hautFait: h, palier: Number(m[2]) } : null
}

/** Comment un palier s'écrit sur une étagère : « Le Bavard · Argent ». */
export function titreDePalier(h: HautFaitDeCarriere, palier: number): string {
  return `${h.title} · ${NOM_PALIER[palier - 1]}`
}

/** L'expérience que rapporte une clé rangée — haut fait de soirée ou palier —, 0 pour le reste. */
export function xpDe(cle: string): number {
  const soiree = hautFaitDeSoiree(cle)
  if (soiree) return soiree.xp
  const p = palierDe(cle)
  return p ? XP_PALIER[p.palier - 1] : 0
}

/** Les paliers qu'une carrière atteint, clés rangées comprises (`hf:bavard:1`, `hf:bavard:2`…). */
export function paliersAtteints(c: Carriere): string[] {
  return HAUTS_FAITS_DE_CARRIERE.flatMap(h => {
    const v = h.valeur(c)
    return h.paliers.flatMap((seuil, i) => (v >= seuil ? [clePalier(h.key, i + 1)] : []))
  })
}

/**
 * Un haut fait tel qu'une page le montre : gagné ou non, avec sa progression.
 * La page profil montre tout le catalogue — savoir ce qui vient donne envie
 * de revenir.
 */
export interface HautFaitVu {
  key: string
  famille: 'soiree' | 'carriere'
  emoji: string
  title: string
  /** Soirée : la règle ; carrière : ce qu'on compte. */
  rule: string
  /** Carrière : ce qu'on compte, au singulier (moins de deux). */
  ruleUne?: string
  ton: Ton
  /** Soirée : combien de fois décroché ; carrière : le palier atteint, de 0 à 3. */
  fois: number
  /** Carrière : où l'on en est, et le prochain seuil (null au sommet). */
  valeur?: number
  prochain?: number | null
  /** La rareté du plus haut palier atteint, ou du haut fait — null avec trop peu de monde. */
  rarete?: Rarete | null
  porteurs?: number
}
