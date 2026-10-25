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
// (`cabinet-contenu.test.ts`). Le lot C7 y ajoutera le tirage et les routes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hasardDe } from '../../shared/missions'
import type { Fiche, Lieu, Replique } from '../../shared/cabinet/contenu'
import { DANS_LA_FRANCE, distanceKm, type Point } from '../../shared/cabinet/france'
import {
  DECALAGE_DE_LA_ZONE_KM,
  DUREES_DES_JEUX,
  ETOILES_DE_LA_REPLIQUE,
  INDICES_DES_ETOILES,
  KM_DE_L_EPINGLE,
  LETTRES_POUR_UNE_FAUTE,
  MOTS_D_UNE_IDENTITE_MAX,
  RAYON_D_ECLAIRER_KM,
} from '../../shared/cabinet/bareme'
import { effacablesAuPlus, refusDuPouvoir } from '../../shared/cabinet/pouvoirs'
import { PREFIXE_DU_CABINET, deplier, idDeLaFiche, idDeLaReplique, idDuLieu } from '../../shared/cabinet/pieces'
import { justeDeLaPiece, type VerdictDUneManche } from '../../shared/cabinet/jeux/regle'
import { GESTE_A_JUGER } from '../../shared/cabinet/jeux/outils'
import {
  REGLE_DE_L_EPINGLE,
  epingleTiree,
  etoilesDeLaDistance,
  kmDits,
  pointADistance,
  zoneDEclairer,
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
  type IndicesTires,
} from '../../shared/cabinet/jeux/indices'
import {
  REGLE_DE_LA_REPLIQUE,
  repliqueEntiere,
  repliqueTiree,
  type EtatDeLaReplique,
  type GesteDeLaReplique,
  type RepliqueTiree,
} from '../../shared/cabinet/jeux/replique'

/** La phrase que dit la seule règle des refus quand la manche n'a plus rien à souffler : les jeux ne la recopient pas. */
const RIEN_A_ECLAIRER = refusDuPouvoir({ pouvoir: 'eclairer', force: 3, jeu: 'epingle', servi: 0, aEclairer: false })

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

test('l’Épingle : Éclairer entoure une zone de 170 km qui contient toujours le lieu, sans jamais le dire — mille hasards', () => {
  assert.equal(RAYON_D_ECLAIRER_KM, 170)
  const [loin, plusLoin] = DECALAGE_DE_LA_ZONE_KM
  let auNord = 0
  for (const [i, point] of lieuxDEssai(1000).entries()) {
    // Mille hasards du tireur : le décalage de la zone se tire au départ, avec le lieu.
    const t = epingleTiree(lieuEn(point, i), hasardDe(`zone:${i}`))
    const e = REGLE_DE_L_EPINGLE.eclairer(t, REGLE_DE_L_EPINGLE.ouvrir(t), HASARD_DE_LA_GRAINE)
    assert.ok(typeof e !== 'string', 'la première fois, Éclairer sert')
    const zone = e.zone!
    assert.equal(zone.rayonKm, RAYON_D_ECLAIRER_KM)
    const ecart = distanceKm(zone, point)
    assert.ok(ecart <= zone.rayonKm, `${i} : le lieu est dans la zone (${ecart} km du centre)`)
    // Ni au centre, ni au bord : le centre décalé de 40 à 140 km ne dit pas où est le lieu.
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

test('les Indices : les indices vus, moins les offerts, plus les erreurs — 2 ★★★, 3 ★★, au-delà ★', () => {
  assert.deepEqual(INDICES_DES_ETOILES, [2, 3])
  assert.equal(etoilesDesIndices(1), 3)
  assert.equal(etoilesDesIndices(2), 3)
  assert.equal(etoilesDesIndices(3), 2)
  assert.equal(etoilesDesIndices(4), 1)
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
  // Un indice de plus : deux vus, encore ★★★ ; un troisième, ★★.
  assert.equal(trouver(jouer(t, [{ quoi: 'indice' }])).naturel, 3)
  const trois = jouer(t, [{ quoi: 'indice' }, { quoi: 'indice' }])
  assert.equal(comptesDesIndices(trois), 3)
  assert.equal(trouver(trois).naturel, 2)
  // Une erreur : une erreur et un indice de plus — deux de plus au compte, une étoile de moins.
  const uneErreur = jouer(t, [{ quoi: 'nom', texte: 'Zola' }])
  assert.deepEqual(uneErreur, { vus: 2, offerts: 0, essais: ['Zola'] })
  assert.equal(comptesDesIndices(uneErreur), 3)
  const v = trouver(uneErreur)
  assert.equal(v.naturel, 2)
  assert.deepEqual(piece0(v), { juste: true, choix: 0, composee: '2|1' })
  // L'indice qu'Éclairer offre ne compte pas : trois vus dont un offert, ★★★.
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
  assert.equal(montree.vaut, 1, 'trois vus et une erreur : la réponse vaut ★')
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
  assert.equal(v.naturel, 2, 'trois vus dont un offert, une erreur : trois au compte')
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
    assert.equal(REGLE_DE_LA_REPLIQUE.eclairer(t, e, HASARD_DE_LA_GRAINE), RIEN_A_ECLAIRER, 'deux restent toujours')
    const une = REGLE_DE_LA_REPLIQUE.montrer(t, e)
    assert.ok(une.etape === 1 && une.mots.filter(m => m.efface).length === 2)
    // La seconde étape repart sans rien d'effacé ; un nom sur trois s'y efface.
    let deux = REGLE_DE_LA_REPLIQUE.apresLeGeste(t, e, { quoi: 'mot', choix: 0 }) as EtatDeLaReplique
    assert.deepEqual(deux.effaces, [e.effaces[0], []])
    deux = REGLE_DE_LA_REPLIQUE.eclairer(t, deux, HASARD_DE_LA_GRAINE) as EtatDeLaReplique
    assert.deepEqual(deux.effaces[1], t.ordreDesEffaces[1].slice(0, 1))
    assert.ok(!deux.effaces[1].includes(t.bonneQui), 'jamais la bonne personne')
    assert.equal(REGLE_DE_LA_REPLIQUE.eclairer(t, deux, HASARD_DE_LA_GRAINE), RIEN_A_ECLAIRER)
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
