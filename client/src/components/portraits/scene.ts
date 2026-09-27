// La scène · Musique — du DJ au chef d’orchestre.
import { inscrireDessin } from '../medaillons'
import { Portrait } from '../Portrait'
import { etoile, lin, miroir, points, reflet, type DessinDePortrait } from './outils'

/** Les deux faisceaux du DJ, turquoise et rose, qui tombent en biais : la maquette. */
const FAISCEAUX =
  '<path d="M0,0 L14,0 L40,100 L30,100 Z" fill="#35e0d8" opacity=".1"/><path d="M100,0 L86,0 L60,100 L70,100 Z" fill="#ff7ac8" opacity=".12"/>'

/** Les ondes du son, de part et d'autre. */
const ONDES =
  '<g fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1.1" stroke-linecap="round"><path d="M12,44 C9,48 9,54 12,58"/><path d="M7,40 C3,47 3,55 7,62"/><path d="M88,44 C91,48 91,54 88,58"/><path d="M93,40 C97,47 97,55 93,62"/></g>'

/** Une croche dessinée — tête penchée, hampe, crochet —, jamais un caractère : sa police manquerait. */
const croche = (x: number, y: number, s: number, couleur = '#fff', op = 0.45) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="${couleur}" opacity="${op}"><ellipse rx="2" ry="1.45" transform="rotate(-20)"/><path d="M1.4,-.4 L1.4,-8.6 L2.1,-8.6 C2.4,-6.8 4.6,-6.4 4.4,-3.6 C4,-5 3.2,-5.6 2.1,-5.8 L2.1,-.4 Z"/></g>`

/** Deux croches liées par leur barre. */
const doubleCroche = (x: number, y: number, s: number, couleur = '#fff', op = 0.45) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="${couleur}" opacity="${op}"><ellipse rx="2" ry="1.45" transform="rotate(-20)"/><ellipse cx="6.5" cy="-1.5" rx="2" ry="1.45" transform="rotate(-20 6.5 -1.5)"/><path d="M1.4,-.4 L1.4,-8.6 L8.6,-10.4 L8.6,-1.9 L7.9,-1.9 L7.9,-8.2 L2.1,-6.8 L2.1,-.4 Z"/></g>`

export const DESSINS: Record<string, DessinDePortrait> = {
  'br:dj': {
    fond: ['#e45aa3', '#6a1f7a', '#1e0a2a'],
    // Le dégradé du casque s'appelait `c` dans la maquette : le nom de la
    // découpe du disque, qui le masquait — l'arceau ne se dessinait pas.
    defs: u => lin(u + 'p', '#a36b45', '#744427') + lin(u + 'casque', '#2f3444', '#1a1d27'),
    decor: () => FAISCEAUX + ONDES,
    corps: u => `
      <path d="M24,100 C26,86 37,78 50,78 C63,78 74,86 76,100 Z" fill="#2b2f3f"/>
      <path d="M40,80 C44,86 56,86 60,80" stroke="#f1c653" stroke-width="1.2" fill="none"/>
      <path d="M45,70 L45,79 L55,79 L55,70 Z" fill="#7a4a2b"/>
      <path d="M26,49 C22,37 28,22 40,20 C44,14.5 56,14.5 60,20 C72,22 78,37 74,49 C76,57 70,63 66,59 L34,59 C30,63 24,57 26,49 Z" fill="#1f140f"/>
      <g fill="none" stroke="#3b2a20" stroke-width="1.2" stroke-linecap="round" opacity=".9">
        <path d="M32,30 C34,27 37,26 40,26.5"/><path d="M60,26.5 C63,26 66,27 68,30"/><path d="M46,20 C48,19 52,19 54,20"/>
      </g>
      <path d="M36,46 C36,38.5 42,34.5 50,34.5 C58,34.5 64,38.5 64,46 C64,58 58,68 50,70.5 C42,68 36,58 36,46 Z" fill="url(#${u}p)"/>
      <path d="M40.8,49.8 C42.3,52 45.7,52 47.2,49.8 M52.8,49.8 C54.3,52 57.7,52 59.2,49.8" stroke="#2a160c" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M41,45.4 C42.8,44.2 45.2,44.2 47,45.2 M53,45.2 C54.8,44.2 57.2,44.2 59,45.4" stroke="#2a160c" stroke-width="1.2" fill="none" stroke-linecap="round"/>
      <path d="M50.3,52 C49.4,55.6 49.2,57 50.6,57.8" stroke="#5a331c" stroke-width="1" fill="none" stroke-linecap="round"/>
      <path d="M44.8,61.2 C47,65.6 53,65.6 55.2,61.2 C52,62.3 48,62.3 44.8,61.2 Z" fill="#fff"/>
      <path d="M25,47 C25,25 75,25 75,47" stroke="url(#${u}casque)" stroke-width="5.2" fill="none" stroke-linecap="round"/>
      <path d="M27.6,40 C31,29.5 69,29.5 72.4,40" stroke="#35e0d8" stroke-width="1" fill="none" stroke-linecap="round" opacity=".9"/>
      <rect x="20" y="41.5" width="12" height="19" rx="5.5" fill="url(#${u}casque)"/><rect x="68" y="41.5" width="12" height="19" rx="5.5" fill="url(#${u}casque)"/>
      <rect x="22.3" y="44.6" width="7.4" height="12.8" rx="3.7" fill="#35e0d8"/><rect x="70.3" y="44.6" width="7.4" height="12.8" rx="3.7" fill="#35e0d8"/>
      <rect x="23.6" y="46" width="2" height="6" rx="1" fill="#fff" opacity=".6"/><rect x="71.6" y="46" width="2" height="6" rx="1" fill="#fff" opacity=".6"/>`,
  },

  'br:rockeuse': {
    fond: ['#ea5a96', '#72185e', '#210822'],
    defs: u =>
      lin(u + 'p', '#f9dac6', '#e6b096') +
      lin(u + 'h', '#3a2c40', '#0e0a12') +
      lin(u + 'v', '#3c3644', '#141118') +
      lin(u + 'g', '#ff6a5a', '#b81c34', 1, 1) +
      lin(u + 'm', '#d4945a', '#8a5226'),
    decor: () =>
      '<path d="M22,0 L34,0 L62,100 L46,100 Z" fill="#8ff5e6" opacity=".1"/><path d="M78,0 L66,0 L38,100 L54,100 Z" fill="#ffd36e" opacity=".1"/>' +
      etoile(16, 34, 3, '#fff', 0.7) +
      etoile(85, 30, 2.4, '#fff', 0.6) +
      points([[12, 60, 0.6], [26, 14, 0.6], [80, 12, 0.5], [90, 52, 0.5]], '#fff', 0.7),
    corps: u => `
      <path d="M37,50 C34,38 40,29 51,28.5 C62,28.5 68,36 67,48 C68,58 71,66 69,76 C65,77 62,72 61,66 L39,56 Z" fill="url(#${u}h)"/>
      <path d="M20,100 C22,86 34,78 50,78 C66,78 78,86 80,100 Z" fill="url(#${u}v)"/>
      <path d="M43.5,78.5 L50,91 L56.5,78.5 Z" fill="#f2eef4"/>
      <path d="M43.5,78.5 L50,91 L45,100 L36,81 Z M56.5,78.5 L50,91 L55,100 L64,81 Z" fill="#2a2530"/>
      <path d="M36.5,81.5 L45,99 M63.5,81.5 L55,99" stroke="#6a6474" stroke-width=".6"/>
      <g fill="#e0e0ea"><circle cx="29" cy="88" r=".8"/><circle cx="32" cy="85.4" r=".8"/><circle cx="71" cy="88" r=".8"/><circle cx="68" cy="85.4" r=".8"/></g>
      <path d="M45,66 L45,79 L55,79 L55,66 Z" fill="#e0a88c"/>
      <ellipse cx="36.4" cy="52" rx="2.3" ry="3.5" fill="#eab89e"/>
      <circle cx="36.4" cy="57.2" r="1.8" fill="none" stroke="#e8e8f0" stroke-width=".8"/>
      <path d="M36.5,46 C36.5,38.5 42,34.5 50,34.5 C58,34.5 63.5,38.5 63.5,46 C63.5,58 58,68 50,70.5 C42,68 36.5,58 36.5,46 Z" fill="url(#${u}p)"/>
      <path d="M37,47 C35.5,36 42,29.5 51,29.5 C60,29.5 66,35 65,45 C63,48 62.5,52 63,57 C60,52 59,46 59,41.5 C55,40 48,40.5 41,43 C39.2,44 38,45.5 37,47 Z" fill="url(#${u}h)"/>
      <path d="M45.5,30.8 C52,30.2 58.5,33 61.5,38.5 C62,43 61.5,48 62.5,53 C60.5,49.5 59.6,45.5 59.6,41 C56,38.5 51,37.6 47,38 C47.6,35.4 47,32.8 45.5,30.8 Z" fill="#3ee0d0"/>
      <path d="M39.4,50.8 C40.8,48.4 45.4,48.4 46.8,50.8 C45.4,52.6 40.8,52.6 39.4,50.8 Z M53.2,50.8 C54.6,48.4 59.2,48.4 60.6,50.8 C59.2,52.6 54.6,52.6 53.2,50.8 Z" fill="#fff"/>
      <circle cx="43.1" cy="50.6" r="1.8" fill="#2c5a3e"/><circle cx="56.9" cy="50.6" r="1.8" fill="#2c5a3e"/>
      ${reflet(42.4, 50, 0.6)}${reflet(56.2, 50, 0.6)}
      <path d="M46.8,50.6 C45.4,48.2 40.8,48.2 39.4,50.6 L37.6,49.2 M53.2,50.6 C54.6,48.2 59.2,48.2 60.6,50.6 L62.4,49.2" stroke="#140e18" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M39,46.2 C41.4,44.4 45,44.2 47.4,45.4 M53,45.2 C55.4,44 58.6,44.4 61,46" stroke="#1a1018" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M50.3,52.6 C49.6,55.8 49.4,57.2 50.7,57.8" stroke="#b07a60" stroke-width="1" fill="none" stroke-linecap="round"/>
      <ellipse cx="41" cy="57.4" rx="3" ry="1.6" fill="#ff8aa0" opacity=".35"/><ellipse cx="59" cy="57.4" rx="3" ry="1.6" fill="#ff8aa0" opacity=".35"/>
      <path d="M45,61 C47.4,65.2 53,65.2 55.4,60.6 C52,61.8 48.4,61.8 45,61 Z" fill="#fff" stroke="#8a2848" stroke-width=".9"/>
      <g transform="translate(36 85) rotate(-32)">
        <path d="M-12,-3 C-12,-8 -8,-10 -3,-9 C0,-8.5 2,-8 4,-9.5 C6,-11 9,-10.5 9.5,-8 C8,-6 7.5,-4.5 8.5,-3 L8.5,3 C7.5,4.5 8,6 9.5,8 C9,10.5 6,11 4,9.5 C2,8 0,8.5 -3,9 C-8,10 -12,8 -12,3 Z" fill="url(#${u}g)"/>
        <path d="M-10,-4 C-9,-7 -6,-8 -3,-7.4" stroke="#fff" stroke-width=".9" fill="none" opacity=".55" stroke-linecap="round"/>
        <path d="M-8.5,-1 C-8.5,-4.5 -5.5,-5.5 -2,-5 L5.5,-4 L5.5,4 C3,5.6 -2,7.5 -5.5,6.8 C-7.6,6.2 -8.5,3 -8.5,-1 Z" fill="#1c1418"/>
        <g fill="#f2e6c8"><rect x="-3.6" y="-3.4" width="2.2" height="6.8" rx=".5"/><rect x="1.2" y="-3.4" width="2.2" height="6.8" rx=".5"/></g>
        <rect x="-7.4" y="-3" width="1.3" height="6" fill="#d4d4de"/>
        <g fill="#f1c653"><circle cx="-6.6" cy="7.2" r="1.1"/><circle cx="-3.4" cy="7.8" r="1.1"/></g>
        <rect x="8" y="-1.6" width="36" height="3.2" fill="url(#${u}m)"/>
        <path d="M14,0 h0 M22,0 h0 M30,0 h0 M38,0 h0" stroke="#f6ead0" stroke-width="1" stroke-linecap="round"/>
        <path d="M44,-2 L51,-3.4 C52.5,-3.4 53,-2.5 53,-1.5 L53,1.5 C53,2.5 52.5,3.4 51,3.4 L44,2 Z" fill="#1c1418"/>
        <path d="M45.5,-3.9 L52,-3.9 M45.5,3.9 L52,3.9" stroke="#d4d4de" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="0 2.6"/>
        <path d="M-7,-1 L51,-1 M-7,1 L51,1" stroke="#fff" stroke-width=".3" opacity=".6"/>
      </g>`,
  },

  'br:jazzman': {
    fond: ['#c85aae', '#521f78', '#170a2a'],
    defs: u =>
      lin(u + 'p', '#c68c60', '#93603c') +
      lin(u + 'h', '#3e3c4a', '#15141c') +
      lin(u + 's', '#3a3f5c', '#1a1d2e') +
      lin(u + 'o', '#ffeaa0', '#c48a1e', 1, 1),
    decor: () =>
      '<path d="M40,0 L60,0 L80,100 L20,100 Z" fill="#ffe6b0" opacity=".06"/>' +
      croche(18, 38, 1.1) +
      doubleCroche(76, 28, 1) +
      croche(84, 64, 0.8, '#fff', 0.35) +
      points([[14, 60, 0.6], [28, 14, 0.5], [70, 10, 0.5]], '#fff', 0.6),
    corps: u => `
      <path d="M22,100 C24,86 36,78.5 50,78.5 C64,78.5 76,86 78,100 Z" fill="url(#${u}s)"/>
      <path d="M44,79 L50,90 L56,79 Z" fill="#f2eee8"/>
      <path d="M48.8,80.5 L51.2,80.5 L52.2,89 L50,92 L47.8,89 Z" fill="#e0a830"/>
      <path d="M44,79 L50,90 L46,100 L37,81 Z M56,79 L50,90 L54,100 L63,81 Z" fill="#2a2e44"/>
      <path d="M45,66 L45,79 L55,79 L55,66 Z" fill="#8a5a36"/>
      <ellipse cx="36.2" cy="51.5" rx="2.3" ry="3.5" fill="#a87048"/><ellipse cx="63.8" cy="51.5" rx="2.3" ry="3.5" fill="#a87048"/>
      <path d="M36,46 C36,39 42,35.5 50,35.5 C58,35.5 64,39 64,46 C64,58 58,68 50,70.5 C42,68 36,58 36,46 Z" fill="url(#${u}p)"/>
      <path d="M36.3,42 L39.8,42 L39.2,51 C37.8,49.5 36.8,47 36.3,44.5 Z" fill="#1a1210"/>
      ${miroir('<path d="M36.3,42 L39.8,42 L39.2,51 C37.8,49.5 36.8,47 36.3,44.5 Z" fill="#1a1210"/>')}
      <g transform="rotate(-7 50 33)">
        <path d="M36,35 C35.5,27 38.5,23 50,23 C61.5,23 64.5,27 64,35 Z" fill="url(#${u}h)"/>
        <path d="M39,25.6 C45,24.2 55,24.2 61,25.6" stroke="#5a5868" stroke-width=".9" fill="none"/>
        <path d="M35.8,30.5 L64.2,30.5 L64,34.5 L36,34.5 Z" fill="#c8283c"/>
        <path d="M25,36.5 C29,33 40,32.5 50,32.5 C60,32.5 71,33 75,36.5 C71,40 60,40.6 50,40.6 C40,40.6 29,40 25,36.5 Z" fill="url(#${u}h)"/>
        <path d="M27,36.4 C32,34.4 42,34 50,34 C58,34 68,34.4 73,36.4" stroke="#6a687a" stroke-width=".7" fill="none"/>
      </g>
      <path d="M40.8,50.2 C42.3,52.4 45.7,52.4 47.2,50.2 M52.8,50.2 C54.3,52.4 57.7,52.4 59.2,50.2" stroke="#2a160c" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <path d="M40.6,45.8 C42.6,44.2 45.4,44.2 47.2,45.4 M52.8,45.4 C54.6,44.2 57.4,44.2 59.4,45.8" stroke="#1a1008" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <path d="M50.3,52.4 C49.4,55.6 49.2,57 50.6,57.8" stroke="#6a3e22" stroke-width="1" fill="none" stroke-linecap="round"/>
      <ellipse cx="40.6" cy="57.6" rx="3.2" ry="1.8" fill="#e07a6a" opacity=".35"/><ellipse cx="59.4" cy="57.6" rx="3.2" ry="1.8" fill="#e07a6a" opacity=".35"/>
      <path d="M45.5,59.8 C47.5,58.6 49,58.8 50,59.5 C51,58.8 52.5,58.6 54.5,59.8 C52.6,60.8 51,60.6 50,60.2 C49,60.6 47.4,60.8 45.5,59.8 Z" fill="#1a1008"/>
      <path d="M47.6,66.4 C48.2,69.6 51.8,69.6 52.4,66.4 C51.2,67.2 48.8,67.2 47.6,66.4 Z" fill="#1a1008"/>
      <path d="M44,67.2 C44.8,64.8 46.6,62.8 49.6,62.4" stroke="url(#${u}o)" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M48.8,61.2 L51.4,61.6 L51,63.4 L48.6,63 Z" fill="#141018"/>
      <g transform="translate(44.6 66) rotate(25) scale(1.08)">
        <path d="M1.6,0 L3.4,20 C3.4,24.6 -.1,28.2 -4.8,28.2 C-9.4,28.2 -12.9,24.6 -12.9,20 C-12.9,16 -14.4,12.6 -16.4,10.4 L-3,10.4 C-4.7,12.8 -6.1,16.4 -6.1,20 C-6.1,20.8 -5.5,21.4 -4.8,21.4 C-4,21.4 -3.4,20.8 -3.4,20 L-1.6,0 Z" fill="url(#${u}o)"/>
        <ellipse cx="-9.7" cy="10.4" rx="6.7" ry="1.7" fill="#8a5a14"/>
        <path d="M-15,11.4 C-12,12.6 -7,12.6 -4.2,11.4" stroke="#fff4c0" stroke-width=".6" fill="none" opacity=".7"/>
        <path d="M0,4.5 h0 M.3,8.5 h0 M.6,12.5 h0 M.9,16.5 h0" stroke="#fff6d8" stroke-width="2" stroke-linecap="round"/>
        <circle cx="3" cy="14.5" r="1.3" fill="#e8b440" stroke="#8a5a14" stroke-width=".4"/>
        <path d="M-.6,1 L-2.2,19" stroke="#fff6c8" stroke-width=".6" opacity=".6"/>
      </g>`,
  },

  'br:violoniste': {
    fond: ['#df6ab4', '#652082', '#1c0a2c'],
    defs: u =>
      lin(u + 'p', '#f7d6bf', '#e3ab8e') +
      lin(u + 'h', '#f2cf78', '#b9852e') +
      lin(u + 'r', '#2e2436', '#110d16') +
      lin(u + 'v', '#f0913e', '#94400f', 1, 1),
    decor: () =>
      '<path d="M36,0 L64,0 L84,100 L16,100 Z" fill="#fff" opacity=".06"/>' +
      croche(16, 40, 1) +
      croche(82, 30, 1.1) +
      doubleCroche(20, 70, 0.8, '#fff', 0.35) +
      points([[28, 14, 0.6], [74, 12, 0.5], [88, 56, 0.5]], '#fff', 0.6),
    corps: u => `
      <circle cx="36" cy="62" r="6" fill="url(#${u}h)"/>
      <path d="M35.5,52 C33,39 39,29 50,29 C61,29 67,39 64.5,52 C62,46 59,42 50,41.5 C41,42 38,46 35.5,52 Z" fill="url(#${u}h)"/>
      <path d="M22,100 C24,87 36,79.5 50,79.5 C64,79.5 76,87 78,100 Z" fill="url(#${u}r)"/>
      <path d="M45,66 L45,80 L55,80 L55,66 Z" fill="#e0a88a"/>
      <path d="M42,79.8 C44,84.5 56,84.5 58,79.8 Z" fill="#e8b294"/>
      <ellipse cx="36.4" cy="52" rx="2.2" ry="3.4" fill="#eab496"/><circle cx="36.4" cy="56.4" r="1" fill="#fff"/>
      <path d="M36.5,46 C36.5,38.5 42,34.5 50,34.5 C58,34.5 63.5,38.5 63.5,46 C63.5,58 58,68 50,70.5 C42,68 36.5,58 36.5,46 Z" fill="url(#${u}p)"/>
      <path d="M36.2,47 C35.5,38 41,32.5 49,32.5 C57,32 63.5,36.5 64,45 C60,40 55,38 50,38.5 C44,38.5 39,42 36.2,47 Z" fill="url(#${u}h)"/>
      <path d="M40.8,50.2 C42.3,52.4 45.7,52.4 47.2,50.2 M52.8,50.2 C54.3,52.4 57.7,52.4 59.2,50.2" stroke="#3a2016" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <path d="M41,50.6 L40,51.6 M59,50.6 L60,51.6" stroke="#3a2016" stroke-width=".8" stroke-linecap="round"/>
      <path d="M41,46 C42.8,45 45.2,45 47,45.8 M53,45.8 C54.8,45 57.2,45 59,46" stroke="#8a5a2a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M50.3,52.4 C49.6,55.4 49.4,56.8 50.6,57.4" stroke="#c08a70" stroke-width=".9" fill="none" stroke-linecap="round"/>
      <ellipse cx="41.5" cy="57" rx="3.2" ry="1.8" fill="#ff8fa3" opacity=".45"/><ellipse cx="58.5" cy="57" rx="3.2" ry="1.8" fill="#ff8fa3" opacity=".45"/>
      <path d="M47,61.2 C48.8,62.8 51.2,62.8 53,61.2" stroke="#c0485a" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <g transform="translate(53 75) rotate(75)">
        <path d="M0,0 C4,0 6.5,-2 6.5,-5 C6.5,-8 4,-9 4,-11 C4,-13 5.5,-14 5.5,-17 C5.5,-20 3,-22 0,-22 C-3,-22 -5.5,-20 -5.5,-17 C-5.5,-14 -4,-13 -4,-11 C-4,-9 -6.5,-8 -6.5,-5 C-6.5,-2 -4,0 0,0 Z" fill="url(#${u}v)"/>
        <path d="M-2.6,-9 C-3.2,-10.5 -2,-11.5 -2.6,-13 M2.6,-9 C3.2,-10.5 2,-11.5 2.6,-13" stroke="#3a1606" stroke-width=".6" fill="none"/>
        <path d="M-1.2,-12 L1.2,-12 L.8,-33 L-.8,-33 Z" fill="#1a1010"/>
        <path d="M-1.8,-1 L1.8,-1 L1,-6.5 L-1,-6.5 Z" fill="#1a1010"/>
        <path d="M-2.2,-8.6 L2.2,-8.6" stroke="#f4e2c0" stroke-width=".9"/>
        <path d="M-.9,-33 L.9,-33 L1.2,-36 L-1.2,-36 Z" fill="#7a3410"/>
        <circle cx="0" cy="-37.4" r="1.7" fill="#9a4a18"/><circle cx="0" cy="-37.4" r=".7" fill="#5a2208"/>
      </g>
      <path d="M47,97 L79,50" stroke="#4a200c" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M48.3,97.4 L80,51.2" stroke="#f6ecd8" stroke-width=".6"/>`,
  },

  'br:cantatrice': {
    fond: ['#d654b0', '#5e1a7a', '#1a0828'],
    defs: u =>
      lin(u + 'p', '#8e5c3c', '#65391f') +
      lin(u + 'h', '#2c1c1a', '#0c0606') +
      lin(u + 'r', '#f8d878', '#c08a2a'),
    decor: () =>
      '<path d="M38,0 L62,0 L82,100 L18,100 Z" fill="#ffe8f4" opacity=".08"/>' +
      croche(20, 34, 1.1) +
      doubleCroche(74, 24, 1.1) +
      croche(84, 56, 0.9, '#fff', 0.35) +
      croche(14, 62, 0.8, '#fff', 0.3),
    corps: u => `
      <circle cx="50" cy="21" r="8.2" fill="url(#${u}h)"/>
      <path d="M44.5,17.5 C47,15.5 51,15 54,16.5 M43.5,22 C46,19.6 52,19 56,21" stroke="#5a4440" stroke-width=".8" fill="none" opacity=".7"/>
      <path d="M35,50 C33,37 40,27.5 50,27.5 C60,27.5 67,37 65,50 Z" fill="url(#${u}h)"/>
      <path d="M22,100 C24,86 36,79 50,79 C64,79 76,86 78,100 Z" fill="url(#${u}p)"/>
      <path d="M21.5,100 C22.5,93 25,88.5 29,86.5 C36,88.5 43,89.5 47,92 L50,94 L53,92 C57,89.5 64,88.5 71,86.5 C75,88.5 77.5,93 78.5,100 Z" fill="url(#${u}r)"/>
      <path d="M29,86.5 C36,88.5 43,89.5 47,92 L50,94 L53,92 C57,89.5 64,88.5 71,86.5" stroke="#fff3c0" stroke-width=".8" fill="none" opacity=".7"/>
      <path d="M45,66 L45,80 L55,80 L55,66 Z" fill="#6e4024"/>
      <path d="M41.5,78.5 C44,84 56,84 58.5,78.5" fill="none" stroke="#fdf6ea" stroke-width="1.9" stroke-linecap="round" stroke-dasharray="0 2.3"/>
      <ellipse cx="50" cy="85.2" rx="1.3" ry="1.7" fill="#fdf6ea"/>
      <ellipse cx="36.4" cy="52" rx="2.3" ry="3.5" fill="#7a4a2c"/><ellipse cx="63.6" cy="52" rx="2.3" ry="3.5" fill="#7a4a2c"/>
      <circle cx="36.4" cy="57" r="1.1" fill="#fdf6ea"/><circle cx="63.6" cy="57" r="1.1" fill="#fdf6ea"/>
      <path d="M36.5,46 C36.5,39 42,35.5 50,35.5 C58,35.5 63.5,39 63.5,46 C63.5,58 58,68 50,70.5 C42,68 36.5,58 36.5,46 Z" fill="url(#${u}p)"/>
      <path d="M37,44 C38,39 43,36.4 50,36.4 C57,36.4 62,39 63,44 C60,40 55,38.4 50,38.4 C45,38.4 40,40 37,44 Z" fill="url(#${u}h)"/>
      <circle cx="61" cy="28.5" r="3.6" fill="#d8203e"/><path d="M59.4,27.4 C60.6,26.2 62.4,26.6 62.6,28.2 C62.8,29.6 61,30.2 60.2,29.2" stroke="#8a0c22" stroke-width=".7" fill="none"/>
      <path d="M63.6,31 C66,31.4 67.4,30 67.8,28.4 C65.8,28.2 64.4,29 63.6,31 Z" fill="#2a8a4a"/>
      <path d="M39.6,50.4 C41,48 45.6,48 47,50.4 C45.6,52.2 41,52.2 39.6,50.4 Z M53,50.4 C54.4,48 59,48 60.4,50.4 C59,52.2 54.4,52.2 53,50.4 Z" fill="#fff"/>
      <circle cx="43.3" cy="49.8" r="1.8" fill="#1a0c06"/><circle cx="56.7" cy="49.8" r="1.8" fill="#1a0c06"/>
      ${reflet(42.6, 49.2, 0.6)}${reflet(56, 49.2, 0.6)}
      <path d="M39.2,49.8 L38,48.8 M60.8,49.8 L62,48.8" stroke="#1a0c06" stroke-width=".9" stroke-linecap="round"/>
      <path d="M39.4,45 C41.4,42.4 45.2,42 47.6,43.8 M52.4,43.8 C54.8,42 58.6,42.4 60.6,45" stroke="#1a0c06" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      <path d="M50.3,52.4 C49.6,55 49.4,56.2 50.6,56.8" stroke="#4a2814" stroke-width="1" fill="none" stroke-linecap="round"/>
      <ellipse cx="40.6" cy="57.2" rx="3.2" ry="1.8" fill="#e0607a" opacity=".35"/><ellipse cx="59.4" cy="57.2" rx="3.2" ry="1.8" fill="#e0607a" opacity=".35"/>
      <ellipse cx="50" cy="62.4" rx="3.3" ry="3.9" fill="#4a0e18" stroke="#b0384c" stroke-width="1.1"/>
      <path d="M47.6,60.2 C49,59.5 51,59.5 52.4,60.2 L52,61.2 C50.8,60.8 49.2,60.8 48,61.2 Z" fill="#fff"/>
      <ellipse cx="50" cy="64.6" rx="1.9" ry=".9" fill="#e06a7a"/>`,
  },

  'br:maestro': {
    fond: ['#e2609c', '#6e1f6e', '#200a26'],
    defs: u =>
      lin(u + 'p', '#f7d8c2', '#e2ab8e') +
      lin(u + 'h', '#ffffff', '#c8c2d6') +
      lin(u + 'n', '#2e2a3a', '#0e0c14'),
    decor: () =>
      '<g fill="none" stroke="#fff" stroke-width=".5" opacity=".18"><path d="M-2,34 C30,22 70,22 102,34"/><path d="M-2,37 C30,25 70,25 102,37"/><path d="M-2,40 C30,28 70,28 102,40"/><path d="M-2,43 C30,31 70,31 102,43"/><path d="M-2,46 C30,34 70,34 102,46"/></g>' +
      croche(84, 30, 1.1) +
      doubleCroche(74, 64, 0.9, '#fff', 0.35) +
      croche(14, 68, 0.8, '#fff', 0.3) +
      points([[16, 20, 0.5], [88, 50, 0.5]], '#fff', 0.6),
    corps: u => `
      <path d="M31,60 C26,58 24,54 26,51 C21,49 20,44 24,41 C20,37 22,31 28,31 C27,25 32,21 37,23 C38,17 45,15 49,19 C53,14 60,15 62,21 C67,19 72,23 71,29 C77,29 80,35 76,39 C80,42 80,48 75,50 C77,54 75,58 69,60 Z" fill="url(#${u}h)"/>
      <g fill="none" stroke="#a8a0b8" stroke-width=".9" stroke-linecap="round" opacity=".7"><path d="M27,46 C29,44 31,44 33,45 M29,35 C31,33 34,33 36,34.5 M41,23 C43,21.5 46,21.5 48,23 M56,22 C58,21 61,22 62,24 M68,34 C70,33 72,34 73,36 M72,46 C70,44.5 68,44.5 66.5,45.5"/></g>
      <path d="M21,100 C23,86 35,78.5 50,78.5 C65,78.5 77,86 79,100 Z" fill="url(#${u}n)"/>
      <path d="M42,78.5 L50,96 L58,78.5 Z" fill="#f6f4f8"/>
      <path d="M42,78.5 L50,96 L47,100 L35,81 Z M58,78.5 L50,96 L53,100 L65,81 Z" fill="#1a1622"/>
      <path d="M36,81.6 L47.4,99 M64,81.6 L52.6,99" stroke="#6a6480" stroke-width=".7"/>
      <path d="M45,66 L45,79 L55,79 L55,66 Z" fill="#e0a88a"/>
      <path d="M50,80.5 L44.5,77.8 L44.5,83.2 Z M50,80.5 L55.5,77.8 L55.5,83.2 Z" fill="#fff"/><circle cx="50" cy="80.5" r="1.2" fill="#e8e6ee"/>
      <ellipse cx="36.2" cy="52" rx="2.3" ry="3.5" fill="#eab496"/><ellipse cx="63.8" cy="52" rx="2.3" ry="3.5" fill="#eab496"/>
      <path d="M36,46 C36,38.5 42,34.5 50,34.5 C58,34.5 64,38.5 64,46 C64,58 58,68 50,70.5 C42,68 36,58 36,46 Z" fill="url(#${u}p)"/>
      <path d="M38.6,45.6 C40.6,43 44.6,42.6 47.6,44.2 M61.4,45.6 C59.4,43 55.4,42.6 52.4,44.2" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M39.6,50.4 C41,48 45.6,48 47,50.4 C45.6,52.2 41,52.2 39.6,50.4 Z M53,50.4 C54.4,48 59,48 60.4,50.4 C59,52.2 54.4,52.2 53,50.4 Z" fill="#fff"/>
      <circle cx="43.3" cy="50.2" r="1.8" fill="#2f5a9a"/><circle cx="56.7" cy="50.2" r="1.8" fill="#2f5a9a"/>
      ${reflet(42.6, 49.6, 0.6)}${reflet(56, 49.6, 0.6)}
      <path d="M50.6,51.6 C49.2,55.6 48.6,57.4 50.6,58.2 C51.6,58.6 52.6,58.2 52.4,57.4" stroke="#b07a62" stroke-width="1" fill="none" stroke-linecap="round"/>
      <ellipse cx="40.4" cy="57.4" rx="3.2" ry="1.8" fill="#ff8a8a" opacity=".4"/><ellipse cx="59.6" cy="57.4" rx="3.2" ry="1.8" fill="#ff8a8a" opacity=".4"/>
      <path d="M45,61 C46.5,66 53.5,66 55,61 C52,62 48,62 45,61 Z" fill="#6a1a2a"/>
      <path d="M45.8,61.4 C48.4,62.2 51.6,62.2 54.2,61.4 L53.8,62.6 C51.4,63.2 48.6,63.2 46.2,62.6 Z" fill="#fff"/>
      <path d="M17,100 C16,86 16,74 18,62 L26.5,61 C26,72 27,84 30,96 Z" fill="url(#${u}n)"/>
      <path d="M17.6,62.6 L26.8,61.4 L26.5,58 L17.4,59.2 Z" fill="#fff"/>
      <ellipse cx="22" cy="54.6" rx="4.2" ry="3.8" fill="#eab496"/>
      <path d="M20.2,52.6 C21.6,51.6 23.4,51.6 24.6,52.6" stroke="#c08a70" stroke-width=".7" fill="none"/>
      <path d="M22.6,52 L33.6,18" stroke="#2a1a1e" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M22.6,52 L33.6,18" stroke="#fdfbf5" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M22.4,52.6 L23.6,48.8" stroke="#b07a4a" stroke-width="2" stroke-linecap="round"/>`,
  },
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Portrait, branches: { scene: DESSINS } })
