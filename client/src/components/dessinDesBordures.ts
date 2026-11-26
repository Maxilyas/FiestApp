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

// ── Les motifs ────────────────────────────────────────────────────────────
//
// Ce qui pousse à chaque victoire se choisit depuis le 26 novembre 2026 (la
// planche `retours/2026-11-26/bordures-au-choix/`, et le propriétaire : « Fait
// selon tes recommandations ») : la ligue garde ce qui la dit — son métal, son
// insigne, ses douze crans —, le motif est un goût. « Les Feuilles », le brin
// de la ligue, restent dessinées par la parure d'au-dessus, au pixel près ; un
// autre motif passe par ici, dans le même repère, avec les mêmes règles :
// un cran à gagner est une place qui attend, jamais un pointillé ; les crans
// montent du bas, à droite puis à gauche (`ANGLES`) ; le haut se referme en
// dernier. Une forme se dessine debout — `u` en travers, `v` vers
// l'extérieur —, et `-u` est « vers midi » : `poser` la retourne pour le côté
// gauche. Leur ombre portée tient dans un filtre (`#d`) : chaque motif l'a sans
// la dessiner deux fois.

/** Ce qu'un motif sait de sa bordure : sa ligue, son métal, et de quoi se remplir. */
interface Contexte {
  ligue: CleDeLigue
  met: Metal
  /** Les maîtres : l'émail noir ourlé d'or. */
  email: boolean
  /** Le remplissage d'une pièce : le métal, la glace du platine, le feu du diamant, l'émail des maîtres. */
  remplir: string
  /** Un remplissage clair : le feu du métal, là où le métal seul serait terne. */
  clair: string
  /** Son filet. */
  filet: string
}

interface Motif {
  /** Un jonc deux fois plus large que le fil : le Jonc serti. */
  jonc?: boolean
  /** Un cran gagné, à l'angle `a` ; `gauche` le retourne ; `i`, son rang (0 : le premier gagné). */
  cran: (c: Contexte, a: number, gauche: boolean, i: number) => string
  /** Un cran à gagner : d'office, un bourgeon sur le fil. */
  attente?: (c: Contexte, a: number) => string
  /** Ce qui se dessine sous les crans, une fois qu'ils sont tous posés (les liens d'une constellation). */
  dessous?: (c: Contexte, n: number) => string
}

const JONC = [58.6, 64.8] as const
/** Les ligues dont le brin se prête. */
const LIGUES_DES_FEUILLES = Object.keys(FEUILLES) as CleDeLigue[]
/** « Vers midi », en degrés : à droite on remonte en reculant, à gauche en avançant. */
const versMidi = (gauche: boolean) => (gauche ? 1 : -1)
const decaler = (cmds: readonly Commande[], du: number, dv: number): Commande[] =>
  cmds.map(c => (c[0] === 'Z' ? c : ([c[0], ...c.slice(1).map((x, i) => (x as number) + (i % 2 === 0 ? du : dv))] as Commande)))
/** Une forme retournée de gauche à droite, dans son propre repère. */
const retourner = (cmds: readonly Commande[]): Commande[] => cmds.map(c => (c[0] === 'Z' ? c : ([c[0], ...c.slice(1).map((x, i) => (i % 2 === 0 ? -(x as number) : (x as number)))] as Commande)))

/**
 * Une forme posée le long du cercle et non de sa tangente : `u` y est une
 * longueur d'arc au rayon `r`. Pour ce qui court sur le fil — une frise —, où
 * la tangente s'écarterait du cercle aux deux bouts.
 */
function polaire(cmds: readonly Commande[], r: number, deg: number, miroir = false): string {
  let d = ''
  for (const c of cmds) {
    if (c[0] === 'Z') {
      d += 'Z'
      continue
    }
    const pts: string[] = []
    for (let i = 1; i < c.length; i += 2) {
      const u = (miroir ? -1 : 1) * (c[i] as number)
      const [x, y] = xy(r + (c[i + 1] as number), deg + (u / r) * (180 / Math.PI))
      pts.push(`${f(x)} ${f(y)}`)
    }
    d += c[0] + pts.join(' ')
  }
  return d
}

const bourgeon = (c: Contexte, a: number) => {
  const [x, y] = xy(FIL[1] + 0.6, a)
  return `<path d="${rond(x, y, 2.1)}" fill="url(#s)" stroke="${c.met.bord}" stroke-width=".45"/>`
}

/** Une perle ronde, à la couleur de la pierre de la ligue — jamais taillée. */
const perle = (x: number, y: number, R: number, met: Metal) =>
  `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#p)" stroke="${met.bord}" stroke-width=".35"/>` +
  `<ellipse cx="${f(x - 0.34 * R)}" cy="${f(y - 0.36 * R)}" rx="${f(0.32 * R)}" ry="${f(0.22 * R)}" fill="#fff" opacity=".8" transform="rotate(-35 ${f(x - 0.34 * R)} ${f(y - 0.36 * R)})"/>`

/** Une pièce posée : son tracé, rempli et ourlé. */
const piece = (d: string, remplir: string, filet: string) => `<path d="${d}" fill="${remplir}" ${filet}/>`

// Le brin d'une autre ligue, porté dans celle-ci (« chaque bordure sertie prête sa feuille ») :
// la feuille de sa ligue, le métal et les pierres de celle qui le porte.
function feuillesDe(de: CleDeLigue): Motif {
  const F = FEUILLES[de]
  const corps = aLEchelle(F.corps, F.w, F.L)
  const petite = aLEchelle(F.corps, F.w * 0.74, F.L * 0.66)
  const nervure = F.nervure ? aLEchelle(F.nervure, F.w, F.L) : null
  const glace = de === 'platine' || de === 'diamant'
  return {
    cran: (c, a, gauche, i) => {
      // Le givre garde sa glace hors du platine : à la pierre d'une autre ligue, il virait au rubis en ligue d'or.
      const remplir = c.email ? 'url(#e)' : de === 'platine' ? (c.ligue === 'platine' ? 'url(#p)' : 'url(#f)') : de === 'diamant' ? 'url(#f)' : 'url(#m)'
      let s = `<path d="${poser(petite, PIED + 0.4, a, gauche, COUCHE)}" fill="${c.email ? 'url(#e)' : 'url(#s)'}" ${c.filet}/>`
      s += `<path d="${poser(corps, PIED, a, gauche, PENCHE)}" fill="${remplir}" ${c.filet}/>`
      if (nervure)
        s += `<path d="${poser(nervure, PIED, a, gauche, PENCHE)}" fill="none" stroke="${glace ? '#4d86b3' : '#000'}" stroke-width="${glace ? 0.4 : 0.55}" opacity="${glace ? 0.75 : 0.38}" stroke-linecap="round" stroke-linejoin="round"/>`
      if (de === 'diamant' && i % 2 === 0) {
        const [ex, ey] = xy(PIED + F.L * 0.62, a + (gauche ? 1 : -1) * 17.5)
        s += `<path d="${etoile(ex, ey, 3.6, 0.7, 4)}" fill="#fff"/>`
      }
      const [x, y] = xy(FIL[1] - 0.2, a)
      return s + pierre(c.ligue, x, y, 2.9, c.met)
    },
  }
}

// Le Jonc serti : un anneau large, un chaton par cran — la pierre de la ligue y est sertie à chaque victoire.
const jonc: Motif = {
  jonc: true,
  cran: (c, a) => {
    const [x, y] = xy((JONC[0] + JONC[1]) / 2, a)
    return `<circle cx="${f(x)}" cy="${f(y)}" r="4.3" fill="url(#f)" stroke="${c.met.bord}" stroke-width=".5"/>` + pierre(c.ligue, x, y, 3.2, c.met)
  },
  attente: (c, a) => {
    const [x, y] = xy((JONC[0] + JONC[1]) / 2, a)
    return `<circle cx="${f(x)}" cy="${f(y)}" r="3.4" fill="url(#s)" stroke="${c.met.bord}" stroke-width=".45"/><circle cx="${f(x)}" cy="${f(y)}" r="1.6" fill="${c.met.bord}" opacity=".55"/>`
  },
}

// Le Fil nu : la ligue seule, son insigne. Les crans se lisent dans « Ma collection ».
const nu: Motif = { cran: () => '', attente: () => '' }

// Les Perles : un trio de perles graduées par victoire, à la couleur de la pierre de la ligue.
const perles: Motif = {
  cran: (c, a) => {
    const [x, y] = xy(66.4, a)
    const [x1, y1] = xy(65.2, a - 8.6)
    const [x2, y2] = xy(65.2, a + 8.6)
    return perle(x1, y1, 2.3, c.met) + perle(x2, y2, 2.3, c.met) + perle(x, y, 3.6, c.met)
  },
  attente: (c, a) => {
    const [x, y] = xy(FIL[1] + 0.4, a)
    return `<circle cx="${f(x)}" cy="${f(y)}" r="1.5" fill="url(#s)" stroke="${c.met.bord}" stroke-width=".35"/>`
  },
}

// Les Étoiles : une étoile par victoire, reliées en constellation de chaque côté.
const ETOILE: Commande[] = [
  ...Array.from({ length: 10 }, (_, k): Commande => {
    const t = (k * 36 * Math.PI) / 180
    const q = k % 2 === 0 ? 7.4 : 3
    return [k === 0 ? 'M' : 'L', q * Math.sin(t), q * Math.cos(t)]
  }),
  ['Z'],
]
const R_ETOILES = 70.5
const etoiles: Motif = {
  dessous: (_c, n) => {
    let d = ''
    for (const cote of [0, 1]) {
      const siens = ANGLES.filter((_, i) => i < n && i % 2 === cote)
      for (let k = 1; k < siens.length; k++) {
        const [x0, y0] = xy(R_ETOILES, siens[k - 1])
        const [x1, y1] = xy(R_ETOILES, siens[k])
        d += `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`
      }
    }
    return d ? `<path d="${d}" fill="none" stroke="url(#m)" stroke-width=".8" opacity=".85" stroke-dasharray="1.6 1.4"/>` : ''
  },
  cran: (c, a, gauche) => {
    const [ex, ey] = xy(66, a + versMidi(gauche) * 15)
    const [x, y] = xy(R_ETOILES, a)
    return (
      `<path d="${poser(ETOILE, R_ETOILES, a)}" fill="${c.email ? 'url(#f)' : c.clair}" stroke="${c.met.bord}" stroke-width=".5" stroke-linejoin="round"/>` +
      `<path d="${etoile(ex, ey, 2.4, 0.5, 4)}" fill="url(#f)"/>` +
      pierre(c.ligue, x, y, 1.6, c.met)
    )
  },
}

// Les Écailles : deux par victoire, couchées vers midi, la plus basse sur la plus haute — une armure.
const ECAILLE: Commande[] = [['M', -8.6, -1.2], ['C', -8.8, 5, -4.4, 10.4, 0, 12.4], ['C', 4.4, 10.4, 8.8, 5, 8.6, -1.2], ['Z']]
const ECAILLE_DEDANS: Commande[] = [['M', -5.6, 1.4], ['C', -5.7, 5.8, -2.8, 8.8, 0, 10], ['C', 2.8, 8.8, 5.7, 5.8, 5.6, 1.4]]
const ARETE: Commande[] = [['M', 0, 1], ['L', 0, 10.6]]
const ecailles: Motif = {
  cran: (c, a, gauche) => {
    let s = ''
    for (const k of [1, -1]) {
      const b = a + versMidi(gauche) * 7.5 * k
      s += piece(poser(ECAILLE, 60.6, b, gauche, 62), c.remplir, c.filet)
      s += `<path d="${poser(ECAILLE_DEDANS, 60.6, b, gauche, 62)}" fill="none" stroke="#fff" stroke-width=".55" opacity="${c.email ? 0.25 : 0.45}"/>`
      s += `<path d="${poser(ARETE, 60.6, b, gauche, 62)}" fill="none" stroke="${c.email ? 'url(#m)' : c.met.bord}" stroke-width=".4" opacity=".5"/>`
    }
    return s
  },
}

// Les Vagues : une vague qui s'enroule vers midi par victoire, son écume, une perle d'eau au pied.
const VAGUE: Commande[] = [
  ['M', 9.5, -0.6],
  ['C', 9, 6, 4.4, 12.2, -1.8, 13.8],
  ['C', -7.6, 15.2, -12, 11.8, -10.6, 7.4],
  ['C', -9.6, 4.4, -5.6, 4.2, -5, 6.9],
  ['C', -4.6, 8.8, -6.3, 9.8, -7.5, 9.1],
  ['C', -5.6, 11.8, -1, 10.8, 0.6, 6.8],
  ['C', 1.7, 4, 0.8, 1.2, -1.2, -0.6],
  ['Z'],
]
const ECUME: Commande[] = [['M', 7.6, 2.4], ['C', 6.8, 7.4, 2.8, 11.4, -2.2, 12.6]]
const vagues: Motif = {
  cran: (c, a, gauche) => {
    const [x, y] = xy(FIL[1] - 0.2, a - versMidi(gauche) * 6)
    return (
      piece(poser(VAGUE, 61.4, a, gauche, 12), c.remplir, c.filet) +
      `<path d="${poser(ECUME, 61.4, a, gauche, 12)}" fill="none" stroke="#fff" stroke-width=".7" stroke-linecap="round" opacity="${c.email ? 0.3 : 0.55}"/>` +
      perle(x, y, 1.7, c.met)
    )
  },
}

// Les Rayons : un soleil art déco, trois rais par victoire et sa pierre au pied.
const RAI: Commande[] = [['M', -2.5, 0], ['L', -0.7, 18], ['L', 0.7, 18], ['L', 2.5, 0], ['Z']]
const RAI_COURT: Commande[] = [['M', -1.7, 0], ['L', 0, 10.5], ['L', 1.7, 0], ['Z']]
const rayons: Motif = {
  cran: (c, a) => {
    const [x, y] = xy(FIL[1] + 1.2, a)
    return (
      piece(poser(RAI_COURT, PIED, a - 10), c.remplir, c.filet) +
      piece(poser(RAI_COURT, PIED, a + 10), c.remplir, c.filet) +
      piece(poser(RAI, PIED, a), c.remplir, c.filet) +
      pierre(c.ligue, x, y, 1.9, c.met)
    )
  },
}

// Les Fleurs : une fleur de bijou à cinq pétales et son bouton, le cœur à la pierre de la ligue.
const fleurs: Motif = {
  cran: (c, a, gauche) => {
    const [cx, cy] = xy(69.2, a)
    const vers = versMidi(gauche)
    const [bx, by] = xy(64.6, a + vers * 14)
    let s = `<ellipse cx="${f(bx)}" cy="${f(by)}" rx="1.7" ry="2.6" fill="url(#s)" stroke="${c.met.bord}" stroke-width=".4" transform="rotate(${f(a + vers * 49)} ${f(bx)} ${f(by)})"/>`
    for (let k = 0; k < 5; k++) {
      const t = a + k * 72
      const px = cx + 3.8 * Math.sin((t * Math.PI) / 180)
      const py = cy - 3.8 * Math.cos((t * Math.PI) / 180)
      s += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="2.9" ry="4.1" fill="${c.remplir}" stroke="${c.email ? 'url(#m)' : c.met.bord}" stroke-width="${c.email ? 0.8 : 0.45}" transform="rotate(${f(t)} ${f(px)} ${f(py)})"/>`
    }
    return s + pierre(c.ligue, cx, cy, 1.9, c.met)
  },
}

// Les Plumes : une rémige par victoire, couchée vers midi, son rachis, ses barbes, son entaille.
const PLUME: Commande[] = [['M', 0, 0], ['C', 0.5, 0.05, 1, 0.25, 1, 0.55], ['C', 1, 0.8, 0.55, 1, 0.1, 1.06], ['C', -0.35, 0.98, -0.62, 0.75, -0.62, 0.5], ['C', -0.62, 0.25, -0.35, 0.08, 0, 0], ['Z']]
const RACHIS: Commande[] = [['M', 0, -0.08], ['C', 0.06, 0.35, 0.1, 0.7, 0.1, 1.02]]
const BARBES: Commande[] = [0.18, 0.3, 0.42, 0.54, 0.66, 0.78, 0.88].flatMap((s): Commande[] => [['M', 0.06, s], ['L', 0.9, s + 0.14], ['M', 0.05, s], ['L', -0.56, s + 0.12]])
const ENTAILLE: Commande[] = [['M', 1.02, 0.6], ['L', 0.42, 0.62], ['L', 0.98, 0.7]]
const plumes: Motif = {
  cran: (c, a, gauche) => {
    const [L, w, penche, r] = [31, 4.6, 64, PIED - 0.6]
    return (
      piece(poser(aLEchelle(PLUME, w, L), r, a, gauche, penche), c.remplir, c.filet) +
      `<path d="${poser(aLEchelle(BARBES, w, L), r, a, gauche, penche)}" fill="none" stroke="${c.email ? '#e9c873' : c.met.bord}" stroke-width=".4" opacity="${c.email ? 0.6 : 0.5}"/>` +
      `<path d="${poser(aLEchelle(ENTAILLE, w, L), r, a, gauche, penche)}" fill="${c.email ? '#07060a' : 'url(#s)'}" stroke="${c.email ? 'url(#m)' : c.met.bord}" stroke-width=".35"/>` +
      `<path d="${poser(aLEchelle(RACHIS, w, L), r, a, gauche, penche)}" fill="none" stroke="${c.email ? 'url(#f)' : c.met.bord}" stroke-width=".8" stroke-linecap="round"/>`
    )
  },
}

// Les Flammes : deux flammes par victoire, leur cœur à la pierre de la ligue — le Soleil noir, à toutes les ligues.
const flammes: Motif = {
  cran: (c, a, gauche) => {
    const F = FEUILLES.maitre.corps
    return (
      piece(poser(aLEchelle(F, 4, 17), PIED + 0.4, a, gauche, 78), c.email ? 'url(#e)' : 'url(#s)', c.filet) +
      piece(poser(aLEchelle(F, 5.6, 26), PIED, a, gauche, 42), c.remplir, c.filet) +
      `<path d="${poser(decaler(aLEchelle(F, 2.6, 14), 0, 1.6), PIED, a, gauche, 42)}" fill="url(#p)" opacity=".9"/>`
    )
  },
}

// Les Rouages : un engrenage par victoire et son pignon, la pierre au moyeu — l'atelier d'Automate.
function engrenage(x: number, y: number, R: number, r: number, n: number, trou: number, phase: number): string {
  let d = ''
  const pas = (2 * Math.PI) / n
  for (let k = 0; k < n; k++) {
    const t0 = ((k / n) * 360 + phase) * (Math.PI / 180)
    for (const [q, t] of [
      [r, t0],
      [R, t0 + pas * 0.18],
      [R, t0 + pas * 0.48],
      [r, t0 + pas * 0.66],
    ] as const)
      d += `${d ? 'L' : 'M'}${f(x + q * Math.sin(t))} ${f(y - q * Math.cos(t))}`
  }
  return d + 'Z' + rond(x, y, trou)
}
const rouages: Motif = {
  cran: (c, a, gauche, i) => {
    const [x, y] = xy(68.6, a)
    const [px, py] = xy(64.4, a + versMidi(gauche) * 15.5)
    return (
      `<path d="${engrenage(px, py, 3.8, 2.9, 7, 1.1, i * 9)}" fill-rule="evenodd" fill="url(#s)" stroke="${c.met.bord}" stroke-width=".4"/>` +
      `<path d="${engrenage(x, y, 7.4, 5.8, 10, 2.7, a)}" fill-rule="evenodd" fill="${c.remplir}" ${c.filet}/>` +
      pierre(c.ligue, x, y, 1.9, c.met)
    )
  },
}

// Les Cœurs (la Saint-Valentin) : un cœur d'émail rose ourlé du métal de la ligue, et son petit.
const COEUR: Commande[] = [['M', 0, -4.6], ['C', -2.5, -2.2, -6, 0.2, -6, 3.4], ['C', -6, 6, -3.8, 7.4, -2, 7.4], ['C', -1, 7.4, -0.3, 6.8, 0, 6], ['C', 0.3, 6.8, 1, 7.4, 2, 7.4], ['C', 3.8, 7.4, 6, 6, 6, 3.4], ['C', 6, 0.2, 2.5, -2.2, 0, -4.6], ['Z']]
const coeurs: Motif = {
  cran: (c, a, gauche) => {
    const [x, y] = xy(70, a)
    return (
      `<path d="${poser(grandir(COEUR, 0.5), 64.8, a + versMidi(gauche) * 14.5, gauche, 25)}" fill="url(#c)" stroke="url(#m)" stroke-width=".7"/>` +
      `<path d="${poser(COEUR, 68.2, a)}" fill="url(#c)" stroke="url(#m)" stroke-width="1.1" stroke-linejoin="round"/>` +
      `<ellipse cx="${f(x - 1.8)}" cy="${f(y - 1.4)}" rx="1.2" ry=".7" fill="#fff" opacity=".7" transform="rotate(-35 ${f(x - 1.8)} ${f(y - 1.4)})"/>`
    )
  },
}

// Le Houx (Noël) : une feuille d'émail vert ourlée du métal de la ligue, et ses deux baies.
const HOUX: Commande[] = [
  ['M', 0, 0], ['L', 0.5, 0.08], ['L', 0.95, 0.04], ['L', 0.74, 0.28], ['L', 1.05, 0.42], ['L', 0.7, 0.54], ['L', 0.88, 0.76], ['L', 0.44, 0.78], ['L', 0, 1.04],
  ['L', -0.44, 0.78], ['L', -0.88, 0.76], ['L', -0.7, 0.54], ['L', -1.05, 0.42], ['L', -0.74, 0.28], ['L', -0.95, 0.04], ['L', -0.5, 0.08], ['Z'],
]
const baie = (x: number, y: number) => `<circle cx="${f(x)}" cy="${f(y)}" r="2.3" fill="url(#r)" stroke="#3a0408" stroke-width=".35"/><circle cx="${f(x - 0.7)}" cy="${f(y - 0.8)}" r=".6" fill="#fff" opacity=".8"/>`
const houx: Motif = {
  cran: (_c, a, gauche) => {
    const [b1x, b1y] = xy(FIL[1] + 2.4, a - versMidi(gauche) * 3.4)
    const [b2x, b2y] = xy(FIL[1] + 5.4, a - versMidi(gauche) * 0.6)
    return (
      `<path d="${poser(aLEchelle(HOUX, 5.6, 23), PIED, a, gauche, 50)}" fill="url(#h)" stroke="url(#m)" stroke-width=".8" stroke-linejoin="round"/>` +
      `<path d="${poser(aLEchelle([['M', 0, 0.05], ['L', 0, 0.92]], 5.6, 23), PIED, a, gauche, 50)}" fill="none" stroke="url(#m)" stroke-width=".5" opacity=".8"/>` +
      baie(b1x, b1y) +
      baie(b2x, b2y)
    )
  },
}

// Les Serpentins : un ruban qui frise vers midi par victoire, et deux confettis — la fête, à toutes les ligues.
const RUBAN: Commande[] = [['M', 0, 0], ['C', 4.6, 3.2, -4.6, 6.8, 0, 10], ['C', 4.6, 13.2, -4, 16.4, -0.8, 19.6]]
const CONFETTI: Commande[] = [['M', -1.4, -0.85], ['L', 1.4, -0.85], ['L', 1.4, 0.85], ['L', -1.4, 0.85], ['Z']]
const serpentins: Motif = {
  cran: (c, a, gauche, i) => {
    const ruban = poser(RUBAN, PIED, a, gauche, 36)
    const vers = versMidi(gauche)
    return (
      `<path d="${ruban}" fill="none" stroke="${c.email ? 'url(#m)' : c.met.bord}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${ruban}" fill="none" stroke="${c.email ? 'url(#e)' : c.clair}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>` +
      piece(poser(CONFETTI, 74.5, a + vers * 4, gauche, 20 + i * 23), 'url(#p)', `stroke="${c.met.bord}" stroke-width=".35"`) +
      piece(poser(CONFETTI, 66.8, a + vers * 13, gauche, 70 + i * 31), c.email ? 'url(#f)' : 'url(#m)', `stroke="${c.met.bord}" stroke-width=".35"`)
    )
  },
}

// Les Notes : une croche par victoire, sa hampe et son crochet — la musique.
const TETE: Commande[] = [['M', -3.3, 3.2], ['C', -3.3, 4.47, -1.82, 5.5, 0, 5.5], ['C', 1.82, 5.5, 3.3, 4.47, 3.3, 3.2], ['C', 3.3, 1.93, 1.82, 0.9, 0, 0.9], ['C', -1.82, 0.9, -3.3, 1.93, -3.3, 3.2], ['Z']]
const HAMPE: Commande[] = [['M', 2.5, 3.6], ['L', 3.5, 3.6], ['L', 3.5, 17.5], ['L', 2.5, 17.5], ['Z']]
const CROCHET: Commande[] = [['M', 3.5, 17.5], ['C', 4.2, 14.2, 8.4, 13.6, 7.6, 9.2], ['C', 9.8, 13, 6.4, 14.6, 3.5, 14.2], ['Z']]
const notes: Motif = {
  cran: (c, a, gauche, i) => {
    const penche = i % 4 < 2 ? 14 : -6
    // Un cran plus grandes que dessinées : à la taille d'une ligne de classement, la croche se perdait.
    return [TETE, HAMPE, CROCHET].map(p => piece(poser(grandir(p, 1.25), FIL[1] + 0.6, a, gauche, penche), c.remplir, c.filet)).join('')
  },
}

// Les Pixels : un cœur de huit bits par victoire et sa pièce — l'arcade.
const PAS_DU_PIXEL = 2.6
const COEUR_EN_PIXELS: readonly (readonly [number, number])[] = [[0, 0], [-1, 1], [0, 1], [1, 1], [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2], [-2, 3], [-1, 3], [1, 3], [2, 3]]
const carre = (u: number, v: number, s: number): Commande[] => [['M', u - s / 2, v], ['L', u + s / 2, v], ['L', u + s / 2, v + s], ['L', u - s / 2, v + s], ['Z']]
const pixels: Motif = {
  cran: (c, a, gauche) => {
    const s = PAS_DU_PIXEL
    const coeur = COEUR_EN_PIXELS.flatMap(([col, ligne]) => carre(col * s, ligne * s, s))
    const reflet = carre(-1.5 * s + s / 2, 2 * s, s * 0.5)
    return (
      piece(poser(coeur, FIL[1] + 1.4, a, gauche), 'url(#p)', `stroke="${c.met.bord}" stroke-width=".4"`) +
      `<path d="${poser(reflet, FIL[1] + 1.4, a, gauche)}" fill="#fff" opacity=".75"/>` +
      piece(poser(carre(0, 0, s * 1.1), FIL[1] + 1, a + versMidi(gauche) * 14.5, gauche), c.clair, `stroke="${c.met.bord}" stroke-width=".4"`)
    )
  },
}

// La Grecque : la frise d'un temple, qui court sur le fil de victoire en victoire — deux clés chacune.
const R_GRECQUE = FIL[1] + 0.8
function grecque(): Commande[] {
  const cles: Commande[] = []
  for (const u0 of [-14, 1.5]) cles.push(['M', u0, 0], ['L', u0, 8.4], ['L', u0 + 9, 8.4], ['L', u0 + 9, 2.4], ['L', u0 + 4.4, 2.4], ['L', u0 + 4.4, 5.6])
  return [['M', -15.7, 0], ['L', -7.5, 0], ['L', 0, 0], ['L', 7.5, 0], ['L', 15.7, 0], ['M', -15.7, 10.6], ['L', -7.5, 10.6], ['L', 0, 10.6], ['L', 7.5, 10.6], ['L', 15.7, 10.6], ...cles]
}
const GRECQUE = grecque()
const laGrecque: Motif = {
  cran: (c, a, gauche) => {
    const d = polaire(GRECQUE, R_GRECQUE, a, gauche)
    return (
      `<path d="${d}" fill="none" stroke="${c.email ? 'url(#m)' : c.met.bord}" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter"/>` +
      `<path d="${d}" fill="none" stroke="${c.email ? 'url(#e)' : c.clair}" stroke-width="1.3" stroke-linecap="square" stroke-linejoin="miter"/>`
    )
  },
}

// Les Épines : une ronce qui se recourbe vers midi par victoire, ses épines, sa goutte à la pierre de la ligue.
const TIGE: Commande[] = [['M', 0, 0], ['C', -1, 6, -6, 10.4, -9.4, 16.4]]
const EPINES: Commande[] = [
  ['M', -1.2, 4], ['L', 2.4, 4.4], ['L', -0.6, 5.9], ['Z'],
  ['M', -4.2, 9.2], ['L', -6.2, 6.6], ['L', -3, 8.2], ['Z'],
  ['M', -6.8, 12.6], ['L', -4, 14.8], ['L', -7.6, 13.9], ['Z'],
]
const epines: Motif = {
  cran: (c, a, gauche) => {
    const tige = poser(TIGE, PIED, a, gauche, 12)
    const bout = poser([['M', -9.4, 16.4]], PIED, a, gauche, 12).slice(1).split(' ').map(Number)
    return (
      `<path d="${tige}" fill="none" stroke="${c.email ? 'url(#m)' : c.met.bord}" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="${tige}" fill="none" stroke="${c.email ? 'url(#e)' : c.remplir}" stroke-width="1.5" stroke-linecap="round"/>` +
      piece(poser(EPINES, PIED, a, gauche, 12), c.email ? 'url(#e)' : c.remplir, c.filet) +
      pierre(c.ligue, bout[0], bout[1], 1.9, c.met)
    )
  },
}

// Les Nuages : un nuage bombé par victoire, posé sur le fil — la douceur.
const NUAGE: Commande[] = [['M', -8.5, 0], ['C', -11.2, 0, -11, 4.6, -7.8, 4.6], ['C', -7.6, 9, -2.6, 10, -0.8, 7.2], ['C', 1.2, 11, 7.4, 10.4, 7.6, 5.8], ['C', 10.8, 5.8, 11.2, 0.4, 8, 0], ['Z']]
const REFLET_DU_NUAGE: Commande[] = [['M', -6.4, 4.4], ['C', -6, 6.8, -3.4, 7.6, -2, 6.2]]
const nuages: Motif = {
  cran: (c, a, gauche) =>
    piece(poser(NUAGE, FIL[1] - 0.4, a, gauche), c.email ? 'url(#e)' : c.clair, c.filet) +
    `<path d="${poser(REFLET_DU_NUAGE, FIL[1] - 0.4, a, gauche)}" fill="none" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity="${c.email ? 0.35 : 0.7}"/>`,
}

// Les Flocons (le coffre) : un cristal de neige à six branches par victoire, et son petit.
function flocon(x: number, y: number, R: number, tourne: number): string {
  let d = ''
  for (let k = 0; k < 6; k++) {
    const t = ((tourne + k * 60) * Math.PI) / 180
    const [bx, by] = [x + R * Math.sin(t), y - R * Math.cos(t)]
    d += `M${f(x)} ${f(y)}L${f(bx)} ${f(by)}`
    const [mx, my] = [x + 0.58 * R * Math.sin(t), y - 0.58 * R * Math.cos(t)]
    for (const s of [-1, 1]) {
      const u = t + s * 0.62
      d += `M${f(mx)} ${f(my)}L${f(mx + 0.36 * R * Math.sin(u))} ${f(my - 0.36 * R * Math.cos(u))}`
    }
  }
  return d
}
const flocons: Motif = {
  cran: (c, a, gauche) => {
    const [x, y] = xy(69.4, a)
    const [px, py] = xy(64.8, a + versMidi(gauche) * 14)
    const branches = flocon(x, y, 6.8, a) + flocon(px, py, 3.2, a + 30)
    return (
      `<path d="${branches}" fill="none" stroke="${c.met.bord}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="${branches}" fill="none" stroke="${c.email ? 'url(#m)' : 'url(#f)'}" stroke-width="1.05" stroke-linecap="round"/>` +
      pierre(c.ligue, x, y, 1.5, c.met)
    )
  },
}

// Les Papillons (le coffre) : un papillon par victoire, ses ailes à la pierre de la ligue.
const AILE_HAUTE: Commande[] = [['M', 0.4, 1], ['C', 3, 6.4, 9, 8, 8.8, 3.2], ['C', 8.6, 0.2, 3, -0.6, 0.4, 0.4], ['Z']]
const AILE_BASSE: Commande[] = [['M', 0.4, -0.2], ['C', 3, -1, 6.8, -2.6, 5.8, -5.6], ['C', 4.6, -7.6, 1, -4.2, 0.4, -1], ['Z']]
const CORPS: Commande[] = [['M', 0, -4.6], ['C', 1, -4.6, 1, 5.4, 0, 5.4], ['C', -1, 5.4, -1, -4.6, 0, -4.6], ['Z']]
const ANTENNES: Commande[] = [['M', -0.3, 5], ['C', -1, 7, -2.4, 8, -3.2, 8.6], ['M', 0.3, 5], ['C', 1, 7, 2.4, 8, 3.2, 8.6]]
const papillons: Motif = {
  cran: (c, a, gauche, i) => {
    const penche = i % 2 ? 16 : -10
    const r = 67.6
    const ailes = [AILE_HAUTE, AILE_BASSE, retourner(AILE_HAUTE), retourner(AILE_BASSE)]
    return (
      ailes.map(p => piece(poser(p, r, a, gauche, penche), 'url(#p)', `stroke="${c.email ? 'url(#m)' : c.met.bord}" stroke-width=".55" stroke-linejoin="round"`)).join('') +
      [decaler(carre(5.4, 3, 1.6), 0, -0.8), decaler(carre(-5.4, 3, 1.6), 0, -0.8)].map(p => `<path d="${poser(p, r, a, gauche, penche)}" fill="${c.clair}" opacity=".9"/>`).join('') +
      piece(poser(CORPS, r, a, gauche, penche), c.email ? 'url(#e)' : 'url(#m)', `stroke="${c.met.bord}" stroke-width=".4"`) +
      `<path d="${poser(ANTENNES, r, a, gauche, penche)}" fill="none" stroke="${c.email ? 'url(#m)' : c.met.bord}" stroke-width=".55" stroke-linecap="round"/>`
    )
  },
}

// Les Lanternes (le coffre) : une lanterne de papier par victoire, au bout de son fil, qui luit.
const LANTERNE = 1.35
const CORPS_DE_LANTERNE_DESSINE: Commande[] = [['M', -4.2, 6.2], ['C', -4.2, 1.6, 4.2, 1.6, 4.2, 6.2], ['C', 4.2, 10.8, -4.2, 10.8, -4.2, 6.2], ['Z']]
const COTES_DE_LANTERNE_DESSINEES: Commande[] = [['M', -1.6, 2.8], ['C', -2.8, 4.8, -2.8, 7.6, -1.6, 9.6], ['M', 1.6, 2.8], ['C', 2.8, 4.8, 2.8, 7.6, 1.6, 9.6], ['M', 0, 2.6], ['L', 0, 9.8]]
const CHAPEAUX_DESSINES: Commande[] = [['M', -2.2, 1.3], ['L', 2.2, 1.3], ['L', 2.2, 2.6], ['L', -2.2, 2.6], ['Z'], ['M', -1.8, 9.8], ['L', 1.8, 9.8], ['L', 1.8, 11], ['L', -1.8, 11], ['Z']]
// Grandies d'un tiers : dessinées à la taille d'une perle, elles n'étaient qu'un point qui luit.
const CORPS_DE_LANTERNE = grandir(CORPS_DE_LANTERNE_DESSINE, LANTERNE)
const COTES_DE_LANTERNE = grandir(COTES_DE_LANTERNE_DESSINEES, LANTERNE)
const CHAPEAUX = grandir(CHAPEAUX_DESSINES, LANTERNE)
const lanternes: Motif = {
  cran: (c, a, gauche, i) => {
    const r = FIL[1] + 0.2
    const penche = i % 2 ? 8 : -6
    const [x, y] = xy(r + 6.2 * LANTERNE, a)
    return (
      `<circle cx="${f(x)}" cy="${f(y)}" r="${f(6.4 * LANTERNE)}" fill="#ffb347" opacity=".45" filter="url(#b)"/>` +
      `<path d="${poser([['M', 0, 0], ['L', 0, 1.3]], r, a, gauche, penche)}" stroke="${c.met.bord}" stroke-width=".6"/>` +
      piece(poser(CORPS_DE_LANTERNE, r, a, gauche, penche), 'url(#l)', `stroke="${c.met.bord}" stroke-width=".45"`) +
      `<path d="${poser(COTES_DE_LANTERNE, r, a, gauche, penche)}" fill="none" stroke="#8a2a06" stroke-width=".45" opacity=".6"/>` +
      piece(poser(CHAPEAUX, r, a, gauche, penche), c.email ? 'url(#e)' : 'url(#m)', `stroke="${c.met.bord}" stroke-width=".35"`)
    )
  },
}

// Les Joyaux (le coffre) : une grande pierre taillée par victoire, dans ses griffes — à la pierre de la ligue.
const JOYAU: Commande[] = [['M', 0, 0], ['L', -5.2, 6], ['L', -3.6, 8.8], ['L', 3.6, 8.8], ['L', 5.2, 6], ['Z']]
const FACETTES: Commande[] = [['M', -5.2, 6], ['L', 5.2, 6], ['M', 0, 0], ['L', -1.8, 6], ['L', -3.6, 8.8], ['M', 0, 0], ['L', 1.8, 6], ['L', 3.6, 8.8], ['M', -1.8, 6], ['L', 0, 8.8], ['L', 1.8, 6]]
const ECLAT_DU_JOYAU: Commande[] = [['M', -3.4, 6.4], ['L', -1.8, 6.4], ['L', -2.6, 8.2], ['Z']]
const joyaux: Motif = {
  cran: (c, a, gauche) => {
    const r = FIL[1] + 0.8
    const [g1x, g1y] = xy(r + 6.2, a - 4.4)
    const [g2x, g2y] = xy(r + 6.2, a + 4.4)
    const [px, py] = xy(64.2, a + versMidi(gauche) * 15)
    return (
      piece(poser(JOYAU, r, a), 'url(#p)', `stroke="${c.met.bord}" stroke-width=".55" stroke-linejoin="round"`) +
      `<path d="${poser(FACETTES, r, a)}" fill="none" stroke="#fff" stroke-width=".4" opacity=".55"/>` +
      `<path d="${poser(ECLAT_DU_JOYAU, r, a)}" fill="#fff" opacity=".85"/>` +
      `<circle cx="${f(g1x)}" cy="${f(g1y)}" r="1" fill="url(#m)" stroke="${c.met.bord}" stroke-width=".3"/><circle cx="${f(g2x)}" cy="${f(g2y)}" r="1" fill="url(#m)" stroke="${c.met.bord}" stroke-width=".3"/>` +
      pierre(c.ligue, px, py, 1.3, c.met)
    )
  },
}

// Les Comètes (le coffre) : une étoile filante par victoire, sa traîne derrière elle — elle file vers midi.
const TETE_DE_COMETE: Commande[] = ETOILE.map(c => (c[0] === 'Z' ? c : ([c[0], (c[1] as number) * 0.62, (c[2] as number) * 0.62] as Commande)))
const TRAINES: readonly [Commande[], number][] = [
  [[['M', 1.4, -1.6], ['L', 15, -3.2], ['L', 1.4, 1.6], ['Z']], 0.8],
  [[['M', 2, 1.4], ['L', 11.6, 3.6], ['L', 2, 2.6], ['Z']], 0.45],
  [[['M', 2, -2.6], ['L', 10.4, -5.4], ['L', 2, -1.6], ['Z']], 0.35],
]
const cometes: Motif = {
  cran: (c, a, gauche) => {
    const r = 70
    const [x, y] = xy(r, a)
    return (
      TRAINES.map(([p, o]) => `<path d="${poser(p, r, a, gauche)}" fill="${c.email ? 'url(#m)' : 'url(#f)'}" opacity="${o}"/>`).join('') +
      `<path d="${poser(TETE_DE_COMETE, r, a)}" fill="url(#f)" stroke="${c.met.bord}" stroke-width=".45" stroke-linejoin="round"/>` +
      pierre(c.ligue, x, y, 1.2, c.met)
    )
  },
}

// La Couronne (le coffre, légendaire) : un fleuron et sa perle par victoire, une pointe entre deux — sertie, une couronne.
const FLEURON: Commande[] = [['M', -3.4, 0], ['L', -0.9, 9], ['C', -2.6, 10.4, -1.4, 12.6, 0, 13.4], ['C', 1.4, 12.6, 2.6, 10.4, 0.9, 9], ['L', 3.4, 0], ['Z']]
const POINTE: Commande[] = [['M', -2.1, 0], ['L', 0, 6.8], ['L', 2.1, 0], ['Z']]
const couronne: Motif = {
  cran: (c, a, gauche) => {
    const b = a + versMidi(gauche) * 15
    const [tx, ty] = xy(PIED + 14.6, a)
    const [px, py] = xy(PIED + 7.6, b)
    const [sx, sy] = xy(FIL[1] + 2.2, a)
    return (
      piece(poser(POINTE, PIED, b), c.remplir, c.filet) +
      perle(px, py, 1.3, c.met) +
      piece(poser(FLEURON, PIED, a), c.remplir, c.filet) +
      perle(tx, ty, 2.1, c.met) +
      pierre(c.ligue, sx, sy, 1.9, c.met)
    )
  },
}

/** Les motifs dessinés ici — « Les Feuilles » restent à la parure d'au-dessus. */
const MOTIFS: Readonly<Record<string, Motif>> = {
  jonc,
  nu,
  perles,
  rouages,
  flammes,
  etoiles,
  ecailles,
  vagues,
  rayons,
  fleurs,
  plumes,
  serpentins,
  notes,
  pixels,
  grecque: laGrecque,
  epines,
  nuages,
  coeurs,
  houx,
  flocons,
  papillons,
  lanternes,
  joyaux,
  cometes,
  couronne,
}

/** Les motifs que ce module sait dessiner, pour les épreuves : chacun du catalogue (`shared/motifs.ts`) doit y être. */
export const MOTIFS_DESSINES: readonly string[] = ['feuilles', ...Object.keys(MOTIFS), ...LIGUES_DES_FEUILLES.map(l => `feuilles-${l}`)]

/** Le motif d'un nom : ce module le dessine, ou les feuilles de sa ligue — un nom qu'il ne connaît pas (une page d'avant). */
function motifDe(ligue: CleDeLigue, cle: string): Motif | null {
  if (cle === 'feuilles' || cle === `feuilles-${ligue}`) return null
  if (cle.startsWith('feuilles-')) {
    const de = cle.slice('feuilles-'.length) as CleDeLigue
    return LIGUES_DES_FEUILLES.includes(de) ? feuillesDe(de) : null
  }
  return MOTIFS[cle] ?? null
}

/** Les couleurs que seuls des motifs prennent : l'émail rose des cœurs, le vert du houx et ses baies, la lueur des lanternes, et l'ombre portée. */
const DEFINITIONS_DES_MOTIFS =
  `<radialGradient id="c" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#ffc2d4"/><stop offset=".45" stop-color="#e8336b"/><stop offset="1" stop-color="#6e0b2c"/></radialGradient>` +
  `<linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fbf72"/><stop offset=".5" stop-color="#23753a"/><stop offset="1" stop-color="#0b3a1c"/></linearGradient>` +
  `<radialGradient id="r" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#ffb3a8"/><stop offset=".45" stop-color="#d81e2a"/><stop offset="1" stop-color="#5a0610"/></radialGradient>` +
  `<radialGradient id="l" cx=".4" cy=".4" r=".7"><stop offset="0" stop-color="#fff2b8"/><stop offset=".5" stop-color="#ff9a3a"/><stop offset="1" stop-color="#b1360c"/></radialGradient>` +
  `<filter id="d" x="-15%" y="-15%" width="130%" height="135%"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dy="2.2"/><feComponentTransfer><feFuncA type="linear" slope=".42"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`

/** Ce qui est de métal, de pierre ou d'émail dans une bordure à motif : son fil (ou son jonc), ses crans, son insigne. */
function parureDuMotif(ligue: CleDeLigue, crans: number, met: Metal, motif: Motif): string {
  const email = ligue === 'maitre'
  const remplir = email ? 'url(#e)' : ligue === 'platine' ? 'url(#p)' : ligue === 'diamant' ? 'url(#f)' : 'url(#m)'
  const c: Contexte = {
    ligue,
    met,
    email,
    remplir,
    clair: remplir === 'url(#m)' ? 'url(#f)' : remplir,
    filet: `stroke="${email ? 'url(#m)' : met.bord}" stroke-width="${email ? 1 : 0.5}" stroke-linejoin="round"`,
  }
  const [r1, r2] = motif.jonc ? JONC : FIL
  let s = `<path d="${anneau(r1, r2)}" fill-rule="evenodd" fill="url(#m)" stroke="${met.bord}" stroke-width=".55"/>`
  s += `<circle cx="100" cy="100" r="${r1 + 0.9}" fill="none" stroke="#fff" stroke-width=".45" opacity=".45"/>`
  if (motif.jonc) s += `<circle cx="100" cy="100" r="${r2 - 0.9}" fill="none" stroke="${met.bord}" stroke-width=".4" opacity=".5"/>`
  for (let i = crans; i < CRANS_D_UNE_BORDURE; i++) s += (motif.attente ?? bourgeon)(c, ANGLES[i])
  if (motif.dessous) s += motif.dessous(c, crans)
  for (let i = crans - 1; i >= 0; i--) s += motif.cran(c, ANGLES[i], ANGLES[i] > 180, i)
  return s + insigne(ligue, met, crans >= CRANS_D_UNE_BORDURE)
}

/** Les définitions d'une bordure à motif : celles de la parure, et les couleurs à elles. */
const definitionsDuMotif = (ligue: CleDeLigue, met: Metal) => definitions(ligue, met).replace('</defs>', `${DEFINITIONS_DES_MOTIFS}</defs>`)

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
 * Son motif, « Les Feuilles » d'office ; un nom qu'il ne connaît pas les
 * garde aussi — une page d'avant, un motif qui viendrait d'un serveur plus neuf.
 */
export function svgDuCadre(ligue: CleDeLigue, crans: number, motif = 'feuilles'): string {
  const n = borner(crans)
  const met = metalDe(ligue)
  const lueur = n >= CRANS_D_UNE_BORDURE ? `<circle cx="100" cy="100" r="68" fill="none" stroke="${met.lueur}" stroke-width="7" opacity=".5" filter="url(#b)"/>` : ''
  const autre = motifDe(ligue, motif)
  if (autre) return OUVRIR + definitionsDuMotif(ligue, met) + lueur + `<g filter="url(#d)">${parureDuMotif(ligue, n, met, autre)}</g></svg>`
  const corps = aLEchelle(FEUILLES[ligue].corps, FEUILLES[ligue].w, FEUILLES[ligue].L)
  // L'ombre du fil et des feuilles seuls : un disque assombrirait l'avatar.
  let ombres = ''
  for (let i = 0; i < n; i++) ombres += poser(corps, PIED, ANGLES[i], ANGLES[i] > 180, PENCHE)
  return (
    OUVRIR +
    definitions(ligue, met) +
    `<g transform="translate(0 2.4)" opacity=".42" filter="url(#o)">${ombres ? `<path d="${ombres}" fill="#000"/>` : ''}<circle cx="100" cy="100" r="${(FIL[0] + FIL[1]) / 2}" fill="none" stroke="#000" stroke-width="5"/></g>` +
    lueur +
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
 * ajourée, un anneau de lumière serait passé aussi entre les feuilles — ou
 * entre les étoiles, les perles, les écailles d'un autre motif.
 */
export function svgDeLaSilhouette(ligue: CleDeLigue, crans: number, motif = 'feuilles'): string | null {
  if (!A_SON_ECLAT.has(ligue)) return null
  const met = metalDe(ligue)
  const autre = motifDe(ligue, motif)
  if (autre) return OUVRIR + definitionsDuMotif(ligue, met) + parureDuMotif(ligue, borner(crans), met, autre) + `</svg>`
  return OUVRIR + definitions(ligue, met) + parure(ligue, borner(crans), met) + `</svg>`
}

const image = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`

/** Ce qu'une bordure montre : son cadre, et la silhouette que suit son éclat si elle en a un. */
export interface DessinDeBordure {
  cadre: string
  silhouette: string | null
}

const FAITS = new Map<string, DessinDeBordure>()

/** Une bordure en images, faites une fois par ligue, par nombre de crans et par motif, pour toute la page. */
export function dessinDeBordure(ligue: CleDeLigue, crans: number, motif = 'feuilles'): DessinDeBordure {
  // Un motif qui se dessine en feuilles — le sien, celui de sa ligue, un nom inconnu — partage leur image.
  const cle = `${ligue}:${crans}:${motifDe(ligue, motif) ? motif : 'feuilles'}`
  let fait = FAITS.get(cle)
  if (!fait) {
    const silhouette = svgDeLaSilhouette(ligue, crans, motif)
    fait = { cadre: image(svgDuCadre(ligue, crans, motif)), silhouette: silhouette ? image(silhouette) : null }
    FAITS.set(cle, fait)
  }
  return fait
}
