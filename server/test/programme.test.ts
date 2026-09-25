// Le programme de la soirée (rapport du 25 septembre 2026, lot 3) : les quiz
// de ce soir dans l'ordre, la finale en ×2 réglée d'avance — et la console
// qui propose le prochain au lieu de toute la bibliothèque.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createClient } from '@libsql/client'
import { avancementDuProgramme, normaliserEntrees, titreDeProgramme, titreDuJour, MAX_ENTREES } from '../../shared/programme'
import {
  attendre,
  connexionAnimateur,
  cookieDe,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  invite,
  qcm,
  type Banc,
  type Socket,
} from './banc'

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

const vue = (host: Socket, pred: (v: any) => boolean, label: string) =>
  attendre<any>(host, 'session:view', p => pred(p.view), label, 15_000).then(p => ({ sessionId: p.sessionId as string, view: p.view }))

// ── Les règles pures ───────────────────────────────────────────────────────

test('les entrées d’un programme : chaque quiz une fois, un multiplicateur permis, trente au plus', () => {
  assert.deepEqual(normaliserEntrees(null), [])
  assert.deepEqual(
    normaliserEntrees([
      { quizId: 'a', multiplier: 2 },
      { quizId: 'a', multiplier: 3 },
      { quizId: 'b', multiplier: 7 },
      { quizId: '../x', multiplier: 1 },
      { quizId: 42 },
      null,
      { quizId: 'c', multiplier: '3' },
    ]),
    [
      { quizId: 'a', multiplier: 2 },
      { quizId: 'b', multiplier: 1 },
      { quizId: 'c', multiplier: 3 },
    ],
  )
  const trop = Array.from({ length: 40 }, (_, i) => ({ quizId: `q${i}`, multiplier: 1 }))
  assert.equal(normaliserEntrees(trop).length, MAX_ENTREES)
  assert.equal(titreDeProgramme('  Nouvel   an 2026 '), 'Nouvel an 2026')
  assert.equal(titreDeProgramme(''), 'Programme de la soirée')
  assert.equal(titreDuJour(new Date(2026, 11, 31)), 'Soirée du 31 décembre')
  assert.equal(titreDuJour(new Date(2026, 0, 1)), 'Soirée du 1er janvier')
})

test('le prochain quiz est le premier qu’on n’a pas joué ce soir — un quiz qui ne se joue plus sort du compte', () => {
  const entrees = normaliserEntrees([
    { quizId: 'manche-1', multiplier: 1 },
    { quizId: 'supprime', multiplier: 1 },
    { quizId: 'manche-2', multiplier: 1 },
    { quizId: 'finale', multiplier: 2 },
  ])
  const jouables = new Set(['manche-1', 'manche-2', 'finale', 'hors-programme'])
  let a = avancementDuProgramme(entrees, jouables, new Set())
  assert.deepEqual(a.entrees.map(e => e.quizId), ['manche-1', 'manche-2', 'finale'])
  assert.equal(a.prochain?.quizId, 'manche-1')
  assert.equal(a.ensuite?.quizId, 'manche-2')
  // Un quiz lancé hors programme ne fait rien sauter.
  a = avancementDuProgramme(entrees, jouables, new Set(['manche-1', 'hors-programme']))
  assert.equal(a.prochain?.quizId, 'manche-2')
  assert.deepEqual(a.ensuite, { quizId: 'finale', multiplier: 2 })
  // La finale jouée en avance : la manche 2 reste à jouer, et rien après.
  a = avancementDuProgramme(entrees, jouables, new Set(['manche-1', 'finale']))
  assert.equal(a.prochain?.quizId, 'manche-2')
  assert.equal(a.ensuite, null)
  a = avancementDuProgramme(entrees, jouables, new Set(['manche-1', 'manche-2', 'finale']))
  assert.equal(a.prochain, null, 'tout est joué')
})

// ── Le serveur : l'espace, la console, les téléphones ─────────────────────

test('la console propose le prochain quiz du programme, réglé d’avance — et les téléphones n’en savent rien', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const lire = async (chemin: string, c = cookie) => (await fetch(`${banc.url}${chemin}`, { headers: { Cookie: c } })).json() as Promise<any>
  const manche1 = await creerQuiz(banc.url, cookie, [qcm('Manche 1 ?', ['Oui', 'Non'], 0, 60)], 'Manche 1')
  const manche2 = await creerQuiz(banc.url, cookie, [qcm('Manche 2 ?', ['Oui', 'Non'], 0, 60), qcm('Encore ?', ['Oui', 'Non'], 0, 60)], 'Manche 2')
  const finale = await creerQuiz(banc.url, cookie, [qcm('Finale ?', ['Oui', 'Non'], 0, 60)], 'La finale')
  await creerQuiz(banc.url, cookie, [qcm('Autre ?', ['Oui', 'Non'], 0, 60)], 'Hors programme')

  // Le voisin : son quiz n'entre pas dans notre programme, et il ne touche pas au nôtre.
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'voisin', name: 'Voisin', slug: 'chez-le-voisin' }, cookie)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  const voisin = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'voisin-pass-1' }))
  const quizDuVoisin = await creerQuiz(banc.url, voisin, [qcm('Chez lui ?', ['Oui', 'Non'])], 'Chez le voisin')

  const res = await ecrire(
    banc.url,
    '/api/programmes',
    {
      titre: 'Nouvel an 2026',
      entrees: [
        { quizId: manche1, multiplier: 1 },
        { quizId: quizDuVoisin, multiplier: 1 },
        { quizId: manche2, multiplier: 1 },
        { quizId: finale, multiplier: 2 },
      ],
    },
    cookie,
  )
  assert.equal(res.status, 201)
  const programme = (await res.json()) as any
  assert.equal(programme.actif, true, 'le programme qu’on commence est celui de ce soir')
  assert.deepEqual(
    programme.entrees.map((e: any) => e.quizId),
    [manche1, manche2, finale],
    'un quiz d’un autre espace n’entre pas',
  )
  assert.deepEqual(await lire('/api/programmes', voisin), [], 'le voisin ne voit pas nos programmes')
  for (const [chemin, corps, methode] of [
    [`/api/programmes/${programme.id}`, { titre: 'Piraté' }, 'PUT'],
    [`/api/programmes/${programme.id}/activer`, { actif: false }, 'POST'],
    [`/api/programmes/${programme.id}`, {}, 'DELETE'],
  ] as const) {
    assert.equal((await ecrire(banc.url, chemin, corps, voisin, methode)).status, 404, `${methode} ${chemin}`)
  }

  // La console : le programme d'abord, le prochain réglé d'avance.
  const alice = await invite(banc.url, 'Alice')
  const host = await ecranCommun(banc.url, cookie)
  let choix = vue(host, v => v.phase === 'pickPack', 'le choix du premier quiz')
  const telephone = attendre<any>(alice.socket, 'session:view', p => p.view.phase === 'pickPack', 'le téléphone au choix du quiz')
  ;(host as any).emit('host:launch')
  let { sessionId, view } = await choix
  assert.deepEqual(view.programme, { titre: 'Nouvel an 2026', total: 3, prochain: manche1, ensuite: manche2 })
  assert.deepEqual(
    view.packs.slice(0, 3).map((p: any) => [p.id, p.auProgramme]),
    [
      [manche1, { rang: 1, multiplier: 1 }],
      [manche2, { rang: 2, multiplier: 1 }],
      [finale, { rang: 3, multiplier: 2 }],
    ],
    'le programme en tête, dans son ordre, chacun avec son multiplicateur',
  )
  // Quatre quiz à nous, et le modèle livré qui se joue tel quel.
  assert.equal(view.packs.length, 5, 'les autres quiz restent là, pour improviser')
  const autre = view.packs.find((p: any) => p.title === 'Hors programme')
  assert.equal(autre.auProgramme, undefined)
  assert.equal(view.packs.find((p: any) => p.id === manche2).dureeS > 0, true, 'la durée estimée de chaque quiz')
  // Invariant 1 et 4 : le programme annonce les titres à venir — jamais aux téléphones.
  const vueDuTelephone = JSON.stringify((await telephone).view)
  assert.doesNotMatch(vueDuTelephone, /Nouvel an|Manche|finale|programme/i)

  // La manche 1 jouée — la commande `selectPack` n'a pas changé.
  ;(host as any).emit('host:command', { sessionId, command: { type: 'selectPack', packId: manche1, multiplier: 1 } })
  await vue(host, v => v.phase === 'question', 'la manche 1')
  ;(host as any).emit('host:endSession', { sessionId })

  // Un quiz hors programme, puis le programme reprend où il en était.
  choix = vue(host, v => v.phase === 'pickPack', 'le choix du deuxième quiz')
  ;(host as any).emit('host:launch')
  ;({ sessionId, view } = await choix)
  assert.equal(view.programme.prochain, manche2, 'la manche 2 est la suivante')
  assert.equal(view.programme.ensuite, finale, 'puis la finale')
  assert.equal(view.packs.find((p: any) => p.id === manche1).joueCeSoir, true)
  ;(host as any).emit('host:command', { sessionId, command: { type: 'selectPack', packId: autre.id, multiplier: 1 } })
  await vue(host, v => v.phase === 'question', 'le quiz hors programme')
  ;(host as any).emit('host:endSession', { sessionId })

  choix = vue(host, v => v.phase === 'pickPack', 'le choix du troisième quiz')
  ;(host as any).emit('host:launch')
  ;({ sessionId, view } = await choix)
  assert.equal(view.programme.prochain, manche2, 'le quiz improvisé n’a rien fait sauter')

  // Un programme qu'on range pour ce soir : plus de prochain, la bibliothèque comme avant.
  assert.equal((await ecrire(banc.url, `/api/programmes/${programme.id}/activer`, { actif: false }, cookie)).status, 200)
  ;(host as any).emit('host:endSession', { sessionId })
  choix = vue(host, v => v.phase === 'pickPack', 'le choix sans programme')
  ;(host as any).emit('host:launch')
  ;({ sessionId, view } = await choix)
  assert.equal(view.programme, undefined)
  assert.equal(view.packs.some((p: any) => p.auProgramme), false)
  ;(host as any).emit('host:endSession', { sessionId })
  host.close()
  alice.socket.close()

  // Rangé, il reste : c'est le « dossier » de la soirée, qu'on reprend l'an prochain.
  const liste = await lire('/api/programmes')
  assert.deepEqual(liste.map((p: any) => [p.titre, p.actif]), [['Nouvel an 2026', false]])
  const renomme = (await (await ecrire(banc.url, `/api/programmes/${programme.id}`, { titre: 'Nouvel an 2027', entrees: [{ quizId: finale, multiplier: 3 }] }, cookie, 'PUT')).json()) as any
  assert.equal(renomme.titre, 'Nouvel an 2027')
  assert.deepEqual(renomme.entrees, [{ quizId: finale, multiplier: 3 }])
})

test('un compte supprimé emporte ses programmes', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const admin = await connexionAnimateur(banc.url)
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'carla', name: 'Carla', slug: 'chez-carla' }, admin)
  const { account, activation } = (await cree.json()) as { account: { id: string }; activation: { token: string } }
  const carla = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'carla-pass-1' }))
  const quiz = await creerQuiz(banc.url, carla, [qcm('Chez Carla ?', ['Oui', 'Non'])], 'Chez Carla')
  assert.equal((await ecrire(banc.url, '/api/programmes', { titre: 'Anniv', entrees: [{ quizId: quiz, multiplier: 1 }] }, carla)).status, 201)
  assert.equal((await ecrire(banc.url, `/api/admin/accounts/${account.id}/disable`, {}, admin)).status, 200)
  assert.equal((await ecrire(banc.url, `/api/admin/accounts/${account.id}`, {}, admin, 'DELETE')).status, 200)
  const base = createClient({ url: banc.quizDbUrl })
  try {
    const reste = await base.execute({ sql: 'SELECT COUNT(*) AS n FROM programmes WHERE space_id = ?', args: [account.id] })
    assert.equal(Number(reste.rows[0].n), 0)
  } finally {
    base.close()
  }
})
