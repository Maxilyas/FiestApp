// Le carnaval · Autour de la fête — de la piñata au masque de Venise.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { etoile, lin, miroir, reflet, rad, type DessinDePortrait } from './outils'

/** Les confettis du masque de Venise (la maquette), toujours aux mêmes places. */
const CONFETTIS: [number, number, string, number][] = [
  [16, 30, '#f1c653', 20],
  [84, 22, '#ff7aa8', -30],
  [12, 60, '#8fe3d8', 40],
  [88, 66, '#f1c653', -10],
  [26, 12, '#8fe3d8', 10],
  [74, 86, '#ff7aa8', 25],
  [20, 84, '#f1c653', -35],
]
/**
 * Les mêmes confettis en trois chemins, un par couleur, plutôt qu'en sept
 * rectangles tournés : le même dessin pour moitié moins de chaîne.
 */
const confettis = (liste = CONFETTIS) => {
  const parCouleur: Record<string, string> = {}
  for (const [x, y, c, r] of liste) {
    const a = (r * Math.PI) / 180
    const pt = (dx: number, dy: number) =>
      `${(x + dx * Math.cos(a) - dy * Math.sin(a)).toFixed(1)},${(y + dx * Math.sin(a) + dy * Math.cos(a)).toFixed(1)}`
    parCouleur[c] = (parCouleur[c] ?? '') + `M${pt(0, 0)} ${pt(3.2, 0)} ${pt(3.2, 1.6)} ${pt(0, 1.6)}Z`
  }
  return `<g opacity=".85">${Object.entries(parCouleur).map(([c, d]) => `<path d="${d}" fill="${c}"/>`).join('')}</g>`
}

/** Des points ronds en un seul chemin — des traits presque nuls aux bouts arrondis : paillettes, taches de rousseur. */
const grains = (liste: [number, number][], couleur: string, taille: number, op = 1) =>
  `<path d="${liste.map(([x, y]) => `M${x},${y}h.01`).join('')}" stroke="${couleur}" stroke-width="${taille}" stroke-linecap="round" opacity="${op}"/>`

/** Deux serpentins qui ondulent au bord du disque. */
const SERPENTINS =
  '<g fill="none" stroke-width="1.1" stroke-linecap="round" opacity=".7"><path d="M7,44 c2,-2.6 4,2.6 6,0 s4,2.6 6,0" stroke="#ff7aa8"/><path d="M76,77 c2,-2.6 4,2.6 6,0 s4,2.6 6,0" stroke="#f1c653"/><path d="M80,36 c1.6,-2.2 3.2,2.2 4.8,0 s3.2,2.2 4.8,0" stroke="#8fe3d8"/></g>'

/**
 * Des bandes franches, en dégradé à arrêts doublés : les franges de papier
 * de la piñata, les rayures d'un chapeau — sans motif ni découpe, que le
 * cadre n'accepte pas. Chaque couleur court jusqu'à sa limite (0 à 1).
 */
const bandes = (id: string, liste: [string, number][], x2 = 0, y2 = 1) => {
  let debut = 0
  const arrets = liste
    .map(([c, fin]) => {
      const s = `<stop offset="${debut}" stop-color="${c}"/><stop offset="${fin}" stop-color="${c}"/>`
      debut = fin
      return s
    })
    .join('')
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${arrets}</linearGradient>`
}

/** Un contour bouclé, n bosses autour d'une ellipse : l'afro de la reine du disco. */
const nuage = (cx: number, cy: number, rx: number, ry: number, n: number, bosse: number) => {
  const pt = (a: number, k: number) => `${(cx + (rx + k) * Math.cos(a)).toFixed(1)},${(cy + (ry + k) * Math.sin(a)).toFixed(1)}`
  let d = `M${pt(0, 0)}`
  for (let i = 0; i < n; i++) d += ` Q${pt(((i + 0.5) / n) * 2 * Math.PI, bosse)} ${pt(((i + 1) / n) * 2 * Math.PI, 0)}`
  return d + ' Z'
}

/**
 * Les losanges de l'arlequin, découpés d'avance au contour de ses épaules
 * (`M20,100 C22,86 35,78 50,78 C65,78 78,86 80,100 Z`) : un chemin par
 * couleur, deux voisins jamais de la même. Ceux qui tombent hors du disque
 * sont partis.
 */
const LOSANGES = [
  'M36.8,80.4 L33.5,84 L32.2,82.6 L34.4,81.3 Z M33.5,84 L39,90 L33.5,96 L28,90 Z M50,78 L55.5,84 L50,90 L44.5,84 Z M67.8,82.6 L66.5,84 L63.2,80.4 L65.6,81.3 Z M50,90 L55.5,96 L51.8,100 L48.2,100 L44.5,96 Z M66.5,84 L72,90 L66.5,96 L61,90 Z',
  'M25.8,87.6 L28,90 L22.5,96 L21.4,94.8 L23.4,90.7 Z M40.2,79.3 L44.5,84 L39,90 L33.5,84 L36.8,80.4 L39.3,79.5 Z M59.8,79.3 L55.5,84 L50,78 L55.5,78.4 Z M39,90 L44.5,96 L40.8,100 L37.2,100 L33.5,96 Z M55.5,84 L61,90 L55.5,96 L50,90 Z M74.2,87.6 L72,90 L66.5,84 L67.8,82.6 L69.9,83.7 L73.6,86.9 Z M55.5,96 L59.2,100 L51.8,100 Z M72,90 L77.5,96 L73.8,100 L70.2,100 L66.5,96 Z',
  'M32.2,82.6 L33.5,84 L28,90 L25.8,87.6 L26.4,86.9 L30.1,83.7 Z M44.5,84 L40.2,79.3 L44.5,78.4 L50,78 Z M28,90 L33.5,96 L29.8,100 L26.2,100 L22.5,96 Z M44.5,84 L50,90 L44.5,96 L39,90 Z M63.2,80.4 L66.5,84 L61,90 L55.5,84 L59.8,79.3 L60.7,79.5 Z M44.5,96 L48.2,100 L40.8,100 Z M61,90 L66.5,96 L62.8,100 L59.2,100 L55.5,96 Z M78.6,94.8 L77.5,96 L72,90 L74.2,87.6 L76.6,90.7 Z',
]

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:pinata': {
    fond: ['#3aa0a4', '#155056', '#061a1d'],
    defs: u =>
      bandes(u + 'r', [['#ff5fa2', 0.174], ['#ffd23f', 0.313], ['#a66ef0', 0.452], ['#ff8c42', 1]]) +
      bandes(u + 'o', [['#a66ef0', 0.33], ['#ff5fa2', 0.66], ['#8fd14f', 1]]) +
      bandes(u + 'b', [['#a66ef0', 0.33], ['#ff5fa2', 0.66], ['#ffd23f', 1]]) +
      lin(u + 'm', '#fff4de', '#f0cf9c') +
      `<radialGradient id="${u}v" cx="38%" cy="32%" r="75%"><stop offset=".5" stop-color="#3a0a4a" stop-opacity="0"/><stop offset="1" stop-color="#3a0a4a" stop-opacity=".35"/></radialGradient>`,
    decor: () => confettis() + SERPENTINS,
    // Du papier crépon en bandes, chacune laissant pendre ses franges sur
    // la suivante : c'est ce qui en fait une piñata plutôt qu'un âne.
    corps: u => `
      <path d="M22,100 C24,86 36,79 50,79 C64,79 76,86 78,100 Z" fill="url(#${u}b)"/>
      <g fill="none" stroke-width="2.4" stroke-dasharray="1 .8">
        <path d="M27.8,87.2 H72.2" stroke="#a66ef0"/><path d="M24.5,94.2 H75.5" stroke="#ff5fa2"/>
      </g>
      ${[`<path d="M40.5,31.5 C35.5,26 32,18 33,10 C39,12.5 44,20 46,28.5 Z" fill="url(#${u}o)"/><path d="M40,27.5 C37.5,23.5 36,18.5 36.5,14 C39.5,16.5 42,21 43,26 Z" fill="#fff1d6" opacity=".6"/>`].map(l => l + miroir(l)).join('')}
      <path d="M50,27 C59.5,27 66,32.5 66.5,41 C67,48 64.5,54 63,59 C66.5,63 68.5,68.5 67,74 C65,80.5 58,84.5 50,84.5 C42,84.5 35,80.5 33,74 C31.5,68.5 33.5,63 37,59 C35.5,54 33,48 33.5,41 C34,32.5 40.5,27 50,27 Z" fill="url(#${u}r)"/>
      <g fill="none" stroke-width="2.4" stroke-dasharray="1 .8">
        <path d="M35.2,38.2 H64.8" stroke="#ff5fa2"/><path d="M34.8,46.2 H65.2" stroke="#ffd23f"/><path d="M36.2,54.2 H63.8" stroke="#a66ef0"/>
      </g>
      <path d="M50,27 C59.5,27 66,32.5 66.5,41 C67,48 64.5,54 63,59 C66.5,63 68.5,68.5 67,74 C65,80.5 58,84.5 50,84.5 C42,84.5 35,80.5 33,74 C31.5,68.5 33.5,63 37,59 C35.5,54 33,48 33.5,41 C34,32.5 40.5,27 50,27 Z" fill="url(#${u}v)"/>
      <path d="M43,30.5 L44.5,21 L47,28 L49.5,17.5 L52,27.5 L54.5,20.5 L57,30.5 Z" fill="#a66ef0"/>
      <path d="M36.5,59.5 C42,57.3 58,57.3 63.5,59.5 C66.8,63.3 68.5,68.5 67,74 C65,80.5 58,84.5 50,84.5 C42,84.5 35,80.5 33,74 C31.5,68.5 33.2,63.3 36.5,59.5 Z" fill="url(#${u}m)"/>
      <path d="M37.5,60.2 C42,58.4 58,58.4 62.5,60.2" stroke="#ff8c42" stroke-width="2.2" stroke-dasharray="1 .8" fill="none"/>
      <path d="M36,64.5 C42,62.6 58,62.6 64,64.5" stroke="#e8c088" stroke-width="1.8" stroke-dasharray=".9 .8" fill="none"/>
      <g fill="#fff" stroke="#2a1030" stroke-width=".6"><circle cx="42.5" cy="46.5" r="4.4"/><circle cx="57.5" cy="46.5" r="4.4"/></g>
      <circle cx="43.2" cy="47.3" r="2.3" fill="#1e0f24"/><circle cx="58.2" cy="47.3" r="2.3" fill="#1e0f24"/>
      ${reflet(42.4, 46.4, 0.8)}${reflet(57.4, 46.4, 0.8)}
      ${['<path d="M38.6,43.2 L37.2,41.8 M40.6,42.2 L39.9,40.4 M42.9,41.8 L42.9,39.9" stroke="#2a1030" stroke-width=".9" stroke-linecap="round"/>'].map(l => l + miroir(l)).join('')}
      <ellipse cx="44.2" cy="73.5" rx="1.9" ry="2.7" fill="#6a3a22" transform="rotate(-15 44.2 73.5)"/>
      <ellipse cx="55.8" cy="73.5" rx="1.9" ry="2.7" fill="#6a3a22" transform="rotate(15 55.8 73.5)"/>
      <path d="M45,80.2 C47.5,81.8 52.5,81.8 55,80.2" stroke="#6a3a22" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  },

  'br:fetard': {
    fond: ['#35969a', '#134a50', '#05181b'],
    defs: u =>
      lin(u + 'p', '#f9d6bd', '#eab093') +
      lin(u + 'h', '#ee7b3c', '#b34a1a') +
      lin(u + 's', '#8a5ce0', '#55309e') +
      bandes(u + 'c', [['#ff3d8b', 0.2], ['#fff4f8', 0.4], ['#ff3d8b', 0.6], ['#fff4f8', 0.8], ['#ff3d8b', 1]], 0.8, 1) +
      bandes(u + 'l', [['#ff4f9a', 0.25], ['#ffd23f', 0.5], ['#ff4f9a', 0.75], ['#ffd23f', 1]], 1, 0),
    decor: () => confettis() + SERPENTINS,
    corps: u => `
      <path d="M22,100 C24,86 36,78 50,78 C64,78 76,86 78,100 Z" fill="url(#${u}s)"/>
      <path d="M45.5,68 L45.5,79.5 C47.5,81 52.5,81 54.5,79.5 L54.5,68 Z" fill="#dca283"/>
      <path d="M43.5,77.5 L50,84 L47,86.5 L41,80 Z" fill="#fff"/>${miroir('<path d="M43.5,77.5 L50,84 L47,86.5 L41,80 Z" fill="#fff"/>')}
      <path d="M24,93 C30,87 34,96 40,91 C46,86 50,95 56,90 C62,85 66,94 72,89" stroke="#ffd23f" stroke-width="2" fill="none" stroke-linecap="round"/>
      ${grains([[31, 86], [67, 84], [60, 95], [38, 97], [72, 94]], '#8fe3d8', 1.6)}
      <ellipse cx="35.6" cy="52" rx="2.4" ry="3.6" fill="#eeb89a"/><ellipse cx="64.4" cy="52" rx="2.4" ry="3.6" fill="#eeb89a"/>
      <path d="M36,50 C36,41 42,37 50,37 C58,37 64,41 64,50 C64,61 58,69.5 50,71.5 C42,69.5 36,61 36,50 Z" fill="url(#${u}p)"/>
      <g fill="url(#${u}h)"><circle cx="35.4" cy="44.5" r="3"/><circle cx="34.8" cy="49" r="2.5"/><circle cx="37.4" cy="40.5" r="2.8"/><circle cx="64.6" cy="43.5" r="3"/><circle cx="65.2" cy="48" r="2.5"/><circle cx="62.4" cy="39.5" r="2.8"/></g>
      <path d="M40,45 C41.8,43.4 44.4,43.3 46,44.3 M54,44.6 C55.6,43.6 58.2,43.7 60,45.2" stroke="#9a3c14" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="43" cy="50" rx="2" ry="2.5" fill="#2a160c"/>${reflet(42.3, 49.2, 0.8)}
      <path d="M54.4,50.6 C55.7,48.6 58.3,48.6 59.6,50.6" stroke="#2a160c" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <ellipse cx="39.5" cy="58.5" rx="3.6" ry="2.8" fill="#ff8a7a" opacity=".45"/><ellipse cx="60.5" cy="58.5" rx="3.6" ry="2.8" fill="#ff8a7a" opacity=".45"/>
      ${grains([[39.5, 55.5], [41.6, 57], [40, 58.6], [60.5, 55.5], [58.4, 57], [60, 58.6], [48.6, 54.6], [51.4, 54.6]], '#c56a3a', 0.85, 0.8)}
      <path d="M50.3,51.5 C49.4,55 49.2,56.4 50.6,57.2" stroke="#c07a5a" stroke-width="1" fill="none" stroke-linecap="round"/>
      <ellipse cx="50" cy="63.2" rx="2.3" ry="2" fill="#b8404a"/>
      <path d="M53.5,61.4 L78,57.6 L78.8,62.2 L53.8,65 Z" fill="url(#${u}l)"/>
      <path d="M78.3,59.9 C84.5,59.3 87,53.8 84.5,50.5 C82,47.5 77.6,49.2 78.2,52.6 C78.7,55.2 82,55.4 82.8,53.2" stroke="#ff4f9a" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <rect x="50.4" y="61.6" width="4.2" height="3.2" rx="1" fill="#fff"/>
      <path d="M34,36 L42,10 L61,31.5 C55,36 41,38.5 34,36 Z" fill="url(#${u}c)"/>
      <path d="M34,36 C41,38.5 55,36 61,31.5" stroke="#ffd23f" stroke-width="2.6" stroke-dasharray="1.3 .9" fill="none"/>
      <circle cx="42" cy="10" r="3.8" fill="#ffd23f"/><circle cx="40.8" cy="8.8" r="1.2" fill="#fff" opacity=".7"/>`,
  },

  'br:arlequin': {
    fond: ['#3d9c9a', '#16504c', '#061b19'],
    defs: u => lin(u + 'p', '#dcae88', '#bd8a63') + lin(u + 'k', '#2e2a36', '#0f0d14') + lin(u + 'f', '#ffffff', '#dde2ea'),
    decor: () => confettis() + SERPENTINS,
    corps: u => `
      <path d="M20,100 C22,86 35,78 50,78 C65,78 78,86 80,100 Z" fill="#1a1020"/>
      <g stroke="#1a1020" stroke-width=".7" stroke-linejoin="round">
        <path d="${LOSANGES[0]}" fill="#e23b4a"/><path d="${LOSANGES[1]}" fill="#f4c542"/><path d="${LOSANGES[2]}" fill="#2fa35a"/>
      </g>
      <ellipse cx="50" cy="78.5" rx="15" ry="3.6" fill="url(#${u}f)"/>
      <path d="M45.5,68 L45.5,80 L54.5,80 L54.5,68 Z" fill="#b07a54"/>
      <g fill="url(#${u}f)" stroke="#c9ced8" stroke-width=".6">
        ${Array.from({ length: 9 }, (_, i) => `<circle cx="${(50 - 15 * Math.cos((Math.PI * i) / 8)).toFixed(1)}" cy="${(79 + 4 * Math.sin((Math.PI * i) / 8)).toFixed(1)}" r="3.3"/>`).join('')}
      </g>
      <ellipse cx="35.6" cy="52" rx="2.4" ry="3.6" fill="#c9966e"/><ellipse cx="64.4" cy="52" rx="2.4" ry="3.6" fill="#c9966e"/>
      <path d="M36,50 C36,41 42,37 50,37 C58,37 64,41 64,50 C64,61 58,69.5 50,71.5 C42,69.5 36,61 36,50 Z" fill="url(#${u}p)"/>
      <g fill="#2a1a14"><circle cx="35.8" cy="44" r="2.8"/><circle cx="35.2" cy="48" r="2.4"/><circle cx="64.2" cy="44" r="2.8"/><circle cx="64.8" cy="48" r="2.4"/></g>
      <path d="M31,47.5 C33,42 42,41 50,45 C58,41 67,42 69,47.5 C69,53.5 63,56.5 57,55 C54,54 51.5,53 50,54.5 C48.5,53 46,54 43,55 C37,56.5 31,53.5 31,47.5 Z" fill="#17121c"/>
      <path d="M33.5,46 C35.5,43.5 40,42.8 44,44 M66.5,46 C64.5,43.5 60,42.8 56,44" stroke="#5a5068" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <path d="M38.4,48.3 C39.9,45.7 44,45.7 45.6,48.3 C44,50.4 39.9,50.4 38.4,48.3 Z M61.6,48.3 C60.1,45.7 56,45.7 54.4,48.3 C56,50.4 60.1,50.4 61.6,48.3 Z" fill="#fff"/>
      <circle cx="42" cy="48.2" r="1.55" fill="#3a2410"/><circle cx="58" cy="48.2" r="1.55" fill="#3a2410"/>
      ${reflet(41.5, 47.7, 0.55)}${reflet(57.5, 47.7, 0.55)}
      <path d="M48.8,57.3 C49.6,58.2 50.8,58.2 51.4,57.3" stroke="#8a5a3a" stroke-width="1" fill="none" stroke-linecap="round"/>
      <circle cx="39.5" cy="60" r="3" fill="#ff8a7a" opacity=".35"/><circle cx="60.5" cy="60" r="3" fill="#ff8a7a" opacity=".35"/>
      <path d="M43.5,61 C45.8,67.2 54.2,67.2 56.5,61 C52.5,62.4 47.5,62.4 43.5,61 Z" fill="#7a2a2a"/>
      <path d="M44.5,61.6 C48,62.7 52,62.7 55.5,61.6 L55.2,62.8 C52,63.8 48,63.8 44.8,62.8 Z" fill="#fff"/>
      <path d="M15,37.5 C22,33.5 30,20.5 50,16.5 C70,20.5 78,33.5 85,37.5 C72,40 60,38.5 50,39 C40,38.5 28,40 15,37.5 Z" fill="url(#${u}k)"/>
      <path d="M15.8,37 C22.5,33.3 30.5,21 50,17.2 C69.5,21 77.5,33.3 84.2,37" stroke="#e0b451" stroke-width="1.2" fill="none"/>
      <circle cx="50" cy="28" r="3.6" fill="#e23b4a"/><circle cx="50" cy="28" r="1.7" fill="#f4c542"/>`,
  },

  'br:magicien': {
    fond: ['#2f8a94', '#10414c', '#041519'],
    defs: u =>
      lin(u + 'p', '#a8704c', '#83502f') +
      lin(u + 'k', '#3a3545', '#0d0b12') +
      lin(u + 'c', '#2c2536', '#0e0b12') +
      lin(u + 'r', '#e3404f', '#9a1a2a') +
      lin(u + 's', '#ffffff', '#dde2ea') +
      rad(u + 'l', '#ffffff', '#d5d9e3'),
    // La magie qui part de la baguette : des étoiles, au bout, derrière elle.
    decor: () => confettis(CONFETTIS.slice(0, 4)) + etoile(87, 58, 3.4, '#ffe36b', 0.9) + etoile(79, 53, 2, '#fff', 0.85),
    corps: u => `
      <path d="M18,100 C20,85 34,78 50,78 C66,78 80,85 82,100 Z" fill="url(#${u}c)"/>
      <path d="M42.5,78.5 L50,95 L57.5,78.5 Z" fill="url(#${u}s)"/>
      <path d="M45.5,66 L45.5,79 C47.5,80.5 52.5,80.5 54.5,79 L54.5,66 Z" fill="#7a4628"/>
      <path d="M50,81 L45.5,78.6 L45.5,83.4 Z M50,81 L54.5,78.6 L54.5,83.4 Z" fill="#141018"/>
      <g fill="url(#${u}r)" stroke="#0e0b12">${['<path d="M45.5,79.5 L30,60.5 C33,68 35,76 36,84.5 Z"/>'].map(l => l + miroir(l)).join('')}</g>
      <ellipse cx="35.6" cy="52" rx="2.4" ry="3.6" fill="#94603f"/><ellipse cx="64.4" cy="52" rx="2.4" ry="3.6" fill="#94603f"/>
      <path d="M36,50 C36,41 42,37 50,37 C58,37 64,41 64,50 C64,61 58,69.5 50,71.5 C42,69.5 36,61 36,50 Z" fill="url(#${u}p)"/>
      <path d="M35.8,48.5 C35.4,45 36,42.5 37.5,41 L40,41.5 C38.8,43.2 38,45.5 37.6,49 Z M64.2,48.5 C64.6,45 64,42.5 62.5,41 L60,41.5 C61.2,43.2 62,45.5 62.4,49 Z" fill="#141018"/>
      <path d="M40,45.2 C41.8,43.4 44.5,43.2 46.2,44.4 M53.8,44 C55.4,42.2 58.2,41.6 60.2,43" stroke="#141018" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <ellipse cx="43" cy="50" rx="2" ry="2.4" fill="#1a0e08"/><ellipse cx="57" cy="50" rx="2" ry="2.4" fill="#1a0e08"/>
      ${reflet(42.3, 49.2, 0.8)}${reflet(56.3, 49.2, 0.8)}
      <path d="M50.3,51.5 C49.4,55 49.2,56.4 50.6,57.2" stroke="#5a2e18" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M46.4,63.4 C48.3,64.8 51.7,64.8 53.6,63.4" stroke="#5a2a18" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M50,58.6 C47.5,57 43.5,57 41,59.2 C39.8,60.3 38.4,59.6 38.6,58.2 C37.6,60.6 40,62.2 42.4,61 C45,59.8 47.8,59.8 50,60.4 C52.2,59.8 55,59.8 57.6,61 C60,62.2 62.4,60.6 61.4,58.2 C61.6,59.6 60.2,60.3 59,59.2 C56.5,57 52.5,57 50,58.6 Z M47.8,66.8 C48.4,70 49.2,72.2 50,73.2 C50.8,72.2 51.6,70 52.2,66.8 C51,67.4 49,67.4 47.8,66.8 Z" fill="#141018"/>
      <ellipse cx="50" cy="23.5" rx="12.5" ry="2.5" fill="#050408"/>
      <g fill="url(#${u}l)"><ellipse cx="45.6" cy="13.5" rx="2.5" ry="6.2" transform="rotate(-18 45.6 13.5)"/><ellipse cx="54.4" cy="13.5" rx="2.5" ry="6.2" transform="rotate(18 54.4 13.5)"/><circle cx="50" cy="20.5" r="5"/></g>
      <g fill="#ffb3c6"><ellipse cx="45.7" cy="14" rx="1.1" ry="4.4" transform="rotate(-18 45.7 14)"/><ellipse cx="54.3" cy="14" rx="1.1" ry="4.4" transform="rotate(18 54.3 14)"/></g>
      <circle cx="48.1" cy="19.8" r=".95" fill="#1a1020"/><circle cx="51.9" cy="19.8" r=".95" fill="#1a1020"/>
      <ellipse cx="50" cy="21.7" rx=".9" ry=".65" fill="#ff8fab"/>
      <path d="M37.5,23.5 C37.5,26.8 62.5,26.8 62.5,23.5 L61.5,37.5 C55,39 45,39 38.5,37.5 Z" fill="url(#${u}k)"/>
      <path d="M38.3,33.5 C45,35 55,35 61.7,33.5 L61.5,37.5 C55,39 45,39 38.5,37.5 Z" fill="url(#${u}r)"/>
      <path d="M27.5,39.5 C27.5,36 72.5,36 72.5,39.5 C72.5,42.8 27.5,42.8 27.5,39.5 Z" fill="url(#${u}k)"/>
      <ellipse cx="45.5" cy="24.6" rx="1.9" ry="1.3" fill="#fff"/><ellipse cx="54.5" cy="24.6" rx="1.9" ry="1.3" fill="#fff"/>
      <path d="M66,90 L83,65.5" stroke="#141018" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M83,65.5 L85.2,62.3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
      <g transform="translate(70.5 84) rotate(35)">
        <rect x="-4.2" y="-4.4" width="8.4" height="8.8" rx="3.4" fill="url(#${u}s)"/>
        <path d="M-.4,-1.8 H3.8 M-.4,.6 H4 M-.4,3 H3.6" stroke="#aeb6c4" stroke-width=".6"/>
        <rect x="-4" y="4.2" width="8" height="2.6" rx="1" fill="#fff" stroke="#c9ced8" stroke-width=".5"/>
      </g>`,
  },

  'br:disco': {
    fond: ['#3ba0a8', '#154c58', '#06181f'],
    defs: u =>
      lin(u + 'p', '#7e4e36', '#5c3522') +
      rad(u + 'h', '#4a2e22', '#140a06') +
      lin(u + 't', '#f0489e', '#a0186a') +
      rad(u + 'b', '#ffffff', '#6f7a90') +
      lin(u + 'k', '#ffe07a', '#d4a020'),
    // La boule renvoie la lumière : deux pinceaux pâles et des éclats sur le disque.
    decor: () =>
      '<path d="M50,14 L6,46 L10,58 Z M50,14 L94,46 L90,58 Z" fill="#fff" opacity=".07"/>' +
      confettis() +
      etoile(14, 40, 2.2, '#fff', 0.8) +
      etoile(84, 62, 2.2, '#fff', 0.7) +
      grains([[87, 34], [18, 70], [10, 52], [90, 48]], '#ffc2e6', 1.4, 0.8),
    corps: u => `
      <path d="M50,0 L50,7.5" stroke="#c9ced8" stroke-width=".7"/>
      <path d="${nuage(50, 46, 30, 26, 16, 4)}" fill="url(#${u}h)"/>
      <g fill="none" stroke="#6a4430" stroke-width=".8" stroke-linecap="round" opacity=".6">
        <path d="M26,40 c1.5,-2 4,-2 5,0 M30,56 c1.5,-2 4,-2 5,0 M36,27 c1.5,-2 4,-2 5,0 M58,25 c1.5,-2 4,-2 5,0 M68,40 c1.5,-2 4,-2 5,0 M66,57 c1.5,-2 4,-2 5,0 M47,22 c1.5,-2 4,-2 5,0"/>
      </g>
      <path d="M44,68 L44,86 L50,92 L56,86 L56,68 Z" fill="#5c3522"/>
      <path d="M22,100 C24,86 36,78 43,78.2 L50,90 L57,78.2 C64,78 76,86 78,100 Z" fill="url(#${u}t)"/>
      ${grains([[30, 90], [36, 86], [34, 95], [64, 86], [70, 90], [66, 95], [43, 94], [57, 94], [27, 96], [73, 96], [40, 89], [60, 89]], '#ffe07a', 1.3, 0.95)}
      ${grains([[32.5, 89], [67.5, 92], [48, 97]], '#fff', 1.1)}
      <path d="M36.5,50 C36.5,41 42.5,36.5 50,36.5 C57.5,36.5 63.5,41 63.5,50 C63.5,61 57.5,69.5 50,71.5 C42.5,69.5 36.5,61 36.5,50 Z" fill="url(#${u}p)"/>
      <path d="M36.6,48 C36,40 42,35 50,35 C58,35 64,40 63.4,48 C61,42.5 56,40 50,40.5 C44,40 39,42.5 36.6,48 Z" fill="#2e1b12"/>
      <path d="M35.5,44.5 C39,37.5 61,37.5 64.5,44.5" stroke="url(#${u}k)" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${etoile(50, 38.8, 2.6, '#fff', 1)}
      <circle cx="35.4" cy="60" r="3.2" fill="none" stroke="#f2c14e" stroke-width="1.1"/><circle cx="64.6" cy="60" r="3.2" fill="none" stroke="#f2c14e" stroke-width="1.1"/>
      <ellipse cx="43" cy="48.4" rx="3.2" ry="1.8" fill="#c94fd8" opacity=".7"/><ellipse cx="57" cy="48.4" rx="3.2" ry="1.8" fill="#c94fd8" opacity=".7"/>
      <path d="M40,45 C41.8,43.6 44.4,43.5 46,44.4 M54,44.4 C55.6,43.5 58.2,43.6 60,45" stroke="#140a06" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="43" cy="50.4" rx="2" ry="2.4" fill="#140a06"/><ellipse cx="57" cy="50.4" rx="2" ry="2.4" fill="#140a06"/>
      ${reflet(42.3, 49.6, 0.8)}${reflet(56.3, 49.6, 0.8)}
      <path d="M40.9,49.4 L39.4,48.3 M59.1,49.4 L60.6,48.3" stroke="#140a06" stroke-width=".9" stroke-linecap="round"/>
      <path d="M50.3,52.4 C49.5,55.2 49.4,56.4 50.6,57" stroke="#3a1e10" stroke-width="1" fill="none" stroke-linecap="round"/>
      <circle cx="40" cy="57.5" r="3.2" fill="#ff6fae" opacity=".3"/><circle cx="60" cy="57.5" r="3.2" fill="#ff6fae" opacity=".3"/>
      <path d="M45.2,61.3 C47.4,65.8 52.6,65.8 54.8,61.3 C52,62.3 48,62.3 45.2,61.3 Z" fill="#e0307a"/>
      <circle cx="48" cy="63.4" r=".6" fill="#fff" opacity=".7"/>
      <circle cx="50" cy="14" r="7" fill="url(#${u}b)"/>
      <g stroke="#5a6478" stroke-width=".45" fill="none" opacity=".7"><path d="M43.3,11.5 H56.7 M43,14 H57 M43.3,16.5 H56.7 M50,7 V21 M46,7.7 C45,10 45,18 46,20.3 M54,7.7 C55,10 55,18 54,20.3"/></g>
      ${etoile(46.5, 10.5, 2.2, '#fff', 1)}`,
  },

  'br:venise': {
    fond: ['#35969a', '#134a50', '#05181b'],
    defs: u =>
      `<linearGradient id="${u}o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3bf"/><stop offset=".5" stop-color="#e0ad48"/><stop offset="1" stop-color="#8f5e16"/></linearGradient>` +
      lin(u + 'p', '#f8ebe2', '#e5c7b5') +
      lin(u + 'h', '#3d2533', '#1f121a'),
    decor: () =>
      CONFETTIS.map(([x, y, c, r]) => `<rect x="${x}" y="${y}" width="3.2" height="1.6" rx=".4" fill="${c}" opacity=".85" transform="rotate(${r} ${x} ${y})"/>`).join(''),
    corps: u => `
      <path d="M28,53 C24,37 32,22 50,22 C68,22 76,37 72,53 C74,63 70,73 64,75 L36,75 C30,73 26,63 28,53 Z" fill="url(#${u}h)"/>
      <path d="M22,100 C24,86 36,78 50,78 C64,78 76,86 78,100 Z" fill="#6a1f3f"/>
      <path d="M33,87 C40,91.5 60,91.5 67,87" stroke="#e0ad48" stroke-width="1.5" fill="none"/>
      <path d="M45.5,68 L45.5,79 L54.5,79 L54.5,68 Z" fill="#e5c7b5"/>
      <path d="M36,46 C36,37.5 42,32 50,32 C58,32 64,37.5 64,46 C64,58 58,68 50,70.5 C42,68 36,58 36,46 Z" fill="url(#${u}p)"/>
      <path d="M36.5,36 C40,31 46,30 50,32 C44,32.5 40,35 37.5,41 Z" fill="#2a1a24"/>
      <path d="M63.5,36 C60,31 54,30 50,32 C56,32.5 60,35 62.5,41 Z" fill="#2a1a24"/>
      <path d="M66.5,44 C74,34 78.5,22 76.5,9.5 C72.5,20 68.5,30 64,42 Z" fill="#7a4fc8"/>
      <path d="M64,42.5 C69.5,30 70,18 64.5,7.5 C63.5,20 62.5,30 61.3,40.5 Z" fill="#2cc4b0"/>
      <path d="M68,46 C80,40 88,30 90.5,19.5 C82.5,28 74.5,36 66,44 Z" fill="#ff6f9f"/>
      <path d="M71.5,30 C73.8,25 75,19 74.8,14 M66.2,30 C67.2,24 66.8,18 65.2,12.5" stroke="#fff" stroke-width=".6" opacity=".55" fill="none"/>
      <path d="M31.5,46.5 C33.5,40 42,38 50,42 C58,38 66.5,40 68.5,46.5 C68.5,52.5 62,56.5 56,54.5 C53,53.5 51,52.3 50,54.3 C49,52.3 47,53.5 44,54.5 C38,56.5 31.5,52.5 31.5,46.5 Z" fill="url(#${u}o)"/>
      <path d="M33.5,47 C34.5,43.5 37,42 39.5,42.3 M66.5,47 C65.5,43.5 63,42 60.5,42.3 M45,51.8 C47,50.6 48.6,50.8 50,52 C51.4,50.8 53,50.6 55,51.8" stroke="#fff6d0" stroke-width=".7" fill="none" opacity=".85"/>
      <path d="M38.4,47 C39.9,44.4 44,44.4 45.6,47 C44,49.1 39.9,49.1 38.4,47 Z" fill="#1a0f14"/>
      <path d="M61.6,47 C60.1,44.4 56,44.4 54.4,47 C56,49.1 60.1,49.1 61.6,47 Z" fill="#1a0f14"/>
      ${reflet(42.6, 46.4, 0.6)}${reflet(57.4, 46.4, 0.6)}
      <circle cx="50" cy="44.2" r="1.5" fill="#d6335e"/><circle cx="49.5" cy="43.7" r=".45" fill="#fff" opacity=".8"/>
      <path d="M46.5,61 C48.5,59.8 51.5,59.8 53.5,61 C51.5,63.6 48.5,63.6 46.5,61 Z" fill="#c8284f"/>`,
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { carnaval: DESSINS } })
