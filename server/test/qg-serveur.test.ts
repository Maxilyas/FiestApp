// La santé du serveur au QG (`/admin#serveur`, les choix du 13 octobre
// 2026) : sept jours heure par heure dans la base permanente — ce que les
// joueurs attendent, les réveils et les arrêts, les erreurs —, et quatre
// alertes dans « À traiter » : un arrêt net, des erreurs serveur, Turso lent,
// la mémoire près du plafond.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { connect, type AddressInfo } from 'node:net'
import React from 'react'
import Database from 'better-sqlite3'
import { connexionAnimateur, demarrer, ecrire, inscrireProfil, patienter, type Banc } from './banc'
import { Charge, ReleveHoraire, compteurDeConnexions, plafondsDuConteneur, sondeDuGel, sondeDuReseau } from '../src/core/pouls'
import {
  alertesDuServeur,
  arreteNet,
  debutDeLHeure,
  fondreCharges,
  fondreConnexions,
  fondreRequetes,
  pageDuServeur,
  requetesServies,
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
  // La charge, toutes les dix secondes : la moyenne et les pics de l'heure ; une mémoire qui se tait ne compte pas.
  r.charge({ processeur: 4, boucleMaxMs: 120, memoireMo: 200, invites: 12 })
  r.charge({ processeur: 8, boucleMaxMs: 30, memoireMo: null, invites: 20 })
  // Les connexions vers la base : ouvertes, refermées par elle — la plus jeune compte —, tombées en route,
  // la garde de Node, le délai qu'elle annonce — le plus long de l'heure —, et l'entretien qui les garde
  // chaudes : ses battements, ceux qui sont tombés, les connexions qu'ils ont ouvertes.
  const sansRien = { battements: 0, battementsTombes: 0, ouvertesParUnBattement: 0 }
  assert.deepEqual(r.lignes('d1')[0].connexions, { ouvertes: 0, refermeesParLaBase: 0, plusJeuneRefermeeMs: null, echecs: 0, gardeMs: 4_000, annonceeMs: null, chaudes: false, ...sansRien })
  for (let i = 0; i < 3; i++) r.connexion()
  r.refermeeParLaBase(45_200.4)
  r.refermeeParLaBase(31_000.6)
  r.echecDeLaBase()
  r.chaudes(true)
  r.battements(6)
  r.battements(2)
  r.battementTombe()
  r.connexionParUnBattement()
  r.annonceDeLaBase(5_000)
  r.annonceDeLaBase(2_000)
  const [h] = r.lignes('d1')
  assert.deepEqual(h.connexions, {
    ouvertes: 3,
    refermeesParLaBase: 2,
    plusJeuneRefermeeMs: 31_001,
    echecs: 1,
    gardeMs: 4_000,
    annonceeMs: 5_000,
    chaudes: true,
    battements: 8,
    battementsTombes: 1,
    ouvertesParUnBattement: 1,
  })
  assert.deepEqual(h.charge, { n: 2, processeur: 6, processeurMax: 8, boucleMaxMs: 120, memoireMaxMo: 200, invitesMax: 20 })
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
  // Un serveur neuf part de zéro ; l'entretien, réglé pour le processus, reste.
  r.remettreAZero()
  assert.deepEqual(
    r.lignes('d1').map(l => [l.base, l.routes, l.erreurs, l.miroir, l.charge, l.connexions]),
    [[null, null, {}, 0, null, { ouvertes: 0, refermeesParLaBase: 0, plusJeuneRefermeeMs: null, echecs: 0, gardeMs: 4_000, annonceeMs: null, chaudes: true, ...sansRien }]],
  )
})

test('le pouls nourrit le relevé de l’heure : le processeur, le pire gel, la mémoire et les invités connectés, à chaque relevé', async () => {
  const r = new ReleveHoraire()
  const charge = new Charge(20, { releve: r, invites: () => 7 })
  try {
    // Deux relevés au moins, sans parier sur l'horloge d'une machine chargée.
    for (let i = 0; i < 100 && (r.lignes('d1').at(-1)!.charge?.n ?? 0) < 2; i++) await patienter(20)
  } finally {
    charge.arreter()
  }
  const lue = r.lignes('d1').at(-1)!.charge
  assert.ok(lue && lue.n >= 2, `des relevés : ${JSON.stringify(lue)}`)
  assert.equal(lue.invitesMax, 7)
  assert.ok(lue.memoireMaxMo > 0, 'la mémoire du processus')
  assert.ok(lue.processeur >= 0 && lue.processeurMax >= lue.processeur)
})

test('le gel de l’hébergeur : la sonde lit le cgroup du conteneur, le pouls en fait une part du temps, l’heure en garde la moyenne et le pire', async () => {
  // Le 16 octobre 2026, la boucle de la production se figeait deux secondes
  // chaque heure, Turso paraissait lent, et rien ne disait si le dixième de
  // cœur de l'hébergeur manquait.
  const conteneur = (fichiers: Record<string, string>) => (f: string) => {
    if (!(f in fichiers)) throw new Error(`ENOENT: ${f}`)
    return fichiers[f]
  }
  // cgroup v2, en microsecondes ; v1, en nanosecondes ; ailleurs — un PC, un Mac —, pas de sonde.
  assert.equal(sondeDuGel(conteneur({ '/sys/fs/cgroup/cpu.stat': 'usage_usec 812\nnr_periods 100\nnr_throttled 7\nthrottled_usec 4200\n' }))?.(), 4200)
  assert.equal(sondeDuGel(conteneur({ '/sys/fs/cgroup/cpu/cpu.stat': 'nr_periods 10\nnr_throttled 2\nthrottled_time 3000000\n' }))?.(), 3000)
  assert.equal(sondeDuGel(conteneur({})), null)
  assert.equal(sondeDuGel(conteneur({ '/sys/fs/cgroup/cpu.stat': 'usage_usec 812\n' })), null, 'un cgroup sans limite de processeur')
  // Un fichier qui se tait ensuite : la sonde aussi, sans rien jeter.
  let present = true
  const sonde = sondeDuGel(f => {
    if (!present || f !== '/sys/fs/cgroup/cpu.stat') throw new Error('ENOENT')
    return 'throttled_usec 10\n'
  })!
  present = false
  assert.equal(sonde(), null)

  // L'heure : la moyenne et le pire des relevés qui le disent, les autres n'y comptent pas.
  const r = new ReleveHoraire(() => Date.UTC(2026, 9, 16, 15, 10))
  r.charge({ processeur: 9, boucleMaxMs: 2000, memoireMo: 240, invites: 0, gelePct: 30 })
  r.charge({ processeur: 4, boucleMaxMs: 100, memoireMo: 240, invites: 0, gelePct: 10 })
  r.charge({ processeur: 2, boucleMaxMs: 50, memoireMo: 240, invites: 0, gelePct: null })
  assert.deepEqual(r.lignes('d1')[0].charge, { n: 3, processeur: 5, processeurMax: 9, boucleMaxMs: 2000, memoireMaxMo: 240, invitesMax: 0, gelePct: 20, geleMaxPct: 30 })
  // Deux démarrages de la même heure : pondéré sur les relevés qui le disent, le pire des deux.
  const avec = { n: 30, processeur: 5, processeurMax: 9, boucleMaxMs: 300, memoireMaxMo: 210, invitesMax: 18, gelePct: 20, geleMaxPct: 60 }
  const sans = { n: 90, processeur: 1, processeurMax: 3, boucleMaxMs: 80, memoireMaxMo: 260, invitesMax: 2 }
  assert.deepEqual(fondreCharges(avec, sans), { n: 120, processeur: 2, processeurMax: 9, boucleMaxMs: 300, memoireMaxMo: 260, invitesMax: 18, gelePct: 20, geleMaxPct: 60 })
  assert.deepEqual(fondreCharges(avec, { ...avec, gelePct: 40, geleMaxPct: 45 })?.gelePct, 30)
  assert.equal('gelePct' in fondreCharges(sans, sans)!, false, 'deux lignes d’avant n’en disent rien')

  // Branchée sur le pouls : chaque relevé dit la part de son temps gelée, et /healthz la moyenne et le pire de la minute.
  let gele = 0
  const releve = new ReleveHoraire()
  const pouls = new Charge(20, { releve, gel: () => (gele += 5_000) })
  try {
    for (let i = 0; i < 100 && (releve.lignes('d1').at(-1)!.charge?.n ?? 0) < 2; i++) await patienter(20)
    const lue = releve.lignes('d1').at(-1)!.charge!
    assert.ok(typeof lue.gelePct === 'number' && lue.gelePct > 0 && lue.gelePct <= 100, JSON.stringify(lue))
    const minute = pouls.lire()
    assert.ok(typeof minute.geleePct === 'number' && minute.geleeMaxPct! >= minute.geleePct, JSON.stringify(minute))
  } finally {
    pouls.arreter()
  }
  // Sans sonde, rien : ni dans l'heure, ni à /healthz.
  const ailleurs = new ReleveHoraire()
  const sansSonde = new Charge(20, { releve: ailleurs, gel: null })
  try {
    for (let i = 0; i < 100 && (ailleurs.lignes('d1').at(-1)!.charge?.n ?? 0) < 1; i++) await patienter(20)
    assert.equal('gelePct' in ailleurs.lignes('d1').at(-1)!.charge!, false)
    assert.equal(sansSonde.lire().geleePct, null)
  } finally {
    sansSonde.arreter()
  }
})

test('le trafic de l’heure : les requêtes par famille de statut, le pic des connexions ouvertes, ce que la machine a envoyé et reçu', () => {
  // Le 17 octobre 2026 (« combien de connexions », sans clé de l'hébergeur) : ce
  // que le tableau de bord de Render montre de dehors, le serveur le mesure de lui-même.
  const r = new ReleveHoraire(() => Date.UTC(2026, 9, 17, 19, 10))
  for (const statut of [200, 204, 304, 404, 401, 500]) r.requete(statut)
  r.charge({ processeur: 3, boucleMaxMs: 40, memoireMo: 200, invites: 4, connexions: 12, tempsReel: 9, envoyesOctets: 3 * 1024 * 1024, recusOctets: 512 * 1024 })
  // Un relevé dont le réseau se tait : il n'ôte rien à ce qui est dit, il n'y ajoute pas de zéro.
  r.charge({ processeur: 5, boucleMaxMs: 60, memoireMo: 210, invites: 6, connexions: 30, tempsReel: 4, envoyesOctets: 1024 * 1024, recusOctets: null })
  const [h] = r.lignes('d1')
  assert.deepEqual(h.requetes, { reussies: 2, redirigees: 1, refusees: 2, enErreur: 1 })
  assert.deepEqual(h.charge, { n: 2, processeur: 4, processeurMax: 5, boucleMaxMs: 60, memoireMaxMo: 210, invitesMax: 6, connexionsMax: 30, tempsReelMax: 9, envoyesKo: 4096, recusKo: 512 })
  // Une machine qui ne dit ni ses connexions ni son réseau : rien d'écrit, pas un zéro.
  const muette = new ReleveHoraire(() => Date.UTC(2026, 9, 17, 19, 10))
  muette.charge({ processeur: 3, boucleMaxMs: 40, memoireMo: 200, invites: 4 })
  assert.deepEqual(muette.lignes('d1')[0].charge, { n: 1, processeur: 3, processeurMax: 3, boucleMaxMs: 40, memoireMaxMo: 200, invitesMax: 4 })
  assert.deepEqual(muette.lignes('d1')[0].requetes, { reussies: 0, redirigees: 0, refusees: 0, enErreur: 0 })

  // Deux démarrages dans la même heure : le pire des pics, la somme des volumes et des requêtes ; une ligne d'avant n'en dit rien.
  const avec = { n: 30, processeur: 5, processeurMax: 9, boucleMaxMs: 300, memoireMaxMo: 210, invitesMax: 18, connexionsMax: 30, tempsReelMax: 22, envoyesKo: 2048, recusKo: 512 }
  const davant = { n: 90, processeur: 1, processeurMax: 3, boucleMaxMs: 80, memoireMaxMo: 260, invitesMax: 2 }
  assert.deepEqual(fondreCharges(avec, davant), { n: 120, processeur: 2, processeurMax: 9, boucleMaxMs: 300, memoireMaxMo: 260, invitesMax: 18, connexionsMax: 30, tempsReelMax: 22, envoyesKo: 2048, recusKo: 512 })
  assert.deepEqual(fondreCharges(avec, { ...avec, connexionsMax: 41, tempsReelMax: 3, envoyesKo: 1000, recusKo: 24 }), { ...avec, n: 60, connexionsMax: 41, envoyesKo: 3048, recusKo: 536 })
  assert.deepEqual(fondreCharges(davant, davant), { ...davant, n: 180 }, 'deux lignes d’avant restent sans eux')
  assert.deepEqual(fondreRequetes({ reussies: 10, redirigees: 2, refusees: 1, enErreur: 0 }, { reussies: 5, redirigees: 0, refusees: 4, enErreur: 1 }), { reussies: 15, redirigees: 2, refusees: 5, enErreur: 1 })
  assert.deepEqual(fondreRequetes(null, { reussies: 5, redirigees: 0, refusees: 4, enErreur: 1 }), { reussies: 5, redirigees: 0, refusees: 4, enErreur: 1 })
  assert.equal(fondreRequetes(null, null), null)
})

test('les sondes du conteneur : son réseau, hors la boucle locale, et ses plafonds de processeur et de mémoire — rien sur une machine qui ne les dit pas', () => {
  const machine = (fichiers: Record<string, string>) => (f: string) => {
    if (!(f in fichiers)) throw new Error(`ENOENT: ${f}`)
    return fichiers[f]
  }
  const NET_DEV = [
    'Inter-|   Receive                                                |  Transmit',
    ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
    '    lo: 9999999     100    0    0    0     0          0         0  9999999     100    0    0    0     0       0          0',
    '  eth0: 1000000    2000    0    0    0     0          0         0   300000    1500    0    0    0     0       0          0',
    '  eth1:500 10 0 0 0 0 0 0 200 5 0 0 0 0 0 0',
    '',
  ].join('\n')
  assert.deepEqual(sondeDuReseau(machine({ '/proc/net/dev': NET_DEV }))?.(), { recus: 1_000_500, envoyes: 300_200 })
  assert.equal(sondeDuReseau(machine({})), null, 'un Mac, Windows')
  assert.equal(sondeDuReseau(machine({ '/proc/net/dev': NET_DEV.split('\n').slice(0, 3).join('\n') })), null, 'la boucle locale seule')

  // cgroup v2 : un dixième de cœur, 512 Mo — l'offre gratuite de l'hébergeur.
  assert.deepEqual(plafondsDuConteneur(machine({ '/sys/fs/cgroup/cpu.max': '10000 100000\n', '/sys/fs/cgroup/memory.max': '536870912\n' })), { processeurPct: 10, memoireMo: 512 })
  // Sans plafond : « max ».
  assert.deepEqual(plafondsDuConteneur(machine({ '/sys/fs/cgroup/cpu.max': 'max 100000\n', '/sys/fs/cgroup/memory.max': 'max\n' })), { processeurPct: null, memoireMo: null })
  // cgroup v1 : un demi-cœur ; une mémoire sans plafond s'y dit 2⁶³ arrondi à la page.
  assert.deepEqual(
    plafondsDuConteneur(
      machine({
        '/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_quota_us': '50000\n',
        '/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_period_us': '100000\n',
        '/sys/fs/cgroup/memory/memory.limit_in_bytes': '9223372036854771712\n',
      }),
    ),
    { processeurPct: 50, memoireMo: null },
  )
  assert.deepEqual(
    plafondsDuConteneur(machine({ '/sys/fs/cgroup/cpu/cpu.cfs_quota_us': '-1\n', '/sys/fs/cgroup/cpu/cpu.cfs_period_us': '100000\n', '/sys/fs/cgroup/memory/memory.limit_in_bytes': '1073741824\n' })),
    { processeurPct: null, memoireMo: 1024 },
  )
  assert.deepEqual(plafondsDuConteneur(machine({})), { processeurPct: null, memoireMo: null }, 'un PC, un Mac')
  assert.deepEqual(plafondsDuConteneur(machine({ '/sys/fs/cgroup/cpu.max': 'illisible\n' })), { processeurPct: null, memoireMo: null })
})

test('les connexions ouvertes se comptent à leur ouverture et à leur fermeture', async () => {
  const serveur = createServer((_req, res) => res.end('ok'))
  const ouvertes = compteurDeConnexions(serveur)
  await new Promise<void>(resolve => serveur.listen(0, '127.0.0.1', resolve))
  const port = (serveur.address() as AddressInfo).port
  const sockets = [connect(port, '127.0.0.1'), connect(port, '127.0.0.1')]
  try {
    for (let i = 0; i < 100 && ouvertes() < 2; i++) await patienter(10)
    assert.equal(ouvertes(), 2)
    sockets[0].destroy()
    for (let i = 0; i < 100 && ouvertes() > 1; i++) await patienter(10)
    assert.equal(ouvertes(), 1)
  } finally {
    for (const s of sockets) s.destroy()
    await new Promise(resolve => serveur.close(resolve))
  }
})

test('le pouls nourrit l’heure des connexions ouvertes et du réseau : ce que chaque relevé a vu passer depuis le précédent', async () => {
  let recus = 1_000_000
  let envoyes = 5_000_000
  const releve = new ReleveHoraire()
  const pouls = new Charge(20, {
    releve,
    gel: null,
    connexions: () => 5,
    tempsReel: () => 3,
    // 2 Ko reçus et 4 envoyés par relevé.
    reseau: () => ({ recus: (recus += 2048), envoyes: (envoyes += 4096) }),
  })
  try {
    for (let i = 0; i < 100 && (releve.lignes('d1').at(-1)!.charge?.n ?? 0) < 2; i++) await patienter(20)
  } finally {
    pouls.arreter()
  }
  // Lue d'un seul tenant : le nombre de relevés et ce qu'ils ont compté vont ensemble.
  const lue = releve.lignes('d1').at(-1)!.charge!
  assert.ok(lue.n >= 2, JSON.stringify(lue))
  assert.deepEqual([lue.connexionsMax, lue.tempsReelMax, lue.envoyesKo, lue.recusKo], [5, 3, 4 * lue.n, 2 * lue.n])

  // Un compteur qui recule — l'interface recréée — ne compte pas : il sert de départ au suivant.
  const recule = new ReleveHoraire()
  const autre = new Charge(20, { releve: recule, gel: null, reseau: () => ({ recus: (recus -= 100), envoyes: (envoyes -= 100) }) })
  try {
    for (let i = 0; i < 100 && (recule.lignes('d1').at(-1)!.charge?.n ?? 0) < 1; i++) await patienter(20)
  } finally {
    autre.arreter()
  }
  const sansReseau = recule.lignes('d1').at(-1)!.charge!
  assert.equal('envoyesKo' in sansReseau || 'recusKo' in sansReseau || 'connexionsMax' in sansReseau, false, JSON.stringify(sansReseau))
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
  charge: null,
  connexions: null,
  requetes: null,
  ...l,
})
const LIGNES: HeureDeSante[] = [
  // Deux démarrages dans la même heure : b, arrêté net à 14 h 12, puis c.
  ligne(a(4, 14), 'b', {
    base: { n: 10, p50: 30, p95: 60, max: 80 },
    routes: { n: 20, p50: 100, p95: 300, max: 500 },
    erreurs: { 'POST /api/jour/reponse': 2 },
    // Le gel de l'hébergeur, les connexions ouvertes et le réseau, que c, une ligne d'avant, ne dit pas.
    charge: {
      n: 60,
      processeur: 5,
      processeurMax: 9,
      boucleMaxMs: 300,
      memoireMaxMo: 210,
      invitesMax: 18,
      gelePct: 12,
      geleMaxPct: 40,
      connexionsMax: 30,
      tempsReelMax: 22,
      envoyesKo: 2048,
      recusKo: 512,
    },
    connexions: { ouvertes: 8, refermeesParLaBase: 0, plusJeuneRefermeeMs: null, echecs: 1, gardeMs: 4_000, annonceeMs: null },
    requetes: { reussies: 100, redirigees: 20, refusees: 3, enErreur: 2 },
  }),
  ligne(a(4, 14), 'c', {
    base: { n: 30, p50: 50, p95: 90, max: 120 },
    routes: { n: 10, p50: 200, p95: 250, max: 260 },
    erreurs: { 'POST /api/jour/reponse': 1, 'socket host:launch': 1 },
    miroir: 2,
    charge: { n: 180, processeur: 7, processeurMax: 11, boucleMaxMs: 80, memoireMaxMo: 260, invitesMax: 25 },
    connexions: { ouvertes: 12, refermeesParLaBase: 2, plusJeuneRefermeeMs: 31_000, echecs: 0, gardeMs: 30_000, annonceeMs: 5_000 },
  }),
  ligne(a(3, 19), 'd', { base: { n: 12, p50: 40, p95: 100, max: 130 }, routes: { n: 50, p50: 90, p95: 300, max: 400 } }),
  ligne(a(3, 20), 'd', { base: { n: 15, p50: 45, p95: 120, max: 150 }, routes: { n: 45, p50: 95, p95: 320, max: 410 } }),
  ligne(a(0, 20), 'g', {
    base: { n: 25, p50: 60, p95: 140, max: 160 },
    routes: { n: 40, p50: 120, p95: 420, max: 700 },
    lentes: [{ route: 'GET /api/jour', n: 30, p95: 520 }],
  }),
  ligne(a(0, 21), 'g', {
    base: { n: 5, p50: 55, p95: 110, max: 115 },
    routes: { n: 6, p50: 110, p95: 380, max: 390 },
    // Une connexion par aller-retour : chacun a refait sa poignée de main.
    connexions: { ouvertes: 5, refermeesParLaBase: 2, plusJeuneRefermeeMs: 31_000, echecs: 1, gardeMs: 30_000, annonceeMs: 20_000 },
  }),
]

test('sept jours heure par heure : les heures fondues, la nuit endormie, chaque démarrage et sa raison, les arrêts nets', () => {
  const page = pageDuServeur(LIGNES, SEMAINE, { maintenant, courant: COURANT })
  assert.equal(page.heures.length, 168)
  assert.equal(page.heures.at(-1)!.heure, debutDeLHeure(maintenant))
  assert.deepEqual(page.enMarche, { depuis: a(0, 7, 2), version: 'bbbbbbb', env: 'production' })

  const heure = (t: number) => page.heures.find(h => h.heure === t)!
  // b et c dans la même heure : le pire des 95ᵉ centiles, les erreurs additionnées ; la charge
  // moyenne pondérée par ses relevés, ses pics au pire des deux ; les connexions additionnées —
  // vingt pour quarante allers-retours —, la plus jeune refermée, la garde la plus longue.
  assert.deepEqual(heure(a(4, 14)), {
    heure: a(4, 14),
    eveille: true,
    base: 90,
    routes: 300,
    erreurs: 4,
    miroir: 2,
    processeur: 6.5,
    // Pondéré sur les seuls relevés qui le disent : ceux de b.
    gele: 12,
    boucle: 300,
    memoire: 260,
    invites: 25,
    connexionsNeuves: 50,
    connexions: { ouvertes: 20, refermeesParLaBase: 2, plusJeuneRefermeeMs: 31_000, echecs: 1, gardeMs: 30_000, annonceeMs: 5_000 },
    // Les requêtes, les connexions ouvertes et le réseau : ceux de b, c n'en disant rien.
    requetes: { reussies: 100, redirigees: 20, refusees: 3, enErreur: 2 },
    connexionsOuvertes: 30,
    tempsReel: 22,
    envoyesMo: 2,
    recusMo: 0.5,
  })
  // La nuit, l'hébergeur dort ; le matin, le réveil de 7 h 02 compte son heure.
  assert.equal(heure(a(0, 3)).eveille, false)
  assert.equal(heure(a(0, 7)).eveille, true)
  assert.deepEqual(heure(a(1, 23)), {
    heure: a(1, 23),
    eveille: true,
    base: null,
    routes: null,
    erreurs: 0,
    miroir: 0,
    processeur: null,
    gele: null,
    boucle: null,
    memoire: null,
    invites: null,
    connexionsNeuves: null,
    connexions: null,
    requetes: null,
    connexionsOuvertes: null,
    tempsReel: null,
    envoyesMo: null,
    recusMo: null,
  })
  // Une heure d'avant le compte des connexions : ni part, ni détail.
  assert.deepEqual([heure(a(3, 19)).connexionsNeuves, heure(a(3, 19)).connexions], [null, null])

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

test('un vrai serveur compte ses requêtes par statut — pas les sondes de /healthz —, et sa page dit ses plafonds et mène aux mesures de l’hébergeur', async () => {
  const banc = await demarrer({ mesuresDeLHebergeur: 'https://dashboard.render.com/web/srv-banc/metrics' })
  try {
    const admin = await connexionAnimateur(banc.url)
    // Toutes les heures de la page : un test à cheval sur deux heures compte encore juste.
    const lesRequetes = (page: PageDuServeur) =>
      page.heures.reduce((s, h) => (h.requetes ? { servies: s.servies + requetesServies(h.requetes), refusees: s.refusees + h.requetes.refusees } : s), { servies: 0, refusees: 0 })
    const avant = lesRequetes((await lire<PageDuServeur>(banc, admin, '/api/admin/serveur')).corps)
    // Un fichier qui n'existe pas — le `favicon.ico` d'une vieille version —, et une route d'administrateur sans session.
    const introuvable = await fetch(`${banc.url}/nexiste.png`)
    assert.equal(introuvable.status, 404)
    const sansSession = await fetch(`${banc.url}/api/admin/serveur`)
    assert.ok(sansSession.status >= 400 && sansSession.status < 500, `refusée sans session : ${sansSession.status}`)
    // Les sondes de l'hébergeur et du réveil ne comptent pas.
    for (let i = 0; i < 10; i++) assert.equal((await fetch(`${banc.url}/healthz`)).status, 200)
    const page = (await lire<PageDuServeur>(banc, admin, '/api/admin/serveur')).corps
    // La lecture d'avant, servie, et les deux refusées : rien de plus.
    assert.deepEqual(lesRequetes(page), { servies: avant.servies + 3, refusees: avant.refusees + 2 })

    // Les plafonds de cette machine-ci, lus ou non ; et le chemin des mesures de l'hébergeur, tel qu'on l'a donné.
    assert.deepEqual(Object.keys(page.plafonds).sort(), ['memoireMo', 'processeurPct'])
    for (const v of Object.values(page.plafonds)) assert.ok(v === null || (typeof v === 'number' && v > 0), JSON.stringify(page.plafonds))
    assert.equal(page.mesuresDeLHebergeur, 'https://dashboard.render.com/web/srv-banc/metrics')
  } finally {
    await banc.close()
  }
})

test('la page « Le serveur » trace les plafonds lus dans le conteneur, et mène aux graphiques de l’hébergeur quand elle les connaît', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#serveur', origin: 'http://banc' } } })
  const { SanteDuServeurAuQg } = await import(new URL('../../client/src/components/QgServeur.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const rendre = (page: PageDuServeur) => sansInsecables(renderToStaticMarkup(React.createElement(SanteDuServeurAuQg, { page })).replace(/<!-- -->/g, ''))
  const lus = rendre(
    pageDuServeur(LIGNES, SEMAINE, {
      maintenant,
      courant: COURANT,
      plafonds: { processeurPct: 50, memoireMo: 2048 },
      mesuresDeLHebergeur: 'https://dashboard.render.com/web/srv-abc123/metrics',
    }),
  )
  for (const attendu of [
    'en pointillé, les plafonds du conteneur : 50 % d’un cœur, 2048 Mo',
    'href="https://dashboard.render.com/web/srv-abc123/metrics"',
    'ses propres graphiques',
  ]) {
    assert.ok(lus.includes(attendu), `« ${attendu} » dans la page`)
  }
  // Hors de l'hébergeur : ni lien, ni trait inventé — ceux de l'offre gratuite.
  const ailleurs = rendre(pageDuServeur(LIGNES, SEMAINE, { maintenant, courant: COURANT }))
  assert.ok(!ailleurs.includes('ses propres graphiques'))
  assert.ok(ailleurs.includes('les plafonds de l’hébergeur gratuit'))
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
    // La charge : ses cinq graphiques, leurs plafonds, et l'heure lue dans les cinq — le gel de l'hébergeur sous le processeur.
    'La charge, heure par heure',
    'Gel de l’hébergeur',
    'Invités connectés',
    'plafond',
    // Sans plafonds lus dans un conteneur, ceux de l'offre gratuite.
    'en pointillé, les plafonds de l’hébergeur gratuit',
    // Les connexions ouvertes, à la suite de la charge : celles de b.
    'Connexions ouvertes',
    'ven. 9 oct., 14 h : processeur 6,5 % · gel de l’hébergeur 12 % · boucle 300 ms · mémoire 260 Mo · 25 invités · 30 connexions ouvertes, 22 en temps réel',
    // Le trafic : les requêtes par statut, ce que la machine a envoyé et reçu.
    'Le trafic, heure par heure',
    'ven. 9 oct., 14 h : 125 requêtes — 100 réussies, 20 redirigées, 3 refusées, 2 en erreur · 2 Mo envoyés · 512 Ko reçus',
    // Turso et ses connexions : deux graphiques, et l'heure lue dans les deux — la garde, ce que la base a refermé, ce qui est tombé.
    'Connexions neuves',
    'aujourd’hui, 21 h : 95ᵉ centile 110 ms · 100 % de connexions neuves · gardées 30 s · Turso annonce 20 s · 2 refermées par Turso, la plus jeune à 31 s · 1 aller-retour tombé en route',
  ]) {
    assert.ok(html.includes(attendu), `« ${attendu} » dans la page`)
  }
  for (const absent of ['NaN', 'undefined', 'null']) assert.ok(!html.includes(absent), `pas de « ${absent} »`)
})

test('gardées chaudes, l’heure dit ses battements ; deux démarrages de la même heure les additionnent, deux lignes d’avant n’en disent rien', async () => {
  const davant = { ouvertes: 5, refermeesParLaBase: 2, plusJeuneRefermeeMs: 5_022, echecs: 1, gardeMs: 30_000, annonceeMs: null }
  const chaude = { ouvertes: 1, refermeesParLaBase: 0, plusJeuneRefermeeMs: null, echecs: 0, gardeMs: 4_000, annonceeMs: null, chaudes: true, battements: 40, battementsTombes: 0, ouvertesParUnBattement: 1 }
  assert.deepEqual(fondreConnexions(davant, chaude), {
    ouvertes: 6,
    refermeesParLaBase: 2,
    plusJeuneRefermeeMs: 5_022,
    echecs: 1,
    gardeMs: 30_000,
    annonceeMs: null,
    chaudes: true,
    battements: 40,
    battementsTombes: 0,
    ouvertesParUnBattement: 1,
  })
  assert.deepEqual(fondreConnexions(davant, davant), { ...davant, ouvertes: 10, refermeesParLaBase: 4, echecs: 2 }, 'des lignes d’avant l’entretien restent sans lui')

  Object.assign(globalThis, { React, window: { location: { pathname: '/admin', search: '', hash: '#serveur', origin: 'http://banc' } } })
  const { SanteDuServeurAuQg } = await import(new URL('../../client/src/components/QgServeur.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  // La dernière heure gardée chaude : une connexion neuve pour cinq allers-retours, quarante battements, une rouverte par l'un d'eux.
  const lignes = LIGNES.map(l => (l.heure === a(0, 21) ? { ...l, connexions: chaude } : l))
  const html = sansInsecables(renderToStaticMarkup(React.createElement(SanteDuServeurAuQg, { page: pageDuServeur(lignes, SEMAINE, { maintenant, courant: COURANT }) })).replace(/<!-- -->/g, ''))
  const attendu = 'aujourd’hui, 21 h : 95ᵉ centile 110 ms · 20 % de connexions neuves · gardées chaudes par 40 battements · 1 rouverte par un battement'
  assert.ok(html.includes(attendu), `« ${attendu} » dans la page`)
})
