import { useEffect, useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { helloHost, socket } from '../socket'
import { useAppState } from '../state'
import { initAudio, isMuted, toggleMuted } from '../sound'
import { Leaderboard } from '../components/Leaderboard'
import { TeamBoard } from '../components/TeamBoard'
import { FinalPodium, Standings } from '../components/Podium'
import { Trophies } from '../components/Trophies'
import { AwardsBoard } from '../components/AwardsBoard'
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
              onClick={() => {
                const name = window.prompt(`Nouveau nom pour « ${team.name} » ?`, team.name)
                if (name?.trim()) socket.emit('host:updateTeam', { teamId: team.id, name })
              }}
            >
              {team.name}
            </button>
            <span className="muted small">{members.length}</span>
            <button
              className="chip-remove"
              title="Supprimer l'équipe"
              onClick={() => {
                if (
                  window.confirm(
                    `Supprimer l'équipe « ${team.name} » ?\n\nSes ${members.length} membres ne sont pas exclus : ils repassent « sans équipe » et gardent leurs points.`,
                  )
                ) {
                  socket.emit('host:removeTeam', { teamId: team.id })
                }
              }}
            >
              ✕
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
              onClick={() => {
                const name = window.prompt(`Nouveau prénom pour « ${p.name} » ?`, p.name)
                if (name?.trim()) socket.emit('host:renamePlayer', { playerId: p.id, name })
              }}
            >
              {p.name}
            </button>
            {teams.length > 0 && (
              <select
                className="chip-team"
                value={p.teamId ?? ''}
                title="Changer d'équipe"
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
              onClick={() => {
                if (window.confirm(`Retirer « ${p.name} » de la soirée ? Ses points seront effacés.`)) {
                  socket.emit('host:removePlayer', { playerId: p.id })
                }
              }}
            >
              ✕
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

  // Chargés à l'ouverture du podium : ils changent à chaque quiz joué.
  // Rechargés à chaque ouverture d'un écran de fin : les prix et les
  // statistiques changent après chaque quiz joué.
  useEffect(() => {
    if (!screen) return
    fetch('/recap.json')
      .then(r => r.json())
      .then(setRecap)
      .catch(() => setRecap(null))
  }, [screen])

  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get('key')
    if (urlKey) {
      localStorage.setItem('quizz.hostKey', urlKey)
      // Retirée de l'adresse : sur un vidéoprojecteur, la barre du navigateur
      // se lit depuis le fond de la salle.
      window.history.replaceState({}, '', window.location.pathname)
    }
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
    return (
      <div className="center-page">
        <form className="card join-card" onSubmit={submitKey}>
          <h1>🖥️ Écran commun</h1>
          <input
            className="input"
            placeholder="Clé d'accès (HOST_KEY)"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
          />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary">Entrer</button>
        </form>
      </div>
    )
  }

  const snap = s.snapshot
  if (!snap) {
    return (
      <div className="center-page">
        <p className="muted">Connexion…</p>
      </div>
    )
  }

  // Sur le PC on ouvre souvent l'écran en "localhost" : le QR doit quand même
  // montrer l'adresse que les téléphones peuvent ouvrir.
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const joinUrl = isLocalhost && snap.joinUrl ? snap.joinUrl : window.location.origin
  const connectedCount = snap.players.filter(p => p.connected).length
  const session = snap.session
  const activeView = session ? s.views[session.id] : undefined
  const quizView = activeView?.view as QuizHostView | undefined
  const teams = snap.teams

  // Dès qu'une question est à l'écran, tout le reste s'efface : sur un
  // vidéoprojecteur, ce qui compte doit occuper toute la place.
  const staging = (!!quizView && quizView.phase !== 'pickPack') || screen !== null

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

  return (
    <div className={'host' + (staging ? ' staging' : '')}>
      {/* La lueur qui respire derrière l'écran commun. Décorative : elle est
          masquée aux lecteurs d'écran, et ne s'affiche pas si le système
          demande moins de mouvement. */}
      <div className="ambient-glow" aria-hidden="true" />

      <header className="host-header">
        <h1>
          🎉 Quizz Romane 30 {!s.connected && <span className="pill offline-pill">⚠️ reconnexion…</span>}
        </h1>
        <div className="join-info">
          <button
            className="btn btn-ghost btn-small"
            title="Plein écran"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen()
              else document.documentElement.requestFullscreen().catch(() => {})
            }}
          >
            ⛶
          </button>
          <button
            className="btn btn-ghost btn-small"
            title={muted ? 'Activer les sons' : 'Couper les sons'}
            onClick={() => {
              initAudio()
              setMuted(toggleMuted())
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <div>
            <p className="join-url">{joinUrl}</p>
            <p className="muted">{connectedCount} connecté·e·s · scannez pour rejoindre</p>
          </div>
          {snap.wifi && (
            <div className="qr-stack">
              <div className="qr-box">
                <QRCodeSVG value={wifiQrValue(snap.wifi)} size={116} bgColor="#ffffff" fgColor="#1a1033" />
              </div>
              <p className="qr-caption">1️⃣ Wifi « {snap.wifi.ssid} »</p>
            </div>
          )}
          <div className="qr-stack">
            <div className="qr-box">
              <QRCodeSVG value={joinUrl} size={116} bgColor="#ffffff" fgColor="#1a1033" />
            </div>
            <p className="qr-caption">{snap.wifi ? '2️⃣ Le quiz' : 'Rejoindre'}</p>
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
                ✨ Créer les 6 équipes d'un coup
              </button>
            )}
          </section>
        )}

        <section className="card main-stage">
          {screen === 'podium' ? (
            <div className="quiz-host">
              {teams.length > 0 && (
                <div className="row podium-tabs">
                  <button
                    className={'pill-btn' + (podiumTab === 'teams' ? ' active' : '')}
                    onClick={() => setPodiumTab('teams')}
                  >
                    👥 Les équipes
                  </button>
                  <button
                    className={'pill-btn' + (podiumTab === 'solo' ? ' active' : '')}
                    onClick={() => setPodiumTab('solo')}
                  >
                    🏆 Les joueurs
                  </button>
                </div>
              )}

              {showTeamPodium ? (
                <>
                  <h2>👥 Les équipes au quiz</h2>
                  <FinalPodium rows={teamPodium} />
                  <TeamBoard teams={teams} showGamePoints />
                  <p className="muted center">
                    En turquoise, les points à reporter sur le tableau des trois jeux. En doré, la
                    moyenne par membre — c'est elle qui classe les équipes.
                  </p>
                </>
              ) : (
                <>
                  <h2>🏆 Le classement de la soirée</h2>
                  <FinalPodium rows={ranking} />
                  {ranking.length > 3 && <Standings rows={ranking.slice(3)} offset={3} />}
                  {recap && <Trophies recap={recap} />}
                </>
              )}

              <div className="row podium-actions">
                {/* Le QR est le seul moyen pour un invité d'emporter la page :
                    il ne peut pas cliquer sur un lien projeté au mur. */}
                <div className="qr-stack">
                  <div className="qr-box">
                    <QRCodeSVG value={`${joinUrl}/souvenir`} size={104} bgColor="#ffffff" fgColor="#1a1033" />
                  </div>
                  <p className="qr-caption">📖 Le souvenir de la soirée</p>
                </div>
                <a className="btn btn-primary" href="/souvenir" target="_blank" rel="noreferrer">
                  📖 Ouvrir la page souvenir
                </a>
                <button className="btn" onClick={() => openScreen('awards')}>
                  🏅 Remise des prix
                </button>
                <button className="btn btn-ghost" onClick={() => setScreen(null)}>
                  Revenir
                </button>
              </div>
            </div>
          ) : screen === 'awards' ? (
            <div className="quiz-host">
              <h2>🏅 Remise des prix</h2>
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
                <h3>✋ Prix libre</h3>
                <div className="row">
                  <select
                    className="team-emoji-select free-team"
                    value={freeTeam}
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
                    maxLength={60}
                    value={freeReason}
                    onChange={e => setFreeReason(e.target.value)}
                  />
                  <input
                    className="input award-points"
                    type="number"
                    min={-10}
                    max={10}
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
                            onClick={() => socket.emit('host:removeBonus', { bonusId: b.id })}
                          >
                            ✕
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="row podium-actions">
                <button className="btn btn-primary" onClick={() => openScreen('victory')}>
                  👑 Écran de victoire
                </button>
                <button className="btn btn-ghost" onClick={() => setScreen(null)}>
                  Revenir
                </button>
              </div>
            </div>
          ) : screen === 'victory' ? (
            <div className="quiz-host victory">
              <h2>👑 L'équipe qui remporte le quiz</h2>
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
                  <div className="leaderboard">
                    {final.slice(1).map(t => (
                      <div key={t.id} className="lb-row">
                        <span className="lb-rank">{t.rank}</span>
                        <span className="lb-avatar">{t.emoji}</span>
                        <span className="lb-name">{t.name}</span>
                        <span className="team-gamepoints">{t.bonus > 0 ? `+${t.bonus}` : t.bonus || '—'}</span>
                        <span className="lb-score">{t.finalPoints}</span>
                      </div>
                    ))}
                  </div>
                  <p className="muted center">
                    Ce total est celui du quiz, prix compris. Ajoute-lui tes deux jeux physiques
                    pour désigner l'équipe gagnante de la soirée.
                  </p>
                </>
              ) : (
                <p className="muted">Aucune équipe — rien à couronner.</p>
              )}
              <div className="row podium-actions">
                <button className="btn" onClick={() => openScreen('awards')}>
                  🏅 Revenir aux prix
                </button>
                <button className="btn btn-ghost" onClick={() => setScreen(null)}>
                  Revenir
                </button>
              </div>
            </div>
          ) : activeView && quizView ? (
            <QuizHost
              view={quizView}
              teams={teams}
              sendCommand={command => socket.emit('host:command', { sessionId: activeView.sessionId, command })}
              endSession={() => socket.emit('host:endSession', { sessionId: activeView.sessionId })}
            />
          ) : (
            <div className="game-cards">
              <div className="game-card">
                <h3>🧠 Nouveau quiz</h3>
                <p className="muted">
                  Répondez vite : la rapidité rapporte des points bonus. Les scores s'ajoutent au
                  classement de la soirée.
                </p>
                <button
                  className="btn btn-primary btn-big"
                  disabled={connectedCount === 0}
                  onClick={() => {
                    // Premier geste de l'animateur : c'est le moment où le
                    // navigateur autorise enfin le son.
                    initAudio()
                    socket.emit('host:launch')
                  }}
                >
                  {connectedCount === 0 ? 'En attente des invités…' : 'Lancer un quiz'}
                </button>
                <a className="btn btn-ghost btn-small" href={`/edit?key=${localStorage.getItem('quizz.hostKey') ?? ''}`}>
                  ✏️ Mes quiz
                </a>
                {(ranking.length > 0 || teams.length > 0) && (
                  <div className="row">
                    <button className="btn btn-small" onClick={() => openScreen('podium')}>
                      🏆 Podium
                    </button>
                    <button className="btn btn-small" onClick={() => openScreen('awards')}>
                      🏅 Remise des prix
                    </button>
                    {teams.length > 0 && (
                      <button className="btn btn-small" onClick={() => openScreen('victory')}>
                        👑 Victoire
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {!staging && (
          <div className="host-col">
            {teams.length > 0 && (
              <section className="card">
                <h2>Les équipes</h2>
                <TeamBoard teams={teams} showGamePoints />
                <p className="muted small">
                  Classées à la moyenne par membre (en doré). En turquoise, ce que le quiz rapporte
                  au tableau des trois jeux.
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
                    onClick={() => {
                      // Efface tout, y compris la sauvegarde distante : à ne
                      // faire qu'entre deux soirées, jamais pendant.
                      if (!window.confirm(
                        `Effacer les ${snap.players.length} invités, les ${teams.length} équipes et tous les points ?\n\nÀ faire une fois les essais terminés, pour démarrer la vraie soirée à zéro. C'est définitif.`,
                      )) return
                      socket.emit('host:resetParty')
                    }}
                  >
                    🧹 Nouvelle soirée
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {s.toast && <div className={`toast toast-${s.toast.kind}`}>{s.toast.message}</div>}
    </div>
  )
}
