// Les badges d'un profil : ce qu'on décroche en jouant, et ce que ça vaut.
//
// Deux familles, et elles ne se gagnent pas de la même façon.
//
// · Les **badges de soirée** sont les prix que l'application calcule déjà en
//   fin de fête (`server/src/core/stats.ts`) : L'Éclair, Le Cancre
//   Magnifique, Le Franc-Tireur… Ils se décrochent en une soirée, sur un coup
//   d'éclat ou un coup de malchance, et se regagnent d'une fois sur l'autre.
//   Leur catalogue n'est pas ici : il vit avec le calcul qui les attribue, et
//   chaque badge décroché garde une copie de son emoji et de son titre — une
//   étagère se relit des années plus tard, même si un prix a changé de nom.
//
// · Les **badges de carrière** sont ici. Ils ne récompensent pas une soirée
//   mais une habitude : être revenu, avoir répondu longtemps, avoir gagné
//   souvent. Ils ne se perdent jamais et ne se gagnent qu'une fois.
//
// Comme le reste du profil, un badge ne donne AUCUN avantage de jeu. Il dit
// d'où l'on vient, pas ce qu'on vaut ce soir.

/** Ce qu'un profil a accumulé sur toutes ses soirées. */
export interface Carriere {
  soirees: number
  reponses: number
  justes: number
  /** Soirées finies sur le podium. */
  podiums: number
  /** Quiz remportés, toutes soirées confondues. */
  quiz: number
  eclats: number
  niveau: number
}

export interface BadgeCarriere {
  key: string
  emoji: string
  title: string
  /** La règle, telle qu'on l'annonce. */
  rule: string
  atteint: (c: Carriere) => boolean
}

/**
 * Les paliers. Ils sont volontairement espacés : un badge qui tombe à chaque
 * soirée ne se remarque plus, et une étagère pleine dès le premier soir n'a
 * rien à raconter.
 */
export const BADGES_CARRIERE: BadgeCarriere[] = [
  {
    key: 'carriere:premiere',
    emoji: '🌱',
    title: 'La Première Fois',
    rule: 'Avoir joué une soirée entière',
    atteint: c => c.soirees >= 1,
  },
  {
    key: 'carriere:fidele',
    emoji: '🎟️',
    title: 'Le Fidèle',
    rule: 'Cinq soirées',
    atteint: c => c.soirees >= 5,
  },
  {
    key: 'carriere:pilier',
    emoji: '🏛️',
    title: 'Le Pilier',
    rule: 'Vingt soirées',
    atteint: c => c.soirees >= 20,
  },
  {
    key: 'carriere:bavard',
    emoji: '💬',
    title: 'Le Bavard',
    rule: 'Cinq cents réponses envoyées',
    atteint: c => c.reponses >= 500,
  },
  {
    key: 'carriere:encyclopedie',
    emoji: '📚',
    title: 'L’Encyclopédie',
    rule: 'Trois cents bonnes réponses',
    atteint: c => c.justes >= 300,
  },
  {
    key: 'carriere:podium',
    emoji: '🥉',
    title: 'L’Habitué du Podium',
    rule: 'Trois soirées finies sur le podium',
    atteint: c => c.podiums >= 3,
  },
  {
    key: 'carriere:serial',
    emoji: '🏆',
    title: 'Le Sérial Vainqueur',
    rule: 'Dix quiz remportés',
    atteint: c => c.quiz >= 10,
  },
  {
    key: 'carriere:etincelle',
    emoji: '✨',
    title: 'L’Étincelle',
    rule: 'Un premier avatar éclaté — une chance sur quarante par soirée',
    atteint: c => c.eclats >= 1,
  },
  {
    key: 'carriere:collection',
    emoji: '💎',
    title: 'La Collection',
    rule: 'Trois avatars éclatés',
    atteint: c => c.eclats >= 3,
  },
  {
    key: 'carriere:veteran',
    emoji: '🎖️',
    title: 'Le Vétéran',
    rule: 'Atteindre le niveau 10',
    atteint: c => c.niveau >= 10,
  },
  {
    key: 'carriere:legende',
    emoji: '👑',
    title: 'La Légende',
    rule: 'Atteindre le niveau 20',
    atteint: c => c.niveau >= 20,
  },
]

// ── Rareté ────────────────────────────────────────────────────────────────

export type Rarete = 'commune' | 'peucommune' | 'rare' | 'epique' | 'legendaire'

export const NOM_RARETE: Record<Rarete, string> = {
  commune: 'Commune',
  peucommune: 'Peu commune',
  rare: 'Rare',
  epique: 'Épique',
  legendaire: 'Légendaire',
}

/**
 * En deçà de ce nombre de profils, on ne dit rien de la rareté.
 *
 * À cinq inscrits, « légendaire » ne voudrait dire que « une seule personne
 * l'a », ce qui est vrai de presque tout. Mieux vaut annoncer le nombre de
 * porteurs et se taire sur le reste que de décerner des titres au hasard.
 */
export const PROFILS_POUR_RARETE = 10

/**
 * La rareté d'un badge, calculée et non décrétée : la part des profils qui le
 * portent. Elle bouge donc avec la population — un badge que tout le monde
 * finit par décrocher redevient commun, et c'est honnête.
 */
export function rareteDe(porteurs: number, profils: number): Rarete | null {
  if (profils < PROFILS_POUR_RARETE || porteurs <= 0) return null
  const part = porteurs / profils
  if (part >= 0.5) return 'commune'
  if (part >= 0.25) return 'peucommune'
  if (part >= 0.1) return 'rare'
  if (part >= 0.03) return 'epique'
  return 'legendaire'
}

/** Un badge tel qu'une étagère le montre. */
export interface BadgePorte {
  key: string
  emoji: string
  title: string
  /** Combien de fois décroché — un prix de soirée se regagne. */
  fois: number
  /** Quand il est tombé la dernière fois. */
  dernier: number
  /** Combien de profils le portent, et ce que ça en dit (null si trop peu de monde). */
  porteurs: number
  rarete: Rarete | null
}
