import type { MouseEvent, PointerEvent } from 'react'

/**
 * L'heure du dernier geste pris au lever du doigt, pour tout le téléphone :
 * le `click` qui le suit ne le rejoue pas. Hors d'un composant, parce que le
 * geste lui-même fait rendre la page entre les deux événements.
 */
let dernierDoigt = -Infinity

/** Au-delà, le `click` n'est plus l'écho du doigt : c'est un autre geste. */
const ECHO_MS = 800

type Cible = { disabled?: boolean; getBoundingClientRect(): { left: number; right: number; top: number; bottom: number } }

/**
 * Une réponse prise au lever du doigt, et non au `click` du navigateur.
 *
 * Les invités le disaient : « parfois, ça sélectionne la réponse au lieu de
 * la valider ». Le `click` d'un écran tactile ne vient qu'au bout d'un geste
 * que le navigateur juge être un toucher : appuyé un peu longtemps, le
 * texte de la case se surlignait — la réponse avait l'air choisie — et rien
 * ne partait ; tapé à l'arrivée de la question, le navigateur cherchait la
 * case là où elle n'était plus. Le lever du doigt, lui, vient toujours. Un
 * doigt qui défile reçoit `pointercancel` à la place, et un doigt levé hors
 * de la case (un toucher capturé suit le doigt) ne répond rien.
 *
 * La souris et le clavier gardent le `click` ; celui qui suit un doigt déjà
 * pris est ignoré — une case à cocher touchée une fois ne se décoche pas
 * aussitôt.
 */
export function toucher(agir: () => void) {
  return {
    onPointerUp: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' || e.button > 0) return
      const cible = e.currentTarget as unknown as Cible
      if (cible.disabled) return
      const r = cible.getBoundingClientRect()
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return
      dernierDoigt = e.timeStamp
      agir()
    },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (e.timeStamp - dernierDoigt < ECHO_MS) return
      agir()
    },
    // L'appui long ouvrait le menu du texte (copier, rechercher) par-dessus la question.
    onContextMenu: (e: MouseEvent<HTMLElement>) => e.preventDefault(),
  }
}
