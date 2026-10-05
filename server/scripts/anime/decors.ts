// Les décors peints : le Calendrier des Heures, les quatre thèmes qui se
// gagnent sans se vendre (l'Horloge astronomique, le Ciel du jour, les Très
// Riches Heures, le Sommet) et deux fonds de carte (le Triomphe, le Cadran
// solaire).
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
import { PAGES } from '../../../shared/calendrier'

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

type Groupe = 'calendrier' | 'horloge' | 'ciel' | 'heures' | 'sommet' | 'fonds'
const GROUPES: Groupe[] = ['calendrier', 'horloge', 'ciel', 'heures', 'sommet', 'fonds']

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

/**
 * Un fond de carte : le prénom et tout le reste s'écrivent par-dessus, à
 * l'encre claire (`.carte-fond`, `styles.css`) — l'image reste sombre et
 * calme en son milieu, ses beautés vers les bords et le bas.
 */
const FOND_DE_CARTE = (sujet: string) =>
  'Vertical painting (2:3) used as the background of a player’s profile card in a party quiz game. The card’s text is written over it in light ' +
  `ink, so the whole image stays dark and calm in its middle, with its richest details toward the edges and the bottom. ${sujet} Painted as a ` +
  'rich, luminous digital painting with fine gold-leaf accents. No people, no text, no letters, no numerals, no inscriptions, no frame, no border.'

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
  for (const t of TRAVAUX) if (t.nom === nom || t.source === nom) mettreDeCote(t.nom)
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

const enCours = existsSync(cheminLots) ? JSON.parse(readFileSync(cheminLots, 'utf8') || '[]') : []
if (enCours.length && !(await attendre(enCours))) process.exit(0)

for (let passe = 1; GENERER && passe <= 3; passe++) {
  const aFaire = TRAVAUX.filter(t => dansLesGroupes(t) && !existant(t.nom) && (!t.source || existant(t.source)))
  if (!aFaire.length) break
  // Le budget se tient avant de payer : au prix plein, une image coûte
  // environ 0,14 $ (0,07 $ en lot), pensée comprise.
  const prevu = aFaire.length * (LOT ? 0.07 : 0.14)
  if (depense() + prevu > BUDGET) {
    throw new Error(`Budget : ${depense().toFixed(2)} $ dépensés, ${prevu.toFixed(2)} $ prévus pour ${aFaire.length} image(s) — au-delà de ${BUDGET} $.`)
  }
  const demandes = aFaire.map(t => {
    writeFileSync(fichier(`consigne-${t.nom}.txt`), t.consigne + '\n')
    const parties: Partie[] = t.source ? [enPartie(existant(t.source)!), { text: t.consigne }] : [{ text: t.consigne }]
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
  for (const nom of ['ciel-aube', 'ciel-jour', 'ciel-crepuscule', 'ciel-nuit', 'heures-folio', 'sommet-aube', 'fond-triomphe', 'fond-cadran']) {
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

  // Les fonds de carte, dans `styles.css` : posés sur la carte qui les porte.
  if (complet('fond-triomphe-720', 'fond-cadran-720')) {
    reecrire(
      'client/src/styles.css',
      `.carte-fond.fond-triomphe { --fond-peint: url(${adresse('fond-triomphe-720')}); }\n` +
        `.carte-fond.fond-cadran { --fond-peint: url(${adresse('fond-cadran-720')}); }\n`,
    )
  } else {
    dejaCitees('client/src/styles.css')
    console.log('  fonds : incomplets, leur bloc reste celui d’avant')
  }

  // Les fichiers que plus rien ne cite : ceux d'avant un repeint.
  for (const f of readdirSync(publics)) if (!poses.has(f) && !garder.has(f)) rmSync(path.join(publics, f))
  console.log(`${poses.size} fichiers livrés dans client/public/decors`)
}
