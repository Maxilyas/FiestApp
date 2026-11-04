import { createContext, useContext } from 'react'

/**
 * Ouvrir la fiche d'un joueur de n'importe où dans le QG : le QG la pose
 * (`AdminApp`), un prénom la lit. Un module à lui, sans rien d'autre : les
 * pages du QG l'importent toutes, et la fiche importe déjà la moitié d'entre
 * elles.
 */
export const OuvrirLaFiche = createContext<((p: { id: string; nom: string }) => void) | null>(null)

/**
 * Un prénom de joueur au QG : un bouton qui ouvre sa fiche en feuille. La
 * revue d'ergonomie du 4 novembre 2026 : pour libérer Paul, bloqué au palier 5
 * de la campagne, il fallait aller à « Chercher un joueur », taper « Paul »,
 * ouvrir sa fiche — la fiche ne s'ouvrait que de cinq endroits. Hors du QG,
 * ou d'un profil supprimé, le prénom seul, en gras comme avant.
 */
export function PrenomDuJoueur({ id, nom }: { id: string | null | undefined; nom: string }) {
  const ouvrir = useContext(OuvrirLaFiche)
  if (!ouvrir || !id) return <b>{nom}</b>
  return (
    <button type="button" className="qg-prenom" aria-haspopup="dialog" onClick={() => ouvrir({ id, nom })}>
      {nom}
    </button>
  )
}
