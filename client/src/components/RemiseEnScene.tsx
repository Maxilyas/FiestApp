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
  // Seuls comptent les prix remis depuis que la remise est à l'écran : le
  // dernier de toute la soirée faisait réannoncer, à la deuxième remise, le
  // dernier prix de la première.
  const avant = useRef<Set<string> | null>(null)
  if (avant.current === null) avant.current = new Set(bonuses.map(b => b.id))
  const neufs = bonuses.filter(b => !avant.current!.has(b.id))
  const dernier = neufs.reduce<TeamBonus | null>((a, b) => (!a || b.createdAt >= a.createdAt ? b : a), null)
  const equipe = dernier ? teams.find(t => t.id === dernier.teamId) : undefined

  // Le prix remis sonne sur l'écran de la salle : le clic, lui, est ailleurs.
  // Un prix retiré ramène le précédent à l'écran, sans le réannoncer : ni
  // son, ni apparition — la clé ne change qu'à un prix jamais montré.
  const annonces = useRef(new Set<string>())
  const apparition = useRef<string | undefined>(undefined)
  if (dernier && !annonces.current.has(dernier.id)) apparition.current = dernier.id
  useEffect(() => {
    if (!dernier || annonces.current.has(dernier.id)) return
    annonces.current.add(dernier.id)
    sound.reveal()
  }, [dernier?.id])

  return (
    <div className="quiz-host stage-scroll remise-scene">
      <h2>
        <Icon name="award" />
        Remise des prix
      </h2>
      {dernier ? (
        // La clé relance l'apparition à chaque prix remis, et à lui seul.
        <div key={apparition.current} className="remise-prix" role="status">
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
