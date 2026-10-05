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
//   … --retoucher=lg:coq,…           # repayer ces retouches (et la version rare qui en part)
//   … --livrer                       # puis poser les fichiers dans le client
//
// Quatre passes au plus : les images, leur retouche quand il en faut une,
// puis ce qui part d'elles (la version rare, repeinte sur la même pose ; les
// découpes, sur un fond uni), une de plus pour ce qu'un lot aurait refusé ;
// puis le détourage et les fichiers de l'application (WebP, dans app/). Une
// image payée n'est jamais redemandée sans ces options, et l'ancienne est
// gardée à côté ; le journal garde le coût de chacune. L'essai (le Phénix, le
// Kraken, Hélios), validé, y entre tel quel.
//
// Les originaux vivent dans `export/`, hors du dépôt, sur la machine qui les
// a payés. Une autre machine — un conteneur neuf, qui ne peint que les
// derniers venus — ne les a pas : un médaillon déjà livré dont elle n'a
// aucune image n'y est pas repeint (sans quoi elle repaierait tout le
// catalogue), et `--livrer` fusionne au lieu de tout réécrire (plus bas).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { coutEstime, enPartie, formatDe, generer, lancerLot, lireLot, type Demande, type Partie, type Rendu } from './gemini'
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
// En anglais, comme celles des portraits. Un seul style pour les vingt-six :
// une collection, comme un set de cartes — et aucun des douze styles des
// branches.

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

// Le fond uni d'un bijou ou d'une découpe : vert, sauf pour qui porte du vert
// (les feuilles d'émeraude de l'Arbre-Monde, les écailles de l'Ouroboros, les
// plumes du Serpent à plumes) — sur du vert, le modèle assombrissait le fond
// pour les garder, et le détourage, qui lit l'opacité dans l'écart à la
// couleur du fond, perçait l'émeraude ou ne trouvait plus rien à retirer.
const FONDS_UNIS = {
  vert: { nom: 'green (#00FF00)', proscrit: 'green', rvb: [0, 255, 0] },
  magenta: { nom: 'magenta (#FF00FF)', proscrit: 'pink or magenta', rvb: [255, 0, 255] },
} as const
type FondUni = keyof typeof FONDS_UNIS

// Une retouche : ce que la consigne n'a pas suffi à empêcher (des lettres
// revenues deux fois), retiré de l'illustration après coup, sans la repeindre.
const RETOUCHE = (retouche: string) =>
  `Edit the attached illustration: ${retouche} Keep everything else exactly as it is — same composition, same creature, same pose, ` +
  'same colors, same light and details. No text, no letters, no frame. Output one square image (1:1 aspect ratio).'

const DECOUPE = (garde: string, retirer: string, fond: FondUni) =>
  `Edit the attached image. Keep ${garde} exactly as it is — same pose, same position, same size, same outline, same colors and details, untouched. ` +
  `Replace everything else with a single perfectly flat, uniform chroma-key ${FONDS_UNIS[fond].nom} filling the canvas edge to edge: no gradient, no shadow, ` +
  `no glow, no texture on it. In particular, replace ${retirer} with the flat color. Do not move, resize, crop, redraw or restyle what you keep. ` +
  'Output one square image (1:1 aspect ratio).'

const BIJOU = (fond: FondUni) =>
  'Style: a sacred emblem painted as a goldsmith’s masterpiece — solid polished gold, deep glowing enamel and faceted gemstones, fine filigree ' +
  'engraving, warm light gleaming on the metal; ultra detailed yet with a bold, instantly readable silhouette. Seen straight on, the emblem alone, ' +
  `centered, filling about 90% of the canvas. Background: a single perfectly flat, uniform chroma-key ${FONDS_UNIS[fond].nom} filling the entire canvas ` +
  `edge to edge — no shadow, no glow, no vignette, no light spilling onto it. Do not use any ${FONDS_UNIS[fond].proscrit} on the emblem. No text, no letters, no numbers. ` +
  'Output one square image (1:1 aspect ratio).'

interface Travail {
  nom: string
  /** Le médaillon dont il est une image (`lg:phenix` pour le Phénix, sa version rare et sa découpe). */
  cle: string
  consigne: string
  /** L'image dont il part (repeinte, découpée) : il attend qu'elle existe. */
  source?: string
}

/**
 * Les vingt-six légendaires : chacun sa scène, qui raconte l'exploit qui le
 * fait tomber (`shared/legendaires.ts`) ; sa version rare, dans les couleurs
 * de son Éclat (`FONDS_ECLAT`, `Legendaire.tsx`) ; ce que sa découpe garde et
 * retire.
 */
interface LegendairePeint {
  id: string
  ombre?: boolean
  sujet: string
  rare: string
  garde: string
  retirer: string
  /** Le fond uni de sa découpe, vert sauf pour une créature qui porte du vert. */
  fond?: FondUni
  /**
   * Une retouche de l'illustration (`RETOUCHE`) : elle devient l'image du
   * médaillon, et sa version rare part d'elle. La découpe part toujours de
   * l'illustration peinte, que la retouche ne déplace pas.
   */
  retouche?: string
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
  // Ceux du quiz du jour et de la campagne (le 5 octobre 2026), puis les deux
  // des trois mondes. Chacun garde sa silhouette à vingt pixels : l'aigle aux
  // ailes ouvertes, l'anneau du serpent, le disque du scarabée, la queue du
  // coq, les ailes de la chauve-souris, la flamme de la salamandre, la tour de
  // l'éléphant, les plumes du serpent, les trois têtes de la chimère, les
  // deux visages de Janus.
  {
    id: 'aigle',
    sujet:
      'the Laurel Eagle, thirty times crowned — a colossal imperial eagle of living gold perched at the very top of a towering marble ' +
      'triumphal column at dawn, its immense wings spread wide across the whole canvas, a crown of golden laurel leaves on its proud head, ' +
      'fierce amber eyes and a hooked golden beak, its breast feathers like gilded scales; the first rays of the sun light its head and ' +
      'breast, a huge sun disc rises on the horizon behind the column, golden laurel leaves fly around it on the wind, marble domes far ' +
      'below in the morning mist. Palette: gold and amber against a rose and pale-blue dawn.',
    rare: 'the Laurel Eagle becomes a silver eagle — feathers of polished silver and white gold, a crown of silver laurel, eyes of pale amethyst, a sky of deep imperial purple with a silver sun.',
    garde: 'the eagle with its spread wings, its talons and its laurel crown',
    retirer: 'the column, the domes, the mist, the sun disc, the flying laurel leaves and the sky',
  },
  {
    id: 'ouroboros',
    sujet:
      'the Ouroboros, a hundred days in a row and the circle never broke — a colossal serpent biting its own tail, its body forming one ' +
      'perfect, unbroken ring centered on the canvas and filling about three quarters of it; scales of gold and emerald enamel, each edged ' +
      'with fine gilded filigree; its great head at the top of the ring, well lit, with glowing golden eyes, its jaws closed on the tip of ' +
      'its tail; inside the ring floats a celestial dial, half day and half night — a golden sun on one side, a silver crescent moon and ' +
      'stars on the other; all around, the deep cosmos with nebulae and gold-leaf stars. Palette: gold and emerald against a deep blue-black cosmos.',
    rare: 'the Ouroboros becomes an obsidian serpent — scales of polished black obsidian veined with glowing emerald and edged with pale gold, the dial of silver and jade, a deep green night.',
    garde: 'the serpent — its head, its whole ring-shaped body and its tail',
    retirer: 'the dial inside the ring, the sun, the moon, the stars, the nebulae and the sky',
    fond: 'magenta',
  },
  {
    id: 'scarabee',
    sujet:
      'the Solar Scarab, who pushed the sun up every morning for a whole month — a colossal sacred scarab beetle, an original creature ' +
      'inspired by the ancient sun beetle, facing the viewer with its wings spread wide in panels of lapis-lazuli and turquoise enamel edged ' +
      'with gold, its shell of polished gold engraved with filigree, its head well lit, raising between its front legs an immense blazing ' +
      'disc of the sun above its head; below, golden dunes at dawn; rays of gold-leaf light and drifting sand sparkle around it. ' +
      'Palette: gold, lapis blue and turquoise against a rose and amber dawn.',
    rare: 'the Solar Scarab becomes a silver scarab raising a full moon — a shell of polished silver and moonstone, wings of sapphire and pale-blue enamel, the sun disc turned into a glowing silver moon, the dunes under a deep blue starry night.',
    garde: 'the scarab with its spread wings and the great disc it raises',
    retirer: 'the dunes, the rays of light, the drifting sand and the sky',
  },
  {
    id: 'coq',
    sujet:
      // Sa première girouette portait les points cardinaux, lettres comprises :
      // on la lui veut nue. La seconde les portait encore (la retouche, plus bas).
      'the Dawn Rooster, twenty times up before everyone else — a magnificent colossal rooster crowing on the arrow of an old wrought-iron ' +
      'weathervane — a plain arrow on a pole, without any letters, compass points or cardinal signs — above the slate roofs and chimneys of ' +
      'a sleeping village, its plumage of living flame — crimson, orange and gold —, its long arching tail feathers sweeping like fire, a ' +
      'bright crimson comb, its beak wide open to the first rays of the sun that light its head and breast; the morning star still shines ' +
      'in a violet and rose sky, gold-leaf glints on every feather. Palette: flame red, orange and gold against a violet and rose dawn.',
    rare: 'the Dawn Rooster becomes a white rooster of snow and silver — white plumage edged with silver, a comb of pale ice blue, silver tail feathers, at the blue hour before sunrise: a deep blue sky with the morning star, the village in blue and silver.',
    garde: 'the rooster with its comb, its tail feathers and its feet',
    retirer: 'the weathervane, the roofs, the chimneys, the village, the morning star and the sky',
    retouche: 'remove the compass cross and all its letters from the weathervane pole — below the arrow, the pole is bare and plain, with nothing attached to it.',
  },
  {
    id: 'chauve-souris',
    ombre: true,
    // Sa première horloge affichait « 11:45 » en chiffres, et les tiges de
    // fonte qui croisaient ses ailes restaient dans sa découpe : un cadran
    // nu, une fonte qui passe derrière, et la chauve-souris plus grande.
    sujet:
      'the Bat, ten times on the last metro — an elegant colossal bat gliding toward the viewer, seen close, its body and face large at the ' +
      'center of the canvas, its wide wings spread across the whole canvas and standing out clearly against the night sky, its furry face ' +
      'with large ears and glowing pale-violet eyes lit from below by warm lamps, mischievous rather than menacing; below and behind it, ' +
      'the ornate entrance of a Parisian metro station in the Art Nouveau style — curving cast-iron stems like plant stalks, a fan-shaped ' +
      'glass canopy, two glowing amber lamps —, an original design with no lettering, no sign and no logo, whose ironwork never crosses the ' +
      'wings; on a cast-iron post, a round station clock with a blank face — no numbers, no digits —, its two golden hands showing a ' +
      'quarter to midnight; a full moon low in the sky, the empty wet street gleaming. Its wing membranes shine like tarnished silver with ' +
      'a violet sheen. Palette: tarnished silver, violet and midnight blue, with the warm amber of the lamps.',
    rare: 'the Bat becomes an emerald bat — wings of dark emerald membrane with glowing green veins, eyes of mint light, the lamps and the moon turned to eerie green, a dark emerald night.',
    // Sa découpe a gardé l'édicule que ses pattes effleurent : on le lui
    // décrit pièce par pièce.
    garde: 'the bat alone — its head, its furry body, its feet and its two spread wings',
    retirer:
      'the whole metro entrance below the bat — its fan-shaped glass canopy, its iron arches, pillars and railings, its stairs and its ' +
      'lamps —, the clock on its post, the moon, the wet street and the sky',
  },
  {
    id: 'salamandre',
    sujet:
      'the Salamander, one single life and nine right answers in the fire — a colossal fire salamander walking unharmed through a wall of ' +
      'roaring flames, its sleek body curved in an S toward the viewer, glossy black skin patterned with molten gold that glows like lava, ' +
      'ember-red eyes, its head raised proudly and well lit; a single heart-shaped flame floats just above its head, its one life; embers ' +
      'and gold-leaf sparks swirl all around. Palette: black and molten gold with orange and crimson flames against a dark smoky red.',
    rare: 'the Salamander becomes an ice salamander — skin of translucent blue ice with silver patterns, walking through cold blue and white flames, the heart-shaped flame turned ice blue, a deep midnight-blue background.',
    garde: 'the salamander with its tail and the heart-shaped flame above its head',
    retirer: 'the wall of flames, the embers far from it, the smoke and the background',
  },
  {
    id: 'elephant',
    sujet:
      'the Elephant, two thousand right answers: the memory of an elephant — a colossal wise elephant walking toward the viewer under a ' +
      'starry night, adorned with gold — a jeweled golden headdress, a caparison of crimson and gold filigree, gold-capped tusks —, its ' +
      'trunk raised in greeting, kind and knowing eyes, its head well lit; on its back rises a tall tower of ancient books and scrolls bound ' +
      'with golden ribbons; glowing constellations and gold-leaf stars above. Palette: warm slate grey, gold and crimson against a deep blue starry night.',
    rare: 'the Elephant becomes a white elephant — a coat of pearly white, ornaments of silver and sapphire, the books bound in silver and blue, a deep sapphire night with silver stars.',
    garde: 'the elephant with its ornaments and the tower of books and scrolls on its back',
    retirer: 'the ground, the stars, the constellations and the sky',
  },
  {
    id: 'serpent',
    sujet:
      'the Feathered Serpent, thirty steps of a single series — a colossal serpent covered with emerald and turquoise feathers, an original ' +
      'creature, coiling up the steep stairway of a stepped pyramid that rises out of a misty jungle; its great feathered head, seen close ' +
      'and well lit, with a crest of long emerald plumes and golden eyes, fills the upper part of the canvas as it reaches the golden temple ' +
      'at the very top; ornaments of jade and gold along its body; the morning sun breaks through the mist, gold-leaf glints on every ' +
      'feather. Palette: emerald, turquoise and gold against a misty green jungle and a golden sky.',
    rare: 'the Feathered Serpent becomes a crimson one — feathers of purple and crimson edged with gold, at sunset: a purple and orange sky, the pyramid in shadow.',
    // La première découpe gardait la pyramide, que le serpent enlace : on la
    // lui nomme en entier, quitte à interrompre son corps derrière elle.
    garde: 'the feathered serpent alone — its head, its crest, its whole coiling body and its golden ornaments',
    retirer:
      'the stepped pyramid entirely — even where the serpent coils in front of it or behind it: where its body passed behind the pyramid, ' +
      'it may simply look interrupted —, the temple, the stairway, the jungle, the mist, the clouds, the sun and the sky',
    fond: 'magenta',
  },
  {
    id: 'chimere',
    sujet:
      'the Chimera, the three worlds at once — a colossal chimera, an original creature: the body and roaring head of a golden lion with a ' +
      'mane of fire, a goat’s head with spiral horns rising from its back, and a serpent for a tail that rears up behind it, fangs bared; ' +
      'it stands on a rocky crag among swirling flames and gold-leaf embers under a stormy sky lit with fire, the lion’s head in front and ' +
      'well lit. Palette: gold, fiery orange and crimson against a dark stormy red.',
    rare: 'the Chimera becomes silver and blue — a mane of silver and pale sapphire, the goat of moonstone, the serpent of blue steel, cold blue flames, a deep blue night.',
    garde: 'the chimera — the lion with its mane, the goat’s head and horns, and the serpent tail',
    retirer: 'the crag, the flames around it, the embers, the clouds and the sky',
  },
  {
    id: 'janus',
    sujet:
      'Janus, three times king of an evening and three times winner of the day — a colossal divine bust of marble and gold with one head ' +
      'and two noble faces looking in opposite directions, in profile, both well lit, sharing a single crown — a jeweled royal crown on the ' +
      'night side, golden laurel leaves on the day side —, set under a great marble archway that splits the sky in two: on the night side, ' +
      'the lights of a joyous party, lanterns and fireworks under the stars; on the day side, a radiant golden sun and a bright morning sky. ' +
      'Palette: marble white and gold, with deep indigo night on one side and warm golden day on the other.',
    rare: 'Janus becomes silver and moonstone — the bust of moonstone and silver, the crown of silver and pearls, both halves of the sky turned to a silver-blue twilight.',
    garde: 'the two-faced bust and its crown',
    retirer: 'the archway, the sky, the party lights, the fireworks, the sun and the background',
  },
]

/** Les six Divins : chacun sa silhouette de bijou. Rien de leurs règles, qui ne quittent jamais le serveur. */
export const DIVINS_PEINTS: { id: string; sujet: string; fond?: FondUni }[] = [
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
  {
    // Le seul en hauteur : ni disque, ni ailes, ni corolle — un sablier
    // debout, que son anneau traverse en biais. Ses ampoules sont d'un
    // cristal qui ne laisse pas voir au travers : du verre clair aurait
    // montré le fond vert, que le détourage aurait percé.
    id: 'chronos',
    sujet:
      'the divine badge of Chronos — a tall upright hourglass of polished gold, its two bulbs of luminous amber crystal glowing from within, ' +
      'opaque and full of golden sand, framed by slender twisted golden pillars, crowned at its top by a radiant golden sun and a silver ' +
      'crescent moon set side by side, a slim ring of deep blue enamel engraved with the twelve signs of the zodiac in fine gold orbiting ' +
      'diagonally around its waist like the ring of a planet, sapphires and rubies set into its base. The upright hourglass, the sun and ' +
      'the moon above it and the tilted ring make its silhouette.',
  },
]

/** L'image d'un légendaire : son illustration, ou sa retouche s'il en a une. */
const imageDe = (l: LegendairePeint) => (l.retouche ? `${l.id}-retouche` : l.id)

const TRAVAUX: Travail[] = [
  ...LEGENDAIRES_PEINTS.flatMap(l => {
    const cle = `lg:${l.id}`
    return [
      { nom: l.id, cle, consigne: [CARTE, LEGENDAIRE, l.ombre ? OMBRE : '', `Subject: ${l.sujet}`].filter(Boolean).join('\n\n') },
      ...(l.retouche ? [{ nom: `${l.id}-retouche`, cle, source: l.id, consigne: RETOUCHE(l.retouche) }] : []),
      { nom: `${l.id}-rare`, cle, source: imageDe(l), consigne: RARE(l.rare) },
      { nom: `decoupe-${l.id}`, cle, source: l.id, consigne: DECOUPE(l.garde, l.retirer, l.fond ?? 'vert') },
    ]
  }),
  ...DIVINS_PEINTS.map(d => ({ nom: d.id, cle: `dv:${d.id}`, consigne: [BIJOU(d.fond ?? 'vert'), `Subject: ${d.sujet}`].join('\n\n') })),
]

// Les deux tables que `--livrer` écrit et que l'application lit : ce qui est
// déjà livré, et à quelles adresses.
const depot = path.resolve('..')
const TABLES = {
  legendaires: path.join(depot, 'client/src/components/legendaires-peints.ts'),
  divins: path.join(depot, 'client/src/components/divins-peints.ts'),
}
const lireTable = async (f: string, nom: string): Promise<Record<string, any>> =>
  existsSync(f) ? ((await import(pathToFileURL(f).href))[nom] ?? {}) : {}
const LIVRES_LEGENDAIRES = await lireTable(TABLES.legendaires, 'IMAGES')
const LIVRES_DIVINS = await lireTable(TABLES.divins, 'BADGES')
const livre = (cle: string) => cle in LIVRES_LEGENDAIRES || cle in LIVRES_DIVINS

// Ce qu'on repaie : l'image mise de côté, ce qui part d'elle avec — la
// version rare et la découpe repartent de la nouvelle.
const peint = (cle: string) => (cle.startsWith('lg:') ? LEGENDAIRES_PEINTS.find(l => l.id === cle.slice(3)) : undefined)
for (const cle of liste('regenerer')) {
  const l = peint(cle)
  if (l) for (const nom of [l.id, `${l.id}-retouche`, `${l.id}-rare`, `decoupe-${l.id}`]) mettreDeCote(nom)
  else if (cle.startsWith('dv:') && DIVINS_PEINTS.some(d => d.id === cle.slice(3))) mettreDeCote(cle.slice(3))
  else throw new Error(`${cle} : ni un légendaire ni un Divin peint`)
}
for (const [option, noms] of [
  ['rare', (id: string) => [`${id}-rare`]],
  ['redecouper', (id: string) => [`decoupe-${id}`]],
  // La version rare part de la retouche : elle repart avec elle.
  ['retoucher', (id: string) => [`${id}-retouche`, `${id}-rare`]],
] as const) {
  for (const cle of liste(option)) {
    const l = peint(cle)
    if (!l) throw new Error(`--${option}=${cle} : un légendaire seulement — un Divin n'a qu'une image, son bijou`)
    if (option === 'retoucher' && !l.retouche) throw new Error(`--retoucher=${cle} : ce légendaire n'a pas de retouche`)
    for (const nom of noms(l.id)) mettreDeCote(nom)
  }
}

// Un médaillon déjà livré dont cette machine n'a jamais vu une image — ses
// originaux sont restés sur celle qui les a payés — n'est pas à faire : sans
// cette règle, un conteneur neuf venu peindre un seul nouveau légendaire
// repeignait tout le catalogue, à ses frais, et livrait des médaillons que
// personne n'avait regardés. `--regenerer` le repeint quand même ; `--rare`,
// `--redecouper` et `--retoucher` ont besoin de son image, qui est ailleurs.
// Une seule de ses images vue ici suffit : la retouche ajoutée au Coq après
// sa livraison se demande.
const repeints = new Set(liste('regenerer'))
const vuIci = (cle: string) => TRAVAUX.some(t => t.cle === cle && dejaVue(t.nom))
const aPeindre = (t: Travail) => !livre(t.cle) || vuIci(t.cle) || repeints.has(t.cle)

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

// Un lot en ligne ne passe pas les vingt mégaoctets, et chaque version rare,
// chaque découpe y envoie son image : une vingtaine d'images d'un mégaoctet
// et demi, en base64, les dépassaient. Les demandes partent alors en
// plusieurs lots, attendus ensemble.
const POIDS_MAX_D_UN_LOT = 15_000_000
function enLots(demandes: Demande[]): Demande[][] {
  const lots: Demande[][] = []
  let poids = Infinity
  for (const d of demandes) {
    const p = d.parties.reduce((n, x) => n + (x.inlineData?.data.length ?? 0) + (x.text?.length ?? 0), 0)
    if (poids + p > POIDS_MAX_D_UN_LOT) {
      lots.push([])
      poids = 0
    }
    lots[lots.length - 1].push(d)
    poids += p
  }
  return lots
}

for (let passe = 1; passe <= 4; passe++) {
  const aFaire = TRAVAUX.filter(t => !existant(t.nom) && (!t.source || existant(t.source)) && aPeindre(t))
  if (!aFaire.length) break
  const demandes = aFaire.map(t => {
    writeFileSync(fichier(`consigne-${t.nom}.txt`), t.consigne + '\n')
    const parties: Partie[] = t.source ? [enPartie(existant(t.source)!), { text: t.consigne }] : [{ text: t.consigne }]
    return { cle: t.nom, parties }
  })
  console.log(`Passe ${passe} : ${aFaire.map(t => t.nom).join(', ')}`)
  if (LOT) {
    const noms: string[] = []
    for (const paquet of enLots(demandes)) {
      noms.push(await lancerLot(paquet, { modele: MODELE, taille: TAILLE, nom: 'fiestapp-legendaires' }))
      // Noté à chaque lot lancé : un arrêt entre deux ne perd pas celui qui est déjà payé.
      writeFileSync(cheminLots, JSON.stringify(noms) + '\n')
    }
    console.log(`lot${noms.length > 1 ? 's' : ''} ${noms.join(', ')}`)
    if (!(await attendre(noms))) process.exit(0)
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
  // Livrés d'ailleurs, sans un original ici : la livraison garde leur entrée.
  const ailleurs: string[] = []
  for (const l of LEGENDAIRES_PEINTS) {
    // Retouché, c'est sa retouche qui fait le médaillon ; la découpe, partie
    // de l'illustration peinte, retombe dessus par l'alignement.
    const image = existant(imageDe(l))
    const rare = existant(`${l.id}-rare`)
    const dec = existant(`decoupe-${l.id}`)
    if (!image && !rare && !dec && livre(`lg:${l.id}`)) {
      ailleurs.push(l.id)
      continue
    }
    if (!image || !rare || !dec) {
      console.log(`  ${l.id} : incomplet (${[!image && 'image', !rare && 'rare', !dec && 'découpe'].filter(Boolean).join(', ')})`)
      continue
    }
    const d = await dansLaPage<any>(page, 'detourer', enDataUrl(dec), null, FONDS_UNIS[l.fond ?? 'vert'].rvb)
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
    if (!badge && livre(`dv:${dv.id}`)) {
      ailleurs.push(dv.id)
      continue
    }
    if (!badge) {
      console.log(`  ${dv.id} : pas encore de badge`)
      continue
    }
    // Un bijou est peint seul : son bord est son fond, même plus terne que
    // demandé (`fondLu`, `pixels.ts`) — le vert de Chronos est revenu sombre.
    const d = await dansLaPage<any>(page, 'detourer', enDataUrl(badge), null, FONDS_UNIS[dv.fond ?? 'vert'].rvb, true)
    const r = await dansLaPage<any>(page, 'assembler', { image: d.plein, disque: 1, cadre: [0, 100], tailles: [512, 256], qualite: 0.84 })
    poser(`${dv.id}-badge-512`, r.perso[512])
    poser(`${dv.id}-badge-256`, r.perso[256])
    const terne = d.force < 0.9 ? `, fond terne (${d.fond.join(', ')}) : seuils ×${d.force.toFixed(2)}` : ''
    console.log(`  ${d.transparents < 0.2 ? '⚠ ' : ''}${dv.id} : ${(d.transparents * 100).toFixed(0)} % transparent${terne}`)
  }
  if (ailleurs.length) console.log(`  déjà livrés, originaux ailleurs : ${ailleurs.join(', ')}`)
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
//
// Elle fusionne. Les originaux restent hors du dépôt (`export/`), sur la
// machine qui les a payés : une autre n'a dans app/ que ce qu'elle vient de
// peindre. Réécrites d'après ces seuls fichiers, les tables perdaient tout le
// reste du catalogue, et le ménage effaçait ses images. Un médaillon dont les
// fichiers sont dans app/ est donc (re)livré ; un autre garde son entrée telle
// que la table la cite ; et le ménage ne retire que ce que plus aucune entrée
// ne cite — l'image d'avant un repeint, un médaillon sorti du catalogue —,
// jamais les fichiers d'une entrée gardée.
type ImagesLivrees = { art: [string, string]; rare: [string, string]; perso: string; rarePerso: [string, string] }

function livrer(app: string) {
  const publics = path.join(depot, 'client/public/medaillons')
  mkdirSync(publics, { recursive: true })
  const empreinte = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 10)
  const poses = new Set<string>()
  const poser = (nom: string): string => {
    const source = path.join(app, `${nom}.webp`)
    const final = `${nom}.${empreinte(source)}.webp`
    writeFileSync(path.join(publics, final), readFileSync(source))
    poses.add(final)
    return `/medaillons/${final}`
  }
  const garder = (f: string): string => {
    const nom = f.slice('/medaillons/'.length)
    if (!existsSync(path.join(publics, nom))) console.log(`  ⚠ ${f} : la table le cite, client/public/medaillons ne l'a pas`)
    poses.add(nom)
    return f
  }
  // Ses fichiers dans app/ : tous (on le livre), aucun (on garde son entrée),
  // ou une partie seulement — un assemblage interrompu, qu'on ne livre pas.
  const dansApp = (cle: string, noms: string[]): boolean => {
    const manquants = noms.filter(n => !existsSync(path.join(app, `${n}.webp`)))
    if (manquants.length && manquants.length < noms.length) throw new Error(`${cle} : ${manquants.join(', ')} manque dans app/ — relance l'assemblage`)
    return !manquants.length
  }
  const livres: string[] = []
  const gardes: string[] = []
  const lignes: string[] = []
  for (const l of LEGENDAIRES_PEINTS) {
    const cle = `lg:${l.id}`
    const noms = ['art-512', 'art-256', 'rare-512', 'rare-256', 'perso-256', 'rare-perso-512', 'rare-perso-256'].map(v => `${l.id}-${v}`)
    let i: ImagesLivrees
    if (dansApp(cle, noms)) {
      const paire = (v: string): [string, string] => [poser(`${l.id}-${v}-512`), poser(`${l.id}-${v}-256`)]
      i = { art: paire('art'), rare: paire('rare'), perso: poser(`${l.id}-perso-256`), rarePerso: paire('rare-perso') }
      livres.push(cle)
    } else if (LIVRES_LEGENDAIRES[cle]) {
      const a: ImagesLivrees = LIVRES_LEGENDAIRES[cle]
      const paire = (p: [string, string]): [string, string] => [garder(p[0]), garder(p[1])]
      i = { art: paire(a.art), rare: paire(a.rare), perso: garder(a.perso), rarePerso: paire(a.rarePerso) }
      gardes.push(cle)
    } else {
      console.log(`  ${cle} : ni ses fichiers dans app/, ni une entrée à garder — pas livré`)
      continue
    }
    lignes.push(
      `  '${cle}': {\n` +
        `    art: ['${i.art[0]}', '${i.art[1]}'],\n` +
        `    rare: ['${i.rare[0]}', '${i.rare[1]}'],\n` +
        `    perso: '${i.perso}',\n` +
        `    rarePerso: ['${i.rarePerso[0]}', '${i.rarePerso[1]}'],\n` +
        `  },`,
    )
  }
  const badges: string[] = []
  for (const d of DIVINS_PEINTS) {
    const cle = `dv:${d.id}`
    let paire: [string, string]
    if (dansApp(cle, [`${d.id}-badge-512`, `${d.id}-badge-256`])) {
      paire = [poser(`${d.id}-badge-512`), poser(`${d.id}-badge-256`)]
      livres.push(cle)
    } else if (LIVRES_DIVINS[cle]) {
      paire = [garder(LIVRES_DIVINS[cle][0]), garder(LIVRES_DIVINS[cle][1])]
      gardes.push(cle)
    } else {
      console.log(`  ${cle} : ni son bijou dans app/, ni une entrée à garder — pas livré`)
      continue
    }
    badges.push(`  '${cle}': ['${paire[0]}', '${paire[1]}'],`)
  }
  const entete = (quoi: string, tailles: string) =>
    `// ${quoi}, peints : leurs fichiers, dans \`client/public/medaillons\`.\n//\n` +
    `// Écrit par \`server/scripts/anime/legendaires.ts --livrer\` : on ne le retouche\n` +
    `// pas à la main, on relance la chaîne. Chaque fichier est nommé par son\n` +
    `// empreinte : un médaillon repeint change d'adresse, et aucun téléphone ne\n` +
    `// garde l'ancien. Deux tailles, \`[grande, petite]\` : ${tailles}\n`
  writeFileSync(
    TABLES.legendaires,
    entete('Les vingt-six légendaires', '512 et 256 pixels pour\n// le disque (le médaillon en fait 90 % du côté).') +
      `\nexport interface ImagesDeLegendaire {\n` +
      `  /** L'illustration, sur le carré du disque. */\n  art: [string, string]\n` +
      `  /** Sa version rare, éclatée : la même pose, ses couleurs rares. */\n  rare: [string, string]\n` +
      `  /** La créature seule, détourée : sa forme fait la silhouette d'un légendaire à gagner. */\n  perso: string\n` +
      `  /** La créature rare, dans un cadre plus large (−20 → 120 du disque) : ce qui sort du cadre d'un éclaté. */\n  rarePerso: [string, string]\n}\n\n` +
      `export const IMAGES: Record<string, ImagesDeLegendaire> = {\n${lignes.join('\n')}\n}\n`,
  )
  writeFileSync(
    TABLES.divins,
    entete('Les six Divins', '512 et 256 pixels pour\n// le côté du bijou.') + `\n/** Le bijou de chaque Divin, détouré, sur tout le carré. */\nexport const BADGES: Record<string, [string, string]> = {\n${badges.join('\n')}\n}\n`,
  )
  // Les fichiers qu'aucune entrée ne cite plus : ceux d'avant un repeint, ceux
  // d'un médaillon sorti du catalogue. Ceux des entrées gardées sont cités.
  for (const f of readdirSync(publics)) if (!poses.has(f)) rmSync(path.join(publics, f))
  console.log(`${livres.length} médaillons livrés (${livres.join(', ') || 'aucun'}), ${gardes.length} gardés tels quels — ${poses.size} fichiers dans client/public/medaillons`)
}
