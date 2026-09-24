import { rankTeams } from '../../../shared/teams'
import type { PublicTeam } from '../../../shared/types'
import { Rank, Score, motPoints } from './Rank'

interface Props {
  teams: PublicTeam[]
  /** Mon équipe, mise en avant sur le téléphone. */
  highlightId?: string | null
  /** Affiche les points de classement du quiz, ceux auxquels les prix s'ajoutent. */
  showGamePoints?: boolean
  compact?: boolean
}

/**
 * Classement des équipes au quiz.
 *
 * Le chiffre qui classe est la **moyenne par membre**, pas le total : les
 * équipes n'ont jamais le même effectif, et une équipe de neuf battrait
 * mécaniquement une équipe de six. Le total reste affiché en petit, parce
 * qu'il est plus parlant quand on commente le classement à voix haute.
 */
export function TeamBoard({ teams, highlightId, showGamePoints, compact }: Props) {
  if (teams.length === 0) {
    return <p className="muted">Aucune équipe pour l'instant…</p>
  }
  const rows = rankTeams(teams)
  // Avant le premier quiz, toutes les équipes sont à zéro donc toutes
  // premières : six « 1 » projetés au mur, ça ne veut rien dire. On n'affiche
  // le classement qu'une fois qu'il y a quelque chose à classer.
  const played = rows.some(t => t.average > 0)

  return (
    // Une liste : sans elle, le lecteur d'écran lisait toutes les équipes
    // d'une traite, sans dire où l'une finit et l'autre commence.
    <div className="leaderboard team-board" role="list">
      {rows.map(t => (
        <div
          key={t.id}
          role="listitem"
          className={'lb-row team-row' + (t.id === highlightId ? ' me' : '')}
        >
          {played ? <Rank n={t.rank} /> : <span className="lb-rank" aria-hidden="true">·</span>}
          <span className="lb-avatar">{t.emoji}</span>
          <span className="lb-name">
            {t.name}
            {!compact && (
              <span className="team-sub">
                {t.memberCount === 0
                  ? 'aucun membre'
                  : `${t.memberCount} membre${t.memberCount > 1 ? 's' : ''} · ${t.total} pts au total`}
              </span>
            )}
          </span>
          {showGamePoints && (
            <span className="team-gamepoints" title="Points de classement du quiz — les prix s'y ajoutent">
              {played ? t.gamePoints : '–'}
              {played && <span className="sr-only"> {motPoints(t.gamePoints)} de classement,</span>}
            </span>
          )}
          <Score n={t.average} precision="de moyenne par membre" />
        </div>
      ))}
    </div>
  )
}
