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
        // Le focus reste dans le champ : passé au bouton, il fermait le
        // clavier du téléphone au milieu de la saisie.
        onMouseDown={e => e.preventDefault()}
        onClick={() => setVisible(v => !v)}
      >
        <Icon name={visible ? 'eye-off' : 'eye'} />
      </button>
    </div>
  )
}

/**
 * Le minimum du serveur (`MIN_PASSWORD`, `server/src/auth/password.ts`), que
 * la page ne peut pas importer : `connexion-claire.test.ts` les compare.
 */
const MINIMUM = 8

/**
 * Le mot de passe d'un profil qui naît, à l'accueil comme à l'entrée d'une
 * soirée : sa règle dite d'avance, et le refus du serveur (« Au moins
 * 8 caractères ») sous le champ, qui la fait taire — un seul texte à l'œil
 * comme à l'oreille (`aria-describedby`). Les deux formulaires avaient
 * chacun le leur, et l'accueil gardait sa règle au-dessus du refus : le
 * lecteur d'écran disait « 8 caractères au moins », puis « Au moins
 * 8 caractères » (la relecture du lot de la tablée du 26 octobre 2026).
 */
export function MotDePasseChoisi({
  id,
  valeur,
  refus,
  onChange,
  regle,
}: {
  id: string
  valeur: string
  /** Le refus du serveur, vide sinon : c'est au parent de le vider quand on retape. */
  refus: string
  onChange: (valeur: string) => void
  /**
   * Où se dit la règle : à côté du libellé à l'accueil, où chaque ligne
   * compte au-dessus du clavier d'un petit téléphone à 130 % ; sous le champ à
   * l'entrée d'une soirée, comme aux autres écrans qui font choisir un mot de
   * passe (`Secours.tsx`, `ChangerMotDePasse.tsx`).
   */
  regle: 'en-tete' | 'dessous'
}) {
  const libelle = (
    <label className="label" htmlFor={id}>
      Ton mot de passe
    </label>
  )
  return (
    <div className="field">
      {regle === 'en-tete' ? (
        <div className="field-head">
          {libelle}
          {/* Refusé, elle se tait et garde sa place : ôtée, la tête du champ
              perdait une ligne à 130 % (« Ton mot de passe » et elle y passent
              sur deux), le champ remontait sous le doigt, puis redescendait
              à la première lettre retapée. */}
          <span className="muted small" id={`${id}-regle`} style={refus ? { visibility: 'hidden' } : undefined}>
            {`${MINIMUM} caractères au moins`}
          </span>
        </div>
      ) : (
        libelle
      )}
      <MotDePasse
        id={id}
        className="input input-line"
        value={valeur}
        onChange={e => onChange(e.target.value)}
        autoComplete="new-password"
        aria-describedby={refus ? `${id}-refus` : `${id}-regle`}
        aria-invalid={refus ? true : undefined}
      />
      {refus ? (
        <p className="error" id={`${id}-refus`} role="alert">
          {refus}
        </p>
      ) : (
        regle === 'dessous' && (
          <span className="muted small" id={`${id}-regle`}>
            {`Au moins ${MINIMUM} caractères.`}
          </span>
        )
      )}
    </div>
  )
}
