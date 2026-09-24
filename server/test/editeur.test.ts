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
  cloneQuestion,
  emptyQuestion,
  parseImportedQuestions,
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
