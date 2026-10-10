import { useEffect, useState } from 'react'
import { api, motifDe } from '../api'
import { Icon } from '../components/Icon'
import type { Adversaire, IssueDeRencontre, MesRencontres, RencontreDeCampagne } from '../../../shared/campagne'

const bonnes = (n: number) => `${n} bonne${n > 1 ? 's' : ''} réponse${n > 1 ? 's' : ''}`

/** Le score d'une rencontre, toi d'abord : « Toi 7 – Tom 6 ». */
export const scoreDeRencontre = (toi: number, a: Adversaire, lui = a.justes) => `Toi ${toi} – ${a.nom} ${lui}`

/** Ce que dit une rencontre finie, en un mot. */
export const MOT_DE_L_ISSUE: Record<IssueDeRencontre, string> = { gagnee: 'Gagné', egalite: 'Égalité', perdue: 'Perdu' }

/**
 * Affronter un inconnu, sous le défi de la semaine (`#defi`) : un adversaire
 * tout de suite — la série finie d'un autre joueur de son niveau, ses
 * questions, son score à battre —, sans liste d'amis ni attente. Celle
 * laissée en route se reprend ; dessous, les dernières, et qui les a gagnées.
 * La partie elle-même se joue sur l'écran de la série (`CampagneApp`).
 */
export function AffronterUnInconnu({ onJouer }: { onJouer: (r: RencontreDeCampagne) => void }) {
  const [miennes, setMiennes] = useState<MesRencontres | null>(null)
  const [erreur, setErreur] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let vivant = true
    api.campagne.rencontre
      .miennes()
      .then(m => vivant && setMiennes(m))
      // Une liste qui ne vient pas n'empêche pas d'en chercher un : le bouton reste.
      .catch(() => vivant && setMiennes({ enCours: null, passees: [] }))
    return () => {
      vivant = false
    }
  }, [])

  const chercher = async () => {
    if (busy) return
    setBusy(true)
    setErreur('')
    try {
      const r = await api.campagne.rencontre.commencer()
      if (r.serie.question) onJouer(r)
    } catch (e) {
      setErreur(motifDe(e))
    } finally {
      setBusy(false)
    }
  }

  const enCours = miennes?.enCours?.serie.question ? miennes.enCours : null
  return (
    <section className="card rencontre-carte" aria-labelledby="rencontre-titre">
      <h2 id="rencontre-titre">Affronter un inconnu</h2>
      <p className="muted small">Un joueur de ton niveau a fini une série : tu joues les mêmes questions, et son score est à battre.</p>
      {erreur && (
        <p className="error small" role="alert">
          {erreur}
        </p>
      )}
      <button type="button" className="btn btn-block" aria-disabled={busy || undefined} onClick={() => void chercher()}>
        <Icon name="users" />
        {enCours ? `Reprendre contre ${enCours.adversaire.nom} · ${bonnes(enCours.serie.justes)}` : 'Trouver un adversaire'}
      </button>
      {miennes && miennes.passees.length > 0 && (
        <ul className="rencontre-liste" aria-label="Tes dernières rencontres">
          {miennes.passees.map(r => (
            <li key={r.serie} className={r.issue ? `rencontre-${r.issue}` : undefined}>
              <span className="rencontre-adversaire" aria-hidden="true">
                {r.adversaire.avatar}
              </span>
              <b>{scoreDeRencontre(r.justes, r.adversaire)}</b>
              <span className="rencontre-issue">{r.issue ? MOT_DE_L_ISSUE[r.issue] : 'en cours'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
