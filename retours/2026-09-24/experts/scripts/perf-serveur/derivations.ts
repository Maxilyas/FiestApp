// Ce que coûtent les dérivations pures sur une soirée entière : le souvenir
// (`recap.json`), le bilan (`bilan.json`), le rangement après chaque quiz
// (`buildArchive` + son empreinte sha1 + `buildProgress`), et la clôture
// (hauts faits, Divins, prix). Tout se recalcule à chaque requête ou à
// chaque quiz : on mesure en fonction de la salle et du nombre de questions.
//
//   cd server && npx tsx ../retours/2026-09-24/experts/scripts/perf-serveur/derivations.ts
//
// Journaux synthétiques, au format exact de `AnswerLog` et `ScoreLedger` :
// N invités (un sur trois avec un profil), Q questions en quiz de 10, un QCM
// sur cinq devenant une estimation. Chaque mesure est la médiane de 5.
import { createHash, randomUUID } from 'node:crypto'
import { buildRecap } from '../../../../../server/src/core/recap'
import { buildReview } from '../../../../../server/src/core/review'
import { buildArchive } from '../../../../../server/src/core/archive'
import { buildProgress } from '../../../../../server/src/core/progress'
import { hautsFaitsDeSoiree } from '../../../../../server/src/core/hautsfaits'
import { divinsDeSoiree } from '../../../../../server/src/core/divins'
import { computeStats } from '../../../../../server/src/core/stats'
import type { AnswerRow } from '../../../../../server/src/core/answers'
import type { ScoreEntry } from '../../../../../server/src/core/scores'
import type { PlayerRec } from '../../../../../server/src/core/party'

function soiree(N: number, Q: number) {
  const t0 = Date.now() - 3 * 3600_000
  const players: PlayerRec[] = Array.from({ length: N }, (_, i) => ({
    id: randomUUID(),
    name: `Invité ${i}`,
    avatar: '🦊',
    token: randomUUID(),
    teamId: null,
    profileId: i % 3 === 0 ? randomUUID() : null,
    createdAt: t0 + i,
  }))
  const answers: AnswerRow[] = []
  const scores: ScoreEntry[] = []
  const packs = new Map<string, { title: string; questions: any[] }>()
  for (let quiz = 0; quiz * 10 < Q; quiz++) {
    const sessionId = randomUUID()
    const title = `Quiz ${quiz + 1}`
    const questions: any[] = []
    for (let q = 0; q < Math.min(10, Q - quiz * 10); q++) {
      const estimation = q % 5 === 4
      questions.push(
        estimation
          ? { kind: 'number', text: `Estimation ${q}`, target: 1789, unit: 'ans', duration: 20, image: null, observeSeconds: null }
          : { kind: 'choice', text: `Question ${q}`, answers: ['A', 'B', 'C', 'D'], correct: q % 4, duration: 20, image: null, observeSeconds: null },
      )
      const createdAt = t0 + (quiz * 10 + q) * 60_000
      players.forEach((p, i) => {
        const answered = (i + q) % 11 !== 0
        const choice = answered && !estimation ? (i * 7 + q) % 4 : null
        const value = answered && estimation ? 1700 + ((i * 13) % 200) : null
        const correct = estimation ? null : answered ? choice === q % 4 : null
        const points = correct ? 500 + ((i * 31) % 500) : estimation && answered ? (i * 17) % 400 : 0
        answers.push({
          sessionId, quizTitle: title, qIndex: q, kind: estimation ? 'number' : 'choice', playerId: p.id,
          answered, correct, choice, value, target: estimation ? 1789 : null, ms: answered ? 1500 + ((i * 97) % 15000) : null,
          changes: 0, points, durationMs: 20000, observed: false, category: null, createdAt,
        })
        if (points > 0) scores.push({ playerId: p.id, sessionId, points, reason: `Quiz « ${title} » — Q${q + 1}`, createdAt })
      })
    }
    packs.set(sessionId, { title, questions })
  }
  return { players, answers, scores, packs }
}

function mediane(fn: () => unknown): number {
  const ts: number[] = []
  for (let k = 0; k < 5; k++) {
    const t = performance.now()
    fn()
    ts.push(performance.now() - t)
  }
  return ts.sort((a, b) => a - b)[2]
}

const tailles: [number, number][] = [
  [30, 40],
  [50, 40],
  [150, 40],
  [300, 40],
  [500, 40],
  [300, 80],
]
for (const [N, Q] of tailles) {
  const { players, answers, scores, packs } = soiree(N, Q)
  const totals = new Map<string, number>()
  for (const s of scores) totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.points)
  const publics = players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, connected: true, score: totals.get(p.id) ?? 0, teamId: null }))
  const live = { players, scores, answers }
  let recapOctets = 0
  let bilanOctets = 0
  let archiveOctets = 0
  const recap = mediane(() => {
    recapOctets = JSON.stringify(buildRecap({ players: publics as any, teams: [], bonuses: [], scores, answers })).length
  })
  const bilan = mediane(() => {
    bilanOctets = JSON.stringify(
      buildReview({ rows: answers, players: publics as any, teams: [], bonuses: [], packsBySession: packs as any, library: [] }),
    ).length
  })
  const rangement = mediane(() => {
    const built = buildArchive({
      soiree: { id: 'x', heldAt: 0 } as any, players, teams: [], bonuses: [], scores, answers, packsBySession: packs as any, library: [],
    })
    const json = JSON.stringify(built!.archive)
    archiveOctets = json.length
    createHash('sha1').update(json).digest('hex')
    JSON.stringify(buildProgress(live))
  })
  const cloture = mediane(() => {
    hautsFaitsDeSoiree(live)
    divinsDeSoiree(live)
    buildProgress(live, { cloture: true })
    computeStats(answers, publics as any)
  })
  console.log(
    JSON.stringify({
      invites: N,
      questions: Q,
      'lignes du journal': answers.length,
      'recap.json ms': recap.toFixed(1),
      'recap.json Ko': (recapOctets / 1024).toFixed(0),
      'bilan.json ms': bilan.toFixed(1),
      'bilan.json Ko': (bilanOctets / 1024).toFixed(0),
      'rangement après quiz ms': rangement.toFixed(1),
      'archive Ko': (archiveOctets / 1024).toFixed(0),
      'clôture (dérivations) ms': cloture.toFixed(1),
    }),
  )
}
