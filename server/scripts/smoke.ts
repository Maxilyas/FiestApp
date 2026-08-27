// Test de bout en bout : boote un vrai serveur (base jetable) et rejoue le
// parcours complet d'une soirée — inscription, lancement d'un quiz, réponses,
// scoring de rapidité, révélation, classement, reconnexion par token.
// À lancer via `npm run smoke`.
import { io as clientIo, type Socket } from 'socket.io-client'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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

const tmpDir = mkdtempSync(path.join(tmpdir(), 'quizz-smoke-'))
const dbPath = path.join(tmpDir, 'test.db')
const quizDbUrl = `file:${path.join(tmpDir, 'quizzes.db').replace(/\\/g, '/')}`
const server = await createQuizServer({ port: 0, dbPath, hostKey: 'smoke', quizDbUrl })
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

  // 9. Bibliothèque : l'API est protégée par la clé animateur
  const anon = await fetch(`${url}/api/quizzes`)
  assert(anon.status === 401, `l'API doit refuser sans clé (reçu ${anon.status})`)

  const apiCall = (path: string, init?: RequestInit) =>
    fetch(`${url}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'x-quizz-key': 'smoke', ...init?.headers },
    })

  const seeded = (await (await apiCall('/api/quizzes')).json()) as any[]
  assert(
    seeded.some((q: any) => q.id === 'culture-generale'),
    'les quiz JSON livrés doivent être importés dans la bibliothèque',
  )

  // 10. Photos : envoi en dataURL, stockage en base, relecture publique
  //     (les téléphones des invités doivent pouvoir les charger sans clé)
  const TINY_JPEG =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=='
  const upload = (await (
    await apiCall('/api/images', { method: 'POST', body: JSON.stringify({ dataUrl: TINY_JPEG }) })
  ).json()) as any
  assert(upload.url?.startsWith('/media/image/'), `URL d'image inattendue : ${upload.url}`)
  const fetched = await fetch(`${url}${upload.url}`)
  assert(fetched.ok, 'la photo doit être lisible sans clé (les invités la chargent)')
  assert(
    fetched.headers.get('content-type') === 'image/jpeg',
    `type de contenu inattendu : ${fetched.headers.get('content-type')}`,
  )
  const bytes = Buffer.from(await fetched.arrayBuffer())
  assert(
    bytes.equals(Buffer.from(TINY_JPEG.split(',')[1], 'base64')),
    'la photo relue diffère de la photo envoyée',
  )
  const badImage = await apiCall('/api/images', {
    method: 'POST',
    body: JSON.stringify({ dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' }),
  })
  assert(badImage.status === 400, 'un faux fichier image doit être refusé')

  // 11. Création + édition : un brouillon incomplet est conservé, pas jeté
  const created = (await (
    await apiCall('/api/quizzes', { method: 'POST', body: JSON.stringify({ title: 'Spécial Romane' }) })
  ).json()) as any
  assert(created.id, 'création de quiz échouée')

  const saved = (await (
    await apiCall(`/api/quizzes/${created.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: 'Spécial Romane',
        questions: [
          // Réponses vides intercalées : la bonne réponse doit suivre son texte,
          // pas son numéro de case.
          { text: 'Quelle danse ?', answers: ['', 'La salsa', '', 'Le tango'], correct: 1, duration: 15, image: null },
          { text: 'Brouillon pas fini', answers: ['', '', '', ''], correct: 0, duration: 20, image: null },
        ],
      }),
    })
  ).json()) as any
  assert(saved.questions.length === 2, 'le brouillon incomplet doit être conservé tel quel')

  const all = (await (await apiCall('/api/quizzes')).json()) as any[]
  const summary = all.find(q => q.id === created.id)
  assert(
    summary.questionCount === 2 && summary.readyCount === 1,
    `2 questions dont 1 prête attendues, reçu ${summary?.questionCount}/${summary?.readyCount}`,
  )

  // 12. Le quiz créé se joue immédiatement : seule la question prête est posée,
  //     et la bonne réponse est bien « La salsa » une fois les vides retirées
  const quiz2Seen = waitFor<any>(bob, 'session:view', () => true, 'nouvelle partie chez Bob')
  ;(host as any).emit('host:launch')
  const quiz2Id = (await quiz2Seen).sessionId
  ;(host as any).emit('host:command', { sessionId: quiz2Id, command: { type: 'selectPack', packId: created.id } })
  const q2 = await waitFor<any>(bob, 'session:view', p => p.view.phase === 'question', 'question du quiz créé')
  assert(q2.view.qCount === 1, `1 seule question jouable attendue, vu ${q2.view.qCount}`)
  assert(
    JSON.stringify(q2.view.answers) === JSON.stringify(['La salsa', 'Le tango']),
    `réponses vides mal retirées : ${JSON.stringify(q2.view.answers)}`,
  )

  const bobReveal = waitFor<any>(bob, 'session:view', p => p.view.phase === 'reveal', 'reveal du quiz créé')
  ;(bob as any).emit('player:action', { sessionId: quiz2Id, action: { type: 'answer', choice: 0 } })
  ;(alice2 as any).emit('player:action', { sessionId: quiz2Id, action: { type: 'answer', choice: 1 } })
  const rv2 = await bobReveal
  assert(rv2.view.correct === 0, `« La salsa » doit rester la bonne réponse (index reçu : ${rv2.view.correct})`)
  assert(rv2.view.yourPoints > 100, 'Bob a répondu juste, il doit marquer des points')

  // 13. Suppression
  const del = await apiCall(`/api/quizzes/${created.id}`, { method: 'DELETE' })
  assert(del.ok, 'suppression du quiz échouée')
  const after = (await (await apiCall('/api/quizzes')).json()) as any[]
  assert(!after.some((q: any) => q.id === created.id), 'le quiz supprimé ne doit plus être listé')
  ;(host as any).emit('host:endSession', { sessionId: quiz2Id })

  // 14. Question « estimation » : le plus proche empoche le maximum, celui qui
  //     répond quand même marque un minimum, personne n'est bloqué
  const mixed = (await (
    await apiCall('/api/quizzes', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Estimation & retardataire',
        questions: [
          { kind: 'number', text: 'Quel âge fête Romane ?', target: 30, unit: 'ans', duration: 30 },
          {
            kind: 'choice',
            text: 'Quelle danse ?',
            answers: ['La salsa', 'Le tango', '', ''],
            correct: 0,
            duration: 30,
          },
        ],
      }),
    })
  ).json()) as any

  const mixedSeen = waitFor<any>(bob, 'session:view', () => true, 'partie estimation chez Bob')
  ;(host as any).emit('host:launch')
  const mixedId = (await mixedSeen).sessionId
  ;(host as any).emit('host:command', { sessionId: mixedId, command: { type: 'selectPack', packId: mixed.id } })
  const numQ = await waitFor<any>(bob, 'session:view', p => p.view.phase === 'question', 'question estimation')
  assert(numQ.view.kind === 'number', `type de question attendu 'number', reçu ${numQ.view.kind}`)
  assert(numQ.view.unit === 'ans', `unité attendue 'ans', reçue ${numQ.view.unit}`)

  const aliceGuessRv = waitFor<any>(alice2, 'session:view', p => p.view.phase === 'reveal', 'reveal estimation Alice')
  const bobGuessRv = waitFor<any>(bob, 'session:view', p => p.view.phase === 'reveal', 'reveal estimation Bob')
  const hostGuessRv = waitFor<any>(host, 'session:view', p => p.view.phase === 'reveal', 'reveal estimation host')
  ;(alice2 as any).emit('player:action', { sessionId: mixedId, action: { type: 'guess', value: 41 } })
  ;(alice2 as any).emit('player:action', { sessionId: mixedId, action: { type: 'guess', value: 31 } }) // correction
  ;(bob as any).emit('player:action', { sessionId: mixedId, action: { type: 'guess', value: 50 } })
  const [aliceG, bobG, hostG] = await Promise.all([aliceGuessRv, bobGuessRv, hostGuessRv])
  assert(aliceG.view.yourGuess === 31, `la correction doit remplacer la 1re estimation, vu ${aliceG.view.yourGuess}`)
  assert(aliceG.view.yourPoints === 200, `le plus proche marque 200, vu ${aliceG.view.yourPoints}`)
  assert(bobG.view.yourPoints === 30, `le plus loin marque le minimum de participation, vu ${bobG.view.yourPoints}`)
  assert(hostG.view.target === 30, 'la valeur à deviner doit être révélée sur l’écran commun')
  assert(hostG.view.guesses?.[0]?.name === 'Alice', 'Alice doit être en tête des estimations')

  // 15. Retardataire : Charlie arrive en pleine partie et joue la question suivante
  const charlie = connect()
  const charlieView = waitFor<any>(charlie, 'session:view', p => p.sessionId === mixedId, 'vue donnée au retardataire')
  const charlieAck = await emitAck<any>(charlie, 'player:join', { name: 'Charlie', avatar: '🐼' })
  assert(charlieAck.ok, 'join Charlie échoué')
  const charlieFirst = await charlieView
  assert(
    charlieFirst.view.justArrived === true,
    'le retardataire doit être accueilli, pas recevoir un « trop tard » pour une question qu’il n’a pas vue',
  )
  const withCharlie = await waitFor<any>(
    host,
    'party:snapshot',
    s => s.session?.participantIds.includes(charlieAck.playerId),
    'le retardataire doit rejoindre la partie en cours',
  )
  assert(withCharlie.session.participantIds.length === 3, '3 participants attendus après l’arrivée de Charlie')

  ;(host as any).emit('host:command', { sessionId: mixedId, command: { type: 'next' } })
  await waitFor<any>(charlie, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === 1, 'question 2')

  const charlieRv = waitFor<any>(charlie, 'session:view', p => p.view.phase === 'reveal', 'reveal pour Charlie')
  ;(charlie as any).emit('player:action', { sessionId: mixedId, action: { type: 'answer', choice: 0 } })
  ;(bob as any).emit('player:action', { sessionId: mixedId, action: { type: 'answer', choice: 1 } })
  ;(alice2 as any).emit('player:action', { sessionId: mixedId, action: { type: 'answer', choice: 1 } })
  const charlieReveal = await charlieRv
  assert(charlieReveal.view.yourPoints > 100, 'Charlie a répondu juste, il doit marquer des points')
  assert(
    charlieReveal.view.yourQuizTotal === charlieReveal.view.yourPoints,
    'le retardataire ne doit rien récupérer sur la question qu’il a manquée',
  )
  ;(host as any).emit('host:endSession', { sessionId: mixedId })
  charlie.disconnect()

  // 16. Redémarrage du serveur avec disque effacé — le scénario d'un
  //     hébergeur gratuit qui recycle l'instance en pleine soirée. Invités et
  //     points doivent revenir depuis la base distante.
  const before = await waitFor<any>(host, 'party:snapshot', s => s.players.length >= 3, 'classement avant coupure')
  const aliceBefore = before.players.find((p: any) => p.id === aliceAck.playerId)
  assert(aliceBefore?.score > 0, 'Alice devrait avoir des points avant la coupure')

  host.disconnect()
  bob.disconnect()
  alice2.disconnect()
  await server.close()

  // Le disque local disparaît, la base distante reste.
  for (const suffix of ['', '-wal', '-shm']) rmSync(dbPath + suffix, { force: true })

  const server2 = await createQuizServer({
    port: 0,
    dbPath: path.join(tmpDir, 'apres-redemarrage.db'),
    hostKey: 'smoke',
    quizDbUrl,
  })
  const probe = clientIo(`http://localhost:${server2.port}`, { transports: ['websocket'] })
  const after2 = await waitFor<any>(probe, 'party:snapshot', s => s.players.length > 0, 'soirée rechargée')
  const aliceAfter = after2.players.find((p: any) => p.id === aliceAck.playerId)
  assert(
    aliceAfter?.score === aliceBefore.score,
    `score perdu au redémarrage : ${aliceAfter?.score} au lieu de ${aliceBefore.score}`,
  )
  assert(aliceAfter?.name === 'Alice', 'le nom du joueur doit être rechargé lui aussi')
  probe.disconnect()
  await server2.close()

  console.log(
    '✅ Smoke test OK — inscription, quiz, rapidité, classement, reconnexion, bibliothèque, photos, estimation, retardataire, reprise après coupure',
  )
  process.exit(0)
} catch (e) {
  fail((e as Error).message)
}
