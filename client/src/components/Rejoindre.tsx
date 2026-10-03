import { useState, type FormEvent } from 'react'
import { JoinHead } from './Invitation'
import { Sortie } from './Pieces'
import { CODE_DU_SALON, ecrireCode } from '../../../shared/space'

interface Props {
  /**
   * Affiché quand on arrive d'une adresse qui ne mène nulle part : le code
   * ou le nom tapé, qu'on retrouve dans le champ pour le corriger au lieu de
   * tout retaper. Le serveur a déjà essayé la casse et « chez-‹nom› ».
   */
  perdu?: string
  /** Sans lui, pas de « ← Accueil » : il n'y a rien derrière. */
  onCancel?: () => void
}

/** Les chiffres d'une saisie, six au plus : « 482 157 » se tape comme on le dicte, espaces ou non. */
const chiffres = (saisie: string) => saisie.replace(/\D/g, '').slice(0, 6)

/**
 * « Rejoindre une soirée » — le chemin de celui qui a le code mais pas le QR.
 *
 * Six chiffres, sur le pavé numérique du téléphone : le code que l'hôte
 * dicte à la table (`core/salons.ts`), et le bouton s'allume au sixième.
 * Rien d'autre : toute soirée ouverte a son code, les espaces d'avant les
 * codes compris — leur nom ne se tape plus (« J'ai le nom de la soirée »
 * est parti le 3 octobre 2026), leur adresse et leur QR marchent toujours.
 * C'est l'échappée du chemin anonyme : on n'a jamais besoin d'un
 * profil pour entrer dans une soirée, et ce formulaire-là doit rester à un
 * geste de l'accueil. Il n'a pas d'`autoFocus` : le clavier pousserait le
 * bouton hors de l'écran d'un téléphone de 360 × 640.
 */
export function FormulaireSoiree({ perdu, onCancel }: Props) {
  const [code, setCode] = useState(perdu && CODE_DU_SALON.test(perdu) ? perdu : '')
  const pret = code.length === 6

  const go = (e: FormEvent) => {
    e.preventDefault()
    if (pret) window.location.assign(`/${code}`)
  }

  return (
    <form className="join" onSubmit={go}>
      {/* « ← Accueil » en haut à gauche, comme partout : c'était le seul
          écran dont le retour, « Revenir », attendait sous le bouton (la
          remarque du propriétaire du 3 octobre 2026). */}
      {onCancel && <Sortie onClick={onCancel} />}
      <JoinHead
        eyebrow="Le quiz de la soirée"
        title="Rejoindre une soirée"
        compact
        sub="Le code à six chiffres que ton hôte te donne."
      />
      <hr className="hairline" />
      {perdu !== undefined && (
        <p className="warn">
          {perdu && CODE_DU_SALON.test(perdu) ? (
            <>Le code {ecrireCode(perdu)} ne mène à aucun salon — ou plus.</>
          ) : perdu ? (
            <>« {perdu} » ne mène à aucune soirée.</>
          ) : (
            'Cette adresse ne mène à aucune soirée.'
          )}{' '}
          Vérifie avec ton hôte, ou scanne à nouveau le QR de l'écran.
        </p>
      )}
      <div className="field">
        <label className="label" htmlFor="salon-code">
          Le code du salon
        </label>
        {/* Le pavé numérique, sans les flèches d'un champ « number » : un
            code n'est pas une quantité, et son zéro de tête compte. */}
        <input
          id="salon-code"
          className="input input-line input-code"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9 ]*"
          placeholder="482 157"
          value={ecrireCode(code)}
          onChange={e => setCode(chiffres(e.target.value))}
        />
      </div>
      <div className="join-grow" />
      <div className="join-actions">
        <button className="btn btn-primary btn-big btn-block" disabled={!pret}>
          Rejoindre la soirée
        </button>
      </div>
    </form>
  )
}
