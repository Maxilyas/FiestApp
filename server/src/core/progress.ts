import type { PlayerRec } from './party'
import type { ScoreEntry } from './scores'
import type { AnswerRow } from './answers'
import { XP, totalGain, type GainSoiree } from '../../../shared/profil'

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
  xp: number
}

export function buildProgress(live: ProgressInput): SoireeGain[] {
  // Les totaux de la soirée, tout le monde compris : le podium se gagne
  // contre toute la salle, pas contre les seuls inscrits. Un profil qui
  // finirait troisième derrière deux anonymes n'est pas deuxième.
  const totals = new Map<string, number>()
  for (const s of live.scores) totals.set(s.playerId, (totals.get(s.playerId) ?? 0) + s.points)

  // Rang partagé, comme partout ailleurs : deux ex æquo sont premiers tous
  // les deux, et personne n'est quatrième parce que son prénom vient après.
  const classes = [...totals.entries()].filter(([, pts]) => pts > 0).sort((a, b) => b[1] - a[1])
  const rangDe = (playerId: string): number => {
    const pts = totals.get(playerId) ?? 0
    if (pts <= 0) return 0
    return classes.findIndex(([, p]) => p === pts) + 1
  }

  // Le vainqueur de chaque quiz de la soirée. Les lignes d'annulation étant
  // négatives, la somme suffit : une question retirée ne compte plus.
  const parQuiz = new Map<string, Map<string, number>>()
  for (const s of live.scores) {
    if (!s.sessionId) continue
    const m = parQuiz.get(s.sessionId) ?? new Map<string, number>()
    m.set(s.playerId, (m.get(s.playerId) ?? 0) + s.points)
    parQuiz.set(s.sessionId, m)
  }
  const victoires = new Map<string, number>()
  for (const m of parQuiz.values()) {
    let top: [string, number] | null = null
    for (const entry of m) if (!top || entry[1] > top[1]) top = entry
    if (top && top[1] > 0) victoires.set(top[0], (victoires.get(top[0]) ?? 0) + 1)
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

  return live.players.flatMap(p => {
    // Un invité anonyme ne gagne rien — et c'est sans conséquence sur sa
    // soirée : l'expérience ne donne aucun avantage de jeu.
    if (!p.profileId || !presents.has(p.id)) return []
    const rang = rangDe(p.id)
    const gain: GainSoiree = {
      presence: XP.presence,
      reponses: (repondues.get(p.id) ?? 0) * XP.parReponse,
      justesse: (justes.get(p.id) ?? 0) * XP.parBonneReponse,
      podium: rang >= 1 && rang <= XP.podium.length ? XP.podium[rang - 1] : 0,
      quiz: (victoires.get(p.id) ?? 0) * XP.vainqueurDeQuiz,
    }
    return [{ profileId: p.profileId, playerId: p.id, avatar: p.avatar, gain, xp: totalGain(gain) }]
  })
}
