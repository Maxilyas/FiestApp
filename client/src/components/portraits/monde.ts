// Le tour du monde · Culture générale — du kangourou au panda roux.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { lin, miroir, points, reflet, rad, type DessinDePortrait } from './outils'

/** Le globe en filigrane, méridiens et parallèles : la branche du voyage, derrière chacun. */
const GLOBE =
  '<g fill="none" stroke="#fff" stroke-opacity=".08" stroke-width=".8"><circle cx="50" cy="50" r="40"/><ellipse cx="50" cy="50" rx="20" ry="40"/><ellipse cx="50" cy="50" rx="40" ry="14"/><path d="M10,50 H90 M50,10 V90"/></g>'

/** Des villes allumées sur ses lignes, là où le personnage ne les cache pas. */
const VILLES: [number, number, number][] = [
  [30, 15.4, 0.7],
  [84.6, 30, 0.8],
  [15.4, 30, 0.6],
  [86, 50, 0.6],
  [12.4, 63.7, 0.7],
  [70, 15.4, 0.5],
]

const DECOR = () => GLOBE + points(VILLES, '#fff4d6')

/** Arrondi à une décimale : les écailles se calculent, le SVG n'a pas besoin de plus. */
const n = (v: number) => +v.toFixed(1)

/** Une écaille de pangolin, pointe en bas, le bord haut bombé. */
const ecaille = (x: number, y: number, l: number, h: number) => {
  const d = l / 2
  return `M${n(x - d)},${y}c0,${n(h * 0.6)} ${n(d * 0.6)},${h} ${n(d)},${h}s${n(d)},${n(-h * 0.4)} ${n(d)},${-h}q${n(-d)},${n(-h * 0.3)} ${-l},0z`
}
/**
 * Une rangée d'écailles, d'un seul tracé : elles ont toutes la même hauteur,
 * donc le même dégradé. Posées de la rangée du bas à celle du haut, chacune
 * recouvre la base de la suivante, comme des tuiles.
 */
const rangee = (y: number, xs: number[], l: number, h: number) =>
  `<path d="${xs.map(x => ecaille(x, y, l, h)).join('')}"/>`

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:kangourou': {
    fond: ['#6cbfc4', '#236a7a', '#0a2830'],
    defs: u => rad(u + 't', '#dea06a', '#a8622f') + lin(u + 'n', '#bf7a44', '#7c4520') + lin(u + 'v', '#fbeedd', '#e6caa6'),
    decor: DECOR,
    // Le petit dans sa poche : de face, sans lui, un kangourou passe pour une biche.
    corps: u => `
      <path d="M24,100 C26,87 37,80 50,80 C63,80 74,87 76,100 Z" fill="url(#${u}n)"/>
      <path d="M38.5,100 C39.5,90 44,85 50,85 C56,85 60.5,90 61.5,100 Z" fill="url(#${u}v)"/>
      <path d="M46.3,88 C45,85 45.3,82.6 46.5,81.7 C47.9,83 48.4,85.2 48,87.6 Z" fill="#b8733f"/>
      ${miroir('<path d="M46.3,88 C45,85 45.3,82.6 46.5,81.7 C47.9,83 48.4,85.2 48,87.6 Z" fill="#b8733f"/>')}
      <ellipse cx="50" cy="91" rx="4.4" ry="3.9" fill="#cc8752"/>
      <circle cx="48.3" cy="90.4" r=".75" fill="#1d100a"/><circle cx="51.7" cy="90.4" r=".75" fill="#1d100a"/>
      <ellipse cx="50" cy="92.5" rx=".9" ry=".6" fill="#2b1a12"/>
      <path d="M38.5,100 C39,96.4 42.5,94 50,94 C57.5,94 61,96.4 61.5,100 Z" fill="#ead0ab"/>
      <path d="M40,95.6 C44,93.8 56,93.8 60,95.6" stroke="#b98b62" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <ellipse cx="45.7" cy="94.3" rx="1.7" ry="1.1" fill="#cc8752"/><ellipse cx="54.3" cy="94.3" rx="1.7" ry="1.1" fill="#cc8752"/>
      <path d="M37,37 C31.5,29 28,19.5 29,11 C29.3,8.6 31.8,8.2 33.4,10 C38.6,16 42.4,22.6 44.8,30 Z" fill="#b8733f"/>
      <path d="M37.8,32.6 C34,26.4 31.8,19.8 32,14 C35.4,17.8 38.8,23.2 40.9,29.2 Z" fill="#f2bfa4"/>
      <path d="M29.2,12.5 C29.2,9.4 31.4,8.2 33.4,10 C34.6,11.4 35.6,12.8 36.5,14.2 C34,13.2 31.4,12.6 29.2,12.5 Z" fill="#5a3218"/>
      ${miroir('<path d="M37,37 C31.5,29 28,19.5 29,11 C29.3,8.6 31.8,8.2 33.4,10 C38.6,16 42.4,22.6 44.8,30 Z" fill="#b8733f"/><path d="M37.8,32.6 C34,26.4 31.8,19.8 32,14 C35.4,17.8 38.8,23.2 40.9,29.2 Z" fill="#f2bfa4"/><path d="M29.2,12.5 C29.2,9.4 31.4,8.2 33.4,10 C34.6,11.4 35.6,12.8 36.5,14.2 C34,13.2 31.4,12.6 29.2,12.5 Z" fill="#5a3218"/>')}
      <path d="M50,28 C61.5,28 67.5,35.5 67,45 C66.5,52.5 62,57.5 59.5,63 C58,69 55.5,76.5 50,77.5 C44.5,76.5 42,69 40.5,63 C38,57.5 33.5,52.5 33,45 C32.5,35.5 38.5,28 50,28 Z" fill="url(#${u}t)"/>
      <ellipse cx="50" cy="37" rx="7.5" ry="4.5" fill="#eab47e" opacity=".5"/>
      <path d="M43.6,63 C44,58.4 56,58.4 56.4,63 C56.4,70.5 53.4,76.6 50,77.5 C46.6,76.6 43.6,70.5 43.6,63 Z" fill="url(#${u}v)"/>
      <ellipse cx="41.6" cy="47.6" rx="3" ry="3.3" fill="#1d100a"/><ellipse cx="58.4" cy="47.6" rx="3" ry="3.3" fill="#1d100a"/>
      ${reflet(40.5, 46.4, 1.1)}${reflet(57.3, 46.4, 1.1)}
      <circle cx="42.6" cy="49" r=".45" fill="#fff" opacity=".7"/><circle cx="59.4" cy="49" r=".45" fill="#fff" opacity=".7"/>
      <path d="M38.8,45.4 L37.2,44.2 M39.8,44.5 L38.8,42.9 M61.2,45.4 L62.8,44.2 M60.2,44.5 L61.2,42.9" stroke="#1d100a" stroke-width=".8" stroke-linecap="round"/>
      <ellipse cx="37.8" cy="57.5" rx="3" ry="1.8" fill="#ff9a7a" opacity=".35"/><ellipse cx="62.2" cy="57.5" rx="3" ry="1.8" fill="#ff9a7a" opacity=".35"/>
      <path d="M45.8,62.8 C45.8,60.1 54.2,60.1 54.2,62.8 C54.2,65.2 52,66.8 50,66.8 C48,66.8 45.8,65.2 45.8,62.8 Z" fill="#2b1a12"/>
      <ellipse cx="48" cy="62" rx="1.2" ry=".55" fill="#fff" opacity=".5"/>
      <path d="M50,66.8 L50,69.2 M47.2,70.2 C48.6,71.6 51.4,71.6 52.8,70.2" stroke="#6b3f22" stroke-width=".9" fill="none" stroke-linecap="round"/>`,
  },

  'br:lama': {
    fond: ['#5fb3cf', '#1f5e80', '#0a2434'],
    defs: u => lin(u + 'l', '#fffaf1', '#e6d6bd') + lin(u + 'm', '#f4e9d7', '#cdb795') + lin(u + 'r', '#dc3f58', '#a01f3e'),
    decor: DECOR,
    // Les pompons des Andes et la couverture tissée : en petit, c'est leur couleur qui dit « lama ».
    corps: u => `
      <path d="M39,62 C36.5,65 38.5,68.5 37,71.5 C35.5,74.5 37.5,78 36.5,81 C36,83 36.5,85 37,86 L63,86 C63.5,85 64,83 63.5,81 C62.5,78 64.5,74.5 63,71.5 C61.5,68.5 63.5,65 61,62 Z" fill="url(#${u}m)"/>
      <path d="M41.5,77.5 C43,76.3 44.8,76.7 45.4,78.3 M54.6,80 C56.1,78.8 57.9,79.2 58.5,80.8 M57.5,72.5 C58.6,71.6 59.8,71.8 60.3,72.9" stroke="#d6c3a2" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <path d="M18,100 C19,91 26,85.5 34,84.5 C42,86.5 58,86.5 66,84.5 C74,85.5 81,91 82,100 Z" fill="url(#${u}r)"/>
      <path d="M21.5,91.5 C29.5,88.3 40,89.8 50,89.8 C60,89.8 70.5,88.3 78.5,91.5" stroke="#f2c14e" stroke-width="1.4" fill="none"/>
      <path d="M36,91.6l1.4,1.4-1.4,1.4-1.4-1.4zM43,92l1.4,1.4-1.4,1.4-1.4-1.4zM50,92.1l1.4,1.4-1.4,1.4-1.4-1.4zM57,92l1.4,1.4-1.4,1.4-1.4-1.4zM64,91.6l1.4,1.4-1.4,1.4-1.4-1.4z" fill="#fff4d6"/>
      <path d="M24,97.5 C33,95.5 42,96.4 50,96.4 C58,96.4 67,95.5 76,97.5" stroke="#f59b2b" stroke-width="1.3" fill="none"/>
      <path d="M39.6,31.5 C34.5,26.5 31.2,18.5 32,9.8 C35.4,10.6 39,16 41.4,22.4 C42.4,25.4 42.8,28.4 42.4,31 Z" fill="#eadcc5"/>
      <path d="M39.6,28 C36.6,24 34.6,18.6 34.5,13.4 C36.6,15.4 38.7,19.6 40.1,23.8 Z" fill="#e3ad98"/>
      ${miroir('<path d="M39.6,31.5 C34.5,26.5 31.2,18.5 32,9.8 C35.4,10.6 39,16 41.4,22.4 C42.4,25.4 42.8,28.4 42.4,31 Z" fill="#eadcc5"/><path d="M39.6,28 C36.6,24 34.6,18.6 34.5,13.4 C36.6,15.4 38.7,19.6 40.1,23.8 Z" fill="#e3ad98"/>')}
      <path d="M50,24 C59.5,24 64.5,31 64.5,40 C64.5,48 61,53 59.5,58 C58.5,64 58,70 56,74 C54.5,77 45.5,77 44,74 C42,70 41.5,64 40.5,58 C39,53 35.5,48 35.5,40 C35.5,31 40.5,24 50,24 Z" fill="url(#${u}l)"/>
      <path d="M37,31.5 C33.5,27.5 36,22 41,22.5 C41.5,18 47.5,16 50.5,19.5 C53.5,16 59.5,18 59.5,22.5 C64.5,22 66.5,27.5 63,31.5 C58,28.5 42,28.5 37,31.5 Z" fill="#fffdf8"/>
      <path d="M42.5,25.5 C44,24 46,24 47,25 M52.5,24.5 C54,23.5 56,23.8 57,25" stroke="#e2d3bc" stroke-width=".8" fill="none" stroke-linecap="round"/>
      <path d="M34.4,18.5 C32.5,21 31,23.5 30.3,26 M36.8,23 C35.8,25.6 35,28 34.8,30.6" stroke="#f7d24a" stroke-width=".8" fill="none"/>
      <circle cx="30" cy="27.8" r="2.9" fill="#e8367a"/><circle cx="34.6" cy="32.4" r="2.5" fill="#f59b2b"/>
      <circle cx="29.1" cy="26.8" r=".9" fill="#fff" opacity=".45"/><circle cx="33.9" cy="31.5" r=".8" fill="#fff" opacity=".45"/>
      ${miroir('<path d="M34.4,18.5 C32.5,21 31,23.5 30.3,26 M36.8,23 C35.8,25.6 35,28 34.8,30.6" stroke="#f7d24a" stroke-width=".8" fill="none"/><circle cx="30" cy="27.8" r="2.9" fill="#e8367a"/><circle cx="34.6" cy="32.4" r="2.5" fill="#f59b2b"/><circle cx="29.1" cy="26.8" r=".9" fill="#fff" opacity=".45"/><circle cx="33.9" cy="31.5" r=".8" fill="#fff" opacity=".45"/>')}
      <ellipse cx="42.2" cy="45.5" rx="2.7" ry="3.1" fill="#1e120c"/><ellipse cx="57.8" cy="45.5" rx="2.7" ry="3.1" fill="#1e120c"/>
      ${reflet(41.2, 44.3, 1)}${reflet(56.8, 44.3, 1)}
      <path d="M39.6,43.4 L38,42.3 M40.4,42.6 L39.4,41 M60.4,43.4 L62,42.3 M59.6,42.6 L60.6,41" stroke="#1e120c" stroke-width=".8" stroke-linecap="round"/>
      <ellipse cx="38.4" cy="53.5" rx="2.8" ry="1.7" fill="#ff9a8a" opacity=".35"/><ellipse cx="61.6" cy="53.5" rx="2.8" ry="1.7" fill="#ff9a8a" opacity=".35"/>
      <path d="M43.5,63 C43.5,58.6 56.5,58.6 56.5,63 C56.5,70 53.6,75.2 50,75.2 C46.4,75.2 43.5,70 43.5,63 Z" fill="#e3cfb2"/>
      <ellipse cx="47.3" cy="63.4" rx="1.2" ry=".7" fill="#4a3526" transform="rotate(30 47.3 63.4)"/><ellipse cx="52.7" cy="63.4" rx="1.2" ry=".7" fill="#4a3526" transform="rotate(-30 52.7 63.4)"/>
      <path d="M50,65.6 L50,68.4 M46.6,68.8 C48.2,70.8 51.8,70.8 53.4,68.8" stroke="#6b4c38" stroke-width=".9" fill="none" stroke-linecap="round"/>`,
  },

  'br:fennec': {
    fond: ['#72c6bf', '#236b73', '#0a282c'],
    defs: u => lin(u + 's', '#f6dcab', '#d2a064') + lin(u + 'b', '#fffaf2', '#ecdcc4') + lin(u + 'r', '#fbe0d4', '#eab6a4'),
    decor: DECOR,
    corps: u => `
      <path d="M42.5,62 L57.5,62 L60,80 L40,80 Z" fill="#d9a96c"/>
      <path d="M25,100 C27,86.5 37,77.5 50,77.5 C63,77.5 73,86.5 75,100 Z" fill="url(#${u}s)"/>
      <path d="M40.5,100 C41.5,89.5 45.5,84 50,84 C54.5,84 58.5,89.5 59.5,100 Z" fill="url(#${u}b)"/>
      <path d="M34.5,48 C27.5,40 21.5,29 18.8,16.4 C19.2,14.8 20.6,14.2 22.2,14.8 C33,19.2 42,25.4 47.5,33.4 Z" fill="url(#${u}s)"/>
      <path d="M35.8,43 C30.4,36.4 26,28.4 23.8,19.6 C31.6,23 38.4,28 43,34.2 Z" fill="url(#${u}r)"/>
      <path d="M31.5,39.5 C32,36.5 33.5,34.5 35.5,33.5 M34.5,42.5 C35,39.8 36.5,38 38.5,37.2 M28.5,35.5 C29,33 30.5,31.2 32.2,30.4" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".85"/>
      ${miroir(`<path d="M34.5,48 C27.5,40 21.5,29 18.8,16.4 C19.2,14.8 20.6,14.2 22.2,14.8 C33,19.2 42,25.4 47.5,33.4 Z" fill="url(#${u}s)"/><path d="M35.8,43 C30.4,36.4 26,28.4 23.8,19.6 C31.6,23 38.4,28 43,34.2 Z" fill="url(#${u}r)"/><path d="M31.5,39.5 C32,36.5 33.5,34.5 35.5,33.5 M34.5,42.5 C35,39.8 36.5,38 38.5,37.2 M28.5,35.5 C29,33 30.5,31.2 32.2,30.4" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".85"/>`)}
      <path d="M50,33 C60,33 66,39.5 66,48 C66,55 62,60 58,65.5 C55.5,69.5 53,72.5 50,72.5 C47,72.5 44.5,69.5 42,65.5 C38,60 34,55 34,48 C34,39.5 40,33 50,33 Z" fill="url(#${u}s)"/>
      <ellipse cx="50" cy="39.5" rx="6.5" ry="3.8" fill="#fbe8c4" opacity=".65"/>
      <path d="M35.5,54 C32,56.5 31.5,61 33.5,64 C34.5,62.5 36,61.8 37.5,61.8 C37,63.5 37.5,65 38.5,66 C39,63 39.5,60 38.5,56.5 Z" fill="#fffaf2"/>
      <path d="M64.5,54 C68,56.5 68.5,61 66.5,64 C65.5,62.5 64,61.8 62.5,61.8 C63,63.5 62.5,65 61.5,66 C61,63 60.5,60 61.5,56.5 Z" fill="#fffaf2"/>
      <path d="M50,53 C55.5,53 60.5,55.5 63.5,59 C61,64.5 56,69.5 50,72.5 C44,69.5 39,64.5 36.5,59 C39.5,55.5 44.5,53 50,53 Z" fill="url(#${u}b)"/>
      <path d="M44.8,50.8 C45.6,55 46.6,58.6 47.6,62 M55.2,50.8 C54.4,55 53.4,58.6 52.4,62" stroke="#c0874a" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".7"/>
      <ellipse cx="41.4" cy="43.2" rx="3" ry="1.4" fill="#fffaf2" opacity=".8" transform="rotate(-12 41.4 43.2)"/><ellipse cx="58.6" cy="43.2" rx="3" ry="1.4" fill="#fffaf2" opacity=".8" transform="rotate(12 58.6 43.2)"/>
      <circle cx="42" cy="48" r="3" fill="#1b100a"/><circle cx="58" cy="48" r="3" fill="#1b100a"/>
      ${reflet(40.9, 46.9, 1.05)}${reflet(56.9, 46.9, 1.05)}
      <circle cx="43" cy="49.3" r=".45" fill="#fff" opacity=".7"/><circle cx="59" cy="49.3" r=".45" fill="#fff" opacity=".7"/>
      <path d="M39,48.5 L36.8,49.6 M61,48.5 L63.2,49.6" stroke="#8a5a30" stroke-width="1" stroke-linecap="round"/>
      <ellipse cx="38.5" cy="57" rx="2.8" ry="1.7" fill="#ff9a7a" opacity=".35"/><ellipse cx="61.5" cy="57" rx="2.8" ry="1.7" fill="#ff9a7a" opacity=".35"/>
      <path d="M47.5,64.4 C47.5,62.6 52.5,62.6 52.5,64.4 C52.5,66.2 51,67.4 50,67.4 C49,67.4 47.5,66.2 47.5,64.4 Z" fill="#1d130d"/>
      <ellipse cx="49" cy="63.9" rx=".8" ry=".4" fill="#fff" opacity=".5"/>
      <path d="M50,67.4 L50,69 M47.8,69.6 C48.9,70.6 51.1,70.6 52.2,69.6" stroke="#7a5238" stroke-width=".8" fill="none" stroke-linecap="round"/>`,
  },

  'br:axolotl': {
    fond: ['#58b0c9', '#1c5b79', '#0a2331'],
    defs: u =>
      rad(u + 't', '#ffd0dc', '#ee8dab') + lin(u + 'n', '#f7a8bf', '#d86f90') + lin(u + 'v', '#fff1f5', '#fbd2de'),
    decor: DECOR,
    // Les branchies en plumeau : un trait épais en tirets fait les barbes, la tige passe par-dessus.
    corps: u => `
      <path d="M24,100 C25,86 31,74 36,64 L64,64 C69,74 75,86 76,100 Z" fill="url(#${u}n)"/>
      <path d="M40,100 C41,90 45,85.5 50,85.5 C55,85.5 59,90 60,100 Z" fill="url(#${u}v)"/>
      <g fill="none" stroke="#f47ea2" stroke-width="6" stroke-dasharray=".9 .9">
        <path d="M32,41 C26,35.5 21,30 17,23.5"/><path d="M29.5,49 C23,47.5 17.5,46.5 11.5,46.5"/><path d="M31,57.5 C25,60 20.5,63 16,67.5"/>
      </g>
      <g fill="none" stroke="#c23a68" stroke-width="2.2" stroke-linecap="round">
        <path d="M32,41 C26,35.5 21,30 17,23.5"/><path d="M29.5,49 C23,47.5 17.5,46.5 11.5,46.5"/><path d="M31,57.5 C25,60 20.5,63 16,67.5"/>
      </g>
      ${miroir('<g fill="none" stroke="#f47ea2" stroke-width="6" stroke-dasharray=".9 .9"><path d="M32,41 C26,35.5 21,30 17,23.5"/><path d="M29.5,49 C23,47.5 17.5,46.5 11.5,46.5"/><path d="M31,57.5 C25,60 20.5,63 16,67.5"/></g><g fill="none" stroke="#c23a68" stroke-width="2.2" stroke-linecap="round"><path d="M32,41 C26,35.5 21,30 17,23.5"/><path d="M29.5,49 C23,47.5 17.5,46.5 11.5,46.5"/><path d="M31,57.5 C25,60 20.5,63 16,67.5"/></g>')}
      <path d="M50,31 C64.5,31 74,39 74,50 C74,61 64,68.5 50,68.5 C36,68.5 26,61 26,50 C26,39 35.5,31 50,31 Z" fill="url(#${u}t)"/>
      <ellipse cx="44" cy="37.5" rx="9" ry="3.8" fill="#fff" opacity=".3"/>
      <g fill="#d8668a" opacity=".5"><circle cx="46" cy="41" r=".7"/><circle cx="53" cy="39.5" r=".6"/><circle cx="57" cy="42.5" r=".5"/><circle cx="42" cy="44" r=".5"/></g>
      <circle cx="37" cy="48" r="3" fill="#2a1420"/><circle cx="63" cy="48" r="3" fill="#2a1420"/>
      ${reflet(35.9, 46.9, 1.1)}${reflet(61.9, 46.9, 1.1)}
      <circle cx="38" cy="49.3" r=".45" fill="#fff" opacity=".7"/><circle cx="64" cy="49.3" r=".45" fill="#fff" opacity=".7"/>
      <ellipse cx="33" cy="55" rx="3.3" ry="2" fill="#ff6f91" opacity=".45"/><ellipse cx="67" cy="55" rx="3.3" ry="2" fill="#ff6f91" opacity=".45"/>
      <circle cx="47" cy="51" r=".5" fill="#b84a72"/><circle cx="53" cy="51" r=".5" fill="#b84a72"/>
      <path d="M40.5,55.5 C44.5,60.5 55.5,60.5 59.5,55.5" stroke="#a3375d" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
  },

  'br:pangolin': {
    fond: ['#68bcc0', '#22656f', '#0a262c'],
    defs: u => lin(u + 'e', '#e0ae6c', '#8a5a2c') + lin(u + 'p', '#e8c6b6', '#ad8070') + lin(u + 'n', '#6b4526', '#3e2410'),
    decor: DECOR,
    // Un dôme d'écailles d'où sort un museau pointu : le capuchon rejoint le corps, sans marche.
    corps: u => `
      <path d="M18,100 C15,85 16,68 24,58 C28,52 31,47 36,45 L64,45 C69,47 72,52 76,58 C84,68 85,85 82,100 Z" fill="url(#${u}n)"/>
      <g fill="url(#${u}e)" stroke="#5a3a1c" stroke-width=".7">
        ${rangee(91, [25, 35, 45, 55, 65, 75], 11, 9.5)}${rangee(82, [20, 30, 40, 50, 60, 70, 80], 11, 9.5)}${rangee(73, [22, 31, 40, 60, 69, 78], 10, 9)}${rangee(64, [24, 33, 67, 76], 10, 9)}${rangee(56, [28, 72], 10, 8.5)}${rangee(46.5, [30.5, 69.5], 9, 8.5)}
      </g>
      <path d="M50,32 C58,32 62.5,38.5 62.5,46 C62.5,53 59,58.5 56,64 C54.2,68.5 52.3,75 50,75 C47.7,75 45.8,68.5 44,64 C41,58.5 37.5,53 37.5,46 C37.5,38.5 42,32 50,32 Z" fill="url(#${u}p)"/>
      <ellipse cx="48.6" cy="62" rx="1.3" ry="4.5" fill="#fff" opacity=".25"/>
      <g fill="url(#${u}e)" stroke="#5a3a1c" stroke-width=".7">
        ${rangee(37, [33, 41.5, 50, 58.5, 67], 9, 8)}${rangee(31, [37.2, 45.7, 54.3, 62.8], 9, 7.5)}${rangee(25.5, [41.5, 50, 58.5], 9, 7)}${rangee(21, [46, 54], 8.5, 6)}
      </g>
      <path d="M41.2,49.8 C42.4,48.4 44.8,48.4 46,49.8 M58.8,49.8 C57.6,48.4 55.2,48.4 54,49.8" stroke="#8a5a3a" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <circle cx="43.6" cy="52.3" r="2.3" fill="#20140c"/><circle cx="56.4" cy="52.3" r="2.3" fill="#20140c"/>
      ${reflet(42.8, 51.5, 0.8)}${reflet(55.6, 51.5, 0.8)}
      <ellipse cx="41.4" cy="58.4" rx="2.3" ry="1.4" fill="#ff9a7a" opacity=".4"/><ellipse cx="58.6" cy="58.4" rx="2.3" ry="1.4" fill="#ff9a7a" opacity=".4"/>
      <ellipse cx="50" cy="71.6" rx="2.2" ry="1.5" fill="#3a2418"/>
      <ellipse cx="49.2" cy="71.1" rx=".8" ry=".4" fill="#fff" opacity=".5"/>`,
  },

  // La maquette approuvée, telle quelle.
  'br:panda-roux': {
    fond: ['#63b6c7', '#22627c', '#0b2632'],
    defs: u => rad(u + 't', '#ec7a36', '#b3441a') + lin(u + 'n', '#4d2415', '#2b120a'),
    decor: () => GLOBE,
    corps: u => `
      <path d="M24,100 C26,88 37,80 50,80 C63,80 74,88 76,100 Z" fill="url(#${u}n)"/>
      <path d="M23.5,42 C19.5,30 23.5,19 32,16.5 C38.5,20 42.5,28 43,33 Z" fill="#c1501f" stroke="#f7ecdc" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M27,37 C25,29 28,23 32.3,21.5 C36.2,24.2 38.3,29 38.5,32.5 Z" fill="#3a1a10"/>
      ${miroir('<path d="M23.5,42 C19.5,30 23.5,19 32,16.5 C38.5,20 42.5,28 43,33 Z" fill="#c1501f" stroke="#f7ecdc" stroke-width="2.2" stroke-linejoin="round"/><path d="M27,37 C25,29 28,23 32.3,21.5 C36.2,24.2 38.3,29 38.5,32.5 Z" fill="#3a1a10"/>')}
      <path d="M22,56 C22,41 34,32 50,32 C66,32 78,41 78,56 C78,60 76,63 74,64 C70,74 60,79 50,79 C40,79 30,74 26,64 C24,63 22,60 22,56 Z" fill="url(#${u}t)"/>
      <path d="M22.5,58 C19,62 21.5,68.5 27.5,70.5 C25.8,66.5 26,62.5 28,60 Z" fill="#fbf3e6"/>
      ${miroir('<path d="M22.5,58 C19,62 21.5,68.5 27.5,70.5 C25.8,66.5 26,62.5 28,60 Z" fill="#fbf3e6"/>')}
      <ellipse cx="40.8" cy="44" rx="4.8" ry="3" fill="#fbf3e6"/><ellipse cx="59.2" cy="44" rx="4.8" ry="3" fill="#fbf3e6"/>
      <path d="M50,58 C57,58 66,61 70,66 C66,74 58,78.5 50,78.5 C42,78.5 34,74 30,66 C34,61 43,58 50,58 Z" fill="#fbf3e6"/>
      <path d="M40.5,53 C39.5,58.5 40.5,62.5 42.5,66 M59.5,53 C60.5,58.5 59.5,62.5 57.5,66" stroke="#8a3514" stroke-width="1.9" stroke-linecap="round" fill="none" opacity=".75"/>
      <circle cx="41" cy="51" r="3.3" fill="#1f110a"/><circle cx="59" cy="51" r="3.3" fill="#1f110a"/>
      ${reflet(39.9, 49.9, 1)}${reflet(57.9, 49.9, 1)}
      <path d="M46.3,64 C46.3,61.8 53.7,61.8 53.7,64 C53.7,66.5 51.6,68.2 50,68.2 C48.4,68.2 46.3,66.5 46.3,64 Z" fill="#1f110a"/>
      <path d="M50,68.2 L50,70.2 M47,71.2 C48.5,72.4 51.5,72.4 53,71.2" stroke="#7a4a33" stroke-width=".9" fill="none" stroke-linecap="round"/>`,
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { monde: DESSINS } })
