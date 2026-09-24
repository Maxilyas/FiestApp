// Deux soirées de deux espaces sous le MÊME nom : l'expérience d'un profil
// qui joue les deux se perd.
//
// Le nom d'une soirée (`archiveIdOf`, core/archive.ts) ne dépend que de
// l'heure d'arrivée de son premier invité, à la milliseconde : il ne porte
// pas l'espace. Les archives, elles, sont rangées par (space_id, id) — mais
// l'expérience d'un profil l'est par (profile_id, soiree_id) seulement
// (`profile_xp`, auth/profiles.ts), et l'Éclat d'une soirée s'efface par
// `soiree_id` seul. Deux espaces dont le premier invité arrive à la même
// milliseconde ont donc une ligne d'expérience en commun.
//
// Pour la rejouer à coup sûr, on fige l'horloge le temps que les deux premiers
// invités arrivent — c'est ce qu'une vraie salle ne fait qu'une fois sur des
// millions, mais que n'importe quel script qui entre dans deux soirées vides
// en même temps fait à volonté.
//
//   cd server && node --import tsx ../retours/2026-09-24/experts/scripts/robustesse-espaces/collision.ts
import { ProfileStore } from '../../../../../server/src/auth/profiles'
import {
  ADMIN,
  attendre,
  bilan,
  connexionAnimateur,
  creerQuiz,
  ecranCommun,
  emitAck,
  espace,
  essai,
  eteindre,
  inscrireProfil,
  invite,
  lancerQuiz,
  lire,
  patienter,
  qcm,
  serveur,
  type Invite,
  type Socket,
} from './commun'

ProfileStore.tirageEclat = () => false

const { server, url, quizDbUrl } = await serveur('collision')
const sockets: Socket[] = []

async function jouer(host: Socket, quizId: string, reponses: [Invite, number][]) {
  const vue = (sid: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sid && pred(p.view), label, 20_000)
  const sid = await lancerQuiz(host, quizId)
  for (let q = 0; q < 2; q++) {
    await vue(sid, v => v.phase === 'question' && v.qIndex === q, `question ${q + 1}`)
    const revelee = vue(sid, v => v.phase === 'reveal' && v.qIndex === q, `révélation ${q + 1}`)
    for (const [qui, choice] of reponses) await emitAck(qui.socket, 'player:action', { sessionId: sid, action: { type: 'answer', choice } })
    await revelee
    ;(host as any).emit('host:command', { sessionId: sid, command: { type: 'next' } })
  }
  await vue(sid, v => v.phase === 'finished', 'le podium')
  ;(host as any).emit('host:endSession', { sessionId: sid })
}
const clore = async (host: Socket) => {
  const t = attendre<any>(host, 'toast', () => true, 'la clôture', 20_000)
  ;(host as any).emit('host:closeParty', {})
  return (await t).message
}

try {
  const A = { cookie: await connexionAnimateur(url), slug: ADMIN.slug }
  const B = await espace(url, 'bruno', 'chez-bruno', 'Bruno')
  const paula = await inscrireProfil(url, 'paula', 'Paula', '🦉')
  const P = String((await lire(quizDbUrl, "SELECT id FROM profiles WHERE login = 'paula'"))[0].id)
  const hA = await ecranCommun(url, A.cookie)
  const hB = await ecranCommun(url, B.cookie)
  sockets.push(hA, hB)
  const qA = await creerQuiz(url, A.cookie, [qcm('A1'), qcm('A2')])
  const qB = await creerQuiz(url, B.cookie, [qcm('B1'), qcm('B2')])

  // Les deux premiers invités, à la même milliseconde.
  const vrai = Date.now
  const T = vrai()
  Date.now = () => T
  const [tA, tB] = await Promise.all([invite(url, 'Témoin', '🐻', { slug: A.slug }), invite(url, 'Témoin', '🐻', { slug: B.slug })])
  Date.now = vrai
  const pA = await invite(url, 'Paula', '🦉', { slug: A.slug, cookie: paula })
  const pB = await invite(url, 'Paula', '🦉', { slug: B.slug, cookie: paula })
  sockets.push(tA.socket, tB.socket, pA.socket, pB.socket)

  // Chez A, Paula trouve tout ; chez B, elle se trompe.
  await jouer(hA, qA, [[pA, 0], [tA, 1]])
  await patienter(1000)
  const apresA = await lire(quizDbUrl, "SELECT soiree_id, space_id, xp FROM profile_xp WHERE profile_id = ? AND soiree_id != '#paliers'", [P])
  await jouer(hB, qB, [[pB, 1], [tB, 0]])
  await patienter(1000)
  const apresB = await lire(quizDbUrl, "SELECT soiree_id, space_id, xp FROM profile_xp WHERE profile_id = ? AND soiree_id != '#paliers'", [P])
  console.log('   après le quiz de A :', JSON.stringify(apresA))
  console.log('   après le quiz de B :', JSON.stringify(apresB))

  console.log('   clôtures :', await clore(hA), '|', await clore(hB))
  await patienter(1000)
  const fin = await lire(quizDbUrl, "SELECT soiree_id, space_id, xp FROM profile_xp WHERE profile_id = ? AND soiree_id != '#paliers'", [P])
  const archives = await lire(quizDbUrl, 'SELECT space_id, id FROM soirees ORDER BY space_id')
  console.log('   après les deux clôtures :', JSON.stringify(fin))
  console.log('   archives :', JSON.stringify(archives))
  essai('même nom — les deux archives existent, une par espace (témoin)', archives.length === 2 && archives[0].id === archives[1].id, archives[0]?.id)
  essai('même nom — Paula garde une ligne d’expérience par soirée jouée', fin.length === 2, `${fin.length} ligne(s) : ${fin.map(l => `${l.xp} xp rangés sous l’espace ${l.space_id === apresA[0]?.space_id ? 'A' : 'B'}`).join(', ')}`)
} finally {
  for (const s of sockets) s.close()
  await eteindre(server)
}
process.exit(bilan() > 0 ? 1 : 0)
