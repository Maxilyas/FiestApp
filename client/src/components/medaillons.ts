import { useEffect, useSyncExternalStore } from 'react'
import { divin as divinDe } from '../../../shared/divins'
import { legendaire as legendaireDe } from '../../../shared/legendaires'
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
 *
 * Chaque sorte vient seule : les Divins sont les plus rares des récompenses,
 * et le premier légendaire d'une salle les faisait venir avec lui — six
 * kilo-octets chez chaque téléphone de la salle, et chez chaque profil qui
 * voit la silhouette de saison du quiz du jour, pour ne rien afficher.
 */

/** Les deux sortes de dessins, chacune dans son fichier. */
export type Sorte = 'legendaire' | 'divin'
const SORTES: readonly Sorte[] = ['legendaire', 'divin']

/**
 * Les sortes de dessins que demandent ces médaillons — légendaires ou Divins,
 * une clé inconnue ne demande rien.
 */
export function sortesDe(cles: readonly (string | null | undefined)[]): Sorte[] {
  return SORTES.filter(sorte => cles.some(c => !!c && !!(sorte === 'divin' ? divinDe(c) : legendaireDe(c))))
}

interface Dessins {
  Legendaire?: typeof Legendaire
  Divin?: typeof Divin
  /**
   * Les sortes dont le chargement a échoué : c'est pour toute la page. Le
   * navigateur garde l'échec d'un `import()` — le même fichier redemandé
   * échoue aussitôt, sans requête —, et après un redéploiement l'ancienne
   * empreinte répond 404 de toute façon. Réessayer ne ferait que redessiner
   * la page à chaque avatar : l'emoji tient la place, et ce qui n'a pas
   * d'emoji le dit — la carte cache ses galeries, la fin de soirée mène au
   * profil.
   */
  echecs?: readonly Sorte[]
}

let dessins: Dessins = {}
const enRoute: Partial<Record<Sorte, Promise<void>>> = {}
const abonnes = new Set<() => void>()

/**
 * Ce qui va chercher le fichier d'une sorte — remplaçable par un test, qui
 * simule une coupure sans navigateur.
 */
export const chargeur = {
  importer: (sorte: Sorte): Promise<unknown> => (sorte === 'divin' ? import('./Divin') : import('./Legendaire')),
}

/** Appelé par `Legendaire.tsx` et `Divin.tsx` à leur évaluation. */
export function inscrireDessin(d: Dessins) {
  dessins = { ...dessins, ...d }
  for (const f of abonnes) f()
}

/** Le dessin de cette sorte est-il là ? */
function present(d: Dessins, sorte: Sorte): boolean {
  return !!(sorte === 'divin' ? d.Divin : d.Legendaire)
}

/** Le dessin de cette sorte ne viendra plus : son chargement a échoué. */
function perdu(d: Dessins, sorte: Sorte): boolean {
  return !present(d, sorte) && !!d.echecs?.includes(sorte)
}

/** Ces dessins — les deux sortes, par défaut — sont-ils tous là ? */
export function complets(d: Dessins = dessins, sortes: readonly Sorte[] = SORTES): boolean {
  return sortes.every(s => present(d, s))
}

/** L'un de ces dessins ne viendra plus : la page dit autre chose à sa place. */
export function perdus(d: Dessins, sortes: readonly Sorte[]): boolean {
  return sortes.some(s => perdu(d, s))
}

/** L'un de ces dessins est encore attendu : ni là, ni perdu. */
export function attendus(d: Dessins, sortes: readonly Sorte[]): boolean {
  return sortes.some(s => !present(d, s) && !perdu(d, s))
}

/**
 * Lance le chargement de ces sortes — les deux, par défaut —, une fois par
 * sorte pour toute la page, un échec compris. La promesse ne rejette jamais :
 * qui l'attend repart, avec ou sans dessins.
 */
export function chargerDessins(sortes: readonly Sorte[] = SORTES): Promise<void> {
  return Promise.all(sortes.map(charger)).then(() => {})
}

function charger(sorte: Sorte): Promise<void> {
  if (present(dessins, sorte) || perdu(dessins, sorte)) return Promise.resolve()
  return (enRoute[sorte] ??= chargeur.importer(sorte).then(
    () => {},
    () => inscrireDessin({ echecs: [...(dessins.echecs ?? []), sorte] }),
  ))
}

/** Ce qu'une page accepte d'attendre ses dessins avant de s'afficher sans eux. */
export const ATTENTE_MAX_DESSINS = 2500

/**
 * Ces dessins, attendus au plus `ms` : une requête qui ne répond pas — une 4G
 * qui traîne, un proxy muet — ne doit pas garder un téléphone sous « On
 * arrive… ». Passé ce délai, l'emoji tient la place, et le médaillon le
 * remplace s'il finit par arriver.
 */
export function chargerDessinsAuPlus(sortes: readonly Sorte[], ms = ATTENTE_MAX_DESSINS): Promise<void> {
  if (!attendus(dessins, sortes)) return Promise.resolve()
  return Promise.race([chargerDessins(sortes), new Promise<void>(r => setTimeout(r, ms))])
}

const abonner = (f: () => void) => {
  abonnes.add(f)
  return () => {
    abonnes.delete(f)
  }
}
const lire = () => dessins

/**
 * Les dessins, pour un composant qui en affiche : les sortes `voulues`
 * se chargent si elles manquent — aucune, il ne fait que lire —, et le
 * composant se redessine à leur arrivée.
 */
export function useDessins(...voulues: Sorte[]): Dessins {
  const d = useSyncExternalStore(abonner, lire, lire)
  // Une chaîne, pas un tableau neuf à chaque rendu : l'effet ne repart que
  // quand ce qui manque change.
  const manquent = voulues.filter(s => !present(d, s) && !perdu(d, s)).join(' ')
  useEffect(() => {
    if (manquent) void chargerDessins(manquent.split(' ') as Sorte[])
  }, [manquent])
  return d
}
