import { useId, type CSSProperties } from 'react'
import { divin as divinDe } from '../../../shared/divins'
import { inscrireDessin } from './medaillons'
import { BADGES } from './divins-peints'

/**
 * Les avatars divins : cinq bijoux au-dessus des légendaires
 * (`shared/divins.ts`). Personne ne sait ce qui les fait descendre.
 *
 * Un légendaire est une carte peinte, ronde, tenue dans son cadre. Un Divin,
 * lui, n'est pas un rond : c'est un bijou sacré — or, émail, pierres —, peint
 * chacun à sa silhouette (le disque solaire d'Hélios, les six ailes du
 * Séraphin, les pétales du Lotus, la couronne de l'Arbre-Monde, l'auréole
 * brisée de l'Ange Déchu). À vingt pixels dans un classement, sa forme seule
 * dit ce qu'il est.
 *
 * Et il vit : sa lumière tourne derrière lui, sa lueur respire, un éclat
 * glisse sur son or, des étincelles gravitent. Rien que des `transform` et
 * des `opacity`, et aucun filtre — le PC du vidéoprojecteur en fait tourner
 * plusieurs ; figé dans les listes, comme les médaillons.
 *
 * Il ne prend ni finition ni Éclat : il a sa propre lumière.
 *
 * Verrouillé, un Divin ne montre rien de lui : un voile, une lueur de sa
 * couleur, et c'est tout — ni silhouette, ni règle.
 */

interface Theme {
  /** Le fond du voile, du centre vers le bord. */
  fond: [string, string, string]
  /** L'anneau du voile : du clair au sombre. */
  anneau: [string, string, string]
  /** Sa lumière : celle qui déborde du voile, et les rayons du bijou. */
  aura: string
}

const THEMES: Record<string, Theme> = {
  'dv:helios': { fond: ['#3b52c4', '#17227a', '#060a2b'], anneau: ['#fff4c7', '#e3b04b', '#8a5a10'], aura: '#ffc94a' },
  'dv:seraphin': { fond: ['#c92d4c', '#630c2a', '#18030d'], anneau: ['#ffffff', '#f1d9a6', '#b9873a'], aura: '#ffe2b0' },
  'dv:lotus': { fond: ['#3a1d5c', '#1d1446', '#070a1f'], anneau: ['#ffe3ec', '#e8a0b8', '#9a4a6a'], aura: '#ffb0cc' },
  'dv:arbre': { fond: ['#11604a', '#062a1f', '#010a07'], anneau: ['#fff2c4', '#d4a64a', '#6f4a10'], aura: '#7dffc0' },
  'dv:dechu': { fond: ['#4a1d6b', '#1d0a2d', '#07020d'], anneau: ['#d9b8ff', '#7a3aa8', '#2a0f3d'], aura: '#c0306a' },
}

const n = (v: number) => Number(v.toFixed(2))

/** Une étoile à quatre branches, centrée en (x, y). */
function etoile(x: number, y: number, r: number, key: string | number, className = 'dv-scintille', fill = '#fffbe6') {
  const t = r * 0.22
  return (
    <path
      key={key}
      className={className}
      d={`M${n(x)},${n(y - r)} L${n(x + t)},${n(y - t)} L${n(x + r)},${n(y)} L${n(x + t)},${n(y + t)} L${n(x)},${n(y + r)} L${n(x - t)},${n(y + t)} L${n(x - r)},${n(y)} L${n(x - t)},${n(y - t)} Z`}
      fill={fill}
    />
  )
}

/** Les étincelles qui gravitent autour du bijou : (x, y, rayon), sur un cercle un peu plus grand que lui. */
const ETINCELLES: [number, number, number][] = [
  [50, 2, 3.2],
  [93, 42, 2.4],
  [72, 94, 2.8],
  [9, 72, 2.2],
  [15, 17, 2],
]

/** « #ffc94a » → « 255, 201, 74 » : la lumière entre dans des `rgba()` sans `color-mix`, que tous les navigateurs n'ont pas. */
const rvb = (hex: string) => [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16)).join(', ')

interface Props {
  /** La clé du Divin (`dv:helios`…). */
  cle: string
  /** Pas encore descendu : un voile, et rien d'autre. */
  verrouille?: boolean
  /** Regardé en grand — sa descente en fin de soirée, à la clôture — : le grand fichier du bijou. */
  grand?: boolean
  className?: string
}

/** Un avatar divin, à la taille du texte qui l'entoure (1 em) — sa lumière en plus. */
export function Divin({ cle, verrouille, grand, className }: Props) {
  const brut = useId()
  const d = divinDe(cle)
  const theme = THEMES[cle]
  const badge = BADGES[cle]
  if (!d || !theme || !badge) return null
  const classes = ['dv', `dv-${cle.slice(3)}`]
  if (className) classes.push(className)
  if (!verrouille) {
    const src = badge[grand ? 0 : 1]
    const lumiere = { '--dv-rvb': rvb(theme.aura) } as CSSProperties
    // L'éclat glisse sur l'or seul : le bijou lui-même lui sert de masque.
    const masque = { WebkitMaskImage: `url(${src})`, maskImage: `url(${src})` } as CSSProperties
    return (
      <span className={[...classes, 'dv-peint'].join(' ')} role="img" aria-label={d.nom} style={lumiere}>
        <span className="dv-rayons" />
        <span className="dv-rayons dv-rayons-2" />
        <span className="dv-lueur" />
        <img className="dv-bijou" src={src} alt="" decoding="async" draggable={false} />
        {/* L'éclat est un élément, pas un pseudo-élément : les règles qui
            figent un Divin dans une liste (`.dv *`) ne voient pas ceux-là. */}
        <span className="dv-or" style={masque}>
          <span className="dv-or-bande" />
        </span>
        <svg className="dv-etincelles" viewBox="0 0 100 100" aria-hidden="true">
          {ETINCELLES.map(([x, y, r], i) => etoile(x, y, r, i, 'dv-scintille', '#fff4c7'))}
        </svg>
      </span>
    )
  }
  // `useId` rend des deux-points, que `url(#…)` n'aime pas ; la clé entre
  // dans l'identifiant, comme pour les légendaires.
  const base = `${cle.replace(':', '-')}${brut.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const id = (nom: string) => `${base}-${nom}`
  classes.push('dv-voile')
  const titre = 'Un Divin — personne ne sait ce qui le fait descendre'
  return (
    <svg className={classes.join(' ')} viewBox="0 0 100 100" role="img" aria-label={titre}>
      <title>{titre}</title>
      <defs>
        <radialGradient id={id('aura')} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="62">
          <stop offset="0.62" stopColor={theme.aura} stopOpacity={0.12} />
          <stop offset="1" stopColor={theme.aura} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('fond')} cx="50%" cy="42%" r="66%">
          <stop offset="0" stopColor="#2a2130" />
          <stop offset="0.55" stopColor="#15101a" />
          <stop offset="1" stopColor="#07050a" />
        </radialGradient>
        <linearGradient id={id('anneau')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.anneau[0]} />
          <stop offset="0.5" stopColor={theme.anneau[1]} />
          <stop offset="1" stopColor={theme.anneau[2]} />
        </linearGradient>
        <radialGradient id={id('brume')} cx="50%" cy="55%" r="50%">
          <stop offset="0" stopColor={theme.aura} stopOpacity="0.35" />
          <stop offset="1" stopColor={theme.aura} stopOpacity="0" />
        </radialGradient>
        <clipPath id={id('disque')}>
          <circle cx="50" cy="50" r="45.6" />
        </clipPath>
      </defs>
      <circle className="dv-aura" cx="50" cy="50" r="62" fill={`url(#${id('aura')})`} />
      <circle className="dv-fond" cx="50" cy="50" r="46.6" fill={`url(#${id('fond')})`} />
      <g clipPath={`url(#${id('disque')})`}>
        {/* Une nébuleuse de sa couleur, quelques étoiles, un scellé de
            lumière : de quoi le désirer, rien pour le deviner. */}
        <g className="dv-nebuleuse">
          <circle cx="38" cy="42" r="26" fill={`url(#${id('brume')})`} />
          <circle cx="62" cy="60" r="22" fill={`url(#${id('brume')})`} />
        </g>
        <g>
          {[
            [24, 30, 0.9],
            [74, 24, 0.7],
            [80, 68, 0.8],
            [30, 76, 0.6],
            [58, 16, 0.5],
            [16, 56, 0.5],
          ].map(([x, y, r], i) => (
            <circle key={i} className="dv-scintille" cx={x} cy={y} r={r} fill={theme.anneau[0]} opacity="0.7" />
          ))}
        </g>
        <circle className="dv-brume" cx="50" cy="50" r="14" fill={`url(#${id('brume')})`} />
        {etoile(50, 50, 7, 'voile', 'dv-pouls', theme.anneau[0])}
      </g>
      <g className="dv-cadre">
        <circle cx="50" cy="50" r="47.2" fill="none" stroke={`url(#${id('anneau')})`} strokeWidth="2.2" />
        <circle cx="50" cy="50" r="44.9" fill="none" stroke={theme.anneau[0]} strokeWidth="0.45" opacity="0.55" />
      </g>
    </svg>
  )
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Divin })
