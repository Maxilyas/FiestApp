import { useState, type InputHTMLAttributes } from 'react'
import { Icon } from './Icon'

/**
 * Un champ de mot de passe qu'on peut afficher.
 *
 * Tapé dans le noir, sur un téléphone, un mot de passe se trompe d'une
 * lettre sans qu'on le voie : l'œil le montre le temps de le relire. Le
 * bouton garde son nom et son infobulle, et dit son état par `aria-pressed`
 * — la règle des boutons bascule (un libellé qui change aussi faisait lire
 * l'inverse).
 */
export function MotDePasse(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="mdp">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="mdp-oeil"
        aria-label="Afficher le mot de passe"
        aria-pressed={visible}
        title="Afficher le mot de passe"
        onClick={() => setVisible(v => !v)}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} />
      </button>
    </div>
  )
}
