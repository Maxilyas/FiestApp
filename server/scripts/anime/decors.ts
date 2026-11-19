// Les décors peints : le Calendrier des Heures, les quatre thèmes qui se
// gagnent sans se vendre (l'Horloge astronomique, le Ciel du jour, les Très
// Riches Heures, le Sommet), deux fonds de carte (le Triomphe, le Cadran
// solaire), le trésor du coffre de la semaine (`shared/coffre.ts`) : ses
// six fonds de carte, et les quatre coffres, fermés puis ouverts — et les
// douze fonds des savoirs, un par catégorie, que la boutique vend. Et le
// podium (le groupe `podium`) : une marche peinte par thème, sur le croquis
// de `gabarit-marche.ts`, plus belle à mesure que son thème est dur à obtenir.
// Et les Deux Bannières (le groupe `bannieres`) : les emblèmes de ses deux
// camps, la frontière repeinte à leurs couleurs sur l'esquisse de la maquette
// validée, et une marche par camp.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/decors.ts --groupe=calendrier,horloge [--lot]
//   … --seulement=horloge-cadran            # un essai, une image
//   … --tout                                # tout ce qui manque encore
//   … --regenerer=calendrier-03,ciel-jour   # repayer ces images, et ce qui part d'elles
//   … --repeindre=calendrier-03-doree       # repayer celle-ci seule, sur la même source
//   npx tsx scripts/anime/decors.ts [--livrer]   # sans rien nommer : assembler, livrer, rien payer
//
// Trois passes de peinture au plus : les images, puis ce qui part d'elles (la
// page dorée, repeinte sur la même composition ; les trois autres lumières du
// ciel, sur le même paysage ; le cadran de l'horloge, repeint deux fois), puis
// l'assemblage — détourage, recadrage, WebP — dans Chromium. Une image payée
// n'est jamais redemandée sans ces options, et l'ancienne est mise de côté,
// datée, jamais jetée ; le journal garde le coût de chacune, et le script
// refuse de dépasser le budget (`BUDGET`, 9 $).
//
// Les originaux et le journal vivent dans `../export/decors/`, hors du dépôt ;
// seuls les fichiers de l'application entrent au client, nommés par leur
// empreinte (`--livrer`).
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { coutEstime, enPartie, formatDe, generer, lancerLot, lireLot, type FormatDImage, type Partie, type Rendu } from './gemini'
import { dansLaPage, deDataUrl, pagePixels } from './pixels'
import { FACE, FONDS_DES_MARCHES, GABARIT_DE_LA_MARCHE, croquisDeLaMarche, type FondDUneMarche } from './gabarit-marche'
import { PAGES } from '../../../shared/calendrier'
import { THEMES } from '../../../shared/themes'
import { PLAQUES, themeDeLaPlaque } from '../../../shared/plaques'

const args = process.argv.slice(2)
const LOT = args.includes('--lot')
const ATTENTE = Number(process.env.ATTENTE ?? 3600)
const MODELE = process.env.MODELE ?? 'gemini-3-pro-image'
/** Le plafond de toute la chaîne, journal compris : au-delà, rien ne part. */
const BUDGET = Number(process.env.BUDGET ?? 9)
const racine = path.resolve('../export/decors')
const sortie = path.join(racine, 'originaux')
mkdirSync(sortie, { recursive: true })
const fichier = (nom: string) => path.join(sortie, nom)
const existant = (nom: string) => ['png', 'jpg', 'webp'].map(e => fichier(`${nom}.${e}`)).find(f => existsSync(f))
const liste = (nom: string) => (args.find(a => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? '').split(',').filter(Boolean)
/** Les deux repères du bloc qu'écrit la livraison, dans chaque feuille qui cite un décor peint (`decors-peints.test.ts` les relit). */
const REPERE_DEBUT = '/* ── Décors peints : écrit par `server/scripts/anime/decors.ts --livrer`, on ne le retouche pas à la main ── */'
const REPERE_FIN = '/* ── Fin des décors peints ── */'

/** Met une image payée de côté, datée : on ne jette jamais ce qui a coûté. */
function mettreDeCote(nom: string) {
  const f = existant(nom)
  if (!f) return
  const ext = path.extname(f)
  renameSync(f, f.slice(0, -ext.length) + `.ancien-${Date.now()}${ext}`)
}

// ── Les consignes ─────────────────────────────────────────────────────────
// En anglais, comme celles des portraits et des légendaires.

type Groupe = 'calendrier' | 'horloge' | 'ciel' | 'heures' | 'sommet' | 'fonds' | 'tresor' | 'savoirs' | 'podium' | 'bannieres'
const GROUPES: Groupe[] = ['calendrier', 'horloge', 'ciel', 'heures', 'sommet', 'fonds', 'tresor', 'savoirs', 'podium', 'bannieres']

interface Travail {
  nom: string
  groupe: Groupe
  consigne: string
  format: FormatDImage
  /**
   * 2K pour ce qui se montre en grand — un décor plein écran, le cadran — :
   * Nano Banana Pro facture une image 1K ou 2K au même prix (1 120 jetons),
   * et l'assemblage réduit ensuite. 1K pour les pages du calendrier, livrées
   * en 512, et les pièces détourées.
   */
  taille: '1K' | '2K'
  /** L'image dont il part (repeinte) : il attend qu'elle existe. */
  source?: string
  /** Le croquis sur lequel il se peint, sur son fond uni (`gabarit-marche.ts`) : une marche du podium. */
  croquis?: FondDUneMarche
  /**
   * Des images qu'il recopie — les emblèmes des deux camps des Deux Bannières,
   * qu'un drapeau ou un écu doit porter tels quels : nommés en mots, le modèle
   * en inventait un autre, ou peignait celui d'un jeu existant. Il attend
   * qu'elles existent, comme sa source ; elles suivent la source ou le croquis.
   */
  references?: string[]
}

/**
 * Une miniature de livre d'heures. Les Très Riches Heures (vers 1411-1416)
 * sont dans le domaine public ; on en garde l'esprit — le tympan du zodiaque,
 * le lapis et l'or, les travaux du mois devant un château —, jamais une page :
 * chaque composition est neuve.
 */
const ENLUMINURE =
  'Square miniature painting (1:1) for one calendar page of a fifteenth-century French book of hours, in the spirit of the Très Riches Heures du ' +
  'duc de Berry — an original composition that copies no existing page. Layout: across the top, a wide semicircular tympanum arch of deep ' +
  'ultramarine lapis-lazuli blue, framed by bands of burnished gold and studded with tiny gold stars, holding the two zodiac signs of the month as ' +
  'small golden figures on either side of a radiant golden sun; the two upper corners beside the arch are deep blue spandrels with fine gold ' +
  'filigree. Below the arch, filling the rest of the square, the scene of the month. Technique: tempera and shell gold on vellum — jewel-like ' +
  'saturated pigments (ultramarine, vermilion, malachite green, lead white, ochre), meticulous tiny details, elegant elongated figures in ' +
  'late-gothic costumes, castles with slender towers, blue slate roofs and gilded weathervanes, a high horizon and the tilted, stacked perspective ' +
  'of the period, burnished gold highlights. The painting fills the whole square edge to edge inside a thin gold fillet. No text anywhere: no ' +
  'letters, no words, no numerals, no calligraphy, no inscriptions, no banderoles, no signature, no watermark, no page margin, no book.'

/** La page dorée, celle du champion du mois : la même composition, à la feuille d'or — comme la version rare d'un légendaire. */
const DOREE =
  'Edit the attached illumination into its golden edition, the rarest one, reserved for the champion of the month: keep exactly the same ' +
  'composition — the same figures, poses, buildings, animals and landscape at the same places and sizes —, the same framing and the same level ' +
  'of detail. Turn it into a masterpiece of goldsmith’s illumination: the sky becomes burnished gold leaf tooled with tiny punched stars and rays, ' +
  'every garment, roof, tree and field is heightened with fine gold hatching (chrysography), the figures glow, the tympanum shines in gold and ' +
  'lapis, and the thin fillet becomes a rich frame of gold. Keep the jewel-like colors underneath, warmer. No text, no letters, no numerals. ' +
  'Output one square image (1:1 aspect ratio).'

/** Les douze pages : les signes du tympan, et la scène — celle que `PAGES[i].scene` dit en une phrase, détaillée pour le peintre. */
export const PAGES_A_PEINDRE: { mois: string; signes: string; scene: string }[] = [
  {
    mois: '01',
    signes: 'the Goat (Capricorn) and the Water-Bearer (Aquarius)',
    scene:
      'the New Year’s gift banquet: a great hall hung with tapestries of knights and forests, a lord in a deep blue robe embroidered with gold ' +
      'presiding at a long table spread with white linen and golden dishes, a roaring fireplace behind him, courtiers in rich robes of vermilion ' +
      'and green bowing as they offer gifts, servants carrying a peacock pie, two small white dogs on the table.',
  },
  {
    mois: '02',
    signes: 'the Water-Bearer (Aquarius) and the Fishes (Pisces)',
    scene:
      'a farmyard under deep snow: a small timber farmhouse open at the front where three peasants warm their hands at a blazing hearth, sheep ' +
      'huddled in a wattle fold, beehives capped with snow, a woodcutter splitting logs, a man driving a donkey laden with firewood toward a ' +
      'village church on a white hill, crows on the snow, a pale grey winter sky.',
  },
  {
    mois: '03',
    signes: 'the Fishes (Pisces) and the Ram (Aries)',
    scene:
      'ploughing at the foot of a white castle with slender towers and blue slate roofs: a peasant guiding an ox-drawn plough, vine-dressers ' +
      'pruning the vineyards inside low stone walls, a shepherd with his dog and flock, fields in neat strips of brown and fresh green, a small ' +
      'stone wayside shrine at a crossroads, a clear spring sky.',
  },
  {
    mois: '04',
    signes: 'the Ram (Aries) and the Bull (Taurus)',
    scene:
      'a betrothal in a flowering meadow: young nobles in long gowns of blue, rose and vermilion exchanging rings, two young women picking violets, ' +
      'orchards of white blossoming trees, a castle on a green hill above a lake where a boat glides, a walled garden.',
  },
  {
    mois: '05',
    signes: 'the Bull (Taurus) and the Twins (Gemini)',
    scene:
      'the May Day cavalcade: lords and ladies on white and bay horses riding through a spring wood, crowned with green leafy garlands, the ladies ' +
      'in green gowns, trumpeters leading the procession, the towers and blue roofs of a city rising behind the trees.',
  },
  {
    mois: '06',
    signes: 'the Twins (Gemini) and the Crab (Cancer)',
    scene:
      'haymaking along the river: mowers swinging their scythes in a green meadow, women raking and stacking the hay, a river with an arched stone ' +
      'bridge, and across the water the walls, spires and tall gothic chapel of a city.',
  },
  {
    mois: '07',
    signes: 'the Crab (Cancer) and the Lion (Leo)',
    scene:
      'the wheat harvest and the sheep shearing: reapers with sickles in fields of golden wheat, sheaves standing in rows, shearers clipping white ' +
      'sheep in a meadow, a castle with round towers by a river, a hot summer sky.',
  },
  {
    mois: '08',
    signes: 'the Lion (Leo) and the Maiden (Virgo)',
    scene:
      'falconry and bathing: a hawking party of nobles on horseback with falcons on their gloved wrists, a falconer walking ahead with his birds, ' +
      'peasants bathing and swimming in the river below, harvesters loading sheaves on a cart, a great castle beyond the fields.',
  },
  {
    mois: '09',
    signes: 'the Maiden (Virgo) and the Scales (Libra)',
    scene:
      'the grape harvest at the foot of a castle with blue roofs and golden weathervanes: grape pickers bent among the vines, baskets of purple ' +
      'grapes carried to a cart loaded with barrels and drawn by mules, the tall towers of the castle rising behind the vineyard.',
  },
  {
    mois: '10',
    signes: 'the Scales (Libra) and the Scorpion (Scorpio)',
    scene:
      'the sowing: a peasant in a blue smock casting seed by hand across a ploughed field, a horse drawing a harrow weighted with a stone, magpies ' +
      'and crows pecking at the seed, a scarecrow with a bow standing at the edge of the field, a river and a great palace with many towers on the ' +
      'far bank, people strolling along the water.',
  },
  {
    mois: '11',
    signes: 'the Scorpion (Scorpio) and the Archer (Sagittarius)',
    scene:
      'the acorn harvest in a russet autumn forest: a swineherd throwing a stick into an oak to knock down acorns for his pigs feeding beneath, his ' +
      'dog beside him, trees in red, copper and gold, a castle on a rocky spur above a river valley in the distance.',
  },
  {
    mois: '12',
    signes: 'the Archer (Sagittarius) and the Goat (Capricorn)',
    scene:
      'the end of the boar hunt in the heart of a winter forest: huntsmen in red and blue, one sounding his horn, a pack of hounds gathered around ' +
      'the wild boar they have brought to bay, bare golden-brown trees, a castle with tall towers rising above the forest.',
  },
]

/**
 * Le cadran de l'Horloge astronomique, sans ses aiguilles : elles sont des
 * couches à part, que la feuille fait tourner à l'heure de Paris. Le carré
 * autour du disque est uni : l'assemblage le découpe en disque.
 *
 * En deux temps. D'abord un cadran d'or (`CADRAN_D_OR`), dont les douze
 * chiffres romains sont justes et à leur place — redemandé d'un coup en
 * cadran de nuit, il revenait avec XI trois fois et VI deux fois. Puis il
 * est repeint en cadran de nuit (`CADRAN_DE_NUIT`), sur la même composition :
 * le large anneau d'or aux chiffres noirs noyait les aiguilles d'or, et
 * demandait sous le texte clair un voile si lourd que l'or s'y éteignait. La
 * retouche nomme aussi les douze signes un à un : « les signes du zodiaque »
 * avaient donné quatre lions et trois boucs.
 */
const CADRAN_D_OR =
  'Square image (1:1): the dial of a monumental medieval astronomical clock — an original design in the spirit of the great clocks of Prague and ' +
  'Strasbourg —, seen perfectly straight on, perfectly circular and exactly centered, its outer rim touching the four edges of the square. From the ' +
  'center outward: a small round golden boss at the exact center, and no hands at all; a sky disc of deep lapis-lazuli blue enamel strewn with ' +
  'tiny gold stars, with an engraved silver crescent moon; an inner ring of the twelve zodiac signs as small golden figures on blue enamel; a broad ' +
  'ring of burnished gold leaf bearing the twelve hours in Roman numerals in black enamel, evenly spaced, XII at the very top and VI at the very ' +
  'bottom; an outermost rim of fine brass gear teeth. Goldsmith’s work: polished gold, deep glowing enamel, fine filigree engraving, warm light ' +
  'gleaming on the metal, ultra detailed. The four corners of the square outside the dial are plain flat deep midnight blue. No clock hands, no ' +
  'pointers, no letters or words: nothing written except the Roman numerals.'
const CADRAN_DE_NUIT =
  'Edit the attached clock dial into its night version. Keep exactly the same composition: the same circle, the same rings at the same radii, ' +
  'the same gear-tooth rim, the same golden boss at the center, and the same twelve Roman numerals at exactly the same places, with the same ' +
  'shapes and the same orientation. Change only the colors and the zodiac: the broad hour ring becomes deep black enamel and its Roman numerals ' +
  'become burnished gold; in the ring of twelve compartments, replace the animals with the twelve signs of the zodiac, each one clearly ' +
  'recognizable, clockwise from the top: the ram, the bull, the twins, the crab, the lion, the maiden, the scales, the scorpion, the archer, the ' +
  'sea-goat, the water-bearer and the two fishes, as small figures in raised gold on lapis enamel; add a small engraved golden sun on the starry ' +
  'center disc, opposite the silver crescent moon. Keep the deep lapis-lazuli blue enamel, the gold stars, the fine engraving and the warm light ' +
  'gleaming on the metal, with the soft patina of a centuries-old masterpiece. The corners outside the dial stay plain flat deep midnight blue. ' +
  'No hands, no letters or words. Output one square image (1:1 aspect ratio).'
/** La nuit repeinte gardait ses animaux : une troisième retouche ne touche qu'aux douze figures, un signe par case. */
const ZODIAQUE =
  'Edit the attached clock dial. Change only the twelve small gold figures in the ring of twelve blue compartments around the starry center; ' +
  'everything else stays exactly as it is — the Roman numerals, the black hour ring, the rims, the gear teeth, the center disc with its sun, ' +
  'moon and stars, the golden boss, the colors and the lighting. Replace the twelve figures, one per compartment, clockwise starting from the ' +
  'compartment just right of the top: 1 a ram, 2 a bull, 3 the twins (two small human figures holding hands), 4 a crab, 5 a lion, 6 a maiden ' +
  'holding a sheaf of wheat, 7 a pair of balance scales, 8 a scorpion, 9 an archer centaur drawing a bow, 10 a sea-goat with a fish tail, 11 a ' +
  'water-bearer pouring from a jar, 12 two fishes. Each in the same raised gold relief, the same size, on the same lapis enamel. No letters or ' +
  'words. Output one square image (1:1 aspect ratio).'

/** Une aiguille, peinte seule sur un fond uni, son pivot au centre : détourée, elle tourne autour de lui. */
const AIGUILLE = (quoi: string) =>
  `A single ornate hand (pointer) for a medieval astronomical clock — ${quoi} — painted as a goldsmith’s masterpiece in polished gold leaf with ` +
  'fine engraving and a few small gemstones, warm light gleaming on the metal. It is perfectly vertical and points straight up, seen straight on, ' +
  'flat and symmetrical. Its round pivot hub sits at the exact center of the canvas; the long arm rises from the hub almost to the top edge; the ' +
  'short counterweight tail descends from the hub about one fifth of the canvas. Background: a single perfectly flat, uniform chroma-key green ' +
  '(#00FF00) filling the entire canvas edge to edge — no shadow, no glow, no vignette. Do not use any green on the hand. No text. Output one square ' +
  'image (1:1 aspect ratio).'

/** Un engrenage, de face et sous une lumière égale : il tourne, un reflet de côté tournerait avec lui. */
const ENGRENAGE = (quoi: string) =>
  `A single clockwork gear wheel — ${quoi} — in polished antique brass with fine engraving, seen perfectly straight on (flat, frontal, no ` +
  'perspective, no tilt), perfectly circular and centered, filling about 94% of the canvas. Soft, even, frontal lighting, no strong highlight on ' +
  'one side and no cast shadow (it will rotate). Background: a single perfectly flat, uniform chroma-key green (#00FF00) filling the entire canvas ' +
  'edge to edge. Do not use any green on the gear. No text. Output one square image (1:1 aspect ratio).'

/**
 * Le Ciel du jour : un même paysage en quatre lumières. Le jour d'abord, où
 * tout se voit ; les trois autres repeints dessus — « même composition,
 * autres couleurs », la technique des versions rares.
 */
const PAYSAGE =
  'Vertical painting (9:16, a phone wallpaper): a peaceful French countryside seen from a hillside, painted as a richly detailed gouache matte ' +
  'painting for a hand-painted animated film background — soft visible brushwork, luminous atmosphere (an original work: imitate no existing film ' +
  'or studio). Composition, simple and readable from afar: the sky fills the upper half of the image and stays calm and uncluttered, because ' +
  'text will be written over it; low on the horizon, distant blue hills; in ' +
  'the middle ground, a small village of stone houses with terracotta roofs around a slender church bell tower, beside a winding river crossed by ' +
  'an old arched stone bridge, poplars and orchards; in the lower part, a gentle grassy slope with wildflowers and one old oak tree at the right ' +
  'edge. No people, no animals, no text, no frame, no border.'
// Un ciel dégagé : le premier essai posait de gros cumulus blancs là où
// s'écrivent l'en-tête et la question, du blanc sous un texte clair.
const MIDI =
  'The light: a radiant summer midday — a clear, deep blue sky, darker toward the top, with only a few small soft clouds low near the ' +
  'horizon, the sun high and out of frame, vivid greens, crisp shadows.'
const LUMIERE = (quoi: string) =>
  'Edit the attached painting: keep exactly the same composition — every hill, house, tree, the bell tower, the bridge, the river, the slope and ' +
  `the oak at the same place and size — and the same brushwork; change only the time of day, the light and the colors: ${quoi} No text, no frame. ` +
  'Output one vertical image (9:16 aspect ratio).'

/** Le folio des Très Riches Heures : le vélin et sa bordure enluminée, la page du mois s'y pose par-dessus (`heures.css`). */
const FOLIO =
  'Vertical image (9:16): a blank page of a fifteenth-century French book of hours, seen flat and straight on, filling the canvas edge to edge: warm ' +
  'cream vellum with a faint natural grain and the softest stains of age; all around it, a delicate illuminated border in the margins — fine ' +
  'black-ink tendrils of ivy with tiny burnished gold leaves (rinceaux), small acanthus sprays in ultramarine blue, vermilion and rose, a few ' +
  'tiny painted flowers, strawberries, a goldfinch and a snail hidden in the foliage — thin on the left and right edges, a little richer in the ' +
  'four corners. The whole middle of the page is empty, calm vellum. No text, no letters, no lines of writing, no initials, no miniature painting, ' +
  'no book edges, no frame around the page.'

/** Le Sommet : la montagne à l'aube et ses quatre camps ; les drapeaux à part, détourés, pour qu'ils ondulent. */
const SOMMET =
  'Vertical painting (9:16, a phone wallpaper): a colossal Himalayan peak at dawn — an original, epic yet serene composition, painted as a ' +
  'luminous, richly detailed digital matte painting with soft brushwork and cinematic light. The summit pyramid of a giant mountain of snow and ' +
  'ice rises in the upper half, its very tip catching the first rose-gold rays of the rising sun while the lower slopes are still in deep blue ' +
  'shadow; long plumes of spindrift snow stream off the summit ridge in the wind. A ridge route zigzags up from the bottom of the image to the ' +
  'summit, and along it four tiny high-altitude camps, each a small cluster of tents glowing warm orange from within: one near the bottom, two ' +
  'at mid-height, the highest just below the summit pyramid. Sky: deep indigo at the top with the last stars, warming to rose and apricot behind ' +
  'the peak. Foreground at the bottom: a glacier and seracs in cold blue shadow. No people, no flags, no text, no frame, no border.'
const DRAPEAUX =
  'A single string of Tibetan prayer flags (lungta): about twelve small square cotton flags in the traditional order blue, white, red, green, ' +
  'yellow, repeating, hanging in a gentle sagging curve across the whole width of the canvas from the left edge to the right edge, fluttering in ' +
  'a strong wind, slightly faded and weathered, each printed with a small abstract wind-horse pattern (no readable script), on a thin dark cord. ' +
  'Painted in a luminous matte painting style, lit by a warm dawn light from the right. Background: a single perfectly flat, uniform chroma-key ' +
  'magenta (#FF00FF) filling the entire canvas edge to edge — no shadow, no glow. Do not use any pink or magenta on the flags. No text. Output ' +
  'one wide image (16:9 aspect ratio).'

// ── Les Deux Bannières ────────────────────────────────────────────────────
// Deux factions d'un monde de légende, inventées : le propriétaire voulait le
// thème de son jeu préféré, et ses blasons — ceux de deux factions d'un jeu
// existant, des marques — ne se recopient pas. Les emblèmes ont été choisis
// sur une planche de six (le 19 novembre 2026,
// `retours/2026-11-19/deux-bannieres/`), et chaque image qui les porte les
// reçoit dessinés (`references`).

/** Un emblème de camp : ce que portent ses bannières, ses écus, sa marche — et, redessiné, sa plaque. */
const EMBLEME = (sujet: string) =>
  'A heraldic emblem for one of two rival factions of an epic fantasy world, to be shown on the banners, shields and name plates of a mobile quiz app. ' +
  'Painted like a richly crafted game emblem — bold, symmetric or near-symmetric, with crisp metallic edges and subtle bevels — but with a strong, simple ' +
  'silhouette that still reads as a tiny 24-pixel icon. Centered, filling about 80 % of a plain flat off-white (#f4efe6) background, no scene, no frame ' +
  'around the image, no text, no letters. An original design: it must not resemble any existing emblem, logo or crest from a video game, film or ' +
  `book. Output one square image (1:1).\n\n${sujet}`

/** Ce que les images des Deux Bannières disent de leurs deux emblèmes, joints dans cet ordre après leur source. */
const LES_DEUX_EMBLEMES = (premier: string) =>
  `The ${premier} and the next attached images are the two faction sigils: the first — a black boar head with ivory tusks on a red spiked shield — ` +
  'is the sigil of the war clans of the Ember; the second — a golden lion rampant on an azure shield — is the sigil of the Azure kingdom. Paint every ' +
  'red-and-black banner, shield and emblem of the clans with the first, and every blue-and-gold one of the kingdom with the second, faithfully, as ' +
  'painted heraldry. No other emblem, symbol or crest anywhere — in particular no existing faction emblem from any video game.'

/**
 * L'esquisse : la frontière de la maquette, celle que le propriétaire a
 * choisie (« La frontière OK », le 19 novembre 2026), peinte avec les
 * emblèmes de la maquette — d'autres, depuis remplacés. Elle ne se repeint
 * pas : la frontière part d'elle, et un second tirage aurait une autre
 * composition. Une machine neuve la reprend de la maquette gardée, avec les
 * deux emblèmes choisis (`retours/2026-11-19/deux-bannieres/maquette/` :
 * `bannieres-esquisse.webp`, `embleme-clans.webp`, `embleme-royaume.webp`,
 * à recopier dans `export/decors/originaux/` sous leur nom) — sans rien
 * repayer.
 */
const FRONTIERE_ESQUISSE =
  'Vertical painted backdrop (9:16) for a mobile quiz app theme called « The Two Banners »: an epic high-fantasy world where two rival factions face each ' +
  'other. The war clans of the Ember: red-rock canyons, fortified war camps of hide tents, spiked wooden palisades, horned totem poles, roaring braziers, ' +
  'tall red-and-black war banners bearing their sigil. The Azure kingdom: white stone towers with blue slate roofs and golden domes, glowing cathedral ' +
  'windows, tall blue-and-gold banners bearing their sigil. Composition: the frontier at dusk, the two factions face to face across a deep valley — the ' +
  'Ember’s canyon cliffs and war camp climbing the left edge, the Azure towers and banners climbing the right edge; at the top, a dramatic sky split ' +
  'between ember-red clouds on the left and deep azure with the first stars on the right, a huge pale moon in the center; at the bottom, a stone bridge ' +
  'over the chasm where the torches of both armies meet. The middle of the image is calm, dark, softly lit shadow — mist over a valley — because text ' +
  'will be written over it: the beauties are along the left and right edges, at the top and at the bottom. Painted in a luminous, richly detailed matte ' +
  'painting style, dramatic and warm. Every design is original: imitate no existing video game, film, book or card game — no existing faction emblem, no ' +
  'existing logo, no existing character. No text, no letters, no frame, no border. Output one vertical image (9:16 aspect ratio).'

/** La frontière : l'esquisse, ses blasons repeints aux emblèmes choisis, rien d'autre. */
const FRONTIERE =
  'The first attached image is a finished painted backdrop for a mobile quiz app. Repaint it exactly — the same composition, the same places, the same ' +
  'light, colors and brushwork, the same camps, towers, bridge, moon and sky — changing only the heraldry: the emblems painted on its banners and shields. ' +
  `${LES_DEUX_EMBLEMES('second')} Keep the middle of the image calm and dark. No text, no letters, no frame, no border. Output one vertical image (9:16 aspect ratio).`

/**
 * Un fond de carte : le prénom et tout le reste s'écrivent par-dessus, à
 * l'encre claire (`.carte-fond`, `styles.css`) — l'image reste sombre et
 * calme en son milieu, ses beautés vers les bords et le bas.
 */
const FOND_DE_CARTE = (sujet: string) =>
  'Vertical painting (2:3) used as the background of a player’s profile card in a party quiz game. The card’s text is written over it in light ' +
  `ink, so the whole image stays dark and calm in its middle, with its richest details toward the edges and the bottom. ${sujet} Painted as a ` +
  'rich, luminous digital painting with fine gold-leaf accents. No people, no text, no letters, no numerals, no inscriptions, no frame, no border.'

/**
 * Les fonds du trésor : introuvables en boutique, ils ne sortent que du coffre
 * de la semaine (`shared/coffre.ts`) — deux rares, deux épiques, deux
 * légendaires, chacun sa palette, loin des sept d'avant. Le nom est la clé de
 * `shared/fonds.ts` ; la classe de la carte, `.fond-<clé>`.
 */
export const FONDS_DU_TRESOR: { cle: string; sujet: string }[] = [
  {
    cle: 'voie-lactee',
    sujet:
      'The Milky Way: a perfectly still alpine lake at night between two dark mountain slopes, the Milky Way arching across a deep indigo sky full of stars, mirrored in the black water at the bottom; a few dark pines on the shores, a faint violet and teal nebular glow; the middle of the image is calm night sky. Palette: indigo, violet, silver starlight and a touch of gold.',
  },
  {
    cle: 'lanternes',
    sujet:
      'The Lantern Garden: a Japanese garden at night, round glowing paper lanterns hanging from the dark branches of maple trees along both sides (plain lanterns, no writing on them), a small vermilion arched bridge over a still pond at the bottom where koi glint gold, a few floating candle lanterns on the water; the middle is soft dark night air. Palette: deep indigo, warm amber lantern light, vermilion and gold.',
  },
  {
    cle: 'abysses',
    sujet:
      'The Abyss: the deep ocean, pale shafts of light falling from far above into dark teal water, translucent bioluminescent jellyfish drifting along both sides with glowing cyan tendrils, and at the very bottom a half-buried ancient treasure chest spilling gold coins among corals and swaying seaweed; the middle is calm deep water. Palette: abyssal blue, teal, cyan glow and gold.',
  },
  {
    cle: 'bibliotheque',
    sujet:
      'The Enchanted Library: an endless old library seen in perspective, towering walnut bookshelves rising on both sides into darkness, floating lit candles, a few open books flying like birds with fluttering blank pages, warm golden dust in the air, a reading desk with a brass astrolabe at the bottom; the middle is a calm dark nave of shadow. Palette: walnut brown, deep green, warm candlelight and gold.',
  },
  {
    cle: 'dragon',
    sujet:
      // Le premier essai l'avait posé dans un panneau de laque — un cadre noir, un filet d'or, des coins arrondis, du blanc
      // aux angles : la carte a déjà son bord. La consigne le lui interdit en toutes lettres.
      'The Golden Dragon: a long Eastern dragon with scales of burnished gold leaf coiling along the edges of the image through dark storm clouds, its head near a top corner, its claw holding a luminous pearl near the bottom, crimson silk ribbons and small stylized clouds, in the spirit of Asian lacquer art; the middle stays dark cloud. The painting fills the whole canvas and bleeds off all four edges: it is not a lacquer panel or a screen — no border around it, no gold fillet, no rounded corners, no margin. Palette: black lacquer, crimson and burnished gold.',
  },
  {
    cle: 'cite-celeste',
    sujet:
      'The Sky City: floating islands carrying a white palace with golden domes high above a sea of clouds at sunset, waterfalls pouring from the islands into the clouds, a few birds far away; the islands sit toward the top and the edges, the clouds glow at the bottom; the middle is calm twilight sky. Palette: rose, lilac, peach and gold.',
  },
]

/**
 * Les fonds des savoirs, que la boutique vend (le souhait du propriétaire du
 * 15 octobre 2026 : « de la variété par rapport à ce que l'on a déjà », « en
 * rapport avec les thèmes des catégories ») : un par catégorie
 * (`shared/categories.ts`), chacun sa palette et son sujet, loin des treize
 * fonds d'avant — trois nuits étoilées, un théâtre, une bibliothèque — et des
 * thèmes de la boutique : la Savane plutôt que la Jungle, la terre battue
 * plutôt que le Stade, la table de jeux plutôt que le néon de l'Arcade, les
 * Années folles plutôt que le Carnaval. Le nom est la clé de
 * `shared/fonds.ts` ; la classe de la carte, `.fond-<clé>`.
 */
export const FONDS_DES_SAVOIRS: { cle: string; sujet: string }[] = [
  {
    cle: 'musee',
    sujet:
      'The Museum at Night: the great hall of an old museum after closing time, cold moonlight falling through a vaulted glass-and-iron roof at the top, the huge skeleton of a dinosaur arching along one side, white marble statues on pedestals and gilded picture frames holding abstract paintings along the other, an antique globe and a suspended model of the planets, a polished checkerboard marble floor at the bottom; the middle is calm shadowed air. Palette: moonlit blue-grey, white marble and warm gold.',
  },
  {
    cle: 'egypte',
    sujet:
      'The Egyptian Temple: a hypostyle hall of colossal sandstone columns with papyrus capitals receding on both sides, their shafts covered with purely ornamental carved patterns (no readable hieroglyphs, no script), two colossal seated statues of pharaohs flanking a far doorway that glows with warm light, flames in bronze braziers, a golden scarab amulet, a canopic jar and gold treasures at the bottom; the middle is calm warm shadow. Palette: sandstone ochre, turquoise and lapis-blue accents, amber torchlight and gold.',
  },
  {
    cle: 'navigateurs',
    sujet:
      'The Navigators’ Chart: an antique hand-painted sea chart on dark aged parchment filling the whole canvas, a large ornate compass rose with gilded points near the bottom, fine rhumb lines radiating across the sea, a sailing galleon and a coiling sea serpent along the edges, stylized coastlines and small islands, a brass navigator’s divider and a spyglass lying on the chart at the bottom; strictly no lettering, no labels, no place names and no numbers anywhere on the map; the middle is calm, empty dark sea. Palette: deep teal sea, sepia parchment, burnt umber and gold.',
  },
  {
    cle: 'foudre',
    sujet:
      'The Lightning Laboratory: a nineteenth-century scientist’s laboratory at night, a great copper Tesla coil on one side throwing branching violet-white electric arcs toward a brass sphere on the other side, glass vacuum tubes glowing blue, a brass orrery, glass flasks and coils of copper wire on a workbench at the bottom; the middle is calm dark air crossed only by a faint thin spark. Palette: deep violet, electric blue, copper and brass.',
  },
  {
    cle: 'savane',
    sujet:
      'The Savanna at Dusk: the African savanna after sunset, the silhouettes of flat-topped acacia trees on both sides, a giraffe and a family of elephants walking in silhouette along the bottom, tall golden grass, a huge pale moon rising near the top among the first stars, a last band of orange and violet light low on the horizon; the middle is calm deepening twilight sky. Palette: indigo dusk, burnt orange, ochre grass and gold.',
  },
  {
    cle: 'salle-obscure',
    sujet:
      'The Picture Palace: an empty old cinema in darkness, the long beam of a film projector crossing the image diagonally from a small window high on one side, dust motes sparkling in the beam, strips of film and reels unspooling along the edges, rows of red velvet seats at the bottom, golden art-deco wall sconces glowing softly; the screen itself is out of view; the middle is calm darkness. Palette: black, crimson velvet, warm amber light and gold.',
  },
  {
    cle: 'jazz',
    sujet:
      'The Jazz Club: an empty, intimate jazz club at midnight, a golden saxophone and a double bass resting on a little stage on one side, the curve of a black grand piano with gleaming keys at the bottom, a vinyl record and a few sheets of blank staff paper (no notes, no writing), soft violet and blue light through drifting smoke, small round tables with candles; the middle is calm smoky shadow. Palette: midnight blue, violet, warm brass and gold.',
  },
  {
    cle: 'vitrail',
    sujet:
      'The Stained Glass: inside a gothic cathedral at dusk, a great rose window of stained glass glowing in jewel colors near the top, tall lancet windows of stained glass along both sides casting pools of colored light onto stone pillars, rows of small candles flickering at the bottom; the glass shows abstract geometric and floral patterns only (no figures, no faces, no letters); the middle is calm dark stone and shadow. Palette: ruby, sapphire, emerald and amber glass, dark stone and gold.',
  },
  {
    cle: 'terre-battue',
    sujet:
      'The Clay Court: a grand tennis stadium at dusk seen from the stands, the warm terracotta clay court with crisp white lines and the net at the bottom, a few yellow tennis balls and a wooden racket resting on the clay in the foreground, the empty bottle-green stands curving around, tall floodlights just switching on at the top corners in a deep blue evening sky; no logos, no advertising, no scoreboard; the middle is calm darkening sky. Palette: terracotta orange, bottle green, dusk blue and gold.',
  },
  {
    cle: 'epices',
    sujet:
      'The Spice Market: a covered oriental spice market at night, conical heaps of saffron, paprika, turmeric and cinnamon in copper bowls and wooden barrels at the bottom, hanging pierced-brass lanterns casting star-shaped patterns of light on the walls, strings of dried red chili peppers, sacks of dried rosebuds and star anise, a steaming copper teapot; the middle is calm warm shadow. Palette: saffron yellow, paprika red, cinnamon brown, copper and gold.',
  },
  {
    cle: 'table-de-jeux',
    sujet:
      'The Game Table: a cozy game room at night, a large wooden table covered in green felt at the bottom with a chessboard, carved chess pieces, scattered dice of many shapes, a fan of playing cards with blank faces and game tokens, a vintage pinball machine glowing softly on one side, shelves of plain board game boxes without titles along the other, a warm lamp hanging from the top; the middle is calm warm shadow. Palette: walnut brown, felt green, warm lamplight and gold.',
  },
  {
    cle: 'annees-folles',
    sujet:
      'The Roaring Twenties: a grand art-deco ballroom after midnight, empty of guests, a tall tower of champagne coupes sparkling at the bottom, black-and-gold geometric art-deco patterns and sunburst motifs along the edges, strings of pearls and white ostrich feathers, gold streamers and confetti drifting, a crystal chandelier glowing at the top; the middle is calm dark shadow. Palette: black, champagne gold, ivory and a touch of emerald.',
  },
]

/**
 * Un coffre de la semaine, peint fermé sur un fond uni qu'on détoure, puis
 * repeint ouvert sur la même pose. Ni lueur ni rayon : la lumière qui en
 * jaillit, les rayons et les étincelles sont ceux de la page, qui les anime
 * (`components/Coffre.tsx`) — peints, ils se seraient mêlés au fond uni, et
 * la page n'aurait plus su les éteindre. Assez petit dans le carré pour que
 * le couvercle ouvert y tienne, à la même place fermé et ouvert : les deux
 * se posent l'un sur l'autre.
 */
const COFFRE_FERME = (matiere: string) =>
  'A single treasure chest for the reward screen of a mobile party quiz game, shown alone and centered, seen from the front and slightly above ' +
  `(a three-quarter view), its lid closed. ${matiere} The chest sits in the lower half of the square canvas and fills about 55% of its width, ` +
  'with empty background above it (room for its lid to open later). Painted as a rich, luminous, highly detailed digital painting with crisp ' +
  'edges, warm light from the upper left, deep shadows inside the carvings. Background: a single perfectly flat, uniform chroma-key magenta ' +
  '(#FF00FF) filling the entire canvas edge to edge — no floor, no shadow, no glow, no sparkles, no scenery. Do not use any pink or magenta on ' +
  'the chest. No text, no letters, no numerals. Output one square image (1:1 aspect ratio).'
const COFFRE_OUVERT =
  'Edit the attached image: keep exactly the same treasure chest — the same materials, ornaments, colors and lighting, the same size and position ' +
  'in the canvas, the same three-quarter view — but with its lid thrown wide open, swung back on its hinges, so that we look inside: a dark ' +
  'velvet interior holding a heap of gold coins and a few jewels that catch the light. Do not add any glow, light beams, sparkles or magic ' +
  'effects. Keep the background a single perfectly flat, uniform chroma-key magenta (#FF00FF) filling the entire canvas edge to edge. No text. ' +
  'Output one square image (1:1 aspect ratio).'

/** Les quatre rangs du coffre (`RANGS_DU_COFFRE`, `shared/coffre.ts`) : du plus humble au plus somptueux. */
export const COFFRES_A_PEINDRE: { rang: string; matiere: string }[] = [
  {
    rang: 'bois',
    matiere: 'A sturdy, humble chest of weathered oak planks bound with dark iron bands, iron corner plates with round rivets and a simple iron padlock; charming and well-used.',
  },
  {
    rang: 'argent',
    matiere:
      'A chest of dark polished walnut bound with engraved silver bands, silver filigree corners and a silver lock set with a small blue sapphire; elegant and cool-toned.',
  },
  {
    rang: 'or',
    matiere:
      'A chest of deep red lacquered wood bound with ornate burnished gold bands, gold filigree corners, a gold lock set with a large emerald, and a row of small rubies along the lid; rich and warm.',
  },
  {
    rang: 'royal',
    matiere:
      'A royal chest of midnight-blue enamel and gold, encrusted with sapphires, rubies and amethysts, small golden crowns on its corners, and a lock shaped like a radiant golden sun around a great diamond; magnificent and precious.',
  },
]

/**
 * Une marche du podium, peinte sur le croquis (`gabarit-marche.ts`) : la
 * face avant à sa place, l'avatar debout au milieu du dessus, le décor sur
 * ses deux coins, le rang posé par la page dans le médaillon. Le fond uni est
 * celui que le thème ne porte pas : le vert pour les roses et les violets, le
 * magenta pour les autres — le détourage efface le fond et ses traits.
 */
const MARCHE = (sujet: string, finition: string, fond: FondDUneMarche) => {
  const couleur = fond === 'magenta' ? 'magenta (#FF00FF)' : 'green (#00FF00)'
  const interdit = fond === 'magenta' ? 'pink, magenta or violet' : 'green'
  return (
    'Paint one step of a winners podium for a mobile party quiz game, following the attached layout sketch exactly. The sketch is drawn in ' +
    `darker lines on a flat chroma-key ${couleur} background: the large rectangle is the front face of the step, and it continues past the bottom ` +
    'edge of the canvas (we never see its base); the narrow band just above it is the flat top surface, seen slightly from above; the circle is ' +
    'an empty round medallion on the front face; the two dashed boxes at the top left and top right are where the decorations stand, on the top ' +
    'surface — they may also hang down the sides of the step; the crossed dashed box in the middle must stay completely empty, because the winner ' +
    'stands there. Paint the step exactly over the sketch — the same position, the same size, the same proportions, its front face filling the ' +
    'rectangle edge to edge — and let no sketch line remain visible. Strictly front-facing and orthographic, like an architectural elevation: ' +
    'only the front face and the narrow top band are visible — no side faces, no box corners in perspective, no visible base, no floor; the ' +
    'front face reaches the left, right and bottom edges of the rectangle, and the bottom edge of the image cuts it, like a tall plinth seen from ' +
    'close: its lower edge is never visible. The dashed boxes and the cross are only guides: paint nothing along them, no dashed line, no frame.\n\n' +
    `${sujet}\n\n${finition} The medallion is exactly the circle of the sketch — the same place, the same size, near the top of the front ` +
    'face —, and its center stays a plain, calm, uncluttered disc: a number will be placed on it later.\n\n' +
    'Painted in a luminous, richly detailed storybook miniature diorama style, crisp readable shapes at small size, soft light from the upper ' +
    `left. No light rays, no beams, no glow spilling onto the background. Background: keep the single perfectly flat, uniform chroma-key ${couleur} ` +
    `filling the entire canvas edge to edge around the step — no floor, no shadow, no gradient. Do not use any ${interdit} in the subject. No ` +
    'text, no letters, no numbers, no digits, no frame, no border. Portrait image, 3:4 aspect ratio.'
  )
}

/**
 * La finition d'une marche suit la rareté de son thème : un thème qui se
 * gagne, ou qui coûte cher, a la plus belle (« par rapport à ceux qui sont dur
 * à obtenir je veux que ce soit encore plus beau », le propriétaire). Velours,
 * celle de qui n'a pas de plaque, a la finition des offerts : personne n'y a
 * l'air d'avoir moins.
 */
const FINITIONS: Record<string, string> = {
  offert:
    'Craft: elegant and simple — a handsome step in fine materials with a few well-chosen props on its two top corners; the medallion has a simple rim in the material of the step.',
  commune:
    'Craft: charming and simple — a handsome step with a few well-chosen props on its two top corners, clean shapes, modest materials; the medallion has a simple rim in the material of the step.',
  peucommune:
    'Craft: richer — more props and finer details on the corners, quality materials, a little sparkle; the medallion has a neat carved rim.',
  rare: 'Craft: precious — fine materials, intricate ornament along the edges of the front face and around the medallion, delicate details, a soft warm inner glow from the theme’s own light sources; the medallion has a fine gilded rim.',
  epique:
    'Craft: spectacular — luminous precious materials, intricate sculpted or inlaid ornament all over the front face, glowing accents and a few floating sparkles around the decorations; the medallion has a gilded rim set with small gems.',
  legendaire:
    'Craft: a legendary masterpiece — the most precious and magnificent podium step imaginable: jewel-like gilded and gem-set ornament, breathtaking detail, radiant light, a whole miniature world on its two top corners; the medallion is framed by an ornate gold rim set with gems.',
  gagne:
    'Craft: a legendary masterpiece, a trophy that only the most dedicated players ever earn — the most precious and magnificent podium step imaginable: jewel-like gilded and gem-set ornament, breathtaking detail, radiant light, a whole miniature world on its two top corners, a fine filigree of gold leaf running along every edge; the medallion is framed by an ornate gold rim set with gems and tiny rays of gold.',
}

/**
 * Les trente-cinq marches : une par thème du catalogue (`shared/themes.ts`),
 * Velours compris, que porte qui n'a pas de plaque. Le sujet dit la matière
 * de la marche et ce qui se tient sur ses deux coins ; sa palette, les
 * couleurs de la plaque du thème (`styles.css`, `.plaque-<clé>`).
 */
export const MARCHES_A_PEINDRE: { cle: string; fond: FondDUneMarche; sujet: string; references?: string[] }[] = [
  {
    cle: 'velours',
    fond: 'vert',
    sujet:
      'Theme — Velvet, the house theme of a night party quiz: the step is draped in deep wine and plum velvet whose heavy soft folds hang over its front, with champagne-gold braided trim and small tassels along the top edge, a row of small brass studs, two small gilded finials and a tiny brass candlestick on the top corners; elegant and warm, like a theatre stage at night. Palette: near-black plum (#1c1416), wine-red velvet, champagne gold (#d4b06a).',
  },
  {
    cle: 'ivoire',
    fond: 'magenta',
    sujet:
      'Theme — Ivory, the daylight version of the house theme: the front face of the step is a wall of polished ivory marble with soft veins, gilded edges and a carved classical moulding along its top; on its top corners, a golden laurel wreath and a few delicate white flowers and leaves. Palette: ivory (#f9f5ec), warm gold (#ac8536), soft beige.',
  },
  {
    cle: 'cahier',
    fond: 'magenta',
    sujet:
      'Theme — the French school notebook: the front face of the step is a wall of crisp white paper ruled in the French Seyès grid (fine blue lines) with a red margin line down its left side, bound by a cobalt-blue notebook edge; on its top corners, a four-colour ballpoint pen on one side, a yellow pencil, an eraser and a small ink blot on the other; the middle of the top stays bare. No writing anywhere. Palette: paper white (#fdfdf8), ink blue (#2342a8), a red margin line.',
  },
  {
    cle: 'carnet',
    fond: 'magenta',
    sujet:
      'Theme — the travel journal: the step is wrapped in kraft paper, stamped with travel stamps made only of abstract shapes and wavy lines (no text), a postage stamp and a luggage label; on its top corners, a small vintage typewriter on one side, a brass compass and a folded map tied with string on the other. Palette: kraft (#e8d9ba), rust red (#b5452f), dark brown.',
  },
  {
    cle: 'guinguette',
    fond: 'magenta',
    sujet:
      'Theme — the Guinguette, a 1930s French riverside open-air dance hall on a summer night: the step is painted navy wood like a little bandstand with cream pillars, a string of warm glowing festoon bulbs draped along its top edge, small paper bunting flags in navy, white and yellow; on its top corners, a tiny accordion and a straw boater hat. Palette: night navy (#14213d), warm yellow light (#ffd166), cream.',
  },
  {
    cle: 'pyjama',
    fond: 'magenta',
    sujet:
      'Theme — the Pyjama, a gentle bedtime night: the step is a soft quilted cushion of deep indigo-blue fabric with a crescent moon and little stars stitched on in peach thread, a satin piping along its edges; on its top corners, a tiny fluffy sheep leaping over a little wooden fence on one side, a small sleepy moon night-lamp on the other. Palette: deep indigo blue (#1f1b3a), peach (#ffdcaa), cream.',
  },
  {
    cle: 'stade',
    fond: 'magenta',
    sujet:
      'Theme — the Stadium, a night match under the floodlights: the front face of the step is the dark green painted wall of a stadium stand with a lime-green trim and two thin white stripes, its top covered with striped green turf and crisp white chalk lines; on its top corners, a small floodlight tower glowing white on one side, a classic leather football and a little trophy cup on the other. No digits. Palette: deep pitch green (#0e2616), lime (#e8ff47), white.',
  },
  {
    cle: 'jungle',
    fond: 'magenta',
    sujet:
      'Theme — the Jungle: the step is carved from ancient mossy stone, wrapped with tropical leaves, ferns and hanging vines down its sides; on its top corners, among small white and golden orchids and a ripe mango, perch three or four tiny colourful birds (a hummingbird, two little parrots, a baby toucan), dew drops glinting. Palette: deep emerald and jungle greens, warm golden light (#f6c052).',
  },
  {
    cle: 'ocean',
    fond: 'magenta',
    sujet:
      'Theme — the Ocean, the abyss: the step is a block of pale stone under the sea, encrusted with coral; on its top corners, orange, yellow and teal coral, sea anemones and swaying seaweed, two tiny tropical fish and a little seahorse, a few rising bubbles. Palette: deep teal-black (#03202b), glowing aqua (#5ff2da), warm coral orange accents.',
  },
  {
    cle: 'patisserie',
    fond: 'vert',
    sujet:
      'Theme — the Pastry tea room: the step is a tiered cream cake with smooth vanilla icing, raspberry glaze dripping along its top edge and piped cream rosettes; on its top corners, a stack of macarons (raspberry, vanilla, chocolate, lemon) and a fresh raspberry tart on one side, a small porcelain teapot and teacup on the other. Palette: cream (#fff7f0), raspberry (#b0305a), soft rose, chocolate brown.',
  },
  {
    cle: 'gameboy',
    fond: 'magenta',
    sujet:
      'Theme — the pocket game console: the whole step is chunky pixel art drawn with exactly four shades of green (#0f380f, #306230, #8bac0f, #9bbc0f) — a pixel brick block with a little pixel border; on its top corners, a pixel tree and a pixel mushroom on one side, a spinning pixel coin and a tiny pixel hero on the other. Only those four greens, crisp square pixels.',
  },
  {
    cle: 'foret',
    fond: 'magenta',
    sujet:
      'Theme — the Russet forest on an autumn afternoon: the step is carved from a thick oak stump with its bark and growth rings, moss along its base; on its top corners, a little hedgehog among red-capped mushrooms and acorns on one side, a squirrel holding a hazelnut and a pile of russet leaves on the other, a few leaves twirling down. Palette: cream (#f7ead8), rust (#b8481a), warm browns and gold.',
  },
  {
    cle: 'carnaval',
    fond: 'vert',
    sujet:
      'Theme — the Carnival: the step is painted with bold harlequin diamonds in purple, gold and turquoise-blue, gold trim along its edges; on its top corners, a Venetian carnival mask with feathers and a jester hat with bells on one side, a burst of streamers, pennants and confetti on the other. Palette: cream (#fff6e9), deep purple (#6a24a0), gold, turquoise blue.',
  },
  {
    cle: 'plage',
    fond: 'magenta',
    sujet:
      'Theme — the Beach in summer: the step is a little beach cabin painted with wide blue and white stripes, its top covered with golden sand; on its top corners, a striped orange-and-white parasol with a beach ball on one side, a small sandcastle with a starfish and seashells on the other, a curl of sea foam. Palette: warm sand (#fff4dc), deep sea blue (#0f3b4a), sunny orange (#ffb347).',
  },
  {
    cle: 'licorne',
    fond: 'vert',
    sujet:
      'Theme — the Unicorn: the step is iridescent mother-of-pearl with holographic pastel reflections (lilac, pink, sky blue), its edges trimmed with pearls; on its top corners, a small white unicorn with a golden horn and a pastel mane on one side, a fluffy pastel cloud with a little rainbow and glittering crystals on the other, tiny sparkles. Palette: pearl white (#fbf6ff), lilac (#d7a8ff), violet (#9b2fc0), soft pink and sky blue.',
  },
  {
    cle: 'heros',
    fond: 'magenta',
    sujet:
      'Theme — the comic book Hero: the step is drawn like a comic book panel come to life, thick black ink outlines, bold flat colours and halftone dots, a jagged action burst shape on its front (shape only, no letters); on its top corners, a red hero cape draped over a little mask on one side, a small lightning bolt and speed lines on the other. Palette: pale yellow (#fff4c7), hero red (#d61f26), black ink, a touch of blue.',
  },
  {
    cle: 'grimoire',
    fond: 'magenta',
    sujet:
      'Theme — the Grimoire: the step is a giant closed spellbook of worn red-brown leather with brass corners and a brass clasp, the gilded edges of its parchment pages showing; on its top corners, a quill in an inkwell beside a dripping candle on one side, a few small potion bottles and a rolled scroll sealed with red wax on the other, faint swirls of magic. Palette: parchment (#efe2c2), deep red (#8b1e1e), brass, dark brown.',
  },
  {
    cle: 'filmnoir',
    fond: 'magenta',
    sujet:
      'Theme — the Film noir, in black and white only, with a single colour, red: the step is a dark polished detective’s desk, the slanted shadows of venetian blinds across its front, raindrops beading on it; on its top corners, a vintage telephone and a fedora hat on one side, a magnifying glass and a single red rose on the other. Everything in black, white and greys, except the rose. Palette: black (#111111), greys, white, one red (#ff4a4a).',
  },
  {
    cle: 'disco',
    fond: 'vert',
    sujet:
      'Theme — the Disco: the step is a glowing dance floor block whose front face is made of lit square tiles in gold, pink and violet, with chrome edges; on its top corners, a sparkling mirror ball on a little stand on one side, a pair of roller skates and two vinyl records on the other, glitter in the air. Palette: deep night violet (#1a0b2e), gold (#ffd866), hot pink, violet.',
  },
  {
    cle: 'halloween',
    fond: 'vert',
    sujet:
      'Theme — Halloween, a haunted manor: the step is old dark stone and rotting wood draped with cobwebs, a little iron-barred window glowing orange on its side; on its top corners, carved jack-o’-lantern pumpkins glowing orange with a black cat on one side, a twisted candlestick with dripping candles and a small bat on the other, a crescent moon cut-out. Palette: night purple (#120a18), pumpkin orange (#ff8c1a), bone white.',
  },
  {
    cle: 'neige',
    fond: 'magenta',
    sujet:
      // Repeinte le 19 novembre 2026 : son médaillon sortait plus grand et plus bas que le cercle, puis un ovale de
      // travers, sa face se rétrécissait sous les glaçons, puis les cases en pointillés du croquis se peignaient sur sa
      // neige — la consigne dit la face pleine, le médaillon et un dessus de neige nu.
      'Theme — the Snowy winter night: the front face of the step is one wide wall of blue ice and packed snow, frost patterns on it, filling the rectangle edge to edge, a few short icicles hanging only from the edge of its top band, and the top band itself plain smooth snow with nothing drawn on it — no line, no dash, no frame, no box; the medallion is a perfectly round porthole of clear ice with a thin silver rim, exactly the circle of the sketch; on its top corners, little snow-covered fir trees with a warm glowing lantern on one side, a small snowman with a scarf on the other, snowflakes falling. Palette: midnight blue (#0b1627), ice blue (#a8dcff), white.',
  },
  {
    cle: 'cerisiers',
    fond: 'vert',
    sujet:
      'Theme — the Cherry blossoms of hanami: the step is a black lacquered Japanese wooden platform with fine gold accents; on its top corners, blossoming cherry branches heavy with soft pink flowers on dark bare branches (no leaves), a small paper lantern and a tiny stone lantern, pink petals drifting down. Palette: lacquer black, gold, blossom pink (#f4a6bd), deep rose (#a82d5a).',
  },
  {
    cle: 'neon',
    fond: 'vert',
    sujet:
      'Theme — the Neon arcade, cyberpunk: the front face of the step is a wall of dark metal panels like the front of a futuristic arcade tower, its edges outlined by glowing hot-pink and violet neon tubes, tiny lit windows, cables and vents, a faint glowing grid; on its top corners, a tiny skyline of neon skyscrapers and a small friendly robot standing guard, little holographic signs with abstract glyphs only (no readable text). Palette: near-black indigo (#0b0616), hot pink (#ff3fd8), violet, a touch of cyan.',
  },
  {
    cle: 'olympe',
    fond: 'magenta',
    sujet:
      'Theme — Mount Olympus: the front face of the step is a wall of white veined marble with a Greek key frieze inlaid in gold along its top and slender fluted pilasters at its two sides; on its top corners, a golden lyre and an olive branch on one side, a golden laurel wreath on a little altar with an amphora on the other, soft white clouds curling at its sides. Palette: marble white (#f4f2ee), gold (#c9a23a), deep navy (#1f2a36).',
  },
  {
    cle: 'braises',
    fond: 'magenta',
    sujet:
      'Theme — the Embers of the Phoenix: the step is dark volcanic stone cracked with veins of glowing embers, small flames licking its top edge; on its top corners, a small fiery phoenix rising with spread wings of flame on one side, a nest of glowing coals with a golden feather on the other, sparks rising. Palette: charcoal black (#140806), ember orange (#ff6a1a), gold, deep red.',
  },
  {
    cle: 'cosmos',
    fond: 'vert',
    sujet:
      'Theme — the Cosmos: the step is a slab of dark crystal full of stars and swirling nebulae in violet, blue and pink, its edges catching starlight; on its top corners, a small ringed planet and a little moon on one side, a tiny comet with a long tail and a cluster of glowing stars on the other, stardust floating. Palette: deep space (#070b1f), periwinkle violet (#8f7bff), blue, pink.',
  },
  {
    cle: 'feudartifice',
    fond: 'vert',
    sujet:
      'Theme — the New Year’s fireworks at midnight: the step is a midnight-blue rooftop terrace with a gold balustrade; on its top corners, a tiny silhouette of city rooftops with a clock tower on one side, a pair of champagne coupes and a bottle on the other, fireworks bursting above them in gold, red and blue, a few golden sparks. Palette: midnight blue (#0a0f2c), gold (#ffcf5a), white, red, blue.',
  },
  {
    cle: 'aurore',
    fond: 'magenta',
    sujet:
      'Theme — the Northern lights: the step is a block of snow and clear blue ice with frosted edges; on its top corners, snow-covered fir trees and a small reindeer on one side, a little wooden cabin with a warm glowing window on the other, and above them ribbons of the aurora in green and teal only, starry glints. Palette: arctic night (#06141f), aurora mint (#6bffc2), teal, ice white.',
  },
  {
    cle: 'kintsugi',
    fond: 'magenta',
    sujet:
      'Theme — Kintsugi: the front face of the step is a wall of matte black ceramic, cracked and repaired with shining veins of gold that flow like rivers across it; on its top corners, a tiny bonsai pine in a gold-mended pot on one side, a black tea bowl mended with gold and a bamboo whisk on the other, a few drifting gold leaves. Serene and precious. Palette: black, charcoal, warm gold (#e0b54a).',
  },
  {
    cle: 'theatre',
    fond: 'vert',
    sujet:
      'Theme — the Grand theatre: the step is a miniature stage, its front framed by a gilded carved proscenium, crimson velvet curtains drawn and tied on both sides with gold ropes, a row of small glowing footlights along its top edge; on its top corners, golden comedy and tragedy masks on one side, a small gilded opera box with a candelabra on the other. Palette: theatre crimson (#1c0508 in the shadows), velvet red, gold (#e0b34a).',
  },
  // Les Deux Bannières : une marche par camp, chacune son emblème dessiné (`LES_DEUX_EMBLEMES`), joint après le croquis.
  {
    cle: 'bannieres-clans',
    fond: 'magenta',
    references: ['embleme-clans', 'embleme-royaume'],
    sujet:
      'Theme — The Two Banners, the war clans of the Ember: the front face of the step is a wall of dark riveted iron plates and rough red canyon rock, bound by spiked iron bands, with carved bone and curved tusk ornaments at its two upper corners; on its top corners, a roaring iron brazier and a horned war helm on one side, a tall red-and-black war banner bearing the clans’ sigil — the boar head of the second attached image — beside a hide war drum on the other. Palette: ember red (#c8361e), black iron, bone ivory, ember orange (#f08a3a).',
  },
  {
    cle: 'bannieres-royaume',
    fond: 'magenta',
    references: ['embleme-clans', 'embleme-royaume'],
    sujet:
      'Theme — The Two Banners, the Azure kingdom: the front face of the step is a wall of white carved stone with fine gold tracery and deep blue enamel inlays, a gilded moulding along its top; on its top corners, a tall blue-and-gold banner bearing the kingdom’s sigil — the golden lion rampant of the third attached image — and a gilded kite shield bearing the same lion on one side, a slender white tower with a golden dome and a glowing lantern on the other. Palette: azure blue (#2f6fd1), gold (#d4a24c), white stone.',
  },
  {
    cle: 'babel',
    fond: 'magenta',
    sujet:
      'Theme — Babel, the infinite library, earned by mastering every path of knowledge: the step is built of stacked leather-bound books with gilded spines (no titles), carved bookcase pillars at its corners; on its top corners, a tiny spiralling tower of Babel made of books reaching up on one side, a green banker’s lamp glowing warmly over an open book and an hourglass on the other. Palette: dark leather (#15110d), gold (#dbb75e), a single glowing green lampshade.',
  },
  {
    cle: 'horloge',
    fond: 'magenta',
    sujet:
      'Theme — the Astronomical clock, earned by winning the daily quiz fifty times: the step is lapis-lazuli blue enamel and gold, a ring of the twelve zodiac signs in gold leaf circling the medallion, gilded clockwork ornaments; on its top corners, small brass gears and a golden armillary sphere on one side, a little gilded astrolabe and a sun with a serene face on the other. Palette: lapis blue (#0a1024), gold (#e4c06a), ivory.',
  },
  {
    cle: 'ciel',
    fond: 'magenta',
    sujet:
      'Theme — the Sky of the day, earned by playing thirty days in a row: the step is a window onto a luminous painted landscape of rolling hills and a river under a golden sky, framed in deep blue and gold; on its top corners, a radiant golden sun on one side, a silver crescent moon with little stars on the other, small soft clouds drifting between them. Palette: deep blue (#0e1430), gold (#f6cd78), sky blue, warm dawn tones.',
  },
  {
    cle: 'heures',
    fond: 'magenta',
    sujet:
      'Theme — the Very Rich Hours, a fifteenth-century illuminated manuscript, earned by completing the whole calendar: the step is a page of vellum with a border of lapis-lazuli blue and burnished gold leaf, fine gothic filigree and painted acanthus; on its top corners, a tiny gothic castle with slender towers and blue slate roofs on one side, a golden zodiac tympanum arch with a radiant sun on the other. Palette: vellum (#f3e8cf), lapis blue (#1e4091), burnished gold (#c19a3e), vermilion.',
  },
  {
    cle: 'sommet',
    fond: 'magenta',
    sujet:
      'Theme — the Summit, earned by a twenty-question streak: the step is carved from a block of mountain granite with snow and ice on its top; on its top corners, a ridge of tiny snowy peaks with a small orange tent glowing warm on one side, a string of tiny prayer flags in blue, white, red, green and yellow fluttering on the other, dawn light on the snow. Palette: night blue (#0b1322), dawn apricot (#f2a65a), snow white.',
  },
]

// Une marche par plaque du catalogue — par camp pour les Deux Bannières —,
// le Velours compris, et rien de plus : un thème de plus sans sa marche, et
// son podium n'aurait pas d'image.
{
  const attendues = ['velours', ...PLAQUES.map(p => p.cle)].sort().join()
  const peintes = MARCHES_A_PEINDRE.map(m => m.cle).sort().join()
  if (attendues !== peintes) throw new Error(`MARCHES_A_PEINDRE ne suit pas THEMES (shared/themes.ts) : ${peintes} ≠ ${attendues}`)
}

/** La finition d'une marche : la rareté de son thème, ou « gagne » pour un thème qui se gagne. */
const finitionDe = (cle: string) => {
  const t = THEMES.find(x => x.key === themeDeLaPlaque(cle))!
  return FINITIONS[t.gagne ? 'gagne' : t.rarete]
}

const TRAVAUX: Travail[] = [
  ...PAGES_A_PEINDRE.flatMap(p => [
    {
      nom: `calendrier-${p.mois}`,
      groupe: 'calendrier' as const,
      format: '1:1' as const,
      taille: '1K' as const,
      consigne: `${ENLUMINURE}\n\nThe zodiac signs in the tympanum: ${p.signes}.\n\nThe scene of the month: ${p.scene}\n\nOutput one square image (1:1 aspect ratio).`,
    },
    { nom: `calendrier-${p.mois}-doree`, groupe: 'calendrier' as const, format: '1:1' as const, taille: '1K' as const, source: `calendrier-${p.mois}`, consigne: DOREE },
  ]),
  { nom: 'horloge-cadran-or', groupe: 'horloge', format: '1:1', taille: '2K', consigne: CADRAN_D_OR },
  { nom: 'horloge-cadran-nuit', groupe: 'horloge', format: '1:1', taille: '2K', source: 'horloge-cadran-or', consigne: CADRAN_DE_NUIT },
  { nom: 'horloge-cadran', groupe: 'horloge', format: '1:1', taille: '2K', source: 'horloge-cadran-nuit', consigne: ZODIAQUE },
  {
    nom: 'horloge-heures',
    groupe: 'horloge',
    format: '1:1',
    taille: '1K',
    consigne: AIGUILLE(
      'the hour hand: a sturdy arm ending in a small gilded human hand with a pointing index finger, and a radiant golden sun disc with a serene face set halfway along the arm',
    ),
  },
  {
    nom: 'horloge-minutes',
    groupe: 'horloge',
    format: '1:1',
    taille: '1K',
    consigne: AIGUILLE('the minute hand: a long slender arm ending in a sharp gilded star point, with a small openwork fleur-de-lis near the hub'),
  },
  {
    nom: 'horloge-engrenage-grand',
    groupe: 'horloge',
    format: '1:1',
    taille: '1K',
    consigne: ENGRENAGE('a large wheel with a ring of fine regular pointed teeth, six curved openwork spokes and a small round hub'),
  },
  {
    nom: 'horloge-engrenage-petit',
    groupe: 'horloge',
    format: '1:1',
    taille: '1K',
    consigne: ENGRENAGE('a small pinion wheel: a solid disc pierced with five round holes around its hub, with a ring of regular square teeth'),
  },
  { nom: 'ciel-jour', groupe: 'ciel', format: '9:16', taille: '2K', consigne: `${PAYSAGE}\n\n${MIDI}\n\nOutput one vertical image (9:16 aspect ratio).` },
  {
    nom: 'ciel-aube',
    groupe: 'ciel',
    format: '9:16',
    taille: '2K',
    source: 'ciel-jour',
    consigne: LUMIERE(
      'the first light of dawn — a pale sky of rose, apricot and lilac, the sun just rising behind the distant hills with soft rays, a light mist lying on the river, the village still in bluish shade with a few warm lit windows, dew on the grass.',
    ),
  },
  {
    nom: 'ciel-crepuscule',
    groupe: 'ciel',
    format: '9:16',
    taille: '2K',
    source: 'ciel-jour',
    consigne: LUMIERE(
      'a blazing sunset — a sky of orange, rose and violet clouds, the sun setting on the horizon behind the hills, long golden shadows, the river reflecting the fire of the sky, windows lighting up in warm gold.',
    ),
  },
  {
    nom: 'ciel-nuit',
    groupe: 'ciel',
    format: '9:16',
    taille: '2K',
    source: 'ciel-jour',
    consigne: LUMIERE(
      'a deep blue moonlit night — a sky full of stars and the faint Milky Way, a crescent moon reflected in the river, the hills dark blue, the village asleep with a few warm golden lit windows, a few fireflies over the grass.',
    ),
  },
  { nom: 'heures-folio', groupe: 'heures', format: '9:16', taille: '2K', consigne: FOLIO },
  { nom: 'sommet-aube', groupe: 'sommet', format: '9:16', taille: '2K', consigne: SOMMET },
  { nom: 'sommet-drapeaux', groupe: 'sommet', format: '16:9', taille: '1K', consigne: DRAPEAUX },
  {
    nom: 'fond-triomphe',
    groupe: 'fonds',
    format: '2:3',
    taille: '2K',
    consigne: FOND_DE_CARTE(
      'The Triumph, for the champion of the month: an imperial triumph in ancient Rome at dusk — a colonnade of white marble columns with gilded capitals receding on both sides toward a monumental triumphal arch glowing at the far end, deep imperial purple velvet drapes falling from the top corners, golden laurel garlands and a great golden laurel wreath above the arch, rose petals and gold flakes drifting in the air; the attic of the arch is blank, with no inscription. Palette: imperial purple, wine and gold.',
    ),
  },
  {
    nom: 'fond-cadran',
    groupe: 'fonds',
    format: '2:3',
    taille: '2K',
    consigne: FOND_DE_CARTE(
      'The Sundial: a classical sundial of pale weathered stone on a carved pedestal in a formal garden at the golden hour, its bronze gnomon casting a long sharp shadow across the engraved hour lines (lines only, no numerals), clipped boxwood hedges, lavender and old roses around it; the low sun rakes through an arbor of dark foliage, so that the top of the image is deep shade, and warm gold light falls on the stone. Palette: deep green shade, warm gold and honey.',
    ),
  },
  ...FONDS_DU_TRESOR.map(f => ({ nom: `fond-${f.cle}`, groupe: 'tresor' as const, format: '2:3' as const, taille: '2K' as const, consigne: FOND_DE_CARTE(f.sujet) })),
  ...FONDS_DES_SAVOIRS.map(f => ({ nom: `fond-${f.cle}`, groupe: 'savoirs' as const, format: '2:3' as const, taille: '2K' as const, consigne: FOND_DE_CARTE(f.sujet) })),
  ...COFFRES_A_PEINDRE.flatMap(c => [
    { nom: `coffre-${c.rang}-ferme`, groupe: 'tresor' as const, format: '1:1' as const, taille: '1K' as const, consigne: COFFRE_FERME(c.matiere) },
    {
      nom: `coffre-${c.rang}-ouvert`,
      groupe: 'tresor' as const,
      format: '1:1' as const,
      taille: '1K' as const,
      source: `coffre-${c.rang}-ferme`,
      consigne: COFFRE_OUVERT,
    },
  ]),
  ...MARCHES_A_PEINDRE.map(m => ({
    nom: `marche-${m.cle}`,
    groupe: m.references ? ('bannieres' as const) : ('podium' as const),
    format: '3:4' as const,
    taille: '1K' as const,
    croquis: m.fond,
    references: m.references,
    // Avec ses emblèmes, le croquis n'est plus la seule image jointe : la consigne dit laquelle il est.
    consigne: m.references
      ? MARCHE(m.sujet, finitionDe(m.cle), m.fond).replace('following the attached layout sketch exactly', 'following the first attached image, a layout sketch, exactly') +
        `\n\n${LES_DEUX_EMBLEMES('second')}`
      : MARCHE(m.sujet, finitionDe(m.cle), m.fond),
  })),
  {
    nom: 'embleme-clans',
    groupe: 'bannieres',
    format: '1:1',
    taille: '1K',
    consigne: EMBLEME(
      'The war clans of the Ember (red, black, bone, ember orange): a fierce black boar head seen from the front with two huge ivory tusks, glowing ember eyes, on a ' +
        'red jagged shield with a black spiked iron edge, tribal and savage.',
    ),
  },
  {
    nom: 'embleme-royaume',
    groupe: 'bannieres',
    format: '1:1',
    taille: '1K',
    consigne: EMBLEME(
      'The Azure kingdom (royal blue, gold, white): a golden lion rampant seen in profile, standing on its hind legs, claws out, tongue and claws red, on an azure ' +
        'heater shield with a plain thick gold border — classic medieval European heraldry, noble and proud.',
    ),
  },
  // Sans référence : un emblème repeint ne la met pas de côté (`--regenerer`), elle ne se repeindrait pas à l'identique.
  { nom: 'bannieres-esquisse', groupe: 'bannieres', format: '9:16', taille: '2K', consigne: FRONTIERE_ESQUISSE },
  {
    nom: 'bannieres-frontiere',
    groupe: 'bannieres',
    format: '9:16',
    taille: '2K',
    source: 'bannieres-esquisse',
    references: ['embleme-clans', 'embleme-royaume'],
    consigne: FRONTIERE,
  },
]

// Chaque mois du catalogue a sa page à peindre, et rien de plus.
if (PAGES_A_PEINDRE.map(p => p.mois).join() !== PAGES.map(p => p.mois).join()) throw new Error('PAGES_A_PEINDRE ne suit pas PAGES (shared/calendrier.ts)')

const groupesVoulus = liste('groupe') as Groupe[]
for (const g of groupesVoulus) if (!GROUPES.includes(g)) throw new Error(`--groupe=${g} : inconnu (${GROUPES.join(', ')})`)
// `--seulement=` : un essai, une image à la fois, avant d'engager tout un groupe.
const seulement = liste('seulement')
for (const n of seulement) if (!TRAVAUX.some(t => t.nom === n)) throw new Error(`--seulement=${n} : aucune image de ce nom`)
const dansLesGroupes = (t: Travail) => (groupesVoulus.length === 0 || groupesVoulus.includes(t.groupe)) && (seulement.length === 0 || seulement.includes(t.nom))
// Sans rien de nommé, on assemble et on livre, on ne paie rien : relancer la
// chaîne pour une livraison ne doit pas commander tout ce qui manque encore.
const GENERER = groupesVoulus.length > 0 || seulement.length > 0 || args.includes('--tout')

// Ce qu'on repaie : l'image mise de côté, et ce qui part d'elle avec (`--regenerer`) — ou elle seule (`--repeindre`).
const travail = (nom: string) => TRAVAUX.find(t => t.nom === nom)
for (const nom of liste('regenerer')) {
  if (!travail(nom)) throw new Error(`--regenerer=${nom} : aucune image de ce nom`)
  for (const t of TRAVAUX) if (t.nom === nom || t.source === nom || t.references?.includes(nom)) mettreDeCote(t.nom)
}
for (const nom of liste('repeindre')) {
  if (!travail(nom)) throw new Error(`--repeindre=${nom} : aucune image de ce nom`)
  mettreDeCote(nom)
}

// ── Le journal ────────────────────────────────────────────────────────────
// Une ligne par image payée (JSON Lines) : deux passes peuvent tourner à la
// fois — un lot du calendrier qui attend, un essai de thème —, et un ajout
// en fin de fichier ne réécrit jamais la ligne de l'autre.

const cheminJournal = path.join(racine, 'journal-decors.jsonl')
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
  const t = travail(nom)
  appendFileSync(cheminJournal, JSON.stringify({ nom, date: new Date().toISOString(), modele: MODELE, taille: t?.taille, format: t?.format, lot, jetons: r.jetons, cout }) + '\n')
  console.log(`  ${nom} : environ ${cout.toFixed(3)} $ (total ${depense().toFixed(2)} $)`)
}

// ── Les images ────────────────────────────────────────────────────────────

const cheminLots = path.join(racine, `lots-en-cours-${groupesVoulus.length ? [...groupesVoulus].sort().join('-') : 'tous'}.json`)
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

/** Le croquis d'une marche, rendu en PNG une fois : le modèle le reçoit avant la consigne. */
const cheminDuCroquis = (fond: FondDUneMarche) => fichier(`croquis-marche-${fond}.png`)
async function poserLesCroquis(fonds: FondDUneMarche[]) {
  const manquants = [...new Set(fonds)].filter(f => !existsSync(cheminDuCroquis(f)))
  if (!manquants.length) return
  const { chromium } = chargerPlaywright()
  const nav = await chromium.launch({ headless: true })
  try {
    const { largeur, hauteur } = GABARIT_DE_LA_MARCHE
    const page = await nav.newPage({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1 })
    for (const f of manquants) {
      await page.setContent(`<!doctype html><body style="margin:0">${croquisDeLaMarche(f)}</body>`)
      await page.screenshot({ path: cheminDuCroquis(f), clip: { x: 0, y: 0, width: largeur, height: hauteur } })
    }
  } finally {
    await nav.close()
  }
}

const enCours = existsSync(cheminLots) ? JSON.parse(readFileSync(cheminLots, 'utf8') || '[]') : []
if (enCours.length && !(await attendre(enCours))) process.exit(0)

for (let passe = 1; GENERER && passe <= 3; passe++) {
  const aFaire = TRAVAUX.filter(t => dansLesGroupes(t) && !existant(t.nom) && (!t.source || existant(t.source)) && (t.references ?? []).every(r => existant(r)))
  if (!aFaire.length) break
  // Le budget se tient avant de payer : au prix plein, une image coûte
  // environ 0,14 $ (0,07 $ en lot), pensée comprise.
  const prevu = aFaire.length * (LOT ? 0.07 : 0.14)
  if (depense() + prevu > BUDGET) {
    throw new Error(`Budget : ${depense().toFixed(2)} $ dépensés, ${prevu.toFixed(2)} $ prévus pour ${aFaire.length} image(s) — au-delà de ${BUDGET} $.`)
  }
  await poserLesCroquis(aFaire.flatMap(t => (t.croquis ? [t.croquis] : [])))
  const demandes = aFaire.map(t => {
    writeFileSync(fichier(`consigne-${t.nom}.txt`), t.consigne + '\n')
    const references = (t.references ?? []).map(r => enPartie(existant(r)!))
    const parties: Partie[] = t.source
      ? [enPartie(existant(t.source)!), ...references, { text: t.consigne }]
      : t.croquis
        ? [enPartie(cheminDuCroquis(t.croquis)), ...references, { text: t.consigne }]
        : [...references, { text: t.consigne }]
    return { cle: t.nom, parties, format: t.format, taille: t.taille }
  })
  console.log(`Passe ${passe} : ${aFaire.map(t => t.nom).join(', ')}`)
  if (LOT) {
    // Un lot par taille : la taille est celle du lot, le format celui de chaque demande.
    const noms: string[] = []
    for (const taille of ['1K', '2K'] as const) {
      const paquet = demandes.filter(d => d.taille === taille)
      if (paquet.length) noms.push(await lancerLot(paquet, { modele: MODELE, taille, nom: `fiestapp-decors-${taille}` }))
    }
    writeFileSync(cheminLots, JSON.stringify(noms) + '\n')
    console.log(`lot(s) ${noms.join(', ')}`)
    if (!(await attendre(noms))) process.exit(0)
  } else {
    for (const d of demandes) {
      try {
        ranger(d.cle, await generer(d.parties, { modele: MODELE, taille: d.taille, format: d.format }), false)
      } catch (e) {
        // Une image refusée n'arrête pas les autres : elle reviendra à la prochaine passe.
        console.log(`  ${d.cle} : ${(e as Error).message}`)
      }
    }
  }
}

// ── L'assemblage : les fichiers de l'application ─────────────────────────
// Dans Chromium, comme les portraits (`pixels.ts`) : le détourage et les
// réductions par moitiés en viennent ; ici, ce qui manquait — une image en
// hauteur réduite sans être carrée, le disque du cadran, une pièce détourée
// recentrée sur son pivot pour tourner autour de lui.

const OUTILS = String.raw`
// Une image recadrée (fractions de la source : x, y, largeur, hauteur) puis
// réduite à l × h par moitiés successives : d'un coup, le navigateur saute
// des pixels et les traits fins se hachent.
async function redimensionner(src, l, h, qualite, cadrage, transparent) {
  const img = await charger(src)
  const [cx, cy, cl, ch] = cadrage || [0, 0, 1, 1]
  let c = toile(Math.round(cl * img.naturalWidth), Math.round(ch * img.naturalHeight))
  c.getContext('2d').drawImage(img, -cx * img.naturalWidth, -cy * img.naturalHeight)
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

// Le disque du cadran : le carré autour du centre (cx, cy) et du rayon r
// (fractions de la largeur), réduit, puis détouré. Dedans (sous rDedans, en
// part de r), tout reste ; au-delà de r, rien ; entre les deux, la couronne
// des dents d'engrenage, d'où le fond uni de la consigne (sa couleur lue aux
// coins) s'en va pixel par pixel — le laiton entre les dents laisse voir la
// page, comme un vrai rouage. Le chroma seul ne sépare pas le bleu nuit du
// coin du lapis de l'émail : la distance se lit sur les trois canaux.
async function disque(src, cx, cy, r, rDedans, cote, qualite) {
  const img = await charger(src)
  const W = img.naturalWidth
  const cadre = toile(Math.round(2 * r * W), Math.round(2 * r * W))
  cadre.getContext('2d').drawImage(img, -(cx - r) * W, -(cy - r) * W)
  const fin = reduire(cadre, cote), x = fin.getContext('2d', { willReadFrequently: true })
  const donnees = x.getImageData(0, 0, cote, cote), d = donnees.data
  const coin = (u, v) => [0, 1, 2].map(i => d[(v * cote + u) * 4 + i])
  const K = [coin(2, 2), coin(cote - 3, 2), coin(2, cote - 3), coin(cote - 3, cote - 3)].reduce((s, c) => s.map((v, i) => v + c[i] / 4), [0, 0, 0])
  const c = cote / 2
  for (let v = 0; v < cote; v++)
    for (let u = 0; u < cote; u++) {
      const k = (v * cote + u) * 4
      const rho = Math.hypot(u + 0.5 - c, v + 0.5 - c) / c
      let a = 1
      if (rho >= 1) a = 0
      else if (rho > rDedans) {
        const e = Math.hypot(d[k] - K[0], d[k + 1] - K[1], d[k + 2] - K[2])
        a = Math.max(0, Math.min(1, (e - 28) / 70))
        // Le bord du disque, adouci sur un pixel et demi.
        a *= Math.max(0, Math.min(1, (1 - rho) * c / 1.5))
        if (a > 0.02 && a < 0.98) for (let i = 0; i < 3; i++) d[k + i] = Math.max(0, Math.min(255, Math.round((d[k + i] - (1 - a) * K[i]) / a)))
      }
      d[k + 3] = Math.round(a * 255)
    }
  x.putImageData(donnees, 0, 0)
  return fin.toDataURL('image/webp', qualite)
}

// Une pièce détourée (une aiguille, un engrenage), recentrée sur son pivot
// (fractions de la largeur ; par défaut le milieu de ce qui est opaque) dans
// un carré juste assez grand pour qu'elle y tourne sans jamais toucher le
// bord : la feuille la fait tourner autour du centre de sa boîte. « halo » :
// une ombre sombre tout autour, cuite dans l'image — l'or d'une aiguille se
// perdait sur l'or des signes, et un filtre posé par la feuille se
// recalculerait à chaque pas de l'aiguille. Centrée, elle vaut pour tous les
// angles, là où une ombre portée tournerait avec la pièce.
async function recentrer(src, pivot, cote, qualite, halo) {
  const img = await charger(src)
  const W = img.naturalWidth, H = img.naturalHeight
  const c = toile(W, H), x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, W, H).data
  let x0 = W, y0 = H, x1 = 0, y1 = 0
  for (let y = 0; y < H; y++) for (let u = 0; u < W; u++) if (d[(y * W + u) * 4 + 3] > 24) { x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  const px = pivot ? pivot[0] * W : (x0 + x1) / 2, py = pivot ? pivot[1] * W : (y0 + y1) / 2
  let R = 0
  for (let y = y0; y <= y1; y++) for (let u = x0; u <= x1; u++) if (d[(y * W + u) * 4 + 3] > 24) R = Math.max(R, Math.hypot(u - px, y - py))
  const flou = halo ? Math.round(R * halo) : 0
  const S = Math.ceil(2 * (R + 2 * flou)) + 4
  const carre = toile(S, S), cx = carre.getContext('2d')
  if (flou) {
    cx.shadowColor = 'rgba(4, 6, 16, 0.75)'
    cx.shadowBlur = flou
  }
  cx.drawImage(c, S / 2 - px, S / 2 - py)
  return { data: reduire(carre, cote).toDataURL('image/webp', qualite), boite: [x0 / W, y0 / H, x1 / W, y1 / H], pivot: [px / W, py / W], rayon: R / W, marge: (2 * flou) / (R + 2 * flou) }
}

// Une pièce détourée rognée à ce qui est opaque, puis réduite à sa largeur.
async function rogner(src, largeur, qualite) {
  const img = await charger(src)
  const W = img.naturalWidth, H = img.naturalHeight
  const c = toile(W, H), x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, W, H).data
  let x0 = W, y0 = H, x1 = 0, y1 = 0
  for (let y = 0; y < H; y++) for (let u = 0; u < W; u++) if (d[(y * W + u) * 4 + 3] > 24) { x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  const l = x1 - x0 + 1, h = y1 - y0 + 1
  return { data: await redimensionner(src, largeur, Math.round((largeur * h) / l), qualite, [x0 / W, y0 / H, l / W, h / H]), rapport: h / l }
}

// Des pièces détourées de la même taille — un coffre fermé, le même ouvert —
// rognées au même cadre, l'union de ce qui est opaque dans l'une ou l'autre,
// puis réduites à la même largeur : posées l'une sur l'autre, la caisse ne
// saute pas quand le couvercle s'ouvre.
async function rognerEnsemble(srcs, largeur, qualite) {
  const imgs = await Promise.all(srcs.map(charger))
  const W = imgs[0].naturalWidth, H = imgs[0].naturalHeight
  let x0 = W, y0 = H, x1 = 0, y1 = 0
  // Et le haut de chacune : le couvercle fermé commence plus bas que l'ouvert.
  const hauts = []
  for (const img of imgs) {
    const c = toile(W, H), x = c.getContext('2d', { willReadFrequently: true })
    x.drawImage(img, 0, 0, W, H)
    const d = x.getImageData(0, 0, W, H).data
    let haut = H
    for (let y = 0; y < H; y++) for (let u = 0; u < W; u++) if (d[(y * W + u) * 4 + 3] > 24) { x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, y); y1 = Math.max(y1, y); haut = Math.min(haut, y) }
    hauts.push(haut)
  }
  const l = x1 - x0 + 1, h = y1 - y0 + 1
  const cadre = [x0 / W, y0 / H, l / W, h / H]
  return {
    donnees: await Promise.all(srcs.map(s => redimensionner(s, largeur, Math.round((largeur * h) / l), qualite, cadre))),
    rapport: h / l,
    cadre,
    // Le haut de chaque pièce, en part de la hauteur du cadre commun.
    hauts: hauts.map(y => (y - y0) / h),
  }
}

// Ce qu'une marche du podium a vraiment peint, pour la comparer au croquis :
// la largeur de sa face (le bas de l'image, où rien ne la déborde) et la
// hauteur de son dessus (la première rangée, d'en haut, aussi large qu'elle —
// à 97 % : le bord arrière du dessus, vu d'un peu au-dessus, en fait 94 %),
// en parts de la largeur de l'image.
async function profilDUneMarche(src) {
  const img = await charger(src)
  const W = img.naturalWidth, H = img.naturalHeight
  const c = toile(W, H), x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, W, H).data
  const largeurs = []
  for (let y = 0; y < H; y++) {
    let n = 0
    for (let u = 0; u < W; u++) if (d[(y * W + u) * 4 + 3] > 128) n++
    largeurs.push(n)
  }
  const bas = largeurs.slice(Math.round(H * 0.85)).sort((a, b) => a - b)
  const corps = bas[bas.length >> 1]
  const dessus = largeurs.findIndex(n => n >= corps * 0.97)
  return { corps: corps / W, dessus: dessus / W }
}

// La planche de contrôle de l'horloge : le cadran, ses aiguilles posées comme
// la feuille les pose (longueurs en part du rayon), à deux heures — un pivot
// mal mesuré se voit tout de suite.
async function controleHorloge(cadran, heures, minutes, longueurs, temps) {
  const C = 512, c = toile(C * temps.length, C), x = c.getContext('2d')
  const [imgC, imgH, imgM] = await Promise.all([charger(cadran), charger(heures), charger(minutes)])
  temps.forEach(([h, m], i) => {
    const ox = i * C
    x.drawImage(imgC, ox, 0, C, C)
    for (const [img, longueur, angle] of [[imgH, longueurs.heures, (h % 12) * 30 + m * 0.5], [imgM, longueurs.minutes, m * 6]]) {
      const B = C * longueur
      x.save()
      x.translate(ox + C / 2, C / 2)
      x.rotate((angle * Math.PI) / 180)
      x.drawImage(img, -B / 2, -B / 2, B, B)
      x.restore()
    }
  })
  return c.toDataURL('image/png')
}
`

/** Les longueurs des aiguilles, en part du rayon du cadran : la feuille de l'horloge pose les mêmes (`horloge.css`). */
export const LONGUEURS_DES_AIGUILLES = { heures: 0.62, minutes: 0.88 }

/**
 * Ce que l'œil a mesuré sur une image, quand le modèle ne l'a pas posée tout
 * à fait où on le lui demandait : le centre et le rayon du cadran, le pivot
 * d'une aiguille (fractions de la largeur). Vide : la consigne a été suivie.
 */
const MESURES: { cadran?: [number, number, number, number]; pivots: Record<string, [number, number]> } = {
  // Le moyeu de chaque aiguille, mesuré sur son profil (le disque du moyeu,
  // symétrique autour de son centre) : le modèle l'a peint aux deux tiers de
  // la hauteur, pas au centre qu'on lui demandait.
  pivots: { 'horloge-heures': [0.501, 0.666], 'horloge-minutes': [0.4998, 0.6545] },
  // La couronne dentée commence après le filet d'or qui borde l'anneau noir
  // (0,895 du rayon) : partie plus tôt, elle prenait l'émail noir pour le
  // fond bleu nuit et le démêlait en un liseré rougeâtre.
  cadran: [0.5, 0.5, 0.5, 0.905],
}

function chargerPlaywright(): any {
  const globale = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim()
  return createRequire(path.join(globale, 'decors.js'))('playwright')
}

const app = path.join(racine, 'app')
mkdirSync(app, { recursive: true })
const poser = (nom: string, data: string) => writeFileSync(path.join(app, `${nom}.webp`), deDataUrl(data))
const enDataUrl = (f: string) => {
  const b = readFileSync(f)
  return `data:${formatDe(b).mime};base64,${b.toString('base64')}`
}

const { chromium } = chargerPlaywright()
const nav = await chromium.launch({ headless: true })
try {
  const page = await pagePixels(nav, 512)
  await page.addScriptTag({ content: OUTILS })
  const manque = (...noms: string[]) => noms.filter(n => !existant(n))

  // Le calendrier : chaque page et sa dorée, en 512 et 256.
  for (const p of PAGES_A_PEINDRE) {
    for (const [nom, cible] of [
      [`calendrier-${p.mois}`, `page-${p.mois}`],
      [`calendrier-${p.mois}-doree`, `page-${p.mois}-doree`],
    ]) {
      const f = existant(nom)
      if (!f) continue
      for (const cote of [512, 256]) poser(`${cible}-${cote}`, await dansLaPage<string>(page, 'redimensionner', enDataUrl(f), cote, cote, 0.84))
    }
  }

  // L'horloge : le cadran en disque, les aiguilles et les engrenages détourés, recentrés sur leur pivot.
  if (existant('horloge-cadran')) {
    // Centre, rayon du carré pris, et début de la couronne dentée (en part du rayon).
    const [cx, cy, r, dedans] = MESURES.cadran ?? [0.5, 0.5, 0.5, 0.86]
    poser('horloge-cadran-960', await dansLaPage<string>(page, 'disque', enDataUrl(existant('horloge-cadran')!), cx, cy, r, dedans, 960, 0.82))
  }
  for (const [nom, cote] of [
    ['horloge-heures', 512],
    ['horloge-minutes', 512],
    ['horloge-engrenage-grand', 512],
    ['horloge-engrenage-petit', 384],
  ] as const) {
    const f = existant(nom)
    if (!f) continue
    // Le fond est lu sur le pourtour, sans couleur attendue : le vert des
    // aiguilles est sorti plus sombre que #00FF00, et l'imposer aurait mal
    // démêlé leurs bords.
    const d = await dansLaPage<any>(page, 'detourer', enDataUrl(f), null, null)
    // Une aiguille tourne autour de son moyeu, mesuré (`MESURES`) ; un
    // engrenage, autour du milieu de ce qui est opaque.
    const aiguille = !nom.includes('engrenage')
    const pivot = MESURES.pivots[nom] ?? (aiguille ? [0.5, 0.5] : null)
    const r = await dansLaPage<any>(page, 'recentrer', d.plein, pivot, cote, 0.86, aiguille ? 0.025 : 0)
    poser(`${nom}-${cote}`, r.data)
    const doute = d.bordFaux || d.transparents < 0.3
    console.log(`  ${doute ? '⚠ ' : ''}${nom} : ${(d.transparents * 100).toFixed(0)} % transparent, boîte ${r.boite.map((v: number) => v.toFixed(3)).join(' ')}, pivot ${r.pivot.map((v: number) => v.toFixed(3)).join(' ')}`)
  }
  if (!manque('horloge-cadran', 'horloge-heures', 'horloge-minutes').length) {
    const png = await dansLaPage<string>(
      page,
      'controleHorloge',
      enDataUrl(path.join(app, 'horloge-cadran-960.webp')),
      enDataUrl(path.join(app, 'horloge-heures-512.webp')),
      enDataUrl(path.join(app, 'horloge-minutes-512.webp')),
      LONGUEURS_DES_AIGUILLES,
      [
        [10, 10],
        [3, 42],
        [7, 25],
      ],
    )
    writeFileSync(path.join(racine, 'controle-horloge.png'), deDataUrl(png))
  }

  // Les décors en hauteur : 720 de large, la mesure d'un téléphone (360 points, deux pixels par point).
  for (const nom of [
    'ciel-aube',
    'ciel-jour',
    'ciel-crepuscule',
    'ciel-nuit',
    'heures-folio',
    'sommet-aube',
    'bannieres-frontiere',
    'fond-triomphe',
    'fond-cadran',
    ...FONDS_DU_TRESOR.map(f => `fond-${f.cle}`),
    ...FONDS_DES_SAVOIRS.map(f => `fond-${f.cle}`),
  ]) {
    const f = existant(nom)
    if (!f) continue
    const { l, h } = await page.evaluate(
      `(async () => { const i = await charger(${JSON.stringify(enDataUrl(f))}); return { l: i.naturalWidth, h: i.naturalHeight } })()`,
    )
    poser(`${nom}-720`, await dansLaPage<string>(page, 'redimensionner', enDataUrl(f), 720, Math.round((720 * h) / l), 0.8))
  }
  // Les drapeaux, détourés sur leur magenta, rognés à leur cordon.
  if (existant('sommet-drapeaux')) {
    const d = await dansLaPage<any>(page, 'detourer', enDataUrl(existant('sommet-drapeaux')!), null, [255, 0, 255])
    const r = await dansLaPage<any>(page, 'rogner', d.plein, 720, 0.84)
    poser('sommet-drapeaux-720', r.data)
    console.log(`  ${d.bordFaux || d.transparents < 0.3 ? '⚠ ' : ''}sommet-drapeaux : ${(d.transparents * 100).toFixed(0)} % transparent, ${(1 / r.rapport).toFixed(2)}:1`)
  }
  // Les coffres : fermé et ouvert détourés sur leur magenta, rognés au même
  // cadre, en 480 de large — la scène du coffre les montre à 240 points. Leur
  // rapport (hauteur sur largeur) part avec eux : la page réserve leur place ;
  // et la fente du couvercle fermé, où la lumière filtre avant l'ouverture —
  // aux deux cinquièmes de la caisse fermée, sous son haut.
  const mesuresDesCoffres: Record<string, { rapport: number; fente: number }> = {}
  for (const c of COFFRES_A_PEINDRE) {
    const noms = [`coffre-${c.rang}-ferme`, `coffre-${c.rang}-ouvert`]
    if (manque(...noms).length) continue
    const detoures = []
    for (const nom of noms) {
      const d = await dansLaPage<any>(page, 'detourer', enDataUrl(existant(nom)!), null, [255, 0, 255])
      console.log(`  ${d.bordFaux || d.transparents < 0.3 ? '⚠ ' : ''}${nom} : ${(d.transparents * 100).toFixed(0)} % transparent`)
      detoures.push(d.plein)
    }
    const r = await dansLaPage<any>(page, 'rognerEnsemble', detoures, 480, 0.86)
    poser(`coffre-${c.rang}-ferme-480`, r.donnees[0])
    poser(`coffre-${c.rang}-ouvert-480`, r.donnees[1])
    const haut = r.hauts[0]
    mesuresDesCoffres[c.rang] = { rapport: Math.round(r.rapport * 1000) / 1000, fente: Math.round((haut + (1 - haut) * 0.4) * 1000) / 1000 }
  }
  writeFileSync(path.join(app, 'coffres.json'), JSON.stringify(mesuresDesCoffres) + '\n')
  // Les marches du podium : détourées sur leur fond, gardées dans le cadre du
  // croquis — la feuille pose chacune par les mesures du gabarit, jamais par
  // les siennes —, en 360 de large : une marche fait 118 points au plus, deux
  // ou trois pixels par point. Une marche qui ne tombe pas sur son croquis se
  // signale (⚠) : elle se repeint (`--repeindre=marche-<clé>`).
  for (const m of MARCHES_A_PEINDRE) {
    const f = existant(`marche-${m.cle}`)
    if (!f) continue
    const d = await dansLaPage<any>(page, 'detourer', enDataUrl(f), null, [...FONDS_DES_MARCHES[m.fond].rgb])
    const [l, h] = d.taille as [number, number]
    const c = Math.max(l, h)
    const data = await dansLaPage<string>(page, 'redimensionner', d.plein, 360, 480, 0.86, [(c - l) / 2 / c, (c - h) / 2 / c, l / c, h / c])
    poser(`marche-${m.cle}-360`, data)
    const p = await dansLaPage<{ corps: number; dessus: number }>(page, 'profilDUneMarche', data)
    // Le dessus se lit entre son bord arrière et son bord avant : ce qui pose
    // sur les coins, aussi large que la face, le fait lire un peu plus haut.
    const { dessus, profondeur } = GABARIT_DE_LA_MARCHE
    const doute = d.bordFaux || Math.abs(p.dessus - (dessus - profondeur / 2)) > 0.045 || Math.abs(p.corps - FACE) > 0.05
    console.log(`  ${doute ? '⚠ ' : ''}marche-${m.cle} : face ${(p.corps * 100).toFixed(0)} % (${(FACE * 100).toFixed(0)}), dessus à ${p.dessus.toFixed(3)} (${dessus - profondeur} à ${dessus})`)
  }
  // La planche des médaillons : chaque marche, le cercle du gabarit tracé
  // par-dessus — c'est lui qui pose la pièce du rang. Le profil ne mesure que
  // la face et le dessus : le médaillon du Ciel du jour, plus grand et plus
  // bas que le cercle, est passé jusqu'à l'écran d'un joueur, la pièce « 3 »
  // posée sur son bord haut (le retour du propriétaire, le 19 novembre 2026).
  // À juger à l'œil avant de livrer.
  const marchesAssemblees = MARCHES_A_PEINDRE.filter(m => existsSync(path.join(app, `marche-${m.cle}-360.webp`)))
  if (marchesAssemblees.length) {
    const { dessus, medaillon, rayon } = GABARIT_DE_LA_MARCHE
    const cy = 360 * (dessus + FACE * medaillon)
    const r = 360 * FACE * rayon
    const planche = await nav.newPage({ viewport: { width: 1480, height: 400 }, deviceScaleFactor: 1 })
    await planche.setContent(
      '<!doctype html><body style="margin:0;padding:8px;background:#1c181e;display:grid;grid-template-columns:repeat(7,200px);gap:8px;font:12px sans-serif;color:#f0d796">' +
        marchesAssemblees
          .map(
            m =>
              `<figure style="margin:0"><figcaption>${m.cle}</figcaption><svg viewBox="0 60 360 300" width="200" height="167">` +
              `<image href="${enDataUrl(path.join(app, `marche-${m.cle}-360.webp`))}" width="360" height="480"/>` +
              `<circle cx="180" cy="${cy}" r="${r}" fill="none" stroke="#00ffff" stroke-width="3"/></svg></figure>`,
          )
          .join('') +
        '</body>',
    )
    await planche.screenshot({ path: path.join(racine, 'planche-des-medaillons.png'), fullPage: true })
    await planche.close()
    console.log(`  la planche des médaillons : ${path.join(racine, 'planche-des-medaillons.png')}`)
  }
  console.log(app)
  if (args.includes('--livrer')) livrer()
} finally {
  await nav.close()
}

// ── La livraison ──────────────────────────────────────────────────────────
// `--livrer` : les fichiers rejoignent `client/public/decors`, nommés par
// leur empreinte — servis un an sans revalider (`server.ts`), un décor
// repeint change d'adresse —, et ce qui les cite est réécrit :
// - `client/src/components/calendrier-peint.ts`, la table des pages ;
// - dans chaque feuille d'un thème peint et dans `styles.css` (les fonds de
//   carte), le bloc entre ses deux repères, où chaque image devient une
//   propriété (`--horloge-cadran: url(…)`). Le reste de la feuille, écrit à
//   la main, ne lit que ces propriétés : une image repeinte ne touche qu'aux
//   lignes que la chaîne écrit, et une feuille ne cite jamais une adresse
//   qu'un repeint aurait périmée. Une table en TypeScript aurait fait partir
//   les adresses avec toutes les pages, et l'image avec elles dès qu'un style
//   en ligne l'aurait posée : dans la feuille, elle ne part que chez qui porte
//   le thème — et, pour la page du mois, seulement celle du mois.
// Rien n'est livré d'un ensemble incomplet : un thème garde son bloc d'avant.
function livrer() {
  const depot = path.resolve('..')
  const publics = path.join(depot, 'client/public/decors')
  mkdirSync(publics, { recursive: true })
  const empreinte = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex').slice(0, 10)
  const poses = new Set<string>()
  // Ce qui était livré et n'est pas repris reste : un ensemble incomplet garde ses fichiers d'avant.
  const garder = new Set<string>()
  const adresse = (nom: string): string => {
    const source = path.join(app, `${nom}.webp`)
    if (!existsSync(source)) throw new Error(`${nom}.webp manque : relance l'assemblage`)
    const final = `${nom}.${empreinte(source)}.webp`
    writeFileSync(path.join(publics, final), readFileSync(source))
    poses.add(final)
    return `/decors/${final}`
  }
  const complet = (...noms: string[]) => noms.every(n => existsSync(path.join(app, `${n}.webp`)))

  /** Réécrit le bloc entre les deux repères d'une feuille ; le reste ne bouge pas. */
  const reecrire = (feuille: string, bloc: string) => {
    const chemin = path.join(depot, feuille)
    const css = readFileSync(chemin, 'utf8')
    const debut = css.indexOf(REPERE_DEBUT)
    const fin = css.indexOf(REPERE_FIN)
    if (debut < 0 || fin < debut) throw new Error(`${feuille} : les repères des décors peints manquent`)
    writeFileSync(chemin, css.slice(0, debut + REPERE_DEBUT.length) + '\n' + bloc + css.slice(fin))
  }
  /** Les adresses qu'une feuille cite déjà : un ensemble incomplet les garde. */
  const dejaCitees = (feuille: string) => {
    const chemin = path.join(depot, feuille)
    if (!existsSync(chemin)) return
    for (const [, f] of readFileSync(chemin, 'utf8').matchAll(/url\(\/decors\/([^)]+)\)/g)) garder.add(f)
  }

  // Le calendrier : la table que lit l'écran du calendrier.
  const pages = PAGES_A_PEINDRE.flatMap(p => [`page-${p.mois}`, `page-${p.mois}-doree`])
  if (complet(...pages.flatMap(n => [`${n}-512`, `${n}-256`]))) {
    const paire = (nom: string) => `['${adresse(`${nom}-512`)}', '${adresse(`${nom}-256`)}']`
    const lignes = PAGES_A_PEINDRE.map(p => `  '${p.mois}': {\n    page: ${paire(`page-${p.mois}`)},\n    doree: ${paire(`page-${p.mois}-doree`)},\n  },`)
    writeFileSync(
      path.join(depot, 'client/src/components/calendrier-peint.ts'),
      '// Le Calendrier des Heures, peint : douze enluminures, une par mois\n' +
        "// (`shared/calendrier.ts`), et la version dorée de chacune, celle du\n" +
        '// champion du mois. Leurs fichiers vivent dans `client/public/decors`.\n//\n' +
        '// Écrit par `server/scripts/anime/decors.ts --livrer` : on ne le retouche\n' +
        '// pas à la main, on relance la chaîne. Chaque fichier est nommé par son\n' +
        "// empreinte : une page repeinte change d'adresse, et aucun téléphone ne\n" +
        "// garde l'ancienne. Deux tailles, `[grande, petite]` : 512 et 256 pixels\n" +
        '// de côté. La clé est le mois sur deux chiffres, comme `PAGES[i].mois` ;\n' +
        "// pour les parcourir dans l'ordre de l'année, partir de `PAGES` : les clés\n" +
        "// '10', '11' et '12' sont des entiers, et `Object.keys` les range devant '01'.\n\n" +
        'export const PAGES_PEINTES: Record<string, { page: [string, string]; doree: [string, string] }> = {\n' +
        lignes.join('\n') +
        '\n}\n',
    )
  } else {
    const avant = path.join(depot, 'client/src/components/calendrier-peint.ts')
    if (existsSync(avant)) for (const [, f] of readFileSync(avant, 'utf8').matchAll(/\/decors\/([^']+)/g)) garder.add(f)
    console.log('  calendrier : incomplet, rien de livré')
  }

  // Les thèmes peints : chacun ses images, sous des propriétés `--decor-…` de
  // sa feuille — un préfixe à part, que rien d'autre ne pose : l'horloge de
  // `themeJoueur.ts` pose ses angles sous `--horloge-…`.
  const proprietes = (cle: string, images: [string, string][]) =>
    `:root[data-theme='${cle}'] {\n` + images.map(([prop, nom]) => `  --decor-${prop}: url(${adresse(nom)});\n`).join('') + '}\n'
  const themes: { cle: string; images: [string, string][]; plus?: () => string }[] = [
    {
      cle: 'horloge',
      images: [
        ['cadran', 'horloge-cadran-960'],
        ['aiguille-heures', 'horloge-heures-512'],
        ['aiguille-minutes', 'horloge-minutes-512'],
        ['engrenage-grand', 'horloge-engrenage-grand-512'],
        ['engrenage-petit', 'horloge-engrenage-petit-384'],
      ],
    },
    {
      cle: 'ciel',
      images: [
        ['aube', 'ciel-aube-720'],
        ['jour', 'ciel-jour-720'],
        ['crepuscule', 'ciel-crepuscule-720'],
        ['nuit', 'ciel-nuit-720'],
      ],
    },
    {
      cle: 'heures',
      images: [['folio', 'heures-folio-720']],
      // La page du mois de Paris (`data-mois`, posé par `themeJoueur.ts`) :
      // une règle par mois, et seule celle du mois fait venir son image.
      plus: () =>
        PAGES_A_PEINDRE.map(p => `:root[data-theme='heures'][data-mois='${p.mois}'] {\n  --decor-page: url(${adresse(`page-${p.mois}-512`)});\n}\n`).join(''),
    },
    {
      cle: 'sommet',
      images: [
        ['montagne', 'sommet-aube-720'],
        ['drapeaux', 'sommet-drapeaux-720'],
      ],
    },
    { cle: 'bannieres', images: [['frontiere', 'bannieres-frontiere-720']] },
  ]
  for (const t of themes) {
    const feuille = `client/src/themes/${t.cle}.css`
    const noms = [...t.images.map(([, n]) => n), ...(t.cle === 'heures' ? PAGES_A_PEINDRE.map(p => `page-${p.mois}-512`) : [])]
    if (!complet(...noms)) {
      dejaCitees(feuille)
      console.log(`  ${t.cle} : incomplet, son bloc reste celui d'avant`)
      continue
    }
    reecrire(feuille, proprietes(t.cle, t.images) + (t.plus?.() ?? ''))
  }

  // Les fonds de carte, dans `styles.css` : posés sur la carte qui les porte,
  // une ligne chacun. Un fond dont l'image manque ici garde sa ligne d'avant —
  // les originaux d'un fond peint ailleurs ne sont pas dans ce dossier, et le
  // trésor ne devait pas attendre qu'on repeigne le Triomphe pour arriver.
  {
    const feuille = 'client/src/styles.css'
    const { dedans } = (() => {
      const css = readFileSync(path.join(depot, feuille), 'utf8')
      return { dedans: css.slice(css.indexOf(REPERE_DEBUT) + REPERE_DEBUT.length, css.indexOf(REPERE_FIN)) }
    })()
    const avant = new Map([...dedans.matchAll(/\.carte-fond\.fond-([\w-]+) \{ --fond-peint: url\(\/decors\/([^)]+)\); \}/g)].map(m => [m[1], m[2]]))
    const lignes: string[] = []
    for (const cle of ['triomphe', 'cadran', ...FONDS_DU_TRESOR.map(f => f.cle), ...FONDS_DES_SAVOIRS.map(f => f.cle)]) {
      if (complet(`fond-${cle}-720`)) lignes.push(`.carte-fond.fond-${cle} { --fond-peint: url(${adresse(`fond-${cle}-720`)}); }`)
      else if (avant.has(cle)) {
        garder.add(avant.get(cle)!)
        lignes.push(`.carte-fond.fond-${cle} { --fond-peint: url(/decors/${avant.get(cle)}); }`)
        console.log(`  fond ${cle} : pas d'image ici, sa ligne reste celle d'avant`)
      } else console.log(`  fond ${cle} : pas encore peint`)
    }
    // Les marches du podium, une ligne chacune : la marche de la maison, le
    // Velours, sous le podium entier — qui n'a pas de plaque, ou une plaque
    // encore sans peinture, la reçoit —, puis celle de chaque plaque, sous sa
    // classe. Une marche dont l'image manque ici garde sa ligne d'avant.
    const marchesAvant = new Map([...dedans.matchAll(/^(\.[\w.:()-]+) \{ --marche-peinte: url\(\/decors\/([^)]+)\); \}$/gm)].map(m => [m[1], m[2]]))
    for (const m of MARCHES_A_PEINDRE) {
      const selecteur = m.cle === 'velours' ? '.podium-du-classement' : `.pdc-marche.plaque-${m.cle}`
      if (complet(`marche-${m.cle}-360`)) lignes.push(`${selecteur} { --marche-peinte: url(${adresse(`marche-${m.cle}-360`)}); }`)
      else if (marchesAvant.has(selecteur)) {
        garder.add(marchesAvant.get(selecteur)!)
        lignes.push(`${selecteur} { --marche-peinte: url(/decors/${marchesAvant.get(selecteur)}); }`)
        console.log(`  marche ${m.cle} : pas d'image ici, sa ligne reste celle d'avant`)
      } else console.log(`  marche ${m.cle} : pas encore peinte`)
    }
    reecrire(feuille, lignes.join('\n') + '\n')
  }

  // Les coffres de la semaine : la table que lit la scène du coffre. Rien
  // n'est livré tant qu'un des quatre manque : un rang sans dessin garderait
  // les autres d'avant, et un coffre ne change pas de style d'une semaine à
  // l'autre.
  const rangs = COFFRES_A_PEINDRE.map(c => c.rang)
  const moduleDesCoffres = path.join(depot, 'client/src/components/coffres-peints.ts')
  const mesures: Record<string, { rapport: number; fente: number }> = existsSync(path.join(app, 'coffres.json'))
    ? JSON.parse(readFileSync(path.join(app, 'coffres.json'), 'utf8'))
    : {}
  if (complet(...rangs.flatMap(r => [`coffre-${r}-ferme-480`, `coffre-${r}-ouvert-480`])) && rangs.every(r => mesures[r]?.rapport > 0)) {
    const lignes = rangs.map(
      r =>
        `  ${r}: { ferme: '${adresse(`coffre-${r}-ferme-480`)}', ouvert: '${adresse(`coffre-${r}-ouvert-480`)}', rapport: ${mesures[r].rapport}, fente: ${mesures[r].fente} },`,
    )
    writeFileSync(
      moduleDesCoffres,
      '// Les coffres de la semaine, peints : chacun fermé, puis ouvert sur la même\n' +
        '// pose (`shared/coffre.ts`, ses quatre rangs). Leurs fichiers vivent dans\n' +
        '// `client/public/decors`, détourés, rognés au même cadre : posés l’un sur\n' +
        '// l’autre, la caisse ne saute pas quand le couvercle s’ouvre. `rapport` :\n' +
        '// la hauteur sur la largeur, pour réserver leur place.\n//\n' +
        '// Écrit par `server/scripts/anime/decors.ts --livrer` : on ne le retouche\n' +
        "// pas à la main, on relance la chaîne. Chaque fichier est nommé par son\n" +
        "// empreinte : un coffre repeint change d'adresse. `fente` : où la lumière\n" +
        '// filtre sous le couvercle fermé, en part de la hauteur.\n\n' +
        "import type { RangDuCoffre } from '../../../shared/coffre'\n\n" +
        'export const COFFRES_PEINTS: Partial<Record<RangDuCoffre, { ferme: string; ouvert: string; rapport: number; fente: number }>> = {\n' +
        lignes.join('\n') +
        '\n}\n',
    )
  } else {
    if (existsSync(moduleDesCoffres)) for (const [, f] of readFileSync(moduleDesCoffres, 'utf8').matchAll(/\/decors\/([^']+)/g)) garder.add(f)
    console.log('  coffres : incomplets, rien de livré')
  }

  // Les fichiers que plus rien ne cite : ceux d'avant un repeint.
  for (const f of readdirSync(publics)) if (!poses.has(f) && !garder.has(f)) rmSync(path.join(publics, f))
  console.log(`${poses.size} fichiers livrés dans client/public/decors`)
}
