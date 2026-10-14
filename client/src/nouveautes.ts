// La pastille rouge de « Profil », dans la barre du menu : ce qu'il a de neuf
// à porter depuis son dernier passage dans sa loge (le souhait du propriétaire
// du 14 octobre 2026 : « un petit indicateur rouge, comme les notifications
// des duels », qui donne envie d'aller voir). La pastille dorée « Nouveau » de
// « M'habiller » ne se voyait qu'une fois sur la page du profil.
//
// À part de la barre (`components/Pieces.tsx`) : l'entrée d'une soirée la
// partage, et n'a que faire de l'API du profil.
import { useEffect, useState } from 'react'
import { api } from './api'

const CLE = 'quizz.nouveautes'

/** Le dernier compte connu sur cet onglet : la barre le montre en attendant le serveur, plutôt que rien puis un chiffre. */
export function dernierCompte(): number {
  // Sous try/catch : des cookies bloqués donnaient une page noire.
  try {
    const n = Number(sessionStorage.getItem(CLE))
    return Number.isInteger(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

/** Le compte que la page vient de lire — du serveur, ou de la loge qui vient de regarder une pièce. */
export function retenirLeCompte(n: number) {
  try {
    sessionStorage.setItem(CLE, String(n))
  } catch {
    // Stockage refusé : la barre attendra le serveur, rien ne casse.
  }
}

/**
 * Le compte de la barre, sur une page qui ne lit pas le détail du profil —
 * l'accueil, ses quiz, son compte : demandé une fois, après l'affichage (la
 * page n'attend rien de plus). `demander` faux, le dernier compte connu,
 * sans rien demander : la page du profil le recompte elle-même.
 */
export function useNouveautesDuMenu(demander: boolean): number {
  const [n, setN] = useState(dernierCompte)
  useEffect(() => {
    if (!demander) return
    let vivant = true
    api.joueur.nouveautes().then(
      r => {
        retenirLeCompte(r.nouveautes)
        if (vivant) setN(r.nouveautes)
      },
      // Un réseau qui coupe : la pastille garde son dernier compte.
      () => {},
    )
    return () => {
      vivant = false
    }
  }, [demander])
  return n
}
