// La carte de France de l'Épingle et des murs, en données : le contour de la
// métropole et celui de la Corse, les sept villes repères, recopiés de la
// maquette jouable (`retours/2026-10-24/maquette/contenu.js`) — assez pour
// planter une épingle au doigt, pas une carte de géographe : un trait de côte à
// une soixantaine de points, sans fleuve ni frontière intérieure. La
// projection est celle de `shared/cabinet/france.ts` (`projeter`,
// `deprojeter`), la même qui relit le toucher.
//
// Et ce que la carte dit à qui ne la voit pas : où est son épingle, par la
// ville repère la plus proche (« près de Lyon », « à 120 km au sud-ouest de
// Paris ») — un lecteur d'écran, ou un doigt qui cache la carte, ne lit pas un
// dessin. Purs, sans React : `cabinet-ecran-neufs.test.ts` les lit tels quels.

import { DANS_LA_FRANCE, deprojeter, distanceKm, projeter, type Point } from '../../../../shared/cabinet/france'
import { formatNumber } from '../../../../shared/typographie'

/** Un point d'un contour, comme la maquette l'écrit : la longitude, puis la latitude, en degrés. */
export type PointDuContour = readonly [lon: number, lat: number]

/** La métropole, d'est en ouest par le nord : Dunkerque, la Manche, la Bretagne, l'Atlantique, les Pyrénées, la Méditerranée, les Alpes, le Rhin. */
export const CONTOUR_DE_LA_FRANCE: readonly PointDuContour[] = [
  [2.55, 51.08], [1.85, 50.95], [1.6, 50.73], [1.6, 50.2], [1.08, 49.92], [0.1, 49.5], [-0.3, 49.3], [-1.25, 49.4], [-1.6, 49.65], [-1.95, 49.7],
  [-1.6, 48.84], [-2.0, 48.65], [-3.05, 48.8], [-4.0, 48.72], [-4.77, 48.4], [-4.73, 48.04], [-4.2, 47.8], [-3.4, 47.7], [-3.1, 47.5], [-2.2, 47.27],
  [-2.2, 47.0], [-1.8, 46.5], [-1.15, 46.15], [-1.05, 45.62], [-1.2, 44.65], [-1.56, 43.48], [-1.78, 43.36], [-1.4, 43.05], [-0.7, 42.8], [0.7, 42.7],
  [1.7, 42.5], [2.6, 42.4], [3.17, 42.43], [3.05, 42.7], [3.2, 43.2], [3.5, 43.28], [3.7, 43.4], [4.0, 43.55], [4.6, 43.4], [5.37, 43.3],
  [5.93, 43.1], [6.65, 43.25], [7.0, 43.55], [7.27, 43.7], [7.5, 43.78], [7.0, 44.2], [6.9, 44.7], [7.0, 45.3], [6.8, 45.85], [6.15, 46.15],
  [6.1, 46.6], [6.9, 47.3], [7.55, 47.6], [7.6, 48.2], [7.8, 48.6], [8.2, 48.97], [7.0, 49.15], [6.4, 49.47], [5.8, 49.55], [4.85, 49.8],
  [4.85, 50.15], [4.2, 49.98], [3.7, 50.3], [3.1, 50.8],
]

/** La Corse, du cap Corse à Bonifacio, puis la côte ouest : la décision du propriétaire la veut sur la carte dès la V1. */
export const CONTOUR_DE_LA_CORSE: readonly PointDuContour[] = [[9.35, 43.0], [9.55, 42.6], [9.4, 41.4], [8.8, 41.5], [8.6, 42.0], [8.7, 42.6]]

/**
 * Une ville repère : où l'œil se pose pour situer un lieu. Son nom se pose à
 * droite de son point, ou dessous — Strasbourg, collé à droite, sortait du
 * dessin ; Marseille, à droite, couvrait la côte jusqu'à Nice, dessous il est en
 * mer.
 */
export interface VilleRepere extends Point {
  nom: string
  nomA: 'droite' | 'dessous'
}

export const VILLES_REPERES: readonly VilleRepere[] = [
  { nom: 'Paris', lon: 2.35, lat: 48.86, nomA: 'droite' },
  { nom: 'Lyon', lon: 4.84, lat: 45.76, nomA: 'droite' },
  { nom: 'Marseille', lon: 5.37, lat: 43.3, nomA: 'dessous' },
  { nom: 'Bordeaux', lon: -0.58, lat: 44.84, nomA: 'droite' },
  { nom: 'Lille', lon: 3.06, lat: 50.63, nomA: 'droite' },
  { nom: 'Nantes', lon: -1.55, lat: 47.22, nomA: 'droite' },
  { nom: 'Strasbourg', lon: 7.75, lat: 48.58, nomA: 'dessous' },
]

/** Un point au dixième de pixel du dessin : le tracé SVG n'en demande pas plus, et le HTML reste court. */
const auDixieme = (n: number) => Math.round(n * 10) / 10

/** Un point de la carte, dans le dessin : `projeter`, arrondi. */
export function surLeDessin(p: Point): { x: number; y: number } {
  const { x, y } = projeter(p)
  return { x: auDixieme(x), y: auDixieme(y) }
}

/** Les points d'un contour, tels qu'un `<polygon points>` les lit. */
export const traceDe = (contour: readonly PointDuContour[]) =>
  contour
    .map(([lon, lat]) => {
      const { x, y } = surLeDessin({ lat, lon })
      return `${x},${y}`
    })
    .join(' ')

/**
 * Le point que vise un toucher : sa place dans le dessin, relue par la
 * projection, et gardée dans le cadre où une épingle se plante
 * (`DANS_LA_FRANCE`). Le dessin déborde le cadre — la mer à l'ouest, de quoi
 * écrire les noms à l'est — : un doigt posé là plante l'épingle au bord le plus
 * proche, où elle se voit, plutôt que de la planter hors de France et de se
 * l'entendre refuser à « Planter ici ».
 */
export function pointDuToucher(
  doigt: { x: number; y: number },
  rect: { left: number; top: number; width: number; height: number },
  dessin: { largeur: number; hauteur: number },
): Point {
  const p = deprojeter({ x: ((doigt.x - rect.left) * dessin.largeur) / rect.width, y: ((doigt.y - rect.top) * dessin.hauteur) / rect.height })
  return dansLeCadre(p)
}

/** Un point ramené dans le cadre de l'Épingle, au plus près. */
export function dansLeCadre(p: Point): Point {
  const c = DANS_LA_FRANCE
  return { lat: Math.min(c.latMax, Math.max(c.latMin, p.lat)), lon: Math.min(c.lonMax, Math.max(c.lonMin, p.lon)) }
}

/** Où l'épingle part la première fois qu'on la mène au clavier : le milieu de la France, d'où chaque flèche la mène. */
export const MILIEU_DE_LA_FRANCE: Point = { lat: 46.6, lon: 2.45 }

/** Les flèches du clavier, et le sens où chacune mène l'épingle. */
export type Fleche = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
export const estUneFleche = (touche: string): touche is Fleche => touche === 'ArrowUp' || touche === 'ArrowDown' || touche === 'ArrowLeft' || touche === 'ArrowRight'

/** Ce que vaut un grand pas, en petits : Maj au clavier, la bascule des grands pas au pied de l'Épingle, qui l'écrit (« ×5 »). */
export const GRAND_PAS = 5

/**
 * Un pas de flèche : un dixième de degré de latitude — onze kilomètres —, et
 * autant de chemin vers l'est ou l'ouest (la longitude s'allonge du cosinus de
 * la latitude) ; cinq fois plus, Maj enfoncée, pour traverser la France en
 * une vingtaine de pas. Gardé dans le cadre, comme un toucher.
 */
export function deplacer(p: Point, fleche: Fleche, grand = false): Point {
  const pas = 0.1 * (grand ? GRAND_PAS : 1)
  const est = pas / Math.cos((p.lat * Math.PI) / 180)
  switch (fleche) {
    case 'ArrowUp':
      return dansLeCadre({ lat: p.lat + pas, lon: p.lon })
    case 'ArrowDown':
      return dansLeCadre({ lat: p.lat - pas, lon: p.lon })
    case 'ArrowLeft':
      return dansLeCadre({ lat: p.lat, lon: p.lon - est })
    case 'ArrowRight':
      return dansLeCadre({ lat: p.lat, lon: p.lon + est })
  }
}

/** Assez près d'une ville repère pour se dire « près de » elle : à cette distance, une épingle ne se distingue plus de son point. */
export const PRES_D_UNE_VILLE_KM = 25

/** Les huit directions, du nord dans le sens des aiguilles d'une montre, et la façon de les dire devant « de Lyon ». */
const DIRECTIONS = ['au nord', 'au nord-est', 'à l’est', 'au sud-est', 'au sud', 'au sud-ouest', 'à l’ouest', 'au nord-ouest'] as const

/** La direction où l'on va de `a` vers `b`, en degrés (le nord à 0, l'est à 90) : le cap initial d'un grand cercle. */
function capDe(a: Point, b: Point): number {
  const r = Math.PI / 180
  const y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r)
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r)
  return ((Math.atan2(y, x) / r) % 360 + 360) % 360
}

/**
 * Où est l'épingle, en mots : par la ville repère la plus proche — « Près de
 * Lyon », sinon sa distance à dix kilomètres près et sa direction (« À 120 km
 * au sud-ouest de Paris »), une ligne à elle seule. Le lecteur d'écran le dit à
 * chaque pas de flèche, et l'écran l'écrit au-dessus de « Planter ici » : sous
 * le doigt qui la plante, l'épingle ne se voit pas. La distance passe par
 * `formatNumber`, jamais par `Intl` (règle `client.md`).
 */
export function ouEstLEpingle(p: Point): string {
  const [proche] = VILLES_REPERES.map(v => ({ v, km: distanceKm(v, p) })).sort((a, b) => a.km - b.km)
  if (proche.km < PRES_D_UNE_VILLE_KM) return `Près de ${proche.v.nom}`
  const km = Math.max(10, Math.round(proche.km / 10) * 10)
  const direction = DIRECTIONS[Math.round(capDe(proche.v, p) / 45) % DIRECTIONS.length]
  return `À ${formatNumber(km)} km ${direction} de ${proche.v.nom}`
}
