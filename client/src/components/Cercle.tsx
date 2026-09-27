import type { Finition } from '../../../shared/profil'

// Le cercle d'un avatar dessiné qu'on porte, dans la matière de la finition
// de son porteur — un légendaire (`Legendaire.tsx`) comme un portrait des
// branches (`Portrait.tsx`) : la finition dit le niveau d'un joueur à toute
// la salle, quel que soit le visage qu'il a choisi. Un halo par-dessus un
// médaillon faisait deux ou trois anneaux, une cible ; il n'y a plus qu'une
// bordure, et c'est elle.
//
// Un fichier à part, chargé avec le premier dessin qui en a besoin : les
// portraits ne font pas venir les légendaires pour leur cercle.

/** L'or d'origine des légendaires, du clair au sombre — et le cercle de la finition Or. */
export const OR: [string, string, string] = ['#fff2c4', '#d9b56a', '#7a5618']

/** Une étoile à quatre branches, centrée en (x, y). */
export function etoile(x: number, y: number, r: number, key?: string | number, className = 'lg-scintille') {
  const t = r * 0.28
  return (
    <path
      key={key}
      className={className}
      d={`M${x},${y - r} L${x + t},${y - t} L${x + r},${y} L${x + t},${y + t} L${x},${y + r} L${x - t},${y + t} L${x - r},${y} L${x - t},${y - t} Z`}
      fill="#fffbe6"
    />
  )
}

/** Un point à `r` du centre, à `deg` degrés du haut, dans le sens des aiguilles d'une montre. */
function pol(r: number, deg: number): string {
  const a = (deg * Math.PI) / 180
  return `${(50 + r * Math.sin(a)).toFixed(2)},${(50 - r * Math.cos(a)).toFixed(2)}`
}

/**
 * Le cercle découpé en segments, chacun de sa couleur : c'est le dégradé
 * conique d'Holo, de Prisme et d'Aurore, que le SVG n'a pas. Chaque segment
 * mord un peu sur ses voisins — sans ça, l'anticrénelage laissait un fil
 * sombre entre deux.
 */
const SEGMENTS = 36
const SEGMENTS_D = Array.from({ length: SEGMENTS }, (_, i) => {
  const a0 = (i * 360) / SEGMENTS - 0.8
  const a1 = ((i + 1) * 360) / SEGMENTS + 0.8
  return `M${pol(49, a0)} A49,49 0 0 1 ${pol(49, a1)} L${pol(45, a1)} A45,45 0 0 0 ${pol(45, a0)} Z`
})

/** Les couleurs d'un cycle, réparties sur les segments et fondues de l'une à l'autre. */
function cyclique(couleurs: string[]): string[] {
  const rgb = couleurs.map(c => [1, 3, 5].map(k => parseInt(c.slice(k, k + 2), 16)))
  return Array.from({ length: SEGMENTS }, (_, i) => {
    const x = (i / SEGMENTS) * rgb.length
    const a = rgb[Math.floor(x) % rgb.length]
    const b = rgb[(Math.floor(x) + 1) % rgb.length]
    const f = x - Math.floor(x)
    return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, '0')).join('')
  })
}

/** Les cercles de métal, du clair au sombre : Mat est un bronze, l'Or reste l'or d'origine. */
const METAUX: Partial<Record<Finition, [string, string, string]>> = {
  mat: ['#dcbd93', '#9c7449', '#5a3d20'],
  argent: ['#ffffff', '#c3cbd8', '#6b7688'],
  or: OR,
}

/** Les cercles qui tournent : les couleurs d'Holo, de Prisme et d'Aurore, là où elles faisaient un halo. */
const IRISES: Partial<Record<Finition, string[]>> = {
  holo: cyclique(['#ffb8c8', '#ffe39e', '#b8f0d2', '#b9c9ff', '#e4bbff']),
  prisme: cyclique(['#ff4d6d', '#ffa53d', '#fff05a', '#4dff9a', '#4dc3ff', '#9a6bff']),
  aurore: cyclique(['#58e6b4', '#3fc9ff', '#7d8cff', '#c078ff', '#3fc9ff']),
}

/** Les étoiles du cercle de Constellation, toujours aux mêmes places. */
const ETOILES_CONSTELLATION: [number, number][] = [
  [8, 0.85],
  [46, 0.6],
  [80, 0.75],
  [119, 0.55],
  [152, 0.85],
  [197, 0.6],
  [232, 0.8],
  [265, 0.55],
  [301, 0.85],
  [336, 0.6],
]

/** Le cercle d'un avatar dessiné porté, dans la matière de la finition de son porteur. */
export function Cercle({ finition, id }: { finition: Finition; id: (nom: string) => string }) {
  const metal = METAUX[finition]
  const irise = IRISES[finition]
  return (
    <g className={`lg-cercle lg-cercle-${finition}`}>
      {metal && (
        <>
          <defs>
            <linearGradient id={id('cercle')} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={metal[0]} />
              <stop offset="50%" stopColor={metal[1]} />
              <stop offset="100%" stopColor={metal[2]} />
            </linearGradient>
          </defs>
          <circle className="lg-bord" cx="50" cy="50" r="49" fill={`url(#${id('cercle')})`} />
        </>
      )}
      {irise && (
        <>
          {finition === 'aurore' && (
            <circle className="lg-cercle-lueur" cx="50" cy="50" r="51.4" fill="none" stroke="#7dffd0" strokeWidth="2.8" opacity="0.32" />
          )}
          <g className="lg-cercle-tourne">
            {SEGMENTS_D.map((d, i) => (
              <path key={i} d={d} fill={irise[i]} />
            ))}
          </g>
          <circle cx="50" cy="50" r="48.7" fill="none" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="0.5" />
        </>
      )}
      {finition === 'constellation' && (
        <>
          <defs>
            <linearGradient id={id('nuit')} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34479e" />
              <stop offset="100%" stopColor="#0e1440" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="47" fill="none" stroke={`url(#${id('nuit')})`} strokeWidth="4.2" />
          <g className="lg-cercle-tourne">
            {ETOILES_CONSTELLATION.map(([a, r], i) => {
              const [x, y] = pol(47, a).split(',').map(Number)
              return <circle key={i} className={i % 2 ? 'lg-scintille' : undefined} cx={x} cy={y} r={r} fill="#fff6d8" />
            })}
          </g>
          <circle cx="50" cy="50" r="49" fill="none" stroke="#d9b56a" strokeWidth="0.7" />
          <circle cx="50" cy="50" r="45.1" fill="none" stroke="#d9b56a" strokeWidth="0.5" />
        </>
      )}
      {finition === 'prisme' && etoile(89, 10, 10, 'prisme')}
    </g>
  )
}
