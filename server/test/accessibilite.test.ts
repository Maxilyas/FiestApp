// Ce qu'entend un invité qui joue au lecteur d'écran. Hugo a joué une soirée
// entière avec l'arbre d'accessibilité pour seuls yeux (la tablée du
// 23 septembre 2026) : la bonne réponse du bilan n'existait que pour l'œil, le
// podium se lisait 2ᵉ, 1ᵉʳ, 3ᵉ, et un classement n'était qu'une suite de
// nombres nus.
//
// Les composants sont rendus en HTML, sans navigateur ni serveur, puis lus
// comme le ferait un lecteur d'écran : dans l'ordre du document, sans ce qui
// porte `aria-hidden`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

/** Un composant du client, rendu en HTML — la recette d'`eclat.test.ts`. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

// Les seules balises vides du HTML : React ferme `<path></path>` et
// `<rect></rect>`, et les compter pour vides décalait la profondeur — un
// `aria-hidden` voisin cessait alors de masquer quoi que ce soit.
const VIDES = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source'])

/**
 * Le texte d'un fragment tel qu'un lecteur d'écran le parcourt : l'ordre du
 * document, ce qui est masqué par `aria-hidden` en moins, les espaces tassés.
 * La mise en page (flex, grille, `order`) n'y change rien — c'est le but.
 */
function entendu(html: string): string {
  const morceaux: string[] = []
  // La profondeur à laquelle un sous-arbre masqué a commencé, sinon -1.
  let masque = -1
  let profondeur = 0
  for (const m of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*?)(\/?)>|([^<]+)/gi)) {
    const [, fermante, nom, attributs, autoFermante, texte] = m
    if (texte !== undefined) {
      if (masque < 0) morceaux.push(texte)
      continue
    }
    if (fermante) {
      profondeur--
      if (profondeur === masque) masque = -1
      continue
    }
    const vide = autoFermante === '/' || VIDES.has(nom.toLowerCase())
    if (!vide) {
      if (masque < 0 && /aria-hidden="true"/.test(attributs)) masque = profondeur
      profondeur++
    }
  }
  return morceaux
    .join(' ')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Les éléments d'une liste, entendus un par un. */
const elements = (html: string, balise = 'li') =>
  [...html.matchAll(new RegExp(`<${balise}\\b[^>]*>([\\s\\S]*?)</${balise}>`, 'g'))].map(m => entendu(m[1]))

// ── 1. La bonne réponse d'un bilan s'entend ───────────────────────────────

test('dans le bilan, la bonne réponse d’une question à choix est dite, pas seulement cochée', async () => {
  const q = {
    key: 's#0', sessionId: 's', quizNumber: 1, quizTitle: 'Spécial Sam', qIndex: 0, order: 1,
    kind: 'choice', text: 'Le groupe de Sam ?',
    answers: ['Rando Rock', 'Les Spaghettis Électriques', 'Les Pâtes'], correct: 1,
    target: null, unit: '', image: null, durationMs: 20000, observed: false,
    resolved: true, uncertain: false, asked: 3, answered: 3, correctCount: 1,
    counts: [2, 1, 0], byTeam: [], fastest: null, newLeader: null, closest: [], guesses: 0,
  }
  const review = { generatedAt: 0, questions: [q], players: [], teams: [], quizzes: [], records: {}, unresolved: 0 }
  const { makeCtx } = await import(new URL('../../client/src/components/BilanQuestion.tsx', import.meta.url).href)
  const html = await rendu('components/BilanQuestion', 'QuestionCard', { ctx: makeCtx(review as any), q })
  const [rock, spaghettis, pates] = elements(html)
  assert.match(spaghettis, /Les Spaghettis Électriques.*la bonne réponse/)
  // Une seule : dite partout, elle ne désignerait plus rien.
  assert.doesNotMatch(rock, /bonne réponse/)
  assert.doesNotMatch(pates, /bonne réponse/)
})

// ── 2. Le podium se lit dans l'ordre des rangs ────────────────────────────

const rangee = (name: string, avatar: string, points: number) => ({ name, avatar, points })

test('le podium se lit 1ᵉʳ, 2ᵉ, 3ᵉ — l’escalier 2-1-3 n’est qu’une mise en page', async () => {
  const html = await rendu('components/Podium', 'FinalPodium', {
    rows: [rangee('Camille', '🦊', 1611), rangee('Lucas', '👑', 1501), rangee('Sofia', '🦊', 1366), rangee('Jeanne', '🐢', 1281)],
  })
  assert.deepEqual(elements(html), [
    'Rang 1 : 🦊 Camille 1611 points',
    'Rang 2 : 👑 Lucas 1501 points',
    'Rang 3 : 🦊 Sofia 1366 points',
  ])
  // Et c'est la feuille de style qui dresse les marches.
  const css = readFileSync(new URL('../../client/src/styles.css', import.meta.url), 'utf8')
  assert.match(css, /\.final-podium > :nth-child\(1\) \{ order: 2; \}/)
})

test('deux équipes : deux marches, sans colonne vide qui décentre le podium', async () => {
  const html = await rendu('components/Podium', 'FinalPodium', {
    rows: [rangee('Les Carbonara', '🍝', 12), rangee('Les Randonneurs', '🥾', 10)],
  })
  assert.equal(elements(html).length, 2)
  assert.match(html, /--marches:2/)
})

// ── 3. Aucun nombre nu dans un classement ─────────────────────────────────

test('une ligne de classement dit lequel des nombres est le rang, lequel les points', async () => {
  const joueurs = [
    { id: 'a', name: 'Hugo', avatar: '🐯', score: 0, connected: true, teamId: null },
    { id: 'b', name: 'Sofia', avatar: '🐼', score: 1366, connected: true, teamId: null, niveau: 2 },
  ]
  const liste = entendu(await rendu('components/Leaderboard', 'Leaderboard', { players: joueurs }))
  assert.equal(liste, 'Rang 1 🐼 Sofia niveau 2 1366 points Rang 2 🐯 Hugo 0 point')

  // Le bouton qui ouvre la carte : son nom remplace son contenu, il doit tout porter.
  const boutons = await rendu('components/Leaderboard', 'Leaderboard', { players: joueurs, onOuvrir: () => {} })
  assert.match(boutons, /aria-label="La carte de Hugo — rang 2, 0 point"/)

  const suite = await rendu('components/Podium', 'Standings', { rows: [rangee('Jeanne', '🐢', 1281)], offset: 3 })
  assert.deepEqual(elements(suite, 'div'), ['Rang 4 🐢 Jeanne 1281 points'])
})

test('une équipe dit son rang, son barème prix compris et sa moyenne', async () => {
  const equipe = (id: string, name: string, emoji: string, average: number) =>
    ({ id, name, emoji, position: 0, memberCount: 2, total: average * 2, average, bonus: 0 })
  const html = await rendu('components/TeamBoard', 'TeamBoard', {
    teams: [equipe('r', 'Les Randonneurs', '🥾', 439), equipe('c', 'Les Carbonara', '🍝', 336)],
    showFinalPoints: true,
    compact: true,
  })
  assert.match(html, /role="list"/)
  assert.deepEqual(
    [...html.matchAll(/role="listitem"[^>]*>([\s\S]*?)<\/div>/g)].map(m => entendu(m[1])),
    [
      // Le chiffre cerclé compte les prix (axe 1) : l'oreille l'entend aussi.
      'Rang 1 🥾 Les Randonneurs 2 points au barème, prix compris, 439 points de moyenne par membre',
      'Rang 2 🍝 Les Carbonara 1 point au barème, prix compris, 336 points de moyenne par membre',
    ],
  )
})

// ── 4. La photo à mémoriser s'annonce ─────────────────────────────────────

test('la photo à mémoriser se dit visuelle, avant que l’invité ne cherche l’image', async () => {
  const view = { phase: 'observe', qIndex: 3, qCount: 9, deadline: Date.now() + 5000, duration: 5, image: '/media/x' }
  const texte = entendu(await rendu('games/quiz/PlayerView', 'QuizPlayer', { view, send: () => {}, teams: [], myTeamId: null }))
  assert.match(texte, /Question visuelle/)
  assert.match(texte, /tenter ta chance/)
})

// ── 5. Les homonymes ont chacun leurs libellés ────────────────────────────

test('à l’écran commun, aucun libellé accessible ne prend le prénom sans sa marque', () => {
  // La quatrième porte par où sort un prénom (invariant 17) : deux « Camille »
  // avaient les mêmes « Exclure Camille de la soirée ».
  const source = readFileSync(new URL('../../client/src/views/HostApp.tsx', import.meta.url), 'utf8')
  const libelles = [...source.matchAll(/aria-label=\{`[^`]*`\}/g)].map(m => m[0])
  assert.ok(libelles.some(l => l.includes('p.nomAffiche ?? p.name')), 'les libellés des invités sont bien là')
  for (const l of libelles) assert.doesNotMatch(l, /\$\{p\.name\}/, l)
})

// ── 6. Pas d'annonces en trop au téléphone ────────────────────────────────

test('le compte à rebours ne s’égrène pas dans la région vivante du téléphone', async () => {
  // Tout le téléphone est une région annoncée : « 3 », « 2 », « 1 », « GO ! »
  // étaient lus par-dessus la question qui arrivait.
  const html = await rendu('components/GetReady', 'GetReady', { deadline: Date.now() + 3000, label: 'Prépare-toi…' })
  assert.match(html, /class="big-count" aria-live="off"/)
})

test('en pause, l’oreille entend ce qui va se passer, pas « regarde l’écran »', async () => {
  const view = {
    phase: 'question', qIndex: 0, qCount: 3, kind: 'choice', text: 'La capitale ?', answers: ['A', 'B'],
    deadline: Date.now() + 5000, duration: 20, paused: true, remainingMs: 5000, yourChoice: null,
  }
  const texte = entendu(await rendu('games/quiz/PlayerView', 'QuizPlayer', { view, send: () => {}, teams: [], myTeamId: null }))
  assert.match(texte, /En pause — l'animateur reprend bientôt/)
  assert.doesNotMatch(texte, /regarde l'écran/)
})

// ── 7. La colonne triée se dit ────────────────────────────────────────────

test('le tableau des chiffres dit par quelle colonne il est trié', async () => {
  const joueur = {
    playerId: 'a', name: 'Hugo', avatar: '🐯', points: 120, asked: 3, answered: 3, correct: 2, wrong: 1, accuracy: 0.66,
    avgMs: 4000, bestMs: 2000, bestStreak: 2, worstStreak: 1, missed: 0, changes: 0, lastSecond: 0, alone: 0,
    followed: 1, guesses: 0, exact: 0, coupDOeil: null, avgGapPct: null, bias: null,
  }
  const html = await rendu('components/StatsTable', 'StatsTable', { stats: { players: [joueur], awards: [], questions: 3, logged: 3 } })
  // Une seule colonne le porte : celle des points, triée du plus grand au plus petit.
  assert.deepEqual([...html.matchAll(/aria-sort="(\w+)"/g)].map(m => m[1]), ['descending'])
  assert.match(html, /<th title="Points marqués sur la soirée" aria-sort="descending">/)
})
