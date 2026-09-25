import { useState, type FormEvent } from 'react'
import { JoinHead } from './Invitation'
import { normalizeSlug } from '../../../shared/space'

interface Props {
  /**
   * Affiché quand on arrive d'une adresse qui ne mène nulle part : le nom
   * tapé, qu'on retrouve dans le champ pour le corriger au lieu de tout
   * retaper. Le serveur a déjà essayé la casse et « chez-‹nom› ».
   */
  perdu?: string
  /** Sans lui, pas de bouton « Revenir » : il n'y a rien derrière. */
  onCancel?: () => void
}

/**
 * « Quelle soirée ? » — le chemin de celui qui a l'adresse mais pas le QR.
 *
 * C'est l'échappée du chemin anonyme : on n'a jamais besoin d'un profil pour
 * entrer dans une soirée, et ce formulaire-là doit rester à un geste de
 * l'accueil. Il n'a pas d'`autoFocus` : le clavier pousserait le bouton hors
 * de l'écran d'un téléphone de 360 × 640.
 */
export function FormulaireSoiree({ perdu, onCancel }: Props) {
  const [name, setName] = useState(perdu ?? '')
  const slug = normalizeSlug(name)

  const go = (e: FormEvent) => {
    e.preventDefault()
    if (slug) window.location.assign(`/${slug}`)
  }

  return (
    <form className="join" onSubmit={go}>
      <JoinHead eyebrow="Le quiz de la soirée" title="Quelle soirée ?" compact sub="Chaque soirée a son adresse." />
      <hr className="hairline" />
      {perdu !== undefined && (
        <p className="warn">
          {perdu ? <>« {perdu} » ne mène à aucune soirée.</> : 'Cette adresse ne mène à aucune soirée.'} Vérifie
          le nom avec ton hôte, ou scanne à nouveau le QR de l'écran.
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
          placeholder="chez-camille"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <p className="muted small">
          Le dernier mot de l'adresse que ton hôte t'a donnée
          {slug && (
            <>
              {' '}
              : <code>{`${window.location.host}/${slug}`}</code>
            </>
          )}
          . « chez camille » se tape aussi comme on le dit.
        </p>
      </div>
      <div className="join-grow" />
      <div className="join-actions">
        <button className="btn btn-primary btn-big btn-block" disabled={!slug}>
          Rejoindre la soirée
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Revenir
          </button>
        )}
      </div>
    </form>
  )
}
