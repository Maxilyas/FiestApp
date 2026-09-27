// Les avatars du savoir : douze branches, une par catégorie de questions, et
// six portraits dessinés dans chacune.
//
// Un emoji se choisit, un légendaire se décroche par un exploit ; ceux-ci se
// gagnent en sachant. Chaque bonne réponse d'une catégorie — en soirée comme
// au quiz du jour, celles qui font déjà les écussons (`justesParCategorie`)
// — fait avancer sa branche, et chaque palier ouvre un portrait : le premier
// tombe dès la première soirée où l'on joue la catégorie, le dernier avec
// l'écusson d'or. La collection finit par dire ce qu'on sait : Léa porte le
// cerf, on devine qu'elle aime la nature.
//
// Rien ne s'écrit : les portraits ouverts se lisent dans la carrière, à
// chaque lecture, comme les écussons. Une soirée retirée de l'historique
// reprend donc ce que ses réponses avaient ouvert. Et relever un seuil
// reprendrait un portrait à qui l'a déjà : la courbe ne se durcit pas sans
// retenir d'abord ce que chacun avait, comme les légendaires (invariant 22).
//
// Le dessin vit côté client (`client/src/components/portraits/`), une
// branche par fichier ; ici, le catalogue et la règle, purs et partagés — le
// serveur vérifie qu'on porte un portrait qu'on a, la page du profil montre
// ce qui vient.

import type { Categorie } from './categories'
import { SEUILS_ECUSSON, NOM_ECUSSON } from './ecussons'

/**
 * Les bonnes réponses qu'il faut dans la catégorie pour chacun des six
 * portraits d'une branche, du premier au dernier. Le deuxième, le quatrième
 * et le sixième tombent avec les écussons de bronze, d'argent et d'or.
 *
 * Mesurés par `server/scripts/calibrage.ts` (RECOMPENSES.md, § 5.4) : à
 * cinq, un joueur sur cinq repartait de sa première soirée sans rien — ses
 * bonnes réponses se partagent entre douze catégories —, et plus d'un sur
 * trois d'une petite soirée de trois quiz de douze questions. À trois,
 * presque tout le monde a le sien dès le premier soir ; ensuite, au format de
 * la maison, à peu près un par soirée, et le sixième reste un sommet : un
 * joueur sur deux en a un au bout de quarante soirées, aucun sans le quiz du
 * jour aux petits formats.
 */
export const SEUILS_BRANCHE = [3, 20, 40, 75, 130, 200] as const

export interface Portrait {
  /** `br:cerf` : un avatar dessiné, porté à la place de l'emoji comme un légendaire. */
  key: string
  /** « Le cerf », avec son article : la fiche l'écrit tel quel. */
  nom: string
  /** La branche qui le range. */
  branche: CleDeBranche
  /** Les bonnes réponses qu'il faut dans la catégorie de sa branche. */
  seuil: number
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
  portraits: portraits.map(([p, n], i) => ({ key: `br:${p}`, nom: n, branche: key, seuil: SEUILS_BRANCHE[i] })),
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
 * Ce que les bonnes réponses d'un profil ouvrent : ses bonnes réponses par
 * catégorie (`justesParCategorie`), soirées et quiz du jour ensemble.
 */
export type Savoir = Readonly<Record<string, number>>

/**
 * Le savoir que disent ses écussons (`ecussonsDe`) : la page du profil les
 * reçoit déjà, bonnes réponses comprises — les mêmes, comptées au même
 * endroit (`justesParCategorie`).
 */
export function savoirDesEcussons(ecussons: readonly { categorie: string; justes: number }[]): Savoir {
  return Object.fromEntries(ecussons.map(e => [e.categorie, e.justes]))
}

/** Les portraits qu'ouvre ce savoir, branche après branche. */
export function portraitsOuverts(savoir: Savoir): string[] {
  return PORTRAITS.filter(p => (savoir[brancheDe(p).categorie] ?? 0) >= p.seuil).map(p => p.key)
}

/**
 * Ceux qu'une soirée, ou une partie du quiz du jour, vient d'ouvrir : ouverts
 * avec ses réponses, pas sans elles. La fin de soirée les fête.
 */
export function portraitsOuvertsPar(avant: Savoir, apres: Savoir): string[] {
  const deja = new Set(portraitsOuverts(avant))
  return portraitsOuverts(apres).filter(k => !deja.has(k))
}

/** Combien de portraits d'une branche ce savoir ouvre. */
export function ouvertsDansLaBranche(b: Branche, savoir: Savoir): number {
  const justes = savoir[b.categorie] ?? 0
  return b.portraits.filter(p => justes >= p.seuil).length
}

/** Le prochain portrait d'une branche, et les bonnes réponses qui lui manquent ; null quand elle est complète. */
export function prochainDansLaBranche(b: Branche, savoir: Savoir): { portrait: Portrait; manque: number } | null {
  const justes = savoir[b.categorie] ?? 0
  const p = b.portraits.find(x => justes < x.seuil)
  return p ? { portrait: p, manque: p.seuil - justes } : null
}

/** L'écusson qui tombe avec ce seuil — « bronze », « argent », « or » —, ou null. */
export function ecussonDuSeuil(seuil: number): string | null {
  const i = (SEUILS_ECUSSON as readonly number[]).indexOf(seuil)
  return i < 0 ? null : NOM_ECUSSON[i + 1].toLowerCase()
}
