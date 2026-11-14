// Le point sans lissage d'un avatar dessiné.
//
// Quatre retours du même téléphone Android, du 9 au 14 novembre 2026 : au
// classement du quiz du jour, des tuiles entières en friture — les lignes,
// leurs prénoms, leurs points, et à leur place ce qui traînait dans la mémoire
// de la carte graphique —, les médaillons seuls par-dessus. Trois corrections
// à côté (les calques des lignes, ceux du décor, les fusions des médaillons),
// puis ce que le téléphone a dit de lui (`chrome://gpu` : Mali-G52, pilote
// r49p1 « bet0 », Chrome 157, rendu vers une texture multi-échantillonnée) et
// ce que les captures montraient : la friture couvre, chaque fois, les tuiles
// que touche l'avatar d'un même joueur, aux Abysses — les tentacules de ses
// méduses sont des traits, que Chrome ne trace qu'en multi-échantillonnage
// (MSAA) quand le calque s'y prête.
//
// Chrome renonce au MSAA pour tout calque qui contient un dessin sans lissage :
// l'avatar dessiné en pose un, invisible (`SansLissage`, `Avatar.tsx`). Node
// n'a pas de carte graphique : ce fichier garde le point, sa feuille et les
// essais qui l'ôtent ; ce qu'il change à la façon de peindre se relève dans un
// Chromium tracé (`retours/2026-11-14/reproductions/passes-msaa.mts` : des
// centaines de traits tracés en MSAA sans lui, aucun avec), et ce qu'il change
// sur ce téléphone ne se lit que sur ce téléphone — la panne elle-même ne se
// rejoue pas ici (`retours/2026-11-14/friture.md`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const url = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url).href
const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')
const CSS = source('styles.css').replace(/\/\*[\s\S]*?\*\//g, '')
const REGLES = [...CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, sel, corps]) => ({ selecteurs: sel.split(',').map(s => s.trim()), corps }))
const regles = (motif: RegExp) => REGLES.filter(r => r.selecteurs.some(s => motif.test(s)))

async function rendre(props: object): Promise<string> {
  const { Avatar } = await import(url('components/Avatar.tsx'))
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(Avatar, { avatar: '🦊', ...props }))
}

const POINT = /<svg class="av-sans-lissage"[^>]*aria-hidden="true"[^>]*><rect[^>]*shape-rendering="crispEdges"[^>]*><\/rect><\/svg>/

// Le premier, avant qu'aucun dessin n'arrive : les suivants les chargent pour tout le fichier.
test('un emoji nu ne porte rien de plus : ni l’invité anonyme, ni le légendaire qui attend son dessin', async () => {
  assert.equal(await rendre({}), '<span class="av"><span class="av-emoji">🦊</span></span>')
  assert.doesNotMatch(await rendre({ finition: 'or', eclat: true }), /av-sans-lissage/, 'un halo de finition est un dégradé, pas un dessin')
  assert.doesNotMatch(await rendre({ legendaire: 'lg:ouroboros', finition: 'abysses' }), /av-sans-lissage/, 'son dessin pas encore arrivé, il est un emoji')
})

test('un avatar dessiné pose son point sans lissage, dans son cadre', async () => {
  for (const f of ['Legendaire.tsx', 'Lumiere.tsx', 'Bordure.tsx', 'Divin.tsx']) await import(url(`components/${f}`))
  const dessines: Record<string, object> = {
    'un légendaire aux Abysses, éclaté': { legendaire: 'lg:ouroboros', finition: 'abysses', eclat: true },
    'un légendaire sans finition': { legendaire: 'lg:phenix' },
    'un emoji sous la lumière d’une finition': { finition: 'abysses' },
    'un emoji sous sa bordure de ligue': { bordure: { ligue: 'or', crans: 3 } },
    'un emoji taillé dans une matière': { eclat: 'jade' },
    'un Divin': { legendaire: 'dv:helios' },
  }
  for (const [qui, props] of Object.entries(dessines)) {
    const html = await rendre(props)
    assert.match(html, POINT, qui)
    // Enfant direct de l'avatar, le dernier : le calque qui porte l'avatar le porte, et rien de ce qui précède ne bouge.
    assert.match(html, /<span class="av[^"]*">(?!<svg class="av-sans-lissage")[\s\S]*<svg class="av-sans-lissage"[^>]*><rect[^>]*><\/rect><\/svg><\/span>$/, qui)
    assert.equal(html.match(/av-sans-lissage/g)?.length, 1, `${qui} : un seul`)
  }
})

test('le point se peint sans se voir : un pixel presque transparent, hors du flux, sous l’avatar', () => {
  const avatar = source('components/Avatar.tsx')
  // Un composant, pas une constante : un JSX évalué au chargement du module demanderait React avant qu'une page — ou un test — l'ait posé.
  const point = /function SansLissage\(\) \{([\s\S]*?)\n\}\n/.exec(avatar)?.[1] ?? ''
  assert.doesNotMatch(avatar, /^const \w+ = \(\s*<svg/m)
  assert.match(point, /shapeRendering="crispEdges"/, 'la seule façon de dire « sans lissage » à un dessin')
  // Il doit se peindre pour compter : une opacité nulle, et le navigateur ne retient aucun dessin.
  const opacite = Number(/fillOpacity="([\d.]+)"/.exec(point)?.[1])
  assert.ok(opacite > 0 && opacite <= 0.02, `une opacité de ${opacite}`)
  assert.match(point, /width="1" height="1"/)
  assert.match(point, /aria-hidden="true"/)
  // Enfant direct de l'avatar, et plus fort que la règle d'une page qui dimensionne ses dessins (`.timbre svg`).
  const [base] = regles(/^\.av > \.av-sans-lissage$/)
  assert.ok(base, 'sa règle')
  assert.match(base.corps, /position:\s*absolute/)
  assert.match(base.corps, /pointer-events:\s*none/)
  assert.doesNotMatch(base.corps, /display:\s*none|visibility|opacity/)
  // Sous l'emoji et le médaillon, qui passent devant (`z-index: 1`).
  assert.doesNotMatch(base.corps, /z-index/)
})

test('seuls l’écran commun et l’essai `sonde` l’ôtent', () => {
  const otent = regles(/\.av-sans-lissage$/)
    .filter(r => /display:\s*none/.test(r.corps))
    .flatMap(r => r.selecteurs)
    .sort()
  assert.deepEqual(otent, ['.host .av-sans-lissage', ":root[data-sans~='sonde'] .av-sans-lissage"])
})

test('un essai ôte une pièce des avatars d’une liste, le temps d’une page, et rien d’autre', () => {
  const essais = REGLES.filter(r => r.selecteurs.some(s => s.includes('[data-sans~=')))
  // Un sélecteur à `:is(a, b)` porte une virgule : la règle entière, pas ses morceaux.
  const pieces = essais.flatMap(r => [...r.selecteurs.join(', ').matchAll(/\[data-sans~='([a-z]+)'\]/g)].map(m => m[1])).sort()
  assert.deepEqual(pieces, ['bordure', 'gemme', 'lumiere', 'medaillon', 'motif', 'sonde'])
  // Un essai passe devant toute règle : la gemme d'un médaillon de liste se montre par une règle aussi forte, écrite après.
  for (const r of essais) assert.match(r.corps, /^\s*display:\s*none !important;\s*$/, r.selecteurs.join(', '))
  // La page ne le pose que de son adresse, des mots simples, sous try/catch — et ne l'écrit nulle part.
  const entree = source('main.tsx')
  const poser = /function poserLEssai\(\) \{([\s\S]*?)\n\}\n/.exec(entree)?.[1] ?? ''
  assert.match(poser, /try \{[\s\S]*URLSearchParams\(window\.location\.search\)\.get\('sans'\)[\s\S]*\} catch/)
  assert.match(poser, /\/\^\[a-z\]\+\$\/\.test\(piece\)/)
  assert.match(poser, /document\.documentElement\.dataset\.sans = pieces\.join\(' '\)/)
  assert.doesNotMatch(poser, /localStorage|sessionStorage|fetch\(/)
  assert.match(entree, /\nposerLEssai\(\)\n/)
})
