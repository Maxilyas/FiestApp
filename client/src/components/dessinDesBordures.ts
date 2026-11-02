import type { Finition } from '../../../shared/profil'
import { CRANS_D_UNE_BORDURE, type CleDeLigue } from '../../../shared/duels'

// Les bordures de ligue, dessinées : la ligue donne la forme et la pierre, la
// finition le métal (la maquette des alliages, validée par le propriétaire le
// 12 octobre 2026). Douze crans autour de l'avatar ; un cran serti — un duel
// gagné dans la ligue — se dessine en métal, un cran à gagner en pointillé.
//
// Des images, faites à la demande et gardées : quarante avatars d'une liste
// qui portent la même bordure partagent la même, décodée une fois, sans cent
// nœuds SVG chacun à comparer — ni un identifiant de dégradé qu'un autre
// avatar, caché, garderait pour lui (`Lumiere.tsx` fait de même). Ce qui
// bouge — les rayons des maîtres, le reflet qui fait le tour — est un calque
// à part, qui ne tourne que par `rotate` (`Bordure.tsx`, `styles.css`).
//
// Un module sans React ni page : la planche des alliages le lit dans Node
// (`server/scripts/planche-bordures.ts`), les tests aussi.
//
// Le repère : 200 × 200, centré en (100, 100). Le disque de l'avatar tient
// dans un rayon de 59 — un médaillon de 1,12 em y entre juste, son cercle de
// finition contre la sertissure (`Cercle.tsx`) —, le bandeau de la ligue va
// de 63 à 82, ses ornements jusqu'à 96, les rayons des maîtres jusqu'à 99.

/** Un nombre court : au-delà de deux décimales, le tracé s'allonge sans que l'œil y gagne. */
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

/** Un morceau d'anneau, de `a0` à `a1`, entre les rayons `r1` et `r2`. */
function secteur(r1: number, r2: number, a0: number, a1: number): string {
  const g = a1 - a0 > 180 ? 1 : 0
  return `M${pt(r2, a0)}A${r2} ${r2} 0 ${g} 1 ${pt(r2, a1)}L${pt(r1, a1)}A${r1} ${r1} 0 ${g} 0 ${pt(r1, a0)}Z`
}

function rond(x: number, y: number, r: number): string {
  const q = f(r)
  return `M${f(x - r)} ${f(y)}a${q} ${q} 0 1 0 ${f(2 * r)} 0a${q} ${q} 0 1 0 ${f(-2 * r)} 0Z`
}

/** Une étoile à `n` branches, ses pointes à `R`, ses creux à `r`. */
function etoile(x: number, y: number, R: number, r: number, n: number, rot: number): string {
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

/** Une forme dessinée debout — `u` vers la droite, `v` vers l'extérieur —, posée au rayon `r` et à l'angle `deg`. */
function poser(cmds: readonly Commande[], r: number, deg: number): string {
  const t = (deg * Math.PI) / 180
  const sn = Math.sin(t)
  const cs = Math.cos(t)
  let d = ''
  for (const c of cmds) {
    if (c[0] === 'Z') {
      d += 'Z'
      continue
    }
    const pts: string[] = []
    for (let i = 1; i < c.length; i += 2) {
      const R = r + (c[i + 1] as number)
      const U = c[i] as number
      pts.push(`${f(100 + R * sn + U * cs)} ${f(100 - R * cs + U * sn)}`)
    }
    d += c[0] + pts.join(' ')
  }
  return d
}

/**
 * Le miroir d'une forme, parcouru à l'envers : un miroir retourne le sens du
 * tracé, et deux tracés de sens contraires qui se chevauchent dans un même
 * chemin font un trou — le pétale gauche d'une fleur de lys perçait le cœur.
 */
function miroir(cmds: readonly Commande[]): Commande[] {
  const m = cmds.map(c => (c[0] === 'Z' ? c : ([c[0], ...c.slice(1).map((x, i) => (i % 2 === 0 ? -(x as number) : (x as number)))] as Commande)))
  const segs: ({ t: 'L'; de: [number, number] } | { t: 'C'; de: [number, number]; c1: [number, number]; c2: [number, number] })[] = []
  let cur: [number, number] = [0, 0]
  for (const c of m) {
    if (c[0] === 'M') cur = [c[1]!, c[2]!]
    else if (c[0] === 'L') {
      segs.push({ t: 'L', de: cur })
      cur = [c[1]!, c[2]!]
    } else if (c[0] === 'C') {
      segs.push({ t: 'C', de: cur, c1: [c[1]!, c[2]!], c2: [c[3]!, c[4]!] })
      cur = [c[5]!, c[6]!]
    }
  }
  const out: Commande[] = [['M', cur[0], cur[1]]]
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i]
    out.push(s.t === 'L' ? ['L', s.de[0], s.de[1]] : ['C', s.c2[0], s.c2[1], s.c1[0], s.c1[1], s.de[0], s.de[1]])
  }
  out.push(['Z'])
  return out
}

// ── Les formes ────────────────────────────────────────────────────────────

const PETALE: Commande[] = [
  ['M', 1, 4.6],
  ['C', 2.2, 10.8, 7, 12.6, 8.1, 8.4],
  ['C', 8.6, 6.4, 7.6, 4.9, 6.1, 5.3],
  ['C', 6.9, 6.3, 6.8, 8, 5.6, 8.3],
  ['C', 4.1, 8.6, 2.9, 6.6, 2.7, 3.9],
  ['Z'],
]
const BRANCHE: Commande[] = [['M', 0.2, 9], ['L', -0.1, 10.6], ['L', 4.2, 14.1], ['L', 4.9, 13.2], ['Z']]

const FORMES = {
  /** La fleur de lys des Fleurons : son cœur, ses deux pétales, son lien, son pied. */
  lys: [
    [['M', 0, 17], ['C', 2.4, 13.2, 3.1, 8.6, 1.5, 4.4], ['L', -1.5, 4.4], ['C', -3.1, 8.6, -2.4, 13.2, 0, 17], ['Z']],
    PETALE,
    miroir(PETALE),
    [['M', -4.6, 4.6], ['L', 4.6, 4.6], ['L', 4.1, 2.4], ['L', -4.1, 2.4], ['Z']],
    [['M', -1.6, 2.4], ['L', 1.6, 2.4], ['L', 2.6, -0.4], ['L', 0, 0.8], ['L', -2.6, -0.4], ['Z']],
  ] as Commande[][],
  /** L'aiguille de glace du Givre, ses deux branches, et les petites à côté. */
  aiguille: [['M', 0, 19.5], ['L', 1.5, 5], ['L', 0, -1], ['L', -1.5, 5], ['Z']] as Commande[],
  branches: [BRANCHE, miroir(BRANCHE)],
  courte: [['M', 0, 9], ['L', 1.1, 3], ['L', 0, -1], ['L', -1.1, 3], ['Z']] as Commande[],
  /** Le cran fin du Perlé, entre deux perles. */
  losange: [['M', 0, 2.8], ['L', 1.2, 0], ['L', 0, -2.8], ['L', -1.2, 0], ['Z']] as Commande[],
  /** Les rayons du Soleil noir : une flamme qui ondule, et un trait plus court. */
  rayon: [['M', -2.3, 0], ['C', -1.9, 6.5, 1.4, 10.5, 0, 19], ['C', 2.8, 12.5, 2.6, 6, 2.3, 0], ['Z']] as Commande[],
  rayonCourt: [['M', -1.5, 0], ['L', 0, 11], ['L', 1.5, 0], ['Z']] as Commande[],
}

// ── Les métaux ────────────────────────────────────────────────────────────

/** Un métal : son dégradé, du sombre au clair et retour, son filet, sa lueur. */
interface Metal {
  m: readonly [string, string, string, string, string]
  bord: string
  lueur: string
  /** Constellation : des étoiles d'or semées sur le métal de toutes les ligues. */
  etoiles?: boolean
}

/** Les métaux des finitions — Mat, c'est celui de la ligue —, et ceux des ligues. */
const METAUX: Record<'bronze' | 'argent' | 'or' | 'platine' | 'diamant' | Exclude<Finition, 'mat' | 'argent' | 'or'>, Metal> = {
  bronze: { m: ['#4f2d14', '#d29660', '#86501f', '#f1c08c', '#5e3718'], bord: '#26150a', lueur: '#e9a86b' },
  argent: { m: ['#7c858f', '#f4f6f9', '#a3acb6', '#ffffff', '#858e98'], bord: '#2c3138', lueur: '#e8eef6' },
  or: { m: ['#7d5416', '#f6dd94', '#b8892f', '#fff0bf', '#8f6219'], bord: '#3a2508', lueur: '#f6cf73' },
  platine: { m: ['#7d8c9c', '#f2f6fa', '#b3c1cf', '#ffffff', '#8b9bab'], bord: '#36414c', lueur: '#eef6ff' },
  diamant: { m: ['#8fb6db', '#f2faff', '#b9daf3', '#ffffff', '#9dc0e2'], bord: '#3b5a78', lueur: '#dff1ff' },
  // Les couleurs des pastilles de la loge (`.teinte-*`), en métal.
  holo: { m: ['#f7b8e8', '#9fe3ff', '#fff1a6', '#b9f5c6', '#f7b8e8'], bord: '#5b4a70', lueur: '#f7c8ef' },
  prisme: { m: ['#ff8fa3', '#ffd166', '#7aa8ff', '#3ff0d0', '#ff8fa3'], bord: '#3d2f5a', lueur: '#ffffff' },
  aurore: { m: ['#58e6b4', '#5aaaff', '#be78ff', '#58e6b4', '#5aaaff'], bord: '#16313f', lueur: '#8ff5d6' },
  constellation: { m: ['#1b2357', '#3a4ca8', '#141a45', '#5468cc', '#1b2357'], bord: '#e2c27a', lueur: '#a9b8ff', etoiles: true },
  // Les cinq du 1er novembre 2026, chacune dans la matière de sa lumière : l'eau qui luit, le ciel d'orage, la nacre
  // des plumes, le miroir de la boule, la nuit cerclée de feu.
  abysses: { m: ['#062a3d', '#1fb6c9', '#0b4f6c', '#7ff6ff', '#062a3d'], bord: '#031822', lueur: '#7ff6ff' },
  orage: { m: ['#16235e', '#9fd8ff', '#2a4fb8', '#e9f7ff', '#16235e'], bord: '#0b1236', lueur: '#bfe6ff' },
  envol: { m: ['#b28a3e', '#fffdf5', '#f3e2b0', '#ffffff', '#c79d4a'], bord: '#6b5320', lueur: '#fff3cf' },
  disco: { m: ['#4a4f63', '#f4f6fb', '#9aa3b5', '#ffffff', '#4a4f63'], bord: '#17161d', lueur: '#ff8fd0' },
  singularite: { m: ['#050308', '#ff9a3c', '#1a0c08', '#fff3d6', '#050308'], bord: '#ff7a1f', lueur: '#ffb86b' },
}

/** Le métal d'une bordure : celui de la finition ; en Mat, celui de la ligue — l'or pour les maîtres. */
function metalDe(ligue: CleDeLigue, finition: Finition): Metal {
  if (finition !== 'mat') return METAUX[finition]
  return METAUX[ligue === 'maitre' ? 'or' : ligue]
}

function melange(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16))
  const x = p(a)
  const y = p(b)
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

// ── Le cadre ──────────────────────────────────────────────────────────────

/** Ce que dessine une bordure, calque par calque. */
interface Calques {
  bandePleine: string[]
  ornements: string[]
  vide: string[]
  rayonsPleins: string[]
  rayonsVides: string[]
  graves: string[]
  clairs: string[]
  givre: string[]
  semis: string[]
  etoiles: string[]
  perles: string[]
  pierres: string[]
  coeurs: string[]
  facettes: string[]
  reflets: string[]
  feux: string[]
}

/** Le bandeau de chaque ligue, de son rayon intérieur à l'extérieur. */
const BANDEAUX: Record<CleDeLigue, readonly [number, number]> = {
  bronze: [64, 82],
  argent: [64, 79],
  or: [64, 80],
  platine: [64, 78],
  diamant: [64, 79],
  maitre: [63, 81],
}

/** Une perle, un rivet : un dôme éclairé d'en haut à gauche, quel que soit son angle. */
function perle(L: Calques, r: number, a: number, R: number, sertie: boolean) {
  const [x, y] = xy(r, a)
  if (!sertie) return void L.vide.push(rond(x, y, R))
  L.perles.push(rond(x, y, R))
  L.reflets.push(rond(x - 0.32 * R, y - 0.34 * R, 0.34 * R))
}

/** Un cabochon de rubis, son cœur plus clair, son reflet, et le feu de la finition. */
function cabochon(L: Calques, r: number, a: number, R: number, allume: boolean) {
  const [x, y] = xy(r, a)
  if (!allume) return void L.vide.push(rond(x, y, R))
  L.pierres.push(rond(x, y, R))
  L.coeurs.push(rond(x + 0.1 * R, y + 0.14 * R, 0.68 * R))
  L.reflets.push(rond(x - 0.34 * R, y - 0.36 * R, 0.28 * R))
  L.feux.push(rond(x + 0.36 * R, y + 0.4 * R, 0.16 * R))
}

/** Un brillant taillé : sa table, ses arêtes, une étincelle, un feu. */
function brillant(L: Calques, r: number, a: number, R: number, sertie: boolean) {
  const [x, y] = xy(r, a)
  const octogone = (q: number) => {
    let d = ''
    for (let i = 0; i < 8; i++) {
      const t = ((22.5 + i * 45) * Math.PI) / 180
      d += `${i ? 'L' : 'M'}${f(x + q * Math.sin(t))} ${f(y - q * Math.cos(t))}`
    }
    return d + 'Z'
  }
  if (!sertie) return void L.vide.push(octogone(R))
  L.pierres.push(octogone(R))
  L.coeurs.push(octogone(R * 0.48))
  let aretes = ''
  for (let i = 0; i < 8; i++) {
    const t = ((22.5 + i * 45) * Math.PI) / 180
    aretes += `M${f(x + R * 0.48 * Math.sin(t))} ${f(y - R * 0.48 * Math.cos(t))}L${f(x + R * Math.sin(t))} ${f(y - R * Math.cos(t))}`
  }
  L.facettes.push(aretes)
  L.reflets.push(etoile(x - 0.36 * R, y - 0.4 * R, 0.62 * R, 0.14 * R, 4, 0))
  L.feux.push(rond(x + 0.3 * R, y + 0.32 * R, 0.17 * R))
}

/** Un nombre répétable : la même bordure sème toujours les mêmes cristaux, chez tout le monde. */
const tirage = (k: number, j: number, a: number, b: number, n: number) => (k * a + j * b) % n

/** Les douze crans d'une ligue, dessinés : `crans` sertis, les autres à gagner. */
function dessiner(ligue: CleDeLigue, crans: number, etoilee: boolean): Calques {
  const L: Calques = {
    bandePleine: [], ornements: [], vide: [], rayonsPleins: [], rayonsVides: [], graves: [], clairs: [], givre: [], semis: [], etoiles: [], perles: [], pierres: [], coeurs: [], facettes: [], reflets: [], feux: [],
  }
  const [r1, r2] = BANDEAUX[ligue]
  // L'écart entre deux crans : c'est lui qui fait la bordure crantée.
  const ecart = 2.4
  for (let k = 0; k < CRANS_D_UNE_BORDURE; k++) {
    const sertie = k < crans
    const a0 = k * 30 + ecart / 2
    const a1 = (k + 1) * 30 - ecart / 2
    const c = k * 30 + 15
    const orne = (d: string) => (sertie ? L.ornements : L.vide).push(d)
    ;(sertie ? L.bandePleine : L.vide).push(secteur(r1, r2, a0, a1))
    if (ligue === 'bronze') {
      // Le Moletage : quatre dents par cran, un rivet, des stries sur le bandeau.
      for (let j = 0; j < 4; j++) {
        const cj = a0 + ((j + 0.5) * (a1 - a0)) / 4
        orne(`M${pt(81.4, cj - 2.4)}L${pt(89.6, cj - 1.5)}L${pt(89.6, cj + 1.5)}L${pt(81.4, cj + 2.4)}Z`)
      }
      if (sertie) {
        L.graves.push(secteur(71.3, 72, a0 + 0.8, a1 - 0.8))
        for (let j = 0; j < 7; j++) {
          const cj = a0 + ((j + 0.5) * (a1 - a0)) / 7
          L.graves.push(`M${pt(73.6, cj - 1.3)}L${pt(81, cj + 0.4)}L${pt(81, cj + 1.3)}L${pt(73.6, cj - 0.4)}Z`)
        }
      }
      perle(L, 67.8, c, 2.4, sertie)
    } else if (ligue === 'argent') {
      // Le Perlé : trois perles par cran, et un cran fin entre deux.
      if (sertie) {
        for (let j = 0; j < 6; j++) {
          const cj = a0 + ((j + 0.5) * (a1 - a0)) / 6
          L.graves.push(`M${pt(66.4, cj - 0.35)}L${pt(76.6, cj - 0.35)}L${pt(76.6, cj + 0.35)}L${pt(66.4, cj + 0.35)}Z`)
        }
      }
      for (const da of [-10, 0, 10]) perle(L, 84.4, c + da, 4.3, sertie)
      for (const da of [-5, 5]) orne(poser(FORMES.losange, 84.4, c + da))
    } else if (ligue === 'or') {
      // Les Fleurons : une fleur de lys par cran ; les rubis viennent après.
      if (sertie) L.graves.push(secteur(71.6, 72.4, a0 + 1, a1 - 1))
      for (const forme of FORMES.lys) orne(poser(forme, 79, c))
    } else if (ligue === 'platine') {
      // Le Givre : une grande aiguille et ses branches, deux petites, et des cristaux sur le bandeau.
      if (sertie) {
        L.givre.push(secteur(r1, r2, a0, a1))
        for (let j = 0; j < 6; j++) {
          const [x, y] = xy(66.4 + tirage(k, j, 7, 5, 10), a0 + 1.6 + tirage(k, j, 11, 7, 24))
          L.semis.push(etoile(x, y, 1.5, 0.45, 4, (k + j) * 20))
        }
      }
      orne(poser(FORMES.aiguille, 77, c))
      for (const b of FORMES.branches) orne(poser(b, 77, c))
      orne(poser(FORMES.courte, 77, c - 9))
      orne(poser(FORMES.courte, 77, c + 9))
    } else if (ligue === 'diamant') {
      // La Couronne de brillants : un bandeau taillé en facettes, trois brillants par cran.
      if (sertie) {
        for (let j = 0; j < 4; j++) {
          const b0 = a0 + (j * (a1 - a0)) / 4
          const b1 = a0 + ((j + 1) * (a1 - a0)) / 4
          const m = (b0 + b1) / 2
          L.graves.push(`M${pt(64, b0)}L${pt(64, b1)}L${pt(71.5, m)}Z`, `M${pt(79, b0)}L${pt(79, b1)}L${pt(71.5, m)}Z`)
          L.clairs.push(`M${pt(64, b0)}L${pt(79, b0)}L${pt(71.5, m)}Z`)
        }
      }
      for (const da of [-10, 0, 10]) brillant(L, 86, c + da, 5, sertie)
    } else {
      // Le Soleil noir : un bandeau d'émail entre deux filets, une étoile par cran, des rayons.
      orne(secteur(63, 64.9, a0, a1))
      orne(secteur(79.1, 81, a0, a1))
      const [x, y] = xy(72, c)
      orne(etoile(x, y, 3.8, 1.4, 8, c))
      ;(sertie ? L.rayonsPleins : L.rayonsVides).push(poser(FORMES.rayon, 80, c), poser(FORMES.rayonCourt, 80, c - 10), poser(FORMES.rayonCourt, 80, c + 10))
      if (sertie) {
        for (let j = 0; j < 4; j++) {
          const [px, py] = xy(66.6 + tirage(k, j, 5, 3, 10), a0 + 2.5 + tirage(k, j, 7, 6, 23))
          L.etoiles.push(rond(px, py, 0.5))
        }
      }
    }
    // Constellation sème ses étoiles sur le métal de toutes les ligues.
    if (sertie && etoilee && ligue !== 'maitre') {
      const large = Math.max(1, r2 - r1 - 5)
      for (let j = 0; j < 2; j++) {
        const [x, y] = xy(r1 + 2.5 + tirage(k, j, 3, 5, large), a0 + 4 + tirage(k, j, 9, 11, 20))
        L.etoiles.push(etoile(x, y, 1.3, 0.4, 4, 0))
      }
    }
  }
  // Les quatre rubis des Fleurons s'allument un à un, tous les trois crans ; celui de midi sertit la bordure.
  if (ligue === 'or') for (const [a, n] of [[90, 3], [180, 6], [270, 9], [0, 12]] as const) cabochon(L, 72, a, 5.2, crans >= n)
  return L
}

/** Ce que creusent les stries, les gravures et les facettes sombres de chaque bandeau. */
const GRAVES: Partial<Record<CleDeLigue, number>> = { bronze: 0.42, argent: 0.3, or: 0.45, diamant: 0.32 }

/** Un calque, s'il a quelque chose à dessiner. */
const chemin = (d: readonly string[], attributs: string) => (d.length > 0 ? `<path d="${d.join('')}" ${attributs}/>` : '')

const image = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`

/** Le dégradé d'un métal, en diagonale. */
const degrade = (id: string, m: readonly string[]) =>
  `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="24" y1="16" x2="176" y2="184">${m
    .map((c, i) => `<stop offset="${[0, 0.27, 0.5, 0.73, 1][i]}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`

/**
 * Le cadre d'une bordure, en SVG : son bandeau et ses ornements, ses pierres,
 * ses crans à gagner en pointillé, la sertissure contre l'avatar — et, sertie,
 * sa lueur. Rien au milieu : l'emoji garde son halo, le médaillon son cercle.
 */
export function svgDuCadre(ligue: CleDeLigue, crans: number, finition: Finition): string {
  const met = metalDe(ligue, finition)
  const L = dessiner(ligue, Math.max(0, Math.min(CRANS_D_UNE_BORDURE, Math.round(crans))), !!met.etoiles)
  const feu = met.m.map(c => melange(c, '#ffffff', 0.42))
  // Le bandeau des maîtres est d'émail : de nuit sous Constellation, noir sinon.
  const email = met.etoiles ? ['#26326f', '#151b48', '#090c24'] : ['#2c2438', '#15111b', '#07060a']
  // Un cran à gagner : un pointillé du métal, assez sombre pour se voir sur l'Ivoire comme sur le Velours.
  const fantome = met.etoiles ? met.bord : met.m[2]
  const pierre = ligue === 'or' ? '#8f1028' : 'url(#f)'
  const coeur = ligue === 'or' ? '#d1324d' : 'rgba(255,255,255,0.5)'
  const grave = GRAVES[ligue] ?? 0
  const sertie = crans >= CRANS_D_UNE_BORDURE
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">` +
    `<defs>${degrade('m', met.m)}${degrade('f', feu)}` +
    `<radialGradient id="e" gradientUnits="userSpaceOnUse" cx="100" cy="100" r="84"><stop offset=".74" stop-color="${email[0]}"/><stop offset=".86" stop-color="${email[1]}"/><stop offset=".97" stop-color="${email[2]}"/></radialGradient>` +
    `<filter id="b" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="5"/></filter>` +
    `<filter id="o" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>` +
    // L'ombre portée du bandeau seul : un disque assombrirait l'avatar.
    `<circle cx="100" cy="103" r="78" fill="none" stroke="#000" stroke-width="24" opacity=".32" filter="url(#o)"/>` +
    (sertie ? `<circle cx="100" cy="100" r="88" fill="none" stroke="${met.lueur}" stroke-width="9" opacity=".5" filter="url(#b)"/>` : '') +
    chemin(L.bandePleine, `fill="${ligue === 'maitre' ? 'url(#e)' : 'url(#m)'}" stroke="${met.bord}" stroke-width=".6"`) +
    chemin(L.givre, 'fill="#fff" opacity=".3"') +
    chemin(L.graves, `fill="#000" opacity="${grave}"`) +
    chemin(L.clairs, 'fill="#fff" opacity=".32"') +
    chemin(L.semis, 'fill="#fff" opacity=".9"') +
    chemin(L.etoiles, 'fill="#ffe7a3" opacity=".92"') +
    chemin(L.ornements, `fill="url(#m)" stroke="${met.bord}" stroke-width=".55"`) +
    chemin(L.perles, `fill="${ligue === 'argent' ? 'url(#f)' : 'url(#m)'}" stroke="${met.bord}" stroke-width=".45"`) +
    chemin(L.pierres, `fill="${pierre}" stroke="${met.bord}" stroke-width=".5"`) +
    chemin(L.coeurs, `fill="${coeur}"`) +
    chemin(L.facettes, `fill="none" stroke="${met.bord}" stroke-width=".35" opacity=".7"`) +
    chemin(L.reflets, 'fill="#fff" opacity=".85"') +
    chemin(L.feux, `fill="${met.lueur}" opacity=".95"`) +
    chemin(L.vide, `fill="rgba(255,255,255,0.05)" stroke="${fantome}" stroke-opacity=".7" stroke-width=".6" stroke-dasharray="1.3 1.1"`) +
    // La sertissure, contre l'avatar : un filet de métal, et son ombre.
    `<circle cx="100" cy="100" r="61.3" fill="none" stroke="url(#m)" stroke-width="3.4"/>` +
    `<circle cx="100" cy="100" r="63" fill="none" stroke="${met.bord}" stroke-width=".5" opacity=".8"/>` +
    `</svg>`
  )
}

/**
 * Les rayons du Soleil noir, à part : ils tournent lentement, et dépassent un
 * peu du cercle. Rien pour les autres ligues.
 */
export function svgDesRayons(ligue: CleDeLigue, crans: number, finition: Finition): string | null {
  if (ligue !== 'maitre') return null
  const met = metalDe(ligue, finition)
  const L = dessiner(ligue, Math.max(0, Math.min(CRANS_D_UNE_BORDURE, Math.round(crans))), !!met.etoiles)
  const fantome = met.etoiles ? met.bord : met.m[2]
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>${degrade('m', met.m)}</defs>` +
    chemin(L.rayonsPleins, `fill="url(#m)" stroke="${met.bord}" stroke-width=".5"`) +
    chemin(L.rayonsVides, `fill="rgba(255,255,255,0.05)" stroke="${fantome}" stroke-opacity=".7" stroke-width=".6" stroke-dasharray="1.3 1.1"`) +
    `</svg>`
  )
}

/** Ce qu'une bordure montre : son cadre, et ses rayons s'il en a. */
export interface DessinDeBordure {
  cadre: string
  rayons: string | null
}

const FAITS = new Map<string, DessinDeBordure>()

/**
 * Une bordure en images, faites une fois par alliage et par nombre de crans,
 * pour toute la page.
 */
export function dessinDeBordure(ligue: CleDeLigue, crans: number, finition: Finition): DessinDeBordure {
  const cle = `${ligue}:${crans}:${finition}`
  let fait = FAITS.get(cle)
  if (!fait) {
    const rayons = svgDesRayons(ligue, crans, finition)
    fait = { cadre: image(svgDuCadre(ligue, crans, finition)), rayons: rayons ? image(rayons) : null }
    FAITS.set(cle, fait)
  }
  return fait
}
