// Les motifs de bordure à choisir — une maquette, pas du code livré : rien de
// `client/` ne bouge. Le repère, le fil, l'ordre des crans, l'insigne et le
// métal sont ceux de la parure du 17 novembre 2026
// (`client/src/components/dessinDesBordures.ts`, recopiés ici : ses pièces ne
// sont pas exportées) ; seul ce qui pousse à chaque victoire change — le
// motif. La ligue garde ce qui la dit : son métal, son insigne, son compte de
// crans.
//
// Le repère : 200 × 200, centré en (100, 100). Le disque de l'avatar tient
// dans un rayon de 59, le fil va de 59,8 à 62,6, un motif jusqu'à 80 environ,
// l'insigne jusqu'à 92. Une forme se dessine debout — `u` en travers, `v`
// vers l'extérieur —, et `-u` est « vers midi » : `poser` la retourne pour le
// côté gauche, et la bordure reste symétrique à chaque victoire.
import { CRANS_D_UNE_BORDURE, type CleDeLigue } from '../../../shared/duels'
import { METAUX, type Metal } from '../../../client/src/components/metaux'

const f = (n: number) => String(Math.round(n * 100) / 100)

function xy(r: number, deg: number): [number, number] {
  const t = (deg * Math.PI) / 180
  return [100 + r * Math.sin(t), 100 - r * Math.cos(t)]
}

function rond(x: number, y: number, r: number): string {
  const q = f(r)
  return `M${f(x - r)} ${f(y)}a${q} ${q} 0 1 0 ${f(2 * r)} 0a${q} ${q} 0 1 0 ${f(-2 * r)} 0Z`
}

const anneau = (r1: number, r2: number) => rond(100, 100, r2) + rond(100, 100, r1)

function etoile(x: number, y: number, R: number, r: number, n: number): string {
  let d = ''
  for (let i = 0; i < 2 * n; i++) {
    const a = (i * Math.PI) / n
    const q = i % 2 === 0 ? R : r
    d += `${i === 0 ? 'M' : 'L'}${f(x + q * Math.sin(a))} ${f(y - q * Math.cos(a))}`
  }
  return d + 'Z'
}

type Commande = readonly [string, ...number[]]

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

const grandir = (cmds: readonly Commande[], k: number): Commande[] => cmds.map(c => (c[0] === 'Z' ? c : ([c[0], ...c.slice(1).map(x => (x as number) * k)] as Commande)))
const aLEchelle = (cmds: readonly Commande[], w: number, L: number): Commande[] =>
  cmds.map(c => (c[0] === 'Z' ? c : ([c[0], ...c.slice(1).map((x, i) => (x as number) * (i % 2 === 0 ? w : L))] as Commande)))
const decaler = (cmds: readonly Commande[], du: number, dv: number): Commande[] =>
  cmds.map(c => (c[0] === 'Z' ? c : ([c[0], ...c.slice(1).map((x, i) => (x as number) + (i % 2 === 0 ? du : dv))] as Commande)))

/** L'ordre des crans : du bas vers le haut, à droite puis à gauche (celui de l'application). */
export const ANGLES: readonly number[] = [165, 195, 135, 225, 105, 255, 75, 285, 45, 315, 15, 345]

// ── Les métaux et les pierres ─────────────────────────────────────────────

const metalDe = (ligue: CleDeLigue): Metal => METAUX[ligue === 'maitre' ? 'or' : ligue]

function melange(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16))
  const x = p(a)
  const y = p(b)
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

export type Pierres = readonly [string, string, string]

export const PIERRES: Record<CleDeLigue, Pierres> = {
  bronze: ['#ffe0b8', '#c9803f', '#5e3414'],
  argent: ['#ffffff', '#e6ebf2', '#8d97a6'],
  or: ['#ff9aa8', '#c8152f', '#560616'],
  platine: ['#ffffff', '#bfe9ff', '#4f9bcb'],
  diamant: ['#ffffff', '#e2f4ff', '#86c1ea'],
  maitre: ['#6a5a80', '#1a1422', '#050308'],
}

/** Des pierres qu'un avatar pourrait donner à sa bordure (la proposition « les pierres de l'avatar »). */
export const PIERRES_D_AVATAR: Record<string, [string, Pierres]> = {
  feu: ['Opale de feu', ['#ffe2a0', '#ff7a1f', '#7a2104']],
  mer: ['Aigue-marine', ['#e6fffb', '#2fc6c9', '#0b4f6c']],
  jade: ['Émeraude', ['#c9ffd8', '#1fa65a', '#0b3d20']],
  nuit: ['Améthyste', ['#f1ddff', '#9b4fe0', '#3a0f66']],
  ciel: ['Saphir', ['#d9e8ff', '#3a6ee8', '#0e2466']],
  rose: ['Quartz rose', ['#fff0f5', '#f28fb4', '#8a2d55']],
}

const EMAIL = ['#33293f', '#17121e', '#07060a'] as const

const degrade = (id: string, m: readonly string[]) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="24" y1="16" x2="176" y2="184">${m
    .map((c, i) => `<stop offset="${[0, 0.27, 0.5, 0.73, 1][i]}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`

const radial = (id: string, [a, b, c]: readonly string[]) =>
  `<radialGradient id="${id}" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="${a}"/><stop offset=".45" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`

function definitions(met: Metal, pierres: Pierres): string {
  return (
    `<defs>${degrade('m', met.m)}${degrade('f', met.m.map(c => melange(c, '#ffffff', 0.42)))}${degrade('s', met.m.map(c => melange(c, '#000000', 0.5)))}` +
    `<linearGradient id="e" gradientUnits="userSpaceOnUse" x1="30" y1="20" x2="170" y2="180"><stop offset="0" stop-color="${EMAIL[0]}"/><stop offset=".5" stop-color="${EMAIL[1]}"/><stop offset="1" stop-color="${EMAIL[2]}"/></linearGradient>` +
    radial('p', pierres) +
    // Les couleurs des motifs de saison : l'émail rose des cœurs, le vert du houx, le rouge de ses baies.
    radial('c', ['#ffc2d4', '#e8336b', '#6e0b2c']) +
    `<linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fbf72"/><stop offset=".5" stop-color="#23753a"/><stop offset="1" stop-color="#0b3a1c"/></linearGradient>` +
    radial('r', ['#ffb3a8', '#d81e2a', '#5a0610']) +
    `<filter id="b" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="5"/></filter>` +
    // L'ombre portée de toute la parure, d'un filtre : chaque motif l'a sans la dessiner.
    `<filter id="d" x="-15%" y="-15%" width="130%" height="135%"><feGaussianBlur in="SourceAlpha" stdDeviation="2"/><feOffset dy="2.2"/><feComponentTransfer><feFuncA type="linear" slope=".42"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
  )
}

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
    return (
      `<path d="${octogone(R)}" fill="url(#p)" stroke="${met.bord}" stroke-width=".35"/>` +
      `<path d="${octogone(R * 0.5)}" fill="#fff" opacity=".7"/>` +
      `<path d="${etoile(x - 0.3 * R, y - 0.34 * R, 0.62 * R, 0.13 * R, 4)}" fill="#fff"/>`
    )
  }
  const dome = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#p)" stroke="${met.bord}" stroke-width=".35"/>`
  if (ligue === 'platine') return dome + `<path d="${etoile(x, y, 0.82 * R, 0.2 * R, 4)}" fill="#fff" opacity=".95"/>`
  if (ligue === 'maitre') return dome + `<path d="${etoile(x, y, 0.8 * R, 0.3 * R, 8)}" fill="url(#f)"/>` + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.2 * R)}" fill="#fff6d8"/>`
  const [rx, ry] = [x - 0.32 * R, y - 0.36 * R]
  return dome + `<ellipse cx="${f(rx)}" cy="${f(ry)}" rx="${f(0.3 * R)}" ry="${f(0.2 * R)}" fill="#fff" opacity=".85" transform="rotate(-35 ${f(rx)} ${f(ry)})"/>`
}

/** Une perle ronde, à la couleur de la pierre de la ligue — jamais taillée. */
const perle = (x: number, y: number, R: number, met: Metal) =>
  `<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="url(#p)" stroke="${met.bord}" stroke-width=".35"/>` +
  `<ellipse cx="${f(x - 0.34 * R)}" cy="${f(y - 0.36 * R)}" rx="${f(0.32 * R)}" ry="${f(0.22 * R)}" fill="#fff" opacity=".8" transform="rotate(-35 ${f(x - 0.34 * R)} ${f(y - 0.36 * R)})"/>`

// ── L'insigne (celui de l'application) ────────────────────────────────────

const ECU: Commande[] = [['M', -7.6, 0], ['L', 7.6, 0], ['L', 7.6, 10], ['C', 7.6, 16, 3.6, 20, 0, 23.6], ['C', -3.6, 20, -7.6, 16, -7.6, 10], ['Z']]
const ECU_DEDANS: Commande[] = [['M', -5.6, 1.8], ['L', 5.6, 1.8], ['L', 5.6, 10], ['C', 5.6, 14.6, 2.7, 17.8, 0, 20.6], ['C', -2.7, 17.8, -5.6, 14.6, -5.6, 10], ['Z']]
const AILE: Commande[] = [['M', 7.4, 9.6], ['C', 12, 10, 16.2, 13.2, 17.8, 18.4], ['C', 12.6, 18.8, 9, 15.8, 7.4, 13.2], ['Z']]
const BELIERE: Commande[] = [['M', -4, 0], ['L', 4, 0], ['L', 2.6, 6.4], ['L', -2.6, 6.4], ['Z']]
const PETALE: Commande[] = [['M', 1, 4.6], ['C', 2.2, 10.8, 7, 12.6, 8.1, 8.4], ['C', 8.6, 6.4, 7.6, 4.9, 6.1, 5.3], ['C', 6.9, 6.3, 6.8, 8, 5.6, 8.3], ['C', 4.1, 8.6, 2.9, 6.6, 2.7, 3.9], ['Z']]
const LYS: Commande[][] = [
  [['M', 0, 17], ['C', 2.4, 13.2, 3.1, 8.6, 1.5, 4.4], ['L', -1.5, 4.4], ['C', -3.1, 8.6, -2.4, 13.2, 0, 17], ['Z']],
  [['M', -4.6, 4.6], ['L', 4.6, 4.6], ['L', 4.1, 2.4], ['L', -4.1, 2.4], ['Z']],
  [['M', -1.6, 2.4], ['L', 1.6, 2.4], ['L', 2.6, -0.4], ['L', 0, 0.8], ['L', -2.6, -0.4], ['Z']],
]
const RAYON: Commande[] = [['M', -2.3, 0], ['C', -1.9, 6.5, 1.4, 10.5, 0, 19], ['C', 2.8, 12.5, 2.6, 6, 2.3, 0], ['Z']]
const RAYON_COURT: Commande[] = [['M', -1.5, 0], ['L', 0, 11], ['L', 1.5, 0], ['Z']]
const cristal = (w: number, L: number): Commande[] => [['M', 0, 0], ['L', w, 0.2 * L], ['L', w, 0.62 * L], ['L', 0, L], ['L', -w, 0.62 * L], ['L', -w, 0.2 * L], ['Z']]
const aretesDuCristal = (w: number, L: number): Commande[] => [['M', 0, 0], ['L', 0, L], ['M', -w, 0.2 * L], ['L', 0, 0.36 * L], ['L', w, 0.2 * L]]
const R_INSIGNE = 58.4

function insigne(ligue: CleDeLigue, met: Metal, sertie: boolean): string {
  const r0 = R_INSIGNE
  const metal = `fill="url(#m)" stroke="${met.bord}" stroke-width=".5" stroke-linejoin="round"`
  const en = (cmds: readonly Commande[], r = r0, deg = 180, miroir = false) => `<path d="${poser(cmds, r, deg, miroir)}" ${metal}/>`
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

// ── Les motifs ────────────────────────────────────────────────────────────

/** Ce qu'un motif sait de sa bordure : sa ligue, son métal, et de quoi se remplir. */
interface Contexte {
  ligue: CleDeLigue
  met: Metal
  /** Les maîtres : l'émail noir ourlé d'or. */
  email: boolean
  /** Le remplissage d'une pièce : le métal, la glace du platine, le feu du diamant, l'émail des maîtres. */
  remplir: string
  /** Son filet. */
  filet: string
}

interface Motif {
  /** Le fil : celui d'aujourd'hui, ou un jonc deux fois plus large (le Jonc serti). */
  jonc?: boolean
  /** Un cran gagné, à l'angle `a` ; `gauche` le retourne ; `i`, son rang (0 : le premier gagné). */
  cran: (c: Contexte, a: number, gauche: boolean, i: number) => string
  /** Un cran à gagner : d'office, un bourgeon sur le fil. */
  attente?: (c: Contexte, a: number) => string
  /** Ce qui se dessine sous les crans, une fois qu'ils sont tous posés (les liens d'une constellation). */
  dessous?: (c: Contexte, n: number) => string
}

const FIL = [59.8, 62.6] as const
const PIED = FIL[1] - 0.6
const JONC = [58.6, 64.8] as const

const bourgeon = (c: Contexte, a: number) => {
  const [x, y] = xy(FIL[1] + 0.6, a)
  return `<path d="${rond(x, y, 2.1)}" fill="url(#s)" stroke="${c.met.bord}" stroke-width=".45"/>`
}
/** « Vers midi », en degrés : à droite on remonte en reculant, à gauche en avançant. */
const versMidi = (gauche: boolean) => (gauche ? 1 : -1)

// Les feuilles d'aujourd'hui, pour la parure « Les Feuilles » : dessinées par l'application même (`svgDuCadre`).

// Le jonc serti : un anneau large, un chaton par cran — la pierre de la ligue y est sertie à chaque victoire.
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

// Le fil nu : la ligue seule, son insigne. Les crans ne se voient que dans « Ma collection ».
const nu: Motif = { cran: () => '', attente: () => '' }

// Les perles : un trio de perles graduées par victoire, à la couleur de la pierre de la ligue.
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

// Les étoiles : une étoile par victoire, reliées en constellation de chaque côté.
const ETOILE: Commande[] = Array.from({ length: 10 }, (_, k) => {
  const t = (k * 36 * Math.PI) / 180
  const q = k % 2 === 0 ? 7.4 : 3
  return [k === 0 ? 'M' : 'L', q * Math.sin(t), q * Math.cos(t)] as Commande
}).concat([['Z']])
const R_ETOILES = 70.5
const etoiles: Motif = {
  dessous: (c, n) => {
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
    const remplir = c.email ? 'url(#f)' : c.remplir === 'url(#m)' ? 'url(#f)' : c.remplir
    return (
      `<path d="${poser(ETOILE, R_ETOILES, a)}" fill="${remplir}" stroke="${c.met.bord}" stroke-width=".5" stroke-linejoin="round"/>` +
      `<path d="${etoile(ex, ey, 2.4, 0.5, 4)}" fill="url(#f)"/>` +
      (() => {
        const [x, y] = xy(R_ETOILES, a)
        return pierre(c.ligue, x, y, 1.6, c.met)
      })()
    )
  },
}

// Les écailles : deux par victoire, couchées vers midi, la plus basse sur la plus haute — une armure de dragon.
const ECAILLE: Commande[] = [['M', -8.6, -1.2], ['C', -8.8, 5, -4.4, 10.4, 0, 12.4], ['C', 4.4, 10.4, 8.8, 5, 8.6, -1.2], ['Z']]
const ECAILLE_DEDANS: Commande[] = [['M', -5.6, 1.4], ['C', -5.7, 5.8, -2.8, 8.8, 0, 10], ['C', 2.8, 8.8, 5.7, 5.8, 5.6, 1.4]]
const ecailles: Motif = {
  cran: (c, a, gauche) => {
    let s = ''
    for (const k of [1, -1]) {
      const b = a + versMidi(gauche) * 7.5 * k
      s += `<path d="${poser(ECAILLE, 60.6, b, gauche, 62)}" fill="${c.remplir}" ${c.filet}/>`
      s += `<path d="${poser(ECAILLE_DEDANS, 60.6, b, gauche, 62)}" fill="none" stroke="#fff" stroke-width=".55" opacity="${c.email ? 0.25 : 0.45}"/>`
      s += `<path d="${poser([['M', 0, 1], ['L', 0, 10.6]], 60.6, b, gauche, 62)}" fill="none" stroke="${c.email ? 'url(#m)' : c.met.bord}" stroke-width=".4" opacity=".5"/>`
    }
    return s
  },
}

// Les vagues : une vague qui s'enroule vers midi par victoire, son écume.
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
  cran: (c, a, gauche) =>
    `<path d="${poser(VAGUE, 61.4, a, gauche, 12)}" fill="${c.remplir}" ${c.filet}/>` +
    `<path d="${poser(ECUME, 61.4, a, gauche, 12)}" fill="none" stroke="#fff" stroke-width=".7" stroke-linecap="round" opacity="${c.email ? 0.3 : 0.55}"/>` +
    (() => {
      const [x, y] = xy(FIL[1] - 0.2, a + versMidi(gauche) * -6)
      return perle(x, y, 1.7, c.met)
    })(),
}

// Les rayons : un soleil art déco, trois rais par victoire et sa pierre au pied.
const RAI: Commande[] = [['M', -2.5, 0], ['L', -0.7, 18], ['L', 0.7, 18], ['L', 2.5, 0], ['Z']]
const RAI_COURT: Commande[] = [['M', -1.7, 0], ['L', 0, 10.5], ['L', 1.7, 0], ['Z']]
const rayons: Motif = {
  cran: (c, a) => {
    const [x, y] = xy(FIL[1] + 1.2, a)
    return (
      `<path d="${poser(RAI_COURT, PIED, a - 10)}" fill="${c.remplir}" ${c.filet}/>` +
      `<path d="${poser(RAI_COURT, PIED, a + 10)}" fill="${c.remplir}" ${c.filet}/>` +
      `<path d="${poser(RAI, PIED, a)}" fill="${c.remplir}" ${c.filet}/>` +
      pierre(c.ligue, x, y, 1.9, c.met)
    )
  },
}

// Les fleurs : une fleur de bijou à cinq pétales et son bouton, le cœur à la pierre de la ligue.
const fleurs: Motif = {
  cran: (c, a, gauche) => {
    const [cx, cy] = xy(69.2, a)
    let s = ''
    const [bx, by] = xy(64.6, a + versMidi(gauche) * 14)
    s += `<ellipse cx="${f(bx)}" cy="${f(by)}" rx="1.7" ry="2.6" fill="url(#s)" stroke="${c.met.bord}" stroke-width=".4" transform="rotate(${f(a + versMidi(gauche) * 14 + versMidi(gauche) * 35)} ${f(bx)} ${f(by)})"/>`
    for (let k = 0; k < 5; k++) {
      const t = a + k * 72
      const [px, py] = [cx + 3.8 * Math.sin((t * Math.PI) / 180), cy - 3.8 * Math.cos((t * Math.PI) / 180)]
      s += `<ellipse cx="${f(px)}" cy="${f(py)}" rx="2.9" ry="4.1" fill="${c.remplir}" stroke="${c.email ? 'url(#m)' : c.met.bord}" stroke-width="${c.email ? 0.8 : 0.45}" transform="rotate(${f(t)} ${f(px)} ${f(py)})"/>`
    }
    return s + pierre(c.ligue, cx, cy, 1.9, c.met)
  },
}

// Les plumes : une rémige par victoire, couchée vers midi, son rachis et ses barbes.
const PLUME: Commande[] = [['M', 0, 0], ['C', 0.5, 0.05, 1, 0.25, 1, 0.55], ['C', 1, 0.8, 0.55, 1, 0.1, 1.06], ['C', -0.35, 0.98, -0.62, 0.75, -0.62, 0.5], ['C', -0.62, 0.25, -0.35, 0.08, 0, 0], ['Z']]
const RACHIS: Commande[] = [['M', 0, -0.08], ['C', 0.06, 0.35, 0.1, 0.7, 0.1, 1.02]]
const BARBES: Commande[] = [0.18, 0.3, 0.42, 0.54, 0.66, 0.78, 0.88].flatMap(s => [['M', 0.06, s], ['L', 0.9, s + 0.14], ['M', 0.05, s], ['L', -0.56, s + 0.12]] as Commande[])
/** L'entaille d'une rémige : ses barbes s'écartent, à un tiers du bout. */
const ENTAILLE: Commande[] = [['M', 1.02, 0.6], ['L', 0.42, 0.62], ['L', 0.98, 0.7]]
const plumes: Motif = {
  cran: (c, a, gauche) => {
    const L = 31
    const w = 4.6
    const penche = 64
    return (
      `<path d="${poser(aLEchelle(PLUME, w, L), PIED - 0.6, a, gauche, penche)}" fill="${c.remplir}" ${c.filet}/>` +
      `<path d="${poser(aLEchelle(BARBES, w, L), PIED - 0.6, a, gauche, penche)}" fill="none" stroke="${c.email ? '#e9c873' : c.met.bord}" stroke-width=".4" opacity="${c.email ? 0.6 : 0.5}"/>` +
      `<path d="${poser(aLEchelle(ENTAILLE, w, L), PIED - 0.6, a, gauche, penche)}" fill="${c.email ? '#07060a' : 'url(#s)'}" stroke="${c.email ? 'url(#m)' : c.met.bord}" stroke-width=".35"/>` +
      `<path d="${poser(aLEchelle(RACHIS, w, L), PIED - 0.6, a, gauche, penche)}" fill="none" stroke="${c.email ? 'url(#f)' : c.met.bord}" stroke-width=".8" stroke-linecap="round"/>`
    )
  },
}

// Les flammes : deux flammes par victoire, leur cœur à la pierre de la ligue — le Soleil noir, à toutes les ligues.
const FLAMME: Commande[] = [['M', 0, 0], ['C', 1.3, 0.18, 0.5, 0.46, 0.95, 0.68], ['C', 0.7, 0.84, 0.25, 0.9, 0.05, 1.06], ['C', -0.3, 0.8, -1.2, 0.6, -0.6, 0.32], ['C', -0.4, 0.2, -0.5, 0.08, 0, 0], ['Z']]
const flammes: Motif = {
  cran: (c, a, gauche) => {
    const corps = aLEchelle(FLAMME, 5.6, 26)
    const coeur = decaler(aLEchelle(FLAMME, 2.6, 14), 0, 1.6)
    const petite = aLEchelle(FLAMME, 4, 17)
    return (
      `<path d="${poser(petite, PIED + 0.4, a, gauche, 78)}" fill="${c.email ? 'url(#e)' : 'url(#s)'}" ${c.filet}/>` +
      `<path d="${poser(corps, PIED, a, gauche, 42)}" fill="${c.remplir}" ${c.filet}/>` +
      `<path d="${poser(coeur, PIED, a, gauche, 42)}" fill="url(#p)" opacity=".9"/>`
    )
  },
}

// Les rouages : un engrenage par victoire et son pignon, la pierre au moyeu — l'atelier d'Automate.
function engrenage(x: number, y: number, R: number, r: number, n: number, trou: number, phase: number): string {
  let d = ''
  for (let k = 0; k < n; k++) {
    const t0 = ((k / n) * 360 + phase) * (Math.PI / 180)
    const pas = (2 * Math.PI) / n
    const pts: [number, number][] = [
      [r, t0],
      [R, t0 + pas * 0.18],
      [R, t0 + pas * 0.48],
      [r, t0 + pas * 0.66],
    ]
    for (const [q, t] of pts) d += `${d ? 'L' : 'M'}${f(x + q * Math.sin(t))} ${f(y - q * Math.cos(t))}`
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

// Les cœurs (la Saint-Valentin) : un cœur d'émail rose ourlé du métal de la ligue, et son petit.
const COEUR: Commande[] = [['M', 0, -4.6], ['C', -2.5, -2.2, -6, 0.2, -6, 3.4], ['C', -6, 6, -3.8, 7.4, -2, 7.4], ['C', -1, 7.4, -0.3, 6.8, 0, 6], ['C', 0.3, 6.8, 1, 7.4, 2, 7.4], ['C', 3.8, 7.4, 6, 6, 6, 3.4], ['C', 6, 0.2, 2.5, -2.2, 0, -4.6], ['Z']]
const coeurs: Motif = {
  cran: (c, a, gauche) =>
    `<path d="${poser(grandir(COEUR, 0.5), 64.8, a + versMidi(gauche) * 14.5, gauche, 25)}" fill="url(#c)" stroke="url(#m)" stroke-width=".7"/>` +
    `<path d="${poser(COEUR, 68.2, a)}" fill="url(#c)" stroke="url(#m)" stroke-width="1.1" stroke-linejoin="round"/>` +
    (() => {
      const [x, y] = xy(70, a)
      return `<ellipse cx="${f(x - 1.8)}" cy="${f(y - 1.4)}" rx="1.2" ry=".7" fill="#fff" opacity=".7" transform="rotate(-35 ${f(x - 1.8)} ${f(y - 1.4)})"/>`
    })(),
}

// Le houx (Noël) : une feuille d'émail vert ourlée du métal de la ligue, et ses deux baies.
const HOUX: Commande[] = [
  ['M', 0, 0], ['L', 0.5, 0.08], ['L', 0.95, 0.04], ['L', 0.74, 0.28], ['L', 1.05, 0.42], ['L', 0.7, 0.54], ['L', 0.88, 0.76], ['L', 0.44, 0.78], ['L', 0, 1.04],
  ['L', -0.44, 0.78], ['L', -0.88, 0.76], ['L', -0.7, 0.54], ['L', -1.05, 0.42], ['L', -0.74, 0.28], ['L', -0.95, 0.04], ['L', -0.5, 0.08], ['Z'],
]
const houx: Motif = {
  cran: (c, a, gauche) => {
    const feuille = aLEchelle(HOUX, 5.6, 23)
    const nervure = aLEchelle([['M', 0, 0.05], ['L', 0, 0.92]], 5.6, 23)
    const [b1x, b1y] = xy(FIL[1] + 2.4, a + versMidi(gauche) * -3.4)
    const [b2x, b2y] = xy(FIL[1] + 5.4, a + versMidi(gauche) * -0.6)
    const baie = (x: number, y: number) => `<circle cx="${f(x)}" cy="${f(y)}" r="2.3" fill="url(#r)" stroke="#3a0408" stroke-width=".35"/><circle cx="${f(x - 0.7)}" cy="${f(y - 0.8)}" r=".6" fill="#fff" opacity=".8"/>`
    return (
      `<path d="${poser(feuille, PIED, a, gauche, 50)}" fill="url(#h)" stroke="url(#m)" stroke-width=".8" stroke-linejoin="round"/>` +
      `<path d="${poser(nervure, PIED, a, gauche, 50)}" fill="none" stroke="url(#m)" stroke-width=".5" opacity=".8"/>` +
      baie(b1x, b1y) +
      baie(b2x, b2y)
    )
  },
}

// Les feuilles d'une ligue, portées dans une autre (la proposition « chaque bordure sertie prête sa feuille ») : le
// brin de l'application (`FEUILLES`, `parure`), au métal et aux pierres de la ligue qui le porte.
const FEUILLES: Record<CleDeLigue, { corps: Commande[]; nervure?: Commande[]; L: number; w: number }> = {
  bronze: { corps: [['M', 0, 0], ['C', 0.95, 0.16, 1.05, 0.56, 0, 1], ['C', -1.05, 0.56, -0.95, 0.16, 0, 0], ['Z']], nervure: [['M', 0, 0.12], ['L', 0, 0.84]], L: 25, w: 6 },
  argent: { corps: [['M', 0, 0], ['C', 0.9, 0.2, 0.95, 0.6, 0, 1], ['C', -0.95, 0.6, -0.9, 0.2, 0, 0], ['Z']], nervure: [['M', 0, 0.12], ['L', 0, 0.84]], L: 26, w: 4.8 },
  or: {
    corps: [['M', 0, 0], ['C', 1.1, 0.12, 1.25, 0.5, 0.5, 0.74], ['C', 0.32, 0.86, 0.12, 0.95, -0.28, 1.04], ['C', -0.16, 0.78, -1.15, 0.6, -0.92, 0.26], ['C', -0.82, 0.12, -0.5, 0.04, 0, 0], ['Z']],
    nervure: [['M', 0, 0.1], ['C', 0.16, 0.4, 0.1, 0.7, -0.16, 0.9]],
    L: 25,
    w: 5.8,
  },
  platine: {
    corps: [['M', 0, 0], ['L', 0.9, 0.2], ['L', 0.9, 0.66], ['L', 0, 1], ['L', -0.9, 0.66], ['L', -0.9, 0.2], ['Z']],
    nervure: [['M', 0, 0], ['L', 0, 1], ['M', -0.9, 0.2], ['L', 0, 0.36], ['L', 0.9, 0.2], ['M', -0.9, 0.66], ['L', 0, 0.54], ['L', 0.9, 0.66]],
    L: 26,
    w: 3.5,
  },
  diamant: { corps: [['M', 0, 0], ['C', 1.05, 0.26, 1.05, 0.74, 0, 1], ['C', -1.05, 0.74, -1.05, 0.26, 0, 0], ['Z']], nervure: [['M', 0, 0], ['L', 0, 1], ['M', -0.78, 0.5], ['L', 0, 0.26], ['L', 0.78, 0.5], ['L', 0, 0.74], ['Z']], L: 24, w: 5 },
  maitre: { corps: [['M', 0, 0], ['C', 1.3, 0.18, 0.5, 0.46, 0.95, 0.68], ['C', 0.7, 0.84, 0.25, 0.9, 0.05, 1.06], ['C', -0.3, 0.8, -1.2, 0.6, -0.6, 0.32], ['C', -0.4, 0.2, -0.5, 0.08, 0, 0], ['Z']], L: 27, w: 5.4 },
}

/** Le brin d'une ligue (`de`), porté dans la bordure d'une autre : son métal, ses pierres. */
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
      let s = `<path d="${poser(petite, PIED + 0.4, a, gauche, 82)}" fill="${c.email ? 'url(#e)' : 'url(#s)'}" ${c.filet}/>`
      s += `<path d="${poser(corps, PIED, a, gauche, 54)}" fill="${remplir}" ${c.filet}/>`
      if (nervure)
        s += `<path d="${poser(nervure, PIED, a, gauche, 54)}" fill="none" stroke="${glace ? '#4d86b3' : '#000'}" stroke-width="${glace ? 0.4 : 0.55}" opacity="${glace ? 0.75 : 0.38}" stroke-linecap="round" stroke-linejoin="round"/>`
      if (de === 'diamant' && i % 2 === 0) {
        const [ex, ey] = xy(PIED + F.L * 0.62, a + (gauche ? 1 : -1) * 17.5)
        s += `<path d="${etoile(ex, ey, 3.6, 0.7, 4)}" fill="#fff"/>`
      }
      const [x, y] = xy(FIL[1] - 0.2, a)
      return s + pierre(c.ligue, x, y, 2.9, c.met)
    },
  }
}

export const MOTIFS = { jonc, nu, perles, etoiles, ecailles, vagues, rayons, fleurs, plumes, flammes, rouages, coeurs, houx } as const
export type CleDeMotif = keyof typeof MOTIFS | 'feuilles'

export const NOM_DU_MOTIF: Record<CleDeMotif, string> = {
  feuilles: 'Les Feuilles',
  jonc: 'Le Jonc serti',
  nu: 'Le Fil nu',
  perles: 'Les Perles',
  etoiles: 'Les Étoiles',
  ecailles: 'Les Écailles',
  vagues: 'Les Vagues',
  rayons: 'Les Rayons',
  fleurs: 'Les Fleurs',
  plumes: 'Les Plumes',
  flammes: 'Les Flammes',
  rouages: 'Les Rouages',
  coeurs: 'Les Cœurs',
  houx: 'Le Houx',
}

const OUVRIR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">`
const borner = (crans: number) => Math.max(0, Math.min(CRANS_D_UNE_BORDURE, Math.round(crans)))

/** Une bordure au motif choisi : son fil, ses crans au motif, l'insigne de sa ligue — et, sertie, sa lueur. */
/** `cle` : un motif, ou `feuilles-<ligue>` — le brin d'une ligue porté dans une autre. */
export function svgDuMotif(ligue: CleDeLigue, crans: number, cle: string, pierres?: Pierres): string {
  const n = borner(crans)
  const met = metalDe(ligue)
  const motif: Motif = cle.startsWith('feuilles-') ? feuillesDe(cle.slice(9) as CleDeLigue) : MOTIFS[cle as keyof typeof MOTIFS]
  const email = ligue === 'maitre'
  const c: Contexte = {
    ligue,
    met,
    email,
    remplir: email ? 'url(#e)' : ligue === 'platine' ? 'url(#p)' : ligue === 'diamant' ? 'url(#f)' : 'url(#m)',
    filet: `stroke="${email ? 'url(#m)' : met.bord}" stroke-width="${email ? 1 : 0.5}" stroke-linejoin="round"`,
  }
  const [r1, r2] = motif.jonc ? JONC : FIL
  let s = `<path d="${anneau(r1, r2)}" fill-rule="evenodd" fill="url(#m)" stroke="${met.bord}" stroke-width=".55"/>`
  s += `<circle cx="100" cy="100" r="${r1 + 0.9}" fill="none" stroke="#fff" stroke-width=".45" opacity=".45"/>`
  if (motif.jonc) s += `<circle cx="100" cy="100" r="${r2 - 0.9}" fill="none" stroke="${met.bord}" stroke-width=".4" opacity=".5"/>`
  for (let i = n; i < CRANS_D_UNE_BORDURE; i++) s += (motif.attente ?? bourgeon)(c, ANGLES[i])
  if (motif.dessous) s += motif.dessous(c, n)
  for (let i = n - 1; i >= 0; i--) s += motif.cran(c, ANGLES[i], ANGLES[i] > 180, i)
  s += insigne(ligue, met, n >= CRANS_D_UNE_BORDURE)
  return (
    OUVRIR +
    definitions(met, pierres ?? PIERRES[ligue]) +
    (n >= CRANS_D_UNE_BORDURE ? `<circle cx="100" cy="100" r="68" fill="none" stroke="${met.lueur}" stroke-width="7" opacity=".5" filter="url(#b)"/>` : '') +
    `<g filter="url(#d)">${s}</g></svg>`
  )
}
