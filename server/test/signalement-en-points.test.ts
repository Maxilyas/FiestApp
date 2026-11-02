// Un signalement en plusieurs points (`shared/signalement.ts`) : le joueur
// coche ce qui cloche — la bonne réponse, une faute, le classement —, corrige
// chaque point à sa place, et une seule phrase part au serveur, qui n'en
// reçoit encore qu'une. Ses points passent avant ce qu'il en dit : coupée à
// 280 caractères, la phrase ne perd jamais une correction pour garder sa
// preuve.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SIGNALEMENT_MAX, changementsProposes, decoupage, ecartDesMots, texteDuSignalement, type QuestionSignalee } from '../../shared/signalement'
import { SIGNALEMENT_MAX as DE_LA_CAMPAGNE } from '../../shared/campagne'

const FLEUVE: QuestionSignalee = {
  texte: 'Quel est le plus long fleuve de France ?',
  reponses: ['Seine', 'Loire', 'Rhône', 'Garonne'],
  bonne: 2,
  anecdote: 'Le Rhône prend sa source en Suise, au glacier du Rhône.',
  categorie: 'Géographie',
  marche: 'facile',
}

test('une coquille se lit mot à mot, pas en deux phrases entières', () => {
  assert.deepEqual(ecartDesMots('Il prend sa source en Suise, au glacier.', 'Il prend sa source en Suisse, au glacier.'), { enleve: 'Suise,', ajoute: 'Suisse,' })
  assert.equal(ecartDesMots('Même phrase.', '  Même   phrase.  '), null)
  assert.deepEqual(ecartDesMots('', 'Ajoutée.'), { enleve: '', ajoute: 'Ajoutée.' })
})

test('la feuille montre la correction dans le texte même : ce qui reste autour, ce qui part, ce qui vient', () => {
  assert.deepEqual(decoupage('Il prend sa source en Suise, au glacier.', 'Il prend sa source en Suisse, au glacier.'), {
    debut: 'Il prend sa source en',
    enleve: 'Suise,',
    ajoute: 'Suisse,',
    fin: 'au glacier.',
  })
  assert.deepEqual(decoupage('Un mot.', 'Un mot de plus.'), { debut: 'Un', enleve: 'mot.', ajoute: 'mot de plus.', fin: '' })
  assert.equal(decoupage('Rien ne change.', ' Rien  ne change. '), null)
})

test('trois points corrigés d’un coup partent dans une seule phrase, dans l’ordre du QG', () => {
  const proposition = {
    bonne: 1,
    anecdote: 'Le Rhône prend sa source en Suisse, au glacier du Rhône.',
    difficulte: 'trop-dure' as const,
    preuve: 'La Loire fait 1 006 km, tous en France.',
  }
  assert.deepEqual(
    changementsProposes(FLEUVE, proposition).map(c => c.ou),
    ['La bonne réponse', 'L’anecdote', 'La difficulté'],
  )
  assert.equal(
    texteDuSignalement(FLEUVE, proposition),
    'La bonne réponse : « Rhône » → « Loire ». L’anecdote : « Suise, » → « Suisse, ». La difficulté : trop dure pour une facile. Pourquoi : La Loire fait 1 006 km, tous en France.',
  )
})

test('rien de changé, rien à envoyer — même avec une preuve', () => {
  assert.equal(texteDuSignalement(FLEUVE, {}), '')
  // La bonne réponse qu'elle avait, son texte tel quel, sa catégorie : ce ne sont pas des corrections.
  assert.equal(texteDuSignalement(FLEUVE, { bonne: 2, texte: FLEUVE.texte, categorie: 'Géographie', preuve: 'Je le sais.' }), '')
  assert.equal(texteDuSignalement(FLEUVE, { autre: '   ' }), '')
})

test('sans marche connue — le quiz du jour —, la difficulté se dit seule', () => {
  const { marche: _, ...duJour } = FLEUVE
  assert.equal(texteDuSignalement(duJour, { difficulte: 'trop-facile' }), 'La difficulté : trop facile.')
  assert.equal(texteDuSignalement(duJour, { categorie: 'Histoire' }), 'La catégorie : « Géographie » → « Histoire ».')
})

test('coupée à la limite du serveur, la phrase garde ses points et perd la fin de sa preuve', () => {
  const longue = 'Parce que '.repeat(60)
  const texte = texteDuSignalement(FLEUVE, { bonne: 1, difficulte: 'trop-dure', preuve: longue })
  assert.ok(Array.from(texte).length <= SIGNALEMENT_MAX)
  assert.ok(texte.startsWith('La bonne réponse : « Rhône » → « Loire ». La difficulté : trop dure pour une facile. Pourquoi : Parce que'))
})

test('une seule limite : la campagne reprend celle du signalement', () => {
  assert.equal(DE_LA_CAMPAGNE, SIGNALEMENT_MAX)
})
