import type { PublicPlayer, PublicTeam } from '../../../shared/types'

interface Props {
  teams: PublicTeam[]
  value: string | null
  onPick: (teamId: string) => void
  disabled?: boolean
  /**
   * Les invités de la soirée : on choisit une équipe pour ceux qui y sont.
   * Sans leurs prénoms, Camille M. a dû crier « Sofia, t'es dans quelle
   * équipe ?? » à travers le salon.
   */
  players?: PublicPlayer[]
}

/** Au-delà, « +N » : le bouton garde sa taille sur un petit téléphone. */
const PRENOMS_MAX = 3

/** Le choix d'équipe, sur le téléphone : de gros boutons, un par équipe. */
export function TeamPicker({ teams, value, onPick, disabled, players }: Props) {
  return (
    <div className="team-grid">
      {teams.map(t => {
        // Le prénom tel qu'il s'affiche : « Camille (2) » dit de quelle Camille on parle.
        const membres = (players ?? []).filter(p => p.teamId === t.id).map(p => p.nomAffiche ?? p.name)
        const reste = membres.length - PRENOMS_MAX
        return (
          <button
            type="button"
            key={t.id}
            disabled={disabled}
            aria-pressed={t.id === value}
            className={'team-btn' + (t.id === value ? ' selected' : '')}
            onClick={() => onPick(t.id)}
          >
            <span className="team-btn-emoji">{t.emoji}</span>
            <span className="team-btn-name">{t.name}</span>
            <span className="team-btn-count">
              {t.memberCount === 0 ? 'personne' : `${t.memberCount} joueur${t.memberCount > 1 ? 's' : ''}`}
            </span>
            {membres.length > 0 && (
              <span className="team-btn-membres">
                {membres.slice(0, PRENOMS_MAX).join(', ')}
                {reste > 0 && ` +${reste}`}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
