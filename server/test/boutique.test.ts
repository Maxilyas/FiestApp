// La boutique a deux rayons — les thèmes, les objets —, chacun son onglet,
// sous une barre fine (la remarque du propriétaire du 5 octobre 2026) : les
// vies, posées sous la vitrine des thèmes, ne se trouvaient qu'en la faisant
// défiler toute. Le rayon des vies est devenu celui des objets — les vies,
// le sablier de la série, et ce qui viendra —, en icônes : toucher l'une
// dit ce qu'on achète et combien (la remarque du 5 octobre 2026, au soir).
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
    { nom: 'Objets', choisi: false },
  ])
  assert.match(html, /class="onglets onglets-fins"/, 'la barre fine, pas les pilules')
  assert.match(html, /role="tabpanel"/)
  assert.match(html, /class="gemmes"/, 'la vitrine des thèmes d’abord')
  assert.doesNotMatch(html, /class="objets-grille"/, 'les objets attendent leur onglet')

  // À son adresse, le rayon des objets : un lien peut y mener.
  const objets = await boutique('#objets')
  assert.deepEqual(onglets(objets), [
    { nom: 'Thèmes', choisi: false },
    { nom: 'Objets', choisi: true },
  ])
  assert.match(objets, /class="objets-grille"/)
  assert.doesNotMatch(objets, /class="gemmes"/)
  lieu.hash = ''
})

/** Les cases du rayon des objets : leur nom, leur prix, et si leur fiche est dépliée. */
function cases(html: string) {
  return [...html.matchAll(/<button\b[^>]*class="objet-case[^"]*"[^>]*aria-expanded="(true|false)"[^>]*>(.*?)<\/button>/g)].map(m => ({
    nom: /class="objet-nom">([^<]*)</.exec(m[2])?.[1],
    prix: /class="objet-prix">([^<]*)</.exec(m[2])?.[1],
    ouverte: m[1] === 'true',
  }))
}

test('les objets en icônes : une case par objet, sa fiche au toucher, avec la quantité', async () => {
  // Le rayon : des cases, rien de déplié — on voit tout ce qui s'achète d'un coup d'œil.
  const rayon = await boutique('#objets')
  assert.deepEqual(cases(rayon), [
    { nom: 'Vie', prix: '🎊 25', ouverte: false },
    { nom: 'Sablier', prix: '🎊 50', ouverte: false },
  ])
  assert.match(rayon, /class="objet-dessin"><svg class="coeur-de-vie"/, 'la vie a son cœur')
  assert.match(rayon, /class="objet-dessin"><svg class="sablier sablier-plein"/, 'le sablier, le sien')
  assert.doesNotMatch(rayon, /id="fiche-objet"/, 'aucune fiche avant le toucher')
  assert.match(rayon, /class="objet-compte" aria-hidden="true">0\/2</, 'ce qu’on a de sabliers, sur sa case')
  assert.match(rayon, /class="sr-only">Tu en as : 0 sur 2/, 'et en toutes lettres pour le lecteur d’écran')

  // L'adresse d'un objet ouvre sa fiche — le lien de la série, au quiz du
  // jour : ce que c'est, son prix, combien on en prend, le total.
  const sablier = await boutique('#objet-sablier')
  assert.deepEqual(
    cases(sablier).map(c => c.ouverte),
    [false, true],
  )
  const fiche = sablier.slice(sablier.indexOf('id="fiche-objet"'))
  assert.match(fiche, /aria-label="Sablier"/)
  assert.match(fiche, /class="galerie-detail-nom">Sablier</)
  assert.match(fiche, /class="detail-famille muted">Série du quiz du jour</, 'où il sert')
  assert.match(fiche, /Un jour sans quiz du jour en prend un/, 'ce qu’il fait')
  assert.match(fiche, /aria-label="Combien : 1 sablier"/, 'la quantité, un d’abord')
  assert.match(fiche, /1 sablier · 🎊 50/)
  assert.match(fiche, />Acheter · 🎊 50</)
  // C'est là que mène la feuille de la série, au quiz du jour.
  const { adresseDeLObjet } = await import(new URL('../../client/src/components/Objets.tsx', import.meta.url).href)
  assert.equal(adresseDeLObjet('sablier'), '/boutique#objet-sablier')
  assert.match(readFileSync(new URL('../../client/src/views/JourApp.tsx', import.meta.url), 'utf8'), /href=\{adresseDeLObjet\('sablier'\)\}/)

  // L'adresse d'avant, quand le rayon ne vendait que les vies, y mène encore.
  const vies = await boutique('#vies')
  assert.equal(onglets(vies)[1].choisi, true)
  assert.deepEqual(
    cases(vies).map(c => c.ouverte),
    [true, false],
  )
  assert.match(vies.slice(vies.indexOf('id="fiche-objet"')), /aria-label="Combien : 1 vie"/)
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
