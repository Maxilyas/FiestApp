import type { PublicPlayer } from '../../../shared/types'

interface Props {
  players: PublicPlayer[]
  compact?: boolean
  highlightId?: string
}

const MEDALS = ['🥇', '🥈', '🥉']

export function Leaderboard({ players, compact, highlightId }: Props) {
  const rows = [...players].sort((a, b) => b.score - a.score)
  const list = compact ? rows.slice(0, 8) : rows

  return (
    <div className="leaderboard">
      {list.map((p, i) => (
        <div key={p.id} className={'lb-row' + (p.id === highlightId ? ' me' : '')}>
          <span className="lb-rank">{MEDALS[i] ?? i + 1}</span>
          <span className="lb-avatar">{p.avatar}</span>
          <span className="lb-name">{p.name}</span>
          <span className="lb-score">{p.score}</span>
        </div>
      ))}
      {list.length === 0 && <p className="muted">Personne pour l'instant…</p>}
    </div>
  )
}
