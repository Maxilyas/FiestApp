import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { helloHost, socket } from '../socket'
import { setState, showToast, useAppState } from '../state'
import { choixDialog, confirmDialog, promptDialog } from '../components/Dialog'
import { api } from '../api'
import { dataUrl, spacePath } from '../routes'
import { formatDay } from '../../../shared/archive'
import { titreDeCloture } from '../../../shared/space'
import { deNom, espacesFines } from '../format'
import { initAudio, isMuted, toggleMuted } from '../sound'
import { currentTheme, toggleTheme } from '../theme'
import { Leaderboard } from '../components/Leaderboard'
import { TeamBoard } from '../components/TeamBoard'
import { FinalPodium, Standings } from '../components/Podium'
import { Trophies } from '../components/Trophies'
import { AwardsBoard } from '../components/AwardsBoard'
import { Icon } from '../components/Icon'
import { Rank, Score } from '../components/Rank'
import { LoginForm } from '../components/Invitation'
import { ConsoleActions, ConsoleSlot } from '../components/HostConsole'
import { finalRanking, rankTeams, vainqueursDuQuiz } from '../../../shared/teams'
import { classer, enumerer } from '../../../shared/classement'
import type { PublicPlayer, PublicTeam, Recap } from '../../../shared/types'
import { sound } from '../sound'
import { QuizHost } from '../games/quiz/HostView'
import type { QuizHostView } from '../../../shared/games/quiz'
import { Avatar } from '../components/Avatar'
import { Niveau } from '../components/Niveau'
import { distinctions } from '../../../shared/profil'
import type { ArchiveList } from '../../../shared/archive'
import { AnnoncesDeNiveau, ClotureEcran } from '../components/Cloture'
import { useEcranAllume } from '../veille'

/** QR wifi standard : le téléphone rejoint le réseau en le scannant. */
function wifiQrValue(wifi: { ssid: string; pass: string }): string {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')
  return wifi.pass
    ? `WIFI:T:WPA;S:${esc(wifi.ssid)};P:${esc(wifi.pass)};;`
    : `WIFI:T:nopass;S:${esc(wifi.ssid)};;`
}

/** L'encre des QR codes : le noir chaud du fond, sur blanc. */
const QR_INK = '#1a1412'

/**
 * Le plein écran n'existe pas partout : sur iPhone, il est réservé aux
 * vidéos, et `requestFullscreen` n'y est même pas défini — le bouton levait
 * une exception et ne faisait rien. On ne montre que ce qui marche.
 */
const PLEIN_ECRAN = document.fullscreenEnabled === true

/**
 * L'adresse projetée, avec une coupure permise avant le nom de l'espace : sur
 * un téléphone, elle passait à la ligne au milieu du mot (« roman / e »).
 */
function adresseCoupable(url: string) {
  const i = url.lastIndexOf('/')
  if (i <= 0) return url
  return (
    <>
      {url.slice(0, i)}
      <wbr />
      {url.slice(i)}
    </>
  )
}

/** De quoi baptiser six équipes sans réfléchir, dans l'ambiance de la soirée. */
// Tous antérieurs à Unicode 13 : les emojis récents (boule à facettes,
// visage pointillé…) s'affichent en carré vide sur Windows 10.
const TEAM_EMOJIS = ['💃', '🕺', '🎤', '✨', '🥁', '🌶️', '🦩', '🍹', '⭐', '🔥', '🌙', '🎺', '🌺', '🦜']

/**
 * Une équipe et ses membres, avec de quoi la renommer, la supprimer, et
 * déplacer quelqu'un qui s'est trompé de bouton à l'inscription.
 */
function TeamGroup({
  team,
  members,
  teams,
}: {
  team: PublicTeam | null
  members: PublicPlayer[]
  teams: PublicTeam[]
}) {
  return (
    <div className={'team-group' + (team ? '' : ' team-group-none')}>
      <div className="team-group-head">
        {team ? (
          <>
            <select
              className="team-emoji-select"
              value={team.emoji}
              title="Changer l'emoji"
              aria-label={`Emoji de l'équipe ${team.name}`}
              onChange={e => socket.emit('host:updateTeam', { teamId: team.id, emoji: e.target.value })}
            >
              {/* L'emoji courant peut venir d'une soirée précédente : on l'ajoute
                  à la liste, sinon le select afficherait autre chose que la réalité. */}
              {[...new Set([team.emoji, ...TEAM_EMOJIS])].map(e => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <button
              className="chip-name team-group-name"
              title="Renommer l'équipe"
              aria-label={`Renommer l'équipe ${team.name}`}
              onClick={async () => {
                const name = await promptDialog({
                  title: `Nouveau nom pour « ${team.name} »`,
                  input: { value: team.name, placeholder: "Nom de l'équipe", maxLength: 20 },
                  confirmLabel: 'Renommer',
                })
                if (name) socket.emit('host:updateTeam', { teamId: team.id, name })
              }}
            >
              {team.name}
            </button>
            <span className="muted small">{members.length}</span>
            <button
              className="chip-remove"
              title="Supprimer l'équipe"
              aria-label={`Supprimer l'équipe ${team.name}`}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: `Supprimer l'équipe « ${team.name} » ?`,
                  message: `Ses ${members.length} membres ne sont pas exclus : ils repassent « sans équipe » et gardent leurs points.`,
                  confirmLabel: "Supprimer l'équipe",
                  danger: true,
                })
                if (ok) socket.emit('host:removeTeam', { teamId: team.id })
              }}
            >
              <Icon name="x" />
            </button>
          </>
        ) : (
          <span className="team-group-name muted">Sans équipe ({members.length})</span>
        )}
      </div>

      <div className="players-grid">
        {members.map(p => (
          <div key={p.id} className={'player-chip' + (p.connected ? '' : ' offline')}>
            <Avatar className="player-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
            <Niveau niveau={p.niveau} />
            {/* Les libellés de la puce prennent le nom affiché, marque comprise :
                c'est une porte de plus par où sort un prénom (invariant 17).
                Avec `p.name`, deux « Camille » avaient les mêmes boutons pour
                qui les entend, et « Exclure Camille » ne disait pas laquelle. */}
            {/* Un surnom pour la soirée : l'écran commun, le souvenir et le
                bilan l'affichent ; le profil de l'invité garde son prénom, et
                la soirée suivante le lui rend. */}
            <button
              className="chip-name"
              title="Donner un surnom pour la soirée"
              aria-label={`Donner un surnom à ${p.nomAffiche ?? p.name}`}
              onClick={async () => {
                const name = await promptDialog({
                  title: `Un surnom pour « ${p.nomAffiche ?? p.name} » ce soir`,
                  message: p.niveau
                    ? 'Il s’affiche partout ce soir. Son profil garde son prénom, et la soirée suivante le lui rend.'
                    : 'Il s’affiche partout ce soir, à la place du prénom choisi à l’entrée.',
                  input: { value: p.name, placeholder: 'Surnom', maxLength: 24 },
                  confirmLabel: 'Donner ce surnom',
                })
                if (name) socket.emit('host:renamePlayer', { playerId: p.id, name })
              }}
            >
              {p.nomAffiche ?? p.name}
            </button>
            {/* Hors ligne : la transparence seule ne se lit pas du fond de la
                salle, et un lecteur d'écran n'en sait rien. */}
            {!p.connected && (
              <span className="chip-offline" title="Hors ligne" role="img" aria-label="hors ligne">
                <Icon name="moon" />
              </span>
            )}
            {teams.length > 0 && (
              <select
                className="chip-team"
                value={p.teamId ?? ''}
                title="Changer d'équipe"
                aria-label={`Équipe ${deNom(p.nomAffiche ?? p.name)}`}
                onChange={e =>
                  socket.emit('host:assignPlayer', {
                    playerId: p.id,
                    teamId: e.target.value || null,
                  })
                }
              >
                <option value="">— sans équipe</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className="chip-remove"
              title="Exclure de la soirée"
              aria-label={`Exclure ${p.nomAffiche ?? p.name} de la soirée`}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: `Exclure « ${p.nomAffiche ?? p.name} » de la soirée ?`,
                  message: 'Ses points seront effacés et son téléphone reviendra à l’inscription.',
                  confirmLabel: 'Exclure',
                  danger: true,
                })
                if (ok) socket.emit('host:removePlayer', { playerId: p.id })
              }}
            >
              <Icon name="x" />
            </button>
          </div>
        ))}
        {members.length === 0 && <p className="muted small">Personne pour l'instant</p>}
      </div>
    </div>
  )
}

export function HostApp() {
  const s = useAppState()
  /** L'animateur reconnu par le serveur — `null` tant que la session n'a pas été vérifiée. */
  const [me, setMe] = useState<{ slug: string; name: string } | null>(null)
  /** Le serveur a refusé la poignée de main : pas de session, ou une session périmée. */
  const [needLogin, setNeedLogin] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [muted, setMuted] = useState(isMuted)
  /** Velours (noir chaud) ou Ivoire (fond clair, pour un vidéoprojecteur qui délave les noirs). */
  const [theme, setTheme] = useState(currentTheme)
  /**
   * Les écrans de fin de soirée, projetés à la place du jeu. `null` = on est
   * sur l'écran d'accueil, prêt à lancer un quiz.
   */
  const [screen, setScreen] = useState<null | 'podium' | 'awards' | 'victory' | 'cloture'>(null)
  /** Motif et points du prix libre, celui qui ne se calcule pas. */
  const [freeReason, setFreeReason] = useState('')
  const [freePoints, setFreePoints] = useState(1)
  const [freeTeam, setFreeTeam] = useState('')
  /** Le podium montre les équipes ou les individus — on bascule pendant la remise. */
  const [podiumTab, setPodiumTab] = useState<'teams' | 'solo'>('teams')
  /** Les prix de caractère, calculés côté serveur à partir du journal des points. */
  const [recap, setRecap] = useState<Recap | null>(null)
  /** Formulaire de création d'équipe. */
  const [newTeam, setNewTeam] = useState('')
  const [newEmoji, setNewEmoji] = useState(TEAM_EMOJIS[0])
  /** L'emplacement de la console animateur, où chaque écran pose ses boutons. */
  const [consoleSlot, setConsoleSlot] = useState<HTMLElement | null>(null)

  // L'écran commun ne s'éteint pas en pleine soirée : le QR doit rester au
  // mur pendant l'arrivée des invités, un quiz en mode « Auto » ne touche
  // plus la souris, et un téléphone qui pilote ou qu'on recopie sur la télé
  // se met en veille au bout de trente secondes.
  useEcranAllume(me !== null)

  // Rechargés à chaque ouverture d'un écran de fin : les prix et les
  // statistiques changent après chaque quiz joué.
  const spaceSlug = s.snapshot?.space.slug ?? null
  const spaceTitle = s.snapshot?.space.title ?? null
  useEffect(() => {
    if (spaceTitle) document.title = `${spaceTitle} · Écran commun`
  }, [spaceTitle])
  // La soirée qu'on vient de clore prend l'écran : c'est la dernière chose
  // que la salle doit voir.
  useEffect(() => {
    if (s.cloture) setScreen('cloture')
  }, [s.cloture])
  const finirAnnonces = useCallback(() => setState({ progres: null }), [])
  useEffect(() => {
    if (!screen || screen === 'cloture' || !spaceSlug) return
    fetch(dataUrl(spaceSlug, 'recap.json'))
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setRecap)
      .catch(() => {
        // Un podium sans prix ni trophées, sans un mot, ressemblerait à un
        // écran normal : l'animateur doit savoir qu'il manque quelque chose.
        setRecap(null)
        showToast({ kind: 'error', message: 'Impossible de charger les prix et les statistiques' })
      })
  }, [screen, spaceSlug])

  // La session voyage dans le cookie de la poignée de main : le serveur la
  // reconnaît (ou non) à chaque connexion, sans rien à retenir ici.
  useEffect(() => {
    socket.connect()
    const hello = async () => {
      // Sans réponse, on ne conclut rien sur la session : la liaison est
      // vérifiée, et la prochaine connexion reposera la question.
      const res = await helloHost().catch(() => null)
      if (!res) return
      if (res.ok && res.slug && res.name) {
        setMe({ slug: res.slug, name: res.name })
        setNeedLogin(false)
      } else {
        setMe(null)
        setNeedLogin(true)
      }
    }
    // Une session révoquée — déconnexion ou mot de passe changé depuis « Mon
    // compte » — coupe l'écran commun côté serveur. Après ce motif-là,
    // socket.io ne se reconnecte jamais tout seul : « reconnexion… » restait
    // affiché pour toujours, et la console n'envoyait plus rien.
    const coupe = (motif: string) => {
      if (motif !== 'io server disconnect') return
      setMe(null)
      setNeedLogin(true)
      setError('Session fermée — reconnecte-toi')
    }
    if (socket.connected) hello()
    socket.on('connect', hello)
    socket.on('disconnect', coupe)
    return () => {
      socket.off('connect', hello)
      socket.off('disconnect', coupe)
    }
  }, [])

  const submitLogin = async (login: string, password: string) => {
    setBusy(true)
    setError('')
    try {
      await api.auth.login(login, password)
      // Le cookie est posé : la prochaine poignée de main le porte.
      socket.disconnect()
      socket.connect()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (needLogin) {
    return <LoginForm title="Écran commun" error={error} busy={busy} onSubmit={submitLogin} />
  }
  if (!me) {
    return (
      <div className="center-page">
        <p className="serif-note">Connexion…</p>
      </div>
    )
  }

  const snap = s.snapshot
  if (!snap) {
    return (
      <div className="center-page">
        <p className="serif-note">Connexion…</p>
      </div>
    )
  }

  // Sur le PC on ouvre souvent l'écran en "localhost" : le QR doit quand même
  // montrer l'adresse que les téléphones peuvent ouvrir. Elle se termine par
  // le nom de l'espace : c'est lui qui dit quelle soirée on rejoint.
  const slug = snap.space.slug
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const joinUrl = isLocalhost && snap.joinUrl ? snap.joinUrl : `${window.location.origin}/${slug}`
  const connectedCount = snap.players.filter(p => p.connected).length
  const offlineCount = snap.players.length - connectedCount
  const session = snap.session
  const activeView = session ? s.views[session.id] : undefined
  const quizView = activeView?.view as QuizHostView | undefined
  const teams = snap.teams

  // Dès qu'une question est à l'écran, tout le reste s'efface : sur un
  // vidéoprojecteur, ce qui compte doit occuper toute la place.
  const staging = (!!quizView && quizView.phase !== 'pickPack') || screen !== null
  const answering = quizView?.phase === 'question'

  /** Ce que la bande d'état annonce au centre : où en est la soirée. */
  const stageLabel =
    screen === 'cloture'
      ? 'Soirée close'
      : screen === 'podium'
      ? 'Podium'
      : screen === 'awards'
        ? 'Remise des prix'
        : screen === 'victory'
          ? 'Victoire'
          : !quizView
            ? "Salle d'attente"
            : quizView.phase === 'pickPack'
              ? 'Nouveau quiz'
              : quizView.phase === 'finished'
                ? 'Podium du quiz'
                : `Question ${quizView.qIndex + 1} / ${quizView.qCount}`

  // L'ordre commun (shared/classement.ts), celui du souvenir : à égalité, le
  // prénom affiché. Chaque ligne emporte son rang partagé — la liste sous le
  // podium commence au quatrième, et ne saurait pas sinon qu'il est troisième
  // ex æquo.
  const ranking = classer(
    snap.players.filter(p => p.score !== 0),
    p => p.score,
    p => p.nomAffiche ?? p.name,
    p => p.id,
  )
    // Les distinctions suivent le joueur jusque sur l'écran commun : c'est là
    // qu'un niveau se montre à toute la salle.
    .map(({ item: p, rang }) => ({
      name: p.nomAffiche ?? p.name,
      avatar: p.avatar,
      points: p.score,
      rank: rang,
      ...distinctions(p),
    }))

  const teamStandings = rankTeams(teams)
  const teamPodium = teamStandings.map(t => ({ name: t.name, avatar: t.emoji, points: t.average, rank: t.rank }))
  const showTeamPodium = podiumTab === 'teams' && teams.length > 0
  // Le vainqueur se joue sur le barème plus les prix : les prix peuvent
  // renverser l'ordre du quiz, c'est tout leur intérêt. Et à égalité, elles
  // gagnent ensemble : la liste départage par nom, pas l'écran de victoire.
  const final = finalRanking(teams)
  const champions = vainqueursDuQuiz(teams)
  const bonuses = snap.bonuses
  const givenTitles = new Set(bonuses.map(b => b.reason))
  const teamById = (id: string) => teams.find(t => t.id === id)

  const openScreen = (next: 'podium' | 'awards' | 'victory') => {
    initAudio()
    if (next !== 'awards') sound.fanfare()
    if (next === 'podium') setPodiumTab(teams.length > 0 ? 'teams' : 'solo')
    setScreen(next)
  }

  const createTeam = (e: FormEvent) => {
    e.preventDefault()
    if (!newTeam.trim()) return
    socket.emit('host:createTeam', { name: newTeam, emoji: newEmoji })
    setNewTeam('')
    // L'emoji suivant, pour ne pas créer six équipes avec la même vignette.
    setNewEmoji(TEAM_EMOJIS[(TEAM_EMOJIS.indexOf(newEmoji) + 1) % TEAM_EMOJIS.length])
  }

  const backButton = (
    <button className="btn btn-ghost" onClick={() => setScreen(null)}>
      Revenir
    </button>
  )

  /**
   * « Clore la soirée » : le seul geste de fin. Il remplace « Sauvegarder »
   * — la soirée s'enregistre toute seule après chaque quiz — et « Nouvelle
   * soirée », qui effaçait tout et perdait les prix quand on n'avait pas
   * sauvegardé d'abord. Une soirée d'essai, elle, s'efface sans rien garder.
   */
  const clore = async () => {
    // Le titre sous lequel la soirée est déjà rangée, s'il y en a un.
    const rangee = await fetch(dataUrl(slug, 'soirees.json'))
      .then(r => (r.ok ? (r.json() as Promise<ArchiveList>) : null))
      .then(l => l?.current?.title)
      .catch(() => undefined)
    const choix = await choixDialog({
      title: 'Clore la soirée',
      message:
        'Elle rejoint l’historique sous ce nom. Chaque invité reçoit sa fin de soirée sur son téléphone — son rang, ses hauts faits, ses niveaux —, puis la suivante part de zéro.',
      input: { value: titreDeCloture(rangee, snap.space, formatDay(Date.now())), maxLength: 80 },
      confirmLabel: 'Clore la soirée',
      alternative: { label: 'C’était un essai', danger: true },
    })
    if (!choix) return
    if (choix.geste === 'confirmer') {
      socket.emit('host:closeParty', { title: choix.valeur })
      return
    }
    const ok = await confirmDialog({
      title: 'Effacer cet essai ?',
      message: `Rien n’est gardé : ni la soirée dans l’historique, ni l’expérience, les prix et les hauts faits de ses ${snap.players.length} invités. Les téléphones repassent par l’entrée.`,
      confirmLabel: 'Tout effacer',
      danger: true,
    })
    if (ok) socket.emit('host:discardParty')
  }
  const cloreButton = snap.players.length > 0 && (
    <button className="btn" onClick={() => void clore()}>
      <Icon name="flag" />
      Clore la soirée
    </button>
  )

  return (
    <ConsoleSlot.Provider value={consoleSlot}>
      <div className={'host' + (staging ? ' staging' : '')}>
        {/* La bande d'état : le titre, où on en est, comment rejoindre. */}
        <header className="host-band">
          <div className="band-left">
            <span className="brand">{espacesFines(snap.space.title)}</span>
            {quizView?.packTitle && (
              <>
                <span className="band-sep" aria-hidden="true" />
                <span className="band-sub">{quizView.packTitle}</span>
              </>
            )}
            {!s.connected && (
              <span className="pill offline-pill">
                <Icon name="alert" /> reconnexion…
              </span>
            )}
            {/* La base en ligne refuse les écritures depuis un moment : la
                soirée continue ici, mais l'animateur doit le savoir avant de
                laisser l'hébergeur s'endormir. Discret — la salle le voit aussi. */}
            {snap.sauvegardeEnRetard && (
              <span className="pill sauvegarde-pill" role="status">
                Sauvegarde en retard — la soirée continue
              </span>
            )}
          </div>
          <div className="band-center">
            <span>{stageLabel}</span>
            {quizView && quizView.phase !== 'pickPack' && quizView.phase !== 'finished' && (quizView.multiplier ?? 1) > 1 && (
              <span className="pill multi">×{quizView.multiplier} points</span>
            )}
          </div>
          <div className="band-right">
            <span className="band-answered">
              {answering ? (
                <>
                  <b>{quizView?.answeredCount ?? 0}</b> / {quizView?.participantCount ?? 0} ont répondu
                </>
              ) : (
                <>{connectedCount} connecté·e·s</>
              )}
            </span>
            <div className="qr-stack">
              <div className="qr-box">
                <QRCodeSVG value={joinUrl} size={46} bgColor="#ffffff" fgColor={QR_INK} />
              </div>
              <div className="qr-text">
                <span className="label">Rejoindre</span>
                <span className="join-url">{joinUrl}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Les montées de niveau du dernier podium, proclamées à la salle. */}
        {s.progres && <AnnoncesDeNiveau progres={s.progres} onFin={finirAnnonces} />}

        <div className={'host-grid' + (staging ? ' staging' : '')}>
          {!staging && (
            <section className="card">
              <h2>Invités ({snap.players.length})</h2>

              {/* Groupés par équipe : c'est la vue dont on a besoin pour repérer
                  d'un coup d'œil qui s'est trompé d'équipe, et l'y remettre. */}
              <div className="team-groups">
                {teams.map(t => (
                  <TeamGroup
                    key={t.id}
                    team={t}
                    members={snap.players.filter(p => p.teamId === t.id)}
                    teams={teams}
                  />
                ))}
                {(() => {
                  const orphans = snap.players.filter(p => !p.teamId)
                  return orphans.length > 0 || teams.length === 0 ? (
                    <TeamGroup team={null} members={orphans} teams={teams} />
                  ) : null
                })()}
              </div>

              <form className="row team-create" onSubmit={createTeam}>
                <select
                  className="team-emoji-select"
                  value={newEmoji}
                  aria-label="Emoji de la nouvelle équipe"
                  onChange={e => setNewEmoji(e.target.value)}
                >
                  {TEAM_EMOJIS.map(e => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
                <input
                  className="input team-name-input"
                  placeholder="Nouvelle équipe"
                  aria-label="Nom de la nouvelle équipe"
                  value={newTeam}
                  maxLength={20}
                  onChange={e => setNewTeam(e.target.value)}
                />
                <button className="btn btn-small" disabled={!newTeam.trim()}>
                  Ajouter
                </button>
              </form>
              {teams.length === 0 && (
                <button className="btn btn-small" onClick={() => socket.emit('host:seedTeams')}>
                  <Icon name="sparkles" />
                  Créer les 6 équipes d'un coup
                </button>
              )}
            </section>
          )}

          <section className="card main-stage">
            {screen === 'cloture' && s.cloture ? (
              <>
                <ClotureEcran cloture={s.cloture} souvenirUrl={`${joinUrl}/soirees/${s.cloture.soiree.id}`} />
                <ConsoleActions>
                  <a
                    className="btn"
                    href={spacePath(slug, 'souvenir', s.cloture.soiree.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="book" />
                    Le souvenir
                  </a>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setState({ cloture: null })
                      setScreen(null)
                    }}
                  >
                    <Icon name="play" />
                    La soirée suivante
                  </button>
                </ConsoleActions>
              </>
            ) : screen === 'podium' ? (
              <div className="quiz-host stage-scroll">
                {/* Le titre, les onglets et le QR du souvenir sur une ligne,
                    le podium à gauche et les listes à droite : empilés, ils
                    faisaient deux écrans en 1366 × 768, et le QR — le seul
                    moyen pour un invité d'emporter la page, il ne peut pas
                    cliquer sur un lien projeté au mur — tombait sous la
                    console. */}
                <div className="scene-tete">
                  <h2>
                    <Icon name={showTeamPodium ? 'users' : 'trophy'} />
                    {showTeamPodium ? 'Les équipes au quiz' : 'Le classement de la soirée'}
                  </h2>
                  {teams.length > 0 && (
                    <div className="row podium-tabs">
                      <button
                        className={'pill-btn' + (podiumTab === 'teams' ? ' active' : '')}
                        onClick={() => setPodiumTab('teams')}
                      >
                        <Icon name="users" />
                        Les équipes
                      </button>
                      <button
                        className={'pill-btn' + (podiumTab === 'solo' ? ' active' : '')}
                        onClick={() => setPodiumTab('solo')}
                      >
                        <Icon name="trophy" />
                        Les joueurs
                      </button>
                    </div>
                  )}
                  <div className="qr-stack scene-qr">
                    <div className="qr-box">
                      <QRCodeSVG value={`${joinUrl}/souvenir`} size={84} bgColor="#ffffff" fgColor={QR_INK} />
                    </div>
                    <div className="qr-text">
                      <span className="label">Le souvenir de la soirée</span>
                      <span className="join-url">{joinUrl}/souvenir</span>
                    </div>
                  </div>
                </div>

                {showTeamPodium ? (
                  <div className="scene-podium">
                    <FinalPodium rows={teamPodium} />
                    <div className="scene-listes">
                      <TeamBoard teams={teams} showFinalPoints />
                      <p className="muted small">
                        Le chiffre cerclé : le barème, prix compris — il range le tableau et
                        désigne l'équipe gagnante. Le grand chiffre à droite, la moyenne par membre :
                        c'est elle qui fait le podium du quiz et distribue le barème.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="scene-podium">
                    <FinalPodium rows={ranking} />
                    {(ranking.length > 3 || recap) && (
                      <div className="scene-listes">
                        {ranking.length > 3 && <Standings rows={ranking.slice(3)} offset={3} />}
                        {recap && <Trophies recap={recap} />}
                      </div>
                    )}
                  </div>
                )}

                <ConsoleActions>
                  <a className="btn btn-accent" href={spacePath(slug, 'souvenir')} target="_blank" rel="noreferrer">
                    <Icon name="book" />
                    Page souvenir
                  </a>
                  <a className="btn" href={spacePath(slug, 'bilan')} target="_blank" rel="noreferrer">
                    <Icon name="list" />
                    Le bilan
                  </a>
                  <button className="btn" onClick={() => openScreen('awards')}>
                    <Icon name="award" />
                    Remise des prix
                  </button>
                  {backButton}
                </ConsoleActions>
              </div>
            ) : screen === 'awards' ? (
              <div className="quiz-host stage-scroll">
                <h2>
                  <Icon name="award" />
                  Remise des prix
                </h2>
                {/* « Rien n'est attribué tant que tu ne cliques pas » : vrai des
                    points, faux du palmarès, qui se relit au souvenir et se
                    range sur l'étagère des profils remis ou non. Une
                    animatrice qui avait épargné un prix à voix haute le
                    retrouvait le lendemain. */}
                <p className="muted center">
                  Des points pour les équipes : un prix ne rapporte rien tant que tu ne cliques pas,
                  puis s'ajoute au total de l'équipe du lauréat, sur l'échelle du barème. Le palmarès,
                  lui, reste au souvenir, remis ou non — sans jamais rapporter d'expérience.
                </p>

                <AwardsBoard
                  awards={recap?.stats.awards ?? []}
                  teams={teams}
                  givenTitles={givenTitles}
                  onAward={(teamId, points, reason) => {
                    sound.reveal()
                    socket.emit('host:awardTeam', { teamId, points, reason })
                  }}
                />

                {/* Tout ce qui ne se calcule pas : le karaoké, le déguisement,
                    la table qui a rangé. */}
                <div className="card free-award">
                  <h3>
                    <Icon name="star" />
                    Prix libre
                  </h3>
                  <div className="row">
                    <select
                      className="team-emoji-select free-team"
                      value={freeTeam}
                      aria-label="Équipe qui reçoit le prix"
                      onChange={e => setFreeTeam(e.target.value)}
                    >
                      <option value="">Choisir une équipe…</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.emoji} {t.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      placeholder="Motif (ex. « ont chanté le plus fort »)"
                      aria-label="Motif du prix"
                      maxLength={60}
                      value={freeReason}
                      onChange={e => setFreeReason(e.target.value)}
                    />
                    <input
                      className="input award-points"
                      type="number"
                      min={-10}
                      max={10}
                      aria-label="Points du prix"
                      value={freePoints}
                      onChange={e => setFreePoints(Number(e.target.value))}
                    />
                    <button
                      className="btn btn-primary btn-small"
                      disabled={!freeTeam || !freeReason.trim()}
                      onClick={() => {
                        sound.reveal()
                        socket.emit('host:awardTeam', {
                          teamId: freeTeam,
                          points: freePoints,
                          reason: freeReason,
                        })
                        setFreeReason('')
                      }}
                    >
                      Attribuer
                    </button>
                  </div>
                </div>

                {bonuses.length > 0 && (
                  <div className="card">
                    <h3>Prix déjà remis</h3>
                    <div className="given-list">
                      {bonuses.map(b => {
                        const team = teamById(b.teamId)
                        return (
                          <div key={b.id} className="given-row">
                            <span className="given-points">
                              {b.points > 0 ? '+' : ''}
                              {b.points}
                            </span>
                            <span className="given-team">
                              {team ? `${team.emoji} ${team.name}` : '—'}
                            </span>
                            <span className="given-reason">{b.reason}</span>
                            <button
                              className="chip-remove"
                              title="Retirer ce prix"
                              aria-label={`Retirer le prix « ${b.reason} »`}
                              onClick={() => socket.emit('host:removeBonus', { bonusId: b.id })}
                            >
                              <Icon name="x" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Le tableau complet se lit sur un téléphone, pas au
                    vidéoprojecteur : le souvenir s'ouvre à côté, droit sur
                    ses chiffres. */}
                <div className="stage-foot">
                  <div className="qr-stack">
                    <div className="qr-box">
                      <QRCodeSVG value={`${joinUrl}/stats`} size={84} bgColor="#ffffff" fgColor={QR_INK} />
                    </div>
                    <div className="qr-text">
                      <span className="label">Les chiffres</span>
                      <span className="join-url">{joinUrl}/stats</span>
                    </div>
                  </div>
                </div>

                <ConsoleActions>
                  <button className="btn btn-primary" onClick={() => openScreen('victory')}>
                    <Icon name="crown" />
                    Écran de victoire
                  </button>
                  <a className="btn" href={spacePath(slug, 'stats')} target="_blank" rel="noreferrer">
                    <Icon name="bar-chart" />
                    Les chiffres
                  </a>
                  {backButton}
                </ConsoleActions>
              </div>
            ) : screen === 'victory' ? (
              <div className="quiz-host victory stage-scroll">
                <h2>
                  <Icon name="crown" />
                  {/* Sans équipes, « L'équipe qui remporte le quiz » au-dessus de
                      « rien à couronner » se lisait comme un verdict contre Jo,
                      qui venait de gagner la soirée seul. */}
                  {final.length === 0
                    ? "Pas d'équipes ce soir"
                    : champions.length > 1 ? 'Les équipes qui remportent le quiz' : "L'équipe qui remporte le quiz"}
                </h2>
                {final.length > 0 ? (
                  <>
                    {/* Couronner la première de la liste, c'était couronner
                        l'alphabet : un prix à +1 remis aux Aigles, deuxièmes,
                        les faisait passer devant les Zèbres, qui avaient gagné
                        le quiz. À égalité, elles gagnent ensemble. */}
                    {champions.length === 0 ? (
                      <p className="muted center">Aucun quiz joué, aucun prix remis : rien à couronner pour l'instant.</p>
                    ) : (
                      <div className="victory-winner">
                        <span className="victory-emoji">{champions.map(t => t.emoji).join(' ')}</span>
                        <span className="victory-name">{enumerer(champions.map(t => t.name))}</span>
                        {champions.length > 1 ? (
                          <span className="victory-points">Ex æquo · {champions[0].finalPoints} points chacune</span>
                        ) : (
                          <>
                            <span className="victory-points">{champions[0].finalPoints} points</span>
                            <span className="muted">
                              {champions[0].gamePoints} au barème
                              {champions[0].bonus !== 0 &&
                                ` · ${champions[0].bonus > 0 ? '+' : ''}${champions[0].bonus} de prix`}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    <div className="victory-boards">
                      <div>
                        <h3>
                          <Icon name="users" />
                          Les équipes
                        </h3>
                        <div className="leaderboard">
                          {final.map(t => (
                            <div key={t.id} className="lb-row team-row">
                              <Rank n={t.rank} />
                              <span className="lb-avatar">{t.emoji}</span>
                              <span className="lb-name">
                                {t.name}
                                <span className="team-sub">
                                  {t.total} pts cumulés · {t.average} de moyenne
                                  {t.bonus !== 0 && ` · ${t.bonus > 0 ? '+' : ''}${t.bonus} de prix`}
                                </span>
                              </span>
                              <Score n={t.finalPoints} precision="au total, prix compris" />
                            </div>
                          ))}
                        </div>
                        <p className="muted small center">
                          Le gros chiffre est le total du quiz, prix compris : c'est lui qui
                          classe les équipes.
                        </p>
                      </div>

                      {/* Le classement individuel a sa place ici : c'est pour lui
                          que chacun a joué, et il explique le total des équipes. */}
                      <div>
                        <h3>
                          <Icon name="trophy" />
                          Les joueurs
                        </h3>
                        <div className="leaderboard">
                          {ranking.slice(0, 12).map((p, i) => (
                            <div key={i} className="lb-row">
                              <Rank n={p.rank} />
                              <Avatar className="lb-avatar" avatar={p.avatar} finition={p.finition} eclat={p.eclat} legendaire={p.legendaire} />
                              <span className="lb-name">{p.name}</span>
                              <Niveau niveau={p.niveau} />
                              <Score n={p.points} />
                            </div>
                          ))}
                        </div>
                        {ranking.length > 12 && (
                          <p className="muted small center">et {ranking.length - 12} autres…</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="muted">Sans équipes, c’est le classement des joueurs qui dit qui mène.</p>
                )}
                <ConsoleActions>
                  <button className="btn" onClick={() => openScreen('awards')}>
                    <Icon name="award" />
                    Revenir aux prix
                  </button>
                  {cloreButton}
                  {backButton}
                </ConsoleActions>
              </div>
            ) : activeView && quizView ? (
              <QuizHost
                view={quizView}
                teams={teams}
                sendCommand={command => socket.emit('host:command', { sessionId: activeView.sessionId, command })}
                endSession={() => socket.emit('host:endSession', { sessionId: activeView.sessionId })}
              />
            ) : (
              <>
                {/* L'invitation : avant le premier quiz, la seule chose que la
                    salle doit voir de loin, c'est comment entrer. */}
                <div className="invite">
                  <span className="label">Pour rejoindre le quiz</span>
                  <p className="invite-url">{adresseCoupable(joinUrl)}</p>
                  <div className="invite-qrs">
                    {snap.wifi && (
                      <div className="invite-qr">
                        <div className="qr-box">
                          <QRCodeSVG value={wifiQrValue(snap.wifi)} size={148} bgColor="#ffffff" fgColor={QR_INK} />
                        </div>
                        <span className="label">1 · Wifi {espacesFines(`« ${snap.wifi.ssid} »`)}</span>
                      </div>
                    )}
                    <div className="invite-qr">
                      <div className="qr-box">
                        <QRCodeSVG value={joinUrl} size={148} bgColor="#ffffff" fgColor={QR_INK} />
                      </div>
                      <span className="label">{snap.wifi ? '2 · Le quiz' : 'Scanner pour jouer'}</span>
                    </div>
                  </div>
                  {/* Un écran ne scanne pas son propre QR : l'animateur qui
                      pilote depuis son téléphone et veut jouer aussi ouvre la
                      soirée dans un autre onglet, où le cookie de son profil
                      et celui de la console cohabitent. Au mur, où rien ne se
                      touche, le lien reste caché (styles.css). */}
                  <a className="btn btn-accent jouer-ici" href={spacePath(slug)} target="_blank" rel="noreferrer">
                    <Icon name="play" />
                    Jouer depuis cet appareil
                  </a>
                  <p className="muted invite-note">
                    Le temps de lire la question est offert, puis la rapidité rapporte des points bonus.
                    Les scores s'ajoutent au classement de la soirée.
                  </p>
                  {offlineCount > 0 && (
                    <p className="muted small invite-note">
                      {offlineCount} inscrit{offlineCount > 1 ? 's' : ''} hors ligne : un téléphone dont
                      l'écran s'est éteint n'entrera dans le quiz qu'à son retour.
                    </p>
                  )}
                </div>
                <ConsoleActions>
                  <button
                    className="btn btn-primary"
                    disabled={connectedCount === 0}
                    onClick={() => {
                      // Premier geste de l'animateur : c'est le moment où le
                      // navigateur autorise enfin le son.
                      initAudio()
                      socket.emit('host:launch')
                    }}
                  >
                    <Icon name="play" />
                    {connectedCount === 0 ? 'En attente des invités…' : 'Lancer un quiz'}
                  </button>
                  {/* Dans un autre onglet : l'écran commun reste projeté. La
                      session est dans le cookie, rien à passer dans l'adresse. */}
                  <a className="btn" href="/edit" target="_blank" rel="noreferrer">
                    <Icon name="edit" />
                    Mes quiz
                  </a>
                  <a className="btn btn-ghost" href="/compte" target="_blank" rel="noreferrer">
                    <Icon name="users" />
                    Mon compte
                  </a>
                  {(ranking.length > 0 || teams.length > 0) && (
                    <>
                      <button className="btn" onClick={() => openScreen('podium')}>
                        <Icon name="trophy" />
                        Podium
                      </button>
                      <button className="btn" onClick={() => openScreen('awards')}>
                        <Icon name="award" />
                        Prix
                      </button>
                      {teams.length > 0 && (
                        <button className="btn" onClick={() => openScreen('victory')}>
                          <Icon name="crown" />
                          Victoire
                        </button>
                      )}
                      <a className="btn" href={spacePath(slug, 'stats')} target="_blank" rel="noreferrer">
                        <Icon name="bar-chart" />
                        Les chiffres
                      </a>
                    </>
                  )}
                  <a className="btn btn-ghost" href={spacePath(slug, 'soirees')} target="_blank" rel="noreferrer">
                    <Icon name="book" />
                    Historique
                  </a>
                  {cloreButton}
                </ConsoleActions>
              </>
            )}
          </section>

          {!staging && (
            <div className="host-col">
              {teams.length > 0 && (
                <section className="card">
                  <h2>Les équipes</h2>
                  <TeamBoard teams={teams} showFinalPoints />
                  <p className="muted small">
                    Le chiffre cerclé : le barème, prix compris — il range les équipes et désigne
                    la gagnante. Le grand chiffre à droite, la moyenne par membre, qui distribue le
                    barème.
                  </p>
                </section>
              )}

              <section className="card">
                <h2>Classement de la soirée</h2>
                <Leaderboard players={snap.players} />
              </section>
            </div>
          )}
        </div>

        {/* La console animateur : discrète, en bas, toujours au même endroit.
            Chaque écran y pose ses boutons ; le son, l'habillage et le plein
            écran restent à droite quoi qu'il arrive. */}
        <footer className="host-console">
          <span className="console-label">Console animateur</span>
          <div className="console-actions" ref={setConsoleSlot} />
          <div className="console-icons">
            <button
              className="btn btn-icon"
              title={muted ? 'Activer les sons' : 'Couper les sons'}
              aria-label={muted ? 'Activer les sons' : 'Couper les sons'}
              aria-pressed={!muted}
              onClick={() => {
                initAudio()
                setMuted(toggleMuted())
              }}
            >
              <Icon name={muted ? 'volume-off' : 'volume'} />
            </button>
            {/* Un vidéoprojecteur délave les noirs : l'écran commun peut passer
                sur fond clair, sans toucher aux téléphones des invités. */}
            <button
              className="btn btn-icon"
              title={theme === 'ivoire' ? 'Fond sombre (Velours)' : 'Fond clair pour le vidéoprojecteur (Ivoire)'}
              aria-label={theme === 'ivoire' ? 'Revenir au fond sombre' : 'Passer sur fond clair'}
              aria-pressed={theme === 'ivoire'}
              onClick={() => setTheme(toggleTheme())}
            >
              <Icon name={theme === 'ivoire' ? 'sun' : 'moon'} />
            </button>
            {PLEIN_ECRAN && (
              <button
                className="btn btn-icon"
                title="Plein écran"
                aria-label="Plein écran"
                onClick={() => {
                  if (document.fullscreenElement) document.exitFullscreen()
                  else document.documentElement.requestFullscreen().catch(() => {})
                }}
              >
                <Icon name="maximize" />
              </button>
            )}
          </div>
        </footer>

        {s.toast && <div className={`toast toast-${s.toast.kind}`}>{espacesFines(s.toast.message)}</div>}
      </div>
    </ConsoleSlot.Provider>
  )
}
