import { useEffect, useState, type FormEvent } from 'react'
import type { AbsentDuMemeNom } from '../../../shared/events'
import { sansAccent } from '../../../shared/homonymes'
import { motifDe } from '../api'
import { horsLigneDuMemeNom } from '../socket'
import { espacesFines } from '../format'
import { Icon } from './Icon'

/**
 * « Un Rachid 🦁 est hors ligne : si c'est toi, demande à l'animateur. »
 *
 * Un téléphone mort emporte son jeton, et un nouveau ne peut qu'inscrire un
 * second Rachid, dont les points ne rejoindront jamais ceux du premier. On
 * ne rend pas une place sur parole — n'importe qui taperait « Rachid » :
 * c'est l'animateur, qui le voit en face, qui fait paraître un code. Sauf
 * pour une fiche à profil : c'est le profil qui la rend, jamais un code.
 *
 * `profilIci` : ce téléphone porte un profil — le serveur y refuse un code,
 * sinon la place reprise se rattacherait à ce profil.
 */
export function AvisHorsLigne({
  absent,
  profilIci,
  onCode,
  onProfil,
  discret,
}: {
  absent: AbsentDuMemeNom
  profilIci: boolean
  /** Pendant un quiz : une ligne en petit, au-dessus du résultat, pas un avertissement. */
  discret?: boolean
  onCode: () => void
  /** Mène à « Me connecter » — absent quand ce téléphone porte déjà un profil. */
  onProfil?: () => void
}) {
  const qui = `Un « ${absent.name} » ${absent.avatar} est hors ligne : si c'est toi,`
  if (absent.profil) {
    return (
      <p className={'warn avis-hors-ligne' + (discret ? ' small' : '')}>
        {espacesFines(`${qui} connecte-toi à ton profil — il te rend ta place.`)}{' '}
        {onProfil && !profilIci && (
          <button type="button" className="link-inline" onClick={onProfil}>
            Me connecter
          </button>
        )}
      </p>
    )
  }
  if (profilIci) {
    return (
      <p className={'warn avis-hors-ligne' + (discret ? ' small' : '')}>
        {espacesFines(
          `${qui} ouvre la soirée dans une fenêtre privée, et demande à l'animateur de te rendre ta place.`,
        )}
      </p>
    )
  }
  return (
    <p className={'warn avis-hors-ligne' + (discret ? ' small' : '')}>
      {espacesFines(`${qui} demande à l'animateur de te rendre ta place.`)}{' '}
      <button type="button" className="link-inline" onClick={onCode}>
        J'ai un code
      </button>
    </p>
  )
}

/**
 * L'invité hors ligne qui porte ce prénom — le candidat à « c'est moi » —,
 * demandé au serveur. L'instantané des téléphones ne dit pas qui est
 * connecté, ou plus pour longtemps : ce n'est pas l'affaire de la salle.
 *
 * On ne demande que si un invité porte déjà ce prénom (les prénoms, eux,
 * sont publics) : cinq cents téléphones n'interrogent pas le serveur à
 * chaque instantané pour un homonyme qui n'existe pas. `cle` redemande quand
 * la salle a changé — un nouvel instantané.
 */
export function useHorsLigne(
  slug: string,
  nom: string,
  players: { id: string; name: string }[],
  opts: { actif?: boolean; sauf?: string } = {},
): AbsentDuMemeNom | undefined {
  const [absent, setAbsent] = useState<AbsentDuMemeNom>()
  const cle = sansAccent(nom)
  const candidat =
    opts.actif !== false && !!cle && players.some(p => p.id !== opts.sauf && sansAccent(p.name) === cle)
  useEffect(() => {
    if (!candidat) return setAbsent(undefined)
    let perime = false
    // Le temps de finir de taper : une demande par prénom, pas par lettre.
    const t = setTimeout(() => {
      void horsLigneDuMemeNom(slug, nom).then(a => {
        if (!perime) setAbsent(a)
      })
    }, 400)
    return () => {
      perime = true
      clearTimeout(t)
    }
    // `players` change à chaque instantané : c'est voulu, l'absent a pu revenir.
  }, [slug, nom, candidat, players])
  return candidat ? absent : undefined
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
