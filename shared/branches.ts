// Les avatars du savoir : douze branches, une par catégorie de questions, et
// six portraits dessinés dans chacune.
//
// Un emoji se choisit, un légendaire se décroche par un exploit ; ceux-ci se
// gagnent en sachant, sur les sentiers du savoir de la campagne
// (`shared/sentiers.ts`) : douze paliers par branche, de plus en plus durs,
// et un portrait tous les deux paliers. La collection finit par dire ce
// qu'on sait : Léa porte le cerf, on devine qu'elle aime la nature.
//
// Les soirées et le quiz du jour en ouvraient jusqu'au 5 octobre 2026, à
// leurs bonnes réponses : les sentiers sont devenus le seul chemin (le choix
// du 5 octobre 2026), et chacun a gardé ce qu'il avait — repris en paliers
// une fois pour toutes (`core/repriseDesPortraits.ts`).
//
// Le dessin vit côté client (`client/src/components/portraits/`), une
// branche par fichier ; ici, le catalogue et la règle, purs et partagés — le
// serveur vérifie qu'on porte un portrait qu'on a, la page du profil montre
// ce qui vient.

import type { Categorie } from './categories'

/**
 * Le palier du sentier qui ouvre chaque portrait d'une branche, du premier au
 * dernier : un tous les deux paliers, le sixième au sommet. Le premier palier
 * d'une paire entraîne, le second — un peu plus dur — ouvre l'avatar.
 */
export const PALIER_DU_PORTRAIT = [2, 4, 6, 8, 10, 12] as const

export interface Portrait {
  /** `br:cerf` : un avatar dessiné, porté à la place de l'emoji comme un légendaire. */
  key: string
  /** « Le cerf », avec son article : la fiche l'écrit tel quel. */
  nom: string
  /** La branche qui le range. */
  branche: CleDeBranche
  /** Son rang dans la branche, de 0 (le visage) à 5 (la forme ultime) : son dessin en dépend. */
  rang: number
  /** Le palier du sentier qui l'ouvre (`PALIER_DU_PORTRAIT`). */
  palier: number
}

export interface Branche {
  key: CleDeBranche
  /** « La forêt » : ce qui les range, pas la catégorie. */
  nom: string
  categorie: Categorie
  /** Ses six portraits, du premier ouvert au dernier. */
  portraits: Portrait[]
}

export type CleDeBranche =
  | 'monde'
  | 'mythes'
  | 'oceans'
  | 'espace'
  | 'foret'
  | 'ecran'
  | 'scene'
  | 'contes'
  | 'stade'
  | 'brigade'
  | 'arcade'
  | 'carnaval'

/** Une branche, ses six portraits dans l'ordre : `[clé, nom]`. */
const CATALOGUE: [CleDeBranche, string, Categorie, [string, string][]][] = [
  [
    'monde',
    'Le tour du monde',
    'Culture générale',
    [
      ['kangourou', 'Le kangourou'],
      ['lama', 'Le lama'],
      ['fennec', 'Le fennec'],
      ['axolotl', 'L’axolotl'],
      ['pangolin', 'Le pangolin'],
      ['panda-roux', 'Le panda roux'],
    ],
  ],
  [
    'mythes',
    'Les mythologies',
    'Histoire',
    [
      ['minotaure', 'Le Minotaure'],
      ['gorgone', 'La Gorgone'],
      ['thor', 'Thor'],
      ['anubis', 'Anubis'],
      ['poseidon', 'Poséidon'],
      ['athena', 'Athéna'],
    ],
  ],
  [
    'oceans',
    'Les océans',
    'Géographie',
    [
      ['hippocampe', 'L’hippocampe'],
      ['tortue', 'La tortue de mer'],
      ['meduse', 'La méduse lumineuse'],
      ['raie', 'La raie manta'],
      ['baleine', 'La baleine à bosse'],
      ['narval', 'Le narval'],
    ],
  ],
  [
    'espace',
    'L’espace',
    'Sciences',
    [
      ['robot', 'Le robot'],
      ['extraterrestre', 'L’extraterrestre'],
      ['chat', 'Le chat de Schrödinger'],
      ['astronome', 'L’astronome'],
      ['savante', 'La savante'],
      ['astronaute', 'L’astronaute'],
    ],
  ],
  [
    'foret',
    'La forêt',
    'Nature',
    [
      ['ecureuil', 'L’écureuil'],
      ['blaireau', 'Le blaireau'],
      ['lynx', 'Le lynx'],
      ['loup', 'Le loup'],
      ['ours', 'L’ours'],
      ['cerf', 'Le cerf'],
    ],
  ],
  [
    'ecran',
    'Le grand écran',
    'Cinéma & séries',
    [
      ['cow-boy', 'Le cow-boy'],
      ['vampire', 'Le vampire'],
      ['detective', 'Le détective'],
      ['pirate', 'Le pirate'],
      ['super-heroine', 'La super-héroïne'],
      ['star', 'La star'],
    ],
  ],
  [
    'scene',
    'La scène',
    'Musique',
    [
      ['dj', 'Le DJ'],
      ['rockeuse', 'La rockeuse'],
      ['jazzman', 'Le jazzman'],
      ['violoniste', 'La violoniste'],
      ['cantatrice', 'La cantatrice'],
      ['maestro', 'Le chef d’orchestre'],
    ],
  ],
  [
    'contes',
    'Les contes',
    'Arts & lettres',
    [
      ['lutin', 'Le lutin'],
      ['troll', 'Le troll'],
      ['yeti', 'Le yéti'],
      ['fee', 'La fée'],
      ['sirene', 'La sirène'],
      ['griffon', 'Le griffon'],
    ],
  ],
  [
    'stade',
    'Le stade',
    'Sport',
    [
      ['nageuse', 'La nageuse'],
      ['cycliste', 'Le cycliste'],
      ['surfeur', 'Le surfeur'],
      ['skieuse', 'La skieuse'],
      ['boxeur', 'Le boxeur'],
      ['danseuse', 'La danseuse étoile'],
    ],
  ],
  [
    'brigade',
    'La brigade',
    'Cuisine',
    [
      ['croissant', 'Le croissant'],
      ['macaron', 'Le macaron'],
      ['boulanger', 'Le boulanger'],
      ['patissiere', 'La pâtissière'],
      ['sommelier', 'Le sommelier'],
      ['chef', 'Le chef'],
    ],
  ],
  [
    'arcade',
    'L’arcade',
    'Jeux & pop culture',
    [
      ['slime', 'Le slime'],
      ['squelette', 'Le squelette'],
      ['coffre', 'Le coffre vivant'],
      ['archere', 'L’archère'],
      ['mage', 'La mage'],
      ['chevalier', 'Le chevalier'],
    ],
  ],
  [
    'carnaval',
    'Le carnaval',
    'Autour de la fête',
    [
      ['pinata', 'La piñata'],
      ['fetard', 'Le fêtard'],
      ['arlequin', 'L’arlequin'],
      ['magicien', 'Le magicien'],
      ['disco', 'La reine du disco'],
      ['venise', 'Le masque de Venise'],
    ],
  ],
]

/** Les douze branches, dans l'ordre de la liste des catégories — celui des écussons. */
export const BRANCHES: Branche[] = CATALOGUE.map(([key, nom, categorie, portraits]) => ({
  key,
  nom,
  categorie,
  portraits: portraits.map(([p, n], i) => ({ key: `br:${p}`, nom: n, branche: key, rang: i, palier: PALIER_DU_PORTRAIT[i] })),
}))

/** Les soixante-douze portraits, branche après branche. */
export const PORTRAITS: Portrait[] = BRANCHES.flatMap(b => b.portraits)

const PAR_CLE = new Map(PORTRAITS.map(p => [p.key, p]))
const BRANCHE_PAR_CLE = new Map(BRANCHES.map(b => [b.key, b]))

export function portrait(key: unknown): Portrait | undefined {
  return typeof key === 'string' ? PAR_CLE.get(key) : undefined
}

export function branche(key: unknown): Branche | undefined {
  return typeof key === 'string' ? BRANCHE_PAR_CLE.get(key as CleDeBranche) : undefined
}

/** La branche d'un portrait. */
export function brancheDe(p: Portrait): Branche {
  return BRANCHE_PAR_CLE.get(p.branche)!
}

/**
 * Le nom dans une phrase : « pour l’ours », « pour la tortue de mer » — mais
 * « pour Thor ». Seul l'article prend la minuscule.
 */
export function nomDansLaPhrase(nom: string): string {
  return nom.replace(/^(Le |La |Les |L’)/, m => m.toLowerCase())
}

/**
 * Les paliers validés de chaque sentier (`shared/sentiers.ts`) : de 0 à 12,
 * et 13 quand son palier de maître l'est aussi. Ce qui ouvre les portraits.
 */
export type Paliers = Readonly<Partial<Record<CleDeBranche, number>>>

/** Les portraits qu'ouvrent ces paliers, branche après branche. */
export function portraitsOuverts(paliers: Paliers): string[] {
  return PORTRAITS.filter(p => (paliers[p.branche] ?? 0) >= p.palier).map(p => p.key)
}

/** Combien de portraits d'une branche ces paliers ouvrent. */
export function ouvertsDansLaBranche(b: Branche, paliers: Paliers): number {
  const valides = paliers[b.key] ?? 0
  return b.portraits.filter(p => valides >= p.palier).length
}

/** Le prochain portrait d'une branche, et combien de paliers il reste à valider ; null quand elle est complète. */
export function prochainDansLaBranche(b: Branche, paliers: Paliers): { portrait: Portrait; encore: number } | null {
  const valides = paliers[b.key] ?? 0
  const p = b.portraits.find(x => valides < x.palier)
  return p ? { portrait: p, encore: p.palier - valides } : null
}

/**
 * Le nom de la branche après « de » : « de la forêt », « du stade », « des
 * océans », « de l’espace ». Pour « le sentier de… » et « Maître de… ».
 */
export function deLaBranche(b: Branche): string {
  const nom = b.nom
  if (nom.startsWith('Le ')) return `du ${nom.slice(3)}`
  if (nom.startsWith('Les ')) return `des ${nom.slice(4)}`
  if (nom.startsWith('La ')) return `de la ${nom.slice(3)}`
  if (nom.startsWith('L’')) return `de l’${nom.slice(2)}`
  return `de ${nom}`
}
