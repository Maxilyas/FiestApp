import type { AnswerRow } from './answers'
import { computeStats } from './stats'
import type { PlayableQuestion } from '../../../shared/library'
import { equipeDeLaLigne, moyenneAuProrata, prixRemis, questionsDesEquipes, rankTeams, teamScores } from '../../../shared/teams'
import { nomAffiche } from '../../../shared/homonymes'
import { classer, ecartEstimation, ordreDeClassement, rangPartage, vainqueurs } from '../../../shared/classement'
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
        ecartEstimation(a.value!, target) - ecartEstimation(b.value!, target) || (a.ms ?? 0) - (b.ms ?? 0),
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
  const tied = vainqueurs([...totals.keys()], id => totals.get(id)!, id => nomAffiche(byId.get(id)!), id => id)
  if (tied.length === 0) return null
  if (previous && tied.includes(previous)) return previous
  return tied[0]
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
  // L'équipe de chaque ligne est celle qu'elle a figée en s'écrivant
  // (`equipeDeLaLigne`) : la moyenne, la réussite et le détail de chaque
  // question lisent les mêmes lignes, quoi que le joueur ait fait depuis.
  const equipeDuMoment = new Map(players.flatMap(p => (p.teamId ? [[p.id, p.teamId] as const] : [])))
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
      // Le plus petit écart de la salle : tous ceux qui l'atteignent sont « les
      // plus proches » — la rapidité ne départage plus deux réponses égales,
      // ni au barème ni ici. Le bilan qui n'en nommait qu'un couronnait le
      // plus rapide de deux « 1994 » payés pareil.
      const ecart = (r: AnswerRow) => ecartEstimation(r.value!, target!)
      const ecarts = guesses.map(g => -ecart(g))
      const plusPetitEcart = guesses[0] ? ecart(guesses[0]) : null
      const closest = guesses.filter(g => ecart(g) === plusPetitEcart).map(g => ({ playerId: g.playerId, value: g.value! }))

      const byTeam: TeamOnQuestion[] = []
      for (const t of teams) {
        const tRows = qRows.filter(r => equipeDeLaLigne(r, equipeDuMoment) === t.id)
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
        // Le rang de proximité, celui que montre l'écran commun : partagé à
        // égalité d'écart. Il ne fait plus les points — la distance les fait
        // (`quiz.ts`) —, mais il dit encore qui visait le plus juste.
        const proximityRank = r.answered && r.value !== null && target !== null ? rangPartage(-ecart(r), ecarts) : 0
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
          } else if (plusPetitEcart !== null && ecart(r) === plusPetitEcart && guesses.length >= 2) {
            push(r.playerId, { kind: 'closest', questionKey: key, text: "L'estimation la plus proche de toute la salle" })
          }
        }
      }
    }
  })

  // ── Les rangs par quiz : partagés à égalité, comme partout ailleurs.
  const nomDe = (playerId: string) => nomAffiche(byId.get(playerId)!)
  const sessionRanks = sessionTotals.map(
    totals =>
      new Map(
        classer([...totals.keys()], id => totals.get(id)!, nomDe, id => id).map(({ item, rang }) => [item, rang]),
      ),
  )

  // ── Les joueurs, dans l'ordre commun : à égalité, le prénom AFFICHÉ. Le
  // prénom nu laissait deux « Camille » dans l'ordre du registre, qui n'est
  // pas le même en direct et dans l'archive.
  const stats = computeStats(rows, players)
  const statById = new Map(stats.players.map(s => [s.playerId, s]))
  const sortedPlayers = [...players].sort(ordreDeClassement<PublicPlayer>(p => p.score, nomAffiche, p => p.id))
  const reviewPlayers: ReviewPlayer[] = sortedPlayers.map(p => {
    const mates = p.teamId ? sortedPlayers.filter(o => o.teamId === p.teamId) : []
    return {
      id: p.id,
      // Le prénom tel qu'on l'affiche : c'est lui que le bilan imprime, et il
      // doit dire la même chose que le classement de la soirée.
      name: nomAffiche(p),
      avatar: p.avatar,
      teamId: p.teamId,
      points: p.score,
      rank: sharedRank(sortedPlayers, p, o => o.score),
      teamRank: p.teamId ? sharedRank(mates, p, o => o.score) : null,
      stat: statById.get(p.id)!,
      answers: answersByPlayer.get(p.id) ?? [],
      awards: stats.awards
        .filter(a => a.player?.playerId === p.id)
        .map(a => ({ emoji: a.emoji, title: a.title, detail: a.detail, ...(a.exAequo && { exAequo: a.exAequo }) })),
      highlights: highlightsByPlayer.get(p.id) ?? [],
      perQuiz: sessions.map((g, i) => ({
        sessionId: g.id,
        points: sessionTotals[i].get(p.id) ?? 0,
        rank: sessionRanks[i].get(p.id) ?? null,
      })),
    }
  })

  // ── Les équipes
  // La règle de la salle (`shared/teams.ts`), quiz par quiz : le bilan
  // divisait par les présents au quiz quand la victoire divisait par tous
  // les membres, et un invité arrivé après le quiz changeait l'un sans
  // l'autre.
  const parQuiz = sessions.map(g => questionsDesEquipes(players, rows.filter(r => r.sessionId === g.id)))
  const reviewTeams: ReviewTeam[] = rankTeams(teamScores(teams, players, bonuses, questionsDesEquipes(players, rows))).map(t => {
    const members = sortedPlayers.filter(p => p.teamId === t.id)
    // Les lignes jouées pour l'équipe, comme la moyenne les range : celles
    // d'un membre parti ailleurs après le quiz restent ici.
    const tRows = rows.filter(r => equipeDeLaLigne(r, equipeDuMoment) === t.id)
    const perQuiz: ReviewTeamQuiz[] = sessions.map((g, i) => {
      const sRows = tRows.filter(r => r.sessionId === g.id)
      const total = sum(sRows.map(r => r.points))
      return {
        sessionId: g.id,
        total,
        average: moyenneAuProrata(parQuiz[i].get(t.id) ?? []),
        accuracy: accuracyOf(sRows),
        avgMs: avgMsOf(sRows),
        rank: 0,
      }
    })
    // Estimation par estimation, pas membre par membre : celui qui en a joué
    // deux ne pèse pas autant que celle qui en a joué trente.
    const mesurees = members.map(p => statById.get(p.id)!).filter(s => s.coupDOeil !== null)
    const comparees = sum(mesurees.map(s => s.estimationsComparees))
    return {
      ...t,
      accuracy: accuracyOf(tRows),
      coupDOeil: comparees ? sum(mesurees.map(s => s.coupDOeil! * s.estimationsComparees)) / comparees : null,
      avgMs: avgMsOf(tRows),
      best: members[0] ? { playerId: members[0].id, points: members[0].score } : null,
      perQuiz,
    }
  })
  sessions.forEach((_, i) => {
    for (const { item, rang } of classer(reviewTeams, t => t.perQuiz[i].average, t => t.name, t => t.id)) {
      item.perQuiz[i].rank = rang
    }
  })

  // ── Les quiz. Leurs vainqueurs suivent la règle commune : des ex æquo
  // gagnent ensemble, et le bilan les nomme tous, comme le souvenir et dans
  // le même ordre. Il n'avait la place que d'un nom : à 300–300, l'une des
  // deux gagnantes y lisait que l'autre avait gagné seule.
  const quizzes: ReviewQuiz[] = sessions.map((g, i) => {
    const totals = sessionTotals[i]
    const winners = vainqueurs([...totals.keys()], id => totals.get(id)!, nomDe, id => id).map(id => ({
      playerId: id,
      points: totals.get(id)!,
    }))
    const teamWinners = vainqueurs(reviewTeams, t => t.perQuiz[i].average, t => t.name, t => t.id).map(t => ({
      teamId: t.id,
      average: t.perQuiz[i].average,
    }))
    return {
      sessionId: g.id,
      number: i + 1,
      title: input.packsBySession.get(g.id)?.title ?? g.title,
      questionCount: g.questions.length,
      startedAt: g.startedAt,
      players: totals.size,
      winners,
      teamWinners,
      winner: winners[0] ?? null,
      teamWinner: teamWinners[0] ?? null,
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
    bonuses: prixRemis(bonuses, teams),
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
