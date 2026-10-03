import { useState, type FormEvent } from 'react'
import { api, motifDe } from '../api'
import { CodeSecours } from './Secours'

/**
 * Relire son identifiant, changer son mot de passe. La route existait, pas
 * l'écran. Il faut l'actuel — ou le code de secours, qui se consomme et en
 * rend un neuf, à noter aussitôt. Les consoles que ce profil avait ouvertes
 * ailleurs se referment (invariant 16) : c'est le serveur qui s'en charge.
 */
export function ChangerMotDePasse({ login }: { login: string }) {
  const [parCode, setParCode] = useState(false)
  const [preuve, setPreuve] = useState('')
  const [suivant, setSuivant] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const [fait, setFait] = useState(false)
  const [code, setCode] = useState('')

  const envoyer = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErreur('')
    try {
      const res = await api.joueur.motDePasse(
        parCode ? { code: preuve.trim(), next: suivant } : { current: preuve, next: suivant },
      )
      setFait(true)
      setCode(res.recovery ?? '')
      setPreuve('')
      setSuivant('')
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p>
        Ton identifiant : <strong>{login}</strong>
      </p>
      {fait ? (
        <>
          <p className="info" role="status">
            Mot de passe changé. Tes autres appareils devront se reconnecter.
          </p>
          {code && (
            <>
              <p className="muted small">Ton code de secours a servi : voici le nouveau.</p>
              <CodeSecours code={code} />
            </>
          )}
        </>
      ) : (
        <form className="mdp-form" onSubmit={envoyer}>
          <div className="field">
            <label className="label" htmlFor="mdp-preuve">
              {parCode ? 'Ton code de secours' : 'Ton mot de passe actuel'}
            </label>
            <input
              id="mdp-preuve"
              className="input input-line"
              type={parCode ? 'text' : 'password'}
              value={preuve}
              onChange={e => setPreuve(e.target.value)}
              autoComplete={parCode ? 'off' : 'current-password'}
              autoCapitalize={parCode ? 'characters' : 'none'}
              spellCheck={false}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="mdp-suivant">
              Ton nouveau mot de passe
            </label>
            <input
              id="mdp-suivant"
              className="input input-line"
              type="password"
              value={suivant}
              onChange={e => setSuivant(e.target.value)}
              autoComplete="new-password"
            />
            <span className="muted small">Au moins 8 caractères.</span>
          </div>
          {erreur && (
            <p className="error" role="alert">
              {erreur}
            </p>
          )}
          <button className="btn btn-primary btn-block" disabled={busy || !preuve.trim() || !suivant}>
            Changer mon mot de passe
          </button>
          <button
            type="button"
            className="link-inline"
            onClick={() => {
              setParCode(c => !c)
              setPreuve('')
              setErreur('')
            }}
          >
            {parCode ? 'Je connais mon mot de passe' : "Mot de passe oublié ? Mon code de secours"}
          </button>
        </form>
      )}
    </>
  )
}

