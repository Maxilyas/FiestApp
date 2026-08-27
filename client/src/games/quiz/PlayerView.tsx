import type { QuizAction, QuizPlayerView } from '../../../../shared/games/quiz'
import { Countdown } from '../../components/Countdown'

const SHAPES = ['▲', '◆', '●', '■']
const MEDALS = ['🥇', '🥈', '🥉']

interface Props {
  view: QuizPlayerView
  send: (action: QuizAction) => void
}

export function QuizPlayer({ view: v, send }: Props) {

  if (v.phase === 'pickPack') {
    return (
      <div className="getready">
        <span className="getready-emoji">🧠</span>
        <p>Le quiz va commencer…</p>
      </div>
    )
  }

  if (v.phase === 'getReady') {
    return (
      <div className="getready">
        <span className="getready-emoji">🚦</span>
        <p>Prépare-toi…</p>
        {v.deadline && <Countdown deadline={v.deadline} />}
      </div>
    )
  }

  if (v.phase === 'question') {
    return (
      <div className="quiz-player">
        <div className="quiz-topbar">
          <span className="pill">Question {v.qIndex + 1}/{v.qCount}</span>
          <Countdown deadline={v.deadline!} />
        </div>
        <h2 className="quiz-question">{v.text}</h2>
        {v.image && <img className="quiz-img" src={v.image} alt="" />}
        <div className="ans-grid">
          {v.answers!.map((a, i) => (
            <button
              key={i}
              disabled={v.yourChoice !== null}
              onClick={() => send({ type: 'answer', choice: i })}
              className={`ans-btn ans-${i}` + (v.yourChoice === i ? ' chosen' : '')}
            >
              <span className="ans-shape">{SHAPES[i]}</span>
              {a}
            </button>
          ))}
        </div>
        {v.yourChoice !== null && <p className="muted center">Réponse enregistrée ✓ Regarde l'écran !</p>}
      </div>
    )
  }

  if (v.phase === 'reveal') {
    const good = v.yourChoice !== null && v.yourChoice === v.correct
    return (
      <div className="quiz-player">
        <div className={'card result-banner ' + (good ? 'result-ok' : 'result-ko')}>
          {v.yourChoice === null ? (
            <>
              <span className="big">⏰</span>
              <p>Trop tard !</p>
            </>
          ) : good ? (
            <>
              <span className="big">+{v.yourPoints} pts</span>
              <p>✅ Bien joué !</p>
            </>
          ) : (
            <>
              <span className="big">❌</span>
              <p>Raté…</p>
            </>
          )}
          <p className="muted">
            La bonne réponse : <strong>{v.answers![v.correct!]}</strong>
          </p>
        </div>
        <p className="center muted">
          Total quiz : {v.yourQuizTotal} pts · {v.yourQuizRank}ᵉ
        </p>
      </div>
    )
  }

  // finished
  return (
    <div className="quiz-player">
      <div className="card result-banner">
        <span className="big">🏁</span>
        <p>
          Quiz terminé ! Tu finis <strong>{v.yourQuizRank}ᵉ</strong> avec {v.yourQuizTotal} pts
        </p>
      </div>
      <div className="card">
        <h3>Podium</h3>
        <div className="podium">
          {v.podium?.map((p, i) => (
            <div key={i} className="lb-row">
              <span className="lb-rank">{MEDALS[i]}</span>
              <span className="lb-avatar">{p.avatar}</span>
              <span className="lb-name">{p.name}</span>
              <span className="lb-score">{p.points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
