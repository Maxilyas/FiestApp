import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { clientDistant, type Client } from './distante'
import { QuizStore } from './quizStore'
import { toRow } from './answers'
import { buildReview } from './review'
import { ArchiveStore, reviewOfArchive } from './archive'
import { playableQuestions } from '../../../shared/library'
import { nomsAffiches } from '../../../shared/homonymes'
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
 *
 * Une soirée appartient à un espace, désigné par son nom dans l'adresse ;
 * sans nom, c'est l'espace par défaut — celui de l'administrateur.
 */

export interface ExportTarget {
  /** Le nom de l'espace dans l'adresse (`romane`). Absent : l'espace par défaut. */
  slug?: string
  /** Une soirée de l'historique plutôt que celle en cours. */
  archiveId?: string
}

export async function reviewFromServer(base: string, target: ExportTarget = {}): Promise<Review> {
  const root = base.replace(/\/+$/, '')
  const tail = target.archiveId ? `/soirees/${target.archiveId}/bilan.json` : '/bilan.json'
  // Sans nom d'espace, l'ancienne adresse redirige vers l'espace par défaut.
  const res = await fetch(target.slug ? `${root}/s/${target.slug}${tail}` : `${root}${tail}`)
  if (!res.ok) throw new Error(`${base} répond ${res.status}`)
  return (await res.json()) as Review
}

/**
 * Lit la soirée dans la base : les invités, les équipes, les points, les
 * prix et le journal des réponses tels que le serveur les y a recopiés, et
 * la bibliothèque pour retrouver les intitulés.
 */
export async function reviewFromDatabase(dbUrl: string, token?: string, target: ExportTarget = {}): Promise<Review> {
  // Avec le délai des magasins : c'est le jour où le serveur ne répond plus
  // qu'on exporte depuis la base, et une base muette faisait alors attendre
  // le script cinq minutes sans un mot, dès la première requête.
  const client = clientDistant(dbUrl, token)
  const spaceId = await resolveSpace(client, target.slug)
  // Une soirée archivée est déjà complète : ses questions voyagent avec elle.
  if (target.archiveId) {
    client.close()
    const archives = new ArchiveStore(dbUrl, token)
    await archives.init(spaceId)
    const found = await archives.get(spaceId, target.archiveId)
    archives.close()
    if (!found) throw new Error(`Soirée « ${target.archiveId} » introuvable dans l'historique`)
    return { ...reviewOfArchive(found.archive), archive: found.summary }
  }
  const [players, teams, scores, bonuses, answers] = await Promise.all([
    client.execute({ sql: 'SELECT * FROM party_players WHERE space_id = ?', args: [spaceId] }),
    client.execute({ sql: 'SELECT * FROM party_teams WHERE space_id = ? ORDER BY position', args: [spaceId] }),
    client.execute({
      sql: 'SELECT player_id, SUM(points) AS total FROM party_scores WHERE space_id = ? GROUP BY player_id',
      args: [spaceId],
    }),
    client.execute({ sql: 'SELECT * FROM party_bonus WHERE space_id = ? ORDER BY created_at', args: [spaceId] }),
    client.execute({
      sql: 'SELECT * FROM party_answers WHERE space_id = ? ORDER BY created_at, q_index',
      args: [spaceId],
    }),
  ])
  client.close()
  const totals = new Map(scores.rows.map(r => [String(r.player_id), Number(r.total ?? 0)]))
  const store = new QuizStore(dbUrl, token)
  const library = (await store.all(spaceId)).map(q => ({ title: q.title, questions: playableQuestions(q) }))
  store.close()

  // Les marques d'homonymie, dans l'ordre d'arrivée comme sur l'écran commun :
  // sans elles, deux « Camille » au renard sortaient en deux lignes
  // identiques dans invites.csv. La table, elle, n'est pas rangée par arrivée.
  const inscrits = [...players.rows]
    .sort((a, b) => Number(a.created_at) - Number(b.created_at))
    .map(r => ({
      id: String(r.id),
      name: String(r.name),
      avatar: String(r.avatar),
      teamId: r.team_id === null || r.team_id === undefined ? null : String(r.team_id),
    }))
  const marques = nomsAffiches(inscrits)

  return buildReview({
    rows: answers.rows.map(toRow),
    players: inscrits.map(
      (p): PublicPlayer => ({
        ...p,
        connected: false,
        score: totals.get(p.id) ?? 0,
        ...(marques.has(p.id) && { nomAffiche: marques.get(p.id) }),
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

/** L'identifiant de l'espace derrière un nom d'adresse — ou l'espace par défaut. */
async function resolveSpace(client: Client, slug?: string): Promise<string> {
  if (slug) {
    const res = await client.execute({ sql: 'SELECT id FROM accounts WHERE slug = ?', args: [slug] })
    if (!res.rows[0]) throw new Error(`Aucun espace « ${slug} »`)
    return String(res.rows[0].id)
  }
  const res = await client.execute({ sql: 'SELECT value FROM meta WHERE key = ?', args: ['default_space'] })
  if (!res.rows[0]) throw new Error('Aucun espace par défaut : le serveur n’a jamais démarré sur cette base')
  return String(res.rows[0].value)
}

// ── CSV ──────────────────────────────────────────────────────────────────

/**
 * Ce par quoi Excel reconnaît une formule. Un invité prénommé
 * « =HYPERLINK(…) » glissait un lien piégé dans le tableau de l'animateur,
 * qui l'ouvre en confiance : c'est lui qui l'a exporté.
 */
const FORMULE = /^[=+\-@\t\r]/

/**
 * Point-virgule et BOM : ce qu'Excel en français ouvre sans rien demander.
 * Une cellule qui commence comme une formule prend une apostrophe devant, et
 * reste du texte. Les nombres restent des nombres : −40 n'est pas une formule.
 */
export function toCsv(rows: unknown[][]): string {
  const cell = (v: unknown) => {
    if (typeof v === 'number') return String(v)
    let s = v === null || v === undefined ? '' : String(v)
    if (FORMULE.test(s)) s = `'${s}`
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
          ? q.closest.map(c => `${who(c.playerId)} (${c.value} ${q.unit})`.trim()).join(', ')
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
