// L'avatar d'un invité dans le souvenir et le bilan : celui qu'il porte.
//
// Le propriétaire du dépôt, le 4 octobre 2026 : « quand je fais voir mon
// bilan, j'ai un emoji qui ne correspond pas à l'avatar que j'ai (j'ai un
// légendaire) ». Le bilan et le souvenir ne recopiaient que l'emoji de
// l'inscription, et l'archive n'en garde pas plus — or c'est elle que la fin
// de soirée ouvre, sous « Mon bilan ». Ils montrent maintenant le légendaire,
// la finition et l'Éclat que le profil porte, comme la salle les voit ; ni
// le niveau ni le laurier, que ces pages n'ont jamais dits.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {
  ADMIN,
  attendre,
  connexionAnimateur,
  creerQuiz,
  demarrer,
  ecranCommun,
  ecrire,
  emitAck,
  inscrireProfil,
  invite as inviter,
  lancerQuiz,
  patienter,
  qcm,
  type Banc,
  type Invite,
  type Socket,
} from './banc'
import { ProfileStore } from '../src/auth/profiles'
import type { AnswerRow } from '../src/core/answers'
import { buildRecap } from '../src/core/recap'
import { buildReview } from '../src/core/review'
import { recapOfArchive, reviewOfArchive } from '../src/core/archive'
import type { PartyArchive } from '../../shared/archive'
import type { PublicPlayer } from '../../shared/types'

// L'Éclat se tire une chance sur quarante : ici, il ne tombe jamais.
ProfileStore.tirageEclat = () => false

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

// ── De quoi écrire une soirée en quelques lignes ──────────────────────────

function joueur(id: string, name: string, avatar: string, extra: Partial<PublicPlayer> = {}): PublicPlayer {
  return { id, name, avatar, connected: false, score: 0, teamId: null, ...extra }
}

let horloge = 1_000
function reponse(playerId: string, points: number): AnswerRow {
  return {
    sessionId: 's1',
    quizTitle: 'Quiz',
    qIndex: 0,
    kind: 'choice',
    playerId,
    answered: true,
    correct: points > 0,
    choice: points > 0 ? 0 : 1,
    value: null,
    target: null,
    ms: 5_000,
    changes: 0,
    points,
    durationMs: 20_000,
    observed: false,
    createdAt: ++horloge,
  }
}

/** Ce qu'une ligne dit de l'avatar — et rien d'autre. */
const avatarDe = (ligne: object | undefined) => {
  const l = (ligne ?? {}) as Record<string, unknown>
  return Object.fromEntries(['avatar', 'finition', 'eclat', 'legendaire', 'niveau', 'laurier'].filter(k => k in l).map(k => [k, l[k]]))
}

// ── 1. La dérivation ──────────────────────────────────────────────────────

test('le bilan et le souvenir recopient l’avatar porté — légendaire, finition, Éclat —, sans niveau ni laurier', () => {
  // Jeanne porte le Phénix, éclaté, en Holo, et a gagné le quiz du jour
  // d'hier ; Bob joue sans profil.
  const jeanne = joueur('jeanne', 'Jeanne', '🦊', {
    score: 300,
    niveau: 14,
    finition: 'holo',
    eclat: true,
    legendaire: 'lg:phenix',
    laurier: 1,
  })
  const bob = joueur('bob', 'Bob', '🐻', { score: 100 })
  const rows = [reponse('jeanne', 300), reponse('bob', 100)]
  const attendu = { avatar: '🦊', finition: 'holo', eclat: true, legendaire: 'lg:phenix' }

  const review = buildReview({ rows, players: [jeanne, bob], teams: [], bonuses: [], packsBySession: new Map(), library: [] })
  assert.deepEqual(avatarDe(review.players.find(p => p.id === 'jeanne')), attendu, 'le bilan')
  assert.deepEqual(avatarDe(review.players.find(p => p.id === 'bob')), { avatar: '🐻' }, 'un anonyme n’y porte rien de plus')

  const scores = [
    { playerId: 'jeanne', sessionId: 's1', points: 300, reason: 'Quiz « Quiz » — Q1', createdAt: ++horloge },
    { playerId: 'bob', sessionId: 's1', points: 100, reason: 'Quiz « Quiz » — Q1', createdAt: ++horloge },
  ]
  const recap = buildRecap({ players: [jeanne, bob], teams: [], bonuses: [], scores, answers: rows })
  assert.deepEqual(avatarDe(recap.ranking.find(r => r.name === 'Jeanne')), attendu, 'le podium du souvenir')
  assert.deepEqual(avatarDe(recap.ranking.find(r => r.name === 'Bob')), { avatar: '🐻' })
})

test('relue, une archive montre ce que les profils portent — l’emoji de l’inscription pour qui n’en a pas', () => {
  const archive: PartyArchive = {
    version: 1,
    players: [
      { id: 'jeanne', name: 'Jeanne', avatar: '🦊', teamId: null, profileId: 'profil-jeanne', createdAt: 1 },
      { id: 'bob', name: 'Bob', avatar: '🐻', teamId: null, profileId: null, createdAt: 2 },
      // Un profil supprimé depuis : la recherche ne le trouve plus.
      { id: 'zoe', name: 'Zoé', avatar: '🐸', teamId: null, profileId: 'profil-parti', createdAt: 3 },
    ],
    teams: [],
    bonuses: [],
    scores: [
      { playerId: 'jeanne', sessionId: 's1', points: 300, reason: 'Quiz « Quiz » — Q1', createdAt: 10 },
      { playerId: 'bob', sessionId: 's1', points: 100, reason: 'Quiz « Quiz » — Q1', createdAt: 11 },
      { playerId: 'zoe', sessionId: 's1', points: 50, reason: 'Quiz « Quiz » — Q1', createdAt: 12 },
    ],
    answers: [reponse('jeanne', 300), reponse('bob', 100), reponse('zoe', 50)],
    packs: {},
  }
  const demandes: [string, string][] = []
  const apparences = (profileId: string, avatar: string) => {
    demandes.push([profileId, avatar])
    return profileId === 'profil-jeanne'
      ? { niveau: 14, finition: 'or' as const, eclat: false, legendaire: 'lg:chouette', laurier: 1 as const }
      : undefined
  }

  const review = reviewOfArchive(archive, apparences)
  const lu = (id: string) => avatarDe(review.players.find(p => p.id === id))
  assert.deepEqual(lu('jeanne'), { avatar: '🦊', finition: 'or', legendaire: 'lg:chouette' })
  assert.deepEqual(lu('bob'), { avatar: '🐻' })
  assert.deepEqual(lu('zoe'), { avatar: '🐸' }, 'un profil disparu garde son emoji')
  // L'emoji de la fiche accompagne la question : l'Éclat se juge sur ce qu'il portait ce soir-là.
  assert.deepEqual(demandes, [
    ['profil-jeanne', '🦊'],
    ['profil-parti', '🐸'],
  ])

  const recap = recapOfArchive(archive, apparences)
  assert.deepEqual(avatarDe(recap.ranking.find(r => r.name === 'Jeanne')), { avatar: '🦊', finition: 'or', legendaire: 'lg:chouette' })

  // Sans profils à lire — l'export en ligne de commande —, l'archive se relit comme avant.
  assert.deepEqual(avatarDe(reviewOfArchive(archive).players.find(p => p.id === 'jeanne')), { avatar: '🦊' })
})

// ── 2. La page ────────────────────────────────────────────────────────────

test('« Mon bilan » montre le légendaire porté, pas l’emoji de l’inscription', async () => {
  // Les dessins arrivent à la demande (`medaillons.ts`) ; chargés, `Avatar` les montre.
  await import(new URL('../../client/src/components/Legendaire.tsx', import.meta.url).href)
  await import(new URL('../../client/src/components/Divin.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { makeCtx } = await import(new URL('../../client/src/components/BilanQuestion.tsx', import.meta.url).href)
  const { PlayerReview } = await import(new URL('../../client/src/components/BilanPlayer.tsx', import.meta.url).href)

  const jeanne = joueur('jeanne', 'Jeanne', '🦊', { score: 300, finition: 'or', legendaire: 'lg:phenix' })
  const review = buildReview({
    rows: [reponse('jeanne', 300)],
    players: [jeanne],
    teams: [],
    bonuses: [],
    packsBySession: new Map(),
    library: [],
  })
  const html = renderToStaticMarkup(React.createElement(PlayerReview, { ctx: makeCtx(review), player: review.players[0] }))
  const tete = html.slice(html.indexOf('bilan-who'), html.indexOf('</h2>'))
  assert.match(tete, /<span class="av bilan-avatar av-legendaire[^"]*">/, 'le médaillon, à la place de l’emoji')
  assert.doesNotMatch(tete, /🦊/, 'l’emoji de l’inscription ne se montre plus')

  // Le choix du prénom aussi : chaque pastille porte son avatar, figé comme dans une liste.
  const { readFileSync } = await import('node:fs')
  const bilan = readFileSync(new URL('../../client/src/views/BilanApp.tsx', import.meta.url), 'utf8')
  assert.match(
    bilan,
    /<button key=\{p\.id\} className="bilan-chip" onClick=\{\(\) => onPick\(p\.id\)\}>\s*<Avatar className="lb-avatar" avatar=\{p\.avatar\} finition=\{p\.finition\} eclat=\{p\.eclat\} legendaire=\{p\.legendaire\} \/>/,
  )
})

// ── 3. Une vraie soirée, close ────────────────────────────────────────────

type Reponses = [Invite, number][][]

/** Joue un quiz de bout en bout depuis l'écran commun, puis le referme. */
async function jouerQuiz(host: Socket, quizId: string, questions: Reponses): Promise<void> {
  const vue = (sessionId: string, pred: (v: any) => boolean, label: string) =>
    attendre<any>(host, 'session:view', p => p.sessionId === sessionId && pred(p.view), label, 15_000)
  const sessionId = await lancerQuiz(host, quizId)
  let suivante = vue(sessionId, v => v.phase === 'question' && v.qIndex === 0, 'la première question')
  for (let q = 0; q < questions.length; q++) {
    await suivante
    const revelee = vue(sessionId, v => v.phase === 'reveal' && v.qIndex === q, `la révélation ${q + 1}`)
    for (const [qui, choice] of questions[q]) {
      const ack = await emitAck<any>(qui.socket, 'player:action', { sessionId, action: { type: 'answer', choice } })
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
  ;(host as any).emit('host:endSession', { sessionId })
}

/** « Clore la soirée ». */
async function clore(host: Socket) {
  const toast = attendre<any>(host, 'toast', () => true, 'la soirée close', 15_000)
  ;(host as any).emit('host:closeParty', {})
  const t = await toast
  assert.equal(t.kind, 'info', `la clôture a échoué : ${t.message}`)
}

/** Attend que la soirée en cours se soit rangée d'elle-même, et rend son identifiant. */
async function rangee(banc: Banc): Promise<string> {
  for (const limite = Date.now() + 8000; ; await patienter(100)) {
    const { current } = (await (await fetch(`${banc.url}/s/${ADMIN.slug}/soirees.json`)).json()) as any
    if (current?.id) return current.id
    if (Date.now() > limite) assert.fail('la soirée aurait dû se ranger toute seule après son quiz')
  }
}

const lire = async (banc: Banc, chemin: string) => {
  const res = await fetch(`${banc.url}/s/${ADMIN.slug}/${chemin}`)
  assert.equal(res.status, 200, chemin)
  return (await res.json()) as any
}

test('la Chouette au cou, Alice la retrouve dans son bilan et au souvenir — en cours, puis archivés', async () => {
  const banc = await demarrer()
  try {
    const cookie = await connexionAnimateur(banc.url)
    const huit = await creerQuiz(banc.url, cookie, Array.from({ length: 8 }, (_, i) => qcm(`Question ${i + 1} ?`)), 'Huit')
    const une = await creerQuiz(banc.url, cookie, [qcm('Encore ?')], 'Une')
    const aliceCookie = await inscrireProfil(banc.url, 'alice', 'Alice', '🦊')
    const host = await ecranCommun(banc.url, cookie)

    // Première soirée : un Grand Chelem dans une salle de quatre — la Chouette.
    const alice = await inviter(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const salle: Invite[] = []
    for (const [nom, emoji] of [
      ['Bob', '🐻'],
      ['Dora', '🐙'],
      ['Eve', '🐝'],
    ]) {
      salle.push(await inviter(banc.url, nom, emoji))
    }
    await jouerQuiz(host, huit, Array.from({ length: 8 }, () => [[alice, 0], ...salle.map((i): [Invite, number] => [i, 1])]))
    const premiere = await rangee(banc)
    await clore(host)
    const porte = await ecrire(banc.url, '/api/joueur/moi', { legendaire: 'lg:chouette' }, aliceCookie, 'PUT')
    assert.equal(porte.status, 200, 'la Chouette se porte')

    // Seconde soirée, la Chouette au cou.
    const retour = await inviter(banc.url, 'Alice', '🦊', { cookie: aliceCookie })
    const bob = await inviter(banc.url, 'Bob', '🐻')
    await jouerQuiz(host, une, [
      [
        [retour, 0],
        [bob, 1],
      ],
    ])
    const seconde = await rangee(banc)

    const verifier = (bilan: any, souvenir: any, ou: string) => {
      const a = bilan.players.find((p: any) => p.name === 'Alice')
      assert.equal(a?.avatar, '🦊', `${ou} : l’emoji de sa fiche reste dessous`)
      assert.equal(a?.legendaire, 'lg:chouette', `${ou} : son bilan montre la Chouette`)
      assert.equal(a?.niveau, undefined, `${ou} : pas de niveau`)
      assert.equal(a?.laurier, undefined, `${ou} : pas de laurier`)
      assert.equal(bilan.players.find((p: any) => p.name === 'Bob')?.legendaire, undefined, `${ou} : Bob joue sans profil`)
      assert.equal(souvenir.ranking.find((r: any) => r.name === 'Alice')?.legendaire, 'lg:chouette', `${ou} : le souvenir aussi`)
    }
    verifier(await lire(banc, 'bilan.json'), await lire(banc, 'recap.json'), 'en cours')

    // Close, la soirée se relit à l'adresse de son archive : celle que la fin
    // de soirée ouvre sous « Mon bilan ».
    await clore(host)
    verifier(await lire(banc, `soirees/${seconde}/bilan.json`), await lire(banc, `soirees/${seconde}/recap.json`), 'archivée')
    // La soirée d'avant la Chouette la montre aussi : c'est l'avatar qu'elle porte.
    verifier(await lire(banc, `soirees/${premiere}/bilan.json`), await lire(banc, `soirees/${premiere}/recap.json`), 'la première')
  } finally {
    await banc.close()
  }
})
