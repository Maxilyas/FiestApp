import { useEffect, useState, type ReactNode } from 'react'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { showToast } from '../state'
import type { GestesDeLaCarte } from './GestesDuJoueur'
import type { RepliDeCarte } from './CarteJoueur'

/** La carte d'un joueur, au toucher de son nom : rien ne la télécharge avant. */
const carteJoueur = aLaDemande(() => import('./CarteJoueur'))

/**
 * La carte d'un profil touché hors d'une soirée — un classement de défi,
 * celui des duels, ses amis, une recherche —, comme au classement du jour
 * (le souhait du propriétaire du 11 octobre 2026 : « reprendre comme de
 * partout la carte qui s'affiche du joueur »). Rend de quoi l'ouvrir, et la
 * carte ouverte, à poser dans la page : ses gestes au pied — le défier,
 * l'ajouter à ses amis (`GestesDuJoueur`) —, que `gestes` mène ici même.
 * À part, et sans rien de lourd : la feuille des amis s'ouvre sur l'accueil,
 * qui ne télécharge pas la page du défi.
 */
export function useCarteDUnProfil(gestes?: Omit<GestesDeLaCarte, 'profileId'>): {
  ouvrir: (profileId: string, repli?: RepliDeCarte) => void
  carte: ReactNode
} {
  const [carte, setCarte] = useState<string | null>(null)
  const [repli, setRepli] = useState<RepliDeCarte | undefined>(undefined)
  const laCarte = useALaDemande(carteJoueur, !!carte)
  useEffect(() => {
    if (!carte || laCarte !== 'perdu') return
    showToast({ kind: 'error', message: 'La carte ne s’ouvre pas : vérifie ta connexion.' })
    setCarte(null)
  }, [carte, laCarte])
  return {
    ouvrir: (profileId, r) => {
      setRepli(r)
      setCarte(profileId)
    },
    carte:
      carte && laCarte && laCarte !== 'perdu' ? (
        <laCarte.CarteJoueur
          key={carte}
          adresse={`/api/joueur/carte/${encodeURIComponent(carte)}`}
          gestes={{ ...gestes, profileId: carte }}
          repli={repli}
          onFermer={() => setCarte(null)}
        />
      ) : null,
  }
}
