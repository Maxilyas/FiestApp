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
//
// Les indices (le 11 novembre 2026 — « c'est parfois des choses qu'on n'arrive
// pas à savoir », et l'idée du propriétaire : un texte qui se déroule, de plus
// en plus précis, pendant que les étoiles baissent). Deux par lieu, qu'il
// demande quand il veut, comme un pas en arrière au Détail : sa piste, écrite —
// le coin de France —, puis son repère, calculé au tirage — sa place dite par
// une ville de la carte, dans les mots mêmes où la page dit celle de l'épingle
// (`villesReperes.ts`). Chacun retire une étoile de ce que la manche met en jeu
// (`ETOILES_AUX_INDICES_DE_L_EPINGLE`) ; la distance décide sous ce plafond. Ils
// se figent dans le tirage (`EpingleTiree.indices`) : un tirage d'avant n'en a
// pas, et sa manche se rejoue telle qu'elle s'est jouée — aucune version du
// départ. Demandés, pas minutés : un indice qui tomberait de lui-même prendrait
// une étoile à qui vise encore, et un plafond qui baisse avec le temps voudrait
// un chrono par indice, que le serveur seul peut tenir.

import { DECALAGE_DE_LA_ZONE_KM, DUREES_DES_JEUX, ETOILES_AUX_INDICES_DE_L_EPINGLE, KM_DE_L_EPINGLE, RAYON_D_ECLAIRER_KM } from '../bareme'
import type { Lieu } from '../contenu'
import { dansLaFrance, distanceKm, type Point } from '../france'
import { idDuLieu } from '../pieces'
import { formatNumber } from '../../typographie'
import { GESTE_A_JUGER, champsDuGeste, choixDe, naturelDe, pieceDuContenu, reponseEnvoyee, rienAEclairer, type RegleQuiTranche } from './outils'
import { justeDeLaPiece, type VerdictDUneManche } from './regle'

/**
 * Où Éclairer posera le centre de sa zone, depuis le lieu — une direction en
 * degrés (le nord à 0, l'est à 90), une distance en kilomètres —, et le rayon
 * qu'elle aura, toujours plus grand que la distance : figés ensemble au tirage,
 * une zone relue au barème du jour se serait rétrécie sous un décalage tiré plus
 * loin, et aurait laissé le lieu dehors.
 */
export interface DecalageDeLaZone {
  cap: number
  km: number
  rayonKm: number
}

/** Ce que le départ fige d'une manche de l'Épingle : le lieu entier, sa réponse comprise, et le décalage de sa zone — rien ne quitte le serveur avant le verdict. */
export interface EpingleTiree {
  jeu: 'epingle'
  /** Son thème est celui de la manche : une rechange de Changer vient d'un autre thème, et le dit. */
  lieu: Lieu
  /** Avec le centre de la zone, que la page reçoit, il redonnerait le lieu : il ne part jamais. */
  decalage: DecalageDeLaZone
  /**
   * Ses indices, du plus large au plus précis, figés au tirage : la piste du lieu, puis son repère. Absents d'un tirage
   * d'avant le 11 novembre 2026, ou d'un lieu sans piste : la manche se joue sans, comme avant.
   */
  indices?: readonly string[]
  /**
   * Ce que la manche met en jeu sans indice, puis après chacun (`ETOILES_AUX_INDICES_DE_L_EPINGLE`), figé avec eux :
   * une partie jouée se relit à son barème — son cartel, « Mes réponses » —, quel que soit celui du jour.
   */
  etoilesAuxIndices?: readonly number[]
}

/** La zone qu'Éclairer entoure : un cercle qui contient le lieu, sans être centré sur lui. */
export interface ZoneDEclairer extends Point {
  rayonKm: number
}

/** Ce que le serveur sait d'une manche avant sa réponse : la zone éclairée, s'il l'a demandée, et ses indices demandés. L'épingle, la page la tient seule. */
export interface EtatDeLEpingle {
  zone: ZoneDEclairer | null
  /** Combien d'indices il a demandés ; absent : aucun. */
  indices?: number
}

/** « Planter ici », ou l'envoi de l'échéance : l'épingle posée, ou aucune ; « Un indice », qui ne tranche rien. */
export type GesteDeLEpingle = { quoi: 'repondre'; epingle: Point | null } | { quoi: 'indice' }

/** Ce que la page reçoit : « 1429 · Les grands sièges », le récit, la question — jamais le lieu, ni ce qui le situe au-delà des indices qu'il a demandés. */
export interface EpingleMontree {
  jeu: 'epingle'
  date: string
  theme: string
  recit: string
  question: string
  zone: ZoneDEclairer | null
  /** Les indices qu'il a demandés, dans l'ordre : ceux-là seuls — le suivant ne part qu'à sa demande. */
  indices: string[]
  /** Ce que la manche met en jeu à présent, la distance décidant dessous. */
  enJeu: number
  /** Les indices qu'il peut encore demander. */
  aDemander: number
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
  /** Les indices qu'il avait demandés : ce que la manche mettait en jeu se lit à leur nombre. */
  indices: string[]
  /** « Le savais-tu ? » */
  savais: string
}

/** Les indices qu'un tirage porte : aucun pour un tirage d'avant eux. */
const indicesDe = (t: EpingleTiree): readonly string[] => t.indices ?? []
/** Ceux qu'il a demandés, bornés à ceux du tirage. */
const demandes = (t: EpingleTiree, e: EtatDeLEpingle): string[] => indicesDe(t).slice(0, e.indices ?? 0)

/**
 * Ce qu'une manche met en jeu après tant d'indices (`ETOILES_AUX_INDICES_DE_L_EPINGLE`) : trois étoiles sans aucun, une
 * de moins à chacun, jamais zéro — un indice coûte une étoile, pas la manche. Au barème que le tirage a figé, quand il
 * en porte un.
 */
export function etoilesEnJeu(indices: number, bareme: readonly number[] = ETOILES_AUX_INDICES_DE_L_EPINGLE): VerdictDUneManche['naturel'] {
  return naturelDe(bareme[Math.min(Math.max(0, indices), bareme.length - 1)])
}

/** Ce que cette manche met en jeu, au barème de son tirage. */
const enJeuDe = (t: EpingleTiree, e: EtatDeLEpingle) => etoilesEnJeu(demandes(t, e).length, t.etoilesAuxIndices)

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
 * `DECALAGE_DE_LA_ZONE_KM`, deux tirages dans cet ordre —, avec son rayon
 * (`RAYON_D_ECLAIRER_KM`). Tiré ici, au départ, même si Éclairer ne sert
 * jamais. `hasard` est celui du tireur, que la page ne peut pas refaire —
 * jamais celui de la graine de la partie : qui la saurait referait le
 * décalage, et du centre de la zone remonterait au lieu. Elle est un secret du
 * serveur ; figé ici, le décalage ne tient même pas à ce secret. Ses indices,
 * le tireur les donne — la piste du lieu, puis le repère qu'il calcule
 * (`indicesDuLieu`, `core/cabinet/tirages/epingle.ts`) — : sans eux, rien ne
 * change au hasard tiré, et un plan d'essai garde le sien.
 */
export function epingleTiree(lieu: Lieu, hasard: () => number, indices?: readonly string[]): EpingleTiree {
  const cap = hasard() * 360
  const [pres, loin] = DECALAGE_DE_LA_ZONE_KM
  return {
    jeu: 'epingle',
    lieu,
    decalage: { cap, km: pres + hasard() * (loin - pres), rayonKm: RAYON_D_ECLAIRER_KM },
    ...(indices && indices.length > 0 && { indices: [...indices], etoilesAuxIndices: [...ETOILES_AUX_INDICES_DE_L_EPINGLE] }),
  }
}

/**
 * La zone qu'Éclairer entoure : le rayon figé au tirage autour du centre que
 * le départ a décalé du lieu — jamais le barème du jour : une partie commencée
 * garde la zone qu'elle a tirée. Le décalage reste sous le rayon : le lieu est
 * toujours dedans ; il n'est jamais nul : le centre ne dit pas où il est.
 */
export function zoneDEclairer(lieu: Point, decalage: DecalageDeLaZone): ZoneDEclairer {
  const centre = pointADistance(lieu, decalage.km, decalage.cap)
  return { lat: centre.lat, lon: centre.lon, rayonKm: decalage.rayonKm }
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

/** Plantée hors du cadre, l'épingle se refuse en mots (`apresLeGeste`) : il la replante, et la manche continue. Un indice ne tranche rien. */
const tranche = (g: GesteDeLEpingle) => g.quoi === 'repondre' && (g.epingle === null || dansLaFrance(g.epingle))

/** Les refus d'un indice : la page n'en propose pas quand il n'en reste pas, et un double toucher sur le dernier arrive quand même. */
export const PLUS_D_INDICE = 'Plus d’indice : plante ton épingle'
export const PAS_D_INDICE = 'Pas d’indice pour ce lieu'

export const REGLE_DE_L_EPINGLE: RegleQuiTranche<EpingleTiree, EtatDeLEpingle, GesteDeLEpingle, EpingleMontree, EpingleRevelee> = {
  cle: 'epingle',
  etapes: 1,
  dureeMs: () => DUREES_DES_JEUX.epingle * 1000,

  ouvrir: () => ({ zone: null }),

  lireLeGeste(brut) {
    const g = champsDuGeste(brut)
    if (g?.quoi === 'indice') return { quoi: 'indice' }
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

  apresLeGeste(t, e, g) {
    if (g.quoi === 'indice') {
      const combien = indicesDe(t).length
      const deja = e.indices ?? 0
      if (deja >= combien) return combien === 0 ? PAS_D_INDICE : PLUS_D_INDICE
      return { ...e, indices: deja + 1 }
    }
    return tranche(g) ? GESTE_A_JUGER : 'Plante ton épingle en France'
  },

  juger(t, e, reponse) {
    // Expirée, quittée, ou sans épingle : ce que la page tenait, le serveur ne l'a jamais eu.
    const epingle = typeof reponse === 'object' && reponse.quoi === 'repondre' ? reponse.epingle : null
    if (!epingle) return { naturel: 0, pieces: [{ juste: false, choix: null, composee: null }] }
    const km = distanceKm(epingle, t.lieu)
    // La distance décide, sous ce que ses indices ont laissé en jeu : au second, une étoile au plus.
    const naturel = naturelDe(Math.min(etoilesDeLaDistance(km), enJeuDe(t, e)))
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
    indices: demandes(t, e),
    enJeu: enJeuDe(t, e),
    aDemander: indicesDe(t).length - demandes(t, e).length,
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
      indices: demandes(t, e),
      savais: l.savais,
    }
  },

  piece: (t, _e, _v, i) =>
    pieceDuContenu({ id: idDuLieu(t.lieu.id), texte: t.lieu.question, reponse: reponseDite(t.lieu), categorie: t.lieu.categorie, anecdote: t.lieu.savais }, 'epingle', i),

  cartel: t => ({ sujet: t.lieu.question, reponse: reponseDite(t.lieu), anecdote: t.lieu.savais }),
}
