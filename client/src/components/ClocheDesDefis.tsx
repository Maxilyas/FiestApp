import { useEffect, useState } from 'react'
import { motifDe } from '../api'
import { activerLeRappel, couperLeRappel, preparerLeRappel, rappelPossible, type EtatDuRappel } from '../rappel'
import { estInstallee, telephone } from '../installation'
import { showToast } from '../state'
import { ClocheVue, gesteDeLaCloche } from './RappelDuJour'

/** Ce que la cloche des défis dit au toucher : ce qui change, ou ce qui l'empêche. */
export const DIT_LA_CLOCHE_DES_DEFIS = {
  active: 'Ton téléphone sonnera quand on te défie',
  coupe: 'Les duels ne sonneront plus : ils t’attendent dans tes duels',
  bloque: 'Les notifications sont bloquées : elles se rouvrent dans les réglages du téléphone',
}

/**
 * La cloche des duels, dans la page des duels (`rappel.ts`, la cloche
 * `defis`) : allumée, son téléphone sonne quand on le défie — à la dernière
 * réponse de qui l'a lancé —, et quand un duel qu'il a lancé vient d'être
 * joué. Une ligne, la cloche devant ce qu'elle fait : seule, une cloche dans
 * une carte ne disait pas de quoi. Dans l'application installée seulement,
 * comme celle du soir ; sur un téléphone qui ne l'a pas installée, une
 * phrase dit où la trouver ; sur un ordinateur, rien.
 */
export function ClocheDesDefis() {
  const [possible] = useState(rappelPossible)
  const [etat, setEtat] = useState<EtatDuRappel | null>(null)
  const [occupe, setOccupe] = useState(false)
  useEffect(() => {
    if (!possible) return
    let vivant = true
    preparerLeRappel('defis')
      .then(e => vivant && setEtat(e))
      .catch(() => {})
    return () => {
      vivant = false
    }
  }, [possible])

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

  if (!possible) {
    let surUnTelephone = false
    try {
      surUnTelephone = telephone() !== null && !estInstallee()
    } catch {
      // Sans de quoi le savoir, rien à promettre.
    }
    return surUnTelephone ? <p className="muted small cloche-des-defis-ailleurs">Installe l’application : ton téléphone sonnera quand on te défie.</p> : null
  }
  if (etat === null) return null
  return (
    <div className="cloche-des-defis">
      <ClocheVue etat={etat} occupe={occupe} onToucher={() => void toucher()} nom="Les duels" titre="Une notification quand on te défie, et quand ton duel est joué" />
      <span className="small">{etat === 'bloque' ? 'Notifications bloquées sur ce téléphone' : 'Mon téléphone sonne quand on me défie'}</span>
    </div>
  )
}
