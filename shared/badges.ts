// L'étagère d'un profil : ce qu'on décroche en jouant, et ce que ça vaut.
//
// Trois sortes de récompenses s'y rangent, et elles ne se gagnent pas de la
// même façon.
//
// · Les **prix du palmarès** sont ceux que l'application calcule déjà en fin
//   de soirée (`server/src/core/stats.ts`) : L'Éclair, Le Cancre Magnifique,
//   Le Franc-Tireur… Leur catalogue vit avec le calcul qui les attribue.
// · Les **hauts faits de soirée** (`shared/hautsfaits.ts`) : un exploit ou
//   une malchance assumée, lus sur les journaux à la clôture. Ils se
//   regagnent d'une soirée à l'autre.
// · Les **paliers de carrière**, dans le même catalogue : une habitude
//   récompensée en trois temps — Bronze, Argent, Or —, qui ne tombe qu'une
//   fois.
//
// Chaque récompense rangée garde une copie de son emoji et de son titre : une
// étagère se relit des années plus tard. Un prix du palmarès s'y montre sous
// son nom du jour, le reste sous le titre de sa ligne la plus récente. Ce
// fichier-ci ne garde que ce qu'elles ont en commun : leur rareté, et la
// forme sous laquelle une étagère les montre.
//
// Comme le reste du profil, une récompense ne donne AUCUN avantage de jeu.
// Elle dit d'où l'on vient, pas ce qu'on vaut ce soir.

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
