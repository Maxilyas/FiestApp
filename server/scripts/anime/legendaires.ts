// Les légendaires et les Divins peints.
//
// Les légendaires deviennent des illustrations de carte légendaire, pleine
// page, peintes à la feuille d'or — l'app pose par-dessus une pellicule holo
// vivante, plus intense encore quand il est éclaté. Les Divins deviennent des
// bijoux sacrés (or, émail, pierres), chacun sa silhouette, que l'app anime
// de lumière.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/legendaires.ts --lot
//   … --regenerer=lg:lion,dv:arbre   # repayer ces images (et ce qui part d'elles)
//   … --rare=lg:lion,…               # repayer ces versions rares seulement
//   … --redecouper=lg:lion,…         # repayer ces découpes seulement
//   … --livrer                       # puis poser les fichiers dans le client
//
// Trois passes au plus : les images, puis ce qui part d'elles (la version
// rare, repeinte sur la même pose ; les découpes, sur un fond uni), puis le
// détourage et les fichiers de l'application (WebP, dans app/). Une image
// payée n'est jamais redemandée sans ces options, et l'ancienne est gardée à
// côté ; le journal garde le coût de chacune. L'essai (le Phénix, le Kraken,
// Hélios), validé, y entre tel quel.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { coutEstime, enPartie, formatDe, generer, lancerLot, lireLot, type Partie, type Rendu } from './gemini'
import { dansLaPage, deDataUrl, pagePixels } from './pixels'

const args = process.argv.slice(2)
const LOT = args.includes('--lot')
const ATTENTE = Number(process.env.ATTENTE ?? 1800)
const MODELE = process.env.MODELE ?? 'gemini-3-pro-image'
const TAILLE = process.env.TAILLE ?? '1K'
const sortie = path.resolve('../export/legendaires/production')
mkdirSync(sortie, { recursive: true })
const fichier = (nom: string) => path.join(sortie, nom)
const existant = (nom: string) => ['png', 'jpg', 'webp'].map(e => fichier(`${nom}.${e}`)).find(f => existsSync(f))
/** Une image déjà passée par ici — là, ou mise de côté : celle-ci ne revient pas de l'essai. */
const dejaVue = (nom: string) => readdirSync(sortie).some(f => f.startsWith(`${nom}.`))
// L'essai, validé tel quel, entre dans la production : on ne repaie pas le Phénix, le Kraken ni Hélios.
const essai = path.resolve('../export/legendaires/essai')
for (const nom of ['phenix', 'phenix-rare', 'decoupe-phenix', 'kraken', 'decoupe-kraken', 'helios']) {
  if (dejaVue(nom)) continue
  for (const ext of ['jpg', 'png', 'webp']) {
    const de = path.join(essai, `${nom}.${ext}`)
    if (existsSync(de)) writeFileSync(fichier(`${nom}.${ext}`), readFileSync(de))
  }
}

/** Met une image payée de côté, datée : on ne jette jamais ce qui a coûté. */
function mettreDeCote(nom: string) {
  const f = existant(nom)
  if (!f) return
  const ext = path.extname(f)
  renameSync(f, f.slice(0, -ext.length) + `.ancien-${Date.now()}${ext}`)
}
const liste = (nom: string) => (args.find(a => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? '').split(',').filter(Boolean)

// ── Les consignes ─────────────────────────────────────────────────────────
// En anglais, comme celles des portraits. Un seul style pour les seize : une
// collection, comme un set de cartes — et aucun des douze styles des branches.

const CARTE =
  'Square illustration for a round avatar in a party quiz game: it must read instantly even as a tiny icon — one colossal creature with a bold, ' +
  'clear silhouette and a well-lit head, centered; the scene fills the whole square edge to edge: no round badge, no drawn circle, no frame, ' +
  'no border, no text, no letters, no signature, no watermark. Output one square image (1:1 aspect ratio).'

const LEGENDAIRE =
  'Style: epic fantasy full-art illustration for the rarest card of a collectible card game — a rich painterly digital painting with cinematic ' +
  'composition and scale, volumetric light and a glowing atmosphere, luminous saturated color against deep shadows, ultra detailed. Accents of real ' +
  'gold leaf and fine gilded filigree are woven into the design — the creature’s ornaments, the rims of the light, the edges of clouds and stars — ' +
  'so that a holographic foil will catch them. An original creature design: imitate no existing game, film or card.'

const OMBRE =
  'This is a legend of the shadows: the same epic finish, but darker and eerier — the gilding turns to tarnished silver and violet sheen.'

const RARE = (variante: string) =>
  'Edit the attached illustration into its rare variant, the one a player may find once in forty evenings: keep exactly the same composition, pose, ' +
  `framing, scale and level of detail, and change its colors and matter: ${variante} Same painterly style, same gold-leaf accents recolored to match. ` +
  'No text, no frame. Output one square image (1:1 aspect ratio).'

const DECOUPE = (garde: string, retirer: string) =>
  `Edit the attached image. Keep ${garde} exactly as it is — same pose, same position, same size, same outline, same colors and details, untouched. ` +
  'Replace everything else with a single perfectly flat, uniform chroma-key green (#00FF00) filling the canvas edge to edge: no gradient, no shadow, ' +
  `no glow, no texture on it. In particular, replace ${retirer} with the flat color. Do not move, resize, crop, redraw or restyle what you keep. ` +
  'Output one square image (1:1 aspect ratio).'

// Le fond d'un bijou : vert, sauf pour celui qui porte du vert (les feuilles
// d'émeraude de l'Arbre-Monde) — sur du vert, le modèle assombrissait le fond
// pour les garder, et le détourage ne trouvait plus rien à retirer.
const FONDS_DE_BIJOU = {
  vert: { nom: 'green (#00FF00)', proscrit: 'green', rvb: [0, 255, 0] },
  magenta: { nom: 'magenta (#FF00FF)', proscrit: 'pink or magenta', rvb: [255, 0, 255] },
} as const
type FondDeBijou = keyof typeof FONDS_DE_BIJOU

const BIJOU = (fond: FondDeBijou) =>
  'Style: a sacred emblem painted as a goldsmith’s masterpiece — solid polished gold, deep glowing enamel and faceted gemstones, fine filigree ' +
  'engraving, warm light gleaming on the metal; ultra detailed yet with a bold, instantly readable silhouette. Seen straight on, the emblem alone, ' +
  `centered, filling about 90% of the canvas. Background: a single perfectly flat, uniform chroma-key ${FONDS_DE_BIJOU[fond].nom} filling the entire canvas ` +
  `edge to edge — no shadow, no glow, no vignette, no light spilling onto it. Do not use any ${FONDS_DE_BIJOU[fond].proscrit} on the emblem. No text, no letters, no numbers. ` +
  'Output one square image (1:1 aspect ratio).'

interface Travail {
  nom: string
  consigne: string
  /** L'image dont il part (repeinte, découpée) : il attend qu'elle existe. */
  source?: string
}

/**
 * Les seize légendaires : chacun sa scène, qui raconte l'exploit qui le fait
 * tomber (`shared/legendaires.ts`) ; sa version rare, dans les couleurs
 * qu'avait son Éclat quand il était dessiné (`FONDS_ECLAT`,
 * `Legendaire.tsx`) ; ce que sa découpe garde et retire.
 */
interface LegendairePeint {
  id: string
  ombre?: boolean
  sujet: string
  rare: string
  garde: string
  retirer: string
}

export const LEGENDAIRES_PEINTS: LegendairePeint[] = [
  {
    id: 'phenix',
    sujet:
      'the Phoenix — a colossal firebird bursting upward out of an erupting volcano under a night full of stars, its immense wings spread ' +
      'across the whole canvas; feathers of living flame turning into golden stars at their tips, a crown of white fire, blazing golden eyes, ' +
      'embers and gold-leaf sparks spiraling around it. Palette: blazing orange, gold and crimson against a deep indigo night.',
    rare: 'the Phoenix becomes an ice phoenix — feathers of translucent crystal ice and cyan-white flame, silver and pale-gold gilding, an aurora sky of teal and violet above a volcano of blue fire.',
    garde: 'the Phoenix, its flaming wings and the flames and sparks right around its body',
    retirer: 'the volcano, the sky, the stars and the smoke',
  },
  {
    id: 'dragon',
    sujet:
      'the Golden Dragon, keeper of the treasure — a colossal dragon of living gold coiled three times around the summit of a jade mountain above ' +
      'a sea of clouds, its scales like freshly minted coins, emerald eyes, gold-leaf smoke curling from its nostrils, a hoard of gold, jewels and ' +
      'crowns spilling from the cavern beneath its claws, a full moon behind its horned head. Palette: gold and emerald against a deep green night.',
    rare: 'the Golden Dragon becomes a silver dragon — scales of polished platinum and moonstone, eyes of pale sapphire, the hoard turned to silver and pearls, a violet night with silver stars.',
    garde: 'the dragon — its head, horns, body, wings, tail and claws',
    retirer: 'the mountain, the treasure, the cavern, the clouds, the moon and the sky',
  },
  {
    id: 'oracle',
    sujet:
      'the Oracle, who sees the number before it is said — a veiled seer in flowing violet robes floating above a temple of floating stone arches ' +
      'among the stars, holding a crystal sphere in which glowing numbers and constellations swirl, a third eye of light on her brow, ribbons of ' +
      'starlight around her, golden astrolabe rings orbiting her like a celestial clock. Palette: violet, lavender and crystal cyan with gold.',
    rare: 'the Oracle becomes an emerald oracle — robes of deep jade, the crystal sphere glowing mint green, rings of pale gold, an aurora-green night.',
    garde: 'the seer with her robes, her veil, her crystal sphere and the golden rings around her',
    retirer: 'the temple, the stone arches, the stars and the sky',
  },
  {
    id: 'chouette',
    sujet:
      'the Silver Owl, who makes not a single mistake — a majestic great owl with feathers of polished silver and moonlight, wings raised wide, ' +
      'perched at the top of an ancient spiral tower of books and scrolls that rises above the clouds, piercing wise eyes of pale gold, a perfect ' +
      'ring of silver light like a bull’s-eye behind its head, a crescent moon, silver feathers drifting. Palette: silver, white and pale gold against a navy night.',
    rare: 'the Silver Owl becomes a golden owl — feathers of burnished gold, eyes of garnet, a crimson and garnet night with a golden moon.',
    garde: 'the owl and its wings',
    retirer: 'the tower of books, the scrolls, the clouds, the moon, the ring of light and the sky',
  },
  {
    id: 'tigre',
    sujet:
      'the Thunder Tiger, the fastest night after night — a colossal tiger leaping straight at the viewer out of a storm, its stripes made of ' +
      'crackling lightning, electric-blue eyes, claws of light striking the air, a thunderbolt cracking the sky behind it, sparks and rain ' +
      'shattering around it. Palette: blazing orange fur and electric blue against a deep blue storm.',
    rare: 'the Thunder Tiger becomes a white tiger — snowy fur with violet lightning stripes and silver claws, a violet storm.',
    garde: 'the tiger and the lightning of its stripes',
    retirer: 'the storm, the clouds, the rain, the sky and the thunderbolt behind it',
  },
  {
    id: 'licorne',
    sujet:
      'the Astral Unicorn, alone against everyone and right three times — a unicorn of pure white light rearing on a spiral path of stars across ' +
      'the cosmos, its mane and tail flowing like rainbow nebulae, its horn a spiral of crystal casting a beam that splits a sky of dark storm ' +
      'clouds, which part around it alone. Palette: white and rainbow nebulae against violet and indigo.',
    rare: 'the Astral Unicorn becomes a black unicorn — a coat of obsidian night with a mane of pink and magenta nebulae and a rose-gold horn, a rose and plum sky.',
    garde: 'the unicorn with its mane, its tail and its horn',
    retirer: 'the starry path, the storm clouds, the beam and the sky',
  },
  {
    id: 'lion',
    sujet:
      'the Crowned Lion, first again and again — a colossal golden lion seen close and slightly from below, filling most of the canvas: its ' +
      'mane blazes like a sun around its roaring head, a jeweled crown of gold floats just above it, one mighty paw on the top step of a marble ' +
      'palace staircase, towering crimson banners on either side, rubies and gold leaf everywhere, a sea of tiny lanterns far below. ' +
      'Palette: gold and crimson.',
    rare: 'the Crowned Lion becomes a white lion — a mane of silver and pale sapphire, a crown of diamonds and sapphires, deep blue banners and a blue twilight.',
    garde: 'the lion with its mane and its floating crown',
    retirer: 'the staircase, the banners, the palace, the lanterns and the sky',
  },
  {
    id: 'renard',
    sujet:
      'the Moon Fox, who knows the house — a spirit fox with glowing tails curled into a crescent moon, sitting on the roof of a warm, lantern-lit ' +
      'house under a huge full moon, fur of amber fire, wise and mischievous eyes, the golden windows of the house glowing below it, fireflies and ' +
      'gold-leaf autumn leaves drifting. Palette: amber and orange against a deep blue night.',
    rare: 'the Moon Fox becomes a silver moon fox — fur of moonlit silver and pale lavender with glowing silver tails, a violet night and a silver moon.',
    garde: 'the fox and its glowing tails',
    retirer: 'the house, the roof, the moon, the fireflies and the sky',
  },
  {
    id: 'comete',
    sujet:
      'the Comet, four hundred times among the fastest — a radiant star-spirit riding at the head of a colossal comet, a being of white-blue fire ' +
      'with streaming hair of light, racing past ringed planets at blinding speed, its tail of ice and starlight sweeping across the whole sky, ' +
      'speed lines of light. Palette: white, ice cyan and electric blue against a deep blue galaxy.',
    rare: 'the Comet becomes a crimson and golden comet — the star-spirit of rose and gold fire, a tail of rose-gold flame across a crimson night.',
    garde: 'the star-spirit at the head of the comet and the bright start of its tail',
    retirer: 'the planets, the stars, the galaxy and the sky',
  },
  {
    id: 'kraken',
    ombre: true,
    sujet:
      'the Kraken — a colossal abyssal titan rising from a black storm sea, its tentacles coiling around a sinking ghost ship lit by a single red ' +
      'lantern, one enormous glowing eye, lightning tearing a violet sky, spray catching the light. Palette: deep teal, black and violet, with the ' +
      'one red glow of the lantern.',
    rare: 'the Kraken becomes a creature of the deepest abyss — violet and black, its tentacles glowing with bioluminescent mint-green runes, the lantern turned emerald.',
    garde: 'the Kraken — its head, its eye and all its tentacles',
    retirer: 'the sea, the ship, the lantern, the sky and the lightning',
  },
  {
    id: 'fantome',
    ombre: true,
    sujet:
      'the Phantom, who passes and passes again and never answers — a colossal, elegant ghost seen close, towering over the viewer, its tattered ' +
      'spectral robes billowing out to the edges of the canvas, its face a gentle mask of light with hollow glowing eyes, one hand holding a ' +
      'candle whose flame bends as it passes, chains of silver mist swirling around it; behind it, the long moonlit corridor of a haunted grand ' +
      'manor, tall windows and old portraits watching. Eerie but mischievous. Palette: lavender, silver and indigo. The painting itself is ' +
      'borderless and runs off all four edges of the canvas: no frame, no rounded corners, no margin around it.',
    rare: 'the Phantom becomes an emerald phantom — spectral robes of glowing green mist, green ghost-fire candles, a dark emerald night.',
    garde: 'the phantom with its robes and its chains of mist',
    retirer: 'the corridor, the candelabra, the portraits, the windows and the floor',
  },
  {
    id: 'trou-noir',
    ombre: true,
    sujet:
      'the Black Hole, where estimates are lost in space — a colossal cosmic entity: a devouring black sphere ringed by a blazing golden accretion ' +
      'disk, spiral galaxies and scattered glowing numbers being pulled into it, the vague titanic face of a shadow in the event horizon, starlight ' +
      'bending around it. Palette: black and deep purple with a blazing gold and orange disk.',
    rare: 'the Black Hole gets an ice-cyan accretion disk and teal nebulae, the numbers glowing pale blue.',
    garde: 'the black sphere, its accretion disk and the shadowy face',
    retirer: 'the galaxies, the stars, the numbers far from it and the sky',
  },
  {
    id: 'sphinx',
    sujet:
      'the Sphinx, who has seen every question — a colossal living sphinx with a lion’s body and a serene pharaoh’s face of gold and lapis lazuli, ' +
      'wings of gold feathers half spread, reclining on top of a pyramid at dawn, a giant sun disk behind its head, hieroglyphs of light and ' +
      'question marks drifting like sand. Palette: gold, amber and lapis blue.',
    rare: 'the Sphinx becomes a sphinx of lapis lazuli and silver under a blue night, with a silver moon disk behind its head.',
    garde: 'the sphinx with its wings and its headdress',
    retirer: 'the pyramid, the sun disk, the sand, the hieroglyphs and the sky',
  },
  {
    id: 'citrouille',
    sujet:
      'the Pumpkin, carved one Halloween night, whose candle never went out — a giant enchanted jack-o’-lantern with a mischievous glowing grin, ' +
      'crowned with twisted vines and curling leaves, candlelight blazing from its eyes and mouth, rising over a moonlit pumpkin field with bats ' +
      'and swirling autumn leaves. Palette: orange and amber against a violet night.',
    rare: 'the Pumpkin becomes a ghost-white pumpkin with emerald candlelight, silver vines and an emerald night.',
    garde: 'the carved pumpkin with its vines, its leaves and its candlelight',
    retirer: 'the field, the other pumpkins, the bats, the drifting leaves, the moon and the sky',
  },
  {
    id: 'sapin',
    sujet:
      'the Fir, who has seen every Christmas and keeps a bauble for each — a colossal ancient fir tree in a snowy forest at night, hung with ' +
      'countless glowing baubles, each reflecting a different tiny memory, a star of gold at its top, snow falling, a wise face hidden in the bark, ' +
      'northern lights above. Palette: deep green, gold and warm lights against a blue night.',
    rare: 'the Fir becomes a frosted fir of ice crystal with silver-blue baubles and a star of ice, a pale blue frozen night.',
    garde: 'the great fir tree with its baubles and its star',
    retirer: 'the forest, the snowy ground, the other trees, the northern lights and the sky',
  },
  {
    id: 'bouquet',
    sujet:
      'the Grand Finale, the midnight firework the whole sky lights up for — a colossal firework spirit exploding above a city at midnight: a ' +
      'burst of gold and violet fireworks shaped like a giant blossoming flower of light with a radiant heart, the clock tower striking twelve ' +
      'below, reflections dancing on the river. Palette: gold and violet against a deep purple night.',
    rare: 'the Grand Finale becomes silver and ice-blue fireworks on a purple night.',
    garde: 'the great firework burst and its radiant heart',
    retirer: 'the city, the clock tower, the river and the sky',
  },
]

/** Les cinq Divins : chacun sa silhouette de bijou. Rien de leurs règles, qui ne quittent jamais le serveur. */
export const DIVINS_PEINTS: { id: string; sujet: string; fond?: FondDeBijou }[] = [
  {
    id: 'helios',
    sujet:
      'the divine badge of Helios, god of the sun — a radiant sun disc with a serene golden face in high relief, crowned by a corona of sharp ' +
      'golden rays of different lengths that make its silhouette, rubies and topaz set around the face, a thin ring of deep blue enamel with tiny ' +
      'gold stars behind the face.',
  },
  {
    id: 'seraphin',
    sujet:
      'the divine badge of the Seraph — six great wings in three layered pairs spreading around a radiant central eye of sapphire and diamond, ' +
      'each feather a blade of polished gold with white pearl enamel, crimson rubies at the joints of the wings, a thin halo of gold behind the eye. ' +
      'The six wings make its silhouette.',
  },
  {
    id: 'lotus',
    sujet:
      'the divine badge of the Sacred Lotus — a blooming lotus flower of pink and white enamel petals edged with gold, in three layered rows, a ' +
      'glowing opal at its heart, resting on a round golden lily pad with ripples of blue enamel, violet amethysts at the petal tips. The open ' +
      'petals make its silhouette.',
  },
  {
    id: 'arbre',
    fond: 'magenta',
    sujet:
      'the divine badge of the World Tree — a golden tree whose round crown of branches and whose roots meet in a circle, its crown set with ' +
      'twelve glowing gemstones of twelve colors (ruby red, fiery orange, golden topaz, amber, pearl white, ice-white diamond, sky blue, sapphire ' +
      'blue, turquoise, violet amethyst, lavender and emerald), leaves of emerald enamel, roots of gold intertwining. The crown and the roots make ' +
      'its silhouette.',
  },
  {
    id: 'dechu',
    sujet:
      'the divine badge of the Fallen Angel — a broken halo of blackened gold, tilted and cracked, above a pair of torn wings of black and deep ' +
      'crimson enamel whose feathers are falling away, a dark garnet heart at the center, embers of red light, broken silver chains hanging. The ' +
      'broken halo and the drooping wings make its silhouette.',
  },
]

const TRAVAUX: Travail[] = [
  ...LEGENDAIRES_PEINTS.flatMap(l => [
    { nom: l.id, consigne: [CARTE, LEGENDAIRE, l.ombre ? OMBRE : '', `Subject: ${l.sujet}`].filter(Boolean).join('\n\n') },
    { nom: `${l.id}-rare`, source: l.id, consigne: RARE(l.rare) },
    { nom: `decoupe-${l.id}`, source: l.id, consigne: DECOUPE(l.garde, l.retirer) },
  ]),
  ...DIVINS_PEINTS.map(d => ({ nom: d.id, consigne: [BIJOU(d.fond ?? 'vert'), `Subject: ${d.sujet}`].join('\n\n') })),
]

// Ce qu'on repaie : l'image mise de côté, ce qui part d'elle avec — la
// version rare et la découpe repartent de la nouvelle.
const peint = (cle: string) => (cle.startsWith('lg:') ? LEGENDAIRES_PEINTS.find(l => l.id === cle.slice(3)) : undefined)
for (const cle of liste('regenerer')) {
  const l = peint(cle)
  if (l) for (const nom of [l.id, `${l.id}-rare`, `decoupe-${l.id}`]) mettreDeCote(nom)
  else if (cle.startsWith('dv:') && DIVINS_PEINTS.some(d => d.id === cle.slice(3))) mettreDeCote(cle.slice(3))
  else throw new Error(`${cle} : ni un légendaire ni un Divin peint`)
}
for (const [option, nom] of [
  ['rare', (id: string) => `${id}-rare`],
  ['redecouper', (id: string) => `decoupe-${id}`],
] as const) {
  for (const cle of liste(option)) {
    const l = peint(cle)
    if (!l) throw new Error(`--${option}=${cle} : un légendaire seulement — un Divin n'a qu'une image, son bijou`)
    mettreDeCote(nom(l.id))
  }
}

// ── Le journal ────────────────────────────────────────────────────────────

const cheminJournal = path.resolve('../export/legendaires/journal-legendaires.json')
const lireJournal = (): any[] => (existsSync(cheminJournal) ? JSON.parse(readFileSync(cheminJournal, 'utf8')) : [])
function ranger(nom: string, r: Rendu, lot: boolean) {
  writeFileSync(fichier(`${nom}.${formatDe(r.image).ext}`), r.image)
  const journal = lireJournal()
  const cout = coutEstime(r.jetons, { lot })
  journal.push({ nom, date: new Date().toISOString(), modele: MODELE, taille: TAILLE, lot, jetons: r.jetons, cout })
  writeFileSync(cheminJournal, JSON.stringify(journal, null, 2) + '\n')
  console.log(`  ${nom} : environ ${cout.toFixed(3)} $ (total ${journal.reduce((n, e) => n + (e.cout ?? 0), 0).toFixed(2)} $)`)
}

// ── Le tout ───────────────────────────────────────────────────────────────

const cheminLots = path.resolve('../export/legendaires/lots-en-cours.json')
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

const enCours = existsSync(cheminLots) ? JSON.parse(readFileSync(cheminLots, 'utf8') || '[]') : []
if (enCours.length && !(await attendre(enCours))) process.exit(0)

for (let passe = 1; passe <= 3; passe++) {
  const aFaire = TRAVAUX.filter(t => !existant(t.nom) && (!t.source || existant(t.source)))
  if (!aFaire.length) break
  const demandes = aFaire.map(t => {
    writeFileSync(fichier(`consigne-${t.nom}.txt`), t.consigne + '\n')
    const parties: Partie[] = t.source ? [enPartie(existant(t.source)!), { text: t.consigne }] : [{ text: t.consigne }]
    return { cle: t.nom, parties }
  })
  console.log(`Passe ${passe} : ${aFaire.map(t => t.nom).join(', ')}`)
  if (LOT) {
    const nom = await lancerLot(demandes, { modele: MODELE, taille: TAILLE, nom: 'fiestapp-legendaires' })
    writeFileSync(cheminLots, JSON.stringify([nom]) + '\n')
    console.log(`lot ${nom}`)
    if (!(await attendre([nom]))) process.exit(0)
  } else {
    for (const d of demandes) ranger(d.cle, await generer(d.parties, { modele: MODELE, taille: TAILLE }), false)
  }
}

// ── L'assemblage : les fichiers de l'application ─────────────────────────
// Pour 100 unités du médaillon de `Legendaire.tsx` (le disque, r 45 : 90 de
// diamètre), en 512 et 256 pixels :
// - `art` et `rare` : le carré du disque, pris au centre de l'illustration
//   (84 % de sa largeur, comme la forme ultime d'une branche) ;
// - `perso` : la créature détourée, dans le même carré — sa forme fait la
//   silhouette dorée d'un légendaire à gagner (la petite taille suffit) ;
// - `rare-perso` : la créature rare, dans un cadre plus large (−20 → 120),
//   d'où elle sort du disque quand elle est éclatée.
// Et pour chaque Divin, son badge détouré, sur tout le carré.
export const DISQUE_LEGENDAIRE = 0.84
export const CADRE_DEBORD: [number, number] = [-20, 140]

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'legendaires.js'))('playwright')
}
const { chromium } = chargerPlaywright()
const nav = await chromium.launch({ headless: true })
try {
  const page = await pagePixels(nav, 512)
  const enDataUrl = (f: string) => {
    const b = readFileSync(f)
    return `data:${formatDe(b).mime};base64,${b.toString('base64')}`
  }
  const app = path.join(sortie, 'app')
  mkdirSync(app, { recursive: true })
  const poser = (nom: string, data: string) => writeFileSync(path.join(app, `${nom}.webp`), deDataUrl(data))
  for (const l of LEGENDAIRES_PEINTS) {
    const image = existant(l.id)
    const rare = existant(`${l.id}-rare`)
    const dec = existant(`decoupe-${l.id}`)
    if (!image || !rare || !dec) {
      console.log(`  ${l.id} : incomplet (${[!image && 'image', !rare && 'rare', !dec && 'découpe'].filter(Boolean).join(', ')})`)
      continue
    }
    const d = await dansLaPage<any>(page, 'detourer', enDataUrl(dec), null, [0, 255, 0])
    const a = await dansLaPage<any>(page, 'aligner', enDataUrl(image), d.plein)
    const base = await dansLaPage<any>(page, 'assembler', { image: enDataUrl(image), decoupe: d.plein, ...a, disque: DISQUE_LEGENDAIRE, cadre: [0, 100], tailles: [512, 256], qualite: 0.84 })
    poser(`${l.id}-art-512`, base.disque[512])
    poser(`${l.id}-art-256`, base.disque[256])
    poser(`${l.id}-perso-256`, base.perso[256])
    // La version rare garde la pose : elle prend la découpe de l'autre telle quelle
    // — alignée par la couleur, qu'elle a changée, elle déraillait.
    const r = await dansLaPage<any>(page, 'assembler', { image: enDataUrl(rare), decoupe: d.plein, ...a, disque: DISQUE_LEGENDAIRE, cadre: CADRE_DEBORD, tailles: [512, 256], qualite: 0.84 })
    poser(`${l.id}-rare-512`, r.disque[512])
    poser(`${l.id}-rare-256`, r.disque[256])
    poser(`${l.id}-rare-perso-512`, r.perso[512])
    poser(`${l.id}-rare-perso-256`, r.perso[256])
    const doute = d.bordFaux || d.transparents < 0.2 || !(a.ecart < 35)
    console.log(`  ${doute ? '⚠ ' : ''}${l.id} : ${(d.transparents * 100).toFixed(0)} % transparent, aligné ×${a.s.toFixed(3)}, écart ${a.ecart.toFixed(0)}`)
  }
  for (const dv of DIVINS_PEINTS) {
    const badge = existant(dv.id)
    if (!badge) {
      console.log(`  ${dv.id} : pas encore de badge`)
      continue
    }
    const d = await dansLaPage<any>(page, 'detourer', enDataUrl(badge), null, FONDS_DE_BIJOU[dv.fond ?? 'vert'].rvb)
    const r = await dansLaPage<any>(page, 'assembler', { image: d.plein, disque: 1, cadre: [0, 100], tailles: [512, 256], qualite: 0.84 })
    poser(`${dv.id}-badge-512`, r.perso[512])
    poser(`${dv.id}-badge-256`, r.perso[256])
    console.log(`  ${d.bordFaux || d.transparents < 0.2 ? '⚠ ' : ''}${dv.id} : ${(d.transparents * 100).toFixed(0)} % transparent`)
  }
  console.log(app)
  if (args.includes('--livrer')) livrer(app)
} finally {
  await nav.close()
}

// ── La livraison ──────────────────────────────────────────────────────────
// `--livrer` : les fichiers rejoignent `client/public/medaillons`, nommés par
// leur empreinte — servis un an sans revalider (`server.ts`), un médaillon
// repeint change d'adresse —, et les deux tables que lisent `Legendaire.tsx`
// et `Divin.tsx` sont réécrites. Rien n'est livré d'un médaillon incomplet.
function livrer(app: string) {
  const depot = path.resolve('..')
  const publics = path.join(depot, 'client/public/medaillons')
  mkdirSync(publics, { recursive: true })
  const empreinte = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 10)
  const poses = new Set<string>()
  const poser = (nom: string): string => {
    const source = path.join(app, `${nom}.webp`)
    if (!existsSync(source)) throw new Error(`${nom}.webp manque : relance l'assemblage`)
    const final = `${nom}.${empreinte(source)}.webp`
    writeFileSync(path.join(publics, final), readFileSync(source))
    poses.add(final)
    return `/medaillons/${final}`
  }
  const paire = (nom: string) => `['${poser(`${nom}-512`)}', '${poser(`${nom}-256`)}']`
  const lignes = LEGENDAIRES_PEINTS.map(
    l =>
      `  'lg:${l.id}': {\n` +
      `    art: ${paire(`${l.id}-art`)},\n` +
      `    rare: ${paire(`${l.id}-rare`)},\n` +
      `    perso: '${poser(`${l.id}-perso-256`)}',\n` +
      `    rarePerso: ${paire(`${l.id}-rare-perso`)},\n` +
      `  },`,
  )
  const badges = DIVINS_PEINTS.map(d => `  'dv:${d.id}': ${paire(`${d.id}-badge`)},`)
  const entete = (quoi: string, tailles: string) =>
    `// ${quoi}, peints : leurs fichiers, dans \`client/public/medaillons\`.\n//\n` +
    `// Écrit par \`server/scripts/anime/legendaires.ts --livrer\` : on ne le retouche\n` +
    `// pas à la main, on relance la chaîne. Chaque fichier est nommé par son\n` +
    `// empreinte : un médaillon repeint change d'adresse, et aucun téléphone ne\n` +
    `// garde l'ancien. Deux tailles, \`[grande, petite]\` : ${tailles}\n`
  writeFileSync(
    path.join(depot, 'client/src/components/legendaires-peints.ts'),
    entete('Les seize légendaires', '512 et 256 pixels pour\n// le disque (le médaillon en fait 90 % du côté).') +
      `\nexport interface ImagesDeLegendaire {\n` +
      `  /** L'illustration, sur le carré du disque. */\n  art: [string, string]\n` +
      `  /** Sa version rare, éclatée : la même pose, ses couleurs rares. */\n  rare: [string, string]\n` +
      `  /** La créature seule, détourée : sa forme fait la silhouette d'un légendaire à gagner. */\n  perso: string\n` +
      `  /** La créature rare, dans un cadre plus large (−20 → 120 du disque) : ce qui sort du cadre d'un éclaté. */\n  rarePerso: [string, string]\n}\n\n` +
      `export const IMAGES: Record<string, ImagesDeLegendaire> = {\n${lignes.join('\n')}\n}\n`,
  )
  writeFileSync(
    path.join(depot, 'client/src/components/divins-peints.ts'),
    entete('Les cinq Divins', '512 et 256 pixels pour\n// le côté du bijou.') + `\n/** Le bijou de chaque Divin, détouré, sur tout le carré. */\nexport const BADGES: Record<string, [string, string]> = {\n${badges.join('\n')}\n}\n`,
  )
  // Les fichiers qu'aucune table ne cite plus : ceux d'avant un repeint.
  for (const f of readdirSync(publics)) if (!poses.has(f)) rmSync(path.join(publics, f))
  console.log(`${poses.size} fichiers livrés dans client/public/medaillons`)
}
