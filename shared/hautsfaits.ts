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
import { formatNumber } from './typographie'

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

/**
 * Ce qu'un palier demande, tel qu'on l'écrit sous son titre : « 2000 réponses
 * envoyées », « 1 avatar éclaté » — et « Niveau 20 » pour La Légende, qui ne
 * se compte pas.
 */
export function regleDuPalier(h: HautFaitDeCarriere, palier: number): string {
  const seuil = h.paliers[palier - 1]
  if (h.key === 'hf:legende') return `Niveau ${seuil}`
  return `${formatNumber(seuil)} ${seuil < 2 ? h.mesureUne : h.mesure}`
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

// ── Les plus beaux ────────────────────────────────────────────────────────

/**
 * La part des joueurs qui ont chaque haut fait — de soirée, et chaque palier
 * de carrière —, soirée après soirée, en moyenne sur leurs quarante
 * premières : plus elle est basse, plus il est beau. C'est elle qui choisit
 * « ses plus beaux hauts faits » sur la carte d'un joueur.
 *
 * Mesurée, pas décrétée : `server/scripts/calibrage.ts` fait jouer quarante
 * soirées à des bandes d'amis inventées, sur le vrai code des hauts faits,
 * aux trois formats de RECOMPENSES.md (5.2) — deux quiz de cinquante
 * questions à douze, deux de trente à dix, trois de douze à huit —, et l'on
 * garde la moyenne des trois. Un seul format mentait : à deux quiz par
 * soirée, le Triplé est impossible, et le Grand Chelem tombe à trois joueurs
 * sur cent quand les quiz de douze questions le donnent à un sur deux. La
 * moyenne sur les quarante soirées, et non la part au bout de vingt : L'Habitué
 * · Or, que tout le monde a à sa vingt-cinquième, y passait pour introuvable.
 *
 * L'expérience qu'un haut fait rapporte le disait mal — L'Oracle paie 50, et
 * trois joueurs sur quatre l'ont —, et la rareté de l'étagère (`rareteDe`)
 * se tait sous dix profils : c'est là que la carte montrait six fois
 * L'Éclair.
 *
 * Quatre ne se simulent pas : les Éclats se calculent (une chance sur
 * quarante par soirée) ; La Girouette, Le Globe-trotteur et Le
 * Collectionneur tiennent à une habitude que la bande n'a pas — changer
 * d'avis, d'hôte, d'avatar — et sont estimés.
 */
export const PART_DES_JOUEURS: Readonly<Record<string, number>> = {
  // Les éclats — 2 × 50 · 2 × 30 · 3 × 12, en pour cent.
  'hf:grand-chelem': 0.196, // 3,1 · 7,9 · 48,0
  'hf:foudre': 0.792, // 86,2 · 82,4 · 69,0
  'hf:phenix': 0.214, // 3,4 · 12,8 · 48,0
  'hf:seul-contre-tous': 0.662, // 58,2 · 67,5 · 73,0
  'hf:oracle': 0.779, // 91,8 · 79,9 · 62,2
  'hf:double': 0.216, // 13,5 · 17,6 · 33,6
  'hf:triple': 0.043, // 0 · 0 · 12,9
  'hf:roi': 0.301, // 20,0 · 29,4 · 41,0
  'hf:increvable': 0.674, // 74,6 · 68,0 · 59,7
  'hf:buzzer-or': 0.005, // 1,0 · 0,2 · 0,2
  'hf:flair': 0.927, // 99,2 · 97,1 · 81,8
  // Les ombres.
  'hf:lanterne-rouge': 0.296, // 18,1 · 26,0 · 44,6
  'hf:ascenseur': 0.047, // 0,3 · 1,8 · 12,0
  'hf:kamikaze': 0.054, // 9,9 · 5,1 · 1,1
  'hf:girouette': 0.05, // estimée : la bande ne change jamais d'avis
  'hf:cosmique': 0.749, // 83,5 · 77,1 · 64,1
  'hf:presque': 0.189, // 7,3 · 13,3 · 36,2
  'hf:somnambule': 0.803, // 81,3 · 77,5 · 82,1
  'hf:zero-pointe': 0.001, // 0 · 0 · 0,3
  'hf:contre-courant': 0.915, // 93,8 · 92,0 · 88,7
  // Les paliers de carrière : bronze, argent, or.
  'hf:habitue:1': 0.95,
  'hf:habitue:2': 0.775,
  'hf:habitue:3': 0.4, // tous, mais à la vingt-cinquième soirée
  'hf:bavard:1': 0.964,
  'hf:bavard:2': 0.767,
  'hf:bavard:3': 0.206, // 48,8 · 12,9 · 0
  'hf:encyclopedie:1': 0.965,
  'hf:encyclopedie:2': 0.726,
  'hf:encyclopedie:3': 0.229, // 49,4 · 18,8 · 0,3
  'hf:reflexe:1': 0.941,
  'hf:reflexe:2': 0.675,
  'hf:reflexe:3': 0.205, // 36,4 · 19,2 · 5,9
  'hf:devin:1': 0.871,
  'hf:devin:2': 0.587,
  'hf:devin:3': 0.248, // 44,6 · 22,5 · 7,3
  'hf:globe-trotteur:1': 0.3, // estimées : la bande joue toujours chez le même hôte
  'hf:globe-trotteur:2': 0.05,
  'hf:globe-trotteur:3': 0.005,
  'hf:podium:1': 0.612,
  'hf:podium:2': 0.341,
  'hf:podium:3': 0.089, // 5,4 · 5,6 · 15,6
  'hf:collection:1': 0.25, // estimées : la bande garde son emoji
  'hf:collection:2': 0.05,
  'hf:collection:3': 0.005,
  'hf:eclats:1': 0.379, // calculées : une chance sur quarante par soirée
  'hf:eclats:2': 0.023,
  'hf:eclats:3': 0.0001,
  'hf:legende:1': 0.53, // 70,9 · 54,1 · 34,0
  'hf:legende:2': 0.009, // 2,6 · 0,1 · 0
  'hf:legende:3': 0, // personne en quarante soirées
}

/**
 * Ses plus beaux hauts faits : les exploits et les paliers de carrière, les
 * plus rares d'abord (`PART_DES_JOUEURS`), un seul palier par haut fait — le
 * plus haut. Les coups du sort n'y sont pas : la carte se montre à la salle,
 * et un Zéro Pointé n'est pas ce qu'on y met en avant — ils restent sur
 * l'étagère de leur porteur, qui en rit le premier. Les prix du palmarès non
 * plus : ils tombent à chaque soirée, c'est leur nombre qui se montre. À
 * rareté égale, le mieux payé, puis le plus souvent décroché, puis le plus
 * récent.
 */
export function plusBeaux<T extends { key: string; fois: number; dernier: number }>(recompenses: readonly T[], n: number): T[] {
  const plusHaut = new Map<string, number>()
  for (const r of recompenses) {
    const p = palierDe(r.key)
    if (p) plusHaut.set(p.hautFait.key, Math.max(plusHaut.get(p.hautFait.key) ?? 0, p.palier))
  }
  const retenus = recompenses.filter(r => {
    const p = palierDe(r.key)
    if (p) return plusHaut.get(p.hautFait.key) === p.palier
    return hautFaitDeSoiree(r.key)?.ton === 'eclat'
  })
  const part = (r: T) => PART_DES_JOUEURS[r.key] ?? 1
  return retenus
    .sort((a, b) => part(a) - part(b) || xpDe(b.key) - xpDe(a.key) || b.fois - a.fois || b.dernier - a.dernier)
    .slice(0, n)
}
