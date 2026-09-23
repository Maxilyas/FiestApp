import type { PublicPlayer } from '../../../shared/types'
import { classer } from '../../../shared/classement'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Rank } from './Rank'

interface Props {
  players: PublicPlayer[]
  compact?: boolean
  highlightId?: string
}

/**
 * Classement de la soirée.
 *
 * Deux règles qui comptent quand cinquante personnes regardent l'écran :
 * · à score égal, on affiche le même rang — deux personnes à 965 points ne
 *   sont pas 1ʳᵉ et 2ᵉ, elles sont premières toutes les deux ;
 * · le tri départage par prénom affiché, sinon deux ex æquo échangeraient
 *   leur place à chaque rafraîchissement et le classement clignoterait.
 *
 * C'est la règle commune (shared/classement.ts) : le podium, le souvenir et
 * le bilan écrivent les ex æquo dans ce même ordre.
 */
export function Leaderboard({ players, compact, highlightId }: Props) {
  const rows = classer(players, p => p.score, p => p.nomAffiche ?? p.name, p => p.id)
  const list = compact ? rows.slice(0, 8) : rows

  return (
    <div className="leaderboard">
      {list.map(({ item: p, rang }) => (
        <div key={p.id} className={'lb-row' + (p.id === highlightId ? ' me' : '')}>
          <Rank n={rang} />
          <Avatar className="lb-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
          <span className="lb-name">{p.nomAffiche ?? p.name}</span>
          <Niveau niveau={p.niveau} />
          <span className="lb-score">{p.score}</span>
        </div>
      ))}
      {list.length === 0 && <p className="muted">Personne pour l'instant…</p>}
      {compact && rows.length > list.length && (
        <p className="muted center">et {rows.length - list.length} autres…</p>
      )}
    </div>
  )
}
