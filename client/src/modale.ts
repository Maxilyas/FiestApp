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
    const rendus = boite.current ? horsDeLaBoite(boite.current, document.body).filter(e => !e.hasAttribute('inert')) : []
    for (const e of rendus) e.setAttribute('inert', '')
    boite.current?.focus()
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && fenetre.dessus() && fermer.current()
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('keydown', touche)
      fenetre.retirer()
      for (const e of rendus) e.removeAttribute('inert')
      // La ligne touchée reprend le focus : on rouvre la carte suivante de là.
      avant?.focus({ preventScroll: true })
    }
  }, [boite])
}
