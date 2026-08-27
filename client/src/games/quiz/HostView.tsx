import { useEffect } from 'react'
import type { QuizCommand, QuizHostView } from '../../../../shared/games/quiz'
import { GetReady } from '../../components/GetReady'
import { TimerBar } from '../../components/TimerBar'
import { sound } from '../../sound'

const SHAPES = ['▲', '◆', '●', '■']
const MEDALS = ['🥇', '🥈', '🥉']

const formatNumber = (n: number) => n.toLocaleString('fr-FR')

/** Trois paliers de taille selon la longueur : une question fleuve ne doit
 *  pas chasser les réponses hors de l'écran. */
export function questionSizeClass(text: string | undefined): string {
  const n = (text ?? '').length
  if (n > 120) return ' q-sm'
  if (n > 70) return ' q-md'
  return ''
}


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

/**
 * Podium final : les trois marches montent depuis le bas, la première au
 * milieu. Hauteur proportionnelle au score, avec un plancher pour que la
 * 3e marche reste visible même si l'écart est énorme.
 */
function FinalPodium({ rows }: { rows: NonNullable<QuizHostView['standings']> }) {
  const top = rows.slice(0, 3)
  if (top.length === 0) return <p className="muted">Personne n'a joué…</p>
  const best = Math.max(...top.map(r => r.points), 1)
  const order = [top[1], top[0], top[2]] // 2e — 1er — 3e
  return (
    <div className="final-podium">
      {order.map((row, slot) =>
        row ? (
          <div key={slot} className={'podium-col rank-' + (slot === 1 ? 1 : slot === 0 ? 2 : 3)}>
            <span className="podium-avatar">{row.avatar}</span>
            <span className="podium-name">{row.name}</span>
            <div
              className="podium-step"
              style={{ height: `${30 + 70 * (row.points / best)}%` }}
            >
              <span className="podium-medal">{MEDALS[slot === 1 ? 0 : slot === 0 ? 1 : 2]}</span>
              <span className="podium-points">{row.points}</span>
            </div>
          </div>
        ) : (
          <div key={slot} className="podium-col" />
        ),
      )}
    </div>
  )
}

interface Props {
  view: QuizHostView
  sendCommand: (command: QuizCommand) => void
  endSession: () => void
}

export function QuizHost({ view: v, sendCommand, endSession }: Props) {
  // Les sons ponctuent les changements de phase — sur l'écran commun seulement.
  useEffect(() => {
    if (v.phase === 'question') sound.go()
    else if (v.phase === 'reveal') (v.kind === 'number' ? sound.target : sound.reveal)()
    else if (v.phase === 'finished') sound.fanfare()
  }, [v.phase, v.qIndex, v.kind])

  if (v.phase === 'pickPack') {
    return (
      <div className="quiz-host">
        <h2>🧠 Choisissez un quiz</h2>
        <div className="game-cards">
          {v.packs?.map(p => (
            <div key={p.id} className="game-card">
              <h3>{p.title}</h3>
              <p className="muted">
                {p.questionCount} question{p.questionCount > 1 ? 's' : ''}
              </p>
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
    return <GetReady deadline={v.deadline!} sounds label="Préparez vos téléphones…" />
  }

  if (v.phase === 'question' || v.phase === 'reveal') {
    const revealing = v.phase === 'reveal'
    const last = v.qIndex + 1 >= v.qCount
    const maxCount = Math.max(1, ...(v.counts ?? [0]))
    return (
      <div className="quiz-host">
        <div className="quiz-status">
          <span className="pill">{v.packTitle}</span>
          <span className="pill">
            Question {v.qIndex + 1}/{v.qCount}
          </span>
          {revealing && v.fastest && (
            <span className="pill flash">⚡ {v.fastest.name} — {(v.fastest.ms / 1000).toFixed(2)} s</span>
          )}
        </div>

        {!revealing && (
          <div className="question-timer">
            <TimerBar deadline={v.deadline!} duration={v.duration ?? 20} ticking />
            <span className="muted answered-count">
              {v.answeredCount}/{v.participantCount} ont répondu
            </span>
          </div>
        )}

        <h2 className={'quiz-question' + questionSizeClass(v.text)}>{v.text}</h2>
        {v.image && <img className="quiz-img" src={v.image} alt="" />}

        {v.kind === 'number' ? (
          revealing ? (
            <div className="guess-reveal">
              <p className="target-value pop">
                {formatNumber(v.target!)} <span className="target-unit">{v.unit}</span>
              </p>
              <div className="podium">
                {v.guesses?.map((g, i) => (
                  <div key={i} className="lb-row" style={{ animationDelay: `${i * 60}ms` }}>
                    <span className="lb-rank">{i === 0 ? '🎯' : i + 1}</span>
                    <span className="lb-avatar">{g.avatar}</span>
                    <span className="lb-name">{g.name}</span>
                    <span className="guess-value">
                      {formatNumber(g.value)} {v.unit}
                    </span>
                    <span className="lb-score">+{g.points}</span>
                  </div>
                ))}
                {v.guesses?.length === 0 && <p className="muted">Personne n'a répondu…</p>}
              </div>
            </div>
          ) : (
            <p className="big-waiting">
              ⌨️ Tapez votre estimation sur votre téléphone{v.unit ? ` (en ${v.unit})` : ''} — le plus proche
              gagne&nbsp;!
            </p>
          )
        ) : (
          <div className="ans-grid">
            {v.answers!.map((a, i) => (
              <div
                key={i}
                className={`ans-btn ans-${i}` + (revealing ? (i === v.correct ? ' correct' : ' dim') : '')}
              >
                <span className="ans-shape">{SHAPES[i]}</span>
                <span className="ans-text">{a}</span>
                {revealing && (
                  <>
                    {i === v.correct && <span className="ans-check">✓</span>}
                    <span className="ans-count">{v.counts?.[i] ?? 0}</span>
                    <span
                      className="ans-bar"
                      style={{ width: `${((v.counts?.[i] ?? 0) / maxCount) * 100}%` }}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}

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
      {v.standings && <FinalPodium rows={v.standings} />}
      {v.standings && v.standings.length > 3 && <Standings rows={v.standings.slice(3)} />}
      <div className="row">
        <button className="btn btn-primary" onClick={endSession}>Terminer le quiz</button>
      </div>
    </div>
  )
}
