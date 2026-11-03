import type { PartySnapshot, PublicPlayer, PublicTeam } from './types'

/** Tout ce qui, dans la salle, n'est ni un invité ni une équipe : la partie, le code, les titres, les prix. */
export type ResteDeLaSalle = Omit<PartySnapshot, 'players' | 'teams'>

/**
 * Ce qui a changé dans la salle d'un téléphone depuis l'instantané qu'il
 * tient (`party:salle`) : les invités arrivés ou changés, entiers ; ceux dont
 * seuls les points de la soirée ont bougé, leurs points seulement ; ceux qui
 * sont partis ; les équipes, et le reste, entiers.
 *
 * La liste entière de la salle repartait à chacun à chaque arrivée et à
 * chaque révélation : 44 Ko vers chacun de 300 téléphones, 95 % de ce que
 * le serveur envoyait pendant une soirée (le banc du 3 novembre 2026,
 * `docs/exploitation/capacite.md`). Le serveur ne l'envoie que s'il refait
 * l'instantané à l'identique sur chaque téléphone (`SalleDesTelephones`,
 * `server/src/core/salleDesTelephones.ts`) ; sinon l'instantané entier part.
 */
export interface ChangementDeLaSalle {
  /** Les invités arrivés ou changés, entiers, dans l'ordre de la salle. */
  joueurs?: PublicPlayer[]
  /**
   * Les points de la soirée de ceux dont rien d'autre n'a changé : au podium
   * d'un quiz, tous les invités changent, et leurs lignes entières pesaient
   * six fois plus que leurs points.
   */
  points?: Record<string, number>
  /** Les invités partis. */
  partis?: string[]
  /** Les équipes, entières. */
  equipes?: PublicTeam[]
  /**
   * Le reste, entier — au lancement d'un quiz, la partie et ses participants :
   * quelques kilooctets, quand l'instantané entier en pesait quarante.
   */
  reste?: ResteDeLaSalle
}

/**
 * Le changement appliqué à ce que tient un téléphone : les partis ôtés, les
 * points posés, chaque invité reçu remplacé à sa place ou ajouté au bout, les
 * équipes et le reste remplacés. La salle ne fait qu'ajouter au bout et
 * retirer : un téléphone y retrouve ses invités à leur place.
 */
export function appliquerLeChangement(s: PartySnapshot, c: ChangementDeLaSalle): PartySnapshot {
  let players = s.players
  if (c.partis?.length) {
    const partis = new Set(c.partis)
    players = players.filter(p => !partis.has(p.id))
  }
  if (c.points) {
    // Par une `Map` : un identifiant venu du réseau ne lit jamais le prototype d'un objet.
    const points = new Map(Object.entries(c.points))
    players = players.map(p => {
      const score = points.get(p.id)
      return score === undefined ? p : { ...p, score }
    })
  }
  if (c.joueurs?.length) {
    const recus = new Map(c.joueurs.map(p => [p.id, p]))
    players = players.map(p => recus.get(p.id) ?? p)
    const presents = new Set(players.map(p => p.id))
    players = [...players, ...c.joueurs.filter(p => !presents.has(p.id))]
  }
  const teams = c.equipes ?? s.teams
  if (c.reste) return { ...c.reste, players, teams }
  return { ...s, players, teams }
}
