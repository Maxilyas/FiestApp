// Classement des équipes — même calcul côté serveur et côté écrans.
import { classer } from './classement'
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
  /** gamePoints + les prix remis par l'animateur. C'est le total du quiz. */
  finalPoints: number
}

/** Somme et moyenne des points de chaque équipe, à partir du classement individuel. */
export function teamScores(
  teams: { id: string; name: string; emoji: string; position: number }[],
  players: PublicPlayer[],
  bonuses: { teamId: string; points: number }[] = [],
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
      bonus: bonuses.filter(b => b.teamId === t.id).reduce((sum, b) => sum + b.points, 0),
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
  // La règle commune (shared/classement.ts) : rang partagé, et des ex æquo
  // écrits par nom — sans quoi ils échangeraient leur place à chaque
  // rafraîchissement et le classement clignoterait sur le mur.
  return classer(teams, t => t.average, t => t.name, t => t.id).map(({ item: t, rang }) => {
    const gamePoints = teams.length - rang + 1
    return { ...t, rank: rang, gamePoints, finalPoints: gamePoints + t.bonus }
  })
}

/**
 * Le classement qui désigne le vainqueur du quiz : le barème plus les prix.
 *
 * Il diffère volontairement de `rankTeams` — celui-là classe les équipes sur
 * leur seule performance au quiz, et c'est lui qui distribue le barème. Les
 * prix arrivent après, et peuvent renverser l'ordre : c'est tout leur intérêt.
 */
export function finalRanking(teams: PublicTeam[]): TeamStanding[] {
  return classer(rankTeams(teams), t => t.finalPoints, t => t.name, t => t.id).map(({ item, rang }) => ({
    ...item,
    rank: rang,
  }))
}

/**
 * Les équipes qui remportent le quiz : toutes celles qui partagent la tête du
 * classement final. C'est la règle de l'écran de victoire, et celle de
 * l'historique.
 *
 * L'écran couronnait la première de la liste, et la liste départage les ex
 * æquo par nom : un seul prix à +1 remis à l'équipe deuxième suffisait à
 * couronner « Les Aigles » devant « Les Zèbres », qui avaient gagné le quiz.
 * À égalité, elles gagnent ensemble.
 *
 * Personne tant que rien ne les a départagées — ni quiz joué, ni prix remis :
 * six équipes à égalité ne sont pas six gagnantes.
 */
export function vainqueursDuQuiz(teams: PublicTeam[]): TeamStanding[] {
  if (!teams.some(t => t.average > 0 || t.bonus !== 0)) return []
  return finalRanking(teams).filter(t => t.rank === 1)
}
