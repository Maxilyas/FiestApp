// La console de l'animateur et le quiz tout prêt (le 11 octobre 2026) : dans
// « Choisis un quiz », un bouton ouvre sa feuille, et le quiz composé se
// lance aussitôt, au multiplicateur choisi — la salle attend. Le tirage
// lui-même : `quiz-tout-pret.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import type { QuizHostView } from '../../shared/games/quiz'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/host', search: '', hash: '', origin: 'http://banc' } },
  location: { pathname: '/host', search: '', hash: '', origin: 'http://banc' },
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

test('composé à la console, le quiz se lance aussitôt, au multiplicateur choisi', () => {
  // La feuille rend le quiz composé ; la console le lance — le serveur l'a
  // rangé dans la bibliothèque avant de répondre (`onLibraryChanged`).
  const vue = readFileSync(new URL('../../client/src/games/quiz/HostView.tsx', import.meta.url), 'utf8')
  assert.match(vue, /verbe="Lancer"[\s\S]{0,400}sendCommand\(\{ type: 'selectPack', packId: quiz\.id, multiplier \}\)/)
  // L'écran commun d'une bibliothèque vide le propose aussi, au lieu de renvoyer écrire.
  const ecran = readFileSync(new URL('../../client/src/views/HostApp.tsx', import.meta.url), 'utf8')
  assert.match(ecran, /bibliothequeVide \?[\s\S]{0,600}Un quiz tout prêt/)
})
