import { useCallback, useEffect, useRef, useState } from 'react'
import { joinAsPlayer, reprendrePlace, sendPlayerAction, setMyTeam, socket, watchParty } from '../socket'
import {
  finRouverte,
  garderFin,
  garderSoireeClose,
  getState,
  oublierIdentite,
  quitterFin,
  saveChoix,
  saveMe,
  setState,
  showToast,
  soireeGardee,
  useAppState,
} from '../state'
import { currentSlug, spacePath } from '../routes'
import { Leaderboard } from '../components/Leaderboard'
import { TeamBoard } from '../components/TeamBoard'
import { TeamPicker } from '../components/TeamPicker'
import { Icon } from '../components/Icon'
import { Entree, type Identite } from '../components/Entree'
import { FormulaireSoiree } from '../components/Rejoindre'
import { ProfilForm } from '../components/ProfilForm'
import { AvisHorsLigne, FormulaireCode, useHorsLigne } from '../components/Reprendre'
import { api } from '../api'
import type { PublicProfile } from '../../../shared/profil'
import { QuizPlayer, type Envoi } from '../games/quiz/PlayerView'
import type { QuizAction, QuizPlayerView } from '../../../shared/games/quiz'
import { regleDesEquipes } from '../../../shared/teams'
import { espacesFines, formatNumber, place } from '../format'
import { Avatar } from '../components/Avatar'
import { Niveau } from '../components/Niveau'
import { AttenteConnexion, BandeauCoupure, ConseilVeille } from '../components/Liaison'
import { Celebration, FinDeSoiree } from '../components/FinDeSoiree'
import { CarteJoueur } from '../components/CarteJoueur'
import { Lendemain } from '../components/Lendemain'
import { useEcranAllume } from '../veille'
import { useGardeRetour } from '../retour'

/** Au-delà, on considère la reconnexion perdue plutôt que d'attendre sans fin. */
const RECONNEXION_TIMEOUT_MS = 5000

/** Stable d'un rendu à l'autre : un tableau neuf relancerait la demande à chaque rendu. */
const SANS_JOUEURS: never[] = []
/** Les phases où l'écran du téléphone est plein : l'avis du téléphone perdu attend la suivante. */
const PHASES_PLEINES = new Set<QuizPlayerView['phase']>(['getReady', 'observe', 'question'])

export function PlayerApp() {
  const s = useAppState()
  /** L'espace de la soirée : le nom dans l'adresse, celui que le QR a donné. */
  const slug = currentSlug() ?? ''
  /** Le profil connecté sur ce téléphone, s'il y en a un. */
  const [profil, setProfil] = useState<PublicProfile | null>(null)
  /**
   * La soirée nous a-t-elle répondu ? Tant que non, on ne montre aucun écran
   * d'entrée : celui qu'on montrerait dépend justement du profil, qui arrive
   * dans cette réponse-là.
   */
  const [presente, setPresente] = useState(false)
  /** Salle d'attente : le panneau « changer d'équipe » est-il ouvert ? */
  const [switching, setSwitching] = useState(false)
  /** Salle d'attente : la parenthèse « créer un profil », entre deux quiz. */
  const [montrerProfil, setMontrerProfil] = useState(false)
  /**
   * L'invité à qui l'on a dit « Plus tard » : la carte « Ce soir compte déjà »
   * ne revient pas de la soirée. Retenu par invité — un autre soir, c'est un
   * autre invité, et la question se repose.
   */
  const [plusTard, setPlusTard] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`quizz.plus-tard.${slug}`)
    } catch {
      return null
    }
  })
  /** Le serveur ne connaît pas cette adresse : rien à rejoindre ici. */
  const [spaceError, setSpaceError] = useState('')
  /** Salle d'attente : « J'ai un code » — reprendre la place d'un téléphone mort. */
  const [reprise, setReprise] = useState(false)
  /** La carte ouverte, celle du joueur dont on a touché le nom. */
  const [carte, setCarte] = useState<string | null>(null)
  /**
   * La dernière réponse envoyée, et ce qu'elle est devenue. Le serveur ne
   * montre une réponse qu'une fois reçue : sans ce suivi, un toucher hors
   * ligne ne changeait rien à l'écran, et la révélation disait « Trop tard ! »
   * à qui n'avait rien touché comme à qui avait répondu dans un tunnel.
   */
  const [envoi, setEnvoi] = useState<Envoi | null>(null)
  const numeroEnvoi = useRef(0)
  /** La dernière soirée close d'ici, gardée sur ce téléphone : l'entrée la propose. */
  const [gardee, setGardee] = useState(() => soireeGardee(slug))

  // Connexion, présentation à la soirée, puis re-join automatique (refresh,
  // coupure réseau, redémarrage serveur).
  useEffect(() => {
    socket.connect()
    const presenter = async () => {
      const watched = await watchParty(slug)
      if (!watched.ok) return setSpaceError(watched.error ?? 'Cette adresse ne mène à aucune soirée')
      setSpaceError('')
      // Le serveur reconnaît le profil au cookie posé dans la poignée de main :
      // l'entrée peut saluer avant même qu'on rejoigne.
      setProfil(watched.profile ?? null)
      setPresente(true)
      // Sans jeton, rien à reprendre : c'est l'entrée qui fait entrer —
      // pré-remplie avec le prénom et l'avatar retenus ici, écran d'équipe
      // compris. Rejoindre tout seul avec le prénom retenu faisait atterrir
      // l'habitué « sans équipe », sans jamais lui montrer cet écran.
      const token = getState().me?.token
      if (!token) return
      // Le jeton seul : la fiche du serveur fait foi. Renvoyer le prénom
      // retenu ici défaisait, à chaque réveil du téléphone, le renommage de
      // l'animateur. Sans équipe transmise, le serveur garde la sienne.
      const ack = await joinAsPlayer(slug, undefined, undefined, token)
      if (!ack.ok) {
        // Ce jeton ne désigne plus personne — exclu pendant que le téléphone
        // dormait, essai effacé : on oublie qui l'on était, pas son prénom,
        // et l'entrée le propose.
        if (ack.reason === 'unknown-token') {
          oublierIdentite(slug)
          showToast({ kind: 'info', message: ack.error })
          // Le serveur a redémarré depuis la clôture et oublié les fins : il
          // dit au moins quelle soirée vient de se clore, et l'entrée la
          // propose au lieu d'un simple « on ne te retrouve plus ».
          if (ack.derniere) {
            garderSoireeClose(slug, ack.derniere)
            setGardee(soireeGardee(slug))
          }
        }
        // La soirée s'est close pendant que le téléphone dormait : il reçoit
        // sa fin de soirée, comme s'il avait été là.
        if (ack.reason === 'soiree-close') {
          oublierIdentite(slug)
          if (ack.fin) {
            garderFin(slug, ack.fin)
            setState({ fin: ack.fin })
          }
        }
        return
      }
      saveMe(slug, { playerId: ack.playerId, token: ack.token })
      saveChoix(slug, { name: ack.name, avatar: ack.avatar })
    }
    // Une présentation restée sans réponse — une liaison morte que le
    // téléphone n'a pas encore vue — rejette au bout de son délai. Ce n'est
    // pas une panne de la page : l'envoi a déjà forcé la reconnexion, dont le
    // `connect` relancera la présentation, et le bandeau de liaison parle déjà
    // à l'invité. On ne laisse pas la promesse rejetée traîner dans la console.
    const present = () => {
      presenter().catch(() => {})
    }
    if (socket.connected) present()
    socket.on('connect', present)
    return () => {
      socket.off('connect', present)
    }
  }, [slug])

  // L'expérience créditée en fin de quiz : le serveur renvoie le profil à
  // jour, et le niveau affiché sur ce téléphone monte pendant la fête — pas
  // au prochain rafraîchissement, c'est-à-dire jamais.
  useEffect(() => {
    const maj = (p: PublicProfile) => setProfil(p)
    socket.on('player:profil', maj)
    return () => {
      socket.off('player:profil', maj)
    }
  }, [])

  const space = s.snapshot?.space
  useEffect(() => {
    if (space) document.title = space.title
  }, [space])

  /**
   * Rouvre la connexion et attend que le serveur dise qui est là.
   *
   * Après une connexion ou une inscription, la session du profil arrive dans
   * un cookie — mais la poignée de main du socket, elle, est déjà passée.
   * Sans ce détour, le serveur ne rattacherait pas le joueur à son profil, et
   * l'expérience de la soirée se perdrait au moment de la ranger.
   */
  const reconnecter = (): Promise<PublicProfile | null> =>
    new Promise(resolve => {
      const fini = (p: PublicProfile | null) => {
        clearTimeout(minuteur)
        socket.off('connect', onConnect)
        setProfil(p)
        resolve(p)
      }
      const onConnect = () => {
        watchParty(slug)
          .then(w => fini(w.profile ?? null))
          .catch(() => fini(null))
      }
      // Une reconnexion qui n'arrive jamais laisserait la promesse — donc
      // l'écran — en suspens pour toujours.
      const minuteur = setTimeout(() => fini(null), RECONNEXION_TIMEOUT_MS)
      socket.on('connect', onConnect)
      socket.disconnect()
      socket.connect()
    })

  /** Rejoint la soirée. Rend le motif du refus, ou null si c'est passé. */
  const rejoindre = async ({ name, avatar, teamId }: Identite & { teamId: string | null }) => {
    const ack = await joinAsPlayer(slug, name, avatar, undefined, teamId)
    if (!ack.ok) return ack.error
    // L'identité retenue est celle que le serveur rend : quand c'est le profil
    // qui l'a fournie, le téléphone ne la connaissait pas encore, et il en a
    // besoin pour se re-présenter à l'identique après une coupure.
    saveChoix(slug, { name: ack.name, avatar: ack.avatar })
    saveMe(slug, { playerId: ack.playerId, token: ack.token })
    return null
  }

  /**
   * Reprend sa place avec le code de l'animateur. L'identité que ce téléphone
   * portait jusque-là part avec la demande : le serveur l'efface si elle n'a
   * rien joué — c'était la même personne.
   */
  const reprendre = async (code: string) => {
    const ack = await reprendrePlace(slug, code, getState().me?.token)
    if (!ack.ok) return ack.error
    saveChoix(slug, { name: ack.name, avatar: ack.avatar })
    saveMe(slug, { playerId: ack.playerId, token: ack.token })
    setReprise(false)
    showToast({ kind: 'info', message: `Te revoilà, ${ack.name} ${ack.avatar}` })
    return null
  }

  /** « Ce n'est pas moi » : le téléphone oublie le profil qu'il portait. */
  const oublierProfil = async () => {
    await api.joueur.deconnexion().catch(() => {})
    await reconnecter()
  }

  /** Depuis la salle d'attente : un profil créé en cours de soirée. */
  const profilConnecte = (p: PublicProfile) => {
    setMontrerProfil(false)
    setProfil(p)
    // Le rattachement du joueur déjà inscrit se fait à la re-présentation.
    void reconnecter()
  }

  const changeTeam = async (id: string) => {
    const res = await setMyTeam(id)
    if (!res.ok) return showToast({ kind: 'error', message: res.error ?? 'Impossible' })
    setSwitching(false)
  }

  // ── Quiz en cours (si j'y participe) ─────────────
  const snap = s.snapshot
  const teams = snap?.teams ?? []
  const me = snap?.players.find(p => p.id === s.me?.playerId)
  const session = snap?.session ?? null
  const sessionView = session ? s.views[session.id] : undefined
  // Un quiz neuf recommence à la question 1, au tour 1 : l'envoi du quiz
  // d'avant y viserait sinon la même question, et dirait « Trop tard ! » à
  // qui n'a rien touché.
  const sessionId = session?.id
  useEffect(() => {
    setEnvoi(null)
  }, [sessionId])
  const iAmIn = !!(s.me && session?.participantIds.includes(s.me.playerId))
  const playing = !!sessionView && iAmIn

  // Pendant un quiz, l'écran ne doit pas s'éteindre : un téléphone posé sur la
  // table pendant qu'on écoute la question rate la suivante.
  useEcranAllume(playing)

  // Le geste retour sort de la soirée : dès la salle d'attente, il demande
  // d'abord. Pas à l'entrée — on n'y a encore rien à perdre.
  useGardeRetour(!!s.me && !s.fin && !spaceError)

  // Inscrit une seconde fois sur un téléphone emprunté : sa première place
  // l'attend, points compris, s'il demande le code — en salle d'attente
  // comme en plein quiz, entre deux questions.
  const absent = useHorsLigne(slug, me?.name ?? '', snap?.players ?? SANS_JOUEURS, { actif: !!me, sauf: me?.id })
  const avisAbsent = absent && (
    <AvisHorsLigne absent={absent} profilIci={!!profil} onCode={() => setReprise(true)} />
  )
  // Une partie lancée depuis la clôture : la soirée suivante a commencé, la
  // fin rouverte depuis le téléphone ne se montre plus.
  const partieLancee = !!snap && (!!snap.session || snap.players.some(p => p.score > 0))
  useEffect(() => {
    if (s.fin && finRouverte() && partieLancee) {
      quitterFin(slug)
      setGardee(soireeGardee(slug))
    }
  }, [s.fin, partieLancee, slug])

  // Chaque écran commence en haut, comme ceux de l'entrée. La fin de soirée
  // s'ouvrait au défilement de la salle d'attente, sous son propre titre ; et
  // une question qui suit un classement qu'on a fait défiler, pareil.
  const phase = playing && sessionView ? (sessionView.view as QuizPlayerView) : null
  const ecran = s.fin
    ? 'fin'
    : !s.me
      ? 'entree'
      : montrerProfil
        ? 'profil'
        : phase
          ? `jeu:${phase.qIndex}:${phase.round ?? 0}:${phase.phase}`
          : 'salle'
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [ecran])

  // Le seul canal d'erreur des invités : un lecteur d'écran doit l'annoncer,
  // tout de suite pour une erreur, sans couper la parole pour le reste.
  const toast = s.toast && (
    <div className={`toast toast-${s.toast.kind}`} role={s.toast.kind === 'error' ? 'alert' : 'status'}>
      {espacesFines(s.toast.message)}
    </div>
  )

  // Ce que le dernier podium vient de rapporter, fêté par-dessus l'écran.
  const finirCelebration = useCallback(() => setState({ gain: null }), [])
  const celebration = s.gain && <Celebration gain={s.gain} onFin={finirCelebration} />

  // L'adresse ne mène à rien : on redemande le nom de la soirée sur place.
  // Renvoyer à l'accueil enverrait maintenant sur la page du profil, qui ne
  // répond pas à la question que se pose celui qui s'est trompé d'adresse.
  if (spaceError) return <FormulaireSoiree perdu />

  // La soirée est close : sa fin, jusqu'à ce qu'on passe à la suivante. Une
  // fin rouverte depuis le téléphone attend de savoir où en est l'espace :
  // l'invité qui rescanne le QR pour une deuxième soirée le même soir
  // retombait sur l'ancienne fin.
  if (s.fin && finRouverte() && !snap) return <AttenteConnexion />
  if (s.fin) {
    return (
      <>
        <FinDeSoiree
          fin={s.fin}
          profil={profil}
          onSuivante={() => {
            quitterFin(slug)
            setGardee(soireeGardee(slug))
          }}
        />
        {toast}
      </>
    )
  }

  // Le premier instantané dit comment la soirée s'appelle, et la réponse de la
  // soirée dit si ce téléphone porte un profil : on ne montre pas un écran
  // d'entrée avant de savoir lequel des deux il faut.
  if (!snap || !presente) return <AttenteConnexion />

  // ── L'entrée ─────────────────────────────────────
  if (!s.me) {
    return (
      <>
        <Entree
          space={snap.space}
          players={snap.players}
          teams={teams}
          quizEnCours={!!snap.session}
          profil={profil}
          reconnecter={reconnecter}
          rejoindre={rejoindre}
          oublierProfil={oublierProfil}
          reprendre={reprendre}
          lendemain={gardee && <Lendemain gardee={gardee} />}
        />
        <BandeauCoupure connecte={s.connected} />
        {toast}
      </>
    )
  }

  // Le profil se crée aussi entre deux quiz, sans quitter la soirée : c'est le
  // moment où l'on regarde son téléphone.
  if (montrerProfil) {
    return (
      <>
        <ProfilForm
          prefill={{ name: me?.name ?? '', avatar: me?.avatar ?? '' }}
          onDone={profilConnecte}
          onCancel={() => setMontrerProfil(false)}
          creer
          bandeau={
            sessionView && iAmIn ? (
              <div className="card notice quiz-commence" role="status">
                <span>Le quiz commence</span>
                <button type="button" className="btn btn-primary btn-small" onClick={() => setMontrerProfil(false)}>
                  Y aller
                </button>
              </div>
            ) : null
          }
        />
        {toast}
      </>
    )
  }

  if (reprise) {
    return (
      <>
        <FormulaireCode reprendre={reprendre} onCancel={() => setReprise(false)} />
        <BandeauCoupure connecte={s.connected} />
        {toast}
      </>
    )
  }

  if (sessionView && iAmIn) {
    return (
      // Région « vivante » : un lecteur d'écran annonce la question, puis le
      // résultat, sans qu'on ait à parcourir la page à chaque changement.
      <div className="player-shell" aria-live="polite">
        {/* Pas pendant la question : sur 640 px, quatre réponses remplissent
            l'écran, et l'avis pousserait la dernière dehors. Entre deux
            questions, il y a la place — et le temps de taper un code. */}
        {phase && !PHASES_PLEINES.has(phase.phase) && absent && (
          <AvisHorsLigne absent={absent} profilIci={!!profil} onCode={() => setReprise(true)} discret />
        )}
        <QuizPlayer
          view={sessionView.view as QuizPlayerView}
          teams={teams}
          myTeamId={me?.teamId ?? null}
          // Le jeton est relu au moment de l'envoi : celui du rendu pourrait
          // dater d'avant une reconnexion.
          send={(action: QuizAction) => {
            const vue = sessionView.view as QuizPlayerView
            // Ce qu'on a répondu, en mots : si elle arrive trop tard, on le
            // dit avec elle — la question suivante est peut-être déjà là.
            const libelle =
              action.type === 'answer'
                ? (vue.answers?.[action.choice] ?? '')
                : `${formatNumber(action.value)}${vue.unit ? ` ${vue.unit}` : ''}`
            const numero = ++numeroEnvoi.current
            const suivi = (etat: Envoi['etat'], enFile?: boolean) =>
              setEnvoi(e =>
                numero === numeroEnvoi.current && e ? { ...e, etat, enFile: enFile ?? e.enFile } : e,
              )
            setEnvoi({
              qIndex: action.qIndex,
              round: action.round,
              choice: action.type === 'answer' ? action.choice : undefined,
              value: action.type === 'guess' ? action.value : undefined,
              etat: 'envoi',
              // Lu au même instant que l'envoi : c'est ce qui dit si socket.io
              // la garde pour la reconnexion.
              enFile: !socket.connected,
            })
            sendPlayerAction(sessionView.sessionId, action, slug, getState().me?.token, tardive => {
              if (tardive.ok) {
                suivi('recu')
                showToast({ kind: 'info', message: 'Ta réponse est bien arrivée' })
              } else if (tardive.reason === 'too-late') {
                suivi('trop-tard')
                showToast({
                  kind: 'error',
                  message: `Ta réponse à la question ${(action.qIndex ?? vue.qIndex) + 1} est arrivée trop tard — c'était « ${libelle} »`,
                })
              } else {
                suivi('refusee')
                showToast({ kind: 'error', message: tardive.error })
              }
            }).then(res => {
              if (res.ok) suivi('recu')
              else if (res.reason === 'too-late') suivi('trop-tard')
              // Partie dans un transport mort, elle ne partira jamais : la
              // carte redevient libre, et l'écran demande de la retoucher.
              else if (res.reason === 'timeout') suivi('enFile' in res && res.enFile ? 'pas-partie' : 'perdue', 'enFile' in res && res.enFile)
              else suivi('refusee')
              // Une réponse refusée se disait jusqu'ici en silence : le
              // téléphone vibrait sous le doigt et rien ne suivait.
              if (!res.ok) showToast({ kind: 'error', message: res.error })
            })
          }}
          envoi={envoi}
        />
        <ConseilVeille />
        <BandeauCoupure connecte={s.connected} />
        {celebration}
        {toast}
      </div>
    )
  }

  // ── Salle d'attente ──────────────────────────────
  const myTeam = teams.find(t => t.id === me?.teamId) ?? null
  const sorted = [...snap.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))
  // Rang partagé, comme dans le classement en dessous : à égalité de points,
  // on est premier ensemble, pas quatrième parce que son prénom vient après.
  // Et pas de rang tant que personne n'a marqué : « 0 pts · 1ʳᵉ place »
  // avant le premier quiz, c'était premier de rien.
  const myRank = me && sorted.some(p => p.score > 0) ? sorted.findIndex(p => p.score === me.score) + 1 : 0
  // Seul, on ne gagne rien (invariant 19) : « Ce soir compte déjà » serait faux.
  const invitationProfil = !profil && (me?.score ?? 0) > 0 && snap.players.length > 1 && plusTard !== me?.id
  const remettreAPlusTard = () => {
    const id = me?.id ?? null
    setPlusTard(id)
    try {
      if (id) localStorage.setItem(`quizz.plus-tard.${slug}`, id)
    } catch {
      // Stockage bloqué : la carte reste fermée jusqu'au rechargement.
    }
  }

  return (
    <div className="player-shell">
      <ConseilVeille />
      <header className="me-header">
        <Avatar className="player-avatar big" avatar={me?.avatar ?? ''} finition={me?.finition} eclat={me?.eclat} legendaire={me?.legendaire} />
        <div>
          <h2>
            {/* Le prénom tel qu'il s'affiche : s'il porte une marque
                d'homonymie, son porteur doit la lire sur son propre téléphone
                plutôt que la découvrir sur le mur. */}
            <span className="me-nom">{me?.nomAffiche ?? me?.name}</span>
            <Niveau niveau={me?.niveau} big />
          </h2>
          <p className="muted">
            {me?.score ?? 0} pts{myRank > 0 && ` · ${place(myRank)}`}
            {myTeam && ` · ${myTeam.emoji} ${myTeam.name}`}
          </p>
        </div>
      </header>
      {/* Sous l'en-tête, pas à côté : dans la même ligne, la pastille
          réduisait le prénom à « Mari… » au moment même où l'on se demande
          si le téléphone est encore le sien. */}
      {!s.connected && (
        <span className="pill offline-pill">
          <Icon name="alert" /> reconnexion…
        </span>
      )}

      {avisAbsent}

      {session && !iAmIn && (
        <div className="card notice">Un quiz est en cours — tu entres à la prochaine question.</div>
      )}

      {/* Après un premier quiz marqué, c'est le moment d'y penser — et le lien
          tout en bas, sous le classement, ne se voyait pas. Créé ce soir, le
          profil se rattache à l'invité : la soirée entière y compte. */}
      {invitationProfil && (
        <div className="card invitation-profil">
          <p>Ce soir compte déjà : avec un profil, ton niveau part de cette soirée.</p>
          <div className="invitation-profil-actions">
            <button type="button" className="btn btn-small" onClick={() => setMontrerProfil(true)}>
              Créer mon profil
            </button>
            {/* Sans lui, la carte restait là toute la soirée, au-dessus des
                équipes, pour qui avait déjà répondu non. */}
            <button type="button" className="btn btn-ghost btn-small" onClick={remettreAPlusTard}>
              Plus tard
            </button>
          </div>
        </div>
      )}

      {teams.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>
              <Icon name="users" />
              Les équipes
            </h3>
            {/* On ne change pas de camp en plein quiz : le serveur le refuse
                pendant un quiz, autant ne pas proposer le bouton. */}
            {!session && (
              <button className="btn btn-ghost btn-small" onClick={() => setSwitching(v => !v)}>
                {switching ? 'Annuler' : myTeam ? 'Changer' : 'Choisir mon équipe'}
              </button>
            )}
          </div>
          {/* Le choix ne s'ouvre plus de lui-même à qui est entré sans équipe
              pendant un quiz : le rejoindre après le podium retournait le
              vainqueur annoncé. L'entrée le lui a proposé ; le bouton reste. */}
          {switching ? (
            <TeamPicker teams={teams} value={me?.teamId ?? null} onPick={changeTeam} players={snap.players} />
          ) : (
            <>
              <TeamBoard teams={teams} highlightId={me?.teamId ?? null} compact />
              <p className="muted small">{regleDesEquipes(teams.length)}</p>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3>
          <Icon name="trophy" />
          Classement de la soirée
        </h3>
        <Leaderboard players={snap.players} compact highlightId={s.me.playerId} onOuvrir={setCarte} />
        <p className="muted small">Touche un nom pour voir sa carte.</p>
      </div>
      {carte && <CarteJoueur slug={slug} playerId={carte} onFermer={() => setCarte(null)} />}

      <p className="waiting">En attente du prochain quiz…</p>
      {/* Entre deux quiz, relire ses réponses : rien ne menait du téléphone au
          bilan en cours, il fallait en connaître l'adresse. Un autre onglet,
          pour ne pas manquer le quiz suivant. Une fois des points marqués
          seulement : avant, le bilan n'a rien à montrer. « Mes réponses »,
          à qui en a marqué lui-même : l'arrivé entre deux quiz n'est pas
          encore au bilan, qui lui demandait « Qui es-tu ? ». L'instantané ne
          dit pas qui a répondu sans marquer — celui-là n'a que le souvenir. */}
      {me && sorted.some(p => p.score > 0) && (
        <p className="join-foot">
          {me.score > 0 && (
            <>
              <a className="link-inline" href={`${spacePath(slug, 'bilan')}#p=${me.id}`} target="_blank" rel="noreferrer">
                Mes réponses jusqu’ici
              </a>
              {' · '}
            </>
          )}
          <a className="link-inline" href={spacePath(slug, 'souvenir')} target="_blank" rel="noreferrer">
            {me.score > 0 ? 'le souvenir' : 'Le souvenir de la soirée'}
          </a>
        </p>
      )}
      {/* Entre deux quiz, c'est le moment où l'on regarde son téléphone. */}
      <p className="join-foot">
        {profil ? (
          <a className="link-inline" href="/profil">
            Mon profil · niveau {profil.niveau}
          </a>
        ) : (
          !invitationProfil && (
            <button type="button" className="link-inline" onClick={() => setMontrerProfil(true)}>
              Gagner des niveaux : créer un profil
            </button>
          )
        )}
      </p>
      {celebration}
      {toast}
    </div>
  )
}
