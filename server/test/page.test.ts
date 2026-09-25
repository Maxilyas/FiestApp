// La page du téléphone d'un invité, nommée par le serveur avant tout script
// (`core/page.ts`) : la seconde de téléchargement qui suit le scan dit déjà
// « La soirée d'Antoine », au lieu de « Chargement… » sur un écran noir.
//
// Des fonctions pures : `npm test` tourne avant la construction du client, et
// le serveur n'y sert aucune page.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { espaceDeLEntree, pageDEntree } from '../src/core/page'
import { defaultSettings } from '../../shared/space'
import { ADMIN, demarrer } from './banc'

const PAGE = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>FiestApp</title>
  </head>
  <body><div id="root"></div></body>
</html>`

test('seule l’adresse d’un téléphone d’invité désigne un espace', () => {
  assert.equal(espaceDeLEntree('/antoine'), 'antoine')
  assert.equal(espaceDeLEntree('/antoine/'), 'antoine')
  // Les pages de l'animateur, les pages publiques de la soirée, l'accueil : rien.
  for (const chemin of ['/', '/host', '/edit', '/profil', '/antoine/souvenir', '/antoine/soirees/abc', '/s/antoine/space.json', '/Antoine!', '/assets']) {
    assert.equal(espaceDeLEntree(chemin), null, chemin)
  }
})

test('la page nomme la soirée : l’onglet, et ce que lit le repli du client', () => {
  const page = pageDEntree(PAGE, defaultSettings('Antoine'))
  assert.match(page, /<title>La soirée d’Antoine<\/title>/)
  // Les réglages par défaut (`defaultSettings`) : « La soirée », puis
  // « d’Antoine » — l'élision suit le prénom (« de Bob »).
  assert.match(page, /<meta name="soiree-eyebrow" content="La soirée">/)
  assert.match(page, /<meta name="soiree-headline" content="d’Antoine">/)
  // Dans la tête, une seule fois, et le reste de la page intact.
  assert.equal(page.split('soiree-headline').length, 2)
  assert.ok(page.indexOf('soiree-headline') < page.indexOf('</head>'))
  assert.ok(page.includes('<div id="root"></div>'))
})

test('un nom de soirée ne peut rien injecter dans la page', () => {
  const page = pageDEntree(PAGE, {
    title: '</title><script>alert(1)</script>',
    eyebrow: '"><script>alert(2)</script>',
    // Un remplacement par chaîne réinjecterait le texte trouvé à la place de « $& ».
    headline: 'Sam $& Léa & « Co »',
  })
  assert.ok(!page.includes('<script>'), page)
  assert.match(page, /content="Sam \$&amp; Léa &amp; « Co »"/)
  assert.match(page, /<title>&lt;\/title&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/title>/)
  assert.ok(!page.includes('</title></title>'))
})

test('la page servie à l’entrée garde ses balises d’aperçu, et seule elle porte l’en-tête', async () => {
  // Deux mains posent la page servie : le titre et les balises d'aperçu
  // (`core/apercus.ts`), puis, pour l'entrée d'un invité seulement, l'en-tête
  // que l'attente écrit avant le script (`core/page.ts`). Réunies à la
  // fusion des axes 6 et 9 : l'une ne doit pas effacer l'autre, ni déborder
  // sur les autres pages. Un client minimal tient lieu de construit.
  const dist = mkdtempSync(path.join(tmpdir(), 'quizz-dist-'))
  writeFileSync(path.join(dist, 'index.html'), PAGE)
  const banc = await demarrer({ clientDist: dist })
  try {
    const lire = async (chemin: string) => (await fetch(banc.url + chemin)).text()
    const entree = await lire(`/${ADMIN.slug}`)
    assert.match(entree, /<meta property="og:title" content="[^"]+">/)
    assert.match(entree, /<meta name="soiree-eyebrow" content="[^"]+">/)
    assert.match(entree, /<meta name="soiree-headline" content="[^"]+">/)
    assert.equal(entree.split('<title>').length, 2, 'un seul titre')
    assert.equal(entree.split('soiree-headline').length, 2, 'un seul en-tête')
    // Ailleurs, l'aperçu seul.
    const souvenir = await lire(`/${ADMIN.slug}/souvenir`)
    assert.match(souvenir, /og:title/)
    assert.doesNotMatch(souvenir, /soiree-headline/)
    assert.doesNotMatch(await lire('/'), /soiree-headline/)
  } finally {
    await banc.close()
    rmSync(dist, { recursive: true, force: true })
  }
})
