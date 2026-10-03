// La régie : la télécommande du chef qui anime sans jouer, au téléphone.
//
// Le temps en anneau, qui l'on attend encore, puis, à la révélation, le
// partage de la salle en barres, le plus rapide, l'anecdote. Jamais la bonne
// réponse avant la salle : le téléphone de l'animateur se voit par-dessus
// l'épaule (invariant 1) — même si une vue la portait par erreur.
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

async function regie(view: QuizHostView): Promise<string> {
  const module = await import(new URL('../../client/src/games/quiz/Regie.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module.Regie, { view }))
}

const QUESTION: QuizHostView = {
  phase: 'question',
  qIndex: 2,
  qCount: 10,
  kind: 'choice',
  text: 'Quelle est la capitale de l’Australie ?',
  answers: ['Sydney', 'Canberra', 'Melbourne', 'Perth'],
  category: 'Géographie',
  deadline: Date.now() + 12_000,
  duration: 20,
  answeredCount: 3,
  participantCount: 5,
  attendus: [
    { playerId: 'p4', name: 'Hugo', avatar: '🦊', horsLigne: true },
    { playerId: 'p5', name: 'Inès', avatar: '🐼' },
  ],
}

test('pendant la question : l’anneau, la question, les réponses sans la bonne, et qui l’on attend', async () => {
  const html = await regie(QUESTION)
  assert.match(html, /<span class="regie-anneau" role="timer" aria-label="1[23] secondes">/)
  assert.match(html, /<span class="label">Géographie<\/span><h2 class="telecommande-question">Quelle est la capitale de l’Australie/)
  assert.equal((html.match(/<li class="">/g) ?? []).length, 4, 'quatre réponses, aucune marquée')
  assert.doesNotMatch(html, /regie-bonne|regie-coche|regie-nombre/)
  assert.match(html, /<b>3<\/b>\/5/)
  assert.match(html, /<li class="regie-visage regie-hors-ligne">.*?Hugo<\/span><\/li><li class="regie-visage">.*?Inès/)
  // Même si une vue portait la bonne réponse et les comptes avant la révélation, la régie n'en montre rien.
  const fuite = await regie({ ...QUESTION, correct: 1, counts: [1, 2, 0, 0] })
  assert.doesNotMatch(fuite, /regie-bonne|regie-coche|regie-nombre/)
  // En pause : l'anneau le dit.
  assert.match(await regie({ ...QUESTION, paused: true, remainingMs: 8000 }), /aria-label="En pause"/)
})

test('à la révélation : le partage en barres, la bonne marquée, le plus rapide, l’anecdote', async () => {
  const html = await regie({
    ...QUESTION,
    phase: 'reveal',
    attendus: undefined,
    correct: 1,
    counts: [1, 3, 1, 0],
    fastest: { name: 'Léa', ms: 2400 },
    anecdote: 'Bâtie pour départager Sydney et Melbourne.',
  })
  assert.match(html, /<li class="regie-bonne regie-barre" style="--part:1">.*?Canberra.*?<span class="regie-nombre">3<\/span>/)
  assert.match(html, /<li class=" regie-barre" style="--part:0.3333333333333333">.*?Sydney/)
  assert.match(html, /Le plus rapide : <b>Léa<\/b>, 2,4 s/)
  assert.match(html, /Bâtie pour départager/)
  assert.doesNotMatch(html, /regie-visage/, 'plus personne à attendre')
  // « Plusieurs » marque toutes ses bonnes ; le sondage n'en marque aucune.
  const plusieurs = await regie({ ...QUESTION, phase: 'reveal', variante: 'plusieurs', bonnes: [0, 2], counts: [2, 1, 2, 0] })
  assert.equal((plusieurs.match(/regie-coche/g) ?? []).length, 2)
  assert.doesNotMatch(await regie({ ...QUESTION, phase: 'reveal', variante: 'sondage', counts: [2, 1, 2, 0] }), /regie-coche/)
  // Une estimation dit sa réponse.
  assert.match(await regie({ ...QUESTION, phase: 'reveal', kind: 'number', answers: undefined, target: 1913, unit: 'ans' }), /La réponse : <b>1[  ]?913<\/b> ans/)
})

test('la télécommande ouvre la régie, sauf pendant la photo', () => {
  const vue = readFileSync(new URL('../../client/src/games/quiz/HostView.tsx', import.meta.url), 'utf8')
  assert.match(vue, /\{v\.phase !== 'observe' && <Regie view=\{v\} \/>\}/)
})
