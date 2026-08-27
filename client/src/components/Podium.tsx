export interface PodiumRow {
  name: string
  avatar: string
  points: number
}

const MEDALS = ['🥇', '🥈', '🥉']

/** Classement en liste, du 1er au dernier. */
export function Standings({ rows, offset = 0 }: { rows: PodiumRow[]; offset?: number }) {
  return (
    <div className="podium">
      {rows.map((p, i) => (
        <div key={i} className="lb-row" style={{ animationDelay: `${i * 60}ms` }}>
          <span className="lb-rank">{MEDALS[i + offset] ?? i + offset + 1}</span>
          <span className="lb-avatar">{p.avatar}</span>
          <span className="lb-name">{p.name}</span>
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
      {order.map((row, slot) =>
        row ? (
          <div key={slot} className={'podium-col rank-' + (slot === 1 ? 1 : slot === 0 ? 2 : 3)}>
            <span className="podium-avatar">{row.avatar}</span>
            <span className="podium-name">{row.name}</span>
            <div className="podium-step" style={{ height: `${30 + 70 * (row.points / best)}%` }}>
              <span className="podium-medal">{MEDALS[slot === 1 ? 0 : slot === 0 ? 1 : 2]}</span>
              <span className="podium-points">{row.points}</span>
            </div>
          </div>
        ) : (
          <div key={slot} className="podium-col" />
        ),
      )}
    </div>
  )
}
