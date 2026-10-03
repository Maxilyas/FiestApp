import { useEffect, useState, type FormEvent } from 'react'
import { chargerDessinsAuPlus, sortesDesAvatars } from '../components/medaillons'
import { api, ouvrirParLeProfil, UnauthorizedError, type Me } from '../api'
import { Icon, type IconName } from '../components/Icon'
import { Feuille, MenuBarre } from '../components/Pieces'
import { ChangerMotDePasse } from '../components/ChangerMotDePasse'
import { NavAnimateur } from '../components/NavAnimateur'
import { ChampNombre } from '../components/ChampNombre'
import { showToast, useAppState } from '../state'
import type { SpaceSettings } from '../../../shared/space'
import { brilleChez, type ProfilDeLEspace } from '../../../shared/profil'
import { Avatar } from '../components/Avatar'
import { cibleEclat } from '../../../shared/legendaires'
import { Niveau } from '../components/Niveau'

type FeuilleDuCompte = 'affiche' | 'mdp' | 'profil'

/**
 * « Compte » (`/compte`) : ce qui me concerne sans être du jeu, en peu de
 * mots. Mon salon en tête, puis des lignes qui disent leur état — l'affiche,
 * le mot de passe, le profil rattaché —, chacune ouvrant sa feuille ;
 * l'administration à part, pour l'administrateur seul ; la sortie en bas.
 */
export function AccountApp() {
  const { toast } = useAppState()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')
  /** Tant que la bibliothèque est vide, la page dit par où commencer. */
  const [debut, setDebut] = useState(false)
  /** La feuille ouverte : chaque ligne règle une chose, dans la sienne. */
  const [feuille, setFeuille] = useState<FeuilleDuCompte | null>(null)

  useEffect(() => {
    api
      .list()
      // Un quiz commencé puis laissé vide ne se joue pas : on n'a pas
      // encore commencé.
      .then(l => setDebut(l.every(q => q.readyCount === 0)))
      .catch(() => {})
    api.auth
      .me()
      // Un profil rattaché qui porte un médaillon l'attend sous le
      // « Chargement… » : son emoji ne précède pas son dessin, ni sa finition
      // sa lumière — deux secondes et demie au plus, une requête muette n'y
      // garde personne.
      .then(async m => {
        await chargerDessinsAuPlus(sortesDesAvatars(m.profil ? [m.profil] : []))
        setMe(m)
      })
      .catch(e => {
        if (!(e instanceof UnauthorizedError)) return setError((e as Error).message)
        // Un profil a son compte sans compte d'animateur : la console
        // s'ouvre par lui, et la page se relit — une fois : un cookie refusé
        // la relirait sans fin. Sans profil, la connexion.
        const dejaEssaye = new URLSearchParams(window.location.search).has('par-profil')
        void (dejaEssaye ? Promise.resolve(false) : ouvrirParLeProfil().catch(() => false)).then(ouverte =>
          window.location.replace(ouverte ? '/compte?par-profil=1' : '/connexion?next=/compte'),
        )
      })
  }, [])

  if (error) {
    // Une phrase seule était une impasse : l'accueil, au moins (lot 12).
    return (
      <main className="center-page">
        <div className="impasse">
          <p className="error">{error}</p>
          <a className="btn btn-ghost" href="/">
            <Icon name="home" />
            L’accueil
          </a>
        </div>
      </main>
    )
  }
  if (!me) {
    return (
      <main className="center-page">
        <p className="serif-note">Chargement…</p>
      </main>
    )
  }

  const guestUrl = `${window.location.origin}/${me.space.slug}`
  /**
   * L'espace d'un profil, créé par « Créer un salon » : son compte n'a pas
   * de mot de passe — le profil est sa seule porte — et son identifiant ne
   * se tape jamais. La page parle donc du profil : son identifiant, son mot
   * de passe, son code de secours, et le salon qu'il ouvre.
   */
  const parLeProfil = me.account.status === 'pending' && !!me.profil

  /** Une ligne de la liste : ce qu'elle règle, son état en clair ; elle ouvre sa feuille, ou mène à sa page. */
  const ligne = (icone: IconName, nom: string, valeur: string, quoi: FeuilleDuCompte | string) => {
    const corps = (
      <>
        <span className="style-icone">
          <Icon name={icone} />
        </span>
        <span className="style-nom">{nom}</span>
        <span className="style-valeur">{valeur}</span>
        <Icon name="chevron-down" className="style-chevron" />
      </>
    )
    return (
      <li key={nom}>
        {quoi.startsWith('/') ? (
          <a href={quoi}>{corps}</a>
        ) : (
          <button type="button" onClick={() => setFeuille(quoi as FeuilleDuCompte)}>
            {corps}
          </button>
        )}
      </li>
    )
  }
  const fermer = () => setFeuille(null)

  return (
    <div className="player-shell compte">
      {/* « Compte » et l'identifiant sur une ligne : le reste se lit en lignes qui disent leur état. */}
      <header className="compte-tete">
        <h1>Compte</h1>
        <span className="compte-id">
          <Icon name="lock" />
          <span className="sr-only">Identifiant </span>
          <strong>{parLeProfil ? me.profil!.login : me.account.login}</strong>
        </span>
      </header>

      {/* Un animateur sans profil n'a pas d'accueil à lui : sa barre garde l'écran commun et l'historique. */}
      {!me.profil && <NavAnimateur ici="compte" slug={me.space.slug} admin={me.account.role === 'admin'} />}
      <main className="page-corps">
      {debut && (
        <section className="card premiers-pas">
          <h2>Par où commencer</h2>
          <ol className="premiers-pas-etapes">
            <li>
              <a className="link-inline" href="/edit">
                Mes quiz
              </a>{' '}
              : pars d'un quiz tout fait, importe celui d'un ami, ou écris le tien.
            </li>
            <li>Ouvre l'écran commun sur l'ordinateur branché à la télé.</li>
            <li>Tes invités scannent le QR qu'il affiche, et c'est parti.</li>
          </ol>
        </section>
      )}

      <section className="salon-hud">
        <span className="salon-hud-label">Mon salon</span>
        {parLeProfil ? (
          // Plus d'adresse à copier : chaque salon reçoit son code à l'ouverture.
          <>
            <p className="salon-hud-texte">Rien à retenir : chaque salon reçoit un code de six chiffres en s’ouvrant, que tes invités tapent ou scannent.</p>
            <a className="salon-geste" href="/salon">
              <Icon name="plus" />
              Créer un salon
            </a>
          </>
        ) : (
          <>
            <p className="salon-hud-texte">L’adresse de tes invités : c’est elle que montre le QR de l’écran commun, et qu’on peut dicter ou écrire sur une affiche.</p>
            <div className="link-box">
              <code>{guestUrl}</code>
              <button
                className="btn btn-small"
                onClick={() =>
                  navigator.clipboard
                    .writeText(guestUrl)
                    .then(() => showToast({ kind: 'info', message: 'Adresse copiée' }))
                    .catch(() => showToast({ kind: 'error', message: 'Copie impossible ici : sélectionne l’adresse' }))
                }
              >
                <Icon name="clipboard" />
                Copier
              </button>
            </div>
          </>
        )}
      </section>

      <ul className="style-liste">
        {ligne('edit', 'L’affiche', me.space.title, 'affiche')}
        {ligne('lock', 'Mot de passe', '••••••••', 'mdp')}
        {!parLeProfil && ligne('users', 'Mon profil joueur', me.profil?.name ?? 'À rattacher', 'profil')}
        {me.profil && !parLeProfil && ligne('monitor', 'L’écran commun', '', '/host')}
        {me.profil && !parLeProfil && ligne('book', 'L’historique', '', `/${me.space.slug}/soirees`)}
      </ul>

      {me.account.role === 'admin' && (
        <>
          <h2 className="compte-groupe">
            Administration <span className="etiquette">Toi seul</span>
          </h2>
          <ul className="style-liste">{ligne('sparkles', 'Les comptes et les profils', '', '/admin')}</ul>
        </>
      )}

      <button
        type="button"
        className="compte-sortie"
        onClick={() =>
          // Un profil se déconnecte de son profil : sa console se referme avec lui (invariant 16).
          (parLeProfil ? api.joueur.deconnexion() : api.auth.logout())
            .catch(() => {})
            .then(() => window.location.assign(parLeProfil ? '/' : '/connexion'))
        }
      >
        <Icon name="arrow-left" />
        Me déconnecter
      </button>
      <p className="muted small center">Sur cet appareil seulement. L’écran commun ouvert avec cette session se fermera.</p>

      {feuille === 'affiche' && (
        <Feuille titre="L’affiche de ma soirée" onFermer={fermer}>
          <SettingsForm me={me} onSaved={space => setMe({ ...me, space })} />
        </Feuille>
      )}
      {feuille === 'mdp' && (
        <Feuille titre={parLeProfil ? 'Mot de passe' : 'Le mot de passe du compte'} onFermer={fermer}>
          {parLeProfil ? <ChangerMotDePasse login={me.profil!.login} /> : <PasswordForm />}
        </Feuille>
      )}
      {feuille === 'profil' && (
        <Feuille titre="Mon profil joueur" onFermer={fermer}>
          <ProfilLie profil={me.profil ?? null} onChange={profil => setMe({ ...me, profil })} />
        </Feuille>
      )}

      {toast && <div className={`toast toast-${toast.kind}`}>{toast.message}</div>}
      </main>
      <MenuBarre ici="compte" />
    </div>
  )
}

/**
 * Rattacher son profil joueur à son espace.
 *
 * Un animateur est d'abord quelqu'un qui joue : il n'a aucune raison de
 * tenir deux identités, ni deux mots de passe. Une fois rattaché, son profil
 * ouvre la console tout seul depuis l'accueil — et il garde son niveau quand
 * il joue à sa propre soirée, comme chez les autres.
 *
 * Il faut prouver les deux identités pour les lier : cette session-ci d'un
 * côté, l'identifiant et le mot de passe du profil de l'autre. Après quoi
 * une seule des deux portes suffit ; cette première fois-là, non. Le profil
 * déjà ouvert sur ce navigateur ne redemande que son mot de passe — il
 * fallait retaper l'identifiant qu'on venait de choisir (l'arbitrage du 27
 * septembre 2026) ; un autre profil garde les deux champs.
 */
function ProfilLie({ profil, onChange }: { profil: ProfilDeLEspace | null; onChange: (p: ProfilDeLEspace | null) => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** Le profil ouvert sur ce navigateur, s'il y en a un : on ne lui redemande pas son identifiant. */
  const [ouvert, setOuvert] = useState<{ name: string; login: string } | null>(null)
  const [unAutre, setUnAutre] = useState(false)
  useEffect(() => {
    if (profil) return
    let vivant = true
    api.joueur
      .moi()
      .then(r => vivant && setOuvert(r.profile ? { name: r.profile.name, login: r.profile.login } : null))
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [profil])
  const parLeProfilOuvert = !!ouvert && !unAutre
  /**
   * Détacher demande une preuve fraîche : le mot de passe du profil, ou celui
   * du compte. Une session ne suffisait pas — le téléphone prêté, console
   * ouverte par le profil, détachait l'animateur et rattachait l'emprunteur.
   */
  const [detacher, setDetacher] = useState(false)
  const [preuve, setPreuve] = useState('')

  const lier = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      // Sans identifiant, le serveur prend celui du profil ouvert ici.
      const { profil: lie } = await api.space.lierProfil(parLeProfilOuvert ? '' : login.trim(), password)
      setLogin('')
      setPassword('')
      onChange(lie)
      showToast({ kind: 'info', message: `Profil ${lie.name} rattaché` })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (profil) {
    return (
      <section className="feuille-section">
        <div className="row profil-lie">
          <Avatar avatar={profil.avatar} finition={profil.finition} eclat={brilleChez(profil, cibleEclat(profil.legendaire, profil.avatar))} legendaire={profil.legendaire ?? undefined} />
          <div>
            <strong>{profil.name}</strong>
            <Niveau niveau={profil.niveau} />
            <p className="muted small">
              Identifiant <strong>{profil.login}</strong> — il ouvre cette console depuis l'accueil.
            </p>
          </div>
        </div>
        {detacher ? (
          <form
            className="detacher-profil"
            onSubmit={async e => {
              e.preventDefault()
              setBusy(true)
              setError('')
              try {
                await api.space.detacherProfil(preuve)
                setPreuve('')
                setDetacher(false)
                onChange(null)
              } catch (err) {
                setError((err as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            <div className="field">
              <label className="label" htmlFor="detacher-preuve">
                Le mot de passe de ce profil — ou celui du compte
              </label>
              <input
                id="detacher-preuve"
                className="input input-line"
                type="password"
                value={preuve}
                onChange={e => setPreuve(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="row">
              <button className="btn btn-small" disabled={busy || !preuve}>
                Détacher
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => {
                  setDetacher(false)
                  setPreuve('')
                  setError('')
                }}
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => setDetacher(true)}>
            Détacher ce profil
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </section>
    )
  }

  return (
    <form className="feuille-section" onSubmit={lier}>
      <p className="muted small">
        Rattache le profil avec lequel tu joues : il ouvrira cette console depuis l'accueil, et tu
        n'auras plus qu'un mot de passe à retenir. Si tu n'en as pas encore,{' '}
        {/* La création, pas la connexion : « crée-le » ouvrait « Me connecter ». Et l'accueil y ramène ici. */}
        <a className="link-inline" href="/?creer=1&next=/compte">
          crée-le depuis l'accueil
        </a>
        .
      </p>
      {parLeProfilOuvert ? (
        <p className="profil-ouvert">
          Le profil ouvert ici : <strong>{ouvert!.name}</strong> ({ouvert!.login}).{' '}
          <button type="button" className="link-inline" onClick={() => setUnAutre(true)}>
            Un autre profil ?
          </button>
        </p>
      ) : (
        <div className="field">
          <label className="label" htmlFor="lien-login">
            Identifiant du profil
          </label>
          <input
            id="lien-login"
            className="input input-line"
            value={login}
            onChange={e => setLogin(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            maxLength={32}
          />
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="lien-pass">
          {parLeProfilOuvert ? 'Son mot de passe, pour confirmer' : 'Son mot de passe'}
        </label>
        <input
          id="lien-pass"
          className="input input-line"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" disabled={busy || (!parLeProfilOuvert && !login.trim()) || !password}>
        {parLeProfilOuvert ? `Rattacher ${ouvert!.name}` : 'Rattacher'}
      </button>
    </form>
  )
}

/** Les réglages de la soirée : ce que voient les invités à l'inscription et sur les pages. */
function SettingsForm({ me, onSaved }: { me: Me; onSaved: (space: Me['space']) => void }) {
  const [form, setForm] = useState<SpaceSettings>({
    title: me.space.title,
    eyebrow: me.space.eyebrow,
    headline: me.space.headline,
    dateLine: me.space.dateLine,
    maxPlayers: me.space.maxPlayers,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof SpaceSettings, value: string | number) => setForm(f => ({ ...f, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { space } = await api.space.saveSettings(form)
      onSaved(space)
      showToast({ kind: 'info', message: 'Réglages enregistrés' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="settings-form" onSubmit={submit}>
      <p className="muted small">
        Le titre s'affiche sur l'écran commun, le souvenir et le bilan ; le surtitre et le grand titre, à
        l'inscription des invités.
      </p>
      <div className="field">
        <label className="label" htmlFor="title">
          Titre
        </label>
        <input id="title" className="input" maxLength={80} value={form.title} onChange={e => set('title', e.target.value)} />
      </div>
      <div className="settings-grid">
        <div className="field">
          <label className="label" htmlFor="eyebrow">
            Surtitre
          </label>
          <input id="eyebrow" className="input" maxLength={60} value={form.eyebrow} onChange={e => set('eyebrow', e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="headline">
            Grand titre
          </label>
          <input id="headline" className="input" maxLength={40} value={form.headline} onChange={e => set('headline', e.target.value)} />
        </div>
      </div>
      <div className="settings-grid">
        <div className="field">
          <label className="label" htmlFor="dateLine">
            Date, telle qu'on l'écrit
          </label>
          <input
            id="dateLine"
            className="input"
            maxLength={60}
            placeholder="samedi 14 mars"
            value={form.dateLine}
            onChange={e => set('dateLine', e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="maxPlayers">
            Invités au plus
          </label>
          <ChampNombre
            id="maxPlayers"
            min={2}
            max={500}
            valeur={form.maxPlayers}
            onValeur={n => set('maxPlayers', n)}
          />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" disabled={busy}>
          Enregistrer
        </button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== again) return setError('Les deux nouveaux mots de passe ne sont pas identiques')
    setBusy(true)
    setError('')
    try {
      await api.auth.changePassword(current, next)
      setCurrent('')
      setNext('')
      setAgain('')
      showToast({ kind: 'info', message: 'Mot de passe changé — les autres appareils sont déconnectés' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="settings-form" onSubmit={submit}>
      {/* « du compte », au titre de la feuille : l'animateur qui joue aussi
          avec un profil a deux mots de passe, et changeait celui-ci en
          croyant changer l'autre. */}
      <p className="muted small">Celui de ton espace d'animateur — pas celui de ton profil joueur.</p>
      <div className="field">
        <label className="label" htmlFor="current">
          Mot de passe actuel
        </label>
        <input id="current" className="input" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
      </div>
      <div className="settings-grid">
        <div className="field">
          <label className="label" htmlFor="next">
            Nouveau (8 caractères au moins)
          </label>
          <input id="next" className="input" type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="again">
            Le même, une seconde fois
          </label>
          <input id="again" className="input" type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} />
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn" disabled={busy || !current || !next}>
          Changer
        </button>
      </div>
    </form>
  )
}
