import { useEffect, useState, type FormEvent } from 'react'
import type { QuizAction, QuizPlayerView } from '../../../../shared/games/quiz'
import { GetReady } from '../../components/GetReady'
import { TimerBar } from '../../components/TimerBar'
import { questionSizeClass } from './HostView'

const SHAPES = ['▲', '◆', '●', '■']
const MEDALS = ['🥇', '🥈', '🥉']

const formatNumber = (n: number) => n.toLocaleString('fr-FR')

interface Props {
  view: QuizPlayerView
  send: (action: QuizAction) => void
}

/**
 * Saisie d'une estimation. Tant que tout le monde n'a pas répondu, on peut
 * corriger : sur un clavier de téléphone, un chiffre en trop est vite arrivé.
 */
function GuessForm({ view, send }: Props) {
  const [text, setText] = useState('')

  // Nouvelle question → on vide le champ.
  useEffect(() => setText(''), [view.qIndex])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = Number(text.replace(',', '.'))
    if (!Number.isFinite(value) || text.trim() === '') return
    send({ type: 'guess', value })
  }

  return (
    <form className="guess-form" onSubmit={submit}>
      <div className="guess-row">
        <input
          className="input guess-input"
          type="text"
          inputMode="decimal"
          placeholder="Ton estimation"
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
        />
        {view.unit && <span className="guess-unit">{view.unit}</span>}
      </div>
      <button className="btn btn-primary btn-big" disabled={text.trim() === ''}>
        {view.yourGuess === null ? 'Valider' : 'Corriger'}
      </button>
      {view.yourGuess !== null && view.yourGuess !== undefined && (
        <p className="muted center">
          Ta réponse : <strong>{formatNumber(view.yourGuess)}</strong> {view.unit} — tu peux encore la corriger
        </p>
      )}
    </form>
  )
}

/** Arrivé en pleine partie : il n'a pas raté la question, il n'était pas là. */
function Welcome() {
  return (
    <>
      <span className="big">👋</span>
      <p>Bienvenue ! Tu joues à partir de la prochaine question.</p>
    </>
  )
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
    return <GetReady deadline={v.deadline!} label="Prépare-toi…" />
  }

  if (v.phase === 'question') {
    return (
      <div className="quiz-player">
        <div className="quiz-topbar">
          <span className="pill">
            Question {v.qIndex + 1}/{v.qCount}
          </span>
          {(v.multiplier ?? 1) > 1 && <span className="pill multi">×{v.multiplier} points</span>}
        </div>
        <TimerBar
          deadline={v.deadline!}
          duration={v.duration ?? 20}
          frozenMs={v.paused ? v.remainingMs : undefined}
        />
        {v.paused && <p className="muted center">⏸ En pause — regarde l'écran commun</p>}
        <h2 className={'quiz-question' + questionSizeClass(v.text)}>{v.text}</h2>
        {v.image && <img className="quiz-img" src={v.image} alt="" />}

        {v.kind === 'number' ? (
          <GuessForm view={v} send={send} />
        ) : (
          <>
            <div className="ans-grid">
              {v.answers!.map((a, i) => (
                <button
                  key={i}
                  // Les autres réponses restent actives : on peut se raviser
                  // jusqu'à la révélation. Les estomper les ferait paraître
                  // hors d'atteinte.
                  disabled={v.paused}
                  onClick={() => {
                    navigator.vibrate?.(35)
                    send({ type: 'answer', choice: i })
                  }}
                  className={`ans-btn ans-${i}` + (v.yourChoice === i ? ' chosen' : '')}
                >
                  <span className="ans-shape">{SHAPES[i]}</span>
                  <span className="ans-text">{a}</span>
                </button>
              ))}
            </div>
            {v.yourChoice !== null && (
              <p className="muted center">
                Réponse enregistrée ✓ Tu peux encore changer — mais tu perdrais du bonus de rapidité.
              </p>
            )}
          </>
        )}
      </div>
    )
  }

  if (v.phase === 'reveal') {
    // Estimation : pas de bonne ou mauvaise réponse, seulement un écart.
    if (v.kind === 'number') {
      const answered = v.yourGuess !== null && v.yourGuess !== undefined
      const gap = answered ? Math.abs(v.yourGuess! - v.target!) : null
      return (
        <div className="quiz-player">
          <div className={'card result-banner pop ' + (answered ? 'result-ok' : v.justArrived ? '' : 'result-ko')}>
            {answered ? (
              <>
                <span className="big">+{v.yourPoints ?? 0} pts</span>
                <p>
                  Tu as dit <strong>{formatNumber(v.yourGuess!)}</strong> {v.unit}
                  {gap === 0 ? ' — pile poil ! 🎯' : ` — à ${formatNumber(gap!)} ${v.unit} près`}
                </p>
              </>
            ) : v.justArrived ? (
              <Welcome />
            ) : (
              <>
                <span className="big">⏰</span>
                <p>Trop tard !</p>
              </>
            )}
            <p className="muted">
              La bonne réponse : <strong>{formatNumber(v.target!)}</strong> {v.unit}
            </p>
          </div>
          <p className="center muted">
            Total quiz : {v.yourQuizTotal} pts · {v.yourQuizRank}ᵉ
          </p>
        </div>
      )
    }

    const good = v.yourChoice !== null && v.yourChoice === v.correct
    return (
      <div className="quiz-player">
        <div className={'card result-banner pop ' + (good ? 'result-ok' : v.justArrived ? '' : 'result-ko')}>
          {v.justArrived ? (
            <Welcome />
          ) : v.yourChoice === null ? (
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
      <div className="card result-banner pop">
        <span className="big">🏁</span>
        <p>
          Quiz terminé ! Tu finis <strong>{v.yourQuizRank}ᵉ</strong> avec {v.yourQuizTotal} pts
        </p>
      </div>
      <div className="card">
        <h3>Podium</h3>
        <div className="podium">
          {v.podium?.map((p, i) => (
            <div key={i} className="lb-row" style={{ animationDelay: `${i * 120}ms` }}>
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
