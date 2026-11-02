import type { ReactNode } from 'react'
import { inscrireDessin, type FinitionLumineuse } from './medaillons'

// La lumière des finitions lumineuses — Prisme (15), Aurore (20),
// Constellation (25), puis Abysses (30), Orage (35), Envol (40), Disco (45)
// et Singularité (50) —, autour d'un emoji comme d'un médaillon.
//
// Les halos d'avant tenaient dans 1,45 em : Prisme n'était qu'Holo avec une
// étoile, Aurore un disque flou, et personne ne voyait qu'on avait monté de
// cinq niveaux. Ceux-ci débordent — jusqu'à 2,8 em — et se reconnaissent du
// fond de la salle : le Diamant sertit l'avatar dans une bague de cristal,
// les Voiles lèvent une aurore derrière sa tête, l'Astrolabe l'entoure d'or
// et fait passer une étoile derrière lui, puis devant.
//
// Les cinq du 1er novembre 2026 — choisies par le propriétaire sur une
// planche de douze (`retours/2026-11-01/finitions-de-prestige/`) — changent
// chacune de matière : les grands fonds, l'orage, les ailes, la piste de
// danse, le trou noir. Rien de commun avec celles d'avant, pour que la salle
// voie d'un coup qu'on a encore monté.
//
// Chaque calque est un élément à part, qui ne bouge que par `rotate`,
// `scale`, `translate` et `opacity` : le navigateur les compose sans
// redessiner la page, comme les Divins. Les dessins sont des images, faites
// une fois à l'évaluation du fichier : les quarante avatars d'une salle
// d'attente partagent la même, décodée une fois, sans cent nœuds SVG chacun
// à comparer — ni un identifiant de dégradé qu'un autre avatar, caché,
// garderait pour lui. Ce qui se dessine en CSS (les lueurs, les anneaux du
// spectre, l'orbite) reste dans `styles.css`, avec les mouvements.
//
// Chargé à la demande (`medaillons.ts`) : une salle sans niveau 15 ne le
// télécharge jamais. En l'attendant, l'avatar garde son halo d'avant.

/** Un nombre court, pour que les dessins restent légers. */
const f = (n: number) => String(Math.round(n * 100) / 100)

/** Un point à `r` du centre, à `deg` degrés du haut, dans le sens des aiguilles d'une montre. */
function pt(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [r * Math.sin(a), -r * Math.cos(a)]
}
const xy = (p: [number, number]) => `${f(p[0])},${f(p[1])}`

/** Un hasard répétable : la même finition dessine toujours les mêmes étoiles, chez tout le monde. */
function hasard(graine: number): () => number {
  return () => {
    graine = (graine * 16807) % 2147483647
    return (graine - 1) / 2147483646
  }
}

/** Un dessin centré sur (0, 0), tenu dans ±100 : une image, rien ne dépasse. */
const image = (dessin: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">${dessin}</svg>`)}`

// ── Le Diamant ────────────────────────────────────────────────────────────

/**
 * Une bague de diamant taillé : une couronne de triangles de glace, plus
 * clairs en haut à gauche, où tombe la lumière. Ils sont à moitié
 * transparents : les feux du spectre, qui tournent dessous (`.lu-feux`),
 * passent à travers.
 */
function cristal(n = 16, rIn = 62, rOut = 86): string {
  const pas = 360 / n
  const clarte = (a: number) => 0.5 + 0.5 * Math.cos(((a + 45) * Math.PI) / 180)
  let facettes = ''
  let arretes = ''
  for (let i = 0; i < n; i++) {
    const a0 = i * pas
    const am = a0 + pas / 2
    const o0 = pt(rOut, a0)
    const o1 = pt(rOut, a0 + pas)
    const m = pt(rIn, am)
    const avant = pt(rIn, am - pas)
    facettes +=
      `<path d="M${xy(o0)}L${xy(o1)}L${xy(m)}Z" fill="hsl(215,60%,${f(70 + 26 * clarte(am))}%)" fill-opacity="${f(0.35 + 0.45 * clarte(am))}"/>` +
      `<path d="M${xy(avant)}L${xy(o0)}L${xy(m)}Z" fill="hsl(250,45%,${f(56 + 30 * clarte(a0 + 160))}%)" fill-opacity="${f(0.25 + 0.4 * clarte(a0 + 160))}"/>`
    arretes += `M${xy(o0)}L${xy(m)}L${xy(o1)}`
  }
  const polygone = (r: number, decal: number) => Array.from({ length: n }, (_, i) => xy(pt(r, i * pas + decal))).join(' ')
  return (
    facettes +
    `<path d="${arretes}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-linejoin="round"/>` +
    `<polygon points="${polygone(rOut, 0)}" fill="none" stroke="#fff" stroke-width="1.8"/>` +
    `<polygon points="${polygone(rIn, pas / 2)}" fill="none" stroke="#fff" stroke-width="1.1" stroke-opacity=".9"/>`
  )
}

/**
 * Les éclats qu'un prisme jette au mur : de petits arcs-en-ciel, couchés
 * vers l'extérieur. Un seul dégradé pour tous : chaque trait le prend de
 * son pied à sa pointe.
 */
function spectres(graine: number, decal = 0, n = 6, r = 76, long = 20): string {
  const x = hasard(graine)
  let traits = ''
  for (let i = 0; i < n; i++) {
    const a = decal + (i * 360) / n + x() * 22
    traits += `<rect x="-2.3" y="${f(-(r - x() * 14) - long)}" width="4.6" height="${long}" rx="2.3" fill="url(#s)" transform="rotate(${f(a)})"/>`
  }
  return (
    `<defs><linearGradient id="s" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5c8a" stop-opacity="0"/><stop offset=".2" stop-color="#ff5c8a"/>` +
    `<stop offset=".4" stop-color="#ffd84d"/><stop offset=".6" stop-color="#5dff9e"/><stop offset=".8" stop-color="#58b8ff"/><stop offset="1" stop-color="#a070ff" stop-opacity="0"/></linearGradient></defs>` +
    traits
  )
}

// ── Les Voiles ────────────────────────────────────────────────────────────

/**
 * Un voile d'aurore : des fils verticaux posés sur une lisière qui ondule,
 * plus hauts au milieu — une arche derrière la tête. Chacun prend le même
 * dégradé de son pied à son sommet : vert à la lisière, puis cyan, violet,
 * rose, et plus rien.
 */
function voile(graine: number, teintes: readonly [string, string, string, string], largeur: number, n = 34): string {
  const x = hasard(graine)
  let fils = ''
  for (let i = 0; i < n; i++) {
    const cx = -96 + (192 * (i + 0.5)) / n + (x() - 0.5) * 3
    const pied = 58 + 14 * Math.sin(cx / 26 + 0.8) + 6 * Math.sin(cx / 11)
    const hauteur = (45 + 85 * (0.55 + 0.45 * x())) * Math.cos((cx / 100) * 1.1)
    const w = largeur * (0.6 + x() * 0.8)
    fils += `<rect x="${f(cx - w / 2)}" y="${f(pied - hauteur)}" width="${f(w)}" height="${f(hauteur)}"/>`
  }
  const [lisiere, milieu, haut, sommet] = teintes
  return (
    `<defs><linearGradient id="v" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${lisiere}" stop-opacity="0"/>` +
    `<stop offset=".08" stop-color="${lisiere}" stop-opacity=".95"/><stop offset=".38" stop-color="${milieu}" stop-opacity=".75"/>` +
    `<stop offset=".72" stop-color="${haut}" stop-opacity=".5"/><stop offset="1" stop-color="${sommet}" stop-opacity="0"/></linearGradient>` +
    `<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>` +
    `<g fill="url(#v)" filter="url(#b)">${fils}</g>`
  )
}

// ── L'Astrolabe ───────────────────────────────────────────────────────────

/** Une poussière d'étoiles, entre deux rayons. */
function poussiere(graine: number, n = 34, rMin = 60, rMax = 96): string {
  const x = hasard(graine)
  let etoiles = ''
  for (let i = 0; i < n; i++) {
    const [px, py] = pt(rMin + (rMax - rMin) * Math.sqrt(x()), x() * 360)
    etoiles += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(0.6 + x() * 1.6)}" fill-opacity="${f(0.35 + x() * 0.65)}"/>`
  }
  return `<g fill="#fff6dc">${etoiles}</g>`
}

const DEGRADE_OR = `<linearGradient id="o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".5" stop-color="#e2bd6b"/><stop offset="1" stop-color="#9a7026"/></linearGradient>`

/**
 * Le limbe gradué d'un astrolabe : deux filets d'or, un trait tous les cinq
 * degrés, un plus long tous les trente — des pointillés d'un cercle, pas
 * soixante-douze traits —, et un point d'or entre deux grands traits.
 */
function astrolabe(): string {
  // Chaque trait centré sur son angle : le motif commence à mi-trait.
  const traits = (r: number, n: number, largeur: number, epaisseur: number, opacite: number) => {
    const pas = (2 * Math.PI * r) / n
    return `<circle r="${r}" stroke="#f3d68f" stroke-width="${epaisseur}" stroke-opacity="${opacite}" stroke-dasharray="${f(largeur)} ${f(pas - largeur)}" stroke-dashoffset="${f(largeur / 2)}"/>`
  }
  let points = ''
  for (let i = 0; i < 12; i++) {
    const [x, y] = pt(90.5, i * 30 + 15)
    points += `<circle cx="${f(x)}" cy="${f(y)}" r="1.5"/>`
  }
  return (
    `<defs>${DEGRADE_OR}</defs><g fill="none">` +
    `<circle r="95" stroke="url(#o)" stroke-width="2.2"/><circle r="86" stroke="url(#o)" stroke-opacity=".7"/>` +
    traits(92.5, 72, 0.9, 5, 0.75) +
    traits(90.5, 12, 1.8, 9, 1) +
    `</g><g fill="#fff4cf">${points}</g>`
  )
}

/** L'anneau serti, qui tourne à contresens : un filet d'or et quatre gemmes bleues. */
function gemmes(r = 72): string {
  let serti = ''
  for (let i = 0; i < 4; i++) {
    const [x, y] = pt(r, i * 90 + 45)
    serti += `<g transform="translate(${f(x)} ${f(y)}) rotate(${i * 90 + 45})"><path d="M0,-9L6,0L0,9L-6,0Z" fill="url(#o)"/><path d="M0,-5L3,0L0,5L-3,0Z" fill="#7fb4ff"/></g>`
  }
  return `<defs>${DEGRADE_OR}</defs><circle r="${r}" fill="none" stroke="url(#o)" stroke-width="2"/><circle r="${r - 5}" fill="none" stroke="#f3d68f" stroke-opacity=".45" stroke-width=".8"/>${serti}`
}

/** L'étincelle à quatre branches, creusée. Son halo est un fond CSS de l'élément. */
const etincelle = (couleur: string) =>
  image(`<path d="M0,-96Q10,-10 96,0Q10,10 0,96Q-10,10 -96,0Q-10,-10 0,-96Z" fill="${couleur}"/>`)

// ── Les Méduses (Abysses) ─────────────────────────────────────────────────

/**
 * Une méduse : sa cloche festonnée, deux bras qui ondulent, six tentacules
 * fins, et sa lumière posée sur la nuit de l'eau — un halo flou de son bord.
 */
function meduse(cloche: readonly [string, string], bord: string): string {
  let festons = ''
  for (let i = 0; i < 7; i++) {
    const xa = 46 - (92 * i) / 7
    const xb = 46 - (92 * (i + 1)) / 7
    festons += `Q${f((xa + xb) / 2)},10 ${f(xb)},0`
  }
  const corps = `M-46,0C-46,-62 46,-62 46,0${festons}Z`
  let tentacules = ''
  for (let k = 0; k < 6; k++) {
    const x0 = -30 + k * 12
    tentacules += `<path d="M${x0},4C${x0 - 8},30 ${x0 + 8},50 ${x0 - 4},74C${x0 - 10},86 ${x0 + 4},92 ${x0},98"/>`
  }
  const bras = [-9, 9].map(x0 => `<path d="M${x0},2C${x0 + 10},22 ${x0 - 10},38 ${x0 + 6},58"/>`).join('')
  return (
    `<defs><radialGradient id="c" gradientUnits="userSpaceOnUse" cx="0" cy="-40" r="70"><stop offset="0" stop-color="${cloche[0]}" stop-opacity=".95"/>` +
    `<stop offset=".6" stop-color="${cloche[1]}" stop-opacity=".7"/><stop offset="1" stop-color="${cloche[1]}" stop-opacity=".25"/></radialGradient>` +
    `<filter id="h" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter></defs>` +
    `<path d="${corps}" fill="${bord}" opacity=".55" filter="url(#h)"/>` +
    `<g fill="none" stroke="${bord}" stroke-linecap="round"><g stroke-width="1.8" stroke-opacity=".75">${tentacules}</g><g stroke-width="5" stroke-opacity=".55">${bras}</g></g>` +
    `<path d="${corps}" fill="url(#c)" stroke="${bord}" stroke-width="2.2"/>` +
    `<path d="M-30,-20C-22,-40 22,-40 30,-20" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>`
  )
}

/** Le plancton qui luit en cercle : un halo de couleur flou, un cœur presque blanc. */
function plancton(graine: number, n: number, couleurs: readonly string[]): string {
  const x = hasard(graine)
  let halos = ''
  let coeurs = ''
  for (let i = 0; i < n; i++) {
    const [px, py] = pt(60 + x() * 36, x() * 360)
    const r = 1 + x() * 1.6
    halos += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(r * 2.6)}" fill="${couleurs[Math.floor(x() * couleurs.length)]}"/>`
    coeurs += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(r * 0.7)}" fill="#f2feff"/>`
  }
  return (
    `<defs><filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>` +
    `<g filter="url(#b)" opacity=".85">${halos}</g>${coeurs}`
  )
}

/** La lumière de la surface, qui descend en faisceaux depuis le haut. */
function faisceaux(): string {
  let s = ''
  for (const [a, l] of [[-30, 14], [-14, 9], [0, 16], [16, 10], [32, 12]]) {
    const r = (a * Math.PI) / 180
    const bx = Math.sin(r) * 190
    const by = -100 + Math.cos(r) * 190
    const nx = Math.cos(r)
    const ny = -Math.sin(r)
    s += `<path d="M${f(-3 * nx)},${f(-100 - 3 * ny)}L${f(3 * nx)},${f(-100 + 3 * ny)}L${f(bx + l * nx)},${f(by + l * ny)}L${f(bx - l * nx)},${f(by - l * ny)}Z"/>`
  }
  return (
    `<defs><linearGradient id="r" gradientUnits="userSpaceOnUse" x1="0" y1="-100" x2="0" y2="90"><stop offset="0" stop-color="#d8fbff" stop-opacity=".75"/>` +
    `<stop offset=".6" stop-color="#9eefff" stop-opacity=".22"/><stop offset="1" stop-color="#9eefff" stop-opacity="0"/></linearGradient>` +
    `<filter id="b" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3"/></filter></defs><g fill="url(#r)" filter="url(#b)">${s}</g>`
  )
}

// ── La Foudre (Orage) ─────────────────────────────────────────────────────

/** Un cercle brisé, en trois épaisseurs de lumière : la lueur, le fil, le cœur blanc. */
function anneauElectrique(graine: number, r = 70, n = 52, amplitude = 6): string {
  const x = hasard(graine)
  const p = Array.from({ length: n }, (_, i) => xy(pt(r + (x() - 0.5) * 2 * amplitude, (i * 360) / n))).join(' ')
  return (
    `<polygon points="${p}" fill="none" stroke="#5fb4ff" stroke-width="10" stroke-opacity=".2" stroke-linejoin="round"/>` +
    `<polygon points="${p}" fill="none" stroke="#bfe6ff" stroke-width="3.4" stroke-opacity=".7" stroke-linejoin="round"/>` +
    `<polygon points="${p}" fill="none" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round"/>`
  )
}

/**
 * Un éclair qui part de l'anneau vers l'extérieur : des segments de
 * longueurs inégales, des coudes francs, une branche, un trait qui s'amincit
 * vers la pointe. Un zigzag régulier se lisait comme un ressort.
 */
function eclair(graine: number, angle: number): string {
  const x = hasard(graine)
  const [qx, qy] = pt(1, angle + 90)
  const point = (rr: number, ecart: number): [number, number] => {
    const [bx, by] = pt(rr, angle)
    return [bx + qx * ecart, by + qy * ecart]
  }
  const ecarts = [0, 6, -3, 7, -6, 4, 10]
  const pts = [52, 61, 65, 76, 81, 92, 99].map((r, i) => point(r + (x() - 0.5) * 3, ecarts[i] * (0.7 + x() * 0.6)))
  const branche = [pts[3], point(85, ecarts[3] - 11 - x() * 4), point(94, ecarts[3] - 8 - x() * 3)]
  const ligne = (ps: readonly [number, number][]) => ps.map(xy).join(' ')
  return (
    `<g fill="none" stroke-linejoin="miter" stroke-linecap="round">` +
    `<polyline points="${ligne(pts)}" stroke="#6cc0ff" stroke-width="9" stroke-opacity=".26"/>` +
    `<polyline points="${ligne(pts.slice(0, 4))}" stroke="#fff" stroke-width="3"/>` +
    `<polyline points="${ligne(pts.slice(3))}" stroke="#fff" stroke-width="1.8"/>` +
    `<polyline points="${ligne(branche)}" stroke="#d8f0ff" stroke-width="1.3" stroke-opacity=".9"/></g>`
  )
}

// ── Les Ailes (Envol) ─────────────────────────────────────────────────────

/**
 * Une aile levée. Son bras part de l'épaule, s'arrondit vers l'extérieur et
 * monte jusqu'au poignet ; les rémiges y sont attachées, pendantes près de
 * l'épaule, dressées au bout ; les couvertures, plus courtes, par-dessus.
 * Toutes en éventail depuis un seul point, elles faisaient un soleil, pas une
 * aile. L'autre est son miroir. Le filet d'or se voit aussi sur la crème.
 */
function aile(cote: 1 | -1): string {
  const S: [number, number] = [16, 4]
  const C: [number, number] = [60, -6]
  const W: [number, number] = [54, -50]
  const bras = (t: number): [number, number] => [
    (1 - t) ** 2 * S[0] + 2 * (1 - t) * t * C[0] + t * t * W[0],
    (1 - t) ** 2 * S[1] + 2 * (1 - t) * t * C[1] + t * t * W[1],
  ]
  const plume = (R: [number, number], angle: number, L: number, w: number) => {
    const a = (angle * Math.PI) / 180
    const pointe: [number, number] = [R[0] + L * Math.sin(a), R[1] - L * Math.cos(a)]
    const [nx, ny] = [Math.cos(a), Math.sin(a)]
    const m = (s: number): [number, number] => [R[0] + (pointe[0] - R[0]) * 0.55 + nx * w * s, R[1] + (pointe[1] - R[1]) * 0.55 + ny * w * s]
    return `<path d="M${xy(R)}Q${xy(m(1))} ${xy(pointe)}Q${xy(m(-1))} ${xy(R)}Z"/>`
  }
  let remiges = ''
  let couvertures = ''
  for (let i = 0; i < 11; i++) remiges += plume(bras(i / 10), 168 - (i / 10) * 130, 26 + (i / 10) * 24, 6.4)
  for (let i = 0; i < 8; i++) {
    const t = (i / 7) * 0.9
    couvertures += plume(bras(t), 150 - t * 110, 16 + t * 10, 5.6)
  }
  return (
    `<defs><radialGradient id="p" gradientUnits="userSpaceOnUse" cx="${S[0]}" cy="${S[1]}" r="120"><stop offset=".08" stop-color="#fff"/>` +
    `<stop offset=".4" stop-color="#fff3cf" stop-opacity=".96"/><stop offset=".78" stop-color="#f1cf7a" stop-opacity=".7"/><stop offset="1" stop-color="#e2b04a" stop-opacity="0"/></radialGradient></defs>` +
    `<g${cote < 0 ? ' transform="scale(-1 1)"' : ''}>` +
    `<g fill="url(#p)" stroke="#c4953f" stroke-opacity=".75" stroke-width=".8">${remiges}</g>` +
    `<g fill="url(#p)" stroke="#fff6dc" stroke-opacity=".8" stroke-width=".6">${couvertures}</g>` +
    `<path d="M${xy(S)}Q${xy(C)} ${xy(W)}" fill="none" stroke="#fffaf0" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/></g>`
  )
}

/** L'auréole, une ellipse d'or qui flotte au-dessus de la tête. */
function aureole(): string {
  return (
    `<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c99a3c"/><stop offset=".5" stop-color="#fff4cf"/><stop offset="1" stop-color="#c99a3c"/></linearGradient></defs>` +
    `<ellipse rx="78" ry="22" fill="none" stroke="#ffe9a8" stroke-width="18" stroke-opacity=".22"/>` +
    `<ellipse rx="78" ry="22" fill="none" stroke="url(#a)" stroke-width="8"/>`
  )
}

// ── La Boule à facettes (Disco) ───────────────────────────────────────────

/**
 * Une sphère de miroirs : ses rangées serrées vers les pôles et vers le bord,
 * chaque facette éclairée d'en haut à gauche ; quelques-unes renvoient le
 * blanc du projecteur, d'autres les couleurs de la piste.
 */
function bouleAFacettes(): string {
  const R = 96
  const x = hasard(53)
  const lumiere = [-0.5, -0.62, 0.6]
  const teintes = ['#ff6fbf', '#5fe6ff', '#ffe27a', '#b994ff']
  const rad = (deg: number) => (deg * Math.PI) / 180
  let tuiles = ''
  const bandes = 14
  for (let b = 0; b < bandes; b++) {
    const la0 = -90 + (180 * b) / bandes
    const la1 = -90 + (180 * (b + 1)) / bandes
    const y0 = R * Math.sin(rad(la0))
    const y1 = R * Math.sin(rad(la1))
    const demi = R * Math.cos(rad((la0 + la1) / 2))
    const n = Math.max(3, Math.round((Math.PI * demi) / 13))
    for (let i = 0; i < n; i++) {
      const xa = demi * Math.sin(rad(-90 + (180 * i) / n))
      const xb = demi * Math.sin(rad(-90 + (180 * (i + 1)) / n))
      const cx = (xa + xb) / 2 / R
      const cy = (y0 + y1) / 2 / R
      const cz = Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy))
      const eclaire = Math.max(0, cx * lumiere[0] + cy * lumiere[1] + cz * lumiere[2])
      const t = x()
      const couleur = t < 0.07 ? '#fff' : t < 0.17 ? teintes[Math.floor(x() * teintes.length)] : `hsl(228,10%,${f(Math.min(92, 16 + 64 * eclaire + (x() - 0.5) * 22))}%)`
      if (xb - xa > 2 && y1 - y0 > 2) tuiles += `<rect x="${f(xa + 0.9)}" y="${f(y0 + 0.9)}" width="${f(xb - xa - 1.8)}" height="${f(y1 - y0 - 1.8)}" fill="${couleur}"/>`
    }
  }
  return (
    `<defs><radialGradient id="r" gradientUnits="userSpaceOnUse" cx="-36" cy="-42" r="70"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="o" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="96"><stop offset=".68" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient></defs>` +
    `<circle r="96" fill="#17161d"/>${tuiles}<circle r="96" fill="url(#o)"/><circle r="96" fill="url(#r)"/>`
  )
}

/** Les reflets de la boule sur les murs : des taches de couleur, floues. */
function reflets(graine: number, n: number, couleurs: readonly string[]): string {
  const x = hasard(graine)
  let s = ''
  for (let i = 0; i < n; i++) {
    const [px, py] = pt(64 + x() * 32, (i * 360) / n + x() * 14)
    s += `<circle cx="${f(px)}" cy="${f(py)}" r="${f(2.2 + x() * 2.6)}" fill="${couleurs[i % couleurs.length]}" fill-opacity="${f(0.55 + x() * 0.45)}"/>`
  }
  return `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1"/></filter></defs><g filter="url(#b)">${s}</g>`
}

// ── Le Disque (Singularité) ───────────────────────────────────────────────

/** La part du disque que le trou noir courbe par-dessus la tête : un arc brûlant, flou puis net. */
function lentille(): string {
  const a0 = pt(70, -80)
  const a1 = pt(70, 80)
  const arc = `M${xy(a0)}A70,70 0 0 1 ${xy(a1)}`
  return (
    `<defs><linearGradient id="a" gradientUnits="userSpaceOnUse" x1="-70" y1="0" x2="70" y2="0"><stop offset="0" stop-color="#ff8a2a" stop-opacity="0"/>` +
    `<stop offset=".22" stop-color="#ffb54d"/><stop offset=".5" stop-color="#fff2cf"/><stop offset=".78" stop-color="#ffb54d"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></linearGradient>` +
    `<filter id="b" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="2.6"/></filter></defs>` +
    `<path d="${arc}" fill="none" stroke="url(#a)" stroke-width="15" stroke-opacity=".55" filter="url(#b)" stroke-linecap="round"/>` +
    `<path d="${arc}" fill="none" stroke="url(#a)" stroke-width="4.6" stroke-linecap="round"/>`
  )
}

// Faits une fois : chaque avatar ne reçoit que leur adresse.
const IMAGES = {
  cristal: image(cristal()),
  spectres1: image(spectres(3)),
  spectres2: image(spectres(8, 30)),
  voile1: image(voile(7, ['#46ffb4', '#3fd6ff', '#9b6dff', '#ff7ad9'], 7)),
  voile2: image(voile(21, ['#3fd6ff', '#8f6dff', '#ff7ad9', '#ffb0e6'], 9)),
  poussiere: image(poussiere(13)),
  astrolabe: image(astrolabe()),
  gemmes: image(gemmes()),
  blanche: etincelle('#ffffff'),
  doree: etincelle('#fff4d0'),
  meduseRose: image(meduse(['#ffd6f2', '#c56cff'], '#ff9ee6')),
  meduseCyan: image(meduse(['#d8fffb', '#33c4d6'], '#7ff6ff')),
  plancton1: image(plancton(37, 30, ['#39f0ff', '#2fd6b6', '#8f7bff'])),
  plancton2: image(plancton(59, 22, ['#7ff6ff', '#b88bff', '#3be8c0'])),
  faisceaux: image(faisceaux()),
  foudre1: image(anneauElectrique(31)),
  foudre2: image(anneauElectrique(47)),
  eclair1: image(eclair(3, 38)),
  eclair2: image(eclair(9, 148)),
  eclair3: image(eclair(15, 232)),
  eclair4: image(eclair(23, 312)),
  aileDroite: image(aile(1)),
  aileGauche: image(aile(-1)),
  aureole: image(aureole()),
  boule: image(bouleAFacettes()),
  reflets1: image(reflets(7, 22, ['#ff6fbf', '#5fe6ff', '#ffe27a', '#ffffff', '#b994ff'])),
  reflets2: image(reflets(19, 16, ['#5fe6ff', '#ffffff', '#ff6fbf', '#ffe27a'])),
  lentille: image(lentille()),
}

// ── Les calques ───────────────────────────────────────────────────────────

/**
 * Un calque : sa classe (qui le place, le dimensionne et le fait bouger) et
 * son image s'il en a une. `emoji` : il fait anneau autour d'un emoji, et
 * ne se pose pas autour d'un médaillon — le cercle du médaillon le remplace
 * (`Cercle.tsx`) : deux anneaux et un disque faisaient une cible. `anneau` :
 * il tombe là où passe une bordure de ligue (`Bordure.tsx`), qui le remplace
 * et prend sa matière — la bague de cristal, le limbe et l'anneau serti de
 * l'Astrolabe sous la bordure faisaient trois anneaux. L'atmosphère, elle,
 * reste : arcs-en-ciel, voiles, nébuleuse, étoile en orbite.
 */
interface Calque {
  classe: string
  src?: string
  emoji?: boolean
  anneau?: boolean
}

/**
 * L'orbite de l'Astrolabe, en deux moitiés : celle du fond passe derrière
 * l'avatar, celle du devant par-dessus — la même animation, coupée en deux.
 * Le plan écrase le cercle en ellipse ; le bras tourne dedans ; l'astre se
 * redresse, pour rester rond.
 */
function orbite(moitie: 'arriere' | 'avant') {
  return (
    <i key={`orbite-${moitie}`} className={`lu-orbite lu-orbite-${moitie}`}>
      <b className="lu-plan">
        <b className="lu-trace" />
        <b className="lu-bras">
          <img className="lu-astre" src={IMAGES.blanche} alt="" draggable={false} />
        </b>
      </b>
    </i>
  )
}

/**
 * Le disque de la Singularité, en deux moitiés comme l'orbite : sa moitié
 * lointaine derrière l'avatar, la proche devant, sous le menton. Le plan
 * l'écrase en ellipse ; le tourbillon tourne dedans.
 */
function disque(moitie: 'arriere' | 'avant') {
  return (
    <i key={`disque-${moitie}`} className={`lu-disque lu-disque-${moitie}`}>
      <b className="lu-disque-plan">
        <b className="lu-tourbillon" />
      </b>
    </i>
  )
}

const range = (n: number, calque: (i: number) => Calque) => Array.from({ length: n }, (_, i) => calque(i + 1))

const CALQUES: Record<FinitionLumineuse, { arriere: readonly Calque[]; avant: readonly Calque[]; orbite?: boolean; disque?: boolean }> = {
  // Le Diamant.
  prisme: {
    arriere: [
      { classe: 'lu-dispersion' },
      { classe: 'lu-spectres lu-spectres-1', src: IMAGES.spectres1 },
      { classe: 'lu-spectres lu-spectres-2', src: IMAGES.spectres2 },
      { classe: 'lu-feux', anneau: true },
      { classe: 'lu-glace', emoji: true },
      { classe: 'lu-cristal', src: IMAGES.cristal, anneau: true },
    ],
    avant: [{ classe: 'lu-balayage', anneau: true }, { classe: 'lu-etincelle', src: IMAGES.blanche }],
  },
  // Les Voiles.
  aurore: {
    arriere: [
      { classe: 'lu-lueur' },
      { classe: 'lu-voile lu-voile-2', src: IMAGES.voile2 },
      { classe: 'lu-voile lu-voile-1', src: IMAGES.voile1 },
    ],
    avant: [1, 2, 3, 4, 5].map(i => ({ classe: `lu-ion lu-ion-${i}` })),
  },
  // L'Astrolabe.
  constellation: {
    arriere: [
      { classe: 'lu-nebuleuse' },
      { classe: 'lu-poussiere', src: IMAGES.poussiere },
      { classe: 'lu-astrolabe', src: IMAGES.astrolabe, emoji: true, anneau: true },
      { classe: 'lu-gemmes', src: IMAGES.gemmes, emoji: true, anneau: true },
    ],
    avant: [
      { classe: 'lu-scintille lu-scintille-1', src: IMAGES.doree },
      { classe: 'lu-scintille lu-scintille-2', src: IMAGES.blanche },
      { classe: 'lu-scintille lu-scintille-3', src: IMAGES.doree },
    ],
    orbite: true,
  },
  // Les Méduses : les grands fonds — la lumière de la surface en faisceaux,
  // du plancton qui luit en cercle, deux méduses qui nagent, des bulles.
  abysses: {
    arriere: [
      { classe: 'lu-eau' },
      { classe: 'lu-faisceaux', src: IMAGES.faisceaux },
      { classe: 'lu-plancton lu-plancton-2', src: IMAGES.plancton2 },
      { classe: 'lu-plancton lu-plancton-1', src: IMAGES.plancton1 },
      { classe: 'lu-meduse lu-meduse-1', src: IMAGES.meduseRose },
      { classe: 'lu-meduse lu-meduse-2', src: IMAGES.meduseCyan },
    ],
    avant: range(4, i => ({ classe: `lu-bulle lu-bulle-${i}` })),
  },
  // La Foudre : un anneau électrique qui crépite, quatre éclairs qui frappent
  // tour à tour vers l'extérieur, dans un nuage bleu.
  orage: {
    arriere: [
      { classe: 'lu-nuage' },
      ...[IMAGES.eclair1, IMAGES.eclair2, IMAGES.eclair3, IMAGES.eclair4].map((src, i) => ({ classe: `lu-zebrure lu-zebrure-${i + 1}`, src })),
      { classe: 'lu-foudre lu-foudre-2', src: IMAGES.foudre2, emoji: true, anneau: true },
      { classe: 'lu-foudre lu-foudre-1', src: IMAGES.foudre1, emoji: true, anneau: true },
    ],
    avant: range(3, i => ({ classe: `lu-crepitement lu-crepitement-${i}` })),
  },
  // Les Ailes : deux ailes de lumière qui battent depuis les épaules, une
  // auréole qui flotte au-dessus de la tête, des plumes d'or qui tombent.
  envol: {
    arriere: [
      { classe: 'lu-clarte' },
      { classe: 'lu-aile lu-aile-gauche', src: IMAGES.aileGauche },
      { classe: 'lu-aile lu-aile-droite', src: IMAGES.aileDroite },
      { classe: 'lu-aureole', src: IMAGES.aureole },
    ],
    avant: range(3, i => ({ classe: `lu-plume lu-plume-${i}` })),
  },
  // La Boule à facettes : une boule de miroirs derrière la tête, ses reflets
  // qui tournent autour comme sur les murs d'une piste, des éclats sur ses
  // miroirs. Sous une bordure, la boule s'efface : la bordure en prend les
  // miroirs, les reflets restent.
  disco: {
    arriere: [
      { classe: 'lu-piste' },
      { classe: 'lu-reflets lu-reflets-2', src: IMAGES.reflets2 },
      { classe: 'lu-boule', src: IMAGES.boule, anneau: true },
      { classe: 'lu-reflets lu-reflets-1', src: IMAGES.reflets1 },
    ],
    avant: range(3, i => ({ classe: `lu-miroite lu-miroite-${i}`, src: IMAGES.blanche })),
  },
  // Le Disque : un trou noir derrière l'avatar — son ombre, son anneau de
  // photons, l'arc du disque courbé au-dessus de la tête, et le disque brûlant
  // qui passe derrière lui puis sous son menton.
  singularite: {
    arriere: [
      { classe: 'lu-accretion' },
      { classe: 'lu-lentille', src: IMAGES.lentille },
      { classe: 'lu-ombre', emoji: true },
      { classe: 'lu-photons', emoji: true, anneau: true },
    ],
    avant: range(2, i => ({ classe: `lu-lointaine lu-lointaine-${i}`, src: IMAGES.doree })),
    disque: true,
  },
}

function calques(liste: readonly Calque[], medaillon: boolean, bordure: boolean) {
  return liste
    .filter(c => !(medaillon && c.emoji) && !(bordure && c.anneau))
    .map(c => (c.src ? <img key={c.classe} className={c.classe} src={c.src} alt="" draggable={false} /> : <i key={c.classe} className={c.classe} />))
}

/**
 * La lumière d'une finition, autour de ce qu'elle entoure — l'emoji ou le
 * médaillon, passé en enfant, et sa bordure de ligue avec lui : ce qui est
 * derrière avant eux, ce qui passe devant après. Sous une bordure, ses
 * anneaux s'effacent (`anneau`).
 */
export function Lumiere({
  finition,
  medaillon = false,
  bordure = false,
  children,
}: {
  finition: FinitionLumineuse
  medaillon?: boolean
  bordure?: boolean
  children: ReactNode
}) {
  const c = CALQUES[finition]
  return (
    <>
      <span className="lu lu-arriere" aria-hidden="true">
        {calques(c.arriere, medaillon, bordure)}
        {c.orbite && orbite('arriere')}
        {c.disque && disque('arriere')}
      </span>
      {children}
      <span className="lu lu-avant" aria-hidden="true">
        {c.orbite && orbite('avant')}
        {c.disque && disque('avant')}
        {calques(c.avant, medaillon, bordure)}
      </span>
    </>
  )
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Lumiere })
