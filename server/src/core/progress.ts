import type { PlayerRec } from './party'
import type { ScoreEntry } from './scores'
import type { AnswerRow } from './answers'
import { XP, totalGain, type GainSoiree, type ReleveSoiree } from '../../../shared/profil'
import { rangPartage } from '../../../shared/classement'

/**
 * Ce qu'une soirée rapporte aux profils qui l'ont jouée.
 *
 * Fonction pure, dérivée des journaux — même famille que `recap.ts`,
 * `stats.ts` et `review.ts`. Elle ne lit aucune base et n'écrit nulle part :
 * la consolidation, elle, se fait dans `SpaceRuntime.archiveParty()`, au seul
 * moment où l'on est sûr que la soirée est rangée.
 *
 * Le barème (`shared/profil.ts`) récompense d'abord d'être venu et d'avoir
 * joué, la justesse seulement ensuite. Un niveau qui ne mesurerait que la
 * culture générale n'aurait pas le goût d'une soirée entre amis.
 */
export interface ProgressInput {
  players: PlayerRec[]
  scores: ScoreEntry[]
  answers: AnswerRow[]
}

export interface SoireeGain {
  profileId: string
  playerId: string
  /** L'emoji joué ce soir-là — celui qui peut éclater. */
  avatar: string
  gain: GainSoiree
  /** Les chiffres bruts, que les badges de carrière additionnent. */
  releve: ReleveSoiree
  xp: number
}

export function buildProgress(live: ProgressInput): SoireeGain[] {
  // Des gains sans joueur — les points fantômes d'un invité exclu — ne
  // comptent pour personne : en tête de la soirée, un fantôme faisait
  // descendre tout le podium d'une marche et raflait la victoire d'un quiz.
  const inscrits = new Set(live.players.map(p => p.id))
  const scores = live.scores.filter(s => inscrits.has(s.playerId))

  // Les totaux de la soirée, tout le monde compris : le podium se gagne
  // contre toute la salle, pas contre les seuls inscrits. Un profil qui
  // finirait troisième derrière deux anonymes n'est pas deuxième.
  const totals = new Map<string, number>()
  for (const s of scores) totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.points)

  // Rang partagé, comme partout ailleurs (shared/classement.ts) : deux ex
  // æquo sont premiers tous les deux, et personne n'est quatrième parce que
  // son prénom vient après.
  const positifs = [...totals.values()].filter(pts => pts > 0)
  const rangDe = (playerId: string): number => {
    const pts = totals.get(playerId) ?? 0
    return pts > 0 ? rangPartage(pts, positifs) : 0
  }

  // Les vainqueurs de chaque quiz de la soirée. Les lignes d'annulation étant
  // négatives, la somme suffit : une question retirée ne compte plus.
  const parQuiz = new Map<string, Map<string, number>>()
  for (const s of scores) {
    if (!s.sessionId) continue
    const m = parQuiz.get(s.sessionId) ?? new Map<string, number>()
    m.set(s.playerId, (m.get(s.playerId) ?? 0) + s.points)
    parQuiz.set(s.sessionId, m)
  }
  // Des ex æquo gagnent ensemble, et chacun touche une victoire entière — le
  // barème ne change pas. L'expérience allait au premier à avoir marqué.
  const victoires = new Map<string, number>()
  for (const m of parQuiz.values()) {
    const top = Math.max(...m.values())
    if (top <= 0) continue
    for (const [playerId, pts] of m) {
      if (pts === top) victoires.set(playerId, (victoires.get(playerId) ?? 0) + 1)
    }
  }

  const repondues = new Map<string, number>()
  const justes = new Map<string, number>()
  /** Ceux à qui au moins une question a été posée : c'est ça, avoir été là. */
  const presents = new Set<string>()
  for (const r of live.answers) {
    presents.add(r.playerId)
    if (r.answered) repondues.set(r.playerId, (repondues.get(r.playerId) ?? 0) + 1)
    if (r.correct === true) justes.set(r.playerId, (justes.get(r.playerId) ?? 0) + 1)
  }

  const gains = live.players.flatMap(p => {
    // Un invité anonyme ne gagne rien — et c'est sans conséquence sur sa
    // soirée : l'expérience ne donne aucun avantage de jeu.
    if (!p.profileId || !presents.has(p.id)) return []
    const rang = rangDe(p.id)
    const releve: ReleveSoiree = {
      reponses: repondues.get(p.id) ?? 0,
      justes: justes.get(p.id) ?? 0,
      rang,
      quiz: victoires.get(p.id) ?? 0,
    }
    const gain: GainSoiree = {
      presence: XP.presence,
      reponses: releve.reponses * XP.parReponse,
      justesse: releve.justes * XP.parBonneReponse,
      podium: rang >= 1 && rang <= XP.podium.length ? XP.podium[rang - 1] : 0,
      quiz: releve.quiz * XP.vainqueurDeQuiz,
    }
    return [{ profileId: p.profileId, playerId: p.id, avatar: p.avatar, gain, releve, xp: totalGain(gain) }]
  })

  // Un gain par profil, au plus. Un profil ne tient qu'un joueur par soirée —
  // c'est à l'inscription de le garantir ; s'il en tenait deux quand même,
  // leurs deux lignes (profil, soirée) se remplaceraient l'une l'autre au
  // crédit, dans un ordre que personne ne choisit. On garde la meilleure, et
  // à égalité la première arrivée.
  const parProfil = new Map<string, SoireeGain>()
  for (const g of gains) {
    const deja = parProfil.get(g.profileId)
    if (!deja || g.xp > deja.xp) parProfil.set(g.profileId, g)
  }
  return [...parProfil.values()]
}
