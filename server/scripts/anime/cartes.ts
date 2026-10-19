// Les cartes peintes de l'Expédition : l'illustration de chacune des cartes
// sans légendaire (`CARTES_DES_RENCONTRES`, `shared/rencontres.ts`) — celle
// d'un légendaire est son médaillon peint. « Les cartes c'est des rectangles
// pas très jolis, ça serait pas possible de faire de vraies cartes ? Ça
// rajouterait à l'immersion » (le propriétaire, le 18 octobre 2026) ; puis
// « Go tout faire avec tes recommandations, cependant je n'ai que 7.4 € pour
// les images ». Vingt-trois d'abord, puis les quarante-deux du jeu complet,
// le 19 octobre 2026.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/cartes.ts --tout --lot
//   … --seulement=concentration,plume        # un essai, quelques images
//   … --regenerer=concentration              # repayer celle-ci, l'ancienne mise de côté
//   npx tsx scripts/anime/cartes.ts [--livrer]   # sans rien nommer : la planche, la livraison, rien de payé
//
// Une passe de peinture, en lot à moitié prix (0,07 $ l'image environ), puis
// l'assemblage dans Chromium — deux tailles en WebP — et la planche à juger
// (`export/cartes/planche.png`). Une image payée n'est jamais redemandée sans
// `--regenerer`, et l'ancienne est mise de côté, datée, jamais jetée ; le
// journal garde le coût de chacune, et le script refuse de dépasser le budget
// (`BUDGET`, 6 $ : sous les 7,4 € du propriétaire, taxes comprises).
//
// Les originaux et le journal vivent dans `../export/cartes/`, hors du dépôt ;
// `--livrer` pose les fichiers de l'application dans `client/public/cartes`,
// nommés par leur empreinte, et écrit `client/src/components/cartes-peintes.ts`.
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { coutEstime, formatDe, generer, lancerLot, lireLot, type Rendu } from './gemini'
import { dansLaPage, deDataUrl, pagePixels } from './pixels'
import { CARTES_DES_RENCONTRES, type FamilleDeCartes } from '../../../shared/rencontres'

const args = process.argv.slice(2)
const LOT = args.includes('--lot')
const ATTENTE = Number(process.env.ATTENTE ?? 3600)
const MODELE = process.env.MODELE ?? 'gemini-3-pro-image'
/** Le plafond de toute la chaîne, journal compris, en dollars : au-delà, rien ne part. */
const BUDGET = Number(process.env.BUDGET ?? 6)
const racine = path.resolve('../export/cartes')
const sortie = path.join(racine, 'originaux')
mkdirSync(sortie, { recursive: true })
const fichier = (nom: string) => path.join(sortie, nom)
const existant = (nom: string) => ['png', 'jpg', 'webp'].map(e => fichier(`${nom}.${e}`)).find(f => existsSync(f))
const liste = (nom: string) => (args.find(a => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? '').split(',').filter(Boolean)

/** Met une image payée de côté, datée : on ne jette jamais ce qui a coûté. */
function mettreDeCote(nom: string) {
  const f = existant(nom)
  if (!f) return
  const ext = path.extname(f)
  renameSync(f, f.slice(0, -ext.length) + `.ancien-${Date.now()}${ext}`)
}

// ── Les consignes ─────────────────────────────────────────────────────────
// En anglais, comme celles des légendaires. Un seul style pour toutes : une
// collection, comme un set de cartes. L'illustration vit
// dans la fenêtre d'une carte, de 58 pixels de haut dans la main à 128 levée :
// un seul sujet, gros, centré, qui se lit en tout petit — et qui survit au
// recadrage, presque carré dans la main, en bandeau levée.

const STYLE =
  'Illustration for the art window of a card in a fantasy collectible card game about a quiz expedition (landscape 4:3). One single bold subject, ' +
  'centered and filling the middle of the image, with a strong clear silhouette and a well-lit focal point: it must read instantly even when the ' +
  'card is shown tiny, about 60 pixels tall, and it must survive being cropped to a square or to a wide band — keep everything important inside ' +
  'the central area. Style: a rich painterly digital painting, like a luminous hand-painted storybook illustration, soft volumetric light, glowing ' +
  'magical atmosphere, fine gold-leaf accents that catch the light, ultra detailed but uncluttered; a simple background with soft depth, darker ' +
  'toward the edges. The image fills the canvas edge to edge: no card frame, no border, no rounded corners, no margin, no text, no letters, no ' +
  'numerals, no runes, no symbols written anywhere, no signature, no watermark. An original design: imitate no existing game or card.'

/** La teinte de chaque famille, celle du fond de la carte (`TEINTE_DE_LA_FAMILLE`, `RencontresDExpedition.tsx`) : la palette de son illustration. */
const PALETTE: Record<FamilleDeCartes, string> = {
  neutre: 'cool silver-blue, slate grey and pale steel, with warm gold highlights',
  erudit: 'deep indigo and violet-blue, with warm candle gold',
  flambeur: 'ember orange, flame red and burnished gold',
  metamorphe: 'orchid magenta and violet, with iridescent highlights',
  elan: 'emerald and fresh spring green, with gold',
  rempart: 'bronze, ochre and warm sandstone, with gold',
  devin: 'teal and turquoise, with moonlit silver',
}

/**
 * Ce qu'ajoute une rareté : une rare plus précieuse, une épique majestueuse —
 * le jeu complet, le 19 octobre 2026 —, une maudite inquiétante.
 */
const RARETE: Record<'commun' | 'rare' | 'epique' | 'maudit', string> = {
  commun: 'A humble, clear, friendly image.',
  rare: 'A precious, more ornate image: richer gold filigree and a stronger glow.',
  epique: 'An epic, majestic image: a grander, more dramatic composition, radiant light, a shimmering violet aura around the subject and rich gold filigree.',
  maudit: 'A cursed, tempting card: a darker, eerie mood, a sinister violet glow and tarnished gold — beautiful but dangerous.',
}

/** Le sujet de chaque carte : ce qu'elle fait, en une image (sa clé est celle du catalogue). */
export const SUJETS: Record<string, string> = {
  // Les neutres
  concentration: 'a glowing arrow striking the exact center of an ancient round target of carved bronze rings, light bursting from the bullseye',
  prudence: 'a sturdy round shield of oak planks with an iron rim and a boss, raised and catching a few sparks',
  'coup-d-oeil': 'a golden magnifying glass hovering over four floating stone tiles, one of the four tiles crumbling away into dust',
  echange: 'two rolled parchment scrolls circling around each other in a swirl of light, swapping places',
  pioche: 'a deck of playing cards with plain decorated backs lying on a table, two fresh cards magically rising out of it in a glow',
  'arret-sur-image': 'an open brass pocket watch with its hands stopped — a plain dial with simple hour marks, no numerals —, a drop of water frozen in midair just above it',
  detour: 'a weathered wooden signpost with three blank arrows at a fork of a mountain path, trails winding away in different directions',
  'double-chance': 'two twin golden keys floating side by side before an ornate lock, both glowing',
  sursis: 'an ornate silver hourglass wrapped in a soft protective halo of light, its last grains of sand held back in midair',
  // Le premier essai portait des chiffres sur les faces des dés : des points, et jamais un chiffre.
  'tout-ou-rien': 'two ivory dice tumbling through the air above a dark velvet table, their faces marked only with round dark pips (dots), never digits, a cracked gold coin beneath them',
  'quitte-ou-double': 'a single gold coin spinning on its edge at the brink of a dark chasm, a small golden crown reflected in it',
  // L'Érudit
  plume: 'a white feather quill dipped in a glowing inkwell, trails of luminous ink swirling in abstract curls',
  bibliotheque: 'an ancient open tome floating above a stone lectern, its pages glowing, tall bookshelves fading into the shadows behind',
  // Le Flambeur
  'doubler-la-mise': 'a stack of plain gold coins, each embossed with a small star, splitting into two equal stacks in a burst of embers',
  banco: 'a blazing gold coin embossed with a small star streaking through the air like a comet, a trail of fire behind it',
  // Le Métamorphe
  corser: 'a faceted crystal blooming into six glowing shards arranged in a ring',
  simplifier: 'a single coin floating in the air, one half a golden sun and the other half a silver moon',
  // L'Élan
  echauffement: 'a torch being kindled, its first flame catching with sparks rising',
  lancee: 'a stag leaping in full stride, a trail of green light behind it',
  // Le Rempart
  parade: 'two crossed swords meeting in a parry, a clash of bright sparks where the blades touch',
  'contre-attaque': 'a bronze shield reflecting a beam of light straight back the way it came',
  // Le Devin
  lucidite: 'a crystal lantern glowing in thick fog, its beam clearing a path through the mist',
  'troisieme-oeil': 'a glowing third eye opening in a starry sky, a thin crescent moon below it',

  // Le jeu complet (le 19 octobre 2026) : les neutres
  evidence: 'a pair of round crystal spectacles resting on a stone ledge, the blurry misty landscape behind them perfectly sharp and clear through the lenses',
  // Le premier essai posait le paysage dans un cadre d'écran noir : la scène se voit en direct, jusqu'aux bords.
  meditation:
    'a small cairn of smooth balanced pebbles on a calm lake shore at dawn, a thread of glowing mist rising from its top stone — the landscape seen directly and reaching every edge, never inside a frame, a screen or a card',
  'sang-froid': 'a silver chess knight standing perfectly still on a stone chessboard while sparks and embers fly past it',
  panacee: 'an ornate crystal flask of glowing golden-white elixir on a small stand, healing light radiating from it, sprigs of a sacred herb curling around its base',
  maitrise: 'a glowing golden laurel crown floating above a pedestal of polished stone, calm rays of light radiating from it',
  surmenage: 'a single candle burning at both ends in the dark, its two flames flickering a sinister violet, wax dripping fast',
  // L'Érudit
  'savoir-faire': 'an artisan workbench with a few finely crafted tools laid neatly on leather: a brass compass, a chisel and a small gleaming gear',
  memoire: 'a small antique wooden cabinet of many tiny drawers, one drawer pulled open with a soft golden glow spilling out of it',
  // Celle-ci aussi s'était peinte dans un cadre, puis sa cloche portait des signes lumineux, comme des lettres.
  lecon:
    'a brass hand bell beside a stack of leather-bound books tied with a ribbon, a small red apple on top, on a wooden desk in warm lamplight; the bell is perfectly plain and smooth, with no engraving, no marks, no glowing writing — seen directly and reaching every edge, never inside a frame or a card',
  expose: 'a grand celestial globe on an ornate wooden stand, lit by a single spotlight on a dark stage',
  encyclopedie: 'an enormous ancient tome with a jeweled cover floating open, golden bookmark ribbons streaming out of it, blank glowing pages swirling around it like a whirlwind',
  genie: 'a radiant crystal sphere holding a tiny swirling galaxy, raised on a bronze stand, beams of golden light bursting from it',
  // Le Flambeur
  pourboire: 'a single gold coin embossed with a small star dropping into a small brass cup with a bright sparkle, warm tavern glow',
  cagnotte: 'a round terracotta money pot with a slot on top, a few gold coins embossed with a small star stacked beside it, ember glow',
  // Le premier essai avait deux bandes noires en haut et en bas.
  assurance:
    'a gold coin embossed with a small star resting on a velvet cushion under a protective glass dome, a warm fiery glow around it — a full-bleed scene reaching every edge, no black bands',
  fortune: 'an ornate wheel of fortune of gold and red lacquer spinning fast, its segments plain colored with no numbers nor symbols, sparks flying from its rim',
  pactole: 'a cascade of gold coins embossed with small stars pouring out of an overturned treasure chest into a glowing golden pool',
  // Un coffre qui éclate, au premier essai : le même que Pactole, à côté de lui dans le codex.
  rafle: 'a big fishing net hauled up into the air, overflowing with gold coins and glittering gems that spill through its mesh',
  // Le Métamorphe
  'volte-face': 'a golden weathervane shaped like an arrow whirling around in a gust of iridescent wind',
  prisme: 'a triangular crystal prism splitting a beam of white light into six bright rainbow rays',
  miroir: 'an ornate oval mirror in a silver frame, its surface rippling like water and glowing with soft magenta light',
  cameleon: 'a chameleon curled on a twisting branch, its skin shifting through iridescent colors',
  metamorphose: 'a chrysalis splitting open as a radiant butterfly of iridescent light emerges, its wings unfurling',
  polymorphe: 'a sphere of liquid metal morphing into six different glowing crystal shapes at once, iridescent reflections',
  // L'Élan
  foulee: 'a single winged sandal mid-stride, leaving a trail of green light and spring leaves behind it',
  acceleration: 'an arrow in flight whose tail feathers burst into green sparks as it speeds up, a long trail of light behind it',
  rythme: 'a round drum painted with green and gold patterns, glowing concentric rings of sound pulsing from its skin',
  sprint: 'a hare made of green light dashing at full speed in a blur of motion',
  'vent-arriere': 'the billowing sails of a small ship filled by a glowing green wind, sparkling gusts swirling around them',
  inarretable: 'a charging rhinoceros made of emerald light bursting through a wooden barrier, splinters flying',
  // Le Rempart
  muraille: 'a massive sandstone rampart with battlements standing tall under a warm golden sky',
  pansement: 'a rolled linen bandage beside a small pot of healing balm and a sprig of green herb, a soft warm glow',
  cuirasse: 'a polished bronze breastplate on a wooden stand, gleaming in warm light',
  'second-souffle': 'a bronze horn blowing a swirling stream of warm golden air',
  bastion: 'a round stone tower standing firm as great waves crash against its base, golden light shining from its windows',
  represailles: 'a bronze shield bristling with sharp radiant spikes, arrows shattering against it and flying back',
  // Le Devin
  augure: 'a flight of silver birds in a teal night sky spiraling like an omen above a lonely hill',
  presage: 'a crystal ball with a faint swirling glow inside, resting on a bronze stand on a dark teal cloth',
  // Les volutes du premier essai dessinaient un point d'interrogation : un symbole.
  voyance: 'two hands hovering above a glowing crystal ball, soft abstract wisps of moonlit light rising from it — never shaping a letter, a question mark or any symbol',
  astrolabe: 'an ornate brass astrolabe glowing with moonlit silver light, its rings engraved only with plain lines and dots, never numerals nor letters',
  vision: 'a brass and silver telescope on a tripod aimed at a radiant teal nebula filling the night sky',
  revelation: 'heavy teal velvet curtains drawn wide open to reveal a blinding beam of moonlit silver light',
}

interface Travail {
  nom: string
  consigne: string
}

const A_PEINDRE = CARTES_DES_RENCONTRES.filter(c => !c.legendaire)
// Chaque carte sans légendaire a son sujet, et rien de plus.
for (const c of A_PEINDRE) if (!SUJETS[c.cle]) throw new Error(`${c.cle} : pas de sujet à peindre`)
for (const cle of Object.keys(SUJETS)) if (!A_PEINDRE.some(c => c.cle === cle)) throw new Error(`${cle} : aucune carte de ce nom`)

const TRAVAUX: Travail[] = A_PEINDRE.map(c => ({
  nom: c.cle,
  consigne:
    `${STYLE}\n\nThe subject: ${SUJETS[c.cle]}.\n\nDominant palette: ${PALETTE[c.famille]}. ${RARETE[c.rarete as 'commun' | 'rare' | 'epique' | 'maudit']}\n\n` +
    'Output one landscape image (4:3 aspect ratio).',
}))

const seulement = liste('seulement')
for (const n of seulement) if (!TRAVAUX.some(t => t.nom === n)) throw new Error(`--seulement=${n} : aucune carte de ce nom`)
for (const nom of liste('regenerer')) {
  if (!TRAVAUX.some(t => t.nom === nom)) throw new Error(`--regenerer=${nom} : aucune carte de ce nom`)
  mettreDeCote(nom)
}
// Sans rien de nommé, on assemble et on livre, on ne paie rien.
const GENERER = seulement.length > 0 || liste('regenerer').length > 0 || args.includes('--tout')

// ── Le journal ────────────────────────────────────────────────────────────

const cheminJournal = path.join(racine, 'journal-cartes.jsonl')
const lireJournal = (): any[] =>
  existsSync(cheminJournal)
    ? readFileSync(cheminJournal, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l))
    : []
const depense = () => lireJournal().reduce((n, e) => n + (e.cout ?? 0), 0)
function ranger(nom: string, r: Rendu, lot: boolean) {
  writeFileSync(fichier(`${nom}.${formatDe(r.image).ext}`), r.image)
  const cout = coutEstime(r.jetons, { lot })
  appendFileSync(cheminJournal, JSON.stringify({ nom, date: new Date().toISOString(), modele: MODELE, lot, jetons: r.jetons, cout }) + '\n')
  console.log(`  ${nom} : environ ${cout.toFixed(3)} $ (total ${depense().toFixed(2)} $)`)
}

// ── Les images ────────────────────────────────────────────────────────────

const cheminLots = path.join(racine, 'lots-en-cours.json')
async function attendre(noms: string[]) {
  const t0 = Date.now()
  const restants = [...noms]
  while (restants.length) {
    for (const nom of [...restants]) {
      const l = await lireLot(nom)
      if (!l.fini) continue
      console.log(`lot ${nom} : ${l.etat} en ${((Date.now() - t0) / 1000).toFixed(0)} s`)
      for (const [cle, r] of l.resultats) typeof r === 'string' ? console.log(`  ${cle} : ${r}`) : ranger(cle, r, true)
      restants.splice(restants.indexOf(nom), 1)
      writeFileSync(cheminLots, JSON.stringify(restants) + '\n')
    }
    if (!restants.length) return true
    if (Date.now() - t0 > ATTENTE * 1000) return false
    await new Promise(ok => setTimeout(ok, 20_000))
  }
  return true
}

// Un lot lancé et pas encore revenu se reprend par son nom : relancer la
// chaîne ne le repaie pas.
const enCours = existsSync(cheminLots) ? JSON.parse(readFileSync(cheminLots, 'utf8') || '[]') : []
if (enCours.length && !(await attendre(enCours))) process.exit(0)

if (GENERER) {
  const aFaire = TRAVAUX.filter(t => (seulement.length === 0 || seulement.includes(t.nom)) && !existant(t.nom))
  if (aFaire.length) {
    // Le budget se tient avant de payer : au prix plein, une image coûte
    // environ 0,14 $ (0,07 $ en lot), pensée comprise.
    const prevu = aFaire.length * (LOT ? 0.07 : 0.14)
    if (depense() + prevu > BUDGET) {
      throw new Error(`Budget : ${depense().toFixed(2)} $ dépensés, ${prevu.toFixed(2)} $ prévus pour ${aFaire.length} image(s) — au-delà de ${BUDGET} $.`)
    }
    for (const t of aFaire) writeFileSync(fichier(`consigne-${t.nom}.txt`), t.consigne + '\n')
    const demandes = aFaire.map(t => ({ cle: t.nom, parties: [{ text: t.consigne }], format: '4:3' as const }))
    console.log(`À peindre : ${aFaire.map(t => t.nom).join(', ')}`)
    if (LOT) {
      const nom = await lancerLot(demandes, { modele: MODELE, taille: '1K', nom: 'fiestapp-cartes' })
      writeFileSync(cheminLots, JSON.stringify([nom]) + '\n')
      console.log(`lot ${nom}`)
      if (!(await attendre([nom]))) process.exit(0)
    } else {
      for (const d of demandes) {
        try {
          ranger(d.cle, await generer(d.parties, { modele: MODELE, taille: '1K', format: d.format }), false)
        } catch (e) {
          // Une image refusée n'arrête pas les autres : elle reviendra à la prochaine passe.
          console.log(`  ${d.cle} : ${(e as Error).message}`)
        }
      }
    }
  }
}

// ── L'assemblage : deux tailles, et la planche ───────────────────────────
// Dans Chromium, comme les décors : 480 de large pour la carte levée (128
// points de haut, deux pixels par point), 240 pour la main, les rangées et
// le codex.

const OUTILS = String.raw`
// Une image réduite à l × h par moitiés successives : d'un coup, le
// navigateur saute des pixels et les traits fins se hachent.
async function redimensionner(src, l, h, qualite) {
  const img = await charger(src)
  let c = toile(img.naturalWidth, img.naturalHeight)
  c.getContext('2d').drawImage(img, 0, 0)
  while (c.width / 2 >= l * 1.5 && c.height / 2 >= h * 1.5) {
    const moitie = toile(Math.round(c.width / 2), Math.round(c.height / 2)), x = moitie.getContext('2d')
    x.imageSmoothingQuality = 'high'
    x.drawImage(c, 0, 0, moitie.width, moitie.height)
    c = moitie
  }
  const fin = toile(l, h), x = fin.getContext('2d')
  x.imageSmoothingQuality = 'high'
  x.drawImage(c, 0, 0, l, h)
  return fin.toDataURL('image/webp', qualite)
}
`

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'cartes.js'))('playwright')
}

const app = path.join(racine, 'app')
mkdirSync(app, { recursive: true })
const enDataUrl = (f: string) => {
  const b = readFileSync(f)
  return `data:${formatDe(b).mime};base64,${b.toString('base64')}`
}
/** Les deux tailles livrées : [grande, petite]. */
const TAILLES = [480, 240] as const

const { chromium } = chargerPlaywright()
const nav = await chromium.launch({ headless: true })
try {
  const page = await pagePixels(nav, 512)
  await page.addScriptTag({ content: OUTILS })
  for (const t of TRAVAUX) {
    const f = existant(t.nom)
    if (!f) continue
    for (const l of TAILLES) writeFileSync(path.join(app, `${t.nom}-${l}.webp`), deDataUrl(await dansLaPage<string>(page, 'redimensionner', enDataUrl(f), l, (l * 3) / 4, 0.82)))
  }
  // La planche : chaque carte à sa taille de la main (presque carrée) et
  // levée (en bandeau), sur sa teinte — un sujet qui ne se lit pas en petit
  // ou que le recadrage coupe se voit tout de suite.
  const faites = TRAVAUX.filter(t => existsSync(path.join(app, `${t.nom}-240.webp`)))
  if (faites.length) {
    const cases = faites
      .map(t => {
        const petite = enDataUrl(path.join(app, `${t.nom}-240.webp`))
        const grande = enDataUrl(path.join(app, `${t.nom}-480.webp`))
        return (
          `<figure><div class="main" style="background-image:url(${petite})"></div><div class="levee" style="background-image:url(${grande})"></div>` +
          `<figcaption>${t.nom}</figcaption></figure>`
        )
      })
      .join('')
    const planche = await nav.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 })
    await planche.setContent(
      '<!doctype html><html><body style="margin:0;background:#16110f;color:#f3ece4;font:12px system-ui">' +
        '<style>main{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:14px}figure{margin:0;display:flex;gap:8px;align-items:end;flex-wrap:wrap}' +
        '.main,.levee{background-size:cover;background-position:center;border-radius:6px;border:2px solid #a8b3bf}.main{width:62px;height:58px}.levee{width:200px;height:118px}' +
        'figcaption{width:100%}</style><main>' +
        cases +
        '</main></body></html>',
    )
    await planche.screenshot({ path: path.join(racine, 'planche.png'), fullPage: true })
    console.log(`planche : ${path.join(racine, 'planche.png')} (${faites.length} cartes)`)
  }
  if (args.includes('--livrer')) livrer()
} finally {
  await nav.close()
}

// ── La livraison ──────────────────────────────────────────────────────────
// `--livrer` : les fichiers rejoignent `client/public/cartes`, nommés par
// leur empreinte — servis un an sans revalider (`server.ts`), une carte
// repeinte change d'adresse —, et `cartes-peintes.ts` est réécrit. Rien
// n'est livré tant qu'une carte manque : un set de cartes ne mêle pas
// l'icône d'avant et la peinture.
function livrer() {
  const manquantes = TRAVAUX.filter(t => TAILLES.some(l => !existsSync(path.join(app, `${t.nom}-${l}.webp`))))
  if (manquantes.length) {
    console.log(`  rien de livré : ${manquantes.map(t => t.nom).join(', ')} manque(nt)`)
    return
  }
  const depot = path.resolve('..')
  const publics = path.join(depot, 'client/public/cartes')
  mkdirSync(publics, { recursive: true })
  const empreinte = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 10)
  const poses = new Set<string>()
  const adresse = (nom: string): string => {
    const source = path.join(app, `${nom}.webp`)
    const final = `${nom}.${empreinte(source)}.webp`
    writeFileSync(path.join(publics, final), readFileSync(source))
    poses.add(final)
    return `/cartes/${final}`
  }
  const lignes = TRAVAUX.map(t => `  '${t.nom}': ['${adresse(`${t.nom}-480`)}', '${adresse(`${t.nom}-240`)}'],`)
  writeFileSync(
    path.join(depot, 'client/src/components/cartes-peintes.ts'),
    "// Les cartes peintes de l'Expédition : l'illustration de chaque carte sans\n" +
      '// légendaire (`shared/rencontres.ts`) ; celle d’un légendaire est son\n' +
      '// médaillon. Leurs fichiers vivent dans `client/public/cartes`.\n//\n' +
      '// Écrit par `server/scripts/anime/cartes.ts --livrer` : on ne le retouche\n' +
      "// pas à la main, on relance la chaîne. Chaque fichier est nommé par son\n" +
      "// empreinte : une carte repeinte change d'adresse. Deux tailles,\n" +
      '// `[grande, petite]` : 480 × 360 pour la carte levée, 240 × 180 ailleurs.\n\n' +
      'export const CARTES_PEINTES: Readonly<Record<string, readonly [string, string]>> = {\n' +
      lignes.join('\n') +
      '\n}\n',
  )
  // Les fichiers que plus rien ne cite : ceux d'avant un repeint.
  for (const f of readdirSync(publics)) if (!poses.has(f)) rmSync(path.join(publics, f))
  console.log(`${poses.size} fichiers livrés dans client/public/cartes`)
}
