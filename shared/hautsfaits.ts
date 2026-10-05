// Les hauts faits : ce qu'on décroche en jouant — les coups d'éclat, et les
// coups de malchance.
//
// Deux familles, qui ne se gagnent pas pareil.
//
// · Les hauts faits **de soirée** se jugent sur une soirée entière, à sa
//   clôture : un sans-faute, une remontée, une série noire. Ils se regagnent
//   d'une soirée à l'autre, et l'étagère compte les fois (« ×3 »). Le quiz du
//   jour et la campagne ont les leurs, de la même famille — ils se regagnent
//   aussi, un jour ou une série au plus chacun (`origine`).
// · Les hauts faits **de carrière** additionnent toutes les soirées : trois
//   paliers — bronze, argent, or —, qui ne tombent qu'une fois chacun. Ceux
//   du quiz du jour et de la campagne comptent ce qu'on y fait (`duJour`,
//   `deCampagne`).
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

import type { Carriere, StatsDeCampagne, StatsDuJour } from './profil'
import type { Rarete } from './badges'
import { formatNumber } from './typographie'

export type Ton = 'eclat' | 'ombre'

/** Où se gagne un haut fait qui se regagne, s'il ne se gagne pas en soirée. */
export type Origine = 'jour' | 'campagne'

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
  /**
   * Il se gagne au quiz du jour ou en campagne, pas en soirée : la clôture
   * d'une soirée ne le juge jamais (`core/hautsfaits.ts` ne connaît que
   * `HAUTS_FAITS_DE_SOIREE`), et aucune soirée retirée ne le reprend.
   */
  origine?: Origine
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
  /**
   * Tiré du quiz du jour, et de ce qu'il compte : il tombe à la fin d'une
   * partie ou à la nuit qui clôt un jour (`accorderPaliersDuJour`), jamais à
   * la clôture d'une soirée, qui ne sait rien du quiz du jour.
   */
  duJour?: keyof StatsDuJour
  /**
   * Tiré de la campagne, et de ce qu'elle compte : il tombe à la fin d'une
   * série ou d'une épreuve (`accorderPaliersDeCampagne`), jamais à la
   * clôture d'une soirée.
   */
  deCampagne?: keyof StatsDeCampagne
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

/**
 * La salle du quiz du jour où se juge ce qui se mesure aux autres — être
 * seul à trouver, dernier, dans le premier quart : huit joueurs ce jour-là.
 * À trois, « seul à trouver » ne disait rien, et la lanterne allait à qui
 * jouait contre deux champions.
 */
export const SALLE_DU_JOUR = 8

/**
 * Les hauts faits du quiz du jour : ils se regagnent, un jour au plus chacun
 * — l'étagère compte les jours —, et se rangent sous le jour qui les a fait
 * tomber (`#jour:2026-10-05`) : aucune soirée ne les porte. Ceux qui se
 * mesurent aux autres tombent à la nuit qui clôt le jour, quand tout le monde
 * a joué ; les autres à la fin de la partie.
 *
 * Ils ne rapportent pas d'expérience : le quiz du jour a la sienne, bornée
 * (75 par partie, l'option B du 26 septembre 2026), et ses paliers. Ils
 * ouvrent un titre, comme tout haut fait, et des légendaires — souvent la
 * seconde voie d'un légendaire de soirée qui raconte la même histoire
 * (`shared/legendaires.ts`).
 */
export const HAUTS_FAITS_DU_JOUR: HautFaitDeSoiree[] = [
  // ── Les éclats ──
  {
    key: 'hf:laurier',
    famille: 'soiree',
    origine: 'jour',
    emoji: '🌿',
    title: 'Le Laurier',
    rule: 'Gagner le quiz du jour',
    ton: 'eclat',
    xp: 0,
  },
  {
    key: 'hf:triomphe',
    famille: 'soiree',
    origine: 'jour',
    emoji: '🏛️',
    title: 'Le Triomphe',
    rule: 'Gagner le quiz du jour trois jours d’affilée',
    ton: 'eclat',
    xp: 0,
  },
  {
    key: 'hf:phenix-du-jour',
    famille: 'soiree',
    origine: 'jour',
    emoji: '🌅',
    title: 'Le Phénix du jour',
    rule: 'Gagner le quiz du jour au lendemain d’un jour fini dans la moitié basse',
    ton: 'eclat',
    xp: 0,
  },
  {
    key: 'hf:seul-au-monde',
    famille: 'soiree',
    origine: 'jour',
    emoji: '🏝️',
    title: 'Seul au monde',
    rule: 'Seul de tous les joueurs du jour à trouver une question',
    ton: 'eclat',
    xp: 0,
  },
  {
    key: 'hf:eclair-du-jour',
    famille: 'soiree',
    origine: 'jour',
    emoji: '🌩️',
    title: 'L’Éclair du jour',
    rule: 'La bonne réponse la plus rapide du jour, sur trois questions de sa partie',
    ton: 'eclat',
    xp: 0,
  },
  {
    key: 'hf:leve-tot',
    famille: 'soiree',
    origine: 'jour',
    emoji: '🐓',
    title: 'Le Lève-tôt',
    rule: 'Finir sa partie du jour avant huit heures',
    ton: 'eclat',
    xp: 0,
  },
  {
    key: 'hf:mois-complet',
    famille: 'soiree',
    origine: 'jour',
    emoji: '🗓️',
    title: 'Le Mois complet',
    rule: 'Jouer chaque quiz du jour d’un mois, sans en manquer un',
    ton: 'eclat',
    xp: 0,
  },
  // ── Les ombres ──
  {
    key: 'hf:lanterne-du-jour',
    famille: 'soiree',
    origine: 'jour',
    emoji: '🕯️',
    title: 'La Lanterne du jour',
    rule: 'Dernier du quiz du jour, en ayant répondu à tout',
    ton: 'ombre',
    xp: 0,
  },
  {
    key: 'hf:dernier-metro',
    famille: 'soiree',
    origine: 'jour',
    emoji: '🚇',
    title: 'Le Dernier Métro',
    rule: 'Commencer sa partie du jour dans la dernière demi-heure avant minuit',
    ton: 'ombre',
    xp: 0,
  },
  {
    key: 'hf:courant-d-air',
    famille: 'soiree',
    origine: 'jour',
    emoji: '💨',
    title: 'Le Courant d’air',
    rule: 'Commencer sa partie du jour, et la laisser avant sa dernière question',
    ton: 'ombre',
    xp: 0,
  },
]

/**
 * Les hauts faits de la campagne, la série à trois vies : ils se regagnent,
 * une série au plus chacun, et se rangent sous la série qui les a fait
 * tomber (`#campagne:<série>`). Sans expérience non plus : chaque bonne
 * réponse de campagne paie déjà la sienne, sans plafond.
 */
export const HAUTS_FAITS_DE_CAMPAGNE: HautFaitDeSoiree[] = [
  {
    key: 'hf:funambule',
    famille: 'soiree',
    origine: 'campagne',
    emoji: '🎪',
    title: 'Le Funambule',
    rule: 'Neuf bonnes réponses d’affilée sur sa dernière vie, dans une série',
    ton: 'eclat',
    xp: 0,
  },
  {
    key: 'hf:intact',
    famille: 'soiree',
    origine: 'campagne',
    emoji: '💠',
    title: 'Sans une égratignure',
    rule: 'Atteindre les questions expertes d’une série sans perdre une vie',
    ton: 'eclat',
    xp: 0,
  },
  {
    key: 'hf:grande-serie',
    famille: 'soiree',
    origine: 'campagne',
    emoji: '🏔️',
    title: 'La Grande Série',
    rule: 'Trente bonnes réponses dans une série de toutes les catégories',
    ton: 'eclat',
    xp: 0,
  },
  {
    key: 'hf:tour-du-monde',
    famille: 'soiree',
    origine: 'campagne',
    emoji: '🌍',
    title: 'Le Tour du monde',
    rule: 'Dix bonnes réponses dans une série de chacune des douze catégories',
    ton: 'eclat',
    xp: 0,
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
  // Le quiz du jour a les siens : l'assiduité d'abord — le podium ira
  // toujours aux deux ou trois mêmes —, puis la victoire et le sans-faute.
  {
    key: 'hf:assidu',
    famille: 'carriere',
    emoji: '📆',
    title: 'L’Assidu',
    mesure: 'jours de quiz du jour',
    mesureUne: 'jour de quiz du jour',
    paliers: [7, 30, 100],
    valeur: c => c.jour.joues,
    duJour: 'joues',
  },
  {
    key: 'hf:champion-du-jour',
    famille: 'carriere',
    emoji: '🌞',
    title: 'Le Champion du jour',
    mesure: 'victoires au quiz du jour',
    mesureUne: 'victoire au quiz du jour',
    paliers: [1, 5, 20],
    valeur: c => c.jour.victoires,
    duJour: 'victoires',
  },
  {
    key: 'hf:sans-faute',
    famille: 'carriere',
    emoji: '💯',
    title: 'Le Sans-Faute',
    mesure: 'quiz du jour sans une faute',
    mesureUne: 'quiz du jour sans une faute',
    paliers: [1, 3, 10],
    valeur: c => c.jour.sansFautes,
    duJour: 'sansFautes',
  },
  // Pour qui joue bien sans gagner : le podium du jour ira toujours aux
  // deux ou trois mêmes, le premier quart s'atteint à vingt.
  {
    key: 'hf:elite',
    famille: 'carriere',
    emoji: '🏹',
    title: 'L’Élite',
    mesure: 'jours dans le premier quart du quiz du jour',
    mesureUne: 'jour dans le premier quart du quiz du jour',
    paliers: [10, 50, 150],
    valeur: c => c.jour.elite,
    duJour: 'elite',
  },
  // La série, qui ne faisait que s'afficher : la plus longue, soirées
  // comprises — la fête ne casse jamais une série —, sabliers compris.
  {
    key: 'hf:infatigable',
    famille: 'carriere',
    emoji: '🏃',
    title: 'L’Infatigable',
    mesure: 'jours d’affilée',
    mesureUne: 'jour d’affilée',
    paliers: [7, 30, 100],
    valeur: c => c.jour.serieRecord,
    duJour: 'serieRecord',
  },
  // La campagne, la série à trois vies : son record, ses expertes, ses
  // bonnes réponses — épreuves des sentiers comprises pour les deux derniers.
  {
    key: 'hf:alpiniste',
    famille: 'carriere',
    emoji: '🧗',
    title: 'L’Alpiniste',
    mesure: 'bonnes réponses dans une série de campagne',
    mesureUne: 'bonne réponse dans une série de campagne',
    paliers: [10, 15, 20],
    valeur: c => c.campagne.record,
    deCampagne: 'record',
  },
  {
    key: 'hf:erudit',
    famille: 'carriere',
    emoji: '🎓',
    title: 'L’Érudit',
    mesure: 'questions expertes trouvées en campagne',
    mesureUne: 'question experte trouvée en campagne',
    paliers: [25, 100, 300],
    valeur: c => c.campagne.expertes,
    deCampagne: 'expertes',
  },
  {
    key: 'hf:marathonien',
    famille: 'carriere',
    emoji: '👟',
    title: 'Le Marathonien',
    mesure: 'bonnes réponses en campagne',
    mesureUne: 'bonne réponse en campagne',
    paliers: [250, 1000, 2000],
    valeur: c => c.campagne.justes,
    deCampagne: 'justes',
  },
]

/** Tous ceux qui se regagnent : de soirée, du quiz du jour, de la campagne. */
export const HAUTS_FAITS_REGAGNABLES: readonly HautFaitDeSoiree[] = [...HAUTS_FAITS_DE_SOIREE, ...HAUTS_FAITS_DU_JOUR, ...HAUTS_FAITS_DE_CAMPAGNE]

const PAR_CLE = new Map<string, HautFait>([...HAUTS_FAITS_REGAGNABLES, ...HAUTS_FAITS_DE_CARRIERE].map(h => [h.key, h]))

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

/**
 * Sous le titre d'un haut fait rangé, ce qu'il a fallu faire : sa règle, ou
 * pour un palier le seuil franchi. Un titre seul (« Le Buzzer d'Or ») ne dit
 * rien à qui ne l'a jamais chassé.
 */
export function ceQuIlAFallu(cle: string): string {
  const h = hautFaitDeSoiree(cle)
  if (h) return h.rule
  const p = palierDe(cle)
  return p ? regleDuPalier(p.hautFait, p.palier) : ''
}

/** Trois hauts faits au plus sur une carte : la sienne, qu'il les choisisse ou non. */
export const VITRINE_MAX = 3

/**
 * Les hauts faits qu'il a gagnés : chaque haut fait de soirée décroché —
 * exploit ou coup du sort —, chaque haut fait de carrière à l'un de ses
 * paliers. Chacun ouvre un titre, son nom (« L'Oracle », « Le Bavard »), et
 * peut monter dans la vitrine de sa carte.
 *
 * N'importe quel palier, pas seulement le bronze : la soirée qui l'avait
 * fait tomber, retirée, emporte le bronze et laisse l'argent — le titre et la
 * vitrine tombaient avec lui, et le serveur refusait ce que la page proposait
 * (`cleRangee`, elle, lisait déjà l'argent).
 */
export function hautsFaitsGagnes(recompenses: ReadonlyMap<string, number>): string[] {
  return [
    ...HAUTS_FAITS_REGAGNABLES.filter(h => (recompenses.get(h.key) ?? 0) > 0).map(h => h.key),
    ...HAUTS_FAITS_DE_CARRIERE.filter(h => cleRangee(h.key, recompenses) !== null).map(h => h.key),
  ]
}

/**
 * La clé rangée qui représente un haut fait sur une étagère : la sienne pour
 * un haut fait de soirée, son plus haut palier atteint pour un haut fait de
 * carrière — L'Habitué choisi à l'argent se montre en or le jour où il y
 * monte. Null s'il n'est pas (ou plus) gagné.
 */
export function cleRangee(cle: string, recompenses: ReadonlyMap<string, number>): string | null {
  const h = hautFait(cle)
  if (!h) return null
  if (h.famille === 'soiree') return (recompenses.get(cle) ?? 0) > 0 ? cle : null
  const plusHaut = [3, 2, 1].find(p => (recompenses.get(clePalier(cle, p)) ?? 0) > 0)
  return plusHaut ? clePalier(cle, plusHaut) : null
}

/**
 * Les paliers de soirée qu'une carrière atteint, clés rangées comprises
 * (`hf:bavard:1`, `hf:bavard:2`…) — ceux du quiz du jour et de la campagne
 * à part : ils ont leur moment (`paliersDuJourAtteints`,
 * `paliersDeCampagneAtteints`).
 */
export function paliersAtteints(c: Carriere): string[] {
  return HAUTS_FAITS_DE_CARRIERE.flatMap(h => {
    if (h.duJour || h.deCampagne) return []
    const v = h.valeur(c)
    return h.paliers.flatMap((seuil, i) => (v >= seuil ? [clePalier(h.key, i + 1)] : []))
  })
}

/** Les paliers du quiz du jour que ce qu'il compte fait atteindre. */
export function paliersDuJourAtteints(stats: StatsDuJour): string[] {
  return HAUTS_FAITS_DE_CARRIERE.flatMap(h => {
    if (!h.duJour) return []
    const v = stats[h.duJour]
    return h.paliers.flatMap((seuil, i) => (v >= seuil ? [clePalier(h.key, i + 1)] : []))
  })
}

/** Les paliers de la campagne que ce qu'elle compte fait atteindre. */
export function paliersDeCampagneAtteints(stats: StatsDeCampagne): string[] {
  return HAUTS_FAITS_DE_CARRIERE.flatMap(h => {
    if (!h.deCampagne) return []
    const v = stats[h.deCampagne]
    return h.paliers.flatMap((seuil, i) => (v >= seuil ? [clePalier(h.key, i + 1)] : []))
  })
}

/**
 * Les paliers de La Légende qu'un niveau fait atteindre. Elle se juge aussi
 * au quiz du jour, qui compte dans le niveau : qui n'y jouait que passait le
 * niveau 10 sans son palier, sa page montrait la jauge pleine, et sa première
 * soirée le lui annonçait — l'arbitrage du 27 septembre 2026. Le niveau se lit
 * par `niveauDuProfil` (invariant 22) ; ce qui tombe se range sous le jour.
 */
export function paliersDuNiveau(niveau: number): string[] {
  const legende = HAUTS_FAITS_DE_CARRIERE.find(h => h.key === 'hf:legende')!
  return legende.paliers.flatMap((seuil, i) => (niveau >= seuil ? [clePalier(legende.key, i + 1)] : []))
}

/**
 * Un haut fait tel qu'une page le montre : gagné ou non, avec sa progression.
 * La page profil montre tout le catalogue — savoir ce qui vient donne envie
 * de revenir.
 */
export interface HautFaitVu {
  key: string
  famille: 'soiree' | 'carriere'
  /** Il se gagne au quiz du jour ou en campagne (`origine`, ou un palier `duJour` / `deCampagne`) : la page le range à part. */
  origine?: Origine
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
 * d'avis, d'hôte, d'avatar — et sont estimés. Les trois du quiz du jour
 * aussi : la bande ne joue qu'en soirée.
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
  // Ceux du quiz du jour, estimés : la bande ne joue qu'en soirée. Un joueur
  // sur trois s'y tient une semaine, un sur dix un mois ; le podium du jour
  // et le sans-faute vont à peu.
  'hf:assidu:1': 0.35,
  'hf:assidu:2': 0.12,
  'hf:assidu:3': 0.03,
  'hf:champion-du-jour:1': 0.12,
  'hf:champion-du-jour:2': 0.03,
  'hf:champion-du-jour:3': 0.005,
  'hf:sans-faute:1': 0.2,
  'hf:sans-faute:2': 0.06,
  'hf:sans-faute:3': 0.01,
  // Ceux d'octobre 2026, estimés pour une vingtaine de joueurs par jour —
  // la production en comptait autant — et la campagne qu'ils jouent.
  'hf:laurier': 0.12, // comme Le Champion du jour · Bronze, qu'il double
  'hf:triomphe': 0.01,
  'hf:phenix-du-jour': 0.03,
  'hf:seul-au-monde': 0.15,
  'hf:eclair-du-jour': 0.1,
  'hf:leve-tot': 0.15,
  'hf:mois-complet': 0.05,
  'hf:lanterne-du-jour': 0.1,
  'hf:dernier-metro': 0.2,
  'hf:courant-d-air': 0.3,
  'hf:funambule': 0.02,
  'hf:intact': 0.08,
  'hf:grande-serie': 0.005,
  'hf:tour-du-monde': 0.002,
  'hf:elite:1': 0.25,
  'hf:elite:2': 0.08,
  'hf:elite:3': 0.02,
  'hf:infatigable:1': 0.3,
  'hf:infatigable:2': 0.08,
  'hf:infatigable:3': 0.01,
  'hf:alpiniste:1': 0.4,
  'hf:alpiniste:2': 0.12,
  'hf:alpiniste:3': 0.02,
  'hf:erudit:1': 0.3,
  'hf:erudit:2': 0.1,
  'hf:erudit:3': 0.02,
  'hf:marathonien:1': 0.35,
  'hf:marathonien:2': 0.1,
  'hf:marathonien:3': 0.03,
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
