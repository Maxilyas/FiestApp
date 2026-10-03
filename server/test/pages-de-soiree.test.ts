// Le souvenir et le bilan d'une soirée, et l'historique public de l'espace
// (la remarque du propriétaire du 3 octobre 2026) : on ne passe plus de l'un
// à l'autre depuis leurs pages, et ni « Accueil » ni « Mon compte » n'y
// figurent. Chacune s'ouvre d'une liste qui offre les deux — l'historique du
// compte, la fin de soirée, « Mes soirées », « La dernière soirée » —, et une
// flèche, en haut à gauche, y ramène.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

Object.assign(globalThis, { React })
const source = (f: string) => readFileSync(new URL(`../../client/src/${f}`, import.meta.url), 'utf8')
const ORIGINE = 'https://fiestapp.example'

test('la flèche revient d’où l’on venait, et nomme l’endroit', async () => {
  Object.assign(globalThis, { window: { location: { pathname: '/chez-nadia/souvenir', search: '', hash: '' } } })
  // Par son adresse : le typecheck du serveur ne lit pas le JSX du client.
  const { retourDesPages } = await import(new URL('../../client/src/components/SpaceNav.tsx', import.meta.url).href)
  // Depuis l'historique du compte (le fragment ne voyage pas dans la provenance).
  assert.deepEqual(retourDesPages(`${ORIGINE}/compte`, ORIGINE, 3, true), { reculer: true, vers: 'Historique' })
  assert.deepEqual(retourDesPages(`${ORIGINE}/chez-nadia/soirees`, ORIGINE, 3, false), { reculer: true, vers: 'Historique' })
  assert.deepEqual(retourDesPages(`${ORIGINE}/profil`, ORIGINE, 3, false), { reculer: true, vers: 'Mes soirées' })
  // La fin de soirée, à l'adresse de la soirée : on y revient.
  assert.deepEqual(retourDesPages(`${ORIGINE}/chez-nadia`, ORIGINE, 3, false), { reculer: true, vers: 'Retour' })
  // Un lien, un QR, un onglet neuf : rien derrière. L'animateur va à son historique, l'invité à l'accueil.
  assert.deepEqual(retourDesPages('', ORIGINE, 1, true), { reculer: false, vers: 'Historique', href: '/compte#historique' })
  assert.deepEqual(retourDesPages('', ORIGINE, 1, false), { reculer: false, vers: 'Accueil', href: '/' })
  assert.deepEqual(retourDesPages(`${ORIGINE}/compte`, ORIGINE, 1, false), { reculer: false, vers: 'Accueil', href: '/' }, 'ouvert dans un onglet neuf')
  assert.deepEqual(retourDesPages('https://wa.me/xyz', ORIGINE, 4, false), { reculer: false, vers: 'Accueil', href: '/' }, 'un lien reçu ailleurs')
})

test('le bilan empile ses pas, et la flèche les saute tous', () => {
  const nav = source('components/SpaceNav.tsx')
  assert.match(nav, /history\.go\(-1 - Number\(\(history\.state as Record<string, unknown> \| null\)\?\.\[PROFONDEUR\] \?\? 0\)\)/)
  assert.match(nav, /history\.pushState\(\{ \[PROFONDEUR\]: avant \+ 1 \}, '', adresse\)/)
  const bilan = source('views/BilanApp.tsx')
  assert.match(bilan, /pousserDansLaPage\(window\.location\.pathname \+ hashOf\(next\)\)/)
  assert.doesNotMatch(bilan, /history\.pushState/)
})

test('ni fil, ni passage du souvenir au bilan, ni « Accueil » ou « Mon compte »', () => {
  const pages = ['views/RecapApp.tsx', 'views/BilanApp.tsx', 'views/ArchivesApp.tsx'].map(f => [f, source(f)] as const)
  for (const [f, texte] of pages) {
    assert.match(texte, /<RetourDeLaSoiree \/>/, `${f} : la flèche`)
    assert.doesNotMatch(texte, /<SpaceNav|ArchiveBanner/, `${f} : plus de fil ni de bandeau`)
    assert.doesNotMatch(texte, /href="\/compte"|>\s*Mon compte\s*</, `${f} : pas de « Mon compte »`)
  }
  const [, souvenir] = pages[0]
  const [, bilan] = pages[1]
  assert.doesNotMatch(souvenir, /spacePath\(slug, 'bilan'/, 'le souvenir ne mène plus au bilan')
  assert.doesNotMatch(bilan, /spacePath\(slug, 'souvenir'/, 'le bilan ne mène plus au souvenir')
  assert.doesNotMatch(bilan, /Copier le lien de ce bilan/)
  // Le fil et ses liens d'animateur ont quitté le composant commun.
  const nav = source('components/SpaceNav.tsx')
  assert.doesNotMatch(nav, /space-nav|TABS/)
  // Chaque porte d'entrée offre les deux pages : sans le fil, on ne perd ni l'une ni l'autre.
  for (const f of ['components/HistoriqueDuCompte.tsx', 'components/MesSoirees.tsx', 'components/Lendemain.tsx', 'views/ArchivesApp.tsx']) {
    const t = source(f)
    assert.match(t, /'souvenir'/, `${f} : le souvenir`)
    assert.match(t, /'bilan'|lienBilan/, `${f} : le bilan`)
  }
})
