import { Icon, type IconName } from './Icon'
import { formatNumber, place, rang } from '../format'
import { formatPercent, formatSeconds, questionLabel } from '../../../shared/review'
import type { HighlightKind, ReviewHighlight, ReviewPlayer, ReviewQuestion } from '../../../shared/review'
import { QuestionCard, type BilanCtx } from './BilanQuestion'

const HIGHLIGHT_ICONS: Record<HighlightKind, IconName> = {
  onlyRight: 'star',
  onlyWrong: 'flag',
  fastest: 'zap',
  saviour: 'users',
  exact: 'target',
  closest: 'target',
}

/** Le libellé d'un exploit répété : la version d'une seule question porte un détail en plus. */
const HIGHLIGHT_TITLES: Record<HighlightKind, string> = {
  onlyRight: 'La seule bonne réponse de toute la salle',
  onlyWrong: 'La seule mauvaise réponse de toute la salle',
  fastest: 'La bonne réponse la plus rapide de la salle',
  saviour: 'La seule bonne réponse de ton équipe',
  exact: 'Pile-poil : la valeur exacte',
  closest: "L'estimation la plus proche de toute la salle",
}

/** Les exploits regroupés par nature : « la seule bonne réponse de ton équipe » quinze fois, c'est une ligne. */
function groupHighlights(list: ReviewHighlight[]): ReviewHighlight[][] {
  const groups = new Map<HighlightKind, ReviewHighlight[]>()
  for (const h of list) groups.set(h.kind, [...(groups.get(h.kind) ?? []), h])
  return [...groups.values()]
}

/**
 * Le bilan d'un invité : ses chiffres, ses moments forts, puis chaque
 * question avec ce qu'il a répondu, ce que son équipe a répondu et ce que
 * la salle a répondu. Le même composant sert la page et les fiches imprimées.
 */
export function PlayerReview({ ctx, player }: { ctx: BilanCtx; player: ReviewPlayer }) {
  const { review } = ctx
  const s = player.stat
  const played = review.players.filter(p => p.stat.asked > 0)
  const team = player.teamId ? ctx.teamById.get(player.teamId) : undefined
  const mates = team ? played.filter(p => p.teamId === team.id) : []
  const mineByKey = new Map(player.answers.map(a => [a.questionKey, a]))

  // Le plus beau coup : la question qui a rapporté le plus.
  const bestShot = player.answers.reduce<(typeof player.answers)[number] | null>(
    (best, a) => (a.points > 0 && (!best || a.points > best.points) ? a : best),
    null,
  )
  const bestShotQ = bestShot ? ctx.questionByKey.get(bestShot.questionKey) : undefined
  const questionRef = (key: string) => {
    const q = ctx.questionByKey.get(key)
    return q ? `${questionLabel(q)} · ${q.text}` : ''
  }
  // Plusieurs questions sur une ligne : le numéro suffit, avec le quiz s'il y en a plusieurs.
  const shortRef = (q: ReviewQuestion) =>
    review.quizzes.length > 1 ? `${questionLabel(q)} du quiz ${q.quizNumber}` : questionLabel(q)

  return (
    <>
      <section className="card">
        <div className="bilan-who">
          <span className="bilan-avatar">{player.avatar}</span>
          <div>
            <h2>{player.name}</h2>
            <p className="muted">
              {team ? `${team.emoji} ${team.name}` : 'sans équipe'}
              {' · '}
              {s.asked} question{s.asked > 1 ? 's' : ''} jouée{s.asked > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="bilan-tiles">
          <div className="bilan-tile">
            <span className="label">Points</span>
            <span className="bilan-tile-value">{formatNumber(player.points)}</span>
            <span className="bilan-tile-sub">
              {place(player.rank)} sur {played.length}
            </span>
          </div>
          {team && player.teamRank !== null && (
            <div className="bilan-tile">
              <span className="label">Dans ton équipe</span>
              <span className="bilan-tile-value">{rang(player.teamRank)}</span>
              <span className="bilan-tile-sub">
                place sur {mates.length} · {team.emoji} {team.name}
              </span>
            </div>
          )}
          <div className="bilan-tile">
            <span className="label">Réussite</span>
            <span className="bilan-tile-value">{s.accuracy === null ? '—' : formatPercent(s.accuracy)}</span>
            <span className="bilan-tile-sub">
              {s.correct} juste{s.correct > 1 ? 's' : ''} sur {s.correct + s.wrong} QCM
              {s.missed > 0 && ` · ${s.missed} passée${s.missed > 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="bilan-tile">
            <span className="label">Temps moyen</span>
            <span className="bilan-tile-value">{s.avgMs === null ? '—' : formatSeconds(s.avgMs)}</span>
            <span className="bilan-tile-sub">
              {s.bestMs !== null ? `au mieux ${formatSeconds(s.bestMs)}` : 'sur tes bonnes réponses'}
            </span>
          </div>
        </div>
      </section>

      {(player.awards.length > 0 || player.highlights.length > 0 || bestShot || s.bestStreak >= 3) && (
        <section className="card">
          <h2>Tes moments forts</h2>
          <ul className="bilan-moments">
            {player.awards.map(a => (
              <li key={a.title} className="bilan-moment">
                <span className="award-emoji">{a.emoji}</span>
                <div className="bilan-moment-body">
                  <strong>{a.title}</strong>
                  <span className="muted">{a.detail}</span>
                </div>
              </li>
            ))}
            {bestShot && bestShotQ && (
              <li className="bilan-moment">
                <span className="bilan-moment-icon">
                  <Icon name="trophy" />
                </span>
                <div className="bilan-moment-body">
                  <strong>Ton plus beau coup : +{bestShot.points} pts</strong>
                  <span className="muted">{questionRef(bestShot.questionKey)}</span>
                </div>
              </li>
            )}
            {s.bestStreak >= 3 && (
              <li className="bilan-moment">
                <span className="bilan-moment-icon">
                  <Icon name="sparkles" />
                </span>
                <div className="bilan-moment-body">
                  <strong>{s.bestStreak} bonnes réponses d'affilée</strong>
                  <span className="muted">ta plus longue série</span>
                </div>
              </li>
            )}
            {groupHighlights(player.highlights).map(group => {
              const [first] = group
              const refs = group
                .map(h => ctx.questionByKey.get(h.questionKey))
                .filter((q): q is ReviewQuestion => !!q)
              return (
                <li key={first.kind} className="bilan-moment">
                  <span className="bilan-moment-icon">
                    <Icon name={HIGHLIGHT_ICONS[first.kind]} />
                  </span>
                  <div className="bilan-moment-body">
                    <strong>
                      {group.length > 1 ? `${HIGHLIGHT_TITLES[first.kind]} · ${group.length} fois` : first.text}
                    </strong>
                    <span className="muted">
                      {group.length > 1 ? refs.map(shortRef).join(', ') : questionRef(first.questionKey)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {review.quizzes.map((quiz, i) => {
        const qs = review.questions.filter(q => q.sessionId === quiz.sessionId)
        const mine = qs.filter(q => mineByKey.has(q.key))
        if (mine.length === 0) return null // pas là pour ce quiz
        const late = qs.length - mine.length
        const pq = player.perQuiz[i]
        return (
          <section key={quiz.sessionId} className="card bilan-quiz">
            <div className="card-head">
              <h2>{quiz.title}</h2>
              <span className="pill">
                {pq.points} pts{pq.rank !== null && ` · ${place(pq.rank)} sur ${quiz.players}`}
              </span>
            </div>
            {team && (
              <p className="bilan-legend">
                <span>
                  <i /> la salle
                </span>
                <span className="equipe">
                  <i /> ton équipe
                </span>
              </p>
            )}
            {late > 0 && (
              <p className="muted small">
                Arrivée en cours de quiz : {late === 1 ? 'la première question' : `les ${late} premières questions`} ne
                compte{late > 1 ? 'nt' : ''} pas pour toi.
              </p>
            )}
            {mine.map(q => (
              <QuestionCard key={q.key} ctx={ctx} q={q} me={player} answer={mineByKey.get(q.key)} />
            ))}
          </section>
        )
      })}
    </>
  )
}
