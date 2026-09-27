// Retirer de l'historique la soirée où un palier est tombé reprend le palier
// (invariant 10)… même quand les soirées qui restent le méritent encore. Il
// ne revient qu'à la clôture suivante, qui le fête comme neuf ; d'ici là, la
// page du profil montre sa jauge pleine sans le palier — et un légendaire
// qui en dépend (le Renard Lunaire, la Comète) ne se porte plus.
//
// cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/recompenses-comptes/palier-retire.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

async function jouerUneQuestion(host: Socket, quizId: string, reponses: [Invite, number][]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  await vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la question')
  const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
  for (const [qui, choice] of reponses) {
    const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
    assert.equal(ack.ok, true, ack.error)
  }
  await revelee
  const podium = vue(sessionId, v => v.phase === 'finished', 'le podium')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await podium
  ;(host as any).emit('host:endSession', { sessionId })
}

/** Une soirée d'une question, Alice et un figurant, close : rend la fin de soirée d'Alice. */
async function soiree(banc: Banc, host: Socket, quizId: string, aliceCookie: string) {
  const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
  const fig = await invite(banc.url, 'Fig', '🐻')
  await jouerUneQuestion(host, quizId, [
    [alice, 0],
    [fig, 1],
  ])
  await patienter(300)
  const fin = attendre<any>(alice.socket, 'soiree:fin', () => true, 'la fin de soirée d’Alice', 20_000)
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 20_000)
  ;(host as any).emit('host:closeParty', {})
  assert.equal((await toast).kind, 'info')
  return fin
}

const habitue = async (banc: Banc, cookie: string) => {
  const profil = ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile
  const h = profil.hautsFaits.find((x: any) => x.key === 'hf:habitue')
  return { palier: h.fois as number, soirees: h.valeur as number }
}

test('retirer la soirée où L’Habitué est tombé : les trois soirées qui restent le méritent encore', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)

    await soiree(banc, host, quiz, aliceCookie)
    await soiree(banc, host, quiz, aliceCookie)
    const troisieme = await soiree(banc, host, quiz, aliceCookie)
    assert.deepEqual(
      troisieme.profil.paliers.map((p: any) => p.key),
      ['hf:habitue:1'],
      'L’Habitué · Bronze tombe à la troisième soirée',
    )
    await soiree(banc, host, quiz, aliceCookie)
    assert.deepEqual(await habitue(banc, aliceCookie), { palier: 1, soirees: 4 })

    // L'animateur retire la troisième de son historique (un doublon, un test…).
    const retrait = await ecrire(banc.url, `/api/soirees/${troisieme.soiree.id}`, {}, cookie, 'DELETE')
    assert.equal(retrait.status, 200)
    const apres = await habitue(banc, aliceCookie)
    assert.equal(apres.soirees, 3, 'il lui reste trois soirées qui comptent')

    // La soirée suivante — rien de neuf pour L'Habitué : 4 soirées, le bronze est à 3, l'argent à 10.
    const cinquieme = await soiree(banc, host, quiz, aliceCookie)
    assert.deepEqual(
      { palierApresRetrait: apres.palier, refeteALaSuivante: cinquieme.profil.paliers.map((p: any) => p.key) },
      { palierApresRetrait: 1, refeteALaSuivante: [] },
      'trois soirées méritent encore L’Habitué · Bronze, et la soirée suivante ne le fête pas comme neuf',
    )
  } finally {
    await banc.close()
  }
})
