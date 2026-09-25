// Le hasard d'une partie (rapport du 25 septembre 2026, lot 2) : les réponses
// d'un QCM se mélangent au lancement, le même ordre pour toute la salle, et
// c'est la copie jouée qui fait foi — au journal, au bilan, dans l'archive.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliserReglages, ordreDesReponses, preparerPartie, suiteFixe } from '../../shared/hasard'
import { normalizeQuestions, playableQuestions, type PlayableQuestion } from '../../shared/library'
import { deballerQuiz, emporterQuiz, importerQuiz } from '../../shared/echange'
import { brouillonUtile, emballerBrouillon, lireBrouillon } from '../../shared/brouillon'
import { reviewFromDatabase } from '../src/core/export'
import {
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
} from './banc'

type Choix = Extract<PlayableQuestion, { kind: 'choice' }>
const qcm = (text: string, answers: string[], correct: number, extra: Partial<Choix> = {}): Choix => ({
  kind: 'choice',
  text,
  answers,
  correct,
  duration: 20,
  image: null,
  observeSeconds: null,
  ...extra,
})

// ── La copie jouée ────────────────────────────────────────────────────────

test('sans réglage, le quiz se joue tel qu’il est écrit', () => {
  const questions = [qcm('A ?', ['a', 'b', 'c', 'd'], 0), qcm('B ?', ['a', 'b'], 1)]
  assert.deepEqual(preparerPartie(questions, undefined), questions)
  assert.deepEqual(preparerPartie(questions, {}), questions)
})

test('les réponses mélangées : la bonne suit son texte, et chaque place finit par la recevoir', () => {
  const q = qcm('Capitale de l’Australie ?', ['Canberra', 'Sydney', 'Perth', 'Melbourne'], 0)
  const places = new Set<number>()
  const alea = suiteFixe(7)
  for (let i = 0; i < 200; i++) {
    const [jouee] = preparerPartie([q], { melangerReponses: true }, alea) as [Choix]
    assert.deepEqual([...jouee.answers].sort(), [...q.answers].sort(), 'les mêmes réponses, rien de perdu')
    assert.equal(jouee.answers[jouee.correct], 'Canberra', 'la bonne réponse suit son texte')
    places.add(jouee.correct)
  }
  assert.deepEqual([...places].sort(), [0, 1, 2, 3], 'la bonne réponse n’est plus toujours la première')
})

test('un vrai ou faux, une question « ordre fixe » et une estimation ne bougent pas', () => {
  const vf = qcm('Les flamants roses naissent gris.', ['Vrai', 'Faux'], 0)
  const fixe = qcm('Du plus petit au plus grand ?', ['Souris', 'Chat', 'Chien', 'Cheval'], 3, { ordreFixe: true })
  const estimation = { kind: 'number', text: 'Combien ?', target: 3, unit: '', duration: 20, image: null, observeSeconds: null } as PlayableQuestion
  const alea = suiteFixe(3)
  for (let i = 0; i < 50; i++) {
    assert.deepEqual(preparerPartie([vf, fixe, estimation], { melangerReponses: true }, alea), [vf, fixe, estimation])
  }
})

test('des réponses chiffrées se rangent de la plus petite à la plus grande', () => {
  const q = qcm('Combien de communes en France, environ ?', ['35 000', '3 500', '60 000', '12 000'], 0)
  assert.deepEqual(ordreDesReponses(q, suiteFixe(1)), [1, 3, 0, 2])
  const [jouee] = preparerPartie([q], { melangerReponses: true }, suiteFixe(1)) as [Choix]
  assert.deepEqual(jouee.answers, ['3 500', '12 000', '35 000', '60 000'])
  assert.equal(jouee.answers[jouee.correct], '35 000')
  // Avec leur unité aussi : « 2 ans », « 10 ans ».
  const ages = qcm('Quel âge ?', ['10 ans', '2 ans', '5 ans'], 2)
  assert.deepEqual((preparerPartie([ages], { melangerReponses: true }) as any)[0].answers, ['2 ans', '5 ans', '10 ans'])
})

test('les questions mélangées : les mêmes, dans un autre ordre', () => {
  const questions = Array.from({ length: 8 }, (_, i) => qcm(`Q${i + 1} ?`, ['a', 'b'], 0))
  const jouees = preparerPartie(questions, { melangerQuestions: true }, suiteFixe(11))
  assert.deepEqual(jouees.map(q => q.text).sort(), questions.map(q => q.text).sort())
  assert.notDeepEqual(jouees.map(q => q.text), questions.map(q => q.text))
})

test('les réglages se lisent sans rien croire : ce qui ne se lit pas vaut « non »', () => {
  assert.deepEqual(normaliserReglages(null), {})
  assert.deepEqual(normaliserReglages({ melangerReponses: 'oui', melangerQuestions: 1, tirage: 3 }), {})
  assert.deepEqual(normaliserReglages({ melangerReponses: true, melangerQuestions: true, tirage: 15 }), {
    melangerReponses: true,
    melangerQuestions: true,
    tirage: 15,
  })
  assert.deepEqual(normaliserReglages({ tirage: 1000 }), {})
})

test('« ordre fixe » passe de l’éditeur à la question jouable', () => {
  const [q] = playableQuestions({
    id: 'x',
    title: 'x',
    updatedAt: 0,
    questions: normalizeQuestions([{ kind: 'choice', text: 'Q ?', answers: ['a', 'b'], correct: 0, duration: 20, ordreFixe: true }]),
  })
  assert.equal((q as any).ordreFixe, true)
  const [sans] = playableQuestions({
    id: 'y',
    title: 'y',
    updatedAt: 0,
    questions: normalizeQuestions([{ kind: 'choice', text: 'Q ?', answers: ['a', 'b'], correct: 0, duration: 20 }]),
  })
  assert.equal('ordreFixe' in sans, false, 'absent, il ne pèse rien dans la copie jouée')
})

test('les réglages voyagent : dans le fichier d’un quiz, et dans le brouillon du navigateur', async () => {
  const quiz = {
    id: 'q1',
    title: 'Mélangé',
    updatedAt: 1,
    reglages: { melangerReponses: true },
    questions: normalizeQuestions([{ kind: 'choice', text: 'Q ?', answers: ['a', 'b'], correct: 0, duration: 20 }]),
  }
  const fichier = await emporterQuiz(quiz, async () => null)
  assert.deepEqual(fichier.reglages, { melangerReponses: true })
  const deballe = deballerQuiz(JSON.parse(JSON.stringify(fichier)))
  assert.ok(!('erreur' in deballe))
  if (!('erreur' in deballe)) assert.deepEqual(deballe.reglages, { melangerReponses: true })
  let recus: unknown = null
  await importerQuiz(JSON.parse(JSON.stringify(fichier)), {
    envoyerPhoto: async () => '/media/image/x',
    creer: async (_titre, _questions, reglages) => {
      recus = reglages
      return {}
    },
  })
  assert.deepEqual(recus, { melangerReponses: true }, 'l’import crée le quiz avec ses réglages')
  // Un fichier d'avant n'a pas de réglages : il se joue tel qu'écrit.
  const { reglages: _r, ...ancien } = fichier
  const vieux = deballerQuiz(JSON.parse(JSON.stringify(ancien)))
  if (!('erreur' in vieux)) assert.deepEqual(vieux.reglages, {})

  // Le brouillon garde les réglages ; changer seulement l'ordre est une modification.
  const brouillon = lireBrouillon(emballerBrouillon(quiz, 1, 2), 'q1')!
  assert.deepEqual(brouillon.reglages, { melangerReponses: true })
  assert.equal(brouillonUtile(brouillon, { ...quiz, reglages: {} }), true)
  assert.equal(brouillonUtile(brouillon, quiz), false)
})

// ── Sur un vrai serveur ───────────────────────────────────────────────────

const bancs: Banc[] = []
after(async () => {
  for (const b of bancs) await b.close()
})

test('une partie mélangée : l’écran et le téléphone voient le même ordre, le bilan le relit', async () => {
  const banc = await demarrer()
  bancs.push(banc)
  const cookie = await connexionAnimateur(banc.url)
  const cree = (await (await ecrire(banc.url, '/api/quizzes', { title: 'Mélangé', reglages: { melangerReponses: true } }, cookie)).json()) as any
  assert.deepEqual(cree.reglages, { melangerReponses: true }, 'les réglages naissent avec le quiz')
  const questions = Array.from({ length: 5 }, (_, i) => ({
    kind: 'choice',
    text: `Question ${i + 1} ?`,
    answers: ['Juste', 'Faux 1', 'Faux 2', 'Faux 3'],
    correct: 0,
    duration: 20,
  }))
  const saved = await ecrire(banc.url, `/api/quizzes/${cree.id}`, { title: 'Mélangé', questions, reglages: { melangerReponses: true } }, cookie, 'PUT')
  assert.equal(saved.status, 200)
  const relu = (await (await fetch(`${banc.url}/api/quizzes/${cree.id}`, { headers: { Cookie: cookie } })).json()) as any
  assert.deepEqual(relu.reglages, { melangerReponses: true })

  const host = await ecranCommun(banc.url, cookie)
  const alice = await invite(banc.url, 'Alice')
  const sessionId = await lancerQuiz(host, cree.id)
  const vuesHote: any[] = []
  for (let i = 0; i < 5; i++) {
    // Les deux écoutes se posent ensemble : la vue du téléphone arrive
    // souvent avant celle de l'écran, et une écoute posée après la raterait.
    const [v, tel] = (
      await Promise.all([
        attendre<any>(host, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === i, `question ${i + 1}`),
        attendre<any>(alice.socket, 'session:view', p => p.view.phase === 'question' && p.view.qIndex === i, `téléphone ${i + 1}`),
      ])
    ).map(p => p.view)
    assert.deepEqual(tel.answers, v.answers, 'le téléphone voit l’ordre de l’écran')
    vuesHote.push(v)
    // Alice répond « Juste », où qu'il soit.
    const choix = v.answers.indexOf('Juste')
    const revelation = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal' && p.view.qIndex === i, `révélation ${i + 1}`)
    const ack = await emitAck<any>(alice.socket, 'player:action', { sessionId, action: { type: 'answer', choice: choix, qIndex: v.qIndex, round: v.round } })
    assert.equal(ack.ok, true)
    const r = (await revelation).view
    assert.equal(r.answers[r.correct], 'Juste', 'la révélation désigne la bonne réponse à sa place jouée')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'reveal', qIndex: i, round: r.round } })
  }
  // Au moins une question a bougé : sinon le test ne dit rien.
  assert.ok(vuesHote.some(v => v.answers[0] !== 'Juste'), 'au moins une bonne réponse a quitté la première place')

  await patienter(300)
  // Le bilan relit la copie jouée : chaque bonne réponse, et chaque choix
  // d'Alice, désignent « Juste » à la place où la salle l'a vu.
  const bilan = (await (await fetch(`${banc.url}/s/banc/bilan.json`)).json()) as any
  assert.equal(bilan.questions.length, 5)
  const parCle = new Map<string, any>(bilan.questions.map((q: any) => [q.key, q]))
  for (const q of bilan.questions) {
    assert.equal(q.answers[q.correct], 'Juste', q.text)
    assert.equal(q.uncertain, false, 'la copie exacte fait foi')
  }
  const a = bilan.players.find((p: any) => p.name === 'Alice')
  assert.equal(a.answers.length, 5)
  for (const r of a.answers) {
    assert.equal(r.correct, true)
    assert.equal(parCle.get(r.questionKey).answers[r.choice], 'Juste')
  }

  // L'export de secours, qui lit la base sans le serveur, relit la copie
  // jouée gardée au miroir — la bibliothèque, elle, garde l'ordre écrit.
  const depuisLaBase = await attendreQue(async () => {
    const r = await reviewFromDatabase(banc.quizDbUrl, undefined, { slug: 'banc' })
    return r.questions.length === 5 ? r : null
  })
  for (const q of depuisLaBase.questions) {
    assert.equal(q.uncertain, false, q.text)
    assert.equal(q.answers[q.correct!], 'Juste', q.text)
  }

  // Supprimé de la bibliothèque, le quiz se relit encore par sa copie.
  assert.equal((await ecrire(banc.url, `/api/quizzes/${cree.id}`, {}, cookie, 'DELETE')).status, 200)
  const sansLeQuiz = await reviewFromDatabase(banc.quizDbUrl, undefined, { slug: 'banc' })
  assert.equal(sansLeQuiz.questions.length, 5)
  for (const q of sansLeQuiz.questions) {
    assert.equal(q.resolved, true, q.text)
    assert.equal(q.quizTitle, 'Mélangé')
    assert.equal(q.answers[q.correct!], 'Juste', q.text)
  }
})

/** Relit jusqu'à ce que le miroir ait rattrapé la soirée. */
async function attendreQue<T>(lire: () => Promise<T | null>, delaiMs = 8000): Promise<T> {
  const fin = Date.now() + delaiMs
  for (;;) {
    const r = await lire()
    if (r) return r
    if (Date.now() > fin) throw new Error('le miroir n’a pas rattrapé la soirée')
    await patienter(150)
  }
}
