import { useEffect, useSyncExternalStore } from 'react'
import { divin as divinDe } from '../../../shared/divins'
import { legendaire as legendaireDe } from '../../../shared/legendaires'
import { BRANCHES, portrait as portraitDe, type CleDeBranche } from '../../../shared/branches'
import type { Legendaire } from './Legendaire'
import type { Divin } from './Divin'
import type { Portrait } from './Portrait'
import type { Lumiere } from './Lumiere'
import type { DessinDePortrait } from './portraits/outils'

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
 *
 * Les portraits des branches (`shared/branches.ts`) viennent branche par
 * branche : soixante-douze dessins, et une salle n'en porte que quelques-uns.
 * Qui porte le cerf fait venir la forêt, pas l'océan.
 *
 * La lumière des finitions 15, 20 et 25 (`Lumiere.tsx`) vient de même : il
 * faut des dizaines de soirées pour la porter, et une salle d'anonymes ne la
 * verra jamais.
 */

/** Les sortes de dessins, chacune dans son fichier : les légendaires, les Divins, la lumière des finitions, et chaque branche. */
export type Sorte = 'legendaire' | 'divin' | 'lumiere' | `branche:${CleDeBranche}`
/**
 * Les médaillons : ce qu'un profil peut gagner d'un coup à la fin d'une
 * soirée, que sa page fait venir d'office. Pas les branches : la fin de
 * soirée fait venir celle du portrait qu'elle annonce.
 */
const MEDAILLONS: readonly Sorte[] = ['legendaire', 'divin']
const SORTES: readonly Sorte[] = [...MEDAILLONS, 'lumiere', ...BRANCHES.map(b => `branche:${b.key}` as const)]

/** Les finitions qui ont leur lumière : le Diamant, les Voiles, l'Astrolabe. */
export const FINITIONS_LUMINEUSES = ['prisme', 'aurore', 'constellation'] as const
export type FinitionLumineuse = (typeof FINITIONS_LUMINEUSES)[number]

/** Cette finition a-t-elle sa lumière ? Laquelle, ou null. */
export function lumineuse(finition: string | null | undefined): FinitionLumineuse | null {
  return FINITIONS_LUMINEUSES.find(f => f === finition) ?? null
}

/** La sorte d'un avatar dessiné ; null pour un emoji, une clé inconnue. */
function sorteDe(cle: string | null | undefined): Sorte | null {
  if (!cle) return null
  if (divinDe(cle)) return 'divin'
  if (legendaireDe(cle)) return 'legendaire'
  const p = portraitDe(cle)
  return p ? `branche:${p.branche}` : null
}

/**
 * Les sortes de dessins que demandent ces avatars — légendaires, Divins,
 * branches ; un emoji ou une clé inconnue ne demande rien.
 */
export function sortesDe(cles: readonly (string | null | undefined)[]): Sorte[] {
  const voulues = new Set(cles.map(sorteDe))
  return SORTES.filter(sorte => voulues.has(sorte))
}

/**
 * Ce que demandent ces avatars portés : leurs médaillons, et la lumière de
 * leur finition — sauf sous un Divin, qui n'en prend pas.
 */
export function sortesDesAvatars(avatars: readonly { legendaire?: string | null; finition?: string | null }[]): Sorte[] {
  const voulues = new Set<Sorte>(sortesDe(avatars.map(a => a.legendaire)))
  if (avatars.some(a => !divinDe(a.legendaire) && lumineuse(a.finition))) voulues.add('lumiere')
  return SORTES.filter(sorte => voulues.has(sorte))
}

interface Dessins {
  Legendaire?: typeof Legendaire
  Divin?: typeof Divin
  /** Le cadre des portraits — le disque, la silhouette, le cercle de la finition —, venu avec la première branche. */
  Portrait?: typeof Portrait
  /** La lumière des finitions 15, 20 et 25. */
  Lumiere?: typeof Lumiere
  /** Les dessins des branches arrivées, par branche. */
  branches?: Partial<Record<CleDeBranche, Readonly<Record<string, DessinDePortrait>>>>
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
  importer: (sorte: Sorte): Promise<unknown> =>
    sorte === 'divin'
      ? import('./Divin')
      : sorte === 'legendaire'
        ? import('./Legendaire')
        : sorte === 'lumiere'
          ? import('./Lumiere')
          : BRANCHES_A_IMPORTER[brancheDeSorte(sorte)](),
}

/** Chaque branche dans son fichier — des chemins écrits en entier : c'est à eux que le paquet découpe. */
const BRANCHES_A_IMPORTER: Record<CleDeBranche, () => Promise<unknown>> = {
  monde: () => import('./portraits/monde'),
  mythes: () => import('./portraits/mythes'),
  oceans: () => import('./portraits/oceans'),
  espace: () => import('./portraits/espace'),
  foret: () => import('./portraits/foret'),
  ecran: () => import('./portraits/ecran'),
  scene: () => import('./portraits/scene'),
  contes: () => import('./portraits/contes'),
  stade: () => import('./portraits/stade'),
  brigade: () => import('./portraits/brigade'),
  arcade: () => import('./portraits/arcade'),
  carnaval: () => import('./portraits/carnaval'),
}

const brancheDeSorte = (sorte: `branche:${CleDeBranche}`) => sorte.slice('branche:'.length) as CleDeBranche

/** Appelé par `Legendaire.tsx`, `Divin.tsx`, `Lumiere.tsx` et chaque branche des portraits à leur évaluation. */
export function inscrireDessin(d: Dessins) {
  dessins = { ...dessins, ...d, branches: { ...dessins.branches, ...d.branches } }
  for (const f of abonnes) f()
}

/** Le dessin de cette sorte est-il là ? */
function present(d: Dessins, sorte: Sorte): boolean {
  if (sorte === 'divin') return !!d.Divin
  if (sorte === 'legendaire') return !!d.Legendaire
  if (sorte === 'lumiere') return !!d.Lumiere
  return !!d.Portrait && !!d.branches?.[brancheDeSorte(sorte)]
}

/** Le dessin d'un portrait des branches, s'il est arrivé. */
export function dessinDuPortrait(d: Dessins, cle: string): DessinDePortrait | undefined {
  const p = portraitDe(cle)
  return p && d.Portrait ? d.branches?.[p.branche]?.[cle] : undefined
}

/** Le dessin de cette sorte ne viendra plus : son chargement a échoué. */
function perdu(d: Dessins, sorte: Sorte): boolean {
  return !present(d, sorte) && !!d.echecs?.includes(sorte)
}

/** Ces dessins — les médaillons, par défaut — sont-ils tous là ? */
export function complets(d: Dessins = dessins, sortes: readonly Sorte[] = MEDAILLONS): boolean {
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
 * Lance le chargement de ces sortes — les médaillons, par défaut —, une fois
 * par sorte pour toute la page, un échec compris. La promesse ne rejette
 * jamais : qui l'attend repart, avec ou sans dessins.
 */
export function chargerDessins(sortes: readonly Sorte[] = MEDAILLONS): Promise<void> {
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
