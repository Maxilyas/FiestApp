// Les chiffres d'un joueur : ce que la fiche, la carte, le bilan et le
// souvenir disent de ses QCM et de ses estimations.
//
// La précision ne compte que les QCM — une estimation n'est ni juste ni
// fausse —, mais elle s'affichait sans dire sur combien de questions, à côté
// de chiffres qui comptaient tout : deux QCM et soixante-deux estimations
// faisaient lire « 1/64 justes » sur la carte, « 64 réponses, 1 juste » dans
// l'historique, et « Précision 50 % » au meilleur estimateur de la salle.
// Les estimations ont maintenant leur chiffre, le coup d'œil : la part de la
// salle qu'on bat ou qu'on égale, estimation après estimation. L'écart moyen
// en pour cent mesurait la question plus que le joueur — trois ans sur 1994
// font 0,15 %, trois sur 54 en font 6 % —, et une faute de frappe le triplait.
//
// Les dérivations s'appellent directement ; la carte et le recalcul de
// l'historique ont chacun leur serveur jetable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import type { AnswerRow } from '../src/core/answers'
import type { PlayerRec } from '../src/core/party'
import { relevesDeSoiree } from '../src/core/progress'
import { computeStats } from '../src/core/stats'
import { buildReview } from '../src/core/review'
import { exportFiles } from '../src/core/export'
import { decodeDetail } from '../src/auth/profiles'
import { carriereDe, ficheDe } from '../../shared/profil'
import type { PublicPlayer } from '../../shared/types'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  estimation,
  inscrireProfil,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'

// ── De quoi écrire une soirée ─────────────────────────────────────────────

let horloge = 1_000
/** Chaque ligne arrive après la précédente : l'ordre du journal compte. */
const tic = () => ++horloge

/** Une ligne du journal : par défaut, une bonne réponse à un QCM en 5 s. */
function ligne(playerId: string, extra: Partial<AnswerRow> = {}): AnswerRow {
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

const faux = (playerId: string, qIndex: number) => ligne(playerId, { qIndex, correct: false, choice: 1 })

/** Une estimation : `value` proposé pour `target`. */
const estime = (playerId: string, qIndex: number, value: number, target: number) =>
  ligne(playerId, { qIndex, kind: 'number', correct: null, choice: null, value, target })

/** Une estimation laissée passer. */
const passe = (playerId: string, qIndex: number, target: number) =>
  ligne(playerId, { qIndex, kind: 'number', answered: false, correct: null, choice: null, target, ms: null })

/** Un invité tel que le registre le garde — ce que lit le relevé. */
const inscrit = (id: string): PlayerRec => ({
  id,
  name: id,
  avatar: '🦊',
  token: `jeton-${id}`,
  teamId: null,
  profileId: `profil-${id}`,
  createdAt: tic(),
})

/** Un invité tel que les écrans le voient — ce que lisent le souvenir et le bilan. */
const joueur = (id: string, name: string, extra: Partial<PublicPlayer> = {}): PublicPlayer => ({
  id,
  name,
  avatar: '🦊',
  connected: false,
  score: 0,
  teamId: null,
  ...extra,
})

// ── 1. Le relevé et la fiche ──────────────────────────────────────────────

test('le coup d’œil : la part de la salle qu’une estimation bat ou égale — les ex æquo la partagent, seul on ne se mesure à personne', () => {
  const players = ['anne', 'basile', 'chloe'].map(inscrit)
  const answers = [
    // 100 à trouver : Anne et Basile pile, Chloé à 150. L'invité exclu est
    // pile aussi, mais il ne compte pour personne.
    estime('anne', 0, 100, 100),
    estime('basile', 0, 100, 100),
    estime('chloe', 0, 150, 100),
    estime('exclu', 0, 100, 100),
    // Anne est seule à proposer : sans personne à qui se mesurer, pas de coup d'œil.
    estime('anne', 1, 12, 10),
    passe('basile', 1, 10),
    passe('chloe', 1, 10),
    // Un QCM : Anne et Chloé trouvent.
    ligne('anne', { qIndex: 2 }),
    faux('basile', 2),
    ligne('chloe', { qIndex: 2 }),
    // 50 à trouver : Basile à 5, Anne et Chloé à 10 — l'exclu, pile, ne les
    // fait reculer ni l'un ni l'autre.
    estime('anne', 3, 40, 50),
    estime('basile', 3, 45, 50),
    estime('chloe', 3, 60, 50),
    estime('exclu', 3, 50, 50),
  ]
  const releves = relevesDeSoiree({ players, scores: [], answers })
  const chiffres = (id: string) => {
    const r = releves.get(id)!.releve
    return { estimations: r.estimations, comparees: r.estimationsComparees, coupDOeil: r.coupDOeil, qcm: r.qcm, justes: r.justes }
  }
  // Anne : pile à égalité (personne devant elle), puis une sur deux devant elle.
  assert.deepEqual(chiffres('anne'), { estimations: 3, comparees: 2, coupDOeil: 1 + 0.5, qcm: 1, justes: 1 })
  assert.deepEqual(chiffres('basile'), { estimations: 2, comparees: 2, coupDOeil: 1 + 1, qcm: 1, justes: 0 })
  assert.deepEqual(chiffres('chloe'), { estimations: 2, comparees: 2, coupDOeil: 0 + 0.5, qcm: 1, justes: 1 })
  assert.equal(releves.has('exclu'), false)
})

test('la fiche dit sur combien de QCM porte la précision, et mesure les estimations au coup d’œil', () => {
  // La soirée signalée, en petit : deux QCM, une bonne réponse… et six
  // estimations où elle bat toute la salle.
  const players = ['toi', 'bob', 'dora'].map(inscrit)
  const answers = [
    ligne('toi', { qIndex: 0 }),
    ligne('bob', { qIndex: 0 }),
    faux('dora', 0),
    faux('toi', 1),
    ligne('bob', { qIndex: 1 }),
    ligne('dora', { qIndex: 1 }),
    ...[2, 3, 4, 5, 6, 7].flatMap(q => [
      estime('toi', q, 1990 + q, 1990 + q),
      estime('bob', q, 1985 + q, 1990 + q),
      estime('dora', q, 2010 + q, 1990 + q),
    ]),
  ]
  const { releve, gain } = relevesDeSoiree({ players, scores: [], answers }).get('toi')!
  const fiche = ficheDe(carriereDe([{ releve, gain, spaceId: 'e1' }], { eclats: 0, niveau: 1 }))
  assert.equal(fiche.reponses, 8)
  assert.deepEqual([fiche.precision, fiche.justes, fiche.qcm], [0.5, 1, 2], '50 %, sur deux QCM : la fiche le dit')
  assert.deepEqual([fiche.coupDOeil, fiche.estimationsComparees], [1, 6], 'et elle a battu toute la salle, six fois')

  // Deux soirées s'additionnent estimation par estimation, pas soirée par soirée.
  const autre = relevesDeSoiree({ players, scores: [], answers }).get('bob')!
  const deux = ficheDe(carriereDe([{ releve, gain, spaceId: 'e1' }, { ...autre, spaceId: 'e1' }], { eclats: 0, niveau: 1 }))
  assert.deepEqual([deux.coupDOeil, deux.estimationsComparees], [(6 + 6 * 0.5) / 12, 12])

  // Une soirée rangée avant le coup d'œil, que rien ne peut plus relire, n'en
  // a pas : « — », jamais « 0 % ».
  const { estimationsComparees: _n, coupDOeil: _c, ...avant } = releve
  const relue = decodeDetail(JSON.stringify({ v: 5, gain, releve: avant })).releve
  assert.equal(relue.estimationsComparees, 0)
  const vieille = ficheDe(carriereDe([{ releve: relue, gain, spaceId: 'e1' }], { eclats: 0, niveau: 1 }))
  assert.equal(vieille.coupDOeil, null)
  assert.equal(vieille.precision, 0.5, 'la précision, elle, ne change pas')
})

// ── 2. Le souvenir, le bilan, l'export ────────────────────────────────────

const prix = (stats: ReturnType<typeof computeStats>, key: string) => stats.awards.find(a => a.key === key)

test('Le Devin va au meilleur coup d’œil : ni au retardataire qui n’a vu que les dates, ni au voisin d’une faute de frappe', () => {
  // Côme arrive pour les dates, et finit le plus loin de la salle à chaque
  // fois — mais onze ans sur 1789, c'est 0,6 % d'écart : à l'écart moyen,
  // Le Devin, c'était lui.
  const retard = computeStats(
    [
      estime('anne', 0, 50, 54),
      estime('basile', 0, 70, 54),
      estime('anne', 1, 200, 206),
      estime('basile', 1, 150, 206),
      estime('anne', 2, 1789, 1789),
      estime('basile', 2, 1795, 1789),
      estime('come', 2, 1800, 1789),
      estime('anne', 3, 1968, 1969),
      estime('basile', 3, 1972, 1969),
      estime('come', 3, 1980, 1969),
    ],
    [joueur('anne', 'Anne'), joueur('basile', 'Basile'), joueur('come', 'Côme')],
  )
  assert.deepEqual(
    retard.players.map(s => [s.name, s.coupDOeil, s.estimationsComparees]),
    [
      ['Anne', 1, 4],
      ['Basile', 0.25, 4],
      ['Côme', 0, 2],
    ],
  )
  assert.equal(prix(retard, 'devin')?.player?.name, 'Anne')
  assert.equal(prix(retard, 'devin')?.detail, '100 % de la salle battue ou égalée, sur 4 estimations')

  // Anne tape 19940 pour 1994, puis vise pile cinq fois ; Basile est à trois
  // ans à chaque fois. L'écart moyen donnait le prix à Basile.
  const faute = computeStats(
    [0, 1, 2, 3, 4, 5].flatMap(q => [
      estime('anne', q, q === 0 ? 19940 : 1994 + q, 1994 + q),
      estime('basile', q, 1997 + q, 1994 + q),
    ]),
    [joueur('anne', 'Anne'), joueur('basile', 'Basile')],
  )
  assert.equal(prix(faute, 'devin')?.player?.name, 'Anne')
  assert.equal(prix(faute, 'devin')?.detail, '83 % de la salle battue ou égalée, sur 6 estimations')
})

test('le bilan et l’export donnent le coup d’œil de chacun et de chaque équipe, à côté de la réussite aux QCM', () => {
  const teams = [
    { id: 'z', name: 'Les Zèbres', emoji: '🦓', position: 0 },
    { id: 'a', name: 'Les Aigles', emoji: '🦅', position: 1 },
  ]
  const joueurs = [
    joueur('zack', 'Zack', { teamId: 'z' }),
    joueur('zoe', 'Zoé', { teamId: 'z' }),
    joueur('anna', 'Anna', { teamId: 'a' }),
  ]
  const answers = [
    // 100 à trouver : Zack pile, Anna à 10, Zoé à 30.
    estime('zack', 0, 100, 100),
    estime('anna', 0, 110, 100),
    estime('zoe', 0, 130, 100),
    // 20 à trouver : Anna pile, Zoé à 2, Zack à 5.
    estime('zack', 1, 25, 20),
    estime('anna', 1, 20, 20),
    estime('zoe', 1, 22, 20),
    // Un QCM, que seule Zoé trouve.
    faux('zack', 2),
    ligne('zoe', { qIndex: 2 }),
    faux('anna', 2),
  ]
  const review = buildReview({ rows: answers, players: joueurs, teams, bonuses: [], packsBySession: new Map(), library: [] })
  const stat = (id: string) => review.players.find(p => p.id === id)!.stat
  assert.deepEqual(
    [stat('zack').coupDOeil, stat('anna').coupDOeil, stat('zoe').coupDOeil],
    [(1 + 0) / 2, (0.5 + 1) / 2, (0 + 0.5) / 2],
  )
  const equipe = (id: string) => review.teams.find(t => t.id === id)!
  assert.equal(equipe('z').coupDOeil, (1 + 0 + 0 + 0.5) / 4, 'les quatre estimations des Zèbres, mises ensemble')
  assert.equal(equipe('a').coupDOeil, 0.75)
  assert.equal(equipe('z').accuracy, 0.5, 'la réussite, elle, reste celle des QCM')

  const tableau = (nom: string) =>
    exportFiles(review)
      .find(f => f.name === nom)!
      .content.replace(/^﻿/, '')
      .trim()
      .split('\r\n')
      .map(l => l.split(';'))
  const [entete, ...invites] = tableau('invites.csv')
  const colonne = entete.indexOf('Coup d’œil')
  assert.ok(colonne > 0, 'une colonne pour le coup d’œil')
  assert.deepEqual(
    invites.map(l => [l[0], l[colonne]]),
    [
      ['Anna', '75 %'],
      ['Zack', '50 %'],
      ['Zoé', '25 %'],
    ],
  )
  const [enteteEquipes, ...equipes] = tableau('equipes.csv')
  const colonneEquipes = enteteEquipes.indexOf('Coup d’œil')
  assert.ok(colonneEquipes > 0)
  assert.deepEqual(
    equipes.map(l => [l[0], l[colonneEquipes]]).sort(),
    [
      ['🦅 Les Aigles', '75 %'],
      ['🦓 Les Zèbres', '38 %'],
    ],
  )
})

// ── 3. La carte, et l'historique ──────────────────────────────────────────

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

/** Ce que chacun répond : un numéro de réponse pour un QCM, un nombre pour une estimation. */
type Reponses = [Invite, { choice: number } | { value: number }][][]

/** Joue un quiz de bout en bout depuis l'écran commun, jusqu'à son podium. */
async function jouerQuiz(host: Socket, quizId: string, questions: Reponses): Promise<string> {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, reponse] of questions[q]) {
      const action = 'choice' in reponse ? { type: 'answer', ...reponse } : { type: 'guess', ...reponse }
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action })
      assert.equal(ack.ok, true, `réponse ${q + 1} refusée : ${ack.error}`)
    }
    await revelee
    suivante =
      q + 1 < questions.length
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  return sessionId
}

const permanente = (banc: Banc) => banc.quizDbUrl.replace(/^file:/, '')

const moi = async (banc: Banc, cookie: string) =>
  ((await (await fetch(`${banc.url}/api/joueur/moi`, { headers: { Cookie: cookie } })).json()) as any).profile

test('la carte compte les estimations à part : « 1/1 justes », jamais « 1/2 »', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('On y est ?'), estimation('Combien de marches à la tour Eiffel ?', 1665)])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    const dora = await invite(banc.url, 'Dora', '🐙')

    const credit = attendre<any>(alice.socket, 'player:profil', p => p.xp > 0, 'le crédit du podium', 15_000)
    await jouerQuiz(host, quiz, [
      [
        [alice, { choice: 0 }],
        [bob, { choice: 1 }],
        [dora, { choice: 1 }],
      ],
      [
        [alice, { value: 1665 }],
        [bob, { value: 1500 }],
        [dora, { value: 300 }],
      ],
    ])
    await credit

    const carte = async (id: string) => (await (await fetch(`${banc.url}/s/${ADMIN.slug}/joueurs/${id}.json`)).json()) as any
    const deBob = await carte(bob.playerId)
    // Une estimation n'est jamais « juste » : comptée avec les QCM, elle
    // faisait lire « 0/2 justes » à Bob, deuxième de la salle sur elle — et
    // son coup d'œil le dit, anonyme ou non.
    assert.deepEqual(
      [deBob.ceSoir.qcm, deBob.ceSoir.justes, deBob.ceSoir.estimations, deBob.ceSoir.reponses, deBob.ceSoir.coupDOeil],
      [1, 0, 1, 2, 0.5],
    )

    const dAlice = await carte(alice.playerId)
    assert.deepEqual([dAlice.ceSoir.qcm, dAlice.ceSoir.justes, dAlice.ceSoir.estimations], [1, 1, 1])
    const { fiche } = dAlice.profil
    assert.deepEqual([fiche.precision, fiche.justes, fiche.qcm], [1, 1, 1], 'la précision, avec sa base')
    assert.deepEqual([fiche.coupDOeil, fiche.estimationsComparees], [1, 1], 'et le coup d’œil : pile, devant toute la salle')
    assert.equal(fiche.meilleureSerie, 1, 'les pages d’avant la lisent encore')
  }))

test('au démarrage, une soirée rangée avant le coup d’œil se relit, et la fiche le montre', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [
      estimation('En quelle année la Bastille est-elle tombée ?', 1789),
      estimation('Combien d’os dans le corps humain ?', 206),
    ])
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)
    const alice = await invite(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bob = await invite(banc.url, 'Bob', '🐻')
    const dora = await invite(banc.url, 'Dora', '🐙')
    await jouerQuiz(host, quiz, [
      [
        [alice, { value: 1789 }],
        [bob, { value: 1800 }],
        [dora, { value: 1750 }],
      ],
      [
        [alice, { value: 250 }],
        [bob, { value: 210 }],
        [dora, { value: 100 }],
      ],
    ])
    const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await toast).kind, 'info')
    // Alice : pile sur la Bastille, puis derrière Bob sur les os.
    const attendu = { coupDOeil: (1 + 0.5) / 2, estimationsComparees: 2 }
    const fiche = async () => {
      const { coupDOeil, estimationsComparees } = (await moi(banc, aliceCookie)).fiche
      return { coupDOeil, estimationsComparees }
    }
    assert.deepEqual(await fiche(), attendu)

    // On remonte le temps : la ligne de cette soirée a été écrite par la
    // version d'avant, qui ne savait rien du coup d'œil.
    const db = new Database(permanente(banc))
    try {
      for (const { soiree_id, detail } of db.prepare('SELECT soiree_id, detail FROM profile_xp WHERE soiree_id NOT LIKE ?').all('#%') as any[]) {
        const avant = JSON.parse(detail)
        delete avant.releve.estimationsComparees
        delete avant.releve.coupDOeil
        db.prepare('UPDATE profile_xp SET detail = ? WHERE soiree_id = ?').run(JSON.stringify({ ...avant, v: 5 }), soiree_id)
      }
    } finally {
      db.close()
    }
    await patienter(50)
    await banc.redemarrer()
    assert.deepEqual(await fiche(), attendu, 'relue au démarrage, la soirée dit son coup d’œil')
  }))

test('un prix départagé au prénom le dit : les ex æquo sont nommés, la règle ne change pas', () => {
  // Chez Léa, le 24 septembre : Le Pile-Poil à Liam, à égalité avec Zoé et
  // Malik — « L » vient avant « M » et « Z », et personne ne le savait. La
  // règle reste (le prix ne change pas de mains à chaque rechargement) ;
  // la carte du prix nomme maintenant ceux qu'il a départagés.
  const stats = computeStats(
    [
      estime('zoe', 0, 42, 42),
      estime('liam', 0, 42, 42),
      estime('malik', 0, 42, 42),
      estime('anne', 0, 50, 42),
    ],
    [joueur('zoe', 'Zoé'), joueur('liam', 'Liam'), joueur('malik', 'Malik'), joueur('anne', 'Anne')],
  )
  const pilePoil = prix(stats, 'pilepoil')
  assert.equal(pilePoil?.player?.name, 'Liam', 'la règle du prénom tient toujours')
  assert.deepEqual(pilePoil?.exAequo, ['Malik', 'Zoé'])

  // Seul en tête : rien à dire.
  const seul = computeStats(
    [estime('zoe', 0, 42, 42), estime('liam', 0, 40, 42)],
    [joueur('zoe', 'Zoé'), joueur('liam', 'Liam')],
  )
  assert.equal(prix(seul, 'pilepoil')?.player?.name, 'Zoé')
  assert.equal(prix(seul, 'pilepoil')?.exAequo, undefined)
})

test('les prix d’équipe départagés en silence le disent aussi : Le Coup de Pouce au prénom, La Plus Solidaire au classement', () => {
  // Le README promet que « la carte du prix le dit » : les deux prix
  // d'équipe tranchaient encore sans un mot. La règle ne change pas.
  // Les points d'un prix d'équipe sont ceux du classement de la soirée.
  const membre = (id: string, name: string, teamId: string, score: number) => joueur(id, name, { teamId, score })
  const stats = computeStats(
    [ligne('bob'), ligne('liam'), ligne('anne'), ligne('zoe'), ligne('paul'), ligne('yann')],
    [
      // Cinq points d'écart chez les Salseras comme chez les Rumberos : ceux
      // de Bob, mieux classé qu'Anne, gardent La Plus Solidaire.
      membre('anne', 'Anne', 'salseras', 5),
      membre('zoe', 'Zoé', 'salseras', 0),
      membre('bob', 'Bob', 'rumberos', 6),
      membre('liam', 'Liam', 'rumberos', 1),
      membre('paul', 'Paul', 'micros', 0),
      membre('yann', 'Yann', 'micros', 9),
    ],
  )
  const pouce = prix(stats, 'coupdepouce')
  assert.equal(pouce?.teamId, 'micros', 'Paul ferme la marche, avant Zoé à l’alphabet')
  assert.deepEqual(pouce?.exAequo, ['Zoé'])

  const solidaire = prix(stats, 'solidaire')
  assert.equal(solidaire?.teamId, 'rumberos', 'la règle d’avant : la première équipe rencontrée au classement')
  assert.deepEqual(solidaire?.exAequoEquipes, ['salseras'], 'les Micros, à 9 points d’écart, ne sont pas à égalité')
  assert.equal(solidaire?.departage, 'classement')

  // Un coéquipier à égalité ne départage rien : le prix va à la même équipe.
  const memeEquipe = computeStats(
    [ligne('bob'), ligne('liam'), ligne('lea'), ligne('anne'), ligne('zoe')],
    [
      membre('bob', 'Bob', 'rumberos', 5),
      membre('liam', 'Liam', 'rumberos', 0),
      membre('lea', 'Léa', 'rumberos', 0),
      membre('anne', 'Anne', 'salseras', 3),
      membre('zoe', 'Zoé', 'salseras', 1),
    ],
  )
  assert.equal(prix(memeEquipe, 'coupdepouce')?.exAequo, undefined)
  assert.equal(prix(memeEquipe, 'solidaire')?.teamId, 'salseras')
  assert.equal(prix(memeEquipe, 'solidaire')?.exAequoEquipes, undefined)
})
