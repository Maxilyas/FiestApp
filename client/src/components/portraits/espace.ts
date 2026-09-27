// L’espace · Sciences — du robot à l’astronaute.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { etoile, lin, miroir, points, rad, reflet, type DessinDePortrait } from './outils'

/** Les étoiles de l’astronaute (la maquette validée), aux mêmes places pour toute la branche. */
const ETOILES: [number, number, number][] = [
  [14, 30, 0.7],
  [22, 14, 0.5],
  [84, 70, 0.6],
  [12, 70, 0.5],
  [30, 88, 0.4],
  [66, 10, 0.5],
  [90, 44, 0.5],
]

/** La petite planète à anneau de l’astronaute, posée là où le personnage la laisse voir. */
const planete = (x: number, y: number, teinte = '#e59a62', anneau = '#f3c894') =>
  `<circle cx="${x}" cy="${y}" r="5.5" fill="${teinte}"/><ellipse cx="${x}" cy="${y}" rx="10" ry="2.6" fill="none" stroke="${anneau}" stroke-width="1" transform="rotate(-20 ${x} ${y})"/>`

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:robot': {
    fond: ['#5a66d6', '#1d236e', '#080b27'],
    defs: u => lin(u + 'm', '#f1f5fb', '#a3b2c9') + lin(u + 'c', '#c9d3e3', '#76869f') + rad(u + 'o', '#fffbe0', '#ffbf2e'),
    decor: () => points(ETOILES, '#fff', 0.8) + planete(80, 21),
    corps: u => `
      <path d="M50,26 L50,14" stroke="#a3b2c9" stroke-width="1.8"/>
      <circle cx="50" cy="11.5" r="3.4" fill="#ff5a5a"/><circle cx="48.9" cy="10.4" r="1" fill="#fff" opacity=".7"/>
      <path d="M44.5,26 C44.5,22 55.5,22 55.5,26 Z" fill="#8a9bb5"/>
      <rect x="20.5" y="37" width="7" height="17" rx="3" fill="#8a9bb5"/><rect x="72.5" y="37" width="7" height="17" rx="3" fill="#8a9bb5"/>
      <path d="M22,41 L26,41 M22,45.5 L26,45.5 M22,50 L26,50 M74,41 L78,41 M74,45.5 L78,45.5 M74,50 L78,50" stroke="#6a7a94" stroke-width=".9"/>
      <path d="M18,100 L18,87 C18,80.5 23,76 30,76 L70,76 C77,76 82,80.5 82,87 L82,100 Z" fill="url(#${u}c)"/>
      <rect x="42" y="64" width="16" height="13" fill="#7d8da6"/>
      <path d="M42,68 L58,68 M42,72 L58,72" stroke="#5d6c85" stroke-width="1.2"/>
      <rect x="37" y="83" width="26" height="12" rx="2.5" fill="#23304f"/>
      <circle cx="42.5" cy="89" r="2.2" fill="#ff5a5a"/><circle cx="49" cy="89" r="2.2" fill="#ffd34d"/>
      <rect x="53.5" y="86.5" width="6.5" height="5" rx="1" fill="#6ff0e0" opacity=".85"/>
      <rect x="27" y="25" width="46" height="41" rx="7" fill="url(#${u}m)"/>
      <path d="M31,28.5 C37,27.2 44,27 50,27" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
      <g fill="#8a9bb5"><circle cx="31" cy="30" r=".9"/><circle cx="69" cy="30" r=".9"/><circle cx="31" cy="62" r=".9"/><circle cx="69" cy="62" r=".9"/></g>
      <circle cx="39.5" cy="45" r="7.2" fill="#3a4766"/><circle cx="60.5" cy="45" r="7.2" fill="#3a4766"/>
      <circle cx="39.5" cy="45" r="5.2" fill="url(#${u}o)"/><circle cx="60.5" cy="45" r="5.2" fill="url(#${u}o)"/>
      ${reflet(37.8, 43.2, 1.4)}${reflet(58.8, 43.2, 1.4)}
      <ellipse cx="32.5" cy="56" rx="2.8" ry="1.9" fill="#ff8fb0" opacity=".55"/><ellipse cx="67.5" cy="56" rx="2.8" ry="1.9" fill="#ff8fb0" opacity=".55"/>
      <rect x="40" y="54" width="20" height="7" rx="3.5" fill="#3a4766"/>
      <path d="M42.5,56.2 C45.5,59.3 54.5,59.3 57.5,56.2" stroke="#ffcf4a" stroke-width="1.8" stroke-dasharray="1.8 1.1" fill="none"/>`,
  },

  'br:extraterrestre': {
    fond: ['#5d5ccf', '#1f1f6a', '#090927'],
    defs: u => rad(u + 'v', '#c8f59e', '#4fa845') + lin(u + 's', '#dcd9f4', '#8f89c6') + rad(u + 'o', '#6a4aa8', '#0d0620'),
    decor: () => points(ETOILES, '#fff', 0.8) + planete(84, 30, '#5fd0c0', '#b8f0e6'),
    corps: u => `
      <g fill="none" stroke="#5fb34f" stroke-width="1.9" stroke-linecap="round">
        <path d="M41,25 C38,19 34,15 29,13"/><path d="M59,25 C62,19 66,15 71,13"/>
      </g>
      <circle cx="28" cy="12.5" r="3.6" fill="#ffe36b"/><circle cx="72" cy="12.5" r="3.6" fill="#ffe36b"/>
      <circle cx="27" cy="11.4" r="1.1" fill="#fff" opacity=".8"/><circle cx="71" cy="11.4" r="1.1" fill="#fff" opacity=".8"/>
      <path d="M22,100 C24,86 36,79 50,79 C64,79 76,86 78,100 Z" fill="url(#${u}s)"/>
      <path d="M45,66 L45,80 L55,80 L55,66 Z" fill="#58ad4b"/>
      <path d="M37,80.5 C41,76.5 59,76.5 63,80.5 C59,84.5 41,84.5 37,80.5 Z" fill="#f2c14e"/>
      <circle cx="50" cy="91.5" r="2.8" fill="#ff7ac8"/><ellipse cx="50" cy="91.5" rx="5.4" ry="1.4" fill="none" stroke="#fff" stroke-width=".8" transform="rotate(-20 50 91.5)"/>
      <path d="M50,21 C66,21 76.5,31 76.5,44 C76.5,56 65,68.5 50,70.5 C35,68.5 23.5,56 23.5,44 C23.5,31 34,21 50,21 Z" fill="url(#${u}v)"/>
      <g fill="#a8e886" opacity=".7"><circle cx="40" cy="28" r="1.6"/><circle cx="46" cy="25.5" r="1"/><circle cx="62" cy="29" r="1.3"/></g>
      <ellipse cx="38.5" cy="46" rx="6.6" ry="8.4" transform="rotate(-20 38.5 46)" fill="url(#${u}o)"/>
      <ellipse cx="61.5" cy="46" rx="6.6" ry="8.4" transform="rotate(20 61.5 46)" fill="url(#${u}o)"/>
      ${reflet(36, 42.5, 2)}${reflet(59, 42.5, 2)}
      <circle cx="40.5" cy="50" r=".8" fill="#fff" opacity=".7"/><circle cx="63.5" cy="50" r=".8" fill="#fff" opacity=".7"/>
      <ellipse cx="33.5" cy="58" rx="3" ry="1.8" fill="#ff8fb0" opacity=".5"/><ellipse cx="66.5" cy="58" rx="3" ry="1.8" fill="#ff8fb0" opacity=".5"/>
      <circle cx="48.5" cy="57" r=".6" fill="#2f6a2a"/><circle cx="51.5" cy="57" r=".6" fill="#2f6a2a"/>
      <path d="M45.5,61 C48,63.8 52,63.8 54.5,61" stroke="#2f6a2a" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
  },

  'br:chat': {
    fond: ['#5864d2', '#1b2269', '#070a26'],
    defs: u => rad(u + 'o', '#ffc27a', '#dd7a2c') + lin(u + 'b', '#d4a266', '#96642f') + lin(u + 'r', '#fff6ea', '#f1d7b5'),
    decor: () => points(ETOILES, '#fff', 0.8) + planete(16, 28, '#7fd6c4', '#c8f2e8'),
    corps: u => `
      <path d="M24,74 L28,67 L72,67 L76,74 Z" fill="#5a3a1c"/>
      <path d="M31,44 L29,17 L47,31 Z" fill="#e8893a"/><path d="M33,39 L32,23 L43,31.5 Z" fill="#ffb3a0"/>
      ${miroir('<path d="M31,44 L29,17 L47,31 Z" fill="#e8893a"/><path d="M33,39 L32,23 L43,31.5 Z" fill="#ffb3a0"/>')}
      <path d="M50,28 C64,28 73,37 73,49 C73,61 63,70 50,70 C37,70 27,61 27,49 C27,37 36,28 50,28 Z" fill="url(#${u}o)"/>
      <path d="M50,29.5 L50,36 M45,30.5 L46,35 M55,30.5 L54,35" stroke="#c8641f" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M28.5,47 L33,48 M28.5,52 L33,52 M71.5,47 L67,48 M71.5,52 L67,52" stroke="#c8641f" stroke-width="1.4" stroke-linecap="round"/>
      <ellipse cx="45.5" cy="60" rx="5.5" ry="4.5" fill="url(#${u}r)"/><ellipse cx="54.5" cy="60" rx="5.5" ry="4.5" fill="url(#${u}r)"/>
      <path d="M47.8,55.5 L52.2,55.5 L50,58.2 Z" fill="#ff8a9a"/>
      <path d="M50,58.2 L50,60 M46.5,60.5 C47.8,62 49.2,62 50,60.4 C50.8,62 52.2,62 53.5,60.5" stroke="#7a3f1f" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M40,59 L27,57 M40,61.5 L28,63 M60,59 L73,57 M60,61.5 L72,63" stroke="#fff" stroke-width=".6" opacity=".85"/>
      <path d="M36.5,48 C38,43.5 45,43.5 46.5,48 C45,52.5 38,52.5 36.5,48 Z" fill="#c9e86a"/>
      <ellipse cx="41.5" cy="48" rx="1.3" ry="3.4" fill="#1a1208"/>
      ${reflet(40.3, 46.3, 0.9)}
      <path d="M54,48.5 C56,45.5 61,45.5 63,48.5" stroke="#3a1f0e" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <ellipse cx="36" cy="56" rx="2.8" ry="1.7" fill="#ff8a8a" opacity=".4"/><ellipse cx="64" cy="56" rx="2.8" ry="1.7" fill="#ff8a8a" opacity=".4"/>
      <path d="M22,74 L78,74 L78,100 L22,100 Z" fill="url(#${u}b)"/>
      <path d="M22,74 L78,74 L78,77 L22,77 Z" fill="#e3b77a"/>
      <path d="M22,74 L28,67 L14,58 L7,66 Z" fill="#c38e52"/><path d="M78,74 L72,67 L86,58 L93,66 Z" fill="#b8844a"/>
      <path d="M50,83 L50,97 M44.5,85 C44.5,91 46.5,93 50,93 C53.5,93 55.5,91 55.5,85" stroke="#6b4522" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <ellipse cx="40" cy="75" rx="5" ry="3.3" fill="url(#${u}r)"/><ellipse cx="60" cy="75" rx="5" ry="3.3" fill="url(#${u}r)"/>
      <path d="M38.3,73.5 L38.3,76 M41.7,73.5 L41.7,76 M58.3,73.5 L58.3,76 M61.7,73.5 L61.7,76" stroke="#d9b48a" stroke-width=".7"/>`,
  },

  'br:astronome': {
    fond: ['#5360cc', '#1a2066', '#070a24'],
    defs: u =>
      lin(u + 'p', '#8f5a36', '#63391d') + lin(u + 'b', '#f4c95c', '#c98b24') + lin(u + 'c', '#2f9a95', '#134a50') + lin(u + 'l', '#fff0b5', '#a8761f') + lin(u + 'w', '#f4f1ea', '#c4bdb1'),
    decor: () => points(ETOILES, '#fff', 0.8) + planete(82, 22),
    corps: u => `
      <path d="M18,100 C20,86 33,78 50,78 C67,78 80,86 82,100 Z" fill="url(#${u}c)"/>
      ${etoile(29, 90, 2.4, '#f7d77a', 0.95)}${etoile(38, 96, 1.6, '#f7d77a', 0.9)}${etoile(72, 90, 2, '#f7d77a', 0.95)}
      <path d="M44.5,66 L44.5,80 L55.5,80 L55.5,66 Z" fill="#5c341a"/>
      <path d="M40,80 C44,84 56,84 60,80 L57,78 L43,78 Z" fill="#1d6a6a"/>
      <circle cx="50" cy="83" r="2.6" fill="#f4c95c"/>
      <ellipse cx="34.5" cy="51.5" rx="2.6" ry="3.8" fill="#7a4a2a"/><ellipse cx="65.5" cy="51.5" rx="2.6" ry="3.8" fill="#7a4a2a"/>
      <path d="M36,46 C36,38 42,34 50,34 C58,34 64,38 64,46 C64,58 58,68 50,70.5 C42,68 36,58 36,46 Z" fill="url(#${u}p)"/>
      <path d="M36.4,52 C37,63 42,72 50,75 C58,72 63,63 63.6,52 C61.5,57.5 58.5,60.5 55,61 C52.5,59.5 47.5,59.5 45,61 C41.5,60.5 38.5,57.5 36.4,52 Z" fill="url(#${u}w)"/>
      <path d="M43,60.3 C45.5,57.8 48.5,58 50,59.6 C51.5,58 54.5,57.8 57,60.3 C54.5,61.8 52,61.9 50,60.9 C48,61.9 45.5,61.8 43,60.3 Z" fill="#ebe7df"/>
      <path d="M46.8,63.6 C48.6,65 51.4,65 53.2,63.6" stroke="#3a2016" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M40.5,46.8 C42,45.6 44.5,45.6 46,46.6 M54,46.6 C55.5,45.6 58,45.6 59.5,46.8" stroke="#e6e1d8" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <circle cx="43.2" cy="50.4" r="1.9" fill="#1c0f08"/><circle cx="56.8" cy="50.4" r="1.9" fill="#1c0f08"/>
      ${reflet(42.6, 49.7, 0.65)}${reflet(56.2, 49.7, 0.65)}
      <path d="M50.3,51.5 C49.2,54.8 49,56 50.8,56.6" stroke="#4a2814" stroke-width="1" fill="none" stroke-linecap="round"/>
      <ellipse cx="39.5" cy="55" rx="2.8" ry="1.6" fill="#d9704f" opacity=".35"/><ellipse cx="60.5" cy="55" rx="2.8" ry="1.6" fill="#d9704f" opacity=".35"/>
      <path d="M33.5,41 C33,29 40.5,21.5 50,21.5 C59.5,21.5 67,29 66.5,41 Z" fill="url(#${u}b)"/>
      <path d="M41,25 L41,38 M45.5,23 L45.5,38 M50,22.5 L50,38 M54.5,23 L54.5,38 M59,25 L59,38" stroke="#d09528" stroke-width=".9" opacity=".7"/>
      <rect x="32" y="36.5" width="36" height="7" rx="3.2" fill="#e0a83a"/>
      <path d="M33.5,40 L66.5,40" stroke="#b97d1e" stroke-width="5" stroke-dasharray="1 1.6" opacity=".35"/>
      <circle cx="50" cy="18.5" r="4.8" fill="#fbe3a0"/>
      <g transform="translate(38 100) rotate(-50)">
        <rect x="0" y="-1.7" width="8" height="3.4" rx=".8" fill="#5a3d16"/>
        <rect x="7" y="-2.4" width="20" height="4.8" fill="url(#${u}l)"/>
        <rect x="26" y="-3.1" width="2.2" height="6.2" fill="#8a5a1a"/>
        <rect x="28" y="-3.6" width="30" height="7.2" fill="url(#${u}l)"/>
        <rect x="57" y="-4.4" width="12" height="8.8" rx=".8" fill="url(#${u}l)"/>
        <rect x="57" y="-4.4" width="1.6" height="8.8" fill="#8a5a1a"/>
        <ellipse cx="69" cy="0" rx="1.1" ry="3.7" fill="#aee3ff"/>
      </g>
      <ellipse cx="52.2" cy="83" rx="4.4" ry="3.4" fill="url(#${u}p)" transform="rotate(-50 52.2 83)"/>`,
  },

  'br:savante': {
    fond: ['#5b62d4', '#1c226c', '#080a27'],
    defs: u => lin(u + 'p', '#ecb892', '#cf9068') + lin(u + 'h', '#4a2c1c', '#20120a') + lin(u + 'k', '#ffffff', '#d3dae6') + lin(u + 'f', '#c6ff9e', '#34c46a'),
    decor: () => points(ETOILES, '#fff', 0.8) + planete(20, 24, '#f28ab8', '#ffd0e4'),
    corps: u => `
      <path d="M38.5,10.5 L60.5,25" stroke="#f6c84a" stroke-width="2.2"/>
      <path d="M38.5,10.5 L36.4,9.1" stroke="#3a2a1a" stroke-width="2.2"/>
      <circle cx="50" cy="20" r="8" fill="url(#${u}h)"/>
      <path d="M44,17 C46,14.5 50,14 53,15" stroke="#6e4a34" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M33,52 C30,36 38,26 50,26 C62,26 70,36 67,52 C67,58 65,62 62,64 L38,64 C35,62 33,58 33,52 Z" fill="url(#${u}h)"/>
      <path d="M20,100 C22,86 34,78 50,78 C66,78 78,86 80,100 Z" fill="url(#${u}k)"/>
      <path d="M43.5,78.5 L50,91 L56.5,78.5 Z" fill="#8a6ae0"/>
      <path d="M42,78.5 L50,93 L50,100 M58,78.5 L50,93" stroke="#c3cad8" stroke-width="1" fill="none"/>
      <path d="M27.5,89.5 L37.5,89.5 L37.5,97 L27.5,97 Z" fill="none" stroke="#c3cad8" stroke-width=".9"/>
      <rect x="30" y="85.5" width="1.8" height="5" rx=".6" fill="#e0433a"/><rect x="33.4" y="86" width="1.8" height="4.5" rx=".6" fill="#3b6fd8"/>
      <path d="M45.5,66 L45.5,79 L54.5,79 L54.5,66 Z" fill="#cf9068"/>
      <path d="M37,46 C37,38 42.5,33.5 50,33.5 C57.5,33.5 63,38 63,46 C63,57.5 57.5,66.5 50,69 C42.5,66.5 37,57.5 37,46 Z" fill="url(#${u}p)"/>
      <path d="M36.5,45 C36,35 42,29.5 50,29.5 C58,29.5 64,35 63.5,45 C61,39 56,35.5 48,36 C44,37.5 40,41 36.5,45 Z" fill="url(#${u}h)"/>
      <path d="M40.5,42.8 C42,41.8 45,41.8 46.5,42.8 M53.5,42.8 C55,41.8 58,41.8 59.5,42.8" stroke="#3a2016" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <circle cx="43.6" cy="49.3" r="1.7" fill="#2a160c"/><circle cx="56.4" cy="49.3" r="1.7" fill="#2a160c"/>
      ${reflet(43, 48.7, 0.6)}${reflet(55.8, 48.7, 0.6)}
      <circle cx="43.5" cy="49" r="4.6" fill="#fff" fill-opacity=".18" stroke="#2b2238" stroke-width="1.2"/>
      <circle cx="56.5" cy="49" r="4.6" fill="#fff" fill-opacity=".18" stroke="#2b2238" stroke-width="1.2"/>
      <path d="M48.1,48.6 C49.3,47.8 50.7,47.8 51.9,48.6 M38.9,48 L37,47.2 M61.1,48 L63,47.2" stroke="#2b2238" stroke-width="1" fill="none"/>
      <path d="M50.3,51.5 C49.5,54.2 49.4,55.2 50.7,55.7" stroke="#b5714c" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <ellipse cx="40.5" cy="56" rx="2.8" ry="1.6" fill="#ff8a8a" opacity=".4"/><ellipse cx="59.5" cy="56" rx="2.8" ry="1.6" fill="#ff8a8a" opacity=".4"/>
      <path d="M46.3,59.3 C48.3,61.8 51.7,61.8 53.7,59.3 C51.7,60.2 48.3,60.2 46.3,59.3 Z" fill="#c8455e"/>
      <path d="M68,100 C68,93 71,88 74,84 L82,86 C81,90 80,95 80,100 Z" fill="url(#${u}k)"/>
      <path d="M76.5,56 L80.5,56 L80.5,64 L86,77 C87,79.5 85.5,81.5 83,81.5 L74,81.5 C71.5,81.5 70,79.5 71,77 L76.5,64 Z" fill="#e9f5ff" opacity=".92"/>
      <path d="M73,72 L84,72 L86,77 C87,79.5 85.5,81.5 83,81.5 L74,81.5 C71.5,81.5 70,79.5 71,77 Z" fill="url(#${u}f)"/>
      <rect x="75.8" y="54.8" width="5.4" height="2" rx=".8" fill="#c9d6e6"/>
      <ellipse cx="78" cy="83.5" rx="5.2" ry="3.4" fill="url(#${u}p)"/>
      <g fill="#e6ffe9" opacity=".85"><circle cx="79" cy="50.5" r="2.5"/><circle cx="82.5" cy="45.5" r="3.2"/><circle cx="78.5" cy="39.5" r="3.4"/><circle cx="83" cy="33" r="2.8"/></g>`,
  },

  'br:astronaute': {
    fond: ['#5561d0', '#1b2168', '#070a25'],
    defs: u =>
      rad(u + 'h', '#ffffff', '#b9c2d8') +
      `<linearGradient id="${u}v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset=".5" stop-color="#d99a2b"/><stop offset="1" stop-color="#6e400e"/></linearGradient>` +
      lin(u + 's', '#eef1f7', '#b7bfd2'),
    decor: () => points(ETOILES, '#fff', 0.8) + planete(80, 20),
    corps: u => `
      <path d="M22,100 C24,86 35,79 50,79 C65,79 76,86 78,100 Z" fill="url(#${u}s)"/>
      <ellipse cx="50" cy="81.5" rx="19" ry="4.2" fill="#8f9ab4"/>
      <circle cx="37" cy="92" r="3.4" fill="#2f5bd8" stroke="#fff" stroke-width=".8"/>
      <path d="M72.5,30 L78,20" stroke="#aeb7cc" stroke-width="1.4" stroke-linecap="round"/><circle cx="78.4" cy="19.4" r="1.6" fill="#ff5a5a"/>
      <circle cx="50" cy="50" r="31" fill="url(#${u}h)"/>
      <rect x="15.5" y="43" width="6" height="13" rx="3" fill="#9aa6c0"/><rect x="78.5" y="43" width="6" height="13" rx="3" fill="#9aa6c0"/>
      <path d="M27.5,48 C27.5,36 37.5,29.5 50,29.5 C62.5,29.5 72.5,36 72.5,48 C72.5,60.5 62.5,67 50,67 C37.5,67 27.5,60.5 27.5,48 Z" fill="url(#${u}v)" stroke="#aeb7cc" stroke-width="2"/>
      <circle cx="61" cy="58" r="5.2" fill="#5fb3ff" opacity=".55"/><path d="M58.5,56 C60,55 61,57 62.5,56.5 C63.5,58 62,59.5 60.5,59.5 Z" fill="#7be08f" opacity=".6"/>
      ${points([[40, 50, 0.45], [45, 56, 0.35], [55, 45, 0.4], [36, 58, 0.35]], '#fff', 0.8)}
      <path d="M33,42 C35,36 40,33 46,32" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".75"/>
      <path d="M35.5,47 C36,45 37,43.5 38.5,42.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".5"/>`,
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { espace: DESSINS } })
