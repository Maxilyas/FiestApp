// Les compagnons peints — le pilote : le loup.
//
// Un compagnon s'achète en boutique à sa première forme, puis grandit avec les
// bonnes réponses données en le portant (100, 300, 500 : le choix du 13
// octobre 2026). Quatre formes du même individu, chacune plus riche que la
// précédente : le louveteau seul sur son disque, le jeune loup dans son décor,
// l'adulte qui sort du cercle, la forme ultime et son aura. À chaque forme,
// quatre expressions, que la révélation montre (neutre, ravi, dépité,
// triomphant) ; l'Éclat, une métamorphose de la forme ultime ; et la pose du
// bond de son entrée en scène à l'écran commun. Jamais de feuille d'or : elle
// reste la signature des légendaires.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/compagnons.ts loup                 # l'essai des styles
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/compagnons.ts loup --style=cine3d  # puis tout le reste, dans ce style
//   … --regenerer=adulte,adulte-ravi   # repayer ces images, et ce qui part d'elles
//
// Une expression ne se pose pas sur une illustration qui porte déjà le loup
// neutre : la tête baissée du dépité laissait voir l'autre derrière elle. Le
// disque est donc le décor seul — le loup effacé, le décor refait à sa place
// —, et chaque expression, détourée, se pose dessus.
//
// Le pilote se paie au prix plein, en direct (`generer`) : un lot coûte moitié
// moins, mais revient en minutes ou en heures, et chaque passe attend la
// précédente — la planche, la forme, sa découpe, ses expressions : cinq lots
// à la file faisaient une demi-journée pour une planche à juger. Il ne livre
// rien à l'application : ses fichiers restent dans `export/compagnons/`, hors
// du dépôt.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { coutEstime, enPartie, formatDe, generer, type FormatDImage, type Partie, type Rendu } from './gemini'
import { dansLaPage, deDataUrl, pagePixels } from './pixels'

const args = process.argv.slice(2)
const ID = args.find(a => !a.startsWith('--')) ?? ''
const STYLE = args.find(a => a.startsWith('--style='))?.slice('--style='.length)
const MODELE = process.env.MODELE ?? 'gemini-3-pro-image'
const TAILLE = process.env.TAILLE ?? '1K'
/** Le plafond, en dollars, de tout ce que le journal a payé : au-delà, rien ne part. */
const BUDGET = Number(process.env.BUDGET ?? 6)
/** Au prix plein, une image coûte environ 0,14 $, pensée comprise : de quoi tenir le budget avant de payer. */
const PRIX_D_UNE_IMAGE = 0.14
/** Des images à la fois : quatre tiennent sous le débit de l'API, une à une la planche prenait vingt minutes. */
const EN_MEME_TEMPS = 4
const liste = (nom: string) => (args.find(a => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? '').split(',').filter(Boolean)

// ── Les consignes ─────────────────────────────────────────────────────────
// En anglais, comme celles des portraits et des légendaires.

/**
 * Les styles essayés sur la planche de modèle : aucun des douze des branches
 * (`consignes.ts`), ni l'épopée dorée des légendaires.
 */
export const STYLES: Record<string, { nom: string; consigne: string }> = {
  cine3d: {
    nom: 'Le film d’animation',
    consigne:
      'Style: a still from a premium 3D animated feature film — soft, tactile fur with subsurface light, big soulful and expressive eyes, ' +
      'appealing stylized proportions, cinematic rim light and gentle bloom, rich but harmonious colors. Charming and majestic at once.',
  },
  lumineux: {
    nom: 'La peinture lumineuse',
    consigne:
      'Style: a luminous painterly digital illustration — visible soft brush strokes, glowing magical light, a dreamy atmosphere with floating ' +
      'motes of light, a refined jewel-tone palette (deep blues, silver, soft teal).',
  },
  encre: {
    nom: 'L’encre et l’aquarelle',
    consigne:
      'Style: a Japanese ink-wash painting (sumi-e) with delicate watercolor accents — confident, expressive brush strokes, wet ink bleeds and ' +
      'dry-brush fur, generous negative space, rice-paper texture, touches of indigo and silver-blue.',
  },
}

const ORIGINAL = 'An original character design: imitate no existing film, studio, game or character. No gold leaf, no gilding.'

// Le fond uni d'une découpe : vert, sauf pour qui porte du vert — l'aurore de
// l'Éclat. Sur du vert, le modèle assombrissait le fond pour garder ce qui lui
// ressemblait, et le détourage perçait l'émeraude (`legendaires.ts`).
const CHROMAS = {
  vert: { nom: 'chroma-key green', hex: '#00FF00', rvb: [0, 255, 0], proscrit: 'green' },
  magenta: { nom: 'chroma-key magenta', hex: '#FF00FF', rvb: [255, 0, 255], proscrit: 'pink, magenta or violet' },
} as const
type Chroma = keyof typeof CHROMAS

const fondUni = (c: Chroma) =>
  `a single perfectly flat, uniform ${CHROMAS[c].nom} (${CHROMAS[c].hex}) filling the canvas edge to edge — no gradient, no texture, no floor, ` +
  'no cast shadow, no glow or light spilling onto it, no vignette'

const AVATAR =
  'Square avatar illustration for a party quiz game: a collectible companion that a player buys and raises, shown at one of its four forms, ' +
  'each richer than the one before. It must read instantly even as a tiny round icon: a strong silhouette, big clear shapes, the face well lit. ' +
  'No text, no letters, no numbers, no signature, no watermark, no frame, no border, no round badge, no drawn circle, no vignette. ' +
  'Output one square image (1:1 aspect ratio).'

const REFERENCE =
  'The attached image is this companion’s model sheet: the same individual at four ages, from left to right. Paint exactly this individual, ' +
  'in exactly the style of the sheet — its coat colors and markings, its eyes, its proportions at this age.'

const RANGS = ['first', 'second', 'third', 'fourth']

const DECOR_SEUL =
  'Edit the attached illustration: remove the animal entirely, with its shadow, and repaint the setting where it stood, continuing naturally ' +
  'what lies behind it — the same place, the same light, the same style. Change nothing else: same composition, same colors, same details. ' +
  'No animal, no creature, no character, no text, no frame. Output one square image (1:1 aspect ratio).'

const DECOUPE = (garde: string, retirer: string, c: Chroma) =>
  `Edit the attached image. Keep ${garde} exactly as it is — same pose, same position, same size, same outline, same colors and details, untouched. ` +
  `Replace everything else with ${fondUni(c)}. In particular, replace ${retirer} with the flat color. ` +
  'Do not move, resize, crop, redraw or restyle what you keep. Output one square image (1:1 aspect ratio).'

/** Les trois expressions qui se repeignent ; la neutre est la forme elle-même. */
export const EXPRESSIONS = {
  ravi: 'JOYFUL — bright smiling eyes, mouth open in a happy grin with the tongue just showing, ears perked up, tail raised and wagging',
  depite:
    'DISAPPOINTED, in a cute and gentle way, never tragic — ears folded back, head a little lowered, big sad eyes looking up, ' +
    'mouth closed in a small pout, tail hanging low',
  triomphe: 'TRIUMPHANT — chest puffed out, head held high, mouth open in a proud victory howl toward the sky, ears up, tail raised like a banner',
} as const
type Expression = keyof typeof EXPRESSIONS

// Le corps ne bouge pas : seule la tête, la queue et la mine changent. Sinon,
// d'une révélation à l'autre, le loup sautait sur son disque.
const EXPRESSION = (quoi: string, c: Chroma) =>
  'Edit the attached image: the same animal — the same individual, at the same place, at the same size, its body and paws where they are, ' +
  `with the same colors, light, style and fur details — and change only its expression and attitude: ${quoi}. ` +
  `Only the head, ears, eyes, mouth and tail may move. Keep the background ${fondUni(c)}. Do not use any ${CHROMAS[c].proscrit} on the animal. ` +
  'No text, no frame. Output one square image (1:1 aspect ratio).'

// ── Le loup ───────────────────────────────────────────────────────────────

interface Forme {
  id: string
  /** Sa scène ; aucune pour la première forme, peinte seule sur un fond uni. */
  decor?: string
  /** Ce qui sort du disque par le haut, s'il en sort : sans le dire, le modèle ramène tout dans le cadre. */
  deborde?: string
  /** Sa place dans le cadre, quand elle dit son âge. */
  taille?: string
  /** Ce que sa découpe garde, et ce qu'elle retire. */
  garde: string
  retirer?: string
}

interface Compagnon {
  id: string
  /** Ce qui le fait reconnaître d'une forme à l'autre, et d'un autre loup. */
  identite: string
  /** Ses quatre âges, tels que la planche de modèle les montre, de gauche à droite. */
  ages: [string, string, string, string]
  formes: [Forme, Forme, Forme, Forme]
  /** La métamorphose de l'Éclat, repeinte sur la forme ultime. */
  eclat: { consigne: string; garde: string; retirer: string }
  /** La pose de son entrée en scène, repeinte sur la découpe de la forme ultime. */
  bond: string
}

const LOUP: Compagnon = {
  id: 'loup',
  // Le loup de la forêt (`br:loup`) est un loup gris en papier découpé qui hurle
  // à la lune : celui-ci ne doit jamais lui ressembler.
  identite:
    'Its identity never changes from one age to the next: a silver-white coat; a deep midnight-blue saddle along its back, running down to the ' +
    'tip of its tail; a cream-white chest ruff; a small white crescent-moon mark on its forehead; warm amber-gold eyes; a dark nose. ' +
    'It must look nothing like a plain grey timber wolf.',
  ages: [
    'a tiny newborn wolf cub, round and fluffy, with oversized paws and ears',
    // « Un jeune loup élancé » revenait adulte : le même loup que la forme
    // d'après, dans un autre décor, et l'on ne voyait pas grandir le sien.
    'a half-grown young wolf, visibly younger and smaller than the adult — a slim, lanky body on long legs, oversized paws and big ears, ' +
      'fluffy juvenile fur, a shorter muzzle and a round, curious face',
    'the adult wolf, strong, noble and calm',
    'its mythic ultimate form — larger and majestic, its fur shimmering with starlight, the midnight-blue saddle turned into a starry night sky ' +
      'with small constellations, the crescent mark on its forehead glowing softly',
  ],
  formes: [
    { id: 'louveteau', garde: 'the wolf cub' },
    {
      id: 'jeune',
      decor: 'a snowy pine forest clearing at blue hour, soft falling snow, a few tiny warm lights floating between the trees like fireflies',
      taille: 'It is still small: it fills only about 55% of the canvas height, with plenty of setting around it.',
      garde: 'the young wolf — its head, ears, body, legs, paws and tail',
      retirer: 'the trees, the snowy ground, the falling snow, the floating lights and the sky',
    },
    {
      id: 'adulte',
      decor: 'a rocky ridge high above a sea of clouds at night, a huge full moon low behind it, cold silver light',
      deborde: 'its raised head and pricked ears',
      garde: 'the wolf — its head, ears, body, legs, paws and tail',
      retirer: 'the rock, the clouds, the moon and the sky',
    },
    {
      id: 'ultime',
      decor: 'a high summit under a vast night sky crowded with stars and a giant crescent moon, ribbons of starlight swirling around the wolf',
      deborde: 'its head, its ears and a plume of starlight rising from its mane',
      garde: 'the wolf with the starlight in its fur and mane',
      retirer: 'the summit, the sky, the moon, the stars and the ribbons of starlight around it',
    },
  ],
  eclat: {
    consigne:
      'Edit the attached illustration into its rare variant, a metamorphosis a player may find once in forty evenings: keep exactly the same ' +
      'composition, pose, framing, scale and level of detail, the same individual and its crescent mark — and move it into another world. ' +
      'Its fur becomes flowing ribbons of aurora light, emerald, teal and cyan, translucent and glowing from within; the starry saddle turns into ' +
      'a living aurora; the crescent mark on its forehead becomes a bright white star. The summit is now blue ice, and the sky behind is a deep ' +
      'teal polar night lit by a great curtain of green and cyan aurora, the moon a pale cyan crescent. The same painting style. ' +
      'Do not use any pink, magenta or violet. No gold leaf, no text, no frame. Output one square image (1:1 aspect ratio).',
    garde: 'the aurora wolf with the glowing ribbons of its fur and mane',
    retirer: 'the ice summit, the sky, the aurora curtain, the moon and the stars',
  },
  bond:
    'Edit the attached image: the same wolf in its mythic form — same individual, same colors, same style, same starlight in its fur — now in ' +
    'full motion, leaping to the right through the air, all four legs stretched, its mane and tail streaming behind it, mouth slightly open, ' +
    `powerful and joyful. The whole wolf inside the canvas with a small margin, filling about 85% of its width. Keep the background ${fondUni('vert')}. ` +
    'No motion lines, no text, no frame. Output one square image (1:1 aspect ratio).',
}

const COMPAGNONS: Compagnon[] = [LOUP]

const FEUILLE = (c: Compagnon, style: string) =>
  [
    'Character model sheet for an original collectible companion of a party quiz game: ONE animal shown at four ages, side by side from left ' +
      'to right, evenly spaced, each full body in a three-quarter view facing slightly left, on one plain light grey background — no ground, no scenery.',
    `From left to right: 1) ${c.ages[0]}; 2) ${c.ages[1]}; 3) ${c.ages[2]}; 4) ${c.ages[3]}.`,
    c.identite,
    style,
    ORIGINAL,
    'It must stay unmistakably the same individual at every age, and each age must read instantly even as a tiny icon. ' +
      'No text, no labels, no numbers, no frame, no watermark. Output one wide image (16:9 aspect ratio).',
  ].join('\n\n')

function consigneDeForme(c: Compagnon, i: number, style: string): string {
  const f = c.formes[i]
  const sujet =
    `Subject: its ${RANGS[i]} form — ${c.ages[i]} (the ${RANGS[i]} from the left on the model sheet), calm and attentive, ` +
    'looking at the viewer, in a three-quarter view.'
  const cadrage = !f.decor
    ? 'Sitting, its whole body visible, centered, filling about 70% of the canvas height, well away from the edges. ' +
      `Background: ${fondUni('vert')}. Draw nothing behind it — no ground, no scenery, no glow: only the flat background color. ` +
      `Do not use any ${CHROMAS.vert.proscrit} on the animal.`
    : `Setting: ${f.decor}. The setting fills the whole canvas edge to edge behind it. ` +
      (f.deborde
        ? `Framing: the wolf large and centered, standing in the lower part of the canvas; ${f.deborde} rise high, up into the top band of the ` +
          'canvas close to the top edge — that is what this form is about. Its paws and body stay well inside the canvas.'
        : 'Framing: the wolf centered, its head, ears, paws and tail well inside the canvas and away from the four corners, which will be cut off.') +
      (f.taille ? ` ${f.taille}` : '')
  return [AVATAR, REFERENCE, style, ORIGINAL, c.identite, sujet, cadrage].join('\n\n')
}

interface Travail {
  nom: string
  consigne: string
  /** Les images dont il part, envoyées avant la consigne : il attend qu'elles existent. */
  sources: string[]
  format?: FormatDImage
}

/** Ce que l'on peint : l'essai des styles, ou, un style choisi, tout le compagnon. */
function travaux(c: Compagnon, style?: string): Travail[] {
  if (!style) return Object.entries(STYLES).map(([cle, s]) => ({ nom: `feuille-${cle}`, consigne: FEUILLE(c, s.consigne), sources: [], format: '16:9' }))
  const s = STYLES[style]
  if (!s) throw new Error(`--style=${style} : pas un style de l'essai (${Object.keys(STYLES).join(', ')})`)
  const feuille = `feuille-${style}`
  const t: Travail[] = []
  c.formes.forEach((f, i) => {
    t.push({ nom: f.id, sources: [feuille], consigne: consigneDeForme(c, i, s.consigne) })
    if (f.decor) {
      t.push({ nom: `${f.id}-decor`, sources: [f.id], consigne: DECOR_SEUL })
      t.push({ nom: `${f.id}-decoupe`, sources: [f.id], consigne: DECOUPE(f.garde, f.retirer ?? 'the setting', 'vert') })
    }
  })
  const ultime = c.formes[3].id
  t.push({ nom: 'eclat', sources: [ultime], consigne: c.eclat.consigne })
  t.push({ nom: 'eclat-decor', sources: ['eclat'], consigne: DECOR_SEUL })
  t.push({ nom: 'eclat-decoupe', sources: ['eclat'], consigne: DECOUPE(c.eclat.garde, c.eclat.retirer, 'magenta') })
  for (const [id, base, chroma] of [
    ...c.formes.map(f => [f.id, f.decor ? `${f.id}-decoupe` : f.id, 'vert'] as const),
    ['eclat', 'eclat-decoupe', 'magenta'] as const,
  ]) {
    for (const e of Object.keys(EXPRESSIONS) as Expression[]) t.push({ nom: `${id}-${e}`, sources: [base], consigne: EXPRESSION(EXPRESSIONS[e], chroma) })
  }
  t.push({ nom: 'bond', sources: [`${ultime}-decoupe`], consigne: c.bond })
  return t
}

// ── Les fichiers ──────────────────────────────────────────────────────────

const compagnon = COMPAGNONS.find(c => c.id === ID)
if (!compagnon) throw new Error(`Quel compagnon ? ${COMPAGNONS.map(c => c.id).join(', ')}`)
const racine = path.resolve('../export/compagnons')
const sortie = path.join(racine, compagnon.id)
mkdirSync(sortie, { recursive: true })
const fichier = (nom: string) => path.join(sortie, nom)
const existant = (nom: string) => ['png', 'jpg', 'webp'].map(e => fichier(`${nom}.${e}`)).find(f => existsSync(f))

/** Met une image payée de côté, datée : on ne jette jamais ce qui a coûté. */
function mettreDeCote(nom: string) {
  const f = existant(nom)
  if (!f) return
  const ext = path.extname(f)
  renameSync(f, f.slice(0, -ext.length) + `.ancien-${Date.now()}${ext}`)
}

const TRAVAUX = travaux(compagnon, STYLE)

// Ce qu'on repaie, et tout ce qui part de lui : une découpe repeinte change la
// place des expressions qui en partent.
const aRepayer = new Set(liste('regenerer'))
for (let ajoute = true; ajoute; ) {
  ajoute = false
  for (const t of TRAVAUX) {
    if (!aRepayer.has(t.nom) && t.sources.some(s => aRepayer.has(s))) {
      aRepayer.add(t.nom)
      ajoute = true
    }
  }
}
for (const nom of aRepayer) mettreDeCote(nom)

// ── Le journal ────────────────────────────────────────────────────────────

const cheminJournal = path.join(racine, 'journal-compagnons.json')
const lireJournal = (): any[] => (existsSync(cheminJournal) ? JSON.parse(readFileSync(cheminJournal, 'utf8')) : [])
const depense = () => lireJournal().reduce((n, e) => n + (e.cout ?? 0), 0)

function ranger(nom: string, r: Rendu) {
  writeFileSync(fichier(`${nom}.${formatDe(r.image).ext}`), r.image)
  const journal = lireJournal()
  const cout = coutEstime(r.jetons)
  journal.push({ compagnon: compagnon!.id, nom, date: new Date().toISOString(), modele: MODELE, taille: TAILLE, jetons: r.jetons, cout })
  writeFileSync(cheminJournal, JSON.stringify(journal, null, 2) + '\n')
  console.log(`  ${nom} : environ ${cout.toFixed(3)} $ en ${r.secondes.toFixed(0)} s (total ${depense().toFixed(2)} $)`)
}

/** Une image, sans arrêter les autres : celle qui échoue se redemande à la passe suivante. */
async function peindre(t: Travail) {
  writeFileSync(fichier(`consigne-${t.nom}.txt`), t.consigne + '\n')
  const parties: Partie[] = [...t.sources.map(s => enPartie(existant(s)!)), { text: t.consigne }]
  try {
    ranger(t.nom, await generer(parties, { modele: MODELE, taille: TAILLE, format: t.format }))
  } catch (e) {
    console.log(`  ✗ ${t.nom} : ${(e as Error).message.slice(0, 300)}`)
  }
}

// ── Le tout ───────────────────────────────────────────────────────────────

for (let passe = 1; passe <= 6; passe++) {
  const aFaire = TRAVAUX.filter(t => !existant(t.nom) && t.sources.every(s => existant(s)))
  if (!aFaire.length) break
  const prevu = aFaire.length * PRIX_D_UNE_IMAGE
  if (depense() + prevu > BUDGET) {
    throw new Error(`Budget : ${depense().toFixed(2)} $ dépensés, ${prevu.toFixed(2)} $ prévus pour ${aFaire.length} image(s) — au-delà de ${BUDGET} $.`)
  }
  console.log(`Passe ${passe} : ${aFaire.map(t => t.nom).join(', ')}`)
  const file = [...aFaire]
  await Promise.all(
    Array.from({ length: Math.min(EN_MEME_TEMPS, file.length) }, async () => {
      for (let t = file.shift(); t; t = file.shift()) await peindre(t)
    }),
  )
}
const manquent = TRAVAUX.filter(t => !existant(t.nom)).map(t => t.nom)
if (manquent.length) console.log(`Manquent encore : ${manquent.join(', ')}`)

// ── La planche : les fichiers tels que l'application les poserait ────────
// Pour 100 unités du disque, comme les portraits (`portraits.ts`, `Portrait.tsx`) :
// la part de l'image que couvre le disque, et le cadre du personnage — le
// carré, ou plus large quand il en sort.

/** La part de la largeur de l'image que couvre le carré du disque, forme par forme (le louveteau, puis les trois du décor, puis l'Éclat). */
export const DISQUE: Record<string, number> = { louveteau: 0.94, jeune: 0.92, adulte: 0.76, ultime: 0.84, eclat: 0.84 }
/** Le cadre du personnage dans le repère du disque (origine, côté). */
export const CADRE: Record<string, [number, number]> = { louveteau: [0, 100], jeune: [0, 100], adulte: [-20, 140], ultime: [-20, 140], eclat: [-20, 140] }
const QUALITE = 0.86

// Ce que `pixels.ts` ne fait pas : déplacer une image entière (une expression
// suit la découpe neutre, que l'alignement a replacée sur l'illustration),
// prendre le carré du disque d'un décor seul, réduire une image qui n'est pas
// carrée, et mesurer combien deux silhouettes se recouvrent.
const OUTILS = String.raw`
async function deplacer(src, s, dx, dy) {
  const img = await charger(src)
  const W = img.naturalWidth
  const c = toile(W, W), x = c.getContext('2d')
  x.imageSmoothingQuality = 'high'
  x.translate(W / 2 + dx * W, W / 2 + dy * W)
  x.scale(s, s)
  x.translate(-W / 2, -W / 2)
  x.drawImage(img, 0, 0, W, W)
  return c.toDataURL('image/png')
}
async function disqueDe(src, disque, cote, qualite) {
  const img = await charger(src)
  const W = img.naturalWidth
  const n = Math.round(disque * W), x0 = Math.round((W - n) / 2)
  const carre = toile(n, n)
  carre.getContext('2d').drawImage(img, x0, x0, n, n, 0, 0, n, n)
  return reduire(carre, cote).toDataURL('image/webp', qualite)
}
async function reduireA(src, largeur, qualite) {
  const img = await charger(src)
  let c = toile(img.naturalWidth, img.naturalHeight)
  c.getContext('2d').drawImage(img, 0, 0)
  while (c.width / 2 >= largeur * 1.5) {
    const m = toile(Math.round(c.width / 2), Math.round(c.height / 2)), x = m.getContext('2d')
    x.imageSmoothingQuality = 'high'
    x.drawImage(c, 0, 0, m.width, m.height)
    c = m
  }
  const fin = toile(largeur, Math.round((largeur * img.naturalHeight) / img.naturalWidth)), x = fin.getContext('2d')
  x.imageSmoothingQuality = 'high'
  x.drawImage(c, 0, 0, fin.width, fin.height)
  return fin.toDataURL('image/webp', qualite)
}
async function recouvrement(a, b) {
  const n = 256, pa = await pixelsDe(a, n), pb = await pixelsDe(b, n)
  let les2 = 0, l1 = 0
  for (let k = 3; k < pa.length; k += 4) {
    const A = pa[k] > 128, B = pb[k] > 128
    if (A && B) les2++
    if (A || B) l1++
  }
  return l1 ? les2 / l1 : 0
}
`

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'compagnons.js'))('playwright')
}

const enDataUrl = (f: string) => {
  const b = readFileSync(f)
  return `data:${formatDe(b).mime};base64,${b.toString('base64')}`
}

const { chromium } = chargerPlaywright()
const nav = await chromium.launch({ headless: true })
try {
  const page = await pagePixels(nav, 512)
  await page.addScriptTag({ content: OUTILS })
  const app = path.join(sortie, 'app')
  mkdirSync(app, { recursive: true })
  const poser = (nom: string, data: string) => writeFileSync(path.join(app, `${nom}.webp`), deDataUrl(data))

  // Les planches de modèle et les illustrations, réduites pour être regardées.
  for (const f of readdirSync(sortie).filter(f => /^(feuille-[a-z0-9]+|louveteau|jeune|adulte|ultime|eclat|bond)\.(png|jpg|webp)$/.test(f))) {
    const nom = f.replace(/\.[a-z]+$/, '')
    poser(`apercu-${nom}`, await dansLaPage<string>(page, 'reduireA', enDataUrl(fichier(f)), nom.startsWith('feuille') ? 1280 : 768, QUALITE))
  }

  const expressions = ['neutre', ...Object.keys(EXPRESSIONS)] as const
  const formes = [...compagnon.formes.map(f => ({ id: f.id, decor: !!f.decor, chroma: 'vert' as Chroma })), { id: 'eclat', decor: true, chroma: 'magenta' as Chroma }]
  for (const f of formes) {
    const rvb = CHROMAS[f.chroma].rvb
    // La silhouette neutre d'une forme : la forme elle-même pour le louveteau,
    // peint seul ; la découpe de l'illustration sinon.
    const base = existant(f.decor ? `${f.id}-decoupe` : f.id)
    if (!base) {
      console.log(`  ${f.id} : pas encore de silhouette`)
      continue
    }
    const neutre = await dansLaPage<any>(page, 'detourer', enDataUrl(base), null, rvb)
    let place = { s: 1, dx: 0, dy: 0, ecart: 0 }
    if (f.decor) {
      const decor = existant(`${f.id}-decor`)
      if (decor) poser(`${f.id}-disque`, await dansLaPage<string>(page, 'disqueDe', enDataUrl(decor), DISQUE[f.id], 512, QUALITE))
      place = await dansLaPage<any>(page, 'aligner', enDataUrl(existant(f.id)!), neutre.plein)
    }
    for (const e of expressions) {
      const src = e === 'neutre' ? base : existant(`${f.id}-${e}`)
      if (!src) continue
      const d = e === 'neutre' ? neutre : await dansLaPage<any>(page, 'detourer', enDataUrl(src), null, rvb)
      const deplace = await dansLaPage<string>(page, 'deplacer', d.plein, place.s, place.dx, place.dy)
      const r = await dansLaPage<any>(page, 'assembler', { image: deplace, disque: DISQUE[f.id], cadre: CADRE[f.id], tailles: [512], qualite: QUALITE })
      poser(`${f.id}-${e}`, r.perso[512])
      // Une expression dont le corps a bougé fait sauter le loup sur son disque.
      const commun = e === 'neutre' ? 1 : await dansLaPage<number>(page, 'recouvrement', neutre.plein, d.plein)
      const doute = d.bordFaux || d.transparents < 0.2 || commun < 0.7 || (f.decor && e === 'neutre' && !(place.ecart < 35))
      console.log(
        `  ${doute ? '⚠ ' : ''}${f.id}-${e} : ${(d.transparents * 100).toFixed(0)} % transparent` +
          (e === 'neutre' ? (f.decor ? `, aligné ×${place.s.toFixed(3)}, écart ${place.ecart.toFixed(0)}` : '') : `, ${(commun * 100).toFixed(0)} % de la silhouette neutre`),
      )
    }
  }
  const bond = existant('bond')
  if (bond) {
    const d = await dansLaPage<any>(page, 'detourer', enDataUrl(bond), null, CHROMAS.vert.rvb)
    const r = await dansLaPage<any>(page, 'assembler', { image: d.plein, disque: 1, cadre: [0, 100], tailles: [768], qualite: QUALITE })
    poser('bond', r.perso[768])
    console.log(`  ${d.transparents < 0.2 ? '⚠ ' : ''}bond : ${(d.transparents * 100).toFixed(0)} % transparent`)
  }
  console.log(app)
} finally {
  await nav.close()
}
console.log(`Dépensé en tout : ${depense().toFixed(2)} $`)
