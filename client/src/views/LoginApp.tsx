import { useState } from 'react'
import { api, UnauthorizedError } from '../api'
import { LoginForm } from '../components/Invitation'

/**
 * La page de connexion (`/connexion`). Elle ramène ensuite là d'où on
 * venait (`?next=/compte`), à condition que ce soit une page d'ici : une
 * adresse extérieure glissée dans le lien n'emmène personne ailleurs.
 */
function nextPage(): string {
  const next = new URLSearchParams(window.location.search).get('next') ?? ''
  return next.startsWith('/') && !next.startsWith('//') ? next : '/host'
}

export function LoginApp() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (login: string, password: string) => {
    setBusy(true)
    setError('')
    try {
      await api.auth.login(login, password)
      window.location.assign(nextPage())
    } catch (e) {
      setError(e instanceof UnauthorizedError ? 'Identifiant ou mot de passe incorrect' : (e as Error).message)
      setBusy(false)
    }
  }

  return <LoginForm title="Connexion" error={error} busy={busy} onSubmit={submit} />
}
