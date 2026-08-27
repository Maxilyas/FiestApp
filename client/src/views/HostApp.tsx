import { useEffect, useState, type FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { helloHost, socket } from '../socket'
import { useAppState } from '../state'
import { initAudio, isMuted, toggleMuted } from '../sound'
import { Leaderboard } from '../components/Leaderboard'
import { QuizHost } from '../games/quiz/HostView'
import type { QuizHostView } from '../../../shared/games/quiz'

/** QR wifi standard : le téléphone rejoint le réseau en le scannant. */
function wifiQrValue(wifi: { ssid: string; pass: string }): string {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')
  return wifi.pass
    ? `WIFI:T:WPA;S:${esc(wifi.ssid)};P:${esc(wifi.pass)};;`
    : `WIFI:T:nopass;S:${esc(wifi.ssid)};;`
}

export function HostApp() {
  const s = useAppState()
  const [authed, setAuthed] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(isMuted)

  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get('key')
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

  // Dès qu'une question est à l'écran, tout le reste s'efface : sur un
  // vidéoprojecteur, ce qui compte doit occuper toute la place.
  const staging = !!quizView && quizView.phase !== 'pickPack'

  return (
    <div className={'host' + (staging ? ' staging' : '')}>
      <header className="host-header">
        <h1>
          🎉 Quizz Romane 30 {!s.connected && <span className="pill offline-pill">⚠️ reconnexion…</span>}
        </h1>
        <div className="join-info">
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
            <div className="players-grid">
              {snap.players.map(p => (
                <div key={p.id} className={'player-chip' + (p.connected ? '' : ' offline')}>
                  <span className="player-avatar">{p.avatar}</span>
                  <span className="player-name">{p.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card main-stage">
          {activeView && quizView ? (
            <QuizHost
              view={quizView}
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
              </div>
            </div>
          )}
        </section>

        {!staging && (
          <section className="card">
            <h2>Classement de la soirée</h2>
            <Leaderboard players={snap.players} />
          </section>
        )}
      </div>

      {s.toast && <div className={`toast toast-${s.toast.kind}`}>{s.toast.message}</div>}
    </div>
  )
}
