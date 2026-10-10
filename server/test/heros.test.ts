// Les pages phares, à la manière de la maquette : la campagne et le quiz du
// jour s'ouvrent sur un panneau qui donne envie, la fiche d'un quiz sur un
// en-tête teinté de sa catégorie. Ce qui compte ici n'est pas la couleur
// mais l'ordre et ce qu'on lit d'abord.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

test('la campagne s’ouvre sur son défi : le record, l’échelle et les règles dans un même panneau', () => {
  const page = source('views/CampagneApp.tsx')
  const heros = page.slice(page.indexOf('<section className="atlas-branche campagne-heros"'), page.indexOf('</section>', page.indexOf('campagne-heros')))
  assert.ok(heros.length > 0, 'le panneau')
  assert.match(heros, /<h1>Jusqu’où iras-tu&nbsp;\?<\/h1>/)
  assert.match(heros, /<b>\{etat\.record\}<\/b>/)
  assert.match(heros, /<ol className="campagne-echelle" aria-label="La difficulté monte">/)
  // L'expérience et son plafond restent dits avant de jouer — et les vingt
  // premières du jour, qui paient double (le 6 octobre 2026).
  assert.match(heros, /\{XP_PAR_JUSTE\} XP par bonne réponse, sans limite — le double pour les \{JUSTES_DOUBLEES_PAR_JOUR\} premières du jour/)
  // Les cœurs ne se lisent pas deux fois à l'oreille.
  assert.match(heros, /<span aria-hidden="true">\s*<Vies restantes=\{VIES\} \/>\s*<\/span>/)
  // Les catégories en grille, l'emblème de chacune — celui des écussons —, et « Toutes » d'un toucher,
  // qui quitte aussi un sujet choisi : sur un sujet, aucune catégorie ne se dit choisie.
  assert.match(page, /<div className="categories-grille" role="group" aria-label="Catégories">/)
  assert.match(page, /<Icon name=\{EMBLEME\[c\.categorie\] \?\? 'star'\} \/>/)
  assert.match(page, /aria-pressed=\{!sujetJouable && categories\.length === 0\} onClick=\{\(\) => setCategories\(\[\]\)\}/)
  assert.match(source('components/Ecusson.tsx'), /export const EMBLEME: Record<string, IconName>/)
})

test('le quiz du jour à jouer : la sortie en tête, aujourd’hui d’abord, hier dessous', () => {
  const page = source('views/JourApp.tsx')
  const debut = page.indexOf('// À jouer — ou en cours')
  const ecran = page.slice(debut, page.indexOf('\n}\n', debut))
  // La sortie vit dans la barre du haut ; la série et la cloche du rappel du soir à sa droite.
  const sortie = ecran.indexOf('<BarreDuJour partie={partie} />')
  const aujourdhui = ecran.indexOf('<section className="card jour-carte jour-heros">')
  const hier = ecran.indexOf('<Lendemain ')
  assert.ok(sortie > 0 && aujourdhui > sortie && hier > aujourdhui, 'Sortie, puis aujourd’hui, puis hier')
  assert.match(page, /function BarreDuJour\(\{ partie \}: \{ partie\?: PartieDuJour \}\) \{\s*return \(\s*<div className="jour-barre">\s*<Sortie \/>/, 'la barre commence par la sortie')
  // Deux cartes au plus sous la barre : le jour, puis hier et le mois d'avant
  // ensemble — les sabliers n'ont plus la leur (la remarque du propriétaire
  // du 5 octobre 2026).
  assert.match(ecran, /\{partie\.sonHier \? \(\s*<Lendemain [^\n]*\/>\s*\) : \(\s*partie\.moisDernier && <MoisDernier /)
  assert.doesNotMatch(page, /GardeDeLaSerie|jour-garde/, 'plus de carte pour les sabliers')
  // Une seule sortie : celle du bas faisait doublon.
  assert.doesNotMatch(ecran, /Retour à l’accueil/)
  // « Jouer » respire, sauf si le système demande moins de mouvement.
  const css = source('styles.css')
  assert.match(css, /\.jour-heros \.btn-primary \{ margin-top: 6px; animation: jour-respire/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.jour-heros \.btn-primary \{ animation: none; \} \}/)
})

test('la fiche d’un quiz : son en-tête dans un cadre teinté de sa catégorie', () => {
  const css = source('styles.css')
  assert.match(css, /\.quiz-heros \{[^}]*border: 1px solid color-mix\(in srgb, var\(--lueur\) 40%, transparent\)/)
  assert.match(css, /\.quiz-categories li \{[^}]*font-size: var\(--t-label\)/)
  // La teinte vient de la catégorie du quiz, posée sur la fiche.
  assert.match(source('components/MesQuiz.tsx'), /<section className="quiz-fiche" style=\{lueurDe\(q\)\} aria-labelledby="fiche-titre">/)
})
