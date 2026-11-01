import { useEffect, useState } from 'react'
import { BandeauALaUne } from './ALaUne'
import { FeuilleDesMissions, LigneDesMissions } from './Missions'
import { useMissionsDuJour } from '../missions'
import type { BoutiqueDuProfil } from '../../../shared/themes'

// Le haut de l'accueil d'un profil, sous son identité : « À la une », puis la
// ligne des missions du jour, qui ouvre leur feuille (la maquette C du 14
// octobre 2026). À la demande (`ProfilApp`) : l'accueil anonyme partage la
// page et n'en télécharge rien — ni les catalogues des missions, ni les
// aperçus des thèmes.

/** L'adresse qui ouvre la feuille des missions : la fin d'une partie et la fiche d'un fond du trésor y mènent (`/#missions`). */
const ADRESSE_DES_MISSIONS = '#missions'

/**
 * `aLaUne` faux : l'affiche d'une nouveauté se montre au-dessus (`AfficheDeLaNouveaute`) — elle prend la place de
 * « À la une » le temps qu'il y aille ou la range. Deux affiches l'une sur l'autre poussaient les gros boutons sous la
 * barre du menu, en 360 × 640 (`rendu-affiches.ts`) ; ce qui sort passe avant ce qui se vend.
 */
export function HautDeLAccueil({ boutique, aLaUne = true }: { boutique?: BoutiqueDuProfil; aLaUne?: boolean }) {
  const missions = useMissionsDuJour(true)
  const [feuille, setFeuille] = useState(() => window.location.hash === ADRESSE_DES_MISSIONS)
  useEffect(() => {
    // L'adresse a servi : elle s'efface, pour qu'un rechargement ne rouvre pas la feuille refermée.
    const lire = () => {
      if (window.location.hash !== ADRESSE_DES_MISSIONS) return
      setFeuille(true)
      history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}`)
    }
    lire()
    window.addEventListener('hashchange', lire)
    return () => window.removeEventListener('hashchange', lire)
  }, [])
  return (
    <div className="haut-accueil">
      {boutique && aLaUne && <BandeauALaUne boutique={boutique} />}
      <LigneDesMissions missions={missions} onOuvrir={() => setFeuille(true)} />
      {feuille && <FeuilleDesMissions missions={missions} onFermer={() => setFeuille(false)} />}
    </div>
  )
}
