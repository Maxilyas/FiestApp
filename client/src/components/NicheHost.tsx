import { useSyncExternalStore } from 'react'
import { abonnerNiche, nicheActuelle } from '../niche'
import { aLaDemande, useALaDemande } from '../aLaDemande'

// La niche du compagnon, posée à la racine de chaque page (`main.tsx`), à
// côté des dialogues : elle ne paraît que quand une page qui lit le profil
// l'a posée (`porterNiche`). Son code et ses dessins viennent à la demande :
// l'accueil anonyme et l'invité sans profil n'en téléchargent rien.

const laNiche = aLaDemande(() => import('./Niche'))

export function NicheHost() {
  const niche = useSyncExternalStore(abonnerNiche, nicheActuelle, () => null)
  const module = useALaDemande(laNiche, !!niche)
  if (!niche || !module || module === 'perdu') return null
  return <module.Niche compagnon={niche.compagnon} rang={niche.rang} />
}
