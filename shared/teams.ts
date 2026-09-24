// Classement des équipes — même calcul côté serveur et côté écrans.
import { classer, enumerer } from './classement'
import { rang } from './typographie'
import type { PublicPlayer, PublicTeam } from './types'

export interface TeamStanding extends PublicTeam {
  /** Rang partagé : deux équipes à égalité sont toutes les deux premières. */
  rank: number
  /**
   * Les points d'équipe que rapporte la moyenne : autant que d'équipes pour
   * la première, un de moins pour la suivante, etc. Avec six équipes : 6, 5,
   * 4, 3, 2, 1. Les prix de l'animateur s'y ajoutent (`finalPoints`).
   */
  gamePoints: number
  /** gamePoints + les prix remis par l'animateur : les points d'équipe, ceux qui désignent la gagnante. */
  finalPoints: number
}

/**
 * Une question vue d'une équipe : combien de ses membres y avaient une ligne
 * au journal des réponses — posée, répondue ou non —, et ce qu'ils y ont
 * gagné ensemble.
 */
export interface QuestionDEquipe {
  presents: number
  points: number
}

/** Ce que la règle lit d'une ligne du journal des réponses. */
export interface LigneDuJournal {
  playerId: string
  sessionId: string
  qIndex: number
  points: number
  /**
   * L'équipe du joueur quand la ligne s'est écrite, `null` s'il n'en avait
   * pas ; absente des lignes d'avant, qui retombent sur la composition du
   * moment.
   */
  teamId?: string | null
}

/**
 * Le journal des réponses rangé par équipe, question par question, chaque
 * ligne sous l'équipe qu'elle a figée en s'écrivant : un joueur qui
 * déménage après un quiz laisse ses points à l'équipe pour laquelle il a
 * joué, et un invité sans équipe pendant le quiz ne compte pour aucune.
 * Compter avec la composition du moment retournait un verdict annoncé : Inès,
 * connectée sans équipe pendant le quiz, rejoignait les invités après, et
 * sa ligne à 0 faisait gagner la coloc ; Malik passait de la coloc aux
 * invités, et la coloc gagnait encore.
 *
 * Seules les lignes d'avant la colonne, qui n'en savent rien, se rangent
 * sous l'équipe du moment : les archives d'avant ne bougent pas.
 */
export function questionsDesEquipes(
  players: readonly { id: string; teamId: string | null }[],
  lignes: Iterable<LigneDuJournal>,
): Map<string, QuestionDEquipe[]> {
  const equipeDe = new Map<string, string>()
  for (const p of players) if (p.teamId) equipeDe.set(p.id, p.teamId)
  const parEquipe = new Map<string, Map<string, QuestionDEquipe>>()
  for (const l of lignes) {
    const teamId = equipeDeLaLigne(l, equipeDe)
    if (!teamId) continue
    let questions = parEquipe.get(teamId)
    if (!questions) parEquipe.set(teamId, (questions = new Map()))
    const cle = `${l.sessionId}#${l.qIndex}`
    const q = questions.get(cle)
    if (q) {
      q.presents++
      q.points += l.points
    } else questions.set(cle, { presents: 1, points: l.points })
  }
  return new Map([...parEquipe].map(([teamId, questions]) => [teamId, [...questions.values()]]))
}

/** L'équipe sous laquelle une ligne du journal compte : la sienne, ou celle du moment pour une ligne d'avant. */
export function equipeDeLaLigne(
  l: Pick<LigneDuJournal, 'playerId' | 'teamId'>,
  equipeDuMoment: ReadonlyMap<string, string>,
): string | null {
  return l.teamId !== undefined ? l.teamId : (equipeDuMoment.get(l.playerId) ?? null)
}

/**
 * La moyenne d'une équipe : pour chaque question, la moyenne des membres qui
 * y étaient, et la somme de ces moyennes.
 *
 * Elle divisait le total par tous les membres du moment : Inès, arrivée après
 * le quiz, faisait tomber la moyenne des invités de 1 280 à 640 et donnait la
 * victoire annoncée à l'autre équipe ; Karim, arrivé à la deuxième question,
 * faisait baisser les Randonneurs de 182 à 121 pour une question qu'il
 * n'avait jamais vue. Et le bilan divisait par les présents au quiz : deux
 * règles pour un même verdict. Quand tout le monde a tout joué, c'est la
 * moyenne par membre d'avant, au point près.
 *
 * L'arrondi vient à la fin : arrondir chaque question aurait fait dériver
 * d'un point par question deux équipes égales. Et il passe d'abord par six
 * décimales : des sixièmes additionnés en virgule flottante donnaient
 * 5 412,4999… aux Zèbres (six membres) quand les Aigles (deux) tombaient
 * juste sur 5 412,5 — 5 412 contre 5 413 pour deux équipes exactement ex
 * æquo (invariant 15).
 */
export function moyenneAuProrata(questions: Iterable<QuestionDEquipe>): number {
  let somme = 0
  for (const q of questions) if (q.presents > 0) somme += q.points / q.presents
  return Math.round(Number(somme.toFixed(6)))
}

/**
 * Somme et moyenne des points de chaque équipe. Le total additionne les
 * points de chacun ; la moyenne, celle qui classe, se lit au journal
 * (`moyenneAuProrata`).
 */
export function teamScores(
  teams: { id: string; name: string; emoji: string; position: number }[],
  players: PublicPlayer[],
  bonuses: { teamId: string; points: number }[],
  questions: ReadonlyMap<string, readonly QuestionDEquipe[]>,
): PublicTeam[] {
  return teams.map(t => {
    const members = players.filter(p => p.teamId === t.id)
    const total = members.reduce((sum, p) => sum + p.score, 0)
    return {
      ...t,
      memberCount: members.length,
      total,
      // Une équipe qui n'a rien joué vaut 0 : elle finit dernière.
      average: moyenneAuProrata(questions.get(t.id) ?? []),
      bonus: bonuses.filter(b => b.teamId === t.id).reduce((sum, b) => sum + b.points, 0),
    }
  })
}

/**
 * Trie les équipes à la moyenne et leur attribue les points d'équipe qu'elle rapporte.
 *
 * Le barème part du nombre d'équipes créées, pas du nombre d'équipes ayant
 * marqué : avec six équipes, la première rapporte toujours 6 points, même si
 * l'une d'elles est restée sans joueur. C'est sur cette échelle que les prix
 * de l'animateur s'ajoutent, et que se joue l'équipe gagnante.
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

/**
 * Les prix remis, dans l'ordre où l'animateur les a remis, et seulement ceux
 * d'une équipe encore là. Le registre les rend du plus récent au plus
 * ancien — c'est l'ordre de la console, où l'on retire le dernier ; le
 * lendemain, on les relit comme on les a vécus.
 */
export function prixRemis<T extends { id: string; teamId: string; createdAt: number }>(
  bonuses: T[],
  teams: { id: string }[],
): T[] {
  const ids = new Set(teams.map(t => t.id))
  return bonuses.filter(b => ids.has(b.teamId)).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

// ── Ce que l'on en dit ────────────────────────────────────────────────────
//
// Le classement des équipes s'expliquait de quatre façons, dont une fausse
// (« le gros chiffre est le total du quiz », faux dès le deuxième quiz), avec
// deux mots que personne n'a compris : « barème » et « chiffre cerclé ». Un
// seul mot désormais, « points d'équipe », et une seule phrase, ici, que
// reprennent le téléphone, l'écran commun, le souvenir et le bilan.

/** La règle des équipes, en une phrase, pour `n` équipes. */
export function regleDesEquipes(n: number): string {
  const echelle =
    n >= 3 ? ` : ${n} à la meilleure, ${n - 1} à la suivante, et ainsi de suite` : n === 2 ? ' : 2 à la meilleure, 1 à l’autre' : ''
  return (
    'La moyenne par membre — chacun y compte pour les questions qu’il a jouées dans l’équipe — donne des points d’équipe' +
    `${echelle}. Les prix en ajoutent, et le plus de points d’équipe l’emporte.`
  )
}

/** « 2 à la moyenne + 1 de prix » : d'où viennent les points d'équipe d'une équipe. */
export function detailDesPoints(t: Pick<TeamStanding, 'gamePoints' | 'bonus'>): string {
  if (t.bonus === 0) return `${t.gamePoints} à la moyenne`
  return `${t.gamePoints} à la moyenne ${t.bonus > 0 ? '+' : '−'} ${Math.abs(t.bonus)} de prix`
}

/**
 * Ce que ferait un prix, dit avant de cliquer : « +1 pour 🎸 Guitaristes → à
 * égalité en tête avec 🍝 Arrabbiata ».
 *
 * Un prix peut renverser la victoire, c'est voulu (README, « Les équipes »).
 * Mais Nadia et Marc l'ont découvert après l'avoir annoncée, devant toute la
 * salle : le renversement doit se voir venir, pas se subir.
 */
export function effetDUnPrix(teams: PublicTeam[], teamId: string, tape: number): string {
  // Arrondi comme le serveur arrondit (`Teams.awardBonus`) : « 1,4 » tapé
  // s'annonçait « +1.4 → prend la tête », et le serveur remettait +1 — une
  // égalité.
  const points = Math.round(tape)
  if (points === 0) return 'Pour l’honneur : aucun point d’équipe, aucun classement ne bouge'
  const nom = (t: { emoji: string; name: string }) => `${t.emoji} ${t.name}`
  const avant = finalRanking(teams)
  const apres = finalRanking(teams.map(t => (t.id === teamId ? { ...t, bonus: t.bonus + points } : t)))
  const moi = apres.find(t => t.id === teamId)
  const etait = avant.find(t => t.id === teamId)
  if (!moi || !etait) return ''
  const signe = `${points > 0 ? '+' : '−'}${Math.abs(points)} pour ${nom(moi)}`
  const aCote = apres.filter(t => t.rank === moi.rank && t.id !== teamId).map(nom)
  const seuleEnTete = avant.filter(t => t.rank === 1).length === 1
  let effet: string
  if (moi.rank === 1) {
    effet = aCote.length > 0
      ? `à égalité en tête avec ${enumerer(aCote)}`
      : etait.rank === 1 && seuleEnTete
        ? 'toujours en tête'
        : 'prend la tête'
  } else if (etait.rank === 1) {
    effet = `cède la tête à ${enumerer(apres.filter(t => t.rank === 1).map(nom))}`
  } else if (aCote.length > 0) {
    effet = `à égalité avec ${enumerer(aCote)}, ${rang(moi.rank)}`
  } else {
    effet = `${moi.rank === etait.rank ? 'reste' : 'passe'} ${rang(moi.rank)}`
  }
  return `${signe} → ${effet}`
}

/**
 * Sous le classement d'un podium de quiz : ce que les prix peuvent encore y
 * faire. Annoncé, le renversement devient un suspense au lieu d'un démenti.
 */
export function mentionDesPrix(teams: readonly { bonus: number }[]): string {
  return teams.some(t => t.bonus !== 0)
    ? 'Prix déjà remis compris — les suivants peuvent encore changer l’ordre.'
    : 'Avant les prix : ils peuvent encore changer l’ordre.'
}
