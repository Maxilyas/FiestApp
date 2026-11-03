// Ce que tiennent les téléphones d'une soirée, pour ne leur envoyer que ce
// qui change (`party:salle`, `shared/salle.ts`).
//
// La liste entière de la salle repartait à chacun à chaque arrivée et à
// chaque révélation : 44 Ko vers chacun de 300 téléphones, 95 % de ce que le
// serveur envoyait pendant une soirée (le banc du 3 novembre 2026,
// `docs/exploitation/capacite.md`). Un changement ne vaut que s'il refait,
// sur chaque téléphone, la salle que les autres reçoivent : tous tiennent le
// dernier instantané parti à toute la salle — sauf celui qui vient de se
// présenter ou de faire un geste, qui a reçu le sien sur-le-champ, plus
// récent (invariant 4). Ce que ce dernier avait d'autre, le changement
// suivant le couvre aussi : un invité arrivé puis exclu dans la même fenêtre,
// une équipe choisie puis quittée, ne restent pas sur son écran.
import type { ChangementDeLaSalle, ResteDeLaSalle } from '../../../shared/salle'
import type { PartySnapshot, PublicPlayer } from '../../../shared/types'

/** Un instantané des téléphones tel qu'il s'écrit, ligne par ligne. */
interface Empreinte {
  /** Ses invités, dans l'ordre de la salle. */
  ids: string[]
  lignes: Map<string, string>
  /** Les points de la soirée de chacun : un changement qui ne touche qu'eux ne porte qu'eux. */
  scores: Map<string, number>
  equipes: string
  /** Tout ce qui n'est ni un invité ni une équipe. */
  reste: string
}

function empreinteDe(s: PartySnapshot): Empreinte {
  const { players, teams, ...reste } = s
  const lignes = new Map<string, string>()
  const scores = new Map<string, number>()
  for (const p of players) {
    lignes.set(p.id, JSON.stringify(p))
    scores.set(p.id, p.score)
  }
  return { ids: players.map(p => p.id), lignes, scores, equipes: JSON.stringify(teams), reste: JSON.stringify(reste) }
}

/** Ce qui part à toute la salle : rien, ce qui a changé, ou l'instantané entier. */
export type EnvoiALaSalle = { quoi: 'rien' } | { quoi: 'changement'; changement: ChangementDeLaSalle } | { quoi: 'instantane' }

export class SalleDesTelephones {
  /** Le dernier instantané parti à toute la salle : chaque téléphone de la salle le tient. */
  private base: Empreinte | null = null
  /** L'ordre des invités de chaque instantané parti depuis à un seul téléphone. */
  private ordresAUnSeul: string[][] = []
  /** Les invités qu'un de ceux-là montrait autrement que la base — ou qu'elle n'avait pas. */
  private joueursAutres = new Set<string>()
  private equipesAutres = false
  private resteAutre = false

  /**
   * Un instantané parti à un seul téléphone — qui se présente, qui fait un
   * geste. Il tiendra ce qui y est écrit : ce qui diffère de la base, le
   * prochain envoi à la salle le refait aussi.
   */
  envoyeAUnSeul(s: PartySnapshot): void {
    const base = this.base
    // Avant le premier envoi à la salle, il n'y a pas de base : le premier
    // part entier, et chacun le reçoit.
    if (!base) return
    const { players, teams, ...reste } = s
    for (const p of players) {
      const avant = base.lignes.get(p.id)
      // Un invité que la base n'a pas : son identifiant suffit, sans l'écrire.
      if (avant === undefined || avant !== JSON.stringify(p)) this.joueursAutres.add(p.id)
    }
    if (JSON.stringify(teams) !== base.equipes) this.equipesAutres = true
    if (JSON.stringify(reste) !== base.reste) this.resteAutre = true
    this.ordresAUnSeul.push(players.map(p => p.id))
  }

  /**
   * L'instantané qui part à toute la salle, qui devient la base. Ce qui part :
   * rien s'il n'y a rien à refaire nulle part ; le changement s'il refait
   * cet instantané à l'identique sur chaque téléphone, ordre compris, et
   * pèse moins que lui ; sinon l'instantané entier — `force` (le filet des
   * cinq minutes) aussi. Une salle vidée d'un coup s'écrit en moins de signes
   * que ses partis.
   */
  versLaSalle(apres: PartySnapshot, force = false): EnvoiALaSalle {
    const avant = this.base
    const e = empreinteDe(apres)
    const { ordresAUnSeul, joueursAutres, equipesAutres, resteAutre } = this
    this.base = e
    this.ordresAUnSeul = []
    this.joueursAutres = new Set()
    this.equipesAutres = false
    this.resteAutre = false
    if (!avant || force) return { quoi: 'instantane' }
    const joueurs: PublicPlayer[] = []
    const points: Record<string, number> = {}
    let desPoints = false
    let poidsDuChangement = 0
    for (const p of apres.players) {
      const ligne = e.lignes.get(p.id)!
      const autre = joueursAutres.has(p.id)
      const avantLigne = avant.lignes.get(p.id)
      if (!autre && avantLigne === ligne) continue
      // Seuls ses points ont bougé, et chaque téléphone tient sa ligne d'avant : ses points suffisent.
      if (!autre && avantLigne !== undefined && JSON.stringify({ ...p, score: avant.scores.get(p.id) }) === avantLigne) {
        points[p.id] = p.score
        desPoints = true
        poidsDuChangement += p.id.length + String(p.score).length + 4
        continue
      }
      joueurs.push(p)
      poidsDuChangement += ligne.length + 1
    }
    const partis = new Set<string>()
    for (const id of avant.ids) if (!e.lignes.has(id)) partis.add(id)
    for (const id of joueursAutres) if (!e.lignes.has(id)) partis.add(id)
    const equipes = equipesAutres || e.equipes !== avant.equipes
    const reste = resteAutre || e.reste !== avant.reste
    if (joueurs.length === 0 && !desPoints && partis.size === 0 && !equipes && !reste && memeOrdre(avant.ids, e.ids)) return { quoi: 'rien' }
    for (const id of partis) poidsDuChangement += id.length + 3
    if (equipes) poidsDuChangement += e.equipes.length
    if (reste) poidsDuChangement += e.reste.length
    let poidsDeLInstantane = e.equipes.length + e.reste.length
    for (const ligne of e.lignes.values()) poidsDeLInstantane += ligne.length + 1
    if (poidsDuChangement >= poidsDeLInstantane) return { quoi: 'instantane' }
    // La salle ne fait qu'ajouter au bout et retirer (`Party`) : chaque
    // téléphone y retrouve ses invités à leur place. Vérifié pour chacun,
    // sans rien réécrire : un ordre que la salle changerait un jour ferait
    // partir l'instantané entier, jamais un écran faux.
    const recus = new Set(joueurs.map(p => p.id))
    for (const ordre of [avant.ids, ...ordresAUnSeul]) {
      if (!garderaLOrdre(ordre, partis, recus, e.ids)) return { quoi: 'instantane' }
    }
    const { players: _players, teams: _teams, ...leReste } = apres
    return {
      quoi: 'changement',
      changement: {
        ...(joueurs.length > 0 && { joueurs }),
        ...(desPoints && { points }),
        ...(partis.size > 0 && { partis: [...partis] }),
        ...(equipes && { equipes: apres.teams }),
        ...(reste && { reste: leReste satisfies ResteDeLaSalle }),
      },
    }
  }
}

/**
 * Un téléphone qui tenait `ordre` retrouve-t-il, le changement appliqué,
 * l'ordre de la salle (`ids`) ? `appliquerLeChangement` laisse ses invités
 * restants à leur place et ajoute au bout ceux qu'il n'a pas : ses restants
 * doivent ouvrir la salle, dans le même ordre, et chaque invité d'après doit
 * être dans le changement. Sans rien construire : une vague d'arrivées en
 * vérifie des dizaines par envoi, et refaire les listes coûtait le cinquième
 * du suivi (le banc du 3 novembre 2026).
 */
function garderaLOrdre(ordre: readonly string[], partis: ReadonlySet<string>, recus: ReadonlySet<string>, ids: readonly string[]): boolean {
  let j = 0
  for (const id of ordre) {
    if (partis.has(id)) continue
    if (ids[j] !== id) return false
    j++
  }
  for (; j < ids.length; j++) if (!recus.has(ids[j])) return false
  return true
}

function memeOrdre(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
