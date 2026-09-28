import type { ReactNode } from 'react'
import { inscrireDessin, type FinitionLumineuse } from './medaillons'

// La lumière des trois dernières finitions — Prisme (15), Aurore (20),
// Constellation (25) —, autour d'un emoji comme d'un médaillon.
//
// Les halos d'avant tenaient dans 1,45 em : Prisme n'était qu'Holo avec une
// étoile, Aurore un disque flou, et personne ne voyait qu'on avait monté de
// cinq niveaux. Ceux-ci débordent — jusqu'à 2,8 em — et se reconnaissent du
// fond de la salle : le Diamant sertit l'avatar dans une bague de cristal,
// les Voiles lèvent une aurore derrière sa tête, l'Astrolabe l'entoure d'or
// et fait passer une étoile derrière lui, puis devant.
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
}

// ── Les calques ───────────────────────────────────────────────────────────

/**
 * Un calque : sa classe (qui le place, le dimensionne et le fait bouger) et
 * son image s'il en a une. `emoji` : il fait anneau autour d'un emoji, et
 * ne se pose pas autour d'un médaillon — le cercle du médaillon le remplace
 * (`Cercle.tsx`) : deux anneaux et un disque faisaient une cible.
 */
interface Calque {
  classe: string
  src?: string
  emoji?: boolean
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

const CALQUES: Record<FinitionLumineuse, { arriere: readonly Calque[]; avant: readonly Calque[]; orbite?: boolean }> = {
  // Le Diamant.
  prisme: {
    arriere: [
      { classe: 'lu-dispersion' },
      { classe: 'lu-spectres lu-spectres-1', src: IMAGES.spectres1 },
      { classe: 'lu-spectres lu-spectres-2', src: IMAGES.spectres2 },
      { classe: 'lu-feux' },
      { classe: 'lu-glace', emoji: true },
      { classe: 'lu-cristal', src: IMAGES.cristal },
    ],
    avant: [{ classe: 'lu-balayage' }, { classe: 'lu-etincelle', src: IMAGES.blanche }],
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
      { classe: 'lu-astrolabe', src: IMAGES.astrolabe, emoji: true },
      { classe: 'lu-gemmes', src: IMAGES.gemmes, emoji: true },
    ],
    avant: [
      { classe: 'lu-scintille lu-scintille-1', src: IMAGES.doree },
      { classe: 'lu-scintille lu-scintille-2', src: IMAGES.blanche },
      { classe: 'lu-scintille lu-scintille-3', src: IMAGES.doree },
    ],
    orbite: true,
  },
}

function calques(liste: readonly Calque[], medaillon: boolean) {
  return liste
    .filter(c => !(medaillon && c.emoji))
    .map(c => (c.src ? <img key={c.classe} className={c.classe} src={c.src} alt="" draggable={false} /> : <i key={c.classe} className={c.classe} />))
}

/**
 * La lumière d'une finition, autour de ce qu'elle entoure — l'emoji ou le
 * médaillon, passé en enfant : ce qui est derrière avant lui, ce qui passe
 * devant après.
 */
export function Lumiere({ finition, medaillon = false, children }: { finition: FinitionLumineuse; medaillon?: boolean; children: ReactNode }) {
  const c = CALQUES[finition]
  return (
    <>
      <span className="lu lu-arriere" aria-hidden="true">
        {calques(c.arriere, medaillon)}
        {c.orbite && orbite('arriere')}
      </span>
      {children}
      <span className="lu lu-avant" aria-hidden="true">
        {c.orbite && orbite('avant')}
        {calques(c.avant, medaillon)}
      </span>
    </>
  )
}

// Évalué, le dessin est là pour tout `Avatar` de la page (voir `medaillons.ts`).
inscrireDessin({ Lumiere })
