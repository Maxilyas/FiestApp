import { CRANS_D_UNE_BORDURE, type CleDeLigue } from '../../../shared/duels'
import { METAUX, type Metal } from './metaux'

// Les bordures de ligue, dessinées : une parure qui pousse (la planche du
// 17 novembre 2026, `retours/2026-11-17/bordures/`, et le choix du
// propriétaire : « Mets en place tes recommandations »). Un fil de métal,
// toujours entier ; au bas, l'insigne de la ligue ; et un brin de deux
// feuilles par duel gagné, du bas vers le haut, des deux côtés à la fois —
// le laurier du bronze, l'olivier de l'argent, la feuille d'or et ses rubis,
// les cristaux du givre, les marquises du diamant, les flammes du Soleil noir.
//
// Ce qu'elle a remplacé, les alliages du 12 octobre : un bandeau cranté, large
// de près de la moitié de l'avatar, au métal de la finition, où un cran à
// gagner se dessinait en pointillé. Relevé en production le 17 novembre,
// quatorze bordures sur dix-neuf n'étaient pas serties — un coin de métal, de
// travers, sur une roue fantôme, l'état qu'on voyait le plus et le moins
// beau — ; treize entouraient un avatar peint, auquel le bandeau disputait
// l'œil ; et onze, en Holo, Prisme ou Aurore, faisaient un arc-en-ciel pastel
// où la ligue ne se lisait plus (un bronze porté en Or était doré). D'où ce
// qui la tient :
//   - le cadre est toujours entier — un cran à gagner est un bourgeon sur le
//     fil, jamais un pointillé ;
//   - les crans montent du bas, à droite puis à gauche (`ANGLES`) : à chaque
//     victoire, elle reste symétrique ;
//   - le métal est celui de la ligue, quelle que soit la finition : le bronze
//     est de bronze. La finition garde ce qui est à elle — le cercle du
//     médaillon, son halo, sa lumière ;
//   - l'insigne est en bas : le haut est à ce qui sort d'un médaillon — des
//     ailes, une tête — et à l'étoile d'un légendaire scellé.
//
// Des images, faites à la demande et gardées : quarante avatars d'une liste
// qui portent la même bordure partagent la même, décodée une fois, sans cent
// nœuds SVG chacun à comparer — ni un identifiant de dégradé qu'un autre
// avatar, caché, garderait pour lui (`Lumiere.tsx` fait de même).
//
// Un module sans React ni page : la planche des bordures le lit dans Node
// (`server/scripts/planche-bordures.ts`), les tests aussi.
//
// Le repère : 200 × 200, centré en (100, 100). Le disque de l'avatar tient
// dans un rayon de 59 — un médaillon de 1,12 em y entre juste, son cercle de
// finition contre le fil (`Cercle.tsx`) —, le fil va de 59,8 à 62,6, les
// feuilles jusqu'à 80, l'insigne jusqu'à 92.

/** Un nombre court : au-delà de deux décimales, le tracé s'allonge sans que l'œil y gagne. */
const f = (n: number) => String(Math.round(n * 100) / 100)

/** Un point à `r` du centre, à `deg` degrés de midi, dans le sens des aiguilles d'une montre. */
function xy(r: number, deg: number): [number, number] {
  const t = (deg * Math.PI) / 180
  return [100 + r * Math.sin(t), 100 - r * Math.cos(t)]
}

function rond(x: number, y: number, r: number): string {
  const q = f(r)
  return `M${f(x - r)} ${f(y)}a${q} ${q} 0 1 0 ${f(2 * r)} 0a${q} ${q} 0 1 0 ${f(-2 * r)} 0Z`
}

/** Un anneau entier, de `r1` à `r2` — à remplir en `evenodd`. */
const anneau = (r1: number, r2: number) => rond(100, 100, r2) + rond(100, 100, r1)

/** Une étoile à `n` branches, ses pointes à `R`, ses creux à `r`. */
function etoile(x: number, y: number, R: number, r: number, n: number): string {
  let d = ''
  for (let i = 0; i < 2 * n; i++) {
    const a = (i * Math.PI) / n
    const q = i % 2 === 0 ? R : r
    d += `${i === 0 ? 'M' : 'L'}${f(x + q * Math.sin(a))} ${f(y - q * Math.cos(a))}`
  }
  return d + 'Z'
}

/** Une commande de tracé : `M`, `L`, `C` et leurs points, ou `Z`. */
type Commande = readonly [string, ...number[]]

/**
 * Une forme dessinée debout — `u` vers la droite, `v` vers l'extérieur —,
 * posée au rayon `r` et à l'angle `deg`. `miroir` la retourne de gauche à
 * droite, `penche` la couche vers midi avant de la poser (en degrés) : une
 * feuille du côté droit et sa jumelle du côté gauche sont la même, retournée.
 * Chaque forme a son propre tracé : deux tracés de sens contraires qui se
 * chevauchent dans un même chemin font un trou.
 */
function poser(cmds: readonly Commande[], r: number, deg: number, miroir = false, penche = 0): string {
  const t = (deg * Math.PI) / 180
  const sn = Math.sin(t)
  const cs = Math.cos(t)
  const p = (penche * Math.PI) / 180
  const cp = Math.cos(p)
  const sp = Math.sin(p)
  let d = ''
  for (const c of cmds) {
    if (c[0] === 'Z') {
      d += 'Z'
      continue
    }
    const pts: string[] = []
    for (let i = 1; i < c.length; i += 2) {
      const a = c[i] as number
      const b = c[i + 1] as number
      let U = a * cp - b * sp
      const V = a * sp + b * cp
      if (miroir) U = -U
      const R = r + V
      pts.push(`${f(100 + R * sn + U * cs)} ${f(100 - R * cs + U * sn)}`)
    }
    d += c[0] + pts.join(' ')
  }
  return d
}

/** Une forme, grandie de `k`. */
const grandir = (cmds: readonly Commande[], k: number): Commande[] => cmds.map(c => (c[0] === 'Z' ? c : ([c[0], ...c.slice(1).map(x => (x as number) * k)] as Commande)))

/** Une forme écrite le long de son axe — `t` en travers, `s` de la base (0) à la pointe (1) —, à sa largeur et à sa longueur. */
const aLEchelle = (cmds: readonly Commande[], w: number, L: number): Commande[] =>
  cmds.map(c => (c[0] === 'Z' ? c : ([c[0], ...c.slice(1).map((x, i) => (x as number) * (i % 2 === 0 ? w : L))] as Commande)))

// ── L'ordre des crans ─────────────────────────────────────────────────────

/**
 * Où pousse chaque cran, dans l'ordre où ils se gagnent : du bas vers le
 * haut, à droite puis à gauche. Sertis dans le sens des aiguilles d'une
 * montre depuis midi, les premiers crans faisaient un coin de travers ; d'en
 * bas, deux victoires font déjà un début de couronne, et le haut — que
 * couvre ce qui sort d'un médaillon — se referme en dernier.
 */
export const ANGLES: readonly number[] = [165, 195, 135, 225, 105, 255, 75, 285, 45, 315, 15, 345]

// ── Les métaux et les pierres ─────────────────────────────────────────────

/** Le métal d'une bordure : celui de sa ligue — l'or pour les maîtres, dont les flammes sont d'émail noir. */
const metalDe = (ligue: CleDeLigue): Metal => METAUX[ligue === 'maitre' ? 'or' : ligue]

function melange(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16))
  const x = p(a)
  const y = p(b)
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

/** La pierre de chaque ligue, du reflet au cœur, puis à l'ombre : le rivet, la perle, le rubis, la glace, le brillant, l'onyx. */
const PIERRES: Record<CleDeLigue, readonly [string, string, string]> = {
  bronze: ['#ffe0b8', '#c9803f', '#5e3414'],
  argent: ['#ffffff', '#e6ebf2', '#8d97a6'],
  or: ['#ff9aa8', '#c8152f', '#560616'],
  platine: ['#ffffff', '#bfe9ff', '#4f9bcb'],
  diamant: ['#ffffff', '#e2f4ff', '#86c1ea'],
  maitre: ['#6a5a80', '#1a1422', '#050308'],
}

/** L'émail noir des maîtres. */
const EMAIL = ['#33293f', '#17121e', '#07060a'] as const

/** Le dégradé d'un métal, en diagonale. */
const degrade = (id: string, m: readonly string[]) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="24" y1="16" x2="176" y2="184">${m
    .map((c, i) => `<stop offset="${[0, 0.27, 0.5, 0.73, 1][i]}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`

/** Le métal (`m`), son feu (`f`), son ombre (`s`), l'émail (`e`), la pierre (`p`), la lueur (`b`) et l'ombre portée (`o`). */
function definitions(ligue: CleDeLigue, met: Metal): string {
  const [p0, p1, p2] = PIERRES[ligue]
  return (
    `<defs>${degrade('m', met.m)}${degrade('f', met.m.map(c => melange(c, '#ffffff', 0.42)))}${degrade('s', met.m.map(c => melange(c, '#000000', 0.5)))}` +
    `<linearGradient id="e" gradientUnits="userSpaceOnUse" x1="30" y1="20" x2="170" y2="180"><stop offset="0" stop-color="${EMAIL[0]}"/><stop offset=".5" stop-color="${EMAIL[1]}"/><stop offset="1" stop-color="${EMAIL[2]}"/></linearGradient>` +
    `<radialGradient id="p" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="${p0}"/><stop offset=".45" stop-color="${p1}"/><stop offset="1" stop-color="${p2}"/></radialGradient>` +
    `<filter id="b" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="5"/></filter>` +
    `<filter id="o" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>`
  )
}

/** La pierre d'une ligue : un dôme éclairé d'en haut à gauche, quel que soit son angle — un brillant taillé, un cristal, une étoile d'or sur l'onyx. */
function pierre(ligue: CleDeLigue, x: number, y: number, R: number, met: Metal): string {
  if (ligue === 'diamant') {
    const octogone = (q: number) => {
      let d = ''
      for (let i = 0; i < 8; i++) {
        const t = ((22.5 + i * 45) * Math.PI) / 180
        d += `${i ? 'L' : 'M'}${f(x + q * Math.sin(t))} ${f(y - q * Math.cos(t))}`
      }
      return d + 'Z'
    }
    let aretes = ''
    for (let i = 0; i < 8; i++) {
      const t = ((22.5 + i * 45) * Math.PI) / 180
      aretes += `M${f(x + R * 0.5 * Math.sin(t))} ${f(y - R * 0.5 * Math.cos(t))}L${f(x + R * Math.sin(t))} ${f(y - R * Math.cos(t))}`
    }
    return (
      `<path d="${octogone(R)}" fill="url(#p)" stroke="${met.bord}" stroke-width=".35"/>` +
      `<path d="${octogone(R * 0.5)}" fill="#fff" opacity=".7"/>` +
      `<path d="${aretes}" fill="none" stroke="#4d86b3" stroke-width=".3" opacity=".7"/>` +
      `<path d="${etoile(x - 0.3 * R, y - 0.34 * R, 0.62 * R, 0.13 * R, 4)}" fill="#fff"/>`
    )
  }
  const dome = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#p)" stroke="${met.bord}" stroke-width=".35"/>`
  if (ligue === 'platine') return dome + `<path d="${etoile(x, y, 0.82 * R, 0.2 * R, 4)}" fill="#fff" opacity=".95"/>`
  if (ligue === 'maitre') return dome + `<path d="${etoile(x, y, 0.8 * R, 0.3 * R, 8)}" fill="url(#f)"/>` + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.2 * R)}" fill="#fff6d8"/>`
  const [rx, ry] = [x - 0.32 * R, y - 0.36 * R]
  return dome + `<ellipse cx="${f(rx)}" cy="${f(ry)}" rx="${f(0.3 * R)}" ry="${f(0.2 * R)}" fill="#fff" opacity=".85" transform="rotate(-35 ${f(rx)} ${f(ry)})"/>`
}

// ── L'insigne ─────────────────────────────────────────────────────────────

const ECU: Commande[] = [['M', -7.6, 0], ['L', 7.6, 0], ['L', 7.6, 10], ['C', 7.6, 16, 3.6, 20, 0, 23.6], ['C', -3.6, 20, -7.6, 16, -7.6, 10], ['Z']]
const ECU_DEDANS: Commande[] = [['M', -5.6, 1.8], ['L', 5.6, 1.8], ['L', 5.6, 10], ['C', 5.6, 14.6, 2.7, 17.8, 0, 20.6], ['C', -2.7, 17.8, -5.6, 14.6, -5.6, 10], ['Z']]
const AILE: Commande[] = [['M', 7.4, 9.6], ['C', 12, 10, 16.2, 13.2, 17.8, 18.4], ['C', 12.6, 18.8, 9, 15.8, 7.4, 13.2], ['Z']]
/** La bélière : ce qui tient un pendant au fil. */
const BELIERE: Commande[] = [['M', -4, 0], ['L', 4, 0], ['L', 2.6, 6.4], ['L', -2.6, 6.4], ['Z']]
/** La fleur de lys, celle des Fleurons du 12 octobre : son pétale, puis son cœur, son lien, son pied. */
const PETALE: Commande[] = [['M', 1, 4.6], ['C', 2.2, 10.8, 7, 12.6, 8.1, 8.4], ['C', 8.6, 6.4, 7.6, 4.9, 6.1, 5.3], ['C', 6.9, 6.3, 6.8, 8, 5.6, 8.3], ['C', 4.1, 8.6, 2.9, 6.6, 2.7, 3.9], ['Z']]
const LYS: Commande[][] = [
  [['M', 0, 17], ['C', 2.4, 13.2, 3.1, 8.6, 1.5, 4.4], ['L', -1.5, 4.4], ['C', -3.1, 8.6, -2.4, 13.2, 0, 17], ['Z']],
  [['M', -4.6, 4.6], ['L', 4.6, 4.6], ['L', 4.1, 2.4], ['L', -4.1, 2.4], ['Z']],
  [['M', -1.6, 2.4], ['L', 1.6, 2.4], ['L', 2.6, -0.4], ['L', 0, 0.8], ['L', -2.6, -0.4], ['Z']],
]
/** Les rayons du Soleil noir : une flamme qui ondule, et un trait plus court. */
const RAYON: Commande[] = [['M', -2.3, 0], ['C', -1.9, 6.5, 1.4, 10.5, 0, 19], ['C', 2.8, 12.5, 2.6, 6, 2.3, 0], ['Z']]
const RAYON_COURT: Commande[] = [['M', -1.5, 0], ['L', 0, 11], ['L', 1.5, 0], ['Z']]
/** Un cristal de givre, à six pans, et ses arêtes. */
const cristal = (w: number, L: number): Commande[] => [['M', 0, 0], ['L', w, 0.2 * L], ['L', w, 0.62 * L], ['L', 0, L], ['L', -w, 0.62 * L], ['L', -w, 0.2 * L], ['Z']]
const aretesDuCristal = (w: number, L: number): Commande[] => [['M', 0, 0], ['L', 0, L], ['M', -w, 0.2 * L], ['L', 0, 0.36 * L], ['L', w, 0.2 * L]]

/** Le rayon où l'insigne s'accroche : sous le fil, que l'avatar recouvre. */
const R_INSIGNE = 58.4

/**
 * L'insigne de la ligue, au bas de la bordure : il la dit dès le premier
 * duel, avant qu'une seule feuille ait poussé — l'écu riveté du bronze, la
 * perle en pendant de l'argent, la fleur de lys de l'or, le cristal du givre,
 * le brillant du diamant, le Soleil noir. Sertie, il prend ses deux pierres
 * de côté — ses ailes, pour le bronze.
 */
function insigne(ligue: CleDeLigue, met: Metal, sertie: boolean): string {
  const r0 = R_INSIGNE
  const metal = `fill="url(#m)" stroke="${met.bord}" stroke-width=".5" stroke-linejoin="round"`
  const en = (cmds: readonly Commande[], r = r0, deg = 180, miroir = false) => `<path d="${poser(cmds, r, deg, miroir)}" ${metal}/>`
  /** Une pierre dans sa sertissure, dans le repère de l'insigne : `u` de côté, `v` vers le bas. */
  const posee = (u: number, v: number, R: number) => {
    const x = 100 - u
    const y = 100 + r0 + v
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * 1.24)}" ${metal}/>` + pierre(ligue, x, y, R, met)
  }
  const cotes = (v: number, R: number, u: number) => (sertie ? posee(u, v, R) + posee(-u, v, R) : '')
  if (ligue === 'bronze') {
    return (
      (sertie ? en(AILE) + en(AILE, r0, 180, true) : '') +
      en(ECU) +
      `<path d="${poser(ECU_DEDANS, r0, 180)}" fill="none" stroke="#fff" stroke-width=".4" opacity=".42"/>` +
      pierre(ligue, 100, 100 + r0 + 10.2, 4.9, met)
    )
  }
  if (ligue === 'argent') return en(BELIERE) + cotes(6.6, 2.6, 10.4) + posee(0, 13.2, 6.2)
  if (ligue === 'or') {
    const k = 1.42
    const pied = r0 + 3
    return LYS.map(p => en(grandir(p, k), pied)).join('') + en(grandir(PETALE, k), pied) + en(grandir(PETALE, k), pied, 180, true) + cotes(6.4, 2.4, 14) + pierre(ligue, 100, 100 + pied + 3.5 * k, 3, met)
  }
  if (ligue === 'platine') {
    const glace = `fill="url(#p)" stroke="${met.bord}" stroke-width=".45" stroke-linejoin="round"`
    const g = (w: number, L: number, penche: number, miroir = false) =>
      `<path d="${poser(cristal(w, L), r0 + 5, 180, miroir, penche)}" ${glace}/>` +
      `<path d="${poser(aretesDuCristal(w, L), r0 + 5, 180, miroir, penche)}" fill="none" stroke="#3f7fae" stroke-width=".4" opacity=".7"/>`
    return en(BELIERE) + g(2.6, 12, 58) + g(2.6, 12, 58, true) + g(4.2, 19, 0) + cotes(4.2, 2.2, 13.6)
  }
  if (ligue === 'diamant') return en(BELIERE) + cotes(6.8, 2.8, 10.8) + posee(0, 13.6, 6.6)
  // Le Soleil noir : une flamme d'or — trois, sertie —, ses rais, et le disque d'onyx devant eux.
  const y = 100 + r0 + 10.6
  let rais = ''
  for (let i = 0; i < 12; i++) {
    const t = (i * 30 * Math.PI) / 180
    const [a, b] = [t - 0.17, t + 0.17]
    rais += `M${f(100 + 8.2 * Math.sin(a))} ${f(y - 8.2 * Math.cos(a))}L${f(100 + 12.2 * Math.sin(t))} ${f(y - 12.2 * Math.cos(t))}L${f(100 + 8.2 * Math.sin(b))} ${f(y - 8.2 * Math.cos(b))}Z`
  }
  return (
    en(RAYON, r0 + 14) +
    (sertie ? en(RAYON_COURT, r0 + 12, 168) + en(RAYON_COURT, r0 + 12, 192) : '') +
    `<path d="${rais}" ${metal}/>` +
    `<circle cx="100" cy="${f(y)}" r="8.2" fill="url(#m)" stroke="${met.bord}" stroke-width=".5"/>` +
    `<circle cx="100" cy="${f(y)}" r="6.6" fill="url(#p)"/>` +
    `<path d="${etoile(100, y, 4.2, 1.5, 8)}" fill="url(#f)"/>`
  )
}

// ── Les feuilles ──────────────────────────────────────────────────────────

/** La feuille de chaque ligue, le long de son axe : son corps, sa nervure ou ses arêtes, sa longueur et sa demi-largeur. */
const FEUILLES: Record<CleDeLigue, { corps: Commande[]; nervure?: Commande[]; L: number; w: number }> = {
  // Le laurier du bronze : large, une nervure.
  bronze: {
    corps: [['M', 0, 0], ['C', 0.95, 0.16, 1.05, 0.56, 0, 1], ['C', -1.05, 0.56, -0.95, 0.16, 0, 0], ['Z']],
    nervure: [['M', 0, 0.12], ['L', 0, 0.84]],
    L: 25,
    w: 6,
  },
  // L'olivier de l'argent : plus fin.
  argent: {
    corps: [['M', 0, 0], ['C', 0.9, 0.2, 0.95, 0.6, 0, 1], ['C', -0.95, 0.6, -0.9, 0.2, 0, 0], ['Z']],
    nervure: [['M', 0, 0.12], ['L', 0, 0.84]],
    L: 26,
    w: 4.8,
  },
  // La feuille d'or : ourlée, sa pointe se recourbe.
  or: {
    corps: [['M', 0, 0], ['C', 1.1, 0.12, 1.25, 0.5, 0.5, 0.74], ['C', 0.32, 0.86, 0.12, 0.95, -0.28, 1.04], ['C', -0.16, 0.78, -1.15, 0.6, -0.92, 0.26], ['C', -0.82, 0.12, -0.5, 0.04, 0, 0], ['Z']],
    nervure: [['M', 0, 0.1], ['C', 0.16, 0.4, 0.1, 0.7, -0.16, 0.9]],
    L: 25,
    w: 5.8,
  },
  // Le cristal de givre du platine : une aiguille à six pans, une arête au milieu.
  platine: {
    corps: [['M', 0, 0], ['L', 0.9, 0.2], ['L', 0.9, 0.66], ['L', 0, 1], ['L', -0.9, 0.66], ['L', -0.9, 0.2], ['Z']],
    nervure: [['M', 0, 0], ['L', 0, 1], ['M', -0.9, 0.2], ['L', 0, 0.36], ['L', 0.9, 0.2], ['M', -0.9, 0.66], ['L', 0, 0.54], ['L', 0.9, 0.66]],
    L: 26,
    w: 3.5,
  },
  // La marquise du diamant : une navette taillée.
  diamant: {
    corps: [['M', 0, 0], ['C', 1.05, 0.26, 1.05, 0.74, 0, 1], ['C', -1.05, 0.74, -1.05, 0.26, 0, 0], ['Z']],
    nervure: [['M', 0, 0], ['L', 0, 1], ['M', -0.78, 0.5], ['L', 0, 0.26], ['L', 0.78, 0.5], ['L', 0, 0.74], ['Z']],
    L: 24,
    w: 5,
  },
  // La flamme du Soleil noir, d'émail noir ourlé d'or.
  maitre: {
    corps: [['M', 0, 0], ['C', 1.3, 0.18, 0.5, 0.46, 0.95, 0.68], ['C', 0.7, 0.84, 0.25, 0.9, 0.05, 1.06], ['C', -0.3, 0.8, -1.2, 0.6, -0.6, 0.32], ['C', -0.4, 0.2, -0.5, 0.08, 0, 0], ['Z']],
    L: 27,
    w: 5.4,
  },
}

/** Le fil, de son bord intérieur à l'extérieur, et le pied des feuilles sur lui. */
const FIL = [59.8, 62.6] as const
const PIED = FIL[1] - 0.6
/** De combien une feuille se couche vers midi : la grande, puis la petite, presque contre le fil. */
const PENCHE = 54
const COUCHE = 82

// ── Le cadre ──────────────────────────────────────────────────────────────

const OUVRIR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">`

const borner = (crans: number) => Math.max(0, Math.min(CRANS_D_UNE_BORDURE, Math.round(crans)))

/**
 * Ce qui est de métal, de pierre ou d'émail dans une bordure : son fil, ses
 * bourgeons, ses feuilles, son insigne. Sans son ombre ni sa lueur — c'est
 * aussi la forme que suit l'éclat qui en fait le tour (`svgDeLaSilhouette`).
 */
function parure(ligue: CleDeLigue, crans: number, met: Metal): string {
  const F = FEUILLES[ligue]
  const corps = aLEchelle(F.corps, F.w, F.L)
  const petite = aLEchelle(F.corps, F.w * 0.74, F.L * 0.66)
  const nervure = F.nervure ? aLEchelle(F.nervure, F.w, F.L) : null
  const email = ligue === 'maitre'
  const glace = ligue === 'platine' || ligue === 'diamant'
  let s = `<path d="${anneau(FIL[0], FIL[1])}" fill-rule="evenodd" fill="url(#m)" stroke="${met.bord}" stroke-width=".55"/>`
  s += `<circle cx="100" cy="100" r="${FIL[0] + 0.9}" fill="none" stroke="#fff" stroke-width=".45" opacity=".45"/>`
  // Un cran à gagner : un bourgeon sur le fil, du métal assombri — une place qui attend, pas un fantôme.
  let bourgeons = ''
  for (let i = crans; i < CRANS_D_UNE_BORDURE; i++) {
    const [x, y] = xy(FIL[1] + 0.6, ANGLES[i])
    bourgeons += rond(x, y, 2.1)
  }
  if (bourgeons) s += `<path d="${bourgeons}" fill="url(#s)" stroke="${met.bord}" stroke-width=".45"/>`
  // Un cran gagné : un brin de deux feuilles. De la plus haute à la plus basse, chacune passe sur le pied de celle d'au-dessus.
  const filet = `stroke="${email ? 'url(#m)' : met.bord}" stroke-width="${email ? 1 : 0.5}" stroke-linejoin="round"`
  const remplir = email ? 'url(#e)' : ligue === 'platine' ? 'url(#p)' : ligue === 'diamant' ? 'url(#f)' : 'url(#m)'
  for (let i = crans - 1; i >= 0; i--) {
    const a = ANGLES[i]
    const gauche = a > 180
    s += `<path d="${poser(petite, PIED + 0.4, a, gauche, COUCHE)}" fill="${email ? 'url(#e)' : 'url(#s)'}" ${filet}/>`
    s += `<path d="${poser(corps, PIED, a, gauche, PENCHE)}" fill="${remplir}" ${filet}/>`
    if (nervure)
      s += `<path d="${poser(nervure, PIED, a, gauche, PENCHE)}" fill="none" stroke="${glace ? '#4d86b3' : '#000'}" stroke-width="${glace ? 0.4 : 0.55}" opacity="${glace ? 0.75 : 0.38}" stroke-linecap="round" stroke-linejoin="round"/>`
    // Le diamant jette un éclat à la pointe d'une marquise sur deux : sans lui, trois métaux blancs se confondaient.
    if (ligue === 'diamant' && i % 2 === 0) {
      const [ex, ey] = xy(PIED + F.L * 0.62, a + (gauche ? 1 : -1) * 17.5)
      s += `<path d="${etoile(ex, ey, 3.6, 0.7, 4)}" fill="#fff"/>`
    }
    // Sa pierre, au pied du brin, sur le fil.
    const [x, y] = xy(FIL[1] - 0.2, a)
    s += ligue === 'bronze'
      ? `<circle cx="${f(x)}" cy="${f(y)}" r="2.5" fill="url(#f)" stroke="${met.bord}" stroke-width=".4"/><circle cx="${f(x - 0.8)}" cy="${f(y - 0.9)}" r=".8" fill="#fff" opacity=".8"/>`
      : pierre(ligue, x, y, 2.9, met)
  }
  return s + insigne(ligue, met, crans >= CRANS_D_UNE_BORDURE)
}

/**
 * Le cadre d'une bordure, en SVG : son ombre portée, sa parure — et, sertie,
 * sa lueur. Rien au milieu : l'emoji garde son halo, le médaillon son cercle.
 */
export function svgDuCadre(ligue: CleDeLigue, crans: number): string {
  const n = borner(crans)
  const met = metalDe(ligue)
  const corps = aLEchelle(FEUILLES[ligue].corps, FEUILLES[ligue].w, FEUILLES[ligue].L)
  // L'ombre du fil et des feuilles seuls : un disque assombrirait l'avatar.
  let ombres = ''
  for (let i = 0; i < n; i++) ombres += poser(corps, PIED, ANGLES[i], ANGLES[i] > 180, PENCHE)
  return (
    OUVRIR +
    definitions(ligue, met) +
    `<g transform="translate(0 2.4)" opacity=".42" filter="url(#o)">${ombres ? `<path d="${ombres}" fill="#000"/>` : ''}<circle cx="100" cy="100" r="${(FIL[0] + FIL[1]) / 2}" fill="none" stroke="#000" stroke-width="5"/></g>` +
    (n >= CRANS_D_UNE_BORDURE ? `<circle cx="100" cy="100" r="68" fill="none" stroke="${met.lueur}" stroke-width="7" opacity=".5" filter="url(#b)"/>` : '') +
    parure(ligue, n, met) +
    `</svg>`
  )
}

/** Les ligues dont la bordure a son éclat, qui en fait le tour : l'argent et le diamant, comme avant, et les maîtres, à la place de leurs rayons. */
const A_SON_ECLAT: ReadonlySet<CleDeLigue> = new Set<CleDeLigue>(['argent', 'diamant', 'maitre'])

/**
 * La silhouette d'une bordure, pour les ligues qui ont leur éclat : son
 * métal seul, sans ombre ni lueur. L'éclat est un pinceau de lumière qui
 * tourne, découpé par elle (`Bordure.tsx`, `styles.css`) : sur une couronne
 * ajourée, un anneau de lumière serait passé aussi entre les feuilles.
 */
export function svgDeLaSilhouette(ligue: CleDeLigue, crans: number): string | null {
  if (!A_SON_ECLAT.has(ligue)) return null
  const met = metalDe(ligue)
  return OUVRIR + definitions(ligue, met) + parure(ligue, borner(crans), met) + `</svg>`
}

const image = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`

/** Ce qu'une bordure montre : son cadre, et la silhouette que suit son éclat si elle en a un. */
export interface DessinDeBordure {
  cadre: string
  silhouette: string | null
}

const FAITS = new Map<string, DessinDeBordure>()

/** Une bordure en images, faites une fois par ligue et par nombre de crans, pour toute la page. */
export function dessinDeBordure(ligue: CleDeLigue, crans: number): DessinDeBordure {
  const cle = `${ligue}:${crans}`
  let fait = FAITS.get(cle)
  if (!fait) {
    const silhouette = svgDeLaSilhouette(ligue, crans)
    fait = { cadre: image(svgDuCadre(ligue, crans)), silhouette: silhouette ? image(silhouette) : null }
    FAITS.set(cle, fait)
  }
  return fait
}
