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
 * Une fenêtre modale qui en est vraiment une : le clavier y arrive, il y
 * reste, Échap la ferme, et le focus revient à ce qui l'avait ouverte. La
 * carte d'un joueur se disait `aria-modal`, mais le deuxième Tab sortait
 * vers un bouton caché derrière elle, et Échap rendait le focus à la page
 * entière. Le reste de la page devient inerte (`inert`) plutôt que de
 * boucler Tab à la main : le lecteur d'écran d'un téléphone, qui ne passe
 * pas par Tab, y glissait aussi.
 */
export function useModale(boite: RefObject<HTMLElement | null>, onFermer: () => void) {
  // La page se redessine à chaque instantané, `onFermer` avec elle : on garde
  // le dernier sans rouvrir la fenêtre.
  const fermer = useRef(onFermer)
  fermer.current = onFermer
  useEffect(() => {
    const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const rendus = boite.current ? horsDeLaBoite(boite.current, document.body).filter(e => !e.hasAttribute('inert')) : []
    for (const e of rendus) e.setAttribute('inert', '')
    boite.current?.focus()
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && fermer.current()
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('keydown', touche)
      for (const e of rendus) e.removeAttribute('inert')
      // La ligne touchée reprend le focus : on rouvre la carte suivante de là.
      avant?.focus({ preventScroll: true })
    }
  }, [boite])
}
