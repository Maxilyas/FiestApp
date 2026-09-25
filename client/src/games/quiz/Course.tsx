import type { QuizPlayerView, VoisinAuClassement } from '../../../../shared/games/quiz'
import type { PublicPlayer } from '../../../../shared/types'
import { ecartAuPodium, ligneDeCourse } from '../../../../shared/course'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { Niveau } from '../../components/Niveau'
import { Rank, Score } from '../../components/Rank'
import { pts } from '../../format'

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

/**
 * Au podium du quiz, pour qui n'y monte pas : l'échelle de ses voisins —
 * celui qu'il talonnait, lui, celui qui le talonnait —, là où la place ne
 * manque plus. Rien à zéro point : pas de rang pour qui n'a pas marqué, et
 * personne n'y lit le zéro d'un autre.
 */
export function Echelle({ view: v, players, moi }: { view: QuizPlayerView; players: readonly PublicPlayer[] | undefined; moi: PublicPlayer | undefined }) {
  const place = v.place
  const total = v.yourQuizTotal ?? 0
  if (!place || v.yourQuizRank === undefined || !moi || v.yourPodiumIndex !== undefined || total <= 0) return null
  const decore = (voisin: VoisinAuClassement | undefined) => {
    const p = voisin && players?.find(x => x.id === voisin.id)
    return p && voisin ? { ...voisin, p } : null
  }
  const devant = decore(place.devant)
  const derriere = place.derriere && place.derriere.points > 0 ? decore(place.derriere) : null
  const ecart = ecartAuPodium(v.yourQuizRank, total, place)
  return (
    <section className="card echelle">
      <span className="label">Ta place dans ce quiz</span>
      <div className="leaderboard">
        {devant && <Ligne rang={devant.rang} p={devant.p} points={devant.points} />}
        <Ligne rang={v.yourQuizRank} p={moi} points={total} soi />
        {derriere && <Ligne rang={derriere.rang} p={derriere.p} points={derriere.points} />}
      </div>
      {ecart !== null && <p className="echelle-podium">À {pts(ecart)} du podium</p>}
    </section>
  )
}

function Ligne({ rang, p, points, soi }: { rang: number; p: PublicPlayer; points: number; soi?: boolean }) {
  return (
    <div className={'lb-row' + (soi ? ' me' : '')}>
      <Rank n={rang} />
      <Avatar className="lb-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
      <span className="lb-name">
        {p.nomAffiche ?? p.name}
        {soi && <span className="echelle-toi"> · toi</span>}
      </span>
      <Niveau niveau={p.niveau} />
      <Score n={points} />
    </div>
  )
}
