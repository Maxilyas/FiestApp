import { useEffect, useState } from 'react'
import type { QuizCommand, QuizHostView, Visee } from '../../../../shared/games/quiz'
import { GetReady } from '../../components/GetReady'
import { TimerBar } from '../../components/TimerBar'
import { FinalPodium, Standings } from '../../components/Podium'
import { TeamBoard } from '../../components/TeamBoard'
import { Icon } from '../../components/Icon'
import { Shape } from '../../components/Shape'
import { Rank, Score } from '../../components/Rank'
import { ConsoleActions } from '../../components/HostConsole'
import { confirmDialog } from '../../components/Dialog'
import { serverNow } from '../../clock'
import { espacesFines } from '../../format'
import type { PublicTeam } from '../../../../shared/types'
import { sound } from '../../sound'
import { formatNumber } from '../../format'
import { questionSizeClass } from './questionSize'
import { Avatar } from '../../components/Avatar'
import { Niveau } from '../../components/Niveau'

/** Le décompte avant que la question suivante parte toute seule. */
function AutoNextPill({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => serverNow())
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 200)
    return () => clearInterval(id)
  }, [])
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  return (
    <span className="pill">
      <Icon name="skip" /> suivante dans {seconds} s
    </span>
  )
}

/** Manuel → 5 s → 10 s → manuel : trois réglages suffisent. */
const PALIERS_AUTO: (number | null)[] = [null, 5, 10]

interface Props {
  view: QuizHostView
  /** Les équipes de la soirée — annoncées entre deux questions. */
  teams: PublicTeam[]
  sendCommand: (command: QuizCommand) => void
  endSession: () => void
}

export function QuizHost({ view: v, teams, sendCommand, endSession }: Props) {
  /** Choisi avant de lancer : un quiz qui compte double relance toute la salle. */
  const [multiplier, setMultiplier] = useState(1)

  /**
   * Ce que l'animateur a sous les yeux au moment du clic. La commande
   * l'emporte, et le serveur l'ignore si la partie a bougé entre-temps : un
   * « Révéler » qui arrive après la révélation automatique ne doit pas passer
   * à la question suivante. Figée au rendu — donc au clic, même quand une
   * boîte de dialogue fait attendre la commande.
   */
  const visee: Visee = { phase: v.phase, qIndex: v.qIndex, round: v.round }

  // Les sons ponctuent les changements de phase — sur l'écran commun seulement.
  useEffect(() => {
    if (v.phase === 'observe' || v.phase === 'question') sound.go()
    else if (v.phase === 'reveal') (v.kind === 'number' ? sound.target : sound.reveal)()
    else if (v.phase === 'finished') sound.fanfare()
  }, [v.phase, v.qIndex, v.kind])

  /* Le bouton qui enchaîne les questions sans cliquer : vingt clics par quiz,
     ce sont vingt occasions de décrocher de la soirée. */
  const autoButton = (
    <button
      className={'btn' + (v.autoNextSeconds ? ' auto-on' : ' btn-ghost')}
      title="Enchaîner les questions sans cliquer"
      onClick={() => {
        const i = PALIERS_AUTO.indexOf(v.autoNextSeconds ?? null)
        sendCommand({ type: 'autoNext', seconds: PALIERS_AUTO[(i + 1) % PALIERS_AUTO.length] })
      }}
    >
      <Icon name="skip" />
      {v.autoNextSeconds ? `Auto ${v.autoNextSeconds} s` : 'Manuel'}
    </button>
  )

  // La fin d'un quiz ne se rattrape pas, et ce bouton est collé à « Manuel » :
  // en pleine question, on demande avant de tout arrêter.
  const endButton = (
    <button
      className="btn btn-ghost"
      onClick={async () => {
        if (v.phase === 'observe' || v.phase === 'question') {
          const ok = await confirmDialog({
            title: 'Terminer le quiz maintenant ?',
            message:
              'La question en cours ne comptera pas, et les suivantes ne seront pas posées. Les points déjà gagnés restent acquis.',
            confirmLabel: 'Terminer le quiz',
            danger: true,
          })
          if (!ok) return
        }
        endSession()
      }}
    >
      <Icon name="x" />
      Terminer
    </button>
  )

  if (v.phase === 'pickPack') {
    return (
      <div className="quiz-host">
        <h2>
          <Icon name="sparkles" />
          Choisis un quiz
        </h2>

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
        <ConsoleActions>
          <button className="btn btn-ghost" onClick={endSession}>
            Annuler
          </button>
        </ConsoleActions>
      </div>
    )
  }

  if (v.phase === 'getReady') {
    return <GetReady deadline={v.deadline!} sounds label="Préparez vos téléphones…" />
  }

  // La photo, plein écran, sans la question : c'est le temps d'observation.
  // L'animateur peut l'abréger si tout le monde a déjà vu.
  if (v.phase === 'observe') {
    return (
      <div className="quiz-host">
        <div className="quiz-status">
          <span className="pill flash">
            <Icon name="eye" /> Regardez bien…
          </span>
        </div>
        <TimerBar deadline={v.deadline!} duration={v.duration ?? 5} ticking />
        {v.image && <img className="quiz-img observe-img" src={v.image} alt="" />}
        <ConsoleActions>
          <button className="btn btn-accent" onClick={() => sendCommand({ type: 'next', ...visee })}>
            <Icon name="skip" />
            Passer à la question
          </button>
          {endButton}
        </ConsoleActions>
      </div>
    )
  }

  if (v.phase === 'question' || v.phase === 'reveal') {
    const revealing = v.phase === 'reveal'
    const last = v.qIndex + 1 >= v.qCount
    const maxCount = Math.max(1, ...(v.counts ?? [0]))
    return (
      <div className="quiz-host">
        {revealing && (v.cancelled || v.fastest || v.autoNextAt) && (
          <div className="quiz-status">
            {/* Points annulés : la salle doit le lire, et le plus rapide
                d'une question qui ne compte plus n'a rien gagné. */}
            {v.cancelled ? (
              <span className="pill">
                <Icon name="x-circle" /> Points annulés
              </span>
            ) : (
              v.fastest && (
                <span className="pill flash">
                  <Icon name="zap" /> {v.fastest.name} — {(v.fastest.ms / 1000).toFixed(2)} s
                </span>
              )
            )}
            {v.autoNextAt && <AutoNextPill deadline={v.autoNextAt} />}
          </div>
        )}

        {!revealing && (
          <TimerBar
            deadline={v.deadline!}
            duration={v.duration ?? 20}
            ticking
            frozenMs={v.paused ? v.remainingMs : undefined}
          />
        )}

        {v.category && <span className="label quiz-categorie">{v.category}</span>}
        <h2 className={'quiz-question' + questionSizeClass(v.text)}>{espacesFines(v.text ?? '')}</h2>
        {v.image && <img className="quiz-img" src={v.image} alt="Photo de la question" />}
        {v.photoGone && (
          <p className="photo-gone">
            <Icon name="eye-off" /> La photo a disparu — de mémoire !
          </p>
        )}

        {v.kind === 'number' ? (
          revealing ? (
            <div className="guess-reveal">
              <p className="target-value">
                {formatNumber(v.target!)} <span className="target-unit">{v.unit}</span>
              </p>
              <div className="podium">
                {v.guesses?.map((g, i) => (
                  <div key={i} className="lb-row" style={{ animationDelay: `${i * 60}ms` }}>
                    {/* La cible pour tous les plus proches : deux estimations à
                        égale distance ne sont ni première ni deuxième. */}
                    {g.rank === 1 ? (
                      <span className="lb-rank">
                        <Icon name="target" />
                        <span className="sr-only">Rang 1</span>
                      </span>
                    ) : (
                      <Rank n={g.rank} />
                    )}
                    <Avatar className="lb-avatar" avatar={g.avatar} finition={g.finition} eclat={g.eclat} legendaire={g.legendaire} />
                    <span className="lb-name">{g.name}</span>
                    <Niveau niveau={g.niveau} />
                    <span className="guess-value">
                      {formatNumber(g.value)} {v.unit}
                    </span>
                    <Score n={g.points} texte={`+${g.points}`} />
                  </div>
                ))}
                {v.guesses?.length === 0 && <p className="muted">Personne n'a répondu…</p>}
              </div>
            </div>
          ) : (
            <p className="big-waiting">
              <Icon name="keyboard" /> Tapez votre estimation sur votre téléphone{v.unit ? ` (en ${v.unit})` : ''} — le
              plus proche gagne&nbsp;!
            </p>
          )
        ) : (
          <div className="ans-grid">
            {v.answers!.map((a, i) => (
              <div
                key={i}
                className={'ans-btn' + (revealing ? (i === v.correct ? ' correct' : ' dim') : '')}
              >
                <Shape index={i} />
                <span className="ans-text">{espacesFines(a)}</span>
                {revealing && (
                  <>
                    <span className="ans-extra">
                      {i === v.correct && <Icon name="check" className="ans-check" />}
                      <span className="ans-count">{v.counts?.[i] ?? 0}</span>
                    </span>
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

        <ConsoleActions>
          {revealing ? (
            <>
              <button className="btn btn-primary" onClick={() => sendCommand({ type: 'next', ...visee })}>
                {last ? (
                  <>
                    <Icon name="trophy" />
                    Voir le podium
                  </>
                ) : (
                  'Question suivante'
                )}
              </button>
              <button className="btn btn-ghost" onClick={() => sendCommand({ type: 'replay', ...visee })}>
                <Icon name="rotate" />
                Reposer
              </button>
              {/* Déjà annulés : il n'y a plus rien à retirer. */}
              {!v.cancelled && (
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    const ok = await confirmDialog({
                      title: 'Annuler les points de cette question ?',
                      message: 'Les points gagnés sur cette question sont retirés à tout le monde.',
                      confirmLabel: 'Retirer les points',
                      danger: true,
                    })
                    // `visee` est celle du clic, pas celle de la confirmation :
                    // si la partie a avancé pendant que la boîte était
                    // ouverte, le serveur ne touche pas à la question suivante.
                    if (ok) sendCommand({ type: 'cancel', ...visee })
                  }}
                >
                  <Icon name="x-circle" />
                  Annuler les points
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn btn-accent" onClick={() => sendCommand({ type: 'next', ...visee })}>
                <Icon name="eye" />
                Révéler
              </button>
              <button className="btn" onClick={() => sendCommand({ type: v.paused ? 'resume' : 'pause' })}>
                <Icon name={v.paused ? 'play' : 'pause'} />
                {v.paused ? 'Reprendre' : 'Pause'}
              </button>
            </>
          )}
          {autoButton}
          {endButton}
        </ConsoleActions>

        {/* Entre deux questions, c'est le moment où l'animateur annonce qui
            mène. Les équipes passent en premier : c'est le classement qui
            décide de la soirée, le top du quiz n'en est qu'un ingrédient. */}
        {revealing && (
          <div className="reveal-boards">
            {teams.length > 0 && (
              <div>
                <h3>
                  <Icon name="users" />
                  Les équipes
                </h3>
                <TeamBoard teams={teams} />
              </div>
            )}
            {v.standings && v.standings.length > 0 && (
              <div>
                <h3>
                  <Icon name="trophy" />
                  Top du quiz
                </h3>
                <Standings rows={v.standings} />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // finished
  return (
    <div className="quiz-host stage-scroll">
      <h2>
        <Icon name="trophy" />
        Podium du quiz
      </h2>
      {v.standings && <FinalPodium rows={v.standings} />}
      {v.standings && v.standings.length > 3 && <Standings rows={v.standings.slice(3)} offset={3} />}
      {teams.length > 0 && (
        <div>
          <h3>
            <Icon name="users" />
            Les équipes après ce quiz
          </h3>
          <TeamBoard teams={teams} showFinalPoints />
        </div>
      )}
      <ConsoleActions>
        <button className="btn btn-primary" onClick={endSession}>
          Terminer le quiz
        </button>
      </ConsoleActions>
    </div>
  )
}
