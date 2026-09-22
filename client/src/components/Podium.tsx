import type { Distinctions } from '../../../shared/profil'
import { rangPartage } from '../../../shared/classement'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Rank } from './Rank'

export interface PodiumRow extends Distinctions {
  name: string
  avatar: string
  points: number
  /**
   * Le rang partagé, calculé sur le classement complet. Sans lui, on le
   * déduit des lignes reçues — juste tant qu'elles partent de la tête.
   */
  rank?: number
}

/**
 * Le rang de chaque ligne : celui qu'elle porte, sinon le rang partagé parmi
 * les lignes reçues. Numéroter par la position faisait de deux ex æquo un
 * premier et un deuxième, selon un ordre que personne ne choisit.
 */
function rangs(rows: PodiumRow[], offset: number): number[] {
  const points = rows.map(r => r.points)
  return rows.map(r => r.rank ?? offset + rangPartage(r.points, points))
}

/** Classement en liste, du 1er au dernier. */
export function Standings({ rows, offset = 0 }: { rows: PodiumRow[]; offset?: number }) {
  const rank = rangs(rows, offset)
  return (
    <div className="podium">
      {rows.map((p, i) => (
        <div key={i} className="lb-row" style={{ animationDelay: `${i * 60}ms` }}>
          <Rank n={rank[i]} />
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
 * quand l'écart est énorme. Chaque marche porte le rang partagé : deux ex
 * æquo en tête montent sur deux marches de premier, à la même hauteur.
 */
export function FinalPodium({ rows }: { rows: PodiumRow[] }) {
  const top = rows.slice(0, 3)
  if (top.length === 0) return <p className="muted">Personne n'a joué…</p>
  const rank = rangs(rows, 0)
  const best = Math.max(...top.map(r => r.points), 1)
  const order = [1, 0, 2] // 2e — 1er — 3e
  return (
    <div className="final-podium">
      {order.map((i, slot) => {
        const row = top[i]
        return row ? (
          <div key={slot} className={'podium-col rank-' + rank[i]}>
            <Avatar className="podium-avatar" avatar={row.avatar} finition={row.finition} eclat={row.eclat} />
            <span className="podium-name">
              {row.name}
              <Niveau niveau={row.niveau} />
            </span>
            <div className="podium-step" style={{ height: `${30 + 70 * (row.points / best)}%` }}>
              <span className="podium-medal">{rank[i]}</span>
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
