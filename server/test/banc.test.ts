// Le banc d'essai lui-même : un serveur jetable qui démarre, une question
// jouée de bout en bout, et un redémarrage sur disque effacé qui ne perd rien.
// Si ce fichier casse, tous les autres tests mentent : il passe en premier.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  attendre,
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
} from './banc'

let banc: Banc

before(async () => {
  banc = await demarrer()
})

after(async () => {
  await banc.close()
})

test('une question jouée de bout en bout, puis un réveil sur disque effacé', async () => {
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
  const host = await ecranCommun(banc.url, cookie)
  const alice = await invite(banc.url, 'Alice')

  const sessionId = await lancerQuiz(host, quiz)
  await attendre(alice.socket, 'session:view', (p: any) => p.view.phase === 'question', 'la question')
  const ack = await emitAck(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
  assert.equal(ack.ok, true, 'la réponse d’Alice doit être accusée')

  // Alice est seule : sa réponse déclenche la révélation après le souffle.
  const revelee = await attendre<any>(alice.socket, 'session:view', p => p.view.phase === 'reveal', 'la révélation')
  assert.ok(revelee.view.yourPoints > 100, 'une bonne réponse rapide vaut plus que le socle')
  const points = revelee.view.yourPoints

  ;(host as any).emit('host:endSession', { sessionId })
  // Le miroir distant part en arrière-plan : on lui laisse le temps d'arriver.
  await patienter(400)
  alice.socket.close()
  host.close()

  await banc.redemarrer({ disqueEfface: true })

  const retour = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
  const snap = await instantane<any>(retour, s => s.players.length > 0, 'l’instantané après le réveil')
  const reprise = snap.players.find((p: any) => p.name === 'Alice')
  assert.ok(reprise, 'Alice doit revenir du miroir')
  assert.equal(reprise.score, points, 'avec ses points')
})
