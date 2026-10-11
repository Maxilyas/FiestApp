// La variété d'une série : dans chaque marche, les catégories passent à tour
// de rôle, puis leurs sous-thèmes (`aTourDeRole`). Tirée au hasard, une série
// reflétait la base — après les faits de Wikidata, quatre questions expertes
// sur dix venaient de l'art ou du cinéma, et « Depuis 2010 » posait du cinéma
// une fois sur deux (le 11 octobre 2026). La fraîcheur passe toujours devant :
// jamais vues d'abord, vues d'hier soir en dernier.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { baseDEssai, demarrer, ecrire, inscrireProfil, type Banc } from './banc'
import { VUE_RECENTE_MS, aTourDeRole } from '../src/core/campagne'
import type { Categorie } from '../../shared/categories'

type Q = { id: string; meta: { categorie: string; sousTheme: string } }
const q = (id: string, categorie: string, sousTheme = 'un'): Q => ({ id, meta: { categorie, sousTheme } })
const ids = (qs: readonly Q[]) => qs.map(x => x.id)

const MAINTENANT = Date.UTC(2026, 9, 11, 10, 0)
const JOUR_MS = 24 * 3600 * 1000

test('une marche prend ses catégories à tour de rôle : la plus fournie attend son tour', () => {
  const marche = [...Array.from({ length: 6 }, (_, i) => q(`art${i}`, 'Arts & lettres')), q('sport0', 'Sport'), q('cuisine0', 'Cuisine'), q('sport1', 'Sport')]
  assert.deepEqual(ids(aTourDeRole(marche, new Map(), MAINTENANT)), ['art0', 'sport0', 'cuisine0', 'art1', 'sport1', 'art2', 'art3', 'art4', 'art5'])
})

test('la fraîcheur passe devant : une jamais vue d’une catégorie servie avant une déjà vue, une vue d’hier soir en dernier', () => {
  const vues = new Map([
    ['sport0', MAINTENANT - 3 * JOUR_MS],
    ['cuisine0', MAINTENANT - VUE_RECENTE_MS / 2],
    ['geo0', MAINTENANT - 5 * JOUR_MS],
  ])
  const marche = [q('art0', 'Arts & lettres'), q('art1', 'Arts & lettres'), q('geo0', 'Géographie'), q('sport0', 'Sport'), q('cuisine0', 'Cuisine')]
  assert.deepEqual(
    ids(aTourDeRole(marche, vues, MAINTENANT)),
    ['art0', 'art1', 'geo0', 'sport0', 'cuisine0'],
    'les jamais vues, même d’une seule catégorie ; puis la plus anciennement vue ; la vue d’il y a douze heures au bout',
  )
})

test('dans une catégorie, ses sous-thèmes passent aussi à tour de rôle', () => {
  const marche = [
    ...Array.from({ length: 5 }, (_, i) => q(`ecrans${i}`, 'Musique', 'ecrans')),
    q('classique0', 'Musique', 'classique'),
    q('jazz0', 'Musique', 'jazz-monde'),
  ]
  const ordre = ids(aTourDeRole(marche, new Map(), MAINTENANT))
  assert.deepEqual(ordre.slice(0, 3), ['ecrans0', 'classique0', 'jazz0'], 'une musique de film, puis les autres sous-thèmes avant la deuxième')
  assert.equal(ordre.length, marche.length, 'chaque question une fois')
})

test('une marche ne range que ce qu’une série lira', () => {
  const marche = Array.from({ length: 500 }, (_, i) => q(`q${i}`, i % 2 ? 'Sport' : 'Histoire'))
  assert.equal(aTourDeRole(marche, new Map(), MAINTENANT, 60).length, 60)
})

// ── Sur un vrai serveur ────────────────────────────────────────────────────

/** Quatre questions d'art sur cinq, toutes faciles : une série tirée au hasard serait presque tout en art. */
const BASE = baseDEssai(50, {
  difficultes: [1],
  categories: [...Array<Categorie>(8).fill('Arts & lettres'), 'Sport', 'Cuisine'],
})

function questionsLues(banc: Banc, sql: string, cle: string): { id: string }[] {
  const db = new Database(banc.quizDbUrl.replace(/^file:/, ''), { readonly: true, fileMustExist: true })
  try {
    return JSON.parse((db.prepare(sql).get(cle) as { questions: string }).questions)
  } finally {
    db.close()
  }
}

const categoriesDe = (questions: readonly { id: string }[]) => questions.map(x => BASE.parId.get(x.id)!.meta.categorie)

test('une série et le défi de la semaine font tourner les catégories, même quand l’art remplit la base', async () => {
  const banc = await demarrer({ horlogeDuJour: () => MAINTENANT, baseDeLaCampagne: BASE })
  try {
    const lea = await inscrireProfil(banc.url, 'lea', 'Léa')
    const serie = (await (await ecrire(banc.url, '/api/campagne/serie', {}, lea)).json()) as { id: string }
    const deLaSerie = categoriesDe(questionsLues(banc, 'SELECT questions FROM campagne_series WHERE id = ?', serie.id))
    assert.deepEqual(new Set(deLaSerie.slice(0, 3)), new Set(['Arts & lettres', 'Sport', 'Cuisine']), 'trois catégories dès les trois premières')
    assert.deepEqual(
      ['Sport', 'Cuisine'].map(c => deLaSerie.slice(0, 15).filter(x => x === c).length),
      [5, 5],
      'les cinq questions de sport et de cuisine avant la seizième',
    )

    const defi = (await (await ecrire(banc.url, '/api/campagne/defi', {}, lea)).json()) as { id: string }
    const duDefi = categoriesDe(questionsLues(banc, 'SELECT questions FROM campagne_series WHERE id = ?', defi.id))
    assert.deepEqual(new Set(duDefi.slice(0, 3)), new Set(['Arts & lettres', 'Sport', 'Cuisine']), 'le défi de la semaine aussi')
  } finally {
    await banc.close()
  }
})
