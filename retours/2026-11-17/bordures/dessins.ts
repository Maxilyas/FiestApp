// Les dessins de la planche des bordures de ligue : trois pistes, chacune un
// SVG écrit sans DOM, dans le repère des bordures d'aujourd'hui
// (`client/src/components/dessinDesBordures.ts`) — 200 × 200, centré en
// (100, 100), le disque de l'avatar dans un rayon de 59.
//
// Une maquette, pas du code livré : rien de `client/` ne bouge. Ce qui est
// retenu se réécrira dans `dessinDesBordures.ts`.
//
// Ce que les trois pistes ont en commun, et que les bordures d'aujourd'hui
// n'ont pas :
//   - le cadre est toujours entier : un cran à gagner n'est plus un pointillé
//     — quatorze des dix-neuf bordures portées en production, le 17 novembre
//     2026, n'étaient pas serties : une roue fantôme et un coin de métal ;
//   - les crans se sertissent du bas vers le haut, des deux côtés à la fois :
//     à chaque victoire la bordure reste symétrique ;
//   - le bas porte l'insigne de la ligue : le haut est à ce qui sort du
//     médaillon — des ailes, une tête — et à l'étoile d'un légendaire scellé.

export type Ligue = 'bronze' | 'argent' | 'or' | 'platine' | 'diamant' | 'maitre'

/** Un métal, comme `client/src/components/metaux.ts` : son dégradé, son filet, sa lueur. */
export interface Metal {
  m: readonly string[]
  bord: string
  lueur: string
  etoiles?: boolean
}

export const CRANS = 12

/** L'ordre où les crans se sertissent : du bas vers le haut, à droite puis à gauche. */
export const ANGLES = [165, 195, 135, 225, 105, 255, 75, 285, 45, 315, 15, 345] as const

// ── La géométrie ──────────────────────────────────────────────────────────

const f = (n: number) => String(Math.round(n * 100) / 100)

/** Un point à `r` du centre, à `deg` degrés de midi, dans le sens des aiguilles d'une montre. */
function xy(r: number, deg: number): [number, number] {
  const t = (deg * Math.PI) / 180
  return [100 + r * Math.sin(t), 100 - r * Math.cos(t)]
}
const pt = (r: number, deg: number) => {
  const [x, y] = xy(r, deg)
  return `${f(x)} ${f(y)}`
}

function rond(x: number, y: number, r: number): string {
  const q = f(r)
  return `M${f(x - r)} ${f(y)}a${q} ${q} 0 1 0 ${f(2 * r)} 0a${q} ${q} 0 1 0 ${f(-2 * r)} 0Z`
}

/** Un anneau entier, de `r1` à `r2` — à remplir en `evenodd`. */
const anneau = (r1: number, r2: number) => rond(100, 100, r2) + rond(100, 100, r1)

/** Une étoile à `n` branches, ses pointes à `R`, ses creux à `r`. */
function etoile(x: number, y: number, R: number, r: number, n: number, rot = 0): string {
  let d = ''
  for (let i = 0; i < 2 * n; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180
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
 * droite, `penche` la couche vers midi avant de la poser (en degrés).
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

const tirage = (k: number, j: number, a: number, b: number, n: number) => (k * a + j * b) % n

// ── Les définitions partagées ─────────────────────────────────────────────

const degrade = (id: string, m: readonly string[]) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="24" y1="16" x2="176" y2="184">${m
    .map((c, i) => `<stop offset="${[0, 0.27, 0.5, 0.73, 1][i]}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`

function melange(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16))
  const x = p(a)
  const y = p(b)
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

/** Les pierres des ligues : du reflet au cœur, puis à l'ombre. */
const PIERRES: Record<Ligue, readonly [string, string, string]> = {
  bronze: ['#ffe0b8', '#c9803f', '#5e3414'],
  argent: ['#ffffff', '#e6ebf2', '#8d97a6'],
  or: ['#ff9aa8', '#c8152f', '#560616'],
  platine: ['#ffffff', '#bfe9ff', '#4f9bcb'],
  diamant: ['#ffffff', '#e2f4ff', '#86c1ea'],
  maitre: ['#6a5a80', '#1a1422', '#050308'],
}

function defs(ligue: Ligue, met: Metal): string {
  const feu = met.m.map(c => melange(c, '#ffffff', 0.42))
  const sombre = met.m.map(c => melange(c, '#000000', 0.5))
  const email = met.etoiles ? ['#26326f', '#151b48', '#090c24'] : ['#33293f', '#17121e', '#07060a']
  const [p0, p1, p2] = PIERRES[ligue]
  return (
    `<defs>${degrade('m', met.m)}${degrade('f', feu)}${degrade('s', sombre)}` +
    `<linearGradient id="e" gradientUnits="userSpaceOnUse" x1="30" y1="20" x2="170" y2="180"><stop offset="0" stop-color="${email[0]}"/><stop offset=".5" stop-color="${email[1]}"/><stop offset="1" stop-color="${email[2]}"/></linearGradient>` +
    `<radialGradient id="p" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="${p0}"/><stop offset=".45" stop-color="${p1}"/><stop offset="1" stop-color="${p2}"/></radialGradient>` +
    `<filter id="b" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="5"/></filter>` +
    `<filter id="o" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>`
  )
}

const OUVRIR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">`

// ── Les pierres ───────────────────────────────────────────────────────────

/** La pierre d'une ligue, sertie : un dôme éclairé d'en haut à gauche, à sa façon. */
function pierre(ligue: Ligue, x: number, y: number, R: number, met: Metal): string {
  const reflet = `<ellipse cx="${f(x - 0.32 * R)}" cy="${f(y - 0.36 * R)}" rx="${f(0.3 * R)}" ry="${f(0.2 * R)}" fill="#fff" opacity=".85" transform="rotate(-35 ${f(x - 0.32 * R)} ${f(y - 0.36 * R)})"/>`
  if (ligue === 'diamant') {
    const octo = (q: number) => {
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
      `<path d="${octo(R)}" fill="url(#p)" stroke="${met.bord}" stroke-width=".35"/>` +
      `<path d="${octo(R * 0.5)}" fill="#fff" opacity=".7"/>` +
      `<path d="${aretes}" fill="none" stroke="#4d86b3" stroke-width=".3" opacity=".7"/>` +
      `<path d="${etoile(x - 0.3 * R, y - 0.34 * R, 0.62 * R, 0.13 * R, 4)}" fill="#fff"/>`
    )
  }
  const dome = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#p)" stroke="${met.bord}" stroke-width=".35"/>`
  if (ligue === 'platine') return dome + `<path d="${etoile(x, y, 0.82 * R, 0.2 * R, 4)}" fill="#fff" opacity=".95"/>`
  if (ligue === 'maitre') return dome + `<path d="${etoile(x, y, 0.8 * R, 0.3 * R, 8)}" fill="url(#f)"/>` + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.2 * R)}" fill="#fff6d8"/>`
  return dome + reflet
}

/** Un chaton : sa sertissure de métal, et sa pierre — ou son creux, tant que le cran reste à gagner. */
function chaton(ligue: Ligue, x: number, y: number, R: number, serti: boolean, met: Metal): string {
  const griffe = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#m)" stroke="${met.bord}" stroke-width=".45"/>`
  if (serti) return griffe + pierre(ligue, x, y, R * 0.76, met)
  // Le creux : sombre, son bord du haut dans l'ombre — une place qui attend, pas un trou.
  return (
    griffe +
    `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * 0.7)}" fill="url(#s)"/>` +
    `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * 0.7)}" fill="#07060a" opacity=".5"/>` +
    `<circle cx="${f(x)}" cy="${f(y + 0.14 * R)}" r="${f(R * 0.56)}" fill="none" stroke="#fff" stroke-width=".3" opacity=".25"/>`
  )
}

// ── L'insigne ─────────────────────────────────────────────────────────────

const ECU: Commande[] = [['M', -7.6, 0], ['L', 7.6, 0], ['L', 7.6, 10], ['C', 7.6, 16, 3.6, 20, 0, 23.6], ['C', -3.6, 20, -7.6, 16, -7.6, 10], ['Z']]
const ECU_DEDANS: Commande[] = [['M', -5.6, 1.8], ['L', 5.6, 1.8], ['L', 5.6, 10], ['C', 5.6, 14.6, 2.7, 17.8, 0, 20.6], ['C', -2.7, 17.8, -5.6, 14.6, -5.6, 10], ['Z']]
const AILE: Commande[] = [['M', 7.4, 9.6], ['C', 12, 10, 16.2, 13.2, 17.8, 18.4], ['C', 12.6, 18.8, 9, 15.8, 7.4, 13.2], ['Z']]
/** La bélière : ce qui tient un pendant au jonc. */
const BELIERE: Commande[] = [['M', -4, 0], ['L', 4, 0], ['L', 2.6, 6.4], ['L', -2.6, 6.4], ['Z']]
// Les formes des bordures d'aujourd'hui, reprises telles quelles (`dessinDesBordures.ts`, `FORMES`).
const PETALE: Commande[] = [['M', 1, 4.6], ['C', 2.2, 10.8, 7, 12.6, 8.1, 8.4], ['C', 8.6, 6.4, 7.6, 4.9, 6.1, 5.3], ['C', 6.9, 6.3, 6.8, 8, 5.6, 8.3], ['C', 4.1, 8.6, 2.9, 6.6, 2.7, 3.9], ['Z']]
const LYS: Commande[][] = [
  [['M', 0, 17], ['C', 2.4, 13.2, 3.1, 8.6, 1.5, 4.4], ['L', -1.5, 4.4], ['C', -3.1, 8.6, -2.4, 13.2, 0, 17], ['Z']],
  [['M', -4.6, 4.6], ['L', 4.6, 4.6], ['L', 4.1, 2.4], ['L', -4.1, 2.4], ['Z']],
  [['M', -1.6, 2.4], ['L', 1.6, 2.4], ['L', 2.6, -0.4], ['L', 0, 0.8], ['L', -2.6, -0.4], ['Z']],
]
const RAYON: Commande[] = [['M', -2.3, 0], ['C', -1.9, 6.5, 1.4, 10.5, 0, 19], ['C', 2.8, 12.5, 2.6, 6, 2.3, 0], ['Z']]
const RAYON_COURT: Commande[] = [['M', -1.5, 0], ['L', 0, 11], ['L', 1.5, 0], ['Z']]

const grandir = (cmds: readonly Commande[], k: number): Commande[] => cmds.map(c => (c[0] === 'Z' ? c : ([c[0], ...c.slice(1).map(x => (x as number) * k)] as Commande)))

/**
 * L'insigne de la ligue, au bas de la bordure : il dit la ligue dès le premier
 * duel, par le motif qui donne son nom à la bordure — l'écu riveté du
 * Moletage, la perle en pendant du Perlé, la fleur de lys des Fleurons, le
 * cristal du Givre, le brillant de la Couronne, le Soleil noir. Sertie, il
 * prend ses deux pierres de côté — ses ailes, pour le bronze.
 */
function insigne(ligue: Ligue, met: Metal, sertie: boolean, r0 = 58.4): string {
  const metal = `fill="url(#m)" stroke="${met.bord}" stroke-width=".5" stroke-linejoin="round"`
  const en = (cmds: readonly Commande[], r = r0, deg = 180, miroir = false) => `<path d="${poser(cmds, r, deg, miroir)}" ${metal}/>`
  /** Une pierre posée dans le repère de l'insigne : `u` de côté, `v` vers le bas. */
  const posee = (u: number, v: number, R: number) => {
    const x = 100 - u
    const y = 100 + r0 + v
    return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R * 1.24)}" ${metal}/>` + pierre(ligue, x, y, R, met)
  }
  const cotes = (v: number, R: number, u = 9.6) => (sertie ? posee(u, v, R) + posee(-u, v, R) : '')
  if (ligue === 'bronze') {
    return (
      (sertie ? `<path d="${poser(AILE, r0, 180)}${poser(AILE, r0, 180, true)}" ${metal}/>` : '') +
      en(ECU) +
      `<path d="${poser(ECU_DEDANS, r0, 180)}" fill="none" stroke="#fff" stroke-width=".4" opacity=".42"/>` +
      pierre(ligue, 100, 100 + r0 + 10.2, 4.9, met)
    )
  }
  if (ligue === 'argent') return en(BELIERE) + cotes(6.6, 2.6, 10.4) + posee(0, 13.2, 6.2)
  if (ligue === 'or') {
    const k = 1.42
    return LYS.map(p => en(grandir(p, k), r0 + 3)).join('') + en(grandir(PETALE, k), r0 + 3) + en(grandir(PETALE, k), r0 + 3, 180, true) + cotes(6.4, 2.4, 14) + pierre(ligue, 100, 100 + r0 + 3 + 3.5 * k, 3, met)
  }
  if (ligue === 'platine') {
    // Un cristal de givre, à six pans, et deux petits de côté.
    const glace = `fill="url(#p)" stroke="${met.bord}" stroke-width=".45" stroke-linejoin="round"`
    const cristal = (w: number, L: number): Commande[] => [['M', 0, 0], ['L', w, 0.2 * L], ['L', w, 0.62 * L], ['L', 0, L], ['L', -w, 0.62 * L], ['L', -w, 0.2 * L], ['Z']]
    const aretes = (w: number, L: number): Commande[] => [['M', 0, 0], ['L', 0, L], ['M', -w, 0.2 * L], ['L', 0, 0.36 * L], ['L', w, 0.2 * L]]
    const g = (w: number, L: number, penche: number, miroir = false) =>
      `<path d="${poser(cristal(w, L), r0 + 5, 180, miroir, penche)}" ${glace}/><path d="${poser(aretes(w, L), r0 + 5, 180, miroir, penche)}" fill="none" stroke="#3f7fae" stroke-width=".4" opacity=".7"/>`
    return en(BELIERE) + g(2.6, 12, 58) + g(2.6, 12, 58, true) + g(4.2, 19, 0) + cotes(4.2, 2.2, 13.6)
  }
  if (ligue === 'diamant') return en(BELIERE) + cotes(6.8, 2.8, 10.8) + posee(0, 13.6, 6.6)
  // Le Soleil noir : trois flammes d'or, et le disque noir devant elles.
  const x = 100
  const y = 100 + r0 + 10.6
  let rais = ''
  for (let i = 0; i < 12; i++) {
    const t = (i * 30 * Math.PI) / 180
    rais += `M${f(x + 8.2 * Math.sin(t - 0.17))} ${f(y - 8.2 * Math.cos(t - 0.17))}L${f(x + 12.2 * Math.sin(t))} ${f(y - 12.2 * Math.cos(t))}L${f(x + 8.2 * Math.sin(t + 0.17))} ${f(y - 8.2 * Math.cos(t + 0.17))}Z`
  }
  return (
    en(RAYON, r0 + 14) +
    (sertie ? en(RAYON_COURT, r0 + 12, 168) + en(RAYON_COURT, r0 + 12, 192) : '') +
    `<path d="${rais}" ${metal}/>` +
    `<circle cx="${x}" cy="${f(y)}" r="8.2" fill="url(#m)" stroke="${met.bord}" stroke-width=".5"/>` +
    `<circle cx="${x}" cy="${f(y)}" r="6.6" fill="url(#p)"/>` +
    `<path d="${etoile(x, y, 4.2, 1.5, 8)}" fill="url(#f)"/>`
  )
}

// ── Piste 2 — Le jonc serti ───────────────────────────────────────────────

/**
 * Un jonc de métal, fin, toujours entier, et douze chatons : chaque victoire
 * y sertit la pierre de la ligue. La ligue se lit à la matière du jonc, à sa
 * pierre et à son insigne ; rien ne dépasse l'avatar de plus d'un cinquième.
 */
export function jonc(ligue: Ligue, crans: number, met: Metal): string {
  const R1 = 59.8
  const R2 = 68.6
  const RM = (R1 + R2) / 2
  const sertie = crans >= CRANS
  let s = OUVRIR + defs(ligue, met)
  s += `<circle cx="100" cy="102.6" r="${RM}" fill="none" stroke="#000" stroke-width="${f(R2 - R1 + 3)}" opacity=".36" filter="url(#o)"/>`
  if (sertie) s += `<circle cx="100" cy="100" r="${RM + 3}" fill="none" stroke="${met.lueur}" stroke-width="10" opacity=".55" filter="url(#b)"/>`
  s += `<path d="${anneau(R1, R2)}" fill-rule="evenodd" fill="${ligue === 'maitre' ? 'url(#e)' : 'url(#m)'}" stroke="${met.bord}" stroke-width=".6"/>`
  // La matière de chaque ligue.
  if (ligue === 'bronze') {
    // Le moletage : des stries en biais, tout le tour.
    let stries = ''
    let clairs = ''
    for (let j = 0; j < 72; j++) {
      const a = j * 5
      stries += `M${pt(R1 + 1.5, a)}L${pt(R2 - 1.5, a + 2.6)}`
      clairs += `M${pt(R1 + 1.5, a + 1.1)}L${pt(R2 - 1.5, a + 3.7)}`
    }
    s += `<path d="${stries}" fill="none" stroke="#000" stroke-width=".75" opacity=".34"/><path d="${clairs}" fill="none" stroke="#fff" stroke-width=".45" opacity=".22"/>`
  } else if (ligue === 'argent') {
    // Le perlé : un grènetis sur le bord, comme une bague ancienne.
    let grains = ''
    for (let j = 0; j < 80; j++) {
      const [x, y] = xy(R2 + 0.5, j * 4.5)
      grains += rond(x, y, 1.15)
    }
    s += `<path d="${grains}" fill="url(#f)" stroke="${met.bord}" stroke-width=".28"/>`
    s += `<circle cx="100" cy="100" r="${RM}" fill="none" stroke="#000" stroke-width=".5" opacity=".2"/>`
  } else if (ligue === 'or') {
    // Un filet gravé, et son reflet.
    s += `<circle cx="100" cy="100" r="${RM - 2.4}" fill="none" stroke="#000" stroke-width=".55" opacity=".34"/><circle cx="100" cy="100" r="${RM - 1.8}" fill="none" stroke="#fff" stroke-width=".4" opacity=".35"/>`
    s += `<circle cx="100" cy="100" r="${RM + 2.4}" fill="none" stroke="#000" stroke-width=".55" opacity=".34"/><circle cx="100" cy="100" r="${RM + 3}" fill="none" stroke="#fff" stroke-width=".4" opacity=".35"/>`
  } else if (ligue === 'platine') {
    // Le givre : un voile blanc, et des cristaux semés.
    s += `<path d="${anneau(R1 + 0.6, R2 - 0.6)}" fill-rule="evenodd" fill="#fff" opacity=".26"/>`
    let semis = ''
    for (let k = 0; k < 12; k++)
      for (let j = 0; j < 3; j++) {
        const [x, y] = xy(R1 + 1.8 + tirage(k, j, 7, 5, 6), k * 30 + 2 + tirage(k, j, 11, 7, 26))
        semis += etoile(x, y, 1.35, 0.4, 4, (k + j) * 20)
      }
    s += `<path d="${semis}" fill="#fff" opacity=".9"/>`
  } else if (ligue === 'diamant') {
    // Taillé en facettes.
    let graves = ''
    let clairs = ''
    for (let j = 0; j < 36; j++) {
      const b0 = j * 10
      const b1 = b0 + 10
      const m = b0 + 5
      graves += `M${pt(R1, b0)}L${pt(R1, b1)}L${pt(RM, m)}Z`
      clairs += `M${pt(R1, b0)}L${pt(R2, b0)}L${pt(RM, m)}Z`
      graves += `M${pt(R2, b0)}L${pt(R2, b1)}L${pt(RM, m)}Z`
    }
    s += `<path d="${graves}" fill="#1c4a78" opacity=".2"/><path d="${clairs}" fill="#fff" opacity=".42"/>`
  } else {
    // L'émail noir entre deux filets d'or, et une poussière d'étoiles.
    s += `<path d="${anneau(R1, R1 + 1.5)}${anneau(R2 - 1.5, R2)}" fill-rule="evenodd" fill="url(#m)"/>`
    let poussiere = ''
    for (let k = 0; k < 12; k++)
      for (let j = 0; j < 3; j++) {
        const [x, y] = xy(R1 + 2.4 + tirage(k, j, 5, 3, 5), k * 30 + 3 + tirage(k, j, 7, 6, 24))
        poussiere += rond(x, y, 0.45)
      }
    s += `<path d="${poussiere}" fill="#ffe7a3" opacity=".9"/>`
  }
  if (ligue !== 'maitre') s += `<circle cx="100" cy="100" r="${R1 + 1}" fill="none" stroke="#fff" stroke-width=".55" opacity=".4"/>`
  for (let i = 0; i < CRANS; i++) {
    const [x, y] = xy(RM, ANGLES[i])
    s += chaton(ligue, x, y, 5.2, i < crans, met)
  }
  s += insigne(ligue, met, sertie)
  return s + '</svg>'
}

// ── Piste 3 — La parure ───────────────────────────────────────────────────

/** Une feuille, le long de son axe : `t` en travers, `s` de la base (0) à la pointe (1). */
const FEUILLES: Record<Ligue, { corps: Commande[]; nervure?: Commande[]; L: number; w: number }> = {
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
  // La feuille d'or : ourlée, une pointe qui se recourbe.
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
  // La flamme du Soleil noir.
  maitre: {
    corps: [['M', 0, 0], ['C', 1.3, 0.18, 0.5, 0.46, 0.95, 0.68], ['C', 0.7, 0.84, 0.25, 0.9, 0.05, 1.06], ['C', -0.3, 0.8, -1.2, 0.6, -0.6, 0.32], ['C', -0.4, 0.2, -0.5, 0.08, 0, 0], ['Z']],
    L: 27,
    w: 5.4,
  },
}

const aLEchelle = (cmds: readonly Commande[], w: number, L: number): Commande[] =>
  cmds.map(c => (c[0] === 'Z' ? c : ([c[0], ...c.slice(1).map((x, i) => (x as number) * (i % 2 === 0 ? w : L))] as Commande)))

/**
 * Une parure qui pousse : un fil de métal, toujours entier, l'insigne de la
 * ligue en bas, et une feuille par victoire — elles montent des deux côtés
 * vers le haut, comme une couronne qu'on tresse. Un cran à gagner est un
 * bourgeon sur le fil : rien de fantôme. Sertie, elle se referme et s'allume.
 */
export function parure(ligue: Ligue, crans: number, met: Metal): string {
  const R1 = 59.8
  const R2 = 62.6
  const sertie = crans >= CRANS
  const F = FEUILLES[ligue]
  const corps = aLEchelle(F.corps, F.w, F.L)
  const nervure = F.nervure ? aLEchelle(F.nervure, F.w, F.L) : null
  const PENCHE = 54
  let s = OUVRIR + defs(ligue, met)
  // Chaque victoire, un brin de deux feuilles : la grande, et une petite couchée contre le fil.
  const petite = aLEchelle(F.corps, F.w * 0.74, F.L * 0.66)
  const COUCHE = 82
  const pied = R2 - 0.6
  // L'ombre des feuilles, puis la lueur d'une parure sertie.
  let ombres = ''
  for (let i = 0; i < Math.min(crans, CRANS); i++) ombres += poser(corps, pied, ANGLES[i], ANGLES[i] > 180, PENCHE)
  s += `<g transform="translate(0 2.4)" opacity=".42" filter="url(#o)"><path d="${ombres}" fill="#000"/><circle cx="100" cy="100" r="${(R1 + R2) / 2}" fill="none" stroke="#000" stroke-width="5"/></g>`
  if (sertie) s += `<circle cx="100" cy="100" r="68" fill="none" stroke="${met.lueur}" stroke-width="7" opacity=".5" filter="url(#b)"/>`
  // Le fil.
  s += `<path d="${anneau(R1, R2)}" fill-rule="evenodd" fill="url(#m)" stroke="${met.bord}" stroke-width=".55"/>`
  s += `<circle cx="100" cy="100" r="${R1 + 0.9}" fill="none" stroke="#fff" stroke-width=".45" opacity=".45"/>`
  // Les bourgeons des crans à gagner.
  let bourgeons = ''
  for (let i = crans; i < CRANS; i++) {
    const [x, y] = xy(R2 + 0.6, ANGLES[i])
    bourgeons += rond(x, y, 2.1)
  }
  if (bourgeons) s += `<path d="${bourgeons}" fill="url(#s)" stroke="${met.bord}" stroke-width=".45"/>`
  // Les feuilles gagnées : de la plus haute à la plus basse, chacune passe sur le pied de celle d'au-dessus.
  const email = ligue === 'maitre'
  for (let i = Math.min(crans, CRANS) - 1; i >= 0; i--) {
    const a = ANGLES[i]
    const gauche = a > 180
    const d = poser(corps, pied, a, gauche, PENCHE)
    const remplir = email ? 'url(#e)' : ligue === 'platine' ? 'url(#p)' : ligue === 'diamant' ? 'url(#f)' : 'url(#m)'
    const filet = `stroke="${email ? 'url(#m)' : met.bord}" stroke-width="${email ? 1 : 0.5}" stroke-linejoin="round"`
    s += `<path d="${poser(petite, pied + 0.4, a, gauche, COUCHE)}" fill="${email ? 'url(#e)' : 'url(#s)'}" ${filet}/>`
    s += `<path d="${d}" fill="${remplir}" ${filet}/>`
    if (nervure)
      s += `<path d="${poser(nervure, pied, a, gauche, PENCHE)}" fill="none" stroke="${ligue === 'diamant' || ligue === 'platine' ? '#4d86b3' : '#000'}" stroke-width="${ligue === 'diamant' || ligue === 'platine' ? 0.4 : 0.55}" opacity="${ligue === 'diamant' || ligue === 'platine' ? 0.75 : 0.38}" stroke-linecap="round" stroke-linejoin="round"/>`
    // Le diamant jette un éclat à la pointe d'une marquise sur deux.
    if (ligue === 'diamant' && i % 2 === 0) {
      const [ex, ey] = xy(pied + F.L * 0.62, a + (gauche ? 1 : -1) * 17.5)
      s += `<path d="${etoile(ex, ey, 3.6, 0.7, 4)}" fill="#fff"/>`
    }
    // Sa pierre, au pied de la feuille, sur le fil.
    const [x, y] = xy(R2 - 0.2, a)
    if (ligue !== 'bronze') s += pierre(ligue, x, y, 2.9, met)
    else s += `<circle cx="${f(x)}" cy="${f(y)}" r="2.5" fill="url(#f)" stroke="${met.bord}" stroke-width=".4"/><circle cx="${f(x - 0.8)}" cy="${f(y - 0.9)}" r=".8" fill="#fff" opacity=".8"/>`
  }
  s += insigne(ligue, met, sertie)
  return s + '</svg>'
}

// ── Piste 1 — Les alliages, apaisés ───────────────────────────────────────

/**
 * Les six bordures d'aujourd'hui, leur dessin intact (`svgDuCadre`, sertie),
 * et deux retouches : un cran à gagner est le même métal, patiné — plus un
 * pointillé —, et les crans se polissent du bas vers le haut, des deux côtés.
 * `plein` : le SVG d'une bordure sertie, tel que l'application le dessine.
 */
export function apaise(plein: string, crans: number): string {
  if (crans >= CRANS) return plein
  const corps = plein.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  const coupe = corps.match(/^<defs>([\s\S]*?)<\/defs>([\s\S]*)$/)
  if (!coupe) return plein
  // La lueur d'une bordure sertie s'en va : celle-ci ne l'est pas encore.
  const dessin = coupe[2].replace(/<circle cx="100" cy="100" r="88"[^>]*\/>/, '')
  let parts = ''
  for (let i = 0; i < crans; i++) parts += `M100 100L${pt(110, ANGLES[i] - 15)}A110 110 0 0 1 ${pt(110, ANGLES[i] + 15)}Z`
  return (
    OUVRIR +
    `<defs>${coupe[1]}` +
    `<filter id="pa" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="saturate" values=".28"/><feComponentTransfer><feFuncR type="linear" slope=".4"/><feFuncG type="linear" slope=".4"/><feFuncB type="linear" slope=".44"/></feComponentTransfer></filter>` +
    `<mask id="ga" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><path d="${parts || 'M0 0'}" fill="#fff"/></mask>` +
    `<mask id="re" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><rect width="200" height="200" fill="#fff"/><path d="${parts || 'M0 0'}" fill="#000"/></mask></defs>` +
    `<g mask="url(#re)"><g filter="url(#pa)">${dessin}</g></g><g mask="url(#ga)">${dessin}</g></svg>`
  )
}
