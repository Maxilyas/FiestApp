// Le stade · Sport — de la nageuse à la danseuse étoile.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { etoile, lin, miroir, points, rad, reflet, type DessinDePortrait } from './outils'

/** Les étoiles de la danseuse de la maquette, que la nageuse reprend aux mêmes places. */
const ETOILES: [number, number][] = [
  [18, 30],
  [82, 26],
  [14, 58],
  [86, 62],
  [26, 14],
]
const etoiles = () => ETOILES.map(([x, y]) => etoile(x, y, 2, '#fff', 0.7)).join('')

/** À une décimale : calculé, 18 + 0,6 s'écrirait parfois 18.599999999999998 dans la chaîne. */
const f = (n: number) => +n.toFixed(1)

/** Un projecteur de stade : un panneau sombre, six lampes, et le cône qu'il jette. */
const projecteur = (x: number, y: number) =>
  `<path d="M${x + 1},${y + 6} L${x - 9},${y + 48} L${x + 20},${y + 48} L${x + 10},${y + 6} Z" fill="#fff" opacity=".05"/>` +
  `<rect x="${x}" y="${y}" width="11" height="6.5" rx="1.2" fill="#2a0c20" opacity=".45"/>` +
  points(
    [1.9, 4.6].flatMap(dy => [2.2, 5.5, 8.8].map((dx): [number, number, number] => [f(x + dx), f(y + dy), 1])),
    '#fff6d8',
    0.9,
  )

/** Des confettis : place, couleur, angle. */
const confettis = (liste: [number, number, string, number][]) =>
  liste
    .map(([x, y, c, r]) => `<rect x="${x}" y="${y}" width="3.2" height="1.6" rx=".4" fill="${c}" opacity=".85" transform="rotate(${r} ${x} ${y})"/>`)
    .join('')

/** Un flocon à six branches, d'un seul trait. */
const flocon = (x: number, y: number, r: number, op = 0.75) => {
  const a = r * 0.87
  const b = r / 2
  return `<path d="M${x},${f(y - r)}V${f(y + r)}M${f(x - a)},${f(y - b)}L${f(x + a)},${f(y + b)}M${f(x - a)},${f(y + b)}L${f(x + a)},${f(y - b)}" stroke="#fff" stroke-width=".7" stroke-linecap="round" opacity="${op}"/>`
}

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:nageuse': {
    fond: ['#f5a8b6', '#a3405e', '#351028'],
    defs: u =>
      lin(u + 'p', '#9a643f', '#6b4024') +
      rad(u + 'k', '#6cbcff', '#1f5bc4') +
      lin(u + 'l', '#ffe07a', '#ff5f8f', 1, 1) +
      // En unités de la page : l'eau de derrière et celle de devant se raccordent sans couture.
      `<linearGradient id="${u}o" gradientUnits="userSpaceOnUse" x1="0" y1="76" x2="0" y2="100"><stop offset="0" stop-color="#8ae4f7"/><stop offset="1" stop-color="#1f72c0"/></linearGradient>`,
    decor: u =>
      etoiles() +
      points([[72, 12, 0.6], [88, 38, 0.6]], '#fff', 0.7) +
      `<path d="M27.5,40 C28.1,41.4 29.1,42.4 29.1,43.4 C29.1,44.4 28.4,45 27.5,45 C26.6,45 25.9,44.4 25.9,43.4 C25.9,42.4 26.9,41.4 27.5,40 Z M73,36 C73.5,37.2 74.4,38 74.4,38.9 C74.4,39.8 73.8,40.3 73,40.3 C72.2,40.3 71.6,39.8 71.6,38.9 C71.6,38 72.5,37.2 73,36 Z" fill="#c8f4ff" opacity=".85"/>` +
      // Le bassin derrière elle, et sa ligne d'eau : on sait où l'on est sans voir le plongeoir.
      `<rect x="0" y="76" width="100" height="24" fill="url(#${u}o)"/>
      <path d="M1.1,78 H100" stroke="#fff" stroke-width="2.2" stroke-dasharray="0 4.4" stroke-linecap="round"/>
      <path d="M3.3,78 H100" stroke="#ff5a6e" stroke-width="2.2" stroke-dasharray="0 4.4" stroke-linecap="round"/>`,
    // L'eau de devant est au corps, pas au décor : verrouillée, la silhouette sort encore de l'eau.
    corps: u => `
      <path d="M22,100 C24,87 35.5,79.5 50,79.5 C64.5,79.5 76,87 78,100 Z" fill="url(#${u}p)"/>
      <path d="M38.2,81 L41,80.4 L43.5,90 L40.5,90 Z M61.8,81 L59,80.4 L56.5,90 L59.5,90 Z" fill="#23306e"/>
      <path d="M45,69 L45,80 L55,80 L55,69 Z" fill="#6b4024"/>
      <path d="M36,47 C36,39.5 42,35 50,35 C58,35 64,39.5 64,47 C64,59 58,68.5 50,71 C42,68.5 36,59 36,47 Z" fill="url(#${u}p)"/>
      <path d="M33.5,50 C32,33.5 40,24.5 50,24.5 C60,24.5 68,33.5 66.5,50 C64,43 58,40 50,40 C42,40 36,43 33.5,50 Z" fill="url(#${u}k)"/>
      <ellipse cx="42" cy="29.5" rx="5" ry="2.4" fill="#fff" opacity=".35" transform="rotate(-20 42 29.5)"/>
      <path d="M33.8,41 C40,35.5 60,35.5 66.2,41" stroke="#1b2a4a" stroke-width="1.8" fill="none"/>
      <ellipse cx="43.5" cy="36.2" rx="4.4" ry="3.1" fill="url(#${u}l)" stroke="#1b2a4a" stroke-width="1.1"/>
      <ellipse cx="56.5" cy="36.2" rx="4.4" ry="3.1" fill="url(#${u}l)" stroke="#1b2a4a" stroke-width="1.1"/>
      <path d="M47.9,36.2 C49,35.2 51,35.2 52.1,36.2" stroke="#1b2a4a" stroke-width="1.1" fill="none"/>
      <ellipse cx="42.2" cy="35.2" rx="1.6" ry=".8" fill="#fff" opacity=".7"/><ellipse cx="55.2" cy="35.2" rx="1.6" ry=".8" fill="#fff" opacity=".7"/>
      <path d="M40.6,46.2 C42,44.9 45,44.8 46.5,45.8 M53.5,45.8 C55,44.8 58,44.9 59.4,46.2" stroke="#2a160c" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <ellipse cx="43.5" cy="50.5" rx="2.2" ry="2.6" fill="#1a0f0a"/><ellipse cx="56.5" cy="50.5" rx="2.2" ry="2.6" fill="#1a0f0a"/>
      ${reflet(42.7, 49.6, 0.85)}${reflet(55.7, 49.6, 0.85)}
      <ellipse cx="40" cy="57" rx="3.2" ry="1.9" fill="#ff7a8a" opacity=".35"/><ellipse cx="60" cy="57" rx="3.2" ry="1.9" fill="#ff7a8a" opacity=".35"/>
      <path d="M50.3,52 C49.4,55.3 49.3,56.6 50.7,57.3" stroke="#4e2c18" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M44.8,60.8 C47,65.4 53,65.4 55.2,60.8 C52,61.9 48,61.9 44.8,60.8 Z" fill="#fff" stroke="#5a1e1a" stroke-width=".5"/>
      <path d="M0,84.5 C4,81 9,80 13.5,82.5 C17.5,85 21,87.5 26,88 C34,88.8 40,87 50,88.5 C60,87 66,88.8 74,88 C79,87.5 82.5,85 86.5,82.5 C91,80 96,81 100,84.5 L100,100 L0,100 Z" fill="url(#${u}o)"/>
      <path d="M0,84.5 C4,81 9,80 13.5,82.5 C17.5,85 21,87.5 26,88 C34,88.8 40,87 50,88.5 C60,87 66,88.8 74,88 C79,87.5 82.5,85 86.5,82.5 C91,80 96,81 100,84.5" stroke="#e2fbff" stroke-width="1" fill="none"/>
      <path d="M26,92.5 C30,91.3 34,93.2 38,92 M60,94 C64,92.8 68,94.7 72,93.5 M42,97 C46,95.8 50,97.7 54,96.5" stroke="#fff" stroke-width=".9" fill="none" opacity=".55" stroke-linecap="round"/>`,
  },

  'br:cycliste': {
    fond: ['#f6b0a0', '#ad4550', '#39121c'],
    defs: u =>
      lin(u + 'p', '#fbd9c2', '#eab08e') +
      lin(u + 'k', '#46dcc8', '#11857c', 1, 1) +
      lin(u + 'j', '#ffe45e', '#f0a818') +
      lin(u + 'l', '#3b2f7a', '#ff7a5a', 1, 1),
    decor: () =>
      confettis([
        [16, 30, '#ffe36b', 20],
        [83, 24, '#5fe0d0', -30],
        [12, 60, '#fff', 40],
        [87, 64, '#ffe36b', -10],
        [27, 13, '#5fe0d0', 10],
        [72, 11, '#fff', -25],
        [88, 44, '#6ab8ff', 30],
        [14, 44, '#6ab8ff', -20],
      ]) + points([[22, 22, 0.7], [80, 36, 0.6], [18, 72, 0.6]], '#fff', 0.7),
    // Un casque à encoches, ses aérations au bout : lisse, verrouillé, ce n'était qu'une tête ronde.
    corps: u => `
      <path d="M22,100 C24,86 36,78.5 50,78.5 C64,78.5 76,86 78,100 Z" fill="url(#${u}j)"/>
      <path d="M22,100 C23,93 25.5,88 29,84.5 C31,90 32,95 32,100 Z M78,100 C77,93 74.5,88 71,84.5 C69,90 68,95 68,100 Z" fill="#2a2a3a"/>
      <path d="M45,69 L45,80 L55,80 L55,69 Z" fill="#eab08e"/>
      <path d="M43,78.6 L50,84 L57,78.6 L55.5,78 L50,82 L44.5,78 Z" fill="#c98410"/>
      <path d="M50,84 L50,100" stroke="#b87a0e" stroke-width=".8"/><rect x="49" y="85.5" width="2" height="3" rx=".5" fill="#6b4a10"/>
      <ellipse cx="36.2" cy="51.5" rx="2.3" ry="3.4" fill="#eab08e"/><ellipse cx="63.8" cy="51.5" rx="2.3" ry="3.4" fill="#eab08e"/>
      <path d="M36,47 C36,39.5 42,35 50,35 C58,35 64,39.5 64,47 C64,59 58,68.5 50,71 C42,68.5 36,59 36,47 Z" fill="url(#${u}p)"/>
      <path d="M35.6,45 C36.8,54 40,62.5 45.5,68.6 M64.4,45 C63.2,54 60,62.5 54.5,68.6" stroke="#1f2433" stroke-width=".9" fill="none"/>
      <path d="M31,46.5 C29.8,41 30,36 32,31.5 C33,29.5 34.5,28.5 36.2,28.8 L37.8,30.2 C39,26 41.5,22.8 44.5,21.5 L46,23.2 C47,20.5 48.5,19.2 50,19 C51.5,19.2 53,20.5 54,23.2 L55.5,21.5 C58.5,22.8 61,26 62.2,30.2 L63.8,28.8 C65.5,28.5 67,29.5 68,31.5 C70,36 70.2,41 69,46.5 C66,42 60,39.5 50,39.5 C40,39.5 34,42 31,46.5 Z" fill="url(#${u}k)"/>
      <path d="M37.8,30.2 C38,33 38.3,35.5 38.8,38 M46,23.2 C46,28 46.3,32.5 46.8,37 M54,23.2 C54,28 53.7,32.5 53.2,37 M62.2,30.2 C62,33 61.7,35.5 61.2,38" stroke="#0f3e3a" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M31,46.5 C34,42 40,39.5 50,39.5 C60,39.5 66,42 69,46.5" stroke="#0e3431" stroke-width="1.4" fill="none"/>
      <ellipse cx="41.5" cy="27.5" rx="1.4" ry="3.4" fill="#fff" opacity=".45" transform="rotate(30 41.5 27.5)"/><ellipse cx="50" cy="25" rx="1.3" ry="2.6" fill="#fff" opacity=".35"/>
      <path d="M34.5,48 C35.5,45 42,44.5 50,45.5 C58,44.5 64.5,45 65.5,48 C65.8,52.5 62.5,55.5 57.5,55.5 C54,55.5 52.3,52.8 50,52.8 C47.7,52.8 46,55.5 42.5,55.5 C37.5,55.5 34.2,52.5 34.5,48 Z" fill="url(#${u}l)" stroke="#1a1a2a" stroke-width="1"/>
      <path d="M37.5,48.5 C39.5,47 42.5,46.7 45,47.2 M55,47.4 C56.5,47 58,47 59.5,47.4" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".8"/>
      <ellipse cx="39.5" cy="59" rx="3.2" ry="1.9" fill="#ff8a8a" opacity=".45"/><ellipse cx="60.5" cy="59" rx="3.2" ry="1.9" fill="#ff8a8a" opacity=".45"/>
      <path d="M50.3,53.5 C49.5,56 49.5,57 50.7,57.6" stroke="#c98c70" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M44.5,60.5 C46.8,65.5 53.2,65.5 55.5,60.5 C52,61.6 48,61.6 44.5,60.5 Z" fill="#fff" stroke="#8a3a2a" stroke-width=".5"/>`,
  },

  'br:surfeur': {
    fond: ['#f8b89c', '#b84c5a', '#3d1224'],
    defs: u =>
      lin(u + 'p', '#dca06a', '#a86a3c') +
      lin(u + 'h', '#fff2b0', '#e2b04c') +
      lin(u + 'b', '#8af2e2', '#1e98a0', 1, 0) +
      lin(u + 'o', '#7fe6ee', '#2a8fc0'),
    decor: u =>
      `<circle cx="23" cy="25" r="8" fill="#ffe7a0" opacity=".8"/>` +
      points([[80, 40, 0.7], [88, 56, 0.6], [14, 46, 0.6], [34, 12, 0.5]], '#fff', 0.7) +
      // La vague qui s'enroule derrière son épaule : la planche dit le sport, la vague dit la mer.
      `<path d="M-2,70 C6,58 18,52 29,55 C35,56.5 38,61 36,65 C34,61 29.5,59.5 26,61.5 C22,64 23,70 28,71.5 C24,74 20,80 20,88 L20,100 L-2,100 Z" fill="url(#${u}o)" opacity=".9"/>
      <path d="M36,65 C34,61 29.5,59.5 26,61.5 C22,64 23,70 28,71.5 C31,72.5 34.5,70 36,65 Z" fill="#2b78b4" opacity=".85"/>
      <path d="M35.2,63.6 C33,61.2 29.8,60.6 27.2,62" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M8,60.5 C15,55.5 24,54 30,56.5 C34.5,58.5 36.5,62 36,65" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".9"/>`,
    corps: u => `
      <g transform="rotate(7 70 60)">
        <path d="M70,11 C77.5,15 80,34 80,56 L80,100 L60,100 L60,56 C60,34 62.5,15 70,11 Z" fill="url(#${u}b)"/>
        <path d="M70,12 L70,100" stroke="#fff" stroke-width="1.2" opacity=".85"/>
        <path d="M60.5,30 C66,28 74,28 79.5,30 L79.8,34.5 C74,32.5 66,32.5 60.2,34.5 Z" fill="#ffd54a"/>
      </g>
      <path d="M23,100 C25,87 36,79.5 50,79.5 C64,79.5 75,87 77,100 Z" fill="url(#${u}p)"/>
      <path d="M33.5,100 C34,93 35,88 37,82 L41.5,80.5 C43.5,85.5 46.5,87.5 50,87.5 C53.5,87.5 56.5,85.5 58.5,80.5 L63,82 C65,88 66,93 66.5,100 Z" fill="#f4f7fb"/>
      <path d="M45,69 L45,80 L55,80 L55,69 Z" fill="#a86a3c"/>
      <path d="M42.5,81.5 C45,85.5 55,85.5 57.5,81.5" stroke="#6b4a2c" stroke-width=".6" fill="none"/>
      <g fill="#fff8e8"><circle cx="44" cy="83.3" r=".9"/><circle cx="47" cy="84.6" r=".9"/><circle cx="50" cy="85" r=".9"/><circle cx="53" cy="84.6" r=".9"/><circle cx="56" cy="83.3" r=".9"/></g>
      <ellipse cx="36.2" cy="51.5" rx="2.3" ry="3.4" fill="#a86a3c"/><ellipse cx="63.8" cy="51.5" rx="2.3" ry="3.4" fill="#a86a3c"/>
      <path d="M36,47 C36,39.5 42,35 50,35 C58,35 64,39.5 64,47 C64,59 58,68.5 50,71 C42,68.5 36,59 36,47 Z" fill="url(#${u}p)"/>
      <path d="M34,49 C31,37 36,26.5 46,25 C49,21.5 56,22 58.5,25.5 C66,26.5 70,34 67.5,44 C67,46.5 66,48.5 65,50 C64.5,44.5 62,40.5 58,38.5 L56.5,42 L53.5,37.5 L50,41.5 L47.5,37 L43.5,41 L42,38 C38,40 35.5,44 35,49 Z" fill="url(#${u}h)"/>
      <path d="M46,25 C44,29 43.5,33 44,37 M55,24.5 C57,28 58,31.5 58,35" stroke="#c8903a" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <path d="M40.6,46 C42,44.8 45,44.7 46.5,45.6 M53.5,45.6 C55,44.7 58,44.8 59.4,46" stroke="#c8903a" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="43.5" cy="50.5" rx="2.2" ry="2.6" fill="#1a0f0a"/><ellipse cx="56.5" cy="50.5" rx="2.2" ry="2.6" fill="#1a0f0a"/>
      ${reflet(42.7, 49.6, 0.85)}${reflet(55.7, 49.6, 0.85)}
      <ellipse cx="50" cy="55" rx="10" ry="2.2" fill="#ff7a60" opacity=".3"/>
      <path d="M50.3,52 C49.4,55.3 49.3,56.6 50.7,57.3" stroke="#7a4424" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M44,60.5 C46.5,66 53.5,66 56,60.5 C52.2,61.7 47.8,61.7 44,60.5 Z" fill="#fff" stroke="#6a2a1a" stroke-width=".5"/>`,
  },

  'br:skieuse': {
    fond: ['#efaac8', '#963c70', '#300f2e'],
    defs: u =>
      lin(u + 'p', '#f6d4b6', '#e3ab86') +
      lin(u + 'k', '#3d4fa8', '#1d2766') +
      rad(u + 'q', '#ffffff', '#d2d9ee') +
      lin(u + 'm', '#ffd65a', '#ff5f3d', 1, 1) +
      lin(u + 'v', '#4fd8e2', '#1b86a6'),
    decor: () => {
      const mont = '<path d="M-2,88 L9,73 L14,78 L24,64 L35,82 L35,100 L-2,100 Z" fill="#fff" opacity=".2"/>'
      return mont + miroir(mont) + flocon(18, 34, 3) + flocon(84, 30, 2.6) + flocon(12, 58, 2, 0.6) + flocon(88, 56, 2.2, 0.6) + flocon(29, 13, 1.8, 0.6)
    },
    // Un verre teinté plutôt qu'un miroir : les yeux restent vivants derrière le masque.
    corps: u => `
      <path d="M22,100 C24,86 36,78 50,78 C64,78 76,86 78,100 Z" fill="url(#${u}v)"/>
      <path d="M45,67 L45,78 L55,78 L55,67 Z" fill="#e3ab86"/>
      <path d="M37,87 C36.5,80.5 40.5,75.5 50,75.5 C59.5,75.5 63.5,80.5 63,87 C58.5,84.5 41.5,84.5 37,87 Z" fill="#7fe6ee"/>
      <path d="M50,85 L50,100" stroke="#1b6a80" stroke-width=".8"/><rect x="49" y="86.5" width="2" height="3" rx=".5" fill="#12505e"/>
      <path d="M36,47 C36,39.5 42,35 50,35 C58,35 64,39.5 64,47 C64,59 58,68.5 50,71 C42,68.5 36,59 36,47 Z" fill="url(#${u}p)"/>
      <path d="M33,47 C31.5,32 39.5,23 50,23 C60.5,23 68.5,32 67,47 Z" fill="url(#${u}k)"/>
      <path d="M36,34 L39.5,31 L43,34 L46.5,31 L50,34 L53.5,31 L57,34 L60.5,31 L64,34" stroke="#fff" stroke-width="1.3" fill="none" stroke-linejoin="round"/>
      <path d="M32.5,47.5 C32.5,42 40,39.5 50,39.5 C60,39.5 67.5,42 67.5,47.5 C60,45.5 40,45.5 32.5,47.5 Z" fill="#4a5cb8"/>
      <path d="M50,11 Q52.7,9.3 53.8,12.2 Q56.9,12.5 56.2,15.5 Q58.6,17.5 56.2,19.5 Q56.9,22.5 53.8,22.8 Q52.7,25.7 50,24 Q47.3,25.7 46.2,22.8 Q43.1,22.5 43.8,19.5 Q41.4,17.5 43.8,15.5 Q43.1,12.5 46.2,12.2 Q47.3,9.3 50,11 Z" fill="url(#${u}q)"/>
      <path d="M29,49 L32.5,49.5 M71,49 L67.5,49.5" stroke="#ff6a3d" stroke-width="3.2"/>
      <ellipse cx="43.5" cy="50" rx="2.1" ry="2.5" fill="#1a0f0a"/><ellipse cx="56.5" cy="50" rx="2.1" ry="2.5" fill="#1a0f0a"/>
      <path d="M32.5,49.5 C32.5,45 36,43.5 41,43.5 L59,43.5 C64,43.5 67.5,45 67.5,49.5 C67.5,54 64.5,56.5 60,56.5 C56,56.5 54,54 50,54 C46,54 44,56.5 40,56.5 C35.5,56.5 32.5,54 32.5,49.5 Z" fill="url(#${u}m)" fill-opacity=".62" stroke="#f6f8fc" stroke-width="2.2"/>
      ${reflet(42.7, 49.2, 0.85)}${reflet(55.7, 49.2, 0.85)}
      <path d="M36,47.5 C38,46 41,45.6 43.5,45.8" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round" opacity=".75"/>
      <ellipse cx="40" cy="60" rx="3.6" ry="2.2" fill="#ff6f8a" opacity=".5"/><ellipse cx="60" cy="60" rx="3.6" ry="2.2" fill="#ff6f8a" opacity=".5"/>
      <path d="M50.3,55.5 C49.6,57.4 49.6,58.2 50.6,58.7" stroke="#c98c70" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M46,62 C48,65.2 52,65.2 54,62 C51.8,62.8 48.2,62.8 46,62 Z" fill="#b8384e"/>`,
  },

  'br:boxeur': {
    fond: ['#f4a4ba', '#a33c62', '#380f28'],
    defs: u => lin(u + 'p', '#7c4a2e', '#52301b') + rad(u + 'g', '#ff7262', '#b3141c'),
    decor: () =>
      projecteur(13, 18) +
      projecteur(76, 18) +
      `<path d="M0,58 H100 M0,66.5 H100 M0,75 H100" stroke="#fff" stroke-width="1.5" opacity=".3"/>`,
    corps: u => `
      <path d="M16,100 C18,86 31,78 50,78 C69,78 82,86 84,100 Z" fill="url(#${u}p)"/>
      <path d="M44,70 L44,80 L56,80 L56,70 Z" fill="#52301b"/>
      <ellipse cx="35.8" cy="51" rx="2.4" ry="3.5" fill="#6a3d24"/><ellipse cx="64.2" cy="51" rx="2.4" ry="3.5" fill="#6a3d24"/>
      <path d="M35.5,46 C35.5,38 41.5,33.5 50,33.5 C58.5,33.5 64.5,38 64.5,46 C64.5,57 60.5,66.5 55,69.5 C52.5,71 47.5,71 45,69.5 C39.5,66.5 35.5,57 35.5,46 Z" fill="url(#${u}p)"/>
      <path d="M35.5,45.5 C34.5,37 41,31.5 50,31.5 C59,31.5 65.5,37 64.5,45.5 C62,40.5 57,38.5 50,38.5 C43,38.5 38,40.5 35.5,45.5 Z" fill="#1a0f0a"/>
      <path d="M64.8,42 C69.5,40 73.5,37 77,32.5 C76.5,37.5 73.5,41.5 69,44 Z M64.8,44.5 C69.5,45.5 74,45 78,42.5 C75.5,46.5 70.5,48.5 65.5,47.5 Z" fill="#f2f4f8"/>
      <path d="M34.8,41 C40,37 60,37 65.2,41 L65.4,45.6 C60,42.2 40,42.2 34.6,45.6 Z" fill="#fff"/>
      <path d="M34.8,43.3 C40,39.6 60,39.6 65.2,43.3" stroke="#e0303a" stroke-width="1.2" fill="none"/>
      <path d="M39.8,47.8 C41.5,46.3 44.8,46.1 46.8,47.4 M53.2,47.4 C55.2,46.1 58.5,46.3 60.2,47.8" stroke="#140a06" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <path d="M40,51 C41.2,48.8 45.4,48.8 46.6,51 C45.4,53 41.2,53 40,51 Z M53.4,51 C54.6,48.8 58.8,48.8 60,51 C58.8,53 54.6,53 53.4,51 Z" fill="#fff"/>
      <circle cx="43.4" cy="51" r="1.6" fill="#140a06"/><circle cx="56.6" cy="51" r="1.6" fill="#140a06"/>
      ${reflet(42.8, 50.4, 0.55)}${reflet(56, 50.4, 0.55)}
      <ellipse cx="40.2" cy="57" rx="3" ry="1.8" fill="#ff6a7a" opacity=".3"/><ellipse cx="59.8" cy="57" rx="3" ry="1.8" fill="#ff6a7a" opacity=".3"/>
      <path d="M47.5,57 C48.2,58.4 49,58.8 50,58.8 C51,58.8 51.8,58.4 52.5,57" stroke="#2e1a0e" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M45,61.5 C47.5,65.5 52.5,65.5 55,61.5 C52,62.5 48,62.5 45,61.5 Z" fill="#fff" stroke="#2e1a0e" stroke-width=".5"/>
      <path d="M21,80 C18.5,72 19.5,63.5 26.5,61.5 C32.5,60 38.5,62.5 39.5,69 C40.5,75 39.5,81 36.5,84 C32.5,87.5 23,87 21,80 Z" fill="url(#${u}g)"/>
      <path d="M37.5,71 C41.5,70.5 43,73.5 41.5,77 C40.5,79.5 37.5,80 36.5,78 Z" fill="#d42a2e"/>
      <path d="M22,72 C26,70.5 31.5,70.5 36,72.5" stroke="#8a0e14" stroke-width=".9" fill="none" opacity=".5"/>
      <ellipse cx="26" cy="66.5" rx="3.5" ry="2" fill="#fff" opacity=".45" transform="rotate(-25 26 66.5)"/>
      <path d="M22.5,84 C27,88 33.5,88 37,84.5 L38.5,100 L21,100 Z" fill="#f4f5f8"/>
      <path d="M26,89 L33,93 M33,89 L26,93 M26,94.5 L33,98.5 M33,94.5 L26,98.5" stroke="#d42a2e" stroke-width=".8"/>
      ${miroir(`<path d="M21,80 C18.5,72 19.5,63.5 26.5,61.5 C32.5,60 38.5,62.5 39.5,69 C40.5,75 39.5,81 36.5,84 C32.5,87.5 23,87 21,80 Z" fill="url(#${u}g)"/><path d="M37.5,71 C41.5,70.5 43,73.5 41.5,77 C40.5,79.5 37.5,80 36.5,78 Z" fill="#d42a2e"/><path d="M22,72 C26,70.5 31.5,70.5 36,72.5" stroke="#8a0e14" stroke-width=".9" fill="none" opacity=".5"/><path d="M22.5,84 C27,88 33.5,88 37,84.5 L38.5,100 L21,100 Z" fill="#f4f5f8"/><path d="M26,89 L33,93 M33,89 L26,93 M26,94.5 L33,98.5 M33,94.5 L26,98.5" stroke="#d42a2e" stroke-width=".8"/>`)}
      <ellipse cx="68" cy="65.5" rx="2.5" ry="1.4" fill="#fff" opacity=".35" transform="rotate(20 68 65.5)"/>`,
  },

  // Convertie de la maquette approuvée, telle quelle : le rayon et les étoiles passent au décor.
  'br:danseuse': {
    fond: ['#f2a6b8', '#9a3d62', '#33102a'],
    defs: u => lin(u + 'p', '#f8dac8', '#e8b29a') + lin(u + 'h', '#6e3526', '#431c12'),
    decor: () => `<path d="M40,0 L60,0 L78,100 L22,100 Z" fill="#fff" opacity=".07"/>` + etoiles(),
    corps: u => `
      <path d="M26,100 C28,87 38,79 50,79 C62,79 72,87 74,100 Z" fill="#f4b3c6"/>
      <g fill="#fce4ec" opacity=".92">
        <ellipse cx="30" cy="96" rx="9" ry="5"/><ellipse cx="42" cy="98" rx="9" ry="5"/><ellipse cx="58" cy="98" rx="9" ry="5"/><ellipse cx="70" cy="96" rx="9" ry="5"/><ellipse cx="50" cy="95" rx="9" ry="4.5"/>
      </g>
      <path d="M36.5,84 C42,88 58,88 63.5,84" stroke="#fff" stroke-width="1" fill="none" opacity=".7"/>
      <path d="M45,61 L45,74 C45,77 55,77 55,74 L55,61 Z" fill="#e8b29a"/>
      <circle cx="50" cy="19.5" r="8.5" fill="url(#${u}h)"/>
      <path d="M44,17 C46,14.5 50,13.8 53,15" stroke="#8a4a36" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M34,41 C34,29 41,25 50,25 C59,25 66,29 66,41 C66,45 64.5,47 62.5,47 C60.5,37 56,32.5 50,32.5 C44,32.5 39.5,37 37.5,47 C35.5,47 34,45 34,41 Z" fill="url(#${u}h)"/>
      <path d="M37.5,44 C38,36.5 43,32 50,32 C57,32 62,36.5 62.5,44 C62.5,54.5 57.5,62 50,64 C42.5,62 37.5,54.5 37.5,44 Z" fill="url(#${u}p)"/>
      <path d="M38,32.5 C44,28.2 56,28.2 62,32.5" stroke="#f1d27a" stroke-width="1.3" fill="none"/>
      ${[[40, 31], [45, 29.2], [50, 28.6], [55, 29.2], [60, 31]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".9" fill="#fff8e1"/>`).join('')}
      <path d="M41.6,46.2 C43.1,48.2 46.3,48.2 47.8,46.2 M52.2,46.2 C53.7,48.2 56.9,48.2 58.4,46.2" stroke="#3a1e18" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M41.8,46.6 L40.8,47.6 M58.2,46.6 L59.2,47.6" stroke="#3a1e18" stroke-width=".8" stroke-linecap="round"/>
      <ellipse cx="42" cy="52" rx="3.2" ry="1.8" fill="#ff8fa3" opacity=".45"/><ellipse cx="58" cy="52" rx="3.2" ry="1.8" fill="#ff8fa3" opacity=".45"/>
      <path d="M50.3,48.5 C49.6,51.2 49.5,52.4 50.6,53" stroke="#c98c78" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M47.3,56.3 C48.9,55.3 51.1,55.3 52.7,56.3 C51.1,58.2 48.9,58.2 47.3,56.3 Z" fill="#d5476a"/>`,
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { stade: DESSINS } })
