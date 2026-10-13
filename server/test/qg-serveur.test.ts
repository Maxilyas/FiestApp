// La santé du serveur au QG (`/admin#serveur`, les choix du 13 octobre
// 2026) : sept jours heure par heure dans la base permanente — ce que les
// joueurs attendent, les réveils et les arrêts, les erreurs —, et quatre
// alertes dans « À traiter » : un arrêt net, des erreurs serveur, Turso lent,
// la mémoire près du plafond.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { ReleveHoraire } from '../src/core/pouls'
import {
  alertesDuServeur,
  arreteNet,
  debutDeLHeure,
  pageDuServeur,
  sorteDuDemarrage,
  type DemarrageDuServeur,
  type HeureDeSante,
  type PageDuServeur,
} from '../../shared/santeDuServeur'
import { lesChosesATraiter, type ATraiterDuQg, type VueDEnsemble } from '../../shared/qg'

const H = 3_600_000
// Mardi 13 octobre 2026, 21 h 04 à Paris — à l'heure d'été, deux heures devant UTC.
const maintenant = Date.UTC(2026, 9, 13, 19, 4)
/** Il y a `jours` jours, à telle heure de Paris. */
const a = (jours: number, heure: number, minutes = 0) => Date.UTC(2026, 9, 13 - jours, heure - 2, minutes)
const sansInsecables = (s: string) => s.replace(/ /g, ' ')

const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))

test('le relevé de l’heure : ce que les modules lui disent, et l’heure d’avant qui reste le temps de s’écrire', () => {
  let t = Date.UTC(2026, 9, 13, 19, 10)
  const r = new ReleveHoraire(() => t)
  for (let i = 0; i < 30; i++) r.base(20 + i)
  for (let i = 0; i < 6; i++) r.route('GET /api/jour', 100 + i * 10)
  // Appelée une fois : un appel lent ne fait pas une route lente.
  r.route('GET /api/rare', 900)
  r.erreur('POST /api/x')
  r.erreur('POST /api/x')
  r.erreur('socket host:launch')
  r.echecDuMiroir()
  const [h] = r.lignes('d1')
  assert.deepEqual([h.heure, h.demarrage], [Date.UTC(2026, 9, 13, 19), 'd1'])
  assert.deepEqual(h.base, { n: 30, p50: 35, p95: 48, max: 49 })
  assert.equal(h.routes?.n, 7)
  assert.deepEqual(h.lentes, [{ route: 'GET /api/jour', n: 6, p95: 150 }])
  assert.deepEqual(h.erreurs, { 'POST /api/x': 2, 'socket host:launch': 1 })
  assert.equal(h.miroir, 1)

  // L'heure suivante : celle d'avant reste à côté, ses dernières minutes s'écrivent après coup.
  t += H
  r.base(10)
  assert.deepEqual(
    r.lignes('d1').map(l => [l.heure, l.base?.n]),
    [
      [Date.UTC(2026, 9, 13, 19), 30],
      [Date.UTC(2026, 9, 13, 20), 1],
    ],
  )
  // Les sources d'erreur sont bornées : au-delà de vingt, « autre ».
  for (let i = 0; i < 25; i++) r.erreur(`GET /api/route-${i}`)
  const erreurs = r.lignes('d1')[1].erreurs
  assert.equal(Object.keys(erreurs).length, 21)
  assert.equal(erreurs.autre, 5)
  // Un serveur neuf part de zéro.
  r.remettreAZero()
  assert.deepEqual(
    r.lignes('d1').map(l => [l.base, l.routes, l.erreurs, l.miroir]),
    [[null, null, {}, 0]],
  )
})

// Une semaine de démarrages : un réveil, un arrêt net puis son redémarrage,
// une mise en ligne, une relance, et celui qui répond.
const demarrage = (id: string, d: Partial<DemarrageDuServeur>): DemarrageDuServeur => ({
  id,
  demarreLe: 0,
  pretEnMs: 1000,
  version: 'aaaaaaa',
  env: 'production',
  vuLe: 0,
  arreteLe: null,
  ...d,
})
const SEMAINE: DemarrageDuServeur[] = [
  // Avant la semaine : la sorte du premier se lit dans lui.
  demarrage('z', { demarreLe: a(9, 7), vuLe: a(9, 23, 59), arreteLe: a(9, 23, 59) }),
  demarrage('a', { demarreLe: a(5, 7, 2), pretEnMs: 900, vuLe: a(5, 23, 50), arreteLe: a(5, 23, 50) }),
  // Arrêté net : ni extinction, son dernier signe à 14 h 12.
  demarrage('b', { demarreLe: a(4, 7, 3), pretEnMs: 1200, vuLe: a(4, 14, 12) }),
  demarrage('c', { demarreLe: a(4, 14, 30), pretEnMs: 4100, vuLe: a(3, 18, 41), arreteLe: a(3, 18, 41) }),
  demarrage('d', { demarreLe: a(3, 18, 40), pretEnMs: 2500, version: 'bbbbbbb', vuLe: a(2, 23, 55), arreteLe: a(2, 23, 55) }),
  demarrage('e', { demarreLe: a(1, 7, 1), pretEnMs: 800, version: 'bbbbbbb', vuLe: a(1, 12), arreteLe: a(1, 12) + 20_000 }),
  // Relancé : l'ancien s'est éteint juste après.
  demarrage('f', { demarreLe: a(1, 12), pretEnMs: 950, version: 'bbbbbbb', vuLe: a(1, 23, 58), arreteLe: a(1, 23, 58) }),
]
const COURANT = demarrage('g', { demarreLe: a(0, 7, 2), pretEnMs: 1800, version: 'bbbbbbb', vuLe: maintenant - 4 * 60_000 })

const ligne = (heure: number, demarrage: string, l: Partial<HeureDeSante>): HeureDeSante => ({
  heure,
  demarrage,
  base: null,
  routes: null,
  lentes: [],
  erreurs: {},
  miroir: 0,
  ...l,
})
const LIGNES: HeureDeSante[] = [
  // Deux démarrages dans la même heure : b, arrêté net à 14 h 12, puis c.
  ligne(a(4, 14), 'b', {
    base: { n: 10, p50: 30, p95: 60, max: 80 },
    routes: { n: 20, p50: 100, p95: 300, max: 500 },
    erreurs: { 'POST /api/jour/reponse': 2 },
  }),
  ligne(a(4, 14), 'c', {
    base: { n: 30, p50: 50, p95: 90, max: 120 },
    routes: { n: 10, p50: 200, p95: 250, max: 260 },
    erreurs: { 'POST /api/jour/reponse': 1, 'socket host:launch': 1 },
    miroir: 2,
  }),
  ligne(a(3, 19), 'd', { base: { n: 12, p50: 40, p95: 100, max: 130 }, routes: { n: 50, p50: 90, p95: 300, max: 400 } }),
  ligne(a(3, 20), 'd', { base: { n: 15, p50: 45, p95: 120, max: 150 }, routes: { n: 45, p50: 95, p95: 320, max: 410 } }),
  ligne(a(0, 20), 'g', {
    base: { n: 25, p50: 60, p95: 140, max: 160 },
    routes: { n: 40, p50: 120, p95: 420, max: 700 },
    lentes: [{ route: 'GET /api/jour', n: 30, p95: 520 }],
  }),
  ligne(a(0, 21), 'g', { base: { n: 5, p50: 55, p95: 110, max: 115 }, routes: { n: 6, p50: 110, p95: 380, max: 390 } }),
]

test('sept jours heure par heure : les heures fondues, la nuit endormie, chaque démarrage et sa raison, les arrêts nets', () => {
  const page = pageDuServeur(LIGNES, SEMAINE, { maintenant, courant: COURANT })
  assert.equal(page.heures.length, 168)
  assert.equal(page.heures.at(-1)!.heure, debutDeLHeure(maintenant))
  assert.deepEqual(page.enMarche, { depuis: a(0, 7, 2), version: 'bbbbbbb', env: 'production' })

  const heure = (t: number) => page.heures.find(h => h.heure === t)!
  // b et c dans la même heure : le pire des 95ᵉ centiles, les erreurs additionnées.
  assert.deepEqual(heure(a(4, 14)), { heure: a(4, 14), eveille: true, base: 90, routes: 300, erreurs: 4, miroir: 2 })
  // La nuit, l'hébergeur dort ; le matin, le réveil de 7 h 02 compte son heure.
  assert.equal(heure(a(0, 3)).eveille, false)
  assert.equal(heure(a(0, 7)).eveille, true)
  assert.deepEqual(heure(a(1, 23)), { heure: a(1, 23), eveille: true, base: null, routes: null, erreurs: 0, miroir: 0 })

  assert.deepEqual(
    page.evenements.map(e => [e.sorte, e.quand]),
    [
      ['reveil', a(0, 7, 2)],
      ['relance', a(1, 12)],
      ['reveil', a(1, 7, 1)],
      ['mise-en-ligne', a(3, 18, 40)],
      ['apres-arret', a(4, 14, 30)],
      ['arret-net', a(4, 14, 12)],
      ['reveil', a(4, 7, 3)],
      ['reveil', a(5, 7, 2)],
    ],
  )
  assert.deepEqual(page.chiffres.demarrages, { n: 7, plusLongMs: 4100 })
  assert.equal(page.chiffres.arretsNets, 1)
  assert.deepEqual(page.chiffres.erreurs, {
    n: 4,
    derniere: a(4, 14),
    sources: [
      { source: 'POST /api/jour/reponse', n: 3 },
      { source: 'socket host:launch', n: 1 },
    ],
  })
  // La dernière heure mesurée, et l'habitude : la médiane des heures assez fournies.
  assert.deepEqual(page.chiffres.base, { derniere: 110, habituelle: 110 })
  assert.deepEqual(page.chiffres.routes, { derniere: 380, habituelle: 320, plusLente: { route: 'GET /api/jour', p95: 520 } })
})

test('un démarrage ne se juge pas arrêté net tant qu’il donne signe de vie : à une relance, l’ancien vit encore un instant', () => {
  const ancien = demarrage('x', { demarreLe: maintenant - 3 * H, vuLe: maintenant - 5 * 60_000 })
  const neuf = demarrage('y', { demarreLe: maintenant - 2 * 60_000, vuLe: maintenant })
  assert.equal(arreteNet(ancien, maintenant, 'y'), false)
  assert.equal(sorteDuDemarrage(neuf, ancien, maintenant, 'y'), 'relance')
  // Vingt minutes de silence plus tard, sans extinction : arrêté net.
  assert.equal(arreteNet(ancien, maintenant + 21 * 60_000, 'y'), true)
  assert.equal(sorteDuDemarrage(neuf, ancien, maintenant + 21 * 60_000, 'y'), 'apres-arret')
  // Celui qui répond n'est jamais arrêté net, même sans relevé récent.
  assert.equal(arreteNet(neuf, maintenant + 5 * H, 'y'), false)
})

test('les alertes du serveur : un arrêt net du jour, les erreurs depuis l’heure d’avant, Turso sur assez d’allers-retours, la mémoire', () => {
  const cetteHeure = debutDeLHeure(maintenant)
  const recentes = [
    ligne(cetteHeure - H, 'g', { erreurs: { 'POST /api/x': 2 }, base: { n: 40, p50: 300, p95: 1400, max: 2000 } }),
    // L'heure en cours n'a que cinq allers-retours : Turso se juge sur celle d'avant.
    ligne(cetteHeure, 'g', { erreurs: { 'POST /api/x': 1, 'socket host:launch': 1 }, base: { n: 5, p50: 50, p95: 80, max: 90 } }),
    // Plus vieille que l'heure d'avant : elle ne compte plus.
    ligne(cetteHeure - 2 * H, 'g', { erreurs: { 'GET /api/vieux': 9 } }),
  ]
  const demarrages = [
    demarrage('b', { demarreLe: maintenant - 30 * H, vuLe: maintenant - 2 * H }),
    demarrage('vieux', { demarreLe: maintenant - 40 * H, vuLe: maintenant - 30 * H }),
  ]
  const alertes = alertesDuServeur({ recentes, demarrages, memoireMo: 462, maintenant, courant: 'g' })
  assert.deepEqual(alertes, {
    arretNet: { vers: maintenant - 2 * H },
    erreurs: { n: 4, depuis: cetteHeure - H, source: 'POST /api/x' },
    tursoLent: { p95: 1400, depuis: cetteHeure - H },
    memoireMo: 462,
  })
  assert.deepEqual(alertesDuServeur({ recentes: [], demarrages: [], memoireMo: 300, maintenant, courant: 'g' }), {
    arretNet: null,
    erreurs: null,
    tursoLent: null,
    memoireMo: null,
  })

  // Dans « À traiter » : après le miroir, avant la réserve — trois en rouge, Turso lent en sourdine.
  const calme: ATraiterDuQg = {
    reserve: { joursDAvance: 6 },
    signalementsDuJour: { questions: 0, joueurs: 0 },
    signalementsDeLaCampagne: { questions: 0, joueurs: 0 },
    catalogue: 0,
    rappel: null,
    routine: { jour: null, campagne: null },
    serveur: alertes,
  }
  const choses = lesChosesATraiter(calme, null, maintenant)
  assert.deepEqual(
    choses.map(c => [c.cle, c.alerte, c.ecran]),
    [
      ['arret-net', true, 'serveur'],
      ['erreurs', true, 'serveur'],
      ['memoire', true, 'serveur'],
      ['turso-lent', false, 'serveur'],
      ['reserve', true, 'jour'],
    ],
  )
  assert.deepEqual(
    choses.slice(0, 4).map(c => sansInsecables(`${c.titre} — ${c.detail}`)),
    [
      'Le serveur s’est arrêté net — aujourd’hui à 19 h 04, sans s’éteindre proprement',
      '4 erreurs serveur — depuis 20 h 00 · POST /api/x',
      'La mémoire approche du plafond — 462 Mo sur 512 : au-delà, l’hébergeur arrête le serveur',
      'Turso répond lentement — 1,4 s au 95ᵉ centile depuis 20 h 00',
    ],
  )
  // Sans l'heure qu'il est, l'arrêt net garde la sienne.
  assert.equal(sansInsecables(lesChosesATraiter(calme, null)[0].detail), 'vers 19 h 04, sans s’éteindre proprement')
})

test('un vrai serveur se souvient de lui-même : son démarrage, une erreur serveur, son extinction propre — et un arrêt net se voit au réveil', async () => {
  const banc = await demarrer()
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
  try {
    const admin = await connexionAnimateur(banc.url)
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa', '🦊')
    const idLea = (await lire(banc, lea, '/api/joueur/moi')).corps.profile.id as string

    // Son démarrage est écrit, et il vit.
    const page = (await lire<PageDuServeur>(banc, admin, '/api/admin/serveur')).corps
    assert.deepEqual(
      page.evenements.map(e => e.sorte),
      ['reveil'],
    )
    assert.equal(page.chiffres.demarrages.n, 1)
    assert.equal(page.heures.length, 168)
    assert.equal(page.heures.at(-1)!.eveille, true)
    assert.ok(page.chiffres.routes.derniere !== null, 'les routes de l’heure, lues dans le relevé')

    // Une vraie erreur serveur : la base refuse le don.
    db.exec(`CREATE TRIGGER refus BEFORE INSERT ON profile_dons BEGIN SELECT RAISE(ABORT, 'quota'); END`)
    const refuse = await ecrire(banc.url, `/api/admin/profils/${idLea}/confettis`, { confettis: 10 }, admin)
    assert.equal(refuse.status, 500)
    db.exec('DROP TRIGGER refus')
    const route = 'POST /api/admin/profils/:id/confettis'
    const vue = (await lire<VueDEnsemble>(banc, admin, '/api/admin/qg')).corps
    assert.deepEqual(vue.aTraiter.serveur.erreurs && [vue.aTraiter.serveur.erreurs.n, vue.aTraiter.serveur.erreurs.source], [1, route])
    assert.equal(vue.aTraiter.serveur.arretNet, null)
    // Sur la page, l'heure en cours se lit dans le relevé : plus fraîche que la base.
    assert.deepEqual((await lire<PageDuServeur>(banc, admin, '/api/admin/serveur')).corps.chiffres.erreurs.sources, [{ source: route, n: 1 }])

    // Éteint proprement : son extinction s'écrit, et son heure avec son erreur.
    await banc.redemarrer()
    const lesDemarrages = () => db.prepare('SELECT id, arrete_le FROM qg_demarrages ORDER BY demarre_le').all() as { id: string; arrete_le: number | null }[]
    // Le démarrage du second s'écrit une fois son port ouvert, sans le faire attendre.
    for (let i = 0; i < 100 && lesDemarrages().length < 2; i++) await patienter(20)
    const demarrages = lesDemarrages()
    assert.equal(demarrages.length, 2)
    assert.notEqual(demarrages[0].arrete_le, null, 'le premier s’est éteint proprement')
    assert.equal(demarrages[1].arrete_le, null, 'le second vit')
    const heures = db.prepare('SELECT releve FROM qg_sante WHERE demarrage = ?').all(demarrages[0].id) as { releve: string }[]
    assert.ok(
      heures.some(h => JSON.parse(h.releve).erreurs[route] === 1),
      'son heure est écrite, avec son erreur',
    )

    // Un arrêt net : le premier démarrage n'a plus ni extinction ni signe depuis une heure.
    db.prepare('UPDATE qg_demarrages SET demarre_le = ?, vu_le = ?, arrete_le = NULL WHERE id = ?').run(Date.now() - 2 * H, Date.now() - H, demarrages[0].id)
    const admin2 = await connexionAnimateur(banc.url)
    const apres = (await lire<PageDuServeur>(banc, admin2, '/api/admin/serveur')).corps
    assert.deepEqual(
      apres.evenements.map(e => e.sorte),
      ['apres-arret', 'arret-net', 'reveil'],
    )
    assert.equal(apres.chiffres.arretsNets, 1)
    const vue2 = (await lire<VueDEnsemble>(banc, admin2, '/api/admin/qg')).corps
    assert.ok(vue2.aTraiter.serveur.arretNet, 'un arrêt net du jour attend un geste')
    // Le relevé repart de zéro avec le serveur : l'erreur d'avant est dans la base, pas dans l'alerte.
    assert.equal(vue2.aTraiter.serveur.erreurs, null)
  } finally {
    db.close()
    await banc.close()
  }
})

test('la page « Le serveur » se lit d’un coup d’œil : quatre chiffres, la nuit hachurée, chaque réveil et sa raison', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#serveur', origin: 'http://banc' } } })
  const { SanteDuServeurAuQg } = await import(new URL('../../client/src/components/QgServeur.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const page = pageDuServeur(LIGNES, SEMAINE, { maintenant, courant: COURANT })
  const html = sansInsecables(renderToStaticMarkup(React.createElement(SanteDuServeurAuQg, { page })).replace(/<!-- -->/g, ''))
  for (const attendu of [
    'version bbbbbbb · en marche depuis 14 h 02',
    'le plus long : prêt en 4,1 s',
    '1 arrêt net',
    'la dernière : ven. 9 oct., 14 h',
    '110 ms d’habitude',
    'la plus lente : GET /api/jour',
    'Redémarrage après un arrêt net',
    'Mise en ligne',
    'Relancé',
    'dernier signe ven. 9 oct. à 14 h 12',
    'aujourd’hui à 7 h 02 · prêt en 1,8 s',
    'POST /api/jour/reponse',
    'serveur-routes-endormi',
    'Les chiffres des',
  ]) {
    assert.ok(html.includes(attendu), `« ${attendu} » dans la page`)
  }
  for (const absent of ['NaN', 'undefined', 'null']) assert.ok(!html.includes(absent), `pas de « ${absent} »`)
})
