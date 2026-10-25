// La carte de France de l'Épingle et des murs : la France métropolitaine et
// la Corse en V1 (la décision du propriétaire, le 24 octobre 2026 ; le monde
// attend une V2, même jeu, une autre carte). Sans bibliothèque de
// cartographie : une distance à vol d'oiseau et la projection de la maquette,
// assez pour planter une épingle au doigt et la juger au serveur.
//
// Le serveur juge à la distance (`distanceKm`) ; la page dessine et relit le
// toucher (`projeter`, `deprojeter`). Ni l'une ni l'autre n'envoie jamais les
// coordonnées d'un lieu avant la révélation (invariant 1).

/** Un point, en degrés. */
export interface Point {
  lat: number
  lon: number
}

/**
 * Le cadre où une épingle se plante : la métropole et la Corse, à quelques
 * kilomètres de mer près. Un rectangle, pas la frontière : une épingle à
 * Genève se juge à sa distance, comme une autre.
 */
export const DANS_LA_FRANCE = { latMin: 41.3, latMax: 51.1, lonMin: -5.2, lonMax: 9.6 } as const

export function dansLaFrance(p: Point): boolean {
  const { lat, lon } = p
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= DANS_LA_FRANCE.latMin && lat <= DANS_LA_FRANCE.latMax && lon >= DANS_LA_FRANCE.lonMin && lon <= DANS_LA_FRANCE.lonMax
}

const RAYON_DE_LA_TERRE_KM = 6371
const RADIAN = Math.PI / 180

/** La distance à vol d'oiseau, en kilomètres (haversine). */
export function distanceKm(a: Point, b: Point): number {
  const x = Math.sin(((b.lat - a.lat) * RADIAN) / 2) ** 2 + Math.cos(a.lat * RADIAN) * Math.cos(b.lat * RADIAN) * Math.sin(((b.lon - a.lon) * RADIAN) / 2) ** 2
  return 2 * RAYON_DE_LA_TERRE_KM * Math.asin(Math.sqrt(x))
}

// La projection de la maquette : équirectangulaire, les longitudes resserrées
// au cosinus de la latitude moyenne de la métropole — la France n'y paraît pas
// écrasée, et l'aller-retour d'un toucher est exact.
const PIXELS_PAR_DEGRE = 30
const OUEST = -5.4
const NORD = 51.4
const MARGE = 6
const RESSERRE = Math.cos(46.5 * RADIAN)

/** Un point de la carte, en pixels de son dessin : le nord en haut, l'est à droite. */
export function projeter(p: Point): { x: number; y: number } {
  return { x: (p.lon - OUEST) * RESSERRE * PIXELS_PAR_DEGRE + MARGE, y: (NORD - p.lat) * PIXELS_PAR_DEGRE + MARGE }
}

/** Le point que désigne un toucher sur le dessin. */
export function deprojeter(xy: { x: number; y: number }): Point {
  return { lon: (xy.x - MARGE) / (RESSERRE * PIXELS_PAR_DEGRE) + OUEST, lat: NORD - (xy.y - MARGE) / PIXELS_PAR_DEGRE }
}

/** La taille du dessin : tout le cadre, et de quoi écrire le nom des villes repères à droite de la Corse. */
export const LARGEUR_DE_LA_CARTE = Math.ceil((9.7 - OUEST) * RESSERRE * PIXELS_PAR_DEGRE + 50)
export const HAUTEUR_DE_LA_CARTE = Math.ceil((NORD - 41.3) * PIXELS_PAR_DEGRE + 12)
