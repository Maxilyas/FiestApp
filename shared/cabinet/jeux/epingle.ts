// L'Épingle : un récit daté, une question « Où ? », et une épingle plantée au
// doigt sur la carte de France — la métropole et la Corse en V1 (la décision
// du propriétaire, le 24 octobre 2026). Le serveur la juge à sa distance à vol
// d'oiseau du lieu (`distanceKm`) : la page n'a ni les coordonnées, ni la
// commune, ni le département avant la révélation (invariant 1), et dessine la
// carte de France elle-même.
//
// Ici, la règle pure (le moule : `regle.ts`) : ce que vaut chaque distance, la
// zone qu'Éclairer entoure, ce que la manche montre et ce que la révélation
// dit, la pièce que le journal garde — `cab:lieu:<id>`, hors de la base. Le
// choix des trois lieux d'un thème, et la rechange d'un autre thème, restent
// au serveur, qui lit le contenu et ce que le joueur a déjà vu.
//
// Rien ici ne lit l'heure ni ne tire au hasard de lui-même. La zone d'Éclairer
// se tire au départ, avec le lieu (`epingleTiree`), du hasard du serveur, et se
// fige dans le plan : le pli rejoué redonne la même, et le hasard qu'il passe à
// Éclairer n'y entre pas. Deux remèdes qui se cumulent : la graine de ce
// hasard est un secret du serveur (`DepartDUnePartie.graine`), et la zone ne
// tient même pas à elle.

import { DECALAGE_DE_LA_ZONE_KM, DUREES_DES_JEUX, KM_DE_L_EPINGLE, RAYON_D_ECLAIRER_KM } from '../bareme'
import type { Lieu } from '../contenu'
import { dansLaFrance, distanceKm, type Point } from '../france'
import { idDuLieu } from '../pieces'
import { formatNumber } from '../../typographie'
import { GESTE_A_JUGER, champsDuGeste, choixDe, naturelDe, pieceDuContenu, reponseEnvoyee, rienAEclairer, type RegleQuiTranche } from './outils'
import { justeDeLaPiece, type VerdictDUneManche } from './regle'

/** Où Éclairer posera le centre de sa zone, depuis le lieu : une direction en degrés (le nord à 0, l'est à 90), une distance en kilomètres. */
export interface DecalageDeLaZone {
  cap: number
  km: number
}

/** Ce que le départ fige d'une manche de l'Épingle : le lieu entier, sa réponse comprise, et le décalage de sa zone — rien ne quitte le serveur avant le verdict. */
export interface EpingleTiree {
  jeu: 'epingle'
  /** Son thème est celui de la manche : une rechange de Changer vient d'un autre thème, et le dit. */
  lieu: Lieu
  /** Avec le centre de la zone, que la page reçoit, il redonnerait le lieu : il ne part jamais. */
  decalage: DecalageDeLaZone
}

/** La zone qu'Éclairer entoure : un cercle qui contient le lieu, sans être centré sur lui. */
export interface ZoneDEclairer extends Point {
  rayonKm: number
}

/** Ce que le serveur sait d'une manche avant sa réponse : la zone éclairée, s'il l'a demandée. L'épingle, la page la tient seule. */
export interface EtatDeLEpingle {
  zone: ZoneDEclairer | null
}

/** « Planter ici », ou l'envoi de l'échéance : l'épingle posée, ou aucune. */
export interface GesteDeLEpingle {
  quoi: 'repondre'
  epingle: Point | null
}

/** Ce que la page reçoit : « 1429 · Les grands sièges », le récit, la question — jamais le lieu, ni ce qui le situe. */
export interface EpingleMontree {
  jeu: 'epingle'
  date: string
  theme: string
  recit: string
  question: string
  zone: ZoneDEclairer | null
}

/** La révélation : la distance, le lieu, l'épingle et le trait qui les joint. */
export interface EpingleRevelee {
  jeu: 'epingle'
  /** « À 37 km », « Pas d’épingle ». */
  titre: string
  /** La distance dite, en kilomètres entiers ; null sans épingle. */
  km: number | null
  epingle: Point | null
  lieu: { nom: string; commune: string; departement: string; date: string; lat: number; lon: number }
  zone: ZoneDEclairer | null
  /** « Le savais-tu ? » */
  savais: string
}

/**
 * Les étoiles d'une épingle plantée à tant de kilomètres du lieu : à moins de
 * 40 ★★★, de 120 ★★, de 300 ★ (`KM_DE_L_EPINGLE`), au-delà rien. « À moins
 * de » : un bord compte pour l'étoile d'en dessous.
 */
export function etoilesDeLaDistance(km: number): VerdictDUneManche['naturel'] {
  const palier = KM_DE_L_EPINGLE.findIndex(seuil => km < seuil)
  return palier < 0 ? 0 : naturelDe(3 - palier)
}

/**
 * La distance dite, en kilomètres entiers : tronquée, jamais arrondie. Les
 * seuils sont entiers — 119,6 km arrondis se seraient dits « À 120 km » sous
 * ★★, que « à moins de 120 km » promet ; tronquée, la distance dite tombe
 * toujours dans la tranche de ses étoiles.
 */
export const kmDits = (km: number) => Math.floor(km)

const RADIAN = Math.PI / 180
/**
 * Le rayon de la Terre, relu de `distanceKm` elle-même — un degré d'équateur
 * en vaut un radian sur 180/π — plutôt que recopié : la zone d'Éclairer et le
 * jugement de l'épingle se mesurent sur la même Terre.
 */
const KM_PAR_RADIAN = distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) / RADIAN

/**
 * Le point à tant de kilomètres d'un autre, dans une direction donnée en
 * degrés (le nord à 0, l'est à 90), le long d'un grand cercle : `distanceKm`
 * les relit à la même distance. Un décalage en degrés « à plat » se serait
 * allongé ou raccourci avec la latitude, et la zone aurait pu laisser le lieu
 * dehors.
 */
export function pointADistance(depart: Point, km: number, capDegres: number): Point {
  const d = km / KM_PAR_RADIAN
  const cap = capDegres * RADIAN
  const lat = depart.lat * RADIAN
  const lat2 = Math.asin(Math.sin(lat) * Math.cos(d) + Math.cos(lat) * Math.sin(d) * Math.cos(cap))
  const lon2 = depart.lon * RADIAN + Math.atan2(Math.sin(cap) * Math.sin(d) * Math.cos(lat), Math.cos(d) - Math.sin(lat) * Math.sin(lat2))
  return { lat: lat2 / RADIAN, lon: lon2 / RADIAN }
}

/**
 * La manche tirée d'un lieu que le serveur a choisi : le lieu, et le décalage
 * de sa zone d'Éclairer — une direction, puis une distance dans
 * `DECALAGE_DE_LA_ZONE_KM`, deux tirages dans cet ordre. Tiré ici, au départ,
 * même si Éclairer ne sert jamais. `hasard` est celui du tireur, que la page
 * ne peut pas refaire — jamais celui de la graine de la partie : qui la
 * saurait referait le décalage, et du centre de la zone remonterait au lieu.
 * Elle est un secret du serveur ; figé ici, le décalage ne tient même pas à ce
 * secret.
 */
export function epingleTiree(lieu: Lieu, hasard: () => number): EpingleTiree {
  const cap = hasard() * 360
  const [pres, loin] = DECALAGE_DE_LA_ZONE_KM
  return { jeu: 'epingle', lieu, decalage: { cap, km: pres + hasard() * (loin - pres) } }
}

/**
 * La zone qu'Éclairer entoure : `RAYON_D_ECLAIRER_KM` autour du centre que le
 * départ a décalé du lieu. Le décalage reste sous le rayon : le lieu est
 * toujours dedans ; il n'est jamais nul : le centre ne dit pas où il est.
 */
export function zoneDEclairer(lieu: Point, decalage: DecalageDeLaZone): ZoneDEclairer {
  const centre = pointADistance(lieu, decalage.km, decalage.cap)
  return { lat: centre.lat, lon: centre.lon, rayonKm: RAYON_D_ECLAIRER_KM }
}

/** Une coordonnée gardée au journal, au millième de degré — cent mètres : assez pour redessiner l'épingle sur la carte de France. */
const auMillieme = (degres: number) => Math.round(degres * 1000) / 1000

/** « 47.902,1.909|37 » : l'épingle, puis la distance dite — de quoi refaire la révélation d'une partie finie. */
const composee = (epingle: Point, km: number) => `${auMillieme(epingle.lat)},${auMillieme(epingle.lon)}|${kmDits(km)}`

/** La colonne `composee` relue ; null sans épingle. */
function relue(c: string | null | undefined): { epingle: Point; km: number } | null {
  const m = typeof c === 'string' ? /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\|(\d+)$/.exec(c) : null
  return m ? { epingle: { lat: Number(m[1]), lon: Number(m[2]) }, km: Number(m[3]) } : null
}

/** La réponse dite, au journal et au cartel : « Orléans (Loiret), 1429 ». */
const reponseDite = (l: Lieu) => `${l.commune} (${l.departement}), ${l.date}`

/** Plantée hors du cadre, l'épingle se refuse en mots (`apresLeGeste`) : il la replante, et la manche continue. */
const tranche = (g: GesteDeLEpingle) => g.epingle === null || dansLaFrance(g.epingle)

export const REGLE_DE_L_EPINGLE: RegleQuiTranche<EpingleTiree, EtatDeLEpingle, GesteDeLEpingle, EpingleMontree, EpingleRevelee> = {
  cle: 'epingle',
  etapes: 1,
  dureeMs: () => DUREES_DES_JEUX.epingle * 1000,

  ouvrir: () => ({ zone: null }),

  lireLeGeste(brut) {
    const g = champsDuGeste(brut)
    if (g?.quoi !== 'repondre') return null
    const r = reponseEnvoyee(g, 'epingle')
    // Rien de planté : la page envoie à l'échéance ce qu'elle a, et parfois rien.
    if (r === undefined) return { quoi: 'repondre', epingle: null }
    if (r === null || typeof r.lat !== 'number' || typeof r.lon !== 'number' || !Number.isFinite(r.lat) || !Number.isFinite(r.lon)) return null
    const epingle = { lat: r.lat, lon: r.lon }
    // Envoyée d'elle-même à l'échéance, une épingle hors de France ne se refuse pas : la page insisterait
    // sans fin sur un refus. Elle ne compte pas, comme une épingle qu'il n'aurait pas plantée.
    return { quoi: 'repondre', epingle: g.auto === true && !dansLaFrance(epingle) ? null : epingle }
  },

  tranche: (_t, _e, g) => tranche(g),

  apresLeGeste: (_t, _e, g) => (tranche(g) ? GESTE_A_JUGER : 'Plante ton épingle en France'),

  juger(t, _e, reponse) {
    // Expirée, quittée, ou sans épingle : ce que la page tenait, le serveur ne l'a jamais eu.
    const epingle = typeof reponse === 'object' ? reponse.epingle : null
    if (!epingle) return { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] }
    const km = distanceKm(epingle, t.lieu)
    const naturel = etoilesDeLaDistance(km)
    const juste = justeDeLaPiece(naturel, 'epingle') === true
    return { naturel, pieces: [{ juste, choix: choixDe(true, juste), composee: composee(epingle, km) }] }
  },

  // Une zone par manche : une seconde ne dirait rien de plus que la première. Le hasard du pli n'y entre pas (`epingleTiree`).
  eclairer: (t, e) => (e.zone ? rienAEclairer('epingle') : { ...e, zone: zoneDEclairer(t.lieu, t.decalage) }),

  montrer: (t, e) => ({
    jeu: 'epingle',
    date: t.lieu.date,
    theme: t.lieu.theme,
    recit: t.lieu.recit,
    question: t.lieu.question,
    zone: e.zone ? { ...e.zone } : null,
  }),

  reveler(t, e, v) {
    const lu = relue(v.pieces[0]?.composee)
    const l = t.lieu
    return {
      jeu: 'epingle',
      // `formatNumber`, jamais `toLocaleString` : la règle `client.md`.
      titre: lu ? `À ${formatNumber(lu.km)} km` : 'Pas d’épingle',
      km: lu?.km ?? null,
      epingle: lu?.epingle ?? null,
      lieu: { nom: l.nom, commune: l.commune, departement: l.departement, date: l.date, lat: l.lat, lon: l.lon },
      zone: e.zone ? { ...e.zone } : null,
      savais: l.savais,
    }
  },

  piece: (t, _e, _v, i) =>
    pieceDuContenu({ id: idDuLieu(t.lieu.id), texte: t.lieu.question, reponse: reponseDite(t.lieu), categorie: t.lieu.categorie, anecdote: t.lieu.savais }, 'epingle', i),

  cartel: t => ({ sujet: t.lieu.question, reponse: reponseDite(t.lieu), anecdote: t.lieu.savais }),
}
