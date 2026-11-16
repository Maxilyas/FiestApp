// Le retour du propriétaire : « Sur les sentiers, tu peux que écrire et pas la
// nouvelle méthode pour signaler. » La série et le quiz du jour signalaient en
// plusieurs points d'un coup (`SignalerLaQuestion`) ; les sentiers et les
// parcours de thème en étaient restés à la modale où l'on tape une phrase, le
// Cabinet de curiosités aussi (« Je veux bien que tu uniformises les
// signalements », le 16 novembre 2026). Une vue de jeu solo qui signale ne
// passe plus que par la feuille. L'Expédition n'est pas concernée : remplacée
// par le Cabinet, son sort se décide à part.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { QUESTION_A_LA_MARCHE, NIVEAUX } from '../../shared/campagne'
import { texteDuSignalement, type QuestionSignalee } from '../../shared/signalement'
import type { RevelationVue } from '../../shared/cabinet/vues'
import React from 'react'

// Le client compile son JSX pour un `React` global, et `state.ts` lit son adresse à l'import : posés avant d'importer la page du Cabinet.
Object.assign(globalThis, { React, window: { location: { pathname: '/cabinet', search: '', hash: '', origin: 'http://banc' }, addEventListener: () => {} } })

const vue = (f: string) => readFileSync(path.resolve(import.meta.dirname, '../../client/src/views', f), 'utf8')
const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href

const VUES_A_LA_FEUILLE = ['CampagneApp.tsx', 'JourApp.tsx', 'Sentiers.tsx', 'Parcours.tsx', 'cabinet/Partie.tsx']

for (const f of VUES_A_LA_FEUILLE) {
  test(`${f} signale par la feuille à points, pas par la phrase libre`, () => {
    const src = vue(f)
    assert.match(src, /<SignalerLaQuestion\b/, 'la feuille doit être rendue')
    assert.doesNotMatch(src, /promptDialog/, 'plus de modale où l’on tape une phrase')
  })
}

test('chaque marche a son accord, partagé par les vues qui signalent', () => {
  for (const n of NIVEAUX) assert.ok(QUESTION_A_LA_MARCHE[n])
  for (const f of ['CampagneApp.tsx', 'Sentiers.tsx', 'Parcours.tsx']) {
    assert.match(vue(f), /QUESTION_A_LA_MARCHE/, f)
  }
})

// ── Le Cabinet : la feuille ne montre que ce que la révélation a dit ─────────

/** Une révélation du Cabinet, écrite à la main : seuls le corps et les pièces signalables comptent ici. */
const revelation = (corps: RevelationVue['corps'], signalables: number[]): RevelationVue => ({ manche: 0, fin: 'jugee', signalables, corps })

test('le Pari se signale question par question : ses réponses telles qu’il les a lues, l’anecdote de la seule qui a tranché', async () => {
  const { questionASignaler } = (await import(url('views/cabinet/Partie.tsx'))) as { questionASignaler: (r: RevelationVue, i: number) => QuestionSignalee | null }
  const r = revelation(
    {
      jeu: 'pari',
      titre: 'Pari gagné !',
      questions: [
        { texte: 'Capitale de la Suisse ?', reponses: ['Berne', 'Genève', 'Zurich', 'Bâle'], bonne: 0, choix: 0 },
        { texte: 'Plus haut sommet des Alpes suisses ?', reponses: ['Cervin', 'Pointe Dufour', 'Eiger', 'Jungfrau'], bonne: 1, choix: 1 },
      ],
      savais: 'La pointe Dufour culmine à 4 634 m.',
    },
    [3, 4],
  )
  assert.deepEqual(questionASignaler(r, 0), { texte: 'Capitale de la Suisse ?', reponses: ['Berne', 'Genève', 'Zurich', 'Bâle'], bonne: 0, anecdote: null, categorie: null })
  assert.deepEqual(questionASignaler(r, 1), {
    texte: 'Plus haut sommet des Alpes suisses ?',
    reponses: ['Cervin', 'Pointe Dufour', 'Eiger', 'Jungfrau'],
    bonne: 1,
    anecdote: 'La pointe Dufour culmine à 4 634 m.',
    categorie: null,
  })
  // Une pièce sans question montrée : rien à ouvrir, plutôt qu'une feuille sur la mauvaise.
  assert.equal(questionASignaler(r, 2), null)
})

test('le Mot et le Filet se signalent sur leur seule réponse, comme leur pièce la garde au journal', async () => {
  const { questionASignaler } = (await import(url('views/cabinet/Partie.tsx'))) as { questionASignaler: (r: RevelationVue, i: number) => QuestionSignalee | null }
  const mot = revelation(
    { jeu: 'mot', titre: 'Trouvé en 3 essais', trouve: true, reponse: 'Vilnius', lettres: 'VILNIUS', essais: [], texte: 'Capitale de la Lituanie ?', savais: null },
    [0],
  )
  const q = questionASignaler(mot, 0)
  assert.deepEqual(q, { texte: 'Capitale de la Lituanie ?', reponses: ['Vilnius'], bonne: 0, anecdote: null, categorie: null })
  // La phrase envoyée est celle des autres vues : le serveur et le QG n'ont rien de neuf à lire.
  assert.equal(texteDuSignalement(q!, { texte: 'Capitale de la Lettonie ?' }), 'La question : « Lituanie » → « Lettonie ».')
  const filet = revelation(
    {
      jeu: 'filet',
      titre: 'Dans le filet',
      dedans: true,
      valeur: 1845,
      reponse: '1 845 km',
      lancer: null,
      annee: false,
      unite: 'km',
      piste: { min: 0, max: 4000, pas: 10 },
      zone: null,
      texte: 'Longueur du Rhin ?',
      savais: 'Il naît dans les Alpes suisses.',
    },
    [0],
  )
  assert.deepEqual(questionASignaler(filet, 0), { texte: 'Longueur du Rhin ?', reponses: ['1 845 km'], bonne: 0, anecdote: 'Il naît dans les Alpes suisses.', categorie: null })
})

test('ce que le Cabinet tire hors de la base ne s’ouvre pas à la feuille', async () => {
  const { questionASignaler } = (await import(url('views/cabinet/Partie.tsx'))) as { questionASignaler: (r: RevelationVue, i: number) => QuestionSignalee | null }
  // Le serveur n'en rend aucune pièce signalable ; une révélation qui en porterait une quand même n'ouvre rien.
  const eclair = revelation({ jeu: 'eclair', titre: '5 sur 5', affirmations: [], savais: null } as never, [0])
  assert.equal(questionASignaler(eclair, 0), null)
})
