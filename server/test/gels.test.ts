// Ce qui gèle la boucle (`core/gels.ts`). Le relevé de l'heure disait le pire
// gel de chaque heure, pas ce qui tournait pendant : 2,9 s le 31 octobre 2026,
// pendant une soirée de vingt invités, et rien pour dire si c'était l'une des
// mille requêtes de l'heure, un calcul de fond ou le ramasse-miettes. Chaque
// gel de plus d'une demi-seconde se relève maintenant, avec ce qui tournait,
// heure par heure, jusqu'à la page « Le serveur » du QG.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { ADMIN, attendre, connecter, connexionAnimateur, creerQuiz, demarrer, ecranCommun, emitAck, invite, lancerQuiz, qcm, type Banc } from './banc'
import { SondeDesGels, ceQuiTournait, commencer, suivre } from '../src/core/gels'
import { Charge, ReleveHoraire, releve } from '../src/core/pouls'
import { HEURE_MS, fondreLHeure, pageDuServeur, type DemarrageDuServeur, type GelDeLaBoucle, type HeureDeSante, type PageDuServeur } from '../../shared/santeDuServeur'

/** Gèle la boucle : un calcul qui ne rend pas la main. */
function geler(ms: number) {
  const fin = performance.now() + ms
  while (performance.now() < fin) {
    // Rien.
  }
}

const patienter = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Attend qu'une condition tienne — une machine chargée ne fait que la retarder. */
async function quand<T>(lire: () => T | undefined, message: string): Promise<T> {
  const fin = Date.now() + 10_000
  for (;;) {
    const lu = lire()
    if (lu !== undefined) return lu
    if (Date.now() > fin) assert.fail(message)
    await patienter(10)
  }
}

/** Une sonde au seuil abaissé, et les gels qu'elle relève. */
function sonde(seuilMs = 200) {
  const releves: GelDeLaBoucle[] = []
  const s = new SondeDesGels(g => releves.push(g), { seuilMs })
  return { releves, arreter: () => s.arreter() }
}

test('un gel se relève avec ce qui tournait pendant : ni ce qui avait fini avant, ni ce qui attendait en pause', async () => {
  const { releves, arreter } = sonde()
  try {
    commencer('GET /api/avant')()
    const fond = suivre('fond · en pause')
    fond.suspendre()
    const calcul = suivre('fond · calcul')
    // Deux réveils de la sonde : ce qui a fini avant est derrière sa fenêtre.
    await patienter(250)
    const requetes = [commencer('GET /api/joueur/moi'), commencer('GET /api/joueur/moi')]
    const debut = Date.now()
    await new Promise<void>(fini =>
      setImmediate(() => {
        geler(400)
        fini()
      }),
    )
    for (const fin of requetes) fin()
    calcul.finir()
    fond.finir()
    const gel = await quand(() => releves.at(-1), 'la sonde relève le gel')
    assert.ok(gel.dureeMs >= 300, `sa durée : ${gel.dureeMs} ms`)
    assert.ok(gel.processeurMs > 0, 'le processeur pris pendant')
    assert.ok(gel.a >= debut && gel.a <= Date.now(), 'sa fin, à l’horloge')
    assert.equal(gel.ramasseMiettesMs >= 0, true)
    const noms = new Map(gel.enCours.map(c => [c.quoi, c.n]))
    assert.equal(noms.get('GET /api/joueur/moi'), 2, 'deux accueils de front se comptent ensemble')
    assert.equal(noms.get('fond · calcul'), 1)
    assert.ok(!noms.has('GET /api/avant'), 'fini avant le gel, il n’en est pas')
    assert.ok(!noms.has('fond · en pause'), 'en pause, il n’en est pas')
  } finally {
    arreter()
  }
})

test('sous le seuil, rien ne se relève', async () => {
  const { releves, arreter } = sonde(2_000)
  try {
    await new Promise<void>(fini =>
      setImmediate(() => {
        geler(300)
        fini()
      }),
    )
    await patienter(300)
    assert.deepEqual(releves, [])
  } finally {
    arreter()
  }
})

test('ce qui tournait se lit dans une fenêtre, le nom lu à la fin, et ce qui a couvert le plus de la fenêtre d’abord', async () => {
  const t0 = performance.now()
  let route = 'GET /api hors route'
  const fin = commencer(() => route)
  // Le modèle de la route n'est connu qu'une fois la route trouvée.
  route = 'GET /api/campagne/sentiers'
  await patienter(20)
  const court = commencer('socket player:action')
  court()
  fin()
  const lu = ceQuiTournait(t0, performance.now())
  assert.deepEqual(
    lu.map(c => c.quoi),
    ['GET /api/campagne/sentiers', 'socket player:action'],
  )
  assert.deepEqual(ceQuiTournait(performance.now() + 1, performance.now() + 2), [], 'rien après')
})

test('un gel qui couvre l’échéance du relevé de la charge compte au pire gel de la boucle', async () => {
  // Le relevé de la charge lit l'histogramme du retard de la boucle, puis le
  // remet à zéro — et la remise à zéro oublie l'instant de son dernier tour.
  // Échu pendant un gel, le relevé passait juste après lui, avant que
  // l'histogramme l'ait noté : le gel ne comptait nulle part. Un gel de deux
  // secondes s'y perdait une fois sur cinq, un de dix à chaque fois (le banc
  // du 2 novembre 2026).
  const r = new ReleveHoraire()
  // L'histogramme se réveille tous les dixièmes de seconde depuis sa création,
  // le relevé à 1,05 s : le gel part juste après le réveil d'une seconde de
  // l'histogramme, avant l'échéance du relevé, et la couvre — passé le gel, le
  // relevé échu avant l'histogramme passe le premier.
  const charge = new Charge(1_050, { releve: r, gel: null, reseau: null })
  try {
    await patienter(1_020)
    geler(1_500)
    await patienter(1_300)
    const pire = r.lignes('banc')[0].charge?.boucleMaxMs ?? 0
    assert.ok(pire >= 1_300, `le pire gel de la boucle : ${pire} ms`)
  } finally {
    charge.arreter()
  }
})

/** Un gel tel que la sonde le relève. */
const unGel = (a: number, dureeMs: number, ...noms: string[]): GelDeLaBoucle => ({
  a,
  dureeMs,
  processeurMs: Math.round(dureeMs / 10),
  ramasseMiettesMs: 0,
  enCours: noms.map(quoi => ({ quoi, n: 1 })),
})

test('le relevé de l’heure compte ses gels, garde les cinq plus longs et ce qui tournait, ce qui a couvert le plus de gel d’abord', () => {
  const debut = Date.UTC(2026, 10, 2, 20)
  let t = debut + 60_000
  const r = new ReleveHoraire(() => t)
  assert.deepEqual(r.lignes('d1')[0].gels, { n: 0, totalMs: 0, plusLongs: [], parCe: [], sansRien: 0 }, 'une heure sans gel en compte zéro')
  const gels = [
    unGel(t, 600, 'GET /api/joueur/moi'),
    unGel(t + 1, 2_900, 'GET /api/campagne/sentiers', 'fond · modèle du savoir'),
    unGel(t + 2, 800, 'GET /api/joueur/moi', 'chrono question'),
    unGel(t + 3, 700),
    unGel(t + 4, 1_200, 'fond · modèle du savoir'),
    unGel(t + 5, 550, 'socket player:action'),
    unGel(t + 6, 900, 'GET /api/joueur/moi'),
  ]
  for (const g of gels) r.gel(g)
  const h = r.lignes('d1')[0].gels!
  assert.equal(h.n, 7)
  assert.equal(h.totalMs, 7_650)
  assert.equal(h.sansRien, 1)
  assert.deepEqual(
    h.plusLongs.map(g => g.dureeMs),
    [2_900, 1_200, 900, 800, 700],
  )
  assert.deepEqual(h.parCe.slice(0, 3), [
    { quoi: 'fond · modèle du savoir', n: 2, ms: 4_100 },
    { quoi: 'GET /api/campagne/sentiers', n: 1, ms: 2_900 },
    { quoi: 'GET /api/joueur/moi', n: 3, ms: 2_300 },
  ])
  // L'heure suivante repart de zéro ; celle d'avant reste à côté, ses dernières minutes s'écrivent après coup.
  t = debut + HEURE_MS + 1
  r.gel(unGel(t, 500, 'GET /api/jour'))
  const [avant, courante] = r.lignes('d1')
  assert.equal(avant.gels!.n, 7)
  assert.equal(courante.gels!.n, 1)
})

/** Une heure de démarrage, telle que la base la garde, avec ses gels. */
function ligne(heure: number, demarrage: string, gels?: GelDeLaBoucle[]): HeureDeSante {
  const r = new ReleveHoraire(() => heure + 1)
  for (const g of gels ?? []) r.gel(g)
  const l = r.lignes(demarrage)[0]
  if (!gels) delete l.gels
  return l
}

test('deux démarrages dans la même heure fondent leurs gels, et la page dit ceux de la semaine', () => {
  const heure = Date.UTC(2026, 10, 2, 20)
  const fondue = fondreLHeure([
    ligne(heure, 'd1', [unGel(heure, 2_900, 'chrono question', 'socket player:action'), unGel(heure, 600, 'socket player:action')]),
    ligne(heure, 'd2', [unGel(heure, 1_000, 'socket player:action')]),
  ])!
  assert.equal(fondue.gels!.n, 3)
  assert.deepEqual(fondue.gels!.parCe[0], { quoi: 'socket player:action', n: 3, ms: 4_500 })
  assert.deepEqual(
    fondue.gels!.plusLongs.map(g => g.dureeMs),
    [2_900, 1_000, 600],
  )

  const maintenant = heure + 2 * HEURE_MS + 60_000
  const courant: DemarrageDuServeur = { id: 'd2', demarreLe: heure - HEURE_MS, pretEnMs: 3_000, version: 'abc1234', env: 'production', vuLe: maintenant, arreteLe: null }
  // Une ligne d'avant les gels n'en dit rien ; une heure qui les relève sans en avoir eu en compte zéro.
  const lignes = [
    ligne(heure - HEURE_MS, 'd2'),
    ligne(heure, 'd1', [unGel(heure, 2_900, 'chrono question')]),
    ligne(heure, 'd2', [unGel(heure, 1_000, 'GET /api/joueur/missions')]),
    ligne(heure + HEURE_MS, 'd2', []),
  ]
  const page = pageDuServeur(lignes, [courant], { maintenant, courant })
  assert.equal(page.gels!.n, 2)
  assert.equal(page.gels!.depuis, heure, 'depuis la première heure qui les relève')
  assert.deepEqual(
    page.gels!.parCe.map(c => c.quoi),
    ['chrono question', 'GET /api/joueur/missions'],
  )
  const parHeure = new Map(page.heures.map(h => [h.heure, h.gels]))
  assert.equal(parHeure.get(heure)!.n, 2)
  assert.equal(parHeure.get(heure)!.plusLong.dureeMs, 2_900, 'le plus long de l’heure, pour la légende de la boucle')
  assert.equal(parHeure.get(heure + HEURE_MS), null, 'sans gel, rien')
  assert.equal(parHeure.get(heure - HEURE_MS), null)

  const sansGels = pageDuServeur([ligne(heure, 'd2')], [courant], { maintenant, courant })
  assert.equal(sansGels.gels, null, 'aucune heure ne les relève encore')
})

let banc: Banc | undefined
after(async () => {
  await banc?.close()
})

test('les portes du serveur disent ce qui tourne : chaque route sous son modèle, chaque message du temps réel, chaque chronomètre d’une partie', async () => {
  banc = await demarrer()
  const nomme = async (geste: () => Promise<unknown>) => {
    const t0 = performance.now()
    await geste()
    return ceQuiTournait(t0, performance.now()).map(c => c.quoi)
  }
  const cookie = await connexionAnimateur(banc.url)
  let quizId = ''
  const quiz = await nomme(async () => {
    quizId = await creerQuiz(banc!.url, cookie, [qcm('Une ?')])
  })
  assert.ok(quiz.includes('POST /api/quizzes'), `la route sous son modèle (${quiz.join(', ')})`)
  assert.ok(quiz.includes('PUT /api/quizzes/:id'), 'jamais son adresse : elle porte un identifiant')
  assert.ok(!quiz.some(q => /[0-9a-f]{8}-/.test(q)), 'aucun identifiant')

  const page = await nomme(() => fetch(`${banc!.url}/${ADMIN.slug}`).then(r => r.text()))
  assert.ok(page.some(q => q.startsWith('GET ') && !q.includes(ADMIN.slug)), `une page, sans son adresse (${page.join(', ')})`)

  const socket = connecter(banc.url)
  const regarde = await nomme(() => emitAck(socket, 'party:watch', { slug: ADMIN.slug }))
  assert.ok(regarde.includes('socket party:watch'), `le message du temps réel (${regarde.join(', ')})`)

  const host = await ecranCommun(banc.url, cookie)
  await invite(banc.url, 'Alice')
  const t0 = performance.now()
  assert.ok(await lancerQuiz(host, quizId))
  await attendre<any>(host, 'session:view', p => p.view.phase === 'question', 'la question à l’écran')
  const partie = ceQuiTournait(t0, performance.now()).map(c => c.quoi)
  assert.ok(partie.includes('chrono ready'), `le chronomètre du compte à rebours (${partie.join(', ')})`)
  assert.ok(partie.includes('socket host:command'))
})

test('un gel s’écrit dans la base avec son heure, et la page le relit au réveil', async () => {
  banc ??= await demarrer()
  // Un gel au relevé de l'heure de ce démarrage, comme la sonde l'y range.
  releve.gel(unGel(Date.now(), 1_234, 'GET /api/campagne/sentiers', 'fond · modèle du savoir'))
  // Éteint proprement, son heure s'écrit ; le suivant la relit de la base — la
  // lecture de chaque ligne nommait ses champs un à un, et laissait les gels.
  await banc.redemarrer()
  const admin = await connexionAnimateur(banc.url)
  const page = (await (await fetch(`${banc.url}/api/admin/serveur`, { headers: { Cookie: admin } })).json()) as PageDuServeur
  assert.ok(page.gels, 'la page dit les gels de la semaine')
  const gel = page.gels.plusLongs.find(g => g.dureeMs === 1_234)
  assert.ok(gel, `relu de la base (${JSON.stringify(page.gels.plusLongs.map(g => g.dureeMs))})`)
  assert.deepEqual(
    gel.enCours.map(c => c.quoi),
    ['GET /api/campagne/sentiers', 'fond · modèle du savoir'],
  )
  assert.ok(
    page.gels.parCe.some(c => c.quoi === 'fond · modèle du savoir'),
    'ce qui tournait, sur la semaine',
  )
})
