// Test de bout en bout : boote un vrai serveur (base jetable) et rejoue le
// parcours complet d'une soirée — inscription, lancement d'un quiz, réponses,
// scoring de rapidité, révélation, classement, reconnexion par token.
// À lancer via `npm run smoke`.
import { io as clientIo, type Socket } from 'socket.io-client'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createQuizServer } from '../src/server'

function fail(msg: string): never {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg)
}

function emitAck<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`ack timeout: ${event}`)), 5000)
    ;(socket as any).emit(event, payload, (res: T) => {
      clearTimeout(to)
      resolve(res)
    })
  })
}

function waitFor<T>(socket: Socket, event: string, pred: (p: T) => boolean, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`timeout en attendant : ${label}`)), 8000)
    const handler = (p: T) => {
      if (!pred(p)) return
      clearTimeout(to)
      socket.off(event, handler as any)
      resolve(p)
    }
    socket.on(event, handler as any)
  })
}

const dbPath = path.join(mkdtempSync(path.join(tmpdir(), 'quizz-smoke-')), 'test.db')
const server = await createQuizServer({ port: 0, dbPath, hostKey: 'smoke' })
const url = `http://localhost:${server.port}`
const connect = () => clientIo(url, { transports: ['websocket'] })

try {
  // 1. Écran commun : la clé protège bien l'accès
  const host = connect()
  const hello = await emitAck<{ ok: boolean }>(host, 'host:hello', { key: 'smoke' })
  assert(hello.ok, 'host:hello refusé avec la bonne clé')
  const badHello = await emitAck<{ ok: boolean }>(host, 'host:hello', { key: 'mauvaise' })
  assert(!badHello.ok, 'host:hello accepté avec une mauvaise clé')

  // 2. Deux invités rejoignent depuis leur téléphone
  const alice = connect()
  const bob = connect()
  const aliceAck = await emitAck<any>(alice, 'player:join', { name: 'Alice', avatar: '🦊' })
  const bobAck = await emitAck<any>(bob, 'player:join', { name: 'Bob', avatar: '🐸' })
  assert(aliceAck.ok && bobAck.ok, 'join joueur échoué')

  // 3. Lancement d'un quiz + choix du pack
  const here = path.dirname(fileURLToPath(import.meta.url))
  const packRaw = JSON.parse(readFileSync(path.join(here, '../content/quiz/culture-generale.json'), 'utf8'))
  const q0 = packRaw.questions[0]

  const quizSeen = waitFor<any>(alice, 'session:view', () => true, 'vue quiz chez Alice')
  ;(host as any).emit('host:launch')
  const quizId = (await quizSeen).sessionId

  const hostPicks = waitFor<any>(host, 'session:view', p => p.view.phase === 'pickPack', 'liste des quiz côté host')
  const packs = (await hostPicks).view.packs
  assert(Array.isArray(packs) && packs.length > 0, 'aucun quiz proposé à l’animateur')

  ;(host as any).emit('host:command', { sessionId: quizId, command: { type: 'selectPack', packId: 'culture-generale' } })
  await waitFor<any>(alice, 'session:view', p => p.view.phase === 'question', 'phase question (après le 3-2-1)')

  // 4. Réponses : Alice juste (et la plus rapide), Bob faux → révélation immédiate
  const aliceReveal = waitFor<any>(alice, 'session:view', p => p.view.phase === 'reveal', 'reveal joueur')
  const hostReveal = waitFor<any>(host, 'session:view', p => p.view.phase === 'reveal', 'reveal host')
  // Le classement est diffusé au moment de la révélation : on écoute AVANT de répondre.
  const scoreSeen = waitFor<any>(
    bob,
    'party:snapshot',
    s => (s.players.find((p: any) => p.id === aliceAck.playerId)?.score ?? 0) > 0,
    'score d’Alice dans le classement de la soirée',
  )
  ;(alice as any).emit('player:action', { sessionId: quizId, action: { type: 'answer', choice: q0.correct } })
  ;(bob as any).emit('player:action', {
    sessionId: quizId,
    action: { type: 'answer', choice: (q0.correct + 1) % q0.answers.length },
  })
  const [aliceRv, hostRv] = await Promise.all([aliceReveal, hostReveal])
  assert(aliceRv.view.correct === q0.correct, 'mauvais index de bonne réponse côté joueur')
  assert(
    aliceRv.view.yourPoints > 100 && aliceRv.view.yourPoints <= 200,
    `points de rapidité inattendus : ${aliceRv.view.yourPoints}`,
  )
  const totalAnswers = hostRv.view.counts.reduce((a: number, b: number) => a + b, 0)
  assert(hostRv.view.counts[q0.correct] === 1 && totalAnswers === 2, 'distribution des réponses fausse côté host')
  assert(hostRv.view.fastest?.name === 'Alice', 'le plus rapide devrait être Alice')

  // 5. Le classement de la soirée (ledger) reflète les points gagnés
  const snap = await scoreSeen
  const aliceScore = snap.players.find((p: any) => p.id === aliceAck.playerId)?.score
  assert(
    aliceScore === aliceRv.view.yourPoints,
    `classement soirée à ${aliceScore}, attendu ${aliceRv.view.yourPoints}`,
  )
  assert(snap.session?.id === quizId, 'le snapshot doit exposer la partie en cours')
  assert(snap.session.participantIds.length === 2, '2 participants attendus dans la partie')

  // 6. Question suivante, puis révélation forcée par l'animateur (sans timer)
  ;(host as any).emit('host:command', { sessionId: quizId, command: { type: 'next' } })
  await waitFor<any>(alice, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === 1, 'question 2')
  ;(host as any).emit('host:command', { sessionId: quizId, command: { type: 'next' } })
  await waitFor<any>(host, 'session:view', p => p.view.phase === 'reveal' && p.view.qIndex === 1, 'révélation forcée')

  // 7. Reconnexion : nouveau socket + token → même joueur, et il revoit la partie
  alice.disconnect()
  const alice2 = connect()
  const viewAgain = waitFor<any>(alice2, 'session:view', p => p.sessionId === quizId, 'vue renvoyée après reconnexion')
  const rejoin = await emitAck<any>(alice2, 'player:join', { name: 'Alice', avatar: '🦊', token: aliceAck.token })
  assert(rejoin.ok && rejoin.playerId === aliceAck.playerId, 'la reconnexion par token ne rend pas le même joueur')
  const back = await viewAgain
  assert(back.view.phase === 'reveal', 'Alice devrait retrouver la partie là où elle en est')

  // 8. Fin du quiz : plus de partie en cours dans le snapshot
  const cleared = waitFor<any>(host, 'party:snapshot', s => s.session === null, 'partie soldée dans le snapshot')
  ;(host as any).emit('host:endSession', { sessionId: quizId })
  await cleared

  console.log('✅ Smoke test OK — inscription, quiz, rapidité, classement, reconnexion')
  host.disconnect()
  bob.disconnect()
  alice2.disconnect()
  await server.close()
  process.exit(0)
} catch (e) {
  fail((e as Error).message)
}
