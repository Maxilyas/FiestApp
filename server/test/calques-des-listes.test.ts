// Dans une liste, rien ne garde un calque de la carte graphique.
//
// Le retour du propriétaire du 9 novembre 2026 : au classement du quiz du
// jour, sur un téléphone Android sous Le Ciel, la ligne d'un joueur ne se
// dessinait plus — vide, ou « de la friture sur toute la ligne » —, le
// médaillon de son légendaire seul à sa place. Chaque ligne gardait le calque
// de son entrée (`slide-in … both` : une animation qui garde sa fin garde
// son calque), chaque légendaire le sien (la perspective qui le fait pencher
// sous le doigt, posée même à plat sur tous), et ce qui passe devant un
// médaillon — la gemme de l'Éclat, les bulles des Abysses — un troisième :
// vingt-cinq calques pour huit joueurs, sur un décor peint qui prend déjà
// quatre plein-écrans de la mémoire des tuiles. Un calque que le téléphone
// n'a plus la place de dessiner laisse un trou à sa taille : une ligne.
//
// Node n'a pas de carte graphique : ce fichier garde les deux règles de la
// feuille. Ce qu'elles font à l'écran — vingt-cinq calques, puis dix ; des
// lignes perdues dès 56 Mo, puis aucune à 40 — se rejoue dans un Chromium à la
// mémoire bornée : `retours/2026-11-09/reproductions/classement-sans-sa-ligne.ts`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const CSS = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const REGLES = [...CSS.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map(m => ({ selecteurs: m[1].split(',').map(s => s.trim()), corps: m[2] }))
const regles = (selecteur: string) =>
  REGLES.filter(r => r.selecteurs.includes(selecteur))
    .map(r => r.corps)
    .join('\n')

/** Ce qui fait d'un élément un calque à lui, sans qu'il bouge. */
const FAIT_UN_CALQUE = /will-change|translateZ|translate3d|perspective|rotate[XY3]|backface-visibility/

test('une ligne de classement rend son calque une fois entrée', () => {
  const ligne = regles('.lb-row')
  assert.match(ligne, /animation:\s*slide-in [^;]*\bbackwards\b/, 'son entrée ne retient que son départ')
  // L'entrée finie, la ligne est telle que sa dernière image : `backwards` ne change rien à ce qu'on voit.
  const entree = /@keyframes slide-in \{([^{}]*\{[^{}]*\}\s*)+\}/.exec(CSS)?.[0] ?? ''
  assert.match(entree, /to \{ transform: translateY\(0\); opacity: 1; \}/)
  // Aucune règle d'une ligne ne garde la fin d'une animation, n'en fait tourner une sans fin, ni ne pose de quoi faire un calque.
  for (const r of REGLES) {
    if (!r.selecteurs.some(s => /\.lb-row(?![\w-])/.test(s))) continue
    const animations = [...r.corps.matchAll(/animation(?:-fill-mode|-iteration-count)?:\s*([^;]+)/g)].map(m => m[1])
    for (const a of animations) assert.doesNotMatch(a, /\b(both|forwards|infinite)\b/, `${r.selecteurs.join(', ')} : ${a}`)
    assert.doesNotMatch(r.corps, FAIT_UN_CALQUE, r.selecteurs.join(', '))
  }
})

test('un légendaire ne penche que là où on le prend en main', () => {
  // Hors de là, ni perspective ni transformation : un médaillon de liste se peint avec sa ligne.
  const carte = regles('.lg-carte')
  assert.doesNotMatch(carte, /transform|transition/)
  assert.doesNotMatch(carte, FAIT_UN_CALQUE)
  // Il garde son contexte d'empilement : ce qui sort du cadre, éclaté, reste par-dessus son cercle et sa gerbe derrière.
  assert.match(carte, /isolation:\s*isolate/)
  // En grand — sa révélation, la carte d'un joueur, la clôture —, il penche sous le doigt et se redresse.
  const enMain = regles('.lg-touche-libre .lg-carte')
  assert.match(enMain, /transform:\s*perspective\(4em\) rotateX\(calc\(\(var\(--py\) - 0\.5\) \* -14deg\)\) rotateY\(calc\(\(var\(--px\) - 0\.5\) \* 14deg\)\)/)
  assert.match(enMain, /transition:\s*transform /)
  // Sous le doigt, sans délai — et cette règle-là vient après, à force égale.
  assert.match(regles('.lg-touche .lg-carte'), /transition:\s*none/)
  assert.ok(CSS.indexOf('.lg-touche .lg-carte {') > CSS.indexOf('.lg-touche-libre .lg-carte {'))
})

test('dans une liste, un avatar ne pose rien qui fasse un calque', () => {
  // Les règles qui visent l'avatar d'une ligne ou d'une puce : figé, il n'a aucune raison d'être composé à part.
  for (const r of REGLES) {
    const vises = r.selecteurs.filter(s => /\.lb-avatar(?![\w-])|\.player-chip(?![\w-])/.test(s))
    if (vises.length) assert.doesNotMatch(r.corps, FAIT_UN_CALQUE, vises.join(', '))
  }
  // Et tout ce qui bouge dans un médaillon, une lumière, une bordure s'y arrête : une animation en cours est un calque.
  const fige = REGLES.find(r => r.selecteurs.includes('.av.lb-avatar:not(.av-sujet) .lg *'))
  assert.ok(fige, 'la règle qui fige un médaillon dans une liste')
  for (const s of ['.lg *', '.dv *', '.pt *', '.lu *', '.bo *']) {
    assert.ok(fige.selecteurs.includes(`.av.lb-avatar:not(.av-sujet) ${s}`), `.lb-avatar ${s}`)
    assert.ok(fige.selecteurs.includes(`.player-chip ${s}`), `.player-chip ${s}`)
  }
  assert.match(fige.corps, /animation:\s*none/)
})
