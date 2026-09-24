import { useEffect, useSyncExternalStore } from 'react'
import type { Legendaire } from './Legendaire'
import type { Divin } from './Divin'

/**
 * Les dessins des légendaires et des Divins, chargés à la demande.
 *
 * Ce sont cinquante kilo-octets de SVG, et la plupart des invités n'en
 * verront jamais un : un anonyme n'en porte pas, et le premier légendaire
 * tombe vers la vingtième soirée. Importés par `Avatar`, ils partaient
 * pourtant chez chaque téléphone qui scannait le QR, devant l'écran d'entrée.
 * Ils ne viennent plus que chez qui en a besoin : un profil, une salle où
 * quelqu'un en porte un, une carte qu'on ouvre.
 *
 * Une page qui les importe elle-même (l'écran commun, par la clôture ; le
 * profil, par sa galerie) les inscrit ici en les évaluant : ils y sont avant
 * le premier rendu, et rien n'attend.
 */

interface Dessins {
  Legendaire?: typeof Legendaire
  Divin?: typeof Divin
  /** Le dernier chargement a échoué : on n'attend plus, l'emoji tient la place. */
  echec?: boolean
}

let dessins: Dessins = {}
let enRoute: Promise<void> | null = null
const abonnes = new Set<() => void>()

/** Appelé par `Legendaire.tsx` et `Divin.tsx` à leur évaluation. */
export function inscrireDessin(d: Dessins) {
  dessins = { ...dessins, ...d }
  for (const f of abonnes) f()
}

/** Les deux dessins sont-ils là ? */
export function complets(d: Dessins = dessins): boolean {
  return !!(d.Legendaire && d.Divin)
}

/**
 * Lance le chargement, une fois. Un réseau coupé ne laisse pas de promesse
 * rejetée : le prochain besoin réessaie, et d'ici là l'emoji tient la place.
 */
export function chargerDessins(): Promise<void> {
  if (complets()) return Promise.resolve()
  if (!enRoute && dessins.echec) inscrireDessin({ echec: false })
  enRoute ??= Promise.all([import('./Legendaire'), import('./Divin')]).then(
    () => {},
    () => {
      enRoute = null
      inscrireDessin({ echec: true })
    },
  )
  return enRoute
}

const abonner = (f: () => void) => {
  abonnes.add(f)
  return () => {
    abonnes.delete(f)
  }
}
const lire = () => dessins

/**
 * Les dessins, pour un composant qui en affiche : `voulu` lance le
 * chargement s'ils manquent, et le composant se redessine à leur arrivée.
 */
export function useDessins(voulu: boolean): Dessins {
  const d = useSyncExternalStore(abonner, lire, lire)
  const manque = voulu && !complets(d)
  useEffect(() => {
    if (manque) void chargerDessins()
  }, [manque])
  return d
}

/** Quelqu'un, dans cette liste, porte-t-il un dessin ? */
export function porteUnDessin(joueurs: readonly { legendaire?: string | null }[] | undefined): boolean {
  return !!joueurs?.some(j => j.legendaire)
}
