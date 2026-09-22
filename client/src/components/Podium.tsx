import type { Distinctions } from '../../../shared/profil'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Rank } from './Rank'

export interface PodiumRow extends Distinctions {
  name: string
  avatar: string
  points: number
}

/** Classement en liste, du 1er au dernier. */
export function Standings({ rows, offset = 0 }: { rows: PodiumRow[]; offset?: number }) {
  return (
    <div className="podium">
      {rows.map((p, i) => (
        <div key={i} className="lb-row" style={{ animationDelay: `${i * 60}ms` }}>
          <Rank n={i + offset + 1} />
          <Avatar className="lb-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} />
          <span className="lb-name">{p.name}</span>
          <Niveau niveau={p.niveau} />
          <span className="lb-score">{p.points}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Les trois marches montent depuis le bas, la première au milieu. La hauteur
 * suit le score, avec un plancher pour que la 3e marche reste visible même
 * quand l'écart est énorme.
 */
export function FinalPodium({ rows }: { rows: PodiumRow[] }) {
  const top = rows.slice(0, 3)
  if (top.length === 0) return <p className="muted">Personne n'a joué…</p>
  const best = Math.max(...top.map(r => r.points), 1)
  const order = [top[1], top[0], top[2]] // 2e — 1er — 3e
  return (
    <div className="final-podium">
      {order.map((row, slot) => {
        const rank = slot === 1 ? 1 : slot === 0 ? 2 : 3
        return row ? (
          <div key={slot} className={'podium-col rank-' + rank}>
            <Avatar className="podium-avatar" avatar={row.avatar} finition={row.finition} eclat={row.eclat} />
            <span className="podium-name">
              {row.name}
              <Niveau niveau={row.niveau} />
            </span>
            <div className="podium-step" style={{ height: `${30 + 70 * (row.points / best)}%` }}>
              <span className="podium-medal">{rank}</span>
              <span className="podium-points">{row.points}</span>
            </div>
          </div>
        ) : (
          <div key={slot} className="podium-col" />
        )
      })}
    </div>
  )
}
