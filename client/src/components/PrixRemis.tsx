import type { PublicTeam, TeamBonus } from '../../../shared/types'

/**
 * Les prix que l'animateur a remis à l'écran, dans l'ordre où il les a
 * remis — au souvenir et au bilan. Le palmarès, à côté, dit ce que
 * l'application a calculé, remis ou non ; ici, seulement ce que la salle a
 * vu remettre, et les prix libres (« Le coup de cœur de Sam ») qui
 * n'existent nulle part ailleurs.
 */
export function PrixRemis({ bonuses, teams }: { bonuses: TeamBonus[]; teams: PublicTeam[] }) {
  const teamById = new Map(teams.map(t => [t.id, t]))
  return (
    <ul className="given-list given-lendemain">
      {bonuses.map(b => {
        const team = teamById.get(b.teamId)
        return (
          <li key={b.id} className="given-row">
            <span className="given-points">
              {b.points > 0 ? '+' : b.points < 0 ? '−' : ''}
              {Math.abs(b.points)}
              <span className="sr-only"> point{Math.abs(b.points) > 1 ? 's' : ''}</span>
            </span>
            <span className="given-body">
              <span className="given-title">{b.reason}</span>
              {team && (
                <span className="given-team">
                  {team.emoji} {team.name}
                </span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
