import { MAX_NAME_LENGTH } from '../../../shared/avatars'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Limite } from './Limite'
import { api, motifDe } from '../api'
import { PITCH_PROFIL, type PublicProfile } from '../../../shared/profil'
import { AVATARS } from '../../../shared/avatars'
import { Icon } from './Icon'
import { CodeSecours, FormulaireSecours } from './Secours'
import { identifiantPour, tirage } from './Entree'

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
   * laisser croire.
   */
  echappee?: ReactNode
  /**
   * Ouvrir sur la création plutôt que sur la connexion : le lien « créer un
   * profil » de la salle d'attente menait à « Retrouver mon profil », un
   * formulaire que l'invité n'avait aucun moyen de remplir.
   */
  creer?: boolean
  /**
   * Un bandeau en tête du formulaire : « Le quiz commence » dans la salle
   * d'attente. Le formulaire passait devant le quiz, et l'invité qui
   * remplissait son profil ratait les premières questions sans le savoir.
   */
  bandeau?: ReactNode
}

/**
 * Se connecter à un profil, ou en créer un.
 *
 * Volontairement court : on le remplit debout, dans le noir, au milieu d'une
 * fête. Trois champs pour s'inscrire, deux pour revenir. Personne n'est
 * obligé d'en passer par là — l'invité anonyme joue exactement comme avant,
 * et c'est le chemin par défaut.
 */
export function ProfilForm({ prefill, onDone, onCancel, echappee, creer, bandeau }: Props) {
  const [mode, setMode] = useState<'connexion' | 'inscription' | 'secours'>(creer ? 'inscription' : 'connexion')
  // Deviné du prénom à la création seulement : en connexion, ses échecs se
  // compteraient sur le profil d'un autre, qui fermerait un quart d'heure.
  const [login, setLogin] = useState(() => (creer && prefill?.name ? identifiantPour(prefill.name) : ''))
  /**
   * Tant qu'on n'y a pas touché, l'identifiant suit le prénom — comme à
   * l'entrée d'une soirée : ici, on ne le proposait pas.
   */
  const [loginTouche, setLoginTouche] = useState(false)
  const [password, setPassword] = useState('')
  const [name, setName] = useState(prefill?.name ?? '')
  /**
   * Tiré d'avance, comme à l'entrée : né à l'accueil, chaque profil recevait
   * l'emoji de fête — hors de la grille, et le même pour tous.
   */
  const [avatar, setAvatar] = useState(() => (prefill?.avatar && AVATARS.includes(prefill.avatar) ? prefill.avatar : tirage()))
  /** La grille ne s'ouvre qu'à la demande : à l'accueil, elle poussait tout le reste sous le bord. */
  const [grille, setGrille] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** Une bonne nouvelle, pas une erreur : elle ne s'écrit pas en rouge. */
  const [info, setInfo] = useState('')
  /** Le code de secours, à noter — il ne repassera jamais. `neuf` : il remplace celui qu'on vient de donner. */
  const [recovery, setRecovery] = useState<{ code: string; profile: PublicProfile; neuf?: boolean } | null>(null)

  // Le code d'abord : après un secours réussi, le mode restait « secours »,
  // et c'est le formulaire qui se remontrait — le code neuf ne s'affichait
  // jamais, et le second essai répondait « code incorrect ».
  if (recovery) {
    return (
      <div className="join">
        <h2 className="center">{recovery.neuf ? 'Note ton nouveau code' : 'Ton profil est prêt'}</h2>
        {recovery.neuf && (
          <p className="muted small center">Ton mot de passe a changé, et l'ancien code ne sert plus.</p>
        )}
        <CodeSecours code={recovery.code} />
        <div className="join-grow" />
        <button className="btn btn-primary btn-big btn-block" onClick={() => onDone(recovery.profile)}>
          C'est noté
        </button>
      </div>
    )
  }

  // Le mot de passe oublié se règle par le code de secours — c'est la seule
  // porte de retour, faute d'adresse e-mail. On la met là où on la cherche.
  if (mode === 'secours') {
    return (
      <FormulaireSecours
        prefill={login}
        onDone={(profile, neuf) => {
          // Le code vient d'être consommé : celui qu'on rend est le nouveau,
          // et il se note tout de suite, comme à l'inscription.
          if (profile) return setRecovery({ code: neuf, profile, neuf: true })
          setMode('connexion')
          setError('')
          setInfo('Profil retrouvé — connecte-toi avec ton nouveau mot de passe')
        }}
        onCancel={() => setMode('connexion')}
      />
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    try {
      if (mode === 'connexion') {
        const { profile } = await api.joueur.connexion(login, password)
        onDone(profile)
      } else {
        const res = await api.joueur.inscription({
          login,
          password,
          name: name.trim(),
          avatar,
        })
        setRecovery({ code: res.recovery, profile: res.profile })
      }
    } catch (e) {
      // « Identifiant ou mot de passe incorrect », tel que le serveur le dit
      // — et non plus « Connexion requise », ni « Failed to fetch ».
      setError(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const creation = mode === 'inscription'
  return (
    // Resserré comme l'entrée d'une soirée : en 360 × 640, « Revenir » —
    // la seule sortie de la salle d'attente — tombait sous le bord.
    <form className="join entree" onSubmit={submit}>
      {/* « Retrouver mon profil » titrait aussi la récupération par code de
          secours (`Secours.tsx`) : deux écrans, un seul nom. */}
      {bandeau}
      <h2 className="center">
        <Icon name="sparkles" /> {creation ? 'Créer un profil' : 'Me connecter'}
      </h2>
      {/* Avec une échappée, l'explication passe SOUS les boutons — comme à
          l'entrée d'une soirée. En haut, elle pousse « Rejoindre une
          soirée » sous la ligne de flottaison d'un 360 × 640, et c'est
          exactement ce qu'on s'interdit. */}
      {/* Le bandeau prend sa place : sinon « Revenir » repassait sous le bord. */}
      {!echappee && !bandeau && (
        <>
          <p className="muted small center">
            {PITCH_PROFIL} Il ne change rien au jeu : les points de la soirée se gagnent pareil pour
            tout le monde.
          </p>
          <hr className="hairline" />
        </>
      )}
      {creation && (
        <div className="field">
          <div className="field-head">
            <label className="label" htmlFor="pf-name">
              Ton prénom
            </label>
            <span className="muted small">{MAX_NAME_LENGTH} caractères au plus</span>
          </div>
          <input
            id="pf-name"
            className="input input-line"
            value={name}
            onChange={e => {
              setName(e.target.value)
              if (!loginTouche) setLogin(identifiantPour(e.target.value))
            }}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="given-name"
          />
          <Limite valeur={name} max={MAX_NAME_LENGTH} />
        </div>
      )}
      {/* L'avatar ne se choisit qu'à l'accueil : ailleurs, celui du soir est
          déjà choisi (on ne le choisit jamais deux fois), et sa ligne poussait
          « Revenir », la seule sortie de la salle d'attente, sous le bord. */}
      {creation && echappee && (
        <div className="field">
          <div className="field-head">
            <span className="label" id="pf-avatar-label">
              Ton avatar
            </span>
            {/* L'emoji seul ne se lisait pas comme un bouton : « changer » le dit. */}
            <button
              type="button"
              className="btn btn-small pf-avatar"
              aria-expanded={grille}
              aria-label={`Avatar ${avatar} — en choisir un autre`}
              onClick={() => setGrille(g => !g)}
            >
              <span className="pf-avatar-emoji" aria-hidden="true">
                {avatar}
              </span>
              {grille ? 'fermer' : 'changer'}
            </button>
          </div>
          {grille && (
            <div className="emoji-grid" role="group" aria-labelledby="pf-avatar-label">
              {AVATARS.map(a => (
                <button
                  type="button"
                  key={a}
                  className={'emoji-btn' + (a === avatar ? ' selected' : '')}
                  aria-pressed={a === avatar}
                  aria-label={`Avatar ${a}`}
                  onClick={() => {
                    setAvatar(a)
                    setGrille(false)
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="field">
        <label className="label" htmlFor="pf-login">
          Ton identifiant
        </label>
        {/* Jamais d'`autoFocus` : le clavier ouvert d'office pousse hors
            d'un écran de 360 × 640 le bouton qui permet de repartir —
            « Rejoindre une soirée » sur l'accueil, « Revenir » dans la salle
            d'attente. Le clavier vient quand on touche un champ. */}
        <input
          id="pf-login"
          className="input input-line"
          value={login}
          onChange={e => {
            setLogin(e.target.value)
            setLoginTouche(true)
          }}
          autoComplete="username"
          autoCapitalize="none"
          maxLength={32}
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
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="info" role="status">
          {info}
        </p>
      )}
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
              setInfo('')
              // L'identifiant deviné du prénom ne suit pas en connexion :
              // Camille y aurait essayé « camille », et ses échecs fermaient
              // le vrai profil « camille » un quart d'heure.
              if (!loginTouche) setLogin(creation ? '' : identifiantPour(name))
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
                setInfo('')
                if (!loginTouche) setLogin(creation ? '' : identifiantPour(name))
                setMode(creation ? 'connexion' : 'inscription')
              }}
            >
              {creation ? 'J’ai déjà un profil' : 'Créer un profil'}
            </button>
          </div>
          <p className="muted small center join-foot">
            {PITCH_PROFIL} Il ne change rien aux points d'un quiz — et rejoindre une soirée n'en
            demande aucun.
          </p>
        </>
      )}
    </form>
  )
}
