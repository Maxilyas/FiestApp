import { useState } from 'react'
import { ApiError, api } from '../api'

/**
 * L'identifiant d'un profil qui naît, en une ligne : « Pour te reconnecter :
 * camille · modifier ». Il se déduit du prénom (`identifiantPour`) tant
 * qu'on n'y touche pas — trois champs pour s'inscrire (prénom, identifiant,
 * mot de passe) troublaient : on ne savait pas lequel la salle verrait (la
 * remarque du propriétaire du 4 octobre 2026). Le prénom est ce que la salle
 * voit, l'identifiant ne sert qu'à revenir ; le champ ne s'ouvre qu'à la
 * demande, ou quand le serveur le refuse.
 */
export function IdentifiantDiscret({
  id,
  login,
  ouvert,
  onOuvrir,
  onChange,
}: {
  id: string
  login: string
  /** Le champ est montré : on l'a demandé, ou l'identifiant a été refusé. */
  ouvert: boolean
  onOuvrir: () => void
  onChange: (login: string) => void
}) {
  if (!ouvert) {
    return (
      <p className="identifiant-discret muted small">
        Pour te reconnecter : <b>{login || '…'}</b>{' '}
        <button type="button" className="link-inline" onClick={onOuvrir}>
          modifier
        </button>
      </p>
    )
  }
  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        Ton identifiant, pour te reconnecter
      </label>
      <input
        id={id}
        className="input input-line"
        value={login}
        onChange={e => onChange(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={32}
      />
    </div>
  )
}

/** Ce que l'inscription rend : le profil, son code de secours, et l'identifiant retenu. */
type Inscrit = Awaited<ReturnType<typeof api.joueur.inscription>> & { login: string }

/**
 * L'inscription, l'identifiant deviné compris : pris par un autre, le serveur
 * en propose un libre (`suggestion`), qu'on prend sans rien redemander — on ne
 * l'avait pas choisi. Un identifiant tapé à la main, lui, ne se remplace
 * jamais en silence : le refus remonte, avec sa proposition.
 */
export async function inscrireAvecRepli(
  champs: { login: string; password: string; name: string; avatar: string },
  devine: boolean,
): Promise<Inscrit> {
  try {
    return { ...(await api.joueur.inscription(champs)), login: champs.login }
  } catch (e) {
    if (!devine || !(e instanceof ApiError) || !e.suggestion) throw e
    const login = e.suggestion
    return { ...(await api.joueur.inscription({ ...champs, login })), login }
  }
}
