// Les réactions de la niche à la révélation (le principe du compagnon, § 2 —
// `retours/2026-10-16/compagnon/principe.md`) : il retient son souffle quand
// on touche une réponse, il est ravi d'une bonne réponse qui le nourrit,
// dépité avec toi d'une ratée, une bulle de cœurs quand peu l'ont trouvée ;
// au podium d'un quiz ou à une forme atteinte, il sort de sa niche, une fois.
// La règle est pure (`shared/niche.ts`), l'estimation « parmi les plus
// proches » vient du serveur, et les pages disent ces moments à la niche
// (`client/src/niche.ts`, `components/NicheReagit.tsx`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import React from 'react'
import {
  PART_RARE,
  REPONSES_POUR_UNE_RARE,
  SALLE_QUI_COMPTE,
  bonneReponseRare,
  rareAuQuizDuJour,
  rareEnCampagne,
  reactionDeLaSoiree,
  reactionDuSolo,
} from '../../shared/niche'
import { SEUILS } from '../../shared/profil'
import type { QuizPlayerView } from '../../shared/games/quiz'
import { horloge, salle } from './salle'

const client = (fichier: string) => new URL(`../../client/src/${fichier}`, import.meta.url)
const source = (fichier: string) => readFileSync(client(fichier), 'utf8')

/** Une révélation de soirée, vue du téléphone : un QCM qu'il a trouvé, dans une salle de six. */
const revele = (v: Partial<QuizPlayerView> = {}): QuizPlayerView => ({ phase: 'reveal', qIndex: 2, round: 2, qCount: 5, kind: 'choice', yourChoice: 1, correct: 1, ...v })

// ── La règle, pure ────────────────────────────────────────────────────────

test('à la révélation d’un QCM : ravi d’une bonne réponse, qui le nourrit ; dépité avec toi d’une ratée ; rien sans réponse', () => {
  assert.deepEqual(reactionDeLaSoiree(revele(), 6), { verdict: 'juste', rare: false, nourri: true })
  assert.deepEqual(reactionDeLaSoiree(revele({ yourChoice: 0 }), 6), { verdict: 'ratee', rare: false, nourri: false })
  // Ne rien toucher n'est pas une faute — pas plus qu'arriver en route, une question annulée, ou animer sans jouer.
  for (const calme of [revele({ yourChoice: null }), revele({ justArrived: true }), revele({ cancelled: true }), revele({ horsClassement: true }), revele({ phase: 'question' })]) {
    assert.equal(reactionDeLaSoiree(calme, 6).verdict, 'calme', JSON.stringify(calme))
  }
  // Seul dans la salle, une soirée ne compte pas : ravi, mais rien ne le nourrit.
  assert.deepEqual(reactionDeLaSoiree(revele(), 1), { verdict: 'juste', rare: false, nourri: false })
  assert.equal(SALLE_QUI_COMPTE, SEUILS.salleQuestion, 'la salle d’une question qui compte, recopiée')
})

test('peu l’ont trouvée : le quart au plus de ceux qui ont répondu, à quatre réponses au moins — une bulle de cœurs', () => {
  assert.equal(PART_RARE, 0.25)
  assert.equal(REPONSES_POUR_UNE_RARE, 4)
  assert.ok(bonneReponseRare(1, 4))
  assert.ok(bonneReponseRare(2, 8))
  assert.ok(!bonneReponseRare(3, 8), 'plus du quart : une bonne réponse ordinaire')
  assert.ok(!bonneReponseRare(1, 3), 'à trois, être le seul ne dit pas grand-chose')
  assert.ok(!bonneReponseRare(0, 10))
  const detail = (trouvees: number, repondues: number) => ({ lignes: [], trouvees, repondues, premier: null, second: null })
  assert.equal(reactionDeLaSoiree(revele({ laQuestion: detail(1, 7) }), 7).rare, true)
  assert.equal(reactionDeLaSoiree(revele({ laQuestion: detail(4, 7) }), 7).rare, false)
  // Ratée, jamais de cœurs.
  assert.equal(reactionDeLaSoiree(revele({ yourChoice: 0, laQuestion: detail(1, 7) }), 7).rare, false)
})

test('« plusieurs » et « ordre » se jugent en entier ; un sondage n’a rien de juste', () => {
  const plusieurs = (v: Partial<QuizPlayerView>) => revele({ variante: 'plusieurs', yourChoice: null, ...v })
  assert.equal(reactionDeLaSoiree(plusieurs({ yourChoices: [0, 2], yourCorrect: true }), 4).verdict, 'juste')
  assert.equal(reactionDeLaSoiree(plusieurs({ yourChoices: [0], yourCorrect: false }), 4).verdict, 'ratee')
  assert.equal(reactionDeLaSoiree(plusieurs({ yourChoices: null }), 4).verdict, 'calme')
  assert.equal(reactionDeLaSoiree(revele({ variante: 'ordre', yourChoice: null, yourChoices: [2, 0, 1], yourCorrect: true }), 4).nourri, true)
  assert.equal(reactionDeLaSoiree(revele({ variante: 'sondage', yourChoice: 3 }), 4).verdict, 'calme')
})

test('une estimation n’est jamais fausse : parmi les plus proches, elle le nourrit ; pile-poil, des cœurs ; sinon, rien', () => {
  const estimation = (v: Partial<QuizPlayerView>) => revele({ kind: 'number', yourChoice: null, correct: undefined, target: 1994, ...v })
  assert.deepEqual(reactionDeLaSoiree(estimation({ yourGuess: 1990, parmiLesProches: true }), 5), { verdict: 'juste', rare: false, nourri: true })
  assert.deepEqual(reactionDeLaSoiree(estimation({ yourGuess: 1994, parmiLesProches: true }), 5), { verdict: 'juste', rare: true, nourri: true })
  assert.equal(reactionDeLaSoiree(estimation({ yourGuess: 1950 }), 5).verdict, 'calme', 'loin des autres : pas dépité pour autant')
  assert.equal(reactionDeLaSoiree(estimation({ yourGuess: null }), 5).verdict, 'calme')
  // Une estimation en direct que personne n'a mesurée : pas de cible, rien à fêter.
  assert.equal(reactionDeLaSoiree(estimation({ yourGuess: 1994, target: undefined, parmiLesProches: true }), 5).verdict, 'calme')
})

test('en solo : chaque bonne réponse le nourrit ; peu de joueurs du jour, ou une experte de la campagne, des cœurs', () => {
  assert.deepEqual(reactionDuSolo(true), { verdict: 'juste', rare: false, nourri: true })
  assert.deepEqual(reactionDuSolo(false, true), { verdict: 'ratee', rare: false, nourri: false })
  assert.equal(reactionDuSolo(null).verdict, 'calme', 'sans réponse, trop tard, annulée : rien')
  assert.ok(rareAuQuizDuJour(0.2))
  assert.ok(!rareAuQuizDuJour(0.4))
  assert.ok(!rareAuQuizDuJour(null), 'sous trois joueurs du jour, on ne sait pas')
  assert.ok(rareEnCampagne('expert'))
  assert.ok(!rareEnCampagne('difficile'))
})

// ── Le serveur : l'estimation parmi les plus proches ──────────────────────

test('la révélation d’une estimation dit à chacun s’il est du tiers le plus proche — celles qui nourrissent un compagnon —, et rien avant', async () => {
  const h = horloge()
  const s = salle([
    {
      id: 'q',
      title: 'Années',
      questions: [{ kind: 'number', text: 'En quelle année ?', target: 1994, unit: '', duration: 20, image: null }],
    },
  ])
  try {
    for (const nom of ['Léa', 'Tom', 'Inès', 'Hugo', 'Zoé']) s.inscrire(nom)
    s.lancer(h.avancer)
    const devine = { Léa: 1994, Tom: 1990, Inès: 2000, Hugo: 1980, Zoé: 1990 } as const
    for (const [nom, value] of Object.entries(devine)) s.repondre(nom, { type: 'guess', value })
    // Pendant la question, rien : une réponse se juge à la révélation (invariant 1).
    assert.equal(s.vueDe('Léa')?.parmiLesProches, undefined)
    // Toute la salle a répondu : le souffle passé, la révélation.
    h.avancer(700)
    assert.equal(s.st.phase, 'reveal')
    // Cinq estimations : le tiers, c'est deux places — Léa pile, Tom et Zoé ex æquo derrière elle.
    const proches = Object.keys(devine).filter(nom => s.vueDe(nom)?.parmiLesProches)
    assert.deepEqual(proches.sort(), ['Léa', 'Tom', 'Zoé'])
    assert.equal(s.vueDe('Inès')?.parmiLesProches, undefined, 'le rang des autres ne part pas : seulement le sien')
    // Et la règle de la niche le lit.
    assert.deepEqual(reactionDeLaSoiree(s.vueDe('Léa')!, 5), { verdict: 'juste', rare: true, nourri: true })
    assert.equal(reactionDeLaSoiree(s.vueDe('Hugo')!, 5).verdict, 'calme')
  } finally {
    s.fermer()
    h.arreter()
  }
})

// ── Les moments, côté téléphone ───────────────────────────────────────────

test('la niche écoute ses moments : le souffle, la révélation, le calme quand le verdict s’en va — un bandeau remonté dans le même instant ne la rejoue pas', async () => {
  const niche = await import(client('niche.ts').href)
  const vus: string[] = []
  const fin = niche.ecouterLaNiche((m: { sorte: string; nourri?: boolean }) => vus.push(m.sorte + (m.nourri ? '+1' : '')))
  niche.nicheRetientSonSouffle()
  // React, en développement, monte deux fois : monté, démonté, remonté dans le même instant.
  const juste = { verdict: 'juste', rare: false, nourri: true }
  niche.nicheALaRevelation('soiree:0:1', juste, null)
  niche.nicheApresLaRevelation('soiree:0:1')
  niche.nicheALaRevelation('soiree:0:1', juste, null)
  await new Promise(r => setTimeout(r, 5))
  assert.deepEqual(vus, ['souffle', 'juste+1'], 'une seule fête, et pas de calme')
  // Le verdict s'en va — la question suivante — : il retrouve son calme.
  niche.nicheApresLaRevelation('soiree:0:1')
  await new Promise(r => setTimeout(r, 5))
  assert.deepEqual(vus, ['souffle', 'juste+1', 'calme'])
  niche.nicheALaRevelation('soiree:1:2', { verdict: 'ratee', rare: false, nourri: false }, null)
  assert.equal(vus.at(-1), 'ratee')
  fin()
})

test('il sort de sa niche au podium, ou quand une forme est atteinte en jouant — une fois par quiz au plus', async () => {
  // Un module neuf : la partie n'a pas commencé.
  const niche = await import(`${client('niche.ts').href}?sortie`)
  const sorties: string[] = []
  niche.ecouterLaNiche((m: { sorte: string }) => m.sorte === 'sortie' && sorties.push('sortie'))
  // Une forme atteinte hors d'une partie — l'accueil relit le profil — : la niche la prend, sans sortir.
  niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 0 }] })
  niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 1 }] })
  assert.equal(sorties.length, 0)
  // En jouant, le profil relu après le quiz : il sort la montrer.
  niche.nicheRetientSonSouffle()
  niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 2 }] })
  assert.equal(sorties.length, 1)
  assert.deepEqual(niche.nicheActuelle(), { compagnon: 'loup', rang: 2 })
  // Le même quiz, son podium : il est déjà sorti.
  niche.nicheALaFin(true)
  assert.equal(sorties.length, 1)
  // Le quiz suivant : une réponse rouvre sa sortie ; hors du podium, il reste chez lui.
  niche.nicheRetientSonSouffle()
  niche.nicheALaFin(false)
  assert.equal(sorties.length, 1)
  niche.nicheRetientSonSouffle()
  niche.nicheALaFin(true)
  niche.nicheALaFin(true)
  assert.equal(sorties.length, 2, 'un podium, une sortie')
  // Un autre compagnon installé n'est pas une forme atteinte.
  niche.porterNiche({ niche: 'chat', compagnons: [{ compagnon: 'chat', rang: 3 }] })
  assert.equal(sorties.length, 2)
})

test('un souffle relâché sans verdict — l’essai du Mot mystère qui ne trouve pas encore — rend le calme, et la partie reste en jeu', async () => {
  // Un module neuf : la partie n'a pas commencé.
  const niche = await import(`${client('niche.ts').href}?relache`)
  const vus: string[] = []
  niche.ecouterLaNiche((m: { sorte: string }) => vus.push(m.sorte))
  niche.nicheRetientSonSouffle()
  niche.nicheRelacheSonSouffle()
  assert.deepEqual(vus, ['souffle', 'calme'], 'les couleurs d’un essai ne sont pas un verdict : il reprend son souffle')
  // Le Mot se joue encore : une forme atteinte au bilan le fait sortir de sa niche.
  niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 0 }] })
  niche.porterNiche({ niche: 'loup', compagnons: [{ compagnon: 'loup', rang: 1 }] })
  assert.deepEqual(vus, ['souffle', 'calme', 'sortie'])
})

test('la niche part avec ses humeurs plus tard : la page ne les attend pas, l’invité anonyme ne télécharge rien de plus', async () => {
  Object.assign(globalThis, { React })
  const { Niche } = await import(client('components/Niche.tsx').href)
  const { DESSINS } = await import(client('components/compagnons-peints.ts').href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const html = renderToStaticMarkup(React.createElement(Niche, { compagnon: 'chat', rang: 2 }))
  assert.ok(html.includes(`class="on" src="${DESSINS['cp:chat-adulte'].perso[0]}"`), 'l’expression neutre, montrée')
  for (const h of ['ravi', 'depite', 'triomphe']) assert.ok(!html.includes(DESSINS['cp:chat-adulte'].humeurs[h][0]), `${h} : pas au premier rendu`)
  // Ce que la page de la soirée importe pour la niche ne tire ni le catalogue ni les dessins.
  for (const fichier of ['niche.ts', 'components/NicheReagit.tsx']) {
    assert.doesNotMatch(source(fichier), /^import (?!type )[^\n]*(compagnons|Niche'|medaillons)/m, fichier)
  }
  const regle = readFileSync(new URL('../../shared/niche.ts', import.meta.url), 'utf8')
  assert.deepEqual(
    [...regle.matchAll(/^import (?!type )[^\n]* from '([^']+)'/gm)].map(m => m[1]),
    ['./classement'],
    'la règle pure n’importe que le classement : le barème tirerait le catalogue des compagnons',
  )
})

// ── Les pages ─────────────────────────────────────────────────────────────

test('chaque écran de révélation la dit à la niche, et chaque réponse lui fait retenir son souffle', () => {
  const ecrans: Record<string, { revelations: number; souffles: number }> = {
    // La soirée : un QCM, « plusieurs », « ordre », une estimation ; les révélations de l'estimation, des variantes et du QCM.
    'games/quiz/PlayerView.tsx': { revelations: 3, souffles: 4 },
    // Le quiz du jour répond par l'écran des soirées : son souffle est celui du QCM, plus haut.
    'views/JourApp.tsx': { revelations: 1, souffles: 0 },
    'views/CampagneApp.tsx': { revelations: 1, souffles: 1 },
    'views/Sentiers.tsx': { revelations: 1, souffles: 1 },
    'views/Parcours.tsx': { revelations: 1, souffles: 1 },
    'views/ExpeditionApp.tsx': { revelations: 1, souffles: 1 },
    // Le Cabinet : le cadre d'une manche révèle pour tous ses jeux, et retient le souffle au geste qui peut trancher la manche — une
    // réponse, touchée ou partie d'elle-même à l'échéance, les étoiles gardées du Pari, chaque essai du Mot mystère (que la page
    // ne sait pas juste) —, relâché quand l'essai revient sans verdict. Ses jeux n'en disent rien : ils envoient leurs gestes par
    // lui (plus bas).
    'views/cabinet/Partie.tsx': { revelations: 1, souffles: 1 },
  }
  for (const [fichier, attendu] of Object.entries(ecrans)) {
    const s = source(fichier)
    // La soirée la pose une fois (`const niche`), et chaque bandeau la rend (`{niche}`, seul sur sa ligne).
    const revelations = /const niche = <NicheALaRevelation /.test(s) ? (s.match(/^\s*\{niche\}$/gm) ?? []).length : (s.match(/<NicheALaRevelation /g) ?? []).length
    assert.equal(revelations, attendu.revelations, `${fichier} : ses révélations`)
    assert.equal((s.match(/nicheRetientSonSouffle\(\)/g) ?? []).length, attendu.souffles, `${fichier} : ses réponses`)
  }
  // Chaque bandeau de bonne réponse qui fait éclater la gerbe fait aussi réagir la niche.
  for (const fichier of Object.keys(ecrans)) {
    const s = source(fichier)
    assert.ok((s.match(/result-banner/g) ?? []).length >= 1, fichier)
  }
  // Les écrans des jeux du Cabinet passent par le cadre : une révélation ou un souffle à eux doublerait ceux de la partie. Chaque
  // écran de jeu, d'office : un jeu de plus n'y ajoute rien.
  const jeux = readdirSync(client('views/cabinet/jeux'))
  for (const jeu of ['Pari', 'Eclair', 'Detail', 'Frise']) assert.ok(jeux.includes(`${jeu}.tsx`), jeu)
  for (const jeu of jeux) {
    const s = source(`views/cabinet/jeux/${jeu}`)
    assert.doesNotMatch(s, /<NicheALaRevelation |nicheRetientSonSouffle\(\)/, jeu)
  }
  // Le podium d'un quiz : s'il y monte, il sort.
  assert.match(source('games/quiz/PlayerView.tsx'), /<NicheALaFin podium=\{v\.yourPodiumIndex !== undefined && !v\.horsClassement && total > 0\} \/>/)
  // Les fins de partie en solo relisent le profil : la niche y prend la forme atteinte.
  assert.match(source('components/Gains.tsx'), /setLu\(profile\)\s+porterNiche\(profile\)/)
})

test('immobile si le téléphone demande moins de mouvement, et rien de lui ne déborde de côté', () => {
  const css = readFileSync(client('styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const calme = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map(m => m[1]).join('\n')
  for (const sel of ['.niche-pluie', '.niche-goutte', '.niche.nourrie .niche-rebord', '.niche-plus', '.niche-bulle']) assert.ok(calme.includes(sel), `${sel} se fige`)
  assert.match(calme, /\.niche\.retient \.niche-bete img \{ transform: none; \}/, 'il retient son souffle sans se pencher')
  // Dehors, la scène couvre l'écran et coupe ce qui sortirait : la page ne s'élargit jamais.
  assert.match(css, /\.niche-dehors-scene \{[^}]*position: fixed;[^}]*inset: 0;[^}]*overflow: hidden;[^}]*pointer-events: none;/)
  // Et le composant ne sort pas quand le mouvement est réduit : il triomphe chez lui.
  assert.match(source('components/Niche.tsx'), /if \(sansMouvement\(\)\) \{\s+setHumeur\('triomphe'\)/)
})
