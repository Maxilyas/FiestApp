// Classement des équipes — même calcul côté serveur et côté écrans.
import type { PublicPlayer, PublicTeam } from './types'

export interface TeamStanding extends PublicTeam {
  /** Rang partagé : deux équipes à égalité sont toutes les deux premières. */
  rank: number
  /**
   * Ce que le quiz rapporte à l'équipe dans le tableau des trois jeux :
   * autant de points que d'équipes pour la première, un de moins pour la
   * suivante, etc. Avec six équipes : 6, 5, 4, 3, 2, 1.
   */
  gamePoints: number
}

/** Somme et moyenne des points de chaque équipe, à partir du classement individuel. */
export function teamScores(
  teams: { id: string; name: string; emoji: string; position: number }[],
  players: PublicPlayer[],
): PublicTeam[] {
  return teams.map(t => {
    const members = players.filter(p => p.teamId === t.id)
    const total = members.reduce((sum, p) => sum + p.score, 0)
    return {
      ...t,
      memberCount: members.length,
      total,
      // Une équipe encore vide vaut 0 : elle n'a rien joué, elle finit dernière.
      average: members.length ? Math.round(total / members.length) : 0,
    }
  })
}

/**
 * Trie les équipes et leur attribue leurs points de jeu.
 *
 * Le barème part du nombre d'équipes créées, pas du nombre d'équipes ayant
 * marqué : avec six équipes, la première rapporte toujours 6 points, même si
 * l'une d'elles est restée sans joueur. C'est ce chiffre-là qu'on reporte à
 * la main sur le tableau des trois jeux.
 */
export function rankTeams(teams: PublicTeam[]): TeamStanding[] {
  // Départage par nom : sans lui, deux ex æquo échangeraient leur place à
  // chaque rafraîchissement et le classement clignoterait sur le mur.
  const sorted = [...teams].sort(
    (a, b) => b.average - a.average || a.name.localeCompare(b.name, 'fr'),
  )
  return sorted.map(t => {
    const rank = sorted.findIndex(o => o.average === t.average) + 1
    return { ...t, rank, gamePoints: sorted.length - rank + 1 }
  })
}
