import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { QuizCommand, QuizHostView, QuizPackInfo, Visee } from '../../../../shared/games/quiz'
import { ecrireDuree, pourChercher } from '../../../../shared/library'
import { GetReady } from '../../components/GetReady'
import { TimerBar } from '../../components/TimerBar'
import { FinalPodium, Standings } from '../../components/Podium'
import { TeamBoard } from '../../components/TeamBoard'
import { mentionDesPrix } from '../../../../shared/teams'
import { Icon } from '../../components/Icon'
import { Shape } from '../../components/Shape'
import { Rank, Score } from '../../components/Rank'
import { ConsoleActions } from '../../components/HostConsole'
import { confirmDialog } from '../../components/Dialog'
import { serverNow } from '../../clock'
import { useSecondesRestantes } from '../../decompte'
import { PALIERS_ENCHAINEMENT, gesteAccepte } from '../../../../shared/console'
import { espacesFines } from '../../format'
import type { PublicTeam } from '../../../../shared/types'
import { isMuted, sound } from '../../sound'
import { formatNumber, secondes } from '../../format'
import { lireNombre } from '../../../../shared/nombres'
import { answersSizeClass, questionSizeClass } from './questionSize'
import { CONSIGNE_DES_VARIANTES, consigneEstimation } from './consignes'
import { Avatar } from '../../components/Avatar'
import { Coupe } from '../../components/Coupe'
import { Niveau } from '../../components/Niveau'

/** Le décompte avant que la question suivante parte toute seule. */
function AutoNextPill({ deadline }: { deadline: number }) {
  const seconds = useSecondesRestantes(deadline)
  return (
    <span className="pill">
      <Icon name="skip" /> Question suivante dans {seconds} s
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

/** « 12 questions · Cinéma & séries, Musique · 2 estimations · ≈ 8 min » : de quoi reconnaître un quiz sans l'ouvrir. */
function faitsDuQuiz(p: QuizPackInfo): string {
  return [
    `${p.questionCount} question${p.questionCount > 1 ? 's' : ''}`,
    p.categories?.length ? p.categories.slice(0, 2).join(', ') : '',
    p.estimations ? `${p.estimations} estimation${p.estimations > 1 ? 's' : ''}` : '',
    p.dureeS ? ecrireDuree(p.dureeS) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Le choix du quiz. Avec un programme, le prochain d'abord, déjà réglé : un
 * bouton, et c'est parti — chaque manche se cherchait parmi toute la
 * bibliothèque, à l'écran commun, devant la salle, en se souvenant du ×2 de
 * la finale. « Un autre quiz… » garde l'improvisation, avec une recherche.
 */
function ChoixDuQuiz({
  v,
  sendCommand,
  endSession,
}: {
  v: QuizHostView
  sendCommand: (command: QuizCommand) => void
  endSession: () => void
}) {
  const packs = v.packs ?? []
  const programme = v.programme
  const prochain = (programme?.prochain && packs.find(p => p.id === programme.prochain)) || null
  const ensuite = (programme?.ensuite && packs.find(p => p.id === programme.ensuite)) || null
  const [autre, setAutre] = useState(false)
  const [recherche, setRecherche] = useState('')
  /** Choisi avant de lancer : un quiz qui compte double relance toute la salle. */
  const [multiplier, setMultiplier] = useState<number>(prochain?.auProgramme?.multiplier ?? 1)
  const lancer = (p: QuizPackInfo) => sendCommand({ type: 'selectPack', packId: p.id, multiplier })

  // Annoncé à la salle avant de lancer : tant qu'un quiz peut tout
  // renverser, personne ne décroche du classement.
  const points = (
    <div className="row multiplier-picker" role="group" aria-labelledby="multiplier-label">
      <span className="muted" id="multiplier-label">
        Ce quiz vaut
      </span>
      {[1, 2, 3].map(m => (
        <button
          key={m}
          className={'pill-btn' + (multiplier === m ? ' active' : '')}
          aria-pressed={multiplier === m}
          onClick={() => setMultiplier(m)}
        >
          {m === 1 ? 'points normaux' : `×${m} points`}
        </button>
      ))}
    </div>
  )
  const annuler = (
    <ConsoleActions>
      <button className="btn btn-ghost" onClick={endSession}>
        Annuler
      </button>
    </ConsoleActions>
  )

  if (programme && prochain && !autre) {
    const rang = prochain.auProgramme?.rang ?? 1
    return (
      <div className="quiz-host choix-prochain">
        <p className="prochain-surtitre">
          {programme.titre} · prochain quiz, {rang} sur {programme.total}
        </p>
        <h2 className="prochain-titre">{prochain.title}</h2>
        <p className="muted">{faitsDuQuiz(prochain)}</p>
        {points}
        <div className="row">
          <button className="btn btn-primary btn-big" onClick={() => lancer(prochain)}>
            <Icon name="play" />
            C'est parti !
          </button>
        </div>
        <div className="row prochain-pied">
          <span className="muted">
            {ensuite ? (
              <>
                Ensuite : <b>{ensuite.title}</b>
                {(ensuite.auProgramme?.multiplier ?? 1) > 1 && <span className="pill multi">×{ensuite.auProgramme!.multiplier}</span>}
              </>
            ) : (
              'C’est le dernier du programme'
            )}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setAutre(true)
              setMultiplier(1)
            }}
          >
            Un autre quiz…
          </button>
        </div>
        {annuler}
      </div>
    )
  }

  // La bibliothèque, programme en tête : cherchable dès qu'elle ne tient
  // plus d'un coup d'œil — six cartes visibles sur trente-huit, et la télé
  // qui défilait.
  const mots = pourChercher(recherche)
  const visibles = mots ? packs.filter(p => pourChercher(p.title).includes(mots)) : packs
  return (
    <div className="quiz-host">
      <div className="row choix-tete">
        <h2>
          <Icon name="sparkles" />
          Choisis un quiz
        </h2>
        {prochain && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setAutre(false)
              setMultiplier(prochain.auProgramme?.multiplier ?? 1)
            }}
          >
            Revenir au programme
          </button>
        )}
      </div>
      {programme && !prochain && (
        <p className="muted">{espacesFines(`Le programme « ${programme.titre} » est joué en entier : à toi de choisir la suite.`)}</p>
      )}
      {packs.length > 6 && (
        <label className="champ-recherche">
          <Icon name="search" />
          <input
            className="input"
            type="search"
            value={recherche}
            placeholder="Chercher un quiz…"
            aria-label="Chercher un quiz par son titre"
            onChange={e => setRecherche(e.target.value)}
          />
        </label>
      )}
      {points}
      <div className="game-cards">
        {visibles.map(p => (
          <div key={p.id} className="game-card">
            <h3>{p.title}</h3>
            <p className="muted">{faitsDuQuiz(p)}</p>
            {(p.joueCeSoir || p.auProgramme) && (
              <div className="row">
                {p.auProgramme && <span className="pill">Au programme · {p.auProgramme.rang}</span>}
                {p.joueCeSoir && (
                  <span className="pill joue-ce-soir">
                    <Icon name="check" /> Joué ce soir
                  </span>
                )}
              </div>
            )}
            <button className="btn btn-primary" onClick={() => lancer(p)}>
              C'est parti !
            </button>
          </div>
        ))}
        {visibles.length === 0 && <p className="serif-note">Aucun quiz ne porte ce titre.</p>}
      </div>
      {annuler}
    </div>
  )
}

/**
 * L'estimation en direct attend sa cible : l'animateur mesure, puis la tape.
 * Taper, c'est révéler — un « Révéler » à part laisserait une révélation sans
 * bonne réponse. Le champ prend le clavier dès qu'il paraît : il n'y a rien
 * d'autre à faire.
 */
function FormulaireDeCible({ unit, envoyer }: { unit?: string; envoyer: (valeur: number) => void }) {
  const [texte, setTexte] = useState('')
  const [illisible, setIllisible] = useState(false)
  return (
    <form
      className="cible-form"
      onSubmit={e => {
        e.preventDefault()
        const valeur = lireNombre(texte)
        setIllisible(valeur === null)
        if (valeur !== null) envoyer(valeur)
      }}
    >
      <input
        className="input cible-input"
        type="text"
        inputMode="decimal"
        autoFocus
        placeholder="Bonne réponse"
        aria-label="La bonne réponse, une fois mesurée"
        value={texte}
        onChange={e => {
          setTexte(e.target.value)
          setIllisible(false)
        }}
      />
      {unit && <span className="guess-unit">{unit}</span>}
      <button className="btn btn-accent console-principal" disabled={texte.trim() === ''}>
        <Icon name="eye" />
        Révéler
      </button>
      {illisible && (
        <p className="error" role="alert">
          Écris seulement un nombre, comme 1&nbsp;250 ou 12,5.
        </p>
      )}
    </form>
  )
}

/**
 * Le blind test : l'écran commun joue l'extrait dès que la question paraît
 * — les sons coupés, il attend qu'on le lance. Un navigateur qui n'a vu
 * aucun clic sur la page refuse de jouer seul : le bouton dit « Lancer »
 * tant que l'extrait n'a pas joué, pour que l'animateur ne croie pas la
 * salle en train d'écouter.
 */
function ExtraitSonore({ son, enPause }: { son: string; enPause: boolean }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [lance, setLance] = useState(false)
  const jouer = (depuisLeDebut: boolean) => {
    const a = audio.current
    if (!a) return
    if (depuisLeDebut) a.currentTime = 0
    a.play().then(
      () => setLance(true),
      () => setLance(false),
    )
  }
  useEffect(() => {
    if (!isMuted()) jouer(true)
    const a = audio.current
    return () => a?.pause()
  }, [son])
  // La pause fige aussi la musique : la salle ne doit pas entendre la suite
  // pendant que le chronomètre attend.
  useEffect(() => {
    const a = audio.current
    if (!a) return
    if (enPause) a.pause()
    else if (a.currentTime > 0 && !a.ended) jouer(false)
  }, [enPause])
  return (
    <div className="extrait">
      <audio ref={audio} src={son} preload="auto" />
      <button className="btn btn-ghost btn-small" onClick={() => jouer(true)}>
        <Icon name="music" />
        {lance ? 'Réécouter l’extrait' : 'Lancer l’extrait'}
      </button>
    </div>
  )
}

/**
 * « Qui dans la salle ? », révélé : combien ont voté, à la place de la bonne
 * valeur d'une estimation, et les plus désignés à côté — la même mise en page.
 */
function VotesDuSondage({ v }: { v: QuizHostView }) {
  const votes = v.votes ?? []
  const total = v.counts?.reduce((a, b) => a + b, 0) ?? 0
  return (
    <div className="guess-reveal">
      <p className="target-value">
        {total} <span className="target-unit">vote{total > 1 ? 's' : ''}</span>
      </p>
      <Coupe className="estimations">
        <div className="podium">
          {votes.map((x, i) => (
            <div key={i} className="lb-row vote-row" style={{ animationDelay: `${i * 60}ms` }}>
              <Rank n={1 + votes.filter(o => o.votes > x.votes).length} />
              <Avatar className="lb-avatar" avatar={x.avatar} />
              <span className="lb-name">{x.name}</span>
              <Score n={x.votes} texte={`${x.votes} vote${x.votes > 1 ? 's' : ''}`} />
            </div>
          ))}
          {votes.length === 0 && <p className="muted">Personne n'a voté…</p>}
        </div>
      </Coupe>
    </div>
  )
}

/** La note de l'animateur, à sa télécommande : ce qu'il voulait raconter. */
function NoteDeLAnimateur({ note }: { note: string }) {
  return (
    <p className="note-animateur">
      <Icon name="edit" />
      <span>{espacesFines(note)}</span>
    </p>
  )
}

interface Props {
  view: QuizHostView
  /** Les équipes de la soirée — annoncées entre deux questions. */
  teams: PublicTeam[]
  sendCommand: (command: QuizCommand) => void
  endSession: () => void
  /** Cet écran se tient en télécommande : les gestes, sans la scène — ni la réponse. */
  telecommande?: boolean
  /** Une télécommande est branchée ailleurs : la liste des quiz reste dans sa main. */
  coulissesAilleurs?: boolean
  /** « Choisir d'ici » : cet écran reprend la liste des quiz, pour cette fois. */
  reprendreCoulisses?: () => void
  /**
   * Ce qui suit un quiz, proposé à son podium : il n'y avait que « Terminer
   * le quiz », et la remise des prix se cherchait parmi neuf boutons.
   * `prix` est absent sans équipes : il n'y a personne à qui les remettre.
   */
  apresQuiz?: { suivant: () => void; prix?: () => void; personne?: boolean }
}

export function QuizHost({
  view: v,
  teams,
  sendCommand,
  endSession,
  telecommande,
  coulissesAilleurs,
  reprendreCoulisses,
  apresQuiz,
}: Props) {
  /**
   * Ce que l'animateur a sous les yeux au moment du clic. La commande
   * l'emporte, et le serveur l'ignore si la partie a bougé entre-temps : un
   * « Révéler » qui arrive après la révélation automatique ne doit pas passer
   * à la question suivante. Figée au rendu — donc au clic, même quand une
   * boîte de dialogue fait attendre la commande.
   */
  const visee: Visee = { phase: v.phase, qIndex: v.qIndex, round: v.round }
  const { garde, principal } = useGardeDePhase(`${v.phase}:${v.qIndex}:${v.round}`)

  // Les sons ponctuent les changements de phase — sur l'écran commun
  // seulement : la télécommande, dans la poche, n'a pas à doubler la télé.
  useEffect(() => {
    if (telecommande) return
    if (v.phase === 'observe' || v.phase === 'question') sound.go()
    else if (v.phase === 'reveal') (v.kind === 'number' ? sound.target : sound.reveal)()
    else if (v.phase === 'finished') sound.fanfare()
  }, [v.phase, v.qIndex, v.kind, telecommande])

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
        // Personne n'a répondu : le palier reste allumé, mais n'enchaîne
        // plus. Le retoucher relance — allumé et inerte, il se lisait comme
        // une panne.
        const relance = actif && palier !== null && !!v.autoNextSuspendu
        return (
          <button
            key={palier ?? 'clic'}
            className={'pill-btn' + (actif ? ' active' : '')}
            aria-pressed={actif}
            title={
              relance
                ? `Personne n'a répondu : touche pour relancer — la suite part dans ${palier} s`
                : palier === null
                  ? 'La question suivante attend ton clic'
                  : `La question suivante part seule ${palier} s après la révélation — sauf si personne n'a répondu, même présent : la suite, ou le podium après la dernière, attend alors ton clic`
            }
            onClick={() => {
              if (!actif || relance) sendCommand({ type: 'autoNext', seconds: palier })
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
    // Pendant la mesure d'une estimation en direct, on peut encore reposer
    // la question, ou l'annuler : le gâteau est déjà mangé.
    const revealing = v.phase === 'reveal' || v.phase === 'cible'
    const enMesure = v.phase === 'cible'
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
                // Pas de bouton « Annuler » dans cette boîte : sous pression,
                // l'animateur qui voulait annuler les points touchait le
                // bouton « Annuler »… qui les gardait. Le titre, lui, garde le
                // verbe du bouton et du résultat (« Points annulés ») : un
                // geste, un verbe.
                title: 'Annuler les points de cette question ?',
                message: enMesure
                  ? 'Elle se révèle sans bonne réponse, et ne rapporte rien à personne.'
                  : 'Les points gagnés sur cette question sont retirés à tout le monde.',
                confirmLabel: 'Retirer les points',
                cancelLabel: 'Garder les points',
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

  if (v.phase === 'pickPack' && coulissesAilleurs) {
    // La liste des quiz est l'affaire de l'animateur : la salle attend le
    // suivant sans lire le menu.
    return (
      <div className="quiz-host coulisses">
        <p className="serif-note center coulisses-attente">Le prochain quiz arrive…</p>
        <ConsoleActions>
          <span className="muted small console-note">La liste est à la télécommande</span>
          {reprendreCoulisses && (
            <button className="btn" onClick={reprendreCoulisses}>
              <Icon name="edit" />
              Choisir d’ici
            </button>
          )}
          <button className="btn btn-ghost" onClick={endSession}>
            Annuler
          </button>
        </ConsoleActions>
      </div>
    )
  }

  if (v.phase === 'pickPack') {
    // Le choix repart de zéro quand le prochain change : un autre programme,
    // ou le quiz d'après.
    return <ChoixDuQuiz key={v.programme?.prochain ?? ''} v={v} sendCommand={sendCommand} endSession={endSession} />
  }

  // À la télécommande, la question se lit à la télé : ici, où on en est et
  // les gestes. Jamais la réponse — le téléphone de l'animateur se voit
  // par-dessus l'épaule.
  // La mesure d'une estimation en direct : à la télécommande, le champ de la
  // cible — c'est dans sa main que la bonne réponse se tape.
  if (telecommande && v.phase === 'cible') {
    return (
      <div className="quiz-host telecommande-apercu" role="status">
        <span className="label">
          Question {v.qIndex + 1} / {v.qCount} · la mesure
        </span>
        {v.text && <p className="telecommande-question">{espacesFines(v.text)}</p>}
        {v.note && <NoteDeLAnimateur note={v.note} />}
        {consoleQuestion(<FormulaireDeCible unit={v.unit} envoyer={valeur => sendCommand({ type: 'cible', value: valeur, ...visee })} />)}
      </div>
    )
  }

  if (telecommande && (v.phase === 'observe' || v.phase === 'question' || v.phase === 'reveal')) {
    const revealing = v.phase === 'reveal'
    const last = v.qIndex + 1 >= v.qCount
    return (
      <div className="quiz-host telecommande-apercu" role="status">
        <span className="label">
          Question {v.qIndex + 1} / {v.qCount}
          {v.phase === 'observe' ? ' · la photo' : revealing ? ' · révélée' : ''}
        </span>
        {v.text && v.phase !== 'observe' && <p className="telecommande-question">{espacesFines(v.text)}</p>}
        {/* Sa note : ici seulement — la télé, c'est la salle qui la lit. */}
        {v.note && <NoteDeLAnimateur note={v.note} />}
        <div className="quiz-status">
          {v.paused && (
            <span className="pill">
              <Icon name="pause" /> En pause
            </span>
          )}
          {revealing && v.cancelled && (
            <span className="pill">
              <Icon name="x-circle" /> Points annulés
            </span>
          )}
          {revealing && v.autoNextAt && <AutoNextPill deadline={v.autoNextAt} />}
        </div>
        {consoleQuestion(
          <button
            ref={principal}
            className={'btn console-principal ' + (revealing ? 'btn-primary' : 'btn-accent')}
            onClick={garde(() => sendCommand({ type: 'next', ...visee }))}
          >
            {v.phase === 'observe' ? (
              <>
                <Icon name="skip" />
                Passer à la question
              </>
            ) : !revealing ? (
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
      </div>
    )
  }

  if (v.phase === 'getReady') {
    return <GetReady deadline={v.deadline!} sounds={!telecommande} label="Préparez vos téléphones…" />
  }

  // L'intertitre : une diapo sans réponse — « Manche 2 : le cinéma ». Elle
  // dure ce que l'animateur veut : un clic, ou l'enchaînement s'il en a réglé un.
  if (v.phase === 'intertitre') {
    return (
      <div className={'quiz-host intertitre' + (telecommande ? ' telecommande-apercu' : '')}>
        {!telecommande && <p className="intertitre-texte">{espacesFines(v.intertitre ?? '')}</p>}
        {telecommande && (
          <>
            <span className="label">
              Question {v.qIndex + 1} / {v.qCount} · l’intertitre
            </span>
            <p className="telecommande-question">{espacesFines(v.intertitre ?? '')}</p>
            {v.note && <NoteDeLAnimateur note={v.note} />}
          </>
        )}
        {v.deadline && <AutoNextPill deadline={v.deadline} />}
        {consoleQuestion(
          <button ref={principal} className="btn btn-accent console-principal" onClick={garde(() => sendCommand({ type: 'next', ...visee }))}>
            <Icon name="skip" />
            Passer à la question
          </button>,
        )}
      </div>
    )
  }

  // La photo, plein écran, sans la question : c'est le temps d'observation.
  // L'animateur peut l'abréger si tout le monde a déjà vu.
  if (v.phase === 'observe') {
    return (
      <div className="quiz-host">
        <div className="quiz-status">
          <span className="pill flash">
            <Icon name="eye" /> Regardez bien : la photo va disparaître
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

  // La mesure : la salle attend la bonne réponse, la console la tape.
  if (v.phase === 'cible') {
    return (
      <div className="quiz-host">
        <div className={'quiz-enonce' + (v.image ? ' avec-photo' : '')}>
          <div className="quiz-enonce-texte">
            {v.category && <span className="label quiz-categorie">{v.category}</span>}
            <h2 className={'quiz-question' + questionSizeClass(v.text)}>{espacesFines(v.text ?? '')}</h2>
          </div>
          {v.image && <img className="quiz-img" src={v.image} alt="Photo de la question" />}
        </div>
        <p className="big-waiting">
          <Icon name="target" /> Réponses closes — on mesure !
        </p>
        {v.participantCount !== undefined && (
          <p className="compte-reponses">
            <b>{v.answeredCount ?? 0}</b> / {v.participantCount}
            <span className="compte-reponses-mot">ont répondu</span>
          </p>
        )}
        {consoleQuestion(<FormulaireDeCible unit={v.unit} envoyer={valeur => sendCommand({ type: 'cible', value: valeur, ...visee })} />)}
      </div>
    )
  }

  if (v.phase === 'question' || v.phase === 'reveal') {
    const revealing = v.phase === 'reveal'
    const last = v.qIndex + 1 >= v.qCount
    const maxCount = Math.max(1, ...(v.counts ?? [0]))
    // « Plusieurs » : toutes les bonnes s'allument ; « ordre » : chaque carte
    // reçoit son rang, sans bouger de sa place.
    const estBonne = (i: number) => (v.variante === 'plusieurs' ? !!v.bonnes?.includes(i) : v.variante === 'ordre' ? true : i === v.correct)
    return (
      <div className="quiz-host">
        {revealing && (v.cancelled || v.fastest || v.autoNextAt || v.autoNextSuspendu) && (
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
                  <Icon name="zap" /> {v.fastest.name} — <span className="unite">{secondes(v.fastest.ms)}</span>
                </span>
              )
            )}
            {v.autoNextAt && <AutoNextPill deadline={v.autoNextAt} />}
            {/* La salle s'est vidée — une coupure, une pause gâteau : on ne
                joue pas la suite devant personne. */}
            {v.autoNextSuspendu && (
              <span className="pill">
                <Icon name="pause" /> Personne n'a répondu — la suite attend l'animateur
              </span>
            )}
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

        {/* La pause se voit du canapé : « En pause » en grand sur la scène, les
            réponses éteintes dessous. Seul le chiffre du chrono devenait ⏸,
            et la salle demandait ce qui se passait. */}
        {!revealing && v.paused && (
          <div className="pause-voile" role="status">
            <span>
              <Icon name="pause" />
              En pause
            </span>
          </div>
        )}

        {/* L'énoncé et sa photo côte à côte : empilée sous la question, la
            photo poussait les réponses sous la console en 1366 × 768, la
            définition des portables qu'on branche à la télé. La largeur d'un
            écran 16/9, elle, ne manque jamais (styles.css). */}
        <div className={'quiz-enonce' + ((revealing && v.imageRevelation) || v.image ? ' avec-photo' : '')}>
          <div className="quiz-enonce-texte">
            {v.category && <span className="label quiz-categorie">{v.category}</span>}
            <h2 className={'quiz-question' + questionSizeClass(v.text)}>{espacesFines(v.text ?? '')}</h2>
            {v.photoGone && (
              <p className="photo-gone">
                <Icon name="eye-off" /> La photo a disparu — de mémoire !
              </p>
            )}
          </div>
          {/* À la révélation, sa photo à elle quand elle en a une : le bébé, puis l'adulte. */}
          {revealing && v.imageRevelation ? (
            <img className="quiz-img" src={v.imageRevelation} alt="Photo de la révélation" />
          ) : (
            v.image && <img className="quiz-img" src={v.image} alt="Photo de la question" />
          )}
        </div>

        {/* Le blind test : l'extrait, à l'écran commun seulement. */}
        {!revealing && v.son && !telecommande && <ExtraitSonore son={v.son} enPause={!!v.paused} />}
        {!revealing && v.variante && v.variante !== 'sondage' && (
          <p className="consigne-variante">{espacesFines(CONSIGNE_DES_VARIANTES[v.variante])}</p>
        )}

        {v.kind === 'number' ? (
          revealing && v.target === undefined ? (
            // Une estimation en direct annulée avant d'être mesurée.
            <p className="big-waiting">
              <Icon name="x-circle" /> Pas de mesure : la question ne compte pas
            </p>
          ) : revealing ? (
            <div className="guess-reveal">
              <p className="target-value">
                {formatNumber(v.target!)} <span className="target-unit">{v.unit}</span>
              </p>
              <Coupe className="estimations">
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
              </Coupe>
            </div>
          ) : (
            <>
              <p className="big-waiting">
                <Icon name="keyboard" /> {espacesFines(consigneEstimation(v.unit, v.enDirect))}
              </p>
              {/* Les trois cinquièmes de l'écran étaient vides : le compte des
                  réponses meuble l'attente, et presse les retardataires. */}
              {v.participantCount !== undefined && (
                <p className="compte-reponses">
                  <b>{v.answeredCount ?? 0}</b> / {v.participantCount}
                  <span className="compte-reponses-mot">ont répondu</span>
                </p>
              )}
            </>
          )
        ) : v.variante === 'sondage' ? (
          revealing ? (
            <VotesDuSondage v={v} />
          ) : (
            <>
              {/* Les noms sont aux téléphones : soixante invités ne tiennent pas sur la télé. */}
              <p className="big-waiting">
                <Icon name="users" /> {espacesFines(CONSIGNE_DES_VARIANTES.sondage)}
              </p>
              {v.participantCount !== undefined && (
                <p className="compte-reponses">
                  <b>{v.answeredCount ?? 0}</b> / {v.participantCount}
                  <span className="compte-reponses-mot">ont voté</span>
                </p>
              )}
            </>
          )
        ) : (
          <div className={'ans-grid' + answersSizeClass(v.answers)}>
            {v.answers!.map((a, i) => (
              <div
                key={i}
                // L'ordre révélé ne juge aucune carte : chacune porte son rang.
                className={'ans-btn' + (revealing ? (v.variante === 'ordre' ? ' ordre-place' : estBonne(i) ? ' correct' : ' dim') : '')}
              >
                {revealing && v.variante === 'ordre' ? (
                  <span className="rang-ordre">{(v.ordre?.indexOf(i) ?? 0) + 1}</span>
                ) : (
                  <Shape index={i} />
                )}
                <span className="ans-text">{espacesFines(a)}</span>
                {revealing && (
                  <>
                    <span className="ans-extra">
                      {estBonne(i) && v.variante !== 'ordre' && <Icon name="check" className="ans-check" />}
                      {/* « Ordre » : combien l'ont mise à sa place. */}
                      <span className="ans-count" title={v.variante === 'ordre' ? 'à sa place' : undefined}>
                        {v.counts?.[i] ?? 0}
                      </span>
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

        {/* « Le saviez-vous ? » : l'histoire qu'on avait envie de raconter,
            une fois la réponse connue — jamais avant (invariant 1). */}
        {revealing && v.anecdote && (
          <p className="anecdote">
            <Icon name="message" />
            <span>
              <b>Le saviez-vous ?</b> {espacesFines(v.anecdote)}
            </span>
          </p>
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
              <div className="tableau">
                <h3>
                  <Icon name="users" />
                  Les équipes
                </h3>
                <Coupe>
                  <TeamBoard teams={teams} />
                </Coupe>
              </div>
            )}
            {v.standings && v.standings.length > 0 && (
              <div className="tableau">
                <h3>
                  <Icon name="trophy" />
                  En tête du quiz
                </h3>
                <Coupe>
                  <Standings rows={v.standings} />
                </Coupe>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // finished
  // Ce qui suit, en bouton principal : la remise des prix s'il y a des
  // équipes, sinon le quiz suivant. « Terminer le quiz » ramène à la salle
  // d'attente, comme avant.
  const suiteDuQuiz = (
    <ConsoleActions>
      {apresQuiz?.prix ? (
        <>
          <button ref={principal} className="btn btn-primary" onClick={garde(apresQuiz.prix)}>
            <Icon name="award" />
            Remise des prix
          </button>
          <button className="btn" disabled={apresQuiz.personne} onClick={garde(apresQuiz.suivant)}>
            <Icon name="play" />
            Quiz suivant
          </button>
        </>
      ) : (
        apresQuiz && (
          <button
            ref={principal}
            className="btn btn-primary"
            disabled={apresQuiz.personne}
            onClick={garde(apresQuiz.suivant)}
          >
            <Icon name="play" />
            Quiz suivant
          </button>
        )
      )}
      <button ref={apresQuiz ? undefined : principal} className={apresQuiz ? 'btn btn-ghost' : 'btn btn-primary'} onClick={garde(endSession)}>
        Terminer le quiz
      </button>
    </ConsoleActions>
  )
  if (telecommande) {
    return (
      <div className="quiz-host telecommande-apercu" role="status">
        <span className="label">À l’écran</span>
        <strong className="telecommande-scene">Podium du quiz</strong>
        {suiteDuQuiz}
      </div>
    )
  }

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
              <div className="tableau">
                <h3>
                  <Icon name="users" />
                  Les équipes après ce quiz
                </h3>
                <Coupe>
                  <TeamBoard teams={teams} />
                </Coupe>
                {/* Un prix peut encore renverser l'ordre, c'est voulu : dit
                    ici, le renversement devient un suspense, pas un démenti
                    de ce que l'animateur vient d'annoncer. */}
                <p className="muted small">{mentionDesPrix(teams)}</p>
              </div>
            )}
            {/* Les équipes d'abord : c'est leur classement qui décide de la
                soirée, et la suite du classement peut être longue. */}
            {v.standings && v.standings.length > 3 && (
              <div className="tableau">
                <h3>
                  <Icon name="trophy" />
                  La suite du classement
                </h3>
                <Coupe>
                  <Standings rows={v.standings.slice(3)} offset={3} />
                </Coupe>
              </div>
            )}
          </div>
        )}
      </div>
      {suiteDuQuiz}
    </div>
  )
}
