// Le bilan de la production (`server/scripts/bilan-de-la-production.ts`, le
// 4 novembre 2026 : « que l'on regarde les vrais points bloquants / latence »
// sur deux jours) : ce qui a fait attendre les joueurs, lu dans les heures du
// relevé, chaque moment lent avec ce qui tombait dans ses cinq minutes — le
// gel et son nom, Turso, les connexions neuves. Sur des heures inventées : le
// script ne lit la base qu'une fois lancé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bilanDeLaProduction, lireLesOptions } from '../scripts/bilan-de-la-production'
import type { DemarrageDuServeur, HeureDeSante, TrancheDeSante } from '../../shared/santeDuServeur'

const minute = (h: number, m: number, s = 0) => Date.UTC(2026, 10, 6, h, m, s)
// Vendredi 6 novembre 2026, 18 h 30 à Paris : la fin de deux jours.
const jusqua = minute(17, 30)
const sansInsecables = (s: string) => s.replace(/[  ]/g, ' ')

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
const route = (r: string, n: number, p50: number, p95: number, max: number) => ({ route: r, n, p50, p95, max, totalMs: n * p50, refusees: 0, enErreur: 0 })

// Le 13 h de Paris de la latence du Cabinet, rejoué : un geste à 8 s, un gel sans nom, Turso à 7,6 s, des poignées de main.
const LIGNES: HeureDeSante[] = [
  // Hors de la fenêtre : rien n'en sort.
  ligne(minute(12, 0) - 50 * 3_600_000, 'd1', { routes: { n: 3, p50: 30_000, p95: 30_000, max: 30_000 }, parRoute: [route('GET /api/oubliee', 3, 30_000, 30_000, 30_000)] }),
  ligne(minute(12, 0), 'd2', {
    routes: { n: 42, p50: 80, p95: 900, max: 8000 },
    parRoute: [
      route('POST /api/cabinet/partie/:id/geste', 30, 60, 500, 8000),
      route('GET /api/joueur/missions', 10, 300, 3200, 3200),
      // Deux appels : trop peu pour les plus lentes, assez pour une attente sentie.
      route('GET /api/rare', 2, 4000, 4000, 4000),
    ],
    base: { n: 100, p50: 45, p95: 300, max: 7600 },
    connexions: {
      ouvertes: 6,
      refermeesParLaBase: 0,
      plusJeuneRefermeeMs: null,
      echecs: 0,
      gardeMs: 4000,
      annonceeMs: null,
      chaudes: true,
      battements: 50,
      battementsTombes: 0,
      ouvertesParUnBattement: 0,
      patienceMs: 150,
      attentes: 4,
      lassees: 1,
      attenteMs: 200,
    },
    gels: {
      n: 2,
      totalMs: 2500,
      plusLongs: [
        { a: minute(12, 0, 1), dureeMs: 1800, processeurMs: 280, ramasseMiettesMs: 187, enCours: [] },
        { a: minute(12, 21, 1), dureeMs: 700, processeurMs: 100, ramasseMiettesMs: 10, enCours: [{ quoi: 'cabinet · tirage d’une épreuve', n: 1 }] },
      ],
      parCe: [{ quoi: 'cabinet · tirage d’une épreuve', n: 1, ms: 700 }],
      sansRien: 1,
    },
    tranches: [
      tranche(minute(12, 0), {
        routes: { n: 20, p50: 70, p95: 3000, max: 8000 },
        base: { n: 50, p50: 45, p95: 1200, max: 7600 },
        gels: { n: 1, maxMs: 1800 },
        connexions: { ouvertes: 3, attentes: 1, lassees: 1 },
      }),
      // Cinq minutes calmes : pas un moment lent.
      tranche(minute(12, 5), { routes: { n: 10, p50: 60, p95: 200, max: 300 }, connexions: { ouvertes: 0, attentes: 0, lassees: 0 } }),
      tranche(minute(12, 20), { routes: { n: 5, p50: 100, p95: 1600, max: 1600 }, gels: { n: 1, maxMs: 700 } }),
    ],
    erreurs: { 'GET /api/joueur/missions': 1 },
    erreursEnDetail: [
      { source: 'GET /api/joueur/missions', nom: 'TypeError', code: null, message: 'Camille ne se lit pas', ou: 'missions (server/src/core/missions.ts)', pile: [], n: 1, premiere: minute(12, 3), derniere: minute(12, 3) },
    ],
    charge: { n: 360, processeur: 3, processeurMax: 9, boucleMaxMs: 1800, memoireMaxMo: 300, invitesMax: 0, gelePct: 2, geleMaxPct: 79 },
    requetes: { reussies: 41, redirigees: 0, refusees: 0, enErreur: 1 },
  }),
]

const DEMARRAGES: DemarrageDuServeur[] = [
  // Ni extinction propre ni signe depuis : un arrêt net.
  { id: 'd1', demarreLe: minute(7, 0) - 24 * 3_600_000, pretEnMs: 3100, version: 'aaaaaaa', env: 'production', vuLe: minute(9, 0) - 24 * 3_600_000, arreteLe: null },
  { id: 'd2', demarreLe: minute(10, 46), pretEnMs: 4600, version: 'bbbbbbb', env: 'production', vuLe: jusqua, arreteLe: null },
]

const bilan = (messages = false) => sansInsecables(bilanDeLaProduction(LIGNES, DEMARRAGES, { heures: 48, jusqua, messages }))
/** Une section du bilan, de son titre au titre suivant, quel que soit son niveau. */
function section(texte: string, titre: string): string {
  const debut = texte.indexOf(titre)
  assert.ok(debut >= 0, `« ${titre} » dans le bilan`)
  const suite = texte.slice(debut + titre.length).search(/\n#{1,3} /)
  return texte.slice(debut, suite < 0 ? undefined : debut + titre.length + suite)
}

test('chaque moment lent dit ce qui tombait dans ses cinq minutes : le gel et son nom, Turso, les connexions neuves', () => {
  const lents = section(bilan(), '## Les moments lents')
  const treize = lents.split('\n').find(l => l.startsWith('| ven. 06/11 13:00 '))
  assert.ok(treize, lents)
  for (const attendu of ['8 s', 'gel de 1,8 s (rien de nommé)', "Turso jusqu'à 7,6 s", '3 connexions neuves', '1 attente lassée']) {
    assert.ok(treize.includes(attendu), `« ${attendu} » dans ${treize}`)
  }
  // Le gel nommé de 13 h 21 tombe dans ses cinq minutes à lui, avec son nom.
  assert.ok(lents.split('\n').find(l => l.startsWith('| ven. 06/11 13:20 '))?.includes('gel de 700 ms (cabinet · tirage d’une épreuve)'))
  // Les cinq minutes calmes n'y sont pas.
  assert.ok(!lents.includes('13:05'), 'un moment calme ne se liste pas')
  assert.ok(lents.includes('2 moments sur 3 relevés'), lents)
})

test('ce qu’un joueur a attendu : les plus lentes sur assez d’appels, les attentes de plus de deux secondes même rares, rien hors de la fenêtre', () => {
  const texte = bilan()
  const lentes = section(texte, '### Les plus lentes')
  const lignes = lentes.split('\n').filter(l => l.startsWith('| GET') || l.startsWith('| POST'))
  assert.deepEqual(
    lignes.map(l => l.split(' | ')[0].slice(2)),
    ['GET /api/joueur/missions', 'POST /api/cabinet/partie/:id/geste'],
    'la plus lente d’abord, les routes de moins de dix appels à part',
  )
  const senties = section(texte, '### Les attentes de plus de 2 s')
  assert.ok(senties.includes('| ven. 06/11 13:00 | POST /api/cabinet/partie/:id/geste | 8 s |'), senties)
  assert.ok(senties.includes('GET /api/rare'), 'deux appels à 4 s se sentent')
  assert.ok(!texte.includes('GET /api/oubliee') && !texte.includes('30 s'), 'une heure hors de la fenêtre ne compte pas')
})

test('Turso, ses connexions et la patience ; les démarrages, l’arrêt net compris', () => {
  const texte = bilan()
  assert.ok(texte.includes('100 allers-retours, la moitié sous 45 ms, 19 sur 20 sous 300 ms, le pire 7,6 s. 6 connexions neuves pour les joueurs (6 % des allers-retours'), texte)
  assert.ok(texte.includes('La patience (150 ms) : 4 attentes, 50 ms en moyenne, dont 1 lassée'), texte)
  assert.ok(texte.includes('| bbbbbbb |') && texte.includes('mise en ligne'))
  assert.ok(texte.includes('**arrêt net**'), 'le démarrage d’hier, sans extinction ni signe, s’est arrêté net')
  assert.ok(section(texte, '## Ce qui gèle').includes('| cabinet · tirage d’une épreuve | 1 | 700 ms |'))
})

test('une erreur se dit par sa source, sa sorte et d’où elle vient : son message peut citer un joueur, il ne sort qu’à la demande', () => {
  assert.ok(section(bilan(), '## Les erreurs serveur').includes('| GET /api/joueur/missions | TypeError | missions (server/src/core/missions.ts) | 1 |'))
  assert.ok(!bilan().includes('Camille'), 'pas un prénom d’office')
  assert.ok(bilan(true).includes('Camille ne se lit pas'), '--messages le montre')
})

test('les options : deux jours d’office, huit au plus — le relevé n’en garde pas plus —, une fin lisible', () => {
  const maintenant = minute(17, 30)
  assert.deepEqual(lireLesOptions([], maintenant), { heures: 48, jusqua: maintenant, env: 'production', messages: false })
  assert.deepEqual(lireLesOptions(['24', '--env=preprod', '--messages', '--jusqua=2026-11-05T20:00Z'], maintenant), {
    heures: 24,
    jusqua: Date.UTC(2026, 10, 5, 20),
    env: 'preprod',
    messages: true,
  })
  for (const refusees of [['0'], ['193'], ['1.5'], ['--jusqua=demain']]) assert.throws(() => lireLesOptions(refusees, maintenant), `${refusees} se refuse`)
})
