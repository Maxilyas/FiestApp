// La boutique a deux rayons — les thèmes, les vies des sentiers —, chacun son
// onglet, sous une barre fine (la remarque du propriétaire du 5 octobre
// 2026) : les vies, posées sous la vitrine des thèmes, ne se trouvaient
// qu'en la faisant défiler toute.
//
// Pas de serveur : la page de la boutique, rendue en HTML — la recette de
// `profil-atlas.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

const lieu = { pathname: '/boutique', search: '', hash: '', origin: 'http://banc' }
Object.assign(globalThis, { React, window: { location: lieu }, location: lieu })

/** Jeanne, 420 confettis en poche, trois thèmes à elle. */
const JEANNE = {
  theme: 'ivoire',
  boutique: {
    confettis: { gagnes: 820, depenses: 400, solde: 420 },
    possedes: ['velours', 'ivoire', 'neige'],
    porte: null,
    jour: '2026-09-29',
  },
}

/** La boutique ouverte à cette adresse. */
async function boutique(hash = ''): Promise<string> {
  lieu.hash = hash
  const module = await import(new URL('../../client/src/components/PanneauxDuProfil.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(
    React.createElement(module.PanneauBoutique, { profil: JEANNE, busy: false, enregistrer: () => {}, acheter: async () => null, onSolde: () => {} }),
  )
}

/** Les onglets de la barre fine — la vitrine des thèmes a les siens, ses raretés. */
function onglets(html: string) {
  const debut = html.indexOf('class="onglets onglets-fins"')
  const barre = html.slice(debut, html.indexOf('</div>', debut))
  return [...barre.matchAll(/<button\b([^>]*role="tab"[^>]*)>(.*?)<\/button>/g)].map(m => ({
    nom: m[2].replace(/<[^>]+>/g, ''),
    choisi: /aria-selected="true"/.test(m[1]),
  }))
}

test('la boutique a deux rayons, chacun son onglet, sous une barre fine', async () => {
  const html = await boutique()
  assert.deepEqual(onglets(html), [
    { nom: 'Thèmes', choisi: true },
    { nom: 'Vies', choisi: false },
  ])
  assert.match(html, /class="onglets onglets-fins"/, 'la barre fine, pas les pilules')
  assert.match(html, /role="tabpanel"/)
  assert.match(html, /class="gemmes"/, 'la vitrine des thèmes d’abord')
  assert.doesNotMatch(html, /class="vies-achat rayon-vies"/, 'les vies attendent leur onglet')

  // À son adresse, le rayon des vies : un lien peut y mener.
  const vies = await boutique('#vies')
  assert.deepEqual(onglets(vies), [
    { nom: 'Thèmes', choisi: false },
    { nom: 'Vies', choisi: true },
  ])
  assert.match(vies, /class="vies-achat rayon-vies"/)
  assert.doesNotMatch(vies, /class="gemmes"/)
  lieu.hash = ''
})

test('la barre fine : un trait sous le texte, sans cadre ni pilule', () => {
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  const regle = (selecteur: string) => css.slice(css.indexOf(`${selecteur} {`)).split('}')[0]
  assert.match(regle('.onglets.onglets-fins'), /border: 0/)
  assert.match(regle('.onglets.onglets-fins'), /border-bottom: 1px solid var\(--edge\)/)
  assert.match(regle('.onglets-fins .onglet.actif'), /border-bottom-color: var\(--accent\)/)
  assert.match(regle('.onglets-fins .onglet.actif'), /box-shadow: none/)
})
