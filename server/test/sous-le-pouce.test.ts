// Le geste principal d'un écran reste sous le pouce.
//
// La revue de tous les écrans du 10 novembre 2026 (le propriétaire : « que tu
// modifies ceux que tu trouves trop longs, ou [où] ça serait logique de tout
// voir sans scroller ») a mesuré chaque écran en 360 × 640 : après chaque
// réponse d'une révision, d'une épreuve ou d'un duel, « Question suivante »
// passait sous le pli (122 à 139 px de page en trop) ; « Jouer le duel » était
// au pli sous « Défier Tom », « Ouvrir le salon » à 365 px sous l'écran, et le
// geste qui suit une fin de partie sous tout ce qu'elle venait de rapporter.
// La longueur d'une anecdote ou d'une liste de gains ne se borne pas : c'est le
// geste qui reste en vue (`SousLePouce`, `client/src/components/Pieces.tsx`) —
// à sa place tant que la page tient sur l'écran, collé au bas de l'écran sinon.
//
// Ce qui se voit — le bouton entier dans l'écran, à chaque taille — se mesure
// au navigateur, par les scripts de rendu ; ici, ce qui le décide et qu'une
// retouche déferait sans que le typecheck le voie.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

Object.assign(globalThis, { React })

const client = (f: string) => new URL(`../../client/src/${f}`, import.meta.url)
const CSS = readFileSync(client('styles.css'), 'utf8')
const source = (f: string) => readFileSync(client(f), 'utf8')
/** Le corps de la première règle dont le sélecteur est exactement celui-ci. */
const regle = (selecteur: string) => new RegExp(`(?:^|[{}\\n])\\s*${selecteur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1] ?? ''

test('la pièce : un cadre autour du geste, rien de plus — sa page lui ajoute ses écarts', async () => {
  const { SousLePouce } = await import(client('components/Pieces.tsx').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const bouton = React.createElement('button', { type: 'button' }, 'Question suivante')
  assert.equal(renderToStaticMarkup(React.createElement(SousLePouce, null, bouton)), '<div class="sous-le-pouce"><button type="button">Question suivante</button></div>')
  // Collé, la page le dit d'une classe — jamais au premier rendu : c'est le navigateur qui le sait.
  assert.equal(
    renderToStaticMarkup(React.createElement(SousLePouce, { className: 'duels-geste-principal' }, bouton)),
    '<div class="sous-le-pouce duels-geste-principal"><button type="button">Question suivante</button></div>',
  )
})

test('la feuille : collé au bas de l’écran quand sa place est plus bas, et à sa place rien ne change', () => {
  const pouce = regle('.sous-le-pouce')
  // Au bas de l'écran, au-dessus de l'encoche d'un téléphone.
  assert.match(pouce, /position: sticky; bottom: max\(12px, env\(safe-area-inset-bottom\)\);/)
  // À sa place, ni marge, ni fond, ni retrait : la page qui tient sur l'écran est au pixel celle d'avant. Sur un thème
  // peint, une bande unie y couperait le décor (la carte de la loge, règle `css.md`).
  assert.doesNotMatch(pouce, /background|margin|padding|box-shadow/)
  // Collé, son voile : le fond de la page, hors du flux, que le doigt traverse.
  const voile = regle('.sous-le-pouce.colle::before')
  assert.match(voile, /position: absolute;/)
  assert.match(voile, /background: linear-gradient\(transparent, var\(--bg\) \d+px\);/)
  assert.match(voile, /pointer-events: none;/)
  // Il se colle à l'écran, pas à un cadre : aucune coquille de page ne coupe ni ne fait défiler ce qu'elle contient — un
  // `overflow` sur l'une d'elles, et chaque geste se collerait à elle.
  for (const coquille of ['.player-shell', '.quiz-player']) {
    const corps = [...CSS.matchAll(new RegExp(`(?:^|\\n)${coquille.replace('.', '\\.')} \\{([^}]*)\\}`, 'g'))].map(m => m[1]).join('\n')
    assert.ok(corps.length > 0, coquille)
    assert.doesNotMatch(corps, /overflow/, `${coquille} ne coupe rien`)
  }
  // Le geste principal d'un duel fini sort de la colonne des gestes du bas, qu'il précède aux mêmes écarts : collé dans sa
  // colonne, il ne pourrait pas la quitter.
  assert.match(regle('.sous-le-pouce.duels-geste-principal'), /margin-top: auto; padding-top: 24px;/)
  assert.match(regle('.sous-le-pouce.duels-geste-principal + .duels-gestes-bas'), /margin-top: 14px; padding-top: 0;/)
})

test('chaque écran plus long que le téléphone tient son geste principal sous le pouce', () => {
  /** Ce que le cadre contient, pour chaque `<SousLePouce>` d'un fichier. */
  const gestes = (fichier: string) => [...source(fichier).matchAll(/<SousLePouce(?: className="[^"]*")?>([\s\S]*?)<\/SousLePouce>/g)].map(m => m[1])
  const tient = (fichier: string, ...mots: string[]) => {
    const lus = gestes(fichier)
    for (const mot of mots) assert.ok(lus.some(g => g.includes(mot)), `${fichier} : « ${mot} » sous le pouce`)
  }
  // Après chaque réponse : la campagne et tous ses modes, une épreuve de sentier, une étape de parcours, le quiz du jour.
  tient('views/CampagneApp.tsx', 'Question suivante')
  tient('views/Sentiers.tsx', 'Question suivante')
  tient('views/Parcours.tsx', 'Question suivante')
  tient('views/JourApp.tsx', 'Question suivante')
  // Ce qu'on prépare : un duel, un salon.
  tient('views/LancerUnDefi.tsx', 'Jouer le duel')
  tient('views/SalonApp.tsx', 'Ouvrir le salon')
  // Les fins de partie : ce qu'elles rapportent ne pousse plus leur suite sous l'écran.
  tient('views/CampagneApp.tsx', 'Rejouer', 'Réviser encore', 'Le classement du défi')
  tient('views/Sentiers.tsx', 'Jouer le palier', 'Le porter')
  tient('views/Parcours.tsx', 'Jouer l’étape')
  tient('views/Duel.tsx', 'suite.texte', 'Accueil')
  // Un seul geste par cadre, le principal : deux boutons collés prendraient le quart d'un petit écran.
  for (const fichier of ['views/CampagneApp.tsx', 'views/Sentiers.tsx', 'views/Parcours.tsx', 'views/JourApp.tsx', 'views/LancerUnDefi.tsx', 'views/SalonApp.tsx', 'views/Duel.tsx']) {
    for (const g of gestes(fichier)) assert.equal((g.match(/<(?:button|a)\b/g) ?? []).length, 1, `${fichier} : un seul geste sous le pouce`)
  }
})
