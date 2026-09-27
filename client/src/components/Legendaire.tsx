import { useId, type ReactNode } from 'react'
import type { Finition } from '../../../shared/profil'
import { legendaire as legendaireDe } from '../../../shared/legendaires'
import { inscrireDessin } from './medaillons'
import { Cercle, OR, etoile } from './Cercle'

/**
 * Les avatars légendaires : des médaillons dessinés, qui ne se gagnent que
 * par un haut fait (`shared/legendaires.ts`).
 *
 * Un emoji est à tout le monde ; un légendaire, non — et il doit se voir de
 * loin. Chacun est un disque à sa palette, cerclé d'or (de violet pour ceux
 * de l'ombre), avec un emblème assez franc pour se reconnaître à vingt
 * pixels dans un classement, et assez fin pour qu'on veuille le regarder en
 * grand sur sa page. Un reflet le traverse de temps en temps ; chacun a en
 * plus son mouvement à lui — la flamme du Phénix, le Fantôme qui flotte.
 *
 * Tout est en SVG dans la page : rien à télécharger, et pas d'emoji récent
 * qu'un Windows 10 afficherait en carré vide.
 *
 * Chaque dessin sépare sa forme (`lg-forme`), ses détails (`lg-details`) et
 * son décor (`lg-decor`) : verrouillé, il ne reste que la forme, en
 * silhouette dorée sur un disque sombre — on sait ce qu'on veut avant de
 * l'avoir.
 *
 * Porté, son cercle prend la matière de la finition du joueur — bronze,
 * argent, or, irisé, prisme, aurore, nuit étoilée. Le halo d'une finition
 * s'empilait autour du médaillon, qui avait déjà son cercle d'or : deux ou
 * trois anneaux, une cible. Il n'y a plus qu'une bordure, et c'est elle qui
 * dit le niveau.
 */

interface Palette {
  /** Le fond : du centre vers le bord. */
  fond: [string, string, string]
  /** L'emblème : du haut vers le bas. */
  embleme: [string, string]
}

type Dessin = (id: (nom: string) => string, eclat: boolean) => ReactNode

const OMBRE: [string, string, string] = ['#d9c9ff', '#6d4fb3', '#1d1233']

/** Un ciel : quelques points, toujours les mêmes pour un même dessin. */
function ciel(points: [number, number, number][]) {
  return points.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fffbe6" opacity={0.35 + (i % 3) * 0.2} />)
}

/** La crinière du Lion : seize mèches arrondies autour du visage. */
const CRINIERE = (() => {
  const n = 16
  const cx = 50
  const cy = 52
  let d = ''
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2
    const a1 = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2
    const a2 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2
    const p0 = [cx + Math.cos(a0) * 30, cy + Math.sin(a0) * 30]
    const p1 = [cx + Math.cos(a1) * 44, cy + Math.sin(a1) * 44]
    const p2 = [cx + Math.cos(a2) * 30, cy + Math.sin(a2) * 30]
    d += `${i === 0 ? `M${p0[0].toFixed(1)},${p0[1].toFixed(1)} ` : ''}Q${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)} `
  }
  return d + 'Z'
})()

/** Un chemin et son miroir de part et d'autre de l'axe x = 50. */
const miroir = (d: string) =>
  d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${(100 - Number(x)).toFixed(1)},${y}`)

const PALETTES: Record<string, Palette> = {
  'lg:phenix': { fond: ['#ffcf6e', '#e8512a', '#4a0b27'], embleme: ['#fffbe0', '#ff9d3c'] },
  'lg:dragon': { fond: ['#2f8f68', '#0d3b2c', '#03130d'], embleme: ['#fff4b0', '#e0a100'] },
  'lg:oracle': { fond: ['#5b36a8', '#221047', '#08030f'], embleme: ['#d8fbff', '#7b6cf0'] },
  'lg:chouette': { fond: ['#3a4f8a', '#16203f', '#070b18'], embleme: ['#ffffff', '#9aa6b8'] },
  'lg:tigre': { fond: ['#5fdcff', '#1461c4', '#07183a'], embleme: ['#ffc15e', '#ef6f1a'] },
  'lg:licorne': { fond: ['#9a6ae6', '#3f2186', '#12082a'], embleme: ['#ffffff', '#e4dcff'] },
  'lg:lion': { fond: ['#ff7a70', '#b0122d', '#3a040f'], embleme: ['#ffd98a', '#e39a35'] },
  'lg:renard': { fond: ['#3d63a8', '#172a57', '#060b1a'], embleme: ['#ffae57', '#e85d1c'] },
  'lg:comete': { fond: ['#2a3f96', '#0c1540', '#03050f'], embleme: ['#ffffff', '#7df3ff'] },
  'lg:kraken': { fond: ['#168091', '#073944', '#020c10'], embleme: ['#c98af0', '#6a2a93'] },
  'lg:fantome': { fond: ['#5b48a6', '#211848', '#07050f'], embleme: ['#ffffff', '#cfc6ff'] },
  'lg:trou-noir': { fond: ['#2d1450', '#0a0418', '#000000'], embleme: ['#fff3c4', '#ff8a3d'] },
  'lg:sphinx': { fond: ['#f6c26b', '#b3561f', '#2e0f05'], embleme: ['#fff0c7', '#d99a3a'] },
  'lg:citrouille': { fond: ['#7b4bb8', '#2d1250', '#0b0416'], embleme: ['#ffbe5c', '#e0621a'] },
  'lg:sapin': { fond: ['#3d63a8', '#142552', '#050b1c'], embleme: ['#6fdc98', '#1a7446'] },
  'lg:bouquet': { fond: ['#4a3598', '#1a0f47', '#06031a'], embleme: ['#fff4b8', '#ffb300'] },
}

/**
 * Les mêmes, éclatés. L'Éclat qui tombe sur un légendaire porté ne fait pas
 * tourner ses teintes au hasard comme celles d'un emoji : chacun a sa
 * version rare, dessinée — le Phénix de glace, le Dragon d'argent, la
 * Chouette d'or, le Tigre blanc, la Licorne noire… Le corps change de
 * couleurs, les yeux et les détails restent ceux qu'on connaît.
 */
const PALETTES_ECLAT: Record<string, Palette> = {
  'lg:phenix': { fond: ['#c4f4ff', '#2f86d6', '#0a1d4d'], embleme: ['#ffffff', '#8fdcff'] },
  'lg:dragon': { fond: ['#7a58d0', '#2a1566', '#0b0426'], embleme: ['#f4f8ff', '#9fb4d8'] },
  'lg:oracle': { fond: ['#2aa37e', '#0c4535', '#03140f'], embleme: ['#eafff6', '#5fe0b0'] },
  'lg:chouette': { fond: ['#b03a52', '#4a0f22', '#16030a'], embleme: ['#fff6d8', '#e0b04a'] },
  'lg:tigre': { fond: ['#c9a4ff', '#5a2aa8', '#170838'], embleme: ['#ffffff', '#d6dde8'] },
  'lg:licorne': { fond: ['#ffb8d2', '#b8386e', '#3a0a22'], embleme: ['#5a4872', '#1c1228'] },
  'lg:lion': { fond: ['#86b6ff', '#1d3f9e', '#07122e'], embleme: ['#ffffff', '#dfe4ee'] },
  'lg:renard': { fond: ['#7458c8', '#281a66', '#0a0622'], embleme: ['#f6f8ff', '#b4c0de'] },
  'lg:comete': { fond: ['#c23a62', '#4a0a26', '#12030a'], embleme: ['#fffbe6', '#ffd27a'] },
  'lg:kraken': { fond: ['#6a34a8', '#240f40', '#0a0414'], embleme: ['#a8ffd6', '#1f9a68'] },
  'lg:fantome': { fond: ['#22845f', '#08301f', '#010a06'], embleme: ['#f0fff8', '#8fffd0'] },
  'lg:trou-noir': { fond: ['#11566b', '#031a24', '#000000'], embleme: ['#f0fdff', '#5fdcff'] },
  'lg:sphinx': { fond: ['#5a8cff', '#1a2f8f', '#060b2e'], embleme: ['#e8f1ff', '#8da9e0'] },
  'lg:citrouille': { fond: ['#2f9a70', '#0e3d2c', '#03120c'], embleme: ['#f6f8ff', '#b8c6e6'] },
  'lg:sapin': { fond: ['#9cc4e0', '#34607c', '#0c1c29'], embleme: ['#f4fbff', '#a6cde4'] },
  'lg:bouquet': { fond: ['#a32a66', '#3a0c27', '#10030b'], embleme: ['#f0fcff', '#6fd6ff'] },
}

/** Le Sphinx : son œil, fardé ; l'autre en est le miroir. */
const OEIL_SPHINX = 'M40.5,40.5 C42.5,37.6 46.5,37.6 48.2,40.5 C46.5,42.8 42.5,42.8 40.5,40.5 Z'
const FARD_SPHINX = 'M40.5,40.5 L37.6,41.8'
const SOURCIL_SPHINX = 'M40,36.5 Q44.4,34.8 48.6,36.5'
/** Les rayures de la coiffe, sur le pan gauche : du bord du pan au visage. */
const RAYURES_SPHINX = [34, 41, 48, 55, 62, 68].map(y => `M${(30 - (y - 27) * 0.23).toFixed(1)},${y} L38.5,${y}`).join(' ')

/** La Citrouille : ses côtes, de part et d'autre. */
const COTES_CITROUILLE = 'M38,39 C31,46 30,66 38,77 M44,37 C40,48 40,67 44,79'

/** Le Sapin : ses trois étages, du haut vers le bas. */
const ETAGES_SAPIN = [
  'M50,17 L64,38 L57,38 L68,52 L32,52 L43,38 L36,38 Z',
  'M50,35 L70,60 L62,60 L75,74 L25,74 L38,60 L30,60 Z',
]

/** L'étoile de la cime, à cinq branches. */
const ETOILE_SAPIN = 'M50.0,7.0 L51.9,12.3 L57.6,12.5 L53.1,16.0 L54.7,21.5 L50.0,18.3 L45.3,21.5 L46.9,16.0 L42.4,12.5 L48.1,12.3 Z'

/** Le Bouquet final : une gerbe de douze rais autour de (x, y). */
function gerbe(x: number, y: number, r: number, n = 12): string {
  let d = ''
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    const [ca, sa] = [Math.cos(a), Math.sin(a)]
    const [bx, by] = [x + ca * r * 0.32, y + sa * r * 0.32]
    const [px, py] = [x + ca * r, y + sa * r]
    // Un rai effilé : large au départ, pointu au bout.
    const [nx, ny] = [-sa * r * 0.07, ca * r * 0.07]
    d += `M${(bx + nx).toFixed(1)},${(by + ny).toFixed(1)} L${px.toFixed(1)},${py.toFixed(1)} L${(bx - nx).toFixed(1)},${(by - ny).toFixed(1)} Z `
  }
  return d
}

const DESSINS: Record<string, Dessin> = {
  'lg:citrouille': (id, eclat) => {
    const lueur = `url(#${id('lueur')})`
    return (
      <>
        <g className="lg-decor">
          {/* La lune, en croissant, et deux chauves-souris. */}
          <path d="M80,14 A11,11 0 1 0 88,31 A8.5,8.5 0 1 1 80,14 Z" fill="#fff4d6" opacity="0.85" />
          <path d="M18,26 q3,-3 5,0 q2,-2 3,1 q1,-2 3,-1 q-2,1 -2,3 q-2,-1 -4,1 q-2,-2 -5,-1 q1,-1 0,-3 Z" fill="#12081f" opacity="0.8" />
          <path d="M28,15 q2,-2 3.5,0 q1.5,-1.5 2,0.7 q1,-1.4 2,-0.7 q-1.4,0.7 -1.4,2 q-1.4,-0.7 -2.8,0.7 q-1.4,-1.4 -3.5,-0.7 q0.7,-0.7 0,-2 Z" fill="#12081f" opacity="0.7" />
          {ciel([
            [16, 50, 0.8],
            [86, 52, 0.9],
            [64, 12, 0.7],
          ])}
        </g>
        <g className="lg-forme" fill={`url(#${id('embleme')})`}>
          {/* Un seul tracé : trois ellipses se chevauchaient dans la silhouette. */}
          <path d="M50,35 C45.5,35 42.5,36 40,37.5 C32,35.5 21.5,42 19.5,55 C17.5,68 26,80.5 36,80 C39.5,80 42,79.6 44,79.2 C46,80.4 48,81 50,81 C52,81 54,80.4 56,79.2 C58,79.6 60.5,80 64,80 C74,80.5 82.5,68 80.5,55 C78.5,42 68,35.5 60,37.5 C57.5,36 54.5,35 50,35 Z" />
          <path d="M47,37 C46,31 48,26 53,22 L57,25 C53,28 52,32 53,37 Z" fill={eclat ? '#7d93b3' : '#6e8b2e'} />
        </g>
        <g className="lg-details">
          <g fill="none" stroke={eclat ? '#8fa3c4' : '#b5480f'} strokeWidth="1.3" strokeLinecap="round" opacity="0.55">
            <path d={COTES_CITROUILLE} />
            <path d={miroir(COTES_CITROUILLE)} />
          </g>
          {/* La vrille de la tige. */}
          <path d="M55,27 C61,24 64,28 61,31 C59,33 57,31 59,30" fill="none" stroke={eclat ? '#7d93b3' : '#6e8b2e'} strokeWidth="1.2" strokeLinecap="round" />
          {/* Le visage creusé : la lueur de la bougie derrière, qui vacille. */}
          <g className="lg-bougie" fill={lueur}>
            <path d="M31,52 L45,52 L38,41 Z" />
            <path d="M55,52 L69,52 L62,41 Z" />
            <path d="M46.5,61 L53.5,61 L50,55 Z" />
            <path d="M28,65 C35,79 65,79 72,65 L66,67.5 L62,64 L57.5,70 L53.5,65.5 L50,71 L46.5,65.5 L42.5,70 L38,64 L34,67.5 Z" />
          </g>
        </g>
      </>
    )
  },

  'lg:sapin': (id, eclat) => {
    const boules = eclat ? ['#ffd45e', '#ffe9a8', '#ffc43a'] : ['#ff4d5e', '#ffd23f', '#5fb8ff']
    return (
      <>
        <g className="lg-decor">
          {/* La neige qui tombe. */}
          {ciel([
            [14, 30, 1.2],
            [22, 58, 1],
            [84, 26, 1.1],
            [80, 56, 1.3],
            [30, 16, 0.9],
            [72, 12, 1],
            [12, 76, 0.9],
            [88, 74, 1],
          ])}
          <path d="M8,88 C30,80 70,80 92,88 L92,100 L8,100 Z" fill="#ffffff" opacity="0.85" />
        </g>
        <g className="lg-forme" fill={`url(#${id('embleme')})`}>
          <path d={ETAGES_SAPIN[0]} />
          <path d={ETAGES_SAPIN[1]} />
          <path d="M50,56 L78,86 L22,86 Z" />
          <rect x="45" y="85" width="10" height="8" fill={eclat ? '#8fa9c0' : '#7a4a22'} />
          <path d={ETOILE_SAPIN} />
        </g>
        <g className="lg-details">
          <path className="lg-pouls" d={ETOILE_SAPIN} fill={eclat ? '#ffffff' : '#ffd23f'} />
          {/* La guirlande, en travers de chaque étage. */}
          <g fill="none" stroke={eclat ? '#fff3c4' : '#ffe9a8'} strokeWidth="1.2" strokeLinecap="round" opacity="0.85">
            <path d="M40,45 Q50,50 60,44" />
            <path d="M33,66 Q50,74 67,64" />
            <path d="M28,80 Q50,88 72,78" />
          </g>
          {[
            [44, 41, 0],
            [57, 48, 1],
            [38, 60, 2],
            [62, 69, 0],
            [47, 71, 1],
            [32, 79, 1],
            [68, 83, 2],
            [53, 84, 0],
          ].map(([x, y, c], i) => (
            <circle key={i} className={i % 3 === 0 ? 'lg-scintille' : undefined} cx={x} cy={y} r="2.6" fill={boules[c]} />
          ))}
        </g>
      </>
    )
  },

  'lg:bouquet': (id, eclat) => {
    const seconde = eclat ? '#ff9ad5' : '#7df3ff'
    return (
      <>
        <g className="lg-decor">
          {etoile(18, 24, 2.4, 'a')}
          {etoile(84, 70, 2, 'b')}
          {ciel([
            [26, 80, 0.8],
            [76, 20, 0.9],
            [12, 56, 0.7],
            [88, 44, 0.8],
          ])}
          {/* Les toits de la ville, tout en bas. */}
          <path d="M5,100 L5,88 L14,88 L14,84 L22,84 L22,90 L30,90 L30,82 L36,78 L42,82 L42,90 L52,90 L52,86 L60,86 L60,80 L68,80 L68,88 L76,88 L76,84 L86,84 L86,90 L95,90 L95,100 Z" fill="#05030d" opacity="0.9" />
        </g>
        <g className="lg-forme" fill={`url(#${id('embleme')})`}>
          <path d={gerbe(48, 42, 30)} />
          <circle cx="48" cy="42" r="5" />
          {/* La traînée de la fusée, qui monte de la ville. */}
          <path d="M47,88 C47.5,74 48,60 48,47 L49,47 C49,60 49.5,74 50,88 Z" opacity="0.7" />
        </g>
        <g className="lg-details">
          <g className="lg-pouls" fill={seconde}>
            <path d={gerbe(74, 30, 12, 10)} />
          </g>
          <g fill="#fffbe6">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => {
              const a = (i / 12) * Math.PI * 2 - Math.PI / 2
              return <circle key={i} className={i % 2 ? 'lg-scintille' : undefined} cx={48 + Math.cos(a) * 33} cy={42 + Math.sin(a) * 33} r="1.3" />
            })}
          </g>
          <circle cx="48" cy="42" r="2.4" fill="#ffffff" />
        </g>
      </>
    )
  },

  'lg:sphinx': (id, eclat) => {
    const trait = eclat ? '#4a68a8' : '#8a5a1c'
    return (
      <>
        <g className="lg-decor">
          <path d="M2,92 L22,63 L42,92 Z" fill="#000000" opacity="0.2" />
          <path d="M58,92 L79,60 L100,92 Z" fill="#000000" opacity="0.2" />
          {etoile(17, 30, 3.2, 'a')}
          {etoile(83, 25, 2.6, 'b')}
          {ciel([
            [26, 16, 0.8],
            [74, 13, 0.9],
            [12, 46, 0.7],
            [89, 44, 0.8],
          ])}
        </g>
        <g className="lg-forme" fill={`url(#${id('embleme')})`}>
          {/* La coiffe rayée qui tombe en deux pans, le visage, la barbe tressée. */}
          <path d="M50,13 C39,13 32,18 30,27 L21,66 C20,72 25,76 31,75 L38,74 L38,60 C41,68 45,72 50,72 C55,72 59,68 62,60 L62,74 L69,75 C75,76 80,72 79,66 L70,27 C68,18 61,13 50,13 Z" />
          <path d="M46.5,71 L53.5,71 L52.6,85 C52.2,88 47.8,88 47.4,85 Z" />
        </g>
        <g className="lg-details">
          <path d="M38.5,30 C38.5,24 61.5,24 61.5,30 L61.5,49 C61.5,61 56,67 50,67 C44,67 38.5,61 38.5,49 Z" fill="#ffffff" opacity="0.16" />
          <g fill="none" stroke={trait} strokeWidth="1.4" strokeLinecap="round" opacity="0.6">
            <path d={RAYURES_SPHINX} />
            <path d={miroir(RAYURES_SPHINX)} />
            <path d="M34,21.5 Q50,14.5 66,21.5" />
            <path d="M47.2,75 L52.8,75 M47.4,79 L52.6,79 M47.6,83 L52.4,83" />
          </g>
          <path d="M36,29 Q50,24.5 64,29" fill="none" stroke={trait} strokeWidth="2" strokeLinecap="round" />
          <path d="M50,17.5 C48.4,19.5 48.6,22.5 50,25 C51.4,22.5 51.6,19.5 50,17.5 Z" fill={eclat ? '#bfe0ff' : '#e0a100'} />
          <path d={OEIL_SPHINX} fill="#fffaf0" />
          <path d={miroir(OEIL_SPHINX)} fill="#fffaf0" />
          <circle cx="44.4" cy="40.4" r="1.7" fill="#2a160a" />
          <circle cx="55.6" cy="40.4" r="1.7" fill="#2a160a" />
          <g fill="none" stroke="#2a160a" strokeWidth="1.1" strokeLinecap="round">
            <path d={FARD_SPHINX} />
            <path d={miroir(FARD_SPHINX)} />
            <path d={SOURCIL_SPHINX} />
            <path d={miroir(SOURCIL_SPHINX)} />
            <path d="M50,42.5 L47.8,52.5 Q50,54 52.2,52.5" />
            <path d="M46,58 Q50,60.2 54,58" strokeWidth="1.3" />
          </g>
        </g>
      </>
    )
  },

  'lg:phenix': id => {
    const aile = 'M53,40 C62,33 72,24 85,11 C83,19 81,24 77,28 C83,27 87,25 91,22 C87,30 81,35 74,38 C79,38 83,38 87,37 C81,43 70,47 58,48 Z'
    return (
      <>
        <g className="lg-decor lg-braises">
          {[
            [20, 70, 1.6],
            [80, 66, 1.4],
            [30, 84, 1.2],
            [72, 82, 1.5],
            [16, 52, 1.1],
          ].map(([x, y, r], i) => (
            <circle key={i} className="lg-braise" cx={x} cy={y} r={r} fill="#ffe08a" />
          ))}
        </g>
        <g className="lg-forme lg-flamme" fill={`url(#${id('embleme')})`}>
          <path d={aile} />
          <path d={miroir(aile)} />
          <path d="M50,56 C46,66 43,75 34,88 C44,83 48,78 50,71 C52,78 56,83 66,88 C57,75 54,66 50,56 Z" />
          <path d="M50,60 C48,71 49,82 50,94 C51,82 52,71 50,60 Z" />
          <path d="M50,30 C57,35 58,48 50,62 C42,48 43,35 50,30 Z" />
          <circle cx="50" cy="27" r="6" />
          <path d="M46.5,23 C45,17 47.5,13 50,9 C52.5,13 55,17 53.5,23 Z" />
        </g>
        <g className="lg-details">
          <path d="M50,34 C53,38 53.5,46 50,55 C46.5,46 47,38 50,34 Z" fill="#ffffff" opacity="0.55" />
          <circle cx="52" cy="26.5" r="1.4" fill="#5a0f2e" />
          <path d="M55,28 L60,29.5 L55,31 Z" fill="#ffd166" />
        </g>
      </>
    )
  },

  'lg:dragon': (id, eclat) => (
    <>
      <g className="lg-decor" fill="none" stroke="#5fc79b" strokeWidth="1.4" opacity="0.45">
        <path d="M14,30 Q22,22 30,30 Q38,22 46,30 Q54,22 62,30 Q70,22 78,30 Q86,22 94,30" />
        <path d="M6,76 Q14,68 22,76 Q30,68 38,76 Q46,68 54,76 Q62,68 70,76 Q78,68 86,76" />
      </g>
      <g className="lg-forme">
        {/* L'arcade : une crête au-dessus de l'œil. */}
        <path d="M12,44 C26,26 46,20 70,24 C80,26 88,30 92,34 C82,30 72,30 64,32 C48,34 30,40 12,44 Z" fill={eclat ? '#8fa4c8' : '#c78a00'} />
        <path d="M13,52 C28,30 72,30 87,52 C72,74 28,74 13,52 Z" fill={`url(#${id('iris')})`} />
      </g>
      <g className="lg-details">
        <path d="M13,52 C28,30 72,30 87,52 C72,74 28,74 13,52 Z" fill="none" stroke="#3a2600" strokeWidth="2.2" />
        <path className="lg-pupille" d="M50,33 C56,42 56,62 50,71 C44,62 44,42 50,33 Z" fill="#120800" />
        <ellipse cx="59" cy="43" rx="4" ry="2.6" fill="#ffffff" opacity="0.85" />
        <ellipse cx="41" cy="61" rx="2" ry="1.2" fill="#ffffff" opacity="0.5" />
      </g>
    </>
  ),

  'lg:oracle': id => (
    <>
      <g className="lg-decor">
        {ciel([
          [16, 22, 0.9],
          [84, 18, 1.1],
          [12, 60, 0.8],
          [88, 58, 0.9],
          [24, 88, 0.7],
          [78, 86, 0.8],
        ])}
      </g>
      <g className="lg-forme">
        <path d="M33,74 L67,74 L61,86 L39,86 Z" fill={`url(#${id('or')})`} />
        <ellipse cx="50" cy="73" rx="19" ry="4" fill={`url(#${id('or')})`} />
        <circle cx="50" cy="45" r="27" fill={`url(#${id('boule')})`} />
      </g>
      <g className="lg-details">
        <circle className="lg-lueur" cx="50" cy="45" r="15" fill="#fffbe6" opacity="0.25" />
        {etoile(50, 45, 12, 'coeur', 'lg-pouls')}
        {etoile(38, 36, 3, 'a')}
        {etoile(62, 55, 2.4, 'b')}
        <path d="M31,34 C34,26 41,21 48,20" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" opacity="0.7" />
        <circle cx="50" cy="45" r="27" fill="none" stroke="#ffffff" strokeWidth="0.8" opacity="0.4" />
      </g>
    </>
  ),

  'lg:chouette': (id, eclat) => (
    <>
      <g className="lg-decor">
        {ciel([
          [14, 30, 0.9],
          [86, 34, 0.8],
          [20, 80, 0.7],
          [82, 78, 0.9],
        ])}
      </g>
      <g className="lg-forme" fill={`url(#${id('embleme')})`}>
        <path d="M50,21 C28,21 18,39 20,57 C22,77 36,89 50,89 C64,89 78,77 80,57 C82,39 72,21 50,21 Z" />
        <path d="M27,31 L19,11 L38,24 Z" />
        <path d="M73,31 L81,11 L62,24 Z" />
      </g>
      <g className="lg-details">
        <path d="M24,62 Q30,66 36,62 M34,72 Q40,76 46,72 M54,72 Q60,76 66,72 M64,62 Q70,66 76,62 M44,82 Q50,86 56,82" fill="none" stroke={eclat ? '#a8782a' : '#7d899c'} strokeWidth="1.6" strokeLinecap="round" />
        <g className="lg-yeux">
          <circle cx="37" cy="47" r="12" fill="#eef2f7" stroke={eclat ? '#a8782a' : '#7d899c'} strokeWidth="1.2" />
          <circle cx="63" cy="47" r="12" fill="#eef2f7" stroke={eclat ? '#a8782a' : '#7d899c'} strokeWidth="1.2" />
          <circle cx="37" cy="47" r="8" fill={`url(#${id('ambre')})`} />
          <circle cx="63" cy="47" r="8" fill={`url(#${id('ambre')})`} />
          <circle cx="37" cy="47" r="4" fill="#111111" />
          <circle cx="63" cy="47" r="4" fill="#111111" />
          <circle cx="35" cy="44.5" r="1.6" fill="#ffffff" />
          <circle cx="61" cy="44.5" r="1.6" fill="#ffffff" />
        </g>
        <path d="M50,56 L45,62 L50,70 L55,62 Z" fill="#f2b233" />
      </g>
    </>
  ),

  'lg:tigre': (id, eclat) => (
    <>
      <g className="lg-forme" fill={`url(#${id('embleme')})`}>
        <circle cx="26" cy="27" r="9.5" />
        <circle cx="74" cy="27" r="9.5" />
        <path d="M50,22 C29,22 17,35 17,53 C17,71 31,85 50,87 C69,85 83,71 83,53 C83,35 71,22 50,22 Z" />
      </g>
      <g className="lg-details">
        <circle cx="26" cy="27" r="4.6" fill={eclat ? '#eee6ff' : '#ffe3c4'} />
        <circle cx="74" cy="27" r="4.6" fill={eclat ? '#eee6ff' : '#ffe3c4'} />
        <g fill="#1a0f08">
          <path d="M18,45 L31,48 L18,52 Z" />
          <path d="M82,45 L69,48 L82,52 Z" />
          <path d="M21,61 L32,60 L24,66 Z" />
          <path d="M79,61 L68,60 L76,66 Z" />
          <path d="M34,26 L39,34 L36,35 Z" />
          <path d="M66,26 L61,34 L64,35 Z" />
        </g>
        <ellipse cx="41.5" cy="68" rx="10" ry="8" fill="#fff6ea" />
        <ellipse cx="58.5" cy="68" rx="10" ry="8" fill="#fff6ea" />
        <path d="M44.5,60 L55.5,60 L50,66.5 Z" fill="#e8556d" />
        <path d="M31,49 C34,44.5 42,44.5 45,49 C42,52.5 34,52.5 31,49 Z" fill={eclat ? '#7fd8ff' : '#ffe14d'} />
        <path d="M69,49 C66,44.5 58,44.5 55,49 C58,52.5 66,52.5 69,49 Z" fill={eclat ? '#7fd8ff' : '#ffe14d'} />
        <ellipse cx="38" cy="49" rx="1.5" ry="3" fill="#111111" />
        <ellipse cx="62" cy="49" rx="1.5" ry="3" fill="#111111" />
        {/* La foudre, au front. */}
        <path className="lg-eclair" d="M53,21 L43.5,36 L50,36 L46,47 L57.5,30.5 L51,30.5 L56,21 Z" fill="#fff36b" stroke="#1a0f08" strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    </>
  ),

  'lg:licorne': (id, eclat) => (
    <>
      <g className="lg-decor">
        {etoile(18, 24, 3.4, 'a')}
        {etoile(84, 76, 2.6, 'b')}
        {etoile(24, 82, 2, 'c')}
        {ciel([
          [30, 12, 0.8],
          [88, 40, 0.9],
          [12, 50, 0.7],
        ])}
      </g>
      <g className="lg-forme">
        <path d="M62,21 L68,7 L70,23 Z" fill={`url(#${id('embleme')})`} />
        <path d="M50,22 L37,2 L56,17 Z" fill={`url(#${id('or')})`} />
        <path
          d="M62,18 C71,20 77,28 77,38 C77,50 73,62 71,74 L71,94 L44,94 C46,82 46,73 44,67 C38,65 30,65 24,67 C18,67 14,63 15.5,57 C17,51 23,46 30,42 C38,36 45,27 51,21 C54,18.5 58,17.5 62,18 Z"
          fill={`url(#${id('embleme')})`}
        />
        <path d="M64,17 C81,21 88,40 84,58 C82,70 85,81 92,92 L77,94 C75,80 77,67 77,55 C78,41 73,28 64,17 Z" fill={`url(#${id('arcenciel')})`} />
      </g>
      <g className="lg-details">
        <path d="M44,14 L49,12 M46,9 L51,8" stroke={eclat ? '#6b7688' : '#a8781c'} strokeWidth="1" strokeLinecap="round" />
        <ellipse cx="45" cy="44" rx="2.4" ry="3.2" fill={eclat ? '#ffe9a8' : '#2b1a5e'} />
        <circle cx="44.2" cy="42.8" r="0.8" fill="#ffffff" />
        <circle cx="21" cy="59" r="1.4" fill="#8a7fbf" />
        <path d="M17,63 Q21,65 26,64" fill="none" stroke="#8a7fbf" strokeWidth="1" strokeLinecap="round" />
      </g>
    </>
  ),

  'lg:lion': (id, eclat) => (
    <>
      <g className="lg-forme">
        <path d={CRINIERE} fill={`url(#${id('criniere')})`} />
        <circle cx="31.5" cy="37" r="6.5" fill={`url(#${id('embleme')})`} />
        <circle cx="68.5" cy="37" r="6.5" fill={`url(#${id('embleme')})`} />
        <circle cx="50" cy="55" r="22" fill={`url(#${id('embleme')})`} />
        <path d="M33,24 L37,8 L44,17 L50,4 L56,17 L63,8 L67,24 Z" fill={`url(#${id('or')})`} />
      </g>
      <g className="lg-details">
        <circle cx="31.5" cy="37" r="3" fill={eclat ? '#8f9cc0' : '#b8641c'} />
        <circle cx="68.5" cy="37" r="3" fill={eclat ? '#8f9cc0' : '#b8641c'} />
        <path d="M37,50 C39.5,47 44,47 46,50 C44,52 39.5,52 37,50 Z" fill="#3b1d06" />
        <path d="M63,50 C60.5,47 56,47 54,50 C56,52 60.5,52 63,50 Z" fill="#3b1d06" />
        <ellipse cx="44.5" cy="64" rx="7.5" ry="5.8" fill={eclat ? '#f2f5fb' : '#fde8bd'} />
        <ellipse cx="55.5" cy="64" rx="7.5" ry="5.8" fill={eclat ? '#f2f5fb' : '#fde8bd'} />
        <path d="M45.5,57 L54.5,57 L50,62.5 Z" fill="#5a2d0c" />
        <path d="M46,70 Q50,73.5 54,70" fill="none" stroke="#5a2d0c" strokeWidth="1.3" strokeLinecap="round" />
        <circle className="lg-joyau" cx="50" cy="15" r="2.2" fill="#e8364f" />
        <circle cx="40.5" cy="19" r="1.5" fill="#3aa0ff" />
        <circle cx="59.5" cy="19" r="1.5" fill="#3aa0ff" />
      </g>
    </>
  ),

  'lg:renard': (id, eclat) => (
    <>
      <g className="lg-decor">
        {ciel([
          [16, 18, 0.9],
          [28, 8, 0.7],
          [12, 40, 0.8],
          [88, 84, 0.8],
        ])}
        <circle className="lg-lune" cx="64" cy="36" r="27" fill={eclat ? '#ffcf6e' : '#fdf3c4'} mask={`url(#${id('croissant')})`} opacity="0.95" />
      </g>
      <g className="lg-forme" fill={`url(#${id('embleme')})`}>
        <path d="M22,46 C22,38 25,32 29,28 L23,9 L42,27 C46,26 54,26 58,27 L77,9 L71,28 C75,32 78,38 78,46 C78,58 65,72 50,84 C35,72 22,58 22,46 Z" />
      </g>
      <g className="lg-details">
        <path d="M28,25 L26,15 L36,25 Z" fill={eclat ? '#5d6a94' : '#5a2410'} />
        <path d="M72,25 L74,15 L64,25 Z" fill={eclat ? '#5d6a94' : '#5a2410'} />
        <path d="M22,48 C31,52 41,60 50,84 C38,76 26,64 22,48 Z" fill="#fff6ea" />
        <path d="M78,48 C69,52 59,60 50,84 C62,76 74,64 78,48 Z" fill="#fff6ea" />
        <path d="M34,45 C37,41.5 42,41.5 44,44.5 C41,46.5 37,46.5 34,45 Z" fill="#2a1206" />
        <path d="M66,45 C63,41.5 58,41.5 56,44.5 C59,46.5 63,46.5 66,45 Z" fill="#2a1206" />
        <circle cx="50" cy="79" r="3.2" fill="#2a1206" />
      </g>
    </>
  ),

  'lg:comete': (id, eclat) => (
    <>
      <g className="lg-decor">
        {ciel([
          [18, 20, 0.9],
          [40, 12, 0.7],
          [88, 60, 0.9],
          [70, 88, 0.8],
          [12, 44, 0.6],
        ])}
        {etoile(26, 30, 2.4, 'a')}
        {etoile(84, 44, 2, 'b')}
        {etoile(58, 80, 1.8, 'c')}
      </g>
      <g className="lg-forme">
        <path d="M78,20 C60,30 32,52 8,90 C34,66 58,48 86,32 Z" fill={`url(#${id('queue')})`} />
        <path d="M76,24 C62,40 44,62 30,94 C50,70 66,52 84,36 Z" fill={`url(#${id('queue2')})`} opacity="0.8" />
        <circle cx="80" cy="26" r="11" fill={`url(#${id('tete')})`} />
      </g>
      <g className="lg-details">
        <circle className="lg-pouls" cx="80" cy="26" r="17" fill={eclat ? '#ffe7a0' : '#bff9ff'} opacity="0.25" />
        <circle cx="77" cy="23" r="3.2" fill="#ffffff" />
      </g>
    </>
  ),

  'lg:kraken': (id, eclat) => {
    const tentacule = [
      'M37,56 C28,64 17,66 14,78 C13,86 21,89 24,83 C26,77 31,72 40,62 Z',
      'M43,59 C39,70 32,78 34,88 C35,94 42,94 42,88 C42,80 45,72 48,61 Z',
      'M50,60 C50,72 48,82 52,92 C54,96 59,94 57,89 C54,81 55,72 54,60 Z',
    ]
    return (
      <>
        <g className="lg-decor">
          {[
            [22, 30, 2.2],
            [26, 20, 1.4],
            [80, 40, 1.8],
            [76, 28, 1.2],
          ].map(([x, y, r], i) => (
            <circle key={i} className="lg-bulle" cx={x} cy={y} r={r} fill="none" stroke={eclat ? '#e2c4ff' : '#9ff5ff'} strokeWidth="0.8" opacity="0.7" />
          ))}
        </g>
        <g className="lg-forme lg-ondule" fill={`url(#${id('embleme')})`}>
          {tentacule.map(d => (
            <path key={d} d={d} />
          ))}
          {tentacule.map(d => (
            <path key={`m${d}`} d={miroir(d)} />
          ))}
          <path d="M29,48 C29,24 39,11 50,11 C61,11 71,24 71,48 C71,57 64,62 50,62 C36,62 29,57 29,48 Z" />
        </g>
        <g className="lg-details">
          <path d="M36,22 C40,16 46,14 50,14" fill="none" stroke={eclat ? '#e6fff3' : '#f3d4ff'} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          <circle cx="41" cy="44" r="5.5" fill="#ffe066" />
          <circle cx="59" cy="44" r="5.5" fill="#ffe066" />
          <ellipse cx="41" cy="44" rx="1.4" ry="4" fill="#1a0b24" />
          <ellipse cx="59" cy="44" rx="1.4" ry="4" fill="#1a0b24" />
          {[
            [22, 78],
            [37, 84],
            [78, 78],
            [63, 84],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.3" fill={eclat ? '#e6fff3' : '#f3d4ff'} opacity="0.8" />
          ))}
        </g>
      </>
    )
  },

  'lg:fantome': (id, eclat) => (
    <>
      <g className="lg-decor">
        <ellipse className="lg-brume" cx="26" cy="86" rx="20" ry="5" fill={eclat ? '#8fffd0' : '#cfc6ff'} opacity="0.18" />
        <ellipse className="lg-brume lg-brume-2" cx="74" cy="90" rx="22" ry="5" fill={eclat ? '#8fffd0' : '#cfc6ff'} opacity="0.14" />
        {ciel([
          [16, 22, 0.8],
          [86, 18, 0.9],
          [84, 56, 0.7],
        ])}
      </g>
      <g className="lg-flotte">
        <g className="lg-forme" fill={`url(#${id('embleme')})`}>
          <path d="M28,84 L28,44 C28,26 38,15 50,15 C62,15 72,26 72,44 L72,84 C68,78 64,78 61,84 C58,90 54,90 50,84 C46,78 42,78 39,84 C36,90 32,90 28,84 Z" />
          <path d="M28,52 C22,54 18,58 17,63 C22,62 26,60 28,58 Z" />
          <path d="M72,52 C78,54 82,58 83,63 C78,62 74,60 72,58 Z" />
        </g>
        <g className="lg-details">
          <ellipse cx="42" cy="43" rx="4.2" ry="6.4" fill="#1b1235" />
          <ellipse cx="58" cy="43" rx="4.2" ry="6.4" fill="#1b1235" />
          <circle cx="41" cy="40.5" r="1.3" fill="#ffffff" />
          <circle cx="57" cy="40.5" r="1.3" fill="#ffffff" />
          <ellipse cx="50" cy="58" rx="4" ry="5" fill="#1b1235" />
          <path d="M34,26 C38,20 44,18 49,18" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </g>
      </g>
    </>
  ),

  'lg:trou-noir': (id, eclat) => (
    <>
      <g className="lg-decor">
        {ciel([
          [14, 20, 0.8],
          [30, 10, 0.6],
          [86, 24, 0.9],
          [90, 70, 0.7],
          [18, 80, 0.8],
          [70, 90, 0.6],
        ])}
      </g>
      <g className="lg-forme" transform="rotate(-18 50 50)">
        {/* Le disque passe derrière le trou, puis devant : c'est ce qui
            donne sa profondeur au dessin. */}
        <path d="M10,50 A40,12 0 0 1 90,50" fill="none" stroke={`url(#${id('anneau')})`} strokeWidth="6" strokeLinecap="round" />
        <circle cx="50" cy="50" r="23" fill={`url(#${id('halo')})`} />
        <circle cx="50" cy="50" r="16" fill="#000000" />
        <path d="M34,50 A16,16 0 0 1 66,50" fill="none" stroke={`url(#${id('anneau')})`} strokeWidth="2.6" opacity="0.9" />
        <path className="lg-anneau" d="M90,50 A40,12 0 0 1 10,50" fill="none" stroke={`url(#${id('anneau')})`} strokeWidth="6.5" strokeLinecap="round" />
      </g>
      <g className="lg-details">
        <circle cx="50" cy="50" r="16.8" fill="none" stroke={eclat ? '#bff4ff' : '#ffd08a'} strokeWidth="0.9" opacity="0.9" />
      </g>
    </>
  ),
}

/**
 * Les dégradés propres à chaque dessin, en plus du fond et de l'emblème —
 * dans leur version éclatée quand l'Éclat est tombé sur le légendaire.
 */
function degradesDe(cle: string, id: (nom: string) => string, eclat: boolean): ReactNode {
  /** La couleur d'origine, ou celle de l'Éclat. */
  const c = (base: string, eclate: string) => (eclat ? eclate : base)
  switch (cle) {
    case 'lg:dragon':
      return (
        <radialGradient id={id('iris')} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor={c('#fff8c8', '#f0fbff')} />
          <stop offset="45%" stopColor={c('#f2b705', '#7fd4ff')} />
          <stop offset="100%" stopColor={c('#8a5200', '#1f5f9a')} />
        </radialGradient>
      )
    case 'lg:oracle':
      return (
        <>
          <radialGradient id={id('boule')} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor={c('#e6fdff', '#f4fff9')} stopOpacity="0.95" />
            <stop offset="45%" stopColor={c('#8f7cff', '#54e0a8')} stopOpacity="0.85" />
            <stop offset="100%" stopColor={c('#2b1a5e', '#0f4a36')} stopOpacity="0.95" />
          </radialGradient>
          <linearGradient id={id('or')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c('#fff2c4', '#ffe4dc')} />
            <stop offset="100%" stopColor={c('#a8781c', '#b8665a')} />
          </linearGradient>
        </>
      )
    case 'lg:chouette':
      return (
        <radialGradient id={id('ambre')} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor={c('#ffe89a', '#dcf8ff')} />
          <stop offset="100%" stopColor={c('#e89400', '#3fb4e8')} />
        </radialGradient>
      )
    case 'lg:licorne':
      return (
        <>
          <linearGradient id={id('or')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c('#fff6cc', '#ffffff')} />
            <stop offset="100%" stopColor={c('#d9a53a', '#9aa6b8')} />
          </linearGradient>
          <linearGradient id={id('arcenciel')} x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%" stopColor="#ff7eb3" />
            <stop offset="33%" stopColor="#ffd36e" />
            <stop offset="66%" stopColor="#7de2d1" />
            <stop offset="100%" stopColor="#8f7cff" />
          </linearGradient>
        </>
      )
    case 'lg:lion':
      return (
        <>
          <radialGradient id={id('criniere')} cx="50%" cy="52%" r="50%">
            <stop offset="55%" stopColor={c('#d9822b', '#b8c6e0')} />
            <stop offset="100%" stopColor={c('#7a3a0a', '#4a5a82')} />
          </radialGradient>
          <linearGradient id={id('or')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff2c4" />
            <stop offset="100%" stopColor="#d4a02a" />
          </linearGradient>
        </>
      )
    case 'lg:renard':
      return (
        <mask id={id('croissant')}>
          <circle cx="64" cy="36" r="27" fill="#ffffff" />
          <circle cx="76" cy="28" r="23" fill="#000000" />
        </mask>
      )
    case 'lg:comete':
      return (
        <>
          <linearGradient id={id('queue')} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c('#bff9ff', '#fff0b8')} stopOpacity="0.95" />
            <stop offset="100%" stopColor={c('#53c9ff', '#ff9a3d')} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id('queue2')} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c('#ffb3f0', '#ffd0e6')} stopOpacity="0.8" />
            <stop offset="100%" stopColor={c('#a86bff', '#ff5c8a')} stopOpacity="0" />
          </linearGradient>
          <radialGradient id={id('tete')} cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor={c('#bff9ff', '#fff0b8')} />
            <stop offset="100%" stopColor={c('#53c9ff', '#ffb347')} />
          </radialGradient>
        </>
      )
    case 'lg:trou-noir':
      return (
        <>
          <linearGradient id={id('anneau')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={c('#d9368b', '#3f6bff')} />
            <stop offset="35%" stopColor={c('#ff9d3c', '#5fdcff')} />
            <stop offset="55%" stopColor={c('#fff3c4', '#f0fdff')} />
            <stop offset="75%" stopColor={c('#ff9d3c', '#5fdcff')} />
            <stop offset="100%" stopColor={c('#d9368b', '#3f6bff')} />
          </linearGradient>
          <radialGradient id={id('halo')} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor={c('#ffb36b', '#7fe8ff')} stopOpacity="0.6" />
            <stop offset="100%" stopColor={c('#ffb36b', '#7fe8ff')} stopOpacity="0" />
          </radialGradient>
        </>
      )
    case 'lg:citrouille':
      // Le visage creusé : clair au cœur, sombre au bord — la bougie derrière.
      return (
        <radialGradient id={id('lueur')} cx="50%" cy="60%" r="65%">
          <stop offset="0%" stopColor={c('#fff6b0', '#f2fff8')} />
          <stop offset="50%" stopColor={c('#ffb020', '#6dffb8')} />
          <stop offset="100%" stopColor={c('#6e1f00', '#0c4a31')} />
        </radialGradient>
      )
    default:
      return null
  }
}


interface Props {
  /** La clé du légendaire (`lg:phenix`…). */
  cle: string
  /** Pas encore gagné : une silhouette dorée sur un disque sombre. */
  verrouille?: boolean
  /** La finition de celui qui le porte : elle devient son cercle. Absente, l'or (ou le violet de l'ombre) d'origine. */
  finition?: Finition
  /** L'Éclat est tombé sur lui : il porte sa version rare. */
  eclat?: boolean
  className?: string
}

/** Le médaillon d'un avatar légendaire, à la taille du texte qui l'entoure (1 em). */
export function Legendaire({ cle, verrouille, finition, eclat, className }: Props) {
  const brut = useId()
  const l = legendaireDe(cle)
  const dessin = DESSINS[cle]
  // Verrouillé, il n'a pas de version éclatée : il n'est pas encore à lui.
  const eclate = !!eclat && !verrouille
  const palette = (eclate ? PALETTES_ECLAT : PALETTES)[cle]
  if (!l || !dessin || !palette) return null
  // `useId` rend des deux-points, que `url(#…)` n'aime pas. La clé du
  // légendaire entre dans l'identifiant : deux médaillons différents ne
  // partagent jamais un dégradé, même rendus par deux racines React.
  const base = `${cle.replace(':', '-')}${brut.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const id = (nom: string) => `${base}-${nom}`
  const bord = l.ton === 'ombre' ? OMBRE : OR
  const classes = ['lg', `lg-${l.ton}`, `lg-${cle.slice(3)}`]
  if (verrouille) classes.push('lg-verrou')
  if (eclate) classes.push('lg-eclate')
  if (className) classes.push(className)
  const titre = verrouille ? `${l.nom} — pas encore gagné` : eclate ? `${l.nom}, éclaté` : l.nom
  return (
    <svg className={classes.join(' ')} viewBox="0 0 100 100" role="img" aria-label={titre}>
      <title>{titre}</title>
      <defs>
        <radialGradient id={id('fond')} cx="50%" cy="38%" r="68%">
          <stop offset="0%" stopColor={palette.fond[0]} />
          <stop offset="55%" stopColor={palette.fond[1]} />
          <stop offset="100%" stopColor={palette.fond[2]} />
        </radialGradient>
        <linearGradient id={id('bord')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bord[0]} />
          <stop offset="50%" stopColor={bord[1]} />
          <stop offset="100%" stopColor={bord[2]} />
        </linearGradient>
        <linearGradient id={id('embleme')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.embleme[0]} />
          <stop offset="100%" stopColor={palette.embleme[1]} />
        </linearGradient>
        <linearGradient id={id('reflet')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={id('disque')}>
          <circle cx="50" cy="50" r="45" />
        </clipPath>
        {degradesDe(cle, id, eclate)}
      </defs>
      {finition && !verrouille ? (
        <Cercle finition={finition} id={id} />
      ) : (
        <circle className="lg-bord" cx="50" cy="50" r="49" fill={`url(#${id('bord')})`} />
      )}
      <circle className="lg-fond" cx="50" cy="50" r="45" fill={`url(#${id('fond')})`} />
      <g clipPath={`url(#${id('disque')})`}>
        {dessin(id, eclate)}
        {/* Le reflet tourne dans un groupe à part : une animation qui pose
            `transform` écraserait celui de l'élément. */}
        {!verrouille && (
          <g transform="rotate(20 50 50)">
            <rect className="lg-reflet" x="-40" y="-10" width="26" height="120" fill={`url(#${id('reflet')})`} />
          </g>
        )}
      </g>
      {/* Un légendaire de l'ombre garde son filet violet quand la finition
          prend son cercle : on doit voir d'un coup d'œil qu'il s'est gagné en
          jouant mal. */}
      {finition && !verrouille && l.ton === 'ombre' && (
        <circle cx="50" cy="50" r="45.3" fill="none" stroke="#b48cff" strokeWidth="1.3" />
      )}
      <circle cx="50" cy="50" r="45" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />
    </svg>
  )
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Legendaire })
