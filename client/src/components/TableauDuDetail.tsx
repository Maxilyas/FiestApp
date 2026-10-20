import { useEffect, useState } from 'react'
import { espacesFines } from '../format'
import { serverNow } from '../clock'
import { CADRAGES_DU_DETAIL, adresseDuCadrage, cadragesMontres, instantDuCadrage, type DetailAPoser } from '../../../shared/expedition'

/**
 * Le cadrage d'un détail (v15) qui se montre à l'heure du serveur — le
 * premier dès la question vue, puis un tous les `MS_PAR_CADRAGE` —, relu à
 * l'heure de chaque suivant (`serverNow()`, invariant 6). Arrêt sur image
 * change l'heure : la vue la porte, l'effet repart.
 */
export function useCadrage(detail: DetailAPoser | undefined): number {
  const lire = () => (detail ? Math.max(1, cadragesMontres(detail.depuis, serverNow(), detail.arret)) : 1)
  const [k, setK] = useState(lire)
  useEffect(() => {
    if (!detail) return
    let minuterie: ReturnType<typeof setTimeout> | undefined
    const suivre = () => {
      const n = lire()
      setK(n)
      if (n < CADRAGES_DU_DETAIL) minuterie = setTimeout(suivre, Math.max(50, instantDuCadrage(n + 1, detail.depuis, detail.arret) - serverNow()))
    }
    suivre()
    return () => clearTimeout(minuterie)
    // L'heure du détail suffit : `lire` n'en lit pas d'autre, et un objet neuf à chaque vue relancerait la minuterie pour rien.
  }, [detail?.depuis, detail?.arret])
  return k
}

/**
 * Le cadrage montré : le dernier chargé reste à l'écran tant que le suivant
 * se charge — sans quoi le tableau clignotait à chaque cadrage. Demandé trop
 * tôt (l'horloge du téléphone en avance), la route répond 425 : on le
 * redemande un peu plus tard, à une adresse neuve.
 */
function useImageChargee(adresse: string): string | null {
  const [chargee, setChargee] = useState<string | null>(null)
  useEffect(() => {
    let essais = 0
    let minuterie: ReturnType<typeof setTimeout> | undefined
    let fini = false
    const charger = () => {
      const img = new Image()
      const src = essais === 0 ? adresse : `${adresse}?essai=${essais}`
      img.onload = () => !fini && setChargee(src)
      img.onerror = () => {
        if (!fini && ++essais <= 8) minuterie = setTimeout(charger, 400 * essais)
      }
      img.src = src
    }
    charger()
    return () => {
      fini = true
      clearTimeout(minuterie)
    }
  }, [adresse])
  return chargee
}

/**
 * Le tableau d'un détail, la question sous les yeux (v15) : le cadrage du
 * moment, sa jauge en quatre pas, et la consigne. Le tableau ne se nomme
 * nulle part : l'image seule, sans texte alternatif qui le dirait.
 */
export function DetailQuiSElargit({ expedition, position, cadrage }: { expedition: string; position: number; cadrage: number }) {
  const src = useImageChargee(adresseDuCadrage(expedition, position, cadrage))
  const entier = cadrage >= CADRAGES_DU_DETAIL
  return (
    <div className="exp-detail">
      <div className="exp-detail-cadre">{src && <img src={src} alt={entier ? 'Le tableau entier' : `Un détail du tableau, ${cadrage} sur ${CADRAGES_DU_DETAIL}`} />}</div>
      <div className="exp-detail-pas" role="progressbar" aria-label="Le tableau s’élargit" aria-valuemin={1} aria-valuemax={CADRAGES_DU_DETAIL} aria-valuenow={cadrage}>
        {Array.from({ length: CADRAGES_DU_DETAIL }, (_, i) => (
          <i key={i} className={i < cadrage ? 'exp-detail-vu' : undefined} />
        ))}
      </div>
      <p className="exp-consigne small">{entier ? 'Tout le tableau est là.' : espacesFines('Le tableau s’élargit pas à pas : réponds dès que tu sais.')}</p>
    </div>
  )
}
