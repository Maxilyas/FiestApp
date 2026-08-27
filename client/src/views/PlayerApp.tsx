import { useEffect, useState, type FormEvent } from 'react'
import { joinAsPlayer, socket } from '../socket'
import { getState, loadProfile, saveMe, saveProfile, useAppState } from '../state'
import { Leaderboard } from '../components/Leaderboard'
import { QuizPlayer } from '../games/quiz/PlayerView'
import type { QuizPlayerView } from '../../../shared/games/quiz'

const AVATARS = [
  '🦊', '🐸', '🦄', '🐙', '🐼', '🐯',
  '🦁', '🐨', '🐷', '🐶', '🐱', '🐵',
  '🦉', '🦖', '🍕', '🌮', '🍩', '🎸',
  '🚀', '⚽', '🎲', '👑', '🌵', '🍉',
]

export function PlayerApp() {
  const s = useAppState()
  const [name, setName] = useState('')
  // Tiré au sort : avec un avatar imposé, tous ceux qui ne touchent à rien
  // arrivent identiques sur l'écran commun.
  const [avatar, setAvatar] = useState(() => AVATARS[Math.floor(Math.random() * AVATARS.length)])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Connexion + re-join automatique (refresh, coupure réseau, redémarrage serveur).
  useEffect(() => {
    socket.connect()
    const rejoin = async () => {
      const profile = loadProfile()
      if (!profile) return
      const ack = await joinAsPlayer(profile.name, profile.avatar, getState().me?.token)
      if (ack.ok) saveMe({ playerId: ack.playerId, token: ack.token })
    }
    if (socket.connected) rejoin()
    socket.on('connect', rejoin)
    return () => {
      socket.off('connect', rejoin)
    }
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const ack = await joinAsPlayer(name, avatar)
    setBusy(false)
    if (!ack.ok) return setError(ack.error)
    saveProfile({ name: name.trim(), avatar })
    saveMe({ playerId: ack.playerId, token: ack.token })
  }

  // ── Quiz en cours (si j'y participe) ─────────────
  const snap = s.snapshot
  const session = snap?.session ?? null
  const sessionView = session ? s.views[session.id] : undefined
  const iAmIn = !!(s.me && session?.participantIds.includes(s.me.playerId))
  const playing = !!sessionView && iAmIn

  // Pendant un quiz, l'écran ne doit pas s'éteindre : un téléphone posé sur la
  // table pendant qu'on écoute la question rate la suivante.
  useEffect(() => {
    if (!playing) return
    let sentinel: { release: () => Promise<void> } | null = null
    let stopped = false
    const acquire = () => {
      const wakeLock = (navigator as any).wakeLock
      if (!wakeLock) return
      wakeLock
        .request('screen')
        .then((lock: any) => {
          if (stopped) lock.release()
          else sentinel = lock
        })
        .catch(() => {
          // Refusé (onglet en arrière-plan, navigateur sans la fonction) :
          // ce n'est qu'un confort, on continue sans.
        })
    }
    // Revenir sur l'onglet libère le verrou : il faut le redemander.
    const onVisible = () => document.visibilityState === 'visible' && acquire()
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [playing])

  const toast = s.toast && <div className={`toast toast-${s.toast.kind}`}>{s.toast.message}</div>

  // ── Écran d'inscription ──────────────────────────
  if (!s.me) {
    const count = s.snapshot?.players.filter(p => p.connected).length ?? 0
    // À cinquante invités, deux Camille sont probables : mieux vaut le dire
    // avant que le classement affiche deux lignes identiques.
    const sansAccent = (t: string) =>
      t.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    const homonyme = name.trim() && s.snapshot?.players.some(p => sansAccent(p.name) === sansAccent(name))
    return (
      <div className="center-page">
        <form className="card join-card" onSubmit={submit}>
          <h1>🎉 Quizz Romane 30</h1>
          {count > 0 && <p className="muted">{count} invité·e·s déjà là</p>}
          <input
            className="input"
            placeholder="Ton prénom"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={24}
            autoFocus
          />
          <div className="emoji-grid">
            {AVATARS.map(a => (
              <button
                type="button"
                key={a}
                className={'emoji-btn' + (a === avatar ? ' selected' : '')}
                onClick={() => setAvatar(a)}
              >
                {a}
              </button>
            ))}
          </div>
          {homonyme && (
            <p className="warn">
              Il y a déjà un « {name.trim()} » — ajoute une initiale pour qu'on vous distingue.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-big" disabled={busy || !name.trim()}>
            Rejoindre 🎊
          </button>
        </form>
        {toast}
      </div>
    )
  }

  if (sessionView && iAmIn) {
    return (
      <div className="player-shell">
        <QuizPlayer
          view={sessionView.view as QuizPlayerView}
          send={action => socket.emit('player:action', { sessionId: sessionView.sessionId, action })}
        />
        {toast}
      </div>
    )
  }

  // ── Salle d'attente ──────────────────────────────
  const me = snap?.players.find(p => p.id === s.me!.playerId)
  const sorted = [...(snap?.players ?? [])].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))
  const myRank = me ? sorted.findIndex(p => p.id === me.id) + 1 : 0

  return (
    <div className="player-shell">
      <header className="me-header">
        <span className="player-avatar big">{me?.avatar}</span>
        <div>
          <h2>{me?.name}</h2>
          <p className="muted">
            {me?.score ?? 0} pts{myRank > 0 && ` · ${myRank}ᵉ`}
          </p>
        </div>
        {!s.connected && <span className="pill offline-pill">reconnexion…</span>}
      </header>

      {session && !iAmIn && (
        <div className="card notice">Un quiz est en cours — tu entres à la prochaine question ! 🍿</div>
      )}

      <div className="card">
        <h3>Classement de la soirée</h3>
        <Leaderboard players={snap?.players ?? []} compact highlightId={s.me.playerId} />
      </div>

      <p className="waiting">🪩 En attente du prochain quiz…</p>
      {toast}
    </div>
  )
}
