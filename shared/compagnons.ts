// Les compagnons : des animaux peints qu'on adopte en boutique, et qui
// grandissent avec soi (le choix du 13 octobre 2026).
//
// Un légendaire se décroche par un exploit, un portrait en sachant ; un
// compagnon s'achète à sa première forme, puis grandit avec les bonnes
// réponses données avec lui — dans tous les modes de jeu : soirées, quiz du
// jour, campagne, duels. Quatre formes du même individu, chacune plus riche
// que la précédente, et plus rare : un compagnon payé cher récompense
// l'assiduité, et il doit être beau (le propriétaire). Une forme atteinte ne
// se perd jamais, et chacune se porte aussi en avatar. L'Éclat lui en ouvre
// une de plus à sa forme ultime, sa métamorphose de lumière : elle ne remplace
// rien, on la choisit (`Compagnon.lumiere`, le 19 octobre 2026).
//
// La luciole se gagnait au bout d'une expédition (la Première traversée, le 20
// octobre 2026). L'Expédition effacée, elle s'achète à la boutique comme les
// autres depuis le 31 octobre 2026 (le choix du propriétaire) — qui l'avait la
// garde —, et rejoint encore qui complète sa première salle du Cabinet.
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
import type { ReglageDesOrnements } from './ornements'
import { CABINET_EN_PRODUCTION } from './cabinet/ouverture'
import { EXPEDITION_REMPLACEE, voieDeLExpeditionDite } from './jokers'

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

/** Ce qu'une forme est pour lui, en deux mots — sa métamorphose a le sien. */
export const nomDeLaForme = (f: FormeDeCompagnon): string => (f.metamorphose ? 'Métamorphose' : NOM_DE_LA_FORME[f.rang])

/**
 * Ce que `montree` vaut quand sa niche montre sa métamorphose : une forme de
 * plus, après la forme ultime, qui ne se gagne pas en grandissant.
 */
export const MONTREE_DE_LA_METAMORPHOSE = 4

/** Le nom qu'on lui donne (« Nox ») : court, il tient sous sa niche et sur une ligne de sa fiche. */
export const NOM_D_UN_COMPAGNON_MAX = 16

export type CleDeCompagnon = 'loup' | 'chat' | 'tortue' | 'luciole' | 'panda'

/**
 * Où se gagne un compagnon qui ne s'achète pas : la luciole l'était, au bout
 * d'une expédition, jusqu'au 31 octobre 2026 (l'Expédition effacée, elle
 * s'achète). Aucun aujourd'hui ; d'autres viendront peut-être sur ce modèle, un
 * par mode, chacun son exploit (`retours/2026-10-16/compagnon/principe.md`, § 5).
 */
export type LieuDuCompagnon = 'expedition'

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
  /**
   * Sa métamorphose de lumière, et non une forme qui se gagne en grandissant :
   * elle garde le rang de la forme ultime, d'où elle s'ouvre (`Compagnon.lumiere`).
   */
  metamorphose?: true
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
  /**
   * Sa métamorphose de lumière (`cp:loup-tempete`), que l'Éclat fait tomber :
   * un autre animal, plus féroce, peint d'après sa forme ultime (le choix du
   * 13 octobre 2026), son nom et sa légende ceux de la maquette. Elle ne la
   * remplace pas : c'est une forme de plus, qu'on choisit (le propriétaire,
   * le 19 octobre 2026 : « je veux que ce soit un choix ») — en avatar dans
   * la loge, dans sa niche depuis « Décorer », chez lui —, ouverte à sa forme ultime
   * quand l'Éclat brille sur lui (`metamorphoseOuverte`). Facultative : un
   * compagnon livré sans elle n'en promet aucune, et l'Éclat ne lui pose que
   * ses paillettes — la luciole, jusqu'à sa luciole-aurore (le 20 octobre 2026).
   */
  lumiere?: FormeDeCompagnon
  /**
   * Où il se gagne, s'il ne s'achète pas — absent, il est en boutique. La
   * luciole rejoignait qui mène une expédition au bout (le souhait du
   * propriétaire, le 18 octobre 2026 : « que certains hauts faits
   * récompensent de nouveaux compagnons, comme la luciole »), et ne se
   * montrait que dans « Ma collection » ; l'Expédition effacée, elle est en
   * boutique depuis le 31 octobre 2026.
   */
  gagne?: LieuDuCompagnon
}

/**
 * Un compagnon, ses quatre formes et sa lumière, dans l'ordre, et où il se
 * gagne s'il ne s'achète pas : `[clé, nom, pronom, emoji, phrase, [id, nom,
 * légende][], [id, nom, légende] | null, lieu ?]`.
 */
const CATALOGUE: [CleDeCompagnon, string, 'le' | 'la', string, string, [string, string, string][], [string, string, string] | null, LieuDuCompagnon?][] = [
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
    ['tempete', 'Le loup-tempête', 'Éclairs d’aurore et glace qui vole.'],
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
    ['soleil', 'Le chat-soleil', 'Fourrure d’or tissé, queues en comètes, feux d’artifice dorés.'],
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
    ['fleurs', 'L’île en fleurs', 'Fleurs blanches et dorées, pétales qui tourbillonnent.'],
  ],
  // Ses formes gardent les noms de la planche que le propriétaire a vue (le
  // 18 octobre 2026), sauf la première : « le ver luisant » se serait dit « en
  // la portant » — toutes au féminin, comme elle. Sa métamorphose, la
  // luciole-aurore, peinte le 20 octobre 2026 (« peins-la ici », le
  // propriétaire) : elle ne remplace rien, comme celles des trois autres.
  [
    'luciole',
    'La Luciole',
    'la',
    '✨',
    'Une luciole d’ambre toute ronde, sa lanterne qui luit vert et or, deux longues antennes : elle éclaire le chemin.',
    [
      ['ver', 'La petite luciole', 'Encore un ver luisant, tout rond sur sa feuille, le bout de la queue qui luit.'],
      ['jeune', 'La jeune luciole', 'À peine éclose, ses ailes encore froissées, dans le pré d’été à la nuit tombée.'],
      ['adulte', 'La luciole des sentiers', 'Ses ailes d’ambre grandes ouvertes, sa traînée de lumière éclaire la forêt.'],
      ['constellation', 'La luciole-constellation', 'Ses ailes de vitrail : son essaim tourne autour d’elle et sort du cercle.'],
    ],
    ['aurore', 'La luciole-aurore', 'Ailes en voiles d’aurore boréale, lanterne en petit soleil.'],
  ],
  // Le panda roux, le dernier venu de la boutique (le 20 octobre 2026) : après la
  // luciole dans le catalogue, pour que rien de ce qui s'y comptait par rang ne bouge,
  // vendu comme les autres (`COMPAGNONS_DE_LA_BOUTIQUE` ne retient que ceux qui ne
  // se gagnent pas — les cinq, la luciole comprise depuis le 31 octobre 2026). Sa métamorphose, le panda des cerisiers, a été
  // choisie par le propriétaire parmi quatre thèmes (neige, nuages, cascade, sakura) :
  // celle des Nuages est peinte, et attend sa règle avec l'ombre des autres.
  [
    'panda',
    'Le Panda roux',
    'le',
    '🐼',
    'Un panda roux au poil de braise, le museau crème et de grands yeux d’ambre : il garde sa queue rayée enroulée contre lui.',
    [
      ['bebe', 'Le bébé panda roux', 'Tout rond et tout duveteux, ses grands yeux d’ambre et sa queue rayée enroulée autour de lui.'],
      ['jeune', 'Le jeune panda roux', 'Dégingandé et curieux, dans une bambouseraie à l’aube.'],
      ['adulte', 'Le panda roux adulte', 'Sur une branche moussue, au-dessus d’une forêt de brume et d’érables.'],
      ['erable', 'Le panda des érables', 'Son poil de braise, ses feuilles d’or qui tourbillonnent : elles sortent du cercle.'],
    ],
    ['sakura', 'Le panda des cerisiers', 'Poil rose nacré, pétales qui tourbillonnent, une longue queue de fleurs.'],
  ],
]

/** Les cinq compagnons, tous en boutique, dans l'ordre de ses rayons : la luciole, venue de l'Expédition, puis le panda roux. */
export const COMPAGNONS: readonly Compagnon[] = CATALOGUE.map(([key, nom, le, emoji, phrase, formes, lumiere, gagne]) => {
  const c: Compagnon = {
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
  }
  if (lumiere) c.lumiere = { key: `cp:${key}-${lumiere[0]}`, compagnon: key, rang: 3, nom: lumiere[1], legende: lumiere[2], rarete: 'legendaire', metamorphose: true }
  if (gagne) c.gagne = gagne
  return c
})

/**
 * Ceux que la boutique vend — les cinq, la luciole comprise depuis le 31
 * octobre 2026 : son rayon, l'achat, le coffre et « À la une » ne
 * connaissent qu'eux — un compagnon qui se gagnerait ailleurs ne s'y
 * montrerait même pas en silhouette.
 */
export const COMPAGNONS_DE_LA_BOUTIQUE: readonly Compagnon[] = COMPAGNONS.filter(c => !c.gagne)

/** Le compagnon qu'offre la première salle complète du Cabinet (et qu'amenait la Première traversée de l'Expédition) : la luciole. */
export const COMPAGNON_DE_L_EXPEDITION: CleDeCompagnon = 'luciole'

/** Leurs vingt formes, compagnon après compagnon. */
export const FORMES_DES_COMPAGNONS: readonly FormeDeCompagnon[] = COMPAGNONS.flatMap(c => c.formes)

/** Leurs métamorphoses de lumière, à part : elles ne se gagnent pas en grandissant. */
export const METAMORPHOSES: readonly FormeDeCompagnon[] = COMPAGNONS.flatMap(c => c.lumiere ?? [])

const PAR_CLE = new Map([...FORMES_DES_COMPAGNONS, ...METAMORPHOSES].map(f => [f.key, f]))
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

/**
 * Ce qui amène la luciole, en mots : la Première traversée, et depuis le
 * 25 octobre 2026 la première salle complète du Cabinet de curiosités : son
 * départ fermé, l'Expédition ne l'amènerait plus à personne de neuf.
 * Le Cabinet fermé en production (`CABINET_EN_PRODUCTION`), sa voie ne se dit
 * pas : elle enverrait chercher une page qui n'y répond pas — la préproduction
 * la tait donc aussi d'ici l'ouverture, comme la voie de ses gardiens dans
 * l'album (`voiesMontrees`). L'expédition, elle, se tait quand l'album la tait
 * (`voieDeLExpeditionDite`, son départ fermé : `EXPEDITION_REMPLACEE`) — le
 * Cabinet ouvert seulement : sans lui, elle reste la seule à dire, comme dans
 * la galerie (`venuesDeLaLuciole`). Écrite en dur, elle se serait dite au refus
 * le jour où l'album la tait. `cabinet` et `remplacee` forcent les drapeaux.
 */
export const cheminDeLaLuciole = (cabinet: boolean = CABINET_EN_PRODUCTION, remplacee: boolean = EXPEDITION_REMPLACEE): string =>
  [!cabinet || voieDeLExpeditionDite(remplacee) ? 'mène une expédition au bout' : '', cabinet ? 'complète une salle du Cabinet' : ''].filter(Boolean).join(', ou ')

/**
 * Le refus fait à qui règle, porte ou installe un compagnon qu'il n'a pas :
 * où l'obtenir — la boutique, la luciole comprise depuis le 31 octobre 2026 ;
 * un compagnon qui se gagnerait, son chemin.
 */
export const pourLAvoir = (c: Compagnon, cabinet: boolean = CABINET_EN_PRODUCTION, remplacee: boolean = EXPEDITION_REMPLACEE): string =>
  c.gagne === 'expedition' ? `${c.nom} se gagne d’abord : ${cheminDeLaLuciole(cabinet, remplacee)}` : `${c.nom} s’achète d’abord, à la boutique`

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
  /**
   * Le nom qu'il lui a donné, s'il lui en a donné un : sa carte le montre à
   * qui l'ouvre (le propriétaire, le 19 octobre 2026), l'instantané de la
   * salle jamais.
   */
  nom?: string
  /**
   * Le rang de la forme qu'il montre dans sa niche, s'il en a choisi une
   * d'avant la plus haute — ou sa métamorphose (`MONTREE_DE_LA_METAMORPHOSE`) ;
   * absent, la plus haute — il grandit alors sous ses yeux. Une forme
   * atteinte reprend la place (`formeDansLaNiche`).
   */
  montree?: number
  /**
   * L'Éclat brille sur lui — tombé sur l'une de ses formes, et pas éteint
   * (`brilleChez`) : à sa forme ultime, il lui ouvre sa métamorphose
   * (`metamorphoseOuverte`). Le serveur le dit : la niche ne lit pas les
   * Éclats, et sa fiche se relit seule à l'ouverture (`GET /api/joueur/niche`).
   */
  eclat?: true
  /**
   * Les paliers de sa niche atteints avec lui, après sa forme ultime
   * (`PALIERS_DE_LA_NICHE`, `shared/ornements.ts`) : de 1 à 4, chacun son
   * ornement, jamais perdu. Absent avant le premier.
   */
  paliers?: number
  /** Ce qu'il a réglé de ses ornements, quand ce n'est pas le style d'office (`{ guirlande: 'cache' }`) ; absent : tous montrés. */
  ornements?: ReglageDesOrnements
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

/**
 * Sa métamorphose s'ouvre-t-elle à lui ? Sa forme ultime atteinte, et l'Éclat
 * sur lui — tombé avant ou après, sur n'importe laquelle de ses formes : il
 * suit le compagnon qui grandit (`clesQuiBrillent`). Jamais pour un compagnon
 * qui n'en a pas : éclaté, il garde ses paillettes, rien de plus.
 */
export const metamorphoseOuverte = (a: Pick<CompagnonPossede, 'compagnon' | 'rang' | 'eclat'>): boolean =>
  a.rang >= 3 && !!a.eclat && !!compagnon(a.compagnon)?.lumiere

/** Les clés des formes que ces compagnons laissent porter : chacun jusqu'à sa plus haute, et sa métamorphose si elle s'est ouverte. */
export function formesOuvertes(possedes: readonly CompagnonPossede[]): string[] {
  return possedes.flatMap(a => {
    const c = compagnon(a.compagnon)
    if (!c) return []
    return [...c.formes.filter(f => f.rang <= a.rang).map(f => f.key), ...(c.lumiere && metamorphoseOuverte(a) ? [c.lumiere.key] : [])]
  })
}

/** La plus haute forme qu'il a de ce compagnon. */
export function formeLaPlusHaute(a: CompagnonPossede): FormeDeCompagnon | undefined {
  return compagnon(a.compagnon)?.formes[a.rang]
}

/**
 * La forme qu'il montre dans sa niche : celle qu'il a choisie, si elle est
 * atteinte — sa métamorphose, si elle s'est ouverte —, sinon sa plus haute.
 */
export function formeDansLaNiche(a: CompagnonPossede): FormeDeCompagnon | undefined {
  const c = compagnon(a.compagnon)
  if (!c) return undefined
  if (a.montree === MONTREE_DE_LA_METAMORPHOSE && c.lumiere && metamorphoseOuverte(a)) return c.lumiere
  return c.formes[a.montree !== undefined && a.montree >= 0 && a.montree <= a.rang ? a.montree : a.rang]
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
