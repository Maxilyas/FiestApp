// « Mes avatars » et « Mon style », à la manière de la maquette.
//
// Les avatars se parcourent en atlas : un rail des douze branches, chacune un
// orbe dont l'anneau se remplit, puis la branche choisie en chemin ; les
// légendaires et les Divins en grilles de médaillons. Le style se lit en
// quatre lignes — ce qui est choisi, en clair —, chacune ouvrant son écran à
// son adresse, la carte collée en tête pendant qu'on règle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { BRANCHES, ouvertsDansLaBranche } from '../../shared/branches'
import { LEGENDAIRES } from '../../shared/legendaires'
import { DIVINS } from '../../shared/divins'

Object.assign(globalThis, {
  React,
  window: { location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' } },
  location: { pathname: '/profil', search: '', hash: '', origin: 'http://banc' },
})

const source = (fichier: string) => readFileSync(new URL(`../../client/src/${fichier}`, import.meta.url), 'utf8')

async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

// La branche la plus avancée ouvre l'atlas : trois portraits sur six.
const avancee = BRANCHES[2]
const savoir = { [avancee.categorie]: avancee.portraits[2].seuil }

const profil = {
  id: 'p',
  login: 'lea',
  name: 'Léa',
  avatar: '🦊',
  finition: 'mat',
  finitionChoisie: 'auto',
  niveau: 3,
  acquis: 40,
  requis: 100,
  titre: null,
  fond: null,
  theme: null,
  laurier: false,
  legendaire: null,
  legendaires: [LEGENDAIRES[0].key],
  divins: [],
  eclats: [],
  eclatsEteints: [],
  hautsFaits: [],
  ecussons: Object.entries(savoir).map(([categorie, justes]) => ({ categorie, justes })),
  boutique: { confettis: { solde: 12 } },
}
const rien = { busy: false, enregistrer: () => {} }

test('le savoir en atlas : douze orbes sur deux rangées, la branche la plus avancée en chemin', async () => {
  const html = await rendu('components/AtlasDesAvatars', 'AtlasDesAvatars', { profil, ...rien, onglet: 'savoir' })
  assert.match(html, /<div class="atlas-rail rail-compact" role="tablist" aria-label="Les douze branches">/)
  assert.equal(html.match(/class="atlas-orbe"/g)?.length, BRANCHES.length)
  // Chaque orbe dit où il en est, en chiffres : l'anneau seul ne se lit pas.
  for (const b of BRANCHES) assert.match(html, new RegExp(`${ouvertsDansLaBranche(b, savoir)}/${b.portraits.length}`), b.nom)
  // La branche ouverte d'abord est celle où l'on avance — trois portraits gagnés, le quatrième qui palpite.
  assert.match(html, /<section class="atlas-branche"/)
  assert.equal(html.match(/class="atlas-etape atlas-gagne"/g)?.length, 3)
  assert.equal(html.match(/class="atlas-etape atlas-prochain"/g)?.length, 1)
  assert.equal(html.match(/class="atlas-etape atlas-ferme"/g)?.length, 2)
  // On passe d'une branche à l'autre aux flèches, sans repasser par le rail.
  assert.match(html, /aria-label="Branche précédente"/)
  assert.match(html, /aria-label="Branche suivante"/)
})

test('les légendaires et les Divins en grilles de médaillons, le compte en tête', async () => {
  const html = await rendu('components/AtlasDesAvatars', 'AtlasDesAvatars', { profil, ...rien, onglet: 'legendaires' })
  assert.doesNotMatch(html, /atlas-rail/, 'les légendaires n’ont pas le rail des branches')
  assert.match(html, new RegExp(`1 sur ${LEGENDAIRES.length}`))
  assert.equal(html.match(/class="hud-case[^"]*"/g)?.length, LEGENDAIRES.length + DIVINS.length)
  assert.equal(html.match(/class="hud-case hud-gagne"/g)?.length, 1)
  // Un Divin verrouillé ne dit rien de lui, pas même son nom (invariant 21).
  assert.match(html, /<div class="hud-grille hud-grille-divins">/)
  for (const d of DIVINS) assert.doesNotMatch(html, new RegExp(`aria-label="${d.nom}`), d.nom)
  assert.match(html, /Ils ne disent pas comment/)
})

test('« Mon style » : quatre lignes, ce qui est choisi en clair, le thème vers la boutique', async () => {
  const html = await rendu('components/PanneauxDuProfil', 'PanneauStyle', { profil, ...rien, onReglage: () => {} })
  assert.match(html, /<button type="button" class="identite"/, 'sa carte en tête : c’est elle qui change')
  const lignes = [...html.matchAll(/<span class="style-nom">([^<]+)<\/span><span class="style-valeur">([^<]+)<\/span>/g)].map(([, nom, valeur]) => `${nom} : ${valeur}`)
  assert.deepEqual(lignes, ['Finition : Auto · Mat', 'Titre : Aucun', 'Fond de carte : Aucun', 'Thème : Velours'])
  assert.match(html, /<li><a href="\/boutique"><span class="style-icone">/)
  // Chaque réglage a son écran, à son adresse : le retour du navigateur ramène au style.
  const app = source('views/ProfilApp.tsx')
  assert.match(app, /type ReglageDuStyle = 'style-finition' \| 'style-titre' \| 'style-fond'/)
  assert.match(app, /onReglage=\{r => ouvrir\(`style-\$\{r\}`\)\}/)
  // Le réglage garde la carte collée en tête, où l'on voit ce qu'on change.
  assert.match(source('components/PanneauxDuProfil.tsx'), /<div className="identite-collante">/)
  assert.match(source('styles.css'), /\.identite-collante \{ position: sticky; top: 0;/)
})
