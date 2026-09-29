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
  /**
   * Le disque, du centre (en haut) vers le bord : clair, moyen, sombre.
   * Sous une image, il la remplace le temps qu'elle arrive, et c'est le
   * disque du premier palier, qui n'a pas de décor.
   */
  fond: [string, string, string]
  /** Ses dégradés, en éléments `<linearGradient>`, `<radialGradient>`… sans `<defs>`. */
  defs?: (u: string) => string
  /**
   * Ce qui est derrière lui : étoiles, rayons, bulles, collines. Verrouillé,
   * il n'en reste rien — seule la silhouette du personnage se devine.
   */
  decor?: (u: string) => string
  /** Le personnage, épaules comprises : verrouillé, c'est sa forme qui se voit, en or. */
  corps?: (u: string) => string
  /** Le portrait peint : il remplace le dessin (`decor`, `corps`). */
  image?: ImageDePortrait
}

/**
 * Un portrait peint (`server/scripts/anime/portraits.ts`) : des fichiers
 * WebP servis sous `/portraits/`, chacun en deux tailles — `[grande,
 * petite]`, 512 et 256 pixels pour les 100 unités du disque —, la petite
 * pour les listes, la grande pour ce qu'on regarde.
 */
export interface ImageDePortrait {
  /**
   * L'illustration, le personnage dans son décor, sur le carré 0 → 100 que
   * le disque découpe. Absente au premier palier : le visage n'a pas de
   * décor, le disque teinté de la branche le reçoit.
   */
  disque?: [string, string]
  /**
   * Le personnage seul, détouré — sa forme fait la silhouette, et c'est lui
   * qui sort du disque aux deux derniers paliers —, dans son cadre.
   */
  perso: [string, string]
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

/** Un nombre de coordonnées, au centième, sans zéro inutile. */
const n2 = (n: number) => String(+n.toFixed(2))

/**
 * Un dessin en pixels, pour l'arcade : une grille de lettres, une couleur
 * par lettre, le point pour le vide. Centré, en haut à `y0`.
 *
 * Un chemin par couleur, les pixels voisins d'une même ligne fondus en une
 * bande : un rectangle par pixel faisait trois cents éléments et vingt-quatre
 * mille caractères par portrait — vingt porteurs dans une salle, six mille
 * formes à redessiner à chaque instantané. Chaque bande déborde d'un
 * vingtième : sans ça, l'anticrénelage laissait un fil entre deux rangées.
 */
export function pixels(grille: string[], teintes: Record<string, string>, taille = 3.5, y0 = 17): string {
  const x0 = 50 - (grille[0].length * taille) / 2
  const chemins = new Map<string, string>()
  grille.forEach((ligne, j) => {
    for (let i = 0; i < ligne.length; ) {
      const c = ligne[i]
      let n = 1
      while (ligne[i + n] === c) n++
      if (c !== '.') {
        const d = `M${n2(x0 + i * taille)},${n2(y0 + j * taille)}h${n2(n * taille + 0.05)}v${n2(taille + 0.05)}h-${n2(n * taille + 0.05)}z`
        chemins.set(c, (chemins.get(c) ?? '') + d)
      }
      i += n
    }
  })
  return `<g shape-rendering="crispEdges">${[...chemins].map(([c, d]) => `<path d="${d}" fill="${teintes[c]}"/>`).join('')}</g>`
}
