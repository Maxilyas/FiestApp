import { useEffect, useRef } from 'react'
import type { PublicTeam, TeamBonus } from '../../../shared/types'
import { Icon } from './Icon'
import { TeamBoard } from './TeamBoard'
import { espacesFines } from '../format'
import { sound } from '../sound'

/**
 * La remise des prix telle que la salle la voit, quand la grille est dans la
 * main de l'animateur — à la télécommande. Projetée, la grille montrait les
 * quinze lauréats avant qu'il ouvre la bouche, et sa consigne (« tant que tu
 * ne cliques pas… ») parlait à lui, pas à la salle. Ici : le dernier prix
 * remis, en grand, et ce qu'il fait au classement des équipes.
 */
export function RemiseEnScene({ bonuses, teams }: { bonuses: TeamBonus[]; teams: PublicTeam[] }) {
  const dernier = bonuses.reduce<TeamBonus | null>((a, b) => (!a || b.createdAt >= a.createdAt ? b : a), null)
  const equipe = dernier ? teams.find(t => t.id === dernier.teamId) : undefined

  // Le prix remis sonne sur l'écran de la salle : le clic, lui, est ailleurs.
  const vu = useRef(dernier?.id)
  useEffect(() => {
    if (dernier && dernier.id !== vu.current) sound.reveal()
    vu.current = dernier?.id
  }, [dernier?.id])

  return (
    <div className="quiz-host stage-scroll remise-scene">
      <h2>
        <Icon name="award" />
        Remise des prix
      </h2>
      {dernier ? (
        // La clé relance l'apparition à chaque prix remis.
        <div key={dernier.id} className="remise-prix" role="status">
          <span className="remise-motif">{espacesFines(dernier.reason)}</span>
          <span className="remise-equipe">{equipe ? `${equipe.emoji} ${equipe.name}` : '—'}</span>
          <span className="remise-points">
            {dernier.points > 0 ? '+' : ''}
            {dernier.points} point{Math.abs(dernier.points) > 1 ? 's' : ''} d’équipe
          </span>
        </div>
      ) : (
        <p className="serif-note center remise-attente">Les prix vont être remis…</p>
      )}
      {teams.length > 0 && (
        <div className="remise-equipes">
          <h3>
            <Icon name="users" />
            Les équipes, prix compris
          </h3>
          <TeamBoard teams={teams} showFinalPoints />
        </div>
      )}
    </div>
  )
}
