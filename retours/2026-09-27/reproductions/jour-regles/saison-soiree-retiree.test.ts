// Une saison se gagne par l'une ou l'autre voie : trois jours de quiz du jour
// dans la période, ou une soirée qui compte ces jours-là (RECOMPENSES.md,
// « l'une des deux suffit »). Mais le quiz du jour ne range sa saison que si
// le profil ne l'a pas déjà (`ProfileStore.accorderSaison`,
// server/src/auth/profiles.ts:1503) — sous le nom de la soirée, s'il l'a eue
// en soirée. Retirer ensuite cette soirée de l'historique emporte la
// Citrouille, alors que ses trois jours de quiz du jour la lui donnaient
// aussi ; et la période passée, rien ne la lui rend.
//
//   cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//     ../export/evaluations/jour-regles/saison-soiree-retiree.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  attendre,
  connexionAnimateur,
  creerQuiz,
  ecrire,
  ecranCommun,
  emitAck,
  inscrireProfil,
  invite,
  lancerQuiz,
  qcm,
  type Invite,
  type Socket,
} from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { avecBanc, base, idDe, jouer, lire } from './outils'

ProfileStore.tirageEclat = () => false

/** Un quiz d'une question, que tous les invités jouent, puis que l'écran commun termine (saisons.test.ts). */
async function jouerUneQuestion(host: Socket, quizId: string, salle: Invite[]) {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  await vue(sessionId, v => v.phase === 'question', 'la question')
  const revelee = vue(sessionId, v => v.phase === 'reveal', 'la révélation')
  for (const qui of salle) {
    const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0 } })
    assert.equal(ack.ok, true, ack.error)
  }
  await revelee
  const podium = vue(sessionId, v => v.phase === 'finished', 'le podium')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await podium
  ;(host as any).emit('host:endSession', { sessionId })
}

test('la Citrouille gagnée des deux façons : retirer la soirée emporte aussi ce que les trois jours de quiz du jour donnaient', () =>
  avecBanc(
    async (banc, horloge) => {
      const cookie = await connexionAnimateur(banc.url)
      const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?')])
      const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')

      // Une soirée à deux, datée du soir d'Halloween (comme saisons.test.ts), puis close.
      let host = await ecranCommun(banc.url, cookie)
      const salle = [await invite(banc.url, 'Alice', '', { cookie: alice }), await invite(banc.url, 'Bob', '🐻')]
      await jouerUneQuestion(host, quiz, salle)
      host.close()
      for (const s of salle) s.socket.close()
      const db = new Database(banc.dbPath)
      db.prepare('UPDATE answer_log SET created_at = ?').run(Date.UTC(2026, 9, 30, 20, 0))
      db.close()
      await banc.redemarrer()
      host = await ecranCommun(banc.url, cookie)
      const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
      ;(host as any).emit('host:closeParty', {})
      assert.equal((await toast).kind, 'info')
      host.close()
      assert.ok((await lire(banc, alice, '/api/joueur/moi')).corps.profile.legendaires.includes('lg:citrouille'), 'la soirée l’a ouverte')

      // Trois jours de quiz du jour pendant Halloween : le 29, le 30 (en base), et le 31, joué.
      base(banc, d => {
        const insert = d.prepare(
          `INSERT INTO jour_parties (profile_id, jour, commencee_le, question, servie_le, points, justes, finie_le, xp)
           VALUES (?, ?, 1, 10, NULL, 0, 0, 1, 0)`,
        )
        for (const jour of ['2026-10-29', '2026-10-30']) insert.run(idDe(banc, 'alice'), jour)
      })
      await jouer(banc, horloge, alice, () => true)
      const saisons = base(banc, d => d.prepare(`SELECT soiree_id FROM profile_badges WHERE badge = 'saison:halloween'`).all()) as { soiree_id: string }[]
      console.log('[saison] rangées sous :', JSON.stringify(saisons.map(s => s.soiree_id)))

      // Le 5 novembre, l'animatrice retire la soirée de l'historique (c'était un essai).
      horloge.t = Date.UTC(2026, 10, 5, 9, 0)
      const soiree = saisons.find(s => !s.soiree_id.startsWith('#'))!.soiree_id
      const retrait = await ecrire(banc.url, `/api/soirees/${encodeURIComponent(soiree)}`, {}, cookie, 'DELETE')
      assert.equal(retrait.status, 200)
      const apres = (await lire(banc, alice, '/api/joueur/moi')).corps.profile
      const jours = base(banc, d => d.prepare(`SELECT COUNT(*) AS n FROM jour_parties WHERE profile_id = ? AND jour BETWEEN '2026-10-25' AND '2026-11-01'`).get(idDe(banc, 'alice'))) as { n: number }
      console.log(`[saison] après le retrait : ${jours.n} jours de quiz du jour pendant Halloween ; légendaires : ${JSON.stringify(apres.legendaires)}`)
      assert.ok(apres.legendaires.includes('lg:citrouille'), 'ses trois jours de quiz du jour pendant Halloween suffisent')
    },
    Date.UTC(2026, 9, 31, 9, 0),
  ))
