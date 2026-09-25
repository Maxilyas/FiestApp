import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { QuizAction, QuizPlayerView } from '../../../../shared/games/quiz'
import { lireNombre } from '../../../../shared/nombres'
import { GetReady } from '../../components/GetReady'
import { TimerBar } from '../../components/TimerBar'
import { TeamBoard } from '../../components/TeamBoard'
import { Icon } from '../../components/Icon'
import { Shape } from '../../components/Shape'
import { Rank, Score } from '../../components/Rank'
import type { PublicTeam } from '../../../../shared/types'
import { espacesFines, formatNumber, place, pts } from '../../format'
import { answersSizeClass, questionSizeClass } from './questionSize'
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
  /** La dernière réponse envoyée par ce téléphone, et ce qu'elle est devenue. */
  envoi?: Envoi | null
}

/**
 * Le sort de la dernière réponse envoyée, vu du téléphone : le serveur, lui,
 * ne montre une réponse qu'une fois reçue.
 */
export interface Envoi {
  qIndex?: number
  round?: number
  /** Le choix touché, pour un QCM. */
  choice?: number
  /** Le nombre envoyé, pour une estimation. */
  value?: number
  /**
   * socket.io la garde pour la reconnexion : il ne le fait que s'il se sait
   * déconnecté. Sinon, elle est partie dans un transport peut-être mort.
   */
  enFile?: boolean
  /**
   * `pas-partie` : le délai est passé, elle attend dans la file et partira
   * au retour du réseau. `perdue` : le délai est passé et elle n'était dans
   * aucune file — il faut la retoucher.
   */
  etat: 'envoi' | 'recu' | 'pas-partie' | 'perdue' | 'trop-tard' | 'refusee'
}

/** Cet envoi vise-t-il la question affichée ? */
const viseLaVue = (e: Envoi | null | undefined, v: QuizPlayerView): e is Envoi =>
  !!e && e.qIndex === v.qIndex && (e.round === undefined || e.round === v.round)

/**
 * Rien de retenu pour cette question. « Trop tard ! » ne vaut que pour une
 * réponse que le serveur a refusée parce qu'elle arrivait après la fin : à
 * qui n'a rien touché, il faisait croire à une réponse perdue.
 */
function SansReponse({ envoi }: { envoi: Envoi | null }) {
  const [icone, texte] =
    envoi?.etat === 'trop-tard'
      ? (['clock', 'Trop tard ! Ta réponse est arrivée après la fin.'] as const)
      : envoi && envoi.etat !== 'recu'
        ? (['alert', 'Ta réponse n’est pas arrivée à temps.'] as const)
        : (['clock', 'Pas de réponse à cette question.'] as const)
  return (
    <>
      <span className="result-icon">
        <Icon name={icone} />
      </span>
      <p>{texte}</p>
    </>
  )
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
function GuessForm({
  view,
  send,
  closes,
  envoi,
  perdue,
}: Props & { closes: boolean; envoi: Envoi | null; perdue: boolean }) {
  const [text, setText] = useState('')
  const [illisible, setIllisible] = useState(false)

  // Nouvelle question → on vide le champ.
  useEffect(() => {
    setText('')
    setIllisible(false)
  }, [view.qIndex])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (closes || text.trim() === '') return
    const value = lireNombre(text)
    // Ce qui ne se lit pas le dit : le formulaire se taisait, et l'invité
    // qui avait tapé « 35 000 » croyait avoir répondu.
    setIllisible(value === null)
    if (value !== null) send({ type: 'guess', value, ...visee(view) })
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
          onChange={e => {
            setText(e.target.value)
            setIllisible(false)
          }}
          disabled={closes}
          autoFocus
        />
        {view.unit && <span className="guess-unit">{view.unit}</span>}
      </div>
      {illisible && (
        <p className="error" role="alert">
          Écris seulement un nombre, comme 35&nbsp;000 ou 12,5.
        </p>
      )}
      <button className="btn btn-primary btn-big btn-block" disabled={closes || text.trim() === ''}>
        {view.yourGuess === null ? 'Valider' : 'Corriger'}
      </button>
      {envoi ? (
        <EnvoiEnCours envoi={envoi} />
      ) : perdue ? (
        <ReponsePerdue />
      ) : view.yourGuess !== null && view.yourGuess !== undefined && (
        <p className="hint">
          Ta réponse : <strong>{formatNumber(view.yourGuess)}</strong> {view.unit}
          {!closes && ' · tu peux encore la corriger'}
        </p>
      )}
    </form>
  )
}

/**
 * La réponse est partie mais le serveur ne l'a pas encore vue. Mise en file
 * par socket.io, elle partira au retour du réseau : on le dit, plutôt que
 * « pas partie », qui faisait retaper. Hors file, on n'en promet rien.
 */
function EnvoiEnCours({ envoi }: { envoi: Envoi }) {
  return (
    <p className="hint envoi-en-cours" role="status">
      {envoi.enFile ? 'Pas encore partie — elle partira dès que le réseau revient' : 'Envoi…'}
    </p>
  )
}

/**
 * Partie pendant que la liaison se croyait vivante, elle s'est perdue en
 * route. La retoucher ne coûte rien : un doublon est confirmé sans rien
 * réécrire, et une réponse qui vise une question finie est refusée.
 */
function ReponsePerdue() {
  return (
    <p className="hint envoi-perdu" role="alert">
      Ta réponse n’est pas partie — touche-la à nouveau
    </p>
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
        Total quiz : {pts(v.yourQuizTotal ?? 0)} · {place(v.yourQuizRank ?? 0)}
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

export function QuizPlayer({ view: v, send, teams, myTeamId, envoi }: QuizPlayerProps) {
  // Avant tout retour anticipé : un crochet s'appelle à chaque rendu.
  const closes = useEchue(v.phase === 'question' ? v.deadline : undefined, !!v.paused)
  // La reprise se sent dans la main : on ne regarde pas son téléphone pendant
  // une pause, et rien ne disait que la question était repartie.
  const enPause = v.phase === 'question' && !!v.paused
  const etaitEnPause = useRef(enPause)
  useEffect(() => {
    if (etaitEnPause.current && !enPause && v.phase === 'question') navigator.vibrate?.([60, 80, 60])
    etaitEnPause.current = enPause
  }, [enPause, v.phase])

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
    // Touchée, mais pas encore vue par le serveur : l'écran le dit, au lieu
    // de rester inerte sous le doigt tant que la réponse voyage.
    // Ce que le serveur montre déjà n'attend plus rien : son choix pour un
    // QCM, son nombre pour une estimation — sinon « Envoi… » cachait « Ta
    // réponse : X » jusqu'à la révélation.
    const dejaVue = (e: Envoi) =>
      v.kind === 'number' ? e.value !== undefined && v.yourGuess === e.value : v.yourChoice === e.choice
    const enAttente =
      viseLaVue(envoi, v) && (envoi.etat === 'envoi' || envoi.etat === 'pas-partie') && !dejaVue(envoi)
        ? envoi
        : null
    const perdue = viseLaVue(envoi, v) && envoi.etat === 'perdue' && !dejaVue(envoi) && !closes
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
        {/* En grand, et les réponses éteintes : un petit texte atténué ne
            disait pas pourquoi les réponses ne répondaient plus. */}
        {v.paused && (
          <p className="pause-bandeau" role="status">
            <Icon name="pause" /> En pause
            <span className="pause-bandeau-suite">Le chrono reprendra où il s'est arrêté</span>
          </p>
        )}
        {v.category && <span className="label quiz-categorie">{v.category}</span>}
        <h2 className={'quiz-question' + questionSizeClass(v.text)}>{espacesFines(v.text ?? '')}</h2>
        {v.image && <img className="quiz-img" src={v.image} alt="Photo de la question" />}
        {v.photoGone && (
          <p className="photo-gone">
            <Icon name="eye-off" /> La photo a disparu — de mémoire !
            <span className="sr-only"> Question visuelle, sur la photo d'avant.</span>
          </p>
        )}

        {v.kind === 'number' ? (
          <GuessForm view={v} send={send} closes={closes} envoi={enAttente} perdue={perdue} />
        ) : (
          <>
            <div className={'ans-grid' + answersSizeClass(v.answers)}>
              {v.answers!.map((a, i) => (
                <button
                  key={i}
                  // Les autres réponses restent actives : on peut se raviser
                  // jusqu'à la révélation. Les estomper les ferait paraître
                  // hors d'atteinte — c'est justement ce qu'il faut dire une
                  // fois l'échéance passée, et seulement alors.
                  disabled={v.paused || closes}
                  aria-pressed={v.yourChoice === i || enAttente?.choice === i}
                  onClick={() => {
                    navigator.vibrate?.(35)
                    send({ type: 'answer', choice: i, ...visee(v) })
                  }}
                  className={
                    'ans-btn' +
                    (enAttente?.choice === i ? ' pending' : v.yourChoice === i ? ' chosen' : closes ? ' dim' : '') +
                    (v.paused ? ' en-pause' : '')
                  }
                >
                  <Shape index={i} />
                  <span className="ans-text">{espacesFines(a)}</span>
                  {v.yourChoice === i && enAttente?.choice !== i && <Icon name="check" className="ans-check" />}
                </button>
              ))}
            </div>
            {enAttente ? (
              <EnvoiEnCours envoi={enAttente} />
            ) : perdue ? (
              <ReponsePerdue />
            ) : v.yourChoice !== null && !closes && (
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
      const ton = v.cancelled || !answered ? '' : 'result-ok'
      return (
        <div className="quiz-player">
          <div className={'card result-banner ' + ton}>
            {v.justArrived && !answered ? (
              <Welcome />
            ) : v.cancelled ? (
              <PointsAnnules />
            ) : answered ? (
              <>
                <span className="big">+{pts(v.yourPoints ?? 0)}</span>
                <p>
                  Tu as dit <strong>{formatNumber(v.yourGuess!)}</strong> {v.unit}
                  {gap === 0 ? ' — pile-poil !' : ` — à ${formatNumber(gap!)} ${v.unit} près`}
                </p>
              </>
            ) : (
              <SansReponse envoi={viseLaVue(envoi, v) ? envoi : null} />
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
    // Sans réponse, un bandeau neutre : ne rien toucher n'est pas une faute.
    const ton = v.cancelled || v.justArrived || v.yourChoice === null ? '' : good ? 'result-ok' : 'result-ko'
    return (
      <div className="quiz-player">
        <div className={'card result-banner ' + ton}>
          {v.justArrived ? (
            <Welcome />
          ) : v.cancelled ? (
            <PointsAnnules />
          ) : v.yourChoice === null ? (
            <SansReponse envoi={viseLaVue(envoi, v) ? envoi : null} />
          ) : good ? (
            <>
              <span className="big">+{pts(v.yourPoints ?? 0)}</span>
              <p>Bien joué !</p>
            </>
          ) : (
            <>
              <span className="result-icon">
                <Icon name="x-circle" />
              </span>
              <p>
                Raté… tu avais dit <Shape index={v.yourChoice!} inline />
                <strong>{espacesFines(v.answers![v.yourChoice!])}</strong>
              </p>
            </>
          )}
          <p className="muted">
            {attendue} : <Shape index={v.correct!} inline />
            <strong>{espacesFines(v.answers![v.correct!])}</strong>
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
          Quiz terminé ! Tu finis à la <strong>{place(v.yourQuizRank ?? 0)}</strong> avec {pts(v.yourQuizTotal ?? 0)}
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
