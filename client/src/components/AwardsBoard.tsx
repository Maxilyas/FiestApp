import { useRef, useState } from 'react'
import type { Award, PublicTeam } from '../../../shared/types'
import { enumerer } from '../../../shared/classement'
import { POINTS_D_UN_PRIX, PRIX_MAX, effetDUnPrix } from '../../../shared/teams'
import { ChampNombre } from './ChampNombre'
import { remiseDuClic, type RemiseEnRoute } from '../remise'

interface Props {
  awards: Award[]
  teams: PublicTeam[]
  /** Absent sur la page souvenir : les invités lisent, ils n'attribuent rien. */
  onAward?: (teamId: string, points: number, reason: string, remise: string) => void
  /**
   * Les intitulés des prix déjà remis. On compare sur le titre et non sur la
   * clé : c'est le titre qui part en motif dans le journal des prix, et c'est
   * lui que l'animateur relit dans la liste.
   */
  givenTitles?: Set<string>
  /** Les prix remis tels que l'instantané les montre : une remise vue libère son prix pour « Redonner ». */
  remisesVues?: string
}


/**
 * Les prix de fin de soirée.
 *
 * L'application les calcule et les propose ; rien n'est attribué tant que
 * l'animateur ne clique pas. C'est volontaire : le classement du quiz se
 * mérite, les prix se donnent — et devant cinquante personnes, c'est
 * l'animateur qui sait lequel fera rire. Ils se remettent pour le plaisir,
 * à zéro point d'office (`POINTS_D_UN_PRIX`) : le champ reste, pour qui veut
 * qu'un prix compte.
 */
export function AwardsBoard({ awards, teams, onAward, givenTitles, remisesVues = '' }: Props) {
  const [points, setPoints] = useState<Record<string, number>>({})
  /** La dernière remise de chaque prix, pour reconnaître un double clic (`remiseDuClic`). */
  const remises = useRef(new Map<string, RemiseEnRoute>())
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
        /** Les points tapés pour ce prix, ou ceux d'office. */
        const tape = points[a.key] ?? POINTS_D_UN_PRIX
        // Une équipe se nomme avec les équipes de la soirée ; une équipe
        // retirée depuis n'a plus de nom à donner.
        const exAequo =
          a.exAequo ?? a.exAequoEquipes?.flatMap(id => teamOf(id)?.name ?? []) ?? []
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
              {/* Un seul lauréat, départagé au prénom : la règle se dit, sinon
                  Zoé, à égalité avec Liam, ne comprend pas qu'elle a perdu
                  parce que « L » vient avant « Z ». */}
              {exAequo.length > 0 && (
                <p className="muted small award-exaequo">
                  Ex æquo avec {enumerer(exAequo)} —{' '}
                  {a.departage === 'classement'
                    ? 'départagé par le mieux classé de chaque équipe'
                    : 'départagé par ordre alphabétique'}
                </p>
              )}
              <p className="award-team">
                {team ? (
                  <>
                    {team.emoji} {team.name}
                  </>
                ) : (
                  <span className="muted">sans équipe — aucun point à donner</span>
                )}
              </p>
              {/* Ce que le clic changerait, dit avant : un prix à points peut
                  renverser la victoire, et l'animateur doit le voir venir. À
                  zéro — d'office —, rien : l'en-tête de la remise le dit une
                  fois, et la même ligne sous chaque prix chargeait la grille. */}
              {onAward && team && Number.isFinite(tape) && Math.round(tape) !== 0 && (
                <p className="award-effet">{effetDUnPrix(teams, team.id, tape)}</p>
              )}
            </div>

            {onAward && team && (
              <div className="award-give">
                {/* Le « 1 » n'avait pas d'étiquette : ni l'animatrice ni son
                    lecteur d'écran ne savaient de quoi c'était le nombre. */}
                <label className="award-points-champ">
                  <ChampNombre
                    className="input award-points"
                    min={-PRIX_MAX}
                    max={PRIX_MAX}
                    aria-label={`Points d’équipe du prix « ${a.title} »`}
                    valeur={tape}
                    onValeur={n => setPoints(p => ({ ...p, [a.key]: n }))}
                  />
                  <span className="award-points-unite" aria-hidden="true">pts</span>
                </label>
                <button
                  className={'btn btn-small' + (given ? '' : ' btn-primary')}
                  // La valeur que l'effet annonce : arrondie, comme le serveur la lira.
                  onClick={() => {
                    const pts = Math.round(tape)
                    const remise = remiseDuClic(remises.current.get(a.key), {
                      quoi: `${team.id}:${pts}`,
                      vus: remisesVues,
                      maintenant: Date.now(),
                    })
                    remises.current.set(a.key, remise)
                    onAward(team.id, pts, a.title, remise.id)
                  }}
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
