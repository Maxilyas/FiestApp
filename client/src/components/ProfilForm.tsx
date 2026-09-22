import { useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../api'
import type { PublicProfile } from '../../../shared/profil'
import { Icon } from './Icon'
import { FormulaireSecours } from './Secours'

interface Props {
  /** Le prénom et l'emoji déjà choisis sur l'écran d'inscription, s'il y en a. */
  prefill?: { name: string; avatar: string }
  /** Rendu une fois connecté ou inscrit — au parent de recharger ce qu'il faut. */
  onDone: (profile: PublicProfile) => void
  /** Sans lui, pas de bouton « Revenir » : sur l'accueil, il n'y a rien derrière. */
  onCancel?: () => void
  /**
   * L'échappée, sous les boutons : « Rejoindre une soirée » sur l'accueil.
   *
   * Elle a le format de « Me connecter » et se voit sans défiler — personne
   * n'a jamais besoin d'un profil pour jouer, et cet écran ne doit pas le
   * laisser croire. Sa présence retire aussi l'`autoFocus` : le clavier
   * pousserait ce bouton-là hors d'un écran de 360 × 640.
   */
  echappee?: ReactNode
}

/**
 * Se connecter à un profil, ou en créer un.
 *
 * Volontairement court : on le remplit debout, dans le noir, au milieu d'une
 * fête. Trois champs pour s'inscrire, deux pour revenir. Personne n'est
 * obligé d'en passer par là — l'invité anonyme joue exactement comme avant,
 * et c'est le chemin par défaut.
 */
export function ProfilForm({ prefill, onDone, onCancel, echappee }: Props) {
  const [mode, setMode] = useState<'connexion' | 'inscription' | 'secours'>('connexion')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState(prefill?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** Le code de secours, à noter — il ne repassera jamais. */
  const [recovery, setRecovery] = useState<{ code: string; profile: PublicProfile } | null>(null)

  // Le mot de passe oublié se règle par le code de secours — c'est la seule
  // porte de retour, faute d'adresse e-mail. On la met là où on la cherche.
  if (mode === 'secours') {
    return (
      <FormulaireSecours
        prefill={login}
        onDone={(profile, neuf) => {
          // Le code vient d'être consommé : celui qu'on rend est le nouveau,
          // et il se note tout de suite, comme à l'inscription.
          if (profile) return setRecovery({ code: neuf, profile })
          setMode('connexion')
          setError('Profil retrouvé — reconnecte-toi')
        }}
        onCancel={() => setMode('connexion')}
      />
    )
  }

  if (recovery) {
    return (
      <div className="join">
        <h2 className="center">Ton profil est prêt</h2>
        <div className="card notice">
          <p>
            <strong>Note ce code de secours.</strong> C'est la seule façon de retrouver ton profil si
            tu oublies ton mot de passe — il n'y a pas d'adresse e-mail, donc pas de lien à recevoir.
          </p>
          <p className="code-secours">{recovery.code}</p>
          <p className="muted small">Il ne sera plus jamais affiché.</p>
        </div>
        <div className="join-grow" />
        <button className="btn btn-primary btn-big btn-block" onClick={() => onDone(recovery.profile)}>
          C'est noté
        </button>
      </div>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'connexion') {
        const { profile } = await api.joueur.connexion(login, password)
        onDone(profile)
      } else {
        const res = await api.joueur.inscription({
          login,
          password,
          name: name.trim(),
          avatar: prefill?.avatar ?? '',
        })
        setRecovery({ code: res.recovery, profile: res.profile })
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const creation = mode === 'inscription'
  return (
    <form className="join" onSubmit={submit}>
      <h2 className="center">
        <Icon name="sparkles" /> {creation ? 'Créer un profil' : 'Retrouver mon profil'}
      </h2>
      {/* Avec une échappée, l'explication passe SOUS les boutons — comme à
          l'entrée d'une soirée. En haut, elle pousse « Rejoindre une
          soirée » sous la ligne de flottaison d'un 360 × 640, et c'est
          exactement ce qu'on s'interdit. */}
      {!echappee && (
        <>
          <p className="muted small center">
            Un profil garde tes points d'une soirée à l'autre, te fait monter de niveau et débloque des
            avatars. Il ne change rien au jeu : les points de la soirée se gagnent pareil pour tout le monde.
          </p>
          <hr className="hairline" />
        </>
      )}
      {creation && (
        <div className="field">
          <label className="label" htmlFor="pf-name">
            Ton prénom
          </label>
          <input
            id="pf-name"
            className="input input-line"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={24}
            autoComplete="given-name"
          />
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="pf-login">
          Ton identifiant
        </label>
        <input
          id="pf-login"
          className="input input-line"
          value={login}
          onChange={e => setLogin(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          maxLength={32}
          autoFocus={!echappee}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="pf-pass">
          Ton mot de passe
        </label>
        <input
          id="pf-pass"
          className="input input-line"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={creation ? 'new-password' : 'current-password'}
        />
      </div>
      {error && <p className="error">{error}</p>}
      <div className="join-grow" />
      <div className="join-actions">
        <button
          className="btn btn-primary btn-big btn-block"
          disabled={busy || !login.trim() || !password || (creation && !name.trim())}
        >
          {creation ? 'Créer mon profil' : 'Me connecter'}
        </button>
        {/* Sans échappée, l'autre mode est un bouton discret sous le
            principal. Avec, il passe après le « ou » : c'est là qu'on range
            tout ce qui n'est pas « je reviens ». */}
        {!echappee && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setError('')
              setMode(creation ? 'connexion' : 'inscription')
            }}
          >
            {creation ? 'J’ai déjà un profil' : 'Je n’en ai pas encore'}
          </button>
        )}
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Revenir
          </button>
        )}
      </div>
      {!creation && (
        <p className="join-foot">
          <button type="button" className="link-inline" onClick={() => setMode('secours')}>
            J'ai oublié mon mot de passe
          </button>
        </p>
      )}
      {echappee && (
        <>
          <p className="entree-ou">ou</p>
          <div className="join-actions">
            {echappee}
            <button
              type="button"
              className="btn btn-big btn-block"
              onClick={() => {
                setError('')
                setMode(creation ? 'connexion' : 'inscription')
              }}
            >
              {creation ? 'J’ai déjà un profil' : 'Créer un profil'}
            </button>
          </div>
          <p className="muted small center join-foot">
            Un profil retient ton niveau et tes prix d'une soirée à l'autre. Il ne change rien aux
            points d'un quiz — et rejoindre une soirée n'en demande aucun.
          </p>
        </>
      )}
    </form>
  )
}
