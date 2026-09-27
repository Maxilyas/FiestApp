// Les océans · Géographie — de l’hippocampe au narval.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { lin, miroir, rad, reflet, type DessinDePortrait } from './outils'

/** Deux rais de lumière tombés de la surface — ceux de la méduse, validée sur maquette. */
const RAIS = '<path d="M38,0 L47,0 L30,100 L17,100 Z M58,0 L63,0 L60,100 L50,100 Z" fill="#fff" opacity=".06"/>'

/** Des bulles cerclées, jamais pleines : pleines, on les prendrait pour les étoiles de l’espace. */
const bulles = (liste: [number, number, number][]) =>
  `<g fill="none" stroke="#fff" stroke-opacity=".4" stroke-width=".7">${liste.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`

/** Les bulles de la méduse, aux mêmes places. */
const BULLES: [number, number, number][] = [
  [19, 70, 2],
  [23, 62, 1.2],
  [81, 30, 1.6],
  [85, 40, 1],
  [77, 80, 1.4],
]

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:hippocampe': {
    fond: ['#41b2ca', '#10577a', '#041b2e'],
    defs: u => lin(u + 'o', '#ffd65c', '#e9801f', 1, 1) + lin(u + 'v', '#fff4c8', '#ffd27a') + lin(u + 'n', '#fff0b8', '#f6b24a', 1, 0),
    decor: () => RAIS + bulles([[16, 66, 1.8], [21, 76, 1.2], [80, 22, 1.6], [86, 34, 1], [82, 84, 1.3]]),
    corps: u => `
      <path d="M52,29 L51.5,19.5 L55,23 L57.5,15.5 L60.5,22.5 L63.5,18.5 L64.5,29 Z" fill="#f4a531"/>
      <g fill="#e27a1c"><path d="M68,32 L75.5,30.5 L70.5,37 Z"/><path d="M69.5,39.5 L76.5,40.5 L69.5,45 Z"/><path d="M67.5,47.5 L73.5,51 L66.5,53 Z"/></g>
      <path d="M69,62 C77,61 82,67 81,76 C77,76 72,73 68.5,71 Z" fill="url(#${u}n)" opacity=".92"/>
      <path d="M70,64 L79,66.5 M70,67.5 L80,71.5 M69.5,70.5 L77.5,74.5" stroke="#f0a640" stroke-width=".7"/>
      <path d="M60,86 C61.5,94 56,99 49,98.5 C43,98 39.5,93 41.5,89 C43.5,85.5 48.5,86 49,89.5 C49.3,91.5 47.5,92.5 46,91.8" stroke="url(#${u}o)" stroke-width="4.6" fill="none" stroke-linecap="round"/>
      <path d="M21,54 C29,52.5 36,50 41,45 C41,33 49,26 57,26 C66,26 71,33 70,42 C69,49 66,53 66,58 C73,64 74,76 68,84 C64,89 60,90 56,90 C50,89 43,86 40,80 C36,72 38,63 44,58 C43,57 42,57 41,57.5 C36,60 29,61 21,60 Z" fill="url(#${u}o)"/>
      <path d="M44,58.5 C39.5,63 38.5,71 41.5,77.5 C44,82.5 49,86 55,88 C51.5,83 48.5,77 47.5,70.5 C47,65.5 47,61.5 48,58.5 Z" fill="url(#${u}v)"/>
      <g fill="none" stroke="#d9711c" stroke-width=".9" stroke-linecap="round" opacity=".55">
        <path d="M40.5,65 C49,66 60,65 69,62 M40,71.5 C49,72.5 61,71.5 71,68.5 M42,78 C50,79 61,78.5 70,75 M46.5,84 C52,85 59,84.5 65,82"/>
      </g>
      <ellipse cx="54" cy="33" rx="7" ry="4" fill="#ffe7a0" opacity=".55"/>
      <ellipse cx="21" cy="57" rx="1.8" ry="3.5" fill="#e27a1c"/>
      <ellipse cx="20.6" cy="57" rx=".8" ry="1.6" fill="#5a2a10"/>
      <path d="M26,54.5 C30,53.5 34,52 37.5,50" stroke="#fff3c4" stroke-width="1" fill="none" stroke-linecap="round" opacity=".6"/>
      <ellipse cx="50" cy="45" rx="5.4" ry="5.2" fill="#fff6d8"/>
      <circle cx="49.6" cy="45.4" r="3.6" fill="#1d0f08"/>
      ${reflet(48.3, 44, 1.2)}<circle cx="51" cy="47" r=".5" fill="#fff" opacity=".7"/>
      <ellipse cx="57.5" cy="52" rx="3" ry="1.8" fill="#ff8a70" opacity=".4"/>`,
  },

  'br:tortue': {
    fond: ['#3aa2cf', '#0d4b72', '#03172c'],
    defs: u => rad(u + 'k', '#b67a3c', '#5a3514') + lin(u + 'c', '#e2b36a', '#b07434') + lin(u + 'p', '#b9dd6c', '#5e9336'),
    decor: () => RAIS + bulles([[16, 34, 1.8], [22, 24, 1.2], [84, 36, 1.5], [79, 26, 1], [86, 86, 1.2]]),
    // Vue de dessus, la tête levée vers nous : de face, la tortue n’était qu’un buste aux bras levés.
    // Les joints entre les écailles sont à demi transparents : verrouillée, sa carapace se lit encore.
    corps: u => `
      <path d="M32,57 C22,55 11,60 7,72 C13,69.5 22,70 31,73 Z" fill="url(#${u}p)"/>
      ${miroir(`<path d="M32,57 C22,55 11,60 7,72 C13,69.5 22,70 31,73 Z" fill="url(#${u}p)"/>`)}
      <path d="M13,65.5 L16.5,65 M19,61 L22.5,61 M87,65.5 L83.5,65 M81,61 L77.5,61" stroke="#4f7d2c" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>
      <ellipse cx="50" cy="76" rx="25" ry="22" fill="#4a2508" opacity=".6"/>
      <ellipse cx="50" cy="76" rx="25.8" ry="22.8" fill="none" stroke="url(#${u}k)" stroke-width="2.6"/>
      <g fill="url(#${u}c)" stroke="#f6d78e" stroke-width=".9" stroke-linejoin="round">
        <path d="M43.8,64.5 L50,61 L56.2,64.5 L56.2,71.5 L50,75 L43.8,71.5 Z"/><path d="M43.8,80.5 L50,77 L56.2,80.5 L56.2,87.5 L50,91 L43.8,87.5 Z"/>
        <path d="M30.9,70.1 L36,62.9 L42.3,64.7 L42.1,71.8 L36.9,77.1 L29.7,76.4 Z"/><path d="M69.1,70.1 L64,62.9 L57.7,64.7 L57.9,71.8 L63.1,77.1 L70.3,76.4 Z"/>
        <path d="M29.7,77.7 L36.8,78.9 L42.2,80.5 L42.2,87.5 L36,93 L28.9,87.6 Z"/><path d="M70.3,77.7 L63.2,78.9 L57.8,80.5 L57.8,87.5 L64,93 L71.1,87.6 Z"/>
      </g>
      <ellipse cx="50" cy="76" rx="24.4" ry="21.4" fill="none" stroke="#f6d78e" stroke-width=".9"/>
      <path d="M50,24.5 C60.5,24.5 67,31.5 67,40 C67,47.5 63,53 57.5,56.5 C55,58 52.2,59.3 50,59.8 C47.8,59.3 45,58 42.5,56.5 C37,53 33,47.5 33,40 C33,31.5 39.5,24.5 50,24.5 Z" fill="url(#${u}p)"/>
      <path d="M45.2,28.5 L50,26.6 L54.8,28.5 L55.2,33.5 L50,35.4 L44.8,33.5 Z M44.8,33.5 L39.6,32 M55.2,33.5 L60.4,32" stroke="#e3eea6" stroke-width=".8" fill="#86ad48" stroke-linejoin="round"/>
      <ellipse cx="42.2" cy="42.2" rx="4.4" ry="4.2" fill="#f4f7d0"/><ellipse cx="57.8" cy="42.2" rx="4.4" ry="4.2" fill="#f4f7d0"/>
      <circle cx="42.4" cy="42.5" r="3.3" fill="#1a1208"/><circle cx="57.6" cy="42.5" r="3.3" fill="#1a1208"/>
      ${reflet(41.3, 41.3, 1.1)}${reflet(56.5, 41.3, 1.1)}
      <ellipse cx="37.5" cy="49.5" rx="2.8" ry="1.7" fill="#ff8a7a" opacity=".35"/><ellipse cx="62.5" cy="49.5" rx="2.8" ry="1.7" fill="#ff8a7a" opacity=".35"/>
      <path d="M44.5,49.5 C46,47.6 54,47.6 55.5,49.5 C55.5,52 52.6,54 50,55 C47.4,54 44.5,52 44.5,49.5 Z" fill="#d6e694"/>
      <circle cx="48.5" cy="49.3" r=".55" fill="#4a5a2a"/><circle cx="51.5" cy="49.3" r=".55" fill="#4a5a2a"/>
      <path d="M44.8,52 C47,54.4 48.8,55.4 50,54.6 C51.2,55.4 53,54.4 55.2,52" stroke="#3e5a22" stroke-width=".9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  'br:meduse': {
    fond: ['#39aac6', '#0e4c69', '#03182a'],
    defs: u =>
      `<radialGradient id="${u}b" cx="45%" cy="25%" r="85%"><stop offset="0" stop-color="#fff0fb"/><stop offset=".45" stop-color="#f6a2dc"/><stop offset="1" stop-color="#9657d8"/></radialGradient>`,
    decor: () => RAIS + bulles(BULLES) + '<circle cx="50" cy="38" r="30" fill="#f6a2dc" opacity=".12"/>',
    corps: u => `
      <g fill="none" stroke-linecap="round">
        <path d="M31,52 C28,64 34,74 29,86 C27,92 30,97 28,100" stroke="#f7c4ea" stroke-width="1.1" opacity=".55"/>
        <path d="M69,52 C72,64 66,74 71,86 C73,92 70,97 72,100" stroke="#f7c4ea" stroke-width="1.1" opacity=".55"/>
        <path d="M36,54 C35,66 39,76 36,90" stroke="#f7c4ea" stroke-width=".9" opacity=".5"/>
        <path d="M64,54 C65,66 61,76 64,90" stroke="#f7c4ea" stroke-width=".9" opacity=".5"/>
        <path d="M42,55 C40,64 46,70 42,80 C39,88 44,94 42,100" stroke="#fbd0ef" stroke-width="3" opacity=".85"/>
        <path d="M50,56 C52,66 47,74 51,84 C54,92 49,96 51,100" stroke="#fbd0ef" stroke-width="3.3" opacity=".9"/>
        <path d="M58,55 C61,64 55,71 59,80 C62,88 57,94 59,100" stroke="#fbd0ef" stroke-width="3" opacity=".85"/>
      </g>
      <path d="M23.5,48 C23.5,29.5 35.5,19.5 50,19.5 C64.5,19.5 76.5,29.5 76.5,48 C76.5,50.4 75.3,51.3 73.2,51.2 C70.3,54.4 67.3,50.3 64.2,53.3 C61.2,56.3 58,51.3 55,54.3 C52.2,57.3 47.8,57.3 45,54.3 C42,51.3 38.8,56.3 35.8,53.3 C32.7,50.3 29.7,54.4 26.8,51.2 C24.7,51.3 23.5,50.4 23.5,48 Z" fill="url(#${u}b)" opacity=".96"/>
      <g fill="#ffe3f6" opacity=".55">
        <ellipse cx="44" cy="40" rx="4.5" ry="2.6" transform="rotate(-35 44 40)"/><ellipse cx="56" cy="40" rx="4.5" ry="2.6" transform="rotate(35 56 40)"/>
        <ellipse cx="44" cy="47" rx="4.5" ry="2.6" transform="rotate(35 44 47)"/><ellipse cx="56" cy="47" rx="4.5" ry="2.6" transform="rotate(-35 56 47)"/>
      </g>
      <path d="M31,35 C33,27 39,23 46,22 C39.5,26 35.5,30.5 33.5,37.5 Z" fill="#fff" opacity=".6"/>
      <circle cx="44.5" cy="44" r="1.7" fill="#5b2573"/><circle cx="55.5" cy="44" r="1.7" fill="#5b2573"/>
      ${reflet(44, 43.4, 0.55)}${reflet(55, 43.4, 0.55)}
      <path d="M48,47.6 C49.2,48.8 50.8,48.8 52,47.6" stroke="#5b2573" stroke-width=".8" fill="none" stroke-linecap="round"/>`,
  },

  'br:raie': {
    fond: ['#4ab6d6', '#115f88', '#041e34'],
    defs: u => lin(u + 'd', '#4b5a76', '#1a2234') + lin(u + 'w', '#ffffff', '#cbd7e5'),
    decor: () => RAIS + bulles([[16, 30, 1.8], [22, 22, 1.2], [84, 30, 1.5], [78, 22, 1], [80, 84, 1.3]]),
    corps: u => `
      <path d="M50,100 L50,90" stroke="#1a2234" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M50,40 C45,40 41,41 37,43 C28,46 14,50 3,56 C12,62 26,70 38,80 C44,85 47,90 50,96 C53,90 56,85 62,80 C74,70 88,62 97,56 C86,50 72,46 63,43 C59,41 55,40 50,40 Z" fill="url(#${u}d)"/>
      <path d="M50,46 C45,46 40,47 36,49 C28,52 18,55 10,57.5 C18,62 29,69 39,77 C44,81 47,86 50,91 C53,86 56,81 61,77 C71,69 82,62 90,57.5 C82,55 72,52 64,49 C60,47 55,46 50,46 Z" fill="url(#${u}w)"/>
      <g stroke="#9aabc0" stroke-width=".9" fill="none" stroke-linecap="round">
        <path d="M41,56 C42.5,57 44,57 45,56.5 M41.5,61 C43,62 44.5,62 45.5,61.5 M42.2,66 C43.6,67 45,67 46,66.5 M43,71 C44.3,72 45.5,72 46.5,71.6 M43.8,76 C45,77 46,77 47,76.6"/>
        <path d="M59,56 C57.5,57 56,57 55,56.5 M58.5,61 C57,62 55.5,62 54.5,61.5 M57.8,66 C56.4,67 55,67 54,66.5 M57,71 C55.7,72 54.5,72 53.5,71.6 M56.2,76 C55,77 54,77 53,76.6"/>
      </g>
      <path d="M37.5,44 C35,38 35,32 38,27 C39.5,25.5 41.5,26.5 41,28.5 C40,33 41,38 43,42.5 Z" fill="#2a3446"/>
      ${miroir('<path d="M37.5,44 C35,38 35,32 38,27 C39.5,25.5 41.5,26.5 41,28.5 C40,33 41,38 43,42.5 Z" fill="#2a3446"/>')}
      <path d="M42,44 C46,47.5 54,47.5 58,44 C57.5,48.5 54,51 50,51 C46,51 42.5,48.5 42,44 Z" fill="#0e1522"/>
      <ellipse cx="34.5" cy="47" rx="2.8" ry="3" fill="#fff"/><ellipse cx="65.5" cy="47" rx="2.8" ry="3" fill="#fff"/>
      <circle cx="34.8" cy="47.4" r="1.9" fill="#0e1522"/><circle cx="65.2" cy="47.4" r="1.9" fill="#0e1522"/>
      ${reflet(34.1, 46.6, 0.7)}${reflet(64.5, 46.6, 0.7)}`,
  },

  'br:baleine': {
    fond: ['#44a8cc', '#0f4e78', '#03172b'],
    defs: u => lin(u + 'd', '#5f7c9e', '#223450') + lin(u + 'w', '#f5f8fb', '#c2cfde'),
    decor: () => RAIS + bulles([[14, 56, 1.8], [18, 46, 1.1], [86, 52, 1.5], [83, 42, 1], [84, 86, 1.3]]),
    corps: u => `
      <g fill="none" stroke="#e3f7ff" stroke-linecap="round">
        <path d="M50,28 L50,13" stroke-width="3.2"/>
        <path d="M50,14 C46,9.5 40,9.5 36,14.5 M50,14 C54,9.5 60,9.5 64,14.5" stroke-width="2.4"/>
      </g>
      <g fill="#e3f7ff"><circle cx="34.5" cy="18.5" r="1.5"/><circle cx="65.5" cy="18.5" r="1.5"/><circle cx="42" cy="6.5" r="1.2"/><circle cx="58" cy="6.5" r="1.2"/><circle cx="50" cy="5" r="1.3"/></g>
      <path d="M25,64 C18,61.5 10,62.5 5,66.5 C3.8,69 5.3,71.3 8.5,71 C14,70.6 20,71.8 25,74.5 Z" fill="url(#${u}w)"/><path d="M6.5,65.5 C10,62.8 17,61.8 24,64" stroke="#7d93ae" stroke-width="1.6" fill="none" stroke-linecap="round"/><g fill="#7d93ae"><circle cx="9.5" cy="64" r="1.1"/><circle cx="14" cy="62.8" r="1.1"/><circle cx="18.5" cy="62.7" r="1"/></g>
      ${miroir(`<path d="M25,64 C18,61.5 10,62.5 5,66.5 C3.8,69 5.3,71.3 8.5,71 C14,70.6 20,71.8 25,74.5 Z" fill="url(#${u}w)"/><path d="M6.5,65.5 C10,62.8 17,61.8 24,64" stroke="#7d93ae" stroke-width="1.6" fill="none" stroke-linecap="round"/><g fill="#7d93ae"><circle cx="9.5" cy="64" r="1.1"/><circle cx="14" cy="62.8" r="1.1"/><circle cx="18.5" cy="62.7" r="1"/></g>`)}
      <path d="M21,100 C17,86 16,70 19,57 C23,39 35,28 50,28 C65,28 77,39 81,57 C84,70 83,86 79,100 Z" fill="url(#${u}d)"/>
      <path d="M26,61 C36,66 44,67 50,67 C56,67 64,66 74,61 C75,76 72,90 68,100 L32,100 C28,90 25,76 26,61 Z" fill="url(#${u}w)"/>
      <g stroke="#8ea2bb" stroke-width=".9" fill="none" stroke-linecap="round">
        <path d="M33,66 C34.5,77 36.5,89 38.5,100 M39.5,67 C40.5,78 42,89 43.5,100 M46,67.5 C46.5,78 47,89 47.6,100 M54,67.5 C53.5,78 53,89 52.4,100 M60.5,67 C59.5,78 58,89 56.5,100 M67,66 C65.5,77 63.5,89 61.5,100"/>
      </g>
      <path d="M24,58 C34,65.5 66,65.5 76,58" stroke="#16202f" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <ellipse cx="44" cy="37" rx="10" ry="5" fill="#8aa3c2" opacity=".35"/>
      <g fill="#7f98b8"><circle cx="43" cy="35" r="1.3"/><circle cx="50" cy="33" r="1.4"/><circle cx="57" cy="35" r="1.3"/><circle cx="46.5" cy="40" r="1.1"/><circle cx="53.5" cy="40" r="1.1"/></g>
      <ellipse cx="34" cy="52.5" rx="3.4" ry="3.2" fill="#e9eff6"/><ellipse cx="66" cy="52.5" rx="3.4" ry="3.2" fill="#e9eff6"/>
      <circle cx="34.3" cy="52.8" r="2.3" fill="#0f1826"/><circle cx="65.7" cy="52.8" r="2.3" fill="#0f1826"/>
      ${reflet(33.5, 52, 0.8)}${reflet(64.9, 52, 0.8)}
      <ellipse cx="29" cy="58" rx="2.6" ry="1.5" fill="#ff8aa0" opacity=".35"/><ellipse cx="71" cy="58" rx="2.6" ry="1.5" fill="#ff8aa0" opacity=".35"/>`,
  },

  'br:narval': {
    fond: ['#3a9dc4', '#0c476a', '#021628'],
    defs: u => lin(u + 'g', '#e3e9f0', '#8a9ab0') + lin(u + 'i', '#fffcef', '#d6c496', 1, 0) + lin(u + 'v', '#eef3f8', '#cdd7e3'),
    decor: () => RAIS + bulles(BULLES),
    corps: u => `
      <path d="M45.5,36 L52.6,4.2 L54.4,4.6 L54.5,36 Z" fill="url(#${u}i)"/>
      <path d="M47.5,31 L53.7,28.5 M48.5,26 L53.8,23.5 M49.5,21 L54,18.5 M50.5,16 L54.1,13.5 M51.5,11 L54.3,8.5" stroke="#b3a075" stroke-width=".8" stroke-linecap="round"/>
      <path d="M30,75 C23,73 15,75 11,79 C10,77 10.5,74 12,72 C9,73 7.5,77 8.5,81 C13,85 22,84 30,82 Z" fill="#94a5ba"/>
      ${miroir('<path d="M30,75 C23,73 15,75 11,79 C10,77 10.5,74 12,72 C9,73 7.5,77 8.5,81 C13,85 22,84 30,82 Z" fill="#94a5ba"/>')}
      <path d="M50,31 C64,31 75,41 76,55 C77,68 73,80 72,100 L28,100 C27,80 23,68 24,55 C25,41 36,31 50,31 Z" fill="url(#${u}g)"/>
      <path d="M37.5,75 C42,71.5 58,71.5 62.5,75 C64.5,83 64,92 63,100 L37,100 C36,92 35.5,83 37.5,75 Z" fill="url(#${u}v)"/>
      <g fill="#56687f" opacity=".45">
        <ellipse cx="35" cy="42" rx="2.2" ry="1.5"/><ellipse cx="64" cy="40" rx="2" ry="1.4"/><ellipse cx="29.5" cy="55" rx="1.6" ry="2.2"/><ellipse cx="71" cy="54" rx="1.5" ry="2"/>
        <ellipse cx="41" cy="36.5" rx="1.4" ry="1"/><ellipse cx="58.5" cy="35.5" rx="1.3" ry=".9"/><ellipse cx="31" cy="67" rx="1.8" ry="1.3"/><ellipse cx="69.5" cy="66" rx="1.7" ry="1.2"/>
        <circle cx="33" cy="48" r="1"/><circle cx="67" cy="47" r="1"/><circle cx="30" cy="78" r="1.3"/><circle cx="71" cy="80" r="1.2"/>
      </g>
      <ellipse cx="45" cy="40" rx="9" ry="5" fill="#fff" opacity=".35"/>
      <circle cx="40.5" cy="52.5" r="2.6" fill="#141b26"/><circle cx="59.5" cy="52.5" r="2.6" fill="#141b26"/>
      ${reflet(39.7, 51.6, 0.9)}${reflet(58.7, 51.6, 0.9)}
      <ellipse cx="35.5" cy="58" rx="2.8" ry="1.6" fill="#ff8aa0" opacity=".4"/><ellipse cx="64.5" cy="58" rx="2.8" ry="1.6" fill="#ff8aa0" opacity=".4"/>
      <path d="M45.5,62 C48,64.5 52,64.5 54.5,62" stroke="#3a4658" stroke-width="1" fill="none" stroke-linecap="round"/>`,
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { oceans: DESSINS } })
