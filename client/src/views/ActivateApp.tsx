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
  /** Le compte qu'ouvre ce lien, lu avant de s'en servir. */
  const [compte, setCompte] = useState<{ login: string; slug: string; etat: 'valide' | 'servi' | 'perime' } | null>(null)

  useEffect(() => {
    if (!token) return setError('Ce lien est incomplet : demande-en un nouveau à l’administrateur.')
    api.auth
      .lireActivation(token)
      .then(setCompte)
      // Illisible (réseau, lien inconnu) : le formulaire reste, et c'est
      // l'activation qui dira ce qui ne va pas.
      .catch(() => {})
  }, [token])

  if (compte && compte.etat !== 'valide') {
    return (
      <div className="join">
        <JoinHead eyebrow="Espace animateur" title={compte.etat === 'servi' ? 'Déjà activé' : 'Lien expiré'} compact />
        <hr className="hairline" />
        <p className="center">
          {compte.etat === 'servi'
            ? <>Ce lien a déjà servi : ton compte <strong>{compte.login}</strong> est prêt. Connecte-toi.</>
            : 'Ce lien a expiré : demande-en un nouveau à l’administrateur.'}
        </p>
        <div className="join-grow" />
        {compte.etat === 'servi' && (
          <a className="btn btn-primary btn-big btn-block" href="/connexion?next=/compte">
            Me connecter
          </a>
        )}
      </div>
    )
  }

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
      {compte && (
        <p className="muted small center">
          Ton identifiant : <strong>{compte.login}</strong> · ta soirée : <code>{`${window.location.host}/${compte.slug}`}</code>
        </p>
      )}
      {/* L'identifiant, dans un champ que le gestionnaire de mots de passe
          lit : sans lui, il rangeait le mot de passe choisi sous aucun nom. */}
      <input type="text" name="username" autoComplete="username" value={compte?.login ?? ''} readOnly hidden />
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
