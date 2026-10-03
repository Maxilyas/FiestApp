import { useState, type FormEvent } from 'react'
import { JoinHead } from './Invitation'
import { CODE_DU_SALON, ecrireCode, normalizeSlug } from '../../../shared/space'

interface Props {
  /**
   * Affiché quand on arrive d'une adresse qui ne mène nulle part : le code
   * ou le nom tapé, qu'on retrouve dans le champ pour le corriger au lieu de
   * tout retaper. Le serveur a déjà essayé la casse et « chez-‹nom› ».
   */
  perdu?: string
  /** Sans lui, pas de bouton « Revenir » : il n'y a rien derrière. */
  onCancel?: () => void
}

/** Les chiffres d'une saisie, six au plus : « 482 157 » se tape comme on le dicte, espaces ou non. */
const chiffres = (saisie: string) => saisie.replace(/\D/g, '').slice(0, 6)

/**
 * « Rejoindre une soirée » — le chemin de celui qui a le code mais pas le QR.
 *
 * Six chiffres, sur le pavé numérique du téléphone : le code que l'hôte
 * dicte à la table (`core/salons.ts`), et le bouton s'allume au sixième.
 * Les espaces d'avant les codes s'ouvrent encore par leur nom, un toucher
 * plus loin. C'est l'échappée du chemin anonyme : on n'a jamais besoin d'un
 * profil pour entrer dans une soirée, et ce formulaire-là doit rester à un
 * geste de l'accueil. Il n'a pas d'`autoFocus` : le clavier pousserait le
 * bouton hors de l'écran d'un téléphone de 360 × 640.
 */
export function FormulaireSoiree({ perdu, onCancel }: Props) {
  const perduParNom = perdu !== undefined && perdu !== '' && !CODE_DU_SALON.test(perdu)
  const [parNom, setParNom] = useState(perduParNom)
  const [code, setCode] = useState(perdu && CODE_DU_SALON.test(perdu) ? perdu : '')
  const [name, setName] = useState(perduParNom ? perdu : '')
  const slug = normalizeSlug(name)
  const pret = parNom ? !!slug : code.length === 6

  const go = (e: FormEvent) => {
    e.preventDefault()
    if (pret) window.location.assign(`/${parNom ? slug : code}`)
  }

  return (
    <form className="join" onSubmit={go}>
      <JoinHead
        eyebrow="Le quiz de la soirée"
        title="Rejoindre une soirée"
        compact
        sub={parNom ? 'Les soirées d’avant les codes ont un nom.' : 'Le code à six chiffres que ton hôte te donne.'}
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
      {parNom ? (
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
      ) : (
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
      )}
      <p className="muted small">
        <button type="button" className="link-inline" onClick={() => setParNom(!parNom)}>
          {parNom ? 'J’ai un code à six chiffres' : 'J’ai le nom de la soirée'}
        </button>
      </p>
      <div className="join-grow" />
      <div className="join-actions">
        <button className="btn btn-primary btn-big btn-block" disabled={!pret}>
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
