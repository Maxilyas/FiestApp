// Les mythologies · Histoire — du Minotaure à Athéna.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { etoile, lin, miroir, reflet, rad, type DessinDePortrait } from './outils'

/** Les étoiles d'or à quatre branches, toujours aux mêmes places. */
const ETOILES: [number, number][] = [
  [17, 22],
  [83, 26],
  [14, 48],
  [86, 54],
  [28, 11],
]
const etoiles = (liste = ETOILES) => liste.map(([x, y]) => etoile(x, y, 2.2, '#f4d98a', 0.85)).join('')

/** La lueur dorée derrière la tête : un dieu, ça rayonne un peu. */
const LUEUR = '<circle cx="50" cy="40" r="25" fill="#f1c865" opacity=".16"/>'

/** L'or des bijoux, des couronnes et des armes : le même pour tous. */
const OR = (u: string) => lin(u + 'o', '#fff0b8', '#c98f2c')

/** Trois serpents de la chevelure, d'un côté : le miroir fait les trois autres. */
const SERPENTS = 'M44,31c-2-6-7-6.5-9-11.5c-1.2-3-4-5-7-4.5M37,36c-6-1-10-5-15-5c-3,0-4.5,2-5.5,4M35.5,46c-5.5,2-6.5,8-10.5,11c-2.5,2-5,1.5-6.5,0'

/** Un serpent annelé : le corps, puis ses anneaux sombres, du même tracé. */
const anneles = (d: string) =>
  `<path d="${d}" stroke="#3f8f3c" stroke-width="4.4" stroke-linecap="round" fill="none"/><path d="${d}" stroke="#1f5a27" stroke-width="4.4" stroke-dasharray="1.1 2.3" fill="none"/>`

/** Leurs têtes : des yeux jaunes, deux langues fourchues — des serpents, pas des tuyaux. */
const TETES =
  '<path d="M24.2,15.6l-2.6.3-1-.9m1,.9-.8,1.1M15.4,39l-.8,2.4-1,.4m1-.4.2,1.2" stroke="#e03a4a" stroke-width=".6" fill="none" stroke-linecap="round"/>' +
  '<g fill="#4f9f48"><ellipse cx="26.2" cy="15.3" rx="3.5" ry="2.6" transform="rotate(-8 26.2 15.3)"/><ellipse cx="16" cy="37.2" rx="3.5" ry="2.6" transform="rotate(65 16 37.2)"/><ellipse cx="16.8" cy="56" rx="3.5" ry="2.6" transform="rotate(15 16.8 56)"/></g>' +
  '<g fill="#f5d547"><circle cx="26" cy="14.3" r=".85"/><circle cx="15" cy="36.6" r=".85"/><circle cx="16.5" cy="55" r=".85"/></g>'

/** Une vague qui s'enroule, au bas du disque : Poséidon sort de la mer. */
const VAGUE =
  '<path d="M2,86 C4,74 11,67 19,67 C25,67 28.5,71.5 26.5,75 C25,77.5 21.5,77 21,74.5 C20.6,72.6 22.6,71.8 23.6,73 C23,70 19,69.6 16,71.6 C12,74.4 10,80 9.5,86 Z" fill="#8fe0ee" opacity=".4"/>' +
  '<path d="M0,94 C3,86 8,81 14,81 C18.5,81 21,84 19.8,86.8 C18.8,88.6 16.4,88.2 16.1,86.5" stroke="#8fe0ee" stroke-width="1.2" fill="none" opacity=".45" stroke-linecap="round"/>'

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:minotaure': {
    fond: ['#5577d6', '#1d3486', '#091436'],
    defs: u =>
      OR(u) +
      rad(u + 't', '#8f5a38', '#4a2716') +
      lin(u + 'n', '#6e4128', '#34180b') +
      lin(u + 'm', '#cf9a7c', '#96604a') +
      // La corne s'assombrit vers sa pointe : le dégradé suit sa longueur, pas sa hauteur.
      `<linearGradient id="${u}co" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a3624"/><stop offset=".32" stop-color="#e6cf9f"/><stop offset="1" stop-color="#fff6e0"/></linearGradient>`,
    decor: () => LUEUR + etoiles(),
    corps: u => {
      const corne = `<path d="M39,37.5 C31,39 22,37 17.5,29 C15.5,25 15.5,20.5 17.5,16.5 C19,22 23,27.5 30,30 C33.5,31.2 36.5,31.2 38.5,30.5 Z" fill="url(#${u}co)"/><path d="M35.5,44 C29,41 22.5,42 18.5,46.5 C23,50 30,50 35.5,48 Z" fill="#5e3520"/><path d="M33.5,45.2 C29,44 25,44.5 22,46.5 C25.5,48.2 30,48.2 33.5,47 Z" fill="#d99a80"/>`
      return `
      <path d="M16,100 C19,84 33,76.5 50,76.5 C67,76.5 81,84 84,100 Z" fill="url(#${u}n)"/>
      <path d="M50,89 L50,100 M36,93 C41,95 46,95 49,93 M64,93 C59,95 54,95 51,93" stroke="#2a1208" stroke-width="1" fill="none" opacity=".45"/>
      <path d="M35.5,80.5 C42,85.5 58,85.5 64.5,80.5" stroke="url(#${u}o)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="86.3" r="2.6" fill="url(#${u}o)"/>
      ${corne}${miroir(corne)}
      <path d="M50,27 C61.5,27 67.5,34 67.5,43 C67.5,50 64.5,54.5 62.5,59.5 C61.5,65 61.5,70.5 59.5,74.5 C57,79 43,79 40.5,74.5 C38.5,70.5 38.5,65 37.5,59.5 C35.5,54.5 32.5,50 32.5,43 C32.5,34 38.5,27 50,27 Z" fill="url(#${u}t)"/>
      <ellipse cx="50" cy="39" rx="8" ry="4.5" fill="#b07548" opacity=".45"/>
      <path d="M40.5,33 C40.5,27.5 45.5,24.5 50,27.5 C54.5,24.5 59.5,27.5 59.5,33 C57,31 53.5,31.5 50,34.5 C46.5,31.5 43,31 40.5,33 Z" fill="#2e170a"/>
      <path d="M37.8,47.5 C39.2,44.8 44,44.4 45.8,47 C44.4,49.8 39.6,50.2 37.8,47.5 Z M62.2,47.5 C60.8,44.8 56,44.4 54.2,47 C55.6,49.8 60.4,50.2 62.2,47.5 Z" fill="#fbeede"/>
      <g fill="#2a140a"><circle cx="42" cy="47.3" r="1.9"/><circle cx="58" cy="47.3" r="1.9"/></g>
      ${reflet(41.4, 46.6, 0.6)}${reflet(57.4, 46.6, 0.6)}
      <path d="M37,44 C39.8,42 43.6,42 46.4,43.8 M63,44 C60.2,42 56.4,42 53.6,43.8" stroke="#24110a" stroke-width="1.7" fill="none" stroke-linecap="round"/>
      <path d="M38.5,64.5 C38.5,58 61.5,58 61.5,64.5 C61.5,73 57,79 50,79 C43,79 38.5,73 38.5,64.5 Z" fill="url(#${u}m)"/>
      <ellipse cx="46" cy="61" rx="3" ry="1.2" fill="#fff" opacity=".3"/>
      <ellipse cx="44.6" cy="66.4" rx="2.4" ry="1.5" fill="#3a1d12" transform="rotate(25 44.6 66.4)"/>
      <ellipse cx="55.4" cy="66.4" rx="2.4" ry="1.5" fill="#3a1d12" transform="rotate(-25 55.4 66.4)"/>
      <path d="M45.5,76 C48,77.3 52,77.3 54.5,76" stroke="#6b3a28" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M46.8,69.2 A3.6,3.6 0 1 0 53.2,69.2" stroke="url(#${u}o)" stroke-width="1.7" fill="none"/>`
    },
  },

  'br:gorgone': {
    fond: ['#4f6acb', '#1c2d7c', '#0a1233'],
    defs: u =>
      rad(u + 'p', '#d9f0c6', '#9ccb8c') + lin(u + 'r', '#f4d27a', '#b98530') + lin(u + 'h', '#3f8a45', '#1d4f26'),
    decor: () => LUEUR + etoiles(ETOILES.slice(0, 4)),
    corps: u => `
      <path d="M22,100 C24,86 36,78.5 50,78.5 C64,78.5 76,86 78,100 Z" fill="url(#${u}r)"/>
      <path d="M45.5,63 C45.5,70 45,75 44,78.6 C46,82 48,85 50,87 C52,85 54,82 56,78.6 C55,75 54.5,70 54.5,63 Z" fill="#a4cd94"/>
      ${anneles(SERPENTS)}${TETES}${miroir(anneles(SERPENTS) + TETES)}
      ${anneles('M50,29c-2.5-6,2.5-10,0-16')}
      <ellipse cx="50" cy="11.4" rx="2.6" ry="3.4" fill="#4f9f48"/>
      <g fill="#f5d547"><circle cx="48.9" cy="10.8" r=".75"/><circle cx="51.1" cy="10.8" r=".75"/></g>
      <path d="M50,33 C59,33 64.5,39.5 64.5,48 C64.5,58.5 58,67 50,69.5 C42,67 35.5,58.5 35.5,48 C35.5,39.5 41,33 50,33 Z" fill="url(#${u}p)"/>
      <path d="M34.5,47 C32.5,34 40,26.5 50,26.5 C60,26.5 67.5,34 65.5,47 C63,40 57.5,36 50,36 C42.5,36 37,40 34.5,47 Z" fill="url(#${u}h)"/>
      <path d="M38.8,48.2 C40.2,45.4 44.6,45 46.6,47.6 C45.2,50.4 40.8,50.8 38.8,48.2 Z M61.2,48.2 C59.8,45.4 55.4,45 53.4,47.6 C54.8,50.4 59.2,50.8 61.2,48.2 Z" fill="#f5d547" stroke="#23401f" stroke-width=".9"/>
      <g fill="#1a1a10"><ellipse cx="42.7" cy="47.9" rx=".75" ry="1.9"/><ellipse cx="57.3" cy="47.9" rx=".75" ry="1.9"/></g>
      ${reflet(41.7, 47.1, 0.5)}${reflet(56.3, 47.1, 0.5)}
      <path d="M38.8,48.2 L36.8,47 M61.2,48.2 L63.2,47 M38.2,44.4 C40.6,42.6 44.2,42.6 46.6,44 M61.8,44.4 C59.4,42.6 55.8,42.6 53.4,44" stroke="#23401f" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M50.3,50 C49.6,53.4 49.4,54.8 50.8,55.5" stroke="#6f9c63" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <g fill="#ff8fa3" opacity=".3"><ellipse cx="39.5" cy="55.2" rx="2.9" ry="1.7"/><ellipse cx="60.5" cy="55.2" rx="2.9" ry="1.7"/></g>
      <path d="M46.2,59.6 C48.4,58.6 51.6,58.6 53.8,59.6 C51.8,61.8 48.2,61.8 46.2,59.6 Z" fill="#8a3a6a"/>`,
  },

  'br:thor': {
    fond: ['#4d7ad4', '#1a3888', '#07143a'],
    defs: u =>
      OR(u) +
      lin(u + 'p', '#f7d8c0', '#e4ae8e') +
      lin(u + 'b', '#ef7f3e', '#ad431b') +
      lin(u + 'h', '#f2f5f9', '#8f9aad', 1, 1) +
      lin(u + 'k', '#8f7a64', '#4a3c2e'),
    decor: () =>
      LUEUR +
      etoiles([ETOILES[3], ETOILES[4]]) +
      // L'éclair à gauche répond au marteau, à droite.
      '<path d="M21,40 L12.5,56 L18.5,56 L11,73 L25,52 L18.8,52 L24.5,40 Z" fill="#ffe27a" opacity=".85"/>',
    corps: u => {
      // Un manteau de fourrure, pas une cape rouge : le dieu des sagas, pas celui des films.
      const aile = `<path d="M35,33 C30,27 26,21.5 23,14.5 C28.5,16.5 33,21.5 36.5,29 Z M34,35.5 C28,32.5 22,28.5 17.5,23.5 C24,24 29.5,27 35,31.5 Z M33.5,38.5 C27.5,37.5 21,35.5 15.5,32.5 C21.5,31 28,31.5 34,34.5 Z" fill="#f3f6fa" stroke="#9fb0c8" stroke-width=".6"/>`
      const meche = `<path d="M33.5,40 C31,48 31.5,57 34.5,63 L38.5,59 C37.5,53 37.5,47 38.5,41 Z" fill="url(#${u}b)"/>`
      return `
      <path d="M16,100 C18,85 32,77 50,77 C68,77 82,85 84,100 Z" fill="url(#${u}k)"/>
      <path d="M22,90 C22,85 25,82.5 28.5,82.5 C29,79.5 32.5,78 35,79 C36.5,76.5 40,76 42.5,77.5 C44.5,76 47.5,76 50,77 C52.5,76 55.5,76 57.5,77.5 C60,76 63.5,76.5 65,79 C67.5,78 71,79.5 71.5,82.5 C75,82.5 78,85 78,90 C73,87.5 68,86.5 63,86.5 C58,84.5 42,84.5 37,86.5 C32,86.5 27,87.5 22,90 Z" fill="#c7b59c"/>
      <g fill="url(#${u}o)" stroke="#9a7428" stroke-width=".7"><circle cx="33" cy="88.5" r="2.8"/><circle cx="67" cy="88.5" r="2.8"/></g>
      ${aile}${miroir(aile)}${meche}${miroir(meche)}
      <path d="M50,33 C59.5,33 64.5,39.5 64.5,48 C64.5,57 60,64 50,66.5 C40,64 35.5,57 35.5,48 C35.5,39.5 40.5,33 50,33 Z" fill="url(#${u}p)"/>
      <path d="M35.5,50 C34.5,60 37,68 42,72.5 C44.5,75 47,76 50,76 C53,76 55.5,75 58,72.5 C63,68 65.5,60 64.5,50 C62,57 57,60.5 50,60.5 C43,60.5 38,57 35.5,50 Z" fill="url(#${u}b)"/>
      <path d="M43.2,76.3 q-1.6,2.15 0,4.3 q-1.6,2.15 0,4.3 q-1.6,2.15 0,4.3 h3.6 q1.6-2.15 0-4.3 q1.6-2.15 0-4.3 q1.6-2.15 0-4.3 Z M53.2,76.3 q-1.6,2.15 0,4.3 q-1.6,2.15 0,4.3 q-1.6,2.15 0,4.3 h3.6 q1.6-2.15 0-4.3 q1.6-2.15 0-4.3 q1.6-2.15 0-4.3 Z M43.4,91 L45,95 L46.6,91 Z M53.4,91 L55,95 L56.6,91 Z" fill="#c4561f"/>
      <g fill="#e8c46a"><rect x="42.6" y="89" width="4.8" height="2" rx=".6"/><rect x="52.6" y="89" width="4.8" height="2" rx=".6"/></g>
      <path d="M50,58 C46,56 41,56.8 38.6,60.2 C42,59.6 45.8,60 50,60.8 C54.2,60 58,59.6 61.4,60.2 C59,56.8 54,56 50,58 Z" fill="#c9521f"/>
      <path d="M46.6,63.2 C48.6,64.8 51.4,64.8 53.4,63.2 M50.4,49.5 C49.4,53 49.2,54.6 50.9,55.3" stroke="#a04a2a" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M38.8,48.6 C40.2,46.2 44.4,45.8 46.2,48.2 C44.8,50.6 40.6,50.9 38.8,48.6 Z M61.2,48.6 C59.8,46.2 55.6,45.8 53.8,48.2 C55.2,50.6 59.4,50.9 61.2,48.6 Z" fill="#fff"/>
      <g fill="#2f6fc4"><circle cx="42.6" cy="48.3" r="1.7"/><circle cx="57.4" cy="48.3" r="1.7"/></g>
      ${reflet(42, 47.6, 0.5)}${reflet(56.8, 47.6, 0.5)}
      <path d="M37.6,44.6 C40.2,42.6 44,42.6 46.6,44.2 M62.4,44.6 C59.8,42.6 56,42.6 53.4,44.2" stroke="#b9481c" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <g fill="#ff8a7a" opacity=".4"><ellipse cx="40" cy="55.3" rx="2.8" ry="1.6"/><ellipse cx="60" cy="55.3" rx="2.8" ry="1.6"/></g>
      <path d="M33,41 C33,29 40.5,22 50,22 C59.5,22 67,29 67,41 Z" fill="url(#${u}h)"/>
      <path d="M50,22.5 V38" stroke="#c9a13a" stroke-width="2.2"/>
      <path d="M38,31 C40,26.5 44,24 47.5,23.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/>
      <rect x="32" y="38" width="36" height="5" rx="1.6" fill="url(#${u}o)"/>
      <path d="M36,40.5 H64.1" stroke="#fff6d8" stroke-width="1.4" stroke-dasharray=".1 6.9" stroke-linecap="round"/>
      <path d="M77,98 L74.5,70" stroke="#6b4a2a" stroke-width="3" stroke-linecap="round"/>
      <g transform="rotate(-6 75 63)"><rect x="67" y="58" width="16" height="10" rx="1.6" fill="#b4bdca"/><path d="M68,66.6 H82" stroke="#5a6272" stroke-width=".9"/></g>`
    },
  },

  // La maquette approuvée, telle quelle.
  'br:anubis': {
    fond: ['#4a70d0', '#1b3180', '#081234'],
    defs: u => OR(u) + lin(u + 't', '#343a55', '#14141c', 1, 1),
    decor: () => LUEUR + etoiles(),
    corps: u => `
      <path d="M17,100 C21,83 35,75 50,75 C65,75 79,83 83,100 Z" fill="url(#${u}o)"/>
      <path d="M21.5,100 C25.5,87 37.5,80.5 50,80.5 C62.5,80.5 74.5,87 78.5,100" fill="none" stroke="#35c3bd" stroke-width="3.2"/>
      <path d="M27,100 C30.5,90.5 40,85.5 50,85.5 C60,85.5 69.5,90.5 73,100" fill="none" stroke="#2a4fb0" stroke-width="3.2"/>
      <path d="M32.5,100 C35.5,94 42,90.5 50,90.5 C58,90.5 64.5,94 67.5,100" fill="none" stroke="#e8c46a" stroke-width="2.4" stroke-dasharray="2 1.6"/>
      <path d="M35.5,41 L29.5,5 L46.5,29.5 Z" fill="#16161f"/>
      <path d="M36.3,34.5 L31.8,12.5 L42.8,28.5 Z" fill="url(#${u}o)"/>
      ${miroir(`<path d="M35.5,41 L29.5,5 L46.5,29.5 Z" fill="#16161f"/><path d="M36.3,34.5 L31.8,12.5 L42.8,28.5 Z" fill="url(#${u}o)"/>`)}
      <path d="M50,25.5 C59,25.5 65,31 65,39.5 C65,46 62,50 59.5,54 C58,59 56.6,65 55.6,70 C54.8,73.6 52.8,76 50,76 C47.2,76 45.2,73.6 44.4,70 C43.4,65 42,59 40.5,54 C38,50 35,46 35,39.5 C35,31 41,25.5 50,25.5 Z" fill="url(#${u}t)"/>
      <path d="M47,50 C48,58 48.4,64 48.6,69 C49.6,70 50.4,70 51.4,69 C51.6,64 52,58 53,50 C51,48.6 49,48.6 47,50 Z" fill="#3a4262" opacity=".55"/>
      <path d="M44.5,56 C46,60.5 47,65 47.6,70 M55.5,56 C54,60.5 53,65 52.4,70" stroke="#4a5275" stroke-width=".9" fill="none" opacity=".7"/>
      <path d="M50,47 C50.3,55 50.3,63 50,70" stroke="#4a5275" stroke-width="1.1" fill="none" opacity=".8"/>
      <path d="M38.2,42.5 C40.4,39.4 44.8,39.4 46.6,42.5 C44.8,45 40.4,45 38.2,42.5 Z" fill="#f5e4b2" stroke="#e8c46a" stroke-width=".8"/>
      <path d="M61.8,42.5 C59.6,39.4 55.2,39.4 53.4,42.5 C55.2,45 59.6,45 61.8,42.5 Z" fill="#f5e4b2" stroke="#e8c46a" stroke-width=".8"/>
      <circle cx="42.6" cy="42.4" r="1.35" fill="#0c0c12"/><circle cx="57.4" cy="42.4" r="1.35" fill="#0c0c12"/>
      <path d="M38.2,42.5 L33.4,44.8 M61.8,42.5 L66.6,44.8" stroke="#e8c46a" stroke-width="1.1" stroke-linecap="round"/>
      <ellipse cx="50" cy="73.4" rx="3.3" ry="2.1" fill="#0b0b10"/>
      <ellipse cx="49" cy="72.8" rx="1" ry=".45" fill="#fff" opacity=".5"/>`,
  },

  'br:poseidon': {
    fond: ['#4379cf', '#163a82', '#061536'],
    defs: u => OR(u) + lin(u + 'p', '#9a6446', '#6e4129') + lin(u + 'b', '#ffffff', '#c3dbe8') + lin(u + 'v', '#3fb3a6', '#15625c'),
    decor: () => LUEUR + etoiles(ETOILES.filter(([x]) => x > 20)) + VAGUE + miroir(VAGUE),
    // Le trident passe derrière l'épaule : tenu hors du cadre, sans une main qui flotte.
    corps: u => `
      <rect x="22.8" y="30" width="2.4" height="70" fill="url(#${u}o)"/>
      <path d="M22.9,31 L22.9,19.5 L21.3,20.5 L24,14 L26.7,20.5 L25.1,19.5 L25.1,31 Z M15.3,25.2 L17,20 L18.7,25.2 Z M29.3,25.2 L31,20 L32.7,25.2 Z" fill="url(#${u}o)"/>
      <path d="M17,24 C17,30.5 19,33 24,33 C29,33 31,30.5 31,24" stroke="url(#${u}o)" stroke-width="2.2" fill="none"/>
      <path d="M17,100 C19,85 33,78 50,78 C67,78 81,85 83,100 Z" fill="url(#${u}v)"/>
      <path d="M60,79 C66,86 72,94 74,100" stroke="#0f4a46" stroke-width="1.2" fill="none" opacity=".6"/>
      <circle cx="68" cy="84.5" r="2.5" fill="url(#${u}o)" stroke="#9a7428" stroke-width=".6"/>
      <path d="M50,26 C62,26 69,34 68.5,45 C71,51 70,58 67,62 L33,62 C30,58 29,51 31.5,45 C31,34 38,26 50,26 Z" fill="url(#${u}b)"/>
      <path d="M50,31 C59,31 64,37.5 64,46 C64,55 59.5,61 50,63 C40.5,61 36,55 36,46 C36,37.5 41,31 50,31 Z" fill="url(#${u}p)"/>
      <path d="M36,50 C31.5,57 31.5,67 34.5,73 C33.5,79 37.5,85 43,85.5 C44.5,90 49,91.5 50,89 C51,91.5 55.5,90 57,85.5 C62.5,85 66.5,79 65.5,73 C68.5,67 68.5,57 64,50 C61.5,56 56.5,59.5 50,59.5 C43.5,59.5 38.5,56 36,50 Z" fill="url(#${u}b)"/>
      <path d="M40.5,70 C38,69 38.5,65.5 41,65.5 C42.8,65.5 43.2,67.8 41.8,68.3 M59.5,70 C62,69 61.5,65.5 59,65.5 C57.2,65.5 56.8,67.8 58.2,68.3 M45.5,79 C43,78 43.5,74.5 46,74.5 C47.8,74.5 48.2,76.8 46.8,77.3 M54.5,79 C57,78 56.5,74.5 54,74.5 C52.2,74.5 51.8,76.8 53.2,77.3" stroke="#9fc3d9" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M50,57.2 C46,54.8 40.8,55.8 38.4,59.2 C42,58.6 46,59 50,60 C54,59 58,58.6 61.6,59.2 C59.2,55.8 54,54.8 50,57.2 Z" fill="#f4f8fb"/>
      <path d="M47,61.8 C48.8,63 51.2,63 53,61.8" stroke="#5a2a1a" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M38.8,46.8 C40.2,44.4 44.4,44 46.2,46.4 C44.8,48.8 40.6,49.1 38.8,46.8 Z M61.2,46.8 C59.8,44.4 55.6,44 53.8,46.4 C55.2,48.8 59.4,49.1 61.2,46.8 Z" fill="#fff"/>
      <g fill="#2a1a10"><circle cx="42.6" cy="46.5" r="1.7"/><circle cx="57.4" cy="46.5" r="1.7"/></g>
      ${reflet(42, 45.8, 0.55)}${reflet(56.8, 45.8, 0.55)}
      <path d="M37,42.4 C39.8,40 43.8,40 46.8,41.8 M63,42.4 C60.2,40 56.2,40 53.2,41.8" stroke="#f4f8fb" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M50.4,47.5 C49.4,51.5 49,53 50.9,54" stroke="#4a2a18" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <g fill="#ff8a6a" opacity=".3"><ellipse cx="40" cy="53" rx="2.8" ry="1.6"/><ellipse cx="60" cy="53" rx="2.8" ry="1.6"/></g>
      <path d="M36,33.5 L36.5,23 L41,28 L45,19 L50,26 L55,19 L59,28 L63.5,23 L64,33.5 Z" fill="url(#${u}o)"/>
      <g fill="#fff"><circle cx="36.5" cy="23" r=".9"/><circle cx="45" cy="19" r=".9"/><circle cx="55" cy="19" r=".9"/><circle cx="63.5" cy="23" r=".9"/></g>
      <g fill="#35c3bd"><circle cx="45" cy="30" r="1"/><circle cx="55" cy="30" r="1"/></g><circle cx="50" cy="30.2" r="1.2" fill="#e8475a"/>`,
  },

  'br:athena': {
    fond: ['#5a74d6', '#22368a', '#0b1438'],
    defs: u =>
      OR(u) +
      lin(u + 'p', '#e0ae84', '#c4895f') +
      lin(u + 'cr', '#ec4b40', '#9c1c24') +
      lin(u + 'r', '#ffffff', '#d6dbe6'),
    decor: () => LUEUR + etoiles(ETOILES.slice(0, 2).concat([ETOILES[3]])),
    corps: u => {
      const cheveux = `<path d="M33,42 C29,55 30,70 25,82 C31,85 37,81 38.5,72 C39.5,62 38.5,52 38,45 Z" fill="#2c1b12"/>`
      const garde = `<path d="M32,42 C31.5,48 32.5,54 35.5,58 C37,53 37.5,47 37.5,41 Z" fill="url(#${u}o)"/>`
      return `
      ${cheveux}${miroir(cheveux)}
      <path d="M22,100 C24,86 36,79 50,79 C64,79 76,86 78,100 Z" fill="url(#${u}r)"/>
      <path d="M45,64 V80 H55 V64 Z" fill="#c4895f"/>
      <path d="M40,80.5 C44,85 56,85 60,80.5" stroke="#e8c46a" stroke-width="1.4" fill="none"/>
      <path d="M50,34 C59,34 64,40.5 64,49 C64,59 58,67 50,69.5 C42,67 36,59 36,49 C36,40.5 41,34 50,34 Z" fill="url(#${u}p)"/>
      <path d="M39.2,50.2 C40.6,47.8 44.8,47.4 46.6,49.8 C45.2,52.2 41,52.5 39.2,50.2 Z M60.8,50.2 C59.4,47.8 55.2,47.4 53.4,49.8 C54.8,52.2 59,52.5 60.8,50.2 Z" fill="#fff"/>
      <g fill="#3d6456"><circle cx="43" cy="49.9" r="1.8"/><circle cx="57" cy="49.9" r="1.8"/></g>
      ${reflet(42.4, 49.2, 0.55)}${reflet(56.4, 49.2, 0.55)}
      <path d="M39.2,50.2 L37.6,49 M40,48.8 L38.8,47.4 M60.8,50.2 L62.4,49 M60,48.8 L61.2,47.4 M38.8,46 C41,44.6 44.2,44.6 46.4,45.6 M61.2,46 C59,44.6 55.8,44.6 53.6,45.6" stroke="#1a0f0a" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <path d="M50.3,51 C49.6,54.4 49.4,55.8 50.8,56.4" stroke="#a86e4a" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <g fill="#ff8a7a" opacity=".35"><ellipse cx="40.5" cy="56.4" rx="2.8" ry="1.6"/><ellipse cx="59.5" cy="56.4" rx="2.8" ry="1.6"/></g>
      <path d="M46.8,60.4 C48.6,59.4 51.4,59.4 53.2,60.4 C51.6,62.6 48.4,62.6 46.8,60.4 Z" fill="#b0474a"/>
      <path d="M45,25 C41,20.5 36,15.5 36.2,9.4 C38.6,11.4 40.8,11 42.3,8.2 C44.4,10.4 47,9.8 50,6 C53,9.8 55.6,10.4 57.7,8.2 C59.2,11 61.4,11.4 63.8,9.4 C64,15.5 59,20.5 55,25 Z" fill="url(#${u}cr)"/>
      <path d="M46.5,23.5 C44,19 41,15 39.5,11.5 M50,23.5 V9.5 M53.5,23.5 C56,19 59,15 60.5,11.5" stroke="#7a1018" stroke-width=".7" fill="none" opacity=".55"/>
      <path d="M32,44 C31,30.5 39,22.5 50,22.5 C61,22.5 69,30.5 68,44 C64,39.5 58.5,37 50,37 C41.5,37 36,39.5 32,44 Z" fill="url(#${u}o)"/>
      ${garde}${miroir(garde)}
      <path d="M33.5,41 C38,37.5 44,36 50,36 C56,36 62,37.5 66.5,41" stroke="#a8741f" stroke-width="1.2" fill="none"/>
      <path d="M43.5,27.5 H56.5 L54.5,22.5 H45.5 Z" fill="#c98f2c"/>
      <path d="M38,31 C40.5,27 44,25 48,24.5" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" opacity=".6"/>
      <ellipse cx="74.5" cy="79.5" rx="6.2" ry="7.6" fill="#a8875f"/>
      <path d="M69.3,74 L69,69.2 L72.6,72.6 Z M79.7,74 L80,69.2 L76.4,72.6 Z" fill="#8a6a4a"/>
      <ellipse cx="74.5" cy="75.6" rx="5" ry="4" fill="#ecdcc0"/>
      <g fill="#f4c53a"><circle cx="72.4" cy="75.4" r="1.8"/><circle cx="76.6" cy="75.4" r="1.8"/></g>
      <g fill="#1a1208"><circle cx="72.4" cy="75.4" r=".9"/><circle cx="76.6" cy="75.4" r=".9"/></g>
      <path d="M73.8,77.2 H75.2 L74.5,78.8 Z" fill="#d9953a"/>
      <path d="M68.6,79.5 C68.6,83.5 70,86 72,87.5 M80.4,79.5 C80.4,83.5 79,86 77,87.5" stroke="#6a4e34" stroke-width=".7" fill="none"/>
      <path d="M19,94 C23,86 27,78 30,70" stroke="#6b5a2a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <g fill="#8fb85a"><ellipse cx="21.5" cy="83.9" rx="3.4" ry="1.3" transform="rotate(-105 21.5 83.9)"/><ellipse cx="25.9" cy="74.3" rx="3.4" ry="1.3" transform="rotate(-105 25.9 74.3)"/></g>
      <g fill="#b5d17a"><ellipse cx="27.2" cy="80.7" rx="3.4" ry="1.3" transform="rotate(-25 27.2 80.7)"/><ellipse cx="31.6" cy="71.1" rx="3.4" ry="1.3" transform="rotate(-25 31.6 71.1)"/><ellipse cx="31.3" cy="67.3" rx="3.2" ry="1.2" transform="rotate(-65 31.3 67.3)"/></g>
      <circle cx="23.8" cy="88.5" r="1.4" fill="#4a5a22"/>`
    },
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { mythes: DESSINS } })
