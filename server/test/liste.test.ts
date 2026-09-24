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
  ecrireListe,
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
      // Le temps court, comme la catégorie : les deux questions d'histoire gardent les 30 s de l'Everest.
      { kind: 'choice', reponse: 'Vrai', choix: 2, temps: 30, categorie: 'Histoire', photo: null, observation: null },
      { kind: 'number', reponse: '1969', choix: 0, temps: 30, categorie: 'Histoire', photo: null, observation: null },
      { kind: 'choice', reponse: 'Titanic', choix: 4, temps: 15, categorie: 'Cinéma & séries', photo: 'titanic.jpg', observation: null },
      {
        kind: 'number',
        reponse: '30 bougies',
        choix: 0,
        temps: 15,
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
      // Le temps de la tour Eiffel vaut pour la suite.
      ['number', 30, null],
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
        [30, null],
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

// ── 6. La liste « bavarde » ───────────────────────────────────────────────
//
// Une IA qui « met en forme » sa réponse, un ami qui numérote : `**1. …**`,
// `- Canberra *`, `B) *1989`. L'intitulé gardait ses `**`, les réponses
// leurs puces, l'étoile en fin de ligne n'était pas vue — et la première
// réponse devenait la bonne, dans un quiz qui se disait « prêt ». Rejoué le
// 24 septembre (parcours ED-1).

test('une liste mise en forme par une IA se lit comme une liste propre', () => {
  const gras = une('**1. Quelle est la capitale de l’Australie ?**', '- Sydney', '- Canberra *', '- Perth')
  assert.equal(gras.text, 'Quelle est la capitale de l’Australie ?')
  assert.deepEqual(gras.answers, ['Sydney', 'Canberra', 'Perth', ''])
  assert.equal(gras.correct, 1)
  assert.notEqual(toPlayable(gras), null)

  const lettres = une('Question 2 : En quelle année le mur de Berlin est-il tombé ?', 'A) 1987', 'B) *1989', 'C) 1991')
  assert.equal(lettres.text, 'En quelle année le mur de Berlin est-il tombé ?')
  assert.deepEqual(lettres.answers, ['1987', '1989', '1991', ''])
  assert.equal(lettres.correct, 1)

  for (const [ligne, attendue] of [
    ['• Canberra ✓', 'Canberra'],
    ['– Canberra (bonne réponse)', 'Canberra'],
    ['__Canberra__ ✔', 'Canberra'],
    ['* **Canberra**', 'Canberra'],
    ['Canberra (*)', 'Canberra'],
  ]) {
    const q = une('### Capitale de l’Australie ?', 'Sydney', ligne, 'Perth')
    assert.equal(q.text, 'Capitale de l’Australie ?', ligne)
    assert.equal(q.answers[q.correct], attendue, ligne)
  }

  // « Réponse : … » sous les choix désigne la bonne, par son texte ou sa lettre.
  const parTexte = une('Capitale ?', 'Sydney', 'Canberra', 'Réponse : Canberra')
  assert.deepEqual([parTexte.answers, parTexte.correct], [['Sydney', 'Canberra', '', ''], 1])
  const parLettre = une('Capitale ?', 'a. Sydney', 'b. Canberra', 'Bonne réponse : B')
  assert.deepEqual([parLettre.answers, parLettre.correct], [['Sydney', 'Canberra', '', ''], 1])
})

test('ce qui ressemble à une mise en forme sans en être une reste tel quel', () => {
  // Un nombre en tête d'intitulé n'est pas un numéro ; un signe moins n'est pas une puce.
  assert.equal(une('1984 est un roman de ?', '* Orwell', 'Huxley').text, '1984 est un roman de ?')
  assert.equal(une('3.14, c’est pi ?', '* Oui', 'Non').text, '3.14, c’est pi ?')
  assert.deepEqual(une('Record de froid en France ?', '* -41 °C', '-30 °C').answers, ['-41 °C', '-30 °C', '', ''])
  // Une seule réponse qui commence par une lettre n'est pas une liste lettrée.
  assert.deepEqual(une('Seizième président des États-Unis ?', '* A. Lincoln', 'G. Washington').answers, [
    'A. Lincoln',
    'G. Washington',
    '',
    '',
  ])
  // Une catégorie reste une catégorie, un intitulé à dièse reste un intitulé.
  const { questions } = parseImportedQuestions('# Musique\n\n#1 des ventes en 1985 ?\n* Madonna\nPrince')
  assert.deepEqual([questions[0].category, questions[0].text], ['Musique', '#1 des ventes en 1985 ?'])
})

// Relus par la relecture de l'axe 3 : la première lecture « bavarde »
// nettoyait trop, face à main — un signe pris pour une puce, un « Q7 » pris
// pour un numéro, un en-tête seul lu comme intitulé, les coches d'emoji.
test('la liste bavarde ne retire que la mise en forme, jamais le texte', () => {
  // « - 30 °C » est un signe, pas une puce.
  const froid = une('Température record en Antarctique ?', '- 30 °C', '* - 89 °C', '- 12 °C')
  assert.deepEqual(froid.answers, ['- 30 °C', '- 89 °C', '- 12 °C', ''])
  assert.equal(froid.correct, 1)
  // Un « Q » sans séparateur fait partie de l'intitulé.
  assert.equal(une('Q7 est une voiture de quelle marque ?', '* Audi', 'BMW').text, 'Q7 est une voiture de quelle marque ?')
  assert.equal(une('Q2 2024 : quel trimestre ?', '* Le deuxième', 'Le premier').text, 'Q2 2024 : quel trimestre ?')
  assert.equal(une('Q3 : Capitale ?', '* Canberra', 'Sydney').text, 'Capitale ?', 'avec son séparateur, il reste un numéro')
  // Un en-tête seul sur sa ligne : l'intitulé est la suivante.
  for (const entete of ['### Question 1', '**Question 1**', 'Q1 :', '1.', '## 1']) {
    const q = une(entete, 'Quelle est la capitale de l’Australie ?', 'Sydney', '* Canberra')
    assert.equal(q.text, 'Quelle est la capitale de l’Australie ?', entete)
    assert.deepEqual([q.answers, q.correct], [['Sydney', 'Canberra', '', ''], 1], entete)
  }
  // Les coches d'emoji, devant ou derrière, sélecteur U+FE0F compris.
  for (const ligne of ['✔️ Bleu', '✔\uFE0F Bleu', '✅ Bleu', 'Bleu ✅', 'Bleu ✔️', '☑ Bleu']) {
    const q = une('Couleur du ciel ?', 'Vert', ligne, 'Rouge')
    assert.deepEqual([q.answers[1], q.correct], ['Bleu', 1], ligne)
  }
})

test('une question sans bonne réponse désignée n’est pas prête, et le dit', () => {
  const sansEtoile = parseImportedQuestions('Capitale ?\nSydney\nCanberra')
  assert.equal(sansEtoile.unmarked, 1)
  const q = sansEtoile.questions[0]
  assert.equal(toPlayable(q), null, 'la première réponse n’est plus prise pour la bonne')
  assert.match(questionProblem(q) ?? '', /Choisis la bonne réponse/)

  // Deux étoiles, ou l'étoile sur une cinquième réponse coupée : à choisir aussi.
  const deux = parseImportedQuestions('Capitale ?\n* Sydney\n* Canberra\nPerth')
  assert.deepEqual([deux.unmarked, toPlayable(deux.questions[0])], [1, null])
  const cinquieme = parseImportedQuestions('Capitale ?\nSydney\nPerth\nMelbourne\nDarwin\n* Canberra')
  assert.deepEqual([cinquieme.unmarked, toPlayable(cinquieme.questions[0])], [1, null])

  // Le serveur et le brouillon gardent « à choisir » : l'enregistrement ne la fait pas prête.
  const [relue] = normalizeQuestions([q])
  assert.equal(relue.correct, -1)
  assert.equal(toPlayable(relue), null)
  // Choisie sur la carte, elle se joue.
  assert.equal(toPlayable({ ...relue, correct: 1 })?.kind, 'choice')
})

// ── 7. Le temps d'une liste collée ────────────────────────────────────────
//
// L'aide du panneau disait « le temps de la question qui précède », le
// format copié pour l'IA « celui réglé dans FiestApp », et le lecteur prenait
// celui de la voisine du point où l'on colle : Léa a mis « Temps : 50 s »
// sous sa première question, et les huit autres sont arrivées à 20 s
// (rejoué : [50, 20, 20]). Le temps court maintenant comme la catégorie.

test('une ligne « Temps » vaut pour sa question et les suivantes, jusqu’à la prochaine', () => {
  const temps = (texte: string, voisine = 20) =>
    parseImportedQuestions(texte, { ...emptyQuestion(), duration: voisine }).questions.map(q => q.duration)
  assert.deepEqual(temps('Q1 ?\nTemps : 50 s\n* a\nb\n\nQ2 ?\n* a\nb\n\nQ3 ?\n* a\nb'), [50, 50, 50])
  assert.deepEqual(temps('Q1 ?\n* a\nb\n\nQ2 ?\nTemps : 30\n* a\nb\n\nQ3 ?\n= 4\nTemps : 15 s\n\nQ4 ?\n* a\nb'), [20, 30, 15, 15])
  // Écrite seule, ou en tête de bloc comme une catégorie, elle vaut pour ce qui suit.
  assert.deepEqual(temps('Temps : 45 s\n\nQ1 ?\n* a\nb\n\nQ2 ?\n* a\nb'), [45, 45])
  assert.deepEqual(temps('# Musique\nTemps : 45 s\nQ1 ?\n* a\nb\n\nQ2 ?\n* a\nb'), [45, 45])
  // Sans ligne, celui de la voisine ; illisible, le temps en cours.
  assert.deepEqual(temps('Q1 ?\n* a\nb', 35), [35])
  assert.deepEqual(temps('Q1 ?\nTemps : 40\n* a\nb\n\nQ2 ?\nTemps : vite\n* a\nb', 35), [40, 40])
  // Une ligne « Temps » seule ne compte pas parmi les blocs ignorés.
  assert.equal(parseImportedQuestions('Temps : 45 s\n\nQ1 ?\n* a\nb').ignored, 0)
  // Un intitulé qui commence par « Temps : » sans durée lisible reste un intitulé.
  assert.equal(une('Temps : combien de minutes dure un match ?', '* 90', '80').text, 'Temps : combien de minutes dure un match ?')
})

test('l’aide du panneau, le format et son exemple disent la même règle du temps', () => {
  assert.match(FORMAT_DE_LISTE, /Temps : 30 s — le temps pour répondre[^\n]*cette question et les suivantes/)
  // L'exemple montre un temps qui court : la question sans ligne « Temps » garde celui d'avant.
  const { questions } = parseImportedQuestions(EXEMPLE_DU_FORMAT)
  const i = questions.findIndex(q => q.duration === 30)
  assert.ok(i >= 0 && questions[i + 1]?.duration === 30, 'la question qui suit un « Temps : 30 s » garde 30 s')
})

// ── 8. Copier en liste ────────────────────────────────────────────────────
//
// On ne pouvait pas se passer un quiz en texte — dans un message, à relire
// ou à faire compléter par une IA (AD-7). « Copier en liste » l'écrit dans
// le format que « Coller une liste » relit : l'aller et retour ne perd rien,
// sauf les photos, qui ne voyagent pas en texte et reviennent « attendues ».

test('un quiz copié en liste se recolle à l’identique, photos attendues comprises', () => {
  const base = { ...emptyQuestion(), duration: 30 }
  const questions: QuizQuestionDef[] = [
    { ...base, text: 'Capitale de l’Australie ?', answers: ['Sydney', 'Canberra', 'Perth', ''], correct: 1, category: 'Géographie' },
    { ...base, text: 'Altitude de l’Everest ?', kind: 'number', target: 8849, unit: 'm', category: 'Géographie' },
    { ...base, text: 'Record de froid en France ?', kind: 'number', target: -41.5, unit: '°C', duration: 45, category: null },
    { ...base, text: 'La tour Eiffel mesure 330 m.', answers: ['Vrai', 'Faux', '', ''], correct: 0, duration: 45, category: 'Histoire' },
    { ...base, text: 'Quel est ce monument ?', answers: ['Big Ben', 'Tour Eiffel', '', ''], correct: 1, image: '/media/image/abc', observeSeconds: 5, category: 'Histoire' },
    { ...base, text: 'Sans bonne réponse ?', answers: ['Oui', 'Non', '', ''], correct: -1, category: 'Histoire', photoAttendue: 'plage.jpg' },
    { ...base, text: '   ', answers: ['a', 'b', '', ''] },
  ]
  const texte = ecrireListe(questions)
  const relu = parseImportedQuestions(texte)
  assert.equal(relu.ignored, 0, texte)
  assert.equal(relu.unmarked, 1)
  const resume = (q: QuizQuestionDef) => ({
    text: q.text,
    kind: q.kind,
    answers: q.kind === 'choice' ? q.answers : null,
    correct: q.kind === 'choice' ? q.correct : null,
    target: q.kind === 'number' ? q.target : null,
    unit: q.kind === 'number' ? q.unit : null,
    duration: q.duration,
    category: q.category,
  })
  // La question sans intitulé ne s'écrit pas : elle n'aurait rien à relire.
  assert.deepEqual(relu.questions.map(resume), questions.slice(0, 6).map(resume))
  // La photo jointe revient attendue, avec son observation ; l'attendue reste attendue.
  assert.deepEqual(
    relu.questions.map(q => [q.photoAttendue !== null, q.observeSeconds]),
    [[false, null], [false, null], [false, null], [false, null], [true, 5], [true, null]],
  )
  assert.equal(relu.questions[5].photoAttendue, 'plage.jpg')
  // Le temps ne s'écrit que lorsqu'il change : il court, comme la catégorie.
  assert.equal(texte.match(/^Temps :/gm)?.length, 3)
})

// Relu par la relecture de l'axe 3 : ce que « Copier en liste » perdait en
// plus des photos. L'estimation sans cible, elle, se perd encore au
// recollage : on ne devine pas une cible (voir `ecrireListe`).
test('copié en liste, un intitulé à dièse, un choix « Photo : » et un grand nombre se recollent tels quels', () => {
  const base = emptyQuestion()
  const questions: QuizQuestionDef[] = [
    { ...base, text: '# Quiz musical ?', answers: ['Photo : la plage', 'Réponse : B', 'Temps : 30 s', 'Observation : 5'], correct: 0 },
    { ...base, text: 'Temps : combien dure un match ?', answers: ['90', '80', '', ''], correct: 0 },
    { ...base, text: 'Temps : 30 s', answers: ['a', 'b', '', ''], correct: 1 },
    { ...base, text: '2. étape ?', answers: ['a', 'b', '', ''], correct: 1 },
    { ...base, text: 'Atomes dans un gramme ?', kind: 'number', target: 1e21, unit: 'atomes' },
    { ...base, text: 'Tout petit ?', kind: 'number', target: -1.5e-7, unit: 'm' },
  ]
  const texte = ecrireListe(questions)
  assert.doesNotMatch(texte, /e\+|e-\d/, 'jamais d’exposant')
  const relu = parseImportedQuestions(texte)
  assert.equal(relu.ignored, 0, texte)
  assert.deepEqual(
    relu.questions.map(q => [q.text, q.kind === 'choice' ? [q.answers, q.correct] : [q.target, q.unit]]),
    questions.map(q => [q.text, q.kind === 'choice' ? [q.answers, q.correct] : [q.target, q.unit]]),
    texte,
  )
  assert.equal(relu.questions[0].category, null, 'le dièse n’a pas fait une catégorie')
  assert.equal(relu.questions[0].photoAttendue, null, 'le choix n’a pas fait une photo')
})
