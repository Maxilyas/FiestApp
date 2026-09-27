// La brigade · Cuisine — du croissant au chef.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { etoile, lin, miroir, points, reflet, rad, type DessinDePortrait } from './outils'

/** Les volutes de vapeur du chef (la maquette) : la cuisine chauffe derrière chacun. */
const VAPEUR =
  '<g fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1.4" stroke-linecap="round"><path d="M18,40 C14,34 20,30 16,24"/><path d="M84,44 C88,38 82,34 86,28"/><path d="M14,70 C11,66 15,63 12,58"/></g>'

/** Les étincelles du fourneau, toujours aux mêmes places. */
const ETINCELLES: [number, number, number][] = [
  [24, 14, 0.7],
  [77, 13, 0.6],
  [89, 58, 0.6],
  [11, 48, 0.5],
  [86, 78, 0.5],
]

/**
 * Le pied d'un macaron, sa collerette : une rangée de petites bosses, de
 * droite à gauche — vers le bas (h > 0) sous la coque du dessus, vers le
 * haut sur celle du dessous.
 */
const bosses = (largeur: number, n: number, h: number) => {
  const pas = largeur / n
  return Array.from({ length: n }, () => `q-${(pas / 2).toFixed(2)},${h} -${pas.toFixed(2)},0`).join(' ')
}

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:croissant': {
    fond: ['#d9784a', '#8a3517', '#2e0e04'],
    defs: u =>
      rad(u + 'd', '#ffe9a8', '#d98a30') + lin(u + 'b', '#fcd583', '#b8601a') + lin(u + 'e', '#f4b05a', '#9c4a14'),
    // Il sort du four : sa vapeur monte au-dessus de lui.
    decor: () =>
      '<g fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.4" stroke-linecap="round"><path d="M43,19.5 C40,15.5 45,12.5 42,8"/><path d="M50,18 C47,13.5 53,10.5 50,6"/><path d="M57,19.5 C60,15.5 55,12.5 58,8"/></g>' +
      points(ETINCELLES, '#ffe2a8'),
    // Cinq lobes en éventail, des pointes au ventre : chacun passe devant
    // son voisin de l'extérieur, et le pli qui les sépare se lit encore au
    // classement — c'est lui qui fait le croissant, pas la couleur.
    corps: u => `
      <g stroke="#6a2c08" stroke-width="1.1" stroke-opacity=".7">
        ${[`<path d="M19.5,80 C14.5,72 12.5,57 21.5,43 C25.5,53 28.5,64 31,74 C27,75.5 22.5,77.5 19.5,80 Z" fill="url(#${u}e)"/><path d="M21.5,43 C24,35.5 29,30.5 36,28.5 C39,44 41,61 41.5,75.5 C38,76.5 34,76 30.5,73.5 C26.5,63 23,52 21.5,43 Z" fill="url(#${u}b)"/>`].map(l => l + miroir(l)).join('')}
        <path d="M35,29 C40,26.5 45,25.5 50,25.5 C55,25.5 60,26.5 65,29 C67.5,45 64,63 58.6,76 C55,79.5 45,79.5 41.4,76 C36,63 32.5,45 35,29 Z" fill="url(#${u}d)"/>
      </g>
      <g fill="none" stroke-linecap="round">
        ${[`<path d="M23.8,47.5 C25.8,41.5 29.5,36.5 34,33.5 M15.6,63 C15.8,57.5 17.8,52.5 21,49" stroke="#fff3c8" stroke-width="1.4" opacity=".6"/><path d="M24.5,66.5 C28,69 33,70.4 38.6,70.8 M17,72.5 C19.5,72.8 22.5,72 25.5,70.5" stroke="#8a3c10" stroke-width=".9" opacity=".45"/>`].map(l => l + miroir(l)).join('')}
      </g>
      <ellipse cx="43" cy="31" rx="6" ry="2.4" fill="#fff" opacity=".45" transform="rotate(-12 43 31)"/>
      <ellipse cx="43.5" cy="50" rx="2.6" ry="3.1" fill="#3a1a0a"/><ellipse cx="56.5" cy="50" rx="2.6" ry="3.1" fill="#3a1a0a"/>
      ${reflet(42.6, 48.8, 1.05)}${reflet(55.6, 48.8, 1.05)}
      <circle cx="44.3" cy="51.5" r=".45" fill="#fff" opacity=".7"/><circle cx="57.3" cy="51.5" r=".45" fill="#fff" opacity=".7"/>
      <ellipse cx="39" cy="56.5" rx="2.8" ry="1.9" fill="#ff7a5c" opacity=".5"/><ellipse cx="61" cy="56.5" rx="2.8" ry="1.9" fill="#ff7a5c" opacity=".5"/>
      <path d="M46.2,56.8 C47.2,61 52.8,61 53.8,56.8 C51.2,57.8 48.8,57.8 46.2,56.8 Z" fill="#5a2410"/>
      <path d="M48.3,59.6 C49.3,60.5 50.7,60.5 51.7,59.6 C51,58.9 49,58.9 48.3,59.6 Z" fill="#ff8a70"/>`,
  },

  'br:macaron': {
    fond: ['#f0a068', '#a04c24', '#3c1708'],
    defs: u => rad(u + 'h', '#ffd9e6', '#ea7fa7') + lin(u + 'l', '#f7a6c4', '#d6668f') + lin(u + 'g', '#fff8ec', '#f0d6b8'),
    // Des étincelles de sucre, aux couleurs des autres macarons de la boîte.
    decor: () =>
      etoile(22, 20, 3.2, '#fff', 0.8) +
      etoile(80, 17, 2.4, '#fff', 0.7) +
      etoile(86, 82, 2, '#ffe9f1', 0.7) +
      points([[15, 36, 0.8], [86, 38, 0.7], [32, 11, 0.6], [68, 10, 0.6]], '#ffe9f1') +
      points([[18, 86, 1], [72, 90, 0.8]], '#bff0d8', 0.8) +
      points([[30, 92, 0.8], [88, 60, 0.8]], '#d9c8ff', 0.8),
    corps: u => `
      <path d="M14,70.5 H86 C86,77 73,83 50,83 C27,83 14,77 14,70.5 Z" fill="url(#${u}l)"/>
      <path d="M13.5,71.5 H86.5 V69 ${bosses(73, 24, -2.2)} Z" fill="#eb8db1"/>
      <path d="M16,60.5 H84 C86,60.5 87,62.5 87,64 C87,65.5 86,67.5 84,67.5 H16 C14,67.5 13,65.5 13,64 C13,62.5 14,60.5 16,60.5 Z" fill="url(#${u}g)"/>
      <path d="M13,56 H87 V59.5 ${bosses(74, 24, 2.2)} Z" fill="#f59bbd"/>
      <g stroke-dasharray=".6 1.1" stroke-width="1.4" opacity=".7" fill="none">
        <path d="M15,58 H85" stroke="#d9709a"/><path d="M15.5,70.5 H84.5" stroke="#c95a86"/>
      </g>
      <path d="M13.5,57 C13.5,38 30,27 50,27 C70,27 86.5,38 86.5,57 Z" fill="url(#${u}h)"/>
      <path d="M22,48 C23.5,40 30,34.5 38,32.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".6"/>
      <circle cx="42.5" cy="31.2" r="1.1" fill="#fff" opacity=".6"/>
      <ellipse cx="41" cy="46.5" rx="2.8" ry="3.3" fill="#4a1a2a"/><ellipse cx="59" cy="46.5" rx="2.8" ry="3.3" fill="#4a1a2a"/>
      ${reflet(40, 45.2, 1.1)}${reflet(58, 45.2, 1.1)}
      <circle cx="41.9" cy="48" r=".45" fill="#fff" opacity=".7"/><circle cx="59.9" cy="48" r=".45" fill="#fff" opacity=".7"/>
      <ellipse cx="34.5" cy="51" rx="3.4" ry="2.1" fill="#ff5f8a" opacity=".45"/><ellipse cx="65.5" cy="51" rx="3.4" ry="2.1" fill="#ff5f8a" opacity=".45"/>
      <path d="M46.5,50.6 C47.4,54.4 52.6,54.4 53.5,50.6 C51.2,51.5 48.8,51.5 46.5,50.6 Z" fill="#6a1f35"/>
      <path d="M48.4,53 C49.4,53.8 50.6,53.8 51.6,53 C51,52.4 49,52.4 48.4,53 Z" fill="#ff8fa8"/>`,
  },

  'br:boulanger': {
    fond: ['#f4a868', '#a85026', '#3f180a'],
    defs: u =>
      lin(u + 'p', '#e3a57b', '#c07e55') +
      lin(u + 'k', '#ffffff', '#dfe3ea') +
      lin(u + 't', '#3c4f7a', '#243352') +
      lin(u + 'b', '#f6c872', '#b86a22'),
    // La farine qui vole, et la vapeur du four.
    decor: () => VAPEUR + points(ETINCELLES, '#fff', 0.7),
    corps: u => `
      <path d="M22,100 C24,86 36,78 50,78 C64,78 76,86 78,100 Z" fill="url(#${u}k)"/>
      <path d="M37,86 C42,84 58,84 63,86 L65,100 L35,100 Z" fill="url(#${u}t)"/>
      <path d="M38.5,86 L42.5,79.5 M61.5,86 L57.5,79.5" stroke="#2c3b5e" stroke-width="1.8"/>
      <path d="M45.5,68 L45.5,79.5 C47.5,81 52.5,81 54.5,79.5 L54.5,68 Z" fill="#b87650"/>
      <ellipse cx="35.6" cy="53" rx="2.6" ry="3.8" fill="#c98a60"/><ellipse cx="64.4" cy="53" rx="2.6" ry="3.8" fill="#c98a60"/>
      <path d="M36,50 C36,41 42,37 50,37 C58,37 64,41 64,50 C64,61 58,69.5 50,71.5 C42,69.5 36,61 36,50 Z" fill="url(#${u}p)"/>
      <path d="M35.6,49 C35,44 36.5,40.5 39,38.8 L41,44 C39,44.6 37.6,46.2 37.3,49.5 Z" fill="#3b2416"/>
      ${miroir('<path d="M35.6,49 C35,44 36.5,40.5 39,38.8 L41,44 C39,44.6 37.6,46.2 37.3,49.5 Z" fill="#3b2416"/>')}
      <path d="M31.5,41.5 C30.5,34 32.5,28 36.5,24.5 C41,21 46,22.5 50,25 C54,22.5 59,21 63.5,24.5 C67.5,28 69.5,34 68.5,41.5 C61,38.5 39,38.5 31.5,41.5 Z" fill="url(#${u}k)"/>
      <path d="M31.5,41.5 C39,38.5 61,38.5 68.5,41.5 L68.8,37.8 C61,34.8 39,34.8 31.2,37.8 Z" fill="#eef1f6" stroke="#cfd5e0" stroke-width=".6"/>
      <path d="M50,25 C49.5,29 49.5,32.5 50,35.5" stroke="#cfd5e0" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M40,45.5 C41.8,44.2 44.5,44.2 46,45.2 M54,45.2 C55.5,44.2 58.2,44.2 60,45.5" stroke="#3b2416" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <ellipse cx="43" cy="50" rx="2" ry="2.4" fill="#2a160c"/><ellipse cx="57" cy="50" rx="2" ry="2.4" fill="#2a160c"/>
      ${reflet(42.3, 49.2, 0.8)}${reflet(56.3, 49.2, 0.8)}
      <path d="M50.3,51.5 C49.4,55 49.2,56.4 50.6,57.2" stroke="#9a5e3a" stroke-width="1" fill="none" stroke-linecap="round"/>
      <circle cx="39.5" cy="58.5" r="3.2" fill="#ff8a7a" opacity=".35"/><circle cx="60.5" cy="58.5" r="3.2" fill="#ff8a7a" opacity=".35"/>
      <ellipse cx="61" cy="57.5" rx="2.6" ry="1.3" fill="#fff" opacity=".6" transform="rotate(15 61 57.5)"/>
      <circle cx="50.6" cy="56.4" r="1" fill="#fff" opacity=".6"/>
      <path d="M44.8,61.2 C46.8,66.2 53.2,66.2 55.2,61.2 C51.8,62.2 48.2,62.2 44.8,61.2 Z" fill="#6a2a1a"/>
      <path d="M45.8,61.9 C48.5,62.8 51.5,62.8 54.2,61.9 L54,63 C51.5,63.6 48.5,63.6 46,63 Z" fill="#fff"/>
      <g transform="translate(58 75) rotate(-49)">
        <g fill="url(#${u}b)" stroke="#8a4a14" stroke-width=".6" stroke-opacity=".6">
          <rect x="-34" y="-9.4" width="60" height="6.4" rx="3.2"/><rect x="-34" y="-3.2" width="65" height="6.4" rx="3.2"/><rect x="-34" y="3" width="57" height="6.4" rx="3.2"/>
        </g>
        <path d="M-12,-7.6 l4,-1.6 M-3,-7.6 l4,-1.6 M6,-7.6 l4,-1.6 M15,-7.6 l4,-1.6 M-8,-1.4 l4,-1.6 M1,-1.4 l4,-1.6 M10,-1.4 l4,-1.6 M19,-1.4 l4,-1.6 M-10,4.8 l4,-1.6 M-1,4.8 l4,-1.6 M8,4.8 l4,-1.6 M17,4.8 l4,-1.6" stroke="#ffe3a0" stroke-width="1.3" stroke-linecap="round"/>
      </g>
      <path d="M82,79.5 C73,80.5 62,81.5 51,82.3 L51,90.8 C61,91.3 71,92.3 81,93.5 Z" fill="url(#${u}p)"/>
      <path d="M81,79.6 C74,80.3 69,80.8 64,81.3" stroke="#fff" stroke-width="1" opacity=".35" fill="none" stroke-linecap="round"/>
      <ellipse cx="48.5" cy="86.5" rx="4.8" ry="4.6" fill="url(#${u}p)"/>
      <path d="M44.6,84.6 C46.8,84 49,84 51.2,84.8 M44.2,87 C46.4,86.4 48.8,86.4 51.2,87.2 M44.8,89.4 C46.8,88.9 49,88.9 50.8,89.6" stroke="#8a5234" stroke-width=".8" fill="none" stroke-linecap="round"/>
`,
  },

  'br:patissiere': {
    fond: ['#f09a62', '#9e4622', '#3a1508'],
    defs: u =>
      lin(u + 'p', '#94603f', '#6f4128') +
      lin(u + 'h', '#3a2219', '#1a0e0a') +
      lin(u + 'a', '#ffc4d6', '#ef8fae') +
      lin(u + 's', '#ffffff', '#dde2ea') +
      lin(u + 'm', '#f4f6fa', '#9aa3b3', 1, 0) +
      rad(u + 'r', '#ff6a6a', '#b3121f'),
    decor: () => VAPEUR + etoile(80, 22, 2.6, '#fff', 0.7) + points(ETINCELLES.slice(0, 3), '#ffe2a8'),
    corps: u => `
      <path d="M22,100 C24,86 36,78 50,78 C64,78 76,86 78,100 Z" fill="url(#${u}s)"/>
      <path d="M36,84 C42,82.5 58,82.5 64,84 L67,100 L33,100 Z" fill="url(#${u}a)"/>
      <path d="M36,84 C42,82.5 58,82.5 64,84" stroke="#fff" stroke-width="1.6" stroke-dasharray="1.2 .8" fill="none"/>
      <path d="M37.5,84 L43,79 M62.5,84 L57,79" stroke="#ef8fae" stroke-width="1.8"/>
      <path d="M45.5,68 L45.5,80 C47.5,81.5 52.5,81.5 54.5,80 L54.5,68 Z" fill="#6a3d25"/>
      <path d="M35,49 C34,39 40,31.5 50,31.5 C60,31.5 66,39 65,49 Z" fill="url(#${u}h)"/>
      <circle cx="50" cy="24" r="8.5" fill="url(#${u}h)"/>
      <path d="M44.5,20.5 C46,17.8 49,16.6 52,17" stroke="#6a4232" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M43,31 C47,32.5 53,32.5 57,31" stroke="#ff8fb0" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M50.5,15 C51,11.5 53.5,9 57,8" stroke="#5a7a2a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M54,9.6 C56,7.2 59.5,7.2 61,8.6 C59,10.2 56,10.6 54,9.6 Z" fill="#6fae3a"/>
      <circle cx="50.5" cy="16" r="3.6" fill="url(#${u}r)"/>${reflet(49.3, 14.8, 0.9)}
      <ellipse cx="36.2" cy="53" rx="2.3" ry="3.4" fill="#7a4a30"/><ellipse cx="63.8" cy="53" rx="2.3" ry="3.4" fill="#7a4a30"/>
      <circle cx="36.3" cy="57.3" r="1.1" fill="#fff4dc"/><circle cx="63.7" cy="57.3" r="1.1" fill="#fff4dc"/>
      <path d="M36.5,50 C36.5,41 42.5,36.5 50,36.5 C57.5,36.5 63.5,41 63.5,50 C63.5,61 57.5,69.5 50,71.5 C42.5,69.5 36.5,61 36.5,50 Z" fill="url(#${u}p)"/>
      <path d="M36.6,47 C36,39.5 42,34.5 50,34.5 C58,34.5 64,39.5 63.4,47 C61,41.5 56,39 50,39.5 C44,39 39,41.5 36.6,47 Z" fill="url(#${u}h)"/>
      <path d="M40.2,45.8 C41.8,44.6 44.2,44.5 45.8,45.3 M54.2,45.3 C55.8,44.5 58.2,44.6 59.8,45.8" stroke="#1a0e0a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="43" cy="50.5" rx="2" ry="2.4" fill="#1a0d08"/><ellipse cx="57" cy="50.5" rx="2" ry="2.4" fill="#1a0d08"/>
      ${reflet(42.3, 49.7, 0.8)}${reflet(56.3, 49.7, 0.8)}
      <path d="M41.1,49.4 L39.6,48.4 M58.9,49.4 L60.4,48.4" stroke="#1a0d08" stroke-width=".9" stroke-linecap="round"/>
      <path d="M50.3,52 C49.5,55 49.4,56.2 50.6,56.9" stroke="#4a2a18" stroke-width="1" fill="none" stroke-linecap="round"/>
      <circle cx="40" cy="58" r="3.3" fill="#e86a7a" opacity=".35"/><circle cx="60" cy="58" r="3.3" fill="#e86a7a" opacity=".35"/>
      <path d="M45.5,61.8 C47.5,64.8 52.5,64.8 54.5,61.8 C52,62.6 48,62.6 45.5,61.8 Z" fill="#b8284f"/>
      <path d="M25.8,62.7 L29.2,61.3 C33,69 38,76 42.6,83.9 C40,87.5 35,89.5 32.4,88.1 C30,80 27.5,72 25.8,62.7 Z" fill="url(#${u}s)" stroke="#c9ced8" stroke-width=".6"/>
      <path d="M27.8,66.5 C30.8,73 34.8,79 39.2,84.4 C37.6,86 35.6,86.9 33.9,86.6 C31.6,79.5 29.6,73 27.8,66.5 Z" fill="#ff9fbf" opacity=".85"/>
      <path d="M28.6,64 C30.5,69 33.5,74.5 36.5,78.5" stroke="#fff" stroke-width=".9" fill="none" opacity=".8" stroke-linecap="round"/>
      <path d="M25.2,63.1 L29.4,61.3 L26.4,55.2 L24,56.2 Z" fill="url(#${u}m)"/>
      <path d="M24,56.2 L24.3,54.6 L25.2,55.3 L25.6,54.1 L26.4,55.2" fill="#dfe3ea" stroke="#9aa3b3" stroke-width=".4" stroke-linejoin="round"/>
      <path d="M25.3,59 L28.1,57.8 M25.9,61 L28.8,59.8" stroke="#8a93a4" stroke-width=".5"/>
      <path d="M33,87.8 C34.5,91.5 39.5,91 42.2,84.8" stroke="#dde2ea" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <ellipse cx="38.6" cy="85" rx="5" ry="3.8" fill="url(#${u}p)" transform="rotate(-25 38.6 85)"/>
      <path d="M35.2,83.8 C37.2,82.6 39.8,82.4 42,83.4 M35,86.3 C37,85.2 39.6,85 41.8,86" stroke="#3a2012" stroke-width=".6" fill="none" opacity=".7" stroke-linecap="round"/>`,
  },

  'br:sommelier': {
    fond: ['#eb9a60', '#9a4420', '#381405'],
    defs: u =>
      lin(u + 'p', '#f7d5bc', '#e3ab8c') +
      lin(u + 'k', '#ffffff', '#dde2ea') +
      lin(u + 'n', '#2a2427', '#121012') +
      lin(u + 'h', '#4a2e1e', '#24150d') +
      lin(u + 'v', '#b3163a', '#5c0718') +
      rad(u + 'a', '#ffffff', '#8c95a6'),
    decor: () => VAPEUR + etoile(82, 36, 2.4, '#ffe2a8', 0.7) + points(ETINCELLES, '#ffe2a8'),
    corps: u => `
      <path d="M22,100 C24,86 36,78 50,78 C64,78 76,86 78,100 Z" fill="url(#${u}k)"/>
      <path d="M38,85 C44,84 56,84 62,85 L64,100 L36,100 Z" fill="url(#${u}n)"/>
      <path d="M38.8,85 L44,79.5 M61.2,85 L56,79.5" stroke="#1a1618" stroke-width="1.8"/>
      <path d="M45.5,68 L45.5,79 C47.5,80.5 52.5,80.5 54.5,79 L54.5,68 Z" fill="#dca283"/>
      <path d="M43.5,80 C42,86 45,89 50,89.5 C55,89 58,86 56.5,80" stroke="#c9ced8" stroke-width=".9" fill="none"/>
      <path d="M44.5,77.5 L50,81.5 L47,84 L42.5,79.5 Z" fill="#fff" stroke="#cfd5e0" stroke-width=".5"/>
      ${miroir('<path d="M44.5,77.5 L50,81.5 L47,84 L42.5,79.5 Z" fill="#fff" stroke="#cfd5e0" stroke-width=".5"/>')}
      <path d="M50,80.5 L44.5,77.8 L44.5,83.2 Z M50,80.5 L55.5,77.8 L55.5,83.2 Z" fill="#8a1d34"/>
      <rect x="48.6" y="79.1" width="2.8" height="2.8" rx=".8" fill="#6a1226"/>
      <circle cx="50" cy="90" r="4.3" fill="url(#${u}a)"/>
      <circle cx="50" cy="90" r="2.8" fill="none" stroke="#9aa3b3" stroke-width=".6"/>
      <path d="M54,88 C56.5,87.5 57.5,89.5 55.6,90.6" stroke="#c9ced8" stroke-width="1" fill="none"/>
      <ellipse cx="35.6" cy="52" rx="2.4" ry="3.6" fill="#e8b092"/><ellipse cx="64.4" cy="52" rx="2.4" ry="3.6" fill="#e8b092"/>
      <path d="M36,50 C36,41 42,37 50,37 C58,37 64,41 64,50 C64,61 58,69.5 50,71.5 C42,69.5 36,61 36,50 Z" fill="url(#${u}p)"/>
      <path d="M35,49 C33.5,38 40,31 50,31 C60,31 66.5,38 65,49 C64,45 63,42.5 61,41 C57,39.5 50,40 45.5,37.5 C43,40 39.5,42 37,44.5 C36,46 35.5,47.5 35,49 Z" fill="url(#${u}h)"/>
      <path d="M47,33.5 C51,33 56.5,34 60,36.5" stroke="#8a5a3a" stroke-width="1" fill="none" opacity=".7" stroke-linecap="round"/>
      <path d="M40.2,45.8 C41.8,44.6 44.2,44.5 45.8,45.4 M54.2,44.4 C55.8,43.2 58.2,43.2 59.8,44.6" stroke="#3a2418" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="43" cy="50.3" rx="2" ry="2.4" fill="#2a1a10"/><ellipse cx="57" cy="50.3" rx="2" ry="2.4" fill="#2a1a10"/>
      ${reflet(42.3, 49.5, 0.8)}${reflet(56.3, 49.5, 0.8)}
      <path d="M50.3,51.5 C49.4,55 49.2,56.4 50.6,57.2" stroke="#b87a5a" stroke-width="1" fill="none" stroke-linecap="round"/>
      <circle cx="39.5" cy="58" r="3.2" fill="#ff8a7a" opacity=".35"/><circle cx="60.5" cy="58" r="3.2" fill="#ff8a7a" opacity=".35"/>
      <path d="M50,59.2 C47,57.8 43.5,58.2 41.5,60.3 C44,59.6 47,60.2 50,60.6 C53,60.2 56,59.6 58.5,60.3 C56.5,58.2 53,57.8 50,59.2 Z" fill="#3a2418"/>
      <path d="M46.5,63.4 C48.4,65 51.6,65 53.5,63.4" stroke="#9a4a3a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M66.5,55 C66.5,62.5 69.5,67 73.5,67 C77.5,67 80.5,62.5 80.5,55 Z" fill="#fff" opacity=".28" stroke="#fff" stroke-width=".8" stroke-opacity=".8"/>
      <path d="M66.8,59.5 C67.4,64.2 70,67 73.5,67 C77,67 79.6,64.2 80.2,59.5 Z" fill="url(#${u}v)"/>
      <path d="M68.5,57 C68.5,60 69.5,62.5 71,64" stroke="#fff" stroke-width=".9" fill="none" opacity=".75" stroke-linecap="round"/>
      <path d="M73.5,67 L73.5,80" stroke="#fff" stroke-width="1.3" opacity=".85"/>
      <ellipse cx="73.5" cy="80.4" rx="3.8" ry="1" fill="#fff" opacity=".85"/>
      <path d="M75,77.5 C79,79.5 83,85 85,92 L77,97 C75,90 73,85 71.5,81 Z" fill="url(#${u}k)"/>
      <ellipse cx="74.8" cy="74.6" rx="3.7" ry="3.3" fill="url(#${u}p)"/>
      <path d="M71.6,73.4 C73.4,72.8 75.6,72.8 77.8,73.6 M71.4,75.8 C73.4,75.2 75.6,75.2 77.9,76" stroke="#c98a6a" stroke-width=".7" fill="none" stroke-linecap="round"/>`,
  },

  'br:chef': {
    fond: ['#f2a064', '#a24a22', '#3d1608'],
    defs: u => lin(u + 'k', '#ffffff', '#dde2ea') + lin(u + 'p', '#f8d0ad', '#e8a881'),
    decor: () => VAPEUR,
    corps: u => `
      <path d="M22,100 C24,86 36,78 50,78 C64,78 76,86 78,100 Z" fill="url(#${u}k)"/>
      <path d="M50,80 L50,100" stroke="#cfd5e0" stroke-width=".8"/>
      ${[[43.5, 89], [43.5, 96], [56.5, 89], [56.5, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#c2c8d4"/>`).join('')}
      <path d="M41.5,75.5 C46,80 54,80 58.5,75.5 L55.5,84.5 L50,82 L44.5,84.5 Z" fill="#d6333f"/>
      <path d="M34,50 C34,42 41,39.5 50,39.5 C59,39.5 66,42 66,50 C66,62 59,70 50,72.5 C41,70 34,62 34,50 Z" fill="url(#${u}p)"/>
      <path d="M29.5,40.5 C25.5,30 29.5,17.5 40,17.5 C42,9 58,9 60,17.5 C70.5,17.5 74.5,30 70.5,40.5 Z" fill="url(#${u}k)"/>
      <g stroke="#cfd5e0" stroke-width=".9" fill="none" stroke-linecap="round">
        <path d="M38.5,22 C37.5,27 37.8,32 38.5,37"/><path d="M44.5,16 C43.8,24 44,31 44.5,37"/><path d="M50,13.5 C50,22 50,30 50,37"/><path d="M55.5,16 C56.2,24 56,31 55.5,37"/><path d="M61.5,22 C62.5,27 62.2,32 61.5,37"/>
      </g>
      <rect x="31" y="35.5" width="38" height="8" rx="2.5" fill="#f4f6fa" stroke="#dde2ea" stroke-width=".7"/>
      <circle cx="39" cy="58" r="3.6" fill="#ff8a7a" opacity=".4"/><circle cx="61" cy="58" r="3.6" fill="#ff8a7a" opacity=".4"/>
      <path d="M40,51.4 C41.5,48.8 44.5,48.8 46,51.4 M54,51.4 C55.5,48.8 58.5,48.8 60,51.4" stroke="#3a2418" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="56" r="2.9" fill="#e89a78"/>
      <path d="M50,60 C46,57 40,57 36,60 C34,61.5 32,60 32,58 C31,62 34,65.5 38.2,64.4 C43,63.2 47,62 50,62 C53,62 57,63.2 61.8,64.4 C66,65.5 69,62 68,58 C68,60 66,61.5 64,60 C60,57 54,57 50,60 Z" fill="#5a3320"/>
      <path d="M46,66 C48,67.6 52,67.6 54,66" stroke="#8a3a2a" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { brigade: DESSINS } })
