// Un haut fait de carrière n'est « gagné » (titre, vitrine) que par son
// palier de bronze : `hautsFaitsGagnes` (shared/hautsfaits.ts) ne regarde que
// `clePalier(h.key, 1)`. Or chaque palier se range sous la soirée qui l'a fait
// tomber, et une soirée retirée de l'historique emporte les siens. Retirer la
// soirée qui portait le bronze laisse l'argent et l'or sur l'étagère — et
// pourtant le titre tombe, la vitrine choisie l'oublie, et le serveur refuse
// de le remettre, alors que la page du profil (qui reconstruit les paliers
// 1..fois, `recompensesDe`) le propose toujours.
//
// Ce test passe le jour où un haut fait de carrière compte « gagné » dès
// qu'il a un palier, quel qu'il soit.
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
  invite,
  lancerQuiz,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { hautsFaitsGagnes } from '../../../shared/hautsfaits'
import { recompensesDe } from '../../../shared/proches'

ProfileStore.tirageEclat = () => false

type Reponses = [Invite, number][][]

async function jouerQuiz(host: Socket, quizId: string, questions: Reponses): Promise<void> {
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
}

async function clore(host: Socket) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', {})
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
}

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

test('le bronze retiré avec sa soirée, l’argent et l’or restent : le haut fait reste gagné — titre et vitrine compris', async () => {
  const banc = await demarrer()
  try {
    const hote = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const quiz = await creerQuiz(banc.url, hote, [qcm('Oui ?', ['Oui', 'Non'], 0)])
    const host = await ecranCommun(banc.url, hote)

    // Deux soirées closes, où Alice joue avec un figurant.
    for (const soir of [1, 2]) {
      const a = await invite(banc.url, 'Alice', '', { cookie: alice })
      const b = await invite(banc.url, `Bob${soir}`, '🐻')
      await jouerQuiz(host, quiz, [[[a, 0], [b, 1]]])
      await clore(host)
      a.socket.close()
      b.socket.close()
    }
    const archives = ((await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any).archives as { id: string; heldAt: number }[]
    assert.equal(archives.length, 2)
    const [s1, s2] = [...archives].sort((x, y) => x.heldAt - y.heldAt).map(a => a.id)

    // Le Bavard, tel qu'`accorderPaliers` le range : le bronze tombé à la
    // première soirée, l'argent à la seconde.
    const db = new Database(permanente(banc))
    try {
      const id = (db.prepare('SELECT id FROM profiles WHERE login = ?').get('alice') as { id: string }).id
      const espace = (db.prepare('SELECT id FROM accounts WHERE slug = ?').get(ADMIN.slug) as { id: string }).id
      const palier = db.prepare(
        `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at) VALUES (?, ?, ?, ?, '💬', ?, ?)`,
      )
      palier.run(id, 'hf:bavard:1', s1, espace, 'Le Bavard · Bronze', 1)
      palier.run(id, 'hf:bavard:2', s2, espace, 'Le Bavard · Argent', 2)
    } finally {
      db.close()
    }
    await banc.redemarrer()

    const moi = async () => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: alice } })).json()) as any).profile
    const porter = (corps: object) => ecrire(banc.url, '/api/joueur/moi', corps, alice, 'PUT')
    assert.equal((await porter({ titre: 'hf:bavard', vitrine: ['hf:bavard'] })).status, 200)
    assert.equal((await moi()).titre, 'hf:bavard')

    // L'animateur retire la première soirée de l'historique : elle emporte
    // le bronze. L'argent, tombé à la seconde, reste.
    const retrait = await fetch(`${banc.url}/api/soirees/${encodeURIComponent(s1)}`, {
      method: 'DELETE',
      headers: { Cookie: (await connexionAnimateur(banc.url)), 'X-Requested-With': 'quizz' },
    })
    assert.equal(retrait.status, 200)

    const apres = await moi()
    const bavard = apres.hautsFaits.find((h: any) => h.key === 'hf:bavard')
    assert.equal(bavard.fois, 2, 'sa page montre toujours Le Bavard · Argent')
    assert.ok(apres.vitrine.some((b: any) => b.key === 'hf:bavard:2'), 'son étagère aussi')
    // La page propose toujours ce titre : elle reconstruit les paliers 1..2.
    assert.ok(hautsFaitsGagnes(recompensesDe(apres.hautsFaits)).includes('hf:bavard'), 'la page le propose')

    // Ce qui casse aujourd'hui : le serveur le tient pour « pas gagné ».
    const essai = await porter({ titre: 'hf:bavard' })
    console.log(
      `[constat] titre=${JSON.stringify(apres.titre)} vitrineChoisie=${JSON.stringify(apres.vitrineChoisie)} ` +
        `étagère=${JSON.stringify(apres.vitrine.map((b: any) => b.key))} PUT titre → ${essai.status} ${JSON.stringify(await essai.json())}`,
    )
    assert.equal(apres.titre, 'hf:bavard', 'le titre de Le Bavard tient tant qu’un palier reste')
    assert.deepEqual(apres.vitrineChoisie, ['hf:bavard'], 'la vitrine choisie le garde')
    const remettre = await porter({ titre: 'hf:bavard' })
    assert.equal(remettre.status, 200, `le serveur refuse ce que la page propose : ${JSON.stringify(await remettre.json())}`)
    host.close()
  } finally {
    await banc.close()
  }
})
