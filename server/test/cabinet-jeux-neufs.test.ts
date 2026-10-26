// L'Épingle, les Indices et la Réplique du Cabinet de curiosités, purs : leurs
// règles, sans serveur (les neuf jeux et leurs barèmes :
// `docs/produit/le-cabinet.md` ; le pourquoi de chaque choix :
// `docs/architecture/decisions.md`, « Le Cabinet de curiosités »). Les trois
// jeux du contenu neuf — des lieux datés, des fiches « Qui suis-je ? », des
// répliques —, que la base de la campagne n'a pas. L'Épingle : un récit,
// « Où ? », une épingle plantée sur la carte de France, jugée à sa distance.
// Les Indices : cinq indices, du plus obscur au plus évident ; chaque indice vu
// et chaque erreur coûtent. La Réplique : le mot qui manque, puis qui l'a dite,
// chaque étape son chrono.
//
// Les exemples sont fabriqués ici : le contenu livré a son juge et son test
// (`cabinet-contenu.test.ts`). Puis le tirage des trois au serveur, sur le
// contenu livré (`core/cabinet/tirages/`) — le jamais vu d'abord, l'Épingle
// à thème —, les trois par les routes, d'une partie entière, et tes murs : ce
// qu'il a épinglé et rangé, d'où qu'il vienne.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { inscrireProfil } from './banc'
import {
  DIX_HEURES,
  bancDuCabinet,
  baseDuCabinet,
  commencer,
  dossierDEssai,
  enBase,
  epingleDe,
  fermerLesMagasins,
  ficheDe,
  friseDe,
  jouer as unGeste,
  jouerDesIndices,
  jouerUneEpingle,
  jouerUneFrise,
  jouerUneReplique,
  lire as lireLaRoute,
  magasinDEssai,
  ok,
  ouvrir as ouvrirLaManche,
  piecesALaMain,
  questionDUneFrise,
  repliqueDe,
} from './cabinet-banc'
import { tirerLePlan, themeDuPlan, type ContexteDuTirage } from '../src/core/cabinet/tirages/index'
import { ENJEU_ORDINAIRE } from '../../shared/cabinet/partie'
import { uneFicheSouffleLAutre } from '../src/core/cabinet/tirages/indices'
import { uneRepliqueSouffleLAutre } from '../src/core/cabinet/tirages/replique'
import { contenuDuCabinet } from '../src/core/cabinet/contenu'
import { mursDe } from '../src/core/cabinet/vue'
import { lignesDesFrises } from '../src/core/frises'
import { hasardDe } from '../../shared/missions'
import type { Fiche, Lieu, Replique } from '../../shared/cabinet/contenu'
import { DANS_LA_FRANCE, distanceKm, type Point } from '../../shared/cabinet/france'
import {
  DECALAGE_DE_LA_ZONE_KM,
  DUREES_DES_JEUX,
  ETOILES_DE_LA_REPLIQUE,
  GRACE_D_UNE_MANCHE_MS,
  INDICES_DES_ETOILES,
  KM_DE_L_EPINGLE,
  LETTRES_POUR_UNE_FAUTE,
  MOTS_D_UNE_IDENTITE_MAX,
  RAYON_D_ECLAIRER_KM,
  VAGUES_DE_LA_FRISE,
} from '../../shared/cabinet/bareme'
import { effacablesAuPlus, refusDuPouvoir } from '../../shared/cabinet/pouvoirs'
import { PREFIXE_DU_CABINET, deplier, idDeLEclair, idDeLaFiche, idDeLaFriseATheme, idDeLaFriseDeSujet, idDeLaReplique, idDuLieu } from '../../shared/cabinet/pieces'
import type { Cartel, MursDuCabinet } from '../../shared/cabinet/vues'
import { PREFIXE_DE_LA_FRISE, type EvenementDeLaFrise } from '../../shared/frise'
import { justeDeLaPiece, type VerdictDUneManche } from '../../shared/cabinet/jeux/regle'
import { GESTE_A_JUGER } from '../../shared/cabinet/jeux/outils'
import {
  REGLE_DE_L_EPINGLE,
  epingleTiree,
  etoilesDeLaDistance,
  kmDits,
  pointADistance,
  zoneDEclairer,
  type EpingleMontree,
  type EpingleRevelee,
  type EpingleTiree,
  type EtatDeLEpingle,
} from '../../shared/cabinet/jeux/epingle'
import {
  QUESTION_DES_INDICES,
  REGLE_DES_INDICES,
  bonneIdentite,
  comptesDesIndices,
  etoilesDesIndices,
  type EtatDesIndices,
  type GesteDesIndices,
  type IndicesMontres,
  type IndicesReveles,
  type IndicesTires,
} from '../../shared/cabinet/jeux/indices'
import {
  REGLE_DE_LA_REPLIQUE,
  repliqueEntiere,
  repliqueTiree,
  type EtatDeLaReplique,
  type GesteDeLaReplique,
  type RepliqueMontreeAQui,
  type RepliqueRevelee,
  type RepliqueTiree,
} from '../../shared/cabinet/jeux/replique'

/** La phrase que dit la seule règle des refus quand la manche n'a plus rien à souffler : les jeux ne la recopient pas. */
const RIEN_A_ECLAIRER = refusDuPouvoir({ pouvoir: 'eclairer', force: 3, jeu: 'epingle', servi: 0, aEclairer: false })
/** … et à la Réplique, dont la manche a deux étapes : la question, que le refus nomme — la seconde s'éclaire encore. */
const RIEN_A_ECLAIRER_A_CETTE_QUESTION = refusDuPouvoir({ pouvoir: 'eclairer', force: 3, jeu: 'replique', servi: 0, aEclairer: false })

/** Un hasard d'essai qui rend toujours le même nombre. */
const toujours = (x: number) => () => x

/**
 * Le hasard qu'Éclairer reçoit du pli, rejoué de la graine de la partie et du
 * rang. Quand ces trois jeux se sont écrits, la graine était faite du profil
 * et de la partie (`${profileId}:${serieId}`), que la page connaît : ce qu'un
 * jeu en aurait tiré, elle l'aurait tiré aussi. Elle est devenue un secret du
 * serveur (`DepartDUnePartie.graine`, `cabinet-regles.test.ts`) ; ces trois-là
 * n'en tirent toujours rien — les deux remèdes se cumulent.
 */
const HASARD_DE_LA_GRAINE = () => {
  throw new Error('Éclairer a lu le hasard de la graine : ce qu’il dévoile se fige au départ')
}

/** Tous les nombres d'une vue, où qu'ils soient : une coordonnée ne se cherche pas en texte, une autre la contiendrait. */
const nombresDe = (x: unknown): number[] =>
  typeof x === 'number' ? [x] : typeof x === 'object' && x !== null ? Object.values(x).flatMap(nombresDe) : []

/** La seule pièce d'un verdict. */
const piece0 = (v: VerdictDUneManche) => {
  assert.equal(v.pieces.length, 1, 'une pièce par manche')
  return v.pieces[0]
}

// ── L'Épingle ─────────────────────────────────────────────────────────────

const ORLEANS: Lieu = {
  id: 'sieges-orleans',
  theme: 'Les grands sièges',
  nom: 'Les Tourelles',
  commune: 'Orléans',
  departement: 'Loiret',
  lat: 47.902,
  lon: 1.909,
  annee: 1429,
  date: '1429',
  recit: 'Une jeune fille venue de Lorraine fait lever le siège d’une ville que les Anglais tiennent depuis sept mois.',
  question: 'Où Jeanne lève-t-elle le siège ?',
  savais: 'La ville fête encore sa libération chaque printemps.',
  categorie: 'Histoire',
}

const lieuEn = (p: Point, i: number): Lieu => ({ ...ORLEANS, id: `lieu-${i}`, lat: p.lat, lon: p.lon })

/** Des lieux d'essai aux quatre coins : le nord, la pointe bretonne, l'Alsace, les Pyrénées, la Côte d'Azur, la Corse. */
const COINS: Point[] = [
  { lat: 47.902, lon: 1.909 },
  { lat: 50.629, lon: 3.057 },
  { lat: 48.39, lon: -4.486 },
  { lat: 48.573, lon: 7.752 },
  { lat: 42.699, lon: 2.895 },
  { lat: 43.703, lon: 7.266 },
  { lat: 41.919, lon: 8.738 },
  { lat: 41.387, lon: 9.159 },
]

/** Un plan d'essai : le décalage de sa zone, d'un hasard quelconque — le serveur tire le sien. */
const tireeA = (lieu: Lieu): EpingleTiree => epingleTiree(lieu, toujours(0.5))
const planter = (p: Point | null) => REGLE_DE_L_EPINGLE.lireLeGeste(p ? { quoi: 'repondre', reponse: { epingle: p } } : { quoi: 'repondre' }, tireeA(ORLEANS))!

test('l’Épingle : la distance à vol d’oiseau, et un point posé à tant de kilomètres', () => {
  // Paris – Lyon : 392 km à vol d'oiseau, la valeur qu'on lit partout.
  assert.ok(Math.abs(distanceKm({ lat: 48.8566, lon: 2.3522 }, { lat: 45.764, lon: 4.8357 }) - 392) < 2)
  assert.equal(distanceKm(ORLEANS, ORLEANS), 0)
  // Un point posé à tant de kilomètres, dans toutes les directions, se relit à la même distance par la haversine
  // qui juge : la zone d'Éclairer ne se calcule pas sur une autre Terre que l'épingle.
  for (const coin of COINS)
    for (let cap = 0; cap < 360; cap += 15)
      for (const km of [1, 40, 140, 300, 900]) {
        const p = pointADistance(coin, km, cap)
        assert.ok(Math.abs(distanceKm(coin, p) - km) < 1e-6, `${km} km au cap ${cap} depuis ${coin.lat},${coin.lon}`)
      }
  // Le nord est au cap 0, l'est au cap 90.
  assert.ok(pointADistance(ORLEANS, 100, 0).lat > ORLEANS.lat)
  assert.ok(pointADistance(ORLEANS, 100, 90).lon > ORLEANS.lon)
})

test('l’Épingle : à moins de 40 km ★★★, de 120 ★★, de 300 ★ — chaque bord compte pour l’étoile d’en dessous', () => {
  assert.deepEqual(KM_DE_L_EPINGLE, [40, 120, 300])
  assert.equal(etoilesDeLaDistance(0), 3)
  assert.equal(etoilesDeLaDistance(39.999), 3)
  // « À moins de 40 km » : 40 tout rond n'en est pas.
  assert.equal(etoilesDeLaDistance(40), 2)
  assert.equal(etoilesDeLaDistance(119.999), 2)
  assert.equal(etoilesDeLaDistance(120), 1)
  assert.equal(etoilesDeLaDistance(299.999), 1)
  assert.equal(etoilesDeLaDistance(300), 0)
  assert.equal(etoilesDeLaDistance(1200), 0)

  // Par le jugement, une épingle plantée à tant de kilomètres du lieu, d'un côté et de l'autre de chaque bord.
  const t = tireeA(ORLEANS)
  const e = REGLE_DE_L_EPINGLE.ouvrir(t)
  for (const [km, etoiles] of [[0.2, 3], [39.5, 3], [40.5, 2], [119.5, 2], [120.5, 1], [299.5, 1], [300.5, 0]] as const) {
    const v = REGLE_DE_L_EPINGLE.juger(t, e, planter(pointADistance(ORLEANS, km, 200)))
    assert.equal(v.naturel, etoiles, `${km} km`)
    const p = piece0(v)
    // Juste dès deux étoiles : à moins de 120 km.
    assert.equal(p.juste, km < 120, `${km} km : juste ?`)
    assert.equal(p.juste, justeDeLaPiece(v.naturel, 'epingle'))
    assert.equal(p.choix, p.juste ? 0 : -1)
  }
})

test('l’Épingle : la distance dite ne contredit jamais ses étoiles', () => {
  // 119,6 km arrondis à 120 se seraient lus « À 120 km » sous ★★, que « à moins de 120 km » promet : on tronque.
  assert.equal(kmDits(119.6), 119)
  assert.equal(kmDits(39.99), 39)
  assert.equal(kmDits(40), 40)
  const t = tireeA(ORLEANS)
  const e = REGLE_DE_L_EPINGLE.ouvrir(t)
  for (let km = 0.5; km < 400; km += 7.3) {
    const v = REGLE_DE_L_EPINGLE.juger(t, e, planter(pointADistance(ORLEANS, km, km * 3)))
    const revele = REGLE_DE_L_EPINGLE.reveler(t, e, v)
    assert.ok(revele.km !== null)
    assert.equal(etoilesDeLaDistance(revele.km!), v.naturel, `${km} km se dit « ${revele.titre} »`)
  }
})

/** Des lieux d'essai : les coins, puis des lieux tirés partout dans le cadre de la France — la mer comprise : le cadre la touche. */
function lieuxDEssai(n: number): Point[] {
  const h = hasardDe('cabinet-epingle-zone')
  return Array.from({ length: n }, (_, i) =>
    i < COINS.length ? COINS[i] : { lat: DANS_LA_FRANCE.latMin + h() * (DANS_LA_FRANCE.latMax - DANS_LA_FRANCE.latMin), lon: DANS_LA_FRANCE.lonMin + h() * (DANS_LA_FRANCE.lonMax - DANS_LA_FRANCE.lonMin) },
  )
}

test('l’Épingle : Éclairer entoure une zone de 300 km qui contient toujours le lieu, sans jamais le dire — mille hasards', () => {
  // 300 km, son centre à 120 à 294 km du lieu, depuis le 26 octobre 2026 — 170 km et 40 à 140 avant : planter au centre
  // valait ★★ quatre fois sur cinq, et trois zones gagnaient une commune 91 fois sur 100 sans rien savoir (la tablée du
  // 25 octobre 2026).
  assert.equal(RAYON_D_ECLAIRER_KM, 300)
  assert.deepEqual(DECALAGE_DE_LA_ZONE_KM, [120, 294])
  const [loin, plusLoin] = DECALAGE_DE_LA_ZONE_KM
  let auNord = 0
  for (const [i, point] of lieuxDEssai(1000).entries()) {
    // Mille hasards du tireur : le décalage de la zone se tire au départ, avec le lieu — et son rayon.
    const t = epingleTiree(lieuEn(point, i), hasardDe(`zone:${i}`))
    assert.equal(t.decalage.rayonKm, RAYON_D_ECLAIRER_KM, 'le rayon se fige avec le décalage')
    const e = REGLE_DE_L_EPINGLE.eclairer(t, REGLE_DE_L_EPINGLE.ouvrir(t), HASARD_DE_LA_GRAINE)
    assert.ok(typeof e !== 'string', 'la première fois, Éclairer sert')
    const zone = e.zone!
    assert.equal(zone.rayonKm, RAYON_D_ECLAIRER_KM)
    const ecart = distanceKm(zone, point)
    assert.ok(ecart <= zone.rayonKm, `${i} : le lieu est dans la zone (${ecart} km du centre)`)
    // Ni au centre, ni au bord : le centre décalé de 120 à 294 km ne dit pas où est le lieu.
    assert.ok(ecart >= loin - 1e-6 && ecart <= plusLoin + 1e-6, `${i} : le centre à ${ecart} km du lieu`)
    if (zone.lat > point.lat) auNord++
  }
  // Une direction tirée : le centre n'est pas toujours du même côté.
  assert.ok(auNord > 350 && auNord < 650, `${auNord} centres au nord du lieu`)

  // Aux deux bouts du hasard, la zone le contient encore.
  for (const x of [0, 0.999999]) {
    const zone = zoneDEclairer(ORLEANS, epingleTiree(ORLEANS, toujours(x)).decalage)
    assert.ok(distanceKm(zone, ORLEANS) <= RAYON_D_ECLAIRER_KM)
  }
  // Le rayon d'un tirage est le sien, jamais celui du barème du jour : une partie tirée à 170 km se rejoue à 170 —
  // relu au barème, un rayon changé aurait redessiné la zone des parties déjà jouées, et leur cartel avec.
  const ancienne = { ...epingleTiree(ORLEANS, hasardDe('ancienne')), decalage: { cap: 90, km: 100, rayonKm: 170 } }
  const zone = (REGLE_DE_L_EPINGLE.eclairer(ancienne, REGLE_DE_L_EPINGLE.ouvrir(ancienne), HASARD_DE_LA_GRAINE) as EtatDeLEpingle).zone!
  assert.equal(zone.rayonKm, 170)
  assert.ok(Math.abs(distanceKm(zone, ORLEANS) - 100) < 1, 'son décalage, tel qu’il a été tiré')
})

test('l’Épingle : la zone se fige au départ — un rechargement la redonne, et la graine n’en dit rien', () => {
  const t = tireeA(ORLEANS)
  const e = REGLE_DE_L_EPINGLE.ouvrir(t)
  // Un rechargement redonne la même zone : elle vient du plan, que la reprise relit — le hasard qu'on passe n'y entre pas.
  const a = REGLE_DE_L_EPINGLE.eclairer(t, e, HASARD_DE_LA_GRAINE)
  const b = REGLE_DE_L_EPINGLE.eclairer(t, e, hasardDe('partie:eclairer:3'))
  assert.deepEqual(a, b)
  assert.ok(typeof a !== 'string')
  assert.equal(REGLE_DE_L_EPINGLE.eclairer(t, a, HASARD_DE_LA_GRAINE), RIEN_A_ECLAIRER, 'une zone par manche')

  // La page sait sa graine — son profil, sa partie — et le rang qu'elle envoie. Tirée de ce hasard-là, la zone
  // se défaisait : la page refaisait le cap et le décalage, remontait du centre, et retrouvait le lieu au
  // kilomètre près, à chaque fois. Tirée au départ, du hasard du serveur, elle ne se défait plus.
  const [pres, loin] = DECALAGE_DE_LA_ZONE_KM
  const remonter = (centre: Point, km: number, cap: number): Point => {
    let p = centre
    for (let k = 0; k < 30; k++) {
      const q = pointADistance(p, km, cap)
      p = { lat: p.lat - (q.lat - centre.lat), lon: p.lon - (q.lon - centre.lon) }
    }
    return p
  }
  let retrouves = 0
  const lieux = lieuxDEssai(300)
  for (const [i, point] of lieux.entries()) {
    const graine = `profil-${i}:serie-${i}`
    const plan = epingleTiree(lieuEn(point, i), hasardDe(`le-serveur:${i}`))
    const zone = (REGLE_DE_L_EPINGLE.eclairer(plan, REGLE_DE_L_EPINGLE.ouvrir(plan), hasardDe(`${graine}:eclairer:4`)) as EtatDeLEpingle).zone!
    const h = hasardDe(`${graine}:eclairer:4`)
    const cap = h() * 360
    const devine = remonter(zone, pres + h() * (loin - pres), cap)
    if (distanceKm(devine, point) < 5) retrouves++
  }
  assert.ok(retrouves <= lieux.length / 100, `${retrouves} lieux sur ${lieux.length} retrouvés de la zone et de la graine`)
})

test('l’Épingle : une épingle se plante en France, et la page n’en apprend rien avant la révélation', () => {
  const t = tireeA(ORLEANS)
  const e = REGLE_DE_L_EPINGLE.ouvrir(t)
  // Illisible : ni nombres finis, ni épingle, ni réponse de ce jeu.
  for (const brut of [
    null,
    'repondre',
    { quoi: 'repondre', reponse: { epingle: { lat: '47', lon: 1.9 } } },
    { quoi: 'repondre', reponse: { epingle: { lat: Number.NaN, lon: 1.9 } } },
    { quoi: 'repondre', reponse: { epingle: { lat: 47, lon: Number.POSITIVE_INFINITY } } },
    { quoi: 'repondre', reponse: { epingle: [47, 1.9] } },
    { quoi: 'repondre', reponse: { filet: { x: 3 } } },
    { quoi: 'repondre', reponse: { epingle: null, constructor: {} } },
    { quoi: 'reculer' },
  ])
    assert.equal(REGLE_DE_L_EPINGLE.lireLeGeste(brut, t), null, JSON.stringify(brut))

  // Hors du cadre de la France : refusée en mots, rien ne se juge — la page la replante.
  const londres = REGLE_DE_L_EPINGLE.lireLeGeste({ quoi: 'repondre', reponse: { epingle: { lat: 51.507, lon: -0.128 } } }, t)!
  assert.equal(REGLE_DE_L_EPINGLE.tranche(t, e, londres), false)
  assert.equal(REGLE_DE_L_EPINGLE.apresLeGeste(t, e, londres), 'Plante ton épingle en France')
  // Envoyée d'elle-même à l'échéance, elle ne s'y refuse pas — la page insisterait sans fin : pas d'épingle.
  const auto = REGLE_DE_L_EPINGLE.lireLeGeste({ quoi: 'repondre', auto: true, reponse: { epingle: { lat: 51.507, lon: -0.128 } } }, t)!
  assert.equal(REGLE_DE_L_EPINGLE.tranche(t, e, auto), true)
  const v = REGLE_DE_L_EPINGLE.juger(t, e, auto)
  assert.equal(v.naturel, 0)
  assert.deepEqual(piece0(v), { juste: false, choix: null, composee: null })
  assert.equal(REGLE_DE_L_EPINGLE.reveler(t, e, v).titre, 'Pas d’épingle')

  // Une épingle en France tranche, et ne passe jamais par `apresLeGeste`.
  const ici = planter({ lat: 47.8, lon: 2.1 })
  assert.equal(REGLE_DE_L_EPINGLE.tranche(t, e, ici), true)
  assert.equal(REGLE_DE_L_EPINGLE.apresLeGeste(t, e, ici), GESTE_A_JUGER)

  // Invariant 1 : ni le nom, ni la commune, ni le département, ni les coordonnées du lieu — même éclairée.
  const eclairee = REGLE_DE_L_EPINGLE.eclairer(t, e, hasardDe('secret')) as EtatDeLEpingle
  for (const etat of [e, eclairee]) {
    const montree = REGLE_DE_L_EPINGLE.montrer(t, etat)
    const vue = JSON.stringify(montree)
    for (const secret of [ORLEANS.nom, ORLEANS.commune, ORLEANS.departement, ORLEANS.savais]) assert.ok(!vue.includes(secret), `la manche montre « ${secret} »`)
    for (const n of nombresDe(montree)) assert.ok(n !== ORLEANS.lat && n !== ORLEANS.lon, `la manche montre ${n}, une coordonnée du lieu`)
    // Ni le décalage de la zone : avec le centre, il redonnerait le lieu.
    for (const n of nombresDe(montree)) assert.ok(n !== t.decalage.cap && n !== t.decalage.km, `la manche montre ${n}, le décalage de la zone`)
    assert.equal(montree.question, ORLEANS.question)
    assert.equal(montree.recit, ORLEANS.recit)
    assert.equal(montree.date, '1429')
    assert.equal(montree.theme, 'Les grands sièges')
  }
  assert.equal(REGLE_DE_L_EPINGLE.montrer(t, e).zone, null)
  assert.deepEqual(REGLE_DE_L_EPINGLE.montrer(t, eclairee).zone, eclairee.zone)
})

test('l’Épingle : la révélation, la pièce, le cartel ; sans épingle, rien', () => {
  const t = tireeA(ORLEANS)
  const e = REGLE_DE_L_EPINGLE.ouvrir(t)
  const pin = pointADistance(ORLEANS, 37.4, 45)
  const v = REGLE_DE_L_EPINGLE.juger(t, e, planter(pin))
  assert.equal(v.naturel, 3)
  const p = piece0(v)
  assert.equal(p.juste, true)
  // `composee` : l'épingle et la distance dite, de quoi refaire la révélation d'une partie finie (invariant 14).
  assert.match(p.composee!, /^-?\d+(\.\d+)?,-?\d+(\.\d+)?\|37$/)
  const revele = REGLE_DE_L_EPINGLE.reveler(t, e, v)
  assert.equal(revele.titre, 'À 37 km')
  assert.equal(revele.km, 37)
  assert.ok(distanceKm(revele.epingle!, pin) < 0.2, 'l’épingle relue à cent mètres près')
  assert.deepEqual(revele.lieu, { nom: 'Les Tourelles', commune: 'Orléans', departement: 'Loiret', date: '1429', lat: 47.902, lon: 1.909 })
  assert.equal(revele.savais, ORLEANS.savais)

  const piece = REGLE_DE_L_EPINGLE.piece(t, e, v, { manche: 1, tirage: 4 })
  assert.equal(piece.id, idDuLieu('sieges-orleans'))
  assert.equal(piece.id, 'cab:lieu:sieges-orleans')
  assert.equal(piece.forme, 'epingle')
  assert.equal(piece.texte, ORLEANS.question)
  assert.deepEqual(piece.reponses, ['Orléans (Loiret), 1429'])
  assert.equal(piece.bonne, 0)
  assert.equal(piece.categorie, 'Histoire')
  assert.equal(piece.anecdote, ORLEANS.savais)
  assert.equal(piece.niveau, 'moyen', 'un lieu n’a pas de marche mesurée')
  assert.deepEqual(piece.cabinet, { jeu: 'epingle', manche: 1, tirage: 4 })
  assert.deepEqual(REGLE_DE_L_EPINGLE.cartel(t, v), { sujet: ORLEANS.question, reponse: 'Orléans (Loiret), 1429', anecdote: ORLEANS.savais })

  // Expirée ou quittée : ce que la page tenait ne compte pas — l'épingle, le serveur ne l'a jamais eue.
  for (const fin of ['expiree', 'quittee'] as const) {
    const rien = REGLE_DE_L_EPINGLE.juger(t, e, fin)
    assert.equal(rien.naturel, 0)
    assert.deepEqual(piece0(rien), { juste: false, choix: null, composee: null })
    const r = REGLE_DE_L_EPINGLE.reveler(t, e, rien)
    assert.equal(r.titre, 'Pas d’épingle')
    assert.equal(r.km, null)
    assert.equal(r.epingle, null)
  }
  // Le chrono : 45 s, une étape.
  assert.equal(REGLE_DE_L_EPINGLE.etapes, 1)
  assert.equal(REGLE_DE_L_EPINGLE.dureeMs(1), DUREES_DES_JEUX.epingle * 1000)
})

// ── Les Indices ───────────────────────────────────────────────────────────

const HUGO: Fiche = {
  id: 'lettres-victor-hugo',
  reponse: 'Victor Hugo',
  cles: ['hugo'],
  indices: [
    'Exilé dans une île anglo-normande, j’y ai écrit pendant près de vingt ans.',
    'J’ai fait d’un bossu le héros d’un roman de cathédrale.',
    'Ma fille Léopoldine s’est noyée dans la Seine, et je l’ai pleurée en vers.',
    'J’ai écrit l’histoire de Jean Valjean.',
    'Mon cercueil a traversé Paris jusqu’au Panthéon, en 1885.',
  ],
  savais: 'Un million de personnes ont suivi ses funérailles.',
  categorie: 'Arts & lettres',
}
const VOLTAIRE: Fiche = { ...HUGO, id: 'lettres-voltaire', reponse: 'Voltaire', cles: ['voltaire', 'arouet'] }
const JEANNE: Fiche = { ...HUGO, id: 'histoire-jeanne-d-arc', reponse: 'Jeanne d’Arc', cles: ['jeanne', 'arc'] }
const DE_GAULLE: Fiche = { ...HUGO, id: 'histoire-de-gaulle', reponse: 'Charles de Gaulle', cles: ['gaulle'] }

test('les Indices : une bonne identité, sans casse ni accents, une faute de frappe tolérée dès cinq lettres', () => {
  for (const ok of ['Victor Hugo', 'victor hugo', 'HUGO', 'Hugo', '  Victor   Hugo ', 'Victor-Hugo', 'Hugo Victor', 'Hûgo']) assert.ok(bonneIdentite(ok, HUGO), ok)
  // La faute se compte au mot attendu : cinq lettres au moins, une lettre changée, oubliée, ajoutée ou deux voisines inversées.
  assert.equal(LETTRES_POUR_UNE_FAUTE, 5)
  for (const ok of ['Voltaire', 'voltaïre', 'Voltair', 'Voltaier', 'Volatire', 'Voltaare', 'Vooltaire', 'Arouet', 'Arouer']) assert.ok(bonneIdentite(ok, VOLTAIRE), ok)
  for (const ko of ['Votlaier', 'Vltaier', 'Volt']) assert.ok(!bonneIdentite(ko, VOLTAIRE), ko)
  // Sous cinq lettres, chaque lettre compte : « Hugi » n'est pas Hugo.
  for (const ko of ['Hugi', 'Hgo', 'Hugoo', 'Victor Hugi']) assert.ok(!bonneIdentite(ko, HUGO), ko)
  // Et « Victir Hugo » : « victor » a six lettres, la faute passe.
  assert.ok(bonneIdentite('Victir Hugo', HUGO))
})

test('les Indices : les lettres que les accents ne décomposent pas s’ouvrent — une fiche accepte toujours sa propre réponse', () => {
  // « ł », « ø », « ß » ne sont pas un « l », un « o », un « s » et leur accent : laissés tels, ils coupaient le mot
  // (« Wałęsa » en « wa » et « esa »), et la réponse exacte se refusait.
  const WALESA: Fiche = { ...HUGO, id: 'histoire-walesa', reponse: 'Lech Wałęsa', cles: ['walesa'] }
  const KIERKEGAARD: Fiche = { ...HUGO, id: 'lettres-kierkegaard', reponse: 'Søren Kierkegaard', cles: ['kierkegaard'] }
  const STRAUSS: Fiche = { ...HUGO, id: 'musique-strauss', reponse: 'Johann Strauß', cles: ['Strauß'] }
  for (const ok of ['Lech Wałęsa', 'Wałęsa', 'Lech Walesa', 'walesa', 'WAŁĘSA']) assert.ok(bonneIdentite(ok, WALESA), ok)
  for (const ok of ['Søren Kierkegaard', 'Soren Kierkegaard', 'Kierkegaard', 'SØREN KIERKEGAARD']) assert.ok(bonneIdentite(ok, KIERKEGAARD), ok)
  for (const ok of ['Johann Strauß', 'Johann Strauss', 'Strauss', 'STRAUSS']) assert.ok(bonneIdentite(ok, STRAUSS), ok)
  for (const f of [HUGO, VOLTAIRE, JEANNE, DE_GAULLE, WALESA, KIERKEGAARD, STRAUSS]) assert.ok(bonneIdentite(f.reponse, f), `« ${f.reponse} » pour sa propre fiche`)
})

test('les Indices : la réponse fourre-tout reste fermée — au moins une clé, rien d’autre que le nom, quatre mots au plus', () => {
  // Sans une clé, pas d'identité : « Victor » seul trouverait tous les Victor.
  assert.ok(!bonneIdentite('Victor', HUGO))
  // Chaque mot doit appartenir au nom ou aux clés : une liste de noms n'est pas une réponse.
  for (const ko of ['Hugo Zola Balzac', 'Hugo ou Zola', 'un poète', 'Victor Hugo, Émile Zola', 'Hugo 1802']) assert.ok(!bonneIdentite(ko, HUGO), ko)
  assert.equal(MOTS_D_UNE_IDENTITE_MAX, 4)
  const tropLong: Fiche = { ...HUGO, reponse: 'Marie Joseph Paul Yves Roch Gilbert du Motier de La Fayette', cles: ['fayette', 'lafayette'] }
  assert.ok(bonneIdentite('Gilbert du Motier de La Fayette', tropLong), 'les mots vides ne comptent pas : trois mots')
  assert.ok(bonneIdentite('Marie Joseph Gilbert Fayette', tropLong), 'quatre mots')
  assert.ok(!bonneIdentite('Marie Joseph Paul Gilbert Fayette', tropLong), 'cinq mots, c’est trop')
  // Les mots vides s'écartent : « Jeanne d’Arc », « Charles de Gaulle », « De Gaulle ».
  for (const ok of ['Jeanne d’Arc', "Jeanne d'Arc", 'jeanne d arc', 'Arc', 'Jeanne']) assert.ok(bonneIdentite(ok, JEANNE), ok)
  for (const ok of ['Charles de Gaulle', 'De Gaulle', 'de gaulle', 'Gaulle']) assert.ok(bonneIdentite(ok, DE_GAULLE), ok)
  for (const ko of ['', '   ', 'de', 'de la', 'le général de Gaulle']) assert.ok(!bonneIdentite(ko, DE_GAULLE), `« ${ko} »`)
})

const fiche = (f: Fiche): IndicesTires => ({ jeu: 'indices', fiche: f })
const geste = (t: IndicesTires, brut: unknown) => REGLE_DES_INDICES.lireLeGeste(brut, t)!

/** Joue des gestes qui ne tranchent pas, chacun relu comme la page l'envoie. */
function jouer(t: IndicesTires, gestes: unknown[]): EtatDesIndices {
  let e = REGLE_DES_INDICES.ouvrir(t)
  for (const brut of gestes) {
    const g = geste(t, brut)
    assert.equal(REGLE_DES_INDICES.tranche(t, e, g), false, JSON.stringify(brut))
    const apres = REGLE_DES_INDICES.apresLeGeste(t, e, g)
    assert.ok(typeof apres !== 'string', `${JSON.stringify(brut)} : ${String(apres)}`)
    e = apres
  }
  return e
}

test('les Indices : les indices vus, moins les offerts, plus les erreurs — 2 ★★★, 4 ★★, au-delà ★', () => {
  // Élargi d'un cran au calibrage du 25 octobre 2026 (2/3 → 3/4), sur un modèle où le rang de la reconnaissance ne
  // dépendait pas de la force du joueur ; corrigé, la tablée y faisait 8,75 étoiles sur 9 : ★★★ en un ou deux indices
  // depuis le 26 octobre 2026.
  assert.deepEqual(INDICES_DES_ETOILES, [2, 4])
  assert.equal(etoilesDesIndices(1), 3)
  assert.equal(etoilesDesIndices(2), 3)
  assert.equal(etoilesDesIndices(3), 2)
  assert.equal(etoilesDesIndices(4), 2)
  assert.equal(etoilesDesIndices(5), 1)
  assert.equal(etoilesDesIndices(9), 1)

  const t = fiche(HUGO)
  const trouver = (e: EtatDesIndices) => {
    const g = geste(t, { quoi: 'nom', texte: 'Victor Hugo' })
    assert.equal(REGLE_DES_INDICES.tranche(t, e, g), true, 'le bon nom tranche')
    return REGLE_DES_INDICES.juger(t, e, g)
  }
  // Le premier indice d'office : trouvé tout de suite, ★★★.
  const ouverte = REGLE_DES_INDICES.ouvrir(t)
  assert.deepEqual(ouverte, { vus: 1, offerts: 0, essais: [] })
  assert.equal(trouver(ouverte).naturel, 3)
  // Un indice de plus : deux vus, encore ★★★ ; un troisième, ★★ ; un quatrième, encore ★★.
  assert.equal(trouver(jouer(t, [{ quoi: 'indice' }])).naturel, 3)
  const trois = jouer(t, [{ quoi: 'indice' }, { quoi: 'indice' }])
  assert.equal(comptesDesIndices(trois), 3)
  assert.equal(trouver(trois).naturel, 2)
  const quatre = jouer(t, [{ quoi: 'indice' }, { quoi: 'indice' }, { quoi: 'indice' }])
  assert.equal(comptesDesIndices(quatre), 4)
  assert.equal(trouver(quatre).naturel, 2)
  // Une erreur : une erreur et un indice de plus — deux de plus au compte. Au premier indice, trois au compte : ★★ — une
  // étoile de moins ; après un indice de plus, quatre, encore ★★.
  const uneErreur = jouer(t, [{ quoi: 'nom', texte: 'Zola' }])
  assert.deepEqual(uneErreur, { vus: 2, offerts: 0, essais: ['Zola'] })
  assert.equal(comptesDesIndices(uneErreur), 3)
  assert.equal(trouver(uneErreur).naturel, 2)
  const erreurPuisIndice = jouer(t, [{ quoi: 'indice' }, { quoi: 'nom', texte: 'Zola' }])
  assert.equal(comptesDesIndices(erreurPuisIndice), 4)
  const v = trouver(erreurPuisIndice)
  assert.equal(v.naturel, 2)
  assert.deepEqual(piece0(v), { juste: true, choix: 0, composee: '3|1' })
  // L'indice qu'Éclairer offre ne compte pas : trois vus dont un offert, ★★★ — sans l'offrande, ★★.
  const offert = REGLE_DES_INDICES.eclairer(t, jouer(t, [{ quoi: 'indice' }]), toujours(0.5))
  assert.ok(typeof offert !== 'string')
  assert.deepEqual(offert, { vus: 3, offerts: 1, essais: [] })
  assert.equal(trouver(offert).naturel, 3)
  // Tout vu, sans aide : cinq au compte, ★ — trouvé, mais pas « su » : la pièce n'est pas juste.
  const tout = jouer(t, [{ quoi: 'indice' }, { quoi: 'indice' }, { quoi: 'indice' }, { quoi: 'indice' }])
  const tard = trouver(tout)
  assert.equal(tard.naturel, 1)
  assert.deepEqual(piece0(tard), { juste: false, choix: -1, composee: '5|0' })
})

test('les Indices : au cinquième indice, une erreur tranche à zéro ; avant, elle montre l’indice suivant', () => {
  const t = fiche(HUGO)
  const quatre = jouer(t, [{ quoi: 'nom', texte: 'Zola' }, { quoi: 'nom', texte: 'Balzac' }, { quoi: 'nom', texte: 'Dumas' }])
  assert.deepEqual(quatre, { vus: 4, offerts: 0, essais: ['Zola', 'Balzac', 'Dumas'] })
  const cinq = jouer(t, [{ quoi: 'nom', texte: 'Zola' }, { quoi: 'nom', texte: 'Balzac' }, { quoi: 'nom', texte: 'Dumas' }, { quoi: 'nom', texte: 'Musset' }])
  assert.equal(cinq.vus, 5)
  const faux = geste(t, { quoi: 'nom', texte: 'Lamartine' })
  assert.equal(REGLE_DES_INDICES.tranche(t, cinq, faux), true, 'plus d’indice à montrer : l’erreur tranche')
  assert.equal(REGLE_DES_INDICES.apresLeGeste(t, cinq, faux), GESTE_A_JUGER)
  const v = REGLE_DES_INDICES.juger(t, cinq, faux)
  assert.equal(v.naturel, 0)
  assert.deepEqual(piece0(v), { juste: false, choix: -1, composee: '5|5' })
  // Plus d'indice à demander, ni à offrir.
  const tout = jouer(t, [{ quoi: 'indice' }, { quoi: 'indice' }, { quoi: 'indice' }, { quoi: 'indice' }])
  assert.equal(REGLE_DES_INDICES.apresLeGeste(t, tout, geste(t, { quoi: 'indice' })), 'Tu as vu tous les indices : réponds')
  assert.equal(REGLE_DES_INDICES.eclairer(t, tout, toujours(0)), RIEN_A_ECLAIRER)
})

test('les Indices : ce qui se refuse en mots, ce qui ne se lit pas', () => {
  const t = fiche(HUGO)
  const e = jouer(t, [{ quoi: 'nom', texte: 'Zola' }])
  // Un nom vide ne coûte rien ; un nom déjà essayé non plus — un double toucher, ou l'oubli. Vide comme
  // `bonneIdentite` le lit : des mots vides seuls (« De », envoyé en commençant « De Gaulle ») ne nomment personne.
  const auCinquieme = jouer(t, [{ quoi: 'indice' }, { quoi: 'indice' }, { quoi: 'indice' }, { quoi: 'indice' }])
  for (const texte of ['', '   ', '?!', 'de', 'De', 'le', 'Le', "l'", 'L’', 'de la', 'du', 'des']) {
    for (const etat of [e, auCinquieme]) {
      const g = geste(t, { quoi: 'nom', texte })
      assert.equal(REGLE_DES_INDICES.tranche(t, etat, g), false, `« ${texte} » au ${etat.vus}ᵉ indice`)
      assert.equal(REGLE_DES_INDICES.apresLeGeste(t, etat, g), 'Écris un nom', `« ${texte} »`)
    }
  }
  for (const texte of ['Zola', ' zola ', 'ZOLA', 'de Zola', 'Zola !']) assert.equal(REGLE_DES_INDICES.apresLeGeste(t, e, geste(t, { quoi: 'nom', texte })), 'Tu as déjà essayé ce nom', texte)
  for (const brut of [null, { quoi: 'nom' }, { quoi: 'nom', texte: 3 }, { quoi: 'essai', lettres: 'HUGO' }, { quoi: 'reculer' }, []]) assert.equal(REGLE_DES_INDICES.lireLeGeste(brut, t), null, JSON.stringify(brut))
  // L'envoi de l'échéance ne porte rien : il tranche, et la manche vaut ce qu'elle a trouvé — rien.
  const auto: GesteDesIndices = geste(t, { quoi: 'repondre', auto: true })
  assert.equal(REGLE_DES_INDICES.tranche(t, e, auto), true)
  const v = REGLE_DES_INDICES.juger(t, e, auto)
  assert.equal(v.naturel, 0)
  assert.deepEqual(piece0(v), { juste: false, choix: -1, composee: '2|1' })
  // Rien essayé, rien répondu : `choix` nul.
  for (const fin of ['expiree', 'quittee'] as const) assert.deepEqual(piece0(REGLE_DES_INDICES.juger(t, REGLE_DES_INDICES.ouvrir(t), fin)), { juste: false, choix: null, composee: '1|0' })
  // L'échéance après une erreur : il avait répondu, faux. Quitter, lui, laisse la manche ouverte : zéro, `choix` nul,
  // comme toute manche quittée — seul le Pari gardé fait exception. Ce qu'il a vu reste écrit.
  assert.deepEqual(piece0(REGLE_DES_INDICES.juger(t, e, 'expiree')), { juste: false, choix: -1, composee: '2|1' })
  const quittee = REGLE_DES_INDICES.juger(t, e, 'quittee')
  assert.equal(quittee.naturel, 0)
  assert.deepEqual(piece0(quittee), { juste: false, choix: null, composee: '2|1' })
})

test('les Indices : la manche ne montre que les indices vus, jamais la réponse ni ses clés', () => {
  const t = fiche(HUGO)
  const e = jouer(t, [{ quoi: 'indice' }, { quoi: 'nom', texte: 'Zola' }])
  const montree = REGLE_DES_INDICES.montrer(t, e)
  assert.deepEqual(montree.indices, HUGO.indices.slice(0, 3))
  assert.equal(montree.caches, 2)
  assert.deepEqual(montree.essayes, ['Zola'])
  assert.equal(montree.vaut, 2, 'trois vus et une erreur, quatre au compte : la réponse vaut ★★')
  const vue = JSON.stringify(montree)
  for (const secret of ['Hugo', 'hugo', HUGO.indices[3], HUGO.indices[4], HUGO.savais]) assert.ok(!vue.includes(secret), `la manche montre « ${secret} »`)
  // Au premier indice, elle vaut ★★★.
  assert.equal(REGLE_DES_INDICES.montrer(t, REGLE_DES_INDICES.ouvrir(t)).vaut, 3)
})

test('les Indices : la révélation, la pièce, le cartel', () => {
  const t = fiche(HUGO)
  const offert = REGLE_DES_INDICES.eclairer(t, jouer(t, [{ quoi: 'nom', texte: 'Zola' }]), toujours(0)) as EtatDesIndices
  const g = geste(t, { quoi: 'nom', texte: 'hugo' })
  const v = REGLE_DES_INDICES.juger(t, offert, g)
  assert.equal(v.naturel, 2, 'trois vus dont un offert, une erreur : trois au compte, ★★')
  const revele = REGLE_DES_INDICES.reveler(t, offert, v)
  assert.equal(revele.titre, 'Trouvé')
  assert.equal(revele.trouve, true)
  assert.equal(revele.detail, 'Victor Hugo, avec 3 indices sous les yeux (dont 1 offert) et 1 erreur.')
  assert.deepEqual(revele.indices, HUGO.indices, 'les cinq indices, à la révélation')
  assert.equal(revele.savais, HUGO.savais)

  const seul = REGLE_DES_INDICES.reveler(t, REGLE_DES_INDICES.ouvrir(t), REGLE_DES_INDICES.juger(t, REGLE_DES_INDICES.ouvrir(t), g))
  assert.equal(seul.detail, 'Victor Hugo, avec 1 indice sous les yeux.')
  const rate = REGLE_DES_INDICES.reveler(t, offert, REGLE_DES_INDICES.juger(t, offert, 'expiree'))
  assert.equal(rate.titre, 'C’était Victor Hugo')
  assert.equal(rate.trouve, false)
  assert.equal(rate.detail, null)

  const piece = REGLE_DES_INDICES.piece(t, offert, v, { manche: 2, tirage: 2 })
  assert.equal(piece.id, idDeLaFiche('lettres-victor-hugo'))
  assert.equal(piece.id, 'cab:qui:lettres-victor-hugo')
  assert.equal(piece.forme, 'indices')
  assert.equal(piece.texte, QUESTION_DES_INDICES)
  assert.deepEqual(piece.reponses, ['Victor Hugo'])
  assert.equal(piece.niveau, 'moyen')
  assert.deepEqual(piece.cabinet, { jeu: 'indices', manche: 2, tirage: 2 })
  assert.deepEqual(REGLE_DES_INDICES.cartel(t, v), { sujet: QUESTION_DES_INDICES, reponse: 'Victor Hugo', anecdote: HUGO.savais })
  assert.equal(REGLE_DES_INDICES.etapes, 1)
  assert.equal(REGLE_DES_INDICES.dureeMs(1), DUREES_DES_JEUX.indices * 1000)
})

// ── La Réplique ───────────────────────────────────────────────────────────

const ARLETTY: Replique = {
  id: 'cinema-atmosphere',
  avant: 'Atmosphère ? Atmosphère ? Est-ce que j’ai une gueule d’',
  mot: 'atmosphère',
  apres: ' ?',
  leurres: ['actrice', 'ange', 'innocente'],
  qui: 'Arletty',
  autres: ['Michèle Morgan', 'Danielle Darrieux'],
  source: 'Hôtel du Nord, 1938',
  savais: 'La réplique a été écrite par Henri Jeanson.',
  categorie: 'Cinéma & séries',
}

test('la Réplique : la réplique entière, le mot à sa place', () => {
  assert.equal(repliqueEntiere('Tonnerre de', 'Brest', ' !'), 'Tonnerre de Brest !')
  assert.equal(repliqueEntiere('C’est pas', 'faux', '.'), 'C’est pas faux.')
  // Après une apostrophe, le mot se colle.
  assert.equal(repliqueEntiere("Mais l'important, c'est pas la chute, c'est l'", 'atterrissage', '.'), "Mais l'important, c'est pas la chute, c'est l'atterrissage.")
  assert.equal(repliqueEntiere(ARLETTY.avant, ARLETTY.mot, ARLETTY.apres), 'Atmosphère ? Atmosphère ? Est-ce que j’ai une gueule d’atmosphère ?')
  assert.equal(repliqueEntiere('', 'Rosebud', '…'), 'Rosebud…')
})

test('la Réplique : les quatre mots, les trois personnes et ce qu’Éclairer effacera, tirés au départ et figés', () => {
  const t = repliqueTiree(ARLETTY, hasardDe('le-serveur:replique'))
  assert.deepEqual([...t.mots].sort(), [ARLETTY.mot, ...ARLETTY.leurres].sort())
  assert.deepEqual([...t.personnes].sort(), [ARLETTY.qui, ...ARLETTY.autres].sort())
  assert.equal(t.mots[t.bonMot], ARLETTY.mot)
  assert.equal(t.personnes[t.bonneQui], ARLETTY.qui)
  // Ce qu'Éclairer effacera, dans l'ordre : chaque mauvaise proposition de chaque étape une fois, jamais la bonne.
  assert.deepEqual([...t.ordreDesEffaces[0]].sort(), [0, 1, 2, 3].filter(i => i !== t.bonMot))
  assert.deepEqual([...t.ordreDesEffaces[1]].sort(), [0, 1, 2].filter(i => i !== t.bonneQui))
  // Pure : le même hasard, le même plan. Une reprise, elle, relit le plan — elle ne rebat rien.
  assert.deepEqual(repliqueTiree(ARLETTY, hasardDe('le-serveur:replique')), t, 'le même hasard, le même ordre')
  // Le bon mot n'est pas toujours au même rang, ni le premier effacé.
  const rangs = new Set<number>()
  const premiers = new Set<number>()
  for (let i = 0; i < 200; i++) {
    const tiree = repliqueTiree(ARLETTY, hasardDe(`r:${i}`))
    rangs.add(tiree.bonMot)
    premiers.add(tiree.ordreDesEffaces[0][0])
  }
  assert.deepEqual([...rangs].sort(), [0, 1, 2, 3])
  assert.deepEqual([...premiers].sort(), [0, 1, 2, 3])

  // Ce qu'Éclairer efface ne désigne pas le bon mot : parmi les trois qui restent, rangés comme la page les montre,
  // il est aussi souvent le premier, le deuxième que le troisième. Effacer le premier mauvais à l'écran l'aurait
  // désigné une fois sur deux au premier rang.
  const places = [0, 0, 0]
  for (let i = 0; i < 900; i++) {
    const tiree = repliqueTiree(ARLETTY, hasardDe(`place:${i}`))
    const restent = [0, 1, 2, 3].filter(r => r !== tiree.ordreDesEffaces[0][0])
    places[restent.indexOf(tiree.bonMot)]++
  }
  for (const n of places) assert.ok(n > 240 && n < 360, `le bon mot à chaque place parmi ceux qui restent : ${places.join(', ')}`)
})

/** Une réplique tirée dans un ordre connu : le bon mot au rang 1, la bonne personne au rang 2. */
const T: RepliqueTiree = {
  jeu: 'replique',
  replique: ARLETTY,
  mots: ['actrice', 'atmosphère', 'ange', 'innocente'],
  personnes: ['Michèle Morgan', 'Danielle Darrieux', 'Arletty'],
  bonMot: 1,
  bonneQui: 2,
  ordreDesEffaces: [
    [3, 0, 2],
    [1, 0],
  ],
}
const lire = (brut: unknown) => REGLE_DE_LA_REPLIQUE.lireLeGeste(brut, T)!
const mot = (choix: number) => lire({ quoi: 'mot', choix })
const qui = (choix: number) => lire({ quoi: 'repondre', reponse: { replique: { qui: choix } } })
const avance = (e: EtatDeLaReplique, g: GesteDeLaReplique) => {
  assert.equal(REGLE_DE_LA_REPLIQUE.tranche(T, e, g), false)
  const apres = REGLE_DE_LA_REPLIQUE.apresLeGeste(T, e, g)
  assert.ok(typeof apres !== 'string', String(apres))
  return apres
}

test('la Réplique : deux étapes, chacune son chrono — le mot ouvre la seconde, « qui » tranche', () => {
  assert.equal(REGLE_DE_LA_REPLIQUE.etapes, 2)
  assert.equal(REGLE_DE_LA_REPLIQUE.dureeMs(1), DUREES_DES_JEUX.replique * 1000)
  assert.equal(REGLE_DE_LA_REPLIQUE.dureeMs(2), DUREES_DES_JEUX.replique * 1000, 'un chrono par question')

  const e = REGLE_DE_LA_REPLIQUE.ouvrir(T)
  assert.equal(e.etape, 1)
  // « Qui l'a dit ? » ne se répond pas avant le mot.
  assert.equal(REGLE_DE_LA_REPLIQUE.tranche(T, e, qui(2)), false)
  assert.equal(REGLE_DE_LA_REPLIQUE.apresLeGeste(T, e, qui(2)), 'Choisis d’abord le mot qui manque')
  const deux = avance(e, mot(1))
  assert.deepEqual(deux, { etape: 2, mot: 1, effaces: [[], []] })
  assert.equal(REGLE_DE_LA_REPLIQUE.apresLeGeste(T, deux, mot(0)), 'Le mot est choisi : dis qui l’a dite')
  assert.equal(REGLE_DE_LA_REPLIQUE.tranche(T, deux, qui(2)), true)
  assert.equal(REGLE_DE_LA_REPLIQUE.apresLeGeste(T, deux, qui(2)), GESTE_A_JUGER)

  // L'échéance de la première étape : la page envoie d'elle-même, sans rien — le mot est perdu, la seconde s'ouvre.
  const auto = lire({ quoi: 'repondre', auto: true })
  const perdu = avance(e, auto)
  assert.deepEqual(perdu, { etape: 2, mot: null, effaces: [[], []] })
  assert.equal(REGLE_DE_LA_REPLIQUE.montrer(T, perdu).etape, 2)

  for (const brut of [null, { quoi: 'mot' }, { quoi: 'mot', choix: 4 }, { quoi: 'mot', choix: -1 }, { quoi: 'mot', choix: 1.5 }, { quoi: 'repondre', reponse: { replique: { qui: 3 } } }, { quoi: 'repondre', reponse: { pari: { choix: 1 } } }, { quoi: 'nom', texte: 'Arletty' }])
    assert.equal(REGLE_DE_LA_REPLIQUE.lireLeGeste(brut, T), null, JSON.stringify(brut))
})

test('la Réplique : le bon mot ★★, la bonne personne ★, additionnés ; juste au bon mot', () => {
  assert.deepEqual(ETOILES_DE_LA_REPLIQUE, { mot: 2, qui: 1 })
  const e = REGLE_DE_LA_REPLIQUE.ouvrir(T)
  const cas: [number | null, number | null, number, boolean, number | null, string][] = [
    [1, 2, 3, true, 0, '1|2'],
    [1, 0, 2, true, 0, '1|0'],
    [0, 2, 1, false, -1, '0|2'],
    [3, 1, 0, false, -1, '3|1'],
    [null, 2, 1, false, -1, '.|2'],
  ]
  for (const [m, q, etoiles, juste, choix, composee] of cas) {
    const deux = m === null ? avance(e, lire({ quoi: 'repondre' })) : avance(e, mot(m))
    const v = REGLE_DE_LA_REPLIQUE.juger(T, deux, qui(q!))
    assert.equal(v.naturel, etoiles, composee)
    assert.deepEqual(piece0(v), { juste, choix, composee })
    assert.equal(juste, justeDeLaPiece(v.naturel, 'replique'))
  }
  // Expirée à la seconde : le mot, le serveur l'avait — il compte ; « qui » n'a pas de réponse.
  const expiree = REGLE_DE_LA_REPLIQUE.juger(T, avance(e, mot(1)), 'expiree')
  assert.equal(expiree.naturel, 2)
  assert.deepEqual(piece0(expiree), { juste: true, choix: 0, composee: '1|.' })
  // L'échéance de la seconde, sans rien : le mot compte.
  assert.equal(REGLE_DE_LA_REPLIQUE.juger(T, avance(e, mot(1)), lire({ quoi: 'repondre', auto: true })).naturel, 2)
  // Quittée à la seconde : la manche est laissée ouverte, elle compte zéro, `choix` nul — comme toute manche
  // quittée ; seul le Pari gardé fait exception. Le mot choisi reste écrit : la révélation dit ce qu'il avait répondu.
  const quittee = REGLE_DE_LA_REPLIQUE.juger(T, avance(e, mot(1)), 'quittee')
  assert.equal(quittee.naturel, 0)
  assert.deepEqual(piece0(quittee), { juste: false, choix: null, composee: '1|.' })
  assert.deepEqual(REGLE_DE_LA_REPLIQUE.reveler(T, avance(e, mot(1)), quittee).repondu, { mot: 'atmosphère', qui: null })
  // À la première, rien n'est répondu.
  for (const fin of ['expiree', 'quittee'] as const) assert.deepEqual(piece0(REGLE_DE_LA_REPLIQUE.juger(T, e, fin)), { juste: false, choix: null, composee: '.|.' })
})

test('la Réplique : jamais le mot ni « qui » avant la révélation, ni si le mot choisi était bon', () => {
  const e = REGLE_DE_LA_REPLIQUE.ouvrir(T)
  const une = REGLE_DE_LA_REPLIQUE.montrer(T, e)
  assert.equal(une.etape, 1)
  if (une.etape !== 1) return
  // Les quatre mots, dans l'ordre tiré, sans marque : le bon y est forcément, rien ne le distingue.
  assert.deepEqual(une.mots, T.mots.map(m => ({ mot: m, efface: false })))
  assert.equal(une.avant, ARLETTY.avant)
  assert.equal(une.apres, ARLETTY.apres)
  const vue1 = JSON.stringify(une)
  for (const secret of [ARLETTY.qui, ...ARLETTY.autres, ARLETTY.source, ARLETTY.savais]) assert.ok(!vue1.includes(secret), `la première étape montre « ${secret} »`)

  // À la seconde, le mot choisi dans le trou — le bon ou un leurre, la vue a la même forme.
  const bon = REGLE_DE_LA_REPLIQUE.montrer(T, avance(e, mot(1)))
  const leurre = REGLE_DE_LA_REPLIQUE.montrer(T, avance(e, mot(0)))
  const perdu = REGLE_DE_LA_REPLIQUE.montrer(T, avance(e, lire({ quoi: 'repondre' })))
  assert.deepEqual(Object.keys(bon).sort(), Object.keys(leurre).sort())
  assert.deepEqual(Object.keys(bon).sort(), Object.keys(perdu).sort())
  assert.ok(bon.etape === 2 && leurre.etape === 2 && perdu.etape === 2)
  if (bon.etape !== 2 || leurre.etape !== 2 || perdu.etape !== 2) return
  assert.equal(bon.motChoisi, 'atmosphère')
  assert.equal(leurre.motChoisi, 'actrice')
  assert.equal(perdu.motChoisi, null)
  assert.deepEqual(bon.personnes, T.personnes.map(nom => ({ nom, efface: false })))
  for (const vue of [leurre, perdu]) {
    const texte = JSON.stringify(vue)
    // Le mot, nulle part : « atmosphère » ne se lit que dans ce qui précède le trou, avec sa majuscule.
    assert.ok(!texte.includes('d’atmosphère'), 'le bon mot dans le trou')
    assert.ok(!JSON.stringify({ ...vue, avant: '' }).includes('atmosphère'), 'le bon mot hors de la réplique')
    for (const secret of [ARLETTY.source, ARLETTY.savais]) assert.ok(!texte.includes(secret), secret)
  }
  for (const vue of [une, bon, leurre, perdu]) for (const cle of ['bonMot', 'bonneQui', 'juste', 'bon']) assert.ok(!(cle in vue), cle)
})

test('la Réplique : Éclairer efface une mauvaise proposition à chaque étape — deux mots, un nom au plus', () => {
  assert.equal(effacablesAuPlus(4), 2)
  assert.equal(effacablesAuPlus(3), 1)
  for (let i = 0; i < 50; i++) {
    const t = repliqueTiree(ARLETTY, hasardDe(`replique:tiree:${i}`))
    // Le hasard que le pli passe vient de la graine de la partie : ce qui s'efface n'en vient pas, il est figé au départ.
    let e: EtatDeLaReplique | string = REGLE_DE_LA_REPLIQUE.ouvrir(t)
    e = REGLE_DE_LA_REPLIQUE.eclairer(t, e, HASARD_DE_LA_GRAINE) as EtatDeLaReplique
    e = REGLE_DE_LA_REPLIQUE.eclairer(t, e, HASARD_DE_LA_GRAINE) as EtatDeLaReplique
    assert.equal(e.effaces[0].length, 2)
    assert.ok(!e.effaces[0].includes(t.bonMot), 'jamais le bon mot')
    assert.equal(new Set(e.effaces[0]).size, 2)
    // Dans l'ordre que le départ a tiré.
    assert.deepEqual(e.effaces[0], t.ordreDesEffaces[0].slice(0, 2))
    assert.equal(REGLE_DE_LA_REPLIQUE.eclairer(t, e, HASARD_DE_LA_GRAINE), RIEN_A_ECLAIRER_A_CETTE_QUESTION, 'deux restent toujours')
    const une = REGLE_DE_LA_REPLIQUE.montrer(t, e)
    assert.ok(une.etape === 1 && une.mots.filter(m => m.efface).length === 2)
    // La seconde étape repart sans rien d'effacé ; un nom sur trois s'y efface.
    let deux = REGLE_DE_LA_REPLIQUE.apresLeGeste(t, e, { quoi: 'mot', choix: 0 }) as EtatDeLaReplique
    assert.deepEqual(deux.effaces, [e.effaces[0], []])
    deux = REGLE_DE_LA_REPLIQUE.eclairer(t, deux, HASARD_DE_LA_GRAINE) as EtatDeLaReplique
    assert.deepEqual(deux.effaces[1], t.ordreDesEffaces[1].slice(0, 1))
    assert.ok(!deux.effaces[1].includes(t.bonneQui), 'jamais la bonne personne')
    assert.equal(REGLE_DE_LA_REPLIQUE.eclairer(t, deux, HASARD_DE_LA_GRAINE), RIEN_A_ECLAIRER_A_CETTE_QUESTION)
  }
  // Un plan qui porterait la bonne proposition dans son ordre ne la fait pas effacer pour autant.
  const mal: RepliqueTiree = { ...T, ordreDesEffaces: [[T.bonMot, 3, 0, 2], [T.bonneQui, 1, 0]] }
  const e = REGLE_DE_LA_REPLIQUE.eclairer(mal, REGLE_DE_LA_REPLIQUE.ouvrir(mal), HASARD_DE_LA_GRAINE) as EtatDeLaReplique
  assert.deepEqual(e.effaces[0], [3])
  // Un mot effacé reste un mauvais mot : le choisir ne rapporte rien.
  const efface = REGLE_DE_LA_REPLIQUE.eclairer(T, REGLE_DE_LA_REPLIQUE.ouvrir(T), HASARD_DE_LA_GRAINE) as EtatDeLaReplique
  assert.deepEqual(efface.effaces[0], [3])
  const v = REGLE_DE_LA_REPLIQUE.juger(T, avance(efface, mot(efface.effaces[0][0])), qui(2))
  assert.equal(v.naturel, 1)
})

test('la Réplique : la révélation, la pièce, le cartel', () => {
  const e = REGLE_DE_LA_REPLIQUE.ouvrir(T)
  const deux = avance(e, mot(0))
  const v = REGLE_DE_LA_REPLIQUE.juger(T, deux, qui(0))
  const revele = REGLE_DE_LA_REPLIQUE.reveler(T, deux, v)
  assert.equal(revele.titre, 'C’était « atmosphère »')
  assert.equal(revele.bonMot, false)
  assert.equal(revele.bonneQui, false)
  assert.equal(revele.entiere, 'Atmosphère ? Atmosphère ? Est-ce que j’ai une gueule d’atmosphère ?')
  assert.equal(revele.qui, 'Arletty')
  assert.equal(revele.source, 'Hôtel du Nord, 1938')
  assert.deepEqual(revele.repondu, { mot: 'actrice', qui: 'Michèle Morgan' })
  assert.equal(revele.savais, ARLETTY.savais)
  const juste = REGLE_DE_LA_REPLIQUE.reveler(T, avance(e, mot(1)), REGLE_DE_LA_REPLIQUE.juger(T, avance(e, mot(1)), qui(2)))
  assert.equal(juste.titre, 'Le bon mot')
  assert.ok(juste.bonMot && juste.bonneQui)

  const piece = REGLE_DE_LA_REPLIQUE.piece(T, deux, v, { manche: 0, tirage: 0 })
  assert.equal(piece.id, idDeLaReplique('cinema-atmosphere'))
  assert.equal(piece.id, 'cab:replique:cinema-atmosphere')
  assert.equal(piece.forme, 'replique')
  assert.equal(piece.texte, '« Atmosphère ? Atmosphère ? Est-ce que j’ai une gueule d’… ? »')
  assert.deepEqual(piece.reponses, ['« atmosphère » — Arletty'])
  assert.equal(piece.niveau, 'moyen')
  assert.equal(piece.categorie, 'Cinéma & séries')
  assert.deepEqual(piece.cabinet, { jeu: 'replique', manche: 0, tirage: 0 })
  assert.deepEqual(REGLE_DE_LA_REPLIQUE.cartel(T, v), { sujet: piece.texte, reponse: '« atmosphère » — Arletty, Hôtel du Nord, 1938', anecdote: ARLETTY.savais })

  // Le trou s'écrit en points de suspension, où se fond la ponctuation qui le suit de près : un point, ou des
  // points de suspension — « blanchit la …… » se serait lu deux fois.
  const aTrou = (avant: string, apres: string) => REGLE_DE_LA_REPLIQUE.piece({ ...T, replique: { ...ARLETTY, avant, mot: 'campagne', apres } }, e, v, { manche: 0, tirage: 0 }).texte
  assert.equal(aTrou('Demain, dès l’aube, à l’heure où blanchit la', '…'), '« Demain, dès l’aube, à l’heure où blanchit la … »')
  assert.equal(aTrou('Demain, dès l’aube, à l’heure où blanchit la', '...'), '« Demain, dès l’aube, à l’heure où blanchit la … »')
  assert.equal(aTrou('C’est pas', '.'), '« C’est pas … »')
  assert.equal(aTrou('On ne voit bien qu’avec le', '. L’essentiel est invisible pour les yeux.'), '« On ne voit bien qu’avec le … L’essentiel est invisible pour les yeux. »')
  assert.equal(aTrou('Tonnerre de', ' !'), '« Tonnerre de … ! »')
  assert.equal(aTrou('Atmosphère ? Est-ce que j’ai une gueule d’', ' ?'), '« Atmosphère ? Est-ce que j’ai une gueule d’… ? »')
  // La réplique entière, elle, garde sa ponctuation.
  assert.equal(repliqueEntiere('Demain, dès l’aube, à l’heure où blanchit la', 'campagne', '…'), 'Demain, dès l’aube, à l’heure où blanchit la campagne…')
})

// ── Ce que les trois partagent ────────────────────────────────────────────

test('les trois jeux du contenu neuf : leur clé, leurs pièces hors de la base, ni l’heure ni le hasard de la machine', () => {
  assert.equal(REGLE_DE_L_EPINGLE.cle, 'epingle')
  assert.equal(REGLE_DES_INDICES.cle, 'indices')
  assert.equal(REGLE_DE_LA_REPLIQUE.cle, 'replique')
  const vEpingle = REGLE_DE_L_EPINGLE.juger(tireeA(ORLEANS), REGLE_DE_L_EPINGLE.ouvrir(tireeA(ORLEANS)), 'expiree')
  const pieces = [
    REGLE_DE_L_EPINGLE.piece(tireeA(ORLEANS), REGLE_DE_L_EPINGLE.ouvrir(tireeA(ORLEANS)), vEpingle, { manche: 0, tirage: 0 }),
    REGLE_DES_INDICES.piece(fiche(HUGO), REGLE_DES_INDICES.ouvrir(fiche(HUGO)), REGLE_DES_INDICES.juger(fiche(HUGO), REGLE_DES_INDICES.ouvrir(fiche(HUGO)), 'expiree'), { manche: 0, tirage: 0 }),
    REGLE_DE_LA_REPLIQUE.piece(T, REGLE_DE_LA_REPLIQUE.ouvrir(T), REGLE_DE_LA_REPLIQUE.juger(T, REGLE_DE_LA_REPLIQUE.ouvrir(T), 'expiree'), { manche: 0, tirage: 0 }),
  ]
  for (const p of pieces) {
    // Hors de la base, sous le seul préfixe du Cabinet : ni carnet, ni signalement, ni mesure ; un identifiant qui ne se déplie pas.
    assert.ok(p.id.startsWith(PREFIXE_DU_CABINET), p.id)
    assert.deepEqual(deplier(p.id), [p.id])
    assert.equal(p.forme, p.cabinet.jeu, 'jamais nue : la forme de son jeu')
    assert.equal(p.bonne, 0)
    assert.equal(p.reponses.length, 1)
  }
  // Pur : l'échéance se lit à l'heure du serveur, le hasard vient de la graine — rejoué, le pli redonne la même manche.
  for (const f of ['epingle', 'indices', 'replique', 'outils']) {
    const code = readFileSync(new URL(`../../shared/cabinet/jeux/${f}.ts`, import.meta.url), 'utf8')
    for (const interdit of ['Date.now', 'new Date', 'Math.random']) assert.ok(!code.includes(interdit), `${f}.ts : ${interdit}`)
  }
})

// ── Le tirage, au serveur ─────────────────────────────────────────────────
// Ce que les tireurs des trois tirent au départ, sur le contenu livré
// (`server/content/cabinet/`) : le jamais vu d'abord, puis le plus
// anciennement vu, par son identifiant, d'un jeu à l'autre — au rythme de la
// visite et des chasses, sept jours sans redite (`cabinet-contenu.test.ts`) — ;
// rien deux fois dans un plan, rechanges comprises, ni deux contenus dont l'un
// souffle l'autre ;
// l'Épingle, trois lieux d'un même thème, ses rechanges d'un autre. Et ce qui
// se tire au hasard — le décalage de la zone d'Éclairer, l'ordre des mots et
// des noms — du hasard du serveur, jamais d'une graine que la page saurait.

const CONTENU = contenuDuCabinet()
const THEMES = [...new Set(CONTENU.lieux.map(l => l.theme))]
const lieuxDuTheme = (theme: string) => CONTENU.lieux.filter(l => l.theme === theme)
const JOUR_MS = 24 * 3_600_000
const ilYA = (jours: number) => DIX_HEURES - jours * JOUR_MS

/** Un contexte de tirage sur le contenu livré : les trois jeux n'y lisent rien de la base. */
const surLeContenu = (o: { vues?: ReadonlyMap<string, number>; hasard?: () => number } = {}): ContexteDuTirage => ({
  porte: { deLaCategorie: () => [] },
  jouables: [],
  mesures: new Map(),
  vues: o.vues ?? new Map(),
  maintenant: DIX_HEURES,
  hasard: o.hasard ?? Math.random,
  enjeu: ENJEU_ORDINAIRE,
  leurres: new Map(),
})
const lEpingle = (o?: Parameters<typeof surLeContenu>[0], rechanges = 0) => tirerLePlan('epingle', surLeContenu(o), rechanges) as EpingleTiree[]

test('le tirage de l’Épingle : trois lieux d’un même thème, ses rechanges d’un autre, rien deux fois — le thème figé au départ', () => {
  for (let essai = 0; essai < 20; essai++) {
    // Trois manches et trois rechanges : la force 3 de Changer.
    const plan = lEpingle({}, 3)
    assert.equal(plan.length, 6)
    const theme = plan[0].lieu.theme
    assert.ok(plan.slice(0, 3).every(t => t.lieu.theme === theme), 'les trois manches, d’un même thème')
    assert.equal(themeDuPlan(plan), theme, 'le thème que le départ fige, celui de ses trois manches')
    assert.ok(plan.slice(3).every(t => t.lieu.theme !== theme), 'une rechange de Changer vient d’un autre thème')
    assert.equal(new Set(plan.map(t => t.lieu.id)).size, plan.length, 'jamais deux fois le même lieu, rechanges comprises')
    for (const t of plan) {
      assert.deepEqual(t.lieu, CONTENU.lieux.find(l => l.id === t.lieu.id), 'le lieu tel que le contenu livré le dit')
      assert.ok(t.decalage.km >= DECALAGE_DE_LA_ZONE_KM[0] && t.decalage.km <= DECALAGE_DE_LA_ZONE_KM[1])
    }
  }
  // Le décalage de sa zone et l'ordre des propositions de la Réplique viennent du hasard du tirage — celui du serveur, que le
  // magasin lui donne —, par la règle du jeu : le même hasard, le même tirage.
  const [e] = lEpingle({ hasard: toujours(0.25) })
  assert.deepEqual(e, epingleTiree(e.lieu, toujours(0.25)))
  const [r] = tirerLePlan('replique', surLeContenu({ hasard: toujours(0.25) }), 0) as RepliqueTiree[]
  assert.deepEqual(r, repliqueTiree(r.replique, toujours(0.25)))
})

test('le tirage de l’Épingle : le thème le moins vu — ses lieux jamais vus d’abord, puis le thème visité le plus anciennement', () => {
  const [a, b, c] = THEMES
  const tousVusSauf = (themes: string[], le: number) => new Map(CONTENU.lieux.filter(l => !themes.includes(l.theme)).map(l => [idDuLieu(l.id), le]))
  // Tout vu il y a trois jours, sauf le thème a : c'est lui.
  for (let essai = 0; essai < 10; essai++) assert.equal(themeDuPlan(lEpingle({ vues: tousVusSauf([a], ilYA(3)) })), a)
  // Le thème b garde six lieux jamais vus, trois vus hier ; tout le reste a été vu il y a dix jours : ses jamais vus passent devant
  // une révision, et la partie ne prend qu'eux.
  const avecB = tousVusSauf([b], ilYA(10))
  for (const l of lieuxDuTheme(b).slice(0, 3)) avecB.set(idDuLieu(l.id), ilYA(1))
  for (let essai = 0; essai < 10; essai++) {
    const plan = lEpingle({ vues: avecB })
    assert.equal(themeDuPlan(plan), b)
    assert.ok(plan.every(t => !avecB.has(idDuLieu(t.lieu.id))), 'trois lieux jamais vus')
  }
  // Chaque thème a gardé des lieux jamais vus : le moins récemment visité passe devant — deux parties d'un même thème ne
  // s'enchaînent pas tant qu'un autre attend.
  const visites = new Map<string, number>()
  THEMES.forEach((th, i) => lieuxDuTheme(th).slice(0, 3).forEach(l => visites.set(idDuLieu(l.id), ilYA(2) + i * 3_600_000)))
  for (let essai = 0; essai < 10; essai++) assert.equal(themeDuPlan(lEpingle({ vues: visites })), THEMES[0])
  // Tout vu : un thème vu il y a plus de sept jours passe devant ceux de la semaine.
  const semaine = tousVusSauf([c], ilYA(2))
  for (const l of lieuxDuTheme(c)) semaine.set(idDuLieu(l.id), ilYA(9))
  for (let essai = 0; essai < 10; essai++) assert.equal(themeDuPlan(lEpingle({ vues: semaine })), c)
})

test('le tirage des Indices et de la Réplique : le jamais vu d’abord, puis le plus anciennement vu — rien deux fois dans un plan, rechanges comprises', () => {
  const sortes = [
    { jeu: 'indices' as const, ids: CONTENU.fiches.map(f => idDeLaFiche(f.id)), idDe: (t: IndicesTires | RepliqueTiree) => (t.jeu === 'indices' ? idDeLaFiche(t.fiche.id) : '') },
    { jeu: 'replique' as const, ids: CONTENU.repliques.map(r => idDeLaReplique(r.id)), idDe: (t: IndicesTires | RepliqueTiree) => (t.jeu === 'replique' ? idDeLaReplique(t.replique.id) : '') },
  ]
  for (const { jeu, ids, idDe } of sortes) {
    for (let essai = 0; essai < 20; essai++) {
      const plan = tirerLePlan(jeu, surLeContenu(), 3) as (IndicesTires | RepliqueTiree)[]
      assert.equal(plan.length, 6, jeu)
      assert.equal(new Set(plan.map(idDe)).size, 6, `${jeu} : jamais deux fois le même, rechanges comprises`)
      for (const t of plan) assert.ok(ids.includes(idDe(t)), `${jeu} : du contenu livré`)
    }
    // Tout vu ces jours-ci sauf trois : ce sont elles. Puis, tout vu, les trois plus anciennement vues — il y a huit jours.
    const neuves = ids.slice(0, 3)
    const recentes = new Map(ids.slice(3).map(id => [id, ilYA(2)]))
    const anciennes = new Map(ids.map(id => [id, neuves.includes(id) ? ilYA(8) : ilYA(2)]))
    for (const vues of [recentes, anciennes]) {
      for (let essai = 0; essai < 5; essai++) assert.deepEqual((tirerLePlan(jeu, surLeContenu({ vues }), 0) as (IndicesTires | RepliqueTiree)[]).map(idDe).sort(), [...neuves].sort(), jeu)
    }
  }
  // La fiche, telle que le contenu livré la dit : ses indices dans leur ordre, du plus obscur au plus évident.
  const [t] = tirerLePlan('indices', surLeContenu(), 0) as IndicesTires[]
  assert.deepEqual(t, { jeu: 'indices', fiche: CONTENU.fiches.find(f => f.id === t.fiche.id) })
})

test('le tirage des Indices et de la Réplique : jamais deux contenus dont la révélation de l’un souffle l’autre, dans un sens ou dans l’autre', () => {
  // La révélation d'une manche des Indices montre ses cinq indices et « Le savais-tu ? » : celle de George Sand écrit
  // « Frédéric Chopin », celle de Chopin « la romancière George Sand ». Seules jamais vues, elles se suivaient dans un plan, et
  // la première soufflait la seconde — dans un sens ou dans l'autre : une rechange de Changer se joue avant la manche d'après.
  const laFiche = (id: string) => CONTENU.fiches.find(f => f.id === id)!
  const [sand, chopin] = [laFiche('femmes-george-sand'), laFiche('musique-chopin')]
  assert.ok(uneFicheSouffleLAutre(sand, chopin) && uneFicheSouffleLAutre(chopin, sand))
  assert.ok(!uneFicheSouffleLAutre(sand, laFiche('sciences-edison')), 'une fiche qui ne nomme pas l’autre')
  const seulesNeuves = new Map(CONTENU.fiches.filter(f => f !== sand && f !== chopin).map(f => [idDeLaFiche(f.id), ilYA(2)]))
  for (let essai = 0; essai < 5; essai++) {
    const plan = (tirerLePlan('indices', surLeContenu({ vues: seulesNeuves }), 3) as IndicesTires[]).map(t => t.fiche)
    assert.equal(plan.filter(f => f === sand || f === chopin).length, 1, 'l’une des deux, jamais les deux — rechanges comprises')
  }
  // La Réplique : l'anecdote des Fourberies de Scapin nomme Cyrano de Bergerac, qui dit « C'est une péninsule ! ». Deux répliques
  // d'une même personne non plus : la révélation de la première l'a nommée.
  const laReplique = (id: string) => CONTENU.repliques.find(r => r.id === id)!
  const [scapin, cyrano] = [laReplique('theatre-litterature-galere-scapin'), laReplique('theatre-litterature-peninsule-cyrano')]
  assert.ok(uneRepliqueSouffleLAutre(scapin, cyrano) && uneRepliqueSouffleLAutre(cyrano, scapin))
  assert.ok(uneRepliqueSouffleLAutre(scapin, { ...scapin, id: 'une-autre-de-geronte' }), 'deux répliques de Géronte')
  const deuxNeuves = new Map(CONTENU.repliques.filter(r => r !== scapin && r !== cyrano).map(r => [idDeLaReplique(r.id), ilYA(2)]))
  for (let essai = 0; essai < 5; essai++) {
    const plan = (tirerLePlan('replique', surLeContenu({ vues: deuxNeuves }), 3) as RepliqueTiree[]).map(t => t.replique)
    assert.equal(plan.filter(r => r === scapin || r === cyrano).length, 1, 'l’une des deux, jamais les deux')
  }
  // Au hasard du contenu livré, aucun plan ne garde deux contenus qui se soufflent.
  for (let essai = 0; essai < 200; essai++) {
    const fiches = (tirerLePlan('indices', surLeContenu(), 3) as IndicesTires[]).map(t => t.fiche)
    const repliques = (tirerLePlan('replique', surLeContenu(), 3) as RepliqueTiree[]).map(t => t.replique)
    for (const [a, b] of fiches.flatMap((a, i) => fiches.slice(i + 1).map(b => [a, b]))) assert.ok(!uneFicheSouffleLAutre(a, b), `${a.id} et ${b.id}`)
    for (const [a, b] of repliques.flatMap((a, i) => repliques.slice(i + 1).map(b => [a, b]))) assert.ok(!uneRepliqueSouffleLAutre(a, b), `${a.id} et ${b.id}`)
  }
})

// ── Par les routes ────────────────────────────────────────────────────────

test('par les routes : l’Épingle d’un bout à l’autre — sur le lieu, à cinquante kilomètres, hors de France refusée en mots, puis laissée au temps', async () => {
  const b = await bancDuCabinet()
  try {
    const lea = await inscrireProfil(b.banc.url, 'lea', 'Léa')
    let v = ok(await commencer(b, lea, { origine: 'libre', jeu: 'epingle', carte: null }), 'l’Épingle')
    const t0 = epingleDe(b, v.id, 0)
    // La date, le thème, le récit, la question : ni le lieu, ni rien qui le situe.
    assert.deepEqual(v.enCours, { jeu: 'epingle', date: t0.lieu.date, theme: t0.lieu.theme, recit: t0.lieu.recit, question: t0.lieu.question, zone: null })
    // Hors de France — Madrid —, l'épingle se refuse en mots, et la manche continue : rien ne s'écrit.
    const MADRID = { lat: 40.4168, lon: -3.7038 }
    const dehors = await unGeste(b, lea, v, { quoi: 'repondre', manche: 0, reponse: { epingle: MADRID } })
    assert.deepEqual([dehors.status, dehors.corps], [400, { error: 'Plante ton épingle en France' }])
    v = await jouerUneEpingle(b, lea, v, 0)
    const r0 = v.revelation?.corps as EpingleRevelee
    assert.deepEqual([r0.titre, r0.km, v.manches[0].naturel], ['À 0 km', 0, 3])
    const l = t0.lieu
    assert.deepEqual(r0.lieu, { nom: l.nom, commune: l.commune, departement: l.departement, date: l.date, lat: l.lat, lon: l.lon })
    assert.equal(r0.savais, l.savais)
    // À cinquante kilomètres : deux étoiles.
    v = await ouvrirLaManche(b, lea, v, 1)
    assert.equal((v.enCours as EpingleMontree).theme, t0.lieu.theme, 'la manche suivante, du même thème')
    v = await jouerUneEpingle(b, lea, v, 1, 50)
    assert.equal(v.manches[1].naturel, 2)
    // Laissée au temps, une épingle hors de France que la page envoie d'elle-même ne compte pas : « Pas d'épingle ».
    v = await ouvrirLaManche(b, lea, v, 2)
    b.horloge.t = v.chrono!.echeance + 1
    v = ok(await unGeste(b, lea, v, { quoi: 'repondre', manche: 2, auto: true, reponse: { epingle: MADRID } }), 'l’échéance')
    assert.equal((v.revelation?.corps as EpingleRevelee).titre, 'Pas d’épingle')
    assert.deepEqual([v.phase, v.bilan?.naturel, v.bilan?.total], ['finie', [3, 2, 0], 5])
    // Au journal : une pièce par manche, hors de la base, à la forme de son jeu — l'épingle et la distance dite, ou rien.
    const pieces = enBase(b.fichier, db => db.prepare('SELECT reserve_id, forme, juste, composee FROM campagne_reponses WHERE serie_id = ? ORDER BY position').all(v.id)) as {
      reserve_id: string
      forme: string
      juste: number
      composee: string | null
    }[]
    const plan = [0, 1, 2].map(k => epingleDe(b, v.id, k).lieu.id)
    assert.deepEqual(
      pieces.map(p => [p.reserve_id, p.forme, Number(p.juste)]),
      plan.map((id, k) => [idDuLieu(id), 'epingle', k < 2 ? 1 : 0]),
    )
    assert.match(pieces[0].composee ?? '', /\|0$/)
    assert.equal(pieces[2].composee, null)
  } finally {
    await b.banc.close()
  }
})

test('par les routes : le cartel d’une Épingle dit le thème de la manche qu’il garde — une rechange de Changer vient d’un autre', async () => {
  const b = await bancDuCabinet()
  try {
    const eve = await inscrireProfil(b.banc.url, 'eve', 'Ève')
    // Objection, une commune de l'Épingle, chassée avec Échange : une rechange au plan, d'un autre thème que les trois manches.
    let v = ok(await commencer(b, eve, { origine: 'chasse', oeuvre: 'objection', carte: 'echange' }), 'la chasse')
    const theme = epingleDe(b, v.id, 0).lieu.theme
    v = await jouerUneEpingle(b, eve, v, 0, 50)
    v = await ouvrirLaManche(b, eve, v, 1)
    v = ok(await unGeste(b, eve, v, { quoi: 'changer', manche: 1 }), 'changer')
    const rechange = epingleDe(b, v.id, 3).lieu
    assert.notEqual(rechange.theme, theme)
    v = await jouerUneEpingle(b, eve, v, 1)
    v = await ouvrirLaManche(b, eve, v, 2)
    v = await jouerUneEpingle(b, eve, v, 2, 50)
    // Deux, trois, deux étoiles : gagnée, et son cartel garde la plus étoilée — la rechange.
    assert.deepEqual([v.bilan?.issue, v.bilan?.cartel?.manche, v.bilan?.cartel?.sujet], ['gagnee', 1, rechange.question])
    const cartel = ok(await lireLaRoute<Cartel>(b, eve, '/api/cabinet/oeuvre/objection'), 'son cartel')
    // Le thème de la partie, figé au départ, est celui des trois manches : sous la question d'un lieu d'un autre fil, il mentait.
    assert.deepEqual([cartel.partie?.sujet, cartel.partie?.theme], [rechange.question, rechange.theme])
  } finally {
    await b.banc.close()
  }
})

test('par les routes : les Indices — un indice de plus, un nom faux qui en montre un autre, puis le bon ; un nom vide ou déjà essayé se refuse en mots', async () => {
  const b = await bancDuCabinet()
  try {
    const leo = await inscrireProfil(b.banc.url, 'leo', 'Léo')
    let v = ok(await commencer(b, leo, { origine: 'libre', jeu: 'indices', carte: null }), 'les Indices')
    const t0 = ficheDe(b, v.id, 0)
    // Le premier indice d'office, et ce que vaut une bonne réponse maintenant : rien de la fiche, ni sa réponse ni ses clés.
    assert.deepEqual(v.enCours, { jeu: 'indices', indices: [t0.fiche.indices[0]], caches: t0.fiche.indices.length - 1, vaut: 3, essayes: [], offerts: 0 })
    const vide = await unGeste(b, leo, v, { quoi: 'nom', manche: 0, texte: 'de la' })
    assert.deepEqual([vide.status, vide.corps], [400, { error: 'Écris un nom' }])
    v = ok(await unGeste(b, leo, v, { quoi: 'indice', manche: 0 }), 'un indice de plus')
    assert.deepEqual((v.enCours as IndicesMontres).indices, t0.fiche.indices.slice(0, 2))
    v = ok(await unGeste(b, leo, v, { quoi: 'nom', manche: 0, texte: 'Personne Inconnue' }), 'un nom faux')
    assert.deepEqual([(v.enCours as IndicesMontres).indices.length, (v.enCours as IndicesMontres).essayes], [3, ['Personne Inconnue']])
    const deja = await unGeste(b, leo, v, { quoi: 'nom', manche: 0, texte: 'personne inconnue' })
    assert.deepEqual([deja.status, deja.corps], [400, { error: 'Tu as déjà essayé ce nom' }])
    v = ok(await unGeste(b, leo, v, { quoi: 'nom', manche: 0, texte: t0.fiche.reponse }), 'la réponse')
    assert.equal((v.revelation?.corps as IndicesReveles).titre, 'Trouvé')
    // Trois indices vus, une erreur : quatre au compte.
    assert.equal(v.manches[0].naturel, etoilesDesIndices(4))
    // Trouvée d'emblée, la suivante vaut trois étoiles ; la dernière, laissée au temps, rien — sa révélation dit qui c'était.
    v = await ouvrirLaManche(b, leo, v, 1)
    v = await jouerDesIndices(b, leo, v, 1)
    assert.equal(v.manches[1].naturel, 3)
    v = await ouvrirLaManche(b, leo, v, 2)
    b.horloge.t = v.chrono!.echeance + GRACE_D_UNE_MANCHE_MS + 1
    v = ok(await unGeste(b, leo, v, { quoi: 'repondre', manche: 2, auto: true }), 'l’échéance')
    assert.equal((v.revelation?.corps as IndicesReveles).titre, `C’était ${ficheDe(b, v.id, 2).fiche.reponse}`)
    assert.deepEqual([v.phase, v.bilan?.naturel], ['finie', [etoilesDesIndices(4), 3, 0]])
  } finally {
    await b.banc.close()
  }
})

test('par les routes : la Réplique — le mot, puis qui l’a dite, chacun son chrono ; le temps du mot écoulé, « Qui l’a dit ? » s’ouvre quand même', async () => {
  const b = await bancDuCabinet()
  try {
    const mia = await inscrireProfil(b.banc.url, 'mia', 'Mia')
    let v = ok(await commencer(b, mia, { origine: 'libre', jeu: 'replique', carte: null }), 'la Réplique')
    const t0 = repliqueDe(b, v.id, 0)
    const r0 = t0.replique
    assert.deepEqual(v.enCours, { jeu: 'replique', etape: 1, avant: r0.avant, apres: r0.apres, mots: t0.mots.map(mot => ({ mot, efface: false })) })
    // « Qui » avant le mot : la page ne montre pas encore les noms.
    const tot = await unGeste(b, mia, v, { quoi: 'repondre', manche: 0, reponse: { replique: { qui: 0 } } })
    assert.deepEqual([tot.status, tot.corps], [400, { error: 'Choisis d’abord le mot qui manque' }])
    // Le mot choisi ouvre la seconde étape et son chrono à elle — sans dire s'il était bon.
    b.horloge.t += 10_000
    v = ok(await unGeste(b, mia, v, { quoi: 'mot', manche: 0, choix: t0.bonMot }), 'le mot')
    assert.deepEqual(v.enCours, { jeu: 'replique', etape: 2, avant: r0.avant, apres: r0.apres, motChoisi: t0.mots[t0.bonMot], personnes: t0.personnes.map(nom => ({ nom, efface: false })) })
    assert.deepEqual([v.chrono?.dureeMs, v.chrono!.echeance - b.horloge.t], [DUREES_DES_JEUX.replique * 1000, DUREES_DES_JEUX.replique * 1000])
    v = ok(await unGeste(b, mia, v, { quoi: 'repondre', manche: 0, reponse: { replique: { qui: t0.bonneQui } } }), 'qui l’a dite')
    assert.equal((v.revelation?.corps as RepliqueRevelee).titre, 'Le bon mot')
    assert.equal(v.manches[0].naturel, ETOILES_DE_LA_REPLIQUE.mot + ETOILES_DE_LA_REPLIQUE.qui)
    // Un autre mot, la bonne personne : une étoile.
    v = await ouvrirLaManche(b, mia, v, 1)
    v = await jouerUneReplique(b, mia, v, 1, { mot: false })
    assert.equal((v.revelation?.corps as RepliqueRevelee).titre, `C’était « ${repliqueDe(b, v.id, 1).replique.mot} »`)
    assert.equal(v.manches[1].naturel, ETOILES_DE_LA_REPLIQUE.qui)
    // Le temps du mot écoulé : la page envoie sa réponse vide, le mot est perdu, et « Qui l'a dit ? » s'ouvre.
    v = await ouvrirLaManche(b, mia, v, 2)
    b.horloge.t = v.chrono!.echeance + GRACE_D_UNE_MANCHE_MS + 1
    v = ok(await unGeste(b, mia, v, { quoi: 'repondre', manche: 2, auto: true }), 'le temps du mot')
    assert.equal((v.enCours as RepliqueMontreeAQui).etape, 2)
    assert.equal((v.enCours as RepliqueMontreeAQui).motChoisi, null)
    v = ok(await unGeste(b, mia, v, { quoi: 'repondre', manche: 2, reponse: { replique: { qui: repliqueDe(b, v.id, 2).bonneQui } } }), 'qui, quand même')
    assert.deepEqual([v.phase, v.bilan?.naturel], ['finie', [3, ETOILES_DE_LA_REPLIQUE.qui, ETOILES_DE_LA_REPLIQUE.qui]])
  } finally {
    await b.banc.close()
  }
})

// ── Tes murs ──────────────────────────────────────────────────────────────

/** Un événement daté de la base, tel que les frises le lisent. */
const evenement = (id: string, annee: number): EvenementDeLaFrise => ({ id, evenement: `L’événement ${id}`, annee, categorie: 'Histoire' })

test('tes murs : chaque lieu épinglé, chaque date rangée — d’où qu’elle vienne, une fois, du plus ancien au plus récent ; rien de ce qui a quitté le contenu', () => {
  const [l1, l2] = CONTENU.lieux
  const f = CONTENU.frises[0]
  const evenements = new Map(['q1', 'q2', 'q3'].map((id, k) => [id, evenement(id, [1789, 1492, 1969][k])]))
  const vues = new Map<string, number>([
    [idDuLieu(l1.id), ilYA(3)],
    [idDuLieu(l2.id), ilYA(1)],
    // Un lieu qui a quitté le contenu ne s'y montre plus.
    [idDuLieu('un-lieu-retire'), ilYA(2)],
    // Une frise à thème rangée à moitié : on ne sait pas lesquelles de ses dates il a vues.
    [idDeLaFriseATheme(f.id, 0), ilYA(5)],
    // Une frise de l'Expédition (q4 a quitté la base), puis une frise d'un sujet au Cabinet, qui revoit q1 plus tard.
    ['frise:q1+q2+q4', ilYA(4)],
    [idDeLaFriseDeSujet(['q1', 'q3']), ilYA(2)],
    // L'Éclair, une question de la base vue en série : pas des dates.
    [idDeLEclair(['q2', 'q3', 'q5', 'q6', 'q7']), ilYA(1)],
    ['q2', ilYA(0)],
  ])
  const murs = (v = vues) => mursDe({ vues: v, lieux: CONTENU.lieux, frises: CONTENU.frises, evenements })
  const m = murs()
  assert.deepEqual(m.lieux.map(x => x.id), [l2.id, l1.id], 'le plus récemment épinglé d’abord')
  assert.deepEqual(m.lieux[0], { id: l2.id, nom: l2.nom, commune: l2.commune, departement: l2.departement, date: l2.date, annee: l2.annee, lat: l2.lat, lon: l2.lon, vuLe: ilYA(1) })
  assert.deepEqual(m.dates, [
    { libelle: 'L’événement q2', annee: 1492, de: 'expedition', vuLe: ilYA(4) },
    { libelle: 'L’événement q1', annee: 1789, de: 'cabinet', vuLe: ilYA(2) },
    { libelle: 'L’événement q3', annee: 1969, de: 'cabinet', vuLe: ilYA(2) },
  ])
  // Rangée jusqu'à sa dernière vague, la frise à thème donne ses sept dates — du plus ancien au plus récent avec les autres.
  const entiere = murs(new Map([...vues, [idDeLaFriseATheme(f.id, VAGUES_DE_LA_FRISE.length - 1), ilYA(5)]]))
  assert.equal(entiere.dates.length, 3 + f.evenements.length)
  for (const e of f.evenements) assert.ok(entiere.dates.some(d => d.libelle === e.libelle && d.annee === e.annee && d.de === 'cabinet' && d.vuLe === ilYA(5)), e.libelle)
  assert.deepEqual(entiere.dates.map(d => d.annee), [...entiere.dates.map(d => d.annee)].sort((x, y) => x - y))
  // Champ par champ : un champ de plus du contenu n'y part pas de lui-même.
  const enTrop = mursDe({ vues, lieux: [{ ...l1, cle: 'un-champ-neuf' } as Lieu], frises: [], evenements: new Map() })
  assert.ok(!JSON.stringify(enTrop).includes('un-champ-neuf'))
  assert.deepEqual(mursDe({ vues: new Map(), lieux: CONTENU.lieux, frises: CONTENU.frises, evenements }), { lieux: [], dates: [] })
})

test('par les routes : tes murs — chaque lieu épinglé, chaque frise rangée jusqu’au bout ; rien d’une manche pas tranchée, rien d’un autre profil', async () => {
  const b = await bancDuCabinet()
  try {
    const ana = await inscrireProfil(b.banc.url, 'ana', 'Ana')
    const tom = await inscrireProfil(b.banc.url, 'tom', 'Tom')
    const lesMurs = async (cookie: string | undefined) => lireLaRoute<MursDuCabinet>(b, cookie, '/api/cabinet/murs')
    const anonyme = await lesMurs(undefined)
    assert.equal(anonyme.status, 401)
    assert.equal(anonyme.entetes.get('cache-control'), 'no-store')
    assert.deepEqual(ok(await lesMurs(ana), 'des murs vides'), { lieux: [], dates: [] })

    // Un lieu épinglé y entre à son verdict ; celui de la manche en jeu attend le sien.
    let v = ok(await commencer(b, ana, { origine: 'libre', jeu: 'epingle', carte: null }), 'l’Épingle')
    const [t0, t1, t2] = [0, 1, 2].map(k => epingleDe(b, v.id, k))
    v = await jouerUneEpingle(b, ana, v, 0)
    const epinglee = b.horloge.t
    v = await ouvrirLaManche(b, ana, v, 1)
    let murs = ok(await lesMurs(ana), 'les murs en pleine partie')
    assert.deepEqual(murs.lieux, [{ id: t0.lieu.id, nom: t0.lieu.nom, commune: t0.lieu.commune, departement: t0.lieu.departement, date: t0.lieu.date, annee: t0.lieu.annee, lat: t0.lieu.lat, lon: t0.lieu.lon, vuLe: epinglee }])
    // Quittée, la manche ouverte compte et se révèle : son lieu rejoint les murs ; la troisième, jamais ouverte, non.
    b.horloge.t += 1_000
    v = ok(await unGeste(b, ana, v, { quoi: 'quitter' }), 'quitter')
    murs = ok(await lesMurs(ana), 'les murs après la partie')
    assert.deepEqual(murs.lieux.map(x => x.id), [t1.lieu.id, t0.lieu.id])
    assert.ok(!murs.lieux.some(x => x.id === t2.lieu.id))
    assert.deepEqual(murs.dates, [])

    // Une frise rangée jusqu'au bout : ses sept dates, du plus ancien au plus récent.
    let f = ok(await commencer(b, ana, { origine: 'libre', jeu: 'frise', carte: null }), 'la Frise')
    const frise = friseDe(b, f.id, 0)
    // Une frise d'un sujet daterait ses nouveaux venus à chaque vague : la base du banc n'en date aucun, mais l'épreuve le dit
    // plutôt que d'y compter (les frises des sujets : l'épreuve des murs au magasin, plus bas).
    assert.equal(frise.sorte, 'theme', 'une frise à thème : ses dates n’entrent qu’à sa dernière vague')
    for (let k = 0; k < 3; k++) {
      if (k > 0) f = await ouvrirLaManche(b, ana, f, k)
      f = await jouerUneFrise(b, ana, f, k)
      if (k < 2) assert.deepEqual(ok(await lesMurs(ana), 'une frise à moitié rangée').dates, [], 'ses vagues à venir sont encore à ranger')
    }
    murs = ok(await lesMurs(ana), 'les murs après la frise')
    assert.deepEqual(
      murs.dates.map(d => [d.libelle, d.annee, d.de]),
      [...frise.evenements].sort((x, y) => x.annee - y.annee).map(e => [e.libelle, e.annee, 'cabinet']),
    )
    // Ceux d'un autre profil : rien des siens.
    assert.deepEqual(ok(await lesMurs(tom), 'les murs d’un autre'), { lieux: [], dates: [] })
  } finally {
    await b.banc.close()
  }
})

after(fermerLesMagasins)

test('tes murs, au magasin : les dates d’une frise de l’Expédition et d’une frise d’un sujet, que seule la base jouable date', async () => {
  // Six questions de la base datées, sous l'identifiant de six lignes des frises : celles du banc ne datent rien.
  const lignes = lignesDesFrises().slice(0, 6)
  const annees = [1515, 1610, 1789, 1848, 1914, 1969]
  const base = baseDuCabinet(8, lignes.map((l, k) => questionDUneFrise(l.id, annees[k])))
  const horloge = { t: DIX_HEURES }
  const fichier = path.join(dossierDEssai(), 'cabinet.db')
  const avant = await magasinDEssai(fichier, horloge, base)
  assert.deepEqual(mursDe(await avant.cabinet.murs('qui')), { lieux: [], dates: [] }, 'rien de rangé : rien à dater')
  // Une frise de l'Expédition (les quatre premières), puis la manche d'une frise d'un sujet au Cabinet (la quatrième, revue, et la
  // cinquième) ; la sixième, jamais rangée. Écrites à la main : un serveur qui démarre les lit avec le journal.
  const [a, b, c, d, e] = lignes.map(l => l.id)
  piecesALaMain(fichier, 'qui', [
    { id: `${PREFIXE_DE_LA_FRISE}${[a, b, c, d].join('+')}`, mode: 'expedition', le: ilYA(4) },
    { id: idDeLaFriseDeSujet([d, e]), mode: 'cabinet', le: ilYA(2) },
  ])
  const m = await magasinDEssai(fichier, horloge, base)
  const murs = mursDe(await m.cabinet.murs('qui'))
  const de = (k: number, ou: 'expedition' | 'cabinet', vuLe: number) => ({ libelle: lignes[k].evenement, annee: annees[k], de: ou, vuLe })
  // Chaque date une fois, du plus ancien au plus récent ; celle vue deux fois garde sa dernière vue, et dit où.
  assert.deepEqual(murs.dates, [de(0, 'expedition', ilYA(4)), de(1, 'expedition', ilYA(4)), de(2, 'expedition', ilYA(4)), de(3, 'cabinet', ilYA(2)), de(4, 'cabinet', ilYA(2))])
  // Rien d'un autre profil.
  assert.deepEqual(mursDe(await m.cabinet.murs('autre')), { lieux: [], dates: [] })
})
