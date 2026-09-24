// L'éditeur de quiz : ce qu'une question neuve reprend de sa voisine.
//
// L'animatrice de la première tablée voulait 45 s partout : chaque question
// ajoutée repartait à 20 s et sans catégorie, et elle a corrigé les deux,
// neuf fois. Une question neuve — ajoutée, insérée ou collée — reprend
// désormais le temps et la catégorie de celle qui la précède.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_DURATION,
  bonneEnPremier,
  cloneQuestion,
  estVraiFaux,
  emptyQuestion,
  normalizeQuestions,
  parseImportedQuestions,
  questionProblem,
  toPlayable,
  voisineDe,
  type QuizQuestionDef,
} from '../../shared/library'

function reglee(duration: number, category: string | null): QuizQuestionDef {
  return { ...emptyQuestion(), text: 'Déjà écrite', answers: ['Oui', 'Non', '', ''], duration, category, image: '/img/a.jpg', kind: 'choice' }
}

test('sans voisine, une question neuve part des réglages par défaut', () => {
  const q = emptyQuestion()
  assert.equal(q.duration, DEFAULT_DURATION)
  assert.equal(q.category, null)
})

test('une question neuve reprend le temps et la catégorie de sa voisine, et rien d’autre', () => {
  const voisine = reglee(45, 'Cinéma & séries')
  const q = emptyQuestion(voisine)
  assert.equal(q.duration, 45)
  assert.equal(q.category, 'Cinéma & séries')
  assert.equal(q.text, '', 'l’intitulé ne se recopie pas : c’est le rôle de la duplication')
  assert.deepEqual(q.answers, ['', '', '', ''])
  assert.equal(q.image, null)
  assert.notEqual(q.id, voisine.id)
})

test('un temps hors bornes ou une catégorie inconnue ne se propagent pas', () => {
  assert.equal(emptyQuestion(reglee(0, null)).duration, DEFAULT_DURATION)
  assert.equal(emptyQuestion(reglee(500, null)).duration, DEFAULT_DURATION)
  assert.equal(emptyQuestion(reglee(Number.NaN, null)).duration, DEFAULT_DURATION)
  assert.equal(emptyQuestion(reglee(30.4, null)).duration, 30)
  assert.equal(emptyQuestion(reglee(30, 'Astrologie')).category, null)
})

test('la voisine est la question qui précédera la nouvelle, ou la suivante en tête', () => {
  const qs = ['a', 'b', 'c']
  assert.equal(voisineDe(qs, 4), 'c', 'à la fin : la dernière')
  assert.equal(voisineDe(qs, 99), 'c', 'un numéro trop grand vaut « à la fin »')
  assert.equal(voisineDe(qs, 2), 'a', 'insérée en n° 2 : la n° 1')
  assert.equal(voisineDe(qs, 1), 'a', 'en tête : celle qui la suivra')
  assert.equal(voisineDe(qs, -3), 'a')
  assert.equal(voisineDe([], 1), undefined)
})

test('une liste collée reprend le temps et la catégorie de sa voisine, sauf dièse', () => {
  const voisine = reglee(45, 'Musique')
  const { questions } = parseImportedQuestions(
    `Qui chante Thriller ?
* Michael Jackson
Prince

Combien de disques vendus, en millions ?
= 70

# Cinéma
Qui a réalisé Alien ?
* Ridley Scott
James Cameron

#
Sans catégorie ?
* Oui
Non`,
    voisine,
  )
  assert.deepEqual(
    questions.map(q => [q.duration, q.category]),
    [
      [45, 'Musique'],
      [45, 'Musique'],
      [45, 'Cinéma & séries'],
      [45, null],
    ],
  )
})

test('sans voisine, une liste collée garde ses anciens réglages', () => {
  const { questions } = parseImportedQuestions(`Oui ?
* Oui
Non`)
  assert.equal(questions[0].duration, DEFAULT_DURATION)
  assert.equal(questions[0].category, null)
})

test('une duplication garde tout, temps et catégorie compris', () => {
  const voisine = reglee(45, 'Sport')
  const copie = cloneQuestion(voisine)
  assert.equal(copie.duration, 45)
  assert.equal(copie.category, 'Sport')
  assert.equal(copie.text, voisine.text)
})

// ── Un temps hors bornes se dit ───────────────────────────────────────────
//
// Le champ « Temps » ne se vidait pas : on effaçait « 20 », il revenait, et
// taper 45 donnait « 2045 » — ramené à 120 s à l'enregistrement, sans un
// mot, la question comptée « prête » (tablée du 24 septembre, AN-15, ED-7).
// Le champ garde maintenant ce qu'on tape (`ChampNombre`) ; ce qui sort des
// bornes se dit sur la carte, et la question n'est pas prête tant qu'il y reste.

test('un temps ou une observation hors bornes rend la question « à compléter », et dit les bornes', () => {
  const q: QuizQuestionDef = { ...reglee(20, null), image: null }
  assert.equal(questionProblem(q), null)
  for (const duration of [2045, 4, 0, Number.NaN]) {
    assert.equal(toPlayable({ ...q, duration }), null, `${duration} s`)
    assert.match(questionProblem({ ...q, duration }) ?? '', /de 5 à 120 s/, `${duration} s`)
  }
  assert.notEqual(toPlayable({ ...q, duration: 120 }), null)
  assert.notEqual(toPlayable({ ...q, duration: 5 }), null)

  const photo: QuizQuestionDef = { ...q, image: '/media/image/abc', observeSeconds: 5 }
  assert.equal(questionProblem(photo), null)
  assert.match(questionProblem({ ...photo, observeSeconds: 40 }) ?? '', /de 2 à 30 s/)
  assert.equal(toPlayable({ ...photo, observeSeconds: 1 }), null)
  // Sans photo, l'observation n'a rien à dire : elle est ignorée, pas reprochée.
  assert.equal(questionProblem({ ...q, observeSeconds: 40 }), null)
})

test('le serveur range un temps venu d’une page d’avant dans les bornes, comme avant', () => {
  const [court, long] = normalizeQuestions([
    { text: 'Un ?', answers: ['a', 'b'], duration: 2 },
    { text: 'Deux ?', answers: ['a', 'b'], duration: 2045 },
  ])
  assert.deepEqual([court.duration, long.duration], [5, 120])
})

// ── Vrai ou faux, et la bonne réponse toujours en premier ─────────────────

test('un vrai ou faux se reconnaît, et ne compte pas dans « la bonne réponse en premier »', () => {
  const vf = (correct: number): QuizQuestionDef => ({ ...reglee(20, null), image: null, answers: ['Vrai', 'Faux', '', ''], correct })
  assert.equal(estVraiFaux(vf(0)), true)
  assert.equal(estVraiFaux({ ...vf(0), answers: [' faux', 'VRAI', '', ''] }), true)
  assert.equal(estVraiFaux({ ...vf(0), answers: ['Vrai', 'Faux', 'Peut-être', ''] }), false)
  assert.equal(estVraiFaux({ ...vf(0), kind: 'number' }), false)

  const qcm = (correct: number): QuizQuestionDef => ({ ...reglee(20, null), image: null, answers: ['A', 'B', 'C', ''], correct })
  // Six QCM sur neuf, comme chez Nadia : on le dit.
  assert.deepEqual(bonneEnPremier([...Array(6)].map(() => qcm(0)).concat([qcm(1), qcm(2), qcm(1)])), { premiers: 6, qcm: 9 })
  // Les vrai ou faux n'y entrent pas ; trois QCM, c'est trop peu pour conclure.
  assert.equal(bonneEnPremier([qcm(0), qcm(0), qcm(0), vf(0), vf(0)]), null)
  assert.equal(bonneEnPremier([qcm(0), qcm(1), qcm(2), qcm(0), qcm(1)]), null)
})
