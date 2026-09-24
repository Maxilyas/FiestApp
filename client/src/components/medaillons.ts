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
  /**
   * Le chargement a échoué : c'est pour toute la page. Le navigateur garde
   * l'échec d'un `import()` — le même fichier redemandé échoue aussitôt, sans
   * requête —, et après un redéploiement l'ancienne empreinte répond 404 de
   * toute façon. Réessayer ne ferait que redessiner la page à chaque avatar :
   * l'emoji tient la place, et ce qui n'a pas d'emoji le dit (`Dessin`).
   */
  echec?: boolean
}

let dessins: Dessins = {}
let enRoute: Promise<void> | null = null
const abonnes = new Set<() => void>()

/**
 * Ce qui va chercher les deux fichiers — remplaçable par un test, qui simule
 * une coupure sans navigateur.
 */
export const chargeur = {
  importer: (): Promise<unknown> => Promise.all([import('./Legendaire'), import('./Divin')]),
}

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
 * Lance le chargement, une fois pour toute la page — un échec compris. La
 * promesse ne rejette jamais : qui l'attend repart, avec ou sans dessins.
 */
export function chargerDessins(): Promise<void> {
  if (complets() || dessins.echec) return Promise.resolve()
  enRoute ??= chargeur.importer().then(
    () => {},
    () => inscrireDessin({ echec: true }),
  )
  return enRoute
}

/** Ce qu'une page accepte d'attendre ses dessins avant de s'afficher sans eux. */
export const ATTENTE_MAX_DESSINS = 2500

/**
 * Les dessins, attendus au plus `ms` : une requête qui ne répond pas — une 4G
 * qui traîne, un proxy muet — ne doit pas garder un téléphone sous « On
 * arrive… ». Passé ce délai, l'emoji tient la place, et le médaillon le
 * remplace s'il finit par arriver.
 */
export function chargerDessinsAuPlus(ms = ATTENTE_MAX_DESSINS): Promise<void> {
  return Promise.race([chargerDessins(), new Promise<void>(r => setTimeout(r, ms))])
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
