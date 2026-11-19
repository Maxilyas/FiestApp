// Le gabarit d'une marche du podium peinte (`decors.ts`, le groupe `podium`) :
// le croquis que reçoit le modèle, et la géométrie que la feuille de style
// relit pour poser l'avatar sur le dessus et le rang dans le médaillon
// (`styles.css`, « Le podium : une marche peinte par thème »). Ce que le
// modèle ne tient pas en mots se dessine sur le croquis — la leçon des
// ornements de la niche (`ornements.ts`) : les trente-cinq marches tombent
// sur le même cadre, et une seule règle les pose toutes.
//
// Le choix du propriétaire du 19 novembre 2026, sur la maquette peinte
// (`retours/2026-11-19/podium-peint/`) : « C'est magnifique, je veux ça. Fait
// tous les thèmes […] par rapport à ceux qui sont dur à obtenir je veux que ce
// soit encore plus beau ».
//
// Toutes les mesures sont des parts de la largeur de l'image : la feuille de
// style ne connaît que la largeur d'une marche.

/** Le cadre du croquis et de l'image peinte : 3:4, en hauteur. */
export const GABARIT_DE_LA_MARCHE = {
  largeur: 864,
  hauteur: 1152,
  /** La face avant va de 3 % à 97 % de la largeur : le décor peut déborder d'un peu sur les côtés. */
  bord: 0.03,
  /** Le bord avant du dessus de la marche, depuis le haut de l'image : l'avatar s'y tient. */
  dessus: 0.35,
  /** La profondeur du dessus, vu d'un peu au-dessus : la bande au-dessus du bord avant. */
  profondeur: 0.05,
  /** Le centre du médaillon sous le bord avant, et son rayon — en parts de la largeur de la face avant. */
  medaillon: 0.24,
  rayon: 0.13,
  /** Le milieu du dessus, laissé vide : le gagnant s'y tient. */
  libre: [0.32, 0.68] as const,
  /** Le haut du décor : il ne monte pas plus haut. */
  plafond: 0.02,
} as const

/** La largeur de la face avant, en part de la largeur de l'image. */
export const FACE = 1 - 2 * GABARIT_DE_LA_MARCHE.bord

/** Le fond uni sur lequel une marche se peint, et la couleur de ses traits : un magenta franc, même assombri, est du fond (`pixels.ts`). */
export const FONDS_DES_MARCHES = {
  magenta: { fond: '#ff00ff', trait: '#8a008a', rgb: [255, 0, 255] },
  vert: { fond: '#00ff00', trait: '#008a00', rgb: [0, 255, 0] },
} as const

export type FondDUneMarche = keyof typeof FONDS_DES_MARCHES

/**
 * Le croquis : la face avant, le dessus vu d'un peu au-dessus, le médaillon,
 * les deux cases du décor et la case du milieu qui reste vide — tracés sur
 * le fond uni d'une couleur plus sombre que lui, que le détourage efface.
 */
export function croquisDeLaMarche(fond: FondDUneMarche): string {
  const g = GABARIT_DE_LA_MARCHE
  const W = g.largeur
  const H = g.hauteur
  const { fond: couleur, trait } = FONDS_DES_MARCHES[fond]
  const x0 = g.bord * W
  const x1 = (1 - g.bord) * W
  const y = g.dessus * W
  const p = g.profondeur * W
  const face = FACE * W
  const cy = y + g.medaillon * face
  const r = g.rayon * face
  const haut = g.plafond * W
  const epais = Math.round(W / 140)
  const tirets = `stroke-dasharray="${epais * 4} ${epais * 3}"`
  const caseDuDecor = (a: number, b: number) =>
    `<rect x="${a.toFixed(1)}" y="${haut.toFixed(1)}" width="${(b - a).toFixed(1)}" height="${(y - haut).toFixed(1)}" fill="none" stroke="${trait}" stroke-width="${epais}" ${tirets}/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${couleur}"/>` +
    // La face avant, jusqu'au bas de l'image : on ne voit jamais son pied.
    `<rect x="${x0}" y="${y}" width="${face}" height="${H - y + epais}" fill="none" stroke="${trait}" stroke-width="${epais * 1.6}"/>` +
    // Le dessus, vu d'un peu au-dessus.
    `<path d="M${x0},${y} L${x0 + p * 0.6},${y - p} L${x1 - p * 0.6},${y - p} L${x1},${y}" fill="none" stroke="${trait}" stroke-width="${epais * 1.2}"/>` +
    `<circle cx="${W / 2}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${trait}" stroke-width="${epais * 1.4}"/>` +
    caseDuDecor(x0, (0.3 * W)) +
    caseDuDecor(0.7 * W, x1) +
    // La case du milieu, qui reste vide : barrée d'une croix.
    `<rect x="${g.libre[0] * W}" y="${haut}" width="${(g.libre[1] - g.libre[0]) * W}" height="${(y - p - haut).toFixed(1)}" fill="none" stroke="${trait}" stroke-width="${epais}" ${tirets}/>` +
    `<path d="M${g.libre[0] * W},${haut} L${g.libre[1] * W},${(y - p).toFixed(1)} M${g.libre[1] * W},${haut} L${g.libre[0] * W},${(y - p).toFixed(1)}" stroke="${trait}" stroke-width="${epais * 0.7}" ${tirets}/>` +
    '</svg>'
  )
}
