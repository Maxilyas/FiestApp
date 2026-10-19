// Les compagnons : des animaux peints qu'on adopte en boutique, et qui
// grandissent avec soi (le choix du 13 octobre 2026).
//
// Un légendaire se décroche par un exploit, un portrait en sachant ; un
// compagnon s'achète à sa première forme, puis grandit avec les bonnes
// réponses données avec lui — dans tous les modes de jeu : soirées, quiz du
// jour, campagne, duels. Quatre formes du même individu, chacune plus riche
// que la précédente, et plus rare : un compagnon payé cher récompense
// l'assiduité, et il doit être beau (le propriétaire). Une forme atteinte ne
// se perd jamais, et chacune se porte aussi en avatar.
//
// Il vit dans sa niche, en haut de chaque page du téléphone (le choix du 18
// octobre 2026, `retours/2026-10-16/compagnon/principe.md`), et c'est celui
// de la niche qui grandit : jusque-là, celui qu'on portait — et porter un
// médaillon ne fait plus grandir personne. La niche est sa maison, l'avatar
// une autre affaire (le 19 octobre 2026) : l'adoption l'y installe sans le
// faire porter, et sa niche se gère en la touchant — celui qui y vit, son
// nom, la forme qu'il y montre.
//
// Comme tout ce qui se porte, un compagnon ne donne AUCUN avantage de jeu.
//
// Le dessin vit côté client (`client/src/components/Compagnon.tsx`, ses
// fichiers dans `compagnons-peints.ts`) ; ici, le catalogue et la règle,
// purs et partagés — le serveur vérifie qu'on porte une forme qu'on a, la
// boutique vend, l'album montre ce qui vient.

import type { Rarete } from './badges'

/** Le prix d'un compagnon, à sa première forme : un objet qui se mérite. */
export const PRIX_D_UN_COMPAGNON = 1000

/**
 * Les bonnes réponses données avec lui qu'il faut pour atteindre chaque
 * forme : la première à l'achat, puis 100, 300 et 500, comptées depuis
 * l'achat. Un choix de produit, pas une constante technique.
 */
export const JUSTES_DES_FORMES = [0, 100, 300, 500] as const

/** La rareté de chaque forme : elle monte avec lui, jusqu'à la légendaire. */
export const RARETE_DES_FORMES: readonly Rarete[] = ['commune', 'rare', 'epique', 'legendaire']

/** Ce que chaque forme est pour lui, en deux mots : la carte, la fiche, la boutique. */
export const NOM_DE_LA_FORME = ['Première forme', 'Deuxième forme', 'Troisième forme', 'Forme ultime'] as const

/** Le nom qu'on lui donne (« Nox ») : court, il tient sous sa niche et sur une ligne de sa fiche. */
export const NOM_D_UN_COMPAGNON_MAX = 16

export type CleDeCompagnon = 'loup' | 'chat' | 'tortue'

export interface FormeDeCompagnon {
  /** `cp:loup-adulte` : un avatar dessiné, porté à la place de l'emoji comme un légendaire. */
  key: string
  /** Le compagnon qu'elle est. */
  compagnon: CleDeCompagnon
  /** Son rang, de 0 (la forme qu'on achète) à 3 (la forme ultime) : son dessin et sa rareté en dépendent. */
  rang: number
  /** « Le loup adulte », avec son article : la fiche l'écrit tel quel. */
  nom: string
  /** Ce qu'elle montre, en une phrase. */
  legende: string
  rarete: Rarete
}

export interface Compagnon {
  key: CleDeCompagnon
  /** « Le Loup », comme la boutique le vend. */
  nom: string
  /**
   * Ce qui le reprend : « avec elle », pour la tortue. Toutes ses formes ont
   * son genre — « La jeune tortue arrive à 100 bonnes réponses données en le
   * portant » se lisait de travers.
   */
  le: 'le' | 'la'
  /** L'emoji qui le dit là où rien ne se peint : une ligne, un compte. */
  emoji: string
  /** Ce qu'il est, d'une forme à l'autre. */
  phrase: string
  formes: readonly FormeDeCompagnon[]
}

/** Un compagnon et ses quatre formes, dans l'ordre : `[clé, nom, pronom, emoji, phrase, [id, nom, légende][]]`. */
const CATALOGUE: [CleDeCompagnon, string, 'le' | 'la', string, string, [string, string, string][]][] = [
  [
    'loup',
    'Le Loup',
    'le',
    '🐺',
    'Un loup argenté, sa selle bleu nuit et le croissant de lune sur le front.',
    [
      ['louveteau', 'Le louveteau', 'Tout rond, des pattes et des oreilles trop grandes pour lui.'],
      ['jeune', 'Le jeune loup', 'Dégingandé et curieux, dans une clairière enneigée à l’heure bleue.'],
      ['adulte', 'Le loup adulte', 'Sur une crête, au-dessus d’une mer de nuages, sous la pleine lune.'],
      ['ultime', 'Le loup des étoiles', 'Sa selle devenue ciel étoilé, ses rubans d’étoiles tournent autour de lui.'],
    ],
  ],
  [
    'chat',
    'Le Chat des lanternes',
    'le',
    '🐱',
    'Un chat crème au masque prune, une flamme sur le front, un grelot au cou.',
    [
      ['chaton', 'Le chaton', 'Tout rond, et sa petite lanterne de papier.'],
      ['jeune', 'Le jeune chat', 'Sur les toits, un soir de fête, sous les guirlandes de lanternes.'],
      ['adulte', 'Le chat des lanternes', 'Au cœur de la fête de nuit, sous les premiers feux d’artifice.'],
      ['esprit', 'L’esprit des lanternes', 'Deux queues de flamme ; ses lanternes et ses feux d’artifice sortent du cercle.'],
    ],
  ],
  [
    'tortue',
    'La Tortue-île',
    'la',
    '🐢',
    'Une tortue à carapace de jade, une étoile sur la tête : son décor, c’est son dos.',
    [
      ['bebe', 'La petite tortue', 'À peine éclose, une seule pousse sur sa carapace.'],
      ['jeune', 'La jeune tortue', 'Un jardin de mousse et de fleurs sur le dos, dans un lagon doré.'],
      ['adulte', 'La tortue-bosquet', 'Un bosquet sur la carapace et sa cascade, en pleine mer.'],
      ['ile', 'La tortue-île', 'Une île entière sur le dos : ses cascades et ses oiseaux sortent du cercle.'],
    ],
  ],
]

/** Les trois compagnons de la boutique, dans l'ordre de ses rayons. */
export const COMPAGNONS: readonly Compagnon[] = CATALOGUE.map(([key, nom, le, emoji, phrase, formes]) => ({
  key,
  nom,
  le,
  emoji,
  phrase,
  formes: formes.map(([id, nomDeForme, legende], rang) => ({
    key: `cp:${key}-${id}`,
    compagnon: key,
    rang,
    nom: nomDeForme,
    legende,
    rarete: RARETE_DES_FORMES[rang],
  })),
}))

/** Les douze formes, compagnon après compagnon. */
export const FORMES_DES_COMPAGNONS: readonly FormeDeCompagnon[] = COMPAGNONS.flatMap(c => c.formes)

const PAR_CLE = new Map(FORMES_DES_COMPAGNONS.map(f => [f.key, f]))
const COMPAGNON_PAR_CLE = new Map(COMPAGNONS.map(c => [c.key, c]))

/** La forme de compagnon de cette clé (`cp:loup-adulte`) ; rien pour une autre clé. */
export function formeDeCompagnon(key: unknown): FormeDeCompagnon | undefined {
  return typeof key === 'string' ? PAR_CLE.get(key) : undefined
}

/** Le compagnon de cette clé (`loup`) ; rien pour une autre. */
export function compagnon(key: unknown): Compagnon | undefined {
  return typeof key === 'string' ? COMPAGNON_PAR_CLE.get(key as CleDeCompagnon) : undefined
}

/** Le compagnon d'une forme. */
export function compagnonDe(f: FormeDeCompagnon): Compagnon {
  return COMPAGNON_PAR_CLE.get(f.compagnon)!
}

/** Ce qui le fait grandir, dit à son genre : « avec lui », « avec elle ». */
export const avecLui = (c: Compagnon) => (c.le === 'la' ? 'avec elle' : 'avec lui')

/** Le rang de la plus haute forme que ces bonnes réponses, données avec lui, font atteindre. */
export function rangAtteint(justes: number): number {
  let rang = 0
  JUSTES_DES_FORMES.forEach((seuil, r) => {
    if (justes >= seuil) rang = r
  })
  return rang
}

/**
 * Un compagnon qu'un profil a acheté, et la plus haute forme qu'il a
 * atteinte — jamais perdue : elle et celles d'avant se portent. Ce que le
 * serveur sait de mémoire, et que le profil dit à chaque lecture.
 */
export interface CompagnonPossede {
  compagnon: CleDeCompagnon
  /** Le rang de la plus haute forme atteinte. */
  rang: number
  /** Le nom qu'il lui a donné, s'il lui en a donné un : à lui seul — la salle ne le voit jamais. */
  nom?: string
  /**
   * Le rang de la forme qu'il montre dans sa niche, s'il en a choisi une
   * d'avant la plus haute ; absent, la plus haute — il grandit alors sous ses
   * yeux. Une forme atteinte reprend la place (`formeDansLaNiche`).
   */
  montree?: number
}

/** Et les bonnes réponses données avec lui depuis l'achat, relues dans ses journaux : la jauge de la forme suivante. */
export interface CompagnonAcquis extends CompagnonPossede {
  justes: number
}

/** La forme suivante et ce qui reste pour l'atteindre ; null à la forme ultime. */
export function prochaineForme(a: CompagnonAcquis): { forme: FormeDeCompagnon; encore: number } | null {
  const c = compagnon(a.compagnon)
  const suivante = c?.formes[a.rang + 1]
  if (!suivante) return null
  return { forme: suivante, encore: Math.max(0, JUSTES_DES_FORMES[suivante.rang] - a.justes) }
}

/** Les clés des formes que ces compagnons laissent porter : chacun jusqu'à sa plus haute. */
export function formesOuvertes(possedes: readonly CompagnonPossede[]): string[] {
  return possedes.flatMap(a => (compagnon(a.compagnon)?.formes ?? []).filter(f => f.rang <= a.rang).map(f => f.key))
}

/** La plus haute forme qu'il a de ce compagnon. */
export function formeLaPlusHaute(a: CompagnonPossede): FormeDeCompagnon | undefined {
  return compagnon(a.compagnon)?.formes[a.rang]
}

/** La forme qu'il montre dans sa niche : celle qu'il a choisie, si elle est atteinte, sinon sa plus haute. */
export function formeDansLaNiche(a: CompagnonPossede): FormeDeCompagnon | undefined {
  return compagnon(a.compagnon)?.formes[a.montree !== undefined && a.montree >= 0 && a.montree <= a.rang ? a.montree : a.rang]
}

/**
 * Le compagnon de sa niche — celui que ses bonnes réponses font grandir — ;
 * null sans compagnon. Celui qu'il y a installé (`choisi`), sinon le plus
 * grand des siens, le premier du catalogue à égalité. Rien qu'il n'ait pas :
 * un nom inconnu, un compagnon qu'il n'a pas adopté. Ce qu'il porte n'y
 * compte plus (le 19 octobre 2026) : la niche suivait l'avatar de qui ne
 * l'avait jamais choisie, et l'ôter faisait déménager son compagnon. Ces
 * niches-là se sont figées une fois, sur ce qu'il portait
 * (`ProfileStore.installerLesNiches`).
 */
export function compagnonDeLaNiche(choisi: unknown, possedes: readonly CompagnonPossede[]): CleDeCompagnon | null {
  const sien = possedes.find(a => a.compagnon === choisi)
  if (sien) return sien.compagnon
  let plusGrand: CompagnonPossede | undefined
  for (const c of COMPAGNONS) {
    const a = possedes.find(x => x.compagnon === c.key)
    if (a && (!plusGrand || a.rang > plusGrand.rang)) plusGrand = a
  }
  return plusGrand?.compagnon ?? null
}
