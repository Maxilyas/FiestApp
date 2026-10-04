import { useEffect, useState } from 'react'
import { motifDe } from '../api'
import { activerLeRappel, couperLeRappel, preparerLeRappel, rappelPossible, type EtatDuRappel } from '../rappel'
import { showToast } from '../state'
import { HEURE_DU_RAPPEL } from '../../../shared/jour'
import { Icon } from './Icon'

/** Ce que la cloche dit au toucher : ce qui change, ou ce qui l'empêche. */
export const DIT_LA_CLOCHE = {
  active: `Rappel du soir activé : vers ${HEURE_DU_RAPPEL} h, les jours où tu n’as pas fini ta partie`,
  coupe: 'Rappel du soir coupé',
  bloque: 'Les notifications sont bloquées : le rappel du soir se rouvre dans les réglages du téléphone',
}

/**
 * Ce qu'un toucher fait, selon l'état : bloquée, la cloche ne peut que dire
 * où se débloquer — seuls les réglages du téléphone rouvrent une permission
 * refusée.
 */
export function gesteDeLaCloche(etat: EtatDuRappel): 'activer' | 'couper' | 'expliquer' {
  return etat === 'actif' ? 'couper' : etat === 'bloque' ? 'expliquer' : 'activer'
}

/**
 * La cloche du rappel du soir, en haut de la page du jour, à côté de la
 * sortie (`client/src/rappel.ts`) : un toucher l'active, un autre la coupe.
 * Petite, exprès : un bouton en pleine page disait « Me le rappeler » à qui
 * venait jouer (le propriétaire du dépôt, le 4 octobre 2026). Dans
 * l'application installée seulement ; ailleurs, rien — pas même une cloche
 * grise pour dire qu'il manque.
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
   * Rien n'est attendu avant le geste : l'iPhone ne demande la permission
   * qu'au toucher même (`activerLeRappel`).
   */
  const toucher = async () => {
    if (!etat) return
    const geste = gesteDeLaCloche(etat)
    if (geste === 'expliquer') return showToast({ kind: 'info', message: DIT_LA_CLOCHE.bloque })
    setOccupe(true)
    try {
      const apres = await (geste === 'couper' ? couperLeRappel() : activerLeRappel())
      setEtat(apres)
      // La demande de permission écartée d'un geste ne change rien : rien à dire.
      if (apres === 'actif') showToast({ kind: 'info', message: DIT_LA_CLOCHE.active })
      else if (apres === 'bloque') showToast({ kind: 'info', message: DIT_LA_CLOCHE.bloque })
      else if (geste === 'couper') showToast({ kind: 'info', message: DIT_LA_CLOCHE.coupe })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }
  return <ClocheVue etat={etat} occupe={occupe} onToucher={() => void toucher()} />
}

/** La cloche telle qu'on la voit, selon l'état : rendue seule dans les épreuves. */
export function ClocheVue({ etat, occupe, onToucher }: { etat: EtatDuRappel | null; occupe: boolean; onToucher: () => void }) {
  if (etat === null) return null
  // Bloquée, elle ne bascule plus : un bouton qui dit où se débloquer, pas un interrupteur.
  if (etat === 'bloque') {
    return (
      <button type="button" className="cloche-du-rappel" aria-label="Rappel du soir : notifications bloquées" onClick={onToucher}>
        <Icon name="bell-off" />
      </button>
    )
  }
  return (
    <button
      type="button"
      className="cloche-du-rappel"
      // Un interrupteur : l'état ne se dit que par `aria-pressed` — un nom ou
      // une infobulle qui changeraient avec lui le rediraient (`design.test.ts`).
      aria-pressed={etat === 'actif'}
      aria-label="Rappel du soir"
      title={`Une notification vers ${HEURE_DU_RAPPEL} h, les jours où ta partie n’est pas finie`}
      disabled={occupe}
      onClick={onToucher}
    >
      <Icon name="bell" />
    </button>
  )
}
