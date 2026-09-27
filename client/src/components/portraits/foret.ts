// La forêt · Nature — de l'écureuil au cerf.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { lin, miroir, points, reflet, rad, type DessinDePortrait } from './outils'

/** Les lucioles de la forêt, toujours aux mêmes places. */
const LUCIOLES: [number, number, number][] = [
  [18, 30, 0.9],
  [82, 26, 0.8],
  [13, 58, 0.6],
  [87, 60, 0.7],
  [27, 14, 0.6],
  [73, 12, 0.5],
]

/** Deux sapins sombres, de part et d'autre, au bas du disque. */
const SAPINS = (() => {
  const un = '<path d="M-4,100 C6,86 14,80 21,70 C20,82 24,90 31,100 Z" fill="#12352a" opacity=".9"/>'
  return un + miroir(un)
})()

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:ecureuil': {
    fond: ['#86c47a', '#2f6b3c', '#0d2614'],
    defs: u =>
      lin(u + 'r', '#ee9447', '#b4521d') +
      lin(u + 'q', '#f6a95c', '#a9471a', 1, 1) +
      lin(u + 'v', '#fdf4e3', '#ead3ab') +
      lin(u + 'g', '#d99a55', '#8e5a26'),
    decor: () => points(LUCIOLES, '#ffe9a8'),
    corps: u => `
      <path d="M56,100 C75,96 90,82 92,61 C94,42 90,24 78,16.5 C70,12 61.5,15.5 61.5,23.5 C61.5,30 68,32.5 72.5,29 C76.5,35 78.5,45 77.5,57 C76.5,71 68,83 53,91 Z" fill="url(#${u}q)"/>
      <g fill="none" stroke="#ffcf8a" stroke-width="1" stroke-linecap="round" opacity=".55">
        <path d="M86,40 C88,52 86,64 80,74"/><path d="M81,24 C85,28 87,33 88,38"/><path d="M70,86 C76,82 81,77 84,71"/>
      </g>
      <path d="M28,100 C30,88 39,81 50,81 C61,81 70,88 72,100 Z" fill="url(#${u}r)"/>
      <path d="M40.5,100 C41.5,91 45.5,86 50,86 C54.5,86 58.5,91 59.5,100 Z" fill="url(#${u}v)"/>
      <path d="M34.5,37 L29.5,16.5 L44,30.5 Z" fill="#c4632a"/>
      <path d="M35.6,33.5 L32.2,21.5 L41,30.5 Z" fill="#f6c9a0"/>
      <path d="M29.5,16.5 C28.5,13 28.8,9.5 30.5,7.5 C31.2,10.5 32.2,13 33.5,15.5 Z" fill="#7a3413"/>
      ${miroir('<path d="M34.5,37 L29.5,16.5 L44,30.5 Z" fill="#c4632a"/><path d="M35.6,33.5 L32.2,21.5 L41,30.5 Z" fill="#f6c9a0"/><path d="M29.5,16.5 C28.5,13 28.8,9.5 30.5,7.5 C31.2,10.5 32.2,13 33.5,15.5 Z" fill="#7a3413"/>')}
      <path d="M50,28.5 C62,28.5 70,36.5 70,48 C70,60 62,72 50,74.5 C38,72 30,60 30,48 C30,36.5 38,28.5 50,28.5 Z" fill="url(#${u}r)"/>
      <ellipse cx="50" cy="38" rx="8" ry="5" fill="#f7a45e" opacity=".5"/>
      <path d="M50,53.5 C57,53.5 63.5,57.5 64.5,63.5 C62.5,71 56.5,75 50,75 C43.5,75 37.5,71 35.5,63.5 C36.5,57.5 43,53.5 50,53.5 Z" fill="url(#${u}v)"/>
      <ellipse cx="41.3" cy="47.3" rx="5.2" ry="4.6" fill="#fbe5c8" opacity=".85"/>
      <ellipse cx="58.7" cy="47.3" rx="5.2" ry="4.6" fill="#fbe5c8" opacity=".85"/>
      <circle cx="41.5" cy="47.6" r="3.5" fill="#1d0f08"/><circle cx="58.5" cy="47.6" r="3.5" fill="#1d0f08"/>
      ${reflet(40.3, 46.3, 1.1)}${reflet(57.3, 46.3, 1.1)}
      <circle cx="42.6" cy="49" r=".45" fill="#fff" opacity=".7"/><circle cx="59.6" cy="49" r=".45" fill="#fff" opacity=".7"/>
      <ellipse cx="37.5" cy="58" rx="3" ry="1.8" fill="#ff9a7a" opacity=".35"/><ellipse cx="62.5" cy="58" rx="3" ry="1.8" fill="#ff9a7a" opacity=".35"/>
      <path d="M47.4,59.6 C47.4,58 52.6,58 52.6,59.6 C52.6,61.3 51.1,62.6 50,62.6 C48.9,62.6 47.4,61.3 47.4,59.6 Z" fill="#3a1f14"/>
      <ellipse cx="49" cy="59.2" rx=".9" ry=".45" fill="#fff" opacity=".5"/>
      <path d="M50,62.6 L50,64.4 M47.4,65 C48.6,66.2 51.4,66.2 52.6,65" stroke="#8a4a2c" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <rect x="48.7" y="65.7" width="2.6" height="2.5" rx=".6" fill="#fff"/>
      <path d="M50,65.8 L50,68.1" stroke="#e8d8c4" stroke-width=".4"/>
      <path d="M44.2,84.2 C44.2,80.4 55.8,80.4 55.8,84.2 C55.8,85 44.2,85 44.2,84.2 Z" fill="#7a4a22"/>
      <path d="M50,80.9 L50.5,78.8" stroke="#5a3416" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M45.6,84.6 C45.6,90 47.8,93 50,93 C52.2,93 54.4,90 54.4,84.6 Z" fill="url(#${u}g)"/>
      <ellipse cx="48" cy="87" rx=".8" ry="1.6" fill="#fff" opacity=".35"/>
      <g fill="url(#${u}r)"><ellipse cx="43.8" cy="88.6" rx="3" ry="3.6"/><ellipse cx="56.2" cy="88.6" rx="3" ry="3.6"/></g>`,
  },

  'br:blaireau': {
    fond: ['#6fae8a', '#265a44', '#0a1f17'],
    defs: u => lin(u + 'g', '#9a9ca3', '#55575e') + lin(u + 'b', '#fbf8f1', '#dcd6ca'),
    decor: () =>
      `<circle cx="77" cy="21" r="8" fill="#fdf3c4" opacity=".9"/><circle cx="74.5" cy="19" r="1.4" fill="#e8dca4" opacity=".7"/><circle cx="79.5" cy="24" r="1" fill="#e8dca4" opacity=".6"/>` +
      points(LUCIOLES.filter(([x]) => x < 70), '#ffe9a8') +
      SAPINS,
    corps: u => `
      <path d="M22,100 C24,88 36,80 50,80 C64,80 76,88 78,100 Z" fill="url(#${u}g)"/>
      <g fill="none" stroke="#c4c6cc" stroke-width=".8" stroke-linecap="round" opacity=".5">
        <path d="M30,92 L33,88 M36,94 L38.5,89.5 M64,94 L61.5,89.5 M70,92 L67,88"/>
      </g>
      <path d="M41,100 C42.5,94 45,89.5 47.5,86.5 L50,84.5 L52.5,86.5 C55,89.5 57.5,94 59,100 Z" fill="#2a2a2f"/>
      <circle cx="28.5" cy="42" r="5.4" fill="#2a2a2f"/>
      <path d="M23.6,40.5 C24.6,36.5 29.6,35.2 32.6,37.8" stroke="#f2efe8" stroke-width="1.7" fill="none" stroke-linecap="round"/>
      ${miroir('<circle cx="28.5" cy="42" r="5.4" fill="#2a2a2f"/><path d="M23.6,40.5 C24.6,36.5 29.6,35.2 32.6,37.8" stroke="#f2efe8" stroke-width="1.7" fill="none" stroke-linecap="round"/>')}
      <path d="M50,30 C63,30 73,38.5 73,50 C73,60 64.5,70 55.5,77 C53.5,79 46.5,79 44.5,77 C35.5,70 27,60 27,50 C27,38.5 37,30 50,30 Z" fill="url(#${u}b)"/>
      <path d="M45.4,74.5 C43,68 40.5,60 37.6,52 C35.6,46 33.2,39.5 31.2,33.8 C34.2,31.4 38.2,30.3 41.2,30.6 C42.7,37.2 44.2,44 46.1,51 C47.4,57.5 48.3,65.5 48.8,74 Z" fill="#232327"/>
      ${miroir('<path d="M45.4,74.5 C43,68 40.5,60 37.6,52 C35.6,46 33.2,39.5 31.2,33.8 C34.2,31.4 38.2,30.3 41.2,30.6 C42.7,37.2 44.2,44 46.1,51 C47.4,57.5 48.3,65.5 48.8,74 Z" fill="#232327"/>')}
      <path d="M47,33 C48.5,31.5 51.5,31.5 53,33" stroke="#fff" stroke-width="1.2" fill="none" opacity=".6" stroke-linecap="round"/>
      <ellipse cx="41.2" cy="51.3" rx="2.9" ry="2.4" fill="#45454d"/>
      <ellipse cx="58.8" cy="51.3" rx="2.9" ry="2.4" fill="#45454d"/>
      <circle cx="41.3" cy="51.4" r="1.8" fill="#0b0b0e"/><circle cx="58.7" cy="51.4" r="1.8" fill="#0b0b0e"/>
      ${reflet(40.6, 50.7, 0.7)}${reflet(58, 50.7, 0.7)}
      <path d="M45.6,72.2 C45.6,69.4 54.4,69.4 54.4,72.2 C54.4,75.2 52.1,77.4 50,77.4 C47.9,77.4 45.6,75.2 45.6,72.2 Z" fill="#1a1a1e"/>
      <ellipse cx="48" cy="71.4" rx="1.3" ry=".6" fill="#fff" opacity=".45"/>
      <path d="M50,77.4 L50,79" stroke="#6b6b73" stroke-width=".8" stroke-linecap="round"/>`,
  },

  'br:lynx': {
    fond: ['#9cc47e', '#3b6536', '#10230f'],
    defs: u => lin(u + 't', '#e8bd82', '#b07a45') + lin(u + 'n', '#c89660', '#8a5a2e') + lin(u + 'f', '#fbf5ea', '#e6d7c2'),
    decor: () =>
      points(LUCIOLES, '#fff6d8', 0.7) +
      `<g fill="#fff" opacity=".55"><circle cx="22" cy="44" r=".7"/><circle cx="78" cy="40" r=".8"/><circle cx="16" cy="76" r=".6"/><circle cx="84" cy="80" r=".7"/></g>` +
      SAPINS,
    corps: u => `
      <path d="M24,100 C26,87 37,80 50,80 C63,80 74,87 76,100 Z" fill="url(#${u}n)"/>
      <g fill="#6b4222" opacity=".55"><ellipse cx="33" cy="92" rx="1.6" ry="1.1"/><ellipse cx="38" cy="87" rx="1.3" ry=".9"/><ellipse cx="67" cy="92" rx="1.6" ry="1.1"/><ellipse cx="62" cy="87" rx="1.3" ry=".9"/></g>
      <path d="M42,100 C43,92 46.5,87 50,87 C53.5,87 57,92 58,100 Z" fill="url(#${u}f)"/>
      <path d="M33.5,41 L29.5,16 L45,32 Z" fill="#a8733f"/>
      <path d="M34.8,37 L32,21.5 L41.5,32 Z" fill="#f3e2cc"/>
      <path d="M29.5,16.5 L28,5.5" stroke="#1f1712" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M30.2,19 L29.3,15" stroke="#1f1712" stroke-width="3" stroke-linecap="round"/>
      ${miroir('<path d="M33.5,41 L29.5,16 L45,32 Z" fill="#a8733f"/><path d="M34.8,37 L32,21.5 L41.5,32 Z" fill="#f3e2cc"/><path d="M29.5,16.5 L28,5.5" stroke="#1f1712" stroke-width="1.8" stroke-linecap="round"/><path d="M30.2,19 L29.3,15" stroke="#1f1712" stroke-width="3" stroke-linecap="round"/>')}
      <path d="M50,30 C62,30 70,37 71,47 L80.5,55.5 L72.5,57.5 L78.5,64 L68.5,64 C64.5,72 57.5,77.5 50,78.5 C42.5,77.5 35.5,72 31.5,64 L21.5,64 L27.5,57.5 L19.5,55.5 L29,47 C30,37 38,30 50,30 Z" fill="url(#${u}t)"/>
      <g fill="none" stroke="#4a2e18" stroke-width="1.1" stroke-linecap="round" opacity=".75">
        <path d="M22.5,57 L28,57.5 M24,62.5 L30,61.5 M77.5,57 L72,57.5 M76,62.5 L70,61.5"/>
      </g>
      <path d="M26,56 L20.5,55.8 L27.5,58.5 L22.5,63.6 L32,63.5 C33,66 34.5,68 36,69.5 C34,65 33.5,60 34.5,56 Z" fill="#f6ecdd" opacity=".85"/>
      ${miroir('<path d="M26,56 L20.5,55.8 L27.5,58.5 L22.5,63.6 L32,63.5 C33,66 34.5,68 36,69.5 C34,65 33.5,60 34.5,56 Z" fill="#f6ecdd" opacity=".85"/>')}
      <g fill="none" stroke="#5a3a1e" stroke-width="1.2" stroke-linecap="round" opacity=".7">
        <path d="M46,33 C46.5,36 46.5,39 45.8,41.5"/><path d="M50,32 L50,40"/><path d="M54,33 C53.5,36 53.5,39 54.2,41.5"/>
      </g>
      <g fill="#6b4222" opacity=".6"><circle cx="38" cy="40" r=".9"/><circle cx="62" cy="40" r=".9"/><circle cx="35.5" cy="44.5" r=".7"/><circle cx="64.5" cy="44.5" r=".7"/></g>
      <path d="M36,49.4 C37.6,46.2 42.8,45.6 45.6,48.3 C43.6,51.5 38.2,52.1 36,49.4 Z" fill="#f3f1f0"/>
      <path d="M64,49.4 C62.4,46.2 57.2,45.6 54.4,48.3 C56.4,51.5 61.8,52.1 64,49.4 Z" fill="#f3f1f0"/>
      <path d="M37,49.3 C38.4,47 42.4,46.6 44.6,48.5 C43,50.8 38.8,51.2 37,49.3 Z" fill="#c9d64a" stroke="#2a2016" stroke-width=".9"/>
      <path d="M63,49.3 C61.6,47 57.6,46.6 55.4,48.5 C57,50.8 61.2,51.2 63,49.3 Z" fill="#c9d64a" stroke="#2a2016" stroke-width=".9"/>
      <ellipse cx="41" cy="48.9" rx=".9" ry="1.7" fill="#140e08"/><ellipse cx="59" cy="48.9" rx=".9" ry="1.7" fill="#140e08"/>
      ${reflet(40.2, 48.1, 0.5)}${reflet(58.2, 48.1, 0.5)}
      <path d="M45.2,48.6 C46.5,52 47.5,55 47.8,58 M54.8,48.6 C53.5,52 52.5,55 52.2,58" stroke="#3a2414" stroke-width="1" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M50,55 C56.5,55 61.5,58.5 63,63 C60.5,70 55.5,74 50,75 C44.5,74 39.5,70 37,63 C38.5,58.5 43.5,55 50,55 Z" fill="url(#${u}f)"/>
      <path d="M46.8,60.2 C46.8,58.4 53.2,58.4 53.2,60.2 C53.2,62.3 51.3,63.8 50,63.8 C48.7,63.8 46.8,62.3 46.8,60.2 Z" fill="#b0584a"/>
      <ellipse cx="48.6" cy="59.7" rx=".9" ry=".45" fill="#fff" opacity=".5"/>
      <path d="M50,63.8 L50,66 M46.6,67 C48.4,68.4 51.6,68.4 53.4,67" stroke="#6b4a36" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <g fill="#6b4a36" opacity=".7"><circle cx="42.5" cy="64" r=".55"/><circle cx="41" cy="66" r=".55"/><circle cx="57.5" cy="64" r=".55"/><circle cx="59" cy="66" r=".55"/></g>`,
  },

  'br:loup': {
    fond: ['#4f9a86', '#1a4a3d', '#081b16'],
    defs: u => lin(u + 't', '#9aa5b8', '#5b6478') + lin(u + 'n', '#6b7489', '#3f475a'),
    decor: () => points([[20, 24, 0.8], [80, 20, 0.7], [12, 52, 0.6], [88, 50, 0.8], [30, 10, 0.5]], '#ffe9a8'),
    corps: u => `
      <path d="M24,100 C26,86 37,79 50,79 C63,79 74,86 76,100 Z" fill="url(#${u}n)"/>
      <path d="M41,100 L45.5,86 L50,93 L54.5,86 L59,100 Z" fill="#eef1f6"/>
      <path d="M31.5,41 L27.5,13.5 L46,30.5 Z" fill="#5b6478"/>
      <path d="M33.3,36.5 L30.6,20 L41.5,30.5 Z" fill="#d9c1bb"/>
      ${miroir('<path d="M31.5,41 L27.5,13.5 L46,30.5 Z" fill="#5b6478"/><path d="M33.3,36.5 L30.6,20 L41.5,30.5 Z" fill="#d9c1bb"/>')}
      <path d="M50,26.5 C61,26.5 70,33 72,43 L79,52.5 L70.5,55 C68.5,66 60.5,76 50,80.5 C39.5,76 31.5,66 29.5,55 L21,52.5 L28,43 C30,33 39,26.5 50,26.5 Z" fill="url(#${u}t)"/>
      <path d="M50,28.5 C52.4,34.5 52.4,42.5 50,50.5 C47.6,42.5 47.6,34.5 50,28.5 Z" fill="#454d61" opacity=".75"/>
      <path d="M50,52.5 C56.5,52.5 62.5,56 66.5,60.5 C62.5,70.5 56.5,76.5 50,78.5 C43.5,76.5 37.5,70.5 33.5,60.5 C37.5,56 43.5,52.5 50,52.5 Z" fill="#eef1f6"/>
      <ellipse cx="41.5" cy="43.2" rx="3.2" ry="1.6" fill="#eef1f6" transform="rotate(-12 41.5 43.2)"/>
      <ellipse cx="58.5" cy="43.2" rx="3.2" ry="1.6" fill="#eef1f6" transform="rotate(12 58.5 43.2)"/>
      <path d="M36.3,49.4 C37.9,46.4 42.9,45.9 45.4,48.4 C43.4,51.4 38.4,51.9 36.3,49.4 Z" fill="#f4b73a" stroke="#262b36" stroke-width=".9"/>
      <path d="M63.7,49.4 C62.1,46.4 57.1,45.9 54.6,48.4 C56.6,51.4 61.6,51.9 63.7,49.4 Z" fill="#f4b73a" stroke="#262b36" stroke-width=".9"/>
      <circle cx="41" cy="49" r="1.55" fill="#1a120a"/><circle cx="59" cy="49" r="1.55" fill="#1a120a"/>
      ${reflet(40.3, 48.3, 0.55)}${reflet(58.3, 48.3, 0.55)}
      <path d="M45,63 C45,60.3 55,60.3 55,63 C55,66 52.2,68.2 50,68.2 C47.8,68.2 45,66 45,63 Z" fill="#1f2330"/>
      <ellipse cx="47.6" cy="62.2" rx="1.2" ry=".6" fill="#fff" opacity=".5"/>
      <path d="M50,68.2 L50,71 M46.2,72 C48.2,73.6 51.8,73.6 53.8,72" stroke="#8a93a4" stroke-width=".9" fill="none" stroke-linecap="round"/>`,
  },

  'br:ours': {
    fond: ['#6aa97a', '#255339', '#0a1e13'],
    defs: u => rad(u + 't', '#b57a44', '#6b3f1c') + lin(u + 'n', '#8a5a2e', '#4f2c12') + lin(u + 'm', '#e6b98a', '#c08a58'),
    decor: () => points(LUCIOLES, '#ffe9a8') + SAPINS,
    corps: u => `
      <path d="M17,100 C19,85 33,77 50,77 C67,77 81,85 83,100 Z" fill="url(#${u}n)"/>
      <g fill="none" stroke="#a8764a" stroke-width=".9" stroke-linecap="round" opacity=".5">
        <path d="M28,90 C29,87 31,85 33,84 M72,90 C71,87 69,85 67,84 M40,96 C41,93 43,91 45,90 M60,96 C59,93 57,91 55,90"/>
      </g>
      <circle cx="30.5" cy="33" r="8.2" fill="#7a4a24"/><circle cx="30.8" cy="33.4" r="4.6" fill="#d9a877"/>
      <circle cx="69.5" cy="33" r="8.2" fill="#7a4a24"/><circle cx="69.2" cy="33.4" r="4.6" fill="#d9a877"/>
      <path d="M50,27.5 C65.5,27.5 75.5,38 75.5,52 C75.5,66.5 64.5,77.5 50,78.5 C35.5,77.5 24.5,66.5 24.5,52 C24.5,38 34.5,27.5 50,27.5 Z" fill="url(#${u}t)"/>
      <ellipse cx="50" cy="38" rx="11" ry="6" fill="#c98e56" opacity=".45"/>
      <path d="M36.5,46.5 C38.5,44.5 42.5,44.2 44.5,45.8 M63.5,46.5 C61.5,44.5 57.5,44.2 55.5,45.8" stroke="#4a2a12" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".7"/>
      <circle cx="40.8" cy="50.3" r="2.5" fill="#1a0e07"/><circle cx="59.2" cy="50.3" r="2.5" fill="#1a0e07"/>
      ${reflet(40, 49.5, 0.8)}${reflet(58.4, 49.5, 0.8)}
      <ellipse cx="50" cy="64" rx="11.5" ry="9.5" fill="url(#${u}m)"/>
      <path d="M44.2,59.4 C44.2,56.2 55.8,56.2 55.8,59.4 C55.8,63 52.6,65.2 50,65.2 C47.4,65.2 44.2,63 44.2,59.4 Z" fill="#1f130c"/>
      <ellipse cx="47.4" cy="58.4" rx="1.6" ry=".7" fill="#fff" opacity=".45"/>
      <path d="M50,65.2 L50,68.2 M45.8,69.6 C47.8,71.3 52.2,71.3 54.2,69.6" stroke="#4a2a14" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  },

  'br:cerf': {
    fond: ['#5aa97c', '#1f4f39', '#0a1f16'],
    defs: u => lin(u + 'a', '#fbf3e0', '#c4a473') + lin(u + 't', '#d28d55', '#8f4f28') + lin(u + 'n', '#7d4524', '#4f2a14'),
    decor: () => points(LUCIOLES, '#ffe9a8') + SAPINS,
    corps: u => `
      <path d="M26,100 C28,88 38,79 50,79 C62,79 72,88 74,100 Z" fill="url(#${u}n)"/>
      <path d="M42,100 C43,91 46,85 50,85 C54,85 57,91 58,100 Z" fill="#f1dfc4"/>
      <g fill="none" stroke="url(#${u}a)" stroke-width="3.3" stroke-linecap="round">
        <path d="M42.5,33 C38.5,25.5 32,18 25,9"/><path d="M36.5,25.5 C31,24.5 27,22 22.5,17.5"/><path d="M32,19.5 C33,14.5 33.5,10.5 33,6"/><path d="M39.5,28.5 C39,22.5 40.5,17.5 43,13"/>
        ${miroir('<path d="M42.5,33 C38.5,25.5 32,18 25,9"/><path d="M36.5,25.5 C31,24.5 27,22 22.5,17.5"/><path d="M32,19.5 C33,14.5 33.5,10.5 33,6"/><path d="M39.5,28.5 C39,22.5 40.5,17.5 43,13"/>')}
      </g>
      <path d="M39,38 C31,32.5 21,32.5 14.5,36.5 C20.5,41.5 30.5,42.5 38.5,40.5 Z" fill="#b8733f"/>
      <path d="M37,38.6 C31,35.3 24,35 18.5,36.6 C24,39.4 31,40 36.6,39.6 Z" fill="#f2c7a0"/>
      ${miroir('<path d="M39,38 C31,32.5 21,32.5 14.5,36.5 C20.5,41.5 30.5,42.5 38.5,40.5 Z" fill="#b8733f"/><path d="M37,38.6 C31,35.3 24,35 18.5,36.6 C24,39.4 31,40 36.6,39.6 Z" fill="#f2c7a0"/>')}
      <path d="M50,30.5 C61.5,30.5 68,37.5 67,47.5 C66,56.5 60.5,63 57,72 C55.6,77 53,80.5 50,80.5 C47,80.5 44.4,77 43,72 C39.5,63 34,56.5 33,47.5 C32,37.5 38.5,30.5 50,30.5 Z" fill="url(#${u}t)"/>
      <ellipse cx="50" cy="40.5" rx="7" ry="5" fill="#e3ab74" opacity=".55"/>
      <ellipse cx="42.4" cy="50" rx="5" ry="3.6" fill="#f3dfc3" opacity=".55"/>
      <ellipse cx="57.6" cy="50" rx="5" ry="3.6" fill="#f3dfc3" opacity=".55"/>
      <path d="M43.6,65.5 C44,60.5 56,60.5 56.4,65.5 C56.4,73.5 53.3,80.5 50,80.5 C46.7,80.5 43.6,73.5 43.6,65.5 Z" fill="#f3e2c8"/>
      <path d="M39.4,50 C40.4,47 44.6,47 45.6,50 C44.6,52.6 40.4,52.6 39.4,50 Z" fill="#1d120c"/>
      <path d="M60.6,50 C59.6,47 55.4,47 54.4,50 C55.4,52.6 59.6,52.6 60.6,50 Z" fill="#1d120c"/>
      ${reflet(43.3, 49.1)}${reflet(56.7, 49.1)}
      <path d="M46.3,70.3 C46.3,67.6 53.7,67.6 53.7,70.3 C53.7,72.8 51.6,74.4 50,74.4 C48.4,74.4 46.3,72.8 46.3,70.3 Z" fill="#2b1b12"/>
      <ellipse cx="48.6" cy="69.4" rx="1.1" ry=".6" fill="#fff" opacity=".55"/>`,
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { foret: DESSINS } })
