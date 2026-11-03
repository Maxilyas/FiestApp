// Ce que le tournage écrit (`plans.json`) et que le montage lit : un module à
// part, sans serveur ni navigateur, que le montage — et `vitrine.test.ts`, qui
// relit la borne de poids de la vidéo de la vitrine — importent sans charger le
// banc des tests.

/** Une boîte à l'écran, en pixels CSS de la page (pas de l'image, deux fois plus grande au téléphone). */
export interface Boite {
  x: number
  y: number
  l: number
  h: number
}

/** Une prise : sa photo, l'écran qu'elle montre, et le toucher qui mène à la suivante. */
export interface Prise {
  fichier: string
  /** La largeur et la hauteur de l'écran, en pixels CSS — la photo en a deux fois plus au téléphone. */
  largeur: number
  hauteur: number
  toucher?: Boite
  /** Ce que la prise montre, en mots, quand le montage le dit à l'écran : le nom d'un thème. */
  legende?: string
  /** La hauteur de la page entière, quand la photo la prend toute : le montage la fait défiler dans l'écran. */
  hauteurPleine?: number
}

export type Plans = Record<string, Prise>

/**
 * Les thèmes sous lesquels l'accueil de Léa se photographie, dans l'ordre du
 * montage : le Velours d'abord, celui qu'elle garde, puis des achetés et deux
 * peints, qui se gagnent (le Sommet, une série de vingt en campagne ; le Ciel,
 * trente jours d'affilée au quiz du jour). Le montage leur partage deux
 * secondes et demie : un de plus, et chacun passe plus vite.
 */
export const THEMES_FILMES = ['velours', 'cosmos', 'jungle', 'theatre', 'sommet', 'neon', 'ciel'] as const
