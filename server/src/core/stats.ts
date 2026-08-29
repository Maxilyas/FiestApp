import type { AnswerRow } from './answers'
import type { Award, PartyStats, PlayerStat, PublicPlayer } from '../../../shared/types'

/**
 * Statistiques de soirée et prix de fin de partie.
 *
 * Tout se calcule à partir du journal des réponses : une ligne par joueur et
 * par question posée, y compris les questions laissées passer. Le classement
 * ne suffirait pas — il ne retient que les gains positifs, donc ni les
 * erreurs, ni les temps de réponse, ni les absences.
 *
 * Les prix sont **proposés**, jamais appliqués : l'animateur choisit lesquels
 * il remet et combien de points ils valent. Un prix sans lauréat crédible
 * (personne n'a assez joué pour que le chiffre veuille dire quelque chose)
 * n'est simplement pas proposé.
 */

/** En dessous, une moyenne ne veut rien dire : trois réponses, c'est du hasard. */
const MIN_ANSWERS = 3
/** Idem pour les estimations, moins nombreuses dans un quiz. */
const MIN_GUESSES = 2

const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`
const percent = (r: number) => `${Math.round(r * 100)} %`
/** Le pluriel par défaut ajoute un « s » ; les mots qui s'y refusent le disent. */
const plural = (n: number, one: string, many = one + 's') => `${n} ${n > 1 ? many : one}`
const times = (n: number) => `${n} fois`
const rights = (n: number) => plural(n, 'bonne réponse', 'bonnes réponses')

export function computeStats(rows: AnswerRow[], players: PublicPlayer[]): PartyStats {
  const byId = new Map(players.map(p => [p.id, p]))
  const questionKey = (r: AnswerRow) => `${r.sessionId}#${r.qIndex}`

  // Répartition des réponses par question : elle sert au Franc-Tireur et au
  // Mouton, qui se jugent par rapport à ce que le reste de la salle a choisi.
  const choiceCounts = new Map<string, Map<number, number>>()
  for (const r of rows) {
    if (r.kind !== 'choice' || r.choice === null) continue
    const key = questionKey(r)
    const counts = choiceCounts.get(key) ?? new Map<number, number>()
    counts.set(r.choice, (counts.get(r.choice) ?? 0) + 1)
    choiceCounts.set(key, counts)
  }

  const stats: PlayerStat[] = []
  for (const player of players) {
    const mine = rows.filter(r => r.playerId === player.id)
    if (mine.length === 0) {
      // Inscrit mais jamais présent sur une question : aucune ligne à inventer.
      stats.push(emptyStat(player))
      continue
    }

    const answeredRows = mine.filter(r => r.answered)
    const choiceRows = answeredRows.filter(r => r.kind === 'choice')
    const correctRows = choiceRows.filter(r => r.correct === true)
    const guessRows = answeredRows.filter(r => r.kind === 'number' && r.target !== null)

    // Séries : on suit l'ordre où les questions ont été posées, et une
    // question laissée passer casse la série — ne pas répondre, ce n'est pas
    // répondre juste.
    let best = 0
    let worst = 0
    let runGood = 0
    let runBad = 0
    for (const r of mine) {
      if (r.kind !== 'choice') continue
      if (!r.answered) {
        // Ne pas répondre casse les deux séries sans en nourrir aucune :
        // sinon quelqu'un qui n'a jamais touché son téléphone décrocherait
        // le prix de la plus longue série de mauvaises réponses.
        runGood = 0
        runBad = 0
        continue
      }
      if (r.correct === true) {
        runGood++
        runBad = 0
      } else {
        runBad++
        runGood = 0
      }
      best = Math.max(best, runGood)
      worst = Math.max(worst, runBad)
    }

    let alone = 0
    let followed = 0
    for (const r of choiceRows) {
      const counts = choiceCounts.get(questionKey(r))
      if (!counts || r.choice === null) continue
      const mineCount = counts.get(r.choice) ?? 0
      if (mineCount === 1) alone++
      const top = Math.max(...counts.values())
      // « Suivre la majorité » n'a de sens que s'il y avait une majorité :
      // à deux réponses également choisies, personne n'a suivi personne.
      if (mineCount === top && [...counts.values()].filter(c => c === top).length === 1) followed++
    }

    const gaps = guessRows.map(r => Math.abs(r.value! - r.target!) / Math.max(1, Math.abs(r.target!)))
    const biases = guessRows.map(r => (r.value! - r.target!) / Math.max(1, Math.abs(r.target!)))

    stats.push({
      playerId: player.id,
      name: player.name,
      avatar: player.avatar,
      teamId: player.teamId,
      points: player.score,
      asked: mine.length,
      answered: answeredRows.length,
      missed: mine.length - answeredRows.length,
      correct: correctRows.length,
      wrong: choiceRows.length - correctRows.length,
      accuracy: choiceRows.length ? correctRows.length / choiceRows.length : null,
      avgMs: correctRows.length ? average(correctRows.map(r => r.ms ?? 0)) : null,
      bestMs: correctRows.length ? Math.min(...correctRows.map(r => r.ms ?? 0)) : null,
      bestStreak: best,
      worstStreak: worst,
      changes: mine.reduce((sum, r) => sum + r.changes, 0),
      lastSecond: answeredRows.filter(r => r.ms !== null && r.ms >= r.durationMs - 1000).length,
      alone,
      followed,
      guesses: guessRows.length,
      exact: guessRows.filter(r => r.value === r.target).length,
      avgGapPct: gaps.length ? average(gaps) : null,
      bias: biases.length ? average(biases) : null,
    })
  }

  const questions = new Set(rows.map(questionKey)).size
  return {
    players: stats.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'fr')),
    awards: buildAwards(stats, rows, byId),
    questions,
    logged: rows.length,
  }
}

function emptyStat(p: PublicPlayer): PlayerStat {
  return {
    playerId: p.id,
    name: p.name,
    avatar: p.avatar,
    teamId: p.teamId,
    points: p.score,
    asked: 0,
    answered: 0,
    missed: 0,
    correct: 0,
    wrong: 0,
    accuracy: null,
    avgMs: null,
    bestMs: null,
    bestStreak: 0,
    worstStreak: 0,
    changes: 0,
    lastSecond: 0,
    alone: 0,
    followed: 0,
    guesses: 0,
    exact: 0,
    avgGapPct: null,
    bias: null,
  }
}

const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

// ── Les prix ─────────────────────────────────────────────────────────────

interface Spec {
  key: string
  emoji: string
  title: string
  rule: string
  /** Qui peut prétendre au prix — les autres ne sont pas comparés. */
  eligible: (s: PlayerStat) => boolean
  /** Plus c'est grand, mieux c'est. Le vainqueur est le maximum. */
  score: (s: PlayerStat) => number
  detail: (s: PlayerStat) => string
}

const SPECS: Spec[] = [
  {
    key: 'eclair',
    emoji: '⚡',
    title: "L'Éclair",
    rule: 'Le temps de réponse moyen le plus court, sur ses bonnes réponses',
    eligible: s => s.correct >= MIN_ANSWERS && s.avgMs !== null,
    score: s => -s.avgMs!,
    detail: s => `${seconds(s.avgMs!)} de moyenne sur ${rights(s.correct)}`,
  },
  {
    key: 'contemplatif',
    emoji: '🐢',
    title: 'Le Contemplatif',
    rule: 'Le plus lent à répondre… mais il répond juste quand même',
    eligible: s => s.correct >= MIN_ANSWERS && s.avgMs !== null,
    score: s => s.avgMs!,
    detail: s => `${seconds(s.avgMs!)} de réflexion, et ${rights(s.correct)}`,
  },
  {
    key: 'gachette',
    emoji: '🔫',
    title: 'La Gâchette Facile',
    rule: 'Répond parmi les plus vite, et se trompe le plus souvent',
    eligible: s => s.wrong >= 2 && s.avgMs !== null && s.accuracy !== null && s.accuracy < 0.5,
    score: s => s.wrong / Math.max(1, s.avgMs! / 1000),
    detail: s => `${plural(s.wrong, 'erreur')} pour ${seconds(s.avgMs!)} de moyenne`,
  },
  {
    key: 'buzzer',
    emoji: '⏰',
    title: 'Le Buzzer de Fin',
    rule: 'A validé le plus souvent dans la toute dernière seconde',
    eligible: s => s.lastSecond >= 1,
    score: s => s.lastSecond,
    detail: s => `${plural(s.lastSecond, 'réponse')} arrachée${s.lastSecond > 1 ? 's' : ''} au chrono`,
  },
  {
    key: 'sansfaute',
    emoji: '💯',
    title: 'Le Sans-Faute',
    rule: 'Le meilleur pourcentage de bonnes réponses',
    eligible: s => s.correct + s.wrong >= MIN_ANSWERS && s.accuracy !== null,
    score: s => s.accuracy!,
    detail: s => `${percent(s.accuracy!)} de réussite sur ${plural(s.correct + s.wrong, 'question')}`,
  },
  {
    key: 'cancre',
    emoji: '🙃',
    title: 'Le Cancre Magnifique',
    rule: 'Le plus grand nombre de mauvaises réponses — un prix, pas une punition',
    eligible: s => s.wrong >= 2,
    score: s => s.wrong,
    detail: s => `${plural(s.wrong, 'réponse fausse', 'réponses fausses')}, et toujours souriant`,
  },
  {
    key: 'abstentionniste',
    emoji: '😴',
    title: "L'Abstentionniste",
    rule: 'A laissé passer le plus de questions sans rien envoyer',
    eligible: s => s.missed >= 2,
    score: s => s.missed,
    detail: s => `${plural(s.missed, 'question')} sans réponse`,
  },
  {
    key: 'invincible',
    emoji: '🔥',
    title: "L'Invincible",
    rule: "La plus longue série de bonnes réponses d'affilée",
    eligible: s => s.bestStreak >= 3,
    score: s => s.bestStreak,
    detail: s => `${rights(s.bestStreak)} sans faillir`,
  },
  {
    key: 'serienoire',
    emoji: '🌚',
    title: 'La Série Noire',
    rule: "La plus longue série de mauvaises réponses d'affilée",
    eligible: s => s.worstStreak >= 3,
    score: s => s.worstStreak,
    detail: s => `${plural(s.worstStreak, 'erreur')} à la suite`,
  },
  {
    key: 'devin',
    emoji: '🔮',
    title: 'Le Devin',
    rule: 'Le plus juste sur les questions chiffrées',
    eligible: s => s.guesses >= MIN_GUESSES && s.avgGapPct !== null,
    score: s => -s.avgGapPct!,
    detail: s => `${percent(s.avgGapPct!)} d'écart moyen sur ${plural(s.guesses, 'estimation')}`,
  },
  {
    key: 'optimiste',
    emoji: '🎈',
    title: "L'Optimiste",
    rule: "Voit toujours les choses en plus grand qu'elles ne sont",
    eligible: s => s.guesses >= MIN_GUESSES && s.bias !== null && s.bias > 0.05,
    score: s => s.bias!,
    detail: s => `${percent(s.bias!)} au-dessus de la vérité, en moyenne`,
  },
  {
    key: 'pessimiste',
    emoji: '🪨',
    title: 'Le Pessimiste',
    rule: 'Sous-estime tout, systématiquement',
    eligible: s => s.guesses >= MIN_GUESSES && s.bias !== null && s.bias < -0.05,
    score: s => -s.bias!,
    detail: s => `${percent(Math.abs(s.bias!))} en dessous de la vérité, en moyenne`,
  },
  {
    key: 'pilepoil',
    emoji: '🎯',
    title: 'Le Pile-Poil',
    rule: 'Le plus grand nombre d’estimations tombées exactement juste',
    eligible: s => s.exact >= 1,
    score: s => s.exact,
    detail: s => `${plural(s.exact, 'estimation')} au chiffre près`,
  },
  {
    key: 'franctireur',
    emoji: '🦄',
    title: 'Le Franc-Tireur',
    rule: 'Le plus souvent seul de toute la salle sur sa réponse',
    eligible: s => s.alone >= 2,
    score: s => s.alone,
    detail: s => `${times(s.alone)} seul contre tous`,
  },
  {
    key: 'mouton',
    emoji: '🐑',
    title: 'Le Mouton',
    rule: 'A le plus souvent choisi la réponse que tout le monde choisissait',
    eligible: s => s.followed >= 3,
    score: s => s.followed,
    detail: s => `${times(s.followed)} avec la majorité`,
  },
  {
    key: 'tremblant',
    emoji: '✋',
    title: 'Le Doigt qui Tremble',
    rule: 'A changé d’avis le plus souvent avant la révélation',
    eligible: s => s.changes >= 2,
    score: s => s.changes,
    detail: s => `${plural(s.changes, 'revirement')} de dernière minute`,
  },
]

function buildAwards(stats: PlayerStat[], rows: AnswerRow[], byId: Map<string, PublicPlayer>): Award[] {
  const awards: Award[] = []

  for (const spec of SPECS) {
    const pool = stats.filter(spec.eligible)
    if (pool.length === 0) continue
    // Départage par prénom : sans lui, deux ex æquo échangeraient le prix à
    // chaque rechargement de la page.
    const winner = [...pool].sort(
      (a, b) => spec.score(b) - spec.score(a) || a.name.localeCompare(b.name, 'fr'),
    )[0]
    awards.push({
      key: spec.key,
      emoji: spec.emoji,
      title: spec.title,
      rule: spec.rule,
      detail: spec.detail(winner),
      player: { playerId: winner.playerId, name: winner.name, avatar: winner.avatar },
      teamId: winner.teamId,
    })
  }

  const played = stats.filter(s => s.asked > 0)

  // ── Le Sauveur : il a trouvé une question que son équipe entière a ratée.
  const rescues = new Map<string, number>()
  const byQuestion = new Map<string, AnswerRow[]>()
  for (const r of rows) {
    const key = `${r.sessionId}#${r.qIndex}`
    byQuestion.set(key, [...(byQuestion.get(key) ?? []), r])
  }
  for (const group of byQuestion.values()) {
    for (const r of group) {
      if (r.kind !== 'choice' || r.correct !== true) continue
      const team = byId.get(r.playerId)?.teamId
      if (!team) continue
      const teammates = group.filter(o => o.playerId !== r.playerId && byId.get(o.playerId)?.teamId === team)
      if (teammates.length === 0) continue
      if (teammates.every(o => o.correct !== true)) rescues.set(r.playerId, (rescues.get(r.playerId) ?? 0) + 1)
    }
  }
  pushBest(awards, played, {
    key: 'sauveur',
    emoji: '🦸',
    title: 'Le Sauveur',
    rule: 'Le seul de son équipe à avoir trouvé, le plus souvent',
    value: s => rescues.get(s.playerId) ?? 0,
    min: 2,
    detail: s => `${times(rescues.get(s.playerId) ?? 0)} le sauveur de son équipe`,
  })

  // ── Remontada et Chute Libre : le rang au premier quiz contre le dernier.
  const sessions = [...new Set(rows.map(r => r.sessionId))]
  if (sessions.length >= 2) {
    const first = rankOfSession(rows, sessions[0])
    const last = rankOfSession(rows, sessions[sessions.length - 1])
    const move = (s: PlayerStat) => {
      const a = first.get(s.playerId)
      const b = last.get(s.playerId)
      // Absent de l'un des deux quiz : il n'a pas « progressé », il est arrivé.
      return a === undefined || b === undefined ? 0 : a - b
    }
    pushBest(awards, played, {
      key: 'remontada',
      emoji: '📈',
      title: 'La Remontada',
      rule: 'A le plus progressé entre le premier quiz et le dernier',
      value: move,
      min: 2,
      detail: s => `${plural(move(s), 'place')} gagnée${move(s) > 1 ? 's' : ''} en cours de soirée`,
    })
    pushBest(awards, played, {
      key: 'chutelibre',
      emoji: '📉',
      title: 'La Chute Libre',
      rule: 'A le plus reculé entre le premier quiz et le dernier',
      value: s => -move(s),
      min: 2,
      detail: s => `${plural(-move(s), 'place')} perdue${-move(s) > 1 ? 's' : ''}, et alors ?`,
    })
  }

  // ── L'Œil de Lynx : les questions dont la photo avait disparu.
  const observed = new Map<string, { good: number; total: number }>()
  for (const r of rows) {
    if (!r.observed || r.kind !== 'choice' || !r.answered) continue
    const cur = observed.get(r.playerId) ?? { good: 0, total: 0 }
    cur.total++
    if (r.correct === true) cur.good++
    observed.set(r.playerId, cur)
  }
  pushBest(awards, played, {
    key: 'lynx',
    emoji: '👁️',
    title: "L'Œil de Lynx",
    rule: 'La meilleure mémoire sur les questions à photo',
    value: s => {
      const o = observed.get(s.playerId)
      return o && o.total >= 2 ? o.good / o.total : 0
    },
    min: 0.5,
    detail: s => {
      const o = observed.get(s.playerId)!
      return `${o.good} sur ${o.total} de mémoire`
    },
  })

  // ── Les deux prix qui distinguent une équipe et non une personne.
  const withTeam = played.filter(s => s.teamId)
  if (withTeam.length > 0) {
    // Le Coup de Pouce : l'équipe qui compte la personne ayant le moins marqué.
    const lowest = [...withTeam].sort((a, b) => a.points - b.points || a.name.localeCompare(b.name, 'fr'))[0]
    awards.push({
      key: 'coupdepouce',
      emoji: '🤝',
      title: 'Le Coup de Pouce',
      rule: 'À l’équipe qui compte la personne ayant le moins marqué',
      detail: `${lowest.avatar} ${lowest.name} ferme la marche avec ${lowest.points} points`,
      player: null,
      teamId: lowest.teamId,
    })

    // La Plus Solidaire : le plus petit écart entre son meilleur et son moins bon.
    let bestTeam: string | null = null
    let bestSpread = Infinity
    for (const teamId of new Set(withTeam.map(s => s.teamId!))) {
      const points = withTeam.filter(s => s.teamId === teamId).map(s => s.points)
      if (points.length < 2) continue // un membre unique n'a pas d'écart interne
      const spread = Math.max(...points) - Math.min(...points)
      if (spread < bestSpread) {
        bestSpread = spread
        bestTeam = teamId
      }
    }
    if (bestTeam) {
      awards.push({
        key: 'solidaire',
        emoji: '⚖️',
        title: 'La Plus Solidaire',
        rule: 'L’équipe dont les membres se tiennent le plus près les uns des autres',
        detail: `${bestSpread} points d’écart entre son meilleur et son moins bon`,
        player: null,
        teamId: bestTeam,
      })
    }
  }

  return awards
}

/** Ajoute un prix si quelqu'un atteint le seuil — sinon on ne le propose pas. */
function pushBest(
  awards: Award[],
  pool: PlayerStat[],
  spec: {
    key: string
    emoji: string
    title: string
    rule: string
    value: (s: PlayerStat) => number
    min: number
    detail: (s: PlayerStat) => string
  },
) {
  const ranked = [...pool].sort(
    (a, b) => spec.value(b) - spec.value(a) || a.name.localeCompare(b.name, 'fr'),
  )
  const winner = ranked[0]
  if (!winner || spec.value(winner) < spec.min) return
  awards.push({
    key: spec.key,
    emoji: spec.emoji,
    title: spec.title,
    rule: spec.rule,
    detail: spec.detail(winner),
    player: { playerId: winner.playerId, name: winner.name, avatar: winner.avatar },
    teamId: winner.teamId,
  })
}

/** Le rang de chacun sur un quiz donné, d'après les points de ce quiz seul. */
function rankOfSession(rows: AnswerRow[], sessionId: string): Map<string, number> {
  const totals = new Map<string, number>()
  for (const r of rows) {
    if (r.sessionId !== sessionId) continue
    totals.set(r.playerId, (totals.get(r.playerId) ?? 0) + r.points)
  }
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
  return new Map(sorted.map(([playerId], i) => [playerId, i + 1]))
}
