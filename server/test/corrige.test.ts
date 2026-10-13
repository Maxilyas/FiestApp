// Le corrigé d'une question (`client/src/components/Corrige.tsx`), le même
// partout où l'on relit ses réponses : le quiz du jour, la série, le défi de
// la semaine, le duel, les sentiers, les parcours de thème.
//
// Un retour utilisateur du 13 octobre 2026, sur « La correction » du quiz
// du jour et celle du défi : « les réponses ne ressortent pas, donc on peut
// se tromper entre la bonne réponse et sa réponse fausse. J'aimerais que la
// bonne réponse soit centrée aussi. » La bonne réponse s'écrivait en gras
// sous l'intitulé et la sienne en gris dessous — en campagne, les deux sur
// une seule ligne grise, « ▲ Rome · tu avais dit Milan » —, sans un mot pour
// dire laquelle était laquelle. Ce que le quiz du jour y ajoute — ses
// points, son temps — se lit dans `jour-telephone.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const CSS = readFileSync(client('styles.css'), 'utf8')

/** Le corps de la première règle dont le sélecteur est exactement celui-ci — la recette de `design.test.ts`. */
function regle(selecteur: string): string {
  const echappe = selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(?:^|\\})\\s*${echappe}\\s*\\{([^}]*)\\}`, 'm').exec(CSS)
  assert.ok(m, `la règle ${selecteur} existe`)
  return m[1]
}

/** Une question de la campagne, corrigée : « Rome » est la bonne. */
const question = (o: object = {}) => ({
  texte: 'La capitale de l’Italie ?',
  reponses: ['Rome', 'Milan', 'Turin', 'Naples'],
  bonne: 0,
  choix: 0,
  juste: true,
  niveau: 'facile',
  anecdote: null,
  ...o,
})

async function serieCorrigee(correction: object[]): Promise<string> {
  const { SerieCorrigee } = await import(client('components/SerieCorrigee.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(SerieCorrigee, { correction })).replace(/<!-- -->/g, '')
}

test('la bonne réponse a son cadre et sa légende ; la sienne, fausse, a le sien dessous, barrée', async () => {
  const html = await serieCorrigee([question(), question({ choix: 1, juste: false, anecdote: 'Elle l’est depuis 1871.' })])
  const [trouvee, ratee] = html.split('<li').slice(1)
  // Trouvée : un seul cadre, qui dit qu'elle était la sienne.
  assert.match(trouvee, /<p class="corrige-reponse corrige-bonne"><span class="corrige-legende">.*La bonne réponse · la tienne<\/span><span class="corrige-mot">.*Rome<\/span><\/p>/)
  assert.doesNotMatch(trouvee, /corrige-sienne|Milan/)
  // Ratée : la bonne d'abord, puis la sienne — chacune nommée, la sienne barrée.
  assert.match(ratee, /corrige-bonne"><span class="corrige-legende">.*La bonne réponse<\/span><span class="corrige-mot">.*Rome<\/span>/)
  assert.match(ratee, /corrige-sienne"><span class="corrige-legende">.*Ta réponse<\/span><span class="corrige-mot">.*<s>Milan<\/s><\/span>/)
  assert.ok(ratee.indexOf('corrige-bonne') < ratee.indexOf('corrige-sienne'), 'la bonne réponse passe devant la sienne')
  assert.doesNotMatch(ratee, /<s>Rome/, 'la bonne réponse ne se barre jamais')
  // La marque dit le verdict au lecteur d'écran ; l'anecdote suit, pour s'en souvenir.
  assert.deepEqual(
    [...html.matchAll(/class="corrige-marque" role="img" aria-label="([^"]+)"/g)].map(m => m[1]),
    ['Juste', 'Faux'],
  )
  assert.match(trouvee, /<span class="label">Question 1 · Facile<\/span>/)
  assert.match(ratee, /<p class="corrige-anecdote small">Elle l’est depuis 1871\.<\/p>/)
  // La campagne compte ses bonnes réponses, sans chronomètre : ni points ni temps à dire.
  assert.doesNotMatch(html, /corrige-points|Répondu en|rapidité/)
})

test('sans réponse, la bonne seule — et rien de barré', async () => {
  const html = await serieCorrigee([question({ choix: null, juste: false })])
  assert.match(html, /aria-label="Sans réponse"/)
  assert.match(html, /La bonne réponse<\/span><span class="corrige-mot">.*Rome<\/span>/)
  assert.doesNotMatch(html, /corrige-sienne|<s>/)
})

test('les réponses se centrent, comme à la révélation, et la sienne se distingue de la bonne sans la couleur', () => {
  assert.match(regle('.corrige-reponses'), /align-items:\s*center/)
  assert.match(regle('.corrige-reponse'), /text-align:\s*center/)
  // Pour qui distingue mal les couleurs : un cadre plein pour la bonne, un
  // pointillé pour la sienne, barrée — et leurs légendes, la coche, la croix.
  assert.match(regle('.corrige-bonne'), /border:\s*1\.5px solid/)
  assert.match(regle('.corrige-sienne'), /border:\s*1\.5px dashed/)
  assert.match(regle('.corrige-legende'), /font-size:\s*var\(--t-label\)/, 'la légende ne descend pas sous le plancher du texte')
})

test('la série, le défi, le duel, les sentiers et les parcours corrigent par la même liste', () => {
  // Cinq copies de la même liste vivaient dans leurs pages : une retouche qui
  // en oubliait une laissait l'ancienne ligne grise quelque part.
  for (const page of ['CampagneApp', 'Defi', 'Duel', 'Sentiers', 'Parcours']) {
    const source = readFileSync(client(`views/${page}.tsx`), 'utf8')
    assert.match(source, /<SerieCorrigee correction=\{/, `${page} corrige par SerieCorrigee`)
    assert.doesNotMatch(source, /tu avais dit|campagne-juste|campagne-rate/, `${page} garde une copie de l’ancienne correction`)
  }
})
