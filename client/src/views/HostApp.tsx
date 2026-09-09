import { useEffect, useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { helloHost, socket } from '../socket'
import { showToast, useAppState } from '../state'
import { confirmDialog, promptDialog } from '../components/Dialog'
import { readKeyFromUrl } from '../hostKeyUrl'
import { initAudio, isMuted, toggleMuted } from '../sound'
import { Leaderboard } from '../components/Leaderboard'
import { TeamBoard } from '../components/TeamBoard'
import { FinalPodium, Standings } from '../components/Podium'
import { Trophies } from '../components/Trophies'
import { AwardsBoard } from '../components/AwardsBoard'
import { Icon } from '../components/Icon'
import { Rank } from '../components/Rank'
import { KeyForm } from '../components/Invitation'
import { ConsoleActions, ConsoleSlot } from '../components/HostConsole'
import { finalRanking, rankTeams } from '../../../shared/teams'
import type { PublicPlayer, PublicTeam, Recap } from '../../../shared/types'
import { sound } from '../sound'
import { QuizHost } from '../games/quiz/HostView'
import type { QuizHostView } from '../../../shared/games/quiz'

/** QR wifi standard : le téléphone rejoint le réseau en le scannant. */
function wifiQrValue(wifi: { ssid: string; pass: string }): string {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')
  return wifi.pass
    ? `WIFI:T:WPA;S:${esc(wifi.ssid)};P:${esc(wifi.pass)};;`
    : `WIFI:T:nopass;S:${esc(wifi.ssid)};;`
}

/** L'encre des QR codes : le noir chaud du fond, sur blanc. */
const QR_INK = '#1a1412'

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
            <span className="player-avatar">{p.avatar}</span>
            <button
              className="chip-name"
              title="Renommer"
              aria-label={`Renommer ${p.name}`}
              onClick={async () => {
                const name = await promptDialog({
                  title: `Nouveau prénom pour « ${p.name} »`,
                  input: { value: p.name, placeholder: 'Prénom', maxLength: 24 },
                  confirmLabel: 'Renommer',
                })
                if (name) socket.emit('host:renamePlayer', { playerId: p.id, name })
              }}
            >
              {p.name}
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
                aria-label={`Équipe de ${p.name}`}
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
              aria-label={`Exclure ${p.name} de la soirée`}
              onClick={async () => {
                const ok = await confirmDialog({
                  title: `Retirer « ${p.name} » de la soirée ?`,
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
  const [authed, setAuthed] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(isMuted)
  /**
   * Les écrans de fin de soirée, projetés à la place du jeu. `null` = on est
   * sur l'écran d'accueil, prêt à lancer un quiz.
   */
  const [screen, setScreen] = useState<null | 'podium' | 'awards' | 'victory'>(null)
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

  // Rechargés à chaque ouverture d'un écran de fin : les prix et les
  // statistiques changent après chaque quiz joué.
  useEffect(() => {
    if (!screen) return
    fetch('/recap.json')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setRecap)
      .catch(() => {
        // Un podium sans prix ni trophées, sans un mot, ressemblerait à un
        // écran normal : l'animateur doit savoir qu'il manque quelque chose.
        setRecap(null)
        showToast({ kind: 'error', message: 'Impossible de charger les prix et les statistiques' })
      })
  }, [screen])

  useEffect(() => {
    const urlKey = readKeyFromUrl()
    if (urlKey) localStorage.setItem('quizz.hostKey', urlKey)
    socket.connect()
    const hello = async () => {
      const key = localStorage.getItem('quizz.hostKey')
      if (!key) return
      const res = await helloHost(key)
      setAuthed(res.ok)
    }
    if (socket.connected) hello()
    socket.on('connect', hello)
    return () => {
      socket.off('connect', hello)
    }
  }, [])

  const submitKey = async (e: FormEvent) => {
    e.preventDefault()
    localStorage.setItem('quizz.hostKey', keyInput)
    const res = await helloHost(keyInput)
    if (res.ok) setAuthed(true)
    else setError('Clé incorrecte')
  }

  if (!authed) {
    return <KeyForm title="Écran commun" value={keyInput} error={error} onChange={setKeyInput} onSubmit={submitKey} />
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
  // montrer l'adresse que les téléphones peuvent ouvrir.
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const joinUrl = isLocalhost && snap.joinUrl ? snap.joinUrl : window.location.origin
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
    screen === 'podium'
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

  const ranking = [...snap.players]
    .filter(p => p.score !== 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))
    .map(p => ({ name: p.name, avatar: p.avatar, points: p.score }))

  const teamStandings = rankTeams(teams)
  const teamPodium = teamStandings.map(t => ({ name: t.name, avatar: t.emoji, points: t.average }))
  const showTeamPodium = podiumTab === 'teams' && teams.length > 0
  // Le vainqueur se joue sur le barème plus les prix : les prix peuvent
  // renverser l'ordre du quiz, c'est tout leur intérêt.
  const final = finalRanking(teams)
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

  return (
    <ConsoleSlot.Provider value={consoleSlot}>
      <div className={'host' + (staging ? ' staging' : '')}>
        {/* La bande d'état : le titre, où on en est, comment rejoindre. */}
        <header className="host-band">
          <div className="band-left">
            <span className="brand">Quizz Romane 30</span>
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
            {screen === 'podium' ? (
              <div className="quiz-host stage-scroll">
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

                {showTeamPodium ? (
                  <>
                    <h2>
                      <Icon name="users" />
                      Les équipes au quiz
                    </h2>
                    <FinalPodium rows={teamPodium} />
                    <TeamBoard teams={teams} showGamePoints />
                    <p className="muted center">
                      Le chiffre cerclé est celui à reporter sur le tableau des trois jeux. En
                      champagne, la moyenne par membre — c'est elle qui classe les équipes.
                    </p>
                  </>
                ) : (
                  <>
                    <h2>
                      <Icon name="trophy" />
                      Le classement de la soirée
                    </h2>
                    <FinalPodium rows={ranking} />
                    {ranking.length > 3 && <Standings rows={ranking.slice(3)} offset={3} />}
                    {recap && <Trophies recap={recap} />}
                  </>
                )}

                {/* Le QR est le seul moyen pour un invité d'emporter la page :
                    il ne peut pas cliquer sur un lien projeté au mur. */}
                <div className="stage-foot">
                  <div className="qr-stack">
                    <div className="qr-box">
                      <QRCodeSVG value={`${joinUrl}/souvenir`} size={84} bgColor="#ffffff" fgColor={QR_INK} />
                    </div>
                    <div className="qr-text">
                      <span className="label">Le souvenir de la soirée</span>
                      <span className="join-url">{joinUrl}/souvenir</span>
                    </div>
                  </div>
                </div>

                <ConsoleActions>
                  <a className="btn btn-accent" href="/souvenir" target="_blank" rel="noreferrer">
                    <Icon name="book" />
                    Page souvenir
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
                <p className="muted center">
                  Rien n'est attribué tant que tu ne cliques pas. Les points s'ajoutent au total de
                  l'équipe du lauréat, sur l'échelle du barème.
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
                    vidéoprojecteur : il s'ouvre à côté. */}
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
                  <a className="btn" href="/stats" target="_blank" rel="noreferrer">
                    <Icon name="bar-chart" />
                    Statistiques
                  </a>
                  {backButton}
                </ConsoleActions>
              </div>
            ) : screen === 'victory' ? (
              <div className="quiz-host victory stage-scroll">
                <h2>
                  <Icon name="crown" />
                  L'équipe qui remporte le quiz
                </h2>
                {final.length > 0 ? (
                  <>
                    <div className="victory-winner">
                      <span className="victory-emoji">{final[0].emoji}</span>
                      <span className="victory-name">{final[0].name}</span>
                      <span className="victory-points">{final[0].finalPoints} points</span>
                      <span className="muted">
                        {final[0].gamePoints} au barème
                        {final[0].bonus !== 0 && ` · ${final[0].bonus > 0 ? '+' : ''}${final[0].bonus} de prix`}
                      </span>
                    </div>
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
                              <span className="lb-score">{t.finalPoints}</span>
                            </div>
                          ))}
                        </div>
                        <p className="muted small center">
                          Le gros chiffre est le total du quiz, prix compris. Ajoute-lui tes deux jeux
                          physiques pour désigner l'équipe gagnante de la soirée.
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
                          {ranking.slice(0, 12).map((p, i) => {
                            const rank = ranking.findIndex(r => r.points === p.points) + 1
                            return (
                              <div key={i} className="lb-row">
                                <Rank n={rank} />
                                <span className="lb-avatar">{p.avatar}</span>
                                <span className="lb-name">{p.name}</span>
                                <span className="lb-score">{p.points}</span>
                              </div>
                            )
                          })}
                        </div>
                        {ranking.length > 12 && (
                          <p className="muted small center">et {ranking.length - 12} autres…</p>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="muted">Aucune équipe — rien à couronner.</p>
                )}
                <ConsoleActions>
                  <button className="btn" onClick={() => openScreen('awards')}>
                    <Icon name="award" />
                    Revenir aux prix
                  </button>
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
                  <p className="invite-url">{joinUrl}</p>
                  <div className="invite-qrs">
                    {snap.wifi && (
                      <div className="invite-qr">
                        <div className="qr-box">
                          <QRCodeSVG value={wifiQrValue(snap.wifi)} size={148} bgColor="#ffffff" fgColor={QR_INK} />
                        </div>
                        <span className="label">1 · Wifi « {snap.wifi.ssid} »</span>
                      </div>
                    )}
                    <div className="invite-qr">
                      <div className="qr-box">
                        <QRCodeSVG value={joinUrl} size={148} bgColor="#ffffff" fgColor={QR_INK} />
                      </div>
                      <span className="label">{snap.wifi ? '2 · Le quiz' : 'Scanner pour jouer'}</span>
                    </div>
                  </div>
                  <p className="muted invite-note">
                    Répondez vite : la rapidité rapporte des points bonus. Les scores s'ajoutent au
                    classement de la soirée.
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
                  {/* Dans un autre onglet : l'écran commun reste projeté. La clé
                      passe en fragment, que le navigateur garde pour lui. */}
                  <a
                    className="btn"
                    href={`/edit#key=${encodeURIComponent(localStorage.getItem('quizz.hostKey') ?? '')}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="edit" />
                    Mes quiz
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
                      <a className="btn" href="/stats" target="_blank" rel="noreferrer">
                        <Icon name="bar-chart" />
                        Statistiques
                      </a>
                    </>
                  )}
                </ConsoleActions>
              </>
            )}
          </section>

          {!staging && (
            <div className="host-col">
              {teams.length > 0 && (
                <section className="card">
                  <h2>Les équipes</h2>
                  <TeamBoard teams={teams} showGamePoints />
                  <p className="muted small">
                    Classées à la moyenne par membre, en champagne. Le chiffre cerclé est ce que le
                    quiz rapporte au tableau des trois jeux.
                  </p>
                </section>
              )}

              <section className="card">
                <h2>Classement de la soirée</h2>
                <Leaderboard players={snap.players} />
                {snap.players.length > 0 && (
                  <div className="row reset-row">
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={async () => {
                        // Efface tout, y compris la sauvegarde distante : à ne
                        // faire qu'entre deux soirées, jamais pendant.
                        const ok = await confirmDialog({
                          title: 'Repartir d’une soirée vierge ?',
                          message: `Efface les ${snap.players.length} invités, les ${teams.length} équipes et tous les points.\n\nÀ faire une fois les essais terminés, pour démarrer la vraie soirée à zéro. C'est définitif.`,
                          confirmLabel: 'Tout effacer',
                          danger: true,
                        })
                        if (ok) socket.emit('host:resetParty')
                      }}
                    >
                      <Icon name="trash" />
                      Nouvelle soirée
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* La console animateur : discrète, en bas, toujours au même endroit.
            Chaque écran y pose ses boutons ; le son et le plein écran restent
            à droite quoi qu'il arrive. */}
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
          </div>
        </footer>

        {s.toast && <div className={`toast toast-${s.toast.kind}`}>{s.toast.message}</div>}
      </div>
    </ConsoleSlot.Provider>
  )
}
