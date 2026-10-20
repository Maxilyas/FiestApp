// La scène de son jardin, autour de sa niche (la maquette validée par le
// propriétaire le 20 octobre 2026, `retours/2026-10-20/mon-compagnon/`) : où
// chaque place se tient, dans le repère de la cour — 358 sur 280, la niche
// au milieu —, le jardin qui s'étend à droite, le domaine à gauche. Les
// règles des places — leur sorte, le terrain qui les ouvre — vivent dans
// `shared/trouvailles.ts` ; ici, seulement où elles se dessinent. Tout se
// multiplie par l'échelle de la scène (`k`) : la colonne du téléphone fait
// 320 pixels en 360, 350 en 390.

import type { SorteDeTrouvaille } from '../../../shared/trouvailles'

/** La cour, dans son repère : la largeur de la maquette, la niche au milieu. */
export const COUR = 358

/** Ce que le jardin ajoute à droite de la cour, puis le domaine à gauche. */
export const ETENDUE = 210

/** La niche dans la cour : sa largeur, son coin haut-gauche, son milieu. */
export const NICHE = { l: 112, gauche: 123, haut: 46, milieu: 179 }

/** Où chaque place se pose : son milieu et son sol, dans le repère de la cour (le domaine est à sa gauche, sous zéro). */
export const POSITIONS: Readonly<Record<string, { cx: number; base: number }>> = {
  s1: { cx: 40, base: 186 },
  s2: { cx: 90, base: 200 },
  s3: { cx: 268, base: 200 },
  s4: { cx: 318, base: 186 },
  s5: { cx: 304, base: 96 },
  s6: { cx: 430, base: 186 },
  s7: { cx: 508, base: 200 },
  s8: { cx: -60, base: 186 },
  s9: { cx: -146, base: 200 },
  s10: { cx: -104, base: 92 },
}

/** La taille d'une trouvaille à sa place, en carrés de 64 : un grand objet se voit de loin, ce qui vole reste léger. */
export const ECHELLE: Readonly<Record<SorteDeTrouvaille, number>> = { haut: 1.5, bas: 1.05, ciel: 1.1 }

/** Qui passe devant qui : le sol devant les grands objets, le ciel derrière tout. */
export const PLAN: Readonly<Record<SorteDeTrouvaille, number>> = { haut: 2, bas: 5, ciel: 1 }

/** Où la cour commence dans le terrain dessiné : le domaine, ouvert, la pousse à droite. */
export function decalage(niveau: number): number {
  return niveau >= 3 ? ETENDUE : 0
}

/** La largeur du terrain dessiné : la cour, le jardin à droite, le domaine à gauche. */
export function largeurDuTerrain(niveau: number): number {
  return COUR + (niveau >= 2 ? ETENDUE : 0) + (niveau >= 3 ? ETENDUE : 0)
}

/** Une place est-elle dans la cour — visible sans défiler, la scène centrée sur la niche ? */
export function dansLaCour(place: string): boolean {
  const p = POSITIONS[place]
  return !!p && p.cx - 17 >= 0 && p.cx + 17 <= COUR
}

/** Les touffes d'herbe, en quinconce, en laissant la niche dégagée. */
export function herbes(largeur: number, petit: boolean, off: number): { x: number; y: number }[] {
  const h: { x: number; y: number }[] = []
  const debut = petit ? off + 70 : 14
  const fin = petit ? off + 290 : largeur - 14
  let i = 0
  for (let x = debut; x < fin; x += 44) {
    if (Math.abs(x - (NICHE.milieu + off)) > 50) h.push({ x, y: 206 + (i % 2) * 12 })
    i++
  }
  return h
}
