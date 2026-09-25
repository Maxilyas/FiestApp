import { useState, type FormEvent } from 'react'
import { api } from '../api'
import type { PublicProfile } from '../../../shared/profil'
import { Icon } from './Icon'

/**
 * Le code de secours, à noter — il ne repassera jamais. Le même encart à
 * l'entrée d'une soirée, dans la salle d'attente et sur `/profil` : la salle
 * d'attente et le profil n'avaient pas de « Copier », l'entrée si.
 */
export function CodeSecours({ code }: { code: string }) {
  const [copie, setCopie] = useState(false)
  return (
    <div className="card notice">
      <p>
        <strong>C'est la seule façon de retrouver ton profil</strong> si tu oublies ton mot de
        passe — il n'y a pas d'adresse e-mail, donc pas de lien à recevoir.
      </p>
      <p className="code-secours">{code}</p>
      <p className="muted small">Il ne sera plus jamais affiché.</p>
      {/* Sans presse-papier — hors HTTPS, c'est-à-dire en wifi local, et
          dans certains navigateurs — le bouton ne faisait rien du tout.
          Absent, il ne promet rien : le code reste lisible à l'écran. */}
      {typeof navigator !== 'undefined' && navigator.clipboard && (
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            // Refusé quand même par certains navigateurs : ce n'est qu'un
            // confort.
            navigator.clipboard
              .writeText(code)
              .then(() => setCopie(true))
              .catch(() => {})
          }}
        >
          <Icon name={copie ? 'check' : 'copy'} />
          {copie ? 'Copié' : 'Copier'}
        </button>
      )}
    </div>
  )
}

interface Props {
  /** L'identifiant déjà tapé à l'entrée, s'il y en a un. */
  prefill?: string
  /** Rendu une fois le mot de passe changé et la session ouverte. */
  onDone: (profile: PublicProfile | null, recovery: string) => void
  onCancel: () => void
}

/**
 * Retrouver son profil avec le code de secours.
 *
 * C'est la seule porte de retour : il n'y a pas d'adresse e-mail dans cette
 * application, donc pas de lien à recevoir. Tant que la connexion n'était
 * qu'une option discrète, l'absence de cet écran se tolérait ; depuis qu'elle
 * est le premier écran, un mot de passe oublié ne peut plus être une impasse.
 *
 * Partagé entre l'entrée et la page profil — c'est là qu'on le cherche.
 */
export function FormulaireSecours({ prefill, onDone, onCancel }: Props) {
  const [login, setLogin] = useState(prefill ?? '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErreur('')
    try {
      const res = await api.joueur.secours(login.trim(), code.trim(), password)
      // Le code se consomme et le serveur en rend un neuf : il faut le dire,
      // sinon celui noté sur un bout de papier resterait faux pour toujours.
      onDone(res.profile, res.recovery)
    } catch (e) {
      setErreur((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="join" onSubmit={submit}>
      <h2 className="center">Retrouver mon profil</h2>
      <p className="muted small center">
        Le code de secours t'a été donné le jour où tu as créé ton profil. Il ne sert qu'une fois —
        on t'en redonne un neuf juste après.
      </p>
      <hr className="hairline" />
      <div className="field">
        <label className="label" htmlFor="sec-login">
          Ton identifiant
        </label>
        <input
          id="sec-login"
          className="input input-line"
          value={login}
          onChange={e => setLogin(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="sec-code">
          Ton code de secours
        </label>
        <input
          id="sec-code"
          className="input input-line"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={24}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="sec-pass">
          Ton nouveau mot de passe
        </label>
        <input
          id="sec-pass"
          className="input input-line"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <span className="muted small">Au moins 8 caractères.</span>
      </div>
      {erreur && <p className="error">{erreur}</p>}
      <div className="join-grow" />
      <div className="join-actions">
        <button
          className="btn btn-primary btn-big btn-block"
          disabled={busy || !login.trim() || !code.trim() || !password}
        >
          Retrouver mon profil
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Revenir
        </button>
      </div>
      {/* Dire franchement qu'il n'y a pas d'autre porte vaut mieux que de
          laisser quelqu'un chercher : le chemin anonyme, lui, est resté ouvert. */}
      <p className="join-foot">
        Tu n'as plus le code ? Le profil ne se retrouve pas — tu peux jouer sans compte, ou en créer
        un neuf.
      </p>
    </form>
  )
}
