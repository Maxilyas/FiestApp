import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import { Shape } from './Shape'
import { espacesFines, formatNumber, rang } from '../format'
import { formatPercent, formatSeconds, questionLabel } from '../../../shared/review'
import type {
  Review,
  ReviewAnswer,
  ReviewPlayer,
  ReviewQuestion,
  ReviewTeam,
} from '../../../shared/review'

/** Les index du bilan, construits une fois : partout on cherche par identifiant. */
export interface BilanCtx {
  review: Review
  playerById: Map<string, ReviewPlayer>
  teamById: Map<string, ReviewTeam>
  questionByKey: Map<string, ReviewQuestion>
}

export function makeCtx(review: Review): BilanCtx {
  return {
    review,
    playerById: new Map(review.players.map(p => [p.id, p])),
    teamById: new Map(review.teams.map(t => [t.id, t])),
    questionByKey: new Map(review.questions.map(q => [q.key, q])),
  }
}

/** « 🦊 Léa » — ou trois points d'interrogation pour un invité disparu. */
export function playerName(ctx: BilanCtx, id: string | null | undefined): string {
  const p = id ? ctx.playerById.get(id) : undefined
  return p ? `${p.avatar} ${p.name}` : '???'
}

/** Largeur d'une barre, en variable CSS : la feuille de style fait le reste. */
const bar = (ratio: number): CSSProperties => ({ ['--w' as string]: `${Math.round(ratio * 100)}%` })

interface Props {
  ctx: BilanCtx
  q: ReviewQuestion
  /** Le joueur dont c'est le bilan — absent dans la relecture collective. */
  me?: ReviewPlayer
  /** Ce qu'il a fait sur cette question. */
  answer?: ReviewAnswer
}

/**
 * Une question, avec ce que la salle en a fait — et, dans un bilan personnel,
 * ce que toi et ton équipe avez répondu en regard.
 */
export function QuestionCard({ ctx, q, me, answer }: Props) {
  const mine = me ? answer : undefined
  const team = me?.teamId ? q.byTeam.find(t => t.teamId === me.teamId) : undefined
  const status = !me
    ? ''
    : !mine?.answered
      ? ' q-missed'
      : mine.correct === false
        ? ' q-ko'
        : ' q-ok'

  const result = !me
    ? null
    : !mine?.answered
      ? 'sans réponse'
      : mine.points > 0
        ? `+${mine.points} pts`
        : 'raté'

  const successRate = q.answered ? q.correctCount / q.answered : null

  return (
    <article className={'bilan-q' + status}>
      <div className="bilan-q-head">
        <span className="label">
          {questionLabel(q)} · {Math.round(q.durationMs / 1000)} s
          {q.observed && ' · photo mémoire'}
        </span>
        {result && <span className="bilan-q-result">{result}</span>}
      </div>
      <h3 className="bilan-q-text">{espacesFines(q.text)}</h3>
      {!q.resolved && (
        <p className="muted small">
          L'intitulé n'a pas été retrouvé : le quiz a été supprimé ou renommé depuis la soirée.
        </p>
      )}
      {q.uncertain && (
        <p className="muted small">
          Le quiz a été modifié depuis la soirée : l'intitulé et les réponses peuvent différer de
          ce qui a été joué.
        </p>
      )}
      {q.image && <img className="bilan-q-img" src={q.image} alt="" loading="lazy" />}

      {q.kind === 'choice' ? (
        <>
          <ul className="bilan-answers">
            {q.answers.map((a, i) => {
              const share = q.answered ? q.counts[i] / q.answered : 0
              const teamShare = team && team.answered ? team.counts[i] / team.answered : 0
              const isCorrect = i === q.correct
              const isMine = mine?.choice === i
              return (
                <li key={i} className={'bilan-ans' + (isCorrect ? ' correct' : '') + (isMine ? ' mine' : '')}>
                  <div className="bilan-ans-row">
                    <Shape index={i} />
                    <span className="bilan-ans-text">
                      {espacesFines(a)}
                      {isMine && <span className="bilan-you">toi</span>}
                    </span>
                    {/* La coche ne parle qu'aux yeux : le lecteur d'écran lisait
                        les réponses sans jamais dire laquelle était la bonne. */}
                    {isCorrect && (
                      <>
                        <Icon name="check" className="bilan-ans-check" />
                        <span className="sr-only">la bonne réponse</span>
                      </>
                    )}
                    <span className="bilan-ans-pct num" title={`${q.counts[i]} réponse${q.counts[i] > 1 ? 's' : ''}`}>
                      {formatPercent(share)}
                    </span>
                  </div>
                  <div className="bilan-bars">
                    <span className="bilan-bar salle" style={bar(share)}>
                      <i />
                    </span>
                    {team && (
                      <span className="bilan-bar equipe" style={bar(teamShare)}>
                        <i />
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="bilan-q-foot muted small">
            {me &&
              (mine?.answered && mine.ms !== null ? (
                <span>
                  Ta réponse en {formatSeconds(mine.ms)}
                  {mine.changes > 0 && ` après ${mine.changes} changement${mine.changes > 1 ? 's' : ''} d'avis`}
                </span>
              ) : (
                <span>Tu n'as pas répondu</span>
              ))}
            <span>
              {q.answered === 0
                ? "Personne n'a répondu"
                : successRate !== null && `${formatPercent(successRate)} de la salle a trouvé`}
            </span>
            {team && (
              <span>
                Ton équipe : {team.correct} sur {team.asked}
              </span>
            )}
            {q.fastest && (
              <span>
                <Icon name="zap" />{' '}
                {me && q.fastest.playerId === me.id
                  ? `La réponse la plus rapide de la salle : la tienne, en ${formatSeconds(q.fastest.ms)}`
                  : `La plus rapide : ${playerName(ctx, q.fastest.playerId)}, en ${formatSeconds(q.fastest.ms)}`}
              </span>
            )}
          </p>
        </>
      ) : (
        <div className="bilan-guess">
          <p>
            <span className="label">La bonne valeur</span>
            <br />
            <span className="bilan-target">
              {q.target !== null ? formatNumber(q.target) : '?'} <span className="target-unit">{q.unit}</span>
            </span>
          </p>
          {me &&
            (mine?.answered && mine.value !== null ? (
              <p>
                Ta proposition : <strong className="num">{formatNumber(mine.value)} {q.unit}</strong>
                {/* Le rang du barème, partagé à égalité d'écart : deux valeurs
                    exactes sont premières toutes les deux, comme au jeu. */}
                {mine.value === q.target
                  ? ' · pile-poil'
                  : mine.proximityRank !== null &&
                    (mine.proximityRank === 1
                      ? ' · la plus proche de toute la salle'
                      : ` · ${rang(mine.proximityRank)} estimation la plus proche sur ${q.guesses}`)}
                {mine.ms !== null && ` · en ${formatSeconds(mine.ms)}`}
              </p>
            ) : (
              <p className="muted">Tu n'as rien proposé.</p>
            ))}
          <p className="muted small">
            {q.closest.length === 0
              ? "Personne n'a proposé de valeur"
              : `${q.closest.length > 1 ? 'Les plus proches de la salle, à égalité' : 'Le plus proche de la salle'} : ${q.closest
                  .map(c => `${playerName(ctx, c.playerId)} avec ${formatNumber(c.value)} ${q.unit}`.trim())
                  .join(', ')}`}
            {q.guesses > 0 && ` · ${q.guesses} proposition${q.guesses > 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {/* La relecture collective compare les équipes ; le bilan personnel
          n'a que la tienne, déjà dans les barres et le pied. */}
      {!me && q.byTeam.length > 0 && (
        <div className="bilan-teams">
          {[...q.byTeam]
            .sort((a, b) =>
              q.kind === 'choice' ? b.correct / b.asked - a.correct / a.asked : b.points - a.points,
            )
            .map((t, i) => {
              const rec = ctx.teamById.get(t.teamId)
              if (!rec) return null
              const top = i === 0 && (q.kind === 'choice' ? t.correct > 0 : t.points > 0)
              return (
                <span key={t.teamId} className={'bilan-teamchip' + (top ? ' top' : '')} title={rec.name}>
                  {rec.emoji} {q.kind === 'choice' ? `${t.correct}/${t.asked}` : `${t.points} pts`}
                </span>
              )
            })}
        </div>
      )}
      {!me && q.newLeader && (
        <p className="bilan-leader">
          <Icon name="crown" /> {playerName(ctx, q.newLeader)} prend la tête du classement
        </p>
      )}
    </article>
  )
}
