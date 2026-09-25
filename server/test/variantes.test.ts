// De nouvelles sortes de questions (rapport du 25 septembre 2026, lot 7) :
// plusieurs bonnes réponses, l'ordre à retrouver, « Qui dans la salle ? »,
// l'estimation mesurée en direct. Invariant 1 : les bonnes réponses et le bon
// ordre n'arrivent aux téléphones qu'à la révélation. Le barème ne bouge pas :
// « plusieurs » et « ordre » sont tout ou rien, payés comme un QCM ; le
// sondage ne rapporte rien et n'entre pas au journal.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeQuestions, parseImportedQuestions, questionProblem, toPlayable, type PlayableQuestion } from '../../shared/library'
import { preparerPartie } from '../../shared/hasard'
import { ecrireListe } from '../../shared/liste'
import { emporterQuiz, importerQuiz } from '../../shared/echange'
import { quizModule } from '../src/games/quiz'
import { attendre, connexionAnimateur, creerQuiz, demarrer, ecranCommun, ecrire, emitAck, invite, lancerQuiz, patienter, qcm, type Banc, type Socket } from './banc'

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

// ── Les règles pures ───────────────────────────────────────────────────────

test('chaque sorte se relit, se juge jouable ou non, et dit ce qui lui manque', () => {
  const [plusieurs, ordre, sondage, direct, estimation] = normalizeQuestions([
    { id: 'a', text: 'Des pays ?', answers: ['France', '', 'Paris', 'Kenya'], correct: 0, variante: 'plusieurs', bonnes: [3, 0, 3, 9, -1, 1.5] },
    { id: 'b', text: 'Dans l’ordre ?', answers: ['Un', 'Deux', 'Trois'], correct: 0, variante: 'ordre' },
    { id: 'c', text: 'Qui dans la salle ?', answers: [], correct: -1, variante: 'sondage' },
    { id: 'd', kind: 'number', text: 'Le poids du gâteau ?', target: null, unit: 'g', enDirect: true },
    // Une estimation n'a pas de variante, et une variante inconnue ne passe pas.
    { id: 'e', kind: 'number', text: 'Une estimation ?', target: 3, unit: '', variante: 'plusieurs' },
  ])
  assert.deepEqual(plusieurs.bonnes, [0, 3], 'des cases qui existent, chacune une fois, dans l’ordre')
  assert.equal(estimation.variante, undefined)
  assert.equal(normalizeQuestions([{ text: 'x', answers: ['a', 'b'], variante: 'quiz' }])[0].variante, undefined)

  // La copie jouée : les cases vides tombent, les bonnes suivent.
  const jouee = toPlayable(plusieurs) as PlayableQuestion & { kind: 'choice' }
  assert.deepEqual(jouee.answers, ['France', 'Paris', 'Kenya'])
  assert.deepEqual(jouee.bonnes, [0, 2])
  const enOrdre = toPlayable(ordre) as PlayableQuestion & { kind: 'choice' }
  assert.deepEqual(enOrdre.ordre, [0, 1, 2], 'écrites dans le bon ordre')
  assert.ok(toPlayable(sondage), 'un sondage n’a rien à écrire d’avance')
  const mesuree = toPlayable(direct)
  assert.equal(mesuree?.kind === 'number' && mesuree.enDirect, true, 'en direct, la cible n’a pas à exister')

  // Ce qui manque se dit.
  assert.equal(questionProblem({ ...plusieurs, bonnes: [] }), 'Coche les bonnes réponses')
  assert.equal(questionProblem({ ...ordre, answers: ['Un', 'Deux', '', ''] }), 'Il faut au moins 3 éléments à remettre dans l’ordre')
  assert.equal(toPlayable({ ...ordre, answers: ['Un', 'Deux', '', ''] }), null)
  assert.equal(questionProblem(sondage), null)
  assert.equal(questionProblem(direct), null)
  assert.equal(questionProblem({ ...direct, enDirect: undefined }), 'Il manque la bonne réponse (un nombre)')
})

test('l’ordre à retrouver se montre toujours mélangé, jamais dans le bon ordre, et le bon ordre le suit', () => {
  const [q] = normalizeQuestions([{ id: 'o', text: 'Dans l’ordre ?', answers: ['Un', 'Deux', 'Trois', 'Quatre'], correct: 0, variante: 'ordre' }])
  const jouable = toPlayable(q)!
  // Un hasard qui rendrait toujours le même tirage : l'ordre ne sort pas tel quel.
  for (const aleatoire of [() => 0, () => 0.999, Math.random]) {
    for (let essai = 0; essai < 50; essai++) {
      const [montree] = preparerPartie([jouable], undefined, aleatoire) as (PlayableQuestion & { kind: 'choice' })[]
      assert.notDeepEqual(montree.answers, ['Un', 'Deux', 'Trois', 'Quatre'], 'montrée telle qu’écrite, elle donnerait la réponse')
      assert.deepEqual(
        montree.ordre!.map(i => montree.answers[i]),
        ['Un', 'Deux', 'Trois', 'Quatre'],
        'le bon ordre, en index des réponses montrées',
      )
    }
  }
  // Les bonnes réponses de « plusieurs » suivent le mélange du quiz.
  const [p] = normalizeQuestions([{ id: 'p', text: 'Des pays ?', answers: ['France', 'Paris', 'Kenya', 'Lyon'], correct: 0, variante: 'plusieurs', bonnes: [0, 2] }])
  for (let essai = 0; essai < 30; essai++) {
    const [melangee] = preparerPartie([toPlayable(p)!], { melangerReponses: true }, Math.random) as (PlayableQuestion & { kind: 'choice' })[]
    assert.deepEqual(melangee.bonnes!.map(i => melangee.answers[i]).sort(), ['France', 'Kenya'])
  }
})

test('la liste collée lit la ligne « Type », « = ? », et « Copier en liste » les réécrit', () => {
  const { questions, unmarked, ignored } = parseImportedQuestions(
    [
      'Lesquels sont des pays ?',
      'Type : plusieurs réponses',
      '* France',
      'Paris',
      '* Kenya',
      '',
      'Dans l’ordre, du plus petit au plus grand ?',
      'Type : dans l’ordre',
      'Souris',
      'Chat',
      'Éléphant',
      '',
      'Qui, dans la salle, arrivera en retard demain ?',
      'Type : qui dans la salle',
      '',
      'Combien pèse le gâteau ?',
      '= ? g',
      '',
      'Deux étoiles sans la ligne Type ?',
      '* Oui',
      '* Non',
    ].join('\n'),
  )
  assert.equal(ignored, 0)
  assert.equal(unmarked, 1, 'sans la ligne Type, deux étoiles restent une erreur à trancher')
  assert.deepEqual(
    questions.map(q => [q.kind, q.variante ?? null, q.bonnes ?? null, !!q.enDirect, q.unit]),
    [
      ['choice', 'plusieurs', [0, 2], false, ''],
      ['choice', 'ordre', null, false, ''],
      ['choice', 'sondage', null, false, ''],
      ['number', null, null, true, 'g'],
      ['choice', null, null, false, ''],
    ],
  )
  assert.ok(questions.slice(0, 4).every(q => questionProblem(q) === null), 'chacune se joue telle que collée')
  // « Ordre : à retrouver », ce qu'on écrit aussi pour dire la même chose.
  assert.equal(parseImportedQuestions('Dans l’ordre ?\nOrdre : à retrouver\nA\nB\nC').questions[0].variante, 'ordre')

  const texte = ecrireListe(questions)
  assert.match(texte, /Type : plusieurs réponses\n\* France\nParis\n\* Kenya/)
  assert.match(texte, /= \? g/)
  const relu = parseImportedQuestions(texte).questions
  assert.deepEqual(
    relu.map(q => [q.kind, q.variante ?? null, q.bonnes ?? null, !!q.enDirect, q.answers.filter(Boolean)]),
    questions.map(q => [q.kind, q.variante ?? null, q.bonnes ?? null, !!q.enDirect, q.answers.filter(Boolean)]),
    texte,
  )
})

test('un quiz emporté garde toutes les pièces de ses questions : la photo, celle de la révélation, l’extrait', async () => {
  const pieces: Record<string, string> = {
    '/media/image/photo': 'data:image/png;base64,AAAA',
    '/media/image/revelation': 'data:image/jpeg;base64,BBBB',
    '/media/image/son': 'data:audio/mpeg;base64,CCCC',
  }
  const [q] = normalizeQuestions([{ id: 'q', text: 'Quel est ce titre ?', answers: ['A', 'B'], correct: 0 }])
  const question = { ...q, image: '/media/image/photo', imageRevelation: '/media/image/revelation', son: '/media/image/son' }
  const emporte = await emporterQuiz({ title: 'Blind test', questions: [question] }, async adresse => pieces[adresse] ?? null)
  assert.deepEqual(
    [emporte.questions[0].image, emporte.questions[0].imageRevelation, emporte.questions[0].son],
    [pieces['/media/image/photo'], pieces['/media/image/revelation'], pieces['/media/image/son']],
    'en clair : une adresse ne veut rien dire sur un autre serveur',
  )
  // À l'import, chacune repasse par l'envoi, et prend sa nouvelle adresse.
  const envoyees: string[] = []
  let recue: Record<string, unknown>[] = []
  const fait = await importerQuiz(JSON.parse(JSON.stringify(emporte)), {
    envoyerPhoto: async enClair => {
      envoyees.push(enClair)
      return `/media/image/neuve-${envoyees.length}`
    },
    creer: async (_titre, questions) => (recue = questions),
  })
  assert.equal(fait.photos, 3)
  assert.deepEqual([...envoyees].sort(), Object.values(pieces).sort())
  const [neuve] = recue
  assert.deepEqual(
    [neuve.image, neuve.imageRevelation, neuve.son].map(a => envoyees[Number(String(a).split('-').pop()) - 1]),
    [pieces['/media/image/photo'], pieces['/media/image/revelation'], pieces['/media/image/son']],
  )
  // Un extrait qu'on ne saurait pas jouer se compte, sans rien emporter.
  const douteux = await importerQuiz(
    { ...emporte, questions: [{ ...emporte.questions[0], son: 'data:audio/flac;base64,AAAA' }] },
    { envoyerPhoto: async () => '/media/image/x', creer: async (_t, questions) => questions },
  )
  assert.equal(douteux.photosIgnorees, 1)
  assert.equal('son' in douteux.quiz[0], false)
})

test('pendant la mesure d’une estimation en direct, la réponse donnée attend encore d’être jugée', () => {
  const sess = (phase: string) => ({ state: { phase, responses: { alice: { choice: null, value: 3, ms: 1, changes: 0 } } } }) as any
  assert.equal(quizModule.reponseEnSuspens!(sess('question'), 'alice'), true)
  assert.equal(quizModule.reponseEnSuspens!(sess('cible'), 'alice'), true, 'rendre sa place maintenant ferait voter deux fois')
  assert.equal(quizModule.reponseEnSuspens!(sess('reveal'), 'alice'), false)
})

// ── Une partie ─────────────────────────────────────────────────────────────

const vue = (s: Socket, pred: (v: any) => boolean, label: string) =>
  attendre<any>(s, 'session:view', p => pred(p.view), label, 15_000).then(p => p.view)

/** Envoie une action de joueur, et rend son accusé. */
const repondre = (s: Socket, sessionId: string, action: Record<string, unknown>) => emitAck<any>(s, 'player:action', { sessionId, action })

test('une partie avec chaque sorte : tout ou rien, le bon ordre, la mesure en direct, les votes de la salle', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const id = await creerQuiz(banc.url, cookie, [
    { ...qcm('Lesquels sont des pays ?', ['France', 'Paris', 'Kenya', 'Lyon'], 0, 60), variante: 'plusieurs', bonnes: [0, 2] },
    { ...qcm('Du plus petit au plus grand ?', ['Souris', 'Chat', 'Cheval', 'Éléphant'], 0, 60), variante: 'ordre' },
    { kind: 'number', text: 'Combien pèse le gâteau ?', target: null, unit: 'g', duration: 60, enDirect: true, image: null, answers: [], correct: 0 },
    { ...qcm('Qui dans la salle arrivera en retard demain ?', [], -1, 60), variante: 'sondage' },
  ])
  const alice = await invite(banc.url, 'Alice')
  const bob = await invite(banc.url, 'Bob', '🐻')
  const chloe = await invite(banc.url, 'Chloé', '🐱')
  const host = await ecranCommun(banc.url, cookie)
  const vuesDAlice: any[] = []
  alice.socket.on('session:view', (p: any) => vuesDAlice.push(p.view))

  // ── 1. Plusieurs bonnes réponses : toutes, et elles seules.
  const q1 = vue(host, v => v.phase === 'question' && v.qIndex === 0, 'la question à plusieurs réponses')
  const q1tel = vue(alice.socket, v => v.phase === 'question' && v.qIndex === 0, 'la question au téléphone')
  const sessionId = await lancerQuiz(host, id)
  const [v1, t1] = await Promise.all([q1, q1tel])
  assert.equal(t1.variante, 'plusieurs')
  assert.equal(t1.bonnes, undefined, 'les bonnes réponses n’arrivent qu’à la révélation')
  const visee1 = { qIndex: 0, round: v1.round }
  const indice = (v: any, texte: string) => v.answers.indexOf(texte)
  const pays = [indice(v1, 'Kenya'), indice(v1, 'France')]
  assert.equal((await repondre(alice.socket, sessionId, { type: 'answer', choice: 0, ...visee1 })).reason, 'invalid', 'une seule case ne répond pas à « plusieurs »')
  assert.equal((await repondre(alice.socket, sessionId, { type: 'answers', choices: [0, 0], ...visee1 })).reason, 'invalid', 'chaque case une fois')
  assert.equal((await repondre(alice.socket, sessionId, { type: 'answers', choices: [9], ...visee1 })).reason, 'invalid')
  assert.equal((await repondre(alice.socket, sessionId, { type: 'answers', choices: pays, ...visee1 })).ok, true)
  assert.equal((await repondre(bob.socket, sessionId, { type: 'answers', choices: [indice(v1, 'France')], ...visee1 })).ok, true)
  assert.equal(
    (await repondre(chloe.socket, sessionId, { type: 'answers', choices: [indice(v1, 'France'), indice(v1, 'Kenya'), indice(v1, 'Lyon')], ...visee1 })).ok,
    true,
  )
  const r1 = vue(host, v => v.phase === 'reveal' && v.qIndex === 0, 'la révélation 1')
  const r1tel = vue(alice.socket, v => v.phase === 'reveal' && v.qIndex === 0, 'la révélation 1 au téléphone')
  const r1bob = vue(bob.socket, v => v.phase === 'reveal' && v.qIndex === 0, 'la révélation 1 chez Bob')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', ...visee1 } })
  const [rev1, tel1, bob1] = await Promise.all([r1, r1tel, r1bob])
  assert.deepEqual(rev1.bonnes.map((i: number) => rev1.answers[i]).sort(), ['France', 'Kenya'])
  assert.deepEqual(tel1.yourChoices, [...pays].sort((a, b) => a - b), 'ce qu’elle a coché, rangé')
  assert.equal(tel1.yourCorrect, true)
  assert.ok(tel1.yourPoints > 0, 'payée comme un QCM')
  assert.equal(bob1.yourCorrect, false, 'une bonne réponse sur deux, c’est raté : tout ou rien')
  assert.equal(bob1.yourPoints, 0)
  assert.equal(rev1.counts[indice(rev1, 'France')], 3, 'chaque case cochée compte')
  assert.equal(rev1.fastest?.name, 'Alice', 'le plus rapide, parmi ceux qui ont tout trouvé')

  // ── 2. L'ordre à retrouver : montré mélangé, juste seulement en entier.
  const q2 = vue(host, v => v.phase === 'question' && v.qIndex === 1, 'la question d’ordre')
  const q2tel = vue(alice.socket, v => v.phase === 'question' && v.qIndex === 1, 'l’ordre au téléphone')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: 0, round: rev1.round } })
  const [v2, t2] = await Promise.all([q2, q2tel])
  assert.notDeepEqual(t2.answers, ['Souris', 'Chat', 'Cheval', 'Éléphant'], 'jamais montrée dans le bon ordre')
  assert.equal(t2.ordre, undefined)
  const visee2 = { qIndex: 1, round: v2.round }
  const bonOrdre = ['Souris', 'Chat', 'Cheval', 'Éléphant'].map(a => indice(v2, a))
  const faux = [bonOrdre[1], bonOrdre[0], bonOrdre[2], bonOrdre[3]]
  assert.equal((await repondre(chloe.socket, sessionId, { type: 'order', order: bonOrdre.slice(0, 2), ...visee2 })).reason, 'invalid', 'un ordre complet')
  assert.equal((await repondre(alice.socket, sessionId, { type: 'order', order: bonOrdre, ...visee2 })).ok, true)
  assert.equal((await repondre(bob.socket, sessionId, { type: 'order', order: faux, ...visee2 })).ok, true)
  const r2 = vue(host, v => v.phase === 'reveal' && v.qIndex === 1, 'la révélation 2')
  const r2tel = vue(alice.socket, v => v.phase === 'reveal' && v.qIndex === 1, 'la révélation 2 au téléphone')
  const r2bob = vue(bob.socket, v => v.phase === 'reveal' && v.qIndex === 1, 'la révélation 2 chez Bob')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', ...visee2 } })
  const [rev2, tel2, bob2] = await Promise.all([r2, r2tel, r2bob])
  assert.deepEqual(
    rev2.ordre.map((i: number) => rev2.answers[i]),
    ['Souris', 'Chat', 'Cheval', 'Éléphant'],
  )
  assert.deepEqual(tel2.ordre, rev2.ordre)
  assert.equal(tel2.yourCorrect, true)
  assert.ok(tel2.yourPoints > 0)
  assert.equal(bob2.yourCorrect, false, 'deux inversées : raté')
  // « À sa place » : Cheval et Éléphant, chez l'un comme chez l'autre.
  assert.equal(rev2.counts[indice(rev2, 'Cheval')], 2)
  assert.equal(rev2.counts[indice(rev2, 'Souris')], 1)

  // ── 3. L'estimation en direct : close, mesurée, puis révélée.
  const q3 = vue(host, v => v.phase === 'question' && v.qIndex === 2, 'l’estimation en direct')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: 1, round: rev2.round } })
  const v3 = await q3
  assert.equal(v3.enDirect, true)
  assert.equal(v3.target, undefined)
  const visee3 = { qIndex: 2, round: v3.round }
  assert.equal((await repondre(alice.socket, sessionId, { type: 'guess', value: 1200, ...visee3 })).ok, true)
  assert.equal((await repondre(bob.socket, sessionId, { type: 'guess', value: 900, ...visee3 })).ok, true)
  const mesure = vue(host, v => v.phase === 'cible' && v.qIndex === 2, 'la mesure')
  const mesureTel = vue(chloe.socket, v => v.phase === 'cible' && v.qIndex === 2, 'la mesure au téléphone')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', ...visee3 } })
  const [c3, ct3] = await Promise.all([mesure, mesureTel])
  assert.equal(c3.enDirect, true)
  assert.equal(ct3.target, undefined, 'rien à révéler : la bonne réponse n’existe pas encore')
  assert.equal((await repondre(chloe.socket, sessionId, { type: 'guess', value: 1250, ...visee3 })).reason, 'too-late', 'close pendant la mesure')
  // Un geste d'avant ne révèle rien : il visait la question, pas la mesure.
  ;(host as any).emit('host:command', { sessionId, command: { type: 'cible', value: 5, phase: 'question', ...visee3 } })
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'cible', ...visee3 } })
  await patienter(300)
  const r3 = vue(host, v => v.phase === 'reveal' && v.qIndex === 2, 'la révélation 3')
  const r3tel = vue(alice.socket, v => v.phase === 'reveal' && v.qIndex === 2, 'la révélation 3 au téléphone')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'cible', value: 1250, phase: 'cible', ...visee3 } })
  const [rev3, tel3] = await Promise.all([r3, r3tel])
  assert.equal(rev3.target, 1250, 'la cible tapée, pas le geste périmé')
  assert.equal(tel3.target, 1250)
  assert.deepEqual(rev3.guesses.map((g: any) => g.name), ['Alice', 'Bob'], 'rangées à la distance de la mesure')
  assert.ok(rev3.guesses[0].points > rev3.guesses[1].points)

  // ── 4. « Qui dans la salle ? » : les invités, et leurs votes — sans points.
  const q4 = vue(host, v => v.phase === 'question' && v.qIndex === 3, 'le sondage')
  const q4tel = vue(alice.socket, v => v.phase === 'question' && v.qIndex === 3, 'le sondage au téléphone')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: 2, round: rev3.round } })
  const [v4, t4] = await Promise.all([q4, q4tel])
  assert.deepEqual([...t4.answers].sort(), ['Alice', 'Bob', 'Chloé'], 'les réponses sont les invités')
  const visee4 = { qIndex: 3, round: v4.round }
  const qui = (nom: string) => t4.answers.indexOf(nom)
  assert.equal((await repondre(alice.socket, sessionId, { type: 'answer', choice: 7, ...visee4 })).reason, 'invalid')
  for (const [s, nom] of [[alice.socket, 'Bob'], [bob.socket, 'Bob'], [chloe.socket, 'Alice']] as const) {
    assert.equal((await repondre(s, sessionId, { type: 'answer', choice: qui(nom), ...visee4 })).ok, true)
  }
  const r4 = vue(host, v => v.phase === 'reveal' && v.qIndex === 3, 'les votes')
  const r4tel = vue(chloe.socket, v => v.phase === 'reveal' && v.qIndex === 3, 'les votes au téléphone')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', ...visee4 } })
  const [rev4, tel4] = await Promise.all([r4, r4tel])
  assert.deepEqual(
    rev4.votes.map((x: any) => [x.name, x.avatar, x.votes]),
    [
      ['Bob', '🐻', 2],
      ['Alice', '🦊', 1],
    ],
  )
  assert.deepEqual(tel4.votes, rev4.votes, 'la même répartition pour toute la salle')
  assert.equal(tel4.yourPoints, null, 'personne ne gagne rien')
  assert.equal(rev4.fastest, null)

  // Invariant 1 : avant la révélation, ni les bonnes réponses, ni l'ordre.
  const avant = vuesDAlice.filter(v => v.phase !== 'reveal')
  assert.ok(avant.length > 0)
  assert.doesNotMatch(JSON.stringify(avant), /"(bonnes|ordre|yourCorrect|votes|target)":/)

  // Le bilan : le verdict de « plusieurs » et d'« ordre », la cible mesurée —
  // et pas le sondage, qui n'a ni juste ni faux.
  ;(host as any).emit('host:endSession', { sessionId })
  await patienter(500)
  const bilan = (await (await fetch(`${banc.url}/s/banc/bilan.json`)).json()) as any
  const questions = bilan.questions as any[]
  assert.deepEqual(
    questions.map(q => q.text),
    ['Lesquels sont des pays ?', 'Du plus petit au plus grand ?', 'Combien pèse le gâteau ?'],
    'le sondage n’entre pas au journal',
  )
  assert.equal(questions[0].variante, 'plusieurs')
  assert.deepEqual(questions[0].bonnes.map((i: number) => questions[0].answers[i]).sort(), ['France', 'Kenya'])
  assert.equal(questions[0].correctCount, 1)
  assert.equal(questions[1].variante, 'ordre')
  assert.deepEqual(questions[1].ordre.map((i: number) => questions[1].answers[i]), ['Souris', 'Chat', 'Cheval', 'Éléphant'])
  assert.equal(questions[1].correctCount, 1)
  assert.equal(questions[2].target, 1250, 'la cible tapée, au journal')
  const aliceAuBilan = bilan.players.find((p: any) => p.name === 'Alice')
  assert.equal(aliceAuBilan.stat.correct, 2, 'deux justes, comptées comme des QCM')
})

test('une estimation en direct qu’on ne mesure pas : annulée, sans cible ni points — ou reposée', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const id = await creerQuiz(banc.url, cookie, [
    { kind: 'number', text: 'Combien de bonbons ?', target: null, unit: '', duration: 60, enDirect: true, image: null, answers: [], correct: 0 },
    qcm('Et ensuite ?', ['Oui', 'Non'], 0, 60),
  ])
  const alice = await invite(banc.url, 'Alice')
  await invite(banc.url, 'Bob')
  const host = await ecranCommun(banc.url, cookie)
  const q1 = vue(host, v => v.phase === 'question' && v.qIndex === 0, 'la question')
  const sessionId = await lancerQuiz(host, id)
  const v1 = await q1
  await repondre(alice.socket, sessionId, { type: 'guess', value: 40, qIndex: 0, round: v1.round })
  const mesure = vue(host, v => v.phase === 'cible', 'la mesure')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', qIndex: 0, round: v1.round } })
  const c1 = await mesure

  // Reposée pendant la mesure : elle repart de zéro, et attendra encore sa cible.
  const reposee = vue(host, v => v.phase === 'question' && v.round !== c1.round, 'la question reposée')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'replay', phase: 'cible', qIndex: 0, round: c1.round } })
  const v1bis = await reposee
  assert.equal(v1bis.answeredCount, 0)
  await repondre(alice.socket, sessionId, { type: 'guess', value: 40, qIndex: 0, round: v1bis.round })
  const mesureBis = vue(host, v => v.phase === 'cible' && v.round === v1bis.round, 'la mesure, de nouveau')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', qIndex: 0, round: v1bis.round } })
  const c1bis = await mesureBis

  // Annulée : révélée sans cible — pas de « 0 » à l'écran —, et sans points.
  const annulee = vue(host, v => v.phase === 'reveal', 'la révélation annulée')
  const annuleeTel = vue(alice.socket, v => v.phase === 'reveal', 'la révélation annulée au téléphone')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'cancel', phase: 'cible', qIndex: 0, round: c1bis.round } })
  const [rev, tel] = await Promise.all([annulee, annuleeTel])
  assert.equal(rev.cancelled, true)
  assert.equal(rev.target, undefined)
  assert.equal(rev.guesses, undefined)
  assert.equal(tel.target, undefined)
  assert.equal(tel.yourQuizTotal, 0)

  // Et la partie continue.
  const suite = vue(host, v => v.phase === 'question' && v.qIndex === 1, 'la question suivante')
  ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: 0, round: rev.round } })
  assert.equal((await suite).text, 'Et ensuite ?')
  ;(host as any).emit('host:endSession', { sessionId })
})

// ── Le blind test ──────────────────────────────────────────────────────────

/** Un extrait tel que le navigateur l'envoie : l'en-tête d'un MP3, et du silence. */
const MP3 = `data:audio/mpeg;base64,${Buffer.concat([Buffer.from('ID3'), Buffer.alloc(600)]).toString('base64')}`
/** Une photo d'un pixel. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** Un POST de l'animateur, et sa réponse lue. */
async function poster(url: string, chemin: string, body: unknown, cookie: string) {
  const res = await ecrire(url, chemin, body, cookie)
  return { status: res.status, corps: (await res.json()) as any }
}
const envoyer = (url: string, cookie: string, dataUrl: string) =>
  poster(url, '/api/images', { dataUrl }, cookie) as Promise<{ status: number; corps: { url?: string; error?: string } }>

test('le blind test : l’extrait s’envoie, se sert, ne part qu’aux écrans d’animateur, et voyage avec sa question', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)

  // L'envoi : un extrait qu'une télé sait jouer, pas trop lourd.
  const son = await envoyer(banc.url, cookie, MP3)
  assert.equal(son.status, 201, JSON.stringify(son.corps))
  const servi = await fetch(`${banc.url}${son.corps.url}`)
  assert.equal(servi.headers.get('content-type'), 'audio/mpeg')
  assert.match((await envoyer(banc.url, cookie, 'data:audio/flac;base64,AAAA')).corps.error!, /ne se lit pas — choisis-le en MP3/)
  const lourd = `data:audio/mpeg;base64,${Buffer.alloc(1_600_000).toString('base64')}`
  assert.match((await envoyer(banc.url, cookie, lourd)).corps.error!, /Extrait trop lourd/)
  // Et une photo reste une photo : pas de SVG, même déguisé.
  assert.match((await envoyer(banc.url, cookie, 'data:image/svg+xml;base64,AAAA')).corps.error!, /Cette photo ne se lit pas/)

  const photo = (await envoyer(banc.url, cookie, PNG)).corps.url!
  const photoRevelation = (await envoyer(banc.url, cookie, PNG.replace('ggg==', 'ggA=='))).corps.url!
  const id = await creerQuiz(banc.url, cookie, [
    { ...qcm('Quel est ce titre ?', ['Téléphone', 'Indochine'], 1, 60), son: son.corps.url, image: photo, imageRevelation: photoRevelation },
  ])

  // En jeu : l'écran commun a l'extrait pendant la question ; le téléphone, jamais.
  const alice = await invite(banc.url, 'Alice')
  const host = await ecranCommun(banc.url, cookie)
  const vuesDAlice: any[] = []
  alice.socket.on('session:view', (p: any) => vuesDAlice.push(p.view))
  const q = vue(host, v => v.phase === 'question', 'la question')
  const sessionId = await lancerQuiz(host, id)
  const v = await q
  assert.equal(v.son, son.corps.url)
  const r = vue(host, x => x.phase === 'reveal', 'la révélation')
  const rtel = vue(alice.socket, x => x.phase === 'reveal', 'la révélation au téléphone')
  await repondre(alice.socket, sessionId, { type: 'answer', choice: 1, qIndex: 0, round: v.round })
  const [rev] = await Promise.all([r, rtel])
  assert.equal(rev.son, undefined, 'la révélation se tait')
  const idDuSon = son.corps.url!.split('/').pop()!
  assert.doesNotMatch(JSON.stringify(vuesDAlice), new RegExp(idDuSon), 'l’extrait ne part jamais aux téléphones')
  ;(host as any).emit('host:endSession', { sessionId })

  // Un code de partage recopie toutes les pièces : la photo, celle de la
  // révélation, l'extrait — chacune sous une adresse de l'espace qui reçoit.
  const partage = await poster(banc.url, `/api/quizzes/${id}/partage`, {}, cookie)
  assert.equal(partage.status, 201, JSON.stringify(partage.corps))
  const recu = await poster(banc.url, '/api/partages/recevoir', { code: partage.corps.code }, cookie)
  assert.equal(recu.status, 201, JSON.stringify(recu.corps))
  const copie = recu.corps.questions[0]
  for (const [champ, avant] of [['image', photo], ['imageRevelation', photoRevelation], ['son', son.corps.url]] as const) {
    assert.match(copie[champ], /^\/media\/image\//, `${champ} recopiée`)
    assert.notEqual(copie[champ], avant, `${champ} sous sa propre adresse`)
    const [a, b] = await Promise.all([fetch(`${banc.url}${avant}`), fetch(`${banc.url}${copie[champ]}`)])
    assert.deepEqual(Buffer.from(await b.arrayBuffer()), Buffer.from(await a.arrayBuffer()), `${champ} : le même contenu`)
  }
})
