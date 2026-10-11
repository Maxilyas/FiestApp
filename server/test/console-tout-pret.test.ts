// La console de l'animateur et le quiz tout prêt (le 11 octobre 2026) : dans
// « Choisis un quiz », un bouton ouvre sa feuille, et le quiz composé se
// lance aussitôt, au multiplicateur choisi — la salle attend. Le tirage
// lui-même : `quiz-tout-pret.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import type { QuizHostView } from '../../shared/games/quiz'

const memoire = new Map<string, string>()
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/host', search: '', hash: '', origin: 'http://banc' } },
  location: { pathname: '/host', search: '', hash: '', origin: 'http://banc' },
  localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) },
})

const CHOIX: QuizHostView = {
  phase: 'pickPack',
  qIndex: 0,
  qCount: 0,
  packs: [
    { id: 'q1', title: 'Les années 90', questionCount: 10 },
    { id: 'q2', title: 'Le quiz de Noël', questionCount: 12 },
  ],
} as unknown as QuizHostView

test('« Choisis un quiz » propose un quiz tout prêt, à côté de la bibliothèque', async () => {
  const module = await import(new URL('../../client/src/games/quiz/HostView.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(React.createElement(module.QuizHost, { view: CHOIX, teams: [], sendCommand: () => {}, endSession: () => {} }))
  const boutons = [...html.matchAll(/<button[^>]*>(.*?)<\/button>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim())
  assert.ok(boutons.includes('Un quiz tout prêt'), boutons.join(' | '))
  // La feuille ne vient qu'au toucher : rien d'elle au premier rendu.
  assert.doesNotMatch(html, /Composer|Lancer \d+ questions/)
})

// Tout joué ce soir, « C'est parti ! » sur un quiz « Joué ce soir » restait le
// bouton principal, et le quiz tout prêt — le geste d'une manche de plus —
// un bouton fantôme (l'expert du quiz tout prêt, le 11 octobre 2026).
test('tout joué ce soir : le quiz tout prêt devient le geste principal, les autres se rejouent', async () => {
  const module = await import(new URL('../../client/src/games/quiz/HostView.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const rendre = (view: QuizHostView) => renderToStaticMarkup(React.createElement(module.QuizHost, { view, teams: [], sendCommand: () => {}, endSession: () => {} }))
  const boutons = (html: string) =>
    [...html.matchAll(/<button class="([^"]*)"[^>]*>(.*?)<\/button>/g)].map(m => `${m[1]} : ${m[2].replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").trim()}`)
  const joues = { ...CHOIX, packs: CHOIX.packs!.map(p => ({ ...p, joueCeSoir: true })) } as QuizHostView
  const tout = boutons(rendre(joues))
  assert.ok(tout.includes('btn btn-primary : Un quiz tout prêt'), tout.join(' | '))
  assert.equal(tout.filter(b => b === 'btn : Rejouer').length, 2, tout.join(' | '))
  // Un seul quiz encore à jouer : rien ne change.
  const un = boutons(rendre({ ...joues, packs: [joues.packs![0], { ...joues.packs![1], joueCeSoir: false }] } as QuizHostView))
  assert.ok(un.includes('btn btn-ghost : Un quiz tout prêt'), un.join(' | '))
  assert.equal(un.filter(b => b === "btn btn-primary : C'est parti !").length, 2, un.join(' | '))
})

test('composé à la console, le quiz se lance aussitôt, au multiplicateur choisi', () => {
  // La feuille rend le quiz composé ; la console le lance — le serveur l'a
  // rangé dans la bibliothèque avant de répondre (`onLibraryChanged`).
  const vue = readFileSync(new URL('../../client/src/games/quiz/HostView.tsx', import.meta.url), 'utf8')
  assert.match(vue, /verbe="Lancer"[\s\S]{0,400}sendCommand\(\{ type: 'selectPack', packId: quiz\.id, multiplier \}\)/)
  // L'écran commun d'une bibliothèque vide le propose aussi, au lieu de renvoyer écrire.
  const ecran = readFileSync(new URL('../../client/src/views/HostApp.tsx', import.meta.url), 'utf8')
  assert.match(ecran, /bibliothequeVide \?[\s\S]{0,600}Un quiz tout prêt/)
  // La salle déjà là, il s'y lance aussi d'un toucher : la partie s'ouvre, puis le choisit.
  // Composé avant elle, il le dit. (L'expert du quiz tout prêt, le 11 octobre 2026 : il
  // fallait encore « Lancer un quiz » puis « C'est parti ! », et rien ne disait ce qui était prêt.)
  assert.match(ecran, /verbe=\{connectedCount > 0 \? 'Lancer' : 'Composer'\}/)
  assert.match(ecran, /if \(connectedCount > 0\) \{\s+aLancer\.current = \{ quizId: quiz\.id, le: Date\.now\(\) \}\s+lancerQuiz\(\)\s+\} else showToast\(/)
  assert.match(ecran, /phaseEnCours !== 'pickPack'\) return[\s\S]{0,200}type: 'selectPack', packId: voulu\.quizId/)
})

// Dans « Mes quiz » vide, il arrivait en douzième, sous les onze modèles — à
// près de quatre écrans d'un téléphone —, et « Par où commencer » disait « un
// quiz tout fait », le mot des modèles. Et le ▶ « Lancer » d'un compte
// d'animateur sans profil menait à « Me connecter », alors qu'il l'était
// (l'expert du quiz tout prêt, le 11 octobre 2026).
test('une bibliothèque vide propose le quiz tout prêt en tête ; « Lancer » sans profil mène à l’écran commun', () => {
  const editeur = readFileSync(new URL('../../client/src/views/EditorApp.tsx', import.meta.url), 'utf8')
  const premiersPas = editeur.slice(editeur.indexOf('function PremiersPas('), editeur.indexOf('const ACCORDS_AFFICHES'))
  const toutPret = premiersPas.indexOf('Composer un quiz tout prêt')
  assert.ok(toutPret > 0 && toutPret < premiersPas.indexOf('{rayons.map('), 'avant les rayons des modèles')
  assert.equal(premiersPas.match(/onClick=\{onToutPret\}/g)?.length, 1, 'une seule porte, en tête')
  const compte = readFileSync(new URL('../../client/src/views/AccountApp.tsx', import.meta.url), 'utf8')
  assert.match(compte, /compose un quiz tout prêt en un geste/)
  assert.doesNotMatch(compte, /quiz tout fait/)

  const salon = readFileSync(new URL('../../client/src/views/SalonApp.tsx', import.meta.url), 'utf8')
  assert.match(salon, /setEtat\(\{ e: \(await currentMe\(\)\) \? 'animateur' : 'anonyme' \}\)/)
  assert.match(salon, /etat\.e === 'animateur' \?[\s\S]{0,400}href="\/host"[\s\S]{0,120}Ouvrir l’écran commun/)
})

test('la feuille dit ce que durera le quiz, et ce que « Des enfants jouent » promet', async () => {
  const module = await import(new URL('../../client/src/components/QuizToutPret.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  memoire.delete('quizz.quizToutPret')
  const html = renderToStaticMarkup(React.createElement(module.FeuilleDuQuizToutPret, { onFermer: () => {}, onCompose: () => {} }))
  // Quinze questions, dont trois estimations de trente secondes : huit minutes, révélations comprises.
  assert.match(html, /class="tout-pret-resume">Toutes les catégories · progressive · ≈ 8 min</)
  assert.match(html, /D’abord ce que les enfants savent/)
  memoire.set('quizz.quizToutPret', JSON.stringify({ nombre: 30, estimations: false, enfants: true }))
  const long = renderToStaticMarkup(React.createElement(module.FeuilleDuQuizToutPret, { onFermer: () => {}, onCompose: () => {} }))
  assert.match(long, /class="tout-pret-resume">Toutes les catégories · progressive · ≈ 14 min · des enfants jouent · que des QCM</)
  memoire.delete('quizz.quizToutPret')
})

test('le dernier choix composé se retient sur le téléphone, relu prudemment', async () => {
  const module = await import(new URL('../../client/src/components/QuizToutPret.tsx', import.meta.url).href)
  assert.deepEqual(module.choixRetenu(), {}, 'rien de retenu : la feuille réglée d’office')
  // Ce que ce téléphone ne connaît plus — une catégorie, un sujet, un nombre qu'on ne propose pas — n'y revient pas.
  memoire.set(
    'quizz.quizToutPret',
    JSON.stringify({ categories: ['Sport', 'Astrologie', 'Histoire'], sujet: 'inconnu', difficulte: 'facile', nombre: 12, enfants: true, estimations: false }),
  )
  assert.deepEqual(module.choixRetenu(), { categories: ['Histoire', 'Sport'], difficulte: 'facile', enfants: true, estimations: false })
  memoire.set('quizz.quizToutPret', '{pas du json')
  assert.deepEqual(module.choixRetenu(), {})
  // La feuille s'ouvre sur lui, et retient le choix composé — après la réponse du serveur, pas avant.
  const source = readFileSync(new URL('../../client/src/components/QuizToutPret.tsx', import.meta.url), 'utf8')
  assert.match(source, /useState\(choixRetenu\)/)
  assert.match(source, /await api\.quizToutPret\.composer\(choix\)\s+retenirLeChoix\(choix\)/)
})
