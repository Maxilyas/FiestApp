import { finalRanking, rankTeams, vainqueursDuQuiz } from '../../../shared/teams'
import { enumerer } from '../../../shared/classement'
import type { PublicTeam } from '../../../shared/types'
import { Rank } from './Rank'
import { Icon } from './Icon'

interface Props {
  teams: PublicTeam[]
  /** Mon équipe, mise en avant sur le téléphone. */
  highlightId?: string | null
  /**
   * Affiche le total du quiz, prix compris, et classe les équipes par lui :
   * le classement de l'écran de victoire et de l'historique.
   */
  showFinalPoints?: boolean
  compact?: boolean
}

/**
 * Classement des équipes au quiz.
 *
 * Le chiffre qui classe est la **moyenne par membre**, pas le total : les
 * équipes n'ont jamais le même effectif, et une équipe de neuf battrait
 * mécaniquement une équipe de six. Le total reste affiché en petit, parce
 * qu'il est plus parlant quand on commente le classement à voix haute.
 *
 * Avec le chiffre cerclé, le tableau se range au barème **prix compris**
 * (`finalRanking`), comme l'écran de victoire. Il se rangeait à la moyenne et
 * cerclait le barème sans les prix : deux équipes que l'écran de victoire
 * déclarait ex æquo à 4 points se lisaient « 1. Carbonara (2), 2. Randonneurs
 * (1) » au souvenir et au panneau de la salle. Sans prix remis, les deux
 * classements sont les mêmes.
 */
export function TeamBoard({ teams, highlightId, showFinalPoints, compact }: Props) {
  if (teams.length === 0) {
    return <p className="muted">Aucune équipe pour l'instant…</p>
  }
  const rows = showFinalPoints ? finalRanking(teams) : rankTeams(teams)
  // Avant le premier quiz, toutes les équipes sont à zéro donc toutes
  // premières : six « 1 » projetés au mur, ça ne veut rien dire. On n'affiche
  // le classement qu'une fois qu'il y a quelque chose à classer — un quiz
  // joué, ou un prix remis (la règle de `vainqueursDuQuiz`).
  const played = rows.some(t => t.average > 0 || (showFinalPoints && t.bonus !== 0))

  return (
    <div className="leaderboard team-board">
      {rows.map(t => (
        <div
          key={t.id}
          className={'lb-row team-row' + (t.id === highlightId ? ' me' : '')}
        >
          {played ? <Rank n={t.rank} /> : <span className="lb-rank">·</span>}
          <span className="lb-avatar">{t.emoji}</span>
          <span className="lb-name">
            {t.name}
            {!compact && (
              <span className="team-sub">
                {t.memberCount === 0
                  ? 'aucun membre'
                  : `${t.memberCount} membre${t.memberCount > 1 ? 's' : ''} · ${t.total} pts au total`}
                {showFinalPoints && t.bonus !== 0 && ` · ${t.gamePoints} au barème ${t.bonus > 0 ? '+' : '−'} ${Math.abs(t.bonus)} de prix`}
              </span>
            )}
          </span>
          {showFinalPoints && (
            <span className="team-gamepoints" title="Total du quiz : le barème, prix compris">
              {played ? t.finalPoints : '–'}
            </span>
          )}
          <span className="lb-score">{t.average}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * L'équipe ou les équipes qui remportent le quiz, prix compris, ex æquo
 * compris — le verdict de l'écran de victoire et de l'historique, que le
 * souvenir et le bilan écrivent avec les mêmes mots.
 */
export function VerdictDesEquipes({ teams, avecPrix }: { teams: PublicTeam[]; avecPrix: boolean }) {
  const champions = vainqueursDuQuiz(teams)
  if (champions.length === 0) return null
  const pts = champions[0].finalPoints
  return (
    <p className="team-verdict">
      <Icon name="crown" /> {enumerer(champions.map(t => `${t.emoji} ${t.name}`))}{' '}
      {champions.length > 1
        ? `remportent le quiz ex æquo, ${pts} points chacune`
        : `remporte le quiz, ${pts} point${pts > 1 ? 's' : ''}`}
      {avecPrix && ' prix compris'}.
    </p>
  )
}
