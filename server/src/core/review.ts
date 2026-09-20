import type { AnswerRow } from './answers'
import { computeStats } from './stats'
import type { PlayableQuestion } from '../../../shared/library'
import { rankTeams, teamScores } from '../../../shared/teams'
import type { PublicPlayer, TeamBonus } from '../../../shared/types'
import { formatSeconds, sharedRank } from '../../../shared/review'
import type {
  Review,
  ReviewAnswer,
  ReviewHighlight,
  ReviewPlayer,
  ReviewQuestion,
  ReviewQuiz,
  ReviewRecords,
  ReviewTeam,
  ReviewTeamQuiz,
  TeamOnQuestion,
} from '../../../shared/review'

/**
 * Le bilan de la soirée, question par question.
 *
 * Le journal des réponses ne garde que des numéros : le numéro de la
 * question dans son quiz, le numéro de la réponse choisie. Pour écrire
 * « tu as répondu Canberra », il faut retrouver la question telle qu'elle a
 * été posée. Deux sources, dans l'ordre :
 *
 * · la copie du quiz que le moteur a gardée dans la partie terminée — exacte,
 *   mais elle vit sur le disque local, que l'hébergeur efface au redémarrage ;
 * · la bibliothèque, par titre de quiz. Elle a pu être retouchée depuis la
 *   soirée, alors on vérifie que ce qu'elle dit colle au journal (type, bonne
 *   réponse, nombre de réponses) et on signale ce qui ne colle pas.
 */

/** Un quiz tel qu'il a été joué : son titre et ses questions jouables. */
export interface PlayedPack {
  title: string
  questions: PlayableQuestion[]
}

export interface ReviewInput {
  rows: AnswerRow[]
  players: PublicPlayer[]
  teams: { id: string; name: string; emoji: string; position: number }[]
  bonuses: TeamBonus[]
  /** La copie exacte du quiz de chaque partie, quand le serveur l'a encore. */
  packsBySession: Map<string, PlayedPack>
  /** La bibliothèque, pour les parties dont la copie a disparu. */
  library: PlayedPack[]
}

/** En dessous, un record ou un moment fort ne veut rien dire. */
const MIN_ANSWERS = 3

const questionKey = (sessionId: string, qIndex: number) => `${sessionId}#${qIndex}`
const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'fr')

// ── Les parties, dans l'ordre où elles ont été jouées ────────────────────

interface SessionGroup {
  id: string
  title: string
  startedAt: number
  /** Les lignes de chaque question, dans l'ordre des positions. */
  questions: { qIndex: number; rows: AnswerRow[] }[]
}

function groupSessions(rows: AnswerRow[]): SessionGroup[] {
  const groups = new Map<string, SessionGroup>()
  const lists = new Map<string, AnswerRow[]>()
  for (const r of rows) {
    let g = groups.get(r.sessionId)
    if (!g) {
      g = { id: r.sessionId, title: r.quizTitle, startedAt: r.createdAt, questions: [] }
      groups.set(r.sessionId, g)
    }
    g.startedAt = Math.min(g.startedAt, r.createdAt)
    const key = questionKey(r.sessionId, r.qIndex)
    let list = lists.get(key)
    if (!list) {
      list = []
      lists.set(key, list)
      g.questions.push({ qIndex: r.qIndex, rows: list })
    }
    list.push(r)
  }
  // Une question reposée est journalisée après les suivantes : on lit le
  // quiz dans l'ordre de ses questions, pas dans celui du journal.
  for (const g of groups.values()) g.questions.sort((a, b) => a.qIndex - b.qIndex)
  return [...groups.values()].sort((a, b) => a.startedAt - b.startedAt)
}

// ── Retrouver les questions ──────────────────────────────────────────────

/** Vrai si la question de la bibliothèque colle à ce que le journal en dit. */
function consistent(q: PlayableQuestion, rows: AnswerRow[]): boolean {
  if (rows.length === 0) return true
  if (q.kind !== rows[0].kind) return false
  if (q.kind === 'number') return rows.every(r => r.target === null || r.target === q.target)
  return rows.every(r => {
    if (!r.answered || r.choice === null) return true
    if (r.choice >= q.answers.length) return false
    return (r.choice === q.correct) === r.correct
  })
}

interface Found {
  question: PlayableQuestion | null
  uncertain: boolean
}

/**
 * Le quiz d'une partie : sa copie exacte si on l'a, sinon le quiz de la
 * bibliothèque qui porte ce titre. Deux quiz peuvent porter le même titre —
 * on garde celui qui colle au journal sur le plus de questions.
 */
function choosePack(group: SessionGroup, input: ReviewInput): { pack: PlayedPack | null; exact: boolean } {
  const exact = input.packsBySession.get(group.id)
  if (exact) return { pack: exact, exact: true }
  let best: PlayedPack | null = null
  let bestScore = -1
  for (const pack of input.library.filter(p => p.title === group.title)) {
    const score = group.questions.reduce((n, q) => {
      const pq = pack.questions[q.qIndex]
      return n + (pq && consistent(pq, q.rows) ? 1 : 0)
    }, 0)
    if (score > bestScore) {
      best = pack
      bestScore = score
    }
  }
  return { pack: best, exact: false }
}

function findQuestions(group: SessionGroup, input: ReviewInput): Map<number, Found> {
  const { pack, exact } = choosePack(group, input)
  const found = new Map<number, Found>()
  for (const q of group.questions) {
    const pq = pack?.questions[q.qIndex] ?? null
    found.set(q.qIndex, { question: pq, uncertain: !!pq && !exact && !consistent(pq, q.rows) })
  }
  return found
}

/**
 * Le quiz de chaque partie du journal, tel qu'on peut encore le retrouver.
 * L'archive d'une soirée l'emporte avec elle : le bilan se relira ensuite
 * sans dépendre de la bibliothèque, qui aura peut-être changé.
 */
export function resolvePacks(
  rows: AnswerRow[],
  packsBySession: Map<string, PlayedPack>,
  library: PlayedPack[],
): Map<string, PlayedPack & { exact: boolean }> {
  const input: ReviewInput = { rows, players: [], teams: [], bonuses: [], packsBySession, library }
  const packs = new Map<string, PlayedPack & { exact: boolean }>()
  for (const group of groupSessions(rows)) {
    const { pack, exact } = choosePack(group, input)
    if (pack) packs.set(group.id, { title: pack.title, questions: pack.questions, exact })
  }
  return packs
}

// ── Aides de calcul ──────────────────────────────────────────────────────

function countChoices(rows: AnswerRow[], width: number): number[] {
  const counts = new Array<number>(width).fill(0)
  for (const r of rows) {
    if (r.choice !== null && r.choice >= 0 && r.choice < width) counts[r.choice]++
  }
  return counts
}

/** Les propositions d'une estimation, de la plus proche à la plus loin — la règle du jeu. */
function rankedGuesses(rows: AnswerRow[], target: number): AnswerRow[] {
  return rows
    .filter(r => r.answered && r.value !== null)
    .sort(
      (a, b) =>
        Math.abs(a.value! - target) - Math.abs(b.value! - target) || (a.ms ?? 0) - (b.ms ?? 0),
    )
}

/**
 * Le meneur du classement cumulé. À égalité, le meneur en place le reste :
 * on n'annonce pas un changement de tête qui n'en est pas un.
 */
function leaderOf(
  totals: Map<string, number>,
  previous: string | null,
  byId: Map<string, PublicPlayer>,
): string | null {
  let top = 0
  for (const points of totals.values()) top = Math.max(top, points)
  if (top <= 0) return null
  const tied = [...totals.entries()].filter(([, points]) => points === top).map(([id]) => id)
  if (previous && tied.includes(previous)) return previous
  return tied.sort((a, b) => byName(byId.get(a)!, byId.get(b)!))[0]
}

function argBest<T>(list: T[], value: (t: T) => number, best: 'min' | 'max'): T | null {
  let winner: T | null = null
  let winning = 0
  for (const item of list) {
    const v = value(item)
    if (winner === null || (best === 'max' ? v > winning : v < winning)) {
      winner = item
      winning = v
    }
  }
  return winner
}

// ── Le bilan ─────────────────────────────────────────────────────────────

export function buildReview(input: ReviewInput): Review {
  const { players, teams, bonuses } = input
  const byId = new Map(players.map(p => [p.id, p]))
  // Un invité exclu emporte ses réponses ; par sécurité, une ligne orpheline
  // n'entre pas dans le bilan.
  const rows = input.rows.filter(r => byId.has(r.playerId))
  const sessions = groupSessions(rows)

  const questions: ReviewQuestion[] = []
  const answersByPlayer = new Map<string, ReviewAnswer[]>()
  const highlightsByPlayer = new Map<string, ReviewHighlight[]>()
  const push = (playerId: string, h: ReviewHighlight) => {
    highlightsByPlayer.set(playerId, [...(highlightsByPlayer.get(playerId) ?? []), h])
  }

  /** Points de chacun sur chaque quiz, pour les rangs par quiz. */
  const sessionTotals: Map<string, number>[] = []
  const cumulative = new Map<string, number>()
  let leader: string | null = null
  let order = 0

  sessions.forEach((group, quizIndex) => {
    const found = findQuestions(group, input)
    const totals = new Map<string, number>()
    sessionTotals.push(totals)

    for (const { qIndex, rows: qRows } of group.questions) {
      order++
      const key = questionKey(group.id, qIndex)
      const { question: pq, uncertain } = found.get(qIndex)!
      const kind = qRows[0].kind
      const answered = qRows.filter(r => r.answered)

      // QCM : les réponses telles qu'affichées, ou des numéros si on ne les a plus.
      let answers: string[] = []
      if (kind === 'choice') {
        if (pq?.kind === 'choice') answers = pq.answers
        else {
          const width = Math.max(2, ...answered.map(r => (r.choice ?? -1) + 1))
          answers = Array.from({ length: width }, (_, i) => `Réponse ${i + 1}`)
        }
      }
      const counts = countChoices(answered, answers.length)
      const correctRows = qRows.filter(r => r.correct === true)
      const target =
        kind === 'number'
          ? (qRows.find(r => r.target !== null)?.target ?? (pq?.kind === 'number' ? pq.target : null))
          : null
      const guesses = kind === 'number' && target !== null ? rankedGuesses(qRows, target) : []

      const fastestRow = argBest(
        correctRows.filter(r => r.ms !== null),
        r => r.ms!,
        'min',
      )
      const fastest = fastestRow ? { playerId: fastestRow.playerId, ms: fastestRow.ms! } : null
      const closest = guesses[0] ? { playerId: guesses[0].playerId, value: guesses[0].value! } : null

      const byTeam: TeamOnQuestion[] = []
      for (const t of teams) {
        const tRows = qRows.filter(r => byId.get(r.playerId)?.teamId === t.id)
        if (tRows.length === 0) continue
        const tAnswered = tRows.filter(r => r.answered)
        byTeam.push({
          teamId: t.id,
          asked: tRows.length,
          answered: tAnswered.length,
          correct: tRows.filter(r => r.correct === true).length,
          counts: countChoices(tAnswered, answers.length),
          avgMs: average(tAnswered.filter(r => r.ms !== null).map(r => r.ms!)),
          points: sum(tRows.map(r => r.points)),
        })
      }

      for (const r of qRows) {
        totals.set(r.playerId, (totals.get(r.playerId) ?? 0) + r.points)
        cumulative.set(r.playerId, (cumulative.get(r.playerId) ?? 0) + r.points)
      }
      const top = leaderOf(cumulative, leader, byId)
      const newLeader = top !== leader ? top : null
      leader = top

      questions.push({
        key,
        sessionId: group.id,
        quizNumber: quizIndex + 1,
        quizTitle: group.title,
        qIndex,
        order,
        kind,
        text: pq?.text ?? `Question ${qIndex + 1} du quiz « ${group.title} »`,
        answers,
        correct: pq?.kind === 'choice' ? pq.correct : null,
        target,
        unit: pq?.kind === 'number' ? pq.unit : '',
        image: pq?.image ?? null,
        durationMs: qRows[0].durationMs,
        observed: qRows[0].observed,
        resolved: pq !== null,
        uncertain,
        asked: qRows.length,
        answered: answered.length,
        correctCount: correctRows.length,
        counts,
        byTeam,
        fastest,
        avgMs: average(answered.filter(r => r.ms !== null).map(r => r.ms!)),
        closest,
        guesses: guesses.length,
        newLeader,
        changes: sum(qRows.map(r => r.changes)),
      })

      // Ce que chacun a fait, et ses moments forts sur cette question.
      for (const r of qRows) {
        const proximityRank = guesses.length ? guesses.findIndex(g => g.playerId === r.playerId) + 1 : 0
        answersByPlayer.set(r.playerId, [
          ...(answersByPlayer.get(r.playerId) ?? []),
          {
            questionKey: key,
            answered: r.answered,
            correct: r.correct,
            choice: r.choice,
            value: r.value,
            ms: r.ms,
            changes: r.changes,
            points: r.points,
            proximityRank: proximityRank > 0 ? proximityRank : null,
          },
        ])

        if (kind === 'choice') {
          if (r.correct === true) {
            if (qRows.length >= MIN_ANSWERS && correctRows.length === 1) {
              push(r.playerId, { kind: 'onlyRight', questionKey: key, text: 'La seule bonne réponse de toute la salle' })
            } else if (fastest?.playerId === r.playerId && correctRows.length >= 2) {
              push(r.playerId, {
                kind: 'fastest',
                questionKey: key,
                text: `La bonne réponse la plus rapide de la salle, en ${formatSeconds(fastest.ms)}`,
              })
            } else {
              const team = byId.get(r.playerId)?.teamId
              const mates = team
                ? qRows.filter(o => o.playerId !== r.playerId && byId.get(o.playerId)?.teamId === team)
                : []
              // À deux dans l'équipe, être « le seul à trouver » arrive à chaque
              // question : il faut au moins deux coéquipiers pour que ça compte.
              if (mates.length >= 2 && mates.every(o => o.correct !== true)) {
                push(r.playerId, { kind: 'saviour', questionKey: key, text: 'La seule bonne réponse de ton équipe' })
              }
            }
          } else if (r.answered && answered.length >= MIN_ANSWERS && correctRows.length === answered.length - 1) {
            push(r.playerId, { kind: 'onlyWrong', questionKey: key, text: 'La seule mauvaise réponse de toute la salle' })
          }
        } else if (r.answered && r.value !== null && target !== null) {
          if (r.value === target) {
            push(r.playerId, { kind: 'exact', questionKey: key, text: 'Pile-poil : la valeur exacte' })
          } else if (closest?.playerId === r.playerId && guesses.length >= 2) {
            push(r.playerId, { kind: 'closest', questionKey: key, text: "L'estimation la plus proche de toute la salle" })
          }
        }
      }
    }
  })

  // ── Les rangs par quiz : partagés à égalité, comme partout ailleurs.
  const sessionRanks = sessionTotals.map(totals => {
    const sorted = [...totals.entries()]
      .map(([playerId, points]) => ({ playerId, points, name: byId.get(playerId)!.name }))
      .sort((a, b) => b.points - a.points || byName(a, b))
    return new Map(sorted.map(p => [p.playerId, sharedRank(sorted, p, o => o.points)]))
  })

  // ── Les joueurs
  const stats = computeStats(rows, players)
  const statById = new Map(stats.players.map(s => [s.playerId, s]))
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score || byName(a, b))
  const reviewPlayers: ReviewPlayer[] = sortedPlayers.map(p => {
    const mates = p.teamId ? sortedPlayers.filter(o => o.teamId === p.teamId) : []
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      teamId: p.teamId,
      points: p.score,
      rank: sharedRank(sortedPlayers, p, o => o.score),
      teamRank: p.teamId ? sharedRank(mates, p, o => o.score) : null,
      stat: statById.get(p.id)!,
      answers: answersByPlayer.get(p.id) ?? [],
      awards: stats.awards
        .filter(a => a.player?.playerId === p.id)
        .map(a => ({ emoji: a.emoji, title: a.title, detail: a.detail })),
      highlights: highlightsByPlayer.get(p.id) ?? [],
      perQuiz: sessions.map((g, i) => ({
        sessionId: g.id,
        points: sessionTotals[i].get(p.id) ?? 0,
        rank: sessionRanks[i].get(p.id) ?? null,
      })),
    }
  })

  // ── Les équipes
  const reviewTeams: ReviewTeam[] = rankTeams(teamScores(teams, players, bonuses)).map(t => {
    const members = sortedPlayers.filter(p => p.teamId === t.id)
    const memberIds = new Set(members.map(p => p.id))
    const tRows = rows.filter(r => memberIds.has(r.playerId))
    const perQuiz: ReviewTeamQuiz[] = sessions.map(g => {
      const sRows = tRows.filter(r => r.sessionId === g.id)
      const present = new Set(sRows.map(r => r.playerId)).size
      const total = sum(sRows.map(r => r.points))
      return {
        sessionId: g.id,
        total,
        average: present ? Math.round(total / present) : 0,
        accuracy: accuracyOf(sRows),
        avgMs: avgMsOf(sRows),
        rank: 0,
      }
    })
    return {
      ...t,
      accuracy: accuracyOf(tRows),
      avgMs: avgMsOf(tRows),
      best: members[0] ? { playerId: members[0].id, points: members[0].score } : null,
      perQuiz,
    }
  })
  sessions.forEach((_, i) => {
    const sorted = [...reviewTeams].sort((a, b) => b.perQuiz[i].average - a.perQuiz[i].average || byName(a, b))
    for (const t of reviewTeams) t.perQuiz[i].rank = sharedRank(sorted, t, o => o.perQuiz[i].average)
  })

  // ── Les quiz
  const quizzes: ReviewQuiz[] = sessions.map((g, i) => {
    const winner = argBest(
      [...sessionTotals[i].entries()].sort((a, b) => byName(byId.get(a[0])!, byId.get(b[0])!)),
      ([, points]) => points,
      'max',
    )
    const teamWinner = argBest(
      [...reviewTeams].sort(byName),
      t => t.perQuiz[i].average,
      'max',
    )
    return {
      sessionId: g.id,
      number: i + 1,
      title: input.packsBySession.get(g.id)?.title ?? g.title,
      questionCount: g.questions.length,
      startedAt: g.startedAt,
      players: sessionTotals[i].size,
      winner: winner && winner[1] > 0 ? { playerId: winner[0], points: winner[1] } : null,
      teamWinner:
        teamWinner && teamWinner.perQuiz[i].average > 0
          ? { teamId: teamWinner.id, average: teamWinner.perQuiz[i].average }
          : null,
    }
  })

  // ── Les records de la soirée
  const choiceQs = questions.filter(q => q.kind === 'choice' && q.answered >= MIN_ANSWERS)
  const timedQs = questions.filter(q => q.avgMs !== null && q.answered >= MIN_ANSWERS)
  const hardest = argBest(choiceQs, q => q.correctCount / q.answered, 'min')
  const easiest = argBest(choiceQs, q => q.correctCount / q.answered, 'max')
  const quickest = argBest(timedQs, q => q.avgMs!, 'min')
  const slowest = argBest(timedQs, q => q.avgMs!, 'max')
  const records: ReviewRecords = {
    hardest: hardest?.key ?? null,
    // Une seule question qualifiée serait à la fois la plus ratée et la plus
    // facile : on ne la présente qu'une fois.
    easiest: easiest && easiest !== hardest ? easiest.key : null,
    mostDivisive: argBest(choiceQs, q => Math.max(...q.counts) / q.answered, 'min')?.key ?? null,
    mostHesitant: argBest(questions.filter(q => q.changes > 0), q => q.changes, 'max')?.key ?? null,
    quickest: quickest?.key ?? null,
    slowest: slowest && slowest !== quickest ? slowest.key : null,
  }

  return {
    generatedAt: Date.now(),
    questions,
    players: reviewPlayers,
    teams: reviewTeams,
    quizzes,
    records,
    unresolved: questions.filter(q => !q.resolved).length,
  }
}

function accuracyOf(rows: AnswerRow[]): number | null {
  const answered = rows.filter(r => r.kind === 'choice' && r.answered)
  return answered.length ? answered.filter(r => r.correct === true).length / answered.length : null
}

function avgMsOf(rows: AnswerRow[]): number | null {
  return average(rows.filter(r => r.answered && r.ms !== null).map(r => r.ms!))
}
