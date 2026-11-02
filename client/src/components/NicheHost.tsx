import { useSyncExternalStore } from 'react'
import { abonnerNiche, nicheMontree } from '../niche'
import { aLaDemande, useALaDemande } from '../aLaDemande'

// La niche du compagnon, posée à la racine de chaque page (`main.tsx`), à
// côté des dialogues : elle ne paraît que quand une page qui lit le profil
// l'a posée (`porterNiche`) — ou que la boutique y fait essayer un compagnon
// (`essayerNiche`). Son code et ses dessins viennent à la demande : l'accueil
// anonyme et l'invité sans profil n'en téléchargent rien.

/**
 * Le code de la niche, une fois pour toute la page : l'écran « Mon
 * compagnon » du profil et la carte d'un joueur qui en a un le partagent
 * avec elle.
 */
export const laNiche = aLaDemande(() => import('./Niche'))

export function NicheHost() {
  const niche = useSyncExternalStore(abonnerNiche, nicheMontree, () => null)
  const module = useALaDemande(laNiche, !!niche)
  if (!niche || !module || module === 'perdu') return null
  return <module.Niche {...niche} />
}
