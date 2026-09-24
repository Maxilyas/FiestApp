// Les mots qu'on lit au mur : l'élision, le rang, les espaces insécables.
//
// La soirée jouée par la tablée (retours du 23 septembre 2026) a lu « La
// soirée de Antoine » au-dessus de l'inscription, « 1ᵉʳ sur 7 » pour Camille,
// et un « ? » seul en début de ligne sous la question du gâteau de Sam. Ce ne
// sont que des textes — mais toute la famille les lit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { de, deNom, espacesFines, place, rang } from '../../shared/typographie'
import { defaultSettings, normalizeSettings, titreChoisi, titreDeCloture } from '../../shared/space'

const FINE = ' '
const INSECABLE = ' '

test('« de » s’élide devant une voyelle et un h, pas devant une consonne ni un y', () => {
  assert.equal(deNom('Antoine'), 'd’Antoine')
  assert.equal(deNom('Élodie'), 'd’Élodie', 'l’accent ne cache pas la voyelle')
  assert.equal(deNom('Hugo'), 'd’Hugo')
  assert.equal(deNom('Bob'), 'de Bob')
  assert.equal(deNom('Yann'), 'de Yann')
  assert.equal(de('🎉 Team'), 'de ', 'ce qui n’est pas une lettre garde « de »')
  assert.equal(de(''), 'de ')
})

test('un espace neuf s’appelle « La soirée d’Antoine », et l’ancien défaut suit', () => {
  const neuf = defaultSettings('Antoine')
  assert.equal(neuf.title, 'La soirée d’Antoine')
  assert.equal(neuf.eyebrow, 'La soirée d’')
  assert.equal(neuf.headline, 'Antoine')
  assert.equal(defaultSettings('Bob').eyebrow, 'La soirée de')

  // Un compte créé avant l'élision garde en base l'ancien titre par défaut :
  // relu, il suit le nouveau.
  const ancien = normalizeSettings({ title: 'La soirée de Antoine', eyebrow: 'La soirée de', headline: 'Antoine' }, 'Antoine')
  assert.equal(ancien.title, 'La soirée d’Antoine')
  assert.equal(ancien.eyebrow, 'La soirée d’')

  // Ce que l'animateur a tapé lui-même, en revanche, ne bouge pas.
  const tape = normalizeSettings({ title: 'Les 40 ans de Sam', eyebrow: 'La soirée de', headline: 'Sam' }, 'Antoine')
  assert.equal(tape.title, 'Les 40 ans de Sam')
  assert.equal(tape.eyebrow, 'La soirée de')
})

test('la clôture propose le titre choisi par l’animateur, jamais le titre par défaut', () => {
  assert.equal(titreChoisi({ title: 'Les 40 ans de Sam', name: 'Nadia' }), 'Les 40 ans de Sam')
  assert.equal(titreChoisi({ title: 'La soirée de Nadia', name: 'Nadia' }), null)
  assert.equal(titreChoisi({ title: 'La soirée d’Antoine', name: 'Antoine' }), null)
  assert.equal(titreChoisi({ title: 'La soirée de Antoine', name: 'Antoine' }), null, 'l’ancien défaut non plus')

  // La soirée s'est rangée seule après le premier quiz, sous sa date : le titre
  // choisi passe devant ce nom automatique, pas devant celui qu'on a tapé.
  const sam = { title: 'Les 40 ans de Sam', name: 'Nadia' }
  assert.equal(titreDeCloture('Soirée du 23 septembre 2026', sam, '23 septembre 2026'), 'Les 40 ans de Sam')
  assert.equal(titreDeCloture(undefined, sam, '23 septembre 2026'), 'Les 40 ans de Sam')
  assert.equal(titreDeCloture('Le grand quiz', sam, '23 septembre 2026'), 'Le grand quiz')
  const nadia = { title: 'La soirée de Nadia', name: 'Nadia' }
  assert.equal(titreDeCloture('Soirée du 23 septembre 2026', nadia, '24 septembre 2026'), 'Soirée du 23 septembre 2026')
  assert.equal(titreDeCloture(undefined, nadia, '24 septembre 2026'), 'Soirée du 24 septembre 2026')
})

test('un rang s’écrit au féminin, devant « place »', () => {
  assert.equal(rang(1), '1ʳᵉ')
  assert.equal(rang(2), '2ᵉ')
  assert.equal(place(1), '1ʳᵉ place')
  assert.equal(place(7), '7ᵉ place')
})

test('les espaces avant ? ! ; : deviennent insécables, et les guillemets en reçoivent', () => {
  assert.equal(
    espacesFines('Vous avez bien regardé le gâteau de Sam ? Combien y avait-il de bougies dessus ?'),
    `Vous avez bien regardé le gâteau de Sam${FINE}? Combien y avait-il de bougies dessus${FINE}?`,
  )
  assert.equal(espacesFines('40, évidemment !'), `40, évidemment${FINE}!`)
  assert.equal(espacesFines('Réponse : Paris ; ou Lyon'), `Réponse${INSECABLE}: Paris${FINE}; ou Lyon`)
  assert.equal(espacesFines('le quiz « Spécial Sam »'), `le quiz «${FINE}Spécial Sam${FINE}»`)
  assert.equal(espacesFines('«Collé»'), `«${FINE}Collé${FINE}»`, 'un guillemet collé reçoit son espace')
})

test('les espaces fines ne touchent ni l’anglais, ni une heure, ni une adresse', () => {
  assert.equal(espacesFines('Why? Because!'), 'Why? Because!', 'pas d’espace ajoutée là où il n’y en avait pas')
  assert.equal(espacesFines('Rendez-vous à 20:30'), 'Rendez-vous à 20:30')
  assert.equal(espacesFines('https://exemple.fr'), 'https://exemple.fr')
  assert.equal(espacesFines(''), '')
})

test('les espaces fines sont idempotentes : un texte déjà traité ne change plus', () => {
  const une = espacesFines('Qui ? « Moi » : oui !')
  assert.equal(espacesFines(une), une)
  assert.ok(!/ [?!:;»]|« /.test(une), 'plus aucune espace sécable autour de la ponctuation')
})
