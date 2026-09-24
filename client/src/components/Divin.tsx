import { useId, type ReactNode } from 'react'
import { divin as divinDe } from '../../../shared/divins'
import { inscrireDessin } from './medaillons'

/**
 * Les avatars divins : cinq dessins au-dessus des légendaires
 * (`shared/divins.ts`). Personne ne sait ce qui les fait descendre.
 *
 * Un légendaire est un médaillon : un disque cerclé d'or, sagement tenu dans
 * son cadre. Un Divin, lui, déborde — les rayons d'Hélios traversent le
 * cadre, les ailes du Séraphin le dépassent, l'anneau de l'Ange Déchu est
 * brisé. C'est ce qui le fait reconnaître de loin, avant même qu'on ait vu ce
 * qu'il représente.
 *
 * Il ne prend ni finition ni Éclat : il a sa propre lumière, et un halo
 * posé par-dessus ne pourrait que l'abîmer.
 *
 * Tout est en SVG dans la page, comme les légendaires : rien à télécharger,
 * pas d'emoji récent, et aucun filtre — un flou animé coûte trop cher au PC
 * d'un vidéoprojecteur. Les lueurs sont des dégradés, les mouvements des
 * `transform` et des `opacity`. Les formes savantes (plumes, branches) sont
 * calculées une fois, au chargement du module.
 *
 * Verrouillé, un Divin ne montre rien de lui : un voile, une lueur de sa
 * couleur, et c'est tout — ni silhouette, ni règle.
 */

type Id = (nom: string) => string
type Pt = [number, number]
/** Un chemin décrit dans son repère : des commandes SVG et leurs points. */
type Trace = [string, Pt[]][]

interface Theme {
  /** Le fond du disque, du centre vers le bord. */
  fond: [string, string, string]
  /** L'anneau : du clair au sombre. */
  anneau: [string, string, string]
  /** La lueur qui déborde du disque. */
  aura: string
}

const THEMES: Record<string, Theme> = {
  'dv:helios': { fond: ['#3b52c4', '#17227a', '#060a2b'], anneau: ['#fff4c7', '#e3b04b', '#8a5a10'], aura: '#ffc94a' },
  'dv:seraphin': { fond: ['#c92d4c', '#630c2a', '#18030d'], anneau: ['#ffffff', '#f1d9a6', '#b9873a'], aura: '#ffe2b0' },
  'dv:lotus': { fond: ['#3a1d5c', '#1d1446', '#070a1f'], anneau: ['#ffe3ec', '#e8a0b8', '#9a4a6a'], aura: '#ffb0cc' },
  'dv:arbre': { fond: ['#11604a', '#062a1f', '#010a07'], anneau: ['#fff2c4', '#d4a64a', '#6f4a10'], aura: '#7dffc0' },
  'dv:dechu': { fond: ['#4a1d6b', '#1d0a2d', '#07020d'], anneau: ['#d9b8ff', '#7a3aa8', '#2a0f3d'], aura: '#c0306a' },
}

// ── Géométrie ─────────────────────────────────────────────────────────────

const n = (v: number) => Number(v.toFixed(2))
const p = ([x, y]: Pt) => `${n(x)},${n(y)}`
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Un point à `r` de (cx, cy), à `deg` degrés du haut, dans le sens des aiguilles d'une montre. */
function pol(cx: number, cy: number, r: number, deg: number): Pt {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)]
}

function norme([x, y]: Pt): Pt {
  const l = Math.hypot(x, y) || 1
  return [x / l, y / l]
}

/** Un point d'une courbe de Bézier quadratique, et sa tangente. */
const bez = (a: Pt, b: Pt, c: Pt, s: number): Pt => [
  (1 - s) ** 2 * a[0] + 2 * (1 - s) * s * b[0] + s * s * c[0],
  (1 - s) ** 2 * a[1] + 2 * (1 - s) * s * b[1] + s * s * c[1],
]
const tangente = (a: Pt, b: Pt, c: Pt, s: number): Pt =>
  norme([2 * (1 - s) * (b[0] - a[0]) + 2 * s * (c[0] - b[0]), 2 * (1 - s) * (b[1] - a[1]) + 2 * s * (c[1] - b[1])])

/**
 * Pose un tracé décrit dans son repère : en miroir s'il le faut, tourné de
 * `deg` degrés, puis posé en (x, y). Les coordonnées sont calculées ici, une
 * fois pour toutes : un `transform` sur l'élément serait écrasé par celui
 * d'une animation.
 */
function pose(trace: Trace, x: number, y: number, deg: number, miroir = false): string {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return trace
    .map(([cmd, pts]) =>
      cmd +
      pts
        .map(([px, py]) => {
          const mx = miroir ? -px : px
          return p([x + mx * c - py * s, y + mx * s + py * c])
        })
        .join(' '),
    )
    .join(' ')
}

/** Une amande : racine en (0, 0), pointe vers le haut — pétale, feuille ou plume. */
function amande(long: number, large: number, rondeur = 0.28): Trace {
  return [
    ['M', [[-large * 0.18, 0]]],
    ['C', [[-large, -long * rondeur], [-large * 0.9, -long * 0.76], [0, -long]]],
    ['C', [[large * 0.9, -long * 0.76], [large, -long * rondeur], [large * 0.18, 0]]],
    ['Z', []],
  ]
}

/** Une amande qui part de `b` dans la direction `d` (vecteur unitaire). */
function amandeVers(b: Pt, d: Pt, long: number, large: number): Trace {
  const [dx, dy] = d
  const at = (u: number, v: number): Pt => [b[0] + dx * u - dy * v, b[1] + dy * u + dx * v]
  return [
    ['M', [at(0, -large * 0.3)]],
    ['C', [at(long * 0.3, -large), at(long * 0.78, -large * 0.8), at(long, 0)]],
    ['C', [at(long * 0.78, large * 0.8), at(long * 0.3, large), at(0, large * 0.3)]],
    ['Z', []],
  ]
}

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

/** Un ciel : quelques points, toujours les mêmes pour un même dessin. */
function ciel(points: [number, number, number][], fill = '#fffbe6') {
  return points.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={fill} opacity={0.3 + (i % 3) * 0.2} />)
}

// ── L'aile ────────────────────────────────────────────────────────────────

interface Aile {
  /** Les rémiges, de la pointe vers l'épaule : celles de l'épaule passent devant. */
  plumes: Trace[]
  /** Les couvertures, la bande festonnée qui suit le bord d'attaque. */
  couvertures: Trace
  /** Le bord d'attaque seul, pour la lumière qui le souligne. */
  bord: Trace
}

/**
 * Une aile, dans son repère : l'épaule en (0, 0), le bord d'attaque qui file
 * vers la droite en montant un peu, les plumes qui pendent dessous et se
 * couchent vers la pointe. Dessinée plume à plume, elle se lit comme une aile
 * même à vingt pixels ; en ellipses, elle se lisait comme un pétale.
 */
function aile(long: number, large: number, nb = 11, sauf: number[] = []): Aile {
  const P0: Pt = [0, 0]
  const P1: Pt = [0.42 * long, -0.4 * long]
  const P2: Pt = [long, -0.26 * long]
  const plumes: Trace[] = []
  for (let i = nb - 1; i >= 0; i--) {
    if (sauf.includes(i)) continue
    const t = i / (nb - 1)
    const s = lerp(0.1, 0.97, t)
    const e = bez(P0, P1, P2, s)
    const bas = norme([-0.28, 1])
    const fil = tangente(P0, P1, P2, Math.min(1, s + 0.05))
    const k = Math.pow(t, 1.25)
    const d = norme([lerp(bas[0], fil[0], k), lerp(bas[1], fil[1], k)])
    plumes.push(amandeVers([e[0], e[1] + 1.2], d, lerp(large * 1.05, long * 0.62, Math.pow(t, 1.1)), lerp(5.2, 4, t)))
  }
  const haut: Pt[] = []
  for (let k = 0; k <= 16; k++) haut.push(bez(P0, P1, P2, (k / 16) * 0.84))
  const festons: [Pt, Pt][] = []
  const nf = 7
  let precedent = haut[haut.length - 1]
  for (let k = nf; k >= 0; k--) {
    const s = (k / nf) * 0.84
    const e = bez(P0, P1, P2, s)
    const [tx, ty] = tangente(P0, P1, P2, s)
    const u = s / 0.84
    // Une épaule ronde, une bande qui s'épaissit, puis s'effile vers la pointe.
    const ep = large * 0.72 * Math.sin(Math.PI * Math.min(1, 0.16 + 0.84 * u)) + large * 0.06
    const bout: Pt = [e[0] - ty * ep, e[1] + tx * ep]
    const milieu: Pt = [(precedent[0] + bout[0]) / 2 - ty * 2.4, (precedent[1] + bout[1]) / 2 + tx * 2.4]
    festons.push([milieu, bout])
    precedent = bout
  }
  const couvertures: Trace = [['M', [haut[0]]], ['L', haut.slice(1)], ...festons.map(([c, b]): [string, Pt[]] => ['Q', [c, b]]), ['Z', []]]
  const bord: Trace = [['M', [haut[0]]], ['L', haut.slice(1)]]
  return { plumes, couvertures, bord }
}

// ── Hélios ────────────────────────────────────────────────────────────────

/** Les rayons du soleil-miroir, qui débordent du cadre : longs et courts en alternance. */
const RAYONS_HELIOS = (() => {
  let d = ''
  for (let i = 0; i < 32; i++) {
    const a = i * (360 / 32)
    const long = i % 2 === 0
    const demi = long ? 3.3 : 2.4
    d += `M${p(pol(50, 50, 43, a - demi))} L${p(pol(50, 50, long ? 60 : 53.5, a))} L${p(pol(50, 50, 43, a + demi))} Z `
  }
  return d
})()

/** Une flammèche en S, racine en (0, 0), pointe vers le haut. */
const FLAMMECHE: Trace = [
  ['M', [[-3.4, 0]]],
  ['C', [[-3.8, -5.5], [1.8, -7.6], [0.6, -12]]],
  ['C', [[0, -14.2], [-1.4, -15.6], [0.9, -18.4]]],
  ['C', [[2.6, -15], [3.8, -12.4], [3.3, -9.2]]],
  ['C', [[2.9, -5.6], [4, -2.6], [3.4, 0]]],
  ['Z', []],
]

const FLAMMES_HELIOS = Array.from({ length: 12 }, (_, i) => {
  const a = i * 30 + 15
  const [x, y] = pol(50, 50, 19.4, a)
  return pose(FLAMMECHE, x, y, a)
}).join(' ')

const RAIS_HELIOS = (() => {
  let d = ''
  for (let i = 0; i < 12; i++) {
    const a = i * 30
    d += `M${p(pol(50, 50, 19, a - 3.2))} L${p(pol(50, 50, 45, a))} L${p(pol(50, 50, 19, a + 3.2))} Z `
  }
  return d
})()

/** L'astrolabe gravé autour du soleil : un trait tous les cinq degrés, un plus long tous les trente. */
const GRADUATIONS_HELIOS = (() => {
  let d = ''
  for (let i = 0; i < 72; i++) {
    const a = i * 5
    d += `M${p(pol(50, 50, 40.6, a))} L${p(pol(50, 50, i % 6 === 0 ? 38.2 : 39.4, a))} `
  }
  return d
})()

function helios(id: Id): Dessin {
  return {
    arriere: (
      <g className="dv-tourne-lent">
        <path d={RAYONS_HELIOS} fill={`url(#${id('rayon')})`} />
      </g>
    ),
    dedans: (
      <>
        <g className="dv-decor">
          {ciel([
            [18, 24, 0.7],
            [80, 20, 0.8],
            [86, 64, 0.6],
            [14, 70, 0.7],
            [30, 86, 0.6],
            [72, 86, 0.7],
            [24, 40, 0.4],
            [76, 36, 0.45],
            [62, 90, 0.4],
            [40, 12, 0.45],
          ])}
        </g>
        <circle cx="50" cy="50" r="40.6" fill="none" stroke="#e3b04b" strokeWidth="0.45" opacity="0.7" />
        <path d={GRADUATIONS_HELIOS} stroke="#e3b04b" strokeWidth="0.4" opacity="0.6" />
        <g className="dv-tourne-inverse">
          <path d={RAIS_HELIOS} fill="#ffe7a0" opacity="0.26" />
        </g>
        <circle className="dv-pouls" cx="50" cy="50" r="36" fill={`url(#${id('couronne')})`} />
        <g className="dv-flammes">
          <path d={FLAMMES_HELIOS} fill={`url(#${id('flamme')})`} />
        </g>
        <circle cx="50" cy="50" r="20.5" fill={`url(#${id('soleil')})`} />
        <circle cx="50" cy="50" r="20.5" fill="none" stroke="#fff6cf" strokeWidth="0.8" opacity="0.9" />
        <circle cx="50" cy="50" r="18.3" fill="none" stroke="#b86a12" strokeWidth="0.45" opacity="0.45" strokeDasharray="0.6 1.4" />
        <g fill="none" stroke="#8f4a0a" strokeLinecap="round" strokeLinejoin="round">
          <path d="M37.9,43.4 Q42.6,39.9 47.1,42.6" strokeWidth="1" />
          <path d="M62.1,43.4 Q57.4,39.9 52.9,42.6" strokeWidth="1" />
          <path d="M38.8,47.6 Q42.9,50.6 46.9,47.6" strokeWidth="1.25" />
          <path d="M61.2,47.6 Q57.1,50.6 53.1,47.6" strokeWidth="1.25" />
          <path d="M39.6,48.4 L38.9,49.6 M42.9,49.9 L42.8,51.2 M46.1,48.4 L46.8,49.6" strokeWidth="0.55" />
          <path d="M60.4,48.4 L61.1,49.6 M57.1,49.9 L57.2,51.2 M53.9,48.4 L53.2,49.6" strokeWidth="0.55" />
          <path d="M50,44.8 C49.5,48.6 48.9,51.8 48,54 Q49.8,55.4 51.9,54.4" strokeWidth="0.95" />
          <path d="M45.4,59.8 Q47.9,58.5 50,59.3 Q52.1,58.5 54.6,59.8 Q50,63.6 45.4,59.8 Z" fill="#c2601a" strokeWidth="0.6" />
        </g>
        <ellipse cx="41.8" cy="54.6" rx="3.2" ry="1.9" fill="#ff8a4d" opacity="0.32" />
        <ellipse cx="58.2" cy="54.6" rx="3.2" ry="1.9" fill="#ff8a4d" opacity="0.32" />
        {etoile(50, 36.4, 2.4, 'front', 'dv-scintille', '#fffdf0')}
        <path d="M40.5,36.5 C43.5,33.2 47,32 50,31.8" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
      </>
    ),
    devant: null,
    defs: (
      <>
        <radialGradient id={id('rayon')} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="60">
          <stop offset="0.72" stopColor="#fff3c4" />
          <stop offset="0.86" stopColor="#f0c052" />
          <stop offset="1" stopColor="#b8780f" />
        </radialGradient>
        <radialGradient id={id('couronne')} cx="50%" cy="50%" r="50%">
          <stop offset="0.45" stopColor="#ffd35a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#ffb02e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('flamme')} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="38">
          <stop offset="0.5" stopColor="#ffe07a" />
          <stop offset="0.78" stopColor="#ff9a2e" />
          <stop offset="1" stopColor="#e8451f" />
        </radialGradient>
        <radialGradient id={id('soleil')} cx="42%" cy="38%" r="68%">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.35" stopColor="#ffe28a" />
          <stop offset="0.75" stopColor="#f2ae2e" />
          <stop offset="1" stopColor="#c46f10" />
        </radialGradient>
      </>
    ),
  }
}

// ── Le Séraphin ───────────────────────────────────────────────────────────

/**
 * Ses trois paires d'ailes, en degrés de rotation depuis l'horizontale : la
 * paire du haut s'élève et dépasse le cadre, celle du milieu s'étend, celle
 * du bas se replie — « de deux il se couvrait les pieds ».
 */
const PAIRES_SERAPHIN: { rot: number; long: number; large: number }[] = [
  { rot: -54, long: 34, large: 17 },
  { rot: 3, long: 29, large: 15 },
  { rot: 56, long: 24, large: 13 },
]

const AILES_SERAPHIN = PAIRES_SERAPHIN.map(({ rot, long, large }) => {
  const a = aile(long, large)
  return [false, true].map(miroir => ({
    plumes: a.plumes.map(t => pose(t, 50 + (miroir ? -2 : 2), 50, miroir ? -rot : rot, miroir)).join(' '),
    couvertures: pose(a.couvertures, 50 + (miroir ? -2 : 2), 50, miroir ? -rot : rot, miroir),
  }))
})

/** Les rais de lumière qui partent de l'œil, entre les ailes. */
const RAIS_SERAPHIN = (() => {
  let d = ''
  for (let i = 0; i < 16; i++) {
    const a = i * 22.5 + 11.25
    d += `M${p(pol(50, 50, 12, a - 1.4))} L${p(pol(50, 50, 46, a))} L${p(pol(50, 50, 12, a + 1.4))} Z `
  }
  return d
})()

function seraphin(id: Id): Dessin {
  return {
    arriere: null,
    dedans: (
      <>
        <g className="dv-decor">
          {ciel([
            [16, 50, 0.7],
            [84, 50, 0.7],
            [30, 90, 0.6],
            [70, 90, 0.6],
            [50, 94, 0.5],
          ])}
        </g>
        <g className="dv-tourne-inverse">
          <path d={RAIS_SERAPHIN} fill="#ffe9c4" opacity="0.18" />
        </g>
        <circle className="dv-pouls" cx="50" cy="50" r="36" fill={`url(#${id('gloire')})`} />
      </>
    ),
    devant: (
      <>
        <g className="dv-ailes">
          {AILES_SERAPHIN.map((paire, i) => (
            <g key={i} className={`dv-paire dv-paire-${i + 1}`}>
              {paire.map((a, j) => (
                <g key={j}>
                  <path d={a.plumes} fill={`url(#${id('plume')})`} stroke="#b0521f" strokeWidth="0.3" strokeOpacity="0.55" />
                  <path d={a.couvertures} fill={`url(#${id('duvet')})`} stroke="#c9923a" strokeWidth="0.3" strokeOpacity="0.7" />
                </g>
              ))}
            </g>
          ))}
        </g>
        <circle cx="50" cy="50" r="13.5" fill={`url(#${id('halo')})`} />
        <circle cx="50" cy="50" r="11.2" fill="none" stroke="#ffe7a0" strokeWidth="1" />
        <circle cx="50" cy="50" r="12.8" fill="none" stroke="#ffe7a0" strokeWidth="0.35" opacity="0.7" />
        <g className="dv-oeil">
          <path d="M40.6,50 Q50,42 59.4,50 Q50,58 40.6,50 Z" fill={`url(#${id('blanc')})`} stroke="#c9923a" strokeWidth="0.7" />
          <circle cx="50" cy="50" r="4.9" fill={`url(#${id('iris')})`} />
          <circle cx="50" cy="50" r="2.1" fill="#1a0a05" />
          <circle cx="48.7" cy="48.7" r="0.95" fill="#ffffff" />
        </g>
      </>
    ),
    defs: (
      <>
        <radialGradient id={id('plume')} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="50">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.36" stopColor="#fff4d8" />
          <stop offset="0.62" stopColor="#ffd480" />
          <stop offset="0.84" stopColor="#ff8f45" />
          <stop offset="1" stopColor="#e8364f" />
        </radialGradient>
        <radialGradient id={id('duvet')} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="30">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#ffe6b8" />
        </radialGradient>
        <radialGradient id={id('gloire')} cx="50%" cy="50%" r="50%">
          <stop offset="0.2" stopColor="#ffe9c4" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ff9a6a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('halo')} cx="50%" cy="50%" r="50%">
          <stop offset="0.55" stopColor="#fffaf0" />
          <stop offset="1" stopColor="#ffe7b0" />
        </radialGradient>
        <radialGradient id={id('blanc')} cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ffeccc" />
        </radialGradient>
        <radialGradient id={id('iris')} cx="42%" cy="40%" r="65%">
          <stop offset="0" stopColor="#fff7c4" />
          <stop offset="0.45" stopColor="#f2b705" />
          <stop offset="1" stopColor="#9a4a08" />
        </radialGradient>
      </>
    ),
  }
}

// ── Le Lotus Sacré ────────────────────────────────────────────────────────

const BASE_LOTUS: Pt = [50, 66]

/** Les trois couronnes de pétales : l'arrière s'ouvre large, l'avant se referme en coupe. */
const PETALES_LOTUS = (() => {
  const [x, y] = BASE_LOTUS
  const arriere = [-78, -54, -28, 0, 28, 54, 78].map(a => pose(amande(a === 0 ? 34 : 34 - Math.abs(a) / 9, 7.6), x, y, a)).join(' ')
  const milieu = [-42, -15, 15, 42].map(a => pose(amande(27, 8.2), x, y, a)).join(' ')
  const avant = [-62, 0, 62].map(a => pose(amande(a === 0 ? 21 : 19, 8.6, 0.24), x, y, a)).join(' ')
  const nervures = [-42, -15, 15, 42, 0]
    .map(a => {
      const [bx, by] = pol(x, y, 2, a)
      const [tx, ty] = pol(x, y, a === 0 ? 18 : 23, a)
      return `M${p([bx, by])} L${p([tx, ty])}`
    })
    .join(' ')
  return { arriere, milieu, avant, nervures }
})()

function fleur(id: Id) {
  return (
    <>
      <path d={PETALES_LOTUS.arriere} fill={`url(#${id('petale')})`} stroke="#ffd6e6" strokeWidth="0.35" strokeOpacity="0.8" />
      <path d={PETALES_LOTUS.milieu} fill={`url(#${id('petale2')})`} stroke="#fff0f6" strokeWidth="0.35" />
      <path d={PETALES_LOTUS.nervures} stroke="#ff9cc0" strokeWidth="0.35" opacity="0.6" />
      <path d={PETALES_LOTUS.avant} fill={`url(#${id('petale3')})`} stroke="#ffe7a8" strokeWidth="0.45" />
    </>
  )
}

function lotus(id: Id): Dessin {
  const [x, y] = BASE_LOTUS
  return {
    arriere: null,
    dedans: (
      <>
        <rect x="0" y="0" width="100" height={y + 0.2} fill={`url(#${id('ciel')})`} />
        <rect x="0" y={y + 0.2} width="100" height="36" fill={`url(#${id('eau')})`} />
        <g className="dv-decor">
          {ciel([
            [20, 18, 0.7],
            [34, 10, 0.5],
            [78, 16, 0.8],
            [88, 34, 0.5],
            [12, 38, 0.5],
            [62, 8, 0.45],
            [26, 30, 0.4],
          ])}
        </g>
        <circle className="dv-pouls" cx="50" cy="40" r="30" fill={`url(#${id('aube')})`} />
        <circle cx="50" cy="38" r="15.5" fill="none" stroke="#ffe7c4" strokeWidth="0.6" opacity="0.55" />
        <circle cx="50" cy="38" r="19" fill="none" stroke="#ffe7c4" strokeWidth="0.35" opacity="0.35" />
        <path d={`M43,${y + 0.4} L57,${y + 0.4} L62,96 L38,96 Z`} fill={`url(#${id('chemin')})`} />
        <g className="dv-miroitement" stroke="#ffe0cc" strokeLinecap="round">
          <path d="M40,71 L47,71 M53,71 L61,71 M36,76 L44,76 M56,76 L65,76 M41,82 L48,82 M52,82 L59,82" strokeWidth="0.7" opacity="0.5" />
        </g>
        <g className="dv-rides" fill="none" stroke="#ffd3c0">
          <ellipse className="dv-ride" cx="50" cy={y + 3} rx="18" ry="2" strokeWidth="0.7" />
          <ellipse className="dv-ride dv-ride-2" cx="50" cy={y + 3} rx="18" ry="2" strokeWidth="0.7" />
          <ellipse className="dv-ride dv-ride-3" cx="50" cy={y + 3} rx="18" ry="2" strokeWidth="0.7" />
        </g>
        <g fill="#0d3a3c" stroke="#2b6b62" strokeWidth="0.4">
          <path d="M6,76 C6,72.6 14,71.4 20,72 L18.6,74.4 L24,73.4 C29,74.6 29,77.8 20,78.8 C12,79.4 6,78.6 6,76 Z" />
          <path d="M72,82 C73,79.2 80,78.4 86,79.2 L84.6,81.2 L90,80.8 C93,82.2 91,84.6 84,85 C77,85.4 71.5,84.2 72,82 Z" />
        </g>
        <g opacity="0.2" transform={`translate(0 ${2 * y}) scale(1 -1)`}>
          {fleur(id)}
        </g>
        <rect x="0" y={y + 0.2} width="100" height="36" fill={`url(#${id('voile-eau')})`} />
        <g className="dv-fleur">{fleur(id)}</g>
        <circle className="dv-pouls" cx={x} cy={y - 11} r="10" fill={`url(#${id('graine')})`} />
        <circle cx={x} cy={y - 10.4} r="2.8" fill="#fff6d0" />
        <g className="dv-montee">
          {[
            [44, 50, 0.9],
            [56, 46, 0.8],
            [50, 36, 1],
            [38, 44, 0.6],
            [62, 52, 0.7],
          ].map(([cx, cy, r], i) => (
            <circle key={i} className="dv-grain" cx={cx} cy={cy} r={r} fill="#fff1c4" />
          ))}
        </g>
      </>
    ),
    devant: null,
    defs: (
      <>
        <linearGradient id={id('ciel')} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={y}>
          <stop offset="0" stopColor="#100d36" />
          <stop offset="0.45" stopColor="#3a1d5c" />
          <stop offset="0.78" stopColor="#b3476f" />
          <stop offset="0.95" stopColor="#ffab88" />
          <stop offset="1" stopColor="#ffd6ab" />
        </linearGradient>
        <linearGradient id={id('eau')} gradientUnits="userSpaceOnUse" x1="0" y1={y} x2="0" y2="100">
          <stop offset="0" stopColor="#2a3566" />
          <stop offset="0.25" stopColor="#0e1d3c" />
          <stop offset="1" stopColor="#040a18" />
        </linearGradient>
        <linearGradient id={id('voile-eau')} gradientUnits="userSpaceOnUse" x1="0" y1={y} x2="0" y2="100">
          <stop offset="0" stopColor="#0e1d3c" stopOpacity="0" />
          <stop offset="1" stopColor="#040a18" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={id('chemin')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd9b8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffd9b8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id('aube')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0.95" />
          <stop offset="0.4" stopColor="#ffd6a8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff9fb0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('petale')} gradientUnits="userSpaceOnUse" cx={x} cy={y} r="35">
          <stop offset="0" stopColor="#fff8fb" />
          <stop offset="0.5" stopColor="#ffc6dc" />
          <stop offset="0.85" stopColor="#ff78a8" />
          <stop offset="1" stopColor="#d83a78" />
        </radialGradient>
        <radialGradient id={id('petale2')} gradientUnits="userSpaceOnUse" cx={x} cy={y} r="28">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#ffdcea" />
          <stop offset="1" stopColor="#ff8fb8" />
        </radialGradient>
        <radialGradient id={id('petale3')} gradientUnits="userSpaceOnUse" cx={x} cy={y} r="22">
          <stop offset="0" stopColor="#fffdf6" />
          <stop offset="0.7" stopColor="#fff0f5" />
          <stop offset="1" stopColor="#ffc2d8" />
        </radialGradient>
        <radialGradient id={id('graine')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff3c4" stopOpacity="1" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </>
    ),
  }
}

// ── L'Arbre-Monde ─────────────────────────────────────────────────────────

/**
 * Ses douze lumières — une par légendaire, chacune à la couleur du sien :
 * qui a cueilli les douze les reconnaît.
 */
const COULEURS_ARBRE = [
  '#ff6a3d', // le Phénix
  '#ffd23f', // le Dragon d'Or
  '#a58bff', // l'Oracle
  '#e8eef8', // la Chouette d'Argent
  '#4fd2ff', // le Tigre Foudre
  '#ff9ad5', // la Licorne Astrale
  '#ff4d5e', // le Lion Couronné
  '#ffa04d', // le Renard Lunaire
  '#9ff6ff', // la Comète
  '#33d6b5', // le Kraken
  '#cfc6ff', // le Fantôme
  '#d9368b', // le Trou Noir
]

/**
 * L'arbre se construit par la cime : douze bouts de branche posés sur un
 * cercle, puis leurs fourches, puis le tronc. Construit depuis le tronc, il
 * poussait de travers ; construit depuis la cime, sa couronne est ronde, et
 * chaque lumière tombe à sa place.
 */
const ARBRE = (() => {
  const centre: Pt = [50, 44]
  const haut: Pt = [50, 60]
  const angles = Array.from({ length: 12 }, (_, k) => -104 + (k * 208) / 11)
  const bouts = angles.map(a => pol(centre[0], centre[1], 31.5, a))
  const fourches = [0, 1, 2, 3, 4, 5].map(j => pol(centre[0], centre[1], 20, (angles[2 * j] + angles[2 * j + 1]) / 2))
  const noeuds = [0, 1, 2].map(j => pol(centre[0], centre[1] + 6, 9, (angles[4 * j] + angles[4 * j + 3]) / 2))
  const courbe = (a: Pt, b: Pt, pli: number) => {
    const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const [dx, dy] = norme([b[0] - a[0], b[1] - a[1]])
    return `M${p(a)} Q${p([m[0] - dy * pli, m[1] + dx * pli])} ${p(b)}`
  }
  const cote = (pt: Pt) => (pt[0] < 50 ? -1 : 1)
  const branches = {
    grosses: noeuds.map(nd => courbe(haut, nd, 2.2 * cote(nd))).join(' '),
    moyennes: fourches.map((f, j) => courbe(noeuds[Math.floor(j / 2)], f, 2 * cote(f))).join(' '),
    fines: bouts.map((b, k) => courbe(fourches[Math.floor(k / 2)], b, (k % 2 ? 1.6 : -1.6) * cote(b))).join(' '),
  }
  const racines = [-118, -144, 180, 144, 118]
    .map(a => {
      const bout = pol(50, 80, 22, a)
      return courbe([50, 82], bout, 3 * cote(bout))
    })
    .join(' ')
  const feuilles: string[] = []
  bouts.forEach((b, k) => {
    const f = fourches[Math.floor(k / 2)]
    const d = norme([b[0] - f[0], b[1] - f[1]])
    for (const t of [0.3, 0.55, 0.8]) {
      const base: Pt = [f[0] + (b[0] - f[0]) * t, f[1] + (b[1] - f[1]) * t]
      for (const sens of [-1, 1]) {
        const a = (48 * sens * Math.PI) / 180
        const dir: Pt = [d[0] * Math.cos(a) - d[1] * Math.sin(a), d[0] * Math.sin(a) + d[1] * Math.cos(a)]
        feuilles.push(pose(amandeVers(base, dir, lerp(6.4, 4.6, t), 2), 0, 0, 0))
      }
    }
  })
  fourches.forEach((f, j) => {
    const nd = noeuds[Math.floor(j / 2)]
    const d = norme([f[0] - nd[0], f[1] - nd[1]])
    const base: Pt = [nd[0] + (f[0] - nd[0]) * 0.55, nd[1] + (f[1] - nd[1]) * 0.55]
    for (const sens of [-1, 1]) {
      const a = (52 * sens * Math.PI) / 180
      const dir: Pt = [d[0] * Math.cos(a) - d[1] * Math.sin(a), d[0] * Math.sin(a) + d[1] * Math.cos(a)]
      feuilles.push(pose(amandeVers(base, dir, 6.4, 2.2), 0, 0, 0))
    }
  })
  return { bouts, branches, racines, feuilles: feuilles.join(' ') }
})()

function arbre(id: Id): Dessin {
  return {
    arriere: null,
    dedans: (
      <>
        <g className="dv-decor">
          {ciel([
            [14, 18, 0.6],
            [86, 16, 0.7],
            [10, 60, 0.5],
            [90, 64, 0.6],
            [18, 76, 0.5],
            [82, 78, 0.5],
            [30, 8, 0.4],
            [70, 8, 0.45],
          ])}
        </g>
        <circle className="dv-pouls" cx="50" cy="43" r="40" fill={`url(#${id('seve')})`} />
        <circle cx="50" cy="44" r="31.5" fill="none" stroke="#9dffd0" strokeWidth="0.4" opacity="0.35" />
        <g fill="none" stroke={`url(#${id('bois')})`} strokeLinecap="round">
          <path d={ARBRE.racines} strokeWidth="1.6" />
        </g>
        <path d="M46,84 C48.3,76 48.4,67 47.8,59 L52.2,59 C51.6,67 51.7,76 54,84 Z" fill={`url(#${id('bois')})`} />
        <g className="dv-feuillage">
          <path d={ARBRE.feuilles} fill={`url(#${id('feuille')})`} stroke="#b8ffd8" strokeWidth="0.25" strokeOpacity="0.5" />
          <g fill="none" stroke={`url(#${id('bois')})`} strokeLinecap="round">
            <path d={ARBRE.branches.grosses} strokeWidth="2.6" />
            <path d={ARBRE.branches.moyennes} strokeWidth="1.7" />
            <path d={ARBRE.branches.fines} strokeWidth="1.05" />
          </g>
        </g>
        <g className="dv-lumieres">
          {ARBRE.bouts.map(([bx, by], i) => (
            <g key={i} className="dv-lumiere">
              <circle cx={bx} cy={by} r="5" fill={COULEURS_ARBRE[i]} opacity="0.25" />
              <circle cx={bx} cy={by} r="2.5" fill={COULEURS_ARBRE[i]} stroke="#fff6d8" strokeWidth="0.45" />
              <circle cx={bx - 0.75} cy={by - 0.75} r="0.8" fill="#ffffff" />
            </g>
          ))}
        </g>
      </>
    ),
    devant: null,
    defs: (
      <>
        <radialGradient id={id('seve')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#b8ffd8" stopOpacity="0.4" />
          <stop offset="1" stopColor="#1fae78" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('bois')} gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="100">
          <stop offset="0" stopColor="#fff2c4" />
          <stop offset="0.55" stopColor="#e0ac48" />
          <stop offset="1" stopColor="#7a4f12" />
        </linearGradient>
        <radialGradient id={id('feuille')} gradientUnits="userSpaceOnUse" cx="50" cy="40" r="36">
          <stop offset="0" stopColor="#c8ffe0" />
          <stop offset="0.55" stopColor="#4ee0a0" />
          <stop offset="1" stopColor="#139a68" />
        </radialGradient>
      </>
    ),
  }
}

// ── L'Ange Déchu ──────────────────────────────────────────────────────────

/** Ses deux ailes : l'une entière, l'autre brisée — il lui manque des plumes. */
const AILES_DECHU = (() => {
  const entiere = aile(31, 16)
  const brisee = aile(29, 15, 11, [3, 4, 8])
  return {
    gauche: {
      plumes: entiere.plumes.map(t => pose(t, 47, 61, 38, true)).join(' '),
      couvertures: pose(entiere.couvertures, 47, 61, 38, true),
      bord: pose(entiere.bord, 47, 61, 38, true),
    },
    droite: {
      plumes: brisee.plumes.map(t => pose(t, 53, 61, -30)).join(' '),
      couvertures: pose(brisee.couvertures, 53, 61, -30),
      bord: pose(brisee.bord, 53, 61, -30),
    },
  }
})()

const PLUMES_TOMBEES: [number, number, number][] = [
  [78, 56, 30],
  [26, 70, -25],
  [70, 80, 60],
  [36, 86, -50],
]

function dechu(id: Id): Dessin {
  const cote = (c: typeof AILES_DECHU.gauche, k: string) => (
    <g className={`dv-aile-${k}`}>
      <path d={c.plumes} fill={`url(#${id('plume')})`} stroke="#ff4d8d" strokeWidth="0.35" strokeOpacity="0.75" />
      <path d={c.couvertures} fill={`url(#${id('couverture')})`} stroke="#9a5ac8" strokeWidth="0.3" strokeOpacity="0.8" />
      <path d={c.bord} fill="none" stroke="#e9b8ff" strokeWidth="0.7" strokeLinecap="round" opacity="0.7" />
    </g>
  )
  return {
    arriere: null,
    dedans: (
      <>
        <circle cx="50" cy="106" r="50" fill={`url(#${id('abime')})`} />
        <g className="dv-decor">
          {ciel(
            [
              [16, 26, 0.6],
              [86, 22, 0.7],
              [84, 40, 0.5],
              [12, 46, 0.5],
              [30, 12, 0.4],
            ],
            '#e7d6ff',
          )}
        </g>
        <path d="M47.6,24 L52.4,24 L51.3,62 L48.7,62 Z" fill={`url(#${id('trainee')})`} />
        {cote(AILES_DECHU.gauche, 'gauche')}
        {cote(AILES_DECHU.droite, 'droite')}
        <circle className="dv-pouls" cx="50" cy="64" r="9" fill={`url(#${id('chute')})`} />
        {etoile(50, 64, 11, 'chute', 'dv-scintille', '#ffe3f0')}
        <circle cx="50" cy="64" r="3" fill="#ffffff" />
        <g className="dv-plumes">
          {PLUMES_TOMBEES.map(([x, y, a], i) => (
            <path key={i} className="dv-plume" d={pose(amande(7, 1.9), x, y, a)} fill="#3b1856" stroke="#ff5c9a" strokeWidth="0.35" />
          ))}
        </g>
        <g className="dv-braises">
          {[
            [30, 92, 0.9],
            [44, 96, 0.7],
            [58, 94, 0.8],
            [70, 90, 0.7],
            [38, 88, 0.6],
          ].map(([cx, cy, r], i) => (
            <circle key={i} className="dv-braise" cx={cx} cy={cy} r={r} fill="#ff5c7a" />
          ))}
        </g>
      </>
    ),
    devant: (
      <g className="dv-aureole-brisee" fill="none" strokeLinecap="round">
        <path d="M58.6,22.8 A15,4.6 0 1 1 64.6,17.2" stroke={`url(#${id('aureole')})`} strokeWidth="2.3" />
        <path className="dv-eclat-tombe" d="M66.8,21.4 A15,4.6 0 0 1 62.4,25.6" stroke={`url(#${id('aureole')})`} strokeWidth="2.3" />
      </g>
    ),
    defs: (
      <>
        <radialGradient id={id('abime')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ff2d5f" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#a0153e" stopOpacity="0.45" />
          <stop offset="1" stopColor="#5a0b2a" stopOpacity="0" />
        </radialGradient>
        {/* Les plumes prennent la lumière d'en bas : l'abîme les rougit par-dessous. */}
        <radialGradient id={id('plume')} gradientUnits="userSpaceOnUse" cx="50" cy="104" r="80">
          <stop offset="0.28" stopColor="#ff4d8d" />
          <stop offset="0.45" stopColor="#b0306e" />
          <stop offset="0.64" stopColor="#6a2a94" />
          <stop offset="0.84" stopColor="#3b1856" />
          <stop offset="1" stopColor="#1e0a2e" />
        </radialGradient>
        <linearGradient id={id('couverture')} gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="70">
          <stop offset="0" stopColor="#9a66c8" />
          <stop offset="1" stopColor="#3b1856" />
        </linearGradient>
        <linearGradient id={id('trainee')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd6ea" stopOpacity="0" />
          <stop offset="1" stopColor="#ffe3f0" stopOpacity="0.85" />
        </linearGradient>
        <radialGradient id={id('chute')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd6ea" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff5c9a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('aureole')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff2c4" />
          <stop offset="0.6" stopColor="#d9a53a" />
          <stop offset="1" stopColor="#7a5618" />
        </linearGradient>
      </>
    ),
  }
}

// ── Le cadre ──────────────────────────────────────────────────────────────

interface Dessin {
  /** Derrière le disque : ce qui ne se voit qu'au-delà du cadre. */
  arriere: ReactNode
  /** Dans le disque, découpé à sa mesure. */
  dedans: ReactNode
  /** Par-dessus le cadre : ce qui le déborde. */
  devant: ReactNode
  defs: ReactNode
}

const DESSINS: Record<string, (id: Id) => Dessin> = {
  'dv:helios': helios,
  'dv:seraphin': seraphin,
  'dv:lotus': lotus,
  'dv:arbre': arbre,
  'dv:dechu': dechu,
}

interface Props {
  /** La clé du Divin (`dv:helios`…). */
  cle: string
  /** Pas encore descendu : un voile, et rien d'autre. */
  verrouille?: boolean
  className?: string
}

/** Un avatar divin, à la taille du texte qui l'entoure (1 em) — ses débords en plus. */
export function Divin({ cle, verrouille, className }: Props) {
  const brut = useId()
  const d = divinDe(cle)
  const theme = THEMES[cle]
  const dessiner = DESSINS[cle]
  if (!d || !theme || !dessiner) return null
  // `useId` rend des deux-points, que `url(#…)` n'aime pas ; la clé entre
  // dans l'identifiant, comme pour les légendaires.
  const base = `${cle.replace(':', '-')}${brut.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const id = (nom: string) => `${base}-${nom}`
  const classes = ['dv', `dv-${cle.slice(3)}`]
  if (verrouille) classes.push('dv-voile')
  if (className) classes.push(className)
  const titre = verrouille ? 'Un Divin — personne ne sait ce qui le fait descendre' : d.nom
  const dessin = verrouille ? null : dessiner(id)
  // L'anneau de l'Ange Déchu est brisé : un éclat en manque, celui qui tombe.
  const brisure = cle === 'dv:dechu' && !verrouille ? '256 12 30 400' : undefined
  return (
    <svg className={classes.join(' ')} viewBox="0 0 100 100" role="img" aria-label={titre}>
      <title>{titre}</title>
      <defs>
        <radialGradient id={id('aura')} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="62">
          <stop offset="0.62" stopColor={theme.aura} stopOpacity={verrouille ? 0.12 : 0.42} />
          <stop offset="1" stopColor={theme.aura} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('fond')} cx="50%" cy="42%" r="66%">
          <stop offset="0" stopColor={verrouille ? '#2a2130' : theme.fond[0]} />
          <stop offset="0.55" stopColor={verrouille ? '#15101a' : theme.fond[1]} />
          <stop offset="1" stopColor={verrouille ? '#07050a' : theme.fond[2]} />
        </radialGradient>
        <linearGradient id={id('anneau')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.anneau[0]} />
          <stop offset="0.5" stopColor={theme.anneau[1]} />
          <stop offset="1" stopColor={theme.anneau[2]} />
        </linearGradient>
        <linearGradient id={id('balayage')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id('brume')} cx="50%" cy="55%" r="50%">
          <stop offset="0" stopColor={theme.aura} stopOpacity="0.35" />
          <stop offset="1" stopColor={theme.aura} stopOpacity="0" />
        </radialGradient>
        <clipPath id={id('disque')}>
          <circle cx="50" cy="50" r="45.6" />
        </clipPath>
        {dessin?.defs}
      </defs>
      <circle className="dv-aura" cx="50" cy="50" r="62" fill={`url(#${id('aura')})`} />
      {dessin?.arriere}
      <circle className="dv-fond" cx="50" cy="50" r="46.6" fill={`url(#${id('fond')})`} />
      <g clipPath={`url(#${id('disque')})`}>
        {dessin ? (
          <>
            {dessin.dedans}
            <g transform="rotate(20 50 50)">
              <rect className="dv-balayage" x="-40" y="-10" width="24" height="120" fill={`url(#${id('balayage')})`} />
            </g>
          </>
        ) : (
          <>
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
          </>
        )}
      </g>
      <g className="dv-cadre">
        <circle cx="50" cy="50" r="47.2" fill="none" stroke={`url(#${id('anneau')})`} strokeWidth="2.2" strokeDasharray={brisure} />
        <circle cx="50" cy="50" r="44.9" fill="none" stroke={theme.anneau[0]} strokeWidth="0.45" opacity="0.55" />
        {!verrouille && (
          <g className="dv-orbite">
            <path d="M50,2.8 A47.2,47.2 0 0 1 66.1,5.6" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
          </g>
        )}
      </g>
      {dessin?.devant}
    </svg>
  )
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Divin })
