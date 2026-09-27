// Les outils des portraits des branches (`shared/branches.ts`) : ce que
// chaque dessin partage, et la forme qu'il doit avoir pour `Portrait.tsx`.
//
// Un portrait est du SVG écrit à la main, en chaînes : soixante-douze dessins
// d'une cinquantaine de formes chacun, que la page pose d'un bloc
// (`Portrait.tsx`). Aucune donnée d'invité n'y entre jamais — rien que ces
// fichiers.

/**
 * Un portrait : un disque teinté de sa branche, un personnage de face, la
 * lumière en haut à gauche. Chaque fonction reçoit un préfixe unique `u`,
 * dont le dessin fait les identifiants de ses dégradés : `${u}t`, `${u}peau`
 * — des lettres, jamais de tiret bas, réservé à `Portrait.tsx` (le disque,
 * la découpe, la silhouette, le cercle de la finition).
 */
export interface DessinDePortrait {
  /** Le disque, du centre (en haut) vers le bord : clair, moyen, sombre. */
  fond: [string, string, string]
  /** Ses dégradés, en éléments `<linearGradient>`, `<radialGradient>`… sans `<defs>`. */
  defs?: (u: string) => string
  /**
   * Ce qui est derrière lui : étoiles, rayons, bulles, collines. Verrouillé,
   * il n'en reste rien — seule la silhouette du personnage se devine.
   */
  decor?: (u: string) => string
  /** Le personnage, épaules comprises : verrouillé, c'est sa forme qui se voit, en or. */
  corps: (u: string) => string
}

/** Un dégradé linéaire, du haut vers le bas par défaut. */
export const lin = (id: string, a: string, b: string, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`

/** Un dégradé radial, éclairé en haut à gauche. */
export const rad = (id: string, a: string, b: string, cx = '38%', cy = '32%') =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`

/** Le même dessin, retourné autour de l'axe x = 50 : l'autre oreille, l'autre bois. */
export const miroir = (s: string) => `<g transform="translate(100 0) scale(-1 1)">${s}</g>`

/** Des points de lumière — lucioles, étoiles, poussière. */
export const points = (liste: [number, number, number][], couleur: string, op = 0.75) =>
  liste.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${couleur}" opacity="${op}"/>`).join('')

/** Le reflet d'un œil. */
export const reflet = (x: number, y: number, r = 0.9) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`

/** Une étoile à quatre branches, centrée en (x, y). */
export const etoile = (x: number, y: number, r: number, couleur = '#fff', op = 0.8) => {
  const t = r * 0.25
  return `<path d="M${x},${y - r} L${x + t},${y - t} L${x + r},${y} L${x + t},${y + t} L${x},${y + r} L${x - t},${y + t} L${x - r},${y} L${x - t},${y - t} Z" fill="${couleur}" opacity="${op}"/>`
}

/**
 * Un dessin en pixels, pour l'arcade : une grille de lettres, une couleur
 * par lettre, le point pour le vide. Centré, en haut à `y0`.
 */
export function pixels(grille: string[], teintes: Record<string, string>, taille = 3.5, y0 = 17): string {
  const x0 = 50 - (grille[0].length * taille) / 2
  let rects = ''
  grille.forEach((ligne, j) =>
    [...ligne].forEach((c, i) => {
      if (c === '.') return
      rects += `<rect x="${(x0 + i * taille).toFixed(2)}" y="${(y0 + j * taille).toFixed(2)}" width="${taille + 0.05}" height="${taille + 0.05}" fill="${teintes[c]}"/>`
    }),
  )
  return `<g shape-rendering="crispEdges">${rects}</g>`
}
