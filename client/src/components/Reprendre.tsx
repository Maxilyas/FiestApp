import { useState, type FormEvent } from 'react'
import type { PublicPlayer } from '../../../shared/types'
import { sansAccent } from '../../../shared/homonymes'
import { motifDe } from '../api'
import { espacesFines } from '../format'
import { Icon } from './Icon'

/**
 * « Un Rachid 🦁 est hors ligne : si c'est toi, demande à l'animateur. »
 *
 * Un téléphone mort emporte son jeton, et un nouveau ne peut qu'inscrire un
 * second Rachid, dont les points ne rejoindront jamais ceux du premier. On
 * ne rend pas une place sur parole — n'importe qui taperait « Rachid » :
 * c'est l'animateur, qui le voit en face, qui fait paraître un code.
 */
export function AvisHorsLigne({ joueur, onCode }: { joueur: PublicPlayer; onCode: () => void }) {
  return (
    <p className="warn avis-hors-ligne">
      {espacesFines(`Un « ${joueur.nomAffiche ?? joueur.name} » ${joueur.avatar} est hors ligne : si c'est toi, demande à l'animateur de te rendre ta place.`)}{' '}
      <button type="button" className="link-inline" onClick={onCode}>
        J'ai un code
      </button>
    </p>
  )
}

/** L'invité hors ligne qui porte ce prénom — le candidat à « c'est moi ». */
export function horsLigneDuMemeNom(players: PublicPlayer[], nom: string, sauf?: string): PublicPlayer | undefined {
  const cle = sansAccent(nom)
  if (!cle) return undefined
  return players.find(p => p.id !== sauf && !p.connected && sansAccent(p.name) === cle)
}

interface Props {
  /** Rend le motif du refus, ou null si la place est reprise. */
  reprendre: (code: string) => Promise<string | null>
  onCancel: () => void
}

/** Le code tapé : l'invité retrouve sa fiche — prénom, avatar, équipe, points. */
export function FormulaireCode({ reprendre, onCancel }: Props) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [erreur, setErreur] = useState('')
  const chiffres = code.replace(/\D/g, '')

  const envoyer = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErreur('')
    try {
      const refus = await reprendre(chiffres)
      if (refus) setErreur(refus)
    } catch (err) {
      setErreur(motifDe(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="join" onSubmit={envoyer}>
      <h2 className="center">
        <Icon name="hash" /> Reprendre ma place
      </h2>
      <p className="muted center">
        L'animateur fait paraître un code sur sa console. Tape-le ici : tu retrouves ton prénom, ton avatar et tes
        points.
      </p>
      <hr className="hairline" />
      <div className="field">
        <label className="label" htmlFor="place-code">
          Le code de l'animateur
        </label>
        {/* Pas d'`autoFocus` : le clavier pousserait le bouton hors de l'écran. */}
        <input
          id="place-code"
          className="input input-line code-place"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={e => setCode(e.target.value)}
          maxLength={11}
          placeholder="000 000"
        />
      </div>
      {erreur && (
        <p className="error" role="alert">
          {erreur}
        </p>
      )}
      <div className="join-grow" />
      <div className="join-actions">
        <button className="btn btn-primary btn-big btn-block" disabled={busy || chiffres.length !== 6}>
          Reprendre ma place
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          Revenir
        </button>
      </div>
    </form>
  )
}
