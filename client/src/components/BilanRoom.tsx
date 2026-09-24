import { Icon, type IconName } from './Icon'
import { espacesFines } from '../format'
import { classer, enumerer } from '../../../shared/classement'
import { VerdictDesEquipes } from './TeamBoard'
import { detailDesPoints, regleDesEquipes } from '../../../shared/teams'
import { PrixRemis } from './PrixRemis'
import { formatPercent, formatSeconds, questionLabel } from '../../../shared/review'
import type { ReviewQuestion } from '../../../shared/review'
import { QuestionCard, playerName, type BilanCtx } from './BilanQuestion'

/**
 * La soirée relue par tout le monde : les questions qui ont marqué, les
 * équipes quiz par quiz, puis chaque question avec la répartition des
 * réponses, la réussite de chaque équipe et le plus rapide.
 */
export function RoomReview({ ctx }: { ctx: BilanCtx }) {
  const { review } = ctx
  const rec = review.records
  const rate = (q: ReviewQuestion) => `${formatPercent(q.correctCount / q.answered)} de bonnes réponses`
  const record = (key: string | null, title: string, icon: IconName, sub: (q: ReviewQuestion) => string) => {
    const q = key ? ctx.questionByKey.get(key) : undefined
    if (!q) return null
    return (
      <div className="card trophy">
        <span className="trophy-icon">
          <Icon name={icon} />
        </span>
        <h3>{title}</h3>
        <p>{espacesFines(q.text)}</p>
        <p className="muted small">
          {questionLabel(q)} du quiz {espacesFines(`« ${q.quizTitle} »`)} · {sub(q)}
        </p>
      </div>
    )
  }
  const hasRecord = Object.values(rec).some(v => v !== null)

  return (
    <>
      {hasRecord && (
        <section className="card">
          <h2>Les questions qui ont marqué</h2>
          <div className="trophies">
            {record(rec.hardest, 'La plus ratée', 'alert', rate)}
            {record(rec.easiest, 'La plus facile', 'check-circle', rate)}
            {record(
              rec.mostDivisive,
              'La plus clivante',
              'users',
              q => `la réponse la plus choisie n'a réuni que ${formatPercent(Math.max(...q.counts) / q.answered)} de la salle`,
            )}
            {record(rec.mostHesitant, 'La plus hésitante', 'rotate', q => `${q.changes} changement${q.changes > 1 ? 's' : ''} d'avis`)}
            {record(rec.quickest, 'La plus vite jouée', 'zap', q => `${formatSeconds(q.avgMs!)} de moyenne`)}
            {record(rec.slowest, 'La plus longue à jouer', 'clock', q => `${formatSeconds(q.avgMs!)} de moyenne`)}
          </div>
        </section>
      )}

      {review.teams.length > 0 && (
        <section className="card">
          <h2>Les équipes, quiz par quiz</h2>
          <VerdictDesEquipes teams={review.teams} avecPrix={review.bonuses.length > 0} />
          <div className="stats-scroll">
            <table className="stats-table">
              <thead>
                <tr>
                  <th className="stats-name">Équipe</th>
                  {review.quizzes.map(q => (
                    <th key={q.sessionId} title={q.title}>
                      Quiz {q.number}
                    </th>
                  ))}
                  <th title="Moyenne par membre sur toute la soirée — c'est elle qui donne les points d'équipe">Moyenne</th>
                  <th title="Part de bonnes réponses aux QCM, tous membres confondus">Réussite</th>
                  <th title="Estimations : la part de la salle que celles de l’équipe battent ou égalent, en moyenne">Coup d’œil</th>
                  <th title="Temps de réponse moyen">Temps</th>
                  <th title="Les points d'équipe : ceux de la moyenne, prix compris — ils désignent la gagnante">Points d’équipe</th>
                </tr>
              </thead>
              <tbody>
                {/* Rangées aux points d'équipe, prix compris : à la moyenne, la
                    première ligne n'était pas la gagnante dès qu'un prix
                    renversait l'ordre. */}
                {classer(review.teams, t => t.finalPoints, t => t.name, t => t.id).map(({ item: t }) => (
                  <tr key={t.id}>
                    <td className="stats-name">
                      {t.emoji} {t.name} <span className="muted small">{t.memberCount}</span>
                    </td>
                    {t.perQuiz.map(pq => (
                      <td key={pq.sessionId} title={`${pq.total} pts au total`}>
                        {pq.average}
                        {pq.rank === 1 && pq.average > 0 && ' ★'}
                      </td>
                    ))}
                    <td className="stats-active">{t.average}</td>
                    <td>{t.accuracy === null ? '—' : formatPercent(t.accuracy)}</td>
                    <td>{t.coupDOeil === null ? '—' : formatPercent(t.coupDOeil)}</td>
                    <td>{t.avgMs === null ? '—' : formatSeconds(t.avgMs)}</td>
                    <td title={detailDesPoints(t)}>{t.finalPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            La moyenne de chaque quiz, ★ pour la meilleure. {regleDesEquipes(review.teams.length)}
          </p>
        </section>
      )}

      {review.bonuses.length > 0 && (
        <section className="card">
          <h2>Remis ce soir-là</h2>
          <p className="muted small">Les prix remis à l'écran, dans l'ordre, et les points qu'ils ont rapportés.</p>
          <PrixRemis bonuses={review.bonuses} teams={review.teams} />
        </section>
      )}

      {review.quizzes.map(quiz => {
        // Tous les ex æquo, dans l'ordre commun : n'en nommer qu'un disait à
        // l'autre qu'il avait perdu un quiz qu'il avait gagné.
        const gagnants = quiz.winners.filter(w => ctx.playerById.has(w.playerId))
        const equipes = quiz.teamWinners.flatMap(w => {
          const team = ctx.teamById.get(w.teamId)
          return team ? [{ ...w, team }] : []
        })
        return (
          <section key={quiz.sessionId} className="card bilan-quiz">
            <div className="card-head">
              <h2>{quiz.title}</h2>
              <span className="pill">
                {quiz.questionCount} question{quiz.questionCount > 1 ? 's' : ''} · {quiz.players} joueur
                {quiz.players > 1 ? 's' : ''}
              </span>
            </div>
            {(gagnants.length > 0 || equipes.length > 0) && (
              <p className="muted small">
                {gagnants.length > 0 && (
                  <>
                    <Icon name="trophy" /> {enumerer(gagnants.map(w => playerName(ctx, w.playerId)))}{' '}
                    {gagnants.length > 1 ? 'remportent ce quiz ex æquo' : 'remporte ce quiz'} avec {gagnants[0].points} pts
                  </>
                )}
                {gagnants.length > 0 && equipes.length > 0 && ' · '}
                {equipes.length > 0 && (
                  <>
                    {/* La moyenne du quiz seul, sans les prix : « meilleure équipe »
                        couronnait ici celle que l'écran de victoire ne
                        couronnait pas. */}
                    {equipes.length > 1 ? 'meilleures moyennes ex æquo' : 'meilleure moyenne'} :{' '}
                    {enumerer(equipes.map(e => `${e.team.emoji} ${e.team.name}`))} ({equipes[0].average} pts de moyenne)
                  </>
                )}
              </p>
            )}
            {review.questions
              .filter(q => q.sessionId === quiz.sessionId)
              .map(q => (
                <QuestionCard key={q.key} ctx={ctx} q={q} />
              ))}
          </section>
        )
      })}
    </>
  )
}
