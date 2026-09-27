// Un invité qui scanne le QR pendant que la soirée se clôt.
//
// La clôture lit la salle AVANT sa première attente, puis attend la base
// permanente (l'archive, les crédits : des secondes à cent profils) ; la
// télé montre encore le QR. Qui entre pendant ce temps est inscrit dans la
// soirée qu'on clôt : `viderSoiree` l'efface avec elle, et comme la raison
// est « close », son téléphone est détaché sans un mot — ni fin de soirée
// (il n'était pas dans la salle lue au départ), ni `party:reset`. Il reste
// sur une salle d'attente dont il ne fait plus partie.
//
// Ce que ce test attend (il échoue aujourd'hui) : le téléphone de l'invité
// arrivé pendant la clôture est soit gardé pour la soirée suivante, soit
// renvoyé à l'entrée (`party:reset`, `player:removed` ou sa fin de soirée).
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/entree-pendant-la-cloture.test.ts
import { test } from 'node:test'
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
  type Invite,
  type Socket,
} from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { ArchiveStore } from '../../../server/src/core/archive'

ProfileStore.tirageEclat = () => false

async function jouerUneQuestion(host: Socket, quizId: string, salle: [Invite, number][]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  await vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la question')
  const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
  for (const [qui, choice] of salle) {
    await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
  }
  await revelee
  ;(host as any).emit('host:endSession', { sessionId })
}

test('entré pendant la clôture : gardé pour la suite, ou renvoyé à l’entrée — jamais oublié en silence', async () => {
  const banc = await demarrer()
  const saveDOrigine = ArchiveStore.prototype.save
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Q1 ?')], 'Une')
    const tele = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊')
    const bob = await invite(banc.url, 'Bob', '🐻')
    await jouerUneQuestion(tele, quiz, [
      [alice, 0],
      [bob, 1],
    ])
    await patienter(500)

    // L'archivage de la clôture attend la base permanente, comme en ligne.
    let entre!: () => void
    const archivageEnCours = new Promise<void>(r => (entre = r))
    ArchiveStore.prototype.save = async function (...args: Parameters<typeof saveDOrigine>) {
      entre()
      await patienter(400)
      return saveDOrigine.apply(this, args)
    }
    const toast = attendre<any>(tele, 'toast', () => true, 'la clôture', 20_000)
    ;(tele as any).emit('host:closeParty', { title: 'Fin' })
    await archivageEnCours

    // Zoé scanne le QR que la télé montre encore.
    const zoe = await invite(banc.url, 'Zoé', '🦋')
    const recus: string[] = []
    for (const ev of ['soiree:fin', 'party:reset', 'player:removed']) zoe.socket.on(ev, () => recus.push(ev))
    const t = await toast
    await patienter(800)
    const salle = await instantane(tele, () => true)
    const noms = salle.players.map((p: any) => p.name)
    console.log('clôture :', t.message)
    console.log('salle de la soirée suivante :', JSON.stringify(noms))
    console.log('reçu par le téléphone de Zoé :', JSON.stringify(recus))
    // Son téléphone croit toujours jouer : une réponse, un changement d'équipe…
    const equipe = await emitAck<any>(zoe.socket, 'player:setTeam', { teamId: null })
    console.log('Zoé change d’équipe :', JSON.stringify(equipe))

    assert.ok(
      noms.includes('Zoé') || recus.length > 0,
      'Zoé, entrée pendant la clôture, a été effacée sans que son téléphone le sache',
    )
  } finally {
    ArchiveStore.prototype.save = saveDOrigine
    await banc.close()
  }
})
