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
// Paris ») ou par la Corse (« en Corse », « à 30 km à l'ouest de la Corse ») —
// un lecteur d'écran, ou un doigt qui cache la carte, ne lit pas un dessin —,
// ce que fait un pas, et d'où partir sans viser. Purs, sans React :
// `cabinet-ecran-neufs.test.ts` les lit tels quels.

import { DANS_LA_FRANCE, deprojeter, distanceKm, projeter, type Point } from '../../../../shared/cabinet/france'
import { CONTOUR_DE_LA_CORSE, MILIEU_DE_LA_CORSE, PRES_D_UNE_VILLE_KM, VILLES_DE_LA_CARTE, ouEstCePoint } from '../../../../shared/cabinet/villesReperes'

// Les villes, la Corse et la façon de dire un point vivent dans `shared/` depuis le 11 novembre 2026 : le serveur dit
// le second indice d'un lieu dans les mots mêmes où la page dit l'épingle. Redits d'ici, pour qui les lisait ici.
export { CONTOUR_DE_LA_CORSE, MILIEU_DE_LA_CORSE, PRES_D_UNE_VILLE_KM }

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

const NOMS_DESSOUS: readonly string[] = ['Marseille', 'Strasbourg']
export const VILLES_REPERES: readonly VilleRepere[] = VILLES_DE_LA_CARTE.map(v => ({ ...v, nomA: NOMS_DESSOUS.includes(v.nom) ? 'dessous' : 'droite' }))

/**
 * D'où « Partir de… » pose l'épingle, du nord au sud : chaque ville repère, sur son point dessiné, et la Corse, en son milieu —
 * qu'aucune ville ne dessine. Depuis le milieu de la France, trois étoiles à Ajaccio demandaient dix-huit grands pas, treize à
 * Brest ou à Nice, et Hugo, au lecteur d'écran, y a mis une vingtaine de pressions (la tablée du 26 octobre 2026) ; depuis le
 * départ le plus proche, chaque lieu livré est à six grands pas au plus (`cabinet-ecran-neufs.test.ts`).
 */
export const DEPARTS_DE_L_EPINGLE: readonly { nom: string; point: Point }[] = [
  ...VILLES_REPERES.map(v => ({ nom: v.nom, point: { lat: v.lat, lon: v.lon } })),
  { nom: 'la Corse', point: MILIEU_DE_LA_CORSE },
].sort((a, b) => b.point.lat - a.point.lat)

/** Le départ que la page a choisi, par son nom — par la liste, jamais par `TABLE[nom]` : un objet répond aussi de son prototype. */
export const departNomme = (nom: string): Point | null => DEPARTS_DE_L_EPINGLE.find(d => d.nom === nom)?.point ?? null

/**
 * Le départ où est l'épingle, tant qu'elle y est — sinon rien (`''`) : la liste le garde affiché. Revenue à « Partir de… » à
 * chaque choix, elle se jouait mal au clavier : sous Chromium, une flèche sur la liste fermée la change à chaque pression, et la
 * suivante repartait de la première ligne — Paris, Nantes, la Corse hors d'atteinte, l'épingle replacée à Lille à chaque fois (la
 * relecture du lot, le 26 octobre 2026). Un pas ou un toucher l'en éloigne, et la liste revient à « Partir de… ».
 */
export const departDeLEpingle = (p: Point | null): string => (p && DEPARTS_DE_L_EPINGLE.find(d => d.point.lat === p.lat && d.point.lon === p.lon)?.nom) || ''

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

/** Un pas, en degrés de latitude. */
const DEGRES_D_UN_PAS = 0.1

/**
 * Un pas de flèche : un dixième de degré de latitude — onze kilomètres —, et
 * autant de chemin vers l'est ou l'ouest (la longitude s'allonge du cosinus de
 * la latitude) ; cinq fois plus, Maj enfoncée, pour traverser la France en
 * une vingtaine de pas. Gardé dans le cadre, comme un toucher.
 */
export function deplacer(p: Point, fleche: Fleche, grand = false): Point {
  const pas = DEGRES_D_UN_PAS * (grand ? GRAND_PAS : 1)
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

/**
 * Ce que fait un pas, en kilomètres entiers, tel que la page le dit — « Grands pas, 55 km », « un pas fait 11 km, un grand 55 » :
 * un pas de la règle même (`deplacer`), vers le nord. Un grand se dit cinq de ces kilomètres-là (55, pas les 55,6 d'un vrai) : dit
 * « 56 » derrière « 11 », il ferait compter l'oreille. La page n'en disait que « ×5 » à l'œil et « Grands pas » à l'oreille (Hugo, à
 * la tablée du 26 octobre 2026).
 */
export const KM_D_UN_PAS = Math.round(distanceKm(MILIEU_DE_LA_FRANCE, deplacer(MILIEU_DE_LA_FRANCE, 'ArrowUp')))

/**
 * Où est l'épingle, en mots : par la ville repère la plus proche — « Près de
 * Lyon », sinon sa distance à dix kilomètres près et sa direction (« À 120 km
 * au sud-ouest de Paris »), une ligne à elle seule. La Corse, qu'aucune ville
 * ne dessine, se dit d'elle-même : dans l'île, par son milieu (« Au milieu de
 * la Corse », « En Corse, à 40 km au sud-ouest de son milieu ») ; dans la mer
 * qui la borde, par sa côte, si elle est plus près qu'une ville (« À 30 km à
 * l'ouest de la Corse ») — « Partir de… la Corse » se disait « À 330 km à
 * l'est de Marseille », et chaque pas autour de l'île aussi (la relecture du
 * lot, le 26 octobre 2026). Le lecteur d'écran le dit à chaque pas de flèche,
 * et l'écran l'écrit au-dessus de la carte : sous le doigt qui la plante,
 * l'épingle ne se voit pas. La règle est celle de `shared/cabinet/villesReperes.ts`
 * (`ouEstCePoint`), que le serveur lit aussi : le second indice d'un lieu se dit
 * dans ces mots-là, et l'épingle se mène dessus.
 */
export const ouEstLEpingle = (p: Point): string => ouEstCePoint(p)
