import type { SVGProps } from 'react'
import { partsDuNomAffiche } from '../../../shared/homonymes'
import { NOM_DU_LAURIER, type LaurierPorte } from '../../../shared/jour'

/**
 * Le laurier du vainqueur d'hier au quiz du jour : une couronne juste après
 * son prénom, toute la journée — au classement du jour, sur sa carte, et
 * jusque dans les soirées où il joue. Deux branches en arc, des feuilles par
 * paires le long.
 *
 * Il grandit avec ses victoires (`niveauDuLaurier`, le 5 octobre 2026) :
 * vert à la première, d'or à cinq — un ruban noue les branches —, serti
 * d'un rubis à vingt, couronne étoilée à cinquante. La salle reconnaît un
 * champion habituel sans qu'une marque de plus suive son prénom.
 *
 * Le laurier d'argent, lui, vient de la campagne : le vainqueur du défi
 * de la semaine passée le porte toute la semaine (`'argent'`). Le même
 * dessin garni, en argent, noué de son ruban.
 *
 * Rien pour les autres : ni laurier gris, ni place gardée (invariant 8).
 */
const R = 7.6
const CX = 12
const CY = 12.4
/** Les feuilles d'un angle à l'autre de chaque branche : un laurier d'or s'en garnit jusqu'en haut. */
const feuilles = (degres: readonly number[]) =>
  degres.flatMap(deg => {
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
const FEUILLES = feuilles([115, 145, 175, 205, 235])
const FEUILLES_D_OR = feuilles([112, 137, 162, 187, 212, 237])

/** Ce que le laurier dit à qui ne le voit pas. */
export const LAURIER_TEXTE = 'vainqueur du quiz du jour d’hier'

/**
 * `decoratif` : là où le texte le dit juste à côté (« Vainqueur du quiz du
 * jour d'hier » sur la carte et le profil), ou dans un bouton qui porte déjà
 * son nom, le laurier se tait — il était dit deux fois.
 */
/** Ce que dit le laurier d'argent. */
export const LAURIER_D_ARGENT_TEXTE = 'vainqueur du défi de la semaine dernière'

/**
 * Ce que dit un laurier : « vainqueur du quiz du jour d'hier — laurier
 * d'or », ou celui d'argent du défi. `true` : une page d'avant les allures.
 */
export function texteDuLaurier(laurier: LaurierPorte | true): string {
  if (laurier === 'argent') return LAURIER_D_ARGENT_TEXTE
  return laurier !== true && laurier > 1 ? `${LAURIER_TEXTE} — ${NOM_DU_LAURIER[laurier].toLowerCase()}` : LAURIER_TEXTE
}

export function Laurier({ laurier, decoratif }: { laurier?: LaurierPorte | boolean; decoratif?: boolean }) {
  if (!laurier) return null
  // `true` : une page d'avant les quatre allures, ou un appelant qui ne sait que « il a gagné ».
  const niveau: LaurierPorte = laurier === true ? 1 : laurier
  const texte = texteDuLaurier(niveau)
  const nom: SVGProps<SVGSVGElement> = decoratif ? { 'aria-hidden': true } : { role: 'img', 'aria-label': texte }
  return (
    // L'infobulle, pour la souris — l'animateur à la console, qui voyait une
    // couronne sans savoir ce qu'elle dit (l'arbitrage du 27 septembre
    // 2026) : sur l'enveloppe, et pas en <title>, qui entrerait dans le
    // texte du prénom (`textContent`) que la tablée et les tests lisent.
    // L'enveloppe ne compte pas pour le lecteur d'écran (`presentation`) :
    // le laurier s'y dit une fois, par son dessin, ou pas du tout.
    <span className="laurier-bulle" role="presentation" title={texte}>
      <Couronne niveau={niveau} {...nom} />
    </span>
  )
}

/** Trois étoiles au-dessus de la couronne étoilée, la plus haute au centre. */
const ETOILES = [
  { x: 12, y: 2.2, r: 1.5 },
  { x: 7.2, y: 3.6, r: 1.05 },
  { x: 16.8, y: 3.6, r: 1.05 },
]

/** Une étoile à quatre branches, centrée en (x, y). */
const etoile = ({ x, y, r }: { x: number; y: number; r: number }) =>
  `M${x} ${y - r}L${x + r * 0.32} ${y - r * 0.32}L${x + r} ${y}L${x + r * 0.32} ${y + r * 0.32}L${x} ${y + r}L${x - r * 0.32} ${y + r * 0.32}L${x - r} ${y}L${x - r * 0.32} ${y - r * 0.32}Z`

function Couronne({ niveau, ...nom }: { niveau: LaurierPorte } & SVGProps<SVGSVGElement>) {
  // L'argent se garnit et se noue comme l'or, sans gemme ni étoiles : il
  // dit une victoire, pas une collection.
  const rang = niveau === 'argent' ? 2 : niveau
  const garni = rang >= 2 ? FEUILLES_D_OR : FEUILLES
  return (
    <svg className={`laurier laurier-${niveau}`} viewBox="0 0 24 24" {...nom}>
      <g fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
        <path d="M10.68 19.88A7.6 7.6 0 0 1 8.79 5.51" />
        <path d="M13.32 19.88A7.6 7.6 0 0 0 15.21 5.51" />
      </g>
      <g fill="currentColor">
        {garni.map((f, i) => (
          <ellipse
            key={i}
            cx={f.x.toFixed(2)}
            cy={f.y.toFixed(2)}
            rx="1.8"
            ry="0.8"
            transform={`rotate(${f.a.toFixed(1)} ${f.x.toFixed(2)} ${f.y.toFixed(2)})`}
          />
        ))}
        {/* Le ruban qui noue les branches, d'or à partir de cinq victoires. */}
        {rang >= 2 && <path d="M12 19.3L9.6 22.2L10.9 22.4L12 20.9L13.1 22.4L14.4 22.2Z" />}
      </g>
      {/* Le rubis, serti à vingt victoires, au sommet de la couronne. */}
      {rang >= 3 && <circle className="laurier-gemme" cx="12" cy={rang === 4 ? 5.8 : 4.6} r="1.35" />}
      {rang === 4 && (
        <g className="laurier-etoiles" fill="currentColor">
          {ETOILES.map((e, i) => (
            <path key={i} className="laurier-etoile" d={etoile(e)} />
          ))}
        </g>
      )}
    </svg>
  )
}

/**
 * Un prénom sur une ligne de classement, sa marque d'homonymie et son
 * laurier : c'est le prénom qui se coupe sur un écran étroit, jamais la
 * marque ni le laurier. « Camille (2) » devenait « Camil… » dès 320 px — la
 * seule chose qui distinguait deux invités identiques (invariant 17).
 */
export function NomLaure({ nom, laurier }: { nom: string; laurier?: LaurierPorte | boolean }) {
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
