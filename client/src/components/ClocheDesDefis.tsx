import { useEffect, useState } from 'react'
import { motifDe } from '../api'
import { activerLeRappel, couperLeRappel, preparerLeRappel, rappelPossible, type EtatDuRappel } from '../rappel'
import { showToast } from '../state'
import { ClocheVue, gesteDeLaCloche } from './RappelDuJour'

/** Ce que la cloche des défis dit au toucher : ce qui change, ou ce qui l'empêche. */
export const DIT_LA_CLOCHE_DES_DEFIS = {
  active: 'Ton téléphone sonnera quand on te défie',
  coupe: 'Les duels ne sonneront plus : ils t’attendent dans tes duels',
  bloque: 'Les notifications sont bloquées : elles se rouvrent dans les réglages du téléphone',
}

/**
 * La cloche des défis, en haut à droite de la page des duels, à côté de la
 * sortie — là où la page du jour a celle du soir (le souhait du propriétaire
 * du 12 octobre 2026) : allumée, son téléphone sonne quand on le défie — à
 * la dernière réponse de qui l'a lancé —, et quand un duel qu'il a lancé
 * vient d'être joué. Coupée d'office : seul son toucher l'allume. Dans
 * l'application installée seulement, comme celle du soir ; ailleurs, rien.
 * Elle tenait une ligne à elle sous ses amis, une phrase à côté.
 */
export function ClocheDesDefis() {
  const [etat, setEtat] = useState<EtatDuRappel | null>(null)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => {
    if (!rappelPossible()) return
    let vivant = true
    preparerLeRappel('defis')
      .then(e => vivant && setEtat(e))
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [])

  /** Rien n'est attendu avant le geste : l'iPhone ne demande la permission qu'au toucher même (`activerLeRappel`). */
  const toucher = async () => {
    if (!etat) return
    const geste = gesteDeLaCloche(etat)
    if (geste === 'expliquer') return showToast({ kind: 'info', message: DIT_LA_CLOCHE_DES_DEFIS.bloque })
    setOccupe(true)
    try {
      const apres = await (geste === 'couper' ? couperLeRappel('defis') : activerLeRappel('defis'))
      setEtat(apres)
      if (apres === 'actif') showToast({ kind: 'info', message: DIT_LA_CLOCHE_DES_DEFIS.active })
      else if (apres === 'bloque') showToast({ kind: 'info', message: DIT_LA_CLOCHE_DES_DEFIS.bloque })
      else if (geste === 'couper') showToast({ kind: 'info', message: DIT_LA_CLOCHE_DES_DEFIS.coupe })
    } catch (e) {
      showToast({ kind: 'error', message: motifDe(e) })
    } finally {
      setOccupe(false)
    }
  }
  return <ClocheVue etat={etat} occupe={occupe} onToucher={() => void toucher()} nom="Notification des défis" titre="Une notification quand on te défie, et quand ton duel est joué" />
}
