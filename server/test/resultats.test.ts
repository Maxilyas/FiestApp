// La justesse des résultats : qui gagne, qui reçoit quel prix, et ce que le
// souvenir, l'historique, l'export et l'import en disent.
//
// Tout ce qu'on teste ici est une dérivation pure des journaux : on l'appelle
// directement, avec le strict minimum de lignes pour reproduire le cas. Les
// rares tests qui ont besoin d'une base l'ouvrent dans un dossier jetable.
//
// Les fonctions ajoutées par ces corrections sont lues par un import d'espace
// de noms ou un import dynamique : sur le code d'avant, leur absence fait
// échouer le seul test qui s'en sert, pas le fichier entier.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createClient } from '@libsql/client'
import type { AnswerRow } from '../src/core/answers'
import type { ScoreEntry } from '../src/core/scores'
import type { PlayerRec } from '../src/core/party'
import { computeStats } from '../src/core/stats'
import { buildRecap } from '../src/core/recap'
import { buildProgress } from '../src/core/progress'
import { buildReview } from '../src/core/review'
import { ArchiveStore, summarize } from '../src/core/archive'
import { exportFiles, reviewFromDatabase, toCsv } from '../src/core/export'
import { PartyBackup } from '../src/core/backup'
import { QuizStore } from '../src/core/quizStore'
import * as equipes from '../../shared/teams'
import { parseImportedQuestions } from '../../shared/library'
import { cleanName } from '../../shared/avatars'
import { XP } from '../../shared/profil'
import type { PartyArchive } from '../../shared/archive'
import type { Award, PublicPlayer, TeamBonus } from '../../shared/types'

// ── De quoi écrire une soirée en quelques lignes ──────────────────────────

let horloge = 1_000
/** Chaque ligne arrive après la précédente : l'ordre du journal compte. */
const tic = () => ++horloge

function invite(id: string, name: string, extra: Partial<PublicPlayer> = {}): PublicPlayer {
  return { id, name, avatar: '🦊', connected: false, score: 0, teamId: null, ...extra }
}

/** Un invité tel que le registre le garde — ce que lit l'expérience. */
function inscrit(id: string, name: string, profileId: string | null, createdAt: number): PlayerRec {
  return { id, name, avatar: '🦊', token: `jeton-${id}`, teamId: null, profileId, createdAt }
}

/** Une ligne du journal des réponses : par défaut, un QCM juste en 5 s. */
function reponse(playerId: string, extra: Partial<AnswerRow> = {}): AnswerRow {
  return {
    sessionId: 's1',
    quizTitle: 'Quiz',
    qIndex: 0,
    kind: 'choice',
    playerId,
    answered: true,
    correct: true,
    choice: 0,
    value: null,
    target: null,
    ms: 5_000,
    changes: 0,
    points: 0,
    durationMs: 20_000,
    observed: false,
    createdAt: tic(),
    ...extra,
  }
}

/** Une mauvaise réponse à un QCM. */
const faux = (playerId: string, extra: Partial<AnswerRow> = {}) =>
  reponse(playerId, { correct: false, choice: 1, ...extra })

/** Une estimation. */
const estime = (playerId: string, value: number, target: number, extra: Partial<AnswerRow> = {}) =>
  reponse(playerId, { kind: 'number', correct: null, choice: null, value, target, ...extra })

/** Une ligne du journal des gains. */
function gain(playerId: string, points: number, sessionId = 's1', reason = 'Quiz « Quiz » — Q1'): ScoreEntry {
  return { playerId, sessionId, points, reason, createdAt: tic() }
}

const prix = (awards: Award[], key: string) => awards.find(a => a.key === key)

/** Des questions numérotées de 0 à n - 1, une ligne chacune. */
const serie = (n: number, ligne: (qIndex: number) => AnswerRow) => Array.from({ length: n }, (_, q) => ligne(q))

// ── 1. Les égalités : une seule règle, partout ────────────────────────────

test('une seule règle de classement : rang partagé, ex æquo écrits par prénom affiché', async () => {
  const { rangPartage, classer } = await import('../../shared/classement')
  assert.equal(rangPartage(300, [300, 300, 200]), 1)
  assert.equal(rangPartage(200, [300, 300, 200]), 3, 'deux premiers, puis un troisième — pas de deuxième')

  const lignes = classer(
    [
      { id: 'z', nom: 'Zoé', pts: 300 },
      { id: 'c2', nom: 'Camille (2)', pts: 100 },
      { id: 'a', nom: 'Alice', pts: 300 },
      { id: 'c1', nom: 'Camille', pts: 100 },
    ],
    l => l.pts,
    l => l.nom,
    l => l.id,
  )
  assert.deepEqual(
    lignes.map(l => [l.item.nom, l.rang]),
    [
      ['Alice', 1],
      ['Zoé', 1],
      ['Camille', 3],
      ['Camille (2)', 3],
    ],
  )
})

test('un quiz à 300–300 a deux vainqueurs : le souvenir, le bilan et l’expérience disent la même chose', () => {
  // Zoé marque la première ; Alice la rejoint à la question suivante. Le
  // quiz a de quoi avoir un podium : cinq questions, quatre joueurs.
  const zoe = invite('zoe', 'Zoé', { score: 300 })
  const alice = invite('alice', 'Alice', { score: 300 })
  const salle = [invite('bob', 'Bob'), invite('dora', 'Dora')]
  const scores = [gain('zoe', 300, 's1', 'Quiz « Culture » — Q1'), gain('alice', 300, 's1', 'Quiz « Culture » — Q2')]
  const answers = [
    reponse('zoe', { quizTitle: 'Culture', qIndex: 0, points: 300 }),
    faux('alice', { quizTitle: 'Culture', qIndex: 0 }),
    faux('zoe', { quizTitle: 'Culture', qIndex: 1 }),
    reponse('alice', { quizTitle: 'Culture', qIndex: 1, points: 300 }),
    ...[2, 3, 4].flatMap(q => ['zoe', 'alice'].map(id => faux(id, { quizTitle: 'Culture', qIndex: q }))),
    ...[0, 1, 2, 3, 4].flatMap(q => salle.map(p => faux(p.id, { quizTitle: 'Culture', qIndex: q }))),
  ]

  const recap = buildRecap({ players: [zoe, alice, ...salle], teams: [], bonuses: [], scores, answers })
  assert.deepEqual(
    recap.quizWinners.map(w => [w.name, w.points, w.title]),
    [
      ['Alice', 300, 'Culture'],
      ['Zoé', 300, 'Culture'],
    ],
    'les deux ex æquo sont vainqueurs, écrits dans l’ordre commun',
  )

  const review = buildReview({
    rows: answers,
    players: [zoe, alice, ...salle],
    teams: [],
    bonuses: [],
    packsBySession: new Map(),
    library: [],
  })
  assert.equal(review.quizzes[0].winner?.playerId, 'alice', 'le bilan nomme le premier des vainqueurs du souvenir')

  const gains = buildProgress({
    players: [
      inscrit('zoe', 'Zoé', 'profil-zoe', 1),
      inscrit('alice', 'Alice', 'profil-alice', 2),
      inscrit('bob', 'Bob', null, 3),
      inscrit('dora', 'Dora', null, 4),
    ],
    scores,
    answers,
  })
  assert.equal(gains.length, 2)
  for (const g of gains) {
    assert.equal(g.releve.quizGagnes, 1, `${g.playerId} a gagné le quiz, ex æquo`)
    assert.equal(g.gain.quiz, XP.podiumQuiz[0], 'et touche l’expérience d’une première place entière')
  }
})

test('à égalité de points, le souvenir, le bilan et les chiffres écrivent les ex æquo dans le même ordre', () => {
  // L'ordre de la liste est celui du registre en mémoire, qui n'est pas
  // l'ordre d'arrivée après un redémarrage : aucun écran ne doit en dépendre.
  const joueurs = [
    invite('zoe', 'Zoé', { score: 100 }),
    invite('camille-2', 'Camille', { score: 100, nomAffiche: 'Camille (2)' }),
    invite('alice', 'Alice', { score: 100 }),
    invite('camille-1', 'Camille', { score: 100 }),
  ]
  const scores = joueurs.map(p => gain(p.id, 100))
  const answers = joueurs.map(p => reponse(p.id, { points: 100 }))
  const attendu = ['Alice', 'Camille', 'Camille (2)', 'Zoé']

  const recap = buildRecap({ players: joueurs, teams: [], bonuses: [], scores, answers })
  assert.deepEqual(recap.ranking.map(r => r.name), attendu, 'le podium du souvenir')

  const review = buildReview({ rows: answers, players: joueurs, teams: [], bonuses: [], packsBySession: new Map(), library: [] })
  assert.deepEqual(review.players.map(p => p.name), attendu, 'le classement du bilan')
  assert.ok(review.players.every(p => p.rank === 1), 'tous premiers ex æquo')

  assert.deepEqual(computeStats(answers, joueurs).players.map(s => s.name), attendu, 'le tableau des chiffres')
})

/**
 * Les Zèbres gagnent le quiz (300 contre 200 de moyenne) : 2 points au barème
 * contre 1. Un prix à +1 pour les Aigles les remet à égalité.
 */
const zebresEtAigles = {
  teams: [
    { id: 'zebres', name: 'Les Zèbres', emoji: '🦓', position: 0, createdAt: 1 },
    { id: 'aigles', name: 'Les Aigles', emoji: '🦅', position: 1, createdAt: 1 },
  ],
  bonuses: [{ id: 'b1', teamId: 'aigles', points: 1, reason: 'Karaoké', createdAt: 5 }] as TeamBonus[],
  players: [
    { id: 'zack', name: 'Zack', avatar: '🦓', teamId: 'zebres', createdAt: 1 },
    { id: 'anna', name: 'Anna', avatar: '🦅', teamId: 'aigles', createdAt: 2 },
  ],
  scores: () => [gain('zack', 300), gain('anna', 200)],
  answers: () => [reponse('zack', { points: 300 }), reponse('anna', { points: 200 })],
}

test('l’écran de victoire couronne les ex æquo au lieu de choisir par l’alphabet', () => {
  const { teams, bonuses } = zebresEtAigles
  const joueurs = [invite('zack', 'Zack', { score: 300, teamId: 'zebres' }), invite('anna', 'Anna', { score: 200, teamId: 'aigles' })]
  assert.deepEqual(
    equipes.vainqueursDuQuiz(equipes.teamScores(teams, joueurs, bonuses, equipes.questionsDesEquipes(joueurs, zebresEtAigles.answers()))).map(t => [t.name, t.finalPoints]),
    [
      ['Les Aigles', 2],
      ['Les Zèbres', 2],
    ],
    'deux équipes à 2 points : ex æquo, pas « Les Aigles » seuls',
  )
  assert.deepEqual(equipes.vainqueursDuQuiz(equipes.teamScores(teams, [], [], new Map())), [], 'rien joué, rien remis : personne à couronner')
})

// ── 2. Les prix de la soirée ──────────────────────────────────────────────

test('La Gâchette Facile se juge sur toutes les réponses, et son texte dit ce qu’il mesure', () => {
  // Gaston : six erreurs en une seconde. Hugo : deux bonnes réponses lentes,
  // quatre erreurs éclair. Le prix jugeait sur les seules bonnes réponses.
  const answers = [
    ...serie(6, q => faux('gaston', { qIndex: q, ms: 1_000 })),
    ...serie(2, q => reponse('hugo', { qIndex: q, ms: 15_000, points: 110 })),
    ...serie(4, q => faux('hugo', { qIndex: q + 2, ms: 1_000 })),
  ]
  const { awards } = computeStats(answers, [invite('gaston', 'Gaston'), invite('hugo', 'Hugo')])
  const gachette = prix(awards, 'gachette')
  assert.equal(gachette?.player?.playerId, 'gaston')
  assert.equal(gachette?.detail, '6 erreurs sur 6 réponses, en 1,0 s de moyenne')
})

test('Le Sans-Faute exige au moins une bonne réponse', () => {
  const answers = [...serie(3, q => faux('anne', { qIndex: q })), ...serie(4, q => faux('bea', { qIndex: q }))]
  const { awards } = computeStats(answers, [invite('anne', 'Anne'), invite('bea', 'Béa')])
  assert.equal(prix(awards, 'sansfaute'), undefined, 'personne n’est « sans faute » à 0 % de réussite')
})

test('à score égal, le volume départage avant le prénom', () => {
  const joueurs = [invite('alice', 'Alice'), invite('zoe', 'Zoé')]

  const parfaits = computeStats(
    [...serie(3, q => reponse('alice', { qIndex: q })), ...serie(30, q => reponse('zoe', { qIndex: q }))],
    joueurs,
  )
  assert.equal(prix(parfaits.awards, 'sansfaute')?.player?.name, 'Zoé', '30 sur 30 bat 3 sur 3')

  const devins = computeStats(
    [...serie(2, q => estime('alice', 42, 42, { qIndex: q })), ...serie(8, q => estime('zoe', 42, 42, { qIndex: q }))],
    joueurs,
  )
  assert.equal(prix(devins.awards, 'devin')?.player?.name, 'Zoé', 'parfait sur 8 bat parfait sur 2')

  const lynx = computeStats(
    [
      ...serie(2, q => reponse('alice', { qIndex: q, observed: true })),
      ...serie(6, q => reponse('zoe', { qIndex: q, observed: true })),
    ],
    joueurs,
  )
  assert.equal(prix(lynx.awards, 'lynx')?.player?.name, 'Zoé', '6 sur 6 de mémoire bat 2 sur 2')
})

test('L’Éclair et Le Contemplatif ne vont jamais à la même personne', () => {
  // Alice est la seule à avoir trois bonnes réponses : à la fois la plus
  // rapide et la plus lente d'elle-même.
  const seule = computeStats(
    [...serie(3, q => reponse('alice', { qIndex: q, ms: 2_000 * (q + 1) })), reponse('bob', { qIndex: 0 })],
    [invite('alice', 'Alice'), invite('bob', 'Bob')],
  )
  assert.equal(prix(seule.awards, 'eclair'), undefined)
  assert.equal(prix(seule.awards, 'contemplatif'), undefined)

  const duo = computeStats(
    [...serie(3, q => reponse('alice', { qIndex: q, ms: 2_000 })), ...serie(3, q => reponse('bob', { qIndex: q, ms: 8_000 }))],
    [invite('alice', 'Alice'), invite('bob', 'Bob')],
  )
  assert.equal(prix(duo.awards, 'eclair')?.player?.name, 'Alice')
  assert.equal(prix(duo.awards, 'contemplatif')?.player?.name, 'Bob')
})

test('La Remontada et La Chute Libre se jugent au rang partagé', () => {
  const quatre = [invite('a', 'Alice'), invite('b', 'Bruno'), invite('c', 'Chloé'), invite('d', 'David')]
  // Premier quiz : tout le monde à zéro. L'ordre de connexion ne doit pas
  // devenir un classement.
  const aZero = computeStats(
    [
      ...quatre.map(p => faux(p.id, { sessionId: 's1' })),
      reponse('d', { sessionId: 's2', points: 500 }),
      reponse('c', { sessionId: 's2', points: 400 }),
      reponse('b', { sessionId: 's2', points: 300 }),
      reponse('a', { sessionId: 's2', points: 200 }),
    ],
    quatre,
  )
  assert.equal(prix(aZero.awards, 'remontada'), undefined, 'David n’a gagné aucune place : ils étaient tous premiers')
  assert.equal(prix(aZero.awards, 'chutelibre'), undefined, 'et personne n’a chuté d’une première place partagée à zéro')

  // Une vraie remontée : Chloé, dernière ex æquo, finit première.
  const vraie = computeStats(
    [
      reponse('a', { sessionId: 's1', points: 300 }),
      reponse('b', { sessionId: 's1', points: 200 }),
      faux('c', { sessionId: 's1' }),
      faux('d', { sessionId: 's1' }),
      reponse('c', { sessionId: 's2', points: 500 }),
      reponse('d', { sessionId: 's2', points: 400 }),
      reponse('a', { sessionId: 's2', points: 100 }),
      reponse('b', { sessionId: 's2', points: 50 }),
    ],
    quatre,
  )
  assert.equal(prix(vraie.awards, 'remontada')?.player?.name, 'Chloé')
  assert.equal(prix(vraie.awards, 'remontada')?.detail, '2 places gagnées en cours de soirée')
})

test('Le Sauveur exige deux coéquipiers, comme le bilan', () => {
  const duo = [invite('alice', 'Alice', { teamId: 'duo' }), invite('bob', 'Bob', { teamId: 'duo' })]
  const aDeux = computeStats(serie(2, q => reponse('alice', { qIndex: q })).concat(serie(2, q => faux('bob', { qIndex: q }))), duo)
  assert.equal(prix(aDeux.awards, 'sauveur'), undefined, 'à deux, être « le seul à trouver » arrive à chaque question')

  const trio = [...duo.map(p => ({ ...p, teamId: 'trio' })), invite('chloe', 'Chloé', { teamId: 'trio' })]
  const aTrois = computeStats(
    [
      ...serie(2, q => reponse('alice', { qIndex: q })),
      ...serie(2, q => faux('bob', { qIndex: q })),
      ...serie(2, q => reponse('chloe', { qIndex: q, answered: false, correct: null, choice: null, ms: null })),
    ],
    trio,
  )
  assert.equal(prix(aTrois.awards, 'sauveur')?.player?.name, 'Alice')
})

test('La Plus Solidaire ne va pas à une équipe qui n’a jamais répondu', () => {
  const joueurs = [
    invite('paul', 'Paul', { teamId: 'dormeurs' }),
    invite('pia', 'Pia', { teamId: 'dormeurs' }),
    invite('lea', 'Léa', { teamId: 'actifs', score: 300 }),
    invite('leo', 'Léo', { teamId: 'actifs', score: 100 }),
  ]
  const endormi = { answered: false, correct: null, choice: null, ms: null }
  const { awards } = computeStats(
    [reponse('paul', endormi), reponse('pia', endormi), reponse('lea', { points: 300 }), reponse('leo', { points: 100 })],
    joueurs,
  )
  const solidaire = prix(awards, 'solidaire')
  assert.equal(solidaire?.teamId, 'actifs')
  assert.equal(solidaire?.detail, '200 points d’écart entre son meilleur et son moins bon')
})

test('L’Optimiste écarte les estimations absurdes au lieu d’annoncer « Infinity % »', () => {
  const { awards, players } = computeStats(
    [
      ...serie(2, q => estime('alice', 1e308, 1, { qIndex: q })),
      ...serie(2, q => estime('bob', 150, 100, { qIndex: q })),
    ],
    [invite('alice', 'Alice'), invite('bob', 'Bob')],
  )
  assert.equal(prix(awards, 'optimiste')?.player?.name, 'Bob')
  assert.equal(prix(awards, 'optimiste')?.detail, '50 % au-dessus de la vérité, en moyenne')
  assert.ok(
    awards.every(a => !/Infinity|NaN/.test(a.detail)),
    'aucun prix n’affiche de nombre qui n’en est pas un',
  )
  assert.equal(players.find(s => s.playerId === 'alice')?.bias, null, 'rien de raisonnable à moyenner')
})

test('Le Pessimiste porte un emoji que Windows 10 sait afficher', () => {
  const { awards } = computeStats(serie(2, q => estime('bob', 50, 100, { qIndex: q })), [invite('bob', 'Bob')])
  // 🪨 date d'Emoji 13.0 : un carré vide sur l'écran commun.
  assert.equal(prix(awards, 'pessimiste')?.emoji, '🌧️')
})

// ── 3. Le souvenir ─────────────────────────────────────────────────────────

test('le plus beau coup ignore une question annulée', () => {
  const joueurs = [invite('alice', 'Alice', { score: 200 }), invite('bob', 'Bob', { score: 300 })]
  const scores = [
    gain('alice', 600, 's1', 'Quiz « Quiz » — Q1'),
    gain('alice', -600, 's1', 'Annulation — Q1'),
    gain('alice', 200, 's1', 'Quiz « Quiz » — Q2'),
    gain('bob', 300, 's1', 'Quiz « Quiz » — Q3'),
  ]
  // L'annulation retire aussi la question du journal des réponses.
  const answers = [
    reponse('alice', { qIndex: 1, points: 200 }),
    faux('bob', { qIndex: 1 }),
    faux('alice', { qIndex: 2 }),
    reponse('bob', { qIndex: 2, points: 300 }),
  ]
  const recap = buildRecap({ players: joueurs, teams: [], bonuses: [], scores, answers })
  assert.deepEqual(recap.bestShot, { name: 'Bob', avatar: '🦊', points: 300, reason: 'Quiz « Quiz » — Q3' })
})

test('le plus régulier compte une question reposée une seule fois', () => {
  const joueurs = [invite('alice', 'Alice', { score: 150 }), invite('bob', 'Bob', { score: 100 })]
  const scores = [
    gain('alice', 100, 's1', 'Quiz « Quiz » — Q1'),
    gain('alice', -100, 's1', 'Annulation — Q1'),
    gain('alice', 150, 's1', 'Quiz « Quiz » — Q1'),
    gain('bob', 100, 's1', 'Quiz « Quiz » — Q2'),
  ]
  const answers = [
    reponse('alice', { qIndex: 0, points: 150 }),
    faux('bob', { qIndex: 0 }),
    faux('alice', { qIndex: 1 }),
    reponse('bob', { qIndex: 1, points: 100 }),
  ]
  const recap = buildRecap({ players: joueurs, teams: [], bonuses: [], scores, answers })
  assert.equal(recap.steadiest?.count, 1, 'Alice n’a marqué que sur une question')
})

test('une salle qui s’est trompée partout a quand même joué son quiz', () => {
  // Aucun point : le journal des gains est vide, celui des réponses non. La
  // page souvenir s'affiche désormais dans ce cas — elle doit compter juste.
  const joueurs = [invite('lea', 'Léa'), invite('leo', 'Léo')]
  const recap = buildRecap({
    players: joueurs,
    teams: [],
    bonuses: [],
    scores: [],
    answers: joueurs.flatMap(p => serie(3, q => faux(p.id, { qIndex: q }))),
  })
  assert.equal(recap.ranking.length, 0)
  assert.equal(recap.stats.logged, 6, 'la soirée a commencé : six réponses enregistrées')
  assert.equal(recap.quizCount, 1)
  assert.ok(recap.stats.awards.length > 0, 'ses prix sont déjà là')
})

test('des points fantômes ne comptent ni au souvenir ni à l’expérience', () => {
  // « fantome » a des gains mais n'est plus dans la soirée.
  const scores = [gain('fantome', 900), gain('alice', 200), gain('bob', 100)]
  const answers = [reponse('alice', { points: 200 }), reponse('bob', { qIndex: 1, points: 100 })]

  const recap = buildRecap({
    players: [invite('alice', 'Alice', { score: 200 }), invite('bob', 'Bob', { score: 100 })],
    teams: [],
    bonuses: [],
    scores,
    answers,
  })
  assert.deepEqual(recap.quizWinners.map(w => w.name), ['Alice'], 'un fantôme ne cache pas le vrai vainqueur')
  assert.equal(recap.totalPoints, 300)

  const [alice] = buildProgress({ players: [inscrit('alice', 'Alice', 'profil-alice', 1)], scores, answers })
  assert.equal(alice.releve.rang, 1, 'Alice est première de la soirée, pas deuxième derrière un fantôme')
  assert.equal(alice.releve.points, 200)

  // Et un quiz qui a un podium le donne à Alice : cinq questions, quatre
  // joueurs, le fantôme devant tout le monde.
  const salle = ['bob', 'dora', 'eve']
  const quiz = [
    gain('fantome', 900, 's2', 'Quiz « Quiz » — Q1'),
    gain('alice', 200, 's2', 'Quiz « Quiz » — Q1'),
    gain('bob', 100, 's2', 'Quiz « Quiz » — Q2'),
  ]
  const journal = [0, 1, 2, 3, 4].flatMap(q =>
    ['fantome', 'alice', ...salle].map(id => reponse(id, { sessionId: 's2', qIndex: q, correct: q === 0 ? id !== 'dora' : false })),
  )
  const joueurs = [inscrit('alice', 'Alice', 'profil-alice', 1), ...salle.map((id, i) => inscrit(id, id, null, i + 2))]
  const [aliceQuiz] = buildProgress({ players: joueurs, scores: quiz, answers: journal })
  assert.equal(aliceQuiz.releve.quizGagnes, 1, 'le fantôme ne lui prend pas la victoire du quiz')
  assert.equal(aliceQuiz.gain.quiz, XP.podiumQuiz[0])
})

test('un profil ne reçoit qu’un gain par soirée, même s’il tient deux joueurs', () => {
  const players = [
    inscrit('p1', 'Alice', 'profil-alice', 1),
    inscrit('p2', 'Alice', 'profil-alice', 2),
    inscrit('p3', 'Bob', 'profil-bob', 3),
  ]
  const scores = [
    gain('p1', 100),
    gain('p2', 300, 's1', 'Quiz « Quiz » — Q2'),
    gain('p2', 300, 's1', 'Quiz « Quiz » — Q3'),
    gain('p3', 200, 's1', 'Quiz « Quiz » — Q3'),
  ]
  // Chaque question est posée aux trois : elle rapporte. Le premier joueur
  // d'Alice trouve une fois, le second deux.
  const answers = [
    reponse('p1', { qIndex: 0, points: 100 }),
    faux('p2', { qIndex: 0 }),
    faux('p3', { qIndex: 0 }),
    faux('p1', { qIndex: 1 }),
    reponse('p2', { qIndex: 1, points: 300 }),
    faux('p3', { qIndex: 1 }),
    faux('p1', { qIndex: 2 }),
    reponse('p2', { qIndex: 2, points: 300 }),
    reponse('p3', { qIndex: 2, points: 200 }),
  ]
  const gains = buildProgress({ players, scores, answers })
  const aAlice = gains.filter(g => g.profileId === 'profil-alice')
  assert.equal(aAlice.length, 1, 'deux lignes (profil, soirée) : la seconde écraserait la première')
  assert.equal(aAlice[0].playerId, 'p2', 'on garde le meilleur des deux')
})

// ── 4. L'historique ────────────────────────────────────────────────────────

/** Un dossier jetable, effacé quoi qu'il arrive. */
async function dansUnDossier(fn: (dir: string) => Promise<void>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'quizz-resultats-'))
  try {
    await fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Deux Camille au renard : la seconde, arrivée après, gagne la soirée. */
function soireeDeCamille(): PartyArchive {
  return {
    version: 1,
    players: [
      { id: 'camille-1', name: 'Camille', avatar: '🦊', teamId: null, createdAt: 1 },
      { id: 'camille-2', name: 'Camille', avatar: '🦊', teamId: null, createdAt: 2 },
    ],
    teams: [],
    bonuses: [],
    scores: [gain('camille-1', 100), gain('camille-2', 300, 's1', 'Quiz « Quiz » — Q2')],
    answers: [reponse('camille-1', { points: 100 }), reponse('camille-2', { qIndex: 1, points: 300 })],
    packs: {},
  }
}

test('l’historique nomme le vainqueur comme le souvenir : « Camille (2) »', () => {
  const resume = summarize({ id: 'x', title: 'Soirée', heldAt: 1, archivedAt: 2 }, soireeDeCamille())
  assert.deepEqual(resume.winners, [{ name: 'Camille (2)', avatar: '🦊', points: 300 }])
})

test('l’historique couronne les équipes comme l’écran de victoire, prix compris', () => {
  const { teams, bonuses, players } = zebresEtAigles
  const archive: PartyArchive = {
    version: 1,
    players,
    teams,
    bonuses,
    scores: zebresEtAigles.scores(),
    answers: zebresEtAigles.answers(),
    packs: {},
  }
  const resume = summarize({ id: 'x', title: 'Soirée', heldAt: 1, archivedAt: 2 }, archive)
  assert.deepEqual(
    resume.teamWinners.map(t => [t.name, t.points]),
    [
      ['Les Aigles', 2],
      ['Les Zèbres', 2],
    ],
    'il prenait la première au quiz seul, sans les prix : « Les Zèbres »',
  )
})

test('l’historique se dérive à la lecture, sans relire les archives ni écrire de marque en base', async () => {
  await dansUnDossier(async dir => {
    const url = `file:${path.join(dir, 'permanente.db')}`
    const store = new ArchiveStore(url)
    await store.init('espace')
    const brut = createClient({ url })
    try {
      await store.save('espace', 'soiree-1', 1, soireeDeCamille(), 'Les Camille')
      const stocke = String((await brut.execute('SELECT summary FROM soirees')).rows[0].summary)
      assert.ok(!stocke.includes('Camille (2)'), 'la marque d’homonymie n’est jamais écrite en base')

      const [liste] = await store.list('espace')
      assert.equal(liste.title, 'Les Camille')
      assert.deepEqual(liste.winners, [{ name: 'Camille (2)', avatar: '🦊', points: 300 }])

      // Une soirée rangée par l'ancien code : son résumé figé disait
      // « Camille », sans marque. La liste la redérive, une fois.
      const ancien = {
        players: 2,
        quizzes: 1,
        questions: 2,
        winner: { name: 'Camille', avatar: '🦊', points: 300 },
        teamWinner: null,
      }
      await brut.execute({
        sql: `INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: ['espace', 'soiree-0', 'Avant', 0, 0, JSON.stringify(ancien), JSON.stringify(soireeDeCamille())],
      })
      const rederivee = (await store.list('espace')).find(s => s.id === 'soiree-0')
      assert.deepEqual(rederivee?.winners, [{ name: 'Camille (2)', avatar: '🦊', points: 300 }])

      // La liste ne lit plus que les résumés : des archives illisibles ne
      // l'empêchent pas de s'afficher.
      await brut.execute(`UPDATE soirees SET data = 'illisible'`)
      const encore = await store.list('espace')
      assert.equal(encore.length, 2)
      assert.ok(encore.every(s => s.winners[0]?.name === 'Camille (2)'))
    } finally {
      brut.close()
      store.close()
    }
  })
})

test('les fiches d’avant se refont par lots de dix archives, jamais toutes en une requête', async () => {
  await dansUnDossier(async dir => {
    const url = `file:${path.join(dir, 'permanente.db')}`
    const store = new ArchiveStore(url)
    await store.init('espace')
    const brut = createClient({ url })
    try {
      // Vingt-cinq soirées à la fiche 2, qui ne dit pas assez pour la
      // moyenne des équipes : chacune doit relire son archive, une fois.
      const archive = JSON.stringify(soireeDeCamille())
      for (let i = 0; i < 25; i++) {
        await brut.execute({
          sql: `INSERT INTO soirees (space_id, id, title, held_at, archived_at, summary, data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: ['espace', `soiree-${i}`, `Soirée ${i}`, i, i, JSON.stringify({ v: 2, invites: [] }), archive],
        })
      }
      const client = (store as any).client
      const execute = client.execute.bind(client)
      const lectures: number[] = []
      client.execute = (req: any) => {
        if (typeof req === 'object' && /SELECT id, data FROM soirees/.test(req.sql)) lectures.push(req.args.length - 1)
        return execute(req)
      }
      const liste = await store.list('espace')
      assert.equal(liste.length, 25)
      assert.ok(liste.every(s => s.winners[0]?.name === 'Camille (2)'), 'toutes relues')
      assert.deepEqual(lectures, [10, 10, 5], 'trois requêtes, dix archives au plus chacune')
      lectures.length = 0
      await store.list('espace')
      assert.deepEqual(lectures, [], 'les fiches refaites ne se relisent plus')
    } finally {
      brut.close()
      store.close()
    }
  })
})

// ── 5. L'export ────────────────────────────────────────────────────────────

test('le CSV neutralise les cellules qu’Excel prendrait pour des formules', () => {
  const csv = toCsv([['=HYPERLINK("http://pirate","clic")', '+33', '-2+3', '@SUM(A1)', '\tcaché', 'Camille', -40, '\u221240 °C']])
  const cellules = csv.replace(/^\uFEFF/, '').replace(/\r\n$/, '').split(';')
  assert.deepEqual(cellules, [
    `"'=HYPERLINK(""http://pirate"",""clic"")"`,
    `'+33`,
    `'-2+3`,
    `'@SUM(A1)`,
    `'\tcaché`,
    'Camille',
    '-40',
    '\u221240 °C',
  ])
  assert.equal(toCsv([['\rretour']]).replace(/^\uFEFF/, ''), `"'\rretour"\r\n`)
})

test('l’export depuis la base distingue les homonymes', async () => {
  await dansUnDossier(async dir => {
    const url = `file:${path.join(dir, 'permanente.db')}`
    const miroir = new PartyBackup(url)
    await miroir.init('espace-1')
    await miroir.close()
    const bibliotheque = new QuizStore(url)
    await bibliotheque.init('espace-1')
    bibliotheque.close()
    const brut = createClient({ url })
    const joueur = (id: string, createdAt: number) => ({
      sql: 'INSERT INTO party_players (id, name, avatar, token, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, 'Camille', '🦊', `jeton-${id}`, createdAt, 'espace-1'],
    })
    const point = (id: string, playerId: string, points: number) => ({
      sql: 'INSERT INTO party_scores (id, player_id, session_id, points, reason, created_at, space_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [id, playerId, 's1', points, 'Quiz « Quiz » — Q1', tic(), 'espace-1'],
    })
    const ligne = (id: string, playerId: string, points: number) => ({
      sql: `INSERT INTO party_answers (id, session_id, quiz_title, q_index, kind, player_id, answered, correct, choice,
              value, target, ms, changes, points, duration_ms, observed, created_at, space_id)
            VALUES (?, 's1', 'Quiz', 0, 'choice', ?, 1, ?, 0, NULL, NULL, 5000, 0, ?, 20000, 0, ?, 'espace-1')`,
      args: [id, playerId, points > 0 ? 1 : 0, points, tic()],
    })
    try {
      await brut.batch(
        [
          'CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, slug TEXT NOT NULL)',
          { sql: 'INSERT INTO accounts (id, slug) VALUES (?, ?)', args: ['espace-1', 'fete'] },
          // La seconde Camille est insérée d'abord : l'ordre de la table n'est
          // pas l'ordre d'arrivée.
          joueur('camille-2', 2),
          joueur('camille-1', 1),
          point('g1', 'camille-1', 100),
          point('g2', 'camille-2', 300),
          ligne('r1', 'camille-1', 100),
          ligne('r2', 'camille-2', 300),
        ],
        'write',
      )
    } finally {
      brut.close()
    }
    const review = await reviewFromDatabase(url, undefined, { slug: 'fete' })
    assert.deepEqual(review.players.map(p => p.name), ['Camille (2)', 'Camille'])
    const invites = exportFiles(review).find(f => f.name === 'invites.csv')!.content
    assert.match(invites, /\nCamille \(2\);🦊;/)
  })
})

// ── 6. L'import des questions ──────────────────────────────────────────────

test('l’import lit les milliers, le signe moins typographique et le plus', () => {
  const blocs = [
    ['Profondeur de la fosse des Mariannes ?', '= 10 935 mètres'],
    ['Habitants ?', '= 2\u202f100\u202f000 habitants'],
    ['Record de froid ?', '= \u221240 °C'],
    ['Altitude ?', "= 1'234 m"],
    ['Altitude encore ?', '= 1’234 m'],
    ['Insécable ?', '= 12\u00a0345'],
    ['Positif ?', '= +5 points'],
    // Ce qui marchait déjà doit continuer de marcher.
    ['Année ?', '= 1994'],
    ['Pi ?', '= 3,14'],
    ['Froid ?', '= -40 °C'],
    ['Population ?', '= 4.3 millions'],
    ['Âge ?', '= 11400 ans'],
    ['Cours ?', '= 42 cours'],
  ]
  const lu = parseImportedQuestions(blocs.map(b => b.join('\n')).join('\n\n'))
  assert.equal(lu.ignored, 0)
  assert.deepEqual(
    lu.questions.map(q => [q.kind, q.target, q.unit]),
    [
      ['number', 10935, 'mètres'],
      ['number', 2100000, 'habitants'],
      ['number', -40, '°C'],
      ['number', 1234, 'm'],
      ['number', 1234, 'm'],
      ['number', 12345, ''],
      ['number', 5, 'points'],
      ['number', 1994, ''],
      ['number', 3.14, ''],
      ['number', -40, '°C'],
      ['number', 4.3, 'millions'],
      ['number', 11400, 'ans'],
      ['number', 42, 'cours'],
    ],
  )
})

test('un nombre qui reste ambigu est ignoré plutôt que mal lu', () => {
  const lu = parseImportedQuestions(['Profondeur ?', '= 10 93 mètres', '', 'Population ?', '= 1,000,000'].join('\n'))
  assert.equal(lu.questions.length, 0, 'ni 10 « 93 mètres », ni 1 « ,000 »')
  assert.equal(lu.ignored, 2)
})

// ── 7. Le prénom tronqué ───────────────────────────────────────────────────

test('un prénom trop long se coupe entre deux caractères, jamais au milieu d’un emoji', () => {
  const x23 = 'X'.repeat(23)
  assert.equal(cleanName(x23 + '🎉'), x23 + '🎉', 'vingt-quatre caractères tiennent, emoji compris')
  assert.equal(cleanName(x23 + '🎉🎉'), x23 + '🎉')
  assert.equal(cleanName(x23 + '🇫🇷'), x23, 'un drapeau ne se coupe pas en deux lettres')
  assert.equal(cleanName(x23 + '👍🏽'), x23, 'ni un pouce de sa couleur')
  assert.equal(cleanName('X'.repeat(22) + '👍🏽Y'), 'X'.repeat(22) + '👍🏽')
  for (const nom of [x23 + '🎉🎉', x23 + '🇫🇷', x23 + '👍🏽']) {
    assert.ok(!/[\ud800-\udfff]/u.test(cleanName(nom)), `demi-caractère dans « ${cleanName(nom)} »`)
  }
})
