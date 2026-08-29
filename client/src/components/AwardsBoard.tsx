import { useState } from 'react'
import type { Award, PublicTeam } from '../../../shared/types'

interface Props {
  awards: Award[]
  teams: PublicTeam[]
  /** Absent sur la page souvenir : les invités lisent, ils n'attribuent rien. */
  onAward?: (teamId: string, points: number, reason: string) => void
  /**
   * Les intitulés des prix déjà remis. On compare sur le titre et non sur la
   * clé : c'est le titre qui part en motif dans le journal des prix, et c'est
   * lui que l'animateur relit dans la liste.
   */
  givenTitles?: Set<string>
}

/** Ce qu'un prix vaut par défaut. L'animateur reste libre de changer. */
const DEFAULT_POINTS = 1

/**
 * Les prix de fin de soirée.
 *
 * L'application les calcule et les propose ; rien n'est attribué tant que
 * l'animateur ne clique pas. C'est volontaire : le classement du quiz se
 * mérite, les prix se donnent — et devant cinquante personnes, c'est
 * l'animateur qui sait lequel fera rire.
 */
export function AwardsBoard({ awards, teams, onAward, givenTitles }: Props) {
  const [points, setPoints] = useState<Record<string, number>>({})
  const teamOf = (id: string | null) => teams.find(t => t.id === id) ?? null

  if (awards.length === 0) {
    return (
      <p className="muted">
        Aucun prix pour l'instant — ils apparaissent au fil des quiz, quand les chiffres
        commencent à vouloir dire quelque chose.
      </p>
    )
  }

  return (
    <div className="awards">
      {awards.map(a => {
        const team = teamOf(a.teamId)
        const given = givenTitles?.has(a.title)
        return (
          <div key={a.key} className={'card award' + (given ? ' award-given' : '')}>
            <span className="award-emoji">{a.emoji}</span>
            <div className="award-body">
              <h3>{a.title}</h3>
              <p className="muted small">{a.rule}</p>
              <p className="award-winner">
                {a.player ? (
                  <>
                    <strong>
                      {a.player.avatar} {a.player.name}
                    </strong>{' '}
                    — {a.detail}
                  </>
                ) : (
                  <>{a.detail}</>
                )}
              </p>
              <p className="award-team">
                {team ? (
                  <>
                    {team.emoji} {team.name}
                  </>
                ) : (
                  <span className="muted">sans équipe — aucun point à donner</span>
                )}
              </p>
            </div>

            {onAward && team && (
              <div className="award-give">
                <input
                  className="input award-points"
                  type="number"
                  min={-10}
                  max={10}
                  value={points[a.key] ?? DEFAULT_POINTS}
                  onChange={e => setPoints(p => ({ ...p, [a.key]: Number(e.target.value) }))}
                />
                <button
                  className={'btn btn-small' + (given ? '' : ' btn-primary')}
                  onClick={() => onAward(team.id, points[a.key] ?? DEFAULT_POINTS, a.title)}
                >
                  {given ? 'Redonner' : 'Attribuer'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
