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
  /** Un titre en plusieurs mots : moins grand qu'un seul prénom. */
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
      {/* Celui qui a rattaché son profil n'a plus qu'un mot de passe, et ce
          n'est pas celui-ci : l'écrire ici lui évite de réveiller
          l'administrateur pour un lien dont il n'a pas besoin. Au-dessus du
          bouton : en dessous, le clavier ouvert la cachait. */}
      <p className="join-foot">
        Tu as rattaché ton profil ? <a href="/">Connecte-toi depuis l'accueil</a>. Sinon, mot de passe
        oublié : demande un nouveau lien d'activation à l'administrateur.
      </p>
      <div className="join-grow" />
      <button className="btn btn-primary btn-big btn-block" disabled={busy}>
        Entrer
      </button>
    </form>
  )
}
