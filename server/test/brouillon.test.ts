// L'éditeur face à l'hébergeur qui s'endort.
//
// Sans requête pendant un quart d'heure, l'offre gratuite de l'hébergeur
// endort le serveur, et l'éditeur n'en fait aucune pendant qu'on écrit. Le
// premier « Enregistrer » qui suivait attendait vingt secondes un réveil qui
// en prend soixante, disait « vérifie ta connexion » — et qui rechargeait
// alors la page perdait tout ce qu'il avait écrit depuis le dernier
// enregistrement.
//
// Ce qui le rattrape, vérifié ici : le serveur ne perd rien au réveil ;
// l'enregistrement insiste le temps que le serveur se réveille
// (`shared/reveil.ts`) ; et le navigateur garde un brouillon de ce qui n'est
// pas encore enregistré (`shared/brouillon.ts`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, demarrer, ecrire, qcm } from './banc'
import {
  brouillonDepasse,
  brouillonUtile,
  emballerBrouillon,
  lireBrouillon,
  photosAVerifier,
  sansPhotosDisparues,
} from '../../shared/brouillon'
import {
  MIN_DURATION,
  cleanTitle,
  emptyQuestion,
  normalizeQuestions,
  type QuizDef,
  type QuizQuestionDef,
} from '../../shared/library'
import { ATTENTE_REVEIL_MS, PAUSE_REVEIL_MS, enAttendantLeReveil } from '../../shared/reveil'
import { echecPassager, statutPassager } from '../../shared/erreurs'

const PHOTO = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]).toString('base64')}`

// ── 1. Le serveur, au réveil ──────────────────────────────────────────────

test('au réveil sur disque effacé, « Enregistrer » passe avec la session d’avant, photo comprise', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    // Le quiz existe dès « Nouveau quiz », la photo dès qu'on la choisit : le
    // reste de la saisie n'attend que dans l'onglet.
    const cree = await ecrire(banc.url, '/api/quizzes', { title: 'Nouveau quiz' }, cookie)
    const { id } = (await cree.json()) as { id: string }
    const envoi = await ecrire(banc.url, '/api/images', { dataUrl: PHOTO }, cookie)
    const { url: photo } = (await envoi.json()) as { url: string }

    // Un quart d'heure à écrire sans une requête : l'hébergeur s'endort, et son disque s'efface.
    await banc.redemarrer({ disqueEfface: true })

    const questions = [{ ...qcm('Où est-ce ?'), image: photo }, qcm('Et la deuxième ?')]
    const res = await ecrire(banc.url, `/api/quizzes/${id}`, { title: 'Le quiz du réveil', questions }, cookie, 'PUT')
    assert.equal(res.status, 200, 'la session d’avant la veille ouvre encore la porte')
    const relu = (await (await fetch(`${banc.url}/api/quizzes/${id}`, { headers: { Cookie: cookie } })).json()) as QuizDef
    assert.equal(relu.title, 'Le quiz du réveil')
    assert.deepEqual(
      relu.questions.map(q => q.text),
      ['Où est-ce ?', 'Et la deuxième ?'],
    )
    assert.equal(relu.questions[0].image, photo)
    assert.equal((await fetch(`${banc.url}${photo}`)).status, 200, 'la photo envoyée avant la veille est toujours servie')
  } finally {
    await banc.close()
  }
})

// ── 2. L'enregistrement qui attend le réveil ─────────────────────────────

/** Une horloge qu'on avance à la main : deux minutes d'attente se jouent en un instant. */
function horloge() {
  let t = 0
  const dormi: number[] = []
  return {
    dormi,
    maintenant: () => t,
    avancer: (ms: number) => {
      t += ms
    },
    dormir: async (ms: number) => {
      dormi.push(ms)
      t += ms
    },
  }
}

/** Ce que lève le client quand il renonce, au bout de ses vingt secondes. */
const delaiDepasse = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' })

test('« Enregistrer » attend le réveil : trois délais dépassés, puis le serveur répond', async () => {
  const h = horloge()
  let essais = 0
  let prevenu = 0
  const rendu = await enAttendantLeReveil(
    async () => {
      essais++
      // Le client renonce à vingt secondes ; le serveur répond à partir de la soixantième.
      if (h.maintenant() < 60_000) {
        h.avancer(20_000)
        throw delaiDepasse()
      }
      return 'enregistré'
    },
    { passager: echecPassager, surAttente: () => prevenu++, maintenant: h.maintenant, dormir: h.dormir },
  )
  assert.equal(rendu, 'enregistré')
  assert.equal(essais, 4)
  assert.equal(prevenu, 1, 'l’attente se dit une fois, pas à chaque essai')
  assert.ok(
    h.dormi.every(ms => ms === 0),
    'un délai dépassé a déjà attendu : l’essai suivant part aussitôt',
  )
})

test('un 503 immédiat laisse souffler l’hébergeur entre deux essais', async () => {
  const h = horloge()
  let essais = 0
  const indisponible = Object.assign(new Error('Service Unavailable'), { statut: 503 })
  const rendu = await enAttendantLeReveil(
    async () => {
      if (++essais < 4) throw indisponible
      return 'enregistré'
    },
    {
      passager: e => statutPassager((e as { statut?: number }).statut ?? 0),
      maintenant: h.maintenant,
      dormir: h.dormir,
    },
  )
  assert.equal(rendu, 'enregistré')
  assert.deepEqual(h.dormi, [PAUSE_REVEIL_MS, PAUSE_REVEIL_MS, PAUSE_REVEIL_MS])
})

test('un refus du serveur ne se rejoue pas, et ne fait rien attendre', async () => {
  const h = horloge()
  let essais = 0
  let prevenu = 0
  const refus = new Error('Quiz introuvable')
  await assert.rejects(
    enAttendantLeReveil(
      async () => {
        essais++
        throw refus
      },
      { passager: echecPassager, surAttente: () => prevenu++, maintenant: h.maintenant, dormir: h.dormir },
    ),
    (e: unknown) => e === refus,
  )
  assert.equal(essais, 1)
  assert.equal(prevenu, 0)
  assert.equal(h.maintenant(), 0)
})

test('au bout de deux minutes, on renonce — avec le dernier motif, qui dit quoi faire', async () => {
  const h = horloge()
  let derniere: Error | null = null
  let essais = 0
  await assert.rejects(
    enAttendantLeReveil(
      async () => {
        essais++
        h.avancer(20_000)
        derniere = delaiDepasse()
        throw derniere
      },
      { passager: echecPassager, maintenant: h.maintenant, dormir: h.dormir },
    ),
    (e: unknown) => e === derniere,
  )
  assert.equal(h.maintenant(), ATTENTE_REVEIL_MS, 'aucun essai n’est entamé après le délai')
  assert.equal(essais, ATTENTE_REVEIL_MS / 20_000)
})

test('l’éditeur refermé pendant l’attente, on cesse d’insister', async () => {
  const h = horloge()
  let essais = 0
  let ouvert = true
  await assert.rejects(
    enAttendantLeReveil(
      async () => {
        essais++
        h.avancer(20_000)
        throw delaiDepasse()
      },
      {
        passager: echecPassager,
        continuer: () => ouvert,
        maintenant: h.maintenant,
        // L'animateur quitte l'éditeur pendant la pause.
        dormir: async () => {
          ouvert = false
        },
      },
    ),
  )
  assert.equal(essais, 1)
})

// ── 3. Le brouillon du navigateur ─────────────────────────────────────────

/** L'éditeur tel qu'on le laisse en pleine saisie : un titre à espaces, un temps effacé. */
function enCours(): QuizDef {
  const qcmEnCours: QuizQuestionDef = {
    ...emptyQuestion(),
    text: 'Capitale de l’Australie ?',
    answers: ['Sydney', 'Canberra', '', ''],
    correct: 1,
  }
  const estimationEnCours: QuizQuestionDef = {
    ...emptyQuestion(),
    kind: 'number',
    text: 'Hauteur de la tour Eiffel ?',
    target: 330,
    unit: 'm',
    duration: 0,
  }
  return { id: 'quiz-1', title: '  Quiz du dimanche ', questions: [qcmEnCours, estimationEnCours], updatedAt: 1_000 }
}

test('un brouillon se relit comme « Enregistrer » l’aurait gardé', () => {
  const quiz = enCours()
  const lu = lireBrouillon(emballerBrouillon(quiz, 1_000, 5_000), 'quiz-1')
  assert.ok(lu)
  assert.equal(lu.title, 'Quiz du dimanche')
  assert.deepEqual(lu.questions, normalizeQuestions(quiz.questions))
  assert.equal(lu.questions[1].duration, MIN_DURATION, 'le temps effacé, recalé comme au serveur')
  assert.equal(lu.questions[0].id, quiz.questions[0].id, 'chaque carte garde son identifiant')
  assert.equal(lu.base, 1_000)
  assert.equal(lu.at, 5_000)
})

test('un brouillon abîmé, d’un autre quiz ou d’un autre format est ignoré', () => {
  const bon = JSON.parse(emballerBrouillon(enCours(), 1_000, 5_000))
  const ignores = [
    null,
    '',
    'pas du json',
    '42',
    'null',
    '[]',
    JSON.stringify({ ...bon, id: 'quiz-2' }),
    JSON.stringify({ ...bon, v: 2 }),
    JSON.stringify({ ...bon, questions: 'Capitale ?' }),
    JSON.stringify({ ...bon, base: '1000' }),
    JSON.stringify({ ...bon, at: undefined }),
  ]
  for (const brut of ignores) assert.equal(lireBrouillon(brut, 'quiz-1'), null, String(brut))

  // Des questions abîmées, elles, se relisent en questions sûres : l'éditeur
  // ne tombe pas, et une image qui ne vient pas du serveur ne passe pas.
  const abime = lireBrouillon(
    JSON.stringify({ ...bon, title: 42, questions: [{ text: 7, answers: 'Oui', correct: 9, image: 'javascript:alert(1)' }, null] }),
    'quiz-1',
  )
  assert.ok(abime)
  assert.equal(abime.title, '42')
  assert.equal(abime.questions.length, 2)
  for (const q of abime.questions) {
    assert.equal(q.text, '')
    assert.deepEqual(q.answers, ['', '', '', ''])
    assert.equal(q.correct, 0)
    assert.equal(q.image, null)
  }
})

test('un brouillon identique à ce que le serveur a gardé s’efface sans rien demander', () => {
  const quiz = enCours()
  // L'enregistrement est passé, mais sa réponse s'est perdue en route : le
  // serveur a gardé le quiz, relu à sa façon.
  const serveur: QuizDef = {
    ...quiz,
    title: cleanTitle(quiz.title),
    questions: normalizeQuestions(quiz.questions),
    updatedAt: 2_000,
  }
  const brouillon = lireBrouillon(emballerBrouillon(quiz, 1_000, 5_000), quiz.id)!
  assert.equal(brouillonUtile(brouillon, serveur), false)

  const [capitale, tour] = quiz.questions
  const reponse = lireBrouillon(
    emballerBrouillon({ ...quiz, questions: [{ ...capitale, answers: ['Sydney', 'Canberra', 'Melbourne', ''] }, tour] }, 1_000, 5_000),
    quiz.id,
  )!
  assert.equal(brouillonUtile(reponse, serveur), true, 'une réponse ajoutée')
  const titre = lireBrouillon(emballerBrouillon({ ...quiz, title: 'Quiz du lundi' }, 1_000, 5_000), quiz.id)!
  assert.equal(brouillonUtile(titre, serveur), true, 'un titre changé')
  const ordre = lireBrouillon(emballerBrouillon({ ...quiz, questions: [tour, capitale] }, 1_000, 5_000), quiz.id)!
  assert.equal(brouillonUtile(ordre, serveur), true, 'deux questions échangées')
})

test('un quiz enregistré ailleurs depuis se signale avant qu’on reprenne', () => {
  const brouillon = lireBrouillon(emballerBrouillon(enCours(), 1_000, 5_000), 'quiz-1')!
  assert.equal(brouillonDepasse(brouillon, { updatedAt: 1_000 }), false, 'la version d’où il est parti')
  assert.equal(brouillonDepasse(brouillon, { updatedAt: 3_000 }), true, 'enregistré depuis, d’un autre appareil')
})

test('une photo jamais enregistrée se vérifie, et disparue, elle part avec sa photo « mémoire »', () => {
  const enregistree = '/media/image/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const neuve = '/media/image/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const quiz = enCours()
  const serveur: QuizDef = { ...quiz, questions: [{ ...quiz.questions[0], image: enregistree }] }
  const avec = (image: string | null, observeSeconds: number | null = null): QuizQuestionDef => ({
    ...emptyQuestion(),
    text: 'Où est-ce ?',
    answers: ['Ici', 'Là', '', ''],
    image,
    observeSeconds,
  })
  const brouillon = lireBrouillon(
    emballerBrouillon({ ...quiz, questions: [avec(enregistree), avec(neuve, 5), avec(neuve), avec(null)] }, 1_000, 5_000),
    quiz.id,
  )!
  assert.deepEqual(
    photosAVerifier(brouillon, serveur),
    [neuve],
    'celle que la version enregistrée cite ne risque rien, et une photo citée deux fois se vérifie une fois',
  )

  const { questions, privees } = sansPhotosDisparues(brouillon.questions, new Set([neuve]))
  assert.deepEqual(
    questions.map(q => q.image),
    [enregistree, null, null, null],
  )
  assert.equal(questions[1].observeSeconds, null, 'plus de photo, plus rien à observer')
  assert.deepEqual(privees, [brouillon.questions[1].id, brouillon.questions[2].id])
  assert.equal(
    sansPhotosDisparues(brouillon.questions, new Set()).questions[0],
    brouillon.questions[0],
    'rien de disparu, rien de retouché',
  )
})
