// L'historique, dans « Mon compte » (la remarque du propriétaire du 3
// octobre 2026) : « Historique » ouvrait une page publique à part — une carte
// haute par soirée, sans la barre du menu ni de retour au compte. Il s'ouvre
// maintenant dans le compte, à son adresse (`/compte#historique`) : une ligne
// par soirée, ses deux pages — le souvenir et le bilan — sous chacune, une
// flèche vers « Mon compte », la barre du menu en bas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import type { ArchiveList, ArchiveSummary } from '../../shared/archive'

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

const soiree = (id: string, title: string, heldAt: number, winners: ArchiveSummary['winners'] = []): ArchiveSummary => ({
  id,
  title,
  heldAt,
  archivedAt: heldAt,
  players: 6,
  quizzes: 3,
  questions: 30,
  winners,
  teamWinners: [],
})

test('une ligne par soirée — celle en cours d’abord —, et sous chacune son souvenir et son bilan', async () => {
  Object.assign(globalThis, { React, window: { location: { pathname: '/compte', search: '', hash: '#historique', origin: 'http://banc' } } })
  const module = await import(new URL('../../client/src/components/HistoriqueDuCompte.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const liste: ArchiveList = {
    current: { players: 4, quizzes: 1, questions: 10, since: Date.UTC(2026, 9, 3, 18) },
    archives: [
      soiree('2026-09-27-k7x2q', 'La soirée de Nadia', Date.UTC(2026, 8, 27, 19), [
        { name: 'Hugo', avatar: '🐙', points: 1200 },
        { name: 'Léa', avatar: '🦊', points: 1200 },
      ]),
      soiree('2026-09-20-a1b2c', 'Le quiz des 30 ans', Date.UTC(2026, 8, 20, 19)),
    ],
  } as ArchiveList
  const html = renderToStaticMarkup(React.createElement(module.ListeDesSoirees, { slug: 'chez-bob', liste, onGerer: () => {} }))

  assert.equal(html.match(/<li class="soiree-carte historique-carte">/g)?.length, 3, 'une ligne chacune')
  const pages = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1])
  assert.deepEqual(pages, [
    '/chez-bob/souvenir',
    '/chez-bob/bilan',
    '/chez-bob/soirees/2026-09-27-k7x2q/souvenir',
    '/chez-bob/soirees/2026-09-27-k7x2q/bilan',
    '/chez-bob/soirees/2026-09-20-a1b2c/souvenir',
    '/chez-bob/soirees/2026-09-20-a1b2c/bilan',
  ])
  assert.ok(html.indexOf('En cours') < html.indexOf('La soirée de Nadia'), 'celle qui se joue d’abord')
  assert.match(html, /6 joueurs · 3 quiz · 🏆 🐙 Hugo ex æquo<\/span>/)
  // Renommer et retirer attendent dans la feuille de chaque soirée close, à l'écart des pages.
  assert.match(html, /aria-label="Renommer ou retirer « Le quiz des 30 ans »"/)
  assert.equal(html.match(/class="historique-plus"/g)?.length, 2, 'pas pour celle qui se joue')
})

test('« L’historique » s’ouvre dans le compte : son adresse, la flèche vers « Mon compte », la barre du menu', () => {
  const compte = source('views/AccountApp.tsx')
  assert.match(compte, /history\.pushState\(\{ \.\.\.history\.state, depuisLeCompte: true \}, '', '\/compte#historique'\)/)
  const ecran = compte.slice(compte.indexOf('if (historique) {'), compte.indexOf('/**', compte.indexOf('if (historique) {')))
  assert.match(ecran, /<Sortie vers="Mon compte" href="\/compte" onClick=\{revenirAuCompte\} \/>/)
  assert.match(ecran, /<HistoriqueDuCompte slug=\{me\.space\.slug\} \/>/)
  assert.match(ecran, /<MenuBarre ici="compte" \/>/)
  // La ligne du compte l'ouvre dans la page, pour tout espace — plus la page publique.
  assert.match(compte, /<button type="button" onClick=\{ouvrirHistorique\}>/)
  assert.doesNotMatch(compte, /ligne\('book', 'L’historique', '', `\/\$\{me\.space\.slug\}\/soirees`\)/)
})
