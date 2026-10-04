import type { PublicPlayer, PublicTeam } from '../../../shared/types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'

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

/** Au-delà, rien de plus : le bouton garde sa taille sur un petit téléphone. */
const AVATARS_MAX = 5

/**
 * Le choix d'équipe, sur le téléphone : de gros boutons, un par équipe —
 * l'emoji, le nom, et les avatars de ceux qui y sont déjà. Plus de texte
 * dessous (« personne », « 2 joueurs », les prénoms) : sobre (le
 * propriétaire du dépôt, le 4 octobre 2026). Les prénoms restent à
 * l'oreille, et au survol : on cherche encore « l'équipe de Sofia ».
 */
export function TeamPicker({ teams, value, onPick, disabled, players }: Props) {
  return (
    <div className="team-grid">
      {teams.map(t => {
        const membres = (players ?? []).filter(p => p.teamId === t.id)
        // Le prénom tel qu'il s'affiche : « Camille (2) » dit de quelle Camille on parle.
        const noms = membres.map(p => p.nomAffiche ?? p.name).join(', ')
        const choisie = t.id === value
        return (
          <button
            type="button"
            key={t.id}
            disabled={disabled}
            aria-pressed={choisie}
            className={'team-btn' + (choisie ? ' selected' : '')}
            onClick={() => onPick(t.id)}
            title={noms || undefined}
          >
            <span className="team-btn-emoji" aria-hidden="true">
              {t.emoji}
            </span>
            <span className="team-btn-name">{t.name}</span>
            {membres.length > 0 && (
              <span className="team-btn-avatars" aria-hidden="true">
                {membres.slice(0, AVATARS_MAX).map(p => (
                  <Avatar key={p.id} className="team-btn-av" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
                ))}
              </span>
            )}
            {noms && <span className="sr-only">, avec {noms}</span>}
            {choisie && <Icon name="check" className="team-btn-check" />}
          </button>
        )
      })}
    </div>
  )
}
