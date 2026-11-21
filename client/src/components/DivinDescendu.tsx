import { useState } from 'react'
import { api } from '../api'
import { showToast } from '../state'
import { divin } from '../../../shared/divins'
import { Medaillon } from './Ouverts'

/**
 * Un Divin descendu sur une partie, révélé avant tout le reste, et qu'on
 * porte d'un toucher — la même carte à la fin de chaque mode où l'un d'eux
 * peut descendre (le quiz du jour d'abord, le 5 octobre 2026 ; le défi de la
 * semaine et les sentiers depuis le 21 novembre 2026). Elle ne dit que son
 * nom et le récit que le serveur envoie à son seul porteur : rien ici ne sait
 * ce qui l'a fait descendre (invariant 21).
 */
export function DivinDescendu({ cle, legende, ton, dejaPorte }: { cle: string; legende: string; ton: 'eclat' | 'ombre'; dejaPorte: boolean }) {
  const [porte, setPorte] = useState(dejaPorte)
  const d = divin(cle)
  if (!d) return null
  const porter = async () => {
    try {
      const { profile } = await api.joueur.enregistrer({ legendaire: cle })
      setPorte(profile.legendaire === cle)
      showToast({ kind: 'info', message: `Tu portes ${d.nom}` })
    } catch (e) {
      showToast({ kind: 'error', message: (e as Error).message })
    }
  }
  return (
    <section className={`card fin-divin fin-divin-${ton}`}>
      <span className="label">Un Divin est descendu sur toi</span>
      <Medaillon cle={cle} className="fin-apparition" />
      <h2>{d.nom}</h2>
      {legende && <p className="serif-note">{legende}</p>}
      {porte ? (
        <p className="muted small">C’est lui que la salle verra, dès la prochaine soirée.</p>
      ) : (
        <button className="btn btn-primary" onClick={() => void porter()}>
          Le porter
        </button>
      )}
    </section>
  )
}
