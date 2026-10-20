// S'occuper de son compagnon (la maquette validée par le propriétaire le
// 20 octobre 2026, `retours/2026-10-20/mon-compagnon/` : « réfléchir pour
// faire comme un mini jeu de s'occuper de son compagnon. Que ce soit fun et
// qu'à la fin on puisse avoir des choses supplémentaires »).
//
// Chaque jour, trois envies : un goûter, un câlin, une partie de cueillette.
// Les trois comblées, il rapporte un cadeau — une trouvaille pour son jardin
// (`shared/trouvailles.ts`) — et la complicité gagne un jour. Rien ne se perd
// si l'on ne vient pas : il ne boude jamais, et un jour sans lui ne retire
// rien (`retours/2026-10-16/compagnon/principe.md`, § 8). Chaque compagnon a
// ses envies, sa complicité, son jardin ; c'est celui de la niche qu'on
// soigne, sur sa page.
//
// Rien ici ne donne d'avantage de jeu (invariant 8). Pur : le client, le
// serveur et les tests le lisent.

/** Ses trois envies du jour, dans l'ordre où la page les montre. */
export type Envie = 'gouter' | 'calin' | 'jeu'

export const ENVIES: readonly Envie[] = ['gouter', 'calin', 'jeu']

export const NOM_DE_L_ENVIE: Readonly<Record<Envie, string>> = { gouter: 'Goûter', calin: 'Câlin', jeu: 'Jouer' }

export function estUneEnvie(x: unknown): x is Envie {
  return typeof x === 'string' && (ENVIES as readonly string[]).includes(x)
}

/** Les envies qu'il reste au jour : aucune quand les trois sont comblées. */
export function enviesQuiRestent(faites: Readonly<Partial<Record<Envie, boolean>>>): Envie[] {
  return ENVIES.filter(e => !faites[e])
}

// ── Le cadeau et la complicité ──────────────────────────────────────────────

/**
 * Tous les sept jours de complicité, le cadeau est grand : une rare ou une
 * épique (`CHANCES_DU_CADEAU`). Un choix de produit
 * (`docs/reference/baremes.md`).
 */
export const JOURS_DU_GRAND_CADEAU = 7

/** Le cadeau qui l'attend, à cette complicité : le septième, le quatorzième… sont grands. */
export function prochainCadeauGrand(complicite: number): boolean {
  return (complicite + 1) % JOURS_DU_GRAND_CADEAU === 0
}

/** La complicité du prochain grand cadeau. */
export function prochainGrandCadeau(complicite: number): number {
  return JOURS_DU_GRAND_CADEAU * Math.ceil((complicite + 1) / JOURS_DU_GRAND_CADEAU)
}

/**
 * Ses tours, appris à mesure de la complicité : il les fait quand on le
 * caresse. Un choix de produit (`docs/reference/baremes.md`) — un tour ne
 * donne rien d'autre que le plaisir de le voir.
 */
export const TOURS: readonly { jours: number; nom: string }[] = [
  { jours: 3, nom: 'la pirouette' },
  { jours: 10, nom: 'le salut' },
  { jours: 20, nom: 'la danse' },
  { jours: 40, nom: 'le grand saut' },
]

/** Les tours qu'il sait, du premier appris au dernier. */
export function toursAppris(complicite: number): string[] {
  return TOURS.filter(t => complicite >= t.jours).map(t => t.nom)
}

/** Le tour qu'il apprend pile à cette complicité — le jour du cadeau qui l'y mène. */
export function tourDuJour(complicite: number): string | null {
  return TOURS.find(t => t.jours === complicite)?.nom ?? null
}

/** Le prochain tour à apprendre, s'il en reste. */
export function prochainTour(complicite: number): { jours: number; nom: string } | null {
  return TOURS.find(t => t.jours > complicite) ?? null
}

// ── La cueillette ───────────────────────────────────────────────────────────

/** Une partie : trente secondes pour attraper ses friandises. */
export const DUREE_DE_LA_CUEILLETTE_S = 30

/** Les points de ses trois étoiles : la note d'une partie, comme au quiz du jour. */
export const ETOILES_DE_LA_CUEILLETTE: readonly number[] = [10, 20, 30]

export function etoilesDeLaCueillette(score: number): number {
  return ETOILES_DE_LA_CUEILLETTE.filter(seuil => score >= seuil).length
}

/**
 * Plus qu'une partie ne peut faire : il tombe moins de cinquante choses en
 * trente secondes, et une étoile vaut trois. Au-dessus, le téléphone ment,
 * et la partie ne s'écrit pas.
 */
export const SCORE_MAX_DE_LA_CUEILLETTE = 200

/**
 * Deux parties ne s'écrivent pas à moins de vingt-cinq secondes d'écart : une
 * partie en dure trente-deux, décompte compris. Sans cette garde, dix parties
 * à trois étoiles s'enverraient en un instant — l'étoile filante en dépend.
 */
export const ECART_ENTRE_DEUX_CUEILLETTES_MS = 25_000

/** Lit un score envoyé par le téléphone : un entier entre zéro et le maximum, sinon une erreur lisible. */
export function lireLeScore(brut: unknown): number {
  const score = typeof brut === 'number' ? brut : Number.NaN
  if (!Number.isInteger(score) || score < 0 || score > SCORE_MAX_DE_LA_CUEILLETTE) throw new Error('Ce score ne se lit pas : rejoue la partie.')
  return score
}

// ── Ce que la page lit ──────────────────────────────────────────────────────

/** Les soins d'un compagnon, aujourd'hui (`GET /api/joueur/soins`). */
export interface SoinsDuCompagnon {
  /** Sa clé au catalogue (`shared/compagnons.ts`). */
  compagnon: string
  /** Ses envies d'aujourd'hui, comblées ou non. */
  envies: Record<Envie, boolean>
  /** Le cadeau d'aujourd'hui, une fois ouvert : rouvert, il redonne ce qu'il a donné. */
  cadeau: { objet: string; grand: boolean } | null
  /** Les jours de complicité : ses cadeaux ouverts. */
  complicite: number
  /** Son record à la cueillette. */
  record: number
  /** Son jardin : la trouvaille de chaque place occupée. */
  jardin: Record<string, string>
}

export interface SoinsDuProfil {
  /** Le jour de Paris où le serveur les a lus (« 2026-10-20 ») : ses envies sont celles de ce jour-là. */
  jour: string
  compagnons: SoinsDuCompagnon[]
  /** Ses trouvailles, comptées — à lui, pour tous ses compagnons. */
  trouvailles: Record<string, number>
  /** Ses cueillettes à trois étoiles, avec tous ses compagnons : l'étoile filante en demande dix. */
  troisEtoiles: number
}

/** Ce que rend le cadeau ouvert (`POST /api/joueur/compagnons/:cle/cadeau`). */
export interface CadeauOuvert {
  objet: string
  grand: boolean
  /** Sa complicité, ce jour compris. */
  complicite: number
  /** Le terrain que ce jour ouvre, s'il en ouvre un (son rang dans `TERRAINS`). */
  terrain: number | null
  /** Le tour qu'il apprend ce jour-là. */
  tour: string | null
  /** La légendaire que ce jour fait gagner (cent jours de complicité). */
  exploit: string | null
  soins: SoinsDuProfil
}

/** Ce que rend une cueillette écrite (`POST /api/joueur/compagnons/:cle/cueillette`). */
export interface CueilletteEcrite {
  score: number
  etoiles: number
  /** Son record d'avant la partie. */
  ancien: number
  nouveauRecord: boolean
  /** Vrai quand la partie comble l'envie du jour — la première du jour. */
  envie: boolean
  /** La légendaire que cette partie fait gagner (dix cueillettes à trois étoiles). */
  exploit: string | null
  soins: SoinsDuProfil
}
