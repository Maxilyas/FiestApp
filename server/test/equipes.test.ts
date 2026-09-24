// Créer les équipes d'un coup, au nombre qu'on veut.
//
// Chez Nadia, le 24 septembre : sept invités, et un seul bouton — « Créer les
// 6 équipes d'un coup ». Six équipes pour sept, c'est une soirée en solo
// déguisée. Le nombre se règle maintenant (de deux à six) ; une page d'avant,
// qui n'envoie rien, en crée toujours six.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  attendre,
  connecter,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  instantane,
  invite,
  lancerQuiz,
  qcm,
  type Banc,
  type Socket,
} from './banc'

const bancs: Banc[] = []
after(async () => {
  for (const banc of bancs) await banc.close()
})

/** Crée les équipes par le geste de la console, puis rend ce que la salle voit. */
async function semer(host: Socket, charge: unknown, attendu: number): Promise<any[]> {
  ;(host as any).emit('host:seedTeams', charge)
  const snap = await instantane<any>(host, s => s.teams.length === attendu, `${attendu} équipes`)
  return snap.teams
}

/** Retire toutes les équipes, pour repartir d'un écran vierge. */
async function toutRetirer(host: Socket, equipes: any[]) {
  for (const t of equipes) (host as any).emit('host:removeTeam', { teamId: t.id })
  await instantane<any>(host, s => s.teams.length === 0, 'plus aucune équipe')
}

test('le nombre d’équipes créées d’un coup se règle, de deux à six', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const host = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
  await instantane(host)

  const trois = await semer(host, { count: 3 }, 3)
  assert.deepEqual(
    trois.map(t => t.name),
    ['Les Salseras', 'Les Rumberos', 'Les Micros'],
    'les premières équipes par défaut, dans l’ordre',
  )
  await toutRetirer(host, trois)

  // Une page d'avant n'envoie rien : les six, comme avant.
  await toutRetirer(host, await semer(host, undefined, 6))
  // Un nombre absurde est ramené dans les bornes, jamais refusé en silence.
  await toutRetirer(host, await semer(host, { count: 99 }, 6))
  await toutRetirer(host, await semer(host, { count: 1 }, 2))
  await toutRetirer(host, await semer(host, { count: 'quatre' }, 6))
})

test('le retardataire entre avec son équipe en pleine question : ses points comptent au podium, et le verdict ne bouge plus ensuite', async () => {
  // Chez Nadia, le 24 septembre : Karim, entré sans équipe pendant un quiz
  // (l'entrée sautait l'écran d'équipe), a vu le podium couronner les
  // Salseras, puis a rejoint les Rumberos en salle d'attente — et les
  // Rumberos ont gagné le quiz qu'ils venaient de perdre. L'entrée lui
  // propose de nouveau son équipe pendant un quiz : le serveur doit
  // l'accepter dès `player:join`, puisque `player:setTeam` est refusé
  // jusqu'à la fin.
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const host = await ecranCommun(banc.url, cookie)
  await instantane(host)
  const [salseras, rumberos] = await semer(host, { count: 2 }, 2)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Première ?'), qcm('Seconde ?')])

  const alice = await invite(banc.url, 'Alice')
  const bob = await invite(banc.url, 'Bob')
  assert.equal((await emitAck<any>(alice.socket, 'player:setTeam', { teamId: salseras.id })).ok, true)
  assert.equal((await emitAck<any>(bob.socket, 'player:setTeam', { teamId: rumberos.id })).ok, true)

  const sessionId = await lancerQuiz(host, quiz)
  const question = (qui: Socket, q: number) =>
    attendre<any>(qui, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === q, `la question ${q + 1}`)
  const repondre = async (qui: Socket, choice: number, v: any) =>
    assert.equal(
      (await emitAck<any>(qui, 'player:action', { sessionId, action: { type: 'answer', choice, qIndex: v.qIndex, round: v.round } })).ok,
      true,
    )

  const q1 = (await question(alice.socket, 0)).view
  // Karim arrive en pleine question, et choisit son équipe à l'entrée.
  const karimSocket = connecter(banc.url)
  assert.equal((await emitAck<any>(karimSocket, 'party:watch', { slug: ADMIN.slug })).ok, true)
  const karim = await emitAck<any>(karimSocket, 'player:join', { slug: ADMIN.slug, name: 'Karim', avatar: '🐯', teamId: rumberos.id })
  assert.equal(karim.ok, true, 'entrer avec son équipe pendant un quiz est permis')
  const avecEquipe = await instantane<any>(host, s => s.players.some((p: any) => p.name === 'Karim'), 'Karim dans la salle')
  assert.equal(avecEquipe.players.find((p: any) => p.name === 'Karim').teamId, rumberos.id)
  // Changer d'équipe, lui, reste refusé jusqu'à la fin du quiz.
  assert.equal((await emitAck<any>(karimSocket, 'player:setTeam', { teamId: salseras.id })).ok, false)

  // Il entre dans la question en cours (`joinLate`) : il y répond, comme les autres.
  const q2Karim = question(karimSocket, 1)
  await repondre(karimSocket, 1, q1)
  await repondre(alice.socket, 0, q1)
  await repondre(bob.socket, 1, q1)
  await attendre(host, 'session:view', p => p.view.phase === 'reveal', 'la révélation de la première')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })

  const q2 = (await q2Karim).view
  await repondre(karimSocket, 0, q2)
  await repondre(alice.socket, 1, q2)
  await repondre(bob.socket, 0, q2)
  await attendre(host, 'session:view', p => p.view.phase === 'reveal' && p.view.qIndex === 1, 'la révélation de la seconde')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  await attendre(host, 'session:view', p => p.view.phase === 'finished', 'le podium du quiz')

  const tete = (s: any) => [...s.teams].sort((a: any, b: any) => b.average - a.average)[0].id
  const auPodium = await instantane<any>(host, s => {
    const k = s.players.find((p: any) => p.name === 'Karim')
    return !!k && k.score > 0
  }, 'les points de Karim')
  const karimAuPodium = auPodium.players.find((p: any) => p.name === 'Karim')
  const bobAuPodium = auPodium.players.find((p: any) => p.name === 'Bob')
  const equipeR = auPodium.teams.find((t: any) => t.id === rumberos.id)
  assert.equal(equipeR.total, karimAuPodium.score + bobAuPodium.score, 'les points de Karim comptent pour les Rumberos dès le podium')
  const verdict = tete(auPodium)

  // La partie se referme : plus rien à rejoindre, rien ne se retourne.
  ;(host as any).emit('host:endSession', { sessionId })
  const apres = await instantane<any>(host, s => !s.session, 'la salle d’attente')
  assert.equal(tete(apres), verdict, 'le vainqueur annoncé au podium reste le vainqueur')
  assert.equal(apres.players.find((p: any) => p.name === 'Karim').teamId, rumberos.id)
})
