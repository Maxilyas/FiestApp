// Le grand écran · Cinéma & séries — du cow-boy à la star.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { etoile, lin, miroir, points, reflet, rad, type DessinDePortrait } from './outils'

/** Les plis du rideau de velours, de part et d'autre : la maquette du pirate. */
const RIDEAUX =
  '<g fill="#000" opacity=".16"><path d="M8,0 C12,30 6,70 12,100 L4,100 L0,0 Z"/><path d="M26,0 C30,30 24,70 30,100 L22,100 C18,70 22,30 18,0 Z"/><path d="M92,0 C88,30 94,70 88,100 L96,100 L100,0 Z"/><path d="M74,0 C70,30 76,70 70,100 L78,100 C82,70 78,30 82,0 Z"/></g>'

/**
 * Une pellicule le long d'un tracé : la bande, ses perforations en pointillés
 * que la bande recouvre au milieu, et ses images. Quatre traits, là où trente
 * rectangles feraient la même chose.
 */
const pellicule = (d: string, op: number) =>
  `<g fill="none" opacity="${op}"><path d="${d}" stroke="#1c0306" stroke-width="9"/><path d="${d}" stroke="#ffe3c2" stroke-width="7" stroke-dasharray="1.4 1.8"/><path d="${d}" stroke="#1c0306" stroke-width="4.2"/><path d="${d}" stroke="#5a1420" stroke-width="3.4" stroke-dasharray="6 1.6"/></g>`

/** Un faisceau de projecteur, à peine teinté. */
const faisceau = (d: string, op: number) => `<path d="${d}" fill="#fff4d8" opacity="${op}"/>`

/** Un pan du gilet de cuir du cow-boy : l'autre est son miroir. */
const GILET = (u: string) => `<path d="M21,100 C23,87 33,80.5 41,79.6 C43,86 44,93 44.5,100 Z" fill="url(#${u}v)"/>`

/** Une étoile à `n` branches, pointe en haut. */
function etoileA(n: number, x: number, y: number, R: number, r: number): string {
  let d = ''
  for (let i = 0; i < 2 * n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n
    const k = i % 2 ? r : R
    d += `${i ? 'L' : 'M'}${(x + k * Math.cos(a)).toFixed(1)},${(y + k * Math.sin(a)).toFixed(1)}`
  }
  return d + 'Z'
}

/**
 * L'insigne du shérif : six branches et une boule au bout de chacune — sans
 * elles, c'est une fleur. Les boules sont des tracés de longueur nulle, qu'un
 * bout rond dessine en points : un élément pour six cercles.
 */
function insigne(x: number, y: number, R: number): string {
  let boules = ''
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3
    boules += `M${(x + R * Math.cos(a)).toFixed(1)},${(y + R * Math.sin(a)).toFixed(1)}h0`
  }
  return `<path d="${etoileA(6, x, y, R, R * 0.62)}" fill="#f7d060" stroke="#b8862a" stroke-width=".4"/><path d="${boules}" stroke="#f7d060" stroke-width="1.9" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="${(R * 0.3).toFixed(1)}" fill="#fff3c0" stroke="#c8922a" stroke-width=".5"/>`
}

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:cow-boy': {
    fond: ['#d9645a', '#7e1d1c', '#2b0808'],
    defs: u =>
      lin(u + 'p', '#ecb88e', '#c98a5e') +
      lin(u + 'h', '#cf9258', '#7a4820') +
      lin(u + 'v', '#8e5a32', '#553018') +
      lin(u + 'f', '#4a90e0', '#1f4f99'),
    decor: () =>
      pellicule('M-6,78 C14,66 24,40 44,24 C60,11 80,8 106,12', 0.28) +
      points([[18, 58, 0.8], [84, 66, 0.7], [24, 16, 0.6], [80, 84, 0.6], [12, 44, 0.5]], '#ffe2a8'),
    corps: u => `
      <path d="M21,100 C23,87 35,79 50,79 C65,79 77,87 79,100 Z" fill="#efe2c8"/>
      ${GILET(u)}${miroir(GILET(u))}
      <path d="M45,66 L45,80 L55,80 L55,66 Z" fill="#b97d52"/>
      <path d="M42.5,75 C46,77.5 54,77.5 57.5,75 L58.8,79.4 C55,82 45,82 41.2,79.4 Z M42,79 C46,81.6 54,81.6 58,79 L50,91 Z" fill="url(#${u}f)"/>
      <path d="M44.2,78.3 C47.5,80.6 52.5,80.6 55.8,78.3 M45.6,82.6 C48,84.4 52,84.4 54.4,82.6 M48.6,87.4 L51.4,87.4" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="0 3.2" fill="none" opacity=".85"/>
      ${insigne(63.5, 90, 4.6)}
      <g fill="#d0946a"><ellipse cx="36.2" cy="51.5" rx="2.3" ry="3.5"/><ellipse cx="63.8" cy="51.5" rx="2.3" ry="3.5"/></g>
      <path d="M36,46 C36,40 42,37 50,37 C58,37 64,40 64,46 C64,58 58,68 50,70.5 C42,68 36,58 36,46 Z" fill="url(#${u}p)"/>
      <path d="M36.3,43 L40,43 L39.2,52.5 C37.8,51 36.8,48.5 36.3,45.5 Z M63.7,43 L60,43 L60.8,52.5 C62.2,51 63.2,48.5 63.7,45.5 Z" fill="#5c3418"/>
      <path d="M36.5,44 C44,46.2 56,46.2 63.5,44 L63.8,47.4 C56,49.6 44,49.6 36.2,47.4 Z" fill="#6a3418" opacity=".22"/>
      <path d="M39.6,48.2 C41.6,47 45,47 47,48 M53,48 C55,47 58.4,47 60.4,48.2" stroke="#4a2812" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <path d="M39.8,51.8 C41.2,49.4 45.6,49.4 47,51.8 C45.6,53.8 41.2,53.8 39.8,51.8 Z M53,51.8 C54.4,49.4 58.8,49.4 60.2,51.8 C58.8,53.8 54.4,53.8 53,51.8 Z" fill="#fff"/>
      <g fill="#4a2c16"><circle cx="43.5" cy="51.7" r="1.9"/><circle cx="56.5" cy="51.7" r="1.9"/></g>
      ${reflet(42.8, 51, 0.65)}${reflet(55.8, 51, 0.65)}
      <path d="M50.5,53 C49.6,56.2 49.4,57.8 50.8,58.4" stroke="#9a5e3a" stroke-width="1" fill="none" stroke-linecap="round"/>
      <g fill="#ff8a70" opacity=".35"><ellipse cx="40.5" cy="57.8" rx="3" ry="1.7"/><ellipse cx="59.5" cy="57.8" rx="3" ry="1.7"/></g>
      <path d="M45,61.6 C47.5,64.6 52.5,64.6 55.5,60.9" stroke="#7a3a22" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <path d="M54.6,62.3 L64.2,58.8 M63.6,59 L66.6,57.2 M64.6,58.6 L67,59" stroke="#f0cf6a" stroke-width=".8" stroke-linecap="round"/>
      <path d="M34.5,37.5 C33.5,28 34.5,19.5 38,14.8 C40.5,11.8 45,12.3 50,15.2 C55,12.3 59.5,11.8 62,14.8 C65.5,19.5 66.5,28 65.5,37.5 Z" fill="url(#${u}h)"/>
      <path d="M50,15.6 C49.4,21 49.4,27 50,31.5 M37.6,29.5 C37.1,24 38,19.2 40.5,16.2" stroke="#f4c890" stroke-width="1" fill="none" opacity=".45" stroke-linecap="round"/>
      <path d="M34.3,31.5 C44,33.5 56,33.5 65.7,31.5 L65.6,36 C56,38 44,38 34.4,36 Z" fill="#4a2810"/>
      <path d="M10,29 C13,35 20,38.5 30,39 C38,39.4 43,37.5 50,37.5 C57,37.5 62,39.4 70,39 C80,38.5 87,35 90,29 C89,36.5 84,42 74,44 C64,46 57,44.5 50,44.5 C43,44.5 36,46 26,44 C16,42 11,36.5 10,29 Z" fill="url(#${u}h)"/>
      <path d="M12,31.5 C16,36 22,38.8 30,39.4 C38,39.9 43,38 50,38 C57,38 62,39.9 70,39.4 C78,38.8 84,36 88,31.5" stroke="#f4c890" stroke-width=".8" fill="none" opacity=".55"/>`,
  },

  'br:vampire': {
    fond: ['#c94a6c', '#6c1030', '#22040f'],
    defs: u =>
      lin(u + 'p', '#f6eef2', '#d6c4d6') +
      lin(u + 'n', '#2e2634', '#0c090f') +
      lin(u + 'r', '#dc2a44', '#7a0c20') +
      lin(u + 'h', '#383244', '#0c0a10'),
    decor: () =>
      RIDEAUX +
      `<circle cx="76" cy="22" r="7" fill="#fbead0" opacity=".85"/><circle cx="73.5" cy="20" r="1.4" fill="#e6d0b0" opacity=".7"/><circle cx="78.5" cy="25" r="1" fill="#e6d0b0" opacity=".6"/>` +
      points([[20, 22, 0.6], [30, 10, 0.5], [88, 40, 0.5]], '#ffe9c8'),
    corps: u => `
      <path d="M17,37 C25,45 33,51 38,57 L62,57 C67,51 75,45 83,37 C82,56 76,70 64,81 L36,81 C24,70 18,56 17,37 Z" fill="url(#${u}n)"/>
      <path d="M20.5,43 C27,49.5 33.5,54.5 38.5,60 L61.5,60 C66.5,54.5 73,49.5 79.5,43 C78,57 72.5,68 62.5,78 L37.5,78 C27.5,68 22,57 20.5,43 Z" fill="url(#${u}r)"/>
      <path d="M26,52 C30,61 34,68 40,76 M74,52 C70,61 66,68 60,76" stroke="#5a0818" stroke-width="1" fill="none" opacity=".45"/>
      <path d="M14,100 C16,88 26,80 38,78 L62,78 C74,80 84,88 86,100 Z" fill="url(#${u}n)"/>
      <path d="M38.5,78.5 C37,86 36,93 35.5,100 M61.5,78.5 C63,86 64,93 64.5,100" stroke="#c81e38" stroke-width="2" fill="none"/>
      <path d="M41,78 L50,97 L59,78 Z" fill="#f4eef4"/>
      <path d="M45,66 L45,79 L55,79 L55,66 Z" fill="#cdb8cc"/>
      <path d="M43.5,78.8 L46,75.2 L50,78.6 L54,75.2 L56.5,78.8 L50,82.2 Z" fill="#fff"/>
      <circle cx="50" cy="83" r="2.3" fill="#c8102e" stroke="#f1c653" stroke-width=".8"/><circle cx="49.3" cy="82.3" r=".6" fill="#fff" opacity=".7"/>
      <path d="M37.8,53.5 C35.2,53 33.8,49.5 34,46.2 C34.2,43.6 34.4,41.4 33.7,39 C36.4,40.8 38.3,43.8 38.9,47.4 Z M62.2,53.5 C64.8,53 66.2,49.5 66,46.2 C65.8,43.6 65.6,41.4 66.3,39 C63.6,40.8 61.7,43.8 61.1,47.4 Z" fill="#e4d6e2"/>
      <path d="M36.5,45 C36.5,38.5 42,35 50,35 C58,35 63.5,38.5 63.5,45 C63.5,57 58.5,66.5 50,71 C41.5,66.5 36.5,57 36.5,45 Z" fill="url(#${u}p)"/>
      <path d="M35.8,47 C34,36.5 40.5,28 50,28 C59.5,28 66,36.5 64.2,47 C63.2,42.5 61,39.5 57.5,38.8 C54.5,39.2 52,41 50,44.2 C48,41 45.5,39.2 42.5,38.8 C39,39.5 36.8,42.5 35.8,47 Z" fill="url(#${u}h)"/>
      <path d="M40,34.5 C43,31 47.5,30 51,30.4 M53.5,31 C57,31.6 60,33.4 61.8,36" stroke="#9a90aa" stroke-width="1" fill="none" opacity=".7" stroke-linecap="round"/>
      <path d="M39,47.4 C41,45 45.2,44.8 47.4,46.6 M61,47.4 C59,45 54.8,44.8 52.6,46.6" stroke="#1a141e" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <path d="M39.6,50.8 C41,48.4 45.6,48.4 47,50.8 C45.6,52.6 41,52.6 39.6,50.8 Z M53,50.8 C54.4,48.4 59,48.4 60.4,50.8 C59,52.6 54.4,52.6 53,50.8 Z" fill="#fff"/>
      <g fill="#a01830"><circle cx="43.3" cy="50.6" r="1.8"/><circle cx="56.7" cy="50.6" r="1.8"/></g>
      <g fill="#1a0508"><circle cx="43.3" cy="50.6" r=".8"/><circle cx="56.7" cy="50.6" r=".8"/></g>
      ${reflet(42.6, 50, 0.6)}${reflet(56, 50, 0.6)}
      <path d="M50.4,52 C49.6,55.2 49.4,56.8 50.8,57.4" stroke="#a890a8" stroke-width="1" fill="none" stroke-linecap="round"/>
      <g fill="#e890ae" opacity=".3"><ellipse cx="41" cy="57.5" rx="3" ry="1.6"/><ellipse cx="59" cy="57.5" rx="3" ry="1.6"/></g>
      <path d="M45.2,61 C47.6,62.6 52.4,62.6 54.8,61 C53,63.8 47,63.8 45.2,61 Z" fill="#7a1024"/>
      <path d="M46.8,61.8 L47.6,64.4 L48.5,62.1 Z M53.2,61.8 L52.4,64.4 L51.5,62.1 Z" fill="#fff"/>`,
  },

  'br:detective': {
    fond: ['#c4535e', '#6a1622', '#22060a'],
    defs: u =>
      lin(u + 'p', '#9c6644', '#70432a') +
      lin(u + 'k', '#cfa96e', '#8c6a3c') +
      lin(u + 'm', '#dcbc84', '#a4814c') +
      rad(u + 'l', '#ffffff', '#a8d4f0'),
    // Les lames d'un store, que traverse le projecteur : le film noir.
    decor: () =>
      `<g fill="#ffe6c8" opacity=".07"><path d="M0,24 L100,4 L100,12 L0,32 Z"/><path d="M0,42 L100,22 L100,30 L0,50 Z"/><path d="M0,60 L100,40 L100,48 L0,68 Z"/><path d="M0,78 L100,58 L100,66 L0,86 Z"/></g>` +
      points([[16, 30, 0.6], [86, 76, 0.5], [22, 88, 0.5]], '#ffe6c8', 0.6),
    corps: u => `
      <path d="M20,100 C22,86 34,78.5 50,78.5 C66,78.5 78,86 80,100 Z" fill="url(#${u}m)"/>
      <path d="M43,79 L50,93 L57,79 Z" fill="#f2ece0"/>
      <path d="M48.2,79 L51.8,79 L51.2,81.6 L48.8,81.6 Z M48.8,81.6 L51.2,81.6 L52.4,90 L50,93.4 L47.6,90 Z" fill="#6a1f2a"/>
      <path d="M31,84 C33,77 36,71 39,66 C41.5,71 44,76 47.5,80.5 L43.5,88 Z M69,84 C67,77 64,71 61,66 C58.5,71 56,76 52.5,80.5 L56.5,88 Z" fill="#c29d63" stroke="#8a6a3a" stroke-width=".6"/>
      <path d="M45,66 L45,79 L55,79 L55,66 Z" fill="#6e4229"/>
      <g fill="#855236"><ellipse cx="36.2" cy="52" rx="2.3" ry="3.5"/><ellipse cx="63.8" cy="52" rx="2.3" ry="3.5"/></g>
      <path d="M36,47 C36,40 42,36.5 50,36.5 C58,36.5 64,40 64,47 C64,59 58,68.5 50,71 C42,68.5 36,59 36,47 Z" fill="url(#${u}p)"/>
      <path d="M36.2,44 L39.5,44 L39,51.5 C37.6,50 36.6,48 36.2,46 Z M63.8,44 L60.5,44 L61,51.5 C62.4,50 63.4,48 63.8,46 Z" fill="#1a1210"/>
      <path d="M33.5,44 C32.5,31 40,22 50,22 C60,22 67.5,31 66.5,44 Z" fill="url(#${u}k)"/>
      <path d="M41.5,23.8 C39.6,30 39,37 39.3,44 M50,22 L50,44 M58.5,23.8 C60.4,30 61,37 60.7,44 M35,31 C44,29.2 56,29.2 65,31 M33.6,37.5 C44,36 56,36 66.4,37.5" stroke="#6a4a22" stroke-width=".8" fill="none" opacity=".45"/>
      <path d="M33.2,43 C31.6,37 32.3,31 35.5,27 C37.5,32 38.3,37.5 38,43 Z M66.8,43 C68.4,37 67.7,31 64.5,27 C62.5,32 61.7,37.5 62,43 Z" fill="#a8844e"/>
      <path d="M35.5,27.5 C40,23 45,21 49.5,21 M64.5,27.5 C60,23 55,21 50.5,21" stroke="#7a5a2c" stroke-width=".7" fill="none"/>
      <path d="M50,21.6 C48.2,19 45.6,19 45.8,21 C46.1,22.6 48.4,22.4 50,21.6 C51.6,22.4 53.9,22.6 54.2,21 C54.4,19 51.8,19 50,21.6 Z" fill="#7a5a2c"/>
      <path d="M36,46.6 C42,49.4 58,49.4 64,46.6 L63.6,49.4 C57,51.6 43,51.6 36.4,49.4 Z" fill="#3a2010" opacity=".3"/>
      <path d="M34,42.2 C40,40.6 60,40.6 66,42.2 C64.5,46.8 58,49 50,49 C42,49 35.5,46.8 34,42.2 Z" fill="#5e4020"/>
      <path d="M34,42.2 C40,40.6 60,40.6 66,42.2 C64.8,45 58,46.8 50,46.8 C42,46.8 35.2,45 34,42.2 Z" fill="#b48c58"/>
      <path d="M39.6,50 C41.6,49 45,48.9 47,49.6" stroke="#1a1210" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M39.8,52.4 C41.2,50 45.6,50 47,52.4 C45.6,54.4 41.2,54.4 39.8,52.4 Z" fill="#fff"/>
      <circle cx="43.4" cy="52.3" r="1.8" fill="#2a1810"/>${reflet(42.7, 51.6, 0.6)}
      <path d="M50.5,54 C49.6,57.2 49.4,58.8 50.8,59.4" stroke="#4a2a18" stroke-width="1" fill="none" stroke-linecap="round"/>
      <ellipse cx="41" cy="58.5" rx="3" ry="1.6" fill="#e0706a" opacity=".3"/>
      <path d="M46,62.6 C48.5,64.4 52,64.2 54.5,62" stroke="#3a1a10" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <circle cx="57.8" cy="52.2" r="7.6" fill="url(#${u}l)" opacity=".3"/>
      <path d="M52.6,52.4 C54.4,48.6 61.2,48.6 63,52.4 C61.2,55.8 54.4,55.8 52.6,52.4 Z" fill="#fff"/>
      <circle cx="57.8" cy="52.3" r="2.9" fill="#2a1810"/>${reflet(56.8, 51.2, 1.1)}
      <path d="M52.4,48.6 C53.8,46.4 55.8,45.4 58,45.3" stroke="#fff" stroke-width="1" fill="none" opacity=".8" stroke-linecap="round"/>
      <path d="M63.4,58 L72.5,68.5" stroke="#4a2a18" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M62.9,57.4 L65.2,60.2" stroke="#d9a441" stroke-width="3.8"/>
      <circle cx="57.8" cy="52.2" r="7.6" fill="none" stroke="#d9a441" stroke-width="2.1"/>
      <path d="M70,71 C73,74.5 78,74.5 80.5,71 C84,78 86.5,88 88,97 L73.5,100 C73,91 72,81 70,71 Z" fill="#c29d63" stroke="#8a6a3a" stroke-width=".6"/>
      <ellipse cx="74.4" cy="67.4" rx="5.2" ry="4.3" transform="rotate(51 74.4 67.4)" fill="url(#${u}p)"/>
      <path d="M70.6,66.6 C71.8,65.2 73,64.2 74.4,63.5 M72.5,69 C73.7,67.6 74.9,66.6 76.3,65.9 M74.4,71.3 C75.6,69.9 76.8,68.9 78.2,68.2" stroke="#4a2818" stroke-width=".6" fill="none" opacity=".7"/>`,
  },

  'br:pirate': {
    fond: ['#d5566a', '#7a1426', '#2a0610'],
    defs: u => lin(u + 'p', '#f0bd93', '#c98a61') + lin(u + 'k', '#2a2222', '#0f0b0b'),
    decor: () => RIDEAUX + '<ellipse cx="50" cy="30" rx="32" ry="22" fill="#ffd6a0" opacity=".12"/>',
    corps: u => `
      <path d="M22,100 C24,86 36,78 50,78 C64,78 76,86 78,100 Z" fill="#6b1c24"/>
      <path d="M43.5,78 L50,90 L56.5,78 Z" fill="#f2ead8"/>
      <path d="M34,44 C34,38 41,35.5 50,35.5 C59,35.5 66,38 66,44 C66,56 62,66 50,70.5 C38,66 34,56 34,44 Z" fill="url(#${u}p)"/>
      <ellipse cx="66" cy="51.5" rx="2.2" ry="3.6" fill="#d99a70"/>
      <circle cx="66.6" cy="56.8" r="2.4" fill="none" stroke="#f1c653" stroke-width="1.2"/>
      <path d="M36,58 C38,68.5 44,76.5 50,78.5 C56,76.5 62,68.5 64,58 C60,62 56,64 50,64 C44,64 40,62 36,58 Z" fill="#3a2418"/>
      <path d="M42,61.2 C45,58.2 49,58.2 50,60.3 C51,58.2 55,58.2 58,61.2 C55,62.8 52,62.8 50,61.6 C48,62.8 45,62.8 42,61.2 Z" fill="#26170e"/>
      <path d="M47.5,65.3 C49,66.2 51,66.2 52.5,65.3" stroke="#b86a5a" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M50.5,50.5 C49.5,54.5 48.6,56.6 50.3,57.5 C51.4,58 52.6,57.5 52.2,56.8" stroke="#a8694a" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M36.5,46.8 L66.5,39.6" stroke="#151010" stroke-width="1.5"/>
      <ellipse cx="42.2" cy="49.2" rx="4.6" ry="4.1" fill="#151010"/>
      <path d="M54.2,49.5 C55.4,47.3 59.6,47.3 60.8,49.5 C59.6,51.3 55.4,51.3 54.2,49.5 Z" fill="#fff"/>
      <circle cx="57.5" cy="49.4" r="1.55" fill="#2a1a10"/>${reflet(57, 48.9, 0.5)}
      <path d="M53.6,44.4 C55.8,42.8 59.8,42.8 62,44.8" stroke="#3a2418" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M15,38 C23.5,28 36,21.5 50,21.5 C64,21.5 76.5,28 85,38 C75,36 64.5,37 58.5,40.5 C54.5,34.5 45.5,34.5 41.5,40.5 C35.5,37 25,36 15,38 Z" fill="url(#${u}k)"/>
      <path d="M15,38 C25,36 35.5,37 41.5,40.5 C45.5,34.5 54.5,34.5 58.5,40.5 C64.5,37 75,36 85,38" fill="none" stroke="#e0b451" stroke-width="1.5"/>
      <circle cx="50" cy="29" r="2.6" fill="#f3ead6"/><rect x="48.4" y="30.6" width="3.2" height="1.8" rx=".5" fill="#f3ead6"/>
      <circle cx="49" cy="28.8" r=".6" fill="#1c1414"/><circle cx="51" cy="28.8" r=".6" fill="#1c1414"/>`,
  },

  'br:super-heroine': {
    fond: ['#e0606e', '#861a2c', '#2d0712'],
    defs: u =>
      lin(u + 'p', '#b67b52', '#8a5434') +
      lin(u + 'h', '#3c2420', '#140a0a') +
      lin(u + 's', '#5b4bd6', '#2c2288') +
      lin(u + 'cape', '#44dccb', '#12877d') +
      lin(u + 'o', '#fff4b8', '#e8a82a'),
    decor: () =>
      faisceau('M-4,100 L6,100 L46,0 L34,0 Z', 0.1) +
      faisceau('M104,100 L94,100 L54,0 L66,0 Z', 0.1) +
      etoile(84, 26, 2.4, '#fff', 0.75) +
      etoile(30, 12, 1.8, '#fff', 0.6) +
      points([[88, 54, 0.6], [74, 10, 0.5], [90, 70, 0.5]], '#fff'),
    // Le vent emporte ses boucles et sa cape du même côté : c'est ce qui la
    // fait voler, et ce qui se lit dans sa silhouette.
    corps: u => `
      <path d="M66,80 C74,82 80,90 83,100 L12,100 C10,96 7,93 4,90 C8,88 10,86 10,84 C8,81 7,79 6,76 C10,75 12,73 12,70 C11,66 12,63 14,60 C20,66 27,74 34,80 Z" fill="url(#${u}cape)"/>
      <path d="M14,60 C20,66 27,74 34,80 C27,79 20,77 16,74 C15,70 15,64 14,60 Z M6,76 C12,79 18,81 24,82 C18,84 12,86 10,84 C8,81 7,79 6,76 Z" fill="#0e6a64"/>
      <path d="M65,60 C68,53 67,45 66,40 C67,31 60,24 52,24 C45,20 36,22 32,27 C25,26 19,31 20,37 C14,40 14,47 18,50 C14,55 18,61 24,60 C24,66 31,69 35,65 C37,68 40,68 41,65 Z" fill="url(#${u}h)"/>
      <path d="M23,39 C21,42 22,45 25,46 M19,52 C18,55 19.5,57.5 22.5,57.6 M33,29 C31,30 30,32 31,34 M44,24 C42,25 41,27 42,29 M62,30 C64,32 64.6,35 63.6,37 M29,62 C28,60 29,58 31,57.6" stroke="#7a5048" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".6"/>
      <path d="M33,82 C35,76 37,71 39.5,67.5 C41.5,71.5 43.5,75.5 46.5,79 Z M67,82 C65,76 63,71 60.5,67.5 C58.5,71.5 56.5,75.5 53.5,79 Z" fill="url(#${u}cape)"/>
      <path d="M24,100 C26,87 37,79.5 50,79.5 C63,79.5 74,87 76,100 Z" fill="url(#${u}s)"/>
      <path d="M45,67 L45,80 L55,80 L55,67 Z" fill="#8f5a38"/>
      <path d="M42.5,79.5 C45,83.5 55,83.5 57.5,79.5 L60,80.8 C57,86 43,86 40,80.8 Z" fill="#12877d"/>
      <g fill="url(#${u}o)"><circle cx="33.5" cy="83.5" r="2.4"/><circle cx="66.5" cy="83.5" r="2.4"/></g>
      ${etoile(50, 92, 6.5, `url(#${u}o)`, 1)}${etoile(50, 92, 2.4, '#fff', 0.9)}
      <path d="M37,46 C37,39 42.5,35 50,35 C57.5,35 63,39 63,46 C63,57.5 57.5,67.5 50,70 C42.5,67.5 37,57.5 37,46 Z" fill="url(#${u}p)"/>
      <path d="M64,46 C65,37 59,31 50,31 C43,31 37,35 35.5,42 C35,44 35.5,46 36.2,47 C38,42 42,39 47,38.6 C53,38.2 59,40.5 64,46 Z" fill="url(#${u}h)"/>
      <path d="M33,45.5 C36,44.8 38.5,44.6 41,45 C44.5,45.4 47.5,46.4 50,47.6 C52.5,46.4 55.5,45.4 59,45 C61.5,44.6 64,44.8 67,45.5 C66.8,50 64.5,54.4 60,54.8 C56.5,55 53,53.4 50,51.6 C47,53.4 43.5,55 40,54.8 C35.5,54.4 33.2,50 33,45.5 Z" fill="url(#${u}cape)"/>
      <path d="M39.6,50.2 C41,47.8 45.6,47.8 47,50.2 C45.6,52 41,52 39.6,50.2 Z M53,50.2 C54.4,47.8 59,47.8 60.4,50.2 C59,52 54.4,52 53,50.2 Z" fill="#fff"/>
      <g fill="#2a1408"><circle cx="43.3" cy="50" r="1.8"/><circle cx="56.7" cy="50" r="1.8"/></g>
      ${reflet(42.6, 49.4, 0.6)}${reflet(56, 49.4, 0.6)}
      <path d="M38.6,43.4 C41,41.8 45,41.6 47.6,43 M61.4,43.4 C59,41.8 55,41.6 52.4,43" stroke="#1a0c08" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <path d="M50.4,54 C49.6,56.6 49.4,58 50.8,58.6" stroke="#6a3a22" stroke-width="1" fill="none" stroke-linecap="round"/>
      <g fill="#e0705a" opacity=".35"><ellipse cx="41" cy="58.6" rx="3" ry="1.6"/><ellipse cx="59" cy="58.6" rx="3" ry="1.6"/></g>
      <path d="M45,61.2 C47.2,65.4 52.8,65.4 55,61.2 C52,62.3 48,62.3 45,61.2 Z" fill="#fff" stroke="#8a3a3a" stroke-width=".7"/>`,
  },

  'br:star': {
    fond: ['#dc5f78', '#7f1834', '#2b0614'],
    defs: u =>
      lin(u + 'p', '#fadfcc', '#e9b89d') +
      lin(u + 'h', '#ffe49a', '#cf9432') +
      lin(u + 'g', '#433a4c', '#0c0a12', 1, 1) +
      lin(u + 'b', '#ffc6e2', '#ff6fae'),
    // Les flashes des photographes, chacun dans son halo.
    decor: () =>
      `<g fill="#fff" opacity=".16"><circle cx="17" cy="30" r="6"/><circle cx="80" cy="25" r="7"/><circle cx="13" cy="66" r="4.5"/><circle cx="88" cy="64" r="5"/></g>` +
      etoile(17, 30, 5.5, '#fff', 0.9) +
      etoile(80, 25, 6.5, '#fff', 0.9) +
      etoile(13, 66, 3.8, '#fff', 0.8) +
      etoile(88, 64, 4.4, '#fff', 0.8) +
      points([[28, 12, 0.6], [70, 9, 0.5], [22, 84, 0.5], [80, 86, 0.5]], '#fff', 0.7),
    corps: u => `
      <path d="M28,79 C22,78 17.5,75 19.5,71.5 C21.5,68.5 26,68 24,64.5 C22,61.5 16.5,61 18.5,57.5 C20.5,54.5 26,54 25,50.5 C24,47.5 16.5,48 18.5,43.5 C20,35 27,27 36,25 C41,23 46,22.5 50,22.5 C54,22.5 59,23 64,25 C73,27 80,35 81.5,43.5 C83.5,48 76,47.5 75,50.5 C74,54 79.5,54.5 81.5,57.5 C83.5,61 78,61.5 76,64.5 C74,68 78.5,68.5 80.5,71.5 C82.5,75 78,78 72,79 C64,83 36,83 28,79 Z" fill="url(#${u}h)"/>
      <path d="M30,32 C24,38 29,44 25.5,50 C22,56 28.5,60 25,66 C22,71 26,74 27.5,77 M70,32 C76,38 71,44 74.5,50 C78,56 71.5,60 75,66 C78,71 74,74 72.5,77" stroke="#b07a26" stroke-width="1.1" fill="none" opacity=".55"/>
      <path d="M24,100 C26,88 36,81 50,81 C64,81 74,88 76,100 Z" fill="#2a1a2e"/>
      <g fill="#fff" opacity=".7"><circle cx="44" cy="92" r=".5"/><circle cx="57" cy="95" r=".5"/><circle cx="50" cy="97.5" r=".4"/></g>
      <path d="M45,66 L45,80 C45,84.5 55,84.5 55,80 L55,66 Z" fill="#e6b095"/>
      <g fill="none" stroke-linecap="round"><path d="M40,79 C32,80 26,85 23,100 M60,79 C68,80 74,85 77,100 M40,79 C45,77.6 55,77.6 60,79" stroke="url(#${u}b)" stroke-width="8.4"/>
      <path d="M40,79 C32,80 26,85 23,100 M60,79 C68,80 74,85 77,100" stroke="#ff9ccc" stroke-width="11" stroke-dasharray="0 3.1"/>
      <path d="M40,79 C32,80 26,85 23,100 M60,79 C68,80 74,85 77,100" stroke="#ffe2f1" stroke-width="3" stroke-dasharray="0 3.1" stroke-dashoffset="1.5" opacity=".6" transform="translate(-.9 -1)"/></g>
      <path d="M37,46 C37,39 42.5,35.5 50,35.5 C57.5,35.5 63,39 63,46 C63,57.5 57.5,67.5 50,70 C42.5,67.5 37,57.5 37,46 Z" fill="url(#${u}p)"/>
      <path d="M36.5,48 C34.5,37 41,29 50,29 C59,29 65.5,36 63.5,46 C62,41 59,38.5 55,38 C52,40 49,41 45.5,40.5 C41,40.5 38,43.5 36.5,48 Z" fill="url(#${u}h)"/>
      <path d="M40,37 C43,33.5 47,32.5 51,33.5" stroke="#fff4c8" stroke-width="1.1" fill="none" opacity=".7" stroke-linecap="round"/>
      <path d="M38.6,44 C41,42.4 44.6,42.2 47,43.4 M61.4,44 C59,42.4 55.4,42.2 53,43.4" stroke="#9a6a2a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M33.6,44.6 L39,46.3 C42,45.9 45.6,46.2 48.2,47.6 C48.8,52 46.8,55.6 43,55.6 C39.4,55.6 37.2,52.4 36,48 Z M66.4,44.6 L61,46.3 C58,45.9 54.4,46.2 51.8,47.6 C51.2,52 53.2,55.6 57,55.6 C60.6,55.6 62.8,52.4 64,48 Z" fill="url(#${u}g)" stroke="#f1c653" stroke-width=".6"/>
      <path d="M48.2,48.4 C49.4,47.6 50.6,47.6 51.8,48.4" stroke="#f1c653" stroke-width=".9" fill="none"/>
      <path d="M39.5,49 L42,47.6 M55.5,49 L58,47.6" stroke="#fff" stroke-width=".9" opacity=".75" stroke-linecap="round"/>
      ${reflet(40.4, 51.2, 0.7)}${reflet(56.4, 51.2, 0.7)}
      <path d="M50.4,56 C49.8,57.6 49.8,58.4 50.8,58.8" stroke="#c98a70" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <g fill="#ff7a90" opacity=".35"><ellipse cx="40.5" cy="59" rx="3" ry="1.6"/><ellipse cx="59.5" cy="59" rx="3" ry="1.6"/></g>
      <path d="M45.5,61.4 C47.5,60.4 49,60.6 50,61.2 C51,60.6 52.5,60.4 54.5,61.4 C53,64.6 47,64.6 45.5,61.4 Z" fill="#d42a50"/>
      <path d="M46.8,61.9 C48.6,62.6 51.4,62.6 53.2,61.9" stroke="#fff" stroke-width=".7" fill="none" opacity=".6"/>`,
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { ecran: DESSINS } })
