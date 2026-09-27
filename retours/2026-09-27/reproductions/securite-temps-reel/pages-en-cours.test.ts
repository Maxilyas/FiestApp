// Invariant 1, côté pages publiques : pendant une question NON révélée, les
// JSON publics de la soirée en cours (recap.json, bilan.json, soirees.json)
// ne doivent porter ni l'anecdote de la révélation, ni la cible d'une
// estimation, ni l'index de la bonne réponse — que toute la salle peut lire
// en scannant le QR du souvenir.
//
// On joue une seule question (estimation de cible 1994, anecdote secrète).
// Pendant la question : aucune fuite, et le bilan ne porte aucune question.
// Après la révélation : les trois paraissent — la garde a bien du mordant.
//
// Passe aujourd'hui : `logQuestion` n'écrit au journal qu'à la révélation
// (quiz.ts `reveal`), et les pages dérivent du journal. C'est une garde de
// l'invariant, pas un bug.
//
// Lancer : cd server && nice -n 10 node --import tsx --test --test-timeout=120000 \
//   ../export/evaluations/securite-temps-reel/pages-en-cours.test.ts
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  invite,
  lancerQuiz,
  patienter,
  type Banc,
  type Socket,
} from '../../../server/test/banc'
import type { QuizQuestionDef } from '../../../shared/library'

const SLUG = ADMIN.slug
const ANECDOTE = 'SECRET-ANECDOTE-DE-LA-REVELATION'
let banc: Banc
let cookie: string
before(async () => {
  banc = await demarrer()
  cookie = await connexionAnimateur(banc.url)
})
after(() => banc.close())

async function pagesPubliques(): Promise<{ textes: Record<string, string>; bilanQuestions: any[] }> {
  const textes: Record<string, string> = {}
  for (const chemin of ['recap.json', 'bilan.json', 'soirees.json']) {
    textes[chemin] = await (await fetch(`${banc.url}/s/${SLUG}/${chemin}`)).text()
  }
  return { textes, bilanQuestions: (JSON.parse(textes['bilan.json']).questions ?? []) as any[] }
}

test('une question non révélée ne fuit ni par recap, ni par bilan, ni par soirees.json', async () => {
  const questions: Partial<QuizQuestionDef>[] = [
    { kind: 'number', text: 'Année ?', target: 1994, unit: '', duration: 60, image: null, answers: [], correct: 0, anecdote: ANECDOTE },
  ]
  const created = await ecrire(banc.url, '/api/quizzes', { title: 'Fuite ?' }, cookie)
  const { id } = (await created.json()) as { id: string }
  await ecrire(banc.url, `/api/quizzes/${id}`, { title: 'Fuite ?', questions }, cookie, 'PUT')

  const host = await ecranCommun(banc.url, cookie)
  const alice = await invite(banc.url, 'Alice', '🦊')
  const bob = await invite(banc.url, 'Bob', '🐼')
  const sessionId = await lancerQuiz(host, id)
  const enQuestion = (s: Socket) => attendre<any>(s, 'session:view', p => p.view.phase === 'question', 'la question')
  const v = await enQuestion(host)

  // Alice estime, sans que la question soit révélée.
  await emitAck(alice.socket, 'player:action', { sessionId, action: { type: 'guess', value: 1990, qIndex: v.qIndex, round: v.round } })
  await patienter(200)

  // ── Pendant la question : rien ne fuit.
  {
    const { textes, bilanQuestions } = await pagesPubliques()
    for (const [nom, texte] of Object.entries(textes)) {
      assert.ok(!texte.includes(ANECDOTE), `${nom} porte l’anecdote pendant la question`)
      assert.ok(!/"target"\s*:\s*1994/.test(texte), `${nom} porte la cible pendant la question`)
    }
    assert.equal(bilanQuestions.length, 0, 'le bilan ne porte aucune question tant que rien n’est révélé')
  }

  // ── Après la révélation : les trois paraissent (la garde a du mordant).
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', qIndex: v.qIndex, round: v.round } })
  await attendre<any>(host, 'session:view', p => p.view.phase === 'reveal', 'la révélation')
  await patienter(400)
  {
    const { bilanQuestions } = await pagesPubliques()
    assert.equal(bilanQuestions.length, 1, 'la question révélée entre au bilan')
    assert.equal(bilanQuestions[0].target, 1994, 'et porte alors sa cible')
    assert.equal(bilanQuestions[0].anecdote, ANECDOTE, 'et son anecdote')
  }
  void bob
})
