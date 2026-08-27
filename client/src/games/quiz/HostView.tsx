import type { QuizCommand, QuizHostView } from '../../../../shared/games/quiz'
import { Countdown } from '../../components/Countdown'

const SHAPES = ['▲', '◆', '●', '■']
const MEDALS = ['🥇', '🥈', '🥉']

function Standings({ rows }: { rows: NonNullable<QuizHostView['standings']> }) {
  return (
    <div className="podium">
      {rows.map((p, i) => (
        <div key={i} className="lb-row">
          <span className="lb-rank">{MEDALS[i] ?? i + 1}</span>
          <span className="lb-avatar">{p.avatar}</span>
          <span className="lb-name">{p.name}</span>
          <span className="lb-score">{p.points}</span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  view: QuizHostView
  sendCommand: (command: QuizCommand) => void
  endSession: () => void
}

export function QuizHost({ view: v, sendCommand, endSession }: Props) {

  if (v.phase === 'pickPack') {
    return (
      <div className="quiz-host">
        <h2>🧠 Quiz — choisissez un pack</h2>
        <div className="game-cards">
          {v.packs?.map(p => (
            <div key={p.id} className="game-card">
              <h3>{p.title}</h3>
              <p className="muted">{p.questionCount} questions</p>
              <button className="btn btn-primary" onClick={() => sendCommand({ type: 'selectPack', packId: p.id })}>
                C'est parti !
              </button>
            </div>
          ))}
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={endSession}>Annuler</button>
        </div>
      </div>
    )
  }

  if (v.phase === 'getReady') {
    return (
      <div className="getready">
        <span className="getready-emoji">🚦</span>
        <p>Préparez vos téléphones…</p>
        {v.deadline && <Countdown deadline={v.deadline} />}
      </div>
    )
  }

  if (v.phase === 'question' || v.phase === 'reveal') {
    const revealing = v.phase === 'reveal'
    const last = v.qIndex + 1 >= v.qCount
    return (
      <div className="quiz-host">
        <div className="quiz-status">
          <span className="pill">{v.packTitle}</span>
          <span className="pill">Question {v.qIndex + 1}/{v.qCount}</span>
          {!revealing && (
            <>
              <Countdown deadline={v.deadline!} />
              <span className="muted">{v.answeredCount}/{v.participantCount} ont répondu</span>
            </>
          )}
          {revealing && v.fastest && (
            <span className="pill">⚡ {v.fastest.name} — {(v.fastest.ms / 1000).toFixed(2)} s</span>
          )}
        </div>

        <h2 className="quiz-question">{v.text}</h2>
        {v.image && <img className="quiz-img" src={v.image} alt="" />}

        <div className="ans-grid">
          {v.answers!.map((a, i) => (
            <div
              key={i}
              className={`ans-btn ans-${i}` + (revealing ? (i === v.correct ? ' correct' : ' dim') : '')}
            >
              <span className="ans-shape">{SHAPES[i]}</span>
              {a}
              {revealing && <span className="ans-count">{v.counts?.[i] ?? 0}</span>}
            </div>
          ))}
        </div>

        <div className="row">
          {revealing ? (
            <button className="btn btn-primary" onClick={() => sendCommand({ type: 'next' })}>
              {last ? '🏆 Voir le podium' : 'Question suivante'}
            </button>
          ) : (
            <button className="btn" onClick={() => sendCommand({ type: 'next' })}>
              Révéler la réponse
            </button>
          )}
          <button className="btn btn-ghost" onClick={endSession}>Terminer</button>
        </div>

        {revealing && v.standings && v.standings.length > 0 && (
          <div>
            <h3>Top du quiz</h3>
            <Standings rows={v.standings} />
          </div>
        )}
      </div>
    )
  }

  // finished
  return (
    <div className="quiz-host">
      <h2>🏆 Podium du quiz</h2>
      {v.standings && <Standings rows={v.standings} />}
      <div className="row">
        <button className="btn btn-primary" onClick={endSession}>Terminer le quiz</button>
      </div>
    </div>
  )
}
