import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
import { PALIERS_ENCHAINEMENT, gesteAccepte } from '../../../../shared/console'
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

/**
 * Les gestes de phase n'agissent qu'une demi-seconde après le dernier
 * changement de phase, et le focus revient à l'action principale à chaque
 * changement (voir `GARDE_APRES_PHASE_MS`).
 *
 * Le focus d'abord : il restait sur la position cliquée — sur « Reposer »
 * après une révélation, qui avait pris la place de « Pause ». Une
 * télécommande de présentation, qui n'envoie qu'Entrée, aurait reposé la
 * question au lieu d'avancer. Il ne revient à l'action principale que s'il
 * était dans la console ou nulle part : une boîte de dialogue ouverte le
 * garde.
 */
function useGardeDePhase(cle: string) {
  const changement = useRef<number | null>(null)
  const principal = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    changement.current = performance.now()
    const bouton = principal.current
    if (!bouton) return
    const actif = document.activeElement
    const bande = bouton.parentElement?.closest('.console-actions')
    if (!actif || actif === document.body || bande?.contains(actif)) bouton.focus({ preventScroll: true })
  }, [cle])
  /** Le geste, s'il ne suit pas de trop près un changement de phase. */
  const garde =
    (geste: () => void): (() => void) =>
    () => {
      if (gesteAccepte(changement.current, performance.now())) geste()
    }
  return { garde, principal }
}

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
  const { garde, principal } = useGardeDePhase(`${v.phase}:${v.qIndex}:${v.round}`)

  // Les sons ponctuent les changements de phase — sur l'écran commun seulement.
  useEffect(() => {
    if (v.phase === 'observe' || v.phase === 'question') sound.go()
    else if (v.phase === 'reveal') (v.kind === 'number' ? sound.target : sound.reveal)()
    else if (v.phase === 'finished') sound.fanfare()
  }, [v.phase, v.qIndex, v.kind])

  /* L'enchaînement sans cliquer : vingt clics par quiz, ce sont vingt
     occasions de décrocher de la soirée. Tous les paliers sont à l'écran et
     disent ce qui se passera : le bouton unique affichait l'état (« Manuel »)
     et se lisait comme une action, et il fallait le faire tourner pour
     revenir au clic — le temps que la question suivante parte. Ces boutons-là
     ne passent pas par la garde : reprendre la main ne doit jamais attendre. */
  const enchainement = (
    <div className="enchainement" role="group" aria-label="Passer à la question suivante">
      <span className="enchainement-label">Suivante</span>
      {PALIERS_ENCHAINEMENT.map(palier => {
        const actif = (v.autoNextSeconds ?? null) === palier
        return (
          <button
            key={palier ?? 'clic'}
            className={'pill-btn' + (actif ? ' active' : '')}
            aria-pressed={actif}
            title={palier === null ? 'La question suivante attend ton clic' : `La question suivante part seule ${palier} s après la révélation`}
            onClick={() => {
              if (!actif) sendCommand({ type: 'autoNext', seconds: palier })
            }}
          >
            {palier === null ? 'au clic' : `${palier} s`}
          </button>
        )
      })}
    </div>
  )

  // La fin d'un quiz ne se rattrape pas : tant qu'il reste à jouer, on
  // demande avant de tout arrêter. Même à la révélation, où « Terminer »
  // passait sans un mot — et sautait aussi le podium du quiz.
  const endButton = (
    <button
      className="btn btn-ghost btn-small"
      onClick={garde(async () => {
        const ok = await confirmDialog({
          title: 'Terminer le quiz maintenant ?',
          message:
            v.phase === 'reveal'
              ? 'Les questions suivantes ne seront pas posées, et le podium du quiz ne s’affichera pas. Les points déjà gagnés restent acquis.'
              : 'La question en cours ne comptera pas, et les suivantes ne seront pas posées. Les points déjà gagnés restent acquis.',
          confirmLabel: 'Terminer le quiz',
          danger: true,
        })
        if (ok) endSession()
      })}
    >
      <Icon name="x" />
      Terminer
    </button>
  )

  /**
   * La console d'une question, de la photo à la révélation : toujours les
   * mêmes boutons, aux mêmes places, ceux qui ne servent pas grisés plutôt
   * qu'escamotés — la bande est centrée, un bouton de moins décalait tous
   * les autres sous le curseur. À gauche, l'action principale ; au milieu,
   * la pause et l'enchaînement ; à droite, à l'écart, les gestes qui
   * défont quelque chose.
   */
  const consoleQuestion = (primaire: ReactNode) => {
    const revealing = v.phase === 'reveal'
    const enQuestion = v.phase === 'question'
    return (
      <ConsoleActions>
        <div className="console-groupe">
          {primaire}
          <button
            className="btn console-pause"
            disabled={!enQuestion}
            title={enQuestion ? undefined : 'La pause fige le chronomètre d’une question'}
            onClick={garde(() => sendCommand({ type: v.paused ? 'resume' : 'pause' }))}
          >
            <Icon name={v.paused ? 'play' : 'pause'} />
            {v.paused ? 'Reprendre' : 'Pause'}
          </button>
          {enchainement}
        </div>
        <div className="console-groupe console-risque" role="group" aria-label="Corriger ou arrêter">
          <button
            className="btn btn-ghost btn-small"
            disabled={!revealing}
            title={revealing ? undefined : 'Possible une fois la réponse révélée'}
            onClick={garde(async () => {
              const ok = await confirmDialog({
                title: 'Reposer cette question ?',
                message: 'Les points gagnés sur cette question sont retirés à tout le monde, puis elle repart de zéro, chronomètre compris.',
                confirmLabel: 'Reposer la question',
                danger: true,
              })
              // La visée du clic, comme pour « Annuler les points ».
              if (ok) sendCommand({ type: 'replay', ...visee })
            })}
          >
            <Icon name="rotate" />
            Reposer
          </button>
          <button
            className="btn btn-ghost btn-small"
            // Déjà annulés : il n'y a plus rien à retirer.
            disabled={!revealing || v.cancelled}
            title={v.cancelled ? 'Les points de cette question sont déjà annulés' : revealing ? undefined : 'Possible une fois la réponse révélée'}
            onClick={garde(async () => {
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
            })}
          >
            <Icon name="x-circle" />
            Annuler les points
          </button>
          {endButton}
        </div>
      </ConsoleActions>
    )
  }

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
        {consoleQuestion(
          <button ref={principal} className="btn btn-accent console-principal" onClick={garde(() => sendCommand({ type: 'next', ...visee }))}>
            <Icon name="skip" />
            Passer à la question
          </button>,
        )}
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

        {/* L'énoncé et sa photo côte à côte : empilée sous la question, la
            photo poussait les réponses sous la console en 1366 × 768, la
            définition des portables qu'on branche à la télé. La largeur d'un
            écran 16/9, elle, ne manque jamais (styles.css). */}
        <div className={'quiz-enonce' + (v.image ? ' avec-photo' : '')}>
          <div className="quiz-enonce-texte">
            {v.category && <span className="label quiz-categorie">{v.category}</span>}
            <h2 className={'quiz-question' + questionSizeClass(v.text)}>{espacesFines(v.text ?? '')}</h2>
            {v.photoGone && (
              <p className="photo-gone">
                <Icon name="eye-off" /> La photo a disparu — de mémoire !
              </p>
            )}
          </div>
          {v.image && <img className="quiz-img" src={v.image} alt="Photo de la question" />}
        </div>

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

        {consoleQuestion(
          <button
            ref={principal}
            className={'btn console-principal ' + (revealing ? 'btn-primary' : 'btn-accent')}
            onClick={garde(() => sendCommand({ type: 'next', ...visee }))}
          >
            {!revealing ? (
              <>
                <Icon name="eye" />
                Révéler
              </>
            ) : last ? (
              <>
                <Icon name="trophy" />
                Voir le podium
              </>
            ) : (
              <>
                <Icon name="skip" />
                Question suivante
              </>
            )}
          </button>,
        )}

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
  // Le podium à gauche, les équipes et la suite du classement à droite :
  // empilés, les équipes passaient sous la console en 1366 × 768, et la
  // salle ne voyait que leur titre.
  return (
    <div className="quiz-host stage-scroll">
      <h2>
        <Icon name="trophy" />
        Podium du quiz
      </h2>
      <div className="scene-podium">
        {v.standings && <FinalPodium rows={v.standings} />}
        {(teams.length > 0 || (v.standings?.length ?? 0) > 3) && (
          <div className="scene-listes">
            {teams.length > 0 && (
              <div>
                <h3>
                  <Icon name="users" />
                  Les équipes après ce quiz
                </h3>
                <TeamBoard teams={teams} showGamePoints />
              </div>
            )}
            {/* Les équipes d'abord : c'est leur classement qui décide de la
                soirée, et la suite du classement peut être longue. */}
            {v.standings && v.standings.length > 3 && (
              <div>
                <h3>
                  <Icon name="trophy" />
                  La suite du classement
                </h3>
                <Standings rows={v.standings.slice(3)} offset={3} />
              </div>
            )}
          </div>
        )}
      </div>
      <ConsoleActions>
        <button ref={principal} className="btn btn-primary" onClick={garde(endSession)}>
          Terminer le quiz
        </button>
      </ConsoleActions>
    </div>
  )
}
