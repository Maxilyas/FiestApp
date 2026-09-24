import type { Distinctions } from '../../../shared/profil'
import { rangPartage } from '../../../shared/classement'
import { Avatar } from './Avatar'
import { Niveau } from './Niveau'
import { Rank, Score } from './Rank'

export interface PodiumRow extends Distinctions {
  name: string
  avatar: string
  points: number
  /**
   * Le rang partagé, calculé sur le classement complet. Sans lui, on le
   * déduit des lignes reçues — juste tant qu'elles partent de la tête.
   */
  rank?: number
}

/**
 * Le rang de chaque ligne : celui qu'elle porte, sinon le rang partagé parmi
 * les lignes reçues. Numéroter par la position faisait de deux ex æquo un
 * premier et un deuxième, selon un ordre que personne ne choisit.
 */
function rangs(rows: PodiumRow[], offset: number): number[] {
  const points = rows.map(r => r.points)
  return rows.map(r => r.rank ?? offset + rangPartage(r.points, points))
}

/** Classement en liste, du 1er au dernier. */
export function Standings({ rows, offset = 0 }: { rows: PodiumRow[]; offset?: number }) {
  const rank = rangs(rows, offset)
  return (
    <div className="podium" role="list">
      {rows.map((p, i) => (
        <div key={i} className="lb-row" role="listitem" style={{ animationDelay: `${i * 60}ms` }}>
          <Rank n={rank[i]} />
          <Avatar className="lb-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
          <span className="lb-name">{p.name}</span>
          <Niveau niveau={p.niveau} />
          <Score n={p.points} />
        </div>
      ))}
    </div>
  )
}

/**
 * La hauteur des marches, en fraction de la hauteur qu'on leur laisse : elle
 * suit le score, avec un plancher pour que la 3e reste visible quand l'écart
 * est énorme — et un plafond, pour qu'un podium serré reste un podium : à
 * 1 030, 882 et 828 points, les marches faisaient 100, 90 et 86 %, trois
 * blocs presque égaux. Chaque marche descend de 14 points au moins sous la
 * précédente dès que le rang change ; deux ex æquo, à la même hauteur.
 *
 * Le plafond se mesure à la marche d'avant, pas au rang : plafonnées à 86 %
 * pour la 2e et 72 % pour la 3e, 315, 115 et 114 points gardaient leur
 * proportion, 55,5 et 55,3 %, et la 2e et la 3e étaient deux blocs égaux.
 * Quand l'écart l'exige, le plancher cède : la marche garde sa hauteur
 * minimale (`.podium-step`), le rang et le score y tiennent toujours.
 */
export function hauteursDesMarches(marches: { rang: number; points: number }[]): number[] {
  const meilleur = Math.max(1, ...marches.map(m => m.points))
  const h: number[] = []
  marches.forEach((m, i) => {
    const proportion = 0.3 + (0.7 * Math.max(0, m.points)) / meilleur
    if (i === 0) h.push(proportion)
    else if (m.rang > marches[i - 1].rang) h.push(Math.min(proportion, h[i - 1] - 0.14))
    else h.push(h[i - 1])
  })
  return h
}

/**
 * Les trois marches montent depuis le bas, la première au milieu. La hauteur
 * suit le score, avec un plancher pour que la 3e marche reste visible même
 * quand l'écart est énorme. Chaque marche porte le rang partagé : deux ex
 * æquo en tête montent sur deux marches de premier, à la même hauteur.
 *
 * Le document suit l'ordre des rangs, et seule la feuille de style dresse
 * les marches 2e — 1er — 3e (`order`) : placées ainsi dans le document, elles
 * se lisaient à l'oreille « 2, Lucas » avant « 1, Camille », et Hugo a cru
 * Lucas en tête. La grille prend autant de colonnes que de marches : avec
 * deux équipes, une troisième colonne vide décentrait le podium.
 */
export function FinalPodium({ rows }: { rows: PodiumRow[] }) {
  const top = rows.slice(0, 3)
  if (top.length === 0) return <p className="muted">Personne n'a joué…</p>
  const rank = rangs(rows, 0)
  const hauteurs = hauteursDesMarches(top.map((r, i) => ({ rang: rank[i], points: r.points })))
  return (
    <ol className="final-podium" style={{ ['--marches' as string]: top.length }}>
      {top.map((row, i) => (
        <li key={i} className={'podium-col rank-' + rank[i]}>
          {/* Le rang d'abord pour l'oreille, comme dans les autres classements ;
              l'œil, lui, le lit sur la marche, sous le nom. */}
          <span className="sr-only">Rang {rank[i]} : </span>
          <Avatar className="podium-avatar" avatar={row.avatar} finition={row.finition} eclat={row.eclat} legendaire={row.legendaire} />
          <span className="podium-name">
            <span className="podium-nom">{row.name}</span>
            <Niveau niveau={row.niveau} />
          </span>
          {/* La marche ne rétrécit pas sous un nom long : elle prend sa part de
              ce qui reste sous les têtes (`--h`), et le nom tient en deux
              lignes. Un nom de trois lignes volait la hauteur de sa marche, et
              le vainqueur se retrouvait sur la plus petite. */}
          <div className="podium-step" style={{ ['--h' as string]: hauteurs[i] }}>
            <span className="podium-medal" aria-hidden="true">
              {rank[i]}
            </span>
            <Score n={row.points} className="podium-points" />
          </div>
        </li>
      ))}
    </ol>
  )
}
