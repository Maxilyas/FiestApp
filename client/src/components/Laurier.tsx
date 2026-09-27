import { partsDuNomAffiche } from '../../../shared/homonymes'

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

/**
 * `decoratif` : là où le texte le dit juste à côté (« Vainqueur du quiz du
 * jour d'hier » sur la carte et le profil), ou dans un bouton qui porte déjà
 * son nom, le laurier se tait — il était dit deux fois.
 */
export function Laurier({ laurier, decoratif }: { laurier?: boolean; decoratif?: boolean }) {
  if (!laurier) return null
  const nom = decoratif ? { 'aria-hidden': true } : { role: 'img', 'aria-label': LAURIER_TEXTE }
  return (
    // Pas de <title> : il entrerait dans le texte du prénom (`textContent`),
    // que la tablée et les tests lisent.
    <svg className="laurier" viewBox="0 0 24 24" {...nom}>
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
 * Un prénom sur une ligne de classement, sa marque d'homonymie et son
 * laurier : c'est le prénom qui se coupe sur un écran étroit, jamais la
 * marque ni le laurier. « Camille (2) » devenait « Camil… » dès 320 px — la
 * seule chose qui distinguait deux invités identiques (invariant 17).
 */
export function NomLaure({ nom, laurier }: { nom: string; laurier?: boolean }) {
  const { prenom, marque } = partsDuNomAffiche(nom)
  if (!laurier && !marque) return <>{nom}</>
  return (
    <span className="nom-laure">
      <span className="nom-laure-texte">{prenom}</span>
      {/* L'espace reste dans le texte : la ligne se lit et se copie « Camille (2) ». */}
      {marque && <span className="nom-marque">{marque}</span>}
      <Laurier laurier={laurier} />
    </span>
  )
}
