// La page du téléphone d'un invité, nommée par le serveur avant tout script
// (`core/page.ts`) : la seconde de téléchargement qui suit le scan dit déjà
// « La soirée d'Antoine », au lieu de « Chargement… » sur un écran noir.
//
// Des fonctions pures : `npm test` tourne avant la construction du client, et
// le serveur n'y sert aucune page.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { espaceDeLEntree, pageDEntree } from '../src/core/page'
import { defaultSettings } from '../../shared/space'

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
  assert.match(page, /<meta name="soiree-eyebrow" content="La soirée d’">/)
  assert.match(page, /<meta name="soiree-headline" content="Antoine">/)
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
