import { detailDesPoints, finalRanking, vainqueursDuQuiz } from '../../../shared/teams'
import { enumerer } from '../../../shared/classement'
import type { PublicTeam } from '../../../shared/types'
import { Rank, Score, motPoints } from './Rank'
import { Icon } from './Icon'
import { formatNumber, pts } from '../format'

interface Props {
  teams: PublicTeam[]
  /** Mon équipe, mise en avant sur le téléphone. */
  highlightId?: string | null
  compact?: boolean
}

/**
 * Le classement des équipes — le même partout : au téléphone, au mur, au
 * souvenir.
 *
 * Il se range aux **points d'équipe**, prix compris (`finalRanking`) : la
 * moyenne par membre, plus les prix de l'animateur. C'est le gros chiffre.
 * Le téléphone classait à la seule moyenne quand la télé classait prix
 * compris : après une remise de prix, ils n'avaient pas le même premier.
 *
 * Au téléphone, rien sous le nom : l'emoji, le nom, les points — sobre (le
 * propriétaire du dépôt, le 4 octobre 2026). Au mur, l'effectif et le total,
 * qu'on commente à voix haute.
 */
export function TeamBoard({ teams, highlightId, compact }: Props) {
  if (teams.length === 0) {
    return <p className="muted">Aucune équipe pour l'instant…</p>
  }
  // Au téléphone, une équipe vide et sans points ne prend pas une ligne :
  // les six par défaut pour quatre invités, c'étaient quatre lignes à zéro.
  // Au mur, « aucun membre » dit à l'animateur laquelle supprimer.
  // Toutes vides — personne n'a encore choisi —, on les montre toutes.
  const toutes = finalRanking(teams)
  const habitees = toutes.filter(t => t.memberCount > 0 || t.finalPoints !== 0)
  const rows = compact && habitees.length > 0 ? habitees : toutes
  // Avant le premier quiz, toutes les équipes sont à zéro donc toutes
  // premières : six « 1 » projetés au mur, ça ne veut rien dire. On n'affiche
  // le classement qu'une fois qu'il y a quelque chose à classer — un quiz
  // joué, ou un prix remis (la règle de `vainqueursDuQuiz`).
  const played = rows.some(t => t.average > 0 || t.bonus !== 0)

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
          <span className="lb-name">{t.name}</span>
          {/* Le détail est le voisin du nom, pas son enfant : la grille le
              place dessous, ou sur toute la largeur quand la ligne est
              étroite. Enfant du nom, il n'avait que sa colonne — 14 px au
              texte agrandi, une lettre par ligne. */}
          {!compact && (
            <span className="team-sub">
              {t.memberCount === 0 ? 'aucun membre' : `${t.memberCount} membre${t.memberCount > 1 ? 's' : ''}`}
              {played && t.memberCount > 0 && ` · ${pts(t.total)} au total`}
              {/* Le détail ne vaut que s'il y a des prix : sans eux, il répétait le gros chiffre. */}
              {played && t.bonus !== 0 && ` · ${detailDesPoints(t)}`}
            </span>
          )}
          {played && (
            <span className="team-points">
              <Score n={t.finalPoints} texte={formatNumber(t.finalPoints)} precision="d’équipe" />
              <span className="team-points-unite" aria-hidden="true">
                {motPoints(t.finalPoints) === 'point' ? 'pt' : 'pts'}
              </span>
            </span>
          )}
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
  // `avecPrix` : un prix qui compte. Des prix d'honneur, à 0 point, ne
  // rendent pas le verdict « prix compris ».
  const champions = vainqueursDuQuiz(teams)
  if (champions.length === 0) return null
  const points = champions[0].finalPoints
  const ecrits = `${formatNumber(points)} ${motPoints(points)}`
  return (
    <p className="team-verdict">
      <Icon name="crown" /> {enumerer(champions.map(t => `${t.emoji} ${t.name}`))}{' '}
      {champions.length > 1 ? `remportent le quiz ex æquo, ${ecrits} chacune` : `remporte le quiz, ${ecrits}`}
      {avecPrix && ' prix compris'}.
    </p>
  )
}
