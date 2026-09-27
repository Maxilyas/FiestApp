// Le fantôme qui pèse sur son équipe (rapport de la mission « moteur »).
//
// Le 24 septembre, le Rachid au téléphone mort « dilue l'équipe Commercial,
// dont la moyenne tombe de 743 à 557 » (retours/2026-09-24/verification/
// salons-marc-lea.md, constat 3). Depuis, « Ne plus l'attendre » et « Rendre
// sa place » (#49) règlent l'attente et la reprise — mais la fiche qu'on
// n'attend plus, et le second Rachid « laissé » après la reprise (la même
// personne, qui joue désormais sous l'autre fiche), restent participants : à
// chaque question, `logQuestion` leur écrit une ligne « présent, sans
// réponse, 0 point » sous leur équipe, et la moyenne au prorata les compte.
//
// Cette épreuve échoue sur le code du 26 septembre (b57035c) ; elle passera
// le jour où une fiche qu'on n'attend plus, et qui ne répond pas, ne compte
// plus parmi les présents de la question.
import { after, before, test } from 'node:test'
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
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from '../../../server/test/banc'

const SLUG = ADMIN.slug
let banc: Banc
let cookie: string

before(async () => {
  banc = await demarrer()
  cookie = await connexionAnimateur(banc.url)
})
after(async () => {
  await banc.close()
})

const envoyer = (s: Socket, event: string, ...args: unknown[]) => (s as any).emit(event, ...args)
const vue = (s: Socket, pred: (v: any) => boolean, label: string) =>
  attendre<any>(s, 'session:view', p => pred(p.view), label).then(p => p.view)
const repondre = (i: Invite, sessionId: string, v: any, choice: number) =>
  emitAck<any>(i.socket, 'player:action', {
    sessionId,
    action: { type: 'answer', choice, qIndex: v.qIndex, round: v.round },
    slug: SLUG,
    token: i.token,
  })
const suivante = (host: Socket, sessionId: string, v: any) =>
  envoyer(host, 'host:command', { sessionId, command: { type: 'next', phase: v.phase, qIndex: v.qIndex, round: v.round } })

/** Un invité qui entre avec son équipe, comme l'écran d'entrée d'un retardataire. */
async function entrerAvecEquipe(name: string, avatar: string, teamId: string): Promise<Invite> {
  const socket = connecter(banc.url)
  assert.equal((await emitAck<any>(socket, 'party:watch', { slug: SLUG })).ok, true)
  const res = await emitAck<any>(socket, 'player:join', { slug: SLUG, name, avatar, teamId })
  assert.equal(res.ok, true, `${name} entre`)
  return { socket, playerId: res.playerId, token: res.token }
}

test('moteur-1 · le second Rachid laissé après la reprise ne compte plus comme présent dans son équipe', async () => {
  // Quatre questions faciles, longues : tout le monde répond juste pendant le
  // temps de lecture offert, donc chacun marque exactement 200 par question.
  const quiz = await creerQuiz(
    banc.url,
    cookie,
    ['Un ?', 'Deux ?', 'Trois ?', 'Quatre ?'].map(t => qcm(t, ['Oui', 'Non'], 0, 60)),
    'Le fantôme',
  )
  const host = await ecranCommun(banc.url, cookie)
  envoyer(host, 'host:createTeam', { name: 'Rouges', emoji: '🍒' })
  envoyer(host, 'host:createTeam', { name: 'Bleus', emoji: '🐳' })
  const avecEquipes = await instantane<any>(host, s => s.teams.length === 2, 'deux équipes')
  const rouges = avecEquipes.teams.find((t: any) => t.name === 'Rouges').id
  const bleus = avecEquipes.teams.find((t: any) => t.name === 'Bleus').id

  const alice = await invite(banc.url, 'Alice', '🦊')
  const rachid = await invite(banc.url, 'Rachid', '🦁')
  const bruno = await invite(banc.url, 'Bruno', '🐻')
  const chloe = await invite(banc.url, 'Chloé', '🐼')
  for (const [i, t] of [[alice, rouges], [rachid, rouges], [bruno, bleus], [chloe, bleus]] as const) {
    envoyer(host, 'host:assignPlayer', { playerId: i.playerId, teamId: t })
  }
  await instantane<any>(host, s => s.players.filter((p: any) => p.teamId).length === 4, 'les équipes faites')

  const sessionId = await lancerQuiz(host, quiz)

  // Q1 : tout le monde répond juste.
  let v = await vue(host, v => v.phase === 'question' && v.qIndex === 0, 'la question 1')
  let revele = vue(host, v => v.phase === 'reveal' && v.qIndex === 0, 'la révélation 1')
  for (const i of [alice, rachid, bruno, chloe]) assert.equal((await repondre(i, sessionId, v, 0)).ok, true)
  v = await revele

  // Le téléphone de Rachid meurt ; il revient sur un téléphone emprunté, dans
  // son équipe, et joue la Q2. L'animateur n'attend plus la fiche d'origine.
  rachid.socket.close()
  await patienter(100)
  suivante(host, sessionId, v)
  v = await vue(host, v => v.phase === 'question' && v.qIndex === 1, 'la question 2')
  const emprunte = await entrerAvecEquipe('Rachid', '⚽', rouges)
  envoyer(host, 'host:command', { sessionId, command: { type: 'nePlusAttendre', playerId: rachid.playerId } })
  revele = vue(host, v => v.phase === 'reveal' && v.qIndex === 1, 'la révélation 2')
  for (const i of [alice, emprunte, bruno, chloe]) assert.equal((await repondre(i, sessionId, v, 0)).ok, true)
  v = await revele

  // Il reprend sa place avec le code : le second Rachid, qui a joué, est gardé.
  const { code } = await emitAck<any>(host, 'host:rendrePlace', { playerId: rachid.playerId })
  const reprise = await emitAck<any>(emprunte.socket, 'player:reprendre', { slug: SLUG, code, token: emprunte.token })
  assert.equal(reprise.ok, true, 'la reprise passe')
  const rachidRevenu: Invite = { socket: emprunte.socket, playerId: reprise.playerId, token: reprise.token }

  // Q3 et Q4 : les quatre personnes de la salle répondent juste.
  for (const q of [2, 3]) {
    suivante(host, sessionId, v)
    v = await vue(host, v => v.phase === 'question' && v.qIndex === q, `la question ${q + 1}`)
    revele = vue(host, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const i of [alice, rachidRevenu, bruno, chloe]) assert.equal((await repondre(i, sessionId, v, 0)).ok, true)
    v = await revele
  }
  await patienter(300)
  const snap = await instantane<any>(host)
  const moyenne = (id: string) => snap.teams.find((t: any) => t.id === id).average
  // Tout le monde a marqué 200 à chaque question où il était : les deux
  // équipes ont joué exactement pareil. Ce que la salle lit à l'écran :
  console.log(`Rouges ${moyenne(rouges)} · Bleus ${moyenne(bleus)}`)
  assert.equal(
    moyenne(rouges),
    moyenne(bleus),
    'deux équipes qui ont tout juste, au même rythme, ont la même moyenne — le fantôme ne compte pas comme présent',
  )
  envoyer(host, 'host:endSession', { sessionId })
  await patienter(200)
})
