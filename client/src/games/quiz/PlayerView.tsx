import { useEffect, useState, type FormEvent } from 'react'
import type { QuizAction, QuizPlayerView } from '../../../../shared/games/quiz'
import { GetReady } from '../../components/GetReady'
import { TimerBar } from '../../components/TimerBar'
import { TeamBoard } from '../../components/TeamBoard'
import { Icon } from '../../components/Icon'
import { Shape } from '../../components/Shape'
import { Rank, Score } from '../../components/Rank'
import type { PublicTeam } from '../../../../shared/types'
import { formatNumber, ordinal } from '../../format'
import { questionSizeClass } from './questionSize'
import { Avatar } from '../../components/Avatar'
import { Niveau } from '../../components/Niveau'
import { serverNow } from '../../clock'

interface Props {
  view: QuizPlayerView
  send: (action: QuizAction) => void
}

interface QuizPlayerProps extends Props {
  /** Les équipes de la soirée — montrées entre deux questions. */
  teams: PublicTeam[]
  myTeamId: string | null
}

/**
 * Vrai une fois l'échéance passée, lue à l'heure du serveur — jamais à celle
 * du téléphone, qui dérive. Le chronomètre affichait zéro et les réponses
 * restaient cliquables : c'était promettre une réponse que le serveur
 * refuserait. La marge qu'il garde après l'échéance couvre le trajet d'une
 * réponse partie à temps, pas une réponse tapée après.
 */
function useEchue(deadline: number | undefined, figee: boolean): boolean {
  const [, reveiller] = useState(0)
  useEffect(() => {
    if (deadline === undefined || figee) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const guetter = () => {
      const reste = deadline - serverNow()
      if (reste < 0) reveiller(n => n + 1)
      // Un regard par seconde au plus : une reconnexion peut recaler
      // l'horloge, et l'échéance avec elle.
      else timer = setTimeout(guetter, Math.min(reste + 1, 1000))
    }
    guetter()
    return () => clearTimeout(timer)
  }, [deadline, figee])
  return deadline !== undefined && !figee && serverNow() > deadline
}

/** Chaque réponse dit à quelle question elle répond : le serveur refuse celles qui arrivent après. */
const visee = (v: QuizPlayerView) => ({ qIndex: v.qIndex, round: v.round })

/**
 * Saisie d'une estimation. Tant que tout le monde n'a pas répondu, on peut
 * corriger : sur un clavier de téléphone, un chiffre en trop est vite arrivé.
 */
function GuessForm({ view, send, closes }: Props & { closes: boolean }) {
  const [text, setText] = useState('')

  // Nouvelle question → on vide le champ.
  useEffect(() => setText(''), [view.qIndex])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = Number(text.replace(',', '.'))
    if (closes || !Number.isFinite(value) || text.trim() === '') return
    send({ type: 'guess', value, ...visee(view) })
  }

  return (
    <form className="guess-form" onSubmit={submit}>
      <div className="guess-row">
        <input
          className="input guess-input"
          type="text"
          inputMode="decimal"
          placeholder="Ton estimation"
          aria-label="Ton estimation"
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={closes}
          autoFocus
        />
        {view.unit && <span className="guess-unit">{view.unit}</span>}
      </div>
      <button className="btn btn-primary btn-big btn-block" disabled={closes || text.trim() === ''}>
        {view.yourGuess === null ? 'Valider' : 'Corriger'}
      </button>
      {view.yourGuess !== null && view.yourGuess !== undefined && (
        <p className="hint">
          Ta réponse : <strong>{formatNumber(view.yourGuess)}</strong> {view.unit}
          {!closes && ' · tu peux encore la corriger'}
        </p>
      )}
    </form>
  )
}

/**
 * Le bilan affiché entre deux questions : mon total, mon rang, et où en est
 * mon équipe. C'est le seul moment où l'on regarde son téléphone sans être
 * en train de répondre — autant y mettre ce qui donne envie de continuer.
 */
function BetweenQuestions({
  view: v,
  teams,
  myTeamId,
}: {
  view: QuizPlayerView
  teams: PublicTeam[]
  myTeamId: string | null
}) {
  return (
    <>
      <p className="center muted">
        Total quiz : {v.yourQuizTotal} pts · {ordinal(v.yourQuizRank ?? 0)}
      </p>
      {teams.length > 0 && (
        <div className="card">
          <h3>
            <Icon name="users" />
            Les équipes
          </h3>
          <TeamBoard teams={teams} highlightId={myTeamId} compact />
        </div>
      )}
    </>
  )
}

/** Arrivé en pleine partie : il n'a pas raté la question, il n'était pas là. */
function Welcome() {
  return (
    <>
      <span className="result-icon">
        <Icon name="sparkles" />
      </span>
      <p>Bienvenue ! Tu joues à partir de la prochaine question.</p>
    </>
  )
}

/**
 * L'animateur a retiré les points de la question. Le téléphone affichait
 * « + pts » — un gain vide, là où il fallait dire que la question ne compte
 * plus, pour personne.
 */
function PointsAnnules() {
  return (
    <>
      <span className="result-icon">
        <Icon name="x-circle" />
      </span>
      <p>Points annulés — cette question ne compte pas.</p>
    </>
  )
}

export function QuizPlayer({ view: v, send, teams, myTeamId }: QuizPlayerProps) {
  // Avant tout retour anticipé : un crochet s'appelle à chaque rendu.
  const closes = useEchue(v.phase === 'question' ? v.deadline : undefined, !!v.paused)

  if (v.phase === 'pickPack') {
    return (
      <div className="getready">
        <span className="getready-icon">
          <Icon name="sparkles" />
        </span>
        <p>Le quiz va commencer…</p>
      </div>
    )
  }

  if (v.phase === 'getReady') {
    return <GetReady deadline={v.deadline!} label="Prépare-toi…" />
  }

  // Observation : la photo seule. Ni l'intitulé ni les réponses ne sont encore
  // arrivés — c'est ce qui fait le jeu de mémoire.
  if (v.phase === 'observe') {
    return (
      <div className="quiz-player observe">
        <div className="quiz-topbar">
          <span className="label">
            Question {v.qIndex + 1} / {v.qCount}
          </span>
          <span className="pill flash">
            <Icon name="eye" /> Mémorise
          </span>
        </div>
        <TimerBar deadline={v.deadline!} duration={v.duration ?? 5} />
        {/* Sans la vue, cette question ne se joue pas : c'est son principe.
            Le dire d'emblée, plutôt que laisser l'invité chercher une photo
            que rien ne décrit — et lui rappeler qu'il pourra tenter sa
            chance. Le jeu du téléphone est une région annoncée : le texte
            est lu dès que la phase arrive. */}
        <p className="sr-only">
          Question visuelle : une photo passe seule quelques secondes, sans l'intitulé. La
          question arrive ensuite, avec ses réponses : tu pourras tenter ta chance.
        </p>
        {v.image && <img className="quiz-img observe-img" src={v.image} alt="Photo à mémoriser" />}
        <p className="hint">La photo va disparaître, la question arrive après…</p>
      </div>
    )
  }

  if (v.phase === 'question') {
    return (
      <div className="quiz-player">
        <div className="quiz-topbar">
          <span className="label">
            Question {v.qIndex + 1} / {v.qCount}
          </span>
          {/* En haut, et pas sous les réponses : avec quatre réponses, un
              téléphone de 640 px de haut n'affiche plus rien en dessous. Le
              multiplicateur, lui, n'a plus rien à promettre une fois closes. */}
          {closes ? (
            <span className="pill">
              <Icon name="clock" /> Réponses closes
            </span>
          ) : (
            (v.multiplier ?? 1) > 1 && <span className="pill multi">×{v.multiplier} points</span>
          )}
        </div>
        <TimerBar
          deadline={v.deadline!}
          duration={v.duration ?? 20}
          frozenMs={v.paused ? v.remainingMs : undefined}
        />
        {v.paused && (
          <p className="hint">
            <Icon name="pause" /> En pause — regarde l'écran commun
          </p>
        )}
        {v.category && <span className="label quiz-categorie">{v.category}</span>}
        <h2 className={'quiz-question' + questionSizeClass(v.text)}>{v.text}</h2>
        {v.image && <img className="quiz-img" src={v.image} alt="Photo de la question" />}
        {v.photoGone && (
          <p className="photo-gone">
            <Icon name="eye-off" /> La photo a disparu — de mémoire !
            <span className="sr-only"> Question visuelle, sur la photo d'avant.</span>
          </p>
        )}

        {v.kind === 'number' ? (
          <GuessForm view={v} send={send} closes={closes} />
        ) : (
          <>
            <div className="ans-grid">
              {v.answers!.map((a, i) => (
                <button
                  key={i}
                  // Les autres réponses restent actives : on peut se raviser
                  // jusqu'à la révélation. Les estomper les ferait paraître
                  // hors d'atteinte — c'est justement ce qu'il faut dire une
                  // fois l'échéance passée, et seulement alors.
                  disabled={v.paused || closes}
                  aria-pressed={v.yourChoice === i}
                  onClick={() => {
                    navigator.vibrate?.(35)
                    send({ type: 'answer', choice: i, ...visee(v) })
                  }}
                  className={'ans-btn' + (v.yourChoice === i ? ' chosen' : closes ? ' dim' : '')}
                >
                  <Shape index={i} />
                  <span className="ans-text">{a}</span>
                  {v.yourChoice === i && <Icon name="check" className="ans-check" />}
                </button>
              ))}
            </div>
            {v.yourChoice !== null && !closes && (
              <p className="hint">
                Réponse enregistrée · tu peux encore changer, au prix du bonus de rapidité
              </p>
            )}
          </>
        )}
      </div>
    )
  }

  if (v.phase === 'reveal') {
    // Points annulés : la réponse attendue s'est sans doute révélée fausse.
    // On la montre encore — c'est ce que la salle vient de lire —, mais sans
    // l'appeler « la bonne ».
    const attendue = v.cancelled ? 'La réponse prévue' : 'La bonne réponse'

    // Estimation : pas de bonne ou mauvaise réponse, seulement un écart.
    if (v.kind === 'number') {
      const answered = v.yourGuess !== null && v.yourGuess !== undefined
      const gap = answered ? Math.abs(v.yourGuess! - v.target!) : null
      const ton = v.cancelled || (!answered && v.justArrived) ? '' : answered ? 'result-ok' : 'result-ko'
      return (
        <div className="quiz-player">
          <div className={'card result-banner ' + ton}>
            {v.justArrived && !answered ? (
              <Welcome />
            ) : v.cancelled ? (
              <PointsAnnules />
            ) : answered ? (
              <>
                <span className="big">+{v.yourPoints ?? 0} pts</span>
                <p>
                  Tu as dit <strong>{formatNumber(v.yourGuess!)}</strong> {v.unit}
                  {gap === 0 ? ' — pile poil !' : ` — à ${formatNumber(gap!)} ${v.unit} près`}
                </p>
              </>
            ) : (
              <>
                <span className="result-icon">
                  <Icon name="clock" />
                </span>
                <p>Trop tard !</p>
              </>
            )}
            <p className="muted">
              {attendue} : <strong>{formatNumber(v.target!)}</strong> {v.unit}
            </p>
          </div>
          <BetweenQuestions view={v} teams={teams} myTeamId={myTeamId} />
        </div>
      )
    }

    const good = v.yourChoice !== null && v.yourChoice === v.correct
    const ton = v.cancelled || (!good && v.justArrived) ? '' : good ? 'result-ok' : 'result-ko'
    return (
      <div className="quiz-player">
        <div className={'card result-banner ' + ton}>
          {v.justArrived ? (
            <Welcome />
          ) : v.cancelled ? (
            <PointsAnnules />
          ) : v.yourChoice === null ? (
            <>
              <span className="result-icon">
                <Icon name="clock" />
              </span>
              <p>Trop tard !</p>
            </>
          ) : good ? (
            <>
              <span className="big">+{v.yourPoints} pts</span>
              <p>Bien joué !</p>
            </>
          ) : (
            <>
              <span className="result-icon">
                <Icon name="x-circle" />
              </span>
              <p>
                Raté… tu avais dit <Shape index={v.yourChoice!} inline />
                <strong>{v.answers![v.yourChoice!]}</strong>
              </p>
            </>
          )}
          <p className="muted">
            {attendue} : <Shape index={v.correct!} inline />
            <strong>{v.answers![v.correct!]}</strong>
          </p>
        </div>
        <BetweenQuestions view={v} teams={teams} myTeamId={myTeamId} />
      </div>
    )
  }

  // finished
  return (
    <div className="quiz-player">
      <div className="card result-banner result-ok">
        <span className="result-icon">
          <Icon name="flag" />
        </span>
        <p>
          Quiz terminé ! Tu finis <strong>{ordinal(v.yourQuizRank ?? 0)}</strong> avec {v.yourQuizTotal} pts
        </p>
      </div>
      <div className="card">
        <h3>
          <Icon name="trophy" />
          Podium
        </h3>
        <div className="podium">
          {v.podium?.map((p, i) => (
            <div key={i} className="lb-row" style={{ animationDelay: `${i * 120}ms` }}>
              {/* Rang partagé, comme celui de la phrase au-dessus : deux ex
                  æquo portent le même chiffre. */}
              <Rank n={1 + v.podium!.filter(o => o.points > p.points).length} />
              <Avatar className="lb-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
              <span className="lb-name">{p.name}</span>
              <Niveau niveau={p.niveau} />
              <Score n={p.points} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
