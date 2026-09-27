// Mesure : combien de temps après le podium d'un quiz la ligne d'expérience
// d'un profil arrive-t-elle en base permanente ? Les épreuves d'espaces.test.ts
// l'attendent 500 ms à l'aveugle (`patienter(500)` puis `lignesXp`) — le même
// motif que 89d4260 a retiré d'une autre épreuve du même fichier (« lu 300 ms
// après le podium, il dépendait d'un crédit encore en vol »).
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/tests/mesure-credit.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { attendre, connexionAnimateur, creerQuiz, demarrer, ecranCommun, emitAck, inscrireProfil, invite, lancerQuiz, qcm } from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'

ProfileStore.tirageEclat = () => false

test('le crédit d’un quiz arrive en base combien de millisecondes après son podium', async () => {
  const banc = await demarrer()
  const mesures: number[] = []
  try {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
    const host = await ecranCommun(banc.url, cookie)
    for (let essai = 0; essai < 6; essai++) {
      const profil = await inscrireProfil(banc.url, `p${essai}`, `P${essai}`, '🦊')
      const salle = [await invite(banc.url, `P${essai}`, '', { cookie: profil }), await invite(banc.url, `F${essai}`, '🐻')]
      const sessionId = await lancerQuiz(host, quiz)
      const vue = (pred: (v: any) => boolean, label: string) =>
        attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
      let suivante = vue(v => v.phase === 'question' && v.qIndex === 0, 'Q1')
      for (let q = 0; q < 2; q++) {
        await suivante
        const revelee = vue(v => v.phase === 'reveal' && v.qIndex === q, 'révélation')
        for (const [i, qui] of salle.entries()) {
          await emitAck(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice: i } })
        }
        await revelee
        suivante = q === 0 ? vue(v => v.phase === 'question' && v.qIndex === 1, 'Q2') : vue(v => v.phase === 'finished', 'podium')
        ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
      }
      await suivante
      const t0 = performance.now()
      const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true })
      try {
        const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get(`p${essai}`) as { id: string }).id
        while (!db.prepare(`SELECT 1 FROM profile_xp WHERE profile_id = ? AND soiree_id NOT LIKE '#%'`).get(id)) {
          if (performance.now() - t0 > 10_000) throw new Error('jamais crédité')
          await new Promise(r => setTimeout(r, 2))
        }
      } finally {
        db.close()
      }
      mesures.push(Math.round(performance.now() - t0))
      ;(host as any).emit('host:endSession', { sessionId })
      for (const s of salle) s.socket.close()
    }
    console.log(`[mesure] crédit après le podium, en ms : ${mesures.join(', ')} (max ${Math.max(...mesures)})`)
    assert.ok(mesures.length === 6)
  } finally {
    await banc.close()
  }
})
