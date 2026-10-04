import type { QuizPlayerView } from '../../../../shared/games/quiz'
import type { PublicPlayer } from '../../../../shared/types'
import { ligneDeCourse } from '../../../../shared/course'
import { Icon } from '../../components/Icon'

/** Le nom qu'un invité porte dans la salle, marque d'homonymie comprise (invariant 17). */
const nomDansLaSalle = (players: readonly PublicPlayer[] | undefined, id: string) => {
  const p = players?.find(x => x.id === id)
  return p && (p.nomAffiche ?? p.name)
}

/**
 * La ligne de course, à chaque révélation : sa place au classement du quiz,
 * les places gagnées, et une cible nommée — trois lignes courtes sous le
 * résultat. L'échelle de trois joueurs essayée d'abord à cet endroit prenait
 * 215 px en 360 × 640, et chassait du premier écran les équipes, qui
 * décident de la soirée ; celle-ci en prend 95.
 *
 * Le serveur n'envoie que des identifiants, des points et des rangs : les
 * prénoms viennent de l'instantané que le téléphone a déjà. L'œil lit les
 * trois lignes ; l'oreille, une phrase qui dit tout (`oreille`).
 */
export function LigneDeCourse({
  view: v,
  players,
  sur,
}: {
  view: QuizPlayerView
  players: readonly PublicPlayer[] | undefined
  /** Combien jouent ce quiz, d'après l'instantané. */
  sur: number
}) {
  if (!v.place || v.yourQuizRank === undefined) return null
  const ligne = ligneDeCourse({
    rang: v.yourQuizRank,
    points: v.yourQuizTotal ?? 0,
    place: v.place,
    sur,
    nomDe: id => nomDansLaSalle(players, id),
    qIndex: v.qIndex,
    qCount: v.qCount,
    multiplier: v.multiplier ?? 1,
  })
  return (
    <section className="card course">
      <p className="sr-only">{ligne.oreille}</p>
      <div className="course-lignes" aria-hidden="true">
        <span className="label">{ligne.etiquette}</span>
        <p className="course-place">
          {ligne.rang && <b className="course-rang">{ligne.rang}</b>}
          <span className={ligne.fete ? 'course-fete' : undefined}>{ligne.place}</span>
          {ligne.points && <span className="course-points">· {ligne.points}</span>}
          {/* Monter se fête ; descendre, la place le dit assez à qui s'en souvient. */}
          {ligne.gagnees > 0 && (
            <span className="course-monte">
              <Icon name="arrow-up" />
              {ligne.gagnees}
            </span>
          )}
        </p>
        {ligne.cible && (
          <p className="course-cible">
            {ligne.cible.avant}
            {ligne.cible.nom && <strong>{ligne.cible.nom}</strong>}
            {ligne.cible.apres}
          </p>
        )}
      </div>
    </section>
  )
}
