import { useId, type ReactNode } from 'react'
import { legendaire as legendaireDe } from '../../../shared/legendaires'

/**
 * Les avatars légendaires : douze médaillons dessinés, qui ne se gagnent que
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
 */

interface Palette {
  /** Le fond : du centre vers le bord. */
  fond: [string, string, string]
  /** L'emblème : du haut vers le bas. */
  embleme: [string, string]
}

type Dessin = (id: (nom: string) => string) => ReactNode

const OR: [string, string, string] = ['#fff2c4', '#d9b56a', '#7a5618']
const OMBRE: [string, string, string] = ['#d9c9ff', '#6d4fb3', '#1d1233']

/** Une étoile à quatre branches, centrée en (x, y). */
function etoile(x: number, y: number, r: number, key?: string | number, className = 'lg-scintille') {
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
}

const DESSINS: Record<string, Dessin> = {
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

  'lg:dragon': id => (
    <>
      <g className="lg-decor" fill="none" stroke="#5fc79b" strokeWidth="1.4" opacity="0.45">
        <path d="M14,30 Q22,22 30,30 Q38,22 46,30 Q54,22 62,30 Q70,22 78,30 Q86,22 94,30" />
        <path d="M6,76 Q14,68 22,76 Q30,68 38,76 Q46,68 54,76 Q62,68 70,76 Q78,68 86,76" />
      </g>
      <g className="lg-forme">
        {/* L'arcade : une crête au-dessus de l'œil. */}
        <path d="M12,44 C26,26 46,20 70,24 C80,26 88,30 92,34 C82,30 72,30 64,32 C48,34 30,40 12,44 Z" fill="#c78a00" />
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

  'lg:chouette': id => (
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
        <path d="M24,62 Q30,66 36,62 M34,72 Q40,76 46,72 M54,72 Q60,76 66,72 M64,62 Q70,66 76,62 M44,82 Q50,86 56,82" fill="none" stroke="#7d899c" strokeWidth="1.6" strokeLinecap="round" />
        <g className="lg-yeux">
          <circle cx="37" cy="47" r="12" fill="#eef2f7" stroke="#7d899c" strokeWidth="1.2" />
          <circle cx="63" cy="47" r="12" fill="#eef2f7" stroke="#7d899c" strokeWidth="1.2" />
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

  'lg:tigre': id => (
    <>
      <g className="lg-forme" fill={`url(#${id('embleme')})`}>
        <circle cx="26" cy="27" r="9.5" />
        <circle cx="74" cy="27" r="9.5" />
        <path d="M50,22 C29,22 17,35 17,53 C17,71 31,85 50,87 C69,85 83,71 83,53 C83,35 71,22 50,22 Z" />
      </g>
      <g className="lg-details">
        <circle cx="26" cy="27" r="4.6" fill="#ffe3c4" />
        <circle cx="74" cy="27" r="4.6" fill="#ffe3c4" />
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
        <path d="M31,49 C34,44.5 42,44.5 45,49 C42,52.5 34,52.5 31,49 Z" fill="#ffe14d" />
        <path d="M69,49 C66,44.5 58,44.5 55,49 C58,52.5 66,52.5 69,49 Z" fill="#ffe14d" />
        <ellipse cx="38" cy="49" rx="1.5" ry="3" fill="#111111" />
        <ellipse cx="62" cy="49" rx="1.5" ry="3" fill="#111111" />
        {/* La foudre, au front. */}
        <path className="lg-eclair" d="M53,21 L43.5,36 L50,36 L46,47 L57.5,30.5 L51,30.5 L56,21 Z" fill="#fff36b" stroke="#1a0f08" strokeWidth="1.2" strokeLinejoin="round" />
      </g>
    </>
  ),

  'lg:licorne': id => (
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
        <path d="M44,14 L49,12 M46,9 L51,8" stroke="#a8781c" strokeWidth="1" strokeLinecap="round" />
        <ellipse cx="45" cy="44" rx="2.4" ry="3.2" fill="#2b1a5e" />
        <circle cx="44.2" cy="42.8" r="0.8" fill="#ffffff" />
        <circle cx="21" cy="59" r="1.4" fill="#8a7fbf" />
        <path d="M17,63 Q21,65 26,64" fill="none" stroke="#8a7fbf" strokeWidth="1" strokeLinecap="round" />
      </g>
    </>
  ),

  'lg:lion': id => (
    <>
      <g className="lg-forme">
        <path d={CRINIERE} fill={`url(#${id('criniere')})`} />
        <circle cx="31.5" cy="37" r="6.5" fill={`url(#${id('embleme')})`} />
        <circle cx="68.5" cy="37" r="6.5" fill={`url(#${id('embleme')})`} />
        <circle cx="50" cy="55" r="22" fill={`url(#${id('embleme')})`} />
        <path d="M33,24 L37,8 L44,17 L50,4 L56,17 L63,8 L67,24 Z" fill={`url(#${id('or')})`} />
      </g>
      <g className="lg-details">
        <circle cx="31.5" cy="37" r="3" fill="#b8641c" />
        <circle cx="68.5" cy="37" r="3" fill="#b8641c" />
        <path d="M37,50 C39.5,47 44,47 46,50 C44,52 39.5,52 37,50 Z" fill="#3b1d06" />
        <path d="M63,50 C60.5,47 56,47 54,50 C56,52 60.5,52 63,50 Z" fill="#3b1d06" />
        <ellipse cx="44.5" cy="64" rx="7.5" ry="5.8" fill="#fde8bd" />
        <ellipse cx="55.5" cy="64" rx="7.5" ry="5.8" fill="#fde8bd" />
        <path d="M45.5,57 L54.5,57 L50,62.5 Z" fill="#5a2d0c" />
        <path d="M46,70 Q50,73.5 54,70" fill="none" stroke="#5a2d0c" strokeWidth="1.3" strokeLinecap="round" />
        <circle className="lg-joyau" cx="50" cy="15" r="2.2" fill="#e8364f" />
        <circle cx="40.5" cy="19" r="1.5" fill="#3aa0ff" />
        <circle cx="59.5" cy="19" r="1.5" fill="#3aa0ff" />
      </g>
    </>
  ),

  'lg:renard': id => (
    <>
      <g className="lg-decor">
        {ciel([
          [16, 18, 0.9],
          [28, 8, 0.7],
          [12, 40, 0.8],
          [88, 84, 0.8],
        ])}
        <circle className="lg-lune" cx="64" cy="36" r="27" fill="#fdf3c4" mask={`url(#${id('croissant')})`} opacity="0.95" />
      </g>
      <g className="lg-forme" fill={`url(#${id('embleme')})`}>
        <path d="M22,46 C22,38 25,32 29,28 L23,9 L42,27 C46,26 54,26 58,27 L77,9 L71,28 C75,32 78,38 78,46 C78,58 65,72 50,84 C35,72 22,58 22,46 Z" />
      </g>
      <g className="lg-details">
        <path d="M28,25 L26,15 L36,25 Z" fill="#5a2410" />
        <path d="M72,25 L74,15 L64,25 Z" fill="#5a2410" />
        <path d="M22,48 C31,52 41,60 50,84 C38,76 26,64 22,48 Z" fill="#fff6ea" />
        <path d="M78,48 C69,52 59,60 50,84 C62,76 74,64 78,48 Z" fill="#fff6ea" />
        <path d="M34,45 C37,41.5 42,41.5 44,44.5 C41,46.5 37,46.5 34,45 Z" fill="#2a1206" />
        <path d="M66,45 C63,41.5 58,41.5 56,44.5 C59,46.5 63,46.5 66,45 Z" fill="#2a1206" />
        <circle cx="50" cy="79" r="3.2" fill="#2a1206" />
      </g>
    </>
  ),

  'lg:comete': id => (
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
        <circle className="lg-pouls" cx="80" cy="26" r="17" fill="#bff9ff" opacity="0.25" />
        <circle cx="77" cy="23" r="3.2" fill="#ffffff" />
      </g>
    </>
  ),

  'lg:kraken': id => {
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
            <circle key={i} className="lg-bulle" cx={x} cy={y} r={r} fill="none" stroke="#9ff5ff" strokeWidth="0.8" opacity="0.7" />
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
          <path d="M36,22 C40,16 46,14 50,14" fill="none" stroke="#f3d4ff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
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
            <circle key={i} cx={x} cy={y} r="1.3" fill="#f3d4ff" opacity="0.8" />
          ))}
        </g>
      </>
    )
  },

  'lg:fantome': id => (
    <>
      <g className="lg-decor">
        <ellipse className="lg-brume" cx="26" cy="86" rx="20" ry="5" fill="#cfc6ff" opacity="0.18" />
        <ellipse className="lg-brume lg-brume-2" cx="74" cy="90" rx="22" ry="5" fill="#cfc6ff" opacity="0.14" />
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

  'lg:trou-noir': id => (
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
        <circle cx="50" cy="50" r="16.8" fill="none" stroke="#ffd08a" strokeWidth="0.9" opacity="0.9" />
      </g>
    </>
  ),
}

/** Les dégradés propres à chaque dessin, en plus du fond et de l'emblème. */
function degradesDe(cle: string, id: (nom: string) => string): ReactNode {
  switch (cle) {
    case 'lg:dragon':
      return (
        <radialGradient id={id('iris')} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#fff8c8" />
          <stop offset="45%" stopColor="#f2b705" />
          <stop offset="100%" stopColor="#8a5200" />
        </radialGradient>
      )
    case 'lg:oracle':
      return (
        <>
          <radialGradient id={id('boule')} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#e6fdff" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#8f7cff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#2b1a5e" stopOpacity="0.95" />
          </radialGradient>
          <linearGradient id={id('or')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff2c4" />
            <stop offset="100%" stopColor="#a8781c" />
          </linearGradient>
        </>
      )
    case 'lg:chouette':
      return (
        <radialGradient id={id('ambre')} cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffe89a" />
          <stop offset="100%" stopColor="#e89400" />
        </radialGradient>
      )
    case 'lg:licorne':
      return (
        <>
          <linearGradient id={id('or')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff6cc" />
            <stop offset="100%" stopColor="#d9a53a" />
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
            <stop offset="55%" stopColor="#d9822b" />
            <stop offset="100%" stopColor="#7a3a0a" />
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
            <stop offset="0%" stopColor="#bff9ff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#53c9ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id('queue2')} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffb3f0" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#a86bff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={id('tete')} cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#bff9ff" />
            <stop offset="100%" stopColor="#53c9ff" />
          </radialGradient>
        </>
      )
    case 'lg:trou-noir':
      return (
        <>
          <linearGradient id={id('anneau')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#d9368b" />
            <stop offset="35%" stopColor="#ff9d3c" />
            <stop offset="55%" stopColor="#fff3c4" />
            <stop offset="75%" stopColor="#ff9d3c" />
            <stop offset="100%" stopColor="#d9368b" />
          </linearGradient>
          <radialGradient id={id('halo')} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#ffb36b" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ffb36b" stopOpacity="0" />
          </radialGradient>
        </>
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
  className?: string
}

/** Le médaillon d'un avatar légendaire, à la taille du texte qui l'entoure (1 em). */
export function Legendaire({ cle, verrouille, className }: Props) {
  const brut = useId()
  const l = legendaireDe(cle)
  const dessin = DESSINS[cle]
  const palette = PALETTES[cle]
  if (!l || !dessin || !palette) return null
  // `useId` rend des deux-points, que `url(#…)` n'aime pas. La clé du
  // légendaire entre dans l'identifiant : deux médaillons différents ne
  // partagent jamais un dégradé, même rendus par deux racines React.
  const base = `${cle.replace(':', '-')}${brut.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const id = (nom: string) => `${base}-${nom}`
  const bord = l.ton === 'ombre' ? OMBRE : OR
  const classes = ['lg', `lg-${l.ton}`, `lg-${cle.slice(3)}`]
  if (verrouille) classes.push('lg-verrou')
  if (className) classes.push(className)
  return (
    <svg className={classes.join(' ')} viewBox="0 0 100 100" role="img" aria-label={verrouille ? `${l.nom} — pas encore gagné` : l.nom}>
      <title>{verrouille ? `${l.nom} — pas encore gagné` : l.nom}</title>
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
        {degradesDe(cle, id)}
      </defs>
      <circle className="lg-bord" cx="50" cy="50" r="49" fill={`url(#${id('bord')})`} />
      <circle className="lg-fond" cx="50" cy="50" r="45" fill={`url(#${id('fond')})`} />
      <g clipPath={`url(#${id('disque')})`}>
        {dessin(id)}
        {/* Le reflet tourne dans un groupe à part : une animation qui pose
            `transform` écraserait celui de l'élément. */}
        {!verrouille && (
          <g transform="rotate(20 50 50)">
            <rect className="lg-reflet" x="-40" y="-10" width="26" height="120" fill={`url(#${id('reflet')})`} />
          </g>
        )}
      </g>
      <circle cx="50" cy="50" r="45" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />
    </svg>
  )
}
