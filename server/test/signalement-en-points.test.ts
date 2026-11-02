// Un signalement en plusieurs points (`shared/signalement.ts`) : le joueur
// coche ce qui cloche — la bonne réponse, une faute, le classement —, corrige
// chaque point à sa place, et une seule phrase part au serveur, qui n'en
// reçoit encore qu'une. Ses points passent avant ce qu'il en dit : coupée à
// 280 caractères, la phrase ne perd jamais une correction pour garder sa
// preuve.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SIGNALEMENT_MAX, changementsProposes, decoupage, ecartDesMots, morceaux, texteDuSignalement, type QuestionSignalee } from '../../shared/signalement'
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

test('la phrase envoyée cite d’un seul bloc ce qui change : ce qui reste autour, ce qui part, ce qui vient', () => {
  assert.deepEqual(decoupage('Il prend sa source en Suise, au glacier.', 'Il prend sa source en Suisse, au glacier.'), {
    debut: 'Il prend sa source en',
    enleve: 'Suise,',
    ajoute: 'Suisse,',
    fin: 'au glacier.',
  })
  assert.deepEqual(decoupage('Un mot.', 'Un mot de plus.'), { debut: 'Un', enleve: 'mot.', ajoute: 'mot de plus.', fin: '' })
  assert.equal(decoupage('Rien ne change.', ' Rien  ne change. '), null)
})

test('la feuille montre chaque retouche à sa place : deux mots corrigés ne barrent pas la phrase entre eux', () => {
  // La sonde du 2 novembre 2026 : « en file » devenu « en file indienne », « celui de » devenu « celui qui est ». D'un seul
  // bloc, toute la phrase entre les deux se lisait barrée puis récrite en or, comme une question refaite de bout en bout.
  assert.deepEqual(
    morceaux(
      'Quelle danse fait-on en file, chacun les mains sur les épaules de celui de devant ?',
      'Quelle danse fait-on en file indienne, chacun les mains sur les épaules de celui qui est devant ?',
    ),
    [
      { mots: 'Quelle danse fait-on en', sort: 'reste' },
      { mots: 'file,', sort: 'part' },
      { mots: 'file indienne,', sort: 'vient' },
      { mots: 'chacun les mains sur les épaules de celui', sort: 'reste' },
      { mots: 'de', sort: 'part' },
      { mots: 'qui est', sort: 'vient' },
      { mots: 'devant ?', sort: 'reste' },
    ],
  )
  // Une coquille : barrée, puis remplacée, au milieu de ce qui reste.
  assert.deepEqual(morceaux('Il prend sa source en Suise, au glacier.', 'Il prend sa source en Suisse, au glacier.'), [
    { mots: 'Il prend sa source en', sort: 'reste' },
    { mots: 'Suise,', sort: 'part' },
    { mots: 'Suisse,', sort: 'vient' },
    { mots: 'au glacier.', sort: 'reste' },
  ])
  // Un mot ajouté, des mots retirés : rien de barré pour l'un, rien d'ajouté pour l'autre.
  assert.deepEqual(morceaux('Un mot.', 'Un petit mot.'), [
    { mots: 'Un', sort: 'reste' },
    { mots: 'petit', sort: 'vient' },
    { mots: 'mot.', sort: 'reste' },
  ])
  assert.deepEqual(morceaux('Un très grand mot.', 'Un mot.'), [
    { mots: 'Un', sort: 'reste' },
    { mots: 'très grand', sort: 'part' },
    { mots: 'mot.', sort: 'reste' },
  ])
  assert.equal(morceaux('Rien ne change.', ' Rien  ne change. '), null)
})

test('quitté, un texte ne se relit corrigé qu’après le geste : ce qu’on touche dessous ne glisse pas sous le doigt', () => {
  // La sonde du 2 novembre 2026, au doigt : la question corrigée, puis « La farandole » touchée par son bord haut. Relu au blur
  // — au `mousedown` que le doigt fait suivre —, le texte grandissait de ses mots barrés, la case glissait de 38 px avant le
  // `click`, et le toucher se perdait ; « Trop facile » de même, sous l'anecdote corrigée.
  const source = readFileSync(new URL('../../client/src/components/SignalerLaQuestion.tsx', import.meta.url), 'utf8')
  const debut = source.indexOf('<textarea')
  const champ = source.slice(debut, source.indexOf('/>', debut))
  assert.match(champ, /onBlur=\{relire\}/, 'le champ quitté passe par `relire`')
  assert.match(source, /const relire = \(\) => \{\s*window\.setTimeout\(/, '`relire` attend la fin du geste')
  // Fini plus tard, un texte ne referme pas l'autre, ouvert entre-temps d'un toucher.
  assert.match(source, /onFini=\{\(\) => setEdition\(e => \(e === 'texte' \? null : e\)\)\}/)
  assert.match(source, /onFini=\{\(\) => setEdition\(e => \(e === 'anecdote' \? null : e\)\)\}/)
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
