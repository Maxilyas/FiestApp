import { useEffect, useState, type FormEvent } from 'react'
import { joinAsPlayer, sendPlayerAction, setMyTeam, socket, watchParty } from '../socket'
import { getState, loadProfile, saveMe, saveProfile, showToast, useAppState } from '../state'
import { currentSlug } from '../routes'
import { Leaderboard } from '../components/Leaderboard'
import { TeamBoard } from '../components/TeamBoard'
import { TeamPicker } from '../components/TeamPicker'
import { Icon } from '../components/Icon'
import { JoinHead } from '../components/Invitation'
import { ProfilForm } from '../components/ProfilForm'
import type { PublicProfile } from '../../../shared/profil'
import { QuizPlayer } from '../games/quiz/PlayerView'
import type { QuizPlayerView } from '../../../shared/games/quiz'
import { AVATARS } from '../../../shared/avatars'
import { ordinal } from '../format'
import { Avatar } from '../components/Avatar'
import { Niveau } from '../components/Niveau'

export function PlayerApp() {
  const s = useAppState()
  /** L'espace de la soirée : le nom dans l'adresse, celui que le QR a donné. */
  const slug = currentSlug() ?? ''
  const [name, setName] = useState('')
  // Tiré au sort : avec un avatar imposé, tous ceux qui ne touchent à rien
  // arrivent identiques sur l'écran commun.
  const [avatar, setAvatar] = useState(() => AVATARS[Math.floor(Math.random() * AVATARS.length)])
  // Inscription en deux écrans : le prénom et l'avatar, puis l'équipe. Tout
  // sur une seule page obligerait à faire défiler pour trouver le bouton.
  const [step, setStep] = useState<'me' | 'team' | 'profil'>('me')
  /** Le profil connecté sur ce téléphone, s'il y en a un. */
  const [profil, setProfil] = useState<PublicProfile | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  /** Salle d'attente : le panneau « changer d'équipe » est-il ouvert ? */
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  /** Le serveur ne connaît pas cette adresse : rien à rejoindre ici. */
  const [spaceError, setSpaceError] = useState('')

  // Connexion, présentation à la soirée, puis re-join automatique (refresh,
  // coupure réseau, redémarrage serveur).
  useEffect(() => {
    socket.connect()
    const present = async () => {
      const watched = await watchParty(slug)
      if (!watched.ok) return setSpaceError(watched.error ?? 'Cette adresse ne mène à aucune soirée')
      setSpaceError('')
      // Le serveur reconnaît le profil au cookie posé dans la poignée de main :
      // l'écran d'inscription peut saluer avant même qu'on rejoigne.
      setProfil(watched.profile ?? null)
      const profile = loadProfile(slug)
      if (!profile) return
      // Sans équipe transmise, le serveur conserve celle déjà choisie.
      const ack = await joinAsPlayer(slug, profile.name, profile.avatar, getState().me?.token)
      if (ack.ok) saveMe(slug, { playerId: ack.playerId, token: ack.token })
    }
    if (socket.connected) present()
    socket.on('connect', present)
    return () => {
      socket.off('connect', present)
    }
  }, [slug])

  const space = s.snapshot?.space
  useEffect(() => {
    if (space) document.title = space.title
  }, [space])

  // Un profil connecté propose son prénom et son emoji — il ne les impose
  // pas : on peut très bien vouloir s'appeler autrement ce soir.
  useEffect(() => {
    if (!profil) return
    setName(n => n || profil.name)
    setAvatar(profil.avatar)
  }, [profil])

  /**
   * Après une connexion, la session du profil arrive dans un cookie — mais la
   * poignée de main du socket, elle, est déjà passée. On rouvre la connexion
   * pour que le serveur voie enfin qui est là.
   */
  const profilConnecte = (p: PublicProfile) => {
    setProfil(p)
    setStep('me')
    socket.disconnect()
    socket.connect()
  }

  const doJoin = async (chosenTeam: string | null) => {
    setBusy(true)
    setError('')
    const ack = await joinAsPlayer(slug, name, avatar, undefined, chosenTeam)
    setBusy(false)
    if (!ack.ok) {
      setStep('me')
      return setError(ack.error)
    }
    saveProfile(slug, { name: name.trim(), avatar })
    saveMe(slug, { playerId: ack.playerId, token: ack.token })
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

  if (spaceError) {
    return (
      <div className="join">
        <div className="join-grow" />
        <JoinHead eyebrow="Le quiz de la soirée" title="Hmm…" compact sub={spaceError} />
        <p className="muted small center">
          Vérifie l'adresse avec ton hôte, ou scanne à nouveau le QR de l'écran.
        </p>
        <div className="join-grow" />
        <a className="btn btn-block" href="/">
          Chercher la soirée
        </a>
      </div>
    )
  }

  // Le premier instantané dit comment la soirée s'appelle : on ne montre
  // pas un formulaire sans titre pendant les quelques dizaines de ms qu'il met.
  if (!snap) {
    return (
      <div className="center-page">
        <p className="serif-note">Connexion…</p>
      </div>
    )
  }

  // Le profil se consulte à tout moment — avant de rejoindre comme entre deux
  // quiz. C'est pour ça que cet écran vient avant la bifurcation : depuis la
  // salle d'attente, on ne doit pas avoir à quitter la soirée pour s'inscrire.
  if (step === 'profil') {
    return (
      <>
        <ProfilForm
          prefill={{ name: name.trim() || me?.name || profil?.name || '', avatar }}
          onDone={profilConnecte}
          onCancel={() => setStep('me')}
        />
        {toast}
      </>
    )
  }

  // ── Écran d'inscription ──────────────────────────
  if (!s.me) {
    const count = snap.players.filter(p => p.connected).length

    // Deuxième écran : l'équipe. Il n'apparaît que si l'animateur en a créé.
    if (step === 'team') {
      return (
        <>
          <div className="join">
            <JoinHead
              eyebrow="Le quiz de la soirée"
              title="Ton équipe"
              compact
              sub="Tes points restent les tiens — ils comptent aussi pour ton équipe."
            />
            <hr className="hairline" />
            <TeamPicker teams={teams} value={teamId} onPick={setTeamId} disabled={busy} />
            {error && <p className="error">{error}</p>}
            <div className="join-grow" />
            <div className="join-actions">
              <button
                className="btn btn-primary btn-big btn-block"
                disabled={busy || !teamId}
                onClick={() => doJoin(teamId)}
              >
                {teamId ? 'Rejoindre la soirée' : 'Choisis ton équipe'}
              </button>
              <button className="btn btn-ghost" onClick={() => setStep('me')}>
                Revenir
              </button>
            </div>
          </div>
          {toast}
        </>
      )
    }

    // À cinquante invités, deux Camille sont probables : mieux vaut le dire
    // avant que le classement affiche deux lignes identiques.
    const sansAccent = (t: string) =>
      t.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    const homonyme = name.trim() && snap.players.some(p => sansAccent(p.name) === sansAccent(name))
    const next = (e: FormEvent) => {
      e.preventDefault()
      setError('')
      // Pas d'équipe créée : l'écran suivant n'aurait rien à montrer.
      if (teams.length === 0) return doJoin(null)
      setStep('team')
    }

    return (
      <>
        <form className="join" onSubmit={next}>
          <JoinHead
            eyebrow={snap.space.eyebrow}
            title={snap.space.headline}
            compact={snap.space.headline.length > 12}
            sub="Le quiz de la soirée"
          />
          {profil && (
            <p className="profil-salut">
              <Avatar avatar={profil.avatar} finition={profil.finition} eclat={profil.eclats.includes(profil.avatar)} />
              Content de te revoir, <strong>{profil.name}</strong>
              <Niveau niveau={profil.niveau} />
            </p>
          )}
          <hr className="hairline" />
          <div className="field">
            <label className="label" htmlFor="join-name">
              Ton prénom
            </label>
            <input
              id="join-name"
              className="input input-line"
              autoComplete="given-name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={24}
              autoFocus
            />
          </div>
          <div className="field">
            <div className="field-head">
              <span className="label" id="avatar-label">
                Ton avatar
              </span>
              {count > 0 && (
                <span className="muted small">
                  {count} invité·e·s déjà là
                </span>
              )}
            </div>
            <div className="emoji-grid" role="group" aria-labelledby="avatar-label">
              {AVATARS.map(a => (
                <button
                  type="button"
                  key={a}
                  className={'emoji-btn' + (a === avatar ? ' selected' : '')}
                  aria-pressed={a === avatar}
                  aria-label={`Avatar ${a}`}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          {homonyme && (
            <p className="warn">
              Il y a déjà un « {name.trim()} » — ajoute une initiale pour qu'on vous distingue.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <div className="join-grow" />
          <button className="btn btn-primary btn-big btn-block" disabled={busy || !name.trim()}>
            {teams.length > 0 ? 'Continuer' : 'Rejoindre la soirée'}
          </button>
          {/* Une porte, pas un péage : le chemin anonyme reste le premier, et
              il ne coûte toujours qu'un geste. */}
          <p className="join-foot">
            Rien à installer · ton prénom suffit ·{' '}
            {profil ? (
              <button type="button" className="link-inline" onClick={() => setStep('profil')}>
                changer de profil
              </button>
            ) : (
              <button type="button" className="link-inline" onClick={() => setStep('profil')}>
                j'ai un profil
              </button>
            )}
          </p>
        </form>
        {toast}
      </>
    )
  }

  if (sessionView && iAmIn) {
    return (
      // Région « vivante » : un lecteur d'écran annonce la question, puis le
      // résultat, sans qu'on ait à parcourir la page à chaque changement.
      <div className="player-shell" aria-live="polite">
        <QuizPlayer
          view={sessionView.view as QuizPlayerView}
          teams={teams}
          myTeamId={me?.teamId ?? null}
          // Le jeton est relu au moment de l'envoi : celui du rendu pourrait
          // dater d'avant une reconnexion.
          send={action => {
            sendPlayerAction(sessionView.sessionId, action, slug, getState().me?.token).then(res => {
              // Une réponse refusée se disait jusqu'ici en silence : le
              // téléphone vibrait sous le doigt et rien ne suivait.
              if (!res.ok) showToast({ kind: 'error', message: res.error })
            })
          }}
        />
        {toast}
      </div>
    )
  }

  // ── Salle d'attente ──────────────────────────────
  const myTeam = teams.find(t => t.id === me?.teamId) ?? null
  const sorted = [...snap.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))
  // Rang partagé, comme dans le classement en dessous : à égalité de points,
  // on est premier ensemble, pas quatrième parce que son prénom vient après.
  const myRank = me ? sorted.findIndex(p => p.score === me.score) + 1 : 0

  return (
    <div className="player-shell">
      <header className="me-header">
        <Avatar className="player-avatar big" avatar={me?.avatar ?? ''} finition={me?.finition} eclat={me?.eclat} />
        <div>
          <h2>
            {me?.name}
            <Niveau niveau={me?.niveau} big />
          </h2>
          <p className="muted">
            {me?.score ?? 0} pts{myRank > 0 && ` · ${ordinal(myRank)}`}
            {myTeam && ` · ${myTeam.emoji} ${myTeam.name}`}
          </p>
        </div>
        {!s.connected && (
          <span className="pill offline-pill">
            <Icon name="alert" /> reconnexion…
          </span>
        )}
      </header>

      {session && !iAmIn && (
        <div className="card notice">Un quiz est en cours — tu entres à la prochaine question.</div>
      )}

      {teams.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>
              <Icon name="users" />
              Les équipes
            </h3>
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
        <h3>
          <Icon name="trophy" />
          Classement de la soirée
        </h3>
        <Leaderboard players={snap.players} compact highlightId={s.me.playerId} />
      </div>

      <p className="waiting">En attente du prochain quiz…</p>
      {/* Entre deux quiz, c'est le moment où l'on regarde son téléphone. */}
      <p className="join-foot">
        {profil ? (
          <a className="link-inline" href="/profil">
            Mon profil · niveau {profil.niveau}
          </a>
        ) : (
          <button type="button" className="link-inline" onClick={() => setStep('profil')}>
            Gagner des niveaux : créer un profil
          </button>
        )}
      </p>
      {toast}
    </div>
  )
}
