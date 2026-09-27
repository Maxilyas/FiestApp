// « C'était un essai » et « Clore la soirée » qui se croisent — deux consoles,
// ou le même animateur qui se ravise pendant que l'effacement attend la base.
//
// Les deux gestes posent `fermeture` sans la lire, et passent l'un derrière
// l'autre dans la file (`enFile`) — mais chacun a lu les journaux AVANT sa
// première attente. La clôture arrivée pendant l'effacement a donc lu la
// soirée entière : elle la réarchive et la recrédite APRÈS que l'essai l'a
// effacée. L'animateur a lu « Essai effacé — rien n'a été gardé ».
//
// Ce que ce test attend (il échoue aujourd'hui) : après un essai effacé, ni
// archive ni expérience pour cette soirée — ou bien la clôture refusée.
//
// Lancer depuis `server/` :
//   nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/concurrence/essai-et-cloture.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Invite,
  type Socket,
} from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

type Reponses = [Invite, number][][]

async function jouerQuiz(host: Socket, quizId: string, questions: Reponses): Promise<string> {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, choice] of questions[q]) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
      assert.equal(ack.ok, true, `réponse ${q + 1} refusée : ${ack.error}`)
    }
    await revelee
    suivante =
      q + 1 < questions.length
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  ;(host as any).emit('host:endSession', { sessionId })
  return sessionId
}

function lire<T = any>(quizDbUrl: string, sql: string, ...args: unknown[]): T[] {
  const db = new Database(quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return db.prepare(sql).all(...args) as T[]
  } finally {
    db.close()
  }
}

test('« C’était un essai » puis « Clore la soirée » sur l’autre console : l’essai ne revient pas', async () => {
  const banc = await demarrer()
  const retirerDOrigine = ProfileStore.prototype.retirerSoireeEntiere
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Q1 ?'), qcm('Q2 ?')], 'Deux')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const tele = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    await jouerQuiz(tele, quiz, [
      [[alice, 0], [bob, 1]],
      [[alice, 0], [bob, 1]],
    ])
    // Le podium a rangé la soirée et crédité Alice.
    for (let i = 0; i < 50 && lire(banc.quizDbUrl, "SELECT 1 FROM profile_xp WHERE soiree_id NOT LIKE '#%'").length === 0; i++) {
      await patienter(100)
    }
    const soiree = lire<{ id: string }>(banc.quizDbUrl, 'SELECT id FROM soirees')[0]?.id
    assert.ok(soiree, 'la soirée aurait dû se ranger après son quiz')

    // L'effacement attend la base permanente, comme en ligne.
    ProfileStore.prototype.retirerSoireeEntiere = async function (...args: Parameters<typeof retirerDOrigine>) {
      await patienter(300)
      return retirerDOrigine.apply(this, args)
    }
    const telephone = await ecranCommun(banc.url, cookie)
    const toastEssai = attendre<any>(tele, 'toast', () => true, 'l’essai effacé', 20_000)
    const toastClose = attendre<any>(telephone, 'toast', () => true, 'la clôture', 20_000)
    ;(tele as any).emit('host:discardParty')
    await patienter(50)
    ;(telephone as any).emit('host:closeParty', { title: 'Finalement, on garde' })
    const [t1, t2] = await Promise.all([toastEssai, toastClose])
    await patienter(500)
    console.log('télé :', t1.message)
    console.log('téléphone :', t2.message)

    const archives = lire(banc.quizDbUrl, 'SELECT id, title FROM soirees WHERE id = ?', soiree)
    const xp = lire(banc.quizDbUrl, 'SELECT profile_id, xp FROM profile_xp WHERE soiree_id = ?', soiree)
    console.log('archive après coup :', JSON.stringify(archives))
    console.log('expérience après coup :', JSON.stringify(xp))
    assert.deepEqual(
      { toastEssai: t1.message, archives: archives.length, lignesDExperience: xp.length },
      { toastEssai: t1.message, archives: 0, lignesDExperience: 0 },
      '« Essai effacé — rien n’a été gardé », et pourtant la soirée est archivée et créditée',
    )
    void ADMIN
  } finally {
    ProfileStore.prototype.retirerSoireeEntiere = retirerDOrigine
    await banc.close()
  }
})
