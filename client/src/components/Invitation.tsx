import type { FormEvent } from 'react'

/**
 * L'en-tête d'invitation : une ligne en capitales espacées, un titre serif
 * champagne, une phrase en italique. C'est le premier écran que voient les
 * invités — et celui que retrouve l'animateur devant sa clé.
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

/** La porte de l'espace animateur : une clé, rien d'autre. */
export function KeyForm({
  title,
  value,
  error,
  onChange,
  onSubmit,
}: {
  title: string
  value: string
  error?: string
  onChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
}) {
  return (
    <form className="join" onSubmit={onSubmit}>
      <JoinHead eyebrow="Quizz Romane 30" title={title} compact sub="Réservé à l'animateur" />
      <hr className="hairline" />
      <div className="field">
        <label className="label" htmlFor="host-key">
          Clé d'accès
        </label>
        <input
          id="host-key"
          className="input input-line"
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={e => onChange(e.target.value)}
          autoFocus
        />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="join-grow" />
      <button className="btn btn-primary btn-big btn-block">Entrer</button>
    </form>
  )
}
