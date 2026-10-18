// Une question de l'expédition, à l'écran. Le 18 octobre 2026, le
// propriétaire : « La carte rare pour poser deux réponses, on ne voit pas les
// réponses que l'on choisit. » Sous Double chance, une réponse choisie n'avait
// qu'un fond à peine doré et un filet d'or — que le survol, gardé par le
// téléphone après un toucher, repeignait sur la dernière touchée. Rendue ici
// telle que la page la sert (`renderToStaticMarkup`), et sa règle relue dans
// la feuille de style.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

Object.assign(globalThis, { React, window: { location: { pathname: '/expedition', search: '', hash: '' } } })

/** La page, chargée par son adresse : le typage du serveur ne lit pas le JSX du client. */
type Composant = (props: Record<string, unknown>) => React.ReactNode
async function page(): Promise<{ ReponsesDeLEscale: Composant }> {
  return import(new URL('../../client/src/views/ExpeditionApp.tsx', import.meta.url).href)
}

const CSS = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Les réponses rendues : choisies ou non, cochées ou non, pressées ou non. */
async function reponses(props: Record<string, unknown>) {
  const { ReponsesDeLEscale } = await page()
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(
    React.createElement(ReponsesDeLEscale, { reponses: ['Lyon', 'Paris', 'Marseille', 'Lille'], effacees: new Set<number>(), choisies: [], doubleChance: false, busy: false, onToucher: () => {}, ...props }),
  )
  return [...html.matchAll(/<button class="([^"]+)"([^>]*)>([\s\S]*?)<\/button>/g)].map(m => ({
    classes: m[1].split(' '),
    presse: /aria-pressed="(true|false)"/.exec(m[2])?.[1],
    coche: m[3].includes('ans-check'),
  }))
}

test('sous Double chance, les deux réponses choisies se voient : cochées, pressées, au filet d’or', async () => {
  const toutes = await reponses({ choisies: [1, 3], doubleChance: true })
  assert.deepEqual(
    toutes.map(r => r.classes.includes('exp-choisie')),
    [false, true, false, true],
  )
  assert.deepEqual(
    toutes.map(r => r.coche),
    [false, true, false, true],
    'une coche sur chacune des deux',
  )
  assert.deepEqual(
    toutes.map(r => r.presse),
    ['false', 'true', 'false', 'true'],
    'le lecteur d’écran les dit choisies',
  )
  // Hors Double chance, une réponse ne se dit pas pressée : un toucher répond.
  for (const r of await reponses({})) {
    assert.equal(r.presse, undefined)
    assert.equal(r.coche, false)
  }
})

test('le filet d’or d’une réponse choisie tient sous le doigt : le survol que garde le téléphone ne le repeint pas', () => {
  // Le survol des réponses repeint leur filet ; au téléphone, il reste posé sur la dernière touchée.
  assert.match(CSS, /\.ans-btn:not\(:disabled\):hover \{ border-color: var\(--edge-strong\); \}/)
  // La règle d'une réponse choisie couvre donc ce survol, d'une spécificité au moins égale.
  const regle = /([^{}]*\.ans-btn\.exp-choisie[^{}]*)\{([^}]*)\}/.exec(CSS)
  assert.ok(regle, 'la règle d’une réponse choisie')
  assert.match(regle[1], /\.ans-btn\.exp-choisie:not\(:disabled\):hover/)
  assert.match(regle[2], /border: 1\.5px solid var\(--accent\)/)
})
