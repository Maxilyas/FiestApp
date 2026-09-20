import { computeStats } from './stats'
import type { AnswerRow } from './answers'
import type { ScoreEntry } from './scores'
import { teamScores } from '../../../shared/teams'
import type { PublicPlayer, Recap, TeamBonus } from '../../../shared/types'

/**
 * La page souvenir, calculée à partir du journal des gains et du journal des
 * réponses. Une fonction pure : la soirée en cours et une soirée archivée
 * passent par le même chemin, et le souvenir d'il y a deux ans se relit
 * avec le code d'aujourd'hui.
 */
export interface RecapInput {
  players: PublicPlayer[]
  teams: { id: string; name: string; emoji: string; position: number }[]
  bonuses: TeamBonus[]
  scores: ScoreEntry[]
  answers: AnswerRow[]
}

/** Le titre du quiz, repris du libellé « Quiz « … » — Q3 » écrit par le module de jeu. */
const QUIZ_TITLE = /^Quiz « (.+) » — Q\d+$/

export function buildRecap(input: RecapInput): Recap {
  const { players, teams, bonuses, scores, answers } = input
  const byId = new Map(players.map(p => [p.id, p]))
  const positive = scores.filter(s => s.points > 0)

  // Le plus beau coup : le plus gros gain sur une seule question.
  let best: ScoreEntry | null = null
  for (const s of positive) if (!best || s.points > best.points) best = s

  // Le plus régulier : celui qui a marqué sur le plus de questions.
  const counts = new Map<string, number>()
  for (const s of positive) counts.set(s.playerId, (counts.get(s.playerId) ?? 0) + 1)
  let steady: { playerId: string; n: number } | null = null
  for (const [playerId, n] of counts) if (!steady || n > steady.n) steady = { playerId, n }

  // Un vainqueur par quiz, dans l'ordre où les quiz ont été joués : autant
  // de prix à remettre, et chacun garde une chance même si le classement
  // général lui échappe.
  const sessions = new Map<string, { started: number; title: string; totals: Map<string, number> }>()
  for (const s of scores) {
    if (!s.sessionId) continue
    let sess = sessions.get(s.sessionId)
    if (!sess) {
      sess = { started: s.createdAt, title: '', totals: new Map() }
      sessions.set(s.sessionId, sess)
    }
    sess.started = Math.min(sess.started, s.createdAt)
    sess.totals.set(s.playerId, (sess.totals.get(s.playerId) ?? 0) + s.points)
    // Les lignes d'annulation n'ont pas le titre : on prend la première qui l'a.
    if (!sess.title) sess.title = QUIZ_TITLE.exec(s.reason)?.[1] ?? ''
  }
  const quizWinners = [...sessions.values()]
    .sort((a, b) => a.started - b.started)
    .flatMap(sess => {
      let top: [string, number] | null = null
      for (const entry of sess.totals) if (!top || entry[1] > top[1]) top = entry
      const winner = top ? byId.get(top[0]) : undefined
      if (!top || !winner || top[1] <= 0) return []
      return [{ title: sess.title || 'Un quiz', name: winner.name, avatar: winner.avatar, points: top[1] }]
    })

  const bestPlayer = best ? byId.get(best.playerId) : undefined
  const steadyPlayer = steady ? byId.get(steady.playerId) : undefined

  return {
    ranking: players
      .filter(p => p.score !== 0)
      .sort((a, b) => b.score - a.score)
      .map(p => ({ name: p.name, avatar: p.avatar, points: p.score })),
    teams: teamScores(teams, players, bonuses),
    stats: computeStats(answers, players),
    quizCount: sessions.size,
    totalPoints: scores.reduce((sum, s) => sum + s.points, 0),
    bestShot:
      best && bestPlayer
        ? { name: bestPlayer.name, avatar: bestPlayer.avatar, points: best.points, reason: best.reason }
        : null,
    steadiest:
      steady && steadyPlayer ? { name: steadyPlayer.name, avatar: steadyPlayer.avatar, count: steady.n } : null,
    quizWinners,
  }
}
