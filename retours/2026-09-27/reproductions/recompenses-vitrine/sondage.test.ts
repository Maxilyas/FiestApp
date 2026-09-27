// Un légendaire porté « remplace l'emoji partout où l'on se voit —
// classements, podiums, écran commun, carte » (RECOMPENSES.md § 5.4).
//
// Sauf au résultat de « Qui dans la salle ? » : `votesDuSondage`
// (server/src/games/quiz.ts) ne rend que le nom, l'emoji et les votes, et la
// télé (`VotesDuSondage`, HostView.tsx) dessine l'emoji nu — ni légendaire,
// ni finition, ni laurier, ni niveau. La salle désigne quelqu'un qu'elle voit
// en médaillon depuis le début de la soirée, et la télé le montre sous un
// visage qu'elle n'a jamais vu.
//
// Ce test passe le jour où les lignes du sondage portent les distinctions,
// comme celles du classement et des estimations (`distinctions(p)`).
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
  ecrire,
  emitAck,
  inscrireProfil,
  instantane,
  invite,
  lancerQuiz,
  qcm,
} from '../../../server/test/banc'

test('« Qui dans la salle ? » montre le légendaire qu’on porte, comme le reste de la soirée', async () => {
  const banc = await demarrer()
  try {
    const hote = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    // Le Phénix, gagné une fois : son légendaire s'ouvre.
    const db = new Database(banc.quizDbUrl.replace(/^file:/, ''))
    try {
      const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, 'hf:phenix', 'ancienne', '', '🔥', 'Le Phénix', 1)`,
      ).run(id)
    } finally {
      db.close()
    }
    await banc.redemarrer()
    assert.equal((await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:phenix' }, alice, 'PUT')).status, 200)

    const quiz = await creerQuiz(banc.url, hote, [{ ...qcm('Qui dans la salle chante le plus faux ?', [], -1, 60), variante: 'sondage' }])
    const a = await invite(banc.url, 'Alice', '', { cookie: alice })
    const b = await invite(banc.url, 'Bob', '🐻')
    const host = await ecranCommun(banc.url, hote)
    const salle = await instantane(b.socket, s => s.players.some((p: any) => p.name === 'Alice' && p.legendaire), 'Alice en Phénix')
    assert.equal(salle.players.find((p: any) => p.name === 'Alice').legendaire, 'lg:phenix', 'toute la salle la voit en Phénix')

    const q = attendre<any>(b.socket, 'session:view', p => p.view.phase === 'question', 'le sondage', 15_000)
    const sessionId = await lancerQuiz(host, quiz)
    const vue = (await q).view
    const qui = vue.answers.indexOf('Alice')
    const revele = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'les votes', 15_000)
    for (const s of [a.socket, b.socket]) {
      const ack = await emitAck<any>(s, 'player:action', { sessionId, action: { type: 'answer', choice: qui, qIndex: 0, round: vue.round } })
      assert.equal(ack.ok, true, ack.error)
    }
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
    const votes = (await revele).view.votes as any[]
    console.log(`[constat] ligne du sondage à la télé : ${JSON.stringify(votes[0])}`)
    assert.equal(votes[0].name, 'Alice')
    assert.equal(votes[0].legendaire, 'lg:phenix', 'la télé la montre sous son emoji caché, pas en Phénix')
    host.close()
  } finally {
    await banc.close()
  }
})
