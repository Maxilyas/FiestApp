import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'

/** Toutes les deux secondes : la télé s'allume à peine le code validé. */
const ATTENTE_MS = 2000

/**
 * Le code que la télé affiche, pour qu'on la branche depuis son téléphone —
 * sans taper d'adresse ni de mot de passe à la télécommande de la télé.
 * Un code périmé est remplacé tout seul.
 */
export function CodeDeLaTele({ onBranchee }: { onBranchee: () => void }) {
  const [code, setCode] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    let fini = false
    let minuteur: ReturnType<typeof setTimeout> | undefined
    let jeton = ''

    const demander = async () => {
      try {
        const ouvert = await api.auth.appairage()
        if (fini) return
        jeton = ouvert.jeton
        setCode(ouvert.code)
        setErreur('')
        minuteur = setTimeout(attendre, ATTENTE_MS)
      } catch (e) {
        if (fini) return
        setCode(null)
        setErreur(motifDe(e))
        // Réessayer sans marteler : la réserve d'essais est commune à la connexion.
        minuteur = setTimeout(demander, 30_000)
      }
    }

    const attendre = async () => {
      try {
        const r = await api.auth.attenteAppairage(jeton)
        if (fini) return
        if (r.ok) return onBranchee()
        // Périmé, ou la console qui l'a validé s'est fermée : un code neuf.
        if (r.perime) return void demander()
        minuteur = setTimeout(attendre, ATTENTE_MS)
      } catch {
        if (fini) return
        // Toute autre panne — le wifi coupé, le serveur qui redémarre — garde
        // le code et son jeton : une coupure le faisait jeter, et celui que
        // l'animateur validait entre-temps ne rouvrait jamais la télé.
        minuteur = setTimeout(attendre, ATTENTE_MS)
      }
    }

    void demander()
    return () => {
      fini = true
      clearTimeout(minuteur)
    }
  }, [onBranchee])

  return (
    <section className="appairage" aria-labelledby="appairage-titre">
      <h2 id="appairage-titre" className="label">
        Ou depuis ton téléphone
      </h2>
      {code ? (
        <p className="appairage-code" aria-label={`Code : ${code.split('').join(' ')}`}>
          {code.slice(0, 3)}
          <span aria-hidden="true">&nbsp;</span>
          {code.slice(3)}
        </p>
      ) : (
        <p className="muted small">{erreur || 'Un code arrive…'}</p>
      )}
      <p className="muted small">
        Sur ton téléphone connecté, en télécommande : « Brancher la télé », puis ce code. Il change toutes les cinq
        minutes.
      </p>
    </section>
  )
}
