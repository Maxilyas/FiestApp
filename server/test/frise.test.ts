// La frise (`shared/frise.ts`, `server/content/frises/evenements.json`) : ce
// qu'une ligne d'événement doit être, le choix de quatre événements à l'écart
// de leur marche, l'ordre montré et ce que le serveur juge et garde, et le
// contenu livré, relu contre la vraie base. Née avec la frise de l'Expédition
// (la version 13, le 20 octobre 2026, `retours/2026-10-20/la-frise.md`) ; la
// Frise du Cabinet lit les mêmes lignes et la même règle (`refusDuLibelle`,
// que son juge du contenu neuf applique aussi), ses sept événements par
// `choisirLaFriseSansRepli` (`cabinet-jeux-images.test.ts`).
//
// Ces quatre épreuves viennent d'`expedition-frise.test.ts`, parti avec
// l'Expédition le 16 novembre 2026 : mot pour mot, rien n'en a changé.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lireLaBase } from '../src/core/baseCampagne'
import { CATEGORIES } from '../../shared/categories'
import { anneeDe } from '../../shared/sujets'
import { hasardDe } from '../../shared/missions'
import {
  ECART_DE_LA_FRISE,
  EVENEMENTS_D_UNE_FRISE,
  anneeDite,
  choisirLaFrise,
  evenementsDates,
  friseJuste,
  lireUnOrdre,
  ordreDansLeTemps,
  ordreGarde,
  ordreMontre,
  refusDuLibelle,
  type EvenementDeLaFrise,
} from '../../shared/frise'

const LIGNES = JSON.parse(readFileSync(new URL('../content/frises/evenements.json', import.meta.url), 'utf8')) as { id: string; evenement: string }[]

/** Un événement d'essai, de cette année et de cette catégorie. */
const evenement = (id: string, annee: number, categorie = 'Histoire'): EvenementDeLaFrise => ({ id, evenement: `L’événement ${id}`, annee, categorie })

// ── Une ligne, le choix de quatre événements ────────────────────────────────

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

test('quatre événements, dans l’ordre du temps, à l’écart de la marche ; ceux qu’il n’a jamais vus d’abord ; trop serrés, l’écart se divise, jamais deux de la même année', () => {
  const tas = [1500, 1540, 1580, 1620, 1660, 1700, 1701, 1702].map((a, i) => evenement(`e${i}`, a))
  for (let n = 0; n < 200; n++) {
    const f = choisirLaFrise(tas, ECART_DE_LA_FRISE.facile, hasardDe(`frise:${n}`))!
    assert.equal(f.length, EVENEMENTS_D_UNE_FRISE)
    assert.ok(f.every((e, k) => k === 0 || e.annee - f[k - 1].annee >= ECART_DE_LA_FRISE.facile), f.map(e => e.annee).join(' '))
  }
  // Ce qu'il a déjà vu passe après : quatre jamais vus suffisent.
  const vus = new Set(['e0', 'e1', 'e2', 'e3'])
  for (let n = 0; n < 50; n++) {
    const f = choisirLaFrise(tas, 1, hasardDe(`frise:vus:${n}`), id => vus.has(id))!
    assert.ok(f.every(e => !vus.has(e.id)), f.map(e => e.id).join(' '))
  }
  // Une catégorie serrée — cinquante ans en tout — : l'écart se divise, jusqu'à ce qu'elle tienne.
  const serre = [1980, 1990, 2000, 2010, 2020].map((a, i) => evenement(`s${i}`, a))
  const f = choisirLaFrise(serre, ECART_DE_LA_FRISE.facile, hasardDe('frise:serre'))!
  assert.equal(new Set(f.map(e => e.annee)).size, 4)
  // Trois années différentes seulement : pas de frise.
  assert.equal(choisirLaFrise([1990, 1990, 2000, 2010].map((a, i) => evenement(`m${i}`, a)), 1, hasardDe('frise:meme')), null)
})

test('l’ordre montré n’est jamais le bon ; ce que le téléphone envoie, ce que le serveur juge et garde', () => {
  for (let n = 0; n < 300; n++) {
    const montre = ordreMontre(4, hasardDe(`montre:${n}`))
    assert.deepEqual([...montre].sort(), [0, 1, 2, 3])
    assert.ok(!montre.every((x, i) => x === i), montre.join(''))
  }
  const montre = [2, 0, 3, 1]
  // Le bon ordre, par le rang des cartes à l'écran : celle qui montre le rang 0, puis le 1…
  const bon = [0, 1, 2, 3].map(k => montre.indexOf(k))
  assert.ok(friseJuste(ordreDansLeTemps(bon, montre)))
  assert.ok(!friseJuste(ordreDansLeTemps([0, 1, 2, 3], montre)))
  assert.deepEqual(lireUnOrdre([3, 1, 0, 2], 4), [3, 1, 0, 2])
  for (const brut of [[0, 1, 2], [0, 1, 1, 2], [0, 1, 2, 4], [0, 1, 2, 1.5], '0123', null, 3]) assert.equal(lireUnOrdre(brut, 4), null, JSON.stringify(brut))
  assert.deepEqual(ordreGarde('1032', 4), [1, 0, 3, 2])
  assert.equal(ordreGarde('103', 4), null)
  assert.equal(ordreGarde('1x32', 4), null)
  // Ce qu'une carte date : autant que ce qu'elle effacerait, jamais les quatre ; le même hasard, les mêmes.
  assert.deepEqual(evenementsDates(hasardDe('date'), 4, 0), [])
  assert.equal(evenementsDates(hasardDe('date'), 4, 1).length, 1)
  assert.equal(evenementsDates(hasardDe('date'), 4, 9).length, 3)
  assert.deepEqual(evenementsDates(hasardDe('date'), 4, 2), evenementsDates(hasardDe('date'), 4, 2))
})

// ── Le contenu ──────────────────────────────────────────────────────────────

test('les événements livrés : chacun une question datée de la base, une ligne qui ne date rien, une fois — et de quoi faire une frise facile dans chaque catégorie', () => {
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
    assert.ok(choisirLaFrise(tas, ECART_DE_LA_FRISE.facile, hasardDe(`livres:${c}`)), `${c} : une frise facile`)
  }
})
