// « Rendre sa place » est un geste comme `player:join` : celui qui le fait
// doit se voir dans la partie dès sa première vue (invariant 4, et
// `server/test/au-geste.test.ts` pour l'arrivée et le réveil).
//
// La fiche d'un téléphone mort AVANT le lancement n'est pas participante :
// la reprise l'y fait entrer (`joinLate`), et sa vue part tout de suite —
// l'instantané qui la compte, lui, attend la fenêtre de regroupement (120 ms
// plus 2 ms par invité). D'ici là, la page lit `iAmIn` faux et affiche
// « tu entres à la prochaine question » par-dessus la question.
//
// Échoue sur b57035c ; passera quand `player:reprendre` enverra l'instantané
// au geste, comme `player:join` (`joinLate(res.id, () => socket.emit(...))`).
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
} from '../../../server/test/banc'

let banc: Banc
let cookie: string
before(async () => {
  banc = await demarrer()
  cookie = await connexionAnimateur(banc.url)
})
after(async () => {
  await banc.close()
})

test('moteur-6 · la place reprise en pleine question se voit dans la partie dès sa première vue', async () => {
  const host = await ecranCommun(banc.url, cookie)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?', ['Oui', 'Non'], 0, 60)], 'Reprise au geste')
  await invite(banc.url, 'Alice', '🦊')
  const rachid = await invite(banc.url, 'Rachid', '🦁')
  // Son téléphone meurt avant le lancement : la fiche ne sera pas de la partie.
  rachid.socket.close()
  await instantane<any>(host, s => s.players.find((p: any) => p.id === rachid.playerId)?.connected === false, 'la veille vue')

  // Le téléphone emprunté : un second Rachid, qui suit la soirée.
  const socket = connecter(banc.url)
  assert.equal((await emitAck<any>(socket, 'party:watch', { slug: ADMIN.slug })).ok, true)
  const second = await emitAck<any>(socket, 'player:join', { slug: ADMIN.slug, name: 'Rachid', avatar: '⚽' })
  assert.equal(second.ok, true)

  const sessionId = await lancerQuiz(host, quiz)
  await attendre<any>(host, 'session:view', p => p.sessionId === sessionId && p.view.phase === 'question', 'la question', 15_000)
  await patienter(400)

  let dernier: any = null
  socket.on('party:snapshot', (s: any) => {
    dernier = s
  })
  const { code } = await emitAck<any>(host, 'host:rendrePlace', { playerId: rachid.playerId })
  let accuse = false
  const premiereVue = new Promise<any>(resolve =>
    socket.on('session:view', (p: any) => {
      if (accuse && p.view.phase === 'question') resolve(dernier)
    }),
  )
  const reprise = await new Promise<any>(resolve =>
    (socket as any).emit('player:reprendre', { slug: ADMIN.slug, code, token: second.token }, (res: any) => {
      accuse = true
      resolve(res)
    }),
  )
  assert.equal(reprise.ok, true, 'la reprise passe')
  assert.equal(reprise.playerId, rachid.playerId)
  const instantaneALaVue = await premiereVue
  assert.ok(
    instantaneALaVue?.session?.participantIds?.includes(rachid.playerId),
    'à sa première vue, le téléphone se sait dans la partie (sinon : « tu entres à la prochaine question »)',
  )
  ;(host as any).emit('host:endSession', { sessionId })
  await patienter(200)
})
