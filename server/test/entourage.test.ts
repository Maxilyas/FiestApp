// Ce qui entoure une question (rapport du 25 septembre 2026, lot 7) :
// l'anecdote de la révélation, la note de l'animateur, la photo de la
// révélation, l'intertitre, la question mise de côté. Invariant 1 : rien de
// tout cela n'arrive aux téléphones avant son heure — et la note, jamais.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { INTERTITRE_S, dureeDesJouables, normalizeQuestions, parseImportedQuestions, playableQuestions, toPlayable } from '../../shared/library'
import { ecrireListe } from '../../shared/liste'
import { attendre, connexionAnimateur, creerQuiz, demarrer, ecranCommun, emitAck, invite, lancerQuiz, patienter, qcm, type Banc, type Socket } from './banc'

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

const NOTE = 'Raconte le voyage à Rome'
const ANECDOTE = 'Elle ne devait rester que vingt ans.'
const PHOTO_REVELATION = '/media/image/00000000-0000-4000-8000-000000000001'

// ── Les règles pures ───────────────────────────────────────────────────────

test('ce qui entoure une question ne s’écrit que s’il est posé, et la copie jouée le garde', () => {
  const [avant] = normalizeQuestions([{ id: 'q1', text: 'Question ?', answers: ['Oui', 'Non'], correct: 0 }])
  for (const cle of ['anecdote', 'note', 'intertitre', 'imageRevelation', 'deCote']) assert.equal(cle in avant, false, `${cle} absent d’un quiz d’avant`)
  const [q] = normalizeQuestions([
    {
      id: 'q2',
      text: 'La tour Eiffel ?',
      answers: ['Vrai', 'Faux'],
      correct: 0,
      anecdote: `  ${ANECDOTE}  `,
      note: NOTE,
      intertitre: 'Manche 2 : l’histoire',
      imageRevelation: PHOTO_REVELATION,
    },
  ])
  assert.equal(q.anecdote, ANECDOTE)
  const jouee = toPlayable(q)!
  assert.deepEqual([jouee.anecdote, jouee.note, jouee.intertitre, jouee.imageRevelation], [ANECDOTE, NOTE, 'Manche 2 : l’histoire', PHOTO_REVELATION])
  // Une photo qui ne vient pas du serveur n'entre pas.
  assert.equal(normalizeQuestions([{ ...q, imageRevelation: 'https://ailleurs.example/x.jpg' }])[0].imageRevelation, undefined)
  // L'intertitre compte dans la durée estimée.
  assert.equal(dureeDesJouables([jouee]) - dureeDesJouables([toPlayable(avant)!]), INTERTITRE_S + jouee.duration - toPlayable(avant)!.duration)
  // Mise de côté : écrite, pas jouée.
  const [deCote] = normalizeQuestions([{ ...q, deCote: true }])
  assert.equal(toPlayable(deCote), null)
  assert.equal(playableQuestions({ id: 'x', title: 'x', questions: [q, deCote], updatedAt: 0 }).length, 1)
})

test('la liste collée lit l’anecdote, la note et l’intertitre — et « Copier en liste » les écrit', () => {
  const { questions } = parseImportedQuestions(
    ['Construite pour l’Exposition de 1889 ?', 'Intertitre : Manche 2', '* Vrai', 'Faux', 'Le saviez-vous : ' + ANECDOTE, 'Note : ' + NOTE].join('\n'),
  )
  assert.equal(questions.length, 1)
  assert.deepEqual([questions[0].intertitre, questions[0].anecdote, questions[0].note], ['Manche 2', ANECDOTE, NOTE])
  assert.deepEqual(questions[0].answers.filter(Boolean), ['Vrai', 'Faux'], 'les réglages ne sont pas des réponses')
  const relue = parseImportedQuestions(ecrireListe(questions)).questions[0]
  assert.deepEqual([relue.intertitre, relue.anecdote, relue.note], ['Manche 2', ANECDOTE, NOTE])
})

// ── Une partie ─────────────────────────────────────────────────────────────

const vue = (s: Socket, pred: (v: any) => boolean, label: string) =>
  attendre<any>(s, 'session:view', p => pred(p.view), label, 15_000).then(p => p.view)

test('l’intertitre, puis la question ; l’anecdote à la révélation seulement ; la note jamais aux téléphones', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const id = await creerQuiz(banc.url, cookie, [
    { ...qcm('Première question ?', ['Oui', 'Non'], 0, 60), intertitre: 'Manche 1 : l’échauffement', note: NOTE },
    { ...qcm('De côté ?', ['Oui', 'Non'], 0, 60), deCote: true },
    { ...qcm('La tour Eiffel ?', ['Vrai', 'Faux'], 0, 60), anecdote: ANECDOTE, imageRevelation: PHOTO_REVELATION, note: NOTE },
  ])
  const alice = await invite(banc.url, 'Alice')
  const host = await ecranCommun(banc.url, cookie)
  const vuesDAlice: any[] = []
  alice.socket.on('session:view', (p: any) => vuesDAlice.push(p.view))

  const intertitreHote = vue(host, v => v.phase === 'intertitre', 'l’intertitre à l’écran')
  const intertitreTel = vue(alice.socket, v => v.phase === 'intertitre', 'l’intertitre au téléphone')
  const sessionId = await lancerQuiz(host, id)
  const h1 = await intertitreHote
  const t1 = await intertitreTel
  assert.equal(h1.intertitre, 'Manche 1 : l’échauffement')
  assert.equal(h1.note, NOTE, 'les écrans d’animateur ont la note')
  assert.equal(h1.qCount, 2, 'la question mise de côté ne se joue pas')
  assert.equal(t1.intertitre, 'Manche 1 : l’échauffement')

  // Un clic, et la question.
  const q1 = vue(host, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'intertitre', qIndex: 0, round: h1.round } })
  const v1 = await q1
  assert.equal(v1.note, NOTE)
  const r1 = vue(host, v => v.phase === 'reveal' && v.qIndex === 0, 'la révélation 1')
  await emitAck(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0, qIndex: 0, round: v1.round } })
  const rev1 = await r1

  // Reposée : sans son intertitre, la salle vient de le voir.
  const reposee = vue(host, v => v.qIndex === 0 && (v.phase === 'question' || v.phase === 'intertitre'), 'la question reposée')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'replay', phase: 'reveal', qIndex: 0, round: rev1.round } })
  const v1bis = await reposee
  assert.equal(v1bis.phase, 'question')
  const r1bis = vue(host, v => v.phase === 'reveal' && v.qIndex === 0, 'la révélation reposée')
  await emitAck(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 0, qIndex: 0, round: v1bis.round } })
  const rev1bis = await r1bis

  const q2 = vue(host, v => v.phase === 'question' && v.qIndex === 1, 'la question de la tour Eiffel')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: 0, round: rev1bis.round } })
  const v2 = await q2
  assert.equal(v2.text, 'La tour Eiffel ?')
  assert.equal(v2.anecdote, undefined, 'pas d’anecdote avant la révélation, même à l’écran')
  assert.equal(v2.imageRevelation, undefined)
  const r2 = vue(host, v => v.phase === 'reveal' && v.qIndex === 1, 'la révélation 2')
  const r2tel = vue(alice.socket, v => v.phase === 'reveal' && v.qIndex === 1, 'la révélation 2 au téléphone')
  await emitAck(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: 1, qIndex: 1, round: v2.round } })
  const [rev2, tel2] = await Promise.all([r2, r2tel])
  assert.equal(rev2.anecdote, ANECDOTE)
  assert.equal(rev2.imageRevelation, PHOTO_REVELATION)
  assert.equal(tel2.anecdote, ANECDOTE, 'à la révélation, le téléphone aussi')
  assert.equal(tel2.imageRevelation, PHOTO_REVELATION)

  // Invariant 1 : avant la révélation, rien ; la note, jamais.
  const avant = vuesDAlice.filter(v => v.phase !== 'reveal')
  assert.ok(avant.length > 0)
  assert.doesNotMatch(JSON.stringify(avant), /ne devait rester|0000-4000-8000-000000000001/)
  assert.doesNotMatch(JSON.stringify(vuesDAlice), /voyage à Rome/)

  // Le bilan raconte l'anecdote, jamais la note.
  ;(host as any).emit('host:endSession', { sessionId })
  await patienter(500)
  const bilan = (await (await fetch(`${banc.url}/s/banc/bilan.json`)).json()) as any
  assert.ok(bilan.questions.some((q: any) => q.anecdote === ANECDOTE))
  assert.doesNotMatch(JSON.stringify(bilan), /voyage à Rome/)
})

test('en enchaînement automatique, l’intertitre dure ce que l’animateur a réglé', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const id = await creerQuiz(banc.url, cookie, [
    qcm('D’abord ?', ['Oui', 'Non'], 0, 60),
    { ...qcm('Ensuite ?', ['Oui', 'Non'], 0, 60), intertitre: 'Pause buvette' },
  ])
  await invite(banc.url, 'Alice')
  const host = await ecranCommun(banc.url, cookie)
  const sessionId = await lancerQuiz(host, id)
  const v = await vue(host, x => x.phase === 'question' && x.qIndex === 0, 'la première question')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'autoNext', seconds: 2 } })
  await vue(host, x => x.autoNextSeconds === 2, 'l’enchaînement réglé')
  const revele = vue(host, x => x.phase === 'reveal', 'la révélation')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', qIndex: 0, round: v.round } })
  await revele
  const intertitre = await vue(host, x => x.phase === 'intertitre', 'l’intertitre, tout seul')
  assert.ok(intertitre.deadline > Date.now() - 1000, 'il dit quand il s’arrête')
  const suite = await vue(host, x => x.phase === 'question' && x.qIndex === 1, 'la question, toute seule')
  assert.equal(suite.text, 'Ensuite ?')
  ;(host as any).emit('host:endSession', { sessionId })
})
