import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { QuizAction, QuizPlayerView } from '../../../../shared/games/quiz'
import { lireNombre } from '../../../../shared/nombres'
import { GetReady } from '../../components/GetReady'
import { TimerBar } from '../../components/TimerBar'
import { TeamBoard } from '../../components/TeamBoard'
import { Icon } from '../../components/Icon'
import { Shape } from '../../components/Shape'
import { Rank, Score } from '../../components/Rank'
import type { PublicPlayer, PublicTeam } from '../../../../shared/types'
import { espacesFines, formatNumber, place, pts } from '../../format'
import { answersSizeClass, questionSizeClass } from './questionSize'
import { Avatar } from '../../components/Avatar'
import { Niveau } from '../../components/Niveau'
import { serverNow } from '../../clock'
import { Echelle, LigneDeCourse } from './Course'
import { ligneDeSoiree, moitieHaute } from '../../../../shared/course'

interface Props {
  view: QuizPlayerView
  send: (action: QuizAction) => void
}

interface QuizPlayerProps extends Props {
  /** Les équipes de la soirée — montrées entre deux questions. */
  teams: PublicTeam[]
  myTeamId: string | null
  /** La salle, qui décore les voisins de sa place au classement. */
  players: readonly PublicPlayer[]
  /** Soi, tel que la salle le voit. */
  moi: PublicPlayer | undefined
  /** Combien jouent ce quiz, d'après l'instantané : « 5ᵉ place sur 12 ». */
  participants: number
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
  /** Les cases cochées (« plusieurs »), l'ordre choisi (« ordre »). */
  choix?: number[]
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

/** Deux suites d'index identiques, dans le même ordre. */
const memes = (a: readonly number[] | null | undefined, b: readonly number[] | null | undefined) =>
  !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i])

interface PropsDeVariante extends Props {
  closes: boolean
  /** L'envoi pas encore vu par le serveur, s'il vise cette question. */
  enAttente: Envoi | null
  perdue: boolean
}

/**
 * Ce qui s'écrit sous une variante : l'envoi en route, la réponse perdue, la
 * réponse enregistrée — ou la consigne. Toujours une ligne : apparue au
 * premier envoi, elle rétrécissait les cases sous le doigt.
 */
function PiedDeVariante({ enAttente, perdue, consigne, enregistree }: { enAttente: Envoi | null; perdue: boolean; consigne: string; enregistree: string | null }) {
  if (enAttente) return <EnvoiEnCours envoi={enAttente} />
  if (perdue) return <ReponsePerdue />
  return <p className="hint">{espacesFines(enregistree ?? consigne)}</p>
}

/**
 * « Plusieurs bonnes réponses » : on coche, puis on valide — un toucher par
 * case ne dirait pas quand on a fini. C'est l'envoi qui compte, et son heure
 * qui paie le bonus : cocher sans valider ne répond pas.
 */
function ChoixMultiples({ view: v, send, closes, enAttente, perdue }: PropsDeVariante) {
  const [coches, setCoches] = useState<number[]>(() => v.yourChoices ?? [])
  // Une nouvelle question, ou la même reposée : rien de coché.
  useEffect(() => setCoches(v.yourChoices ?? []), [v.qIndex, v.round]) // eslint-disable-line react-hooks/exhaustive-deps
  const bloque = !!v.paused || closes
  return (
    <>
      <div className={'ans-grid' + answersSizeClass(v.answers)}>
        {v.answers!.map((a, i) => {
          const coche = coches.includes(i)
          return (
            <button
              key={i}
              disabled={bloque}
              aria-pressed={coche}
              onClick={() => {
                navigator.vibrate?.(20)
                setCoches(c => (c.includes(i) ? c.filter(x => x !== i) : [...c, i].sort((x, y) => x - y)))
              }}
              className={'ans-btn' + (coche ? ' chosen' : closes ? ' dim' : '') + (v.paused ? ' en-pause' : '')}
            >
              <Shape index={i} />
              <span className="ans-text">{espacesFines(a)}</span>
              {coche && <Icon name="check" className="ans-check" />}
            </button>
          )
        })}
      </div>
      <button
        className="btn btn-primary btn-block valider-variante"
        disabled={bloque || coches.length === 0 || memes(coches, v.yourChoices)}
        onClick={() => {
          navigator.vibrate?.(35)
          send({ type: 'answers', choices: coches, ...visee(v) })
        }}
      >
        {v.yourChoices ? 'Corriger ma réponse' : 'Valider'}
      </button>
      <PiedDeVariante
        enAttente={enAttente}
        perdue={perdue}
        consigne="Plusieurs bonnes réponses : coche-les toutes, puis valide."
        enregistree={v.yourChoices && !closes ? 'Réponse enregistrée · tu peux encore la corriger, au prix du bonus de rapidité' : null}
      />
    </>
  )
}

/**
 * « Remettez dans l'ordre » : on touche les réponses dans l'ordre, et chacune
 * prend son numéro, sans bouger de sa place — une carte qui se déplace sous
 * le pouce, c'est la voisine qu'on touche. Retoucher un numéro le retire.
 */
function OrdreARetrouver({ view: v, send, closes, enAttente, perdue }: PropsDeVariante) {
  const [suite, setSuite] = useState<number[]>(() => v.yourChoices ?? [])
  useEffect(() => setSuite(v.yourChoices ?? []), [v.qIndex, v.round]) // eslint-disable-line react-hooks/exhaustive-deps
  const n = v.answers?.length ?? 0
  const bloque = !!v.paused || closes
  return (
    <>
      <div className={'ans-grid ordre-grid' + answersSizeClass(v.answers)}>
        {v.answers!.map((a, i) => {
          const rang = suite.indexOf(i)
          return (
            <button
              key={i}
              disabled={bloque}
              aria-pressed={rang >= 0}
              aria-describedby={rang >= 0 ? `rang-${i}` : undefined}
              onClick={() => {
                navigator.vibrate?.(20)
                setSuite(s => (s.includes(i) ? s.filter(x => x !== i) : [...s, i]))
              }}
              className={'ans-btn' + (rang >= 0 ? ' chosen' : closes ? ' dim' : '') + (v.paused ? ' en-pause' : '')}
            >
              {/* Hors du nom du bouton, qui ne change pas quand on le touche : le rang le décrit. */}
              <span className="rang-ordre" id={`rang-${i}`} aria-hidden="true">
                {rang >= 0 ? rang + 1 : ''}
              </span>
              <span className="ans-text">{espacesFines(a)}</span>
            </button>
          )
        })}
      </div>
      <button
        className="btn btn-primary btn-block valider-variante"
        disabled={bloque || suite.length !== n || memes(suite, v.yourChoices)}
        onClick={() => {
          navigator.vibrate?.(35)
          send({ type: 'order', order: suite, ...visee(v) })
        }}
      >
        {v.yourChoices ? 'Corriger mon ordre' : 'Valider cet ordre'}
      </button>
      <PiedDeVariante
        enAttente={enAttente}
        perdue={perdue}
        consigne={suite.length < n ? 'Touche les réponses dans le bon ordre, la première d’abord.' : 'Retouche un numéro pour le retirer.'}
        enregistree={v.yourChoices && !closes ? 'Ordre enregistré · tu peux encore le corriger, au prix du bonus de rapidité' : null}
      />
    </>
  )
}

/**
 * « Qui dans la salle ? » : les invités, un toucher pour désigner. Jusqu'à
 * soixante noms : ils se suivent en deux colonnes, et la page défile — la
 * grille des réponses, qui tient en un écran, les écrasait.
 */
function QuiDansLaSalle({ view: v, send, closes, enAttente, perdue }: PropsDeVariante) {
  return (
    <>
      <div className="sondage-grid">
        {v.answers!.map((nom, i) => (
          <button
            key={i}
            disabled={v.paused || closes}
            aria-pressed={v.yourChoice === i || enAttente?.choice === i}
            onClick={() => {
              navigator.vibrate?.(35)
              send({ type: 'answer', choice: i, ...visee(v) })
            }}
            className={
              'ans-btn sondage-btn' +
              (enAttente?.choice === i ? ' pending' : v.yourChoice === i ? ' chosen' : closes ? ' dim' : '') +
              (v.paused ? ' en-pause' : '')
            }
          >
            <span className="ans-text">{nom}</span>
            {v.yourChoice === i && enAttente?.choice !== i && <Icon name="check" className="ans-check" />}
          </button>
        ))}
      </div>
      <PiedDeVariante
        enAttente={enAttente}
        perdue={perdue}
        consigne="Touche un nom : personne ne saura qui a voté pour qui."
        enregistree={v.yourChoice !== null && !closes ? 'Vote enregistré · tu peux encore changer d’avis' : null}
      />
    </>
  )
}

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

/** Ce que la salle ajoute aux écrans du quiz : les équipes, et les invités qui décorent un classement. */
interface Salle {
  teams: PublicTeam[]
  myTeamId: string | null
  players: readonly PublicPlayer[]
  participants: number
}

/**
 * Le bilan affiché entre deux questions : sa place dans la course, puis où en
 * est son équipe. C'est le seul moment où l'on regarde son téléphone sans
 * être en train de répondre — autant y mettre ce qui donne envie de
 * continuer. Les invités le demandaient : « Total quiz : 450 pts · 3ᵉ
 * place », en petit sous l'anecdote, ne disait rien des autres.
 *
 * L'anecdote vient en dernier : la télé la montre en grand au même instant,
 * et devant les équipes, elle les poussait sous le pouce.
 */
function BetweenQuestions({ view: v, salle: { teams, myTeamId, players, participants } }: { view: QuizPlayerView; salle: Salle }) {
  return (
    <>
      {/* Qui vient d'arriver n'en a pas encore : il n'a rien joué. */}
      <LigneDeCourse view={v} players={players} sur={participants} />
      {teams.length > 0 && (
        <div className="card">
          <h3>
            <Icon name="users" />
            Les équipes
          </h3>
          <TeamBoard teams={teams} highlightId={myTeamId} compact />
        </div>
      )}
      {/* « Le saviez-vous ? » : à la révélation seulement (invariant 1). */}
      {v.anecdote && (
        <p className="card anecdote">
          <Icon name="message" />
          <span>
            <b>Le saviez-vous ?</b> {espacesFines(v.anecdote)}
          </span>
        </p>
      )}
    </>
  )
}

/**
 * « Plusieurs » et « ordre », révélées : tout juste ou raté — la question se
 * juge en entier —, puis les bonnes réponses, ou le bon ordre.
 */
function VarianteRevelee({
  view: v,
  salle,
  envoi,
  attendue,
}: {
  view: QuizPlayerView
  salle: Salle
  envoi: Envoi | null
  attendue: string
}) {
  const repondu = !!v.yourChoices?.length
  const ton = v.cancelled || v.justArrived || !repondu ? '' : v.yourCorrect ? 'result-ok' : 'result-ko'
  const enOrdre = v.variante === 'ordre'
  const mots = (index: readonly number[]) => index.map(i => v.answers?.[i] ?? '')
  return (
    <div className="quiz-player">
      <div className={'card result-banner ' + ton}>
        {v.justArrived ? (
          <Welcome />
        ) : v.cancelled ? (
          <PointsAnnules />
        ) : !repondu ? (
          <SansReponse envoi={envoi} />
        ) : v.yourCorrect ? (
          <>
            <span className="big">+{pts(v.yourPoints ?? 0)}</span>
            <p>{enOrdre ? 'Le bon ordre, bien joué !' : 'Toutes trouvées, bien joué !'}</p>
          </>
        ) : (
          <>
            <span className="result-icon">
              <Icon name="x-circle" />
            </span>
            <p>
              {enOrdre ? 'Raté… tu avais mis ' : 'Raté… tu avais coché '}
              <strong>{espacesFines(mots(v.yourChoices!).join(enOrdre ? ' → ' : ', '))}</strong>
            </p>
          </>
        )}
        {enOrdre ? (
          <div className="muted">
            <p>{attendue === 'La bonne réponse' ? 'Le bon ordre' : 'L’ordre prévu'} :</p>
            <ol className="ordre-revele">
              {mots(v.ordre ?? []).map((m, i) => (
                <li key={i}>{espacesFines(m)}</li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="muted">
            {attendue === 'La bonne réponse' ? 'Les bonnes réponses' : 'Les réponses prévues'} :{' '}
            {(v.bonnes ?? []).map((i, n) => (
              <span key={i}>
                {n > 0 && ', '}
                <Shape index={i} inline />
                <strong>{espacesFines(v.answers?.[i] ?? '')}</strong>
              </span>
            ))}
          </p>
        )}
      </div>
      <BetweenQuestions view={v} salle={salle} />
    </div>
  )
}

/**
 * « Qui dans la salle ? », révélé : qui la salle a désigné — ex æquo
 * compris —, et pour qui on avait voté. Personne n'a gagné ni perdu.
 */
function SondageRevele({ view: v, salle }: { view: QuizPlayerView; salle: Salle }) {
  const votes = v.votes ?? []
  const tete = votes.filter(x => x.votes === votes[0]?.votes)
  const choisi = v.yourChoice !== null && v.yourChoice !== undefined ? v.answers?.[v.yourChoice] : null
  return (
    <div className="quiz-player">
      <div className="card result-banner">
        <span className="result-icon">
          <Icon name="users" />
        </span>
        {tete.length > 0 ? (
          <p>
            La salle a désigné <strong>{tete.map(x => x.name).join(' et ')}</strong> —{' '}
            {tete[0].votes} vote{tete[0].votes > 1 ? 's' : ''}
            {tete.length > 1 ? ' chacun' : ''}
          </p>
        ) : (
          <p>Personne n’a voté.</p>
        )}
        {choisi && <p className="muted">Tu avais désigné <strong>{choisi}</strong></p>}
      </div>
      <BetweenQuestions view={v} salle={salle} />
    </div>
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

export function QuizPlayer({ view: v, send, teams, myTeamId, players, moi, participants, envoi }: QuizPlayerProps) {
  const salle: Salle = { teams, myTeamId, players, participants }
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

  // L'intertitre : la diapo que la salle lit sur la télé, reprise ici.
  if (v.phase === 'intertitre') {
    return (
      <div className="quiz-player intertitre">
        <span className="label">
          Question {v.qIndex + 1} / {v.qCount}
        </span>
        <p className="intertitre-texte">{espacesFines(v.intertitre ?? '')}</p>
        <p className="hint">La question arrive…</p>
      </div>
    )
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
      v.kind === 'number'
        ? e.value !== undefined && v.yourGuess === e.value
        : e.choix
          ? memes(v.yourChoices, e.choix)
          : v.yourChoice === e.choice
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
        ) : v.variante === 'plusieurs' ? (
          <ChoixMultiples view={v} send={send} closes={closes} enAttente={enAttente} perdue={perdue} />
        ) : v.variante === 'ordre' ? (
          <OrdreARetrouver view={v} send={send} closes={closes} enAttente={enAttente} perdue={perdue} />
        ) : v.variante === 'sondage' ? (
          <QuiDansLaSalle view={v} send={send} closes={closes} enAttente={enAttente} perdue={perdue} />
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

  // Une estimation en direct : les réponses sont closes, et l'animateur
  // mesure — le gâteau passe sur la balance.
  if (v.phase === 'cible') {
    const answered = v.yourGuess !== null && v.yourGuess !== undefined
    return (
      <div className="quiz-player">
        <div className="quiz-topbar">
          <span className="label">
            Question {v.qIndex + 1} / {v.qCount}
          </span>
          <span className="pill">
            <Icon name="clock" /> Réponses closes
          </span>
        </div>
        <h2 className={'quiz-question' + questionSizeClass(v.text)}>{espacesFines(v.text ?? '')}</h2>
        <div className="card result-banner">
          <span className="result-icon">
            <Icon name="target" />
          </span>
          <p>On mesure la bonne réponse…</p>
          <p className="muted">
            {answered ? (
              <>
                Ta réponse : <strong>{formatNumber(v.yourGuess!)}</strong> {v.unit}
              </>
            ) : (
              'Pas de réponse à cette question.'
            )}
          </p>
        </div>
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
      // Une estimation en direct annulée avant d'être mesurée n'a pas de cible.
      const cible = v.target ?? null
      const gap = answered && cible !== null ? Math.abs(v.yourGuess! - cible) : null
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
                  {gap === null ? '' : gap === 0 ? ' — pile-poil !' : ` — à ${formatNumber(gap)} ${v.unit} près`}
                </p>
              </>
            ) : (
              <SansReponse envoi={viseLaVue(envoi, v) ? envoi : null} />
            )}
            {cible !== null ? (
              <p className="muted">
                {attendue} : <strong>{formatNumber(cible)}</strong> {v.unit}
              </p>
            ) : (
              <p className="muted">La bonne réponse n’a pas été mesurée.</p>
            )}
          </div>
          <BetweenQuestions view={v} salle={salle} />
        </div>
      )
    }

    if (v.variante === 'sondage') return <SondageRevele view={v} salle={salle} />
    if (v.variante === 'plusieurs' || v.variante === 'ordre') {
      return <VarianteRevelee view={v} salle={salle} envoi={viseLaVue(envoi, v) ? envoi : null} attendue={attendue} />
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
        <BetweenQuestions view={v} salle={salle} />
      </div>
    )
  }

  // finished
  const total = v.yourQuizTotal ?? 0
  // La soirée, dès qu'elle ne se confond plus avec ce quiz : lue dans
  // l'instantané, qui porte les points de toute la soirée.
  const soiree = v.soireeEntamee && moi ? ligneDeSoiree(moi.score, players.map(p => p.score)) : null
  return (
    <div className="quiz-player">
      <div className="card result-banner result-ok">
        <span className="result-icon">
          <Icon name="flag" />
        </span>
        {/* Pas de rang à zéro point : « 1ʳᵉ place avec 0 pt », quand toute la
            salle avait séché, c'était premier de rien. */}
        {total > 0 ? (
          <p>
            Quiz terminé ! Tu finis à la <strong>{place(v.yourQuizRank ?? 0)}</strong>
            {participants > 0 && moitieHaute(v.yourQuizRank ?? 0, participants) ? ` sur ${participants}` : ''} avec {pts(total)}
          </p>
        ) : (
          <p>Quiz terminé ! Pas de points cette fois.</p>
        )}
        {soiree && <p className="muted">{soiree}</p>}
      </div>
      <div className="card">
        <h3>
          <Icon name="trophy" />
          Podium
        </h3>
        <div className="podium">
          {v.podium?.map((p, i) => (
            // Sa propre ligne surlignée, comme au classement de la salle
            // d'attente : sur le podium, elle ne se distinguait pas.
            <div key={i} className={'lb-row' + (i === v.yourPodiumIndex ? ' me' : '')} style={{ animationDelay: `${i * 120}ms` }}>
              {/* Rang partagé, comme celui de la phrase au-dessus : deux ex
                  æquo portent le même chiffre. */}
              <Rank n={1 + v.podium!.filter(o => o.points > p.points).length} />
              {/* Le podium est le sujet : ses médaillons bougent (`av-sujet`). */}
              <Avatar className="lb-avatar av-sujet" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
              <span className="lb-name">{p.name}</span>
              <Niveau niveau={p.niveau} />
              <Score n={p.points} />
            </div>
          ))}
        </div>
      </div>
      {/* Hors du podium, on veut savoir qui l'on a talonné jusqu'au bout. */}
      <Echelle view={v} players={players} moi={moi} />
    </div>
  )
}
