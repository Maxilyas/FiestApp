// Les contes · Arts & lettres — du lutin au griffon.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { etoile, lin, miroir, points, rad, reflet, type DessinDePortrait } from './outils'

/** La poussière d'or des contes, toujours aux mêmes places : celle du griffon de la maquette. */
const POUSSIERE: [number, number, number][] = [
  [18, 26, 0.8],
  [82, 22, 0.7],
  [15, 50, 0.6],
  [86, 48, 0.8],
  [26, 12, 0.6],
  [74, 10, 0.5],
]
const OR = '#f4d98a'

/** À une décimale : calculé, 18 + 0,6 s'écrirait parfois 18.599999999999998 dans la chaîne. */
const f = (n: number) => +n.toFixed(1)

/** Un flocon à six branches, d'un seul trait. */
const flocon = (x: number, y: number, r: number, op = 0.75) => {
  const a = r * 0.87
  const b = r / 2
  return `<path d="M${x},${f(y - r)}V${f(y + r)}M${f(x - a)},${f(y - b)}L${f(x + a)},${f(y + b)}M${f(x - a)},${f(y + b)}L${f(x + a)},${f(y - b)}" stroke="#fff" stroke-width=".7" stroke-linecap="round" opacity="${op}"/>`
}

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:lutin': {
    fond: ['#977fe2', '#41308f', '#140c38'],
    defs: u =>
      lin(u + 'k', '#74dc8e', '#1b7a43', 1, 1) +
      lin(u + 'p', '#fde2cc', '#f0b999') +
      lin(u + 'r', '#e5574c', '#9e2631') +
      rad(u + 'o', '#fff6c2', '#c98a1c'),
    decor: () =>
      points(POUSSIERE, OR, 0.8) +
      etoile(20, 38, 2.2, OR, 0.85) +
      etoile(84, 64, 1.8, OR, 0.7) +
      // Une amanite au pied du lutin : il sort du sous-bois des contes.
      `<path d="M18.9,71 C18.7,77 18.2,84 17,93 L23.5,93 C22.6,84 22.3,77 22.1,71 Z" fill="#cdb8ea" opacity=".45"/>
      <path d="M13.5,72 C13.5,67.5 16.8,65 20.5,65 C24.2,65 27.5,67.5 27.5,72 C25,70.8 16,70.8 13.5,72 Z" fill="#a8406a" opacity=".8"/>
      <g fill="#f3e6ff" opacity=".6"><circle cx="17.6" cy="68.6" r=".9"/><circle cx="22.4" cy="67.4" r=".7"/><circle cx="24.6" cy="70" r=".6"/></g>`,
    corps: u => `
      <path d="M24,100 C26,87 37,79 50,79 C63,79 74,87 76,100 Z" fill="url(#${u}r)"/>
      <path d="M33.5,83 C38.5,79 44,77.5 50,77.5 C56,77.5 61.5,79 66.5,83 L63.5,89 L59,84.5 L55,90.5 L50,85.5 L45,90.5 L41,84.5 L36.5,89 Z" fill="#6fd08a"/>
      <path d="M45,69 L45,80 L55,80 L55,69 Z" fill="#f0b999"/>
      <path d="M37,49 C31,47.5 25,43 20.5,37 C21.5,45.5 27,53.5 37.5,56.5 Z" fill="url(#${u}p)"/>
      <path d="M35.6,50.5 C31,49.2 27.5,46.3 24.6,42.4 C26.2,47.6 29.8,52 35.6,54 Z" fill="#f2a58c"/>
      ${miroir(`<path d="M37,49 C31,47.5 25,43 20.5,37 C21.5,45.5 27,53.5 37.5,56.5 Z" fill="url(#${u}p)"/><path d="M35.6,50.5 C31,49.2 27.5,46.3 24.6,42.4 C26.2,47.6 29.8,52 35.6,54 Z" fill="#f2a58c"/>`)}
      <path d="M35.5,48 C35.5,40 42,36 50,36 C58,36 64.5,40 64.5,48 C64.5,60 58.5,69.5 50,71 C41.5,69.5 35.5,60 35.5,48 Z" fill="url(#${u}p)"/>
      <path d="M35.8,44 C33.6,46.5 33.8,50 35.4,52.5 C35.9,49.5 37.2,47.2 39.8,45.6 Z" fill="#b8562c"/>
      ${miroir('<path d="M35.8,44 C33.6,46.5 33.8,50 35.4,52.5 C35.9,49.5 37.2,47.2 39.8,45.6 Z" fill="#b8562c"/>')}
      <path d="M34.5,40 C35.5,27 42.5,15 55.5,9 C63.5,5.5 71.5,7.5 75.5,14.5 C77,17.5 77.5,20.5 77,23.5 C74.5,19.5 70.5,17 66,17.5 C65,25 65.5,32 65.5,40 Z" fill="url(#${u}k)"/>
      <path d="M38.5,35.5 C39.5,27 44.5,18.5 53,13" stroke="#c4f5cf" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".6"/>
      <path d="M32.5,40.5 C38,36.5 62,36.5 67.5,40.5 L67.5,45 C62,41.2 38,41.2 32.5,45 Z" fill="#f2c14e"/>
      <circle cx="77" cy="26.6" r="3.3" fill="url(#${u}o)"/>
      <path d="M74.3,27.5 L79.7,27.5" stroke="#8a5a14" stroke-width=".7"/><circle cx="77" cy="29.2" r=".7" fill="#6a4410"/>
      <path d="M40.3,46.6 C41.8,45.1 45,45 46.6,46.2 M53.4,46.2 C55,45 58.2,45.1 59.7,46.6" stroke="#a0502a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <ellipse cx="43.5" cy="51" rx="2.4" ry="2.8" fill="#2a1810"/><ellipse cx="56.5" cy="51" rx="2.4" ry="2.8" fill="#2a1810"/>
      ${reflet(42.6, 50, 0.95)}${reflet(55.6, 50, 0.95)}
      <ellipse cx="40" cy="57.5" rx="3.2" ry="2" fill="#ff8a8a" opacity=".45"/><ellipse cx="60" cy="57.5" rx="3.2" ry="2" fill="#ff8a8a" opacity=".45"/>
      <g fill="#d98a6a" opacity=".7"><circle cx="39" cy="55" r=".45"/><circle cx="41.2" cy="55.6" r=".45"/><circle cx="61" cy="55" r=".45"/><circle cx="58.8" cy="55.6" r=".45"/></g>
      <ellipse cx="50" cy="56" rx="2.7" ry="2.3" fill="#f0957e"/><ellipse cx="49" cy="55.2" rx="1" ry=".6" fill="#fff" opacity=".6"/>
      <path d="M45,61 C47,65.8 53,65.8 55,61 C51.8,62.2 48.2,62.2 45,61 Z" fill="#7a2a24"/>
      <path d="M47.8,63.8 C49,64.9 51,64.9 52.2,63.8 C51,63.2 49,63.2 47.8,63.8 Z" fill="#e8747a"/>`,
  },

  'br:troll': {
    fond: ['#8f7bdb', '#3a2c8a', '#120b32'],
    defs: u =>
      rad(u + 't', '#b9c6a6', '#667a60') +
      rad(u + 'n', '#f2b9a0', '#a27862') +
      lin(u + 'v', '#b08658', '#6b4a2c') +
      lin(u + 'h', '#e07f34', '#8f3d16'),
    decor: () =>
      points(POUSSIERE, OR, 0.8) +
      `<circle cx="22" cy="24" r="7.5" fill="#fdf3c4" opacity=".85"/><circle cx="20" cy="22.5" r="1.3" fill="#e8dca4" opacity=".7"/><circle cx="24.5" cy="26.5" r=".9" fill="#e8dca4" opacity=".6"/>` +
      etoile(80, 34, 2, OR, 0.8) +
      etoile(14, 64, 1.6, OR, 0.7),
    corps: u => `
      <path d="M15,100 C17,84 31,75.5 50,75.5 C69,75.5 83,84 85,100 Z" fill="url(#${u}v)"/>
      <path d="M59,87 L67.5,86 L68.5,94.5 L60,95.5 Z" fill="#8f6a40" stroke="#4a321c" stroke-width=".6" stroke-dasharray="1.2 .9"/>
      <path d="M41,77 L50,86.5 L59,77" stroke="#5a3d22" stroke-width="1.2" fill="none" stroke-linejoin="round"/>
      <path d="M29.5,45.5 C23,40 14,39 10,43 C7.5,45.5 9,49 12,51.5 C17,55.5 23,57.5 29,58.5 Z" fill="url(#${u}t)"/>
      <path d="M27.5,48 C23,44.5 16.5,43.5 13.5,45.5 C12.5,47 13.5,48.8 15.5,50.3 C19.5,53 23.5,54.3 27.5,55 Z" fill="#c69a8c" opacity=".8"/>
      ${miroir(`<path d="M29.5,45.5 C23,40 14,39 10,43 C7.5,45.5 9,49 12,51.5 C17,55.5 23,57.5 29,58.5 Z" fill="url(#${u}t)"/><path d="M27.5,48 C23,44.5 16.5,43.5 13.5,45.5 C12.5,47 13.5,48.8 15.5,50.3 C19.5,53 23.5,54.3 27.5,55 Z" fill="#c69a8c" opacity=".8"/>`)}
      <path d="M50,29 C63,29 71,37 71.5,48 C74,56 72,66 66,71 C61,75 56,77.5 50,77.5 C44,77.5 39,75 34,71 C28,66 26,56 28.5,48 C29,37 37,29 50,29 Z" fill="url(#${u}t)"/>
      <ellipse cx="46" cy="36" rx="9" ry="4" fill="#d6e6c2" opacity=".35"/>
      <path d="M46.5,31 C43.5,25.5 43.5,20 46,15 C47,19.5 49,22 50.5,24 C51,19 53.5,15.5 57.5,13.5 C55.5,18.5 55.5,23 57,27 C58.5,24.5 61,23 63.5,22.5 C61.5,26 58.5,29.5 54.5,31.5 Z" fill="url(#${u}h)"/>
      <path d="M37.5,42.5 C39.5,39.8 44,39.3 46.8,40.8 M53.2,40.8 C56,39.3 60.5,39.8 62.5,42.5" stroke="#4d5c47" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="42.5" cy="47.8" rx="3.1" ry="3.3" fill="#fbf8ea"/><ellipse cx="57.5" cy="47.8" rx="3.1" ry="3.3" fill="#fbf8ea"/>
      <circle cx="43" cy="48.2" r="1.9" fill="#2a1d12"/><circle cx="57" cy="48.2" r="1.9" fill="#2a1d12"/>
      ${reflet(42.3, 47.4, 0.7)}${reflet(56.3, 47.4, 0.7)}
      <ellipse cx="35.5" cy="59" rx="3.8" ry="2.4" fill="#ee8a78" opacity=".4"/><ellipse cx="64.5" cy="59" rx="3.8" ry="2.4" fill="#ee8a78" opacity=".4"/>
      <path d="M39,67 C44,73.5 56,73.5 61,67 C55,69 45,69 39,67 Z" fill="#3a2418"/>
      <path d="M43.3,69.6 L44.3,65.8 L45.9,70.1 Z M54.1,70.1 L55.7,65.8 L56.7,69.6 Z" fill="#f7f1dc"/>
      <path d="M50,43.5 C53.5,43.5 55,47.5 55.5,50.5 C60.5,51.5 62.5,57 60,61 C57.5,65 42.5,65 40,61 C37.5,57 39.5,51.5 44.5,50.5 C45,47.5 46.5,43.5 50,43.5 Z" fill="url(#${u}n)"/>
      <ellipse cx="45.8" cy="54.5" rx="2.5" ry="1.5" fill="#fff" opacity=".45"/>
      <path d="M45.6,62 C46.5,61 47.7,61 48.3,62 M51.7,62 C52.3,61 53.5,61 54.4,62" stroke="#6b5a44" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <circle cx="62" cy="53" r="1" fill="#6f8a5f"/>`,
  },

  'br:yeti': {
    fond: ['#8479dc', '#342c8c', '#100b32'],
    defs: u =>
      rad(u + 'f', '#ffffff', '#c3cde8') +
      lin(u + 's', '#f6f8ff', '#b4bfdc') +
      lin(u + 'v', '#bcd2f4', '#7894d2'),
    decor: () =>
      points(POUSSIERE, OR, 0.7) + flocon(18, 34, 3) + flocon(83, 30, 2.6) + flocon(12, 66, 2.2, 0.6) + flocon(88, 64, 2.4, 0.6),
    corps: u => `
      <path d="M50,75 Q53.6,73.8 58.5,72.9 Q59.2,76.1 59.6,75.9 Q63.4,75.4 68.5,75.5 Q68.1,78.7 68.5,78.6 Q72.4,78.8 77.2,79.9 Q75.7,83 76.2,82.9 Q79.9,83.9 84.1,85.8 Q81.6,88.5 82,88.5 Q85.3,90.1 88.7,92.8 Q85.3,94.9 85.7,95 Q88.3,97.2 90.6,100.4 L9.4,100.4 Q11.7,97.2 14.3,95 Q14.7,94.9 11.3,92.8 Q14.7,90.1 18,88.5 Q18.4,88.5 15.9,85.8 Q20.1,83.9 23.8,82.9 Q24.3,83 22.8,79.9 Q27.6,78.8 31.5,78.6 Q31.9,78.7 31.5,75.5 Q36.6,75.4 40.4,75.9 Q40.8,76.1 41.5,72.9 Q46.4,73.8 50,75 Z" fill="url(#${u}s)"/>
      <path d="M22,90 C24.5,86.5 28,84 32,83 M78,90 C75.5,86.5 72,84 68,83 M33,96 C35.5,92.5 39,90.5 43,90 M67,96 C64.5,92.5 61,90.5 57,90" stroke="#a9b5d6" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M38,28.3 C40.5,24.5 43.5,22.5 46.5,22 C45.5,19.5 44.8,17.5 44.5,15 C47,16.5 48.8,18.3 50,20.5 C51.2,18.3 53,16.5 55.5,15 C55.2,17.5 54.5,19.5 53.5,22 C56.5,22.5 59.5,24.5 62,28.3 Q65.3,29.2 69.9,30.8 Q68.4,34.4 68.8,34.4 Q71.6,36.5 75.2,39.7 Q72.6,42.4 72.9,42.6 Q74.8,45.6 77.1,50 Q73.7,51.6 73.9,51.9 Q74.7,55.4 75.2,60.3 Q71.5,60.5 71.6,60.8 Q71.1,64.4 69.9,69.2 Q66.4,68 66.3,68.3 Q64.6,71.4 61.8,75.5 Q58.9,72.9 58.8,73.3 Q56.1,75.5 52,78.2 Q50.3,74.7 50,75 Q49.7,74.7 48,78.2 Q43.9,75.5 41.2,73.3 Q41.1,72.9 38.2,75.5 Q35.4,71.4 33.7,68.3 Q33.6,68 30.1,69.2 Q28.9,64.4 28.4,60.8 Q28.5,60.5 24.8,60.3 Q25.3,55.4 26.1,51.9 Q26.3,51.6 22.9,50 Q25.2,45.6 27.1,42.6 Q27.4,42.4 24.8,39.7 Q28.4,36.5 31.2,34.4 Q31.6,34.4 30.1,30.8 Q34.7,29.2 38,28.3 Z" fill="url(#${u}f)"/>
      <path d="M50,39 C57.5,39 62.5,42 64,47.5 C66,54 64,63 58,67.5 C55,69.8 45,69.8 42,67.5 C36,63 34,54 36,47.5 C37.5,42 42.5,39 50,39 Z" fill="url(#${u}v)"/>
      <path d="M36.5,45.5 L39.5,42 L41.5,46 L44.5,41.5 L47,45.5 L50,41 L53,45.5 L55.5,41.5 L58.5,46 L60.5,42 L63.5,45.5 C62,39 57,36 50,36 C43,36 38,39 36.5,45.5 Z" fill="#fff"/>
      <ellipse cx="43.5" cy="50.5" rx="2.5" ry="2.9" fill="#1c1f4a"/><ellipse cx="56.5" cy="50.5" rx="2.5" ry="2.9" fill="#1c1f4a"/>
      ${reflet(42.6, 49.5, 1)}${reflet(55.6, 49.5, 1)}
      <ellipse cx="39.5" cy="57" rx="3" ry="1.8" fill="#ff9ab8" opacity=".45"/><ellipse cx="60.5" cy="57" rx="3" ry="1.8" fill="#ff9ab8" opacity=".45"/>
      <path d="M46.5,54.5 C46.5,53 53.5,53 53.5,54.5 C53.5,56.5 51.5,58 50,58 C48.5,58 46.5,56.5 46.5,54.5 Z" fill="#2a2f6a"/>
      <ellipse cx="48.6" cy="54.3" rx=".9" ry=".45" fill="#fff" opacity=".6"/>
      <path d="M43,60.5 C45.5,67 54.5,67 57,60.5 C53,61.8 47,61.8 43,60.5 Z" fill="#2a2250"/>
      <path d="M47,64.2 C48.5,65.6 51.5,65.6 53,64.2 C51.5,63.3 48.5,63.3 47,64.2 Z" fill="#f28aa8"/>
      <path d="M45,61 L46,63.2 L47.2,61.3 Z M52.8,61.3 L54,63.2 L55,61 Z" fill="#fff"/>`,
  },

  'br:fee': {
    fond: ['#a27ce0', '#4b2c94', '#190c3a'],
    defs: u =>
      lin(u + 'p', '#a8704c', '#74442a') +
      lin(u + 'h', '#3a2426', '#170d10') +
      lin(u + 'w', '#f2fdff', '#a8dcf5', 1, 1) +
      lin(u + 'r', '#ffa6d4', '#d4468c') +
      lin(u + 'o', '#fff4b8', '#e0a83a'),
    decor: () =>
      points(POUSSIERE, OR, 0.8) + etoile(88, 16, 2.4, '#fff', 0.85) + etoile(70, 18, 1.6, OR, 0.9) + etoile(91, 38, 1.4, OR, 0.8),
    corps: u => `
      <g opacity=".72" stroke="#fff" stroke-width=".7">
        <path d="M45,76 C37,64 25,53 15.5,43 C11,38.5 13,31.5 19.5,32.5 C29,34 39,50 46.5,70 Z" fill="url(#${u}w)"/>
        <path d="M45,77 C37,74.5 26,74 18.5,77.5 C14.5,79.5 15,85 20,85.5 C28,86 38,82 45.5,79.5 Z" fill="url(#${u}w)"/>
        ${miroir(`<path d="M45,76 C37,64 25,53 15.5,43 C11,38.5 13,31.5 19.5,32.5 C29,34 39,50 46.5,70 Z" fill="url(#${u}w)"/><path d="M45,77 C37,74.5 26,74 18.5,77.5 C14.5,79.5 15,85 20,85.5 C28,86 38,82 45.5,79.5 Z" fill="url(#${u}w)"/>`)}
      </g>
      <path d="M43,71 C36,58 27,47 18.5,37.5 M57,71 C64,58 73,47 81.5,37.5" stroke="#fff" stroke-width=".6" fill="none" opacity=".6"/>
      <path d="M26,100 C28,88 38,80 50,80 C62,80 72,88 74,100 Z" fill="url(#${u}r)"/>
      <path d="M45,69 L45,81 L55,81 L55,69 Z" fill="#74442a"/>
      <path d="M40.5,81 C44,86.5 47.5,88.5 50,86.5 C52.5,88.5 56,86.5 59.5,81 C56,79.5 44,79.5 40.5,81 Z" fill="#74442a"/>
      <path d="M41,25 Q39,20 42.6,16.4 Q43.2,11.2 49,10.8 Q54.8,11.2 57.4,16.4 Q61,20 59,25 Z" fill="url(#${u}h)"/>
      <path d="M41.5,25.5 C46,23 54,23 58.5,25.5" stroke="#f2c14e" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M36.5,47 C36.5,39 42.5,34.5 50,34.5 C57.5,34.5 63.5,39 63.5,47 C63.5,59 57.5,68.5 50,70.5 C42.5,68.5 36.5,59 36.5,47 Z" fill="url(#${u}p)"/>
      <path d="M35.5,47.5 C34,36.5 41,27.5 50,27.5 C59,27.5 66,36.5 64.5,47.5 C62.5,40.5 57,36.8 50,36.8 C43,36.8 37.5,40.5 35.5,47.5 Z" fill="url(#${u}h)"/>
      <path d="M40.4,49.2 C41.6,46.6 45.4,46.6 46.6,49.2 M53.4,49.2 C54.6,46.6 58.4,46.6 59.6,49.2" stroke="#1a0f0c" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <ellipse cx="43.5" cy="50.2" rx="2.1" ry="2.4" fill="#1a0f0c"/><ellipse cx="56.5" cy="50.2" rx="2.1" ry="2.4" fill="#1a0f0c"/>
      ${reflet(42.7, 49.4, 0.85)}${reflet(55.7, 49.4, 0.85)}
      <path d="M40.4,48.2 L39.2,47.2 M59.6,48.2 L60.8,47.2" stroke="#1a0f0c" stroke-width=".9" stroke-linecap="round"/>
      <ellipse cx="40.5" cy="56" rx="3.2" ry="1.9" fill="#ff7aa0" opacity=".35"/><ellipse cx="59.5" cy="56" rx="3.2" ry="1.9" fill="#ff7aa0" opacity=".35"/>
      <path d="M50.3,51.8 C49.4,55 49.3,56.3 50.7,57" stroke="#4e2c18" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M46.2,60.4 C48.2,63.4 51.8,63.4 53.8,60.4 C51.6,61.2 48.4,61.2 46.2,60.4 Z" fill="#c8385a"/>
      <path d="M68.2,91 L80.2,32" stroke="#f5e3a8" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M65.6,85.5 C65.2,82.8 67.2,81.2 69.6,81.4 C72,81.6 73.6,83.4 73.2,86 C72.8,88.4 70.8,89.6 68.6,89.3 C66.8,89 65.8,87.6 65.6,85.5 Z" fill="url(#${u}p)"/>
      <path d="M66.2,84.2 L72.8,84.8 M66,86.5 L72.6,87.1" stroke="#4e2c18" stroke-width=".5" opacity=".7"/>
      <polygon points="80.5,21.7 82.3,26.1 87,26.4 83.3,29.4 84.5,34 80.5,31.5 76.5,34 77.7,29.4 74,26.4 78.7,26.1" fill="url(#${u}o)" stroke="#b8801a" stroke-width=".6" stroke-linejoin="round"/>
      <circle cx="79.3" cy="26.6" r=".9" fill="#fff" opacity=".85"/>`,
  },

  'br:sirene': {
    fond: ['#8e72dc', '#3b2b8e', '#140b36'],
    defs: u =>
      lin(u + 'p', '#e7b58c', '#c28a60') +
      lin(u + 'h', '#ffe596', '#dc9a3a') +
      lin(u + 'e', '#62e2d2', '#1f8ea0') +
      lin(u + 's', '#ffd8c8', '#ee8474'),
    decor: () =>
      points(POUSSIERE, OR, 0.7) +
      `<g fill="none" stroke="#fff" stroke-opacity=".45" stroke-width=".7">
        <circle cx="16" cy="66" r="2"/><circle cx="20" cy="58" r="1.2"/><circle cx="84" cy="34" r="1.6"/><circle cx="87" cy="42" r="1"/><circle cx="81" cy="72" r="1.4"/>
      </g>`,
    corps: u => `
      <path d="M50,25.5 C63.5,25.5 71.5,35 71.5,48 C71.5,54 77.5,56 77,62 C76.5,67 73,69 74,73.5 C75,78 80.5,80 80,86 C79.5,91 76.5,93 78,100 L22,100 C23.5,93 20.5,91 20,86 C19.5,80 25,78 26,73.5 C27,69 23.5,67 23,62 C22.5,56 28.5,54 28.5,48 C28.5,35 36.5,25.5 50,25.5 Z" fill="url(#${u}h)"/>
      <path d="M29.5,56 C26.5,63 30,69 28,77 M70.5,56 C73.5,63 70,69 72,77 M25,83 C23.5,89 26,94 25,99 M75,83 C76.5,89 74,94 75,99" stroke="#d09034" stroke-width=".8" fill="none" opacity=".6" stroke-linecap="round"/>
      <path d="M27,100 C29,88 38,80.5 50,80.5 C62,80.5 71,88 73,100 Z" fill="url(#${u}e)"/>
      <path d="M31.5,91 a3,3 0 0 0 6,0 a3,3 0 0 0 6,0 M56.5,91 a3,3 0 0 0 6,0 a3,3 0 0 0 6,0 M28.5,96.5 a3,3 0 0 0 6,0 a3,3 0 0 0 6,0 a3,3 0 0 0 6,0 M53.5,96.5 a3,3 0 0 0 6,0 a3,3 0 0 0 6,0 a3,3 0 0 0 6,0" stroke="#c4fff6" stroke-width=".8" fill="none" opacity=".6"/>
      <path d="M45.5,69 L45.5,81 L54.5,81 L54.5,69 Z" fill="#c28a60"/>
      <path d="M41,81 C45,87 55,87 59,81 C55,79.8 45,79.8 41,81 Z" fill="#c28a60"/>
      <g fill="#fff8ee"><circle cx="42" cy="82.8" r="1"/><circle cx="45.3" cy="85" r="1"/><circle cx="54.7" cy="85" r="1"/><circle cx="58" cy="82.8" r="1"/></g>
      <path d="M46.6,86 C47.6,84.2 52.4,84.2 53.4,86 L50,90.5 Z" fill="url(#${u}s)"/>
      <path d="M36.5,47 C36.5,39 42.5,34.5 50,34.5 C57.5,34.5 63.5,39 63.5,47 C63.5,59 57.5,68.5 50,70.5 C42.5,68.5 36.5,59 36.5,47 Z" fill="url(#${u}p)"/>
      <path d="M35,52 C33.5,37 40.5,29 50.5,29 C60,29 66.5,36 65,50 C62.5,42 58,37.5 52.5,36 C47,38.5 40,43.5 35,52 Z" fill="url(#${u}h)"/>
      <path d="M36.8,45 C33,55 36.5,63 33.5,72 C31.5,78 33,84 31,91 C36,86 38.5,79 38,71 C37.6,63 36.4,55 36.8,45 Z" fill="url(#${u}h)"/>
      ${miroir(`<path d="M36.8,45 C33,55 36.5,63 33.5,72 C31.5,78 33,84 31,91 C36,86 38.5,79 38,71 C37.6,63 36.4,55 36.8,45 Z" fill="url(#${u}h)"/>`)}
      <g transform="rotate(-28 36 32)">
        <path d="M36,39.5 L29.5,32.5 C29.5,27.5 32.5,25 36,25 C39.5,25 42.5,27.5 42.5,32.5 Z" fill="url(#${u}s)"/>
        <path d="M36,39.5 L32.3,28.5 M36,39.5 L36,26.5 M36,39.5 L39.7,28.5" stroke="#c85a52" stroke-width=".6" fill="none"/>
      </g>
      <path d="M40.4,49.2 C41.6,46.6 45.4,46.6 46.6,49.2 M53.4,49.2 C54.6,46.6 58.4,46.6 59.6,49.2" stroke="#3a1e14" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <ellipse cx="43.5" cy="50.2" rx="2.1" ry="2.4" fill="#1f3a3a"/><ellipse cx="56.5" cy="50.2" rx="2.1" ry="2.4" fill="#1f3a3a"/>
      ${reflet(42.7, 49.4, 0.85)}${reflet(55.7, 49.4, 0.85)}
      <ellipse cx="40.5" cy="56" rx="3.2" ry="1.9" fill="#ff8a8a" opacity=".4"/><ellipse cx="59.5" cy="56" rx="3.2" ry="1.9" fill="#ff8a8a" opacity=".4"/>
      <path d="M50.3,51.8 C49.4,55 49.3,56.3 50.7,57" stroke="#9a6440" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M46.2,60.4 C48.2,63.4 51.8,63.4 53.8,60.4 C51.6,61.2 48.4,61.2 46.2,60.4 Z" fill="#d4486a"/>`,
  },

  // Converti de la maquette approuvée, tel quel : la poussière d'or passe au décor.
  'br:griffon': {
    fond: ['#8b6fd8', '#3a2a88', '#130b33'],
    defs: u =>
      lin(u + 'p', '#fffaf0', '#d7c39b') +
      lin(u + 'q', '#f2b640', '#fff6e0') +
      lin(u + 'e', '#d99a3e', '#9a5d1c') +
      lin(u + 'b', '#ffe07a', '#d4861a') +
      lin(u + 'm', '#e3a54e', '#a8661f'),
    decor: () => points(POUSSIERE, OR, 0.8),
    corps: u => `
      <path d="M20,100 C22,84 33,73 43.5,71 L50,79 L56.5,71 C67,73 78,84 80,100 Z" fill="url(#${u}m)"/>
      <path d="M30,100 C31,92 36,86 41,83 C40,90 41,95 43,100 Z M70,100 C69,92 64,86 59,83 C60,90 59,95 57,100 Z" fill="#f0bd66" opacity=".7"/>
      <path d="M27,44 L20,27 L37,34 Z" fill="url(#${u}e)"/><path d="M73,44 L80,27 L63,34 Z" fill="url(#${u}e)"/>
      <path d="M28,40 L23.5,30 L33.5,34.5 Z M72,40 L76.5,30 L66.5,34.5 Z" fill="#f6d9a8"/>
      <g fill="url(#${u}q)">
        <path d="M50,8 C53.5,16 54.5,23 52.5,30 L47.5,30 C45.5,23 46.5,16 50,8 Z"/>
        <path d="M39,12 C43.5,18 45.5,24 45,31 L41,32 C38,26 37.5,19 39,12 Z"/>
        <path d="M61,12 C56.5,18 54.5,24 55,31 L59,32 C62,26 62.5,19 61,12 Z"/>
        <path d="M29,19 C35,23 38.5,28 39.5,34 L36,36 C31.5,32 29.5,26 29,19 Z"/>
        <path d="M71,19 C65,23 61.5,28 60.5,34 L64,36 C68.5,32 70.5,26 71,19 Z"/>
      </g>
      <path d="M50,24 C63,24 72,33 72,45 C72,54 67,60 62,64 C60,72 56,78 50,82 C44,78 40,72 38,64 C33,60 28,54 28,45 C28,33 37,24 50,24 Z" fill="url(#${u}p)"/>
      <g fill="none" stroke="#c7b184" stroke-width=".9" stroke-linecap="round" opacity=".7">
        <path d="M31,52 L34,55 L31,58 M34,57 L37,60 L34,63 M69,52 L66,55 L69,58 M66,57 L63,60 L66,63"/>
      </g>
      <path d="M31.5,42.5 C36.5,37.5 43,37.5 47.5,42 C43,41.8 37.5,43 33,45.5 Z" fill="#a98a55"/>
      <path d="M68.5,42.5 C63.5,37.5 57,37.5 52.5,42 C57,41.8 62.5,43 67,45.5 Z" fill="#a98a55"/>
      <circle cx="40" cy="46.5" r="3.7" fill="#f2a52b" stroke="#6a4a1a" stroke-width=".8"/><circle cx="60" cy="46.5" r="3.7" fill="#f2a52b" stroke="#6a4a1a" stroke-width=".8"/>
      <circle cx="40.3" cy="46.7" r="1.8" fill="#1a0f06"/><circle cx="59.7" cy="46.7" r="1.8" fill="#1a0f06"/>
      ${reflet(39.2, 45.6, 0.75)}${reflet(58.6, 45.6, 0.75)}
      <path d="M42.6,51.5 C44.8,48.3 55.2,48.3 57.4,51.5 C58.6,57.5 55.6,64.5 50,75 C44.4,64.5 41.4,57.5 42.6,51.5 Z" fill="url(#${u}b)"/>
      <path d="M42.6,51.5 C44.8,48.3 55.2,48.3 57.4,51.5 C55,52.6 45,52.6 42.6,51.5 Z" fill="#f7c64d"/>
      <ellipse cx="46.8" cy="54.3" rx="1" ry=".55" fill="#6a3e0c"/><ellipse cx="53.2" cy="54.3" rx="1" ry=".55" fill="#6a3e0c"/>
      <path d="M50,52.5 C50,60 50,65 50,71" stroke="#fff4c4" stroke-width=".9" opacity=".75" fill="none"/>`,
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { contes: DESSINS } })
