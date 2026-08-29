import type { PublicTeam } from '../../../shared/types'

interface Props {
  teams: PublicTeam[]
  value: string | null
  onPick: (teamId: string) => void
  disabled?: boolean
}

/** Le choix d'équipe, sur le téléphone : de gros boutons, un par équipe. */
export function TeamPicker({ teams, value, onPick, disabled }: Props) {
  return (
    <div className="team-grid">
      {teams.map(t => (
        <button
          type="button"
          key={t.id}
          disabled={disabled}
          className={'team-btn' + (t.id === value ? ' selected' : '')}
          onClick={() => onPick(t.id)}
        >
          <span className="team-btn-emoji">{t.emoji}</span>
          <span className="team-btn-name">{t.name}</span>
          <span className="team-btn-count">
            {t.memberCount === 0 ? 'personne' : `${t.memberCount} joueur${t.memberCount > 1 ? 's' : ''}`}
          </span>
        </button>
      ))}
    </div>
  )
}
