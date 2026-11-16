// La frise (`shared/frise.ts`, `server/content/frises/evenements.json`) : ce
// qu'une ligne d'événement doit être, le choix de ses sept événements, ce que
// le téléphone envoie et ce que le serveur relit d'une frise jouée, et le
// contenu livré, relu contre la vraie base. Née avec la frise de l'Expédition
// (la version 13, le 20 octobre 2026, `retours/2026-10-20/la-frise.md`) ; la
// Frise du Cabinet lit les mêmes lignes et la même règle (`refusDuLibelle`,
// que son juge du contenu neuf applique aussi), ses sept événements par
// `choisirLaFriseSansRepli` (`tirage-a-la-piece.test.ts`,
// `cabinet-jeux-images.test.ts`).
//
// Ces épreuves viennent d'`expedition-frise.test.ts`, parti avec
// l'Expédition le 16 novembre 2026. Celles du choix de quatre événements
// (`choisirLaFrise`) et de l'ordre montré (`ordreMontre`, `friseJuste`,
// `evenementsDates`) sont parties avec le code mort qu'elles éprouvaient, le
// même jour : plus aucun lecteur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lireLaBase } from '../src/core/baseCampagne'
import { CATEGORIES } from '../../shared/categories'
import { anneeDe } from '../../shared/sujets'
import { hasardDe } from '../../shared/missions'
import { ECART_DES_ANNEES_DE_LA_FRISE, EVENEMENTS_D_UNE_FRISE_A_THEME } from '../../shared/cabinet/bareme'
import { anneeDite, choisirLaFriseSansRepli, lireUnOrdre, ordreGarde, refusDuLibelle, type EvenementDeLaFrise } from '../../shared/frise'

const LIGNES = JSON.parse(readFileSync(new URL('../content/frises/evenements.json', import.meta.url), 'utf8')) as { id: string; evenement: string }[]

// ── Une ligne, ce que le téléphone envoie ───────────────────────────────────

test('une ligne d’événement dit ce qui s’est passé, jamais quand — un nom de roi ou un titre ne date rien', () => {
  for (const bonne of ['La prise de la Bastille', 'François Ier est fait prisonnier à Pavie', 'La naissance de la Ve République', 'Les Beatles sortent Help!', 'Neil Armstrong marche sur la Lune', 'Apollo 11 se pose sur la Lune']) {
    assert.equal(refusDuLibelle(bonne), null, bonne)
  }
  for (const [mauvaise, pourquoi] of [
    ['La prise de la Bastille en 1789', 'une année'],
    ['Le sacre de Charlemagne, en 800', 'une année de trois chiffres'],
    ['Le début du XIXe siècle', 'un siècle'],
    ['Le disco des années 70', 'une décennie'],
    ['César conquiert la Gaule, av. J.-C', 'avant Jésus-Christ'],
    ['La prise de la Bastille.', 'le point d’une phrase'],
    ['la prise de la Bastille', 'une minuscule en tête'],
    ['La Lune', 'trop court'],
    [`La ${'très '.repeat(20)}longue ligne`, 'trop long'],
    [' La prise de la Bastille', 'un espace au bord'],
    [42, 'pas une ligne'],
  ] as const) {
    assert.notEqual(refusDuLibelle(mauvaise), null, pourquoi)
  }
  assert.equal(anneeDite(1789), '1789')
  assert.equal(anneeDite(-52), '52 av. J.-C.')
})

test('ce que le téléphone envoie, ce que le serveur relit d’une frise jouée', () => {
  assert.deepEqual(lireUnOrdre([3, 1, 0, 2], 4), [3, 1, 0, 2])
  for (const brut of [[0, 1, 2], [0, 1, 1, 2], [0, 1, 2, 4], [0, 1, 2, 1.5], '0123', null, 3]) assert.equal(lireUnOrdre(brut, 4), null, JSON.stringify(brut))
  assert.deepEqual(ordreGarde('1032', 4), [1, 0, 3, 2])
  assert.equal(ordreGarde('103', 4), null)
  assert.equal(ordreGarde('1x32', 4), null)
})

// ── Le contenu ──────────────────────────────────────────────────────────────

test('les événements livrés : chacun une question datée de la base, une ligne qui ne date rien, une fois — et de quoi faire une frise du Cabinet (sept événements à l’écart de sa règle) dans chaque catégorie', () => {
  const parId = new Map(lireLaBase().questions.map(q => [q.id, q]))
  // Au moins ce qui a été livré le 20 octobre 2026 — 1 309 événements, 47 en cuisine au moins : un rangement qui en perdrait se verrait.
  assert.ok(LIGNES.length >= 1309, `${LIGNES.length} événements`)
  assert.equal(new Set(LIGNES.map(l => l.id)).size, LIGNES.length, 'chacun une fois')
  assert.equal(new Set(LIGNES.map(l => l.evenement)).size, LIGNES.length, 'chaque ligne une fois')
  const parCategorie = new Map<string, EvenementDeLaFrise[]>()
  for (const l of LIGNES) {
    assert.equal(refusDuLibelle(l.evenement), null, `${l.id} : ${l.evenement}`)
    const q = parId.get(l.id)
    assert.ok(q, `${l.id} (${l.evenement}) : plus dans la base — retire-le, ou récris la question qui l’a remplacée`)
    assert.ok(q.meta.date && ['annee', 'mois', 'jour'].includes(q.meta.date.precision), `${l.id} : datée à l’année près`)
    const e = { id: l.id, evenement: l.evenement, annee: anneeDe(q.meta.date)!, categorie: q.meta.categorie }
    parCategorie.set(e.categorie, [...(parCategorie.get(e.categorie) ?? []), e])
  }
  for (const c of CATEGORIES) {
    const tas = parCategorie.get(c) ?? []
    assert.ok(tas.length >= 40, `${c} : ${tas.length} événements`)
    assert.ok(choisirLaFriseSansRepli(tas, ECART_DES_ANNEES_DE_LA_FRISE, EVENEMENTS_D_UNE_FRISE_A_THEME, hasardDe(`livres:${c}`)), `${c} : une frise du Cabinet`)
  }
})
