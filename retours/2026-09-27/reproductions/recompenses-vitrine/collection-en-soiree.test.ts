// Un emoji de collection ne se porte qu'au niveau qui l'ouvre, « relu à
// chaque affichage » (`avatarPorte`) : une soirée retirée qui fait
// redescendre le profil le lui reprend, sans rien réécrire.
//
// Sauf dans la soirée où il joue : l'avatar d'un invité est recopié dans sa
// fiche (`Party`) au `player:join`, et plus rien ne le relit. Alice entre
// avec le paon (niveau 2) ; l'animateur retire de l'historique la soirée qui
// lui avait donné ce niveau ; Alice redescend au niveau 1 — sa page montre
// 🎉 — mais toute la salle, la télé et sa carte montrent toujours le paon, à
// côté de « Niv. 1 ».
//
// Ce test passe le jour où l'avatar qu'on montre d'un invité à profil se
// relit au niveau du profil, comme partout ailleurs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  inscrireProfil,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Invite,
  type Socket,
} from '../../../server/test/banc'
import { ProfileStore } from '../../../server/src/auth/profiles'
import { niveauRequis } from '../../../shared/avatars'

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

test('le niveau redescend en pleine soirée : la salle ne montre plus un emoji de collection qu’il n’ouvre plus', async () => {
  const banc = await demarrer()
  try {
    const hote = await connexionAnimateur(banc.url)
    const alice = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const moi = async () => ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: alice } })).json()) as any).profile
    const host = await ecranCommun(banc.url, hote)

    // Première soirée : dix bonnes réponses, le podium, le sans-faute — le
    // niveau 2, et le paon avec lui.
    const quiz = await creerQuiz(banc.url, hote, Array.from({ length: 10 }, (_, i) => qcm(`Question ${i + 1}`, ['Oui', 'Non'], 0)))
    const a1 = await invite(banc.url, 'Alice', '', { cookie: alice })
    const b1 = await invite(banc.url, 'Bob', '🐻')
    await jouerQuiz(host, quiz, Array.from({ length: 10 }, () => [[a1, 0], [b1, 1]] as [Invite, number][]))
    await clore(host)
    a1.socket.close()
    b1.socket.close()
    const s1 = (((await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any).archives as { id: string }[])[0].id
    assert.equal((await moi()).niveau, 2, 'le niveau 2 après la première soirée')

    // Seconde soirée : Alice entre avec le paon, qu'elle vient d'ouvrir.
    const zoe = await invite(banc.url, 'Zoé', '🐸')
    const a2 = await invite(banc.url, 'Alice', '🦚', { cookie: alice })
    const avant = await instantane(zoe.socket, s => s.players.some((p: any) => p.name === 'Alice'), 'Alice dans la salle')
    const aliceAvant = avant.players.find((p: any) => p.name === 'Alice')
    assert.equal(aliceAvant.avatar, '🦚')
    assert.equal(aliceAvant.niveau, 2)

    // L'animateur retire la première soirée de l'historique : elle emporte
    // l'expérience qu'elle avait donnée. Alice redescend au niveau 1.
    const retrait = await fetch(`${banc.url}/api/soirees/${encodeURIComponent(s1)}`, {
      method: 'DELETE',
      headers: { Cookie: hote, 'X-Requested-With': 'quizz' },
    })
    assert.equal(retrait.status, 200)
    const page = await moi()
    assert.equal(page.niveau, 1)
    assert.notEqual(page.avatar, '🦚', 'sa page ne montre plus le paon (avatarPorte)')

    // Quelqu'un arrive : la salle se rediffuse, niveau d'Alice compris.
    await invite(banc.url, 'Yann', '🐙')
    const apres = await instantane(
      zoe.socket,
      s => s.players.some((p: any) => p.name === 'Yann') && s.players.some((p: any) => p.name === 'Alice' && p.niveau === 1),
      'Alice redescendue au niveau 1',
    )
    const aliceApres = apres.players.find((p: any) => p.name === 'Alice')
    const carte = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${a2.playerId}.json`)).json()) as any
    console.log(
      `[constat] page du profil : niveau ${page.niveau}, avatar ${page.avatar} · salle : niveau ${aliceApres.niveau}, avatar ${aliceApres.avatar} · carte : niveau ${carte.profil?.niveau}, avatar ${carte.avatar}`,
    )
    assert.ok(
      niveauRequis(aliceApres.avatar) <= aliceApres.niveau,
      `la salle montre ${aliceApres.avatar} (niveau ${niveauRequis(aliceApres.avatar)}) à côté de « Niv. ${aliceApres.niveau} »`,
    )
    assert.ok(niveauRequis(carte.avatar) <= carte.profil.niveau, `sa carte aussi : ${carte.avatar}`)
    host.close()
  } finally {
    await banc.close()
  }
})
