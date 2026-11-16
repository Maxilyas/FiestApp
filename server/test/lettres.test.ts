// Ce qui se compose d'une réponse (`shared/lettres.ts`) : son gabarit — deux
// mots au plus, de quatre à douze lettres, l'article devant, les signes posés
// d'office —, la règle qui dit si une question s'y prête, sur la vraie base,
// et ce qu'on en a composé. Né avec les questions à composer de l'Expédition
// (la version 11, le 19 octobre 2026, `retours/2026-10-19/les-coups-de-pouce.md`),
// que le Mot mystère du Cabinet lit aujourd'hui (`shared/cabinet/jeux/mot.ts`) ;
// la correction d'une expédition d'avant redit encore ce qu'on y avait composé
// (`compositionDite`, `CampagneStore.correction`).
//
// Ces épreuves viennent d'`expedition-coups-de-pouce.test.ts`, parti avec
// l'Expédition le 16 novembre 2026. Celle des tuiles (`tuilesDe`) et la
// lecture d'une composition envoyée (`lireUneComposition`) sont parties le
// même jour avec le code mort qu'elles éprouvaient : plus aucun lecteur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lireLaBase } from '../src/core/baseCampagne'
import { LETTRES_A_COMPOSER_MAX, compositionDite, gabaritDe, seCompose } from '../../shared/lettres'

test('une réponse se compose de deux mots au plus et de quatre à douze lettres : ses cases, ses signes posés d’office, son article devant', () => {
  assert.deepEqual(gabaritDe('Victor Hugo'), { mots: [Array(6).fill(null), Array(4).fill(null)], lettres: 'VICTORHUGO' })
  // L'article ne se compose pas : il se pose devant les cases, à l'apostrophe de l'écran.
  assert.deepEqual(gabaritDe('La cochenille'), { article: 'La', mots: [Array(10).fill(null)], lettres: 'COCHENILLE' })
  assert.deepEqual(gabaritDe('L\'Odyssée'), { article: 'L’', mots: [Array(7).fill(null)], lettres: 'ODYSSEE' })
  // Le trait d'union et l'apostrophe restent dans le mot, posés d'office ; les accents tombent, « Œ » fait deux lettres.
  assert.deepEqual(gabaritDe('Saint-Exupéry')!.mots, [[null, null, null, null, null, '-', null, null, null, null, null, null, null]])
  assert.equal(gabaritDe('Saint-Exupéry')!.lettres, 'SAINTEXUPERY')
  assert.deepEqual(gabaritDe('Aujourd’hui')!.mots[0].filter(c => c !== null), ['’'])
  assert.equal(gabaritDe('Œdipe')!.lettres, 'OEDIPE')
  // Ce qui ne se compose pas : trop long, trop court, trois mots, un chiffre, une lettre hors de l'alphabet, un signe au bout.
  for (const r of ['Jean-Paul Sartre', 'Zoé', 'Le Petit Prince Charmant', 'Apollo 11', '1515', 'Ørsted', 'Saint-', 'Rock & roll']) assert.equal(gabaritDe(r), null, r)
  assert.equal(gabaritDe('Le Petit Prince')!.lettres, 'PETITPRINCE', 'deux mots après l’article')
  assert.equal(LETTRES_A_COMPOSER_MAX, 12)
  assert.equal(compositionDite(gabaritDe('Saint-Exupéry')!.mots, 'SAINTEXUPERY'), 'SAINT-EXUPERY')
  assert.equal(compositionDite(gabaritDe('Victor Hugo')!.mots, 'VICTORHUGE'), 'VICTOR HUGE')
})

test('une question se pose à composer si sa bonne réponse se compose et que son intitulé ne parle pas de ses choix : six sur dix de la base', () => {
  const q = (texte: string, reponses: string[], bonne = 0) => ({ texte, reponses, bonne })
  assert.equal(seCompose(q('Qui a écrit Les Misérables ?', ['Victor Hugo', 'Émile Zola', 'Balzac', 'Flaubert'])), true)
  assert.equal(seCompose(q('Vrai ou faux : la Lune est un satellite ?', ['Vrai', 'Faux'])), false, 'un vrai ou faux n’a rien à composer')
  // « Laquelle de ces villes » ne se répond pas sans ses choix.
  for (const t of ['Laquelle de ces villes est la plus peuplée ?', 'Parmi les pays suivants, lequel est une île ?', 'Quel est l’intrus ?']) {
    assert.equal(seCompose(q(t, ['Lyon', 'Paris', 'Marseille', 'Lille'])), false, t)
  }
  // Mesuré sur la base livrée (le 19 octobre 2026 : 60,7 %) — le choix du propriétaire, deux mots de douze lettres au plus.
  const { questions } = lireLaBase()
  const choix = questions.filter(x => x.reponses.length > 2)
  const part = choix.filter(seCompose).length / choix.length
  assert.ok(part > 0.55 && part < 0.66, `${(part * 100).toFixed(1)} % de la base se compose`)
})
