import { useState, type FormEvent } from 'react'

/**
 * L'en-tête d'invitation : une ligne en capitales espacées, un titre serif
 * champagne, une phrase en italique. C'est le premier écran que voient les
 * invités — et celui que retrouve l'animateur devant la porte de son espace.
 */
export function JoinHead({
  eyebrow,
  title,
  sub,
  compact,
}: {
  eyebrow: string
  title: string
  sub?: string
  /** Un titre en plusieurs mots : moins grand que le seul prénom de Romane. */
  compact?: boolean
}) {
  return (
    <div className="join-head">
      <span className="join-eyebrow">{eyebrow}</span>
      <h1 className={'join-title' + (compact ? ' compact' : '')}>{title}</h1>
      {sub && <p className="join-sub">{sub}</p>}
    </div>
  )
}

/** La porte de l'espace animateur : un identifiant, un mot de passe. */
export function LoginForm({
  title,
  sub,
  error,
  busy,
  onSubmit,
}: {
  title: string
  sub?: string
  error?: string
  busy?: boolean
  onSubmit: (login: string, password: string) => void
}) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!busy) onSubmit(login.trim(), password)
  }
  return (
    <form className="join" onSubmit={submit}>
      <JoinHead eyebrow="Espace animateur" title={title} compact sub={sub ?? 'Réservé aux animateurs'} />
      <hr className="hairline" />
      <div className="field">
        <label className="label" htmlFor="login">
          Identifiant
        </label>
        <input
          id="login"
          className="input input-line"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={login}
          onChange={e => setLogin(e.target.value)}
          autoFocus
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="password">
          Mot de passe
        </label>
        <input
          id="password"
          className="input input-line"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="join-grow" />
      <button className="btn btn-primary btn-big btn-block" disabled={busy}>
        Entrer
      </button>
      <p className="join-foot">Mot de passe oublié ? Demande un nouveau lien d'activation à l'administrateur.</p>
    </form>
  )
}
