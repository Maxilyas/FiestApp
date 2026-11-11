// Où est un point de la carte de France, en mots : par la ville repère la plus
// proche (« Près de Lyon », « À 120 km au sud-ouest de Paris »), ou par la
// Corse, qu'aucune ville ne dessine. Né dans la page — un lecteur d'écran, ou
// un doigt qui cache la carte, ne lit pas un dessin —, il sert depuis le
// 11 novembre 2026 au serveur aussi : le second indice d'un lieu de l'Épingle
// est sa place dite ainsi, dans les mots mêmes où la page dit celle de
// l'épingle — il n'y a plus qu'à mener l'une sur l'autre. Une seule copie : dit
// de deux façons, l'indice et l'épingle ne se seraient plus comparés.
//
// Pur, sans rien de la page : les sept villes que la carte dessine, le contour
// de la Corse, et les façons de dire un point, la meilleure d'abord.

import { distanceKm, type Point } from './france'
import { formatNumber } from '../typographie'

/** Une ville que la carte dessine : où l'œil se pose pour situer un lieu. */
export interface VilleDeLaCarte extends Point {
  nom: string
}

/** Les sept villes repères, recopiées de la maquette jouable (`retours/2026-10-24/maquette/contenu.js`). */
export const VILLES_DE_LA_CARTE: readonly VilleDeLaCarte[] = [
  { nom: 'Paris', lon: 2.35, lat: 48.86 },
  { nom: 'Lyon', lon: 4.84, lat: 45.76 },
  { nom: 'Marseille', lon: 5.37, lat: 43.3 },
  { nom: 'Bordeaux', lon: -0.58, lat: 44.84 },
  { nom: 'Lille', lon: 3.06, lat: 50.63 },
  { nom: 'Nantes', lon: -1.55, lat: 47.22 },
  { nom: 'Strasbourg', lon: 7.75, lat: 48.58 },
]

/** La Corse, du cap Corse à Bonifacio, puis la côte ouest — la longitude, puis la latitude : la décision du propriétaire la veut sur la carte dès la V1. */
export const CONTOUR_DE_LA_CORSE: readonly (readonly [lon: number, lat: number])[] = [[9.35, 43.0], [9.55, 42.6], [9.4, 41.4], [8.8, 41.5], [8.6, 42.0], [8.7, 42.6]]

/** Le milieu de la Corse, dans son contour : d'où « Partir de… » y pose l'épingle, et d'où se dit un point de l'île. */
export const MILIEU_DE_LA_CORSE: Point = { lat: 42.15, lon: 9.1 }

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

/** Une distance dite : à dix kilomètres près, jamais moins de dix. `formatNumber`, jamais `Intl` (règle `client.md`). */
const kmDits = (km: number) => `${formatNumber(Math.max(10, Math.round(km / 10) * 10))} km`

/** Une distance et sa direction, de `a` vers `p` : « 120 km au sud-ouest ». */
function distanceEtDirection(a: Point, p: Point, km: number): string {
  return `${kmDits(km)} ${DIRECTIONS[Math.round(capDe(a, p) / 45) % DIRECTIONS.length]}`
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
 * Où est le point par rapport à la Corse dessinée : dedans, ou le point de sa côte le plus proche — la côte du dessin, celle que
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

/** Un point dit par une ville : « Près de Lyon », sinon sa distance à dix kilomètres près et sa direction. */
const parLaVille = (v: VilleDeLaCarte, p: Point, km: number) => (km < PRES_D_UNE_VILLE_KM ? `Près de ${v.nom}` : `À ${distanceEtDirection(v, p, km)} de ${v.nom}`)

/**
 * Les façons de dire où est un point, la meilleure d'abord — celle que la page
 * dit de l'épingle (`ouEstCePoint`). Dans la Corse, par son milieu (« Au milieu
 * de la Corse », « En Corse, à 40 km au sud-ouest de son milieu ») ; dans la mer
 * qui la borde, par sa côte, si elle est plus près qu'une ville (« À 30 km à
 * l'ouest de la Corse ») — « Partir de… la Corse » se disait « À 330 km à l'est
 * de Marseille », et chaque pas autour de l'île aussi (la relecture du lot, le
 * 26 octobre 2026). Puis chaque ville repère, de la plus proche à la plus
 * lointaine ; puis, sans direction, par ses distances à deux des trois plus
 * proches (« À 60 km de Lille et à 190 km de Paris ») : l'indice d'un lieu ne
 * peut dire ni sa commune ni son département, et aucun lieu du Nord ne se dit
 * « au nord » de quoi que ce soit — le serveur prend la première qui ne les
 * écrit pas.
 */
export function faconsDeDireCePoint(p: Point): string[] {
  const facons: string[] = []
  const corse = laCorseVue(p)
  const villes = VILLES_DE_LA_CARTE.map(v => ({ v, km: distanceKm(v, p) })).sort((a, b) => a.km - b.km)
  if (corse.dedans) {
    const km = distanceKm(MILIEU_DE_LA_CORSE, p)
    facons.push(km < PRES_D_UNE_VILLE_KM ? 'Au milieu de la Corse' : `En Corse, à ${distanceEtDirection(MILIEU_DE_LA_CORSE, p, km)} de son milieu`)
  } else {
    const aLaCorse = distanceKm(corse.cote, p)
    if (aLaCorse < villes[0].km) facons.push(aLaCorse < PRES_D_UNE_VILLE_KM ? 'Près de la Corse' : `À ${distanceEtDirection(corse.cote, p, aLaCorse)} de la Corse`)
  }
  for (const { v, km } of villes) facons.push(parLaVille(v, p, km))
  const [a, b, c] = villes
  for (const [x, y] of [[a, b], [a, c], [b, c]] as const) facons.push(`À ${kmDits(x.km)} de ${x.v.nom} et à ${kmDits(y.km)} de ${y.v.nom}`)
  return facons
}

/** Où est ce point, en mots : la meilleure façon de le dire, une ligne à elle seule. */
export const ouEstCePoint = (p: Point): string => faconsDeDireCePoint(p)[0]
