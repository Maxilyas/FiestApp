// Les métaux des finitions et des ligues, une seule palette : la bordure de
// ligue s'y frappe (`dessinDesBordures.ts`), le sceau des légendaires aussi
// (`Sceau.tsx`) — l'un et l'autre prennent le métal de la finition portée,
// et appartiennent à la tenue. Un module sans React ni page, que Node lit
// aussi (les planches, les tests).
import type { Finition } from '../../../shared/profil'

/** Un métal : son dégradé, du sombre au clair et retour, son filet, sa lueur. */
export interface Metal {
  m: readonly [string, string, string, string, string]
  bord: string
  lueur: string
  /** Constellation : des étoiles d'or semées sur le métal de toutes les ligues. */
  etoiles?: boolean
}

/** Les métaux des finitions — Mat, c'est celui de la ligue —, et ceux des ligues. */
export const METAUX: Record<'bronze' | 'argent' | 'or' | 'platine' | 'diamant' | Exclude<Finition, 'mat' | 'argent' | 'or'>, Metal> = {
  bronze: { m: ['#4f2d14', '#d29660', '#86501f', '#f1c08c', '#5e3718'], bord: '#26150a', lueur: '#e9a86b' },
  argent: { m: ['#7c858f', '#f4f6f9', '#a3acb6', '#ffffff', '#858e98'], bord: '#2c3138', lueur: '#e8eef6' },
  or: { m: ['#7d5416', '#f6dd94', '#b8892f', '#fff0bf', '#8f6219'], bord: '#3a2508', lueur: '#f6cf73' },
  platine: { m: ['#7d8c9c', '#f2f6fa', '#b3c1cf', '#ffffff', '#8b9bab'], bord: '#36414c', lueur: '#eef6ff' },
  diamant: { m: ['#8fb6db', '#f2faff', '#b9daf3', '#ffffff', '#9dc0e2'], bord: '#3b5a78', lueur: '#dff1ff' },
  // Les couleurs des pastilles de la loge (`.teinte-*`), en métal.
  holo: { m: ['#f7b8e8', '#9fe3ff', '#fff1a6', '#b9f5c6', '#f7b8e8'], bord: '#5b4a70', lueur: '#f7c8ef' },
  prisme: { m: ['#ff8fa3', '#ffd166', '#7aa8ff', '#3ff0d0', '#ff8fa3'], bord: '#3d2f5a', lueur: '#ffffff' },
  aurore: { m: ['#58e6b4', '#5aaaff', '#be78ff', '#58e6b4', '#5aaaff'], bord: '#16313f', lueur: '#8ff5d6' },
  constellation: { m: ['#1b2357', '#3a4ca8', '#141a45', '#5468cc', '#1b2357'], bord: '#e2c27a', lueur: '#a9b8ff', etoiles: true },
  // Les cinq du 1er novembre 2026, chacune dans la matière de sa lumière : l'eau qui luit, le ciel d'orage, la nacre
  // des plumes, le miroir de la boule, la nuit cerclée de feu.
  abysses: { m: ['#062a3d', '#1fb6c9', '#0b4f6c', '#7ff6ff', '#062a3d'], bord: '#031822', lueur: '#7ff6ff' },
  orage: { m: ['#16235e', '#9fd8ff', '#2a4fb8', '#e9f7ff', '#16235e'], bord: '#0b1236', lueur: '#bfe6ff' },
  envol: { m: ['#b28a3e', '#fffdf5', '#f3e2b0', '#ffffff', '#c79d4a'], bord: '#6b5320', lueur: '#fff3cf' },
  disco: { m: ['#4a4f63', '#f4f6fb', '#9aa3b5', '#ffffff', '#4a4f63'], bord: '#17161d', lueur: '#ff8fd0' },
  singularite: { m: ['#050308', '#ff9a3c', '#1a0c08', '#fff3d6', '#050308'], bord: '#ff7a1f', lueur: '#ffb86b' },
}

/** Le métal d'une finition ; en Mat, l'or : le cercle d'un médaillon mat est d'or. */
export function metalDeLaFinition(finition: Finition): Metal {
  return finition === 'mat' ? METAUX.or : METAUX[finition]
}
