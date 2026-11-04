// L'onglet « Temps réel » de la page du serveur (le QG 2 ; la proposition du
// 3 novembre 2026 : « les clients des sockets, les messages reçus, le temps de
// traitement jusqu'à l'accusé, les “trop tard”, le retard des chronomètres,
// les reconnexions — et chaque message en table »). Une soirée vit dans la
// liaison, pas dans les routes : chaque message passe par `ecouter()`, qui le
// relève sous son nom — jamais sa charge — dans la ligne de l'heure, comme une
// route. Pas une ligne de plus écrite ni lue au quota de Turso.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ADMIN, connexionAnimateur, creerQuiz, demarrer, ecranCommun, emitAck, invite, lancerQuiz, qcm } from './banc'
import { ReleveHoraire } from '../src/core/pouls'
import {
  CE_QUE_FAIT_LE_MESSAGE,
  HEURE_MS,
  tempsReelDeLaPeriode,
  type HeureDeSante,
  type PageDuServeur,
  type RouteDeLHeure,
} from '../../shared/santeDuServeur'

const H = HEURE_MS

test('chaque message, sous son nom : jusqu’à l’accusé, ses refus, ses « trop tard », ses pannes ; les liaisons et les chronomètres', () => {
  let t = Date.UTC(2026, 10, 4, 19, 2)
  const r = new ReleveHoraire(() => t)
  r.message('player:action', 12, 'ok')
  r.message('player:action', 40, 'trop-tard')
  r.message('player:action', 20, 'refus')
  r.message('host:command', 5, 'ok')
  r.message('host:launch', 80, 'panne')
  for (let i = 0; i < 3; i++) r.liaisonOuverte()
  r.chrono(3)
  r.chrono(1500)
  r.chrono(2200)

  const [h] = r.lignes('d1')
  // Le plus coûteux au serveur d'abord, comme les routes : ses arrivées fois son temps.
  assert.deepEqual(
    h.tempsReel?.parMessage.map(m => [m.route, m.n, m.totalMs, m.refusees, m.enErreur]),
    [
      ['host:launch', 1, 80, 0, 1],
      ['player:action', 3, 72, 2, 0],
      ['host:command', 1, 5, 0, 0],
    ],
  )
  assert.equal(h.tempsReel?.tropTard, 1, 'un « trop tard » est un refus, compté à part')
  assert.equal(h.tempsReel?.connexions, 3)
  assert.deepEqual(h.tempsReel?.chronos, { n: 3, enRetard: 2, maxMs: 2200 }, 'en retard : plus d’une seconde après l’échéance')

  // Une heure neuve sans un message en compte zéro — elle se distingue d'une ligne d'avant le relevé.
  t += H
  r.base(10)
  assert.deepEqual(r.lignes('d1')[1].tempsReel, { parMessage: [], tropTard: 0, connexions: 0, chronos: { n: 0, enRetard: 0, maxMs: 0 } })
})

const ligne = (heure: number, l: Partial<HeureDeSante>): HeureDeSante => ({
  heure,
  demarrage: 'd1',
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
const message = (route: string, n: number, p95: number, refusees = 0, enErreur = 0): RouteDeLHeure => ({
  route,
  n,
  p50: Math.round(p95 / 2),
  p95,
  max: p95 * 2,
  totalMs: n * Math.round(p95 / 2),
  refusees,
  enErreur,
})

test('sur une période : les heures s’additionnent, la table se pondère comme celle des routes, et rien d’avant le relevé', () => {
  const fin = Date.UTC(2026, 10, 4, 20)
  const charge = (tempsReelMax: number) => ({ n: 6, processeur: 4, processeurMax: 6, boucleMaxMs: 30, memoireMaxMo: 200, invitesMax: 12, tempsReelMax })
  const lignes = [
    // Une ligne d'avant le relevé : elle ne dit rien du temps réel, et n'est pas « zéro ».
    ligne(fin - 30 * H, {}),
    // La période d'avant, pour l'écart.
    ligne(fin - 25 * H, { tempsReel: { parMessage: [message('player:action', 100, 40)], tropTard: 2, connexions: 20, chronos: { n: 30, enRetard: 0, maxMs: 80 } } }),
    ligne(fin - 2 * H, {
      charge: charge(14),
      tempsReel: {
        parMessage: [message('player:action', 300, 60, 9), message('host:command', 40, 20)],
        tropTard: 7,
        connexions: 31,
        chronos: { n: 80, enRetard: 1, maxMs: 1800 },
      },
    }),
    ligne(fin - H, {
      charge: charge(22),
      tempsReel: { parMessage: [message('player:action', 100, 100, 1, 1)], tropTard: 1, connexions: 9, chronos: { n: 20, enRetard: 0, maxMs: 40 } },
    }),
  ]
  const t = tempsReelDeLaPeriode(lignes, { debut: fin - 23 * H, fin, avantDebut: fin - 47 * H, avantFin: fin - 24 * H })!
  assert.deepEqual(
    [t.recus, t.refuses, t.enPanne, t.tropTard, t.connexions, t.clientsMax],
    [440, 10, 1, 8, 40, 22],
  )
  assert.deepEqual(t.chronos, { n: 100, enRetard: 1, maxMs: 1800 })
  assert.equal(t.depuis, fin - 25 * H, 'la première heure qui le relève')
  const action = t.messages.find(m => m.route === 'player:action')!
  // Pondéré par les arrivées : (300 × 60 + 100 × 100) / 400.
  assert.equal(action.p95, 70)
  assert.deepEqual(action.avant, { n: 100, p95: 40 })
  assert.deepEqual([action.refusees, action.enErreur], [10, 1])
  assert.equal(t.messages[0].route, 'player:action', 'le plus coûteux d’abord')
  // Rien d'avant le relevé : la page le dit, plutôt que d'écrire des zéros.
  assert.equal(tempsReelDeLaPeriode([ligne(fin, {})], { debut: fin - 23 * H, fin, avantDebut: fin - 47 * H, avantFin: fin - 24 * H }), null)
})

test('chaque message du contrat a ses mots dans la table', () => {
  for (const [nom, mots] of Object.entries(CE_QUE_FAIT_LE_MESSAGE)) {
    assert.match(nom, /^[a-z]+:[A-Za-z]+$/)
    assert.ok(mots.length > 8 && mots.length <= 60, `« ${nom} » : ${mots}`)
  }
})

test('au banc : un écran, un invité, une réponse trop tard et une hors partie — la page les dit, sans un prénom', async () => {
  const banc = await demarrer()
  try {
    const admin = await connexionAnimateur(banc.url)
    const host = await ecranCommun(banc.url, admin)
    const lea = await invite(banc.url, 'Léandra')
    const quiz = await creerQuiz(banc.url, admin, [qcm('Deux et deux ?', ['Quatre', 'Cinq'])])
    const sessionId = await lancerQuiz(host, quiz)
    // Pendant le compte à rebours, la question n'est pas encore posée : une réponse y arrive trop tard.
    const tard = await emitAck<{ ok: boolean; reason?: string }>(lea.socket, 'player:action', { sessionId, action: { choice: 0 }, slug: ADMIN.slug, token: lea.token })
    assert.deepEqual([tard.ok, tard.reason], [false, 'too-late'])
    // Une partie qui n'est pas celle en cours : refusée, sans être « trop tard ».
    const ailleurs = await emitAck<{ ok: boolean; reason?: string }>(lea.socket, 'player:action', {
      sessionId: 'une-autre-partie',
      action: { choice: 0 },
      slug: ADMIN.slug,
      token: lea.token,
    })
    assert.equal(ailleurs.ok, false)
    assert.notEqual(ailleurs.reason, 'too-late')

    const page = (await (await fetch(`${banc.url}/api/admin/serveur?periode=1h`, { headers: { Cookie: admin } })).json()) as PageDuServeur
    const t = page.tempsReel!
    const noms = t.messages.map(m => m.route)
    for (const attendu of ['host:hello', 'party:watch', 'player:join', 'player:action', 'host:launch', 'host:command']) assert.ok(noms.includes(attendu), `${attendu} est dans la table`)
    const action = t.messages.find(m => m.route === 'player:action')!
    assert.deepEqual([action.n, action.refusees, action.enErreur], [2, 2, 0])
    assert.equal(t.tropTard, 1)
    assert.ok(t.connexions >= 2, 'l’écran et le téléphone ont chacun ouvert leur liaison')
    assert.ok(t.depuis !== null)
    assert.ok(!JSON.stringify(t).includes('Léandra'), 'rien d’un invité : des noms de messages, des temps, des comptes')
    host.close()
    lea.socket.close()
  } finally {
    await banc.close()
  }
})
