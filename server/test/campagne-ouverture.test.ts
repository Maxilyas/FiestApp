// La campagne s'ouvre tout de suite : sa page d'abord, ce qu'elle attend du
// serveur ensuite.
//
// Touchée depuis l'accueil, elle restait 3 à 4 s sur « Chargement… » au
// premier passage après un déploiement : le serveur lisait sa base à la
// première série (`campagne-charge.test.ts` vérifie qu'il la lit maintenant
// en fond). La page montre son défi et ses règles sans attendre, et
// l'accueil télécharge son code avant le toucher.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

const memoire = new Map<string, string>()
Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/campagne', search: '', hash: '', origin: 'http://banc', host: 'banc' }, addEventListener: () => {} },
  document: { addEventListener: () => {}, visibilityState: 'visible', hidden: false },
  localStorage: { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) },
})
const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)

test('la campagne s’ouvre sur sa page, pas sur « Chargement… » : le défi et les règles d’abord', async () => {
  const module = await import(client('views/CampagneApp.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(React.createElement(module.CampagneEnChemin))
  assert.match(html, /Jusqu’où iras-tu/)
  assert.match(html, /trois vies/)
  assert.match(html, /ton record/, 'la place du record, sans rien décaler quand il arrive')
  assert.match(html, /aria-disabled="true"[^>]*>.*Commencer une série/, 'le bouton attend la série à reprendre')
  assert.doesNotMatch(html, /Chargement…/)
  // Et c'est elle que la page rend tant que le serveur n'a pas répondu —
  // ouverte sur les sentiers (`#sentiers`), la place de leurs tuiles.
  const page = readFileSync(client('views/CampagneApp.tsx'), 'utf8')
  assert.match(page, /if \(ecran\.e === 'chargement'\) return <CampagneEnChemin \/>/)
  assert.match(page, /if \(ecran\.e === 'chargement' && mode === 'sentiers'\) return <SentiersEnChemin onglets=\{onglets\} \/>/)
})

test('l’accueil d’un profil télécharge en fond le code de la campagne et du quiz du jour', () => {
  const accueil = readFileSync(client('views/ProfilApp.tsx'), 'utf8')
  assert.match(accueil, /import\('\.\/CampagneApp'\)/)
  assert.match(accueil, /import\('\.\/JourApp'\)/)
  assert.match(accueil, /if \(VUE !== 'accueil' \|\| !aUnProfil\) return/, 'à l’accueil, et pour un profil seulement')
})
