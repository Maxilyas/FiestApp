import { useEffect, useRef, type RefObject } from 'react'

/** Le strict nécessaire d'un élément pour savoir ce qui l'entoure. */
interface Noeud {
  parentElement: Noeud | null
  children: ArrayLike<Noeud> & Iterable<Noeud>
}

/**
 * Tout ce qui, dans la page, n'est ni la boîte ni l'un de ses ancêtres :
 * les voisins de chaque étage, de la boîte jusqu'à la racine. C'est ce
 * qu'une fenêtre modale rend inerte.
 */
export function horsDeLaBoite<T extends Noeud>(boite: T, racine: Noeud): T[] {
  const hors: T[] = []
  for (let e: Noeud = boite; e !== racine && e.parentElement; e = e.parentElement) {
    for (const voisin of e.parentElement.children) if (voisin !== e) hors.push(voisin as T)
  }
  return hors
}

/** Le strict nécessaire d'un élément pour l'endormir. */
interface Inertable {
  hasAttribute(nom: string): boolean
  setAttribute(nom: string, valeur: string): void
  removeAttribute(nom: string): void
}

/** Combien de fenêtres ouvertes couvrent chaque élément qu'elles ont rendu inerte. */
const couvertures = new Map<Inertable, number>()

/**
 * Rend inertes, pour une fenêtre, les éléments qu'elle couvre, et rend de quoi
 * les lui reprendre en partant. Chaque élément compte les fenêtres qui le
 * couvrent, et ne revit qu'au départ de la dernière, d'où qu'elle parte : une
 * fenêtre qui écartait ce qui était déjà inerte ne retenait pas ce que celle
 * d'en dessous avait endormi, et la feuille d'une équipe que la barre du chef
 * referme d'elle-même (l'équipe retirée par l'écran commun) rendait la niche,
 * les bandeaux et le reste de `body` vivants derrière la confirmation encore
 * ouverte sur elle. Ce que la page a rendu inerte elle-même — la face cachée
 * d'une carte à collectionner — n'est à aucune fenêtre : on n'y touche pas.
 */
export function couvrir(elements: readonly Inertable[]): () => void {
  const couverts: Inertable[] = []
  for (const e of elements) {
    const n = couvertures.get(e)
    if (n === undefined && e.hasAttribute('inert')) continue
    if (n === undefined) e.setAttribute('inert', '')
    couvertures.set(e, (n ?? 0) + 1)
    couverts.push(e)
  }
  let parti = false
  return () => {
    if (parti) return
    parti = true
    for (const e of couverts) {
      const n = (couvertures.get(e) ?? 1) - 1
      if (n > 0) {
        couvertures.set(e, n)
        continue
      }
      couvertures.delete(e)
      e.removeAttribute('inert')
    }
  }
}

/**
 * Un appui sur le voile même ne prend pas le focus de la boîte — celui d'un
 * dialogue, celui d'une feuille. Ouverte au lever du doigt (`toucher`), la
 * fenêtre posait le focus sur « Continuer », et le `mousedown` que le
 * navigateur fait suivre tombait sur le voile, qui ne se focalise pas : le
 * focus partait sur la page. Un appui dans la boîte garde le sien — un champ,
 * un bouton.
 */
export function retenirLeFocus(e: { target: unknown; currentTarget: unknown; preventDefault: () => void }) {
  if (e.target === e.currentTarget) e.preventDefault()
}

/**
 * Le focus que le code pose sur la boîte n'a pas d'anneau, comme tout ce qui a
 * `tabindex="-1"` (l'anneau de l'application l'écarte, `styles.css`) : sans
 * geste encore — la feuille des missions à l'arrivée sur `/#missions`, le
 * réveil d'un gardien à l'arrivée au Cabinet — ou ouverte au clavier,
 * `:focus-visible` donnait à la boîte le filet blanc du navigateur. Au clavier,
 * le premier Tab pose l'anneau d'or sur « Fermer ». `focusVisible` manque
 * encore aux types du DOM de TypeScript ; un navigateur qui l'ignore garde son
 * filet.
 */
const SANS_ANNEAU: FocusOptions & { focusVisible?: boolean } = { focusVisible: false }

/**
 * Les fenêtres ouvertes, de la plus ancienne à celle du dessus : seule
 * celle du dessus entend le clavier. Une feuille, la carte d'un joueur et un
 * dialogue écoutent tous Échap sur le document, et la plus ancienne
 * l'entend la première : la galerie des compagnons se fermait avec
 * l'adoption qu'on y confirmait, et une feuille, devenue modale, se serait
 * fermée avec ce qu'on ouvre sur elle — la carte d'un ami sur la feuille des
 * amis, une carte levée sur le paquet de l'Expédition.
 */
const ouvertes: object[] = []

/**
 * Une fenêtre qui s'ouvre se pose sur les autres : `dessus` dit si elle est
 * encore celle du dessus, `retirer` l'enlève en partant (dans le nettoyage de
 * son effet, d'où qu'elle parte : son geste, son voile, sa page démontée).
 */
export function poserUneFenetre(): { dessus: () => boolean; retirer: () => void } {
  const moi = {}
  ouvertes.push(moi)
  return {
    dessus: () => ouvertes[ouvertes.length - 1] === moi,
    retirer: () => {
      const i = ouvertes.indexOf(moi)
      if (i >= 0) ouvertes.splice(i, 1)
    },
  }
}

/**
 * Une fenêtre modale qui en est vraiment une : le clavier y arrive, il y
 * reste, Échap la ferme, et le focus revient à ce qui l'avait ouverte. La
 * carte d'un joueur se disait `aria-modal`, mais le deuxième Tab sortait
 * vers un bouton caché derrière elle, et Échap rendait le focus à la page
 * entière. Le reste de la page devient inerte (`inert`) plutôt que de
 * boucler Tab à la main : le lecteur d'écran d'un téléphone, qui ne passe
 * pas par Tab, y glissait aussi. Les feuilles passent par elle (`Feuille`,
 * `components/Pieces.tsx`) : « Comment ça marche ? » laissait le focus
 * derrière elle, Échap n'y fermait rien, et Tab, Entrée lançait la partie
 * cachée sous « Ta carte-bonus » (la tablée du 25 octobre 2026).
 */
export function useModale(boite: RefObject<HTMLElement | null>, onFermer: () => void) {
  // La page se redessine à chaque instantané, `onFermer` avec elle : on garde
  // le dernier sans rouvrir la fenêtre.
  const fermer = useRef(onFermer)
  fermer.current = onFermer
  useEffect(() => {
    const fenetre = poserUneFenetre()
    const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const decouvrir = couvrir(boite.current ? horsDeLaBoite(boite.current, document.body) : [])
    boite.current?.focus(SANS_ANNEAU)
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && fenetre.dessus() && fermer.current()
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('keydown', touche)
      fenetre.retirer()
      decouvrir()
      // La ligne touchée reprend le focus : on rouvre la carte suivante de là.
      avant?.focus({ preventScroll: true })
    }
  }, [boite])
}
