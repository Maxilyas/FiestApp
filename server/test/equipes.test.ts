// Le verdict des équipes, et la règle unique qui le rend.
//
// Chez Léa, les invités avaient gagné le quiz ; Inès arrive après, choisit
// leur équipe à 0 point, et la moyenne tombe de 1 280 à 640 : l'écran de
// victoire couronne l'autre équipe, et l'historique l'aurait gardé. Chez
// Nadia, Karim arrive à la deuxième question et fait baisser la moyenne des
// Randonneurs pour une question qu'il n'a jamais vue. Et le bilan, lui,
// divisait par les présents au quiz : deux règles, deux vainqueurs possibles.
//
// Une seule règle désormais (`shared/teams.ts`) : pour chaque question, la
// moyenne des membres qui y ont une ligne au journal des réponses, et la
// moyenne de l'équipe est la somme de ces moyennes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  emitAck,
  instantane,
  invite,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import * as equipes from '../../shared/teams'
import { buildReview } from '../src/core/review'
import { buildRecap } from '../src/core/recap'
import { exportFiles } from '../src/core/export'
import { computeStats } from '../src/core/stats'
import type { AnswerRow } from '../src/core/answers'
import type { PublicPlayer } from '../../shared/types'

// ── Outils ────────────────────────────────────────────────────────────────

async function avecBanc(scenario: (banc: Banc) => Promise<void>) {
  const banc = await demarrer()
  try {
    await scenario(banc)
  } finally {
    await banc.close()
  }
}

/**
 * Un quiz joué de bout en bout : chacun répond à chaque question, puis
 * « Terminer le quiz ». Un invité qui ne répond pas n'attend pas le
 * chronomètre : « Révéler », qui vise la question, ne fait rien si elle
 * s'est déjà révélée. `avant` joue un geste pendant la question, avant les
 * réponses ; `apres`, pendant sa révélation.
 */
async function jouerQuiz(
  host: Socket,
  quizId: string,
  questions: [Invite, number][][],
  avant?: (q: number) => Promise<void>,
  apres?: (q: number, sessionId: string) => Promise<void>,
): Promise<void> {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    await avant?.(q)
    for (const [qui, choice] of questions[q]) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
      assert.equal(ack.ok, true, `réponse ${q + 1} refusée : ${ack.error}`)
    }
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next', phase: 'question', qIndex: q } })
    await revelee
    await apres?.(q, sessionId)
    suivante =
      q + 1 < questions.length
        ? vue(sessionId, v => v.phase === 'question' && v.qIndex === q + 1, `la question ${q + 2}`)
        : vue(sessionId, v => v.phase === 'finished', 'le podium')
    ;(host as any).emit('host:command', { sessionId, command: { type: 'next' } })
  }
  await suivante
  ;(host as any).emit('host:endSession', { sessionId })
}

async function lire(banc: Banc, chemin: string): Promise<any> {
  const res = await fetch(`${banc.url}/s/${ADMIN.slug}/${chemin}`)
  assert.equal(res.status, 200, chemin)
  return res.json()
}

const moyennes = (teams: { name: string; average: number }[]) =>
  Object.fromEntries(teams.map(t => [t.name, t.average]))

let horloge = 1_000
const tic = () => ++horloge

function joueur(id: string, name: string, teamId: string | null, score = 0): PublicPlayer {
  return { id, name, avatar: '🦊', connected: true, score, teamId }
}

function ligne(playerId: string, qIndex: number, points: number, extra: Partial<AnswerRow> = {}): AnswerRow {
  return {
    sessionId: 's1',
    quizTitle: 'Quiz',
    qIndex,
    kind: 'choice',
    playerId,
    answered: points > 0,
    correct: points > 0 ? true : null,
    choice: points > 0 ? 0 : null,
    value: null,
    target: null,
    ms: points > 0 ? 3_000 : null,
    changes: 0,
    points,
    durationMs: 20_000,
    observed: false,
    createdAt: tic(),
    ...extra,
  }
}

// ── 1. Le verdict d'un quiz joué ne bouge plus ───────────────────────────

test('un invité qui rejoint une équipe après le quiz ne change ni sa moyenne ni le vainqueur — salle, souvenir, bilan, historique', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
    const host = await ecranCommun(banc.url, cookie)
    ;(host as any).emit('host:createTeam', { name: 'Les invités', emoji: '🎁' })
    ;(host as any).emit('host:createTeam', { name: 'La coloc', emoji: '🏠' })
    const snap = await instantane<any>(host, s => s.teams.length === 2, 'les deux équipes')
    const idDe = (nom: string) => snap.teams.find((t: any) => t.name === nom).id as string
    const liam = await invite(banc.url, 'Liam', '🦁')
    const zoe = await invite(banc.url, 'Zoé', '🐼')
    const malik = await invite(banc.url, 'Malik', '🐯')
    ;(host as any).emit('host:assignPlayer', { playerId: liam.playerId, teamId: idDe('Les invités') })
    ;(host as any).emit('host:assignPlayer', { playerId: zoe.playerId, teamId: idDe('La coloc') })
    ;(host as any).emit('host:assignPlayer', { playerId: malik.playerId, teamId: idDe('La coloc') })
    await instantane<any>(host, s => s.players.filter((p: any) => p.teamId).length === 3, 'les trois rangés')

    await jouerQuiz(host, quiz, [
      [[liam, 0], [zoe, 0], [malik, 1]],
      [[liam, 0], [zoe, 1], [malik, 1]],
    ])
    await patienter(300)
    const avant = await instantane<any>(host, s => !s.session && s.teams.some((t: any) => t.average > 0), 'le quiz fini')
    const vainqueurs = equipes.vainqueursDuQuiz(avant.teams).map(t => t.name)
    assert.deepEqual(vainqueurs, ['Les invités'], 'Liam a tout juste, la coloc à moitié')

    // Inès arrive après le quiz, et choisit l'équipe des invités.
    const ines = await invite(banc.url, 'Inès', '🐰')
    ;(host as any).emit('host:assignPlayer', { playerId: ines.playerId, teamId: idDe('Les invités') })
    const apres = await instantane<any>(
      host,
      s => s.players.some((p: any) => p.id === ines.playerId && p.teamId),
      'Inès dans l’équipe des invités',
    )
    assert.equal(apres.teams.find((t: any) => t.name === 'Les invités').memberCount, 2, 'elle en est bien membre')
    assert.deepEqual(moyennes(apres.teams), moyennes(avant.teams), 'la salle : les moyennes n’ont pas bougé')
    assert.deepEqual(equipes.vainqueursDuQuiz(apres.teams).map(t => t.name), vainqueurs, 'la salle : le même vainqueur')

    // Le souvenir et le bilan, pendant la soirée : la même règle.
    assert.deepEqual(moyennes((await lire(banc, 'recap.json')).teams), moyennes(avant.teams), 'le souvenir')
    assert.deepEqual(moyennes((await lire(banc, 'bilan.json')).teams), moyennes(avant.teams), 'le bilan')

    // Et l'historique, une fois la soirée close.
    const cloture = attendre<any>(host, 'soiree:cloture', () => true, 'l’écran de clôture', 15_000)
    const close = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
    ;(host as any).emit('host:closeParty', {})
    assert.equal((await close).kind, 'info')
    assert.deepEqual(
      (await cloture).equipes.map((t: any) => t.nom),
      vainqueurs,
      'l’écran de clôture annonce l’équipe qui l’emporte',
    )
    const { archives } = await lire(banc, 'soirees.json')
    assert.deepEqual(
      archives[0].teamWinners.map((t: any) => t.name),
      vainqueurs,
      'l’historique garde le vainqueur annoncé',
    )
    const soiree = archives[0].id
    assert.deepEqual(moyennes((await lire(banc, `soirees/${soiree}/recap.json`)).teams), moyennes(avant.teams), 'le souvenir archivé')
    assert.deepEqual(moyennes((await lire(banc, `soirees/${soiree}/bilan.json`)).teams), moyennes(avant.teams), 'le bilan archivé')
  }))

// ── 1 bis. L'équipe figée à chaque ligne du journal ─────────────────────

/** Deux équipes, trois joueurs rangés, et Inès connectée sans équipe. */
async function laSoireeDeLea(banc: Banc) {
  const cookie = await connexionAnimateur(banc.url)
  const quiz = await creerQuiz(banc.url, cookie, [qcm('Un ?'), qcm('Deux ?')])
  const host = await ecranCommun(banc.url, cookie)
  ;(host as any).emit('host:createTeam', { name: 'Les invités', emoji: '🎁' })
  ;(host as any).emit('host:createTeam', { name: 'La coloc', emoji: '🏠' })
  const snap = await instantane<any>(host, s => s.teams.length === 2, 'les deux équipes')
  const idDe = (nom: string) => snap.teams.find((t: any) => t.name === nom).id as string
  const liam = await invite(banc.url, 'Liam', '🦁')
  const zoe = await invite(banc.url, 'Zoé', '🐼')
  const malik = await invite(banc.url, 'Malik', '🐯')
  const ines = await invite(banc.url, 'Inès', '🐰')
  const ranger = async (qui: Invite, equipe: string | null) => {
    const teamId = equipe && idDe(equipe)
    ;(host as any).emit('host:assignPlayer', { playerId: qui.playerId, teamId })
    await instantane<any>(host, s => s.players.some((p: any) => p.id === qui.playerId && p.teamId === teamId), 'le rangement')
  }
  await ranger(liam, 'Les invités')
  await ranger(zoe, 'La coloc')
  await ranger(malik, 'La coloc')
  return { cookie, quiz, host, idDe, liam, zoe, malik, ines, ranger }
}

/** L'équipe que chaque ligne du journal a figée, lue dans la base locale. */
function equipesAuJournal(banc: Banc, playerId: string): (string | null)[] {
  const db = new Database(banc.dbPath, { readonly: true })
  try {
    return (
      db.prepare('SELECT team_id FROM answer_log WHERE player_id = ? ORDER BY created_at, q_index').all(playerId) as {
        team_id: string | null
      }[]
    ).map(r => r.team_id)
  } finally {
    db.close()
  }
}

test('un déménagement après le quiz ne retourne plus son verdict — ni Inès, connectée sans équipe, ni Malik, qui change de camp', () =>
  avecBanc(async banc => {
    const { quiz, host, idDe, liam, zoe, malik, ines, ranger } = await laSoireeDeLea(banc)
    // Liam et Zoé ont tout juste, Malik tout faux ; Inès, là sans équipe, ne répond pas.
    await jouerQuiz(host, quiz, [
      [[liam, 0], [zoe, 0], [malik, 1]],
      [[liam, 0], [zoe, 0], [malik, 1]],
    ])
    await patienter(300)
    const avant = await instantane<any>(host, s => !s.session && s.teams.some((t: any) => t.average > 0), 'le quiz fini')
    const vainqueurs = equipes.vainqueursDuQuiz(avant.teams).map(t => t.name)
    assert.deepEqual(vainqueurs, ['Les invités'])
    assert.deepEqual(equipesAuJournal(banc, ines.playerId), ['', ''], 'Inès a ses lignes, sans équipe')
    assert.deepEqual(equipesAuJournal(banc, malik.playerId), [idDe('La coloc'), idDe('La coloc')])

    // (a) Inès rejoint les invités : sa ligne à 0 ne compte pour aucune équipe.
    await ranger(ines, 'Les invités')
    const a = await instantane<any>(host, s => s.teams.find((t: any) => t.name === 'Les invités').memberCount === 2, 'Inès rangée')
    assert.deepEqual(moyennes(a.teams), moyennes(avant.teams), 'Inès ne fait pas tomber les invités')
    assert.deepEqual(equipes.vainqueursDuQuiz(a.teams).map(t => t.name), vainqueurs)

    // (b) Malik passe aux invités : ses points restent à la coloc.
    await ranger(malik, 'Les invités')
    const b = await instantane<any>(host, s => s.teams.find((t: any) => t.name === 'Les invités').memberCount === 3, 'Malik déménagé')
    assert.deepEqual(moyennes(b.teams), moyennes(avant.teams), 'le déménagement de Malik ne change rien au quiz joué')
    assert.deepEqual(equipes.vainqueursDuQuiz(b.teams).map(t => t.name), vainqueurs)
    assert.deepEqual(moyennes((await lire(banc, 'recap.json')).teams), moyennes(avant.teams), 'le souvenir')
    assert.deepEqual(moyennes((await lire(banc, 'bilan.json')).teams), moyennes(avant.teams), 'le bilan')

    // Le disque effacé : le miroir rend le journal avec ses équipes.
    await banc.redemarrer({ disqueEfface: true })
    assert.deepEqual(equipesAuJournal(banc, ines.playerId), ['', ''], 'restaurée : Inès toujours sans équipe')
    assert.deepEqual(equipesAuJournal(banc, malik.playerId), [idDe('La coloc'), idDe('La coloc')], 'restaurée : Malik à la coloc')
    const host2 = await ecranCommun(banc.url, await connexionAnimateur(banc.url))
    const reveil = await instantane<any>(host2, s => s.teams.length === 2 && s.players.length === 4, 'la soirée restaurée')
    assert.deepEqual(moyennes(reveil.teams), moyennes(avant.teams), 'le verdict survit au disque effacé')
  }))

test('un membre qui change d’équipe entre deux quiz, ou pendant une question, compte pour celle où il était quand la ligne s’écrit', () =>
  avecBanc(async banc => {
    const { quiz, host, idDe, liam, zoe, malik, ranger } = await laSoireeDeLea(banc)
    await jouerQuiz(host, quiz, [
      [[liam, 0], [zoe, 0], [malik, 0]],
      [[liam, 0], [zoe, 0], [malik, 0]],
    ])
    await patienter(300)
    const bilan1 = await lire(banc, 'bilan.json')
    const quiz1 = (b: any) => Object.fromEntries(b.teams.map((t: any) => [t.name, t.perQuiz[0].average]))

    // Entre deux quiz, Malik passe aux invités ; au second, Zoé les rejoint
    // pendant la première question, avant d'y répondre.
    await ranger(malik, 'Les invités')
    await jouerQuiz(
      host,
      quiz,
      [
        [[liam, 0], [zoe, 0], [malik, 1]],
        [[liam, 0], [zoe, 0], [malik, 1]],
      ],
      async q => {
        if (q === 0) await ranger(zoe, 'Les invités')
      },
    )
    await patienter(300)
    assert.deepEqual(equipesAuJournal(banc, malik.playerId), [idDe('La coloc'), idDe('La coloc'), idDe('Les invités'), idDe('Les invités')])
    assert.deepEqual(equipesAuJournal(banc, zoe.playerId), [idDe('La coloc'), idDe('La coloc'), idDe('Les invités'), idDe('Les invités')])

    // Tout le monde retourne à la coloc : rien ne bouge, ni au premier quiz ni au second.
    const bilan2 = await lire(banc, 'bilan.json')
    assert.deepEqual(quiz1(bilan2), quiz1(bilan1), 'le premier quiz garde son verdict')
    await ranger(liam, 'La coloc')
    await ranger(zoe, 'La coloc')
    await ranger(malik, 'La coloc')
    await patienter(300)
    const bilan3 = await lire(banc, 'bilan.json')
    assert.deepEqual(moyennes(bilan3.teams), moyennes(bilan2.teams), 'la soirée entière garde ses moyennes')
    const coloc = bilan3.teams.find((t: any) => t.name === 'La coloc')
    const invites = bilan3.teams.find((t: any) => t.name === 'Les invités')
    assert.equal(invites.perQuiz[0].average, bilan1.teams.find((t: any) => t.name === 'Les invités').perQuiz[0].average)
    assert.equal(coloc.perQuiz[1].average, 0, 'au second quiz, la coloc n’avait plus personne')
    assert.ok(invites.perQuiz[1].average > 0, 'et les invités ont joué pour eux trois')
  }))

test('la mémoire du journal reste d’accord avec la base : question annulée, invité exclu, redémarrage', () =>
  avecBanc(async banc => {
    const { quiz, host, liam, zoe, malik } = await laSoireeDeLea(banc)
    const annulee = attendre<any>(host, 'session:view', p => p.view.phase === 'reveal' && p.view.cancelled, 'la question annulée', 15_000)
    await jouerQuiz(
      host,
      quiz,
      [
        [[liam, 0], [zoe, 0], [malik, 1]],
        [[liam, 0], [zoe, 0], [malik, 0]],
      ],
      undefined,
      async (q, sessionId) => {
        if (q !== 1) return
        // Un instantané part avec la question 2 : la mémoire la tient.
        await instantane<any>(host, s => s.teams.some((t: any) => t.average > 0), 'la question 2 comptée')
        await patienter(400)
        // Malik avait enfin trouvé : l'animateur annule la question.
        ;(host as any).emit('host:command', { sessionId, command: { type: 'cancel', phase: 'reveal', qIndex: 1 } })
        await annulee
      },
    )
    await patienter(300)
    /** L'instantané (la mémoire) face au bilan, relu en base. */
    const accord = async (ecran: Socket, pred: (s: any) => boolean, quoi: string) => {
      const salle = await instantane<any>(ecran, pred, quoi)
      const base = moyennes((await lire(banc, 'bilan.json')).teams)
      assert.deepEqual(moyennes(salle.teams), base, `${quoi} : la salle lit ce que dit la base`)
      return base
    }
    const apresAnnulation = await accord(host, s => !s.session, 'après l’annulation')
    assert.equal((await lire(banc, 'bilan.json')).questions.length, 1, 'la question 2 ne compte plus')
    assert.ok(apresAnnulation['La coloc'] > 0)

    ;(host as any).emit('host:removePlayer', { playerId: zoe.playerId })
    const apresExclusion = await accord(host, s => s.players.length === 3, 'après l’exclusion de Zoé')
    assert.equal(apresExclusion['La coloc'], 0, 'il ne reste à la coloc que Malik, qui n’a rien marqué')

    await banc.redemarrer()
    const reveil = await accord(await ecranCommun(banc.url, await connexionAnimateur(banc.url)), s => s.players.length === 3, 'après le redémarrage')
    assert.deepEqual(reveil, apresExclusion)
  }))

test('une ligne d’avant la colonne retombe sur la composition du moment ; une ligne sans équipe ne compte pour aucune', () => {
  const players = [joueur('liam', 'Liam', 'inv'), joueur('ines', 'Inès', 'inv')]
  const lignes = [
    { playerId: 'liam', sessionId: 's', qIndex: 0, points: 200 },
    { playerId: 'ines', sessionId: 's', qIndex: 0, points: 0, teamId: null },
    { playerId: 'liam', sessionId: 's', qIndex: 1, points: 100, teamId: 'coloc' },
  ]
  const q = equipes.questionsDesEquipes(players, lignes)
  assert.deepEqual(q.get('inv'), [{ presents: 1, points: 200 }], 'Inès, sans équipe à la question 1, n’y pèse pas')
  assert.deepEqual(q.get('coloc'), [{ presents: 1, points: 100 }], 'la question 2, jouée pour la coloc, y reste')
})

// ── 2. La règle, chiffrée ────────────────────────────────────────────────

test('la moyenne d’une équipe se fait question par question, entre les membres qui y étaient', () => {
  // Chez Nadia : Sofia et Hugo jouent la question 1 (200 et 164) ; Karim
  // arrive à la question 2, que les trois jouent (100, 100, 100) ; Inès
  // choisit l'équipe après le quiz, sans une question jouée.
  const teams = [{ id: 'rando', name: 'Les Randonneurs', emoji: '🥾', position: 0 }]
  const players = [
    joueur('sofia', 'Sofia', 'rando', 300),
    joueur('hugo', 'Hugo', 'rando', 264),
    joueur('karim', 'Karim', 'rando', 100),
    joueur('ines', 'Inès', 'rando', 0),
  ]
  const q1 = [ligne('sofia', 0, 200), ligne('hugo', 0, 164)]
  const q2 = [ligne('sofia', 1, 100), ligne('hugo', 1, 100), ligne('karim', 1, 100)]

  const apresQ1 = equipes.teamScores(teams, players, [], equipes.questionsDesEquipes(players, q1))[0]
  assert.equal(apresQ1.average, 182, 'Karim et Inès n’ont rien joué : ni l’un ni l’autre ne pèse sur la question 1')
  assert.equal(apresQ1.memberCount, 4, 'ils restent membres')

  const apresQ2 = equipes.teamScores(teams, players, [], equipes.questionsDesEquipes(players, [...q1, ...q2]))[0]
  assert.equal(apresQ2.average, 282, '182 à la question 1, 100 à la question 2')
  assert.equal(apresQ2.total, 664, 'le total, lui, reste la somme des points de chacun')

  // Une équipe dont tout le monde joue tout : la moyenne par membre d'avant.
  const pleine = equipes.teamScores(
    teams,
    players.slice(0, 2),
    [],
    equipes.questionsDesEquipes(players.slice(0, 2), [...q1, ...q2.slice(0, 2)]),
  )[0]
  assert.equal(pleine.average, Math.round((300 + 264) / 2))
})

test('deux équipes exactement ex æquo à ,5 le restent : la virgule flottante ne les sépare plus', () => {
  // Les Aigles, deux membres, 10 825 points sur 11 questions ; les Zèbres,
  // six membres, 32 475 : 5 412,5 de moyenne chacune. Les sixièmes, additionnés
  // en virgule flottante, faisaient 5 412,4999… : 5 413 contre 5 412.
  const zebres = [2504, 1921, 1385, 4569, 2649, 2322, 4705, 250, 3808, 3851, 4511]
  const aigles = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 825]
  assert.equal(zebres.reduce((a, b) => a + b), 32_475)
  assert.equal(aigles.reduce((a, b) => a + b), 10_825)
  const z = equipes.moyenneAuProrata(zebres.map(points => ({ presents: 6, points })))
  const a = equipes.moyenneAuProrata(aigles.map(points => ({ presents: 2, points })))
  assert.equal(z, a, 'la même moyenne, au point près')
  const teams = [
    { id: 'a', name: 'Les Aigles', emoji: '🦅', position: 0, memberCount: 2, total: 10_825, average: a, bonus: 0 },
    { id: 'z', name: 'Les Zèbres', emoji: '🦓', position: 1, memberCount: 6, total: 32_475, average: z, bonus: 0 },
  ]
  assert.deepEqual(equipes.vainqueursDuQuiz(teams).map(t => t.id), ['a', 'z'], 'elles gagnent ensemble')
})

test('le bilan classe chaque quiz avec la même règle que la salle', () => {
  const teams = [
    { id: 'rando', name: 'Les Randonneurs', emoji: '🥾', position: 0, createdAt: 1 },
    { id: 'guit', name: 'Les Guitaristes', emoji: '🎸', position: 1, createdAt: 1 },
  ]
  const players = [
    joueur('sofia', 'Sofia', 'rando', 300),
    joueur('karim', 'Karim', 'rando', 100),
    joueur('lucas', 'Lucas', 'guit', 250),
  ]
  const rows = [
    ligne('sofia', 0, 200),
    ligne('lucas', 0, 150),
    ligne('sofia', 1, 100),
    ligne('karim', 1, 100),
    ligne('lucas', 1, 100),
  ]
  const review = buildReview({ rows, players, teams, bonuses: [], packsBySession: new Map(), library: [] })
  const rando = review.teams.find(t => t.id === 'rando')!
  assert.equal(rando.average, 300, 'la soirée : 200 puis 100')
  assert.equal(rando.perQuiz[0].average, 300, 'le quiz : la même règle, pas 400 / 2')
  assert.equal(review.quizzes[0].teamWinners[0].teamId, 'rando')
  const recap = buildRecap({ players, teams, bonuses: [], scores: [], answers: rows })
  assert.deepEqual(moyennes(recap.teams), moyennes(review.teams), 'le souvenir dit la même chose')
})

// ── 3. Les prix ──────────────────────────────────────────────────────────

test('un prix d’honneur à 0 point se remet, et ne change aucun classement', () =>
  avecBanc(async banc => {
    const cookie = await connexionAnimateur(banc.url)
    const host = await ecranCommun(banc.url, cookie)
    ;(host as any).emit('host:createTeam', { name: 'Les Carbonara', emoji: '🍝' })
    const snap = await instantane<any>(host, s => s.teams.length === 1, 'l’équipe')
    const refus = attendre<any>(host, 'toast', () => true, 'un refus', 1_500).catch(() => null)
    ;(host as any).emit('host:awardTeam', { teamId: snap.teams[0].id, points: 0, reason: 'Pour l’honneur' })
    const remis = await instantane<any>(host, s => s.bonuses.length === 1, 'le prix d’honneur')
    assert.equal(remis.bonuses[0].points, 0)
    assert.equal(remis.teams[0].bonus, 0)
    assert.equal(await refus, null, 'aucun message d’erreur')
  }))

test('l’effet d’un prix se dit avant de cliquer', () => {
  const t = (id: string, name: string, emoji: string, average: number, bonus = 0) => ({
    id,
    name,
    emoji,
    position: 0,
    memberCount: 2,
    total: average * 2,
    average,
    bonus,
  })
  // Chez Nadia : Arrabbiata 3, Guitaristes 2, Randonneurs 1.
  const salle = [
    t('arra', 'Arrabbiata', '🍝', 1002),
    t('guit', 'Guitaristes', '🎸', 944),
    t('rando', 'Randonneurs', '🥾', 733),
  ]
  assert.equal(equipes.effetDUnPrix(salle, 'guit', 1), '+1 pour 🎸 Guitaristes → à égalité en tête avec 🍝 Arrabbiata')
  assert.equal(equipes.effetDUnPrix(salle, 'guit', 2), '+2 pour 🎸 Guitaristes → prend la tête')
  assert.equal(equipes.effetDUnPrix(salle, 'arra', 1), '+1 pour 🍝 Arrabbiata → toujours en tête')
  assert.equal(equipes.effetDUnPrix(salle, 'rando', 1), '+1 pour 🥾 Randonneurs → à égalité avec 🎸 Guitaristes, 2ᵉ')
  assert.equal(equipes.effetDUnPrix(salle, 'arra', -2), '−2 pour 🍝 Arrabbiata → cède la tête à 🎸 Guitaristes')
  assert.equal(equipes.effetDUnPrix(salle, 'rando', 0), 'Pour l’honneur : aucun point d’équipe, aucun classement ne bouge')
  // Arrondi comme le serveur : « 1,4 » annonçait « +1.4 → prend la tête », et le serveur remettait +1.
  assert.equal(equipes.effetDUnPrix(salle, 'guit', 1.4), '+1 pour 🎸 Guitaristes → à égalité en tête avec 🍝 Arrabbiata')
  assert.equal(equipes.effetDUnPrix(salle, 'guit', 0.4), 'Pour l’honneur : aucun point d’équipe, aucun classement ne bouge')
})

test('L’Abstentionniste ne pèse pas sur le Coup de Pouce : il revient à qui a joué', () => {
  // Paul n'a rien envoyé : c'était lui, « la personne ayant le moins marqué »,
  // et son équipe touchait un point pour son absence.
  const players = [joueur('paul', 'Paul', 'a'), joueur('lea', 'Léa', 'b', 50), joueur('max', 'Max', 'a', 300)]
  const rows = [
    ligne('paul', 0, 0),
    ligne('paul', 1, 0),
    ligne('lea', 0, 50),
    ligne('lea', 1, 0, { answered: true, correct: false, choice: 1, ms: 4_000 }),
    ligne('max', 0, 150),
    ligne('max', 1, 150),
  ]
  const { awards } = computeStats(rows, players)
  assert.equal(awards.find(a => a.key === 'coupdepouce')?.teamId, 'b', 'Léa ferme la marche de ceux qui ont joué')
})

test('le verdict des équipes s’explique d’une seule phrase, en points d’équipe', () => {
  assert.match(equipes.regleDesEquipes(3), /points d’équipe : 3 à la meilleure, 2 à la suivante/)
  assert.match(equipes.regleDesEquipes(3), /Les prix en ajoutent/)
  assert.doesNotMatch(equipes.regleDesEquipes(3), /barème|cerclé/)
  assert.match(equipes.regleDesEquipes(2), /2 à la meilleure, 1 à l’autre/)
})

// ── 4. Ce que les écrans en disent ───────────────────────────────────────

/** Un composant du client rendu en HTML, comme dans `finitions.test.ts`. */
async function rendu(fichier: string, composant: string, props: object): Promise<string> {
  Object.assign(globalThis, { React: (await import('react')).default })
  const module = await import(new URL(`../../client/src/${fichier}.tsx`, import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const React = (await import('react')).default
  return renderToStaticMarkup(React.createElement(module[composant], props))
}

const texteDe = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

test('la grille des prix nomme ses points, dit l’effet de chacun, et L’Abstentionniste vaut 0 par défaut', async () => {
  const equipe = (id: string, name: string, emoji: string, average: number) =>
    ({ id, name, emoji, position: 0, memberCount: 2, total: average * 2, average, bonus: 0 })
  const teams = [equipe('arra', 'Arrabbiata', '🍝', 1002), equipe('guit', 'Guitaristes', '🎸', 944)]
  const prix = (key: string, title: string, teamId: string) => ({
    key,
    emoji: '⚡',
    title,
    rule: 'La règle',
    detail: 'le détail',
    player: { playerId: 'p', name: 'Jeanne', avatar: '🐢' },
    teamId,
  })
  const html = await rendu('components/AwardsBoard', 'AwardsBoard', {
    awards: [prix('eclair', "L'Éclair", 'guit'), prix('abstentionniste', "L'Abstentionniste", 'arra')],
    teams,
    onAward: () => {},
  })
  assert.match(html, /aria-label="Points d’équipe du prix « L&#x27;Éclair »"/)
  assert.match(texteDe(html), /\+1 pour 🎸 Guitaristes → à égalité en tête avec 🍝 Arrabbiata/)
  assert.match(texteDe(html), /Pour l’honneur : aucun point d’équipe/, 'L’Abstentionniste ne récompense pas l’absence')
  assert.equal((html.match(/pts d’équipe/g) ?? []).length, 2, 'l’unité se lit à côté de chaque champ')
})

test('le téléphone classe les équipes comme la télé, prix compris', async () => {
  const equipe = (id: string, name: string, average: number, bonus: number) =>
    ({ id, name, emoji: '🎲', position: 0, memberCount: 2, total: average * 2, average, bonus })
  // Les Aigles ont la meilleure moyenne ; deux prix donnent la victoire aux Zèbres.
  const teams = [equipe('a', 'Les Aigles', 300, 0), equipe('z', 'Les Zèbres', 200, 2)]
  const telephone = texteDe(await rendu('components/TeamBoard', 'TeamBoard', { teams, compact: true }))
  const tele = texteDe(await rendu('components/TeamBoard', 'TeamBoard', { teams }))
  const ordre = (texte: string) => [...texte.matchAll(/Les (Aigles|Zèbres)/g)].map(m => m[1])
  assert.deepEqual(ordre(telephone), ['Zèbres', 'Aigles'])
  assert.deepEqual(ordre(tele), ordre(telephone))
})

test('le bilan et son export rangent les équipes aux points d’équipe, prix compris', async () => {
  // Les Aigles ont la meilleure moyenne ; deux prix donnent la victoire aux Zèbres.
  const teams = [
    { id: 'a', name: 'Les Aigles', emoji: '🦅', position: 0, createdAt: 1 },
    { id: 'z', name: 'Les Zèbres', emoji: '🦓', position: 1, createdAt: 1 },
  ]
  const players = [joueur('ana', 'Ana', 'a', 200), joueur('zak', 'Zak', 'z', 100)]
  const rows = [ligne('ana', 0, 200), ligne('zak', 0, 100)]
  const bonuses = [{ id: 'b1', teamId: 'z', points: 2, reason: 'Le karaoké', createdAt: 5 }]
  const review = buildReview({ rows, players, teams, bonuses, packsBySession: new Map(), library: [] })
  assert.deepEqual(equipes.vainqueursDuQuiz(review.teams).map(t => t.id), ['z'])

  Object.assign(globalThis, { React: (await import('react')).default })
  const { makeCtx } = await import(new URL('../../client/src/components/BilanQuestion.tsx', import.meta.url).href)
  const html = texteDe(await rendu('components/BilanRoom', 'RoomReview', { ctx: makeCtx(review) }))
  const tableau = html.slice(html.indexOf('Les équipes, quiz par quiz'))
  const ligneDe = (nom: string) => tableau.indexOf(`${nom} `, tableau.indexOf('Points d’équipe'))
  assert.ok(ligneDe('Les Zèbres') < ligneDe('Les Aigles'), 'la gagnante en tête du tableau')

  const csv = exportFiles(review).find(f => f.name === 'equipes.csv')!.content.replace(/^\uFEFF/, '').trim().split('\r\n').map(l => l.split(';'))
  const [entete, ...lignes] = csv
  const col = (nom: string) => entete.indexOf(nom)
  assert.deepEqual(
    lignes.map(l => [l[0], l[col('Rang')], l[col('Points d’équipe')]]),
    [
      ['🦓 Les Zèbres', '1', '3'],
      ['🦅 Les Aigles', '2', '2'],
    ],
  )
})
