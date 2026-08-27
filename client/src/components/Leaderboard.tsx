import type { PublicPlayer } from '../../../shared/types'

interface Props {
  players: PublicPlayer[]
  compact?: boolean
  highlightId?: string
}

const MEDALS = ['🥇', '🥈', '🥉']

/**
 * Classement de la soirée.
 *
 * Deux règles qui comptent quand cinquante personnes regardent l'écran :
 * · à score égal, on affiche le même rang — deux personnes à 965 points ne
 *   sont pas 1ʳᵉ et 2ᵉ, elles sont premières toutes les deux ;
 * · le tri départage par prénom, sinon deux ex æquo échangeraient leur place
 *   à chaque rafraîchissement et le classement clignoterait.
 */
export function Leaderboard({ players, compact, highlightId }: Props) {
  const rows = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))
  const list = compact ? rows.slice(0, 8) : rows

  return (
    <div className="leaderboard">
      {list.map(p => {
        // Rang partagé : on remonte au premier joueur du même score.
        const rank = rows.findIndex(r => r.score === p.score) + 1
        return (
          <div key={p.id} className={'lb-row' + (p.id === highlightId ? ' me' : '')}>
            <span className="lb-rank">{MEDALS[rank - 1] ?? rank}</span>
            <span className="lb-avatar">{p.avatar}</span>
            <span className="lb-name">{p.name}</span>
            <span className="lb-score">{p.score}</span>
          </div>
        )
      })}
      {list.length === 0 && <p className="muted">Personne pour l'instant…</p>}
      {compact && rows.length > list.length && (
        <p className="muted center">et {rows.length - list.length} autres…</p>
      )}
    </div>
  )
}
