import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * La console animateur : une bande discrète en bas de l'écran commun, au
 * même endroit quel que soit l'écran. L'écran commun y pose l'emplacement ;
 * chaque vue y envoie ses boutons par un portail, sans avoir à connaître la
 * mise en page de la bande.
 */
export const ConsoleSlot = createContext<HTMLElement | null>(null)

/** Place ses enfants dans la console animateur. */
export function ConsoleActions({ children }: { children: ReactNode }) {
  const slot = useContext(ConsoleSlot)
  return slot ? createPortal(children, slot) : null
}
