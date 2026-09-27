// Le téléphone à 320 px et au texte agrandi.
//
// L'audit du 27 septembre 2026 (`retours/2026-09-27/`, axe 11) l'a mesuré dans
// Chromium : à 320 px, les lauréats n'avaient plus que « M… » de leur prénom ;
// à 277 px — un 360 au texte à 130 % —, plus une lettre, laurier ou pas, et
// « Camille (2) » perdait sa marque dans les points de suspension. Le rendu
// se regarde dans un navigateur ; ici, ce qui le décide et qu'une retouche
// défairait sans que le typecheck le voie.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import React from 'react'
import { partsDuNomAffiche } from '../../shared/homonymes'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

/** Un composant du client, rendu en HTML — la recette d'`accessibilite.test.ts`. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

const CSS = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')

/** Le corps de la première règle dont le sélecteur est exactement celui-ci. */
function regle(selecteur: string, dans = CSS): string {
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(?:^|[{}])\\s*${echappe}\\s*\\{([^}]*)\\}`, 'm').exec(dans)
  assert.ok(m, `la règle ${selecteur} existe`)
  return m[1]
}

/** Les blocs `@container …` de la feuille, entiers, accolades comprises. */
function requetesDeConteneur(): { condition: string; corps: string }[] {
  const blocs: { condition: string; corps: string }[] = []
  for (const m of CSS.matchAll(/@container\s*([^{]*)\{/g)) {
    let profondeur = 1
    let k = m.index! + m[0].length
    while (profondeur > 0 && k < CSS.length) {
      if (CSS[k] === '{') profondeur++
      else if (CSS[k] === '}') profondeur--
      k++
    }
    blocs.push({ condition: m[1].trim(), corps: CSS.slice(m.index! + m[0].length, k - 1) })
  }
  return blocs
}

// ── La marque d'homonymie ne se coupe jamais ──────────────────────────────

test('« Camille (2) » se coupe au prénom : la marque reste, le laurier aussi', async () => {
  // La marque se reconnaît à la forme que `nomsAffiches` écrit.
  assert.deepEqual(partsDuNomAffiche('Camille (2)'), { prenom: 'Camille', marque: ' (2)' })
  assert.deepEqual(partsDuNomAffiche('Marie-Charlotte Lefebvre (12)'), { prenom: 'Marie-Charlotte Lefebvre', marque: ' (12)' })
  assert.deepEqual(partsDuNomAffiche('Camille'), { prenom: 'Camille', marque: '' })
  // Le premier arrivé n'est jamais marqué : « (1) » est un prénom, pas une marque.
  assert.deepEqual(partsDuNomAffiche('Jo (1)'), { prenom: 'Jo (1)', marque: '' })
  assert.deepEqual(partsDuNomAffiche('(2)'), { prenom: '(2)', marque: '' })

  // Le prénom dans sa case qui se coupe, la marque à côté, son espace dans le
  // texte : la ligne se lit toujours « Camille (2) ».
  assert.equal(
    await rendu('components/Laurier', 'NomLaure', { nom: 'Camille (2)' }),
    '<span class="nom-laure"><span class="nom-laure-texte">Camille</span><span class="nom-marque"> (2)</span></span>',
  )
  const laure = await rendu('components/Laurier', 'NomLaure', { nom: 'Camille (2)', laurier: true })
  assert.match(laure, /^<span class="nom-laure"><span class="nom-laure-texte">Camille<\/span><span class="nom-marque"> \(2\)<\/span><svg class="laurier"/)
  // Le cas de toutes les soirées reste un texte nu (`finitions.test.ts` le lit ainsi).
  assert.equal(await rendu('components/Laurier', 'NomLaure', { nom: 'Camille' }), 'Camille')

  // C'est le prénom qui porte les points de suspension ; la marque ne rétrécit pas.
  assert.match(regle('.nom-laure-texte'), /text-overflow:\s*ellipsis/)
  assert.match(regle('.nom-marque'), /flex:\s*none/)
  assert.match(regle('.nom-marque'), /white-space:\s*pre\b/, 'son espace se voit')
  assert.doesNotMatch(regle('.nom-marque'), /overflow/)

  // Au classement de la salle d'attente, avec le vrai composant.
  const joueurs = [
    { id: 'a', name: 'Camille', avatar: '🐙', score: 1200, connected: true, teamId: null },
    { id: 'b', name: 'Camille', nomAffiche: 'Camille (2)', avatar: '🐙', score: 900, connected: true, teamId: null, laurier: true },
  ]
  const html = await rendu('components/Leaderboard', 'Leaderboard', { players: joueurs })
  assert.match(html, /<span class="nom-laure-texte">Camille<\/span><span class="nom-marque"> \(2\)<\/span><svg class="laurier"/)
})

test('chaque prénom d’un classement passe par NomLaure', () => {
  // Une ligne qui écrirait le prénom nu le laisserait couper sa marque. Seuls
  // le nom d'une équipe et son propre prénom, sur l'aperçu du profil, n'en
  // portent jamais.
  const exceptions = new Set(['{t.name}', '{profil.name}'])
  const racine = new URL('../../client/src/', import.meta.url)
  const fichiers = readdirSync(racine, { recursive: true, encoding: 'utf8' }).filter(f => f.endsWith('.tsx'))
  const vus: string[] = []
  for (const f of fichiers) {
    // Les commentaires JSX ne sont pas du contenu.
    const source = readFileSync(new URL(f, racine), 'utf8').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    for (const m of source.matchAll(/<span className="lb-name">\s*([^\s<][^<]*|<\w+)/g)) {
      const contenu = m[1].trim()
      vus.push(f)
      if (exceptions.has(contenu)) continue
      assert.equal(contenu, '<NomLaure', `${f} : « ${contenu} » dans une ligne de classement`)
    }
  }
  assert.ok(vus.length >= 10, 'les lignes de classement sont bien là')
})

// ── Une ligne étroite passe sur deux étages ───────────────────────────────

test('une ligne de classement étroite passe sur deux étages : le prénom seul en haut', () => {
  // Les listes sont des conteneurs : c'est leur largeur qui compte, pas celle
  // de l'écran — la même ligne vit dans une carte, sous une échelle, au mur.
  assert.match(CSS, /\.leaderboard,\s*\.podium\s*\{\s*container-type:\s*inline-size;?\s*\}/)

  const bloc = requetesDeConteneur().find(b => /\.lb-row:not\(\.team-row\)\s*\{/.test(b.corps))
  assert.ok(bloc, 'une requête de conteneur range les lignes de classement')
  // En `rem`, le seuil grandit avec le texte agrandi par le système. Et il
  // couvre le téléphone de 320 px : sa liste y fait 242 px (mesurée dans
  // Chromium, podium et salle d'attente), où un lauréat n'avait plus que
  // « M… » de son prénom.
  const seuil = /^\(max-width:\s*([\d.]+)rem\)$/.exec(bloc.condition)
  assert.ok(seuil, `un seuil en rem : ${bloc.condition}`)
  assert.ok(Number(seuil[1]) * 16 > 242, `${seuil[1]} rem ne couvre pas la liste d’un téléphone de 320 px`)

  // Le prénom seul au premier étage, le niveau et les points au second.
  const ligne = regle('.lb-row:not(.team-row)', bloc.corps)
  assert.match(ligne, /display:\s*grid/)
  assert.match(ligne, /grid-template-areas:\s*'rang av nom nom'\s*'rang av niv pts'/)
  // Chaque enfant d'une ligne a sa case : sans elle, la grille le placerait
  // où elle peut, sur un troisième étage.
  for (const [enfant, aire] of [
    ['.lb-rank', 'rang'],
    ['.lb-avatar', 'av'],
    ['.lb-name', 'nom'],
    ['.niveau', 'niv'],
    ['.lb-score', 'pts'],
  ]) {
    assert.match(regle(`.lb-row:not(.team-row) > ${enfant}`, bloc.corps), new RegExp(`grid-area:\\s*${aire}\\b`), enfant)
  }
  assert.match(regle('.lb-row > .guess-value', bloc.corps), /grid-area:\s*val\b/)
})
