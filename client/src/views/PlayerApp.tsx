import { useEffect, useState, type FormEvent } from 'react'
import { joinAsPlayer, setMyTeam, socket } from '../socket'
import { getState, loadProfile, saveMe, saveProfile, showToast, useAppState } from '../state'
import { Leaderboard } from '../components/Leaderboard'
import { TeamBoard } from '../components/TeamBoard'
import { TeamPicker } from '../components/TeamPicker'
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
  // Inscription en deux écrans : le prénom et l'avatar, puis l'équipe. Tout
  // sur une seule page obligerait à faire défiler pour trouver le bouton.
  const [step, setStep] = useState<'me' | 'team'>('me')
  const [teamId, setTeamId] = useState<string | null>(null)
  /** Salle d'attente : le panneau « changer d'équipe » est-il ouvert ? */
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Connexion + re-join automatique (refresh, coupure réseau, redémarrage serveur).
  useEffect(() => {
    socket.connect()
    const rejoin = async () => {
      const profile = loadProfile()
      if (!profile) return
      // Sans équipe transmise, le serveur conserve celle déjà choisie.
      const ack = await joinAsPlayer(profile.name, profile.avatar, getState().me?.token)
      if (ack.ok) saveMe({ playerId: ack.playerId, token: ack.token })
    }
    if (socket.connected) rejoin()
    socket.on('connect', rejoin)
    return () => {
      socket.off('connect', rejoin)
    }
  }, [])

  const doJoin = async (chosenTeam: string | null) => {
    setBusy(true)
    setError('')
    const ack = await joinAsPlayer(name, avatar, undefined, chosenTeam)
    setBusy(false)
    if (!ack.ok) {
      setStep('me')
      return setError(ack.error)
    }
    saveProfile({ name: name.trim(), avatar })
    saveMe({ playerId: ack.playerId, token: ack.token })
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

    // Deuxième écran : l'équipe. Il n'apparaît que si l'animateur en a créé.
    if (step === 'team') {
      return (
        <div className="center-page">
          <div className="card join-card">
            <h1>👥 Ton équipe</h1>
            <p className="muted">Tes points restent les tiens — ils comptent aussi pour ton équipe.</p>
            <TeamPicker teams={teams} value={teamId} onPick={setTeamId} disabled={busy} />
            {error && <p className="error">{error}</p>}
            <button
              className="btn btn-primary btn-big"
              disabled={busy || !teamId}
              onClick={() => doJoin(teamId)}
            >
              {teamId ? 'Rejoindre 🎊' : 'Choisis ton équipe'}
            </button>
            <button className="btn btn-ghost btn-small" onClick={() => setStep('me')}>
              ← Revenir
            </button>
          </div>
          {toast}
        </div>
      )
    }

    // À cinquante invités, deux Camille sont probables : mieux vaut le dire
    // avant que le classement affiche deux lignes identiques.
    const sansAccent = (t: string) =>
      t.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    const homonyme = name.trim() && s.snapshot?.players.some(p => sansAccent(p.name) === sansAccent(name))
    const next = (e: FormEvent) => {
      e.preventDefault()
      setError('')
      // Pas d'équipe créée : l'écran suivant n'aurait rien à montrer.
      if (teams.length === 0) return doJoin(null)
      setStep('team')
    }

    return (
      <div className="center-page">
        <form className="card join-card" onSubmit={next}>
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
            {teams.length > 0 ? 'Continuer →' : 'Rejoindre 🎊'}
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
          teams={teams}
          myTeamId={me?.teamId ?? null}
          send={action => socket.emit('player:action', { sessionId: sessionView.sessionId, action })}
        />
        {toast}
      </div>
    )
  }

  // ── Salle d'attente ──────────────────────────────
  const myTeam = teams.find(t => t.id === me?.teamId) ?? null
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
            {myTeam && ` · ${myTeam.emoji} ${myTeam.name}`}
          </p>
        </div>
        {!s.connected && <span className="pill offline-pill">reconnexion…</span>}
      </header>

      {session && !iAmIn && (
        <div className="card notice">Un quiz est en cours — tu entres à la prochaine question ! 🍿</div>
      )}

      {teams.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>Les équipes</h3>
            {/* Changer d'équipe emporte ses points : le serveur le refuse
                pendant un quiz, autant ne pas proposer le bouton. */}
            {!session && (
              <button className="btn btn-ghost btn-small" onClick={() => setSwitching(v => !v)}>
                {switching ? 'Annuler' : myTeam ? 'Changer' : 'Choisir mon équipe'}
              </button>
            )}
          </div>
          {switching ? (
            <TeamPicker teams={teams} value={me?.teamId ?? null} onPick={changeTeam} />
          ) : (
            <>
              <TeamBoard teams={teams} highlightId={me?.teamId ?? null} compact />
              <p className="muted small">
                Les équipes sont classées à la moyenne par membre : une petite équipe n'est pas
                pénalisée.
              </p>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3>Classement de la soirée</h3>
        <Leaderboard players={snap?.players ?? []} compact highlightId={s.me.playerId} />
      </div>

      <p className="waiting">🎊 En attente du prochain quiz…</p>
      {toast}
    </div>
  )
}
