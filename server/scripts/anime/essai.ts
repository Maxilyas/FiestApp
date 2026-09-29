// L'essai de style anime des portraits des branches (option A de « La montée
// en puissance » : les mêmes soixante-douze sujets, les mêmes seuils, plus de
// détails et d'effets à chaque palier). Deux portraits, les deux bouts de
// l'échelle : le Minotaure, premier des mythologies (3 bonnes réponses, le
// visage), et Athéna, sa forme ultime (200, celle qui déborde).
//
// Nano Banana les redessine à partir de leurs croquis, puis ils sont posés
// dans le vrai cadre de l'application et photographiés :
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/essai.ts [dossier]
//   npx tsx scripts/anime/essai.ts [dossier] --doublure      # sans un appel
//   … --regenerer                                            # repayer les images
//   … --source="app Gemini, Nano Banana Pro"                 # des images faites ailleurs
//
// Des images générées hors du script — dans l'app Gemini, dont l'offre
// gratuite en donne quelques-unes par jour quand l'API n'en donne aucune —
// se posent dans le dossier sous brut-athena, brut-decor-athena et
// brut-minotaure (.png ou .jpg) : le script les garde comme les siennes, et
// les consignes à leur donner sont les fichiers consigne-*.txt qu'il écrit.
//
// Dossier par défaut : ../export/essai-anime (hors du dépôt). La clé est lue
// dans GEMINI_API_KEY ; le modèle dans MODELE (Nano Banana Pro par défaut,
// gemini-3.1-flash-image pour Nano Banana 2), la taille dans TAILLE (2K).
// Une image déjà générée n'est jamais redemandée sans --regenerer : elle se
// paie. En doublure, les croquis tiennent lieu d'images générées — de quoi
// éprouver le détourage, le recalage et le cadre avant d'en payer une.
//
// Les étapes :
// 1. les références : le personnage seul du croquis, sans disque ni anneau,
//    sur le vert de détourage, dans un canevas élargi (−30 → 130 dans le
//    repère du disque) qui laisse au débord sa place ; et, pour Athéna, le
//    décor du disque ;
// 2. la génération : référence et consigne, et pour le second portrait le
//    premier comme étalon de style ;
// 3. le détourage : le vert devient transparent, les bords se démêlent ;
// 4. le recalage : l'image générée retombe exactement où était le croquis —
//    le modèle cadre à peu près, le disque ne pardonne pas un buste qui flotte ;
// 5. le cadre : le disque et la silhouette de `Portrait.tsx`, le vrai cercle
//    des finitions (`Cercle.tsx`), le débord, en 320, 44 et 26 px.
//
// Ce n'est pas un test : c'est l'œil qu'on pose avant d'en générer soixante-dix
// autres (« Regarde le rendu », CLAUDE.md).
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import type { Finition } from '../../../shared/profil'
import { enPartie, formatDe, generer, type Partie } from './gemini'

// Le client compile son JSX pour un `React` global : posé avant tout import d'un composant.
Object.assign(globalThis, { React })

const { renderToStaticMarkup } = await import('react-dom/server')
/** Un module du client, par son adresse : le serveur ne compile pas le JSX du client, tsx si. */
const duClient = (fichier: string) => import(new URL(`../../../client/src/${fichier}`, import.meta.url).href)
const { Portrait } = await duClient('components/Portrait.tsx')
const { Cercle } = await duClient('components/Cercle.tsx')
const { DESSINS: MYTHES } = await duClient('components/portraits/mythes.ts')

const ICI = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const DOUBLURE = args.includes('--doublure')
const REGENERER = args.includes('--regenerer')
const sortie = path.resolve(args.find(a => !a.startsWith('--')) ?? '../export/essai-anime')
const MODELE = process.env.MODELE ?? 'gemini-3-pro-image'
/** D'où viennent les images, quand ce n'est pas le script qui les a demandées. */
const SOURCE = args.find(a => a.startsWith('--source='))?.slice('--source='.length)
const TAILLE = process.env.TAILLE ?? '2K'
mkdirSync(sortie, { recursive: true })

// ── Les consignes ─────────────────────────────────────────────────────────
// En anglais : les modèles d'image suivent mieux leurs mots de style dans
// cette langue. Le style est le même pour les soixante-douze — c'est lui qui
// fait une série ; le palier dit ce que le portrait ajoute ; le sujet, qui il
// est. Aucun nom d'œuvre ni de personnage existant : l'esprit des visuels
// d'anime, avec des personnages à nous.

const STYLE =
  'Art style: polished modern Japanese anime illustration, like a key visual of a high-budget anime series. ' +
  'Clean, confident dark line art with tapered strokes and varied line weight; cel shading with crisp two-tone shadows and a soft third tone; ' +
  'smooth gradients on skin, hair and metal; bright specular highlights; large expressive eyes with sharp catchlights; vivid, saturated, harmonious colors. ' +
  'This is an original character: do not imitate any existing anime or game character, costume or color scheme. ' +
  'It must read instantly as a small round avatar: strong silhouette, big clear shapes, the face well lit and easy to recognize.'

/** Le fond qu'on détoure : un vert que le personnage n'a pas, et rien qui s'y reflète. */
const FOND_VERT =
  'Background: a single perfectly flat, uniform chroma-key green (#00FF00) filling the entire canvas edge to edge — no gradient, no texture, ' +
  'no floor, no cast shadow, no glow or light spilling onto it, no vignette. Draw no circle, ring, disc, frame, border, text, signature or watermark. ' +
  'Do not use any green on the character, clothing or effects.'

// Les images jointes se désignent par ce qu'elles montrent, jamais par leur
// rang : dans l'app Gemini, on les joint à la main, dans l'ordre qu'on veut.
const COMPOSITION =
  'The attached image with a flat green background is a flat vector sketch of this exact avatar. Keep its composition exactly: ' +
  'same pose, same position and size on the canvas, same framing and crop, same elements, same main colors. ' +
  'Redraw it with far more detail as an anime illustration — do not add or remove major elements, do not zoom in or out, do not move the character.'

/** Le débord : sans cette phrase, le modèle ramène la lance et les ailes dans le cadre. */
const DEBORD =
  'The avatar will sit in a centered circular frame whose diameter is 60% of the canvas width. The parts that reach beyond that circle in the sketch ' +
  '(spearhead, lightning, wings, helmet crest, cape) are meant to burst out of that frame: keep them exactly where they are, at full size.'

const ETALON =
  'The other attached image — an anime illustration of another character of the same series — is the approved art style: ' +
  'match its line work, shading, rendering and level of finish, not its character, pose or colors.'

/** L'API reçoit le format dans sa requête ; l'app Gemini ne le lit que dans la consigne. */
const SORTIE = 'Output one square image (1:1 aspect ratio).'

/** Ce que chaque palier ajoute, de l'échelle de l'artifact : ici, le premier et le dernier. */
const PALIERS = {
  visage:
    'Tier 1 of 6 — the face: a calm, front-facing head-and-shoulders bust looking straight at the viewer, soft key light from the upper left, ' +
    'no action and no special effects. Simple and iconic, yet richly rendered.',
  ultime:
    'Tier 6 of 6 — the ultimate form, the rarest avatar of its series: a dynamic battle stance frozen the instant before the strike, dramatic backlight ' +
    'and golden rim light, glowing eyes, a crackling signature energy effect, hair and cloth whipping in the wind, maximum detail and intensity. ' +
    'It must look far more powerful and precious than the lower tiers.',
}

// ── Les sujets ────────────────────────────────────────────────────────────

/** Une zone (x, y, largeur, hauteur) où le personnage a le droit de sortir du disque. */
type Zone = [number, number, number, number]

interface Sujet {
  id: string
  cle: string
  nom: string
  seuil: number
  palier: keyof typeof PALIERS
  /** Qui il est, pour Nano Banana. */
  sujet: string
  /** Le disque, du centre (en haut) vers le bord : celui de sa branche. */
  fond: [string, string, string]
  /** Le décor vectoriel de l'application, quand le palier n'en peint pas. */
  decorSvg?: string
  /** Le décor peint, quand le palier en a un : sa consigne. */
  decorPeint?: string
  /** Là où le corps sort du disque : ailleurs, le disque le coupe (le buste). */
  debord?: Zone[]
  /** La fenêtre du plan serré (x, y, côté), dans le repère du disque : le visage, pour les petites tailles. */
  serre: [number, number, number]
}

const MINOTAURE = MYTHES['br:minotaure']
/** Le décor des mythologies (`portraits/mythes.ts`) : la lueur derrière la tête et les étoiles d'or. */
const DECOR_MYTHES: string = MINOTAURE.decor('mi')

const SUJETS: Sujet[] = [
  {
    id: 'athena',
    cle: 'br:athena',
    nom: 'Athéna',
    seuil: 200,
    palier: 'ultime',
    sujet:
      'Subject: Athena, goddess of wisdom and war, in her ultimate form. Three-quarter view, facing left. She raises her spear high toward the upper left; ' +
      'golden lightning crackles from the spearhead near the upper-left corner. She guards behind a round golden shield bearing an owl emblem, at the lower right. ' +
      'Golden Corinthian helmet with a long crimson horsehair crest streaming to the right; long dark brown hair and a crimson cape whipping to the right; ' +
      'large golden owl wings spreading behind her shoulders, their feather tips reaching the top of the canvas; golden cuirass over a white chiton; ' +
      'glowing cyan eyes, fierce focused expression. A few golden embers around her.',
    fond: ['#5468d8', '#1d2680', '#070b2c'],
    decorPeint:
      'Paint only the background plate of this avatar — no character, no person, no weapon, no animal, nothing in the foreground. ' +
      'The attached blue sketch is its flat vector version: keep the same colors and layout. A stormy night sky in deep royal blue fading to navy at the edges; ' +
      'a warm golden glory of light where the goddess’s head will be (upper center, slightly left); fine golden light rays radiating from it; ' +
      'distant crackling golden lightning in the upper right; a few tiny four-pointed golden stars. ' +
      'The attached anime illustration of the goddess is the character who will stand in front of it: match her lighting and the anime rendering, but do not draw her or any part of her. ' +
      'Painted anime background: soft gradients, luminous glow, crisp small details. The square canvas is filled edge to edge; no circle, frame, border, text or watermark.',
    // Tout le haut du canevas, jusqu'aux épaules. Les zones du prototype
    // (clipPath h13corps) laissaient aussi sortir le flanc droit et le
    // bouclier : l'app Gemini y a peint une cape qui descend jusqu'au bas du
    // canevas, et elle pendait sous l'anneau, coupée net au bord des
    // rectangles. Le buste, le bouclier et la cape restent donc dans le
    // disque ; ce qui sort — lance, foudre, ailes, cimier — s'estompe au
    // bord de la zone au lieu d'y être tranché.
    debord: [[-26, -26, 152, 90]],
    serre: [26, 16, 44],
  },
  {
    id: 'minotaure',
    cle: 'br:minotaure',
    nom: 'Le Minotaure',
    seuil: 3,
    palier: 'visage',
    sujet:
      'Subject: a young, friendly minotaur — a mascot, not a monster. Bull head with warm chestnut-brown fur and a short dark forelock; ' +
      'big horns, dark at the base, cream then ivory toward the tips, curving outward then up; horizontal ears with pink insides; ' +
      'kind amber-brown eyes under thick, determined brows; a pink muzzle with a golden nose ring; ' +
      'a dark brown tunic with a golden torc necklace and a round golden pendant. Warm, confident, a little mischievous.',
    fond: MINOTAURE.fond,
    decorSvg: DECOR_MYTHES,
    serre: [20, 22, 60],
  },
]

// ── Les outils ────────────────────────────────────────────────────────────

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'essai.js'))('playwright')
}
const { chromium } = chargerPlaywright()

const n2 = (n: number) => String(+n.toFixed(2))
const fichier = (nom: string) => path.join(sortie, nom)
const deDataUrl = (d: string) => Buffer.from(d.slice(d.indexOf(',') + 1), 'base64')

const enDataUrl = (f: string) => {
  const b = readFileSync(f)
  return `data:${formatDe(b).mime};base64,${b.toString('base64')}`
}
/** L'image brute d'un calque, quel que soit son format ; absente, `undefined`. */
const brutExistant = (nom: string) => ['png', 'jpg', 'webp'].map(e => fichier(`brut-${nom}.${e}`)).find(f => existsSync(f))

/**
 * Le canevas des références et des images générées, dans le repère du disque
 * (0 → 100) : de −30 à 130, centré sur le disque, qui en couvre les 60 %. La
 * foudre d'Athéna part jusqu'à −28 : à −15, le croquis la coupait déjà.
 */
const CANEVAS = { origine: -30, cote: 160 }
/** Le cadre SVG du canevas. */
const CADRE = `${CANEVAS.origine} ${CANEVAS.origine} ${CANEVAS.cote} ${CANEVAS.cote}`
const REF_PX = 1024

/**
 * Ce qui tourne dans Chromium : le détourage et le recalage lisent des pixels,
 * que Node ne sait pas décoder sans dépendance. Du JavaScript en chaîne — le
 * serveur se vérifie sans les types du navigateur.
 */
const NAVIGATEUR = String.raw`
function charger(src) {
  return new Promise((ok, ko) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = () => ko(new Error('image illisible'))
    i.src = src
  })
}
function toile(l, h) { const c = document.createElement('canvas'); c.width = l; c.height = h; return c }
const borne = v => Math.max(0, Math.min(255, Math.round(v)))
const cb = (r, g, b) => 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
const cr = (r, g, b) => 128 + 0.5 * r - 0.418688 * g - 0.081312 * b

// Le vert du fond, lu sur le pourtour : la médiane de chaque canal. Le buste
// touche le bas du canevas, la foudre un coin — la médiane les ignore tant
// que le fond tient plus de la moitié du bord.
function couleurDuFond(d, l, h) {
  const bande = Math.max(2, Math.round(l * 0.015))
  const canaux = [[], [], []]
  const prendre = (x, y) => {
    const k = (y * l + x) * 4
    canaux[0].push(d[k]); canaux[1].push(d[k + 1]); canaux[2].push(d[k + 2])
  }
  for (let y = 0; y < h; y++) {
    if (y < bande || y >= h - bande) for (let x = 0; x < l; x++) prendre(x, y)
    else for (let x = 0; x < bande; x++) { prendre(x, y); prendre(l - 1 - x, y) }
  }
  return canaux.map(t => { t.sort((p, q) => p - q); return t[t.length >> 1] })
}

// Le détourage : l'opacité suit la distance de chrominance au vert du fond —
// un bord à moitié vert est à moitié transparent —, puis chaque bord se
// démêle (on retire la part de vert qu'il avait prise) et le reflet vert
// disparaît : le personnage n'a pas de vert, le vert n'y dépasse jamais le
// plus fort des deux autres canaux.
async function detourer(src, cote) {
  const img = await charger(src)
  const l = img.naturalWidth, h = img.naturalHeight
  const c = toile(l, h), x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(img, 0, 0)
  const donnees = x.getImageData(0, 0, l, h), d = donnees.data
  const K = couleurDuFond(d, l, h)
  const kb = cb(K[0], K[1], K[2]), kr = cr(K[0], K[1], K[2])
  const T0 = 0.06, T1 = 0.4
  let transparents = 0
  for (let k = 0; k < d.length; k += 4) {
    const r = d[k], g = d[k + 1], b = d[k + 2]
    let a = (Math.hypot(cb(r, g, b) - kb, cr(r, g, b) - kr) / 255 - T0) / (T1 - T0)
    a = Math.max(0, Math.min(1, a))
    // Un vert franc, même assombri (une ombre que le modèle aurait posée), reste du fond.
    const m = Math.max(r, b)
    if (g > 40 && (g - m) / g > 0.6) a = 0
    if (a < 0.02) { d[k + 3] = 0; transparents++; continue }
    let R = r, G = g, B = b
    if (a < 0.98) { R = (r - (1 - a) * K[0]) / a; G = (g - (1 - a) * K[1]) / a; B = (b - (1 - a) * K[2]) / a }
    G = Math.min(G, Math.max(R, B))
    d[k] = borne(R); d[k + 1] = borne(G); d[k + 2] = borne(B); d[k + 3] = borne(a * 255)
  }
  x.putImageData(donnees, 0, 0)
  // Une image qui n'est pas carrée (l'app Gemini choisit parfois son
  // format) se complète en carré, centrée sur du transparent : étirée, elle
  // déformait le personnage, et le recalage retrouve l'échelle de toute façon.
  const m = Math.max(l, h), carre = toile(m, m)
  carre.getContext('2d').drawImage(c, (m - l) / 2, (m - h) / 2)
  const petit = toile(cote, cote), px = petit.getContext('2d')
  px.imageSmoothingQuality = 'high'
  px.drawImage(carre, 0, 0, cote, cote)
  return { plein: carre.toDataURL('image/png'), reduit: petit.toDataURL('image/png'), fond: K, transparents: transparents / (l * h), taille: [l, h] }
}

async function masque(src, n) {
  const img = await charger(src)
  const c = toile(n, n), x = c.getContext('2d', { willReadFrequently: true })
  x.imageSmoothingQuality = 'high'
  x.drawImage(img, 0, 0, n, n)
  const d = x.getImageData(0, 0, n, n).data
  const m = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) m[i] = d[i * 4 + 3] / 255
  return m
}

// Le recouvrement des deux formes (intersection sur union, en opacités),
// l'image générée mise à l'échelle s autour du centre puis décalée de
// (dx, dy) pixels. Sous la ligne « bas », le buste que le modèle prolonge
// jusqu'au bord du canevas ne compte pas : le disque le coupe avant.
function recouvrement(ref, gen, n, s, dx, dy, bas) {
  const c = n / 2
  let inter = 0, union = 0
  for (let Y = 0; Y < bas; Y++) {
    const v = Math.round(c + (Y - c - dy) / s)
    const dedans = v >= 0 && v < n
    for (let X = 0; X < n; X++) {
      const u = Math.round(c + (X - c - dx) / s)
      const g = dedans && u >= 0 && u < n ? gen[v * n + u] : 0
      const r = ref[Y * n + X]
      inter += r < g ? r : g
      union += r > g ? r : g
    }
  }
  return union ? inter / union : 0
}

async function recaler(srcRef, srcGen, n, bas) {
  const ref = await masque(srcRef, n), gen = await masque(srcGen, n)
  const identite = recouvrement(ref, gen, n, 1, 0, 0, bas)
  let mieux = { s: 1, dx: 0, dy: 0, score: identite }
  // De 0,4 à 1,8 : l'app Gemini remplit le canevas (le Minotaure y revient
  // une fois et demie plus grand que son croquis), et une image rendue en
  // 4:3, complétée en carré, arrive aux trois quarts de sa taille.
  for (let s = 0.4; s <= 1.8001; s += 0.05)
    for (let dx = -32; dx <= 32; dx += 4)
      for (let dy = -32; dy <= 32; dy += 4) {
        const q = recouvrement(ref, gen, n, s, dx, dy, bas)
        if (q > mieux.score) mieux = { s, dx, dy, score: q }
      }
  const b = { ...mieux }
  for (let s = b.s - 0.04; s <= b.s + 0.0401; s += 0.01)
    for (let dx = b.dx - 4; dx <= b.dx + 4; dx += 1)
      for (let dy = b.dy - 4; dy <= b.dy + 4; dy += 1) {
        const q = recouvrement(ref, gen, n, s, dx, dy, bas)
        if (q > mieux.score) mieux = { s, dx, dy, score: q }
      }
  return { ...mieux, identite }
}

// Les retouches du croquis d'Athéna, dans le DOM : garder le personnage
// (ou le décor), ôter le reste, élargir le cadre.
function preparerAthena(mode, vert, cadre) {
  const svg = document.querySelector('svg')
  const ns = 'http://www.w3.org/2000/svg'
  const fond = svg.querySelector('circle[fill="url(#h13fond)"]')
  const disque = svg.querySelector('g[clip-path="url(#h13disque)"]')
  if (mode === 'decor') {
    for (const e of [...svg.children]) if (e.tagName !== 'defs' && e !== fond && e !== disque) e.remove()
    fond.setAttribute('r', '75')
    disque.removeAttribute('clip-path')
    svg.setAttribute('viewBox', '0 0 100 100')
  } else {
    for (const s of ['.h-aura', '.h-vent', '.h-braises', '.h-scintille', '.h-eclat', 'circle[stroke="url(#h13anneau)"]', 'circle[r="45"][fill="none"]'])
      svg.querySelectorAll(s).forEach(e => e.remove())
    fond.remove()
    disque.remove()
    svg.querySelector('g[clip-path="url(#h13corps)"]').removeAttribute('clip-path')
    // Les ailes du croquis sont translucides : sur le vert, elles viraient au
    // vert-jaune, et le modèle les aurait peintes ainsi. Opaques ici seulement.
    const ailes = svg.querySelector('.h-ailes')
    ailes.removeAttribute('opacity')
    ailes.querySelectorAll('[fill^="url(#h13plume"]').forEach(e => e.removeAttribute('opacity'))
    svg.setAttribute('viewBox', cadre.join(' '))
    if (vert) {
      const r = document.createElementNS(ns, 'rect')
      for (const [k, v] of Object.entries({ x: cadre[0], y: cadre[1], width: cadre[2], height: cadre[3], fill: '#00ff00' })) r.setAttribute(k, String(v))
      svg.insertBefore(r, svg.querySelector('defs').nextSibling)
    }
  }
  svg.removeAttribute('overflow')
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.style.display = 'block'
}
`

/** Une page de Chromium, à la taille d'une référence, avec les outils de pixels chargés. */
async function pagePixels(nav: any) {
  const page = await nav.newPage({ viewport: { width: REF_PX, height: REF_PX }, deviceScaleFactor: 1 })
  await page.setContent('<!doctype html><html><body style="margin:0"></body></html>')
  await page.addScriptTag({ content: NAVIGATEUR })
  return page
}

/** Photographie un SVG plein cadre, à la taille d'une référence ; transparent, pour la forme seule. */
async function photographier(page: any, svg: string, sortieFichier: string, transparent: boolean, retouche?: [string, boolean]) {
  await page.evaluate(
    ([html, r, cadre]: [string, [string, boolean] | undefined, number[]]) => {
      const g = globalThis as any
      g.document.body.innerHTML = html
      if (r) g.preparerAthena(r[0], r[1], cadre)
    },
    [svg, retouche, [CANEVAS.origine, CANEVAS.origine, CANEVAS.cote, CANEVAS.cote]],
  )
  await page.screenshot({ path: sortieFichier, omitBackground: transparent, clip: { x: 0, y: 0, width: REF_PX, height: REF_PX } })
}

// ── 1. Les références ─────────────────────────────────────────────────────

/** Le Minotaure seul, tel que l'application le dessine (`portraits/mythes.ts`), sans disque ni décor. */
function minotaureSeul(vert: boolean) {
  const fondVert = vert ? `<rect x="${CANEVAS.origine}" y="${CANEVAS.origine}" width="${CANEVAS.cote}" height="${CANEVAS.cote}" fill="#00ff00"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CADRE}" width="100%" height="100%" style="display:block"><defs>${MINOTAURE.defs('mi')}</defs>${fondVert}${MINOTAURE.corps('mi')}</svg>`
}

async function references(page: any) {
  const athena = readFileSync(path.join(ICI, 'athena-croquis.svg'), 'utf8')
  for (const s of SUJETS) {
    if (s.id === 'athena') {
      await photographier(page, athena, fichier('reference-athena.png'), false, ['personnage', true])
      await photographier(page, athena, fichier('forme-athena.png'), true, ['personnage', false])
      await photographier(page, athena, fichier('reference-decor-athena.png'), false, ['decor', false])
    } else {
      await photographier(page, minotaureSeul(true), fichier(`reference-${s.id}.png`), false)
      await photographier(page, minotaureSeul(false), fichier(`forme-${s.id}.png`), true)
    }
  }
}

// ── 2. La génération ──────────────────────────────────────────────────────

/** L'image brute d'un calque : générée une fois, gardée ensuite — elle se paie. */
async function brut(nom: string, parties: () => Partie[], consigne: string, doublure: string, journal: Record<string, unknown>) {
  writeFileSync(fichier(`consigne-${nom}.txt`), consigne + '\n')
  if (DOUBLURE) {
    const cible = fichier(`brut-${nom}.png`)
    writeFileSync(cible, readFileSync(doublure))
    return cible
  }
  const deja = brutExistant(nom)
  if (deja && !REGENERER) {
    console.log(`  ${nom} : déjà généré, gardé (--regenerer pour le repayer)`)
    return deja
  }
  console.log(`  ${nom} : ${MODELE}, ${TAILLE}…`)
  const r = await generer([...parties(), { text: consigne }], { modele: MODELE, taille: TAILLE })
  const cible = fichier(`brut-${nom}.${formatDe(r.image).ext}`)
  writeFileSync(cible, r.image)
  journal[nom] = { modele: MODELE, taille: TAILLE, mime: r.mime, secondes: r.secondes, jetons: r.jetons }
  console.log(`  ${nom} : ${r.mime}, ${r.secondes.toFixed(1)} s`)
  return cible
}

/** Génère ce qui manque ; rend le fichier du décor peint d'Athéna, que le cadre pose dans son disque. */
async function generation(journal: Record<string, unknown>): Promise<string> {
  const consigne = (s: Sujet, etalon: boolean) =>
    [STYLE, PALIERS[s.palier], s.sujet, COMPOSITION, s.debord ? DEBORD : '', etalon ? ETALON : '', FOND_VERT, SORTIE].filter(Boolean).join('\n\n')
  // Athéna d'abord : la forme ultime fixe le style, le Minotaure le reçoit comme étalon.
  const athena = SUJETS[0]
  const perso = await brut('athena', () => [enPartie(fichier('reference-athena.png'))], consigne(athena, false), fichier('reference-athena.png'), journal)
  const decor = await brut(
    'decor-athena',
    () => [enPartie(fichier('reference-decor-athena.png')), enPartie(perso)],
    [STYLE, athena.decorPeint, SORTIE].join('\n\n'),
    fichier('reference-decor-athena.png'),
    journal,
  )
  const minotaure = SUJETS[1]
  await brut('minotaure', () => [enPartie(fichier('reference-minotaure.png')), enPartie(perso)], consigne(minotaure, true), fichier('reference-minotaure.png'), journal)
  return path.basename(decor)
}

// ── 3 et 4. Le détourage et le recalage ───────────────────────────────────

interface Calque {
  /** L'image détourée, relative à la page du banc. */
  href: string
  /** L'échelle et le décalage (en unités du disque) qui la posent sur le croquis. */
  s: number
  dx: number
  dy: number
}

async function detourage(page: any, journal: Record<string, unknown>): Promise<Record<string, Calque>> {
  const calques: Record<string, Calque> = {}
  for (const s of SUJETS) {
    const r = await page.evaluate(
      ([src, cote]: [string, number]) => (globalThis as any).detourer(src, cote),
      [enDataUrl(brutExistant(s.id)!), 1024] as [string, number],
    )
    writeFileSync(fichier(`detoure-${s.id}.png`), deDataUrl(r.plein))
    writeFileSync(fichier(`detoure-${s.id}-1024.png`), deDataUrl(r.reduit))
    // Deux pixels par unité ; sous y = 98 dans le disque, le disque a déjà coupé.
    const n = 2 * CANEVAS.cote
    const q = await page.evaluate(
      ([ref, gen, taille, bas]: [string, string, number, number]) => (globalThis as any).recaler(ref, gen, taille, bas),
      [enDataUrl(fichier(`forme-${s.id}.png`)), r.reduit, n, 2 * (98 - CANEVAS.origine)] as [string, string, number, number],
    )
    const unite = CANEVAS.cote / n
    calques[s.id] = { href: `detoure-${s.id}-1024.png`, s: q.s, dx: q.dx * unite, dy: q.dy * unite }
    journal[`recalage-${s.id}`] = { ...calques[s.id], recouvrement: +q.score.toFixed(3), sansRecalage: +q.identite.toFixed(3), fond: r.fond, partTransparente: +r.transparents.toFixed(3), taille: r.taille }
    console.log(`  ${s.id} : fond ${r.fond}, ${(r.transparents * 100).toFixed(0)} % transparent ; recalage ×${q.s.toFixed(2)} (${n2(q.dx * unite)}, ${n2(q.dy * unite)}), recouvrement ${q.identite.toFixed(2)} → ${q.score.toFixed(2)}`)
  }
  return calques
}

// ── 5. Le cadre ───────────────────────────────────────────────────────────

/** Le disque d'un portrait qu'on n'a pas encore (`Portrait.tsx`) : sombre, sans ciel. */
const NUIT: [string, string, string] = ['#3a2c24', '#221a16', '#120d0b']

interface Rendu {
  sujet: Sujet
  perso: Calque
  /** Le décor peint (carré, repère du disque), s'il y en a un. */
  decor?: string
  verrouille?: boolean
  /** La finition de celui qui le porte : elle devient son cercle. Absente, ou Mat, le cadre du palier. */
  finition?: Finition
  /** Le plan serré des petites tailles : le visage, sans débord ni aura. */
  serre?: boolean
}

let compteur = 0

/** Le vrai cercle de la finition (`Cercle.tsx`), rendu dans un `<svg>` qu'on retire : hors de lui, React prend ses dégradés pour du HTML. */
const cercleDe = (finition: Finition, u: string) =>
  renderToStaticMarkup(React.createElement('svg', null, React.createElement(Cercle, { finition, id: (nom: string) => `${u}_${nom}` }))).replace(/^<svg>|<\/svg>$/g, '')

/**
 * Un portrait anime dans le cadre de `Portrait.tsx`, calque pour calque : le
 * disque (r 48, ou 45 sous un cercle), le cercle de la finition — le vrai
 * composant —, la silhouette dorée à 42 % sur la nuit quand il est à gagner.
 * Ce que le SVG d'aujourd'hui n'a pas : l'image à la place des formes, et le
 * débord de la forme ultime, découpé comme les Divins (derrière, dedans,
 * devant) : le personnage une fois dans le disque, une fois dans ses zones
 * de débord, par-dessus l'anneau.
 */
function portraitAnime(r: Rendu): string {
  const { sujet } = r
  const u = `ea${++compteur}`
  const cercle = !!r.finition && r.finition !== 'mat' && !r.verrouille
  const ultime = sujet.palier === 'ultime' && !r.serre
  // L'anneau d'or du sixième palier (proposé par l'artifact) quand aucun cercle de finition ne le remplace.
  const anneauOr = ultime && !cercle
  const rayon = cercle ? 45 : anneauOr ? 46.4 : 48
  const [a, b, c] = r.verrouille ? NUIT : sujet.fond
  const p = r.perso
  const t = CANEVAS.cote * p.s
  let perso = `<image href="${p.href}" x="${n2(50 - (CANEVAS.cote / 2) * p.s + p.dx)}" y="${n2(50 - (CANEVAS.cote / 2) * p.s + p.dy)}" width="${n2(t)}" height="${n2(t)}" preserveAspectRatio="none"/>`
  // Le décor couvre le carré du disque : pas carré, il se recadre au centre — seul le disque se voit.
  let decor = r.decor ? `<image href="${r.decor}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice"/>` : (sujet.decorSvg ?? '')
  if (r.serre) {
    // La fenêtre du visage remplit le disque, comme la viewBox du prototype.
    const [x, y, cote] = sujet.serre
    const zoom = `transform="scale(${n2(100 / cote)}) translate(${n2(-x)} ${n2(-y)})"`
    perso = `<g ${zoom}>${perso}</g>`
    decor = `<g ${zoom}>${decor}</g>`
  }
  const grand = 'x="-40" y="-40" width="180" height="180"'
  let defs =
    `<radialGradient id="${u}_fond" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>` +
    `<clipPath id="${u}_clip"><circle cx="50" cy="50" r="${rayon}"/></clipPath>`
  // Verrouillé, la silhouette : le personnage passé en blanc sert de masque à
  // un dégradé d'or. Le filtre et le masque couvrent le débord — ceux de
  // `Portrait.tsx` s'arrêtent au carré 0 → 100.
  const silhouette = `<rect ${grand} fill="url(#${u}_or)" mask="url(#${u}_forme)" opacity=".42"/>`
  if (r.verrouille) {
    defs +=
      `<linearGradient id="${u}_or" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dca0"/><stop offset="1" stop-color="#a47c33"/></linearGradient>` +
      `<filter id="${u}_blanc" ${grand} filterUnits="userSpaceOnUse"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>` +
      `<mask id="${u}_forme" ${grand} maskUnits="userSpaceOnUse"><g filter="url(#${u}_blanc)">${perso}</g></mask>`
  }
  let avant = ''
  let anneau = ''
  let apres = ''
  if (ultime && !r.verrouille) {
    // L'aura de la forme ultime, derrière tout : celle du prototype.
    defs += `<radialGradient id="${u}_aura" gradientUnits="userSpaceOnUse" cx="50" cy="52" r="66"><stop offset=".55" stop-color="#ffd76a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient>`
    avant += `<circle cx="50" cy="52" r="66" fill="url(#${u}_aura)"/>`
  }
  if (cercle) avant += cercleDe(r.finition!, u)
  if (anneauOr) {
    defs += `<linearGradient id="${u}_anneau" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4c7"/><stop offset=".5" stop-color="#e3b04b"/><stop offset="1" stop-color="#8a5a10"/></linearGradient>`
    anneau = r.verrouille
      ? `<circle cx="50" cy="50" r="47.2" fill="none" stroke="#d9b56a" stroke-width=".9" opacity=".45"/>`
      : `<circle cx="50" cy="50" r="47.2" fill="none" stroke="url(#${u}_anneau)" stroke-width="2.2"/><circle cx="50" cy="50" r="45" fill="none" stroke="#fff4c7" stroke-width=".45" opacity=".5"/>`
  } else if (!cercle) {
    apres += `<circle cx="50" cy="50" r="47.5" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="0.9"/>`
  }
  if (ultime && sujet.debord) {
    // Les zones de débord, floues : une image générée ne s'arrête pas où
    // s'arrêtait le croquis, et un bord de zone net la tranchait en ligne
    // droite. Moins le disque, net lui, avec un demi-point de recouvrement :
    // sinon l'anticrénelage des deux découpes laissait un fil au ras de
    // l'anneau.
    defs +=
      `<filter id="${u}_fondu" ${grand} filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="4"/></filter>` +
      `<mask id="${u}_dehors" ${grand} maskUnits="userSpaceOnUse"><g filter="url(#${u}_fondu)">` +
      sujet.debord.map(([x, y, l, h]) => `<rect x="${x}" y="${y}" width="${l}" height="${h}" fill="#fff"/>`).join('') +
      `</g><circle cx="50" cy="50" r="${rayon - 0.5}" fill="#000"/></mask>`
    apres += `<g mask="url(#${u}_dehors)">${r.verrouille ? silhouette : perso}</g>`
  }
  const titre = r.verrouille ? `${sujet.nom} — pas encore gagné` : sujet.nom
  // L'anneau d'or se pose entre le décor et le personnage, comme dans le
  // prototype : par-dessus, son filet intérieur rayait les cheveux d'Athéna.
  const disque = (contenu: string) => `<g clip-path="url(#${u}_clip)">${contenu}</g>`
  const scene = anneau
    ? disque(`<rect ${grand} fill="url(#${u}_fond)"/>` + (r.verrouille ? '' : decor)) + anneau + disque(r.verrouille ? silhouette : perso)
    : disque(`<rect ${grand} fill="url(#${u}_fond)"/>` + (r.verrouille ? silhouette : decor + perso))
  return `<svg class="pt" viewBox="0 0 100 100" role="img" aria-label="${titre}"><title>${titre}</title><defs>${defs}</defs>${avant}${scene}${apres}</svg>`
}

const boite = (svg: string, taille: number, legende = '', classe = '') =>
  `<figure class="${classe}"><span class="boite" style="width:${taille}px;height:${taille}px">${svg}</span>${legende ? `<figcaption>${legende}</figcaption>` : ''}</figure>`

const FINITIONS_MONTREES: [Finition, string][] = [
  ['mat', 'Mat'],
  ['argent', 'Argent'],
  ['or', 'Or'],
  ['holo', 'Holo'],
  ['aurore', 'Aurore'],
  ['prisme', 'Prisme'],
  ['constellation', 'Constellation'],
]

function banc(calques: Record<string, Calque>, decorAthena: string, journal: Record<string, unknown>) {
  const athena = readFileSync(path.join(ICI, 'athena-croquis.svg'), 'utf8')
  const sections = SUJETS.map(s => {
    const perso = calques[s.id]
    const base: Rendu = { sujet: s, perso, decor: s.decorPeint ? decorAthena : undefined }
    const croquis = s.id === 'athena' ? athena : renderToStaticMarkup(React.createElement(Portrait, { cle: s.cle }))
    const palier = s.palier === 'ultime' ? 'sixième palier : la forme ultime' : 'premier palier : le visage'
    const ligneClassement = (serre: boolean) =>
      `<div class="classement"><span class="rang">1</span><span class="boite" style="width:26px;height:26px">${portraitAnime({ ...base, finition: 'argent', serre })}</span><b>Léa</b><span class="pts">1 240 pts</span></div>`
    return `<section>
      <h2>${s.nom} <small>Les mythologies · ${s.seuil} bonne${s.seuil > 1 ? 's' : ''} réponse${s.seuil > 1 ? 's' : ''} · ${palier}</small></h2>
      <div class="rang-grand">
        ${boite(croquis, 320, 'Le croquis (base de composition)')}
        ${boite(portraitAnime(base), 320, 'Anime · gagné')}
        ${boite(portraitAnime({ ...base, verrouille: true }), 320, 'Anime · à gagner')}
      </div>
      <h3>Porté : le cercle de la finition de son porteur</h3>
      <div class="rang">${FINITIONS_MONTREES.map(([f, nom]) => boite(portraitAnime({ ...base, finition: f }), 96, nom)).join('')}</div>
      <h3>Petites tailles</h3>
      <div class="rang petites">
        ${boite(portraitAnime(base), 44, '44 · large')}
        ${boite(portraitAnime({ ...base, serre: true }), 44, '44 · serré')}
        ${boite(portraitAnime({ ...base, verrouille: true }), 44, '44 · à gagner')}
        ${boite(portraitAnime({ ...base, finition: 'argent' }), 26, '26 · large')}
        ${boite(portraitAnime({ ...base, finition: 'argent', serre: true }), 26, '26 · serré')}
        <figure class="clair"><span class="boite" style="width:44px;height:44px">${portraitAnime(base)}</span><span class="boite" style="width:44px;height:44px">${portraitAnime({ ...base, serre: true })}</span><figcaption>Ivoire</figcaption></figure>
        <div class="classements">${ligneClassement(false)}${ligneClassement(true)}</div>
      </div>
    </section>`
  }).join('')
  const doublure = DOUBLURE
    ? '<p class="doublure">Doublure : aucune image générée. Les croquis tiennent lieu d’images anime, pour éprouver le détourage, le recalage et le cadre.</p>'
    : ''
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Essai anime</title><style>
    body { margin: 0; padding: 28px 36px 48px; background: #16110f; color: #f3ece2; font: 14px/1.45 system-ui, sans-serif; width: 1180px; box-sizing: border-box; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .sous { margin: 0 0 8px; color: #a89b8a; }
    .doublure { margin: 10px 0 0; padding: 8px 12px; border: 1px solid #d9b56a; border-radius: 8px; color: #f0d28a; }
    section { border-top: 1px solid #30251d; margin-top: 26px; padding-top: 18px; }
    h2 { font-size: 20px; margin: 0 0 18px; } h2 small { font-size: 13px; font-weight: 400; color: #a89b8a; margin-left: 8px; }
    h3 { font-size: 13px; font-weight: 600; color: #d9b56a; margin: 26px 0 12px; text-transform: uppercase; letter-spacing: .08em; }
    figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
    figcaption { font-size: 12px; color: #a89b8a; }
    .boite { display: inline-block; line-height: 0; flex: none; }
    .boite svg { width: 100%; height: 100%; overflow: visible; display: block; }
    .rang-grand { display: flex; justify-content: space-between; padding: 40px 30px 4px; }
    .rang { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 26px 34px; padding: 8px 12px; }
    .petites { align-items: center; gap: 22px 30px; }
    .clair { background: #f9f5ec; border-radius: 12px; padding: 10px 14px 8px; flex-direction: row; flex-wrap: wrap; justify-content: center; width: 124px; }
    .clair figcaption { color: #74655a; width: 100%; text-align: center; }
    .classements { display: grid; gap: 6px; }
    .classement { display: grid; grid-template-columns: 18px 26px 90px auto; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 10px; background: rgba(255,255,255,.04); border: 1px solid rgba(217,181,106,.18); font-size: 15px; }
    .classement .rang { padding: 0; color: #d9b56a; font-weight: 700; }
    .classement .pts { color: #a89b8a; font-variant-numeric: tabular-nums; }
  </style>
  <h1>Essai de style anime · les portraits des branches</h1>
  <p class="sous">Option A : les mêmes sujets, les mêmes seuils. Les deux bouts de l’échelle, dans le cadre de l’application : disque, cercle de finition, débord, silhouette à gagner, 320, 44 et 26 px.
  ${DOUBLURE ? '' : ` Images : ${SOURCE ?? `${MODELE}, ${TAILLE}`}.`}</p>${doublure}
  ${sections}</html>`
  writeFileSync(fichier('banc.html'), html)
  writeFileSync(fichier('journal.json'), JSON.stringify(journal, null, 2) + '\n')
}

// ── Le tout ───────────────────────────────────────────────────────────────

const journal: Record<string, unknown> = { date: new Date().toISOString(), doublure: DOUBLURE }
const nav = await chromium.launch({ headless: true })
try {
  const page = await pagePixels(nav)
  console.log('1. Les références')
  await references(page)
  console.log(DOUBLURE ? '2. La génération : en doublure, les croquis' : '2. La génération')
  const decor = await generation(journal)
  console.log('3-4. Le détourage et le recalage')
  const calques = await detourage(page, journal)
  await page.close()
  console.log('5. Le cadre')
  banc(calques, decor, journal)
  const photo = await nav.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 })
  const erreurs: string[] = []
  photo.on('pageerror', (e: Error) => erreurs.push(e.message))
  await photo.goto('file://' + fichier('banc.html'))
  await photo.waitForLoadState('networkidle')
  await photo.screenshot({ path: fichier('banc.png'), fullPage: true })
  if (erreurs.length) console.error(erreurs)
  console.log(fichier('banc.png'))
} catch (e) {
  // Un refus de l'API se lit mieux sans sa pile.
  console.error((e as Error).message)
  process.exitCode = 1
} finally {
  await nav.close()
}
