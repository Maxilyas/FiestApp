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
 * La hauteur d'une marche, en fraction de la hauteur qu'on lui laisse : elle
 * suit le score, avec un plancher pour que la 3e reste visible quand l'écart
 * est énorme — et un plafond par rang, pour qu'un podium serré reste un
 * podium : à 1 030, 882 et 828 points, les marches faisaient 100, 90 et 86 %,
 * trois blocs presque égaux. Deux rangs distincts sont toujours à 14 points
 * d'écart au moins ; deux ex æquo, à la même hauteur.
 */
export function hauteurDeMarche(rang: number, points: number, meilleur: number): number {
  const proportion = 0.3 + (0.7 * Math.max(0, points)) / Math.max(1, meilleur)
  return Math.min(proportion, 1 - 0.14 * (Math.max(1, rang) - 1))
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
  const best = Math.max(...top.map(r => r.points), 1)
  return (
    <ol className="final-podium" style={{ ['--marches' as string]: top.length }}>
      {top.map((row, i) => (
        <li key={i} className={'podium-col rank-' + rank[i]}>
          {/* Le rang d'abord pour l'oreille, comme dans les autres classements ;
              l'œil, lui, le lit sur la marche, sous le nom. */}
          <span className="sr-only">Rang {rank[i]} : </span>
          <Avatar className="podium-avatar" avatar={row.avatar} finition={row.finition} eclat={row.eclat} legendaire={row.legendaire} />
          <span className="podium-name">
            {row.name}
            <Niveau niveau={row.niveau} />
          </span>
          {/* La marche ne rétrécit pas sous un nom long : elle prend sa part de
              ce qui reste sous les têtes (`--h`), et le nom tient en deux
              lignes. Un nom de trois lignes volait la hauteur de sa marche, et
              le vainqueur se retrouvait sur la plus petite. */}
          <div className="podium-step" style={{ ['--h' as string]: hauteurDeMarche(rank[i], row.points, best) }}>
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
