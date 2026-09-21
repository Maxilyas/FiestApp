import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { JoinHead } from '../components/Invitation'

/**
 * L'activation d'un compte (`/activer#t=…`) : l'ami suit le lien envoyé par
 * l'administrateur et choisit son mot de passe. Le jeton est dans le
 * fragment de l'adresse — jamais envoyé au serveur avec la page, jamais dans
 * ses journaux — et il est retiré de la barre d'adresse aussitôt lu.
 */
export function ActivateApp() {
  const [token] = useState(() => {
    const t = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('t') ?? ''
    if (t) window.history.replaceState({}, '', window.location.pathname)
    return t
  })
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) setError('Ce lien est incomplet : demande-en un nouveau à l’administrateur.')
  }, [token])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !token) return
    if (password !== again) return setError('Les deux mots de passe ne sont pas identiques')
    setBusy(true)
    setError('')
    try {
      await api.auth.activate(token, password)
      window.location.assign('/compte')
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <form className="join" onSubmit={submit}>
      <JoinHead eyebrow="Espace animateur" title="Bienvenue" compact sub="Choisis ton mot de passe : c'est lui qui ouvrira ton espace." />
      <hr className="hairline" />
      <div className="field">
        <label className="label" htmlFor="password">
          Mot de passe (8 caractères au moins)
        </label>
        <input
          id="password"
          className="input input-line"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="again">
          Le même, une seconde fois
        </label>
        <input
          id="again"
          className="input input-line"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={e => setAgain(e.target.value)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="join-grow" />
      <button className="btn btn-primary btn-big btn-block" disabled={busy || !token}>
        Activer mon compte
      </button>
    </form>
  )
}
