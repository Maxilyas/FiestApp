import { useState, type ReactNode } from 'react'
import { aLaDemande, useALaDemande } from '../aLaDemande'
import { Feuille } from './Pieces'
import { Icon } from './Icon'
import type { FaceAFace, JoueurADefier } from '../../../shared/duels'

/**
 * La feuille des amis (`views/Amis.tsx`), chargée à la demande : l'accueil et
 * la page des duels ne la téléchargent qu'au toucher d'« Amis » — l'accueil
 * d'un profil la fait venir en fond, une fois montré, avec la campagne
 * (`precharger`, `ProfilApp`).
 */
export const lesAmis = aLaDemande(() => import('../views/Amis'))

/** De quoi ouvrir la feuille des amis, et la feuille ouverte, à poser dans la page. */
export function useFeuilleDesAmis(
  gestes: {
    /** Défier ici même (la page des duels) ; sans lui, la carte d'un ami mène à sa préparation. */
    onDefier?: (joueur: JoueurADefier, moi: FaceAFace['moi']) => void
    /** Sa liste a changé : la page qui en dit quelque chose la relit. */
    onAmis?: () => void
  } = {},
): { ouvrir: () => void; feuille: ReactNode } {
  const [ouverte, setOuverte] = useState(false)
  const module = useALaDemande(lesAmis, ouverte)
  const fermer = () => setOuverte(false)
  return {
    ouvrir: () => setOuverte(true),
    feuille: !ouverte ? null : module === 'perdu' ? (
      <Feuille titre="Mes amis" onFermer={fermer}>
        <p className="error" role="alert">
          La liste n’a pas pu se charger : vérifie ta connexion, puis recharge la page.
        </p>
      </Feuille>
    ) : module ? (
      <module.FeuilleDesAmis onFermer={fermer} onDefier={gestes.onDefier} onAmis={gestes.onAmis} />
    ) : null,
  }
}

/**
 * « Amis », au bout de la ligne de son identité sur l'accueil : une icône et
 * son mot, à la taille d'un doigt. La feuille monte sur l'accueil et s'y
 * referme ; « Défier » sur la carte d'un ami mène à sa préparation.
 */
export function BoutonDesAmis() {
  const { ouvrir, feuille } = useFeuilleDesAmis()
  return (
    <>
      <button type="button" className="bouton-des-amis" onClick={ouvrir} onPointerDown={() => void lesAmis.charger().catch(() => {})}>
        <span className="bouton-des-amis-rond" aria-hidden="true">
          <Icon name="users" />
        </span>
        <span>Amis</span>
      </button>
      {feuille}
    </>
  )
}
