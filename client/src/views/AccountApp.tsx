import { useEffect, useState, type FormEvent } from 'react'
import { api, UnauthorizedError, type Me } from '../api'
import { Icon } from '../components/Icon'
import { showToast, useAppState } from '../state'
import type { SpaceSettings } from '../../../shared/space'

/**
 * « Mon compte » (`/compte`) : qui je suis, l'adresse que scannent mes
 * invités, les réglages de ma soirée, mon mot de passe, et la sortie.
 */
export function AccountApp() {
  const { toast } = useAppState()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.auth
      .me()
      .then(setMe)
      .catch(e => {
        if (e instanceof UnauthorizedError) window.location.replace('/connexion?next=/compte')
        else setError((e as Error).message)
      })
  }, [])

  if (error) {
    return (
      <div className="center-page">
        <p className="error">{error}</p>
      </div>
    )
  }
  if (!me) {
    return (
      <div className="center-page">
        <p className="serif-note">Chargement…</p>
      </div>
    )
  }

  const guestUrl = `${window.location.origin}/${me.space.slug}`

  return (
    <div className="recap account">
      <header className="recap-header">
        <span className="label">Espace animateur</span>
        <h1>{me.account.name}</h1>
        <p className="muted">
          Identifiant <strong>{me.account.login}</strong>
          {me.account.role === 'admin' && ' · administrateur'}
        </p>
        <hr className="hairline" />
      </header>

      <nav className="row bilan-tabs">
        <a className="btn" href="/host">
          <Icon name="monitor" />
          Écran commun
        </a>
        <a className="btn" href="/edit">
          <Icon name="edit" />
          Mes quiz
        </a>
        <a className="btn" href={`/${me.space.slug}/soirees`}>
          <Icon name="book" />
          Mes soirées
        </a>
        {me.account.role === 'admin' && (
          <a className="btn btn-accent" href="/admin">
            <Icon name="users" />
            Les comptes
          </a>
        )}
      </nav>

      <section className="card">
        <h2>L'adresse de mes invités</h2>
        <p className="muted small">
          C'est elle que montre le QR de l'écran commun, et qu'on peut aussi dicter ou écrire sur une affiche.
        </p>
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
      </section>

      <SettingsForm me={me} onSaved={space => setMe({ ...me, space })} />
      <PasswordForm />

      <section className="card">
        <h2>Se déconnecter</h2>
        <p className="muted small">Sur cet appareil seulement. L'écran commun ouvert avec cette session se fermera.</p>
        <button
          className="btn"
          onClick={() =>
            api.auth
              .logout()
              .catch(() => {})
              .then(() => window.location.assign('/connexion'))
          }
        >
          <Icon name="x" />
          Me déconnecter
        </button>
      </section>

      {toast && <div className={`toast toast-${toast.kind}`}>{toast.message}</div>}
    </div>
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
    <form className="card settings-form" onSubmit={submit}>
      <h2>Ma soirée</h2>
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
            placeholder="19 septembre 2026"
            value={form.dateLine}
            onChange={e => set('dateLine', e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label" htmlFor="maxPlayers">
            Invités au plus
          </label>
          <input
            id="maxPlayers"
            className="input"
            type="number"
            min={2}
            max={500}
            value={form.maxPlayers}
            onChange={e => set('maxPlayers', Number(e.target.value))}
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
    <form className="card settings-form" onSubmit={submit}>
      <h2>Changer de mot de passe</h2>
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
