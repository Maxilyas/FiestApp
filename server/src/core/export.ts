import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@libsql/client'
import { QuizStore } from './quizStore'
import { toRow } from './answers'
import { buildReview } from './review'
import { ArchiveStore, reviewOfArchive } from './archive'
import { playableQuestions } from '../../../shared/library'
import {
  answerLabel,
  formatPercent,
  formatSeconds,
  questionLabel,
  type Review,
  type ReviewQuestion,
} from '../../../shared/review'
import type { PublicPlayer, TeamBonus } from '../../../shared/types'

/**
 * L'export de la soirée en fichiers : le bilan complet en JSON, et trois CSV
 * qui s'ouvrent dans Excel — une ligne par invité avec une colonne par
 * question, une ligne par question, une ligne par équipe.
 *
 * Le bilan vient soit du serveur (son adresse est publique, c'est le plus
 * simple), soit directement de la base distante, pour le jour où le serveur
 * ne répond plus : les tables `party_*` y sont recopiées pendant la fête.
 */

export async function reviewFromServer(base: string, archiveId?: string): Promise<Review> {
  const root = base.replace(/\/+$/, '')
  const res = await fetch(archiveId ? `${root}/soirees/${archiveId}/bilan.json` : `${root}/bilan.json`)
  if (!res.ok) throw new Error(`${base} répond ${res.status}`)
  return (await res.json()) as Review
}

/**
 * Lit la soirée dans la base : les invités, les équipes, les points, les
 * prix et le journal des réponses tels que le serveur les y a recopiés, et
 * la bibliothèque pour retrouver les intitulés.
 */
export async function reviewFromDatabase(dbUrl: string, token?: string, archiveId?: string): Promise<Review> {
  // Une soirée archivée est déjà complète : ses questions voyagent avec elle.
  if (archiveId) {
    const archives = new ArchiveStore(dbUrl, token)
    await archives.init()
    const found = await archives.get(archiveId)
    archives.close()
    if (!found) throw new Error(`Soirée « ${archiveId} » introuvable dans l'historique`)
    return { ...reviewOfArchive(found.archive), archive: found.summary }
  }
  const client = createClient({ url: dbUrl, authToken: token })
  const [players, teams, scores, bonuses, answers] = await Promise.all([
    client.execute('SELECT * FROM party_players'),
    client.execute('SELECT * FROM party_teams ORDER BY position'),
    client.execute('SELECT player_id, SUM(points) AS total FROM party_scores GROUP BY player_id'),
    client.execute('SELECT * FROM party_bonus ORDER BY created_at'),
    client.execute('SELECT * FROM party_answers ORDER BY created_at, q_index'),
  ])
  client.close()
  const totals = new Map(scores.rows.map(r => [String(r.player_id), Number(r.total ?? 0)]))
  const store = new QuizStore(dbUrl, token)
  const library = (await store.all()).map(q => ({ title: q.title, questions: playableQuestions(q) }))
  store.close()

  return buildReview({
    rows: answers.rows.map(toRow),
    players: players.rows.map(
      (r): PublicPlayer => ({
        id: String(r.id),
        name: String(r.name),
        avatar: String(r.avatar),
        connected: false,
        score: totals.get(String(r.id)) ?? 0,
        teamId: r.team_id === null || r.team_id === undefined ? null : String(r.team_id),
      }),
    ),
    teams: teams.rows.map(r => ({
      id: String(r.id),
      name: String(r.name),
      emoji: String(r.emoji),
      position: Number(r.position),
    })),
    bonuses: bonuses.rows.map(
      (r): TeamBonus => ({
        id: String(r.id),
        teamId: String(r.team_id),
        points: Number(r.points),
        reason: String(r.reason),
        createdAt: Number(r.created_at),
      }),
    ),
    // Les copies exactes des parties vivent sur le disque du serveur, pas
    // dans la base : ici, tout passe par la bibliothèque.
    packsBySession: new Map(),
    library,
  })
}

// ── CSV ──────────────────────────────────────────────────────────────────

/** Point-virgule et BOM : ce qu'Excel en français ouvre sans rien demander. */
export function toCsv(rows: unknown[][]): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n') + '\r\n'
}

const pct = (r: number | null) => (r === null ? '' : formatPercent(r))
const secs = (ms: number | null) => (ms === null ? '' : formatSeconds(ms))
const short = (s: string, max = 70) => (s.length > max ? s.slice(0, max - 1) + '…' : s)
const rank = (n: number) => `${n}${n === 1 ? 'ᵉʳ' : 'ᵉ'}`

/** Les quatre fichiers, prêts à écrire : leur nom et leur contenu. */
export function exportFiles(review: Review): { name: string; content: string }[] {
  const playerById = new Map(review.players.map(p => [p.id, p]))
  const teamById = new Map(review.teams.map(t => [t.id, t]))
  const teamName = (id: string | null) => {
    const t = id ? teamById.get(id) : undefined
    return t ? `${t.emoji} ${t.name}` : ''
  }
  const who = (id: string | null | undefined) => (id ? (playerById.get(id)?.name ?? '') : '')
  const played = review.players.filter(p => p.stat.asked > 0)
  const heading = (q: ReviewQuestion) => `${questionLabel(q)} (quiz ${q.quizNumber}) — ${short(q.text)}`

  // Une ligne par invité, une colonne par question.
  const guests: unknown[][] = [
    [
      'Prénom', 'Avatar', 'Équipe', 'Points', 'Rang', "Rang dans l'équipe", 'Questions', 'Répondu', 'Justes',
      'Fausses', 'Passées', 'Réussite', 'Temps moyen', 'Meilleur temps', 'Estimations', 'Prix',
      ...review.questions.map(heading),
    ],
    ...played.map(p => {
      const byKey = new Map(p.answers.map(a => [a.questionKey, a]))
      const s = p.stat
      return [
        p.name, p.avatar, teamName(p.teamId), p.points, p.rank, p.teamRank ?? '', s.asked, s.answered, s.correct,
        s.wrong, s.missed, pct(s.accuracy), secs(s.avgMs), secs(s.bestMs), s.guesses,
        p.awards.map(a => `${a.emoji} ${a.title}`).join(', '),
        ...review.questions.map(q => {
          const a = byKey.get(q.key)
          if (!a) return 'pas encore là'
          if (!a.answered) return '—'
          const when = a.ms !== null ? ` · ${formatSeconds(a.ms)}` : ''
          if (q.kind === 'number') {
            const near = a.proximityRank !== null ? ` · ${rank(a.proximityRank)} plus proche` : ''
            return `${a.value} ${q.unit} (vrai : ${q.target ?? '?'})${near}${when} · ${a.points} pts`
          }
          return `${answerLabel(q, a.choice)} ${a.correct ? '✔' : '✘'}${when} · ${a.points} pts`
        }),
      ]
    }),
  ]

  // Une ligne par question : ce que la salle et chaque équipe en ont fait.
  const questions: unknown[][] = [
    [
      'N°', 'Quiz', 'Question', 'Type', 'Bonne réponse', 'Posée à', 'Répondu', 'Justes', 'Réussite',
      'Temps moyen', 'Plus rapide', 'Changements d’avis', 'Réponse 1', 'Réponse 2', 'Réponse 3', 'Réponse 4',
      ...review.teams.map(t => `${t.emoji} ${t.name}`),
    ],
    ...review.questions.map(q => {
      const byTeam = new Map(q.byTeam.map(t => [t.teamId, t]))
      const note = (q.resolved ? '' : ' (intitulé non retrouvé)') + (q.uncertain ? ' (quiz modifié depuis)' : '')
      return [
        q.order, q.quizTitle, q.text + note,
        q.kind === 'number' ? 'Estimation' : 'QCM',
        q.kind === 'number' ? `${q.target ?? '?'} ${q.unit}`.trim() : answerLabel(q, q.correct),
        q.asked, q.answered, q.kind === 'number' ? '' : q.correctCount,
        q.kind === 'number' ? '' : pct(q.answered ? q.correctCount / q.answered : null),
        secs(q.avgMs),
        q.kind === 'number'
          ? q.closest ? `${who(q.closest.playerId)} (${q.closest.value} ${q.unit})`.trim() : ''
          : q.fastest ? `${who(q.fastest.playerId)} (${formatSeconds(q.fastest.ms)})` : '',
        q.changes,
        ...[0, 1, 2, 3].map(i => (q.answers[i] === undefined ? '' : `${q.answers[i]} : ${q.counts[i]}`)),
        ...review.teams.map(t => {
          const s = byTeam.get(t.id)
          if (!s) return ''
          return q.kind === 'number' ? `${s.points} pts` : `${s.correct}/${s.asked}`
        }),
      ]
    }),
  ]

  // Une ligne par équipe, un quiz par colonne.
  const teams: unknown[][] = [
    [
      'Équipe', 'Membres', 'Total', 'Moyenne', 'Rang', 'Barème', 'Prix', 'Réussite', 'Temps moyen', 'Meilleur membre',
      ...review.quizzes.map(z => `Quiz ${z.number} — ${short(z.title, 40)}`),
    ],
    ...review.teams.map(t => [
      `${t.emoji} ${t.name}`, t.memberCount, t.total, t.average, t.rank, t.gamePoints, t.bonus, pct(t.accuracy),
      secs(t.avgMs), t.best ? `${who(t.best.playerId)} (${t.best.points} pts)` : '',
      ...t.perQuiz.map(pq => `${pq.average} (${rank(pq.rank)})`),
    ]),
  ]

  return [
    { name: 'bilan.json', content: JSON.stringify(review, null, 2) },
    { name: 'invites.csv', content: toCsv(guests) },
    { name: 'questions.csv', content: toCsv(questions) },
    { name: 'equipes.csv', content: toCsv(teams) },
  ]
}

/** Écrit les quatre fichiers dans le dossier, créé au besoin. Renvoie leurs chemins. */
export function writeExport(review: Review, dir: string): string[] {
  mkdirSync(dir, { recursive: true })
  return exportFiles(review).map(f => {
    const file = path.join(dir, f.name)
    writeFileSync(file, f.content, 'utf8')
    return file
  })
}
