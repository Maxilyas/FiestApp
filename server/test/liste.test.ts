// La liste collée, et le format qu'on donne à écrire à quelqu'un d'autre.
//
// Qui voulait faire écrire un quiz — par un ami, par une IA — n'avait pour
// format qu'un exemple de trois questions : ni le temps, ni la photo, ni la
// liste des catégories, que la liste collée ne savait d'ailleurs pas lire.
// Elle lit maintenant « Temps », « Photo » et « Observation » sous
// l'intitulé ; le format complet se copie d'un bouton, et son exemple se relit
// ici tel quel. Une liste écrite ailleurs arrive sans ses photos : la question
// garde celle qu'elle attend, ne se joue pas sans, et les fichiers choisis en
// collant la liste rejoignent leur question par leur nom. Chaque test
// échouait avant, sauf celui qui garde l'intitulé en première ligne : il
// veille à ce que la nouvelle lecture ne le prenne pas pour un réglage.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { connexionAnimateur, creerQuiz, demarrer, ecrire, qcm } from './banc'
import {
  DEFAULT_DURATION,
  MAX_DURATION,
  MAX_OBSERVE,
  MAX_PHOTO_ATTENDUE,
  MIN_DURATION,
  emptyQuestion,
  normalizeQuestions,
  parseImportedQuestions,
  questionProblem,
  toPlayable,
  type QuizQuestionDef,
} from '../../shared/library'
import { CATEGORIES } from '../../shared/categories'
import { brouillonUtile, emballerBrouillon, lireBrouillon } from '../../shared/brouillon'
import {
  APERCU_DU_FORMAT,
  EXEMPLE_DU_FORMAT,
  FORMAT_DE_LISTE,
  apparierPhotos,
  cleDePhoto,
  joindrePhotos,
} from '../../shared/liste'

/** Une photo d'un pixel, telle que le navigateur l'envoie. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** Une seule question collée, lue. */
function une(...lignes: string[]): QuizQuestionDef {
  const { questions, ignored } = parseImportedQuestions(lignes.join('\n'))
  assert.equal(questions.length, 1, `une question attendue dans « ${lignes.join(' / ')} »`)
  assert.equal(ignored, 0)
  return questions[0]
}

// ── 1. Le format qu'on donne à écrire ─────────────────────────────────────

test('l’exemple du format complet se relit tel quel, chaque possibilité comprise', () => {
  const { questions, unmarked, ignored } = parseImportedQuestions(EXEMPLE_DU_FORMAT)
  assert.equal(unmarked, 0)
  assert.equal(ignored, 0)
  assert.deepEqual(
    questions.map(q => ({
      kind: q.kind,
      reponse: q.kind === 'number' ? `${q.target} ${q.unit}`.trim() : q.answers[q.correct],
      choix: q.answers.filter(Boolean).length,
      temps: q.duration,
      categorie: q.category,
      photo: q.photoAttendue,
      observation: q.observeSeconds,
    })),
    [
      { kind: 'choice', reponse: 'Canberra', choix: 4, temps: 20, categorie: 'Géographie', photo: null, observation: null },
      { kind: 'number', reponse: '8849 m', choix: 0, temps: 30, categorie: 'Géographie', photo: null, observation: null },
      { kind: 'choice', reponse: 'Vrai', choix: 2, temps: 20, categorie: 'Histoire', photo: null, observation: null },
      { kind: 'number', reponse: '1969', choix: 0, temps: 20, categorie: 'Histoire', photo: null, observation: null },
      { kind: 'choice', reponse: 'Titanic', choix: 4, temps: 15, categorie: 'Cinéma & séries', photo: 'titanic.jpg', observation: null },
      {
        kind: 'number',
        reponse: '30 bougies',
        choix: 0,
        temps: 20,
        categorie: 'Autour de la fête',
        photo: "le gâteau d'anniversaire, bougies allumées",
        observation: 5,
      },
    ],
  )
})

test('l’aperçu sous le champ se relit aussi, et le format annonce toutes les bornes et toutes les catégories', () => {
  const apercu = parseImportedQuestions(APERCU_DU_FORMAT)
  assert.equal(apercu.ignored, 0)
  assert.equal(apercu.unmarked, 0)
  assert.deepEqual(
    apercu.questions.map(q => [q.kind, q.duration, q.photoAttendue]),
    [
      ['choice', 20, null],
      ['choice', 30, 'tour-eiffel.jpg'],
      ['number', 20, null],
    ],
  )
  for (const c of CATEGORIES) assert.ok(FORMAT_DE_LISTE.includes(c), `la catégorie « ${c} » manque au format`)
  for (const borne of ['300 caractères', '120 caractères', '12 caractères', '100 questions', 'de 2 à 4 réponses', 'de 5 à 120 secondes', 'de 2 à 30 secondes']) {
    assert.ok(FORMAT_DE_LISTE.includes(borne), `le format doit dire « ${borne} »`)
  }
  assert.ok(FORMAT_DE_LISTE.trimEnd().endsWith(EXEMPLE_DU_FORMAT), 'le format se termine par son exemple')
})

// ── 2. Les réglages sous l'intitulé ───────────────────────────────────────

test('le temps se lit en secondes ou en minutes, borné comme dans l’éditeur', () => {
  const temps = (valeur: string) => une('Question ?', '* Oui', 'Non', `Temps : ${valeur}`).duration
  assert.equal(temps('45'), 45)
  assert.equal(temps('45 s'), 45)
  assert.equal(temps('45s'), 45)
  assert.equal(temps('45 secondes'), 45)
  assert.equal(temps('1 min'), 60)
  assert.equal(temps('1,5 minute'), 90)
  assert.equal(temps('500'), MAX_DURATION)
  assert.equal(temps('2 s'), MIN_DURATION)
  // Illisible, il garde celui de la voisine — et la question n'est pas perdue.
  assert.equal(temps('vite'), DEFAULT_DURATION)
  assert.equal(temps('0'), DEFAULT_DURATION)
  assert.equal(temps('30 à 45 s'), DEFAULT_DURATION)
  // Le mot se lit sans accent ni majuscule, les deux-points après une insécable.
  assert.equal(une('Question ?', 'Oui', 'Non', 'DURÉE : 40').duration, 40)
  assert.equal(une('Question ?', 'Oui', 'Non', 'duree:40').duration, 40)
  assert.equal(une('Question ?', 'Oui', 'Non', 'temps : 25 s').duration, 25)
})

test('un réglage ne compte jamais parmi les réponses, où qu’il soit sous l’intitulé', () => {
  const q = une('Capitale de l’Australie ?', 'Temps : 30 s', 'Sydney', 'Photo : carte.png', '* Canberra', 'Observation : 3 s')
  assert.deepEqual(q.answers, ['Sydney', 'Canberra', '', ''])
  assert.equal(q.correct, 1)
  assert.equal(q.duration, 30)
  assert.equal(q.photoAttendue, 'carte.png')
  assert.equal(q.observeSeconds, 3)

  const estimation = une('Altitude de l’Everest ?', 'Temps : 1 min', '= 8 849 m')
  assert.deepEqual([estimation.kind, estimation.target, estimation.unit, estimation.duration], ['number', 8849, 'm', 60])

  // Sans réponse une fois les réglages retirés, le bloc ne fait pas une question.
  const seul = parseImportedQuestions('Question ?\nTemps : 30 s\nPhoto : x.jpg')
  assert.deepEqual([seul.questions.length, seul.ignored], [0, 1])
})

test('la première ligne reste l’intitulé, même quand elle ressemble à un réglage', () => {
  const q = une('Photo : qui est-ce ?', '* Doisneau', 'Cartier-Bresson')
  assert.equal(q.text, 'Photo : qui est-ce ?')
  assert.equal(q.photoAttendue, null)
  assert.deepEqual(q.answers, ['Doisneau', 'Cartier-Bresson', '', ''])
})

test('la photo s’annonce par son nom ou par ce qu’elle montre ; « aucune » n’en est pas une', () => {
  assert.equal(une('Q ?', 'Oui', 'Non', 'Photo : tour-eiffel.jpg').photoAttendue, 'tour-eiffel.jpg')
  assert.equal(une('Q ?', 'Oui', 'Non', 'Image : La tour Eiffel, de nuit').photoAttendue, 'La tour Eiffel, de nuit')
  for (const rien of ['aucune', 'Aucune', 'non', 'sans', '-', '—', '']) {
    assert.equal(une('Q ?', 'Oui', 'Non', `Photo : ${rien}`).photoAttendue, null, `« Photo : ${rien} »`)
  }
  const longue = une('Q ?', 'Oui', 'Non', `Photo : ${'x'.repeat(500)}`).photoAttendue ?? ''
  assert.equal(Array.from(longue).length, MAX_PHOTO_ATTENDUE)
})

test('l’observation demande une photo, et une valeur lisible — sinon la photo reste affichée', () => {
  const observation = (valeur: string, photo = 'Photo : gateau.jpg') =>
    une('Combien de bougies ?', photo, `Observation : ${valeur}`, '= 12').observeSeconds
  assert.equal(observation('5 s'), 5)
  assert.equal(observation('10'), 10)
  assert.equal(observation('90'), MAX_OBSERVE)
  assert.equal(observation('1 s'), 2)
  assert.equal(observation('aucune'), null, 'une photo qui disparaît sans qu’on l’ait voulu gâche la question')
  assert.equal(observation('0'), null)
  assert.equal(observation('5 s', 'Temps : 20'), null, 'sans photo, rien à observer')
  assert.equal(une('Q ?', 'Photo : a.jpg', 'Mémoire : 4 s', 'Oui', 'Non').observeSeconds, 4)
})

test('la réponse d’une IA dans un bloc de code se colle telle quelle', () => {
  const { questions, ignored } = parseImportedQuestions(
    ['```text', '# Musique', '', 'Qui chante Thriller ?', '* Michael Jackson', 'Prince', '```'].join('\n'),
  )
  assert.equal(ignored, 0)
  assert.equal(questions.length, 1)
  assert.equal(questions[0].text, 'Qui chante Thriller ?')
  assert.equal(questions[0].category, 'Musique')
  // Collée sans ligne vide après la clôture, pareil.
  const serree = parseImportedQuestions('```\nQui chante Thriller ?\n* Michael Jackson\nPrince\n```')
  assert.deepEqual([serree.questions.length, serree.ignored, serree.questions[0].text], [1, 0, 'Qui chante Thriller ?'])
})

// ── 3. La question qui attend sa photo ────────────────────────────────────

test('une question qui attend sa photo ne se joue pas, et le dit', () => {
  const attend: QuizQuestionDef = { ...emptyQuestion(), text: 'Quel est ce monument ?', answers: ['Tour Eiffel', 'Big Ben', '', ''], photoAttendue: 'tour-eiffel.jpg' }
  assert.equal(toPlayable(attend), null)
  assert.match(questionProblem(attend) ?? '', /Il manque la photo « tour-eiffel\.jpg »/)
  // Jointe, la photo l'emporte sur la note ; retirée à la main, la question se joue sans.
  assert.equal(toPlayable({ ...attend, image: '/media/image/abc' })?.image, '/media/image/abc')
  assert.equal(questionProblem({ ...attend, image: '/media/image/abc' }), null)
  assert.equal(toPlayable({ ...attend, photoAttendue: null })?.image, null)
  // Les autres manques passent devant : l'intitulé, les réponses.
  assert.match(questionProblem({ ...attend, answers: ['Tour Eiffel', '', '', ''] }) ?? '', /au moins 2 réponses/)
  const estimation: QuizQuestionDef = { ...emptyQuestion(), kind: 'number', text: 'Combien ?', target: 12, photoAttendue: 'gateau.jpg' }
  assert.equal(toPlayable(estimation), null)
  assert.match(questionProblem(estimation) ?? '', /gateau\.jpg/)
})

test('le serveur garde la photo attendue, bornée, et l’oublie quand la photo arrive', () => {
  const [attend, jointe, rien, longue] = normalizeQuestions([
    { text: 'Un ?', answers: ['a', 'b'], photoAttendue: '  tour-eiffel.jpg  ' },
    { text: 'Deux ?', answers: ['a', 'b'], photoAttendue: 'tour-eiffel.jpg', image: '/media/image/abc' },
    { text: 'Trois ?', answers: ['a', 'b'], photoAttendue: 42 },
    { text: 'Quatre ?', answers: ['a', 'b'], photoAttendue: 'x'.repeat(1000) },
  ])
  assert.equal(attend.photoAttendue, 'tour-eiffel.jpg')
  assert.equal(jointe.photoAttendue, null)
  assert.equal(jointe.image, '/media/image/abc')
  assert.equal(rien.photoAttendue, null)
  assert.equal(Array.from(longue.photoAttendue ?? '').length, MAX_PHOTO_ATTENDUE)
})

test('le brouillon du navigateur garde la photo qu’une question attend', () => {
  // Collée, puis le serveur endormi à l'enregistrement : le brouillon qu'on
  // reprend doit encore dire quelle photo manque, et à quelle question.
  const { questions } = parseImportedQuestions(APERCU_DU_FORMAT)
  const relu = lireBrouillon(emballerBrouillon({ id: 'quiz-colle', title: 'Collé', questions }, 1, 2), 'quiz-colle')
  assert.deepEqual(
    relu?.questions.map(q => q.photoAttendue),
    [null, 'tour-eiffel.jpg', null],
  )
  const sansNote = questions.map(q => ({ ...q, photoAttendue: null }))
  assert.ok(brouillonUtile(relu!, { title: 'Collé', questions: sansNote }), 'une photo attendue de plus est une modification à reprendre')
})

// ── 4. Les photos jointes en collant la liste ─────────────────────────────

test('un nom de fichier se reconnaît sans casse, sans accent, avec ou sans extension', () => {
  assert.equal(cleDePhoto('Tour_Eiffel.JPG'), cleDePhoto('tour-eiffel'))
  assert.equal(cleDePhoto('Tour Eiffel.jpeg'), cleDePhoto('tour-eiffel.jpg'))
  assert.equal(cleDePhoto('gâteau.png'), cleDePhoto('gateau.webp'))
  // Le Mac écrit ses noms de fichier en lettres décomposées.
  assert.equal(cleDePhoto('gâteau.png'), cleDePhoto('gâteau'))
  assert.notEqual(cleDePhoto('titanic.jpg'), cleDePhoto('titanic-2.jpg'))
  assert.equal(cleDePhoto('!!!.jpg'), '')
})

test('chaque photo rejoint sa question, part une seule fois, et celle qui échoue laisse sa question l’attendre', async () => {
  const { questions } = parseImportedQuestions(
    [
      'Quel est ce monument ?', 'Photo : tour-eiffel.jpg', '* Tour Eiffel', 'Big Ben', '',
      'Et de nuit ?', 'Photo : Tour Eiffel', '* Oui', 'Non', '',
      'De quel film ?', 'Photo : titanic.jpg', '* Titanic', 'Avatar', '',
      'Combien de bougies ?', 'Photo : le gâteau, bougies allumées', 'Observation : 5 s', '= 30', '',
      'Sans photo ?', '* Oui', 'Non',
    ].join('\n'),
  )
  const fichiers = [{ name: 'TOUR_EIFFEL.JPG' }, { name: 'titanic.png' }, { name: 'vacances.jpg' }]
  assert.deepEqual(
    apparierPhotos(questions, fichiers).map(f => f?.name ?? null),
    ['TOUR_EIFFEL.JPG', 'TOUR_EIFFEL.JPG', 'titanic.png', null, null],
  )

  const envoyees: string[] = []
  const etapes: string[] = []
  const fait = await joindrePhotos(
    questions,
    fichiers,
    async f => {
      envoyees.push(f.name)
      if (f.name === 'titanic.png') throw new Error('réseau coupé')
      return `/media/image/${f.name}`
    },
    (faites, total) => etapes.push(`${faites}/${total}`),
  )
  assert.deepEqual(envoyees, ['TOUR_EIFFEL.JPG', 'titanic.png'], 'une photo montrée deux fois ne part qu’une fois')
  assert.deepEqual(etapes, ['1/2', '2/2'])
  assert.deepEqual(fait.echecs, ['titanic.png'])
  assert.deepEqual(
    fait.questions.map(q => [q.image, q.photoAttendue]),
    [
      ['/media/image/TOUR_EIFFEL.JPG', null],
      ['/media/image/TOUR_EIFFEL.JPG', null],
      [null, 'titanic.jpg'],
      [null, 'le gâteau, bougies allumées'],
      [null, null],
    ],
  )
  assert.equal(fait.questions[3].observeSeconds, 5, 'l’observation attend la photo avec la question')
  assert.equal(fait.questions.filter(q => toPlayable(q) !== null).length, 3, 'les deux questions sans leur photo ne se jouent pas')
})

// ── 5. De la liste au quiz enregistré ─────────────────────────────────────

test('une question collée attend sa photo jusque dans la bibliothèque, puis se joue une fois la photo jointe', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const { questions } = parseImportedQuestions(APERCU_DU_FORMAT)
    const id = await creerQuiz(banc.url, cookie, questions, 'Collé')

    const lireQuiz = async () =>
      (await (await fetch(`${banc.url}/api/quizzes/${id}`, { headers: { Cookie: cookie } })).json()) as { questions: QuizQuestionDef[] }
    const resume = async () =>
      ((await (await fetch(`${banc.url}/api/quizzes`, { headers: { Cookie: cookie } })).json()) as { id: string; readyCount: number; questionCount: number }[]).find(
        q => q.id === id,
      )!
    const enregistre = await lireQuiz()
    assert.deepEqual(
      enregistre.questions.map(q => [q.duration, q.photoAttendue]),
      [
        [20, null],
        [30, 'tour-eiffel.jpg'],
        [20, null],
      ],
    )
    const avant = await resume()
    assert.deepEqual([avant.readyCount, avant.questionCount], [2, 3], 'la question sans sa photo est « à compléter »')

    // L'animateur joint la photo depuis la carte : la note s'efface, la question se joue.
    const envoi = await ecrire(banc.url, '/api/images', { dataUrl: PNG }, cookie)
    const { url } = (await envoi.json()) as { url: string }
    const avecPhoto = enregistre.questions.map((q, i) => (i === 1 ? { ...q, image: url } : q))
    const resave = await ecrire(banc.url, `/api/quizzes/${id}`, { title: 'Collé', questions: avecPhoto }, cookie, 'PUT')
    assert.equal(resave.status, 200)
    const complet = await lireQuiz()
    assert.deepEqual([complet.questions[1].image, complet.questions[1].photoAttendue], [url, null])
    assert.equal((await resume()).readyCount, 3)

    // Un quiz d'avant la photo attendue se lit comme avant.
    const ancien = await creerQuiz(banc.url, cookie, [qcm('Oui ?')], 'Ancien')
    const relu = (await (await fetch(`${banc.url}/api/quizzes/${ancien}`, { headers: { Cookie: cookie } })).json()) as { questions: QuizQuestionDef[] }
    assert.equal(relu.questions[0].photoAttendue, null)
  } finally {
    await banc.close()
  }
})
