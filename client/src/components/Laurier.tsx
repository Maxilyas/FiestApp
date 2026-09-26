/**
 * Le laurier du vainqueur d'hier au quiz du jour : une couronne dorée juste
 * après son prénom, toute la journée — au classement du jour, sur sa carte,
 * et jusque dans les soirées où il joue. Deux branches en arc, des feuilles
 * par paires le long.
 *
 * Rien pour les autres : ni laurier gris, ni place gardée (invariant 8).
 */
const R = 7.6
const CX = 12
const CY = 12.4
const FEUILLES = [115, 145, 175, 205, 235].flatMap(deg => {
  const phi = (deg * Math.PI) / 180
  return [
    { d: R + 1.45, a: deg + 60 },
    { d: R - 1.45, a: deg + 120 },
  ].flatMap(({ d, a }) => {
    const x = CX + d * Math.cos(phi)
    const y = CY + d * Math.sin(phi)
    // La branche droite, en miroir.
    return [
      { x, y, a },
      { x: 24 - x, y, a: 180 - a },
    ]
  })
})

/** Ce que le laurier dit à qui ne le voit pas. */
export const LAURIER_TEXTE = 'vainqueur du quiz du jour d’hier'

export function Laurier({ laurier }: { laurier?: boolean }) {
  if (!laurier) return null
  return (
    // Pas de <title> : il entrerait dans le texte du prénom (`textContent`),
    // que la tablée et les tests lisent.
    <svg className="laurier" viewBox="0 0 24 24" role="img" aria-label={LAURIER_TEXTE}>
      <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <path d="M10.68 19.88A7.6 7.6 0 0 1 8.79 5.51" />
        <path d="M13.32 19.88A7.6 7.6 0 0 0 15.21 5.51" />
      </g>
      <g fill="currentColor">
        {FEUILLES.map((f, i) => (
          <ellipse
            key={i}
            cx={f.x.toFixed(2)}
            cy={f.y.toFixed(2)}
            rx="1.8"
            ry="0.8"
            transform={`rotate(${f.a.toFixed(1)} ${f.x.toFixed(2)} ${f.y.toFixed(2)})`}
          />
        ))}
      </g>
    </svg>
  )
}

/**
 * Un prénom sur une ligne de classement, et son laurier s'il le porte :
 * c'est le prénom qui se coupe sur un écran étroit, jamais le laurier.
 */
export function NomLaure({ nom, laurier }: { nom: string; laurier?: boolean }) {
  if (!laurier) return <>{nom}</>
  return (
    <span className="nom-laure">
      <span className="nom-laure-texte">{nom}</span>
      <Laurier laurier />
    </span>
  )
}
