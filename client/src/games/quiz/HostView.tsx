import { useEffect, useState } from 'react'
import type { QuizCommand, QuizHostView } from '../../../../shared/games/quiz'
import { GetReady } from '../../components/GetReady'
import { TimerBar } from '../../components/TimerBar'
import { FinalPodium, Standings } from '../../components/Podium'
import { sound } from '../../sound'

const SHAPES = ['▲', '◆', '●', '■']

const formatNumber = (n: number) => n.toLocaleString('fr-FR')

/** Trois paliers de taille selon la longueur : une question fleuve ne doit
 *  pas chasser les réponses hors de l'écran. */
export function questionSizeClass(text: string | undefined): string {
  const n = (text ?? '').length
  if (n > 120) return ' q-sm'
  if (n > 70) return ' q-md'
  return ''
}


/** Le décompte avant que la question suivante parte toute seule. */
function AutoNextPill({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [])
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  return <span className="pill">⏩ suivante dans {seconds} s</span>
}

/** Manuel → 5 s → 10 s → manuel : trois réglages suffisent. */
const PALIERS_AUTO: (number | null)[] = [null, 5, 10]

interface Props {
  view: QuizHostView
  sendCommand: (command: QuizCommand) => void
  endSession: () => void
}

export function QuizHost({ view: v, sendCommand, endSession }: Props) {
  /** Choisi avant de lancer : un quiz qui compte double relance toute la salle. */
  const [multiplier, setMultiplier] = useState(1)

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

        {/* Annoncé à la salle avant de lancer : tant qu'un quiz peut tout
            renverser, personne ne décroche du classement. */}
        <div className="row multiplier-picker">
          <span className="muted">Ce quiz vaut</span>
          {[1, 2, 3].map(m => (
            <button
              key={m}
              className={'pill-btn' + (multiplier === m ? ' active' : '')}
              onClick={() => setMultiplier(m)}
            >
              {m === 1 ? 'points normaux' : `×${m} points`}
            </button>
          ))}
        </div>

        <div className="game-cards">
          {v.packs?.map(p => (
            <div key={p.id} className="game-card">
              <h3>{p.title}</h3>
              <p className="muted">
                {p.questionCount} question{p.questionCount > 1 ? 's' : ''}
              </p>
              <button className="btn btn-primary" onClick={() => sendCommand({ type: 'selectPack', packId: p.id, multiplier })}>
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
          {(v.multiplier ?? 1) > 1 && <span className="pill multi">×{v.multiplier} points</span>}
          <span className="pill">
            Question {v.qIndex + 1}/{v.qCount}
          </span>
          {revealing && v.fastest && (
            <span className="pill flash">⚡ {v.fastest.name} — {(v.fastest.ms / 1000).toFixed(2)} s</span>
          )}
          {revealing && v.autoNextAt && <AutoNextPill deadline={v.autoNextAt} />}
        </div>

        {!revealing && (
          <div className="question-timer">
            <TimerBar
              deadline={v.deadline!}
              duration={v.duration ?? 20}
              ticking
              frozenMs={v.paused ? v.remainingMs : undefined}
            />
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
            <>
              <button className="btn" onClick={() => sendCommand({ type: 'next' })}>
                Révéler la réponse
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => sendCommand({ type: v.paused ? 'resume' : 'pause' })}
              >
                {v.paused ? '▶ Reprendre' : '⏸ Pause'}
              </button>
            </>
          )}
          {revealing && (
            <>
              <button className="btn btn-ghost" onClick={() => sendCommand({ type: 'replay' })}>
                ↺ Reposer
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  if (window.confirm('Retirer les points gagnés sur cette question ?')) {
                    sendCommand({ type: 'cancel' })
                  }
                }}
              >
                ✖ Annuler les points
              </button>
            </>
          )}
          {/* Vingt clics par quiz, ce sont vingt occasions de décrocher de
              la soirée : ce bouton laisse l'application enchaîner seule. */}
          <button
            className={'btn btn-ghost' + (v.autoNextSeconds ? ' auto-on' : '')}
            title="Enchaîner les questions sans cliquer"
            onClick={() => {
              const i = PALIERS_AUTO.indexOf(v.autoNextSeconds ?? null)
              sendCommand({ type: 'autoNext', seconds: PALIERS_AUTO[(i + 1) % PALIERS_AUTO.length] })
            }}
          >
            {v.autoNextSeconds ? `⏩ Auto ${v.autoNextSeconds} s` : '⏩ Manuel'}
          </button>
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
      {v.standings && v.standings.length > 3 && <Standings rows={v.standings.slice(3)} offset={3} />}
      <div className="row">
        <button className="btn btn-primary" onClick={endSession}>Terminer le quiz</button>
      </div>
    </div>
  )
}
