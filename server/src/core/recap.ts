import { computeStats } from './stats'
import type { AnswerRow } from './answers'
import type { ScoreEntry } from './scores'
import { prixRemis, questionsDesEquipes, teamScores } from '../../../shared/teams'
import { nomAffiche } from '../../../shared/homonymes'
import { classer, ordreDAffichage, ordreDeClassement, vainqueurs } from '../../../shared/classement'
import type { PublicPlayer, Recap, TeamBonus } from '../../../shared/types'

/**
 * La page souvenir, calculée à partir du journal des gains et du journal des
 * réponses. Une fonction pure : la soirée en cours et une soirée archivée
 * passent par le même chemin, et le souvenir d'il y a deux ans se relit
 * avec le code d'aujourd'hui.
 */
export interface RecapInput {
  players: PublicPlayer[]
  teams: { id: string; name: string; emoji: string; position: number }[]
  bonuses: TeamBonus[]
  scores: ScoreEntry[]
  answers: AnswerRow[]
}

/** Le titre du quiz, repris du libellé « Quiz « … » — Q3 » écrit par le module de jeu. */
const QUIZ_TITLE = /^Quiz « (.+) » — Q\d+$/

export function buildRecap(input: RecapInput): Recap {
  const { players, teams, bonuses } = input
  const byId = new Map(players.map(p => [p.id, p]))
  // Des gains sans joueur — les points fantômes d'un invité exclu — ne
  // comptent pour personne : ils cachaient le vrai vainqueur d'un quiz (le
  // fantôme en tête, il n'y avait plus personne à couronner) et gonflaient
  // le total de la soirée.
  const scores = input.scores.filter(s => byId.has(s.playerId))
  const answers = input.answers.filter(r => byId.has(r.playerId))
  const nomDe = (playerId: string) => nomAffiche(byId.get(playerId)!)

  // Le plus beau coup et le plus régulier se lisent dans le journal des
  // réponses, comme le bilan. Le journal des gains garde le +600 d'une
  // question annulée à côté de son −600 — elle devenait « le plus beau
  // coup » —, et compte deux fois une question reposée. Le journal des
  // réponses, lui, retire l'une et ne garde que la seconde pose de l'autre.
  const marquees = answers.filter(r => r.points > 0)

  // Le plus beau coup : le plus gros gain sur une seule question. À égalité,
  // l'ordre commun des classements, puis la première fois.
  const affichage = ordreDAffichage<AnswerRow>(r => nomDe(r.playerId), r => r.playerId)
  const [best] = [...marquees].sort((a, b) => b.points - a.points || affichage(a, b) || a.createdAt - b.createdAt)

  // Le plus régulier : celui qui a marqué sur le plus de questions.
  const counts = new Map<string, number>()
  for (const r of marquees) counts.set(r.playerId, (counts.get(r.playerId) ?? 0) + 1)
  const steady = classer([...counts], ([, n]) => n, ([id]) => nomDe(id), ([id]) => id)[0]?.item

  // Les vainqueurs de chaque quiz, dans l'ordre où les quiz ont été joués :
  // autant de prix à remettre, et chacun garde une chance même si le
  // classement général lui échappe. Des ex æquo gagnent ensemble — c'est la
  // règle de l'expérience aussi : le souvenir couronnait le premier à avoir
  // marqué, le bilan le premier de l'alphabet.
  const sessions = new Map<string, { started: number; title: string; totals: Map<string, number> }>()
  for (const s of scores) {
    if (!s.sessionId) continue
    let sess = sessions.get(s.sessionId)
    if (!sess) {
      sess = { started: s.createdAt, title: '', totals: new Map() }
      sessions.set(s.sessionId, sess)
    }
    sess.started = Math.min(sess.started, s.createdAt)
    sess.totals.set(s.playerId, (sess.totals.get(s.playerId) ?? 0) + s.points)
    // Les lignes d'annulation n'ont pas le titre : on prend la première qui l'a.
    if (!sess.title) sess.title = QUIZ_TITLE.exec(s.reason)?.[1] ?? ''
  }
  const quizWinners = [...sessions.entries()]
    .sort(([, a], [, b]) => a.started - b.started)
    .flatMap(([sessionId, sess]) =>
      vainqueurs([...sess.totals], ([, points]) => points, ([id]) => nomDe(id), ([id]) => id).map(([id, points]) => ({
        title: sess.title || 'Un quiz',
        name: nomDe(id),
        avatar: byId.get(id)!.avatar,
        points,
        sessionId,
      })),
    )

  const bestPlayer = best ? byId.get(best.playerId) : undefined
  const steadyPlayer = steady ? byId.get(steady[0]) : undefined

  return {
    // L'ordre commun : à égalité, le prénom affiché. Le souvenir suivait
    // l'ordre d'arrivée quand l'écran commun suivait l'alphabet.
    ranking: players
      .filter(p => p.score !== 0)
      .sort(ordreDeClassement<PublicPlayer>(p => p.score, nomAffiche, p => p.id))
      .map(p => ({ name: nomAffiche(p), avatar: p.avatar, points: p.score })),
    teams: teamScores(teams, players, bonuses, questionsDesEquipes(players, answers)),
    stats: computeStats(answers, players),
    // Un quiz joué a laissé des réponses, pas forcément des points : quand
    // toute la salle s'est trompée, le journal des gains n'en dit rien.
    quizCount: new Set([...sessions.keys(), ...answers.map(r => r.sessionId)]).size,
    totalPoints: scores.reduce((sum, s) => sum + s.points, 0),
    bestShot:
      best && bestPlayer
        ? {
            name: nomAffiche(bestPlayer),
            avatar: bestPlayer.avatar,
            points: best.points,
            // Le libellé que le module de jeu écrit au journal des gains.
            reason: `Quiz « ${best.quizTitle} » — Q${best.qIndex + 1}`,
          }
        : null,
    steadiest:
      steady && steadyPlayer ? { name: nomAffiche(steadyPlayer), avatar: steadyPlayer.avatar, count: steady[1] } : null,
    quizWinners,
    bonuses: prixRemis(bonuses, teams),
  }
}
