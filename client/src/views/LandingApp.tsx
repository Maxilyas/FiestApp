import { useState, type FormEvent } from 'react'
import { JoinHead } from '../components/Invitation'
import { route } from '../routes'
import { normalizeSlug } from '../../../shared/space'

/**
 * L'accueil (`/`) : l'application sert plusieurs soirées, chacune à son
 * adresse. Un invité arrive normalement par le QR de l'écran commun — s'il
 * tape l'adresse à la main et s'arrête à la racine, on lui demande le nom
 * de la soirée. L'animateur, lui, trouve la porte de son espace en bas.
 */
export function LandingApp() {
  const [name, setName] = useState('')
  const unknown = route.kind === 'unknown'
  const slug = normalizeSlug(name)

  const go = (e: FormEvent) => {
    e.preventDefault()
    if (slug) window.location.assign(`/${slug}`)
  }

  return (
    <form className="join" onSubmit={go}>
      <JoinHead eyebrow="Le quiz de la soirée" title="Quelle soirée ?" compact sub="Chaque soirée a son adresse." />
      <hr className="hairline" />
      {unknown && (
        <p className="warn">
          Cette adresse ne mène à aucune soirée. Vérifie le nom avec ton hôte, ou scanne à nouveau le QR de
          l'écran.
        </p>
      )}
      <div className="field">
        <label className="label" htmlFor="space-name">
          Le nom de la soirée
        </label>
        <input
          id="space-name"
          className="input input-line"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="romane"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <p className="muted small">
          C'est le dernier mot de l'adresse que ton hôte t'a donnée
          {slug && (
            <>
              {' '}
              : <code>{`${window.location.host}/${slug}`}</code>
            </>
          )}
          .
        </p>
      </div>
      <div className="join-grow" />
      <button className="btn btn-primary btn-big btn-block" disabled={!slug}>
        Rejoindre la soirée
      </button>
      <p className="join-foot">
        Tu animes ? <a href="/connexion">Espace animateur</a>
      </p>
    </form>
  )
}
