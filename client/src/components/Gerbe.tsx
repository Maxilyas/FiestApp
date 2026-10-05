import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { gerbe as gerbeDuCatalogue } from '../../../shared/gerbes'
import { gerbePortee } from '../gerbe'

/** Combien de particules : assez pour une gerbe, pas de quoi charger un petit téléphone. */
const PARTICULES = 18

/**
 * La gerbe d'une bonne réponse : ses particules éclatent par-dessus l'écran,
 * une fois, puis s'effacent — posée dans le bandeau d'une bonne réponse, elle
 * joue à son apparition. Rien ne se touche à travers elle, rien ne la dit au
 * lecteur d'écran : c'est un décor. Elle ne bouge que par `transform` et
 * `opacity`, et se tait si le système demande moins de mouvement.
 *
 * `cle` : une gerbe à montrer — l'aperçu de « Mon style » ; sinon celle que
 * porte le profil connecté ici (`gerbe.ts`), et rien pour l'anonyme.
 */
export function GerbeDeJuste({ cle }: { cle?: string }) {
  const g = gerbeDuCatalogue(cle ?? gerbePortee())
  // Tirées une fois : une nouvelle diffusion de la même révélation ne relance rien.
  const [particules] = useState(() =>
    Array.from({ length: PARTICULES }, (_, i) => ({
      i,
      x: 4 + Math.random() * 92,
      delai: Math.random() * 0.3,
      duree: 1.3 + Math.random() * 0.8,
      tour: Math.round((Math.random() * 2 - 1) * 300),
      ecart: Math.round((Math.random() * 2 - 1) * 60),
      taille: 0.8 + Math.random() * 0.7,
    })),
  )
  if (!g || typeof document === 'undefined') return null
  // Posée sur la page, pas dans le bandeau : une carte à `backdrop-filter`
  // devient le repère d'un `position: fixed`, et la gerbe s'y rognait.
  return createPortal(
    <span className={`gerbe gerbe-${g.mouvement}`} aria-hidden="true">
      {particules.map(p => (
        <i
          key={p.i}
          style={
            {
              '--x': `${p.x}%`,
              '--delai': `${p.delai}s`,
              '--duree': `${p.duree}s`,
              '--tour': `${p.tour}deg`,
              '--ecart': `${p.ecart}px`,
              '--taille': p.taille,
            } as CSSProperties
          }
        >
          {g.particules[p.i % g.particules.length]}
        </i>
      ))}
    </span>,
    document.body,
  )
}
