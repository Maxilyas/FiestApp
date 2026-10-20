// Les compagnons peints — le pilote : le loup.
//
// Un compagnon s'achète en boutique à sa première forme, puis grandit avec les
// bonnes réponses données en le portant (100, 300, 500 : le choix du 13
// octobre 2026). Quatre formes du même individu, chacune plus riche que la
// précédente : le louveteau seul sur son disque, le jeune loup dans son décor,
// l'adulte qui sort du cercle, la forme ultime et son aura. À chaque forme,
// quatre expressions, que la révélation montre (neutre, ravi, dépité,
// triomphant) ; l'Éclat, une vraie métamorphose de la forme ultime — un autre
// loup, plus féroce, qui sort tout entier de son disque ; et la pose du bond
// de son entrée en scène à l'écran commun. Jamais de feuille d'or : elle reste
// la signature des légendaires.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/compagnons.ts loup                 # l'essai des styles
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/anime/compagnons.ts loup --style=cine3d  # puis tout le reste, dans ce style
//   … --eclat=tempete                  # la métamorphose gardée : son décor, sa découpe, ses expressions
//   … --regenerer=adulte,adulte-ravi   # repayer ces images, et ce qui part d'elles
//   … --seulement=eclat-aurore         # ne peindre que ces images, et ce qui part d'elles
//   … --seulement=bebe,jeune --exactement   # ne peindre que celles-là, sans ce qui en part
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
/** Les métamorphoses de l'Éclat qu'on garde : sans elles, seules leurs illustrations se peignent, pour choisir. */
const ECLATS = (args.find(a => a.startsWith('--eclat='))?.slice('--eclat='.length) ?? '').split(',').filter(Boolean)
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

// Ce qu'on efface est ce que la découpe garde : sans le dire, la tortue-île
// effacée laissait son île flotter dans le ciel, et l'île passait deux fois.
// L'esprit du chat revenait tel quel, chat compris : l'effacement se dit deux
// fois, et ce qui doit rester se dit aussi.
const DECOR_SEUL = (garde: string) =>
  `Edit the attached illustration: erase ${garde} completely, with its shadow, and repaint the setting where it was, continuing naturally ` +
  'what lies behind it — the same place, the same light, the same style. Change nothing else: same composition, same colors, same details. ' +
  'The result shows only the empty setting: there is no animal, no creature and no character anywhere in it. No text, no frame. ' +
  'Output one square image (1:1 aspect ratio).'

// Ce qui est translucide prend la couleur du fond uni, et le détourage la
// garde : les ailes et la traînée de la luciole adulte sortaient roses du
// magenta (le 18 octobre 2026). Une forme qui en a les nomme (`opaque`).
const DECOUPE = (garde: string, retirer: string, c: Chroma, opaque?: string) =>
  `Edit the attached image. Keep ${garde} exactly as it is — same pose, same position, same size, same outline, same colors and details, untouched. ` +
  `Replace everything else with ${fondUni(c)}. In particular, replace ${retirer} with the flat color. ` +
  (opaque
    ? `Paint ${opaque} fully opaque, in their own colors as in the original illustration: the flat background color must never show through ` +
      'them, nor tint them. '
    : '') +
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

// ── Les compagnons ────────────────────────────────────────────────────────

interface Forme {
  id: string
  /** Sa scène ; aucune pour la première forme, peinte seule sur un fond uni. */
  decor?: string
  /** Ce qui sort du disque par le haut, s'il en sort : sans le dire, le modèle ramène tout dans le cadre. */
  deborde?: string
  /**
   * Elle sort du disque de tous côtés, l'animal et le monde qui l'entoure (une
   * forme ultime : « que l'environnement soit vivant et sorte du cercle », le
   * propriétaire, le 13 octobre 2026) : sa découpe garde ce monde avec lui.
   */
  entier?: boolean
  /** Sa place dans le cadre, quand elle dit son âge. */
  taille?: string
  /** Ce que sa découpe garde, et ce qu'elle retire. */
  garde: string
  retirer?: string
  /** Ce qui est translucide et doit sortir opaque de sa découpe, sans quoi le fond uni le teinte. */
  opaque?: string
  /** Le fond uni de ses découpes : vert, sauf pour qui porte du vert (la carapace moussue de la tortue). */
  chroma?: Chroma
}

/**
 * Une métamorphose, peinte d'après la forme ultime. Chaque compagnon en a deux
 * (le choix du 13 octobre 2026) : la lumière, que l'Éclat fait tomber, et
 * l'ombre, qui se gagne par cent mauvaises réponses données en le portant ;
 * l'une et l'autre ne se montrent qu'à la forme ultime.
 */
interface Eclat {
  nom: string
  voie: 'lumiere' | 'ombre' | 'ecartee'
  consigne: string
  garde: string
  retirer: string
  chroma: Chroma
  /** Ce qui est translucide et doit sortir opaque de sa découpe, comme pour une forme : les voiles d'aurore de la luciole. */
  opaque?: string
  /** Il sort du disque tout entier : le disque ne prend qu'une part de l'image, et l'animal en déborde de tous côtés. */
  entier?: boolean
  /** Ses expressions à lui, quand celles de tous ne suffisent pas. */
  expressions?: Partial<Record<Expression, string>>
}

/**
 * Une couche du monde vivant de la forme ultime, peinte à part, qui déborde
 * du cercle et bouge seule : de la lumière peinte sur du noir (posée en
 * `screen`, le noir s'efface), ou des choses détourées (des oiseaux).
 */
interface Vivant {
  cle: string
  mode: 'lumiere' | 'detoure'
  consigne: string
  chroma?: Chroma
}

const VIVANT = (v: Vivant) =>
  `Using the attached illustration only as the reference for its style, light and colors, paint ONLY ${v.consigne}, on ` +
  (v.mode === 'lumiere'
    ? 'a pure, perfectly flat black background (#000000). This is a light layer that will be blended over the picture: everything that is not ' +
      'light stays pure black.'
    : `${fondUni(v.chroma ?? 'vert')}. Do not use any ${CHROMAS[v.chroma ?? 'vert'].proscrit} on what you paint.`) +
  ' Nothing else: no creature, no ground, no sky, no scenery. No text, no frame. Output one square image (1:1 aspect ratio).'

/** Une métamorphose recomposée : l'illustration d'origine ne dit plus que qui il est (voir `FEROCE`, la première). */
const METAMORPHOSE = (reference: string, metamorphose: string, elan: string, c: Chroma) =>
  `Using the attached illustration only as a reference for who this creature is — ${reference}, the painting style — paint its rare variant: ` +
  `a true metamorphosis, recomposed from scratch, nothing like a recolor of the original. ${metamorphose} ` +
  `It is far more dramatic than the original. ${elan} ` +
  'Framing: the creature is huge, filling about 90% of the canvas width and height, its whole body inside the canvas with a small margin on ' +
  'every side — nothing cut off by the edges; its scene fills the background behind it. ' +
  `Do not use any ${CHROMAS[c].proscrit}. No gold leaf, no text, no frame. Output one square image (1:1 aspect ratio).`

// Sur une bête qui grogne, « ravi » gardait le grognement : le loup d'ombre
// ravi était son neutre au pixel près (99 % de la même silhouette).
const RAVI_FEROCE =
  'GLEEFUL — its snarl turns into a wild, happy grin: mouth wide open but relaxed, tongue lolling out, eyes bright and delighted instead of ' +
  'angry, ears forward, tail wagging — still a powerful beast, just thrilled, no longer snarling'

interface Compagnon {
  id: string
  /** Ce qui le fait reconnaître d'une forme à l'autre, et d'un autre loup. */
  identite: string
  /** Ses quatre âges, tels que la planche de modèle les montre, de gauche à droite. */
  ages: [string, string, string, string]
  formes: [Forme, Forme, Forme, Forme]
  /** Ses expressions à lui : une tortue ne remue pas la queue, un chat ne hurle pas. */
  expressions?: Partial<Record<Expression, string>>
  /** Les métamorphoses essayées ; `--eclat=` dit lesquelles on achève. */
  eclats: Record<string, Eclat>
  /** Les couches vivantes de sa forme ultime. */
  vivant?: Vivant[]
  /**
   * Un portrait choisi d'avance, que le propriétaire a validé (`reference.jpg` dans son dossier) : la planche de
   * modèle le prend pour son premier âge, au lieu d'inventer l'individu.
   */
  reference?: boolean
  /** La pose de son entrée en scène, repeinte sur la découpe de la forme ultime — si l'entrée se fait. */
  bond?: string
}

// Une métamorphose qui garde la pose ne change que le monde autour : « que ça
// change complètement l'image, beaucoup plus féroce, qui sort complet » (le
// propriétaire, le 13 octobre 2026). L'illustration d'origine ne dit plus que
// qui il est ; le reste se recompose, et l'animal, immense, bondit vers nous —
// tout entier dans l'image, pour que sa découpe déborde du disque de tous côtés.
const FEROCE = (metamorphose: string, c: Chroma) =>
  'Using the attached illustration only as a reference for who this wolf is — its crescent mark on the forehead, its midnight-blue saddle, ' +
  'the painting style — paint its rare variant: a true metamorphosis a player may find once in forty evenings, recomposed from scratch, ' +
  `nothing like a recolor of the original. ${metamorphose} ` +
  'It is far fiercer than the original: the wolf leaps straight at the viewer, seen from the front, jaws wide open in a snarl, long fangs bared, ' +
  'hackles raised, front paws and claws reaching forward, as if bursting out of the picture. ' +
  'Framing: the wolf is huge, filling about 90% of the canvas width and height, its whole body inside the canvas with a small margin on every ' +
  'side — nothing cut off by the edges; its scene fills the background behind it. ' +
  `Do not use any ${CHROMAS[c].proscrit}. No gold leaf, no text, no frame. Output one square image (1:1 aspect ratio).`

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
  eclats: {
    // La première : même pose, un autre monde. Trop proche de la forme ultime.
    aurore: {
      nom: 'Le loup d’aurore',
      voie: 'ecartee',
      consigne:
        'Edit the attached illustration into its rare variant, a metamorphosis a player may find once in forty evenings: keep exactly the same ' +
        'composition, pose, framing, scale and level of detail, the same individual and its crescent mark — and move it into another world. ' +
        'Its fur becomes flowing ribbons of aurora light, emerald, teal and cyan, translucent and glowing from within; the starry saddle turns into ' +
        'a living aurora; the crescent mark on its forehead becomes a bright white star. The summit is now blue ice, and the sky behind is a deep ' +
        'teal polar night lit by a great curtain of green and cyan aurora, the moon a pale cyan crescent. The same painting style. ' +
        'Do not use any pink, magenta or violet. No gold leaf, no text, no frame. Output one square image (1:1 aspect ratio).',
      garde: 'the aurora wolf with the glowing ribbons of its fur and mane',
      retirer: 'the ice summit, the sky, the aurora curtain, the moon and the stars',
      chroma: 'magenta',
    },
    tempete: {
      nom: 'Le loup-tempête',
      voie: 'lumiere',
      consigne: FEROCE(
        'It becomes a storm spirit of the polar night: its fur turned into crackling ribbons of green and cyan aurora lightning, its eyes ' +
          'blazing white-cyan, the crescent mark flaring like a star; ice shards and snow explode around it, against a dark sky torn by a raging ' +
          'aurora storm. High contrast, a dark stormy palette lit by electric aurora light.',
        'magenta',
      ),
      garde: 'the storm wolf with the lightning and aurora ribbons of its fur',
      retirer: 'the sky, the storm, the aurora, the snow and the flying ice shards around it',
      chroma: 'magenta',
      entier: true,
      expressions: { ravi: RAVI_FEROCE },
    },
    ombre: {
      nom: 'Le loup d’ombre',
      voie: 'ombre',
      consigne: FEROCE(
        'It becomes a shadow beast of black smoke and blue fire: its fur turning into black smoke, its mane and tail flaring into blue flames, ' +
          'its eyes burning electric blue, the crescent mark blazing white; embers and the shards of a broken moon fly around it, against a deep ' +
          'night sky cracked with blue fire. High contrast, deep blacks and midnight blue lit by blue flames.',
        'vert',
      ),
      garde: 'the shadow wolf with the blue flames of its mane and tail',
      retirer: 'the sky, the broken moon, the embers and the cracks of fire around it',
      chroma: 'vert',
      entier: true,
      expressions: { ravi: RAVI_FEROCE },
    },
  },
  // Sa forme ultime, peinte avant le monde vivant, gardait ses rubans d'étoiles
  // dans le disque : ils en sortent maintenant, en lumière, et tournent autour de lui.
  vivant: [
    {
      cle: 'rubans',
      mode: 'lumiere',
      consigne:
        'swirling ribbons of starlight and tiny sparkling stars, like a luminous wind forming a loose ring around the frame, the center left empty',
    },
  ],
  bond:
    'Edit the attached image: the same wolf in its mythic form — same individual, same colors, same style, same starlight in its fur — now in ' +
    'full motion, leaping to the right through the air, all four legs stretched, its mane and tail streaming behind it, mouth slightly open, ' +
    `powerful and joyful. The whole wolf inside the canvas with a small margin, filling about 85% of its width. Keep the background ${fondUni('vert')}. ` +
    'No motion lines, no text, no frame. Output one square image (1:1 aspect ratio).',
}

/** Le chat des lanternes : le plus « fête » des compagnons, un soir de festival qui grandit avec lui. */
const CHAT: Compagnon = {
  id: 'chat',
  // Le chat de Schrödinger (`br:chat`) existe déjà parmi les portraits de l'espace.
  identite:
    'Its identity never changes from one age to the next: a soft cream coat washed with warm apricot; a deep plum mask around its eyes, and ' +
    'plum tips on its ears and tail; big luminous golden-amber eyes; a tiny ember-orange flame mark on its forehead; a red silk cord tied around ' +
    'its neck with a small brass bell. It must look nothing like an ordinary tabby or a black cat.',
  ages: [
    'a tiny kitten, round and fluffy, with oversized ears and big eyes, sitting beside a tiny glowing paper lantern, its tail curled around it',
    'a half-grown young cat, visibly younger and smaller than the adult — a slim, lanky body on long legs, oversized ears and paws, a round, ' +
      'curious face',
    'the adult cat, graceful, elegant and confident',
    'its spirit form — larger and majestic, with two long flowing tails whose tips burn with soft lantern flames, glowing festival patterns ' +
      'running through its fur like light through lantern paper, the flame mark on its forehead shining',
  ],
  formes: [
    { id: 'chaton', garde: 'the kitten and its little lantern' },
    {
      id: 'jeune',
      decor: 'a tiled rooftop on a warm summer festival night, strings of glowing paper lanterns and a few sky lanterns rising into a deep blue sky',
      taille: 'It is still small: it fills only about 55% of the canvas height, with plenty of setting around it.',
      garde: 'the young cat — its head, ears, body, legs, paws and tail',
      retirer: 'the rooftop, the lanterns, the strings and the sky',
    },
    {
      id: 'adulte',
      decor: 'the heart of a night festival: a street lined with glowing lanterns and food stalls, sky lanterns rising, the first fireworks blooming high above',
      deborde: 'its raised head and pointed ears',
      garde: 'the cat — its head, ears, body, legs, paws and tail',
      retirer: 'the street, the stalls, the lanterns, the fireworks and the sky',
    },
    {
      id: 'esprit',
      entier: true,
      decor: 'high above the festival rooftops, an immense night sky full of fireworks bursting in gold, coral and violet, hundreds of sky lanterns rising',
      garde: 'the spirit cat with its two flaming tails, and the paper lanterns floating right around it',
      retirer: 'the sky, the fireworks, the rooftops and the distant lanterns',
    },
  ],
  expressions: {
    triomphe: 'TRIUMPHANT — chest out, chin held high, eyes half closed in a proud smile, mouth open in a victorious meow, tail raised high and curled',
  },
  eclats: {
    soleil: {
      nom: 'Le chat-soleil',
      voie: 'lumiere',
      consigne: METAMORPHOSE(
        'its plum mask, its flame mark on the forehead, its red cord and brass bell',
        'It becomes a sun spirit of the festival: its fur turned into woven gold and sunrise light, its two tails blazing like comets, golden ' +
          'fireworks bursting all around it in a dazzling dawn sky.',
        'It leaps straight at the viewer, seen from the front, wild and joyful, claws out, mouth open in a fierce yowl.',
        'vert',
      ),
      garde: 'the sun cat with its two blazing tails',
      retirer: 'the sky, the fireworks and the sparks around it',
      chroma: 'vert',
      entier: true,
      expressions: {
        ravi:
          'GLEEFUL — its yowl turns into a wide, delighted grin, eyes bright and happy instead of fierce, ears forward, tail held high and ' +
          'curling — still a blazing spirit, just thrilled',
      },
    },
    fantome: {
      nom: 'Le chat-fantôme',
      voie: 'ombre',
      consigne: METAMORPHOSE(
        'its mask, its flame mark on the forehead, its cord and bell',
        'It becomes a ghost cat of the night: its fur turned into black smoke and ink, its mask turned to black, its eyes burning pale ' +
          'green-white, its two tails trailing ghostly pale-green flames, torn paper lanterns and will-o’-wisps swirling around it in a black night.',
        'It lunges straight at the viewer, seen from the front, hissing, fangs bared, claws out, fur bristling.',
        'magenta',
      ),
      garde: 'the ghost cat with the pale-green flames of its two tails',
      retirer: 'the night sky, the torn lanterns and the will-o’-wisps around it',
      chroma: 'magenta',
      entier: true,
      expressions: {
        ravi:
          'GLEEFUL — its hiss turns into a wide, mischievous grin, eyes bright and amused instead of furious, ears forward — still a ghost, ' +
          'just delighted',
      },
    },
  },
  vivant: [
    {
      cle: 'feux',
      mode: 'lumiere',
      consigne: 'bursts of fireworks in gold, coral and violet with long trailing sparks, spread around the frame, the center left empty',
    },
    {
      cle: 'lanternes',
      mode: 'lumiere',
      consigne: 'a scattering of glowing paper sky lanterns of different sizes floating upward, spread around the frame, the center left empty',
    },
  ],
}

/**
 * La tortue-île : son décor, c'est son dos — une pousse, un jardin, un
 * bosquet, une île entière. Magenta partout : sa carapace et son île sont
 * vertes, et l'Éclat en fleurs les garde blanches et dorées, jamais roses.
 */
const TORTUE: Compagnon = {
  id: 'tortue',
  // La tortue de mer (`br:tortue`) existe déjà parmi les portraits des océans.
  identite:
    'Its identity never changes from one age to the next: a shell of mossy jade-green plates edged in warm sandstone; a sea-blue head and ' +
    'flippers dappled with pale freckles; kind deep-amber eyes; a small white star-shaped mark on top of its head. It must look nothing like an ' +
    'ordinary sea turtle.',
  ages: [
    'a tiny hatchling, round-eyed and clumsy, with a single green sprout growing from the top of its shell',
    'a half-grown young turtle, visibly younger and smaller than the adult, with a little garden of moss, ferns and small white flowers on its shell',
    'the large adult turtle, calm and wise, carrying a small grove on its shell — a few trees, mossy rocks and a tiny waterfall',
    'its colossal ultimate form — a gentle giant carrying a whole living island on its back: tall trees, cliffs, waterfalls pouring off the edges ' +
      'of its shell, birds circling above',
  ],
  formes: [
    { id: 'bebe', garde: 'the hatchling and its sprout', chroma: 'magenta' },
    {
      id: 'jeune',
      decor: 'a turquoise lagoon at golden hour, gentle waves around a sandy islet, a few seabirds',
      taille: 'It is still small: it fills only about 55% of the canvas height, with plenty of setting around it.',
      garde: 'the young turtle and the little garden on its shell',
      retirer: 'the sea, the waves, the islet, the birds and the sky',
      chroma: 'magenta',
    },
    {
      id: 'adulte',
      decor: 'the open sea at sunset, the turtle swimming at the surface, warm light on the waves',
      deborde: 'the trees of the grove on its shell',
      garde: 'the turtle and the grove on its shell — its trees, rocks and waterfall',
      retirer: 'the sea, the waves and the sky',
      chroma: 'magenta',
    },
    {
      id: 'ile',
      entier: true,
      decor: 'a vast ocean under a glowing dawn sky with towering clouds, the sea foaming around the island turtle',
      garde: 'the turtle and the whole island on its back — its trees, cliffs, waterfalls and the birds circling it',
      retirer: 'the sea, the foam, the sky and the clouds',
      chroma: 'magenta',
    },
  ],
  expressions: {
    ravi: 'JOYFUL — bright smiling eyes, mouth open in a happy smile, head raised with delight',
    depite: 'DISAPPOINTED, in a cute and gentle way, never tragic — head drooping and half pulled back into its shell, big sad eyes, a small pout',
    triomphe: 'TRIUMPHANT — head stretched high and proud, mouth open in a joyful bellow, one front flipper raised',
  },
  eclats: {
    fleurs: {
      nom: 'L’île en fleurs',
      voie: 'lumiere',
      consigne: METAMORPHOSE(
        'its jade shell edged in sandstone, its sea-blue freckled head, the white star on its head',
        'It becomes a sacred blossom island: every tree on its back bursts into white and golden blossoms, petals swirling everywhere in a ' +
          'warm golden dawn, its waterfalls turned to falling light.',
        'It surges up out of the sea toward the viewer, head raised high, majestic and radiant, the sea parting around it.',
        'magenta',
      ),
      garde: 'the turtle and its blossoming island with the swirling petals',
      retirer: 'the sea, the sky and the clouds',
      chroma: 'magenta',
      entier: true,
    },
    volcan: {
      nom: 'La tortue-volcan',
      voie: 'ombre',
      consigne: METAMORPHOSE(
        'its shell, its freckled head, the star on its head',
        'It becomes a volcano turtle: the island on its back turned into an erupting volcano of black rock and glowing lava, rivers of lava ' +
          'pouring off its shell, ash and embers filling a red-black sky.',
        'It charges out of a boiling sea toward the viewer, jaws wide open in a roar, eyes blazing orange.',
        'vert',
      ),
      garde: 'the volcano turtle with its erupting island and the lava pouring off its shell',
      retirer: 'the boiling sea, the sky, the ash clouds and the embers around it',
      chroma: 'vert',
      entier: true,
      expressions: {
        ravi: 'GLEEFUL — its roar turns into a broad, delighted grin, eyes bright and happy instead of furious — still a force of nature, just thrilled',
      },
    },
  },
  vivant: [
    {
      cle: 'brume',
      mode: 'lumiere',
      consigne: 'drifting sea mist, sea spray and floating motes of golden light, spread around the frame, the center left empty',
    },
    {
      cle: 'oiseaux',
      mode: 'detoure',
      chroma: 'magenta',
      consigne: 'a flock of white seabirds in flight, seen from different angles, spread around the frame, the center left empty',
    },
  ],
}

/**
 * La luciole : la compagne de l'Expédition, qui ne s'achète pas (le souhait du
 * propriétaire, le 18 octobre 2026 : « que certains hauts faits récompensent
 * de nouveaux compagnons, comme la luciole »). Sa lumière est verte et dorée :
 * magenta partout, sur du vert sa lanterne se serait percée au détourage.
 * Mignonne d'abord — ni mandibules ni pattes velues : on n'adopte pas un insecte.
 */
const LUCIOLE: Compagnon = {
  id: 'luciole',
  identite:
    'Its identity never changes from one age to the next: a round, soft, plush-like body of warm amber and honey-brown fuzz; a glowing ' +
    'lantern-like belly that shines a soft golden-green light; big gentle dark eyes with tiny star-shaped highlights; rosy cheeks; two long ' +
    'curling antennae ending in tiny glowing tips. A cute, round, cuddly design, never a realistic insect: no mandibles, no hairy legs — only ' +
    'six tiny stubby legs. It must look nothing like a bee or a ladybird.',
  ages: [
    'a tiny glowworm: a plump little grub of soft amber fuzz, curled up on a round green leaf, big eyes, the tip of its tail glowing softly',
    'a young firefly, just hatched: small and round, its new wings still small and a little crumpled, antennae too long for its head, its ' +
      'lantern belly glowing gently',
    'the adult firefly, graceful and bright: delicate translucent wings veined with amber spread open, its lantern belly shining warm light, ' +
      'a ribbon of light trailing behind it',
    'its mythic ultimate form — a great guardian firefly of the summer night, larger and majestic, its wings like glowing stained glass, its ' +
      'lantern a small sun of golden-green light, a swarm of tiny fireflies orbiting it like a living constellation',
  ],
  formes: [
    { id: 'ver', garde: 'the glowworm and its leaf', chroma: 'magenta' },
    {
      id: 'jeune',
      decor: 'a summer meadow at dusk, tall grasses and wildflowers, the first stars in a deep blue sky, a few tiny fireflies glowing in the grass',
      taille: 'It is still small: it fills only about 55% of the canvas height, with plenty of setting around it.',
      garde: 'the young firefly — its head, antennae, body, wings, legs and glowing belly',
      retirer: 'the grasses, the flowers, the distant fireflies and the sky',
      chroma: 'magenta',
    },
    {
      id: 'adulte',
      decor: 'a winding path through an old forest at night, mossy roots and ferns, the path lit by the firefly’s glow and the trail of light behind it',
      deborde: 'its raised antennae and the tips of its open wings',
      garde: 'the firefly — its head, antennae, body, wings, legs, its glowing belly and the ribbon of light it trails',
      retirer: 'the trees, the path, the roots, the ferns and the night',
      opaque: 'its wings (pale amber and cream, with their amber veins) and the ribbon of light it trails (a warm yellow-green glow)',
      chroma: 'magenta',
    },
    {
      id: 'constellation',
      entier: true,
      decor: 'high above a sleeping valley under an immense starry summer night, a river of fireflies rising from the meadows below',
      garde: 'the great firefly and the swarm of small fireflies orbiting right around it',
      retirer: 'the sky, the stars, the valley and the distant fireflies',
      chroma: 'magenta',
    },
  ],
  // Ni oreilles ni queue : ses antennes, sa lanterne et ses ailes disent son humeur.
  expressions: {
    ravi: 'JOYFUL — bright smiling eyes, mouth open in a happy little smile, rosy cheeks, antennae perked up and curling with delight, its belly glowing brighter',
    depite:
      'DISAPPOINTED, in a cute and gentle way, never tragic — antennae drooping, big sad eyes looking up, a small pout, its belly glowing dimmer',
    triomphe: 'TRIUMPHANT — head held high, eyes shining, mouth open in a joyful cheer, antennae raised high, its belly blazing with light',
  },
  // Sa lumière seule, la luciole-aurore (le 20 octobre 2026 : « peins-la ici »,
  // le propriétaire, parmi les pistes proposées) : l'ombre des trois autres
  // attend encore sa règle. Pas féroce — elle s'envole vers nous, émerveillée,
  // et reste ronde. Ses voiles d'aurore sont translucides : sa découpe les rend
  // opaques, sinon le magenta les teinterait comme les ailes de l'adulte. Et
  // elle nomme les rideaux d'aurore qui pendent sous ses ailes : la première
  // les avait pris pour elles, une jupe violacée à bord dur sous la luciole.
  eclats: {
    aurore: {
      nom: 'La luciole-aurore',
      voie: 'lumiere',
      consigne: METAMORPHOSE(
        'its round, plush amber body, its lantern belly glowing golden-green, its big gentle eyes with star-shaped highlights, its two long ' +
          'curling antennae with glowing tips',
        'It becomes the spirit of the northern lights: its stained-glass wings turned into immense flowing veils of aurora borealis — luminous ' +
          'ribbons of emerald, teal, cyan and pale gold light rippling out from its back across the sky; frost and aurora glints shimmering in its ' +
          'amber fuzz; its lantern belly blazing like a small white-gold sun; its swarm of tiny fireflies turned into sparks of aurora light ' +
          'swirling around it. Its scene: a deep polar night over a still mountain lake that mirrors the sky, dark pine forests and snowy peaks, ' +
          'the whole sky alive with curtains of green and cyan aurora.',
        'It soars straight toward the viewer, seen from the front, its aurora wings spread wide open, antennae streaming, eyes wide and shining ' +
          'with wonder, a small serene smile — majestic and radiant, yet still round and cute.',
        'magenta',
      ),
      garde:
        'the aurora firefly — its head, antennae, round body, tiny legs, blazing lantern belly and its two great wings: the long flowing veils ' +
        'of aurora light that spread up and out from its back',
      retirer:
        'the night sky, the stars, the vertical curtains of aurora hanging in the sky below and between its wings, the small spirals and ' +
        'sparks of light, the lake, the pine forests and the snowy peaks',
      opaque: 'its two wings (veils of emerald, teal, cyan and pale gold light)',
      chroma: 'magenta',
      entier: true,
    },
  },
  vivant: [
    {
      cle: 'lucioles',
      mode: 'lumiere',
      consigne: 'a drifting swarm of tiny glowing fireflies, soft golden-green points of light of different sizes, spread around the frame, the center left empty',
    },
  ],
}

/**
 * Le panda roux : choisi par le propriétaire le 20 octobre 2026 sur le candidat 2 de ses essais
 * (`export/compagnons/panda/candidats/`), d'après son prompt — un bébé tout rond, le poil roux
 * épais, les yeux ambrés immenses. Les couleurs de son pelage ne portent ni vert ni magenta : le
 * fond vert des découpes, comme pour le loup. Ses métamorphoses attendent le choix du propriétaire.
 */
const PANDA: Compagnon = {
  id: 'panda',
  reference: true,
  identite:
    'Its identity never changes from one age to the next: a rich, plush reddish-orange coat; a cream-white face with a soft white muzzle, ' +
    'two small cream-white brow spots above the eyes and big cream-white cheek patches; small rounded ears with soft white fur outside and ' +
    'russet inside; big sparkling amber eyes with several catchlights; a small heart-shaped dark-brown nose; dark russet chest and legs; a ' +
    'fluffy tail ringed in rust-red and pale apricot bands. It must look like a red panda, never a giant panda or a fox. At EVERY age it keeps ' +
    'the eyes of the baby: large, round, wide-open amber eyes with several soft catchlights, a tender and innocent gaze — only a little smaller ' +
    'against the face as it grows, never small, beady or realistic animal eyes. The rendering is the same at every age: stylized, soft, ' +
    'premium 3D animated film — appealing rounded shapes and plush fur, never photorealistic, never a painterly illustration.',
  ages: [
    'a tiny baby red panda sitting shyly, tiny and fluffy, with an oversized round head, chubby cheeks, tiny rounded ears and its paws resting ' +
      'together, its striped tail curled around its little body',
    'a half-grown young red panda, visibly younger and smaller than the adult — a slimmer, lanky body on longer legs, bigger ears, a slightly ' +
      'longer snout, still fluffy juvenile fur, a round curious face and a tail still too big for it',
    'the adult red panda, sleek, graceful and calm, with a full bushy ringed tail',
    'its mythic ultimate form — larger and majestic, its fur glowing like autumn embers lit from within, golden light tracing the rings of its ' +
      'great tail, drifting glowing maple leaves of gold and crimson all around it',
  ],
  formes: [
    { id: 'bebe', garde: 'the baby red panda' },
    {
      id: 'jeune',
      decor: 'a bamboo grove and mossy rocks in morning mist, soft golden sunbeams between the stems, a few leaves drifting down',
      taille: 'It is still small: it fills only about 55% of the canvas height, with plenty of setting around it.',
      garde: 'the young red panda — its head, ears, body, legs, paws and tail',
      retirer: 'the bamboo, the rocks, the mist, the sunbeams, the drifting leaves and the sky',
    },
    {
      id: 'adulte',
      decor: 'a thick mossy branch of an ancient tree high in a misty mountain forest at golden hour, fiery maple trees glowing far below',
      deborde: 'its raised head and pricked ears',
      garde: 'the red panda — its head, ears, body, legs, paws and tail',
      retirer: 'the branch, the moss, the trees, the mist and the sky',
    },
    {
      id: 'erable',
      entier: true,
      decor: 'a sea of crimson and golden maple trees under an immense amber sunset sky, glowing leaves rising in the warm air',
      garde: 'the great red panda with the glowing maple leaves swirling right around it',
      retirer: 'the sky, the maple trees, the sunset and the distant leaves',
    },
  ],
  // La queue ne bouge pas : une queue levée laissait celle de l'illustration enroulée devant le corps,
  // et le panda en avait deux (le bébé ravi, l'ultime triomphant ; le 20 octobre 2026).
  expressions: {
    ravi:
      'JOYFUL — bright smiling eyes, mouth open in a happy little smile, chubby cheeks lifted, ears perked up. Its tail stays exactly where it ' +
      'is and as it is: it has ONE tail — never lift, add or duplicate it',
    depite:
      'DISAPPOINTED, in a cute and gentle way, never tragic — ears folded down, head a little lowered, big sad eyes looking up, mouth closed ' +
      'in a small pout',
    triomphe:
      'TRIUMPHANT — chest puffed out, head held high, mouth open in a proud joyful squeak, ears up, one front paw raised. Its tail stays exactly ' +
      'where it is and as it is: it has ONE tail — never lift, add or duplicate it',
  },
  // Deux métamorphoses vivantes, jamais figées (le propriétaire, le 20 octobre 2026 : « un avatar vivant,
  // extrêmement majestueux, ou en action ») : l'une avance, l'autre se dresse. Un seul panda, une seule
  // queue — la première version du triomphe en avait deux, sa queue levée et celle de l'illustration.
  eclats: {
    aurore: {
      nom: 'Le panda d’aurore',
      voie: 'lumiere',
      consigne: METAMORPHOSE(
        'its rich reddish-orange plush coat, its cream-white face markings, its big round amber eyes, its small rounded ears, its single fluffy ringed tail',
        'It becomes the spirit of the first dawn: its fur woven of sunrise gold and rose-quartz light, glowing from within, its single great ringed tail ' +
          'streaming behind it like a long banner of golden fire and drifting cherry-blossom petals of light; golden mist curling around its paws. ' +
          'Its scene: a mountain ridge above a sea of clouds at the instant the sun rises, the whole sky ablaze in gold, coral and soft pink. ' +
          'It has exactly ONE tail.',
        'It is in full motion, never posed: it strides powerfully toward the viewer along the ridge, seen from the front, one front paw stepping ' +
          'forward, its fur and mane of cheek-fur lifted by the wind, head held high, its big luminous eyes shining with a calm, proud, tender ' +
          'majesty — a guardian spirit of the morning, still round-faced and lovable.',
        'vert',
      ),
      garde: 'the dawn panda with its single streaming ringed tail of golden light',
      retirer: 'the mountain ridge, the clouds, the sky, the sun, the mist and the petals of light around it',
      opaque: 'its streaming golden tail and the glowing light of its fur',
      chroma: 'vert',
      entier: true,
      expressions: {
        triomphe: 'TRIUMPHANT — chest out, head thrown back, mouth open in a proud joyful cry, its single tail blazing high behind it',
      },
    },
    lune: {
      nom: 'Le panda de lune',
      voie: 'ombre',
      consigne: METAMORPHOSE(
        'its plush coat, its cream-white face markings, its big round eyes, its small rounded ears, its single fluffy ringed tail',
        'It becomes a moon spirit of the night forest: its fur turned deep midnight blue and silver, its face markings glowing like moonlight, its ' +
          'big eyes shining pale silver-blue, its single great ringed tail trailing soft silver-blue flames and black maple leaves; fireflies of ' +
          'cold light drift around it. Its scene: a vast night sky with an immense full moon, a misty black forest and a ' +
          'moonlit stone cliff. It has exactly ONE tail.',
        'It is in full motion, never posed: it rears up powerfully on its hind legs on the cliff edge, its front paws spread wide, chest out, head ' +
          'raised and turned toward us with an intense, fearless, majestic gaze, its fur and tail swept by a night wind — a king of the night, ' +
          'still round-faced and lovable.',
        'vert',
      ),
      garde: 'the moon panda with its single tail trailing silver-blue flames and the black leaves around its body',
      retirer: 'the sky, the moon, the cliff, the forest, the mist and the distant fireflies',
      chroma: 'vert',
      entier: true,
      expressions: {
        ravi: 'GLEEFUL — its intense gaze turns into a wide delighted smile, eyes bright and happy instead of fierce — still a majestic spirit, just thrilled',
      },
    },
  },
  vivant: [
    {
      cle: 'feuilles',
      mode: 'lumiere',
      consigne:
        'drifting glowing maple leaves of gold and crimson and tiny floating sparks of warm amber light, like a gentle autumn wind forming a loose ring around the frame, the center left empty',
    },
  ],
}

const COMPAGNONS: Compagnon[] = [LOUP, CHAT, TORTUE, LUCIOLE, PANDA]

const FEUILLE = (c: Compagnon, style: string) =>
  [
    'Character model sheet for an original collectible companion of a party quiz game: ONE animal shown at four ages, side by side from left ' +
      'to right, evenly spaced, each full body in a three-quarter view facing slightly left, on one plain light grey background — no ground, no scenery.',
    `From left to right: 1) ${c.ages[0]}; 2) ${c.ages[1]}; 3) ${c.ages[2]}; 4) ${c.ages[3]}.`,
    ...(c.reference
      ? [
          'The attached image is the validated portrait of this companion as a baby. The first (youngest) age must be exactly this individual — ' +
            'the same face, markings, eyes, nose, ears, proportions, fur colors and rendering — shown here sitting full body, in a three-quarter ' +
            'view. The three other ages are the same individual, grown.',
        ]
      : []),
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
  const chroma = f.chroma ?? 'vert'
  const cadrage = !f.decor
    ? 'Sitting, its whole body visible, centered, filling about 70% of the canvas height, well away from the edges. ' +
      `Background: ${fondUni(chroma)}. Draw nothing behind it — no ground, no scenery, no glow: only the flat background color. ` +
      `Do not use any ${CHROMAS[chroma].proscrit} on the animal.`
    : `Setting: ${f.decor}. The setting fills the whole canvas edge to edge behind it. ` +
      (f.entier
        ? `Framing: ${f.garde}, large, spreading toward all four edges of the canvas — this form overflows its round frame on every side — ` +
          'while everything stays inside the canvas with a small margin; the setting shows behind and between them.'
        : f.deborde
          ? `Framing: the animal large and centered, in the lower part of the canvas; ${f.deborde} rise high, up into the top band of the ` +
            'canvas close to the top edge — that is what this form is about. Its body stays well inside the canvas.'
          : 'Framing: the animal centered, its head, ears, paws and tail well inside the canvas and away from the four corners, which will be cut off.') +
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

/** Ce que l'on peint : l'essai des styles, ou, un style choisi, tout le compagnon et l'essai de ses métamorphoses. */
function travaux(c: Compagnon, style: string | undefined, eclats: string[]): Travail[] {
  if (!style) return Object.entries(STYLES).map(([cle, s]) => ({ nom: `feuille-${cle}`, consigne: FEUILLE(c, s.consigne), sources: [], format: '16:9' }))
  const s = STYLES[style]
  if (!s) throw new Error(`--style=${style} : pas un style de l'essai (${Object.keys(STYLES).join(', ')})`)
  // Un style déjà choisi n'a plus d'essai : sa planche de modèle se peint seule,
  // la première, pour un compagnon qui n'en a pas encore.
  const feuille = `feuille-${style}`
  const t: Travail[] = [{ nom: feuille, consigne: FEUILLE(c, s.consigne), sources: c.reference ? ['reference'] : [], format: '16:9' }]
  c.formes.forEach((f, i) => {
    t.push({ nom: f.id, sources: [feuille], consigne: consigneDeForme(c, i, s.consigne) })
    if (f.decor) {
      t.push({ nom: `${f.id}-decor`, sources: [f.id], consigne: DECOR_SEUL(f.garde) })
      t.push({ nom: `${f.id}-decoupe`, sources: [f.id], consigne: DECOUPE(f.garde, f.retirer ?? 'the setting', f.chroma ?? 'vert', f.opaque) })
    }
  })
  for (const f of c.formes) {
    const base = f.decor ? `${f.id}-decoupe` : f.id
    for (const e of Object.keys(EXPRESSIONS) as Expression[]) {
      t.push({ nom: `${f.id}-${e}`, sources: [base], consigne: EXPRESSION(c.expressions?.[e] ?? EXPRESSIONS[e], f.chroma ?? 'vert') })
    }
  }
  const ultime = c.formes[3].id
  if (c.bond) t.push({ nom: 'bond', sources: [`${ultime}-decoupe`], consigne: c.bond })
  for (const v of c.vivant ?? []) t.push({ nom: `${ultime}-vivant-${v.cle}`, sources: [ultime], consigne: VIVANT(v) })
  // Les métamorphoses : chacune son illustration, pour choisir ; celles qu'on
  // garde (`--eclat=`), leur décor seul, leur découpe et leurs expressions.
  if (eclats.some(x => !(x in c.eclats))) throw new Error(`--eclat=${eclats.join(',')} : pas une métamorphose (${Object.keys(c.eclats).join(', ')})`)
  for (const [cle, e] of Object.entries(c.eclats)) {
    const nom = `eclat-${cle}`
    t.push({ nom, sources: [ultime], consigne: e.consigne })
    if (!eclats.includes(cle)) continue
    t.push({ nom: `${nom}-decor`, sources: [nom], consigne: DECOR_SEUL(e.garde) })
    t.push({ nom: `${nom}-decoupe`, sources: [nom], consigne: DECOUPE(e.garde, e.retirer, e.chroma, e.opaque) })
    for (const x of Object.keys(EXPRESSIONS) as Expression[]) {
      const quoi = e.expressions?.[x] ?? c.expressions?.[x] ?? EXPRESSIONS[x]
      t.push({ nom: `${nom}-${x}`, sources: [`${nom}-decoupe`], consigne: EXPRESSION(quoi, e.chroma) })
    }
  }
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

/** Ces images, et tout ce qui part d'elles. */
function etCeQuiEnPart(noms: string[], tous: Travail[]): Set<string> {
  const s = new Set(noms)
  for (let ajoute = true; ajoute; ) {
    ajoute = false
    for (const t of tous) {
      if (!s.has(t.nom) && t.sources.some(x => s.has(x))) {
        s.add(t.nom)
        ajoute = true
      }
    }
  }
  return s
}

// Une machine qui n'a que l'archive d'un compagnon — ses illustrations et son
// dossier `app`, sans ses découpes ni ses humeurs brutes — repeindrait tout ce
// qui lui manque, et autrement : `--seulement=` n'y peint que ces images et ce
// qui part d'elles. La luciole-aurore (le 20 octobre 2026) s'est peinte ainsi,
// d'après la seule luciole-constellation de `luciole-peinte/`.
const TOUS = travaux(compagnon, STYLE, ECLATS)
const inconnues = liste('seulement').filter(n => !TOUS.some(t => t.nom === n))
if (inconnues.length) throw new Error(`--seulement=${inconnues.join(',')} : pas une image de la chaîne (${TOUS.map(t => t.nom).join(', ')})`)
// `--exactement` : seulement ces images, sans ce qui en part — pour juger les quatre formes avant de payer leurs découpes.
const seulement = liste('seulement').length ? (args.includes('--exactement') ? new Set(liste('seulement')) : etCeQuiEnPart(liste('seulement'), TOUS)) : null
const TRAVAUX = seulement ? TOUS.filter(t => seulement.has(t.nom)) : TOUS

// Ce qu'on repaie, et tout ce qui part de lui : une découpe repeinte change la
// place des expressions qui en partent.
const aRepayer = etCeQuiEnPart(liste('regenerer'), TRAVAUX)
for (const nom of aRepayer) mettreDeCote(nom)

// ── Le journal ────────────────────────────────────────────────────────────

const cheminJournal = path.join(racine, 'journal-compagnons.json')
const lireJournal = (): any[] => (existsSync(cheminJournal) ? JSON.parse(readFileSync(cheminJournal, 'utf8')) : [])
const depense = () => lireJournal().reduce((n, e) => n + (e.cout ?? 0), 0)

function ranger(nom: string, r: Rendu) {
  writeFileSync(fichier(`${nom}.${formatDe(r.image).ext}`), r.image)
  const journal = lireJournal()
  const cout = coutEstime(r.jetons, { modele: MODELE })
  journal.push({ compagnon: compagnon!.id, nom, date: new Date().toISOString(), modele: MODELE, taille: TAILLE, jetons: r.jetons, cout })
  writeFileSync(cheminJournal, JSON.stringify(journal, null, 2) + '\n')
  console.log(`  ${nom} : environ ${cout.toFixed(3)} $ en ${r.secondes.toFixed(0)} s (total ${depense().toFixed(2)} $)`)
}

/**
 * Une image, sans arrêter les autres : celle qui échoue se redemande à la
 * passe suivante. Rend vrai quand Google a refusé pour le débit (429) : un
 * plafond de dépense par minute, que deux compagnons peints d'affilée ont
 * atteint, et que six passes redemandées dans la même seconde ne levaient pas.
 */
async function peindre(t: Travail): Promise<boolean> {
  writeFileSync(fichier(`consigne-${t.nom}.txt`), t.consigne + '\n')
  const parties: Partie[] = [...t.sources.map(s => enPartie(existant(s)!)), { text: t.consigne }]
  try {
    ranger(t.nom, await generer(parties, { modele: MODELE, taille: TAILLE, format: t.format }))
    return false
  } catch (e) {
    const message = (e as Error).message
    console.log(`  ✗ ${t.nom} : ${message.slice(0, 300)}`)
    return message.includes('HTTP 429')
  }
}
const pause = (ms: number) => new Promise(ok => setTimeout(ok, ms))

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
  let freine = false
  await Promise.all(
    Array.from({ length: Math.min(EN_MEME_TEMPS, file.length) }, async () => {
      for (let t = file.shift(); t; t = file.shift()) freine = (await peindre(t)) || freine
    }),
  )
  if (freine) {
    console.log('  Google freine : une minute de pause avant la passe suivante')
    await pause(60_000)
  }
}
const manquent = TRAVAUX.filter(t => !existant(t.nom)).map(t => t.nom)
if (manquent.length) console.log(`Manquent encore : ${manquent.join(', ')}`)

// ── La planche : les fichiers tels que l'application les poserait ────────
// Pour 100 unités du disque, comme les portraits (`portraits.ts`, `Portrait.tsx`) :
// la part de l'image que couvre le disque, et le cadre du personnage — le
// carré, ou plus large quand il en sort.

/** La part de la largeur de l'image que couvre le carré du disque, forme par forme (la première, puis les trois du décor). */
export const DISQUE = [0.94, 0.92, 0.76, 0.84]
/** Le cadre du personnage dans le repère du disque (origine, côté), forme par forme. */
export const CADRE: [number, number][] = [[0, 100], [0, 100], [-20, 140], [-20, 140]]
/**
 * Une forme ou une métamorphose entière : le disque ne prend que le centre de
 * l'image (70 %), et ce qu'elle garde, peint immense, en sort de tous côtés —
 * son cadre couvre toute l'image (de −21,4 à 121,4 unités du disque). À 62 %,
 * le loup-tempête cachait son disque tout entier : on ne voyait plus qu'il en
 * sortait.
 */
export const ECLAT_ENTIER = { disque: 0.7, cadre: [-22, 144] as [number, number] }

/** Le disque et le cadre d'une forme (`adulte`), ou d'une métamorphose (`eclat-tempete`). */
function cadrageDe(id: string): { disque: number; cadre: [number, number] } {
  const eclat = id.startsWith('eclat-') ? compagnon!.eclats[id.slice('eclat-'.length)] : undefined
  if (eclat) return eclat.entier ? ECLAT_ENTIER : { disque: DISQUE[3], cadre: CADRE[3] }
  const rang = compagnon!.formes.findIndex(f => f.id === id)
  if (compagnon!.formes[rang]?.entier) return ECLAT_ENTIER
  return { disque: DISQUE[rang], cadre: CADRE[rang] }
}
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
  const illustrations = new RegExp(`^(feuille-[a-z0-9]+|${compagnon.formes.map(f => f.id).join('|')}|eclat-[a-z]+|bond)\\.(png|jpg|webp)$`)
  for (const f of readdirSync(sortie).filter(f => illustrations.test(f))) {
    const nom = f.replace(/\.[a-z]+$/, '')
    poser(`apercu-${nom}`, await dansLaPage<string>(page, 'reduireA', enDataUrl(fichier(f)), nom.startsWith('feuille') ? 1280 : 768, QUALITE))
  }

  // Le monde vivant de la forme ultime : la lumière garde son noir — la page
  // la pose en `screen`, qui l'efface —, le reste se détoure.
  for (const v of compagnon.vivant ?? []) {
    const nom = `${compagnon.formes[3].id}-vivant-${v.cle}`
    const src = existant(nom)
    if (!src) continue
    const image = v.mode === 'lumiere' ? enDataUrl(src) : (await dansLaPage<any>(page, 'detourer', enDataUrl(src), null, CHROMAS[v.chroma ?? 'vert'].rvb)).plein
    poser(nom, await dansLaPage<string>(page, 'reduireA', image, 768, QUALITE))
    console.log(`  ${nom} : ${v.mode === 'lumiere' ? 'lumière' : 'détouré'}`)
  }

  const expressions = ['neutre', ...Object.keys(EXPRESSIONS)] as const
  const formes = [
    ...compagnon.formes.map(f => ({ id: f.id, decor: !!f.decor, chroma: f.chroma ?? ('vert' as Chroma) })),
    ...Object.entries(compagnon.eclats).map(([cle, e]) => ({ id: `eclat-${cle}`, decor: true, chroma: e.chroma })),
  ]
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
    const { disque, cadre } = cadrageDe(f.id)
    let place = { s: 1, dx: 0, dy: 0, ecart: 0 }
    if (f.decor) {
      const decor = existant(`${f.id}-decor`)
      if (decor) poser(`${f.id}-disque`, await dansLaPage<string>(page, 'disqueDe', enDataUrl(decor), disque, 512, QUALITE))
      place = await dansLaPage<any>(page, 'aligner', enDataUrl(existant(f.id)!), neutre.plein)
    }
    for (const e of expressions) {
      const src = e === 'neutre' ? base : existant(`${f.id}-${e}`)
      if (!src) continue
      const d = e === 'neutre' ? neutre : await dansLaPage<any>(page, 'detourer', enDataUrl(src), null, rvb)
      const deplace = await dansLaPage<string>(page, 'deplacer', d.plein, place.s, place.dx, place.dy)
      const r = await dansLaPage<any>(page, 'assembler', { image: deplace, disque, cadre, tailles: [512], qualite: QUALITE })
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
