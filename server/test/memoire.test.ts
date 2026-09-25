// La mémoire des quiz (rapport du 25 septembre 2026, lot 5) : « joué 3 fois ·
// le 14 mars », la réussite de chaque question à sa dernière soirée, et le
// tirage qui repose d'abord ce qu'on n'a jamais posé.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeQuestions, toPlayable, type PlayableQuestion } from '../../shared/library'
import { preparerPartie, suiteFixe, tirerQuestions } from '../../shared/hasard'
import { dernieresFois, jeuxDeLArchive, memoireDesSoirees } from '../src/core/memoire'
import type { PartyArchive } from '../../shared/archive'
import {
  attendre,
  connexionAnimateur,
  cookieDe,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

const question = (id: string, kind: 'choice' | 'number' = 'choice'): PlayableQuestion =>
  kind === 'choice'
    ? { kind, id, text: `Question ${id} ?`, answers: ['Juste', 'Faux'], correct: 0, duration: 20, image: null, observeSeconds: null }
    : { kind, id, text: `Combien ${id} ?`, target: 12, unit: '', duration: 20, image: null, observeSeconds: null }

// ── Les règles pures ───────────────────────────────────────────────────────

test('la question jouée garde son identifiant : c’est lui dont l’historique se souvient', () => {
  const [q] = normalizeQuestions([{ id: 'q-capitale', kind: 'choice', text: 'Capitale ?', answers: ['A', 'B'], correct: 0 }])
  assert.equal(toPlayable(q)?.id, 'q-capitale')
})

test('le relevé d’une archive, et la mémoire de ses soirées', () => {
  const archive: PartyArchive = {
    version: 1,
    players: [],
    teams: [],
    bonuses: [],
    scores: [],
    packs: {
      s1: { title: 'Années 90', quizId: 'quiz-90', questions: [question('a'), question('b', 'number')], exact: true },
      // Une partie d'avant, sans identifiant de quiz : on ne sait pas ce qu'elle était.
      s2: { title: 'Vieux quiz', questions: [question('c')], exact: true },
    },
    answers: [
      ...['alice', 'bob', 'carla'].map((p, i) => ligne('s1', 0, p, i < 2)),
      ...['alice', 'bob', 'carla'].map(p => ({ ...ligne('s1', 1, p, false), kind: 'number' as const, correct: null })),
      ligne('s2', 0, 'alice', true),
    ],
  }
  const jeux = jeuxDeLArchive(archive)
  assert.deepEqual(jeux, [
    {
      quizId: 'quiz-90',
      questions: [
        ['a', 3, 2],
        ['b', 3, null],
      ],
    },
  ])
  // Deux soirées, et deux parties le même soir pour la seconde.
  const memoire = memoireDesSoirees([
    { heldAt: 200, jeux: [{ quizId: 'quiz-90', questions: [['a', 4, 1]] }, { quizId: 'quiz-90', questions: [['a', 2, 2]] }] },
    { heldAt: 100, jeux },
    { heldAt: 50 },
  ])
  assert.deepEqual(memoire.quiz.get('quiz-90'), { fois: 3, dernier: 200 })
  assert.deepEqual(memoire.questions.get('a'), { fois: 3, dernier: 200, posees: 6, justes: 3 }, 'la dernière soirée, ses deux parties additionnées')
  assert.deepEqual(memoire.questions.get('b'), { fois: 1, dernier: 100, posees: 3, justes: null }, 'une estimation n’est jamais « juste »')
  assert.deepEqual([...dernieresFois(memoire)], [
    ['a', 200],
    ['b', 100],
  ])
})

function ligne(sessionId: string, qIndex: number, playerId: string, correct: boolean) {
  return {
    sessionId,
    quizTitle: 'Quiz',
    qIndex,
    kind: 'choice' as const,
    playerId,
    answered: true,
    correct,
    choice: correct ? 0 : 1,
    value: null,
    target: null,
    ms: 1000,
    changes: 0,
    points: correct ? 100 : 0,
    durationMs: 20000,
    observed: false,
    createdAt: 1,
  }
}

test('le tirage pose d’abord ce qui ne l’a jamais été, puis le plus ancien — dans l’ordre écrit', () => {
  const questions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'].map(id => question(id))
  const posees = new Map([
    ['q1', 300],
    ['q2', 300],
    ['q3', 100],
    ['q5', 200],
  ])
  for (let graine = 1; graine <= 20; graine++) {
    const tirees = tirerQuestions(questions, 5, posees, suiteFixe(graine)).map(q => q.id)
    // Quatre jamais posées, puis la plus ancienne des autres.
    assert.deepEqual(tirees, ['q3', 'q4', 'q6', 'q7', 'q8'], `graine ${graine}`)
  }
  // Entre égales, le hasard : trois parmi six jamais posées ne sont pas toujours les mêmes.
  const vues = new Set<string>()
  for (let graine = 1; graine <= 30; graine++) {
    const tirees = tirerQuestions(questions.slice(0, 6), 3, new Map(), suiteFixe(graine)).map(q => q.id!)
    assert.deepEqual([...tirees].sort(), tirees, 'l’ordre écrit demeure')
    vues.add(tirees.join(','))
  }
  assert.ok(vues.size > 3, `le tirage varie (${vues.size} tirages différents)`)
  assert.equal(tirerQuestions(questions, 20, posees, suiteFixe(1)).length, 8, 'plus qu’il n’y en a : toutes')
  assert.equal(preparerPartie(questions, { tirage: 5 }, suiteFixe(3), posees).length, 5)
  assert.equal(preparerPartie(questions, {}, suiteFixe(3), posees).length, 8, 'sans tirage, tout le quiz')
})

// ── Le serveur : une soirée jouée, puis rejouée ────────────────────────────

const vue = (host: Socket, pred: (v: any) => boolean, label: string) =>
  attendre<any>(host, 'session:view', p => pred(p.view), label, 15_000).then(p => p.view)

/** Joue les questions d'une partie jusqu'au podium : Alice trouve, Bob se trompe. Rend les intitulés posés. */
async function jouer(host: Socket, alice: Invite, bob: Invite, sessionId: string, n: number): Promise<string[]> {
  const textes: string[] = []
  // Chaque vue s'attend avant le geste qui la provoque : arrivée avant
  // l'écoute, elle ne reviendrait pas.
  let v = await vue(host, x => x.phase === 'question' && x.qIndex === 0, 'question 1')
  for (let i = 0; i < n; i++) {
    textes.push(v.text)
    const revelation = vue(host, v => v.phase === 'reveal' && v.qIndex === i, `révélation ${i + 1}`)
    for (const [joueur, choix] of [
      [alice, 0],
      [bob, 1],
    ] as const) {
      const ack = await emitAck<any>(joueur.socket, 'player:action', { sessionId, action: { type: 'answer', choice: choix, qIndex: i, round: v.round } })
      assert.equal(ack.ok, true)
    }
    const r = await revelation
    const suite = vue(host, x => (i + 1 < n ? x.phase === 'question' && x.qIndex === i + 1 : x.phase === 'finished'), 'la suite')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: i, round: r.round } })
    v = await suite
  }
  return textes
}

test('après une soirée, « Mes quiz » sait quand le quiz a été joué et qui a trouvé — et le tirage suivant repose le reste', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const lire = async (chemin: string, c = cookie) => (await fetch(`${banc.url}${chemin}`, { headers: { Cookie: c } })).json() as Promise<any>
  const id = await creerQuiz(
    banc.url,
    cookie,
    Array.from({ length: 10 }, (_, i) => qcm(`Question ${i + 1} ?`, ['Juste', 'Faux'], 0, 60)),
    'Banque de questions',
  )
  const quiz = await lire(`/api/quizzes/${id}`)
  // Cinq questions tirées à chaque partie.
  assert.equal((await ecrire(banc.url, `/api/quizzes/${id}`, { title: quiz.title, questions: quiz.questions, reglages: { tirage: 5 } }, cookie, 'PUT')).status, 200)
  const idDe = new Map<string, string>(quiz.questions.map((q: any) => [q.text, q.id]))
  assert.equal((await lire('/api/quizzes')).find((q: any) => q.id === id).joue, undefined, 'jamais joué')

  const alice = await invite(banc.url, 'Alice')
  const bob = await invite(banc.url, 'Bob', '🐻')
  const host = await ecranCommun(banc.url, cookie)
  const choix = vue(host, v => v.phase === 'pickPack', 'le choix du quiz')
  const premiere = await lancerQuiz(host, id)
  assert.equal((await choix).packs.find((p: any) => p.id === id).questionCount, 5, 'la carte dit ce qui se jouera')
  const posees = await jouer(host, alice, bob, premiere, 5)
  assert.equal(posees.length, 5)

  // Le podium range la soirée : la bibliothèque le sait.
  const joue = await attendreQue(async () => (await lire('/api/quizzes')).find((q: any) => q.id === id).joue ?? null)
  assert.equal(joue.fois, 1)
  const memoire = await lire(`/api/quizzes/${id}/memoire`)
  assert.equal(memoire.joue.fois, 1)
  assert.deepEqual(Object.keys(memoire.questions).sort(), posees.map(t => idDe.get(t)!).sort(), 'les cinq questions posées, et elles seules')
  for (const souvenir of Object.values<any>(memoire.questions)) {
    assert.deepEqual({ fois: souvenir.fois, posees: souvenir.posees, justes: souvenir.justes }, { fois: 1, posees: 2, justes: 1 })
  }

  // Le quiz rejoué : les cinq autres, jamais posées.
  ;(host as any).emit('host:endSession', { sessionId: premiere })
  await patienter(300)
  const seconde = await lancerQuiz(host, id)
  const reposees = await jouer(host, alice, bob, seconde, 5)
  assert.deepEqual(
    [...reposees].sort(),
    [...idDe.keys()].filter(t => !posees.includes(t)).sort(),
    'le tirage a pris les cinq questions jamais posées',
  )
  ;(host as any).emit('host:endSession', { sessionId: seconde })
  const deuxFois = await attendreQue(async () => {
    const q = (await lire('/api/quizzes')).find((x: any) => x.id === id)
    return q.joue?.fois === 2 ? q.joue : null
  })
  assert.equal(deuxFois.fois, 2)
  host.close()
  alice.socket.close()
  bob.socket.close()

  // Le voisin n'en sait rien.
  const cree = await ecrire(banc.url, '/api/admin/accounts', { login: 'voisin', name: 'Voisin', slug: 'chez-le-voisin' }, cookie)
  const { activation } = (await cree.json()) as { activation: { token: string } }
  const voisin = cookieDe(await ecrire(banc.url, '/api/auth/activate', { token: activation.token, password: 'voisin-pass-1' }))
  assert.equal((await fetch(`${banc.url}/api/quizzes/${id}/memoire`, { headers: { Cookie: voisin } })).status, 404)
})

/** Relit jusqu'à ce que l'historique ait rangé la soirée. */
async function attendreQue<T>(lire: () => Promise<T | null>, delaiMs = 10_000): Promise<T> {
  const fin = Date.now() + delaiMs
  for (;;) {
    const r = await lire()
    if (r) return r
    if (Date.now() > fin) throw new Error('l’historique n’a pas rangé la soirée')
    await patienter(150)
  }
}
