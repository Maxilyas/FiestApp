import { useEffect, useState } from 'react'

/**
 * Un module chargé à la demande, sans `lazy` ni `Suspense`.
 *
 * Un composant paresseux suspend au moins une fois, même son fichier déjà
 * téléchargé, et React retient alors trois dixièmes de seconde ce qui sort
 * de l'attente : la grille du profil paraissait 350 ms plus tard, préchargée
 * ou non, la fin de soirée passait par « Connexion… », la carte d'un joueur
 * s'ouvrait en retard. Ici, un module déjà là se rend tout de suite.
 */
export interface ALaDemande<M> {
  /** Lance le chargement, une fois pour toute la page — un échec compris. */
  charger(): Promise<M>
  /** Le module, s'il est déjà là. */
  charge(): M | null
}

export function aLaDemande<M>(importer: () => Promise<M>): ALaDemande<M> {
  let module: M | null = null
  let enRoute: Promise<M> | null = null
  return {
    charger: () => (enRoute ??= importer().then(m => (module = m))),
    charge: () => module,
  }
}

/**
 * Le module, pour un composant qui en a besoin (`voulu`) : `null` en
 * chemin, `'perdu'` s'il ne viendra plus — le navigateur garde l'échec d'un
 * `import()`, redemander n'y changerait rien.
 */
export function useALaDemande<M>(source: ALaDemande<M>, voulu = true): M | 'perdu' | null {
  const [arrive, setArrive] = useState<M | 'perdu' | null>(null)
  const deja = source.charge()
  useEffect(() => {
    if (!voulu || deja || arrive) return
    let vivant = true
    source.charger().then(
      m => vivant && setArrive(m),
      () => vivant && setArrive('perdu'),
    )
    return () => {
      vivant = false
    }
  }, [voulu, deja, arrive, source])
  return deja ?? arrive
}
