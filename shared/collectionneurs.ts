// Les collectionneurs : la valeur d'une collection, et le classement des
// joueurs par elle et par catégorie (le 9 novembre 2026, la maquette
// `retours/2026-11-09/classement-des-collections/`, synthèse retouchée,
// « c'est parfait », le propriétaire).
//
// « Donner une valeur à la collection » : chaque pièce vaut sa gemme, celle
// que l'album lui donne déjà (`shared/album.ts`) — une échelle que tout le
// monde a vue, plutôt qu'une de plus à apprendre. Des carats : un mot à elle,
// ni les points d'un quiz ni les confettis qu'on dépense — une collection ne
// se vend pas.
//
// Les Divins comptent, et se montrent (le choix du propriétaire, le même
// jour : « c'est uniquement la condition d'obtention qui ne doit pas être
// dévoilée, mais justement en avoir un devrait être vraiment mis en avant ») :
// la plus haute gemme. Rien ici ne dit comment ils descendent, ni quand.
//
// Pur et partagé : le serveur compte et classe en fond, la page reclasse ses
// amis et dit ce qui manque pour passer quelqu'un. Les constantes sont des
// choix de produit (`docs/reference/baremes.md`) : relues à chaque relevé,
// elles changent d'un coup la valeur de tous, sans rien écrire.

import { classer, type Classe } from './classement'
import type { RareteDAvatar } from './album'
import type { RareteDeTheme } from './themes'
import type { CleDeLigue, BordureDeLigue } from './duels'
import type { CleDeBranche } from './branches'
import type { ApparenceDeLAvatar } from './profil'
import { MATIERES_POUR_L_OPALE, OPALE, type Matiere, type MatiereTaillee } from './matieres'

// ── Le barème ─────────────────────────────────────────────────────────────

/**
 * Un avatar de l'album, à sa gemme — légendaires, portraits des sentiers,
 * formes des compagnons, emojis de collection. Un Divin vaut huit
 * légendaires : un légendaire taillé dans les quatre matières, cinq Éclats,
 * en vaut six — le Divin reste la pièce la plus chère (le propriétaire, le
 * 9 novembre 2026 : « passe-le à 200 »).
 */
export const CARATS_DE_LA_GEMME: Readonly<Record<RareteDAvatar, number>> = { commune: 1, peucommune: 2, rare: 5, epique: 10, legendaire: 25, divin: 200 }

/**
 * Un Éclat posé vaut un légendaire — qu'il fasse éclater un avatar ou y
 * taille une matière : chaque matière coûte un Éclat, et La Pluie d'Éclats
 * les compte déjà ensemble (`eclatsPosesOf`). Une matière n'est pas un
 * avatar de plus — le Phénix en jade reste un légendaire —, mais elle vaut
 * ce qu'elle a coûté. L'Opale, qu'aucun Éclat ne paie, ne compte pas ; la
 * réserve non plus, tant qu'elle n'est pas posée.
 */
export const CARATS_D_UN_ECLAT = 25

/** Un palier de maître des sentiers : ce qu'il coûte vaut un légendaire. */
export const CARATS_D_UN_MAITRE = 25

/** Un défi d'une carte du Cabinet, au métal de son rang le plus haut tenu. */
export const CARATS_DU_SCEAU: Readonly<{ bronze: number; argent: number; or: number }> = { bronze: 2, argent: 5, or: 10 }

/** Un autre trophée — une étape de piste, un exploit, un coup du sort —, un timbre du carnet des fêtes. */
export const CARATS_D_UN_TROPHEE = 2
export const CARATS_D_UN_TIMBRE = 2

/** Un thème, à sa gemme ; les deux offerts à tous ne valent rien. */
export const CARATS_DU_THEME: Readonly<Record<RareteDeTheme, number>> = { offert: 0, commune: 1, peucommune: 2, rare: 5, epique: 10, legendaire: 25 }

export const CARATS_D_UN_FOND = 3
export const CARATS_D_UNE_GERBE = 3
export const CARATS_D_UNE_FINITION = 2

/** Une bordure par ligue atteinte aux duels, à sa hauteur. */
export const CARATS_DE_LA_LIGUE: Readonly<Record<CleDeLigue, number>> = { bronze: 1, argent: 2, or: 5, platine: 10, diamant: 25, maitre: 50 }

// ── Le relevé d'un joueur ─────────────────────────────────────────────────

/**
 * Ce que le serveur relève d'une collection, pour la compter : des nombres,
 * et ce que sa carte montre déjà de lui (ses légendaires, ses Divins
 * descendus, ses maîtres). Le style — ses thèmes, ses fonds, ses gerbes — ne
 * se compte qu'au serveur : la page n'en reçoit que la valeur.
 */
export interface ReleveDeCollection {
  niveau: number
  /** Les avatars de l'album qu'il a, gemme par gemme, ses Divins compris (`pagesDeLAlbum`). */
  gemmes: Readonly<Record<RareteDAvatar, number>>
  /** Ses légendaires (`lg:…`) et ses Divins descendus (`dv:…`), tels que sa carte les montre au dos. */
  legendaires: readonly string[]
  divins: readonly string[]
  /** Ses Éclats posés : avatars éclatés et matières taillées. */
  eclats: number
  /** Les sentiers dont il a validé le palier de maître, et ses paliers validés sur les 144 (les maîtres à part). */
  maitres: readonly CleDeBranche[]
  paliers: number
  /** Les dix cartes du Cabinet, chacune au rang le plus haut de son défi. */
  sceaux: { bronze: number; argent: number; or: number }
  /** Ses autres trophées et ses timbres. */
  trophees: number
  timbres: number
}

/** Le style, compté au serveur seulement : combien, jamais lesquels — le thème et la gerbe qu'on porte ne partent qu'à soi. */
export interface StyleDeCollection {
  themes: Readonly<Partial<Record<RareteDeTheme, number>>>
  fonds: number
  gerbes: number
  finitions: number
  ligues: readonly CleDeLigue[]
}

export type FamilleDeCarats = 'avatars' | 'trophees' | 'style'

export const FAMILLES_DE_CARATS: readonly FamilleDeCarats[] = ['avatars', 'trophees', 'style']

const somme = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0)

/** Ce que vaut chacune de ses trois familles, et le tout. */
export function caratsDeLaCollection(r: ReleveDeCollection, style: StyleDeCollection): Record<FamilleDeCarats, number> & { total: number } {
  const avatars = somme((Object.keys(CARATS_DE_LA_GEMME) as RareteDAvatar[]).map(g => (r.gemmes[g] ?? 0) * CARATS_DE_LA_GEMME[g])) + r.eclats * CARATS_D_UN_ECLAT
  const trophees =
    r.maitres.length * CARATS_D_UN_MAITRE +
    r.sceaux.bronze * CARATS_DU_SCEAU.bronze +
    r.sceaux.argent * CARATS_DU_SCEAU.argent +
    r.sceaux.or * CARATS_DU_SCEAU.or +
    r.trophees * CARATS_D_UN_TROPHEE +
    r.timbres * CARATS_D_UN_TIMBRE
  const parTheme = somme((Object.keys(style.themes) as RareteDeTheme[]).map(t => (style.themes[t] ?? 0) * CARATS_DU_THEME[t]))
  const styleTotal =
    parTheme +
    style.fonds * CARATS_D_UN_FOND +
    style.gerbes * CARATS_D_UNE_GERBE +
    style.finitions * CARATS_D_UNE_FINITION +
    somme(style.ligues.map(l => CARATS_DE_LA_LIGUE[l]))
  return { avatars, trophees, style: styleTotal, total: avatars + trophees + styleTotal }
}

/**
 * Ce que vaut une pièce de sa vitrine : sa gemme, son Éclat, et chaque
 * matière qu'il y a taillée — un Éclat chacune ; l'Opale, que les quatre
 * ouvrent, ne coûte rien de plus. Un Divin ne prend ni Éclat ni matière
 * (invariant 21) : sa gemme seule.
 */
export function caratsDeLaPiece(gemme: RareteDAvatar, eclate = false, taillees = 0): number {
  if (!eclate || gemme === 'divin') return CARATS_DE_LA_GEMME[gemme]
  return CARATS_DE_LA_GEMME[gemme] + (1 + taillees) * CARATS_D_UN_ECLAT
}

/** La version d'une pièce à montrer sur son socle : l'Opale quand les quatre y sont taillées, sinon la matière qu'il en porte, sinon sa version rare. */
export function versionDeLaPiece(taillees: readonly MatiereTaillee[], portee?: Matiere | null): true | Matiere {
  if (taillees.length >= MATIERES_POUR_L_OPALE) return OPALE
  return portee && portee !== OPALE && (taillees as readonly string[]).includes(portee) ? portee : true
}

// ── La fiche et le classement ─────────────────────────────────────────────

/** Un collectionneur, tel que la page le reçoit : qui il est, ce qu'il porte, ce qu'il a, ce que ça vaut. */
export interface FicheDeCollectionneur extends ReleveDeCollection, ApparenceDeLAvatar {
  id: string
  /** Le prénom affiché — « Camille (2) » à un homonyme (`nomsAffiches`). */
  nom: string
  /** L'emoji de son inscription, sous ce qu'il porte. */
  avatar: string
  bordure?: BordureDeLigue | null
  /** Sa ligue aux duels : le cadre de sa carte. */
  ligue?: CleDeLigue
  carats: number
  familles: Record<FamilleDeCarats, number>
}

/** Ce qu'on classe : la valeur, puis ce que chacun a fait. */
export type CategorieDeCollection = 'collection' | 'niveau' | 'maitres' | 'legendaires' | 'cabinet' | 'eclats'

export const CATEGORIES_DE_COLLECTION: readonly CategorieDeCollection[] = ['collection', 'niveau', 'maitres', 'legendaires', 'cabinet', 'eclats']

export interface DefinitionDeCategorie {
  /** Le nom de sa puce. */
  court: string
  /** L'unité au singulier et au pluriel : « Encore 2 maîtres pour passer Sacha ». */
  unite: readonly [string, string]
  /** Son plafond, quand il y en a un : « 9 sur 12 ». */
  sur?: number
  /** Ce qui, à zéro, fait entrer au classement : l'absence, pas « 87ᵉ avec 0 ». */
  premier: string
}

export const CATEGORIE: Readonly<Record<CategorieDeCollection, DefinitionDeCategorie>> = {
  collection: { court: 'Collection', unite: ['carat', 'carats'], premier: 'Ta première pièce gagnée te place ici.' },
  niveau: { court: 'Niveau', unite: ['niveau', 'niveaux'], premier: 'Ton premier niveau gagné te place ici.' },
  maitres: { court: 'Maîtres', unite: ['maître', 'maîtres'], sur: 12, premier: 'Ton premier palier de maître te place ici.' },
  legendaires: { court: 'Légendaires', unite: ['légendaire', 'légendaires'], sur: 32, premier: 'Ton premier légendaire te place ici.' },
  cabinet: { court: 'Cabinet', unite: ['sceau d’or', 'sceaux d’or'], sur: 10, premier: 'Ton premier défi de carte tenu à l’Or te place ici.' },
  eclats: { court: 'Éclats', unite: ['Éclat', 'Éclats'], premier: 'Ton premier Éclat te place ici.' },
}

/** Le niveau de tout profil qui naît : il ne classe personne. */
export const NIVEAU_DE_DEPART = 1

/** Ce qui le classe dans une catégorie. */
export function valeurDansLaCategorie(f: Pick<FicheDeCollectionneur, 'carats' | 'niveau' | 'maitres' | 'legendaires' | 'sceaux' | 'eclats'>, c: CategorieDeCollection): number {
  switch (c) {
    case 'collection':
      return f.carats
    case 'niveau':
      // Le premier niveau est à tout le monde : classé, chaque profil qui n'a jamais joué y aurait sa place, dernier.
      return f.niveau > NIVEAU_DE_DEPART ? f.niveau : 0
    case 'maitres':
      return f.maitres.length
    case 'legendaires':
      return f.legendaires.length
    case 'cabinet':
      return f.sceaux.or
    case 'eclats':
      return f.eclats
  }
}

/**
 * Le classement d'une catégorie : la règle de tous les classements
 * (`shared/classement.ts`, invariant 15) — rang partagé, ordre d'affichage
 * par le nom puis l'identifiant. Qui n'a rien de ce qu'on classe n'y est
 * pas : ni dernier ex æquo, ni « 0 sur 10 ».
 */
export function classerLesCollectionneurs<T extends Pick<FicheDeCollectionneur, 'id' | 'nom' | 'carats' | 'niveau' | 'maitres' | 'legendaires' | 'sceaux' | 'eclats'>>(
  fiches: readonly T[],
  c: CategorieDeCollection,
): Classe<T>[] {
  const valeur = (f: T) => valeurDansLaCategorie(f, c)
  return classer(
    fiches.filter(f => valeur(f) > 0),
    valeur,
    f => f.nom,
    f => f.id,
  )
}

/** Le plus proche strictement devant lui, et ce qui lui manque pour le passer — un ex æquo n'est ni devant ni derrière. */
export function celuiAPasser<T>(classes: readonly Classe<T>[], index: number, valeur: (t: T) => number): { item: T; manque: number } | null {
  const sienne = valeur(classes[index].item)
  for (let i = index - 1; i >= 0; i--) {
    const v = valeur(classes[i].item)
    if (v > sienne) return { item: classes[i].item, manque: v - sienne + 1 }
  }
  return null
}

// ── Les rangs de collection ───────────────────────────────────────────────

/**
 * Les rangs d'une collection, nommés d'après ce qu'elle remplit — jamais
 * d'après celui qui la tient : « La vitrine » se dit de chacun, sans accord
 * à faire.
 */
export const RANGS_DE_COLLECTION: readonly { nom: string; depuis: number }[] = [
  { nom: 'Le tiroir', depuis: 0 },
  { nom: 'Le coffret', depuis: 100 },
  { nom: 'La vitrine', depuis: 300 },
  { nom: 'La galerie', depuis: 600 },
  { nom: 'Le musée', depuis: 1000 },
  { nom: 'Le palais', depuis: 1500 },
]

export function rangDeCollection(carats: number): { nom: string; depuis: number } {
  let rang = RANGS_DE_COLLECTION[0]
  for (const r of RANGS_DE_COLLECTION) if (carats >= r.depuis) rang = r
  return rang
}

// ── Ce que la page reçoit ─────────────────────────────────────────────────

export interface PlaceDeCollectionneur {
  id: string
  rang: number
  valeur: number
}

export interface CategorieDuClassement {
  /** Combien y sont classés. */
  classes: number
  /** Les premiers, dans l'ordre : le podium, puis la liste. */
  tete: PlaceDeCollectionneur[]
  /** Sa place, s'il y est classé ; ses voisins, s'il est plus bas que la tête. */
  moi?: PlaceDeCollectionneur
  autour: PlaceDeCollectionneur[]
}

/** Un Divin descendu, et qui le garde parmi les classés : sa salle, sous sa place. */
export interface DivinDescendu {
  cle: string
  porteurs: string[]
}

export interface ClassementDesCollections {
  /** Quand le relevé de tous a été fait — le sien est de l'instant. */
  releve: number
  /** Lui : sa fiche est parmi les fiches, s'il en a une. */
  moi: string
  /** Toutes les fiches que la page montre : les têtes, lui, ses voisins, ses amis, les porteurs des Divins. */
  fiches: FicheDeCollectionneur[]
  categories: Record<CategorieDeCollection, CategorieDuClassement>
  /** Ses amis : la page les reclasse, lui compris (`classerLesCollectionneurs`). */
  amis: string[]
  /** Les Divins descendus, dans l'ordre du catalogue, et qui les garde parmi les classés. */
  divins: DivinDescendu[]
  /** Le premier relevé de tous se fait encore, après un premier démarrage : la page le redemande dans un instant. */
  enPreparation?: true
}

/** Une pièce de sa vitrine : sa clé, sa gemme, la version qu'elle montre — rare, ou la matière qu'il en porte —, ses matières taillées, ce qu'elle vaut. */
export interface PieceDeVitrine {
  cle: string
  gemme: RareteDAvatar
  eclat?: true | Matiere
  taillees?: number
  carats: number
}

export interface VitrineDUnCollectionneur {
  fiche: FicheDeCollectionneur
  /** Sa place à la collection, s'il y est classé, et sur combien. */
  rang?: number
  classes: number
  /** Ses pièces maîtresses : ses Divins d'abord, puis ce qui vaut le plus. */
  pieces: PieceDeVitrine[]
}

/** Ce que le gros bouton de son profil dit de lui : sa place à la collection, sur combien, et ce qu'elle vaut — au dernier relevé. */
export interface ResumeDuCollectionneur {
  rang?: number
  classes: number
  carats: number
}

// ── Le face-à-face ────────────────────────────────────────────────────────

export interface LigneDuFaceAFace {
  nom: string
  moi: number
  lui: number
  /** La ligne des Divins, en opale. */
  divine?: true
}

/**
 * Les lignes qu'on compare, de ce qu'on a à ce qu'on a fait — les Divins
 * d'abord. Pas de ligne pour les thèmes (le propriétaire, le 9 novembre
 * 2026 : « gagner sur quelqu'un en fonction des thèmes, je ne suis pas fan ») :
 * ils s'achètent, et l'on ne se mesure pas à ce qu'on a payé ; ils restent
 * dans la valeur. Ce que ni l'un ni l'autre n'a ne se compare pas : « 0
 * contre 0 » ne dit rien de personne.
 */
export function lignesDuFaceAFace(moi: FicheDeCollectionneur, lui: FicheDeCollectionneur): LigneDuFaceAFace[] {
  const avatars = (f: FicheDeCollectionneur) => somme(Object.values(f.gemmes))
  const trophees = (f: FicheDeCollectionneur) => f.trophees + f.maitres.length + f.sceaux.bronze + f.sceaux.argent + f.sceaux.or
  const lignes: LigneDuFaceAFace[] = [
    { nom: 'Divins', moi: moi.divins.length, lui: lui.divins.length, divine: true },
    { nom: 'Avatars', moi: avatars(moi), lui: avatars(lui) },
    { nom: 'Légendaires', moi: moi.legendaires.length, lui: lui.legendaires.length },
    { nom: 'Maîtres des sentiers', moi: moi.maitres.length, lui: lui.maitres.length },
    { nom: 'Paliers des sentiers', moi: moi.paliers, lui: lui.paliers },
    { nom: 'Sceaux d’or du Cabinet', moi: moi.sceaux.or, lui: lui.sceaux.or },
    { nom: 'Éclats', moi: moi.eclats, lui: lui.eclats },
    { nom: 'Trophées', moi: trophees(moi), lui: trophees(lui) },
    { nom: 'Niveau', moi: moi.niveau, lui: lui.niveau },
  ]
  return lignes.filter(l => l.moi > 0 || l.lui > 0)
}

/** Qui mène, ligne à ligne : ses lignes, les miennes, les égalités. */
export function bilanDuFaceAFace(lignes: readonly LigneDuFaceAFace[]): { moi: number; lui: number; egalites: number } {
  return {
    moi: lignes.filter(l => l.moi > l.lui).length,
    lui: lignes.filter(l => l.lui > l.moi).length,
    egalites: lignes.filter(l => l.lui === l.moi).length,
  }
}

/** Combien de pièces maîtresses une vitrine montre. */
export const PIECES_DE_LA_VITRINE = 3

/** Les plus belles pièces d'abord : un Divin, puis la valeur, puis l'ordre du catalogue qu'on leur a donné. */
export function piecesMaitresses(pieces: readonly PieceDeVitrine[], n = PIECES_DE_LA_VITRINE): PieceDeVitrine[] {
  return [...pieces]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.carats - a.p.carats || a.i - b.i)
    .slice(0, n)
    .map(x => x.p)
}
