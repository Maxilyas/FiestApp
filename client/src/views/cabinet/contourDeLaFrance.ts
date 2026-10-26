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

/** Le milieu de la Corse, dans son contour : d'où « Partir de… » y pose l'épingle, et d'où se dit une épingle dans l'île. */
export const MILIEU_DE_LA_CORSE: Point = { lat: 42.15, lon: 9.1 }

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

/** Une distance et sa direction, de `a` vers `p` : « 120 km au sud-ouest », à dix kilomètres près, jamais moins de dix. */
function distanceEtDirection(a: Point, p: Point, km: number): string {
  return `${formatNumber(Math.max(10, Math.round(km / 10) * 10))} km ${DIRECTIONS[Math.round(capDe(a, p) / 45) % DIRECTIONS.length]}`
}

/** Un degré de latitude, en kilomètres — et un degré de longitude au milieu de la Corse. */
const KM_PAR_DEGRE = distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })
const KM_PAR_DEGRE_EN_CORSE = KM_PAR_DEGRE * Math.cos((MILIEU_DE_LA_CORSE.lat * Math.PI) / 180)

/** Un point en kilomètres, sur un plan posé au milieu de la Corse : à l'échelle d'une île de 180 km, la Terre y est plate. */
const surLePlanDeLaCorse = (p: Point) => ({ x: (p.lon - MILIEU_DE_LA_CORSE.lon) * KM_PAR_DEGRE_EN_CORSE, y: (p.lat - MILIEU_DE_LA_CORSE.lat) * KM_PAR_DEGRE })

/** Les côtés du contour dessiné de la Corse, sur son plan. */
const COTES_DE_LA_CORSE = CONTOUR_DE_LA_CORSE.map(([lon, lat], i) => {
  const [lon2, lat2] = CONTOUR_DE_LA_CORSE[(i + 1) % CONTOUR_DE_LA_CORSE.length]
  return [surLePlanDeLaCorse({ lat, lon }), surLePlanDeLaCorse({ lat: lat2, lon: lon2 })] as const
})

/**
 * Où est l'épingle par rapport à la Corse dessinée : dedans, ou le point de sa côte le plus proche — la côte du dessin, celle que
 * l'œil voit : une épingle posée juste hors du trait se dit « près de la Corse », comme elle se voit.
 */
function laCorseVue(p: Point): { dedans: true } | { dedans: false; cote: Point } {
  const q = surLePlanDeLaCorse(p)
  let dedans = false
  let plusPres = { d: Infinity, x: 0, y: 0 }
  for (const [a, b] of COTES_DE_LA_CORSE) {
    // Le rayon vers l'est croise-t-il ce côté ? Un nombre impair de fois : dedans.
    if (a.y > q.y !== b.y > q.y && q.x < a.x + ((q.y - a.y) * (b.x - a.x)) / (b.y - a.y)) dedans = !dedans
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
    const t = Math.max(0, Math.min(1, ((q.x - a.x) * (b.x - a.x) + (q.y - a.y) * (b.y - a.y)) / l2))
    const x = a.x + t * (b.x - a.x)
    const y = a.y + t * (b.y - a.y)
    const d = (q.x - x) ** 2 + (q.y - y) ** 2
    if (d < plusPres.d) plusPres = { d, x, y }
  }
  return dedans ? { dedans } : { dedans, cote: { lat: MILIEU_DE_LA_CORSE.lat + plusPres.y / KM_PAR_DEGRE, lon: MILIEU_DE_LA_CORSE.lon + plusPres.x / KM_PAR_DEGRE_EN_CORSE } }
}

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
 * l'épingle ne se voit pas. La distance passe par `formatNumber`, jamais par
 * `Intl` (règle `client.md`).
 */
export function ouEstLEpingle(p: Point): string {
  const corse = laCorseVue(p)
  if (corse.dedans) {
    const km = distanceKm(MILIEU_DE_LA_CORSE, p)
    return km < PRES_D_UNE_VILLE_KM ? 'Au milieu de la Corse' : `En Corse, à ${distanceEtDirection(MILIEU_DE_LA_CORSE, p, km)} de son milieu`
  }
  const [proche] = VILLES_REPERES.map(v => ({ v, km: distanceKm(v, p) })).sort((a, b) => a.km - b.km)
  const aLaCorse = distanceKm(corse.cote, p)
  if (aLaCorse < proche.km) return aLaCorse < PRES_D_UNE_VILLE_KM ? 'Près de la Corse' : `À ${distanceEtDirection(corse.cote, p, aLaCorse)} de la Corse`
  if (proche.km < PRES_D_UNE_VILLE_KM) return `Près de ${proche.v.nom}`
  return `À ${distanceEtDirection(proche.v, p, proche.km)} de ${proche.v.nom}`
}
