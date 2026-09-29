// Les consignes des portraits en images : ce que Nano Banana dessine, branche
// par branche et palier par palier. Des données seulement — `styles.ts` (le
// premier essai, une forme ultime par branche) et `portraits.ts` (les
// soixante-douze) les lisent sans rien exécuter.
//
// En anglais : les modèles d'image suivent mieux leurs mots de style dans
// cette langue. Aucun nom d'artiste, de studio ni d'œuvre : des techniques et
// des époques. Le sujet reprend l'identité du portrait d'aujourd'hui (ses
// couleurs, ses accessoires) ; le palier dit ce qu'il gagne (l'échelle de
// « La montée en puissance ») ; la branche dit comment sa technique monte
// avec lui — plus d'encres, plus de facettes, plus de pixels.

/** Le fond qu'on détoure : un vert, sauf pour les sujets qui en portent. */
export type Chroma = 'vert' | 'magenta'

export const CHROMAS: Record<Chroma, { hex: string; nom: string }> = {
  vert: { hex: '#00FF00', nom: 'chroma-key green' },
  magenta: { hex: '#FF00FF', nom: 'chroma-key magenta' },
}

export interface StyleDeBranche {
  /** Le style, tel qu'on le dit à l'utilisateur. */
  nom: string
  /** La technique, pour Nano Banana. */
  style: string
  /**
   * Comment la technique monte, du premier palier au cinquième : le sixième
   * est la forme ultime de l'essai, validée telle quelle.
   */
  echelle: [string, string, string, string, string]
  /** La forme ultime, telle que l'essai des styles l'a demandée. */
  ultime: string
  /** Ce que la découpe de la forme ultime garde : le reste devient fond. */
  ultimeGarde: string
  /** Le fond de la découpe de la forme ultime. */
  ultimeChroma: Chroma
}

export const STYLES: Record<string, StyleDeBranche> = {
  monde: {
    nom: 'L’affiche de voyage des années 30',
    style:
      'Style: a 1930s travel poster printed in lithography — flat color planes, a limited palette of inks plus a metallic gold ink, visible paper grain ' +
      'and slight ink misregistration, bold simplified shapes, a radiating sun and a stylized landscape.',
    echelle: [
      'Print it with two inks only on cream paper: two flat colors, bold simple shapes, no gradient.',
      'Print it with three inks, and a simple landscape behind.',
      'Print it with four inks; sun rays begin to radiate behind.',
      'Print it with five inks, in strong contrast, a glowing sun behind.',
      'Print it with six inks and a first touch of metallic gold.',
    ],
    ultime:
      'Subject: the red panda, as the mascot of the Himalayas: standing proudly on a mossy branch above misty mountains and a valley of pagoda roofs at sunrise, ' +
      'its bushy ringed tail curling around it, its round face with white markings, one paw raised to greet the traveler; golden sun rays burst behind it.',
    ultimeGarde: 'the red panda',
    ultimeChroma: 'vert',
  },
  mythes: {
    nom: 'L’anime',
    style:
      'Style: polished modern Japanese anime illustration, like a key visual of a high-budget anime series — clean, confident dark line art with tapered strokes ' +
      'and varied line weight, cel shading with crisp two-tone shadows and a soft third tone, smooth gradients on skin, hair and metal, bright specular highlights, ' +
      'large expressive eyes with sharp catchlights, vivid saturated colors. An original character: imitate no existing anime or game character.',
    echelle: [
      'Keep it simple: clean line art, flat cel colors, soft shading.',
      'Cel shading, with a painted anime background behind.',
      'Two-tone cel shading, dynamic line work, the first sparks of energy.',
      'Dramatic lighting, glowing eyes, rich highlights.',
      'The finish of a key visual; energy effects burst out.',
    ],
    ultime:
      'Subject: Athena, goddess of wisdom and war: three-quarter view facing left, on guard behind a round golden shield bearing an owl emblem, her spear raised high ' +
      'toward the upper left with golden lightning crackling from its tip; a golden Corinthian helmet with a long crimson horsehair crest streaming in the wind, ' +
      'long dark brown hair and a crimson cape whipping to the right, large golden owl wings spread behind her shoulders, glowing cyan eyes, a fierce focused ' +
      'expression, golden embers; a stormy night sky with a golden glory of light behind her head.',
    ultimeGarde: 'Athena with her helmet, spear, shield and wings',
    ultimeChroma: 'vert',
  },
  oceans: {
    nom: 'L’estampe japonaise',
    style:
      'Style: a Japanese ukiyo-e woodblock print — bold confident outlines, flat colors with soft bokashi gradients, Prussian blue and indigo, ' +
      'stylized curling waves with claw-like foam, visible washi paper texture and wood grain, a hint of sparkling mica powder.',
    echelle: [
      'A simple two-block print: black outlines and one flat color on washi paper.',
      'Three blocks, and a simple sea pattern behind.',
      'Soft bokashi gradients and curling waves.',
      'A deep Prussian-blue night and glowing highlights.',
      'Foam claws and spray burst out, with a hint of sparkling mica.',
    ],
    ultime:
      'Subject: the narwhal, bursting out of a towering curling wave, its long spiral tusk glowing and pointing to the sky, water spiraling around it, ' +
      'bioluminescent plankton sparkling like stars in the spray, a full moon behind.',
    ultimeGarde: 'the narwhal',
    ultimeChroma: 'vert',
  },
  espace: {
    nom: 'La SF pulp des années 50',
    style:
      'Style: a 1950s pulp science-fiction paperback cover painted in gouache — bold saturated colors (cobalt, teal, tangerine, lemon yellow), glossy chrome highlights, ' +
      'dramatic rim lighting, a subtle halftone print texture and aged paper grain, retro-futurist design.',
    echelle: [
      'A simple two-color print with a coarse halftone.',
      'Three colors, and a planet behind.',
      'Full gouache colors and the first glossy highlights.',
      'Dramatic rim lighting, chrome reflections, glowing rays.',
      'Rays and plasma burst out.',
    ],
    ultime:
      'Subject: the astronaut, in a rounded retro spacesuit with a big glass bubble helmet reflecting the Earth, launched through space with one arm outstretched, ' +
      'a jetpack at full thrust leaving a glowing plasma trail, ringed planets and stars behind.',
    ultimeGarde: 'the astronaut with his jetpack',
    ultimeChroma: 'vert',
  },
  foret: {
    nom: 'Le papier découpé',
    style:
      'Style: a layered paper-cut diorama — built from cut paper sheets stacked in depth, each layer a flat color with clean cut edges ' +
      'and soft drop shadows between layers, a subtle paper fiber texture, warm light glowing through the gaps, forest greens, moss, amber and cream.',
    echelle: [
      // L'écureuil revenait deux fois dans des anneaux de papier : un visage n'a pas de cadre.
      'A single layer of cut paper: flat, one color and a few cut details — the subject alone, with no circles, rings or frames of paper around it.',
      'Two or three paper layers, simple trees behind.',
      'Four layers with soft shadows between them.',
      'Many layers, warm light glowing through the gaps.',
      'A deep diorama whose front layers of leaves and branches spill out.',
    ],
    ultime:
      'Subject: the stag, standing tall in a deep forest clearing, its huge antlers sprouting glowing leaves and blossoms, head raised in a mighty bellow, ' +
      'a storm of paper leaves swirling around it, sunbeams piercing the layered trees.',
    ultimeGarde: 'the stag with its leafy antlers',
    ultimeChroma: 'magenta',
  },
  ecran: {
    nom: 'L’affiche de cinéma, du noir et blanc au Technicolor',
    style:
      'Style: a hand-painted classic movie poster — glamorous and cinematic, dramatic spotlight lighting, soft painterly brushwork, film grain.',
    echelle: [
      'A grainy black-and-white film still, silent-movie look: no color at all.',
      'Black and white with a sepia tint, and a painted film set behind.',
      'Early two-color film: muted reds and teals only.',
      'Faded color film with one strong color accent, under a dramatic spotlight.',
      'Rich color film, glamorous lighting, film grain.',
    ],
    ultime:
      'Subject: the movie star, caught mid-leap in slow motion under a blazing spotlight, film reel ribbons unfurling around her, a lens flare, ' +
      'sequins sparkling, camera flashes blurred in the dark behind.',
    ultimeGarde: 'the movie star (her dress, boa and sunglasses)',
    ultimeChroma: 'vert',
  },
  scene: {
    nom: 'Le pop art',
    style:
      'Style: 1960s pop art — bold black outlines, flat primary colors (red, yellow, cyan, magenta), Ben-Day halftone dots, graphic comic-book shading, high contrast.',
    echelle: [
      'A simple pop-art portrait: black outlines and two flat primary colors.',
      'Ben-Day dots and a flat colored background.',
      'Bold halftone shading and the first sound lines.',
      'High-contrast colors, radiating rays, glowing accents.',
      'Musical notes and sound waves burst out.',
    ],
    ultime:
      'Subject: the orchestra conductor, both arms raised high, the baton at the end of a sweeping gesture, tailcoat flaring, hair flying, ' +
      'a storm of musical notes and sound waves bursting from the baton, stage lights behind.',
    ultimeGarde: 'the conductor with his baton',
    ultimeChroma: 'vert',
  },
  contes: {
    nom: 'Le livre de contes, plume et aquarelle',
    style:
      'Style: a golden-age children’s storybook illustration — delicate pen-and-ink linework with warm watercolor washes, soft paper texture, ' +
      'whimsical and magical, with firm ink outlines on the main shapes so it stays readable.',
    echelle: [
      'A simple pen-and-ink drawing with a single pale watercolor wash.',
      'Watercolor washes and a small vignette of its world behind.',
      'Richer washes, lively ink lines, small decorative details.',
      'A warm magical glow in luminous watercolor.',
      'An illuminated storybook page whose ornaments and pages fly out.',
    ],
    ultime:
      'Subject: the griffin — eagle head and wings, lion body — diving from the sky with its wings spread wide, feathers turning into flying book pages, ' +
      'ink splashing like stars, a fairytale castle and rolling hills far below.',
    ultimeGarde: 'the griffin',
    ultimeChroma: 'vert',
  },
  stade: {
    nom: 'Le low poly',
    style:
      'Style: low-poly 3D art — every surface, skin, hair and clothes included, is made of crisp geometric facets, each facet a flat color with a subtle gradient, ' +
      'clean sharp edges, a vivid palette, dynamic motion trails made of triangles, soft studio lighting.',
    echelle: [
      'Very low poly: a few dozen large flat facets.',
      'About two hundred facets, and a simple faceted background.',
      'About five hundred facets; motion trails begin.',
      'About a thousand facets under dramatic studio lighting.',
      'About two thousand crisp facets; faceted motion trails burst out.',
    ],
    ultime:
      'Subject: the prima ballerina, suspended mid grand jeté with her legs in a full split, arms elegantly extended, tutu flaring, ' +
      'ribbons of stars trailing behind her movement, under a stage spotlight.',
    ultimeGarde: 'the ballerina',
    ultimeChroma: 'vert',
  },
  brigade: {
    nom: 'La pâte à modeler',
    style:
      'Style: claymation — everything is sculpted from modeling clay with visible fingerprints and tool marks, soft rounded shapes, slightly glossy surfaces, ' +
      'warm studio lighting with soft shadows, the feel of a miniature stop-motion set.',
    echelle: [
      'A simple clay figure with few details.',
      'A small clay kitchen set behind.',
      'Props and action, flour or crumbs flying.',
      'Warm oven light and rising steam.',
      'Clay steam, flour clouds or flames spill out.',
    ],
    ultime:
      'Subject: the chef, a jolly cook in a tall white toque flipping a pan high, a dragon made of clay flames rising from the pan, ' +
      'knives and vegetables flying in the air, a cozy kitchen set behind.',
    ultimeGarde: 'the chef, his pan and the clay flame dragon',
    ultimeChroma: 'vert',
  },
  arcade: {
    nom: 'Le pixel art',
    style:
      'Style: pixel art — a crisp pixel grid with no anti-aliasing, a limited palette, shading with dithering, like a video game sprite portrait.',
    echelle: [
      '8-bit pixel art on a coarse 32 × 32 pixel grid, with four colors.',
      '8-bit pixel art on a 48 × 48 pixel grid, with eight colors.',
      '16-bit pixel art on a 64 × 64 pixel grid, with sixteen colors and dithering.',
      '16-bit pixel art on a 96 × 96 pixel grid, with pixel lighting and glow.',
      'Detailed pixel art on a 128 × 128 pixel grid; pixel effects burst out.',
    ],
    ultime:
      'Subject: the knight, leaning forward with his hand on the hilt, the instant before drawing his sword, crackling lightning around him, eyes glowing ' +
      'under the helmet visor, a cape billowing, scattered pixel sparks.',
    ultimeGarde: 'the knight and his sword',
    ultimeChroma: 'vert',
  },
  carnaval: {
    nom: 'L’art déco',
    style:
      'Style: Art Deco — elegant geometric design in black, ivory and metallic gold with jewel-tone accents (emerald, ruby), sunburst rays, ' +
      'stepped patterns and fan shapes, sleek stylized figures, the glamour of a 1920s party.',
    echelle: [
      // Le noir et l'ivoire seuls faisaient de la piñata un zèbre, et « un
      // portrait art déco » l'encadrait comme une affiche : ni l'un ni l'autre.
      'Simple Art Deco styling: bold geometric shapes, black, ivory, gold and a few jewel tones — no frame, border, panel or rays around the subject.',
      'Black, ivory and a touch of gold, a geometric pattern behind.',
      'Gold lines, fan shapes, a first sunburst.',
      'Metallic gold light, jewel-tone accents, a glamorous shine.',
      'Gold rays, fans and confetti burst out.',
    ],
    ultime:
      'Subject: the Venetian mask, worn by a masked dancer in a mid-spin volte, rapier extended, cape spread wide, the ornate feathered Venetian mask ' +
      'shining in gold, confetti and fireworks bursting behind.',
    ultimeGarde: 'the masked dancer with her rapier and cape',
    ultimeChroma: 'magenta',
  },
}

/** Ce que chaque palier ajoute, pour toutes les branches : l'échelle de « La montée en puissance ». */
export const PALIERS: [string, string, string, string, string] = [
  'Tier 1 of 6 — the face: a calm, front-facing head-and-shoulders portrait of the subject alone, looking at the viewer. No setting, no effect: ' +
    'the simplest avatar of its series, yet carefully drawn.',
  'Tier 2 of 6 — the setting: a calm head-and-shoulders portrait, now with its own place painted behind it.',
  'Tier 3 of 6 — the gesture: a three-quarter view, the subject doing something characteristic, a first touch of energy.',
  'Tier 4 of 6 — the light: dramatic backlight and rim light, strong shadows, glowing eyes or a glowing signature item, richer detail than the tiers below.',
  'Tier 5 of 6 — the overflow: a powerful pose, and the subject breaks out of its frame at the top.',
]

export interface SujetDePortrait {
  /** Qui il est, et ce qu'il fait à son palier. */
  sujet: string
  /** Au cinquième palier : ce qui sort du cadre par le haut. */
  deborde?: string
  /** Le fond de sa découpe : magenta quand il porte du vert. */
  chroma?: Chroma
  /**
   * Ce que sa découpe garde, quand « lui, avec tout ce qu'il porte et tient »
   * ne suffit pas : la planche du surfeur est sous ses pieds, les balles de
   * l'arlequin en l'air.
   */
  garde?: string
  /**
   * Ce que sa découpe doit retirer, nommé : dit dans ce qu'elle garde
   * (« le blaireau seul, sans son terrier »), le modèle gardait le terrier ;
   * dit comme un fond à repeindre, il l'enlève.
   */
  retirer?: string
}

/** Les cinq premiers portraits de chaque branche : la forme ultime a son essai (`STYLES`). */
export const SUJETS: Record<string, SujetDePortrait> = {
  'br:kangourou': { sujet: 'the kangaroo: warm brown fur, long upright ears, a curious joey peeking out of its pouch.' },
  'br:lama': {
    sujet: 'the llama: a white woolly coat, a long neck, colorful tassels on its ears and a woven Andean blanket; behind it, the Andes and their terraces.',
  },
  'br:fennec': { sujet: 'the fennec fox: sandy fur, huge ears, dark shining eyes, leaping playfully over a sand dune.' },
  'br:axolotl': {
    sujet: 'the axolotl: pink and smiling, with feathery pink gills, glowing softly in a moonlit lake among water lilies, backlit.',
  },
  'br:pangolin': {
    sujet: 'the pangolin: covered in overlapping bronze scales like a pinecone, standing on its hind legs with its claws up, its scaly tail curling high.',
    deborde: 'its curled scaly tail and a spray of golden leaves',
  },

  'br:minotaure': {
    sujet: 'the Minotaur: a young, friendly bull-headed hero with chestnut-brown fur, curved cream horns, a golden nose ring, a golden torc with a round pendant and a dark brown tunic.',
  },
  'br:gorgone': {
    sujet: 'the Gorgon: green skin, golden reptile eyes, a crown of living green snakes as hair, a golden armor collar; behind her, a ruined Greek temple at dusk.',
    chroma: 'magenta',
  },
  // « Thor » est refusé (PROHIBITED_CONTENT) : le nom appelle un personnage
  // de bande dessinée protégé. « Le dieu nordique du tonnerre » au casque
  // ailé est passé une fois sur trois, mais sa découpe, jamais : l'image
  // elle-même ressemblait trop au personnage protégé. Le dieu des mythes n'a
  // pas d'ailes à son casque — elles viennent de l'opéra du XIXᵉ siècle — et
  // son marteau est gravé de runes : c'est lui qu'on peint.
  'br:thor': {
    garde: 'the red-bearded warrior with his helmet, fur cloak, armor and hammer',
    sujet:
      'the Viking storm god: a burly warrior with a braided red beard and braided hair, a plain iron helmet and a fur cloak, raising a short rune-carved stone hammer ' +
      'as the first lightning sparks leap from it, storm clouds behind.',
  },
  'br:anubis': {
    sujet: 'Anubis: a black jackal-headed god with tall gold-lined ears, a rainbow-striped Egyptian collar and gold jewelry, eyes glowing gold, backlit by a huge setting sun above the pyramids.',
  },
  'br:poseidon': {
    sujet: 'Poseidon: a dark-skinned sea king with a flowing white beard, a golden crown and a teal robe, raising his golden trident high above the waves.',
    deborde: 'the golden trident’s three prongs and a crest of sea foam',
  },

  'br:hippocampe': { sujet: 'the seahorse: orange and golden, a curled tail, small fins, a friendly eye.' },
  'br:tortue': {
    sujet: 'the sea turtle: green skin, a patterned brown shell, gentle eyes; behind it, a coral reef in the shallows.',
    chroma: 'magenta',
  },
  'br:meduse': {
    sujet: 'the glowing jellyfish: a translucent pink bell and long trailing tentacles, pulsing upward through dark water.',
  },
  'br:raie': {
    garde: 'the manta ray alone — not the water, the waves, the light rays or the plankton',
    sujet: 'the manta ray: a dark back, a white belly, wide wings, gliding through deep blue water under shafts of moonlight, glowing plankton around it.',
  },
  'br:baleine': {
    garde: 'the humpback whale’s body and the column of water spouting from its blowhole',
    retirer:
      'the whole sea — all the water, every wave, the foam and the splashes around and below its body, down to the bottom edge — so that the whale floats alone in the flat color',
    sujet: 'the humpback whale: blue-grey with long white flippers, breaching up out of the waves.',
    deborde: 'its spout of water and the spray of its leap',
  },

  'br:robot': { sujet: 'the robot: a friendly retro robot with a boxy silver head, round yellow eyes, an antenna with a red bulb and a control panel on its chest.' },
  'br:extraterrestre': {
    sujet: 'the alien: bright green skin, huge black eyes, two antennae tipped with little balls; behind it, a flying saucer over a purple planet.',
    chroma: 'magenta',
  },
  'br:chat': {
    garde: 'Schrödinger’s cat, its cardboard box and its ghostly double',
    sujet: 'Schrödinger’s cat: an orange tabby cat winking, half out of a cardboard box, one paw raised, a faint ghostly double of the cat shimmering beside it.',
  },
  'br:astronome': {
    garde: 'the astronomer and his brass telescope',
    sujet: 'the astronomer: an old bearded man in a knit cap looking through a brass telescope, the Milky Way glowing behind him, starlight on his face.',
  },
  'br:savante': {
    sujet: 'the scientist: a woman with glasses and a hair bun, in a lab coat, raising a glowing test tube.',
    deborde: 'a swirling atom and sparkling bubbles rising from the test tube',
  },

  'br:ecureuil': {
    sujet: 'the red squirrel: russet fur, tufted ears, a big bushy tail curling up behind its head, holding an acorn.',
    chroma: 'magenta',
  },
  'br:blaireau': {
    garde: 'the badger — its striped head, its body and its paws',
    retirer: 'its burrow, the roots, the ground, the trees, the moon and the sky',
    sujet: 'the badger: a black-and-white striped face and a grey body; behind it, the entrance of its burrow under tree roots.',
    chroma: 'magenta',
  },
  'br:lynx': {
    sujet: 'the lynx: tawny spotted fur and black-tufted ears, pouncing forward through the ferns.',
    garde: 'the lynx alone — not the ferns, the trees, the ground or the paper frame',
    chroma: 'magenta',
  },
  'br:loup': {
    sujet: 'the grey wolf: howling at a full moon, backlit by moonlight, its eyes glowing.',
    garde: 'the wolf alone — not the moon, the trees, the rocks or the paper frame',
    chroma: 'magenta',
  },
  'br:ours': {
    garde: 'the bear with its raised paws and the few leaves flying right around its paws — not the trees, the branches behind it, the ground or the paper frame',
    sujet: 'the brown bear: standing up on its hind legs with a roar, huge and powerful, among branches and falling leaves.',
    deborde: 'its raised paws and a flurry of leaves',
    chroma: 'magenta',
  },

  'br:cow-boy': { sujet: 'the cowboy: a wide-brimmed hat, a bandana, a sheriff’s star on his vest, a confident smile.' },
  'br:vampire': {
    sujet: 'the vampire: slicked black hair, pale skin, fangs, a high-collared black cape lined with red; behind him, a gothic castle under a full moon.',
  },
  'br:detective': {
    sujet: 'the detective: a deerstalker cap and a tweed coat, examining a clue through a magnifying glass.',
  },
  'br:pirate': {
    sujet: 'the pirate captain: a tricorn hat with a skull, an eye patch, a black beard, a cutlass raised, lantern light and a stormy sea behind.',
  },
  'br:super-heroine': {
    sujet: 'the superheroine: curly dark hair, a teal mask and a flowing cape, one fist raised as she takes flight.',
    deborde: 'her raised fist and her billowing cape',
  },

  'br:dj': { sujet: 'the DJ: a young man with big teal headphones and a cheerful smile.' },
  'br:rockeuse': {
    sujet: 'the rock singer: black hair with a teal streak, a leather jacket and an electric guitar; behind her, a concert stage and its lights.',
  },
  'br:jazzman': { sujet: 'the jazz saxophonist: a hat and a golden saxophone, playing with his eyes closed in a smoky club.' },
  'br:violoniste': {
    sujet: 'the violinist: long blond hair, playing her violin with passion, backlit by a spotlight, her strings glowing.',
  },
  'br:cantatrice': {
    sujet: 'the opera singer: a dark-skinned diva with a hair bun, a red flower and a pearl necklace, singing a high note with her arms open.',
    deborde: 'the sound waves and flying musical notes of her song',
  },

  'br:lutin': { sujet: 'the elf: red hair, a pointy green hat with a bell, pointed ears and a mischievous grin.', chroma: 'magenta' },
  'br:troll': {
    sujet: 'the troll: green warty skin, a tuft of orange hair, a big nose, tusks and a friendly grin; behind it, a stone bridge over a misty river.',
    chroma: 'magenta',
  },
  'br:yeti': { sujet: 'the yeti: thick white fur and a pale blue face, running through a snowstorm with its arms open.' },
  'br:fee': {
    sujet: 'the fairy: dark skin, hair in a bun, translucent blue wings and a golden star wand casting glowing sparkles, backlit by moonlight in an enchanted wood.',
  },
  'br:sirene': {
    sujet: 'the mermaid: long golden hair, a seashell top and a teal scaled tail, rising from a wave onto a rock.',
    deborde: 'her tail fin and a spray of glittering water',
    chroma: 'magenta',
  },

  'br:nageuse': { sujet: 'the swimmer: a woman with a blue swim cap and goggles pushed up on her forehead, a confident smile.' },
  'br:cycliste': {
    sujet: 'the cyclist: a teal aero helmet, sporty sunglasses and a yellow jersey; behind him, a mountain road.',
    garde: 'the cyclist alone — his head, helmet, sunglasses, shoulders and jersey — not the mountains, the road or the flying facets behind him',
  },
  'br:surfeur': { sujet: 'the surfer: blond and tanned, riding a turquoise wave on his surfboard.', garde: 'the surfer and his surfboard', retirer: 'the wave, the water, the spray and the sky' },
  'br:skieuse': {
    garde: 'the skier with her skis and poles — not the mountains, the sky or the slope',
    sujet: 'the skier: a striped beanie and orange goggles, carving through powder snow on a sunlit mountain, backlit, the snow spray glowing.',
  },
  'br:boxeur': {
    sujet: 'the boxer: a man with a white headband and red gloves, throwing an uppercut.',
    deborde: 'his uppercut glove and a burst of impact lines',
  },

  'br:croissant': { sujet: 'the croissant: a golden flaky croissant with a cheerful little face.' },
  'br:macaron': {
    sujet: 'the macaron: a plump pink raspberry macaron with a cute face; behind it, a Parisian pastry shop window with pastel boxes.',
  },
  'br:boulanger': { sujet: 'the baker: a white cap and apron, flour on his cheeks, pulling fresh baguettes out of the oven with a wooden peel.' },
  'br:patissiere': {
    garde: 'the pastry chef, her piping bag and her cake',
    sujet: 'the pastry chef: a woman with a cherry-topped hair bun, piping cream onto a tall cake, warm oven light behind her, sugar sparkling.',
  },
  'br:sommelier': {
    sujet: 'the sommelier: a black waistcoat, a bow tie and a thin mustache, raising a glass of red wine to the light.',
    deborde: 'the swirl of red wine leaping from the glass and a vine of purple grapes',
  },

  'br:slime': { sujet: 'the slime: a bright green jelly blob with a cheerful face.', chroma: 'magenta' },
  'br:squelette': {
    sujet: 'the skeleton warrior: white bones, a rusty sword and a round shield; behind it, a dungeon corridor lit by torches.',
  },
  'br:coffre': {
    garde: 'the living chest with its teeth and tongue',
    sujet: 'the living chest: a wooden treasure chest with golden trim, sharp teeth and a long red tongue, lunging forward to bite, gold coins flying.',
  },
  'br:archere': {
    garde: 'the archer with her bow, her glowing arrow and her cloak — not the trees or the forest',
    sujet: 'the archer: a green hooded cloak and an auburn braid, drawing her bow with a glowing arrow, backlit in a moonlit forest.',
    chroma: 'magenta',
  },
  // Une sorcière : ses longs cheveux blancs, sous le chapeau, avaient été lus
  // comme une barbe, et la mage était revenue en vieux magicien.
  'br:mage': {
    garde: 'the sorceress with her hat, her long white hair, her robe and her glowing staff, and the swirl of magic runes and sparks above the staff',
    retirer: 'the library, the shelves, the books and the floor',
    sujet:
      'the mage: a young dark-skinned sorceress with long white hair, a tall purple pointed hat with stars and a purple robe, ' +
      'raising a staff topped with a glowing golden gem.',
    deborde: 'a swirl of magic runes and sparks from the staff',
  },

  'br:pinata': {
    // Sans ses franges, l'âne géométrique de l'art déco passait pour un zèbre.
    sujet:
      'the piñata: a colorful party piñata toy shaped like a little donkey — a paper-mâché head with a sweet face and big eyes, its neck and body ' +
      'covered in layers of ruffled tissue-paper fringe in pink, orange, yellow and purple — clearly a paper toy, not a real animal.',
  },
  'br:fetard': {
    garde: 'the party-goer with his party hat and party horn — not the balloons, the streamers or the geometric background',
    sujet: 'the party-goer: a striped party hat, blowing a party horn among confetti; behind him, a room full of balloons and streamers.',
  },
  'br:arlequin': {
    garde: 'the harlequin and the balls he juggles',
    sujet: 'the harlequin: a black half-mask, a bicorne hat and a diamond-patterned costume in red, gold and black, juggling.',
  },
  'br:magicien': {
    sujet: 'the magician: a top hat with a white rabbit peeking out, a black cape and a wand throwing sparkles, backlit by a stage spotlight.',
  },
  'br:disco': {
    garde: 'the disco queen, the mirror ball above her and its beams of light',
    retirer: 'the geometric Art Deco panels, the fans, the frame and the patterned background',
    sujet: 'the disco queen: a woman with a big afro and a gold sequin outfit, striking a pose under a mirror ball.',
    deborde: 'the mirror ball and its beams of light',
  },
}
