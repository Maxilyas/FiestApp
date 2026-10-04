import { useEffect, useState } from 'react'
import { motifDe } from '../api'
import { activerLeRappel, couperLeRappel, preparerLeRappel, rappelPossible, type EtatDuRappel } from '../rappel'
import { showToast } from '../state'
import { HEURE_DU_RAPPEL } from '../../../shared/jour'
import { Icon } from './Icon'

/** Ce que le rappel promet, en une phrase : l'heure, et seulement les jours où il sert. */
export const PROMESSE_DU_RAPPEL = `Une notification vers ${HEURE_DU_RAPPEL} h, seulement les jours où tu n’as pas fini ta partie.`

/**
 * Le rappel du soir, sous le quiz du jour (`client/src/rappel.ts`) : le
 * demander, le couper. Dans l'application installée seulement ; ailleurs,
 * rien — pas même une ligne pour dire qu'il manque.
 */
export function RappelDuJour() {
  const [etat, setEtat] = useState<EtatDuRappel | null>(null)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => {
    if (!rappelPossible()) return
    let vivant = true
    preparerLeRappel()
      .then(e => vivant && setEtat(e))
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])

  /**
   * Un geste, et ce qu'il en dit. Rien n'est attendu avant lui : l'iPhone ne
   * demande la permission qu'au toucher même (`activerLeRappel`).
   */
  const agir = async (geste: () => Promise<EtatDuRappel>) => {
    const avant = etat
    setOccupe(true)
    try {
      const apres = await geste()
      setEtat(apres)
      if (apres === 'actif') showToast({ kind: 'info', message: `C’est noté : vers ${HEURE_DU_RAPPEL} h, les jours où tu n’as pas fini ta partie` })
      else if (avant === 'actif') showToast({ kind: 'info', message: 'Rappel coupé' })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }
  return <RappelVu etat={etat} occupe={occupe} onActiver={() => void agir(activerLeRappel)} onCouper={() => void agir(couperLeRappel)} />
}

/** Ce que l'on voit, selon l'état : rendu seul dans les épreuves. */
export function RappelVu({
  etat,
  occupe,
  onActiver,
  onCouper,
}: {
  etat: EtatDuRappel | null
  occupe: boolean
  onActiver: () => void
  onCouper: () => void
}) {
  if (etat === null) return null
  if (etat === 'bloque') {
    return (
      <p className="rappel-du-soir muted small">
        <Icon name="bell" />
        Les notifications sont bloquées : le rappel du soir se rouvre dans les réglages du téléphone.
      </p>
    )
  }
  if (etat === 'actif') {
    return (
      <p className="rappel-du-soir muted small">
        <Icon name="bell" />
        Rappel du soir activé : vers {HEURE_DU_RAPPEL} h, si tu n’as pas fini ta partie.{' '}
        <button type="button" className="link-inline" disabled={occupe} onClick={onCouper}>
          Le couper
        </button>
      </p>
    )
  }
  return (
    <div className="rappel-du-soir rappel-a-demander">
      <button type="button" className="btn btn-accent btn-block" disabled={occupe} onClick={onActiver}>
        <Icon name="bell" />
        Me le rappeler chaque soir
      </button>
      <p className="muted small">{PROMESSE_DU_RAPPEL}</p>
    </div>
  )
}
