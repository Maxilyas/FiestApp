import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Feuille } from './Pieces'
import { Icon } from './Icon'
import { espacesFines } from '../format'

// La plume : l'invitation à proposer une question, là où l'on joue.
//
// Beaucoup ne jouent qu'au quiz du jour et au défi de la semaine : une
// invitation rangée en fin de série de campagne ne les touchait jamais (la
// remarque du propriétaire du 2 novembre 2026). Elle vient donc à eux, au
// moment où l'on est fier — le résultat du jour, la fin du défi — et là où
// une question de joueur se signe. Sans prendre de place : pas de carte de
// plus, une ligne au pied d'une carte qui existe déjà. Ce qui attire l'œil,
// c'est le geste, une fois : la plume se trace à l'arrivée, puis l'encre
// souligne ce qu'elle propose — le mouvement au bon moment, et rien si le
// système en demande moins (`styles.css`, « La plume »).

/**
 * Les bonnes réponses qui valent l'invitation, au quiz du jour comme au
 * défi : après un beau résultat, « écris la tienne » se lit comme un
 * compliment ; après un mauvais, comme une leçon. Un choix de produit.
 */
export const JUSTES_POUR_LA_PLUME = 7

/**
 * Au trait des icônes de l'application : une plume. Chaque tracé a la
 * longueur 1 (`pathLength`) : la feuille de style les dessine du même pas,
 * quelle que soit leur longueur réelle.
 */
export function IconePlume() {
  return (
    <svg className="icon plume-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path pathLength={1} d="M20.5 3.5c-5.4.1-9.7 2.4-11.9 7.2-.9 2-1.3 4.1-1.3 5.8 1.7 0 3.8-.4 5.8-1.3 4.8-2.2 7.3-6.4 7.4-11.7Z" />
      <path pathLength={1} d="M4 20 15 9" />
      <path pathLength={1} d="M10.5 13.5h4.3M13 11h4" />
    </svg>
  )
}

/**
 * La ligne : la plume, une accroche, et ce qu'elle propose, souligné à
 * l'encre — tout le reste de la page reste à sa place. Un bouton : elle
 * ouvre la feuille où l'on écrit sa question.
 */
export function LaPlume({ accroche, appel }: { accroche: string; appel: string }) {
  const [ouverte, setOuverte] = useState(false)
  return (
    <>
      <button type="button" className="plume" aria-haspopup="dialog" onClick={() => setOuverte(true)}>
        <IconePlume />
        <span className="plume-texte">
          {espacesFines(accroche)} <span className="plume-appel">{espacesFines(appel)}</span>
        </span>
        <Icon name="chevron-right" className="plume-chevron" />
      </button>
      {ouverte && <FeuilleDeLaPlume onFermer={() => setOuverte(false)} />}
    </>
  )
}

/**
 * La feuille part au bout du document : posée là où vit la ligne — dans le
 * bandeau du résultat, qui s'anime d'un `transform` —, son voile fixe se
 * serait tenu dans le bandeau, et son texte, centré comme lui.
 */
function FeuilleDeLaPlume({ onFermer }: { onFermer: () => void }) {
  return createPortal(<PropositionDeQuestion onFermer={onFermer} />, document.body)
}

/**
 * La signature d'une question de joueur, au pied de son anecdote : qui l'a
 * écrite, et de quoi écrire la sienne — l'invitation la plus parlante est
 * une question d'un autre joueur, qu'on vient de jouer.
 */
export function SignatureDuPublic({ prenom }: { prenom: string }) {
  const [ouverte, setOuverte] = useState(false)
  return (
    <span className="plume-signature">
      <span className="plume-de">{espacesFines(`La question de ${prenom}`)}</span>
      <button type="button" className="plume-ecrire" aria-haspopup="dialog" onClick={() => setOuverte(true)}>
        <IconePlume />
        Écris la tienne
      </button>
      {ouverte && <FeuilleDeLaPlume onFermer={() => setOuverte(false)} />}
    </span>
  )
}

/** Une question tient sur l'écran d'un téléphone. */
const QUESTION_MAX = 200

/**
 * La première étape de la proposition : la question, vérifiée pendant qu'on
 * l'écrit — ce que la base refuserait se dit avant l'envoi, pas après. Les
 * réponses, la catégorie et l'envoi en relecture viennent ensuite.
 */
function PropositionDeQuestion({ onFermer }: { onFermer: () => void }) {
  const [question, setQuestion] = useState('')
  const t = question.trim()
  const verifications: [boolean, string, string][] = [
    [t.length >= 15, 'Assez longue pour être claire', 'Un peu courte : précise-la'],
    [t.endsWith('?'), 'Elle finit par un point d’interrogation', 'Termine-la par un point d’interrogation'],
    [!/\p{Extended_Pictographic}/u.test(t), 'Sans emoji', 'Enlève l’emoji : certains écrans ne l’affichent pas'],
  ]
  return (
    <Feuille
      titre="Proposer une question"
      onFermer={onFermer}
      className="plume-feuille"
      pied={
        <button type="button" className="btn btn-primary btn-block" disabled>
          Suivant : les réponses
        </button>
      }
    >
      <p className="muted">
        {espacesFines('Une question, une seule bonne réponse. Relue par l’administrateur, elle entre dans le jeu — signée de ton prénom, si tu veux.')}
      </p>
      <label className="field">
        <span className="label">Ta question</span>
        <textarea className="input" rows={3} maxLength={QUESTION_MAX} value={question} placeholder="Quel… ? Combien… ? Qui… ?" onChange={e => setQuestion(e.target.value)} />
      </label>
      {t && (
        <ul className="plume-verifications" aria-live="polite">
          {verifications.map(([ok, oui, non]) => (
            <li key={oui} className={ok ? 'plume-ok' : 'plume-ko'}>
              <Icon name={ok ? 'check-circle' : 'alert'} />
              {espacesFines(ok ? oui : non)}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">{espacesFines('Ensuite : les réponses, la catégorie, puis l’envoi en relecture.')}</p>
    </Feuille>
  )
}
