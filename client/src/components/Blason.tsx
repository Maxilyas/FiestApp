import type { ReactNode } from 'react'
import { ligueParCle, type CleDeLigue } from '../../../shared/duels'

// Le blason d'une ligue des duels (`shared/duels.ts`) : un écu à la couleur
// de son métal, du bronze aux maîtres, son emblème dedans — une, deux, trois
// étoiles, une gemme, une gemme taillée, une couronne. Dessiné ici, sans
// image : il passe sur le bouton de l'accueil, dans chaque ligne du
// classement et à la fin d'un duel, à toutes les tailles, et sa couleur
// (`.blason-<ligue>`, `styles.css`) ne dépend pas du thème porté.

/** Une étoile à cinq branches, centrée en (x, y). */
function etoile(x: number, y: number, r: number): string {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const rayon = i % 2 === 0 ? r : r * 0.45
    const angle = -Math.PI / 2 + (i * Math.PI) / 5
    points.push(`${(x + rayon * Math.cos(angle)).toFixed(2)},${(y + rayon * Math.sin(angle)).toFixed(2)}`)
  }
  return points.join(' ')
}

const EMBLEMES: Record<CleDeLigue, ReactNode> = {
  bronze: <polygon points={etoile(16, 18, 6.5)} />,
  argent: (
    <>
      <polygon points={etoile(11.5, 18, 4.6)} />
      <polygon points={etoile(20.5, 18, 4.6)} />
    </>
  ),
  or: (
    <>
      <polygon points={etoile(16, 13.6, 4.2)} />
      <polygon points={etoile(11, 21.2, 4.2)} />
      <polygon points={etoile(21, 21.2, 4.2)} />
    </>
  ),
  platine: <path d="M16 10.5 L22.5 17.5 L16 26 L9.5 17.5 Z" />,
  diamant: (
    <>
      <path d="M11 12 H21 L24.5 16.5 L16 26.5 L7.5 16.5 Z" />
      <path className="blason-facette" d="M7.5 16.5 H24.5 M11 12 L13.6 16.5 L16 26.5 L18.4 16.5 L21 12 M13.6 16.5 L16 12 L18.4 16.5" />
    </>
  ),
  maitre: <path d="M8.5 23.5 L7.5 12.5 L12.5 17 L16 10 L19.5 17 L24.5 12.5 L23.5 23.5 Z M9 25 H23 V27 H9 Z" />,
}

/** Le blason d'une ligue ; son nom dit la ligue, sauf `decoratif` — le texte à côté la dit déjà. */
export function BlasonDeLigue({ ligue, taille = 28, decoratif, className }: { ligue: CleDeLigue; taille?: number; decoratif?: boolean; className?: string }) {
  const l = ligueParCle(ligue)
  return (
    <svg
      className={`blason blason-${l.cle}${className ? ` ${className}` : ''}`}
      width={taille}
      height={(taille * 36) / 32}
      viewBox="0 0 32 36"
      {...(decoratif ? { 'aria-hidden': true } : { role: 'img', 'aria-label': l.nom })}
    >
      <path className="blason-ecu" d="M16 1 L30 6 V17 C30 26 23.5 32 16 35 C8.5 32 2 26 2 17 V6 Z" />
      <path className="blason-champ" d="M16 4.2 L27 8.2 V17 C27 24.4 21.8 29.4 16 31.9 C10.2 29.4 5 24.4 5 17 V8.2 Z" />
      <g className="blason-embleme">{EMBLEMES[l.cle]}</g>
    </svg>
  )
}
