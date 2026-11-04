// La page « Le serveur » du QG 2 (le lot 2 de la proposition du 3 novembre
// 2026, `retours/2026-11-03/le-qg.md`) : chaque route chaque heure — ses
// appels, ses temps, ses refus, ses erreurs —, les tranches de cinq minutes
// qui font une heure, la période de la barre, la table des routes et les
// versions comparées. Tout tient dans la ligne JSON de l'heure (`qg_sante`) :
// pas une ligne de plus écrite ni lue au quota de Turso.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, demarrer, type Banc } from './banc'
import { ReleveHoraire } from '../src/core/pouls'
import {
  HEURE_MS,
  TRANCHE_MS,
  debutDeLHeure,
  debutDeLaTranche,
  pageDuServeur,
  periodeDuServeur,
  routesDeLaPeriode,
  tranchesFondues,
  versionsDuServeur,
  type DemarrageDuServeur,
  type HeureDeSante,
  type PageDuServeur,
  type RouteDeLHeure,
  type TrancheDeSante,
} from '../../shared/santeDuServeur'

const H = HEURE_MS
// Mardi 13 octobre 2026, 21 h 04 à Paris.
const maintenant = Date.UTC(2026, 9, 13, 19, 4)

const lire = <T = any>(banc: Banc, cookie: string, chemin: string) =>
  fetch(`${banc.url}${chemin}`, { headers: { Cookie: cookie } }).then(async r => ({ status: r.status, corps: (await r.json()) as T }))

test('chaque route chaque heure : son temps, ses refus et ses erreurs ; et ce qu’un joueur attend, cinq minutes par cinq minutes', () => {
  let t = Date.UTC(2026, 9, 13, 19, 2)
  const r = new ReleveHoraire(() => t)
  for (const ms of [100, 110, 90]) r.route('GET /api/jour', ms, 200)
  r.route('POST /api/jour/reponse', 300, 200)
  r.route('POST /api/jour/reponse', 500, 409)
  r.route('POST /api/jour/reponse', 700, 503)
  // Un appelant d'avant, sans statut : une réponse comme une autre.
  r.route('GET /api/vieille', 40)
  r.base(20)
  r.requete(200)
  r.requete(503)
  r.erreur('POST /api/jour/reponse')
  // Cinq minutes plus tard, la tranche suivante.
  t = Date.UTC(2026, 9, 13, 19, 7)
  r.route('GET /api/jour', 120, 200)
  r.charge({ processeur: 6, boucleMaxMs: 40, memoireMo: 210, invites: 3 })
  r.gel({ a: t, dureeMs: 900, processeurMs: 100, ramasseMiettesMs: 0, enCours: [] })

  const [h] = r.lignes('d1')
  // La plus coûteuse au serveur d'abord : ses appels fois son temps.
  assert.deepEqual(
    h.parRoute?.map(x => [x.route, x.n, x.totalMs, x.refusees, x.enErreur]),
    [
      ['POST /api/jour/reponse', 3, 1500, 1, 1],
      ['GET /api/jour', 4, 420, 0, 0],
      ['GET /api/vieille', 1, 40, 0, 0],
    ],
  )
  assert.deepEqual(h.parRoute?.[1], { route: 'GET /api/jour', n: 4, p50: 110, p95: 120, max: 120, totalMs: 420, refusees: 0, enErreur: 0 })
  // Les lentes se lisent toujours, tirées des mêmes routes.
  assert.deepEqual(h.lentes, [])
  // Deux tranches : 21 h 00 et 21 h 05, chacune ce qui y est tombé.
  const [premiere, seconde] = h.tranches ?? []
  assert.deepEqual([premiere?.debut, seconde?.debut], [Date.UTC(2026, 9, 13, 19, 0), Date.UTC(2026, 9, 13, 19, 5)])
  assert.equal(premiere.routes?.n, 7)
  assert.equal(premiere.base?.n, 1)
  assert.equal(premiere.erreurs, 1)
  assert.deepEqual(premiere.requetes, { reussies: 1, redirigees: 0, refusees: 0, enErreur: 1 })
  assert.equal(premiere.charge, null)
  assert.deepEqual(seconde.charge, { n: 1, processeur: 6, boucleMaxMs: 40, memoireMaxMo: 210, invitesMax: 3 })
  assert.deepEqual(seconde.gels, { n: 1, maxMs: 900 })
  assert.equal(seconde.routes?.n, 1)
  // Une heure neuve repart sans tranche ni route.
  t += H
  r.base(10)
  const nouvelle = r.lignes('d1')[1]
  assert.deepEqual([nouvelle.parRoute, nouvelle.tranches?.length], [[], 1])
})

const ligne = (heure: number, demarrage: string, l: Partial<HeureDeSante>): HeureDeSante => ({
  heure,
  demarrage,
  base: null,
  routes: null,
  lentes: [],
  erreurs: {},
  miroir: 0,
  charge: null,
  connexions: null,
  requetes: null,
  ...l,
})
const route = (r: Partial<RouteDeLHeure> & Pick<RouteDeLHeure, 'route' | 'n' | 'p95'>): RouteDeLHeure => ({
  p50: Math.round(r.p95 / 2),
  max: r.p95 * 2,
  totalMs: r.n * Math.round(r.p95 / 2),
  refusees: 0,
  enErreur: 0,
  ...r,
})
const tranche = (debut: number, t: Partial<TrancheDeSante>): TrancheDeSante => ({
  debut,
  routes: null,
  base: null,
  requetes: { reussies: 0, redirigees: 0, refusees: 0, enErreur: 0 },
  erreurs: 0,
  charge: null,
  gels: { n: 0, maxMs: 0 },
  ...t,
})
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

test('la période de la page : une heure en douze tranches de cinq minutes, une journée et une semaine heure par heure', () => {
  const heure = debutDeLHeure(maintenant)
  const courant = demarrage('g', { demarreLe: maintenant - 3 * H, vuLe: maintenant })
  // Deux démarrages dans les mêmes cinq minutes — une mise en ligne : leurs tranches se fondent.
  const lignes = [
    ligne(heure - H, 'f', {
      tranches: [tranche(heure - H + 10 * 60_000, { routes: { n: 10, p50: 80, p95: 200, max: 300 }, erreurs: 1 })],
    }),
    ligne(heure, 'f', {
      tranches: [tranche(heure, { routes: { n: 10, p50: 100, p95: 300, max: 320 }, charge: { n: 6, processeur: 4, boucleMaxMs: 50, memoireMaxMo: 200, invitesMax: 5 } })],
    }),
    ligne(heure, 'g', {
      tranches: [tranche(heure, { routes: { n: 30, p50: 60, p95: 250, max: 400 }, erreurs: 2, charge: { n: 2, processeur: 8, boucleMaxMs: 90, memoireMaxMo: 180, invitesMax: 9 } })],
    }),
  ]
  const page = pageDuServeur(lignes, [demarrage('f', { demarreLe: maintenant - 30 * H, vuLe: maintenant - 3 * H, arreteLe: maintenant - 3 * H })], {
    maintenant,
    courant,
    periode: '1h',
  })
  assert.equal(page.periode, '1h')
  assert.equal(page.pas, TRANCHE_MS)
  assert.equal(page.heures.length, 12)
  assert.deepEqual([page.heures[0].heure, page.heures.at(-1)!.heure], [debutDeLaTranche(maintenant) - 11 * TRANCHE_MS, debutDeLaTranche(maintenant)])
  const derniere = page.heures.at(-1)!
  // Les appels s'ajoutent, la médiane se pondère, le 95ᵉ centile garde le pire ; la charge se pondère par ses relevés.
  assert.deepEqual([derniere.routes, derniere.erreurs, derniere.processeur, derniere.boucle, derniere.memoire, derniere.invites], [300, 2, 5, 90, 200, 9])
  assert.equal(page.heures.find(h => h.heure === heure - H + 10 * 60_000)?.routes, 200)
  // Les erreurs de la période se comptent dans ses tranches.
  assert.equal(page.chiffres.erreurs.n, 3)

  // Une journée : vingt-quatre heures ; une semaine : cent soixante-huit.
  assert.deepEqual([pageDuServeur(lignes, [], { maintenant, courant, periode: '24h' }).heures.length, pageDuServeur(lignes, [], { maintenant, courant }).heures.length], [24, 168])
  assert.equal(pageDuServeur(lignes, [], { maintenant, courant, periode: '24h' }).pas, H)
  // Trente jours, ou n'importe quoi d'autre : la semaine — le relevé n'en garde que huit.
  assert.deepEqual(['1h', '24h', '7j', '30j', undefined, ['1h']].map(periodeDuServeur), ['1h', '24h', '7j', '7j', '7j', '7j'])
})

test('les connexions de cinq minutes : deux démarrages dans la même tranche les additionnent, une tranche d’avant leur relevé n’en dit rien', () => {
  const heure = debutDeLHeure(maintenant)
  const fondues = tranchesFondues([
    ligne(heure, 'f', { tranches: [tranche(heure, { connexions: { ouvertes: 2, attentes: 1, lassees: 0 } }), tranche(heure + TRANCHE_MS, {})] }),
    ligne(heure, 'g', { tranches: [tranche(heure, { connexions: { ouvertes: 1, attentes: 3, lassees: 1 } }), tranche(heure + TRANCHE_MS, {})] }),
    // Seul l'un des deux les relevait : ses comptes, tels quels.
    ligne(heure, 'h', { tranches: [tranche(heure + 2 * TRANCHE_MS, { connexions: { ouvertes: 4, attentes: 0, lassees: 0 } })] }),
  ])
  assert.deepEqual(fondues.get(heure)?.connexions, { ouvertes: 3, attentes: 4, lassees: 1 })
  assert.equal(fondues.get(heure + TRANCHE_MS)?.connexions, undefined)
  assert.deepEqual(fondues.get(heure + 2 * TRANCHE_MS)?.connexions, { ouvertes: 4, attentes: 0, lassees: 0 })
})

test('la table des routes : la plus coûteuse au serveur d’abord, ses centiles moyennés par ses appels, sa part, la période d’avant', () => {
  const heure = debutDeLHeure(maintenant)
  const lignes = [
    // La veille : la période d'avant.
    ligne(heure - 30 * H, 'e', { parRoute: [route({ route: 'GET /api/jour', n: 50, p95: 100 })] }),
    // La journée : deux heures, deux démarrages dans la seconde.
    ligne(heure - 2 * H, 'f', { parRoute: [route({ route: 'GET /api/jour', n: 30, p95: 200, max: 900, totalMs: 3000 })] }),
    ligne(heure, 'f', { parRoute: [route({ route: 'GET /api/jour', n: 10, p95: 400, max: 700, totalMs: 2000, refusees: 2 })] }),
    ligne(heure, 'g', {
      parRoute: [
        route({ route: 'GET /api/jour', n: 10, p95: 300, max: 500, totalMs: 1000, enErreur: 1 }),
        route({ route: 'POST /api/campagne/serie/:id/reponse', n: 100, p95: 80, totalMs: 4000 }),
      ],
    }),
  ]
  const routes = routesDeLaPeriode(lignes, { debut: heure - 23 * H, fin: heure, avantDebut: heure - 47 * H, avantFin: heure - 24 * H })
  assert.deepEqual(
    routes.map(r => r.route),
    ['GET /api/jour', 'POST /api/campagne/serie/:id/reponse'],
  )
  const [jour, reponse] = routes
  // 30 × 200 + 10 × 400 + 10 × 300, sur 50 appels : un pire de la semaine n'aurait dit que son réveil le plus froid.
  assert.deepEqual([jour.n, jour.p95, jour.max, jour.totalMs, jour.refusees, jour.enErreur], [50, 260, 900, 6000, 2, 1])
  assert.deepEqual([jour.part, reponse.part], [60, 40])
  assert.deepEqual(jour.avant, { n: 50, p95: 100 })
  assert.equal(reponse.avant, null)
  // Ses appels heure par heure, sur les vingt-quatre heures.
  assert.equal(jour.parHeure.length, 24)
  assert.deepEqual([jour.parHeure[21], jour.parHeure[23]], [30, 20])
  // Une heure ne se découpe pas : pas d'appels heure par heure.
  assert.deepEqual(routesDeLaPeriode(lignes, { debut: heure - H, fin: heure, avantDebut: heure - 3 * H, avantFin: heure - 2 * H })[0].parHeure, [])
})

test('les versions de la semaine : chacune ce qu’un joueur a attendu sous elle, ses erreurs pour mille requêtes, et les routes qu’elle a ralenties', () => {
  const heure = debutDeLHeure(maintenant)
  const demarrages = [
    demarrage('a', { version: 'a41c9e2', demarreLe: heure - 50 * H, vuLe: heure - 26 * H, arreteLe: heure - 26 * H }),
    demarrage('b', { version: 'b52d0f3', demarreLe: heure - 25 * H, vuLe: maintenant }),
  ]
  const requetes = (reussies: number) => ({ reussies, redirigees: 0, refusees: 0, enErreur: 0 })
  const lignes = [
    ligne(heure - 40 * H, 'a', {
      routes: { n: 100, p50: 60, p95: 200, max: 300 },
      requetes: requetes(1000),
      charge: { n: 10, processeur: 4, processeurMax: 6, boucleMaxMs: 40, memoireMaxMo: 220, invitesMax: 3 },
      parRoute: [
        route({ route: 'POST /api/cabinet/traversee/:id/geste', n: 40, p95: 300 }),
        route({ route: 'GET /api/jour', n: 60, p95: 120 }),
        route({ route: 'GET /api/rare', n: 5, p95: 100 }),
      ],
    }),
    ligne(heure - 10 * H, 'b', {
      routes: { n: 100, p50: 70, p95: 260, max: 900 },
      requetes: requetes(1500),
      erreurs: { 'POST /api/cabinet/traversee/:id/geste': 3 },
      charge: { n: 30, processeur: 8, processeurMax: 12, boucleMaxMs: 80, memoireMaxMo: 260, invitesMax: 9 },
      parRoute: [
        // 300 → 520 : ralentie ; 120 → 110 : non ; une route rare ne se juge pas.
        route({ route: 'POST /api/cabinet/traversee/:id/geste', n: 30, p95: 520 }),
        route({ route: 'GET /api/jour', n: 70, p95: 110 }),
        route({ route: 'GET /api/rare', n: 5, p95: 900 }),
      ],
    }),
  ]
  const versions = versionsDuServeur(lignes, demarrages, maintenant, 'b')
  assert.deepEqual(
    versions.map(v => v.version),
    ['b52d0f3', 'a41c9e2'],
  )
  const [neuve, ancienne] = versions
  assert.deepEqual(neuve.ralenties, [{ route: 'POST /api/cabinet/traversee/:id/geste', avant: 300, apres: 520 }])
  assert.deepEqual(ancienne.ralenties, [])
  assert.deepEqual([neuve.erreursPourMille, ancienne.erreursPourMille], [2, 0])
  assert.deepEqual([neuve.processeur, neuve.memoireMaxMo, neuve.heures, neuve.requetes], [8, 260, 1, 1500])
  assert.deepEqual(neuve.routes, { n: 100, p50: 70, p95: 260 })
  assert.deepEqual([neuve.depuis, neuve.jusqua], [heure - 25 * H, maintenant])
})

test('un vrai serveur relève chaque route servie, et sa page se lit sur une heure, une journée ou une semaine', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    // Une première lecture : la route se relève à sa réponse, la suivante la voit.
    await lire(banc, admin, '/api/admin/serveur?periode=24h')
    const jour = await lire<PageDuServeur>(banc, admin, '/api/admin/serveur?periode=24h')
    assert.equal(jour.status, 200)
    assert.deepEqual([jour.corps.periode, jour.corps.heures.length, jour.corps.pas], ['24h', 24, H])
    const serveur = jour.corps.routes.find(r => r.route === 'GET /api/admin/serveur')
    assert.ok(serveur && serveur.n >= 1, 'la page du serveur se compte parmi les routes')
    assert.ok(jour.corps.routesDepuis !== null)
    const heure = await lire<PageDuServeur>(banc, admin, '/api/admin/serveur?periode=1h')
    assert.deepEqual([heure.corps.periode, heure.corps.heures.length, heure.corps.pas], ['1h', 12, TRANCHE_MS])
    assert.ok(heure.corps.heures.at(-1)!.routes !== null, 'la tranche en cours dit ce qu’un joueur attend')
    // Sans période, ou trente jours : la semaine.
    const semaine = await lire<PageDuServeur>(banc, admin, '/api/admin/serveur?periode=30j')
    assert.deepEqual([semaine.corps.periode, semaine.corps.heures.length], ['7j', 168])
  } finally {
    await banc.close()
  }
})
