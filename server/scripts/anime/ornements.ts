// Les ornements de la niche, peints (le souhait du propriétaire, le 19
// octobre 2026 : « Dessinés comme sur la maquette, sans peinture payante et
// aussi des versions vraiment très jolies avec des peintures payantes de
// différents styles ») : dessinés d'abord (`client/src/components/Ornements.tsx`),
// chacun a ses versions peintes, un style chacune, qu'on choisit dans
// « Ma niche » (`StyleDOrnement`, `shared/ornements.ts`).
//
// Un ornement se peint en une pièce (`PIECES`), sur un calque, dans le repère
// de la niche : son arche tracée d'un magenta plus sombre sur un fond magenta
// uni (`CROQUIS`), la pièce en épouse la courbe — la guirlande suit le haut de
// l'arche, le lierre son bas — sans qu'on ait à l'y recaler. Le magenta
// détouré (`pixels.ts`), le tracé avec lui, il reste ce qui se pose sur la
// niche : un carré de 120 × 120 dans les unités de la niche (54 × 62, au
// centre, `REPERE`), que le client pose de même (`--l`). Le halo, lui, est de
// la lumière : peint sur du noir autour de la niche en silhouette
// (`CROQUIS_DE_NUIT`), il perd son noir comme le monde vivant d'un compagnon
// (`livrer-compagnons.ts`) — sur le magenta, sa lueur se serait mêlée au fond,
// et le détourage l'aurait emportée avec lui.
//
// Chaque calque a son plan (`Plan`) : le halo au fond, le lierre derrière la
// niche, l'or de l'arche sur son cadre, sous les lampes qui pendent devant
// lui, et son étoile devant tout — découpée de son cadre (`decoupe`) : d'un
// seul tenant, l'étoile serait passée sous la lampe du sommet, ou l'or devant
// les lampes des flancs.
//
// Ce que le modèle ne tient pas en mots se dessine sur le croquis. Le premier
// lierre, à qui l'on demandait de ne pas monter plus haut qu'un quart de la
// niche, couvrait ses flancs jusqu'en haut, le bas du compagnon et la jauge de
// son rebord : le second a sa zone en pointillés (`zone`), d'un magenta que le
// détourage efface aussi — et touffu encore, il pousse derrière la niche, qui
// le laisse déborder autour d'elle. La première arche, à qui l'on demandait de
// couvrir le tracé, a peint un cadre plus grand que la niche, son bas une main
// sous elle, et une étoile large comme la moitié de la niche : la seconde
// dore un gabarit, le cadre et l'étoile tracés en plein à leur place
// (`gabarit`). Et la guirlande garde sa première peinture, sept lampes, celle
// du sommet sous l'étoile : six lampes sans lampe au sommet ont fait un feston
// d'un bord à l'autre du calque, coupé par lui (le 20 octobre 2026).
//
// L'essai d'abord (`--essai`) : un ornement, ses pièces, en quelques styles
// (`STYLES`), au prix plein, en direct ; puis la planche (`--planche`, sans
// rien payer) : chaque style posé sur la niche de chaque compagnon à sa forme
// ultime, à la taille de « Ma niche » et à celle du coin de la page, à côté du
// dessin — `--ornement=tous`, les quatre ensemble. Les originaux, les calques
// détourés, la planche et le journal des coûts vivent dans
// `../export/ornements/`, hors du dépôt ; une image payée n'est jamais jetée
// (`mettreDeCote`).
//
// La livraison enfin (`--livrer`), pour chaque style peint de
// `STYLES_PEINTS` (`shared/ornements.ts`), peint pour les quatre : chaque
// calque rejoint `client/public/ornements`, nommé par son empreinte — servi
// un an sans revalider (`server.ts`), un ornement repeint change d'adresse —,
// en deux tailles, 512 et 256 pixels pour ses 120 unités ; et
// `client/src/components/ornements-peints.ts` est réécrit.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/ornements.ts --essai --ornement=lierre [--styles=feerique] [--regenerer]
//   npx tsx scripts/anime/ornements.ts --planche [--ornement=tous]   (client construit d'abord)
//   npx tsx scripts/anime/ornements.ts --livrer
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import React from 'react'
import { coutDUneImage, coutEstime, enPartie, formatDe, generer, type Rendu } from './gemini'
import { dansLaPage, deDataUrl, pagePixels } from './pixels'
import { ORNEMENTS, STYLES_PEINTS, type CleDOrnement } from '../../../shared/ornements'

const args = process.argv.slice(2)
const liste = (nom: string) => (args.find(a => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? '').split(',').filter(Boolean)
const MODELE = process.env.MODELE ?? 'gemini-3-pro-image'
/** Le plafond de toute la chaîne, journal compris : au-delà, rien ne part. */
const BUDGET = Number(process.env.BUDGET ?? 1.5)
const racine = path.resolve('../export/ornements')

/**
 * Le repère d'un calque : un carré de 120 unités de niche, la niche (54 × 62)
 * au centre — de quoi laisser sortir l'étoile de l'arche, les feuilles, un
 * halo. Le client le pose à `--l × -33 / 54`, `--l × -29 / 54`, large de
 * `--l × 120 / 54`.
 */
const REPERE = { cote: 120, gauche: 33, haut: 29, largeur: 54, hauteur: 62 }
const PX = 1024 / REPERE.cote

/** L'arche de la niche dans le croquis : son haut en demi-cercle, ses coins du bas arrondis à 12 unités (`styles.css`, `.niche-cadre`). */
function arche(): string {
  const g = REPERE.gauche * PX
  const h = REPERE.haut * PX
  const l = REPERE.largeur * PX
  const H = REPERE.hauteur * PX
  const r = l / 2
  const b = 12 * PX
  return `M${g},${h + r} A${r},${r} 0 0 1 ${g + l},${h + r} L${g + l},${h + H - b} Q${g + l},${h + H} ${g + l - b},${h + H} L${g + b},${h + H} Q${g},${h + H} ${g},${h + H - b} Z`
}

const svg = (corps: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${corps}</svg>`

type Zone = readonly (readonly [number, number])[]

/** Une zone en pointillés, ses points en unités de niche (son coin haut gauche à 0, 0). */
const zoneDuCroquis = (zone: Zone) =>
  `<path d="M${zone.map(([x, y]) => `${((REPERE.gauche + x) * PX).toFixed(1)},${((REPERE.haut + y) * PX).toFixed(1)}`).join(' L')} Z" fill="none" ` +
  `stroke="#b000b0" stroke-width="${(0.8 * PX).toFixed(1)}" stroke-dasharray="${(2 * PX).toFixed(1)} ${(1.5 * PX).toFixed(1)}"/>`

/**
 * Le croquis que reçoit le modèle : la niche tracée d'un magenta sombre — son
 * arche et son rebord — sur le magenta du fond, et la zone de la pièce s'il
 * le faut. Le détourage efface tout cela (un magenta franc, même assombri,
 * est du fond : `pixels.ts`) : il ne reste que ce qu'il a peint autour.
 */
const CROQUIS = (zone?: Zone) => {
  const g = REPERE.gauche * PX
  const l = REPERE.largeur * PX
  const bas = (REPERE.haut + REPERE.hauteur) * PX
  const rebord = 7 * PX
  return svg(
    `<rect width="1024" height="1024" fill="#ff00ff"/>` +
      `<path d="${arche()}" fill="none" stroke="#8a008a" stroke-width="${(1.6 * PX).toFixed(1)}"/>` +
      `<rect x="${g}" y="${bas - rebord}" width="${l}" height="${rebord}" fill="none" stroke="#8a008a" stroke-width="${(1 * PX).toFixed(1)}"/>` +
      (zone ? zoneDuCroquis(zone) : ''),
  )
}

/** Le croquis du halo : la niche en silhouette, d'un bleu de nuit, sur du noir — tout ce qui reste noir deviendra transparent. */
const CROQUIS_DE_NUIT = () => svg(`<rect width="1024" height="1024" fill="#000"/><path d="${arche()}" fill="#1c2540"/>`)

/**
 * Les styles : chacun une phrase pour le modèle. Le Féerique, choisi par le
 * propriétaire le 20 octobre 2026 sur la planche de l'essai de la guirlande,
 * peint les quatre ornements ; les trois autres n'ont servi qu'à cet essai —
 * leur phrase parle de lampes.
 */
const STYLES: Record<string, { nom: string; consigne: string }> = {
  conte: {
    nom: 'Conte aquarellé',
    consigne:
      "a children's storybook illustration: delicate hand-inked outlines, soft transparent watercolor washes, gentle and whimsical, the paper texture faintly visible in the color",
  },
  orfevre: {
    nom: 'Orfèvre',
    consigne:
      "a jeweler's masterpiece: the string is a fine gold chain, and each lamp a tiny cabochon gem — amber, topaz, aquamarine, peridot, citrine — set in gold filigree with touches of enamel, rich specular highlights, like a precious necklace",
  },
  lanternes: {
    nom: 'Lanternes de papier',
    consigne:
      'tiny round Japanese washi paper lanterns hung on a thin twine, warm candlelight glowing through the paper, painterly, cozy festival-night mood, soft edges on the paper',
  },
  feerique: {
    nom: 'Féerique',
    consigne: 'a luminous high-end fantasy digital painting, as in a premium mobile game: rich saturated colors, crisp clean edges, warm magical light, fine golden details',
  },
}

/**
 * Où un calque se pose : au fond, derrière tout (la lumière du halo, qui
 * délavait le lierre posée sur lui) ; derrière la niche ; sur son cadre, sous
 * ce qui pend devant lui ; ou devant elle.
 */
type Plan = 'fond' | 'derriere' | 'cadre' | 'devant'

interface Piece {
  /** L'ornement qu'elle peint, le nom de ses fichiers : `<cle>-<style>`. */
  cle: CleDOrnement
  plan: Plan
  /** Ce qu'elle demande au modèle, dans le repère du croquis. */
  sujet: string
  /** De la lumière, peinte sur du noir (`CROQUIS_DE_NUIT`). */
  nuit?: boolean
  /** Là où elle se tient, en pointillés sur son croquis. */
  zone?: Zone
  /** Son croquis à dorer, ce qu'elle peint tracé en plein à sa place, et ce que la consigne en dit. */
  gabarit?: { croquis: () => string; guide: string }
  /** Ce qui passe au-dessus de `au` (en unités de niche) part dans son propre calque, sur son propre plan. */
  decoupe?: { cle: string; plan: Plan; au: number }
}

/** Une étoile à huit branches, centrée sur (x, y) en unités de niche. */
function etoileDuGabarit(x: number, y: number, r: number): string {
  const points = Array.from({ length: 16 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 8
    const d = k % 2 ? r * 0.5 : r
    return `${((REPERE.gauche + x + Math.cos(a) * d) * PX).toFixed(1)},${((REPERE.haut + y + Math.sin(a) * d) * PX).toFixed(1)}`
  })
  return `M${points.join(' L')} Z`
}

const PIECES: Record<CleDOrnement, Piece> = {
  guirlande: {
    cle: 'guirlande',
    plan: 'devant',
    sujet:
      'Paint ONLY a garland of seven tiny glowing lamps draped along the OUTSIDE of the top curve of this arch: the string follows the curved edge ' +
      'from the left side to the right side, starting and ending about a third of the way down each side, and the seven lamps hang evenly spaced ' +
      'just below the string, slightly overlapping the edge. The lamps are glass bulbs with a bright warm core, in warm gold, amber, pale sky blue, ' +
      'soft lime green and white — no pink, no purple, no magenta —, and a subtle golden rim light runs along the string.',
  },
  lierre: {
    cle: 'lierre',
    plan: 'derriere',
    // Autour du bas de la niche : le long de ses flancs jusqu'au tiers, les deux bouts du rebord, et sous lui — jamais le milieu du rebord, où
    // sa jauge se remplit le temps d'un repas (`.niche-jauge`, de 6 à 48), ni le dedans de l'arche, où le compagnon se tient. Ses bords ne
    // longent pas le tracé de l'arche : les pointillés s'y perdaient.
    zone: [
      [-8, 42],
      [6, 42],
      [6, 64.5],
      [48, 64.5],
      [48, 42],
      [62, 42],
      [62, 71],
      [-8, 71],
    ],
    sujet:
      'Paint ONLY ivy and little flowers around the bottom of this niche, kept strictly INSIDE the dashed zone, which wraps around the bottom of ' +
      'the niche — up the outside of each side, over the two ends of the ledge, and along under its bottom edge: two small lush clusters at the ' +
      'bottom corners, where the ivy spills over the ends of the ledge and climbs a little way up the outside of each side, joined by a thin ' +
      'trailing vine with a few small leaves hanging just under the bottom edge. Tucked among the glossy fresh green leaves, a few small ' +
      'five-petaled flowers in white, cream and pale butter yellow with golden hearts, and a few tiny sky-blue forget-me-nots — no pink, no ' +
      'purple, no magenta. Nothing outside the dashed zone: the middle of the ledge and the whole inside of the arch above it stay empty.',
  },
  arche: {
    cle: 'arche',
    plan: 'cadre',
    // Le cadre, une bande de 3,2 unités centrée sur le bord de la niche ; l'étoile, où la dessine `Ornements.tsx`, un peu plus haut : la lampe
    // du sommet de la guirlande pend sous elle.
    gabarit: {
      croquis: () =>
        svg(
          `<rect width="1024" height="1024" fill="#ff00ff"/>` +
            `<path d="${arche()}" fill="none" stroke="#8a008a" stroke-width="${(3.2 * PX).toFixed(1)}"/>` +
            `<path d="${etoileDuGabarit(REPERE.largeur / 2, -10, 5.5)}" fill="#8a008a"/>`,
        ),
      guide:
        'The attached image is a layout guide on a flat chroma-key magenta background (#FF00FF): the dark band traces the outline of a small ' +
        'arched niche — a window with a semicircular top —, and the dark eight-pointed star sits just above its top.',
    },
    // Entre le bas de l'étoile (-4,5) et le haut du cadre (-1,6).
    decoupe: { cle: 'etoile', plan: 'devant', au: -3 },
    sujet:
      'Paint ONLY over these two dark shapes, in polished gold, keeping exactly their shapes, positions and sizes — the gold covers them ' +
      'completely and goes no further: the band becomes an ornate gilded frame, a slim moulding with fine engraved filigree and a few tiny inset ' +
      'gems in warm amber and pale sky blue; the star becomes a faceted golden star with a bright warm-white heart, without rays beyond its points.',
  },
  halo: {
    cle: 'halo',
    plan: 'fond',
    nuit: true,
    sujet:
      'Paint ONLY a halo of light around this niche: a soft radiant aura of warm golden light that hugs its outline, brightest along the top ' +
      "curve, and fades smoothly into the black within a short distance — about a quarter of the niche's width —, with a few delicate short " +
      'rays fanning out from the top and a sprinkling of tiny glittering four-pointed stars and motes of light within the glow.',
  },
}

/** Les calques d'une pièce : le sien, et celui de sa découpe. */
const calquesDe = (p: Piece) => [{ cle: p.cle as string, plan: p.plan }, ...(p.decoupe ? [{ cle: p.decoupe.cle, plan: p.decoupe.plan }] : [])]

const consigne = (p: Piece, style: string) =>
  p.nuit
    ? 'The attached image is a layout guide on a pure black background (#000000): the dark blue shape is a small arched niche — a window with ' +
      'a semicircular top. ' +
      `${p.sujet} Style: ${STYLES[style].consigne}. ` +
      'Leave the dark blue shape exactly as it is — do not paint over it or inside it: the light surrounds it. Everything that is not light ' +
      'stays pure black (#000000), edge to edge — no scenery, no frame, no texture. No text, no letters. Output one square image (1:1 aspect ratio).'
    : (p.gabarit
        ? `${p.gabarit.guide} `
        : 'The attached image is a layout guide on a flat chroma-key magenta background (#FF00FF): the darker magenta line traces the edge of a ' +
          'small arched niche — a window with a semicircular top — and the thin rectangle at its bottom marks its ledge' +
          (p.zone ? '; the lighter dashed line only marks a zone. ' : '. ')) +
      `${p.sujet} Style: ${STYLES[style].consigne}. ` +
      (p.gabarit
        ? 'Do not draw anything inside the arch: it stays the same flat magenta as the background. '
        : 'Do not draw the niche itself, its frame, its ledge or anything inside it: the inside of the arch stays the same flat magenta as the ' +
          'background, and the guide lines must stay exactly as they are. ') +
      'Keep the whole background a single perfectly flat, uniform chroma-key magenta (#FF00FF) edge to edge — no shadow, no glow or light halo ' +
      'on the background, no sparkles, no scenery. Do not use any pink, purple or magenta on the ornament. No text, no letters. Output one ' +
      'square image (1:1 aspect ratio).'

// ── Le journal ────────────────────────────────────────────────────────────

const cheminJournal = path.join(racine, 'journal-ornements.jsonl')
const lireJournal = (): { nom: string; cout?: number }[] =>
  existsSync(cheminJournal)
    ? readFileSync(cheminJournal, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l))
    : []
const depense = () => lireJournal().reduce((n, e) => n + (e.cout ?? 0), 0)

/** Met une image payée de côté, datée : on ne jette jamais ce qui a coûté. */
function mettreDeCote(f: string) {
  if (!existsSync(f)) return
  const ext = path.extname(f)
  renameSync(f, f.slice(0, -ext.length) + `.ancien-${Date.now()}${ext}`)
}

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'rendu.js'))('playwright')
}

const original = (cle: string, style: string) => path.join(racine, 'originaux', `${cle}-${style}`)
const calque = (cle: string, style: string) => path.join(racine, 'calques', `${cle}-${style}.png`)
const trouve = (base: string) => ['png', 'jpg', 'webp'].map(e => `${base}.${e}`).find(f => existsSync(f))

/** Peint l'essai : chaque pièce, en chaque style, qui n'a pas encore son image (ou toutes, `--regenerer`). */
async function essai(pieces: Piece[], styles: string[]) {
  mkdirSync(path.join(racine, 'originaux'), { recursive: true })
  const croquis = (p: Piece) => path.join(racine, p.nuit ? 'croquis-nuit.png' : p.zone || p.gabarit ? `croquis-${p.cle}.png` : 'croquis.png')
  const nav = await chargerPlaywright().chromium.launch()
  try {
    // Les croquis, photographiés une fois : le modèle reçoit une image, pas un SVG.
    const page = await nav.newPage({ viewport: { width: 1024, height: 1024 } })
    for (const p of pieces) {
      await page.setContent(`<!doctype html><body style="margin:0">${p.nuit ? CROQUIS_DE_NUIT() : p.gabarit ? p.gabarit.croquis() : CROQUIS(p.zone)}</body>`)
      await page.screenshot({ path: croquis(p), clip: { x: 0, y: 0, width: 1024, height: 1024 } })
    }
    await page.close()
  } finally {
    await nav.close()
  }
  const aFaire = pieces.flatMap(p => styles.map(style => ({ p, style }))).filter(({ p, style }) => args.includes('--regenerer') || !trouve(original(p.cle, style)))
  const prevu = aFaire.length * coutDUneImage(MODELE)
  if (depense() + prevu > BUDGET) throw new Error(`Budget : ${depense().toFixed(2)} $ dépensés, ${prevu.toFixed(2)} $ prévus — au-delà de ${BUDGET} $.`)
  for (const { p, style } of aFaire) {
    const base = original(p.cle, style)
    const avant = trouve(base)
    if (avant) mettreDeCote(avant)
    console.log(`  ${p.cle} · ${STYLES[style].nom}…`)
    const r: Rendu = await generer([enPartie(croquis(p)), { text: consigne(p, style) }], { modele: MODELE, taille: '1K', format: '1:1' })
    writeFileSync(`${base}.${formatDe(r.image).ext}`, r.image)
    const cout = coutEstime(r.jetons, { modele: MODELE })
    appendFileSync(cheminJournal, JSON.stringify({ nom: `${p.cle}-${style}`, date: new Date().toISOString(), modele: MODELE, jetons: r.jetons, cout }) + '\n')
    console.log(`    ${r.secondes.toFixed(0)} s · ${cout.toFixed(3)} $ — ${depense().toFixed(2)} $ en tout`)
  }
}

/**
 * La lumière sans son noir (le halo) : chaque pixel garde sa couleur, portée
 * au plus clair, et prend son éclat pour opacité, par paliers de huit — la
 * règle du monde vivant des compagnons (`livrer-compagnons.ts`) : sans eux,
 * une lueur pèse lourd dans le WebP ; presque noir, il disparaît (le bruit de
 * la compression). Le dedans de la niche, que tenait sa silhouette, s'efface :
 * elle le cache, et son bleu de nuit, devenu lumière, l'aurait teinté.
 */
const LUMIERE = String.raw`
function oterLeNoir(c, chemin) {
  const l = c.width, h = c.height, x = c.getContext('2d', { willReadFrequently: true })
  const d = x.getImageData(0, 0, l, h), p = d.data
  let transparents = 0
  for (let k = 0; k < p.length; k += 4) {
    const a = Math.max(p[k], p[k + 1], p[k + 2])
    if (a < 12) { p[k] = p[k + 1] = p[k + 2] = p[k + 3] = 0; transparents++; continue }
    p[k] = Math.round((p[k] * 255) / a); p[k + 1] = Math.round((p[k + 1] * 255) / a); p[k + 2] = Math.round((p[k + 2] * 255) / a)
    p[k + 3] = Math.min(255, Math.round(a / 8) * 8)
  }
  x.putImageData(d, 0, 0)
  x.save()
  x.scale(l / 1024, h / 1024)
  x.globalCompositeOperation = 'destination-out'
  x.fill(new Path2D(chemin))
  x.restore()
  return transparents / (l * h)
}
async function sansSonNoir(src, chemin) {
  const img = await charger(src)
  const c = toile(img.naturalWidth, img.naturalHeight)
  c.getContext('2d').drawImage(img, 0, 0)
  const transparents = oterLeNoir(c, chemin)
  return { plein: c.toDataURL('image/png'), transparents }
}
// À livrer, la lumière se réduit sur son noir, puis le perd : réduite après coup, elle retrouvait des opacités entre ses paliers.
async function lumiereReduite(src, cote, chemin, qualite) {
  const img = await charger(src)
  const plein = toile(img.naturalWidth, img.naturalHeight)
  plein.getContext('2d').drawImage(img, 0, 0)
  const c = reduire(plein, cote)
  oterLeNoir(c, chemin)
  return c.toDataURL('image/webp', qualite)
}
async function calqueReduit(src, cote, qualite) {
  const img = await charger(src)
  const plein = toile(img.naturalWidth, img.naturalHeight)
  plein.getContext('2d').drawImage(img, 0, 0)
  return reduire(plein, cote).toDataURL('image/webp', qualite)
}
// Un calque coupé en deux à la hauteur y (dans le repère de 1024) : chaque moitié garde le repère entier.
async function couper(src, y) {
  const img = await charger(src)
  const l = img.naturalWidth, h = img.naturalHeight, k = Math.round((y * h) / 1024)
  const dessus = toile(l, h), dessous = toile(l, h)
  dessus.getContext('2d').drawImage(img, 0, 0, l, k, 0, 0, l, k)
  dessous.getContext('2d').drawImage(img, 0, k, l, h - k, 0, k, l, h - k)
  return { dessus: dessus.toDataURL('image/png'), dessous: dessous.toDataURL('image/png') }
}
`

/** Détoure chaque original : le magenta et le tracé de la niche s'en vont — le noir, pour la lumière —, il reste la pièce, dans son repère. */
async function detourer(pieces: Piece[], styles: string[]) {
  mkdirSync(path.join(racine, 'calques'), { recursive: true })
  const nav = await chargerPlaywright().chromium.launch()
  try {
    const page = await pagePixels(nav)
    await page.addScriptTag({ content: LUMIERE })
    for (const p of pieces)
      for (const style of styles) {
        const f = trouve(original(p.cle, style))
        if (!f) continue
        const src = `data:${formatDe(readFileSync(f)).mime};base64,${readFileSync(f).toString('base64')}`
        const r = p.nuit
          ? await dansLaPage<{ plein: string; transparents: number; bordFaux?: boolean }>(page, 'sansSonNoir', src, arche())
          : await dansLaPage<{ plein: string; transparents: number; bordFaux: boolean }>(page, 'detourer', src, null, [255, 0, 255], false)
        if (p.decoupe) {
          const { dessus, dessous } = await dansLaPage<{ dessus: string; dessous: string }>(page, 'couper', r.plein, (REPERE.haut + p.decoupe.au) * PX)
          writeFileSync(calque(p.decoupe.cle, style), deDataUrl(dessus))
          writeFileSync(calque(p.cle, style), deDataUrl(dessous))
        } else writeFileSync(calque(p.cle, style), deDataUrl(r.plein))
        console.log(`  ${p.cle} · ${STYLES[style].nom} : ${(r.transparents * 100).toFixed(0)} % transparent${r.bordFaux ? ' — ⚠ bord douteux' : ''}`)
      }
  } finally {
    await nav.close()
  }
}

/**
 * La planche : chaque compagnon à sa forme ultime, dans sa niche — le dessin,
 * puis chaque style peint —, en grand (« Ma niche ») et au coin de la page,
 * sous la vraie feuille de style du client construit. Les calques s'y posent
 * comme dans l'application : dans un SVG à la taille de la niche, qui déborde
 * sans élargir la page, chacun à son plan — et l'or de l'arche sous les siens.
 */
async function planche(ornements: CleDOrnement[], styles: string[], nom: string) {
  const client = path.resolve('../client')
  const css = readdirSync(path.join(client, 'dist/assets')).find(f => /^index-.*\.css$/.test(f))
  if (!css) throw new Error('Le client n’est pas construit : npm run build -w client')
  // Le vrai composant du client, rendu ici comme dans les tests : la planche montre la niche telle qu'elle est.
  Object.assign(globalThis, { React })
  const { NicheEnMiniature } = await import(new URL('../../../client/src/components/Niche.tsx', import.meta.url).href)
  const { renderToStaticMarkup } = await import('react-dom/server')
  const formes = ['loup', 'chat', 'tortue', 'luciole'].map(compagnon => ({ compagnon, rang: 3 }))
  const publics = `file://${path.join(client, 'public')}`
  const calques = ornements.flatMap(o => calquesDe(PIECES[o]))
  const couche = (style: string, plan: Plan) => {
    const images = calques
      .filter(c => c.plan === plan)
      .map(c => `<image href="file://${calque(c.cle, style)}" x="-${REPERE.gauche}" y="-${REPERE.haut}" width="${REPERE.cote}" height="${REPERE.cote}"/>`)
      .join('')
    return images ? `<svg class="niche-ornements" viewBox="0 0 ${REPERE.largeur} ${REPERE.hauteur}" aria-hidden="true">${images}</svg>` : ''
  }
  const niche = (f: object, taille: number, style?: string) => {
    // Dessinée, la niche ne montre que ces ornements-là, dessinés ; peinte, aucun ornement du client : les calques de l'essai seuls.
    const vue = style ? f : { ...f, paliers: ORNEMENTS.length, ornements: Object.fromEntries(ORNEMENTS.map(x => [x.key, ornements.includes(x.key) ? 'dessin' : 'cache'])) }
    let html: string = renderToStaticMarkup(React.createElement(NicheEnMiniature, { niche: vue as never, taille }))
    if (style) {
      if (ornements.includes('arche')) html = html.replace('class="niche-cadre"', 'class="niche-cadre orne-or"')
      // React 19 fait précéder la niche des `<link rel="preload">` de ses images : elle ne commence pas la chaîne.
      html = html
        .replace(/(<span class="niche-mini[^>]*>)/, `$1${couche(style, 'fond')}${couche(style, 'derriere')}`)
        .replace(/<\/span>$/, `${couche(style, 'cadre')}${couche(style, 'devant')}</span>`)
    }
    return html.replaceAll('src="/', `src="${publics}/`).replaceAll('url(/', `url(${publics}/`)
  }
  const colonnes = [
    { titre: 'Dessin', style: undefined as string | undefined },
    ...styles.filter(s => calques.every(c => existsSync(calque(c.cle, s)))).map(s => ({ titre: STYLES[s].nom, style: s })),
  ]
  const lignes = formes
    .map(f => `<tr>${colonnes.map(c => `<td><div class="grand">${niche(f, 108, c.style)}</div><div class="petit">${niche(f, 54, c.style)}</div></td>`).join('')}</tr>`)
    .join('')
  const titre =
    ornements.length === 1 ? `${ORNEMENTS.find(x => x.key === ornements[0])!.titre} — ${ORNEMENTS.find(x => x.key === ornements[0])!.nom}` : 'La légende — ses quatre ornements ensemble'
  const html =
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><link rel="stylesheet" href="file://${path.join(client, 'dist/assets', css)}">` +
    `<style>body{margin:0;padding:24px;background:#1c1512;color:#f3e6d0;font-family:system-ui,sans-serif}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 18px;color:#c8b49a;font-size:13px}` +
    `table{border-collapse:separate;border-spacing:18px 22px}th{font-size:13px;font-weight:600;text-align:center;color:#f3d27a}td{vertical-align:middle;text-align:center}` +
    `.grand,.petit{display:inline-flex;align-items:center;justify-content:center;padding:34px 30px 26px}.grand{min-width:150px}.petit{min-width:90px}` +
    `.niche-mini{display:inline-block}</style></head><body>` +
    `<h1>${titre}</h1><p>Chaque compagnon à sa forme ultime : en grand, comme dans « Ma niche » ; à côté, à la taille du coin de la page.</p>` +
    `<table><tr>${colonnes.map(c => `<th>${c.titre}</th>`).join('')}</tr>${lignes}</table></body></html>`
  const page_ = path.join(racine, `planche-${nom}.html`)
  writeFileSync(page_, html)
  const nav = await chargerPlaywright().chromium.launch()
  try {
    const page = await nav.newPage({ viewport: { width: 330 * colonnes.length + 80, height: 900 }, deviceScaleFactor: 2 })
    await page.goto(`file://${page_}`)
    await page.waitForLoadState('networkidle')
    await page.evaluate('Promise.all([...document.images].map(i => i.decode().catch(() => {})))')
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(racine, `planche-${nom}.png`), fullPage: true })
  } finally {
    await nav.close()
  }
  console.log(`planche : ${path.join(racine, `planche-${nom}.png`)}`)
}

// ── La livraison ──────────────────────────────────────────────────────────

const publics = path.resolve('../client/public/ornements')
const module_ = path.resolve('../client/src/components/ornements-peints.ts')
/** La qualité des compagnons (`livrer-compagnons.ts`) : la petite taille ne se dégrade pas plus que la grande. */
const QUALITE = 0.86
const TAILLES = [512, 256] as const

const empreinte = (donnees: Buffer) => createHash('sha256').update(donnees).digest('hex').slice(0, 10)

/** Pose des octets sous leur empreinte ; rend leur adresse. */
function poser(donnees: Buffer, nom: string): string {
  const final = `${nom}.${empreinte(donnees)}.webp`
  writeFileSync(path.join(publics, final), donnees)
  return `/ornements/${final}`
}

/**
 * Livre chaque style peint, entier — les quatre ornements, chacun tous ses
 * calques — ou rien : un style à moitié peint montrerait la moitié de la
 * légende. Les deux tailles se tirent chacune de l'image d'origine, et ce que
 * plus personne ne cite part.
 */
async function livrer() {
  const manque = STYLES_PEINTS.flatMap(style => ORNEMENTS.flatMap(o => calquesDe(PIECES[o.key]).filter(c => !existsSync(calque(c.cle, style))).map(c => `${c.cle}-${style}`)))
  if (manque.length) throw new Error(`Rien n’est livré, il manque ${manque.join(', ')} : --essai d’abord.`)
  mkdirSync(publics, { recursive: true })
  const livres: Record<string, Record<string, { plan: Plan; fichiers: string[] }[]>> = {}
  const nav = await chargerPlaywright().chromium.launch()
  try {
    const page = await pagePixels(nav)
    await page.addScriptTag({ content: LUMIERE })
    const enDataUrl = (f: string) => `data:${formatDe(readFileSync(f)).mime};base64,${readFileSync(f).toString('base64')}`
    for (const style of STYLES_PEINTS) {
      livres[style] = {}
      for (const o of ORNEMENTS) {
        const p = PIECES[o.key]
        livres[style][o.key] = []
        for (const c of calquesDe(p)) {
          const fichiers: string[] = []
          for (const cote of TAILLES) {
            // La lumière repart de son original sur noir ; le reste, de son calque détouré.
            const webp = p.nuit
              ? await dansLaPage<string>(page, 'lumiereReduite', enDataUrl(trouve(original(p.cle, style))!), cote, arche(), QUALITE)
              : await dansLaPage<string>(page, 'calqueReduit', enDataUrl(calque(c.cle, style)), cote, QUALITE)
            fichiers.push(poser(deDataUrl(webp), `${c.cle}-${style}-${cote}`))
          }
          livres[style][o.key].push({ plan: c.plan, fichiers })
          console.log(`  ${c.cle} · ${STYLES[style].nom} : ${fichiers.map(f => path.basename(f)).join(', ')}`)
        }
      }
    }
  } finally {
    await nav.close()
  }
  const bloc = (style: string) =>
    `  ${style}: {\n` +
    ORNEMENTS.map(
      o =>
        `    ${o.key}: [\n` +
        livres[style][o.key].map(c => `      { plan: '${c.plan}', fichiers: ['${c.fichiers[0]}', '${c.fichiers[1]}'] },\n`).join('') +
        `    ],\n`,
    ).join('') +
    `  },\n`
  writeFileSync(
    module_,
    `// Les ornements de la niche, peints : les calques de chaque style, chacun
// en deux tailles, \`[grande, petite]\`, et le plan où il se pose — au fond,
// derrière la niche, sur son cadre (sous ce qui pend devant lui), ou devant
// elle —, dans l'ordre où ils se posent.
//
// Peints en images par \`server/scripts/anime/ornements.ts\`, chacun dans le
// repère d'un calque : un carré de 120 unités de niche, la niche (54 × 62) au
// centre, que \`Ornements.tsx\` pose de même.
//
// Écrit par \`server/scripts/anime/ornements.ts --livrer\` : on ne le retouche
// pas à la main, on relance la chaîne. Les fichiers sont dans
// \`client/public/ornements\`, nommés par leur empreinte : un ornement repeint
// change d'adresse, et aucun téléphone ne garde l'ancien.
import type { CleDOrnement, StylePeint } from '../../../shared/ornements'

/** Où un calque se pose : au fond, derrière la niche, sur son cadre, ou devant elle. */
export type PlanDUnCalque = 'fond' | 'derriere' | 'cadre' | 'devant'

export interface CalquePeint {
  plan: PlanDUnCalque
  /** \`[grande, petite]\` : ${TAILLES[0]} et ${TAILLES[1]} pixels pour les 120 unités du calque. */
  fichiers: readonly [string, string]
}

export const ORNEMENTS_PEINTS: Readonly<Record<StylePeint, Readonly<Record<CleDOrnement, readonly CalquePeint[]>>>> = {
${STYLES_PEINTS.map(bloc).join('')}}
`,
  )
  // Ce que plus personne ne cite part : un ornement repeint, un style retiré.
  const cites = new Set(Object.values(livres).flatMap(s => Object.values(s).flatMap(cs => cs.flatMap(c => c.fichiers.map(f => path.basename(f))))))
  for (const f of readdirSync(publics)) if (!cites.has(f)) rmSync(path.join(publics, f))
  console.log(`livrés dans ${path.relative(path.resolve('..'), publics)} : ${cites.size} fichiers, ${path.relative(path.resolve('..'), module_)} réécrit`)
}

const demande = liste('ornement')[0] ?? 'guirlande'
const ornements = (demande === 'tous' ? ORNEMENTS.map(o => o.key) : [demande]) as CleDOrnement[]
for (const o of ornements) if (!PIECES[o]) throw new Error(`Pas d’ornement « ${o} ».`)
const pieces = ornements.map(o => PIECES[o])
const styles = liste('styles').length ? liste('styles') : Object.keys(STYLES)
for (const s of styles) if (!STYLES[s]) throw new Error(`Style inconnu : ${s}`)
mkdirSync(racine, { recursive: true })
if (args.includes('--essai')) {
  if (demande === 'tous') throw new Error('L’essai se paie ornement par ornement : --ornement=guirlande, lierre, arche ou halo.')
  await essai(pieces, styles)
}
if (args.includes('--essai') || args.includes('--planche')) {
  await detourer(pieces, styles)
  await planche(ornements, styles, demande)
}
if (args.includes('--livrer')) await livrer()
console.log(`${depense().toFixed(2)} $ dépensés en tout pour les ornements (budget ${BUDGET} $).`)
