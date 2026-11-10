// Le classement des collectionneurs (la maquette du 9 novembre 2026,
// `retours/2026-11-09/classement-des-collections/`, « c'est parfait », le
// propriétaire) : la valeur de chaque collection en carats
// (`shared/collectionneurs.ts`), et la place de chacun, catégorie par
// catégorie.
//
// « Attention à la performance pour ne pas geler le serveur » (le même jour).
// Le relevé de tous ne se fait jamais sur le chemin d'une requête : en fond,
// quand le dernier a vieilli (`RELEVE_GARDE_MS`), un seul à la fois, par
// tranches qui rendent la main (`rendreLaMain`) et laissent passer la
// question d'une soirée (`laisserPasserLaSalle`) — les profils lus par
// paquets (`byIds`), puis tenus en mémoire ; les sentiers, les thèmes achetés
// et le quiz du jour de tous d'un lot chacun ; les ligues de la mémoire des
// duels. Gardé dans `meta`, il survit aux réveils de l'hébergeur, qui ne
// relisent rien. La page lit la mémoire ; seule la fiche du visiteur se
// refait à sa visite, d'un aller-retour par magasin, de front : sa collection
// est de l'instant, celle des autres du dernier relevé.

import type { BordureDeLigue, CleDeLigue } from '../../../shared/duels'
import type { Paliers } from '../../../shared/branches'
import type { CompagnonPossede } from '../../../shared/compagnons'
import type { Finition, ApparenceDeLAvatar } from '../../../shared/profil'
import type { Matiere, MatiereTaillee } from '../../../shared/matieres'
import { RARETES_D_AVATAR, avatarDeLAlbum, avatarsALui, type ProfilDeLAlbum, type RareteDAvatar } from '../../../shared/album'
import { albumDesTrophees, type CleDeSection, type ProfilDeLAlbumDesTrophees } from '../../../shared/trophees'
import { theme, type RareteDeTheme } from '../../../shared/themes'
import { GERBE_PAR_DEFAUT } from '../../../shared/gerbes'
import { PALIERS_DU_SENTIER, maitresDe } from '../../../shared/sentiers'
import { DIVINS } from '../../../shared/divins'
import { nomsAffiches } from '../../../shared/homonymes'
import { rangDansLesTries } from '../../../shared/classement'
import {
  CARATS_DE_LA_GEMME,
  CARATS_DE_LA_LIGUE,
  CARATS_DU_SCEAU,
  CARATS_DU_THEME,
  CARATS_D_UNE_FINITION,
  CARATS_D_UNE_GERBE,
  CARATS_D_UN_ECLAT,
  CARATS_D_UN_FOND,
  CARATS_D_UN_MAITRE,
  CARATS_D_UN_TIMBRE,
  CARATS_D_UN_TROPHEE,
  CARATS_DU_ZENITH,
  CATEGORIES_DE_COLLECTION,
  caratsDeLaCollection,
  caratsDeLaPiece,
  classerLesCollectionneurs,
  piecesMaitresses,
  valeurDansLaCategorie,
  versionDeLaPiece,
  type CategorieDeCollection,
  type CategorieDuClassement,
  type ClassementDesCollections,
  type FicheDeCollectionneur,
  type PieceDeVitrine,
  type PlaceDeCollectionneur,
  type ReleveDeCollection,
  type ResumeDuCollectionneur,
  type StyleDeCollection,
  type SuiteDuClassement,
  type VitrineDUnCollectionneur,
} from '../../../shared/collectionneurs'
import type { Classe } from '../../../shared/classement'
import type { ProfileRec, ProfileStore } from '../auth/profiles'
import type { CampagneStore } from './campagne'
import type { JourStore } from './jour'
import { laisserPasserLaSalle, rendreLaMain } from './tourniquet'
import { suivre, sousLeNom } from './gels'

// ── Le barème du relevé ───────────────────────────────────────────────────

/**
 * Combien de temps le relevé de tous se garde avant de se refaire, en fond, à
 * la visite suivante — la clé `collectionneurs` de `meta`, reprise au réveil.
 * Chaque relevé lit les épreuves validées, les achats et le quiz du jour de
 * tous, et les profils qu'un réveil n'a pas encore lus : plus court, le
 * classement des autres suit mieux, et coûte autant de fois plus au quota de
 * Turso. Sa propre fiche, elle, est de l'instant.
 */
export const RELEVE_GARDE_MS = 6 * 3_600_000

/** Raté, le relevé se retente au plus tous les tant : une base muette ne se fait pas relire à chaque visite. */
export const RELEVE_RETENTE_MS = 10 * 60_000

/** Sa fiche, refaite à sa visite, se garde tant : la page rouverte dans la minute — une vitrine, un retour — ne relit rien. */
export const FICHE_GARDEE_MS = 60_000

/** Les profils que le relevé charge d'un paquet (`byIds`) : six instructions chacun, décodées d'une traite au retour. */
export const PROFILS_PAR_PAQUET = 50

/** Les profils dont la collection se compte d'une traite, entre deux tours de boucle : un à deux millisecondes sur un vrai cœur. */
export const PROFILS_PAR_TRANCHE = 8

/** Les premiers de chaque catégorie que la page reçoit : le podium, puis la liste jusqu'au dixième. */
export const TETE_DU_CLASSEMENT = 10

/**
 * Les places d'un paquet de la suite (`suite`), demandé au toucher de « Voir
 * la suite » : de quoi voir tout le monde en quelques gestes, sans faire
 * grossir chaque visite de la page avec le nombre de profils.
 */
export const PAQUET_DE_LA_SUITE = 50

const CLE_DU_RELEVE = 'collectionneurs'

/**
 * La forme du relevé gardé, et la façon de le compter (`releveDeLaCollection`) :
 * une règle qui change la monte, et le relevé d'avant ne se relit pas — le
 * suivant le remplace au premier passage. La 2 compte les légendaires scellés
 * (l'étoile du zénith, le 9 novembre 2026) : une fiche d'avant n'en a pas. La
 * 3 garde les comptes de son style dans sa fiche (le même jour : sa vitrine
 * les montre, le face-à-face les compare) — une fiche d'avant n'en a que la
 * valeur. La 4 compte les bordures serties à la règle du 10 novembre 2026 —
 * une victoire sertit aussi les ligues d'en dessous (`releverLesDuels`) : le
 * relevé d'avant aurait classé six heures chacun à sa valeur de la veille,
 * contre sa propre fiche, refaite à sa visite avec ses bordures neuves.
 */
const VERSION_DU_RELEVE = 4

/**
 * Le barème avec lequel un relevé a été compté : relu sous un autre — une
 * constante changée —, il se refait au premier passage, au lieu de dire
 * l'ancienne valeur jusqu'au suivant.
 */
const EMPREINTE_DU_BAREME = JSON.stringify([
  CARATS_DE_LA_GEMME,
  CARATS_D_UN_ECLAT,
  CARATS_D_UN_MAITRE,
  CARATS_DU_ZENITH,
  CARATS_DU_SCEAU,
  CARATS_D_UN_TROPHEE,
  CARATS_D_UN_TIMBRE,
  CARATS_DU_THEME,
  CARATS_D_UN_FOND,
  CARATS_D_UNE_GERBE,
  CARATS_D_UNE_FINITION,
  CARATS_DE_LA_LIGUE,
])

// ── Ce qu'une collection vaut ─────────────────────────────────────────────

/** Ce que les autres magasins disent de lui au magasin des profils (`ProfileStore.collectionDe`). */
export interface AutresDeLaCollection {
  paliers: Paliers
  bordures: readonly BordureDeLigue[]
  /** Ses thèmes achetés, et leur prix (`ProfileStore.themesAchetes`). */
  achetes: ReadonlyMap<string, number>
  jour: { joues: number; victoires: number }
}

/**
 * Ce que la valeur d'une collection lit d'un profil (`ProfileStore.collectionDe`) :
 * les champs de « Ma collection » (`ProfilDeLaCollection`), aux mêmes règles —
 * sans ses écussons —, et ce qu'il porte, pour sa ligne.
 */
export interface ProfilDuCollectionneur
  extends Required<Pick<ProfilDeLAlbumDesTrophees, 'hautsFaits' | 'prix' | 'calendrier' | 'titresDates' | 'sentiers' | 'bordures'>>,
    Pick<ProfilDeLAlbumDesTrophees, 'defisDuCabinet'> {
  id: string
  nom: string
  /** Quand il est arrivé : l'ordre des homonymes (`nomsAffiches`, invariant 17). */
  creeLe: number
  avatar: string
  apparence: ApparenceDeLAvatar
  /** La bordure qu'il porte — jamais sous un Divin. */
  bordure: BordureDeLigue | null
  niveau: number
  legendaires: readonly string[]
  /** Ses légendaires scellés (`legendairesScelles`) : l'étoile du zénith, masquée ou non dans la loge. */
  scelles: readonly string[]
  /** Ses Divins descendus, par leur seule clé. */
  divins: readonly string[]
  compagnons: readonly CompagnonPossede[]
  /** Ses Éclats posés (`eclatsPosesOf`) : avatars éclatés et matières taillées, ni la réserve ni l'Opale. */
  eclatsPoses: number
  eclates: readonly string[]
  matieres: Readonly<Record<string, readonly MatiereTaillee[]>>
  portees: Readonly<Record<string, Matiere>>
  themes: readonly string[]
  fonds: readonly string[]
  gerbes: readonly string[]
  finitions: readonly Finition[]
  timbres: number
}

/**
 * Les sections de l'album des trophées qui se comptent à part : les maîtres
 * (un légendaire chacun), les défis du Cabinet (leurs sceaux), les ligues (le
 * style, à leur hauteur). Les écussons n'y sont pas : le relevé ne les lit pas.
 */
const SECTIONS_A_PART: ReadonlySet<CleDeSection> = new Set(['maitres', 'defis', 'ligues', 'ecussons'])

/**
 * La collection d'un profil, comptée : son relevé (`ReleveDeCollection`), son
 * style et ses pièces maîtresses. Les avatars de l'album à la gemme que
 * l'album leur donne (`avatarsALui`) ; ses trophées comme l'album les compte
 * (`albumDesTrophees`), une case par métal ; le reste comme « Ma
 * collection ». Les deux thèmes offerts, la gerbe et la finition de tous ne
 * valent rien : à tout le monde, ils ne disent rien de lui.
 */
export function releveDeLaCollection(p: ProfilDuCollectionneur): { releve: ReleveDeCollection; style: StyleDeCollection; pieces: PieceDeVitrine[] } {
  // L'album ne lit d'un Divin que sa clé : son récit n'est qu'à son porteur, et ne passe pas par ici.
  const album: ProfilDeLAlbum = { niveau: p.niveau, legendaires: [...p.legendaires], divins: p.divins.map(key => ({ key })) as ProfilDeLAlbum['divins'], sentiers: p.sentiers, compagnons: [...p.compagnons] }
  const gemmes = Object.fromEntries(RARETES_D_AVATAR.map(g => [g, 0])) as Record<RareteDAvatar, number>
  const eclates = new Set(p.eclates)
  // Ses légendaires scellés, parmi ceux qu'il a : la règle ne scelle rien d'autre, mais la valeur ne compte pas une étoile sans sa pièce.
  const scelles = p.scelles.filter(cle => p.legendaires.includes(cle))
  const pieces: PieceDeVitrine[] = []
  for (const cle of avatarsALui(album)) {
    const a = avatarDeLAlbum(cle)
    if (!a) continue
    gemmes[a.rarete]++
    const taillees = p.matieres[cle] ?? []
    const eclate = eclates.has(cle) && a.rarete !== 'divin'
    const scelle = scelles.includes(cle)
    pieces.push({
      cle,
      gemme: a.rarete,
      ...(eclate && { eclat: versionDeLaPiece(taillees, p.portees[cle]) }),
      ...(eclate && taillees.length > 0 && { taillees: taillees.length }),
      ...(scelle && { scelle: true as const }),
      carats: caratsDeLaPiece(a.rarete, eclate, taillees.length, scelle),
    })
  }
  const trophees = albumDesTrophees({
    hautsFaits: p.hautsFaits,
    prix: p.prix,
    calendrier: p.calendrier,
    titresDates: p.titresDates,
    sentiers: p.sentiers,
    bordures: p.bordures,
    defisDuCabinet: p.defisDuCabinet,
  })
    .flatMap(page => page.sections)
    .filter(s => !SECTIONS_A_PART.has(s.cle))
    .reduce((n, s) => n + s.acquis, 0)
  const rangs = Object.values(p.defisDuCabinet?.rangs ?? {})
  const themes: Partial<Record<RareteDeTheme, number>> = {}
  for (const cle of p.themes) {
    const rarete = theme(cle)?.rarete
    if (rarete) themes[rarete] = (themes[rarete] ?? 0) + 1
  }
  return {
    releve: {
      niveau: p.niveau,
      gemmes,
      legendaires: [...p.legendaires],
      divins: [...p.divins],
      scelles,
      eclats: p.eclatsPoses,
      maitres: maitresDe(p.sentiers),
      paliers: Object.values(p.sentiers).reduce((n: number, x) => n + Math.min(PALIERS_DU_SENTIER, x ?? 0), 0),
      sceaux: { bronze: rangs.filter(r => r === 1).length, argent: rangs.filter(r => r === 2).length, or: rangs.filter(r => r === 3).length },
      trophees,
      timbres: p.timbres,
    },
    style: {
      themes,
      fonds: p.fonds.length,
      gerbes: p.gerbes.filter(g => g !== GERBE_PAR_DEFAUT).length,
      finitions: p.finitions.filter(f => f !== 'mat').length,
      ligues: p.bordures.map(b => b.ligue),
    },
    pieces: piecesMaitresses(pieces),
  }
}

// ── Le relevé de tous ─────────────────────────────────────────────────────

/** Un collectionneur relevé : sa fiche — son prénom affiché se pose au rangement —, son prénom tel quel, son arrivée, ses pièces maîtresses. */
interface Entree {
  fiche: Omit<FicheDeCollectionneur, 'nom'>
  nom: string
  creeLe: number
  pieces: PieceDeVitrine[]
}

interface Releve {
  le: number
  entrees: Map<string, Entree>
}

/** Sa fiche, de ce que le magasin des profils a lu de lui. */
export function entreeDe(p: ProfilDuCollectionneur, ligue: CleDeLigue | undefined): Entree {
  const { releve, style, pieces } = releveDeLaCollection(p)
  const { total, ...familles } = caratsDeLaCollection(releve, style)
  return {
    fiche: {
      ...releve,
      id: p.id,
      avatar: p.avatar,
      ...p.apparence,
      ...(p.bordure && { bordure: p.bordure }),
      ...(ligue && { ligue }),
      carats: total,
      familles,
      style,
    },
    nom: p.nom,
    creeLe: p.creeLe,
    pieces,
  }
}

/** Rien à classer : ni pièce, ni niveau — l'absence, pas « dernier avec zéro ». */
const rienAClasser = (e: Entree) => CATEGORIES_DE_COLLECTION.every(c => valeurDansLaCategorie(e.fiche, c) <= 0)

/** Le relevé tel qu'il se garde dans `meta`. */
function enTexte(r: Releve): string {
  return JSON.stringify({ v: VERSION_DU_RELEVE, bareme: EMPREINTE_DU_BAREME, le: r.le, entrees: [...r.entrees.values()] })
}

/** Le relevé gardé, s'il est de la forme et du barème d'aujourd'hui. */
function releveLu(texte: string | null): Releve | null {
  if (!texte) return null
  const lu = JSON.parse(texte) as { v?: unknown; bareme?: unknown; le?: unknown; entrees?: unknown }
  if (lu.v !== VERSION_DU_RELEVE || lu.bareme !== EMPREINTE_DU_BAREME || typeof lu.le !== 'number' || !Array.isArray(lu.entrees)) return null
  return { le: lu.le, entrees: new Map((lu.entrees as Entree[]).map(e => [e.fiche.id, e])) }
}

/** Le classement d'une catégorie, rangé (`classerLesCollectionneurs`) : ses classés, la place de chacun, leurs valeurs dans l'ordre. */
interface CategorieRangee {
  classes: Classe<FicheDeCollectionneur>[]
  position: Map<string, number>
  valeurs: number[]
}

interface Rangement {
  fiches: Map<string, FicheDeCollectionneur>
  categories: Record<CategorieDeCollection, CategorieRangee>
}

export interface DepsDesCollectionneurs {
  profiles: Pick<ProfileStore, 'byIds' | 'cached' | 'idsExistants' | 'collectionDe' | 'themesAchetes' | 'lireLaMeta' | 'ecrireLaMeta'>
  campagne: Pick<CampagneStore, 'collectionneurDe' | 'paliersDeTous' | 'liguesDeTous'>
  jour: Pick<JourStore, 'resumeDe' | 'resumesDeTous' | 'estMasque' | 'versionDesExclus'>
}

const AUCUN_JOUR = { joues: 0, victoires: 0 }

export class Collectionneurs {
  /** Une question attend ses réponses dans une salle : le relevé l'attend (`laisserPasserLaSalle`). Branché par `server.ts`. */
  salleEnJeu?: () => boolean
  private readonly maintenant: () => number
  /** Le relevé gardé — lu dans `meta` une fois par démarrage, puis tenu à jour. */
  private releve: Promise<Releve | null> | null = null
  private releveTenu: Releve | null = null
  private enRoute: Promise<void> | null = null
  private tenteLe = -Infinity
  /** Monte à chaque fiche qui change : le rangement se refait derrière. */
  private version = 0
  private range: { cle: string; rangement: Rangement } | null = null
  /** Les fiches refaites à leur visite, et leurs amis : rouverte dans la minute, la page ne relit rien. */
  private siennes = new Map<string, { le: number; amis: string[] }>()
  private ferme = false

  constructor(
    private readonly deps: DepsDesCollectionneurs,
    options: { maintenant?: () => number } = {},
  ) {
    this.maintenant = options.maintenant ?? Date.now
  }

  /** Le serveur s'arrête : un relevé en route s'interrompt à sa prochaine tranche, sans rien écrire. */
  fermer(): void {
    this.ferme = true
  }

  /**
   * Sa page : sa place et ses voisins dans chaque catégorie, les têtes, ses
   * amis à reclasser, les Divins et qui les garde — de mémoire ; sa fiche
   * refaite, d'un aller-retour par magasin. Un relevé vieilli se refait en
   * fond, derrière la réponse : il ne se fait jamais attendre.
   */
  async pour(profileId: string): Promise<ClassementDesCollections> {
    const releve = await this.releveGarde()
    this.rafraichirSiPerime(releve)
    const amis = await this.saFiche(profileId, releve)
    const tenu = this.releveTenu
    if (!tenu) {
      // Le premier relevé se fait encore : sa fiche seule, et la page le redemande dans un instant.
      const sienne = this.ficheSeule(profileId)
      return { releve: 0, moi: profileId, fiches: sienne ? [sienne] : [], categories: categoriesVides(), amis: [], divins: [], enPreparation: true }
    }
    const rangement = this.rangement(tenu)
    const montrees = new Map<string, FicheDeCollectionneur>()
    const montrer = (id: string) => {
      const f = rangement.fiches.get(id)
      if (f) montrees.set(id, f)
    }
    const sienne = rangement.fiches.get(profileId) ?? this.ficheSeule(profileId)
    const categories = {} as Record<CategorieDeCollection, CategorieDuClassement>
    for (const cat of CATEGORIES_DE_COLLECTION) {
      const place = (c: Classe<FicheDeCollectionneur>): PlaceDeCollectionneur => (montrer(c.item.id), { id: c.item.id, rang: c.rang, valeur: valeurDansLaCategorie(c.item, cat) })
      const r = rangement.categories[cat]
      const tete = r.classes.slice(0, TETE_DU_CLASSEMENT).map(place)
      const i = r.position.get(profileId)
      const valeur = sienne ? valeurDansLaCategorie(sienne, cat) : 0
      // Masqué, il ne paraît chez personne, mais sa page dit sa place : celle que les classés lui feraient.
      const moi: PlaceDeCollectionneur | undefined = i !== undefined ? place(r.classes[i]) : sienne && valeur > 0 ? { id: profileId, rang: rangDansLesTries(valeur, r.valeurs), valeur } : undefined
      const autour = i !== undefined && i >= TETE_DU_CLASSEMENT ? r.classes.slice(i - 1, i + 2).map(place) : []
      categories[cat] = { classes: r.classes.length, tete, ...(moi && { moi }), autour }
    }
    if (sienne) montrees.set(profileId, sienne)
    for (const id of amis) montrer(id)
    // Les Divins descendus, dans l'ordre du catalogue, et qui les garde parmi les classés — dans l'ordre de la collection.
    const parCollection = rangement.categories.collection.classes
    const divins = DIVINS.flatMap(d => {
      const porteurs = parCollection.filter(c => c.item.divins.includes(d.key)).map(c => c.item.id)
      for (const id of porteurs) montrer(id)
      return porteurs.length > 0 ? [{ cle: d.key, porteurs }] : []
    })
    return { releve: tenu.le, moi: profileId, fiches: [...montrees.values()], categories, amis: amis.filter(id => montrees.has(id)), divins }
  }

  /**
   * La vitrine d'un collectionneur : sa fiche, sa place à la collection, ses
   * pièces maîtresses. Null pour un masqué ou un suspendu — sauf pour
   * lui-même —, ou qui n'a rien à montrer.
   */
  async vitrine(viewerId: string, profileId: string): Promise<VitrineDUnCollectionneur | null> {
    const releve = await this.releveGarde()
    this.rafraichirSiPerime(releve)
    if (profileId === viewerId) await this.saFiche(viewerId, releve)
    else if (this.exclu(profileId)) return null
    const tenu = this.releveTenu
    const e = tenu?.entrees.get(profileId)
    if (!tenu || !e) return null
    const r = this.rangement(tenu).categories.collection
    const i = r.position.get(profileId)
    const fiche = this.rangement(tenu).fiches.get(profileId) ?? { ...e.fiche, nom: e.nom }
    return { fiche, ...(i !== undefined && { rang: r.classes[i].rang }), classes: r.classes.length, pieces: e.pieces }
  }

  /**
   * La suite d'un classement, après sa tête : un paquet de places et leurs
   * fiches, de mémoire, comme la tête — rangées de même, sans masqué ni
   * suspendu. Rien tant que le premier relevé se fait : la page n'a pas de
   * tête à prolonger.
   */
  async suite(cat: CategorieDeCollection, depuis: number): Promise<SuiteDuClassement> {
    const releve = await this.releveGarde()
    this.rafraichirSiPerime(releve)
    const tenu = this.releveTenu
    if (!tenu) return { places: [], fiches: [], classes: 0 }
    const r = this.rangement(tenu).categories[cat]
    const paquet = r.classes.slice(depuis, depuis + PAQUET_DE_LA_SUITE)
    return {
      places: paquet.map(c => ({ id: c.item.id, rang: c.rang, valeur: valeurDansLaCategorie(c.item, cat) })),
      fiches: paquet.map(c => c.item),
      classes: r.classes.length,
    }
  }

  /**
   * Ce que le gros bouton de son profil dit de lui, de mémoire seule : sa
   * place au dernier relevé. Rien tant que le relevé n'est pas relu — il se
   * relit derrière, pour la page suivante.
   */
  resume(profileId: string): ResumeDuCollectionneur | undefined {
    if (!this.releve) void this.releveGarde()
    const tenu = this.releveTenu
    const e = tenu?.entrees.get(profileId)
    if (!tenu || !e) return undefined
    const r = this.rangement(tenu).categories.collection
    const i = r.position.get(profileId)
    return { ...(i !== undefined && { rang: r.classes[i].rang }), classes: r.classes.length, carats: e.fiche.carats }
  }

  // ── Le relevé gardé ───────────────────────────────────────────────────

  private releveGarde(): Promise<Releve | null> {
    this.releve ??= this.deps.profiles
      .lireLaMeta(CLE_DU_RELEVE)
      .then(releveLu)
      .catch(e => {
        console.error('[collectionneurs] le relevé gardé est illisible :', e)
        return null
      })
      .then(lu => {
        // Un relevé fait entre-temps par ce serveur passe devant celui de la base.
        this.releveTenu ??= lu
        return this.releveTenu
      })
    return this.releve
  }

  /** Un relevé absent ou vieilli se refait en fond — un seul à la fois, et pas plus d'une tentative toutes les dix minutes. */
  private rafraichirSiPerime(releve: Releve | null): void {
    if (releve && this.maintenant() - releve.le < RELEVE_GARDE_MS) return
    void this.relever()
  }

  /** Refait le relevé de tous, en fond ; rend la promesse de celui qui court déjà. */
  relever(): Promise<void> {
    if (this.enRoute) return this.enRoute
    if (this.maintenant() - this.tenteLe < RELEVE_RETENTE_MS) return Promise.resolve()
    this.tenteLe = this.maintenant()
    this.enRoute = this.releverTout()
      .catch(e => console.error('[collectionneurs] le relevé de tous n’a pas pu se faire :', e))
      .finally(() => {
        this.enRoute = null
      })
    return this.enRoute
  }

  private async releverTout(): Promise<void> {
    const tache = suivre('fond · collectionneurs')
    const laSalle = () => laisserPasserLaSalle(this.salleEnJeu, () => this.ferme, tache)
    try {
      await laSalle()
      const debut = this.maintenant()
      const [ids, paliers, achetes, jour, ligues] = await Promise.all([
        this.deps.profiles.idsExistants(),
        this.deps.campagne.paliersDeTous(),
        this.deps.profiles.themesAchetes(),
        this.deps.jour.resumesDeTous(),
        this.deps.campagne.liguesDeTous(),
      ])
      const tous = [...ids]
      const entrees = new Map<string, Entree>()
      for (let i = 0; i < tous.length; i += PROFILS_PAR_PAQUET) {
        await laSalle()
        await rendreLaMain()
        if (this.ferme) return
        // Un suspendu revient null : il n'est pas relevé.
        const profils = (await this.deps.profiles.byIds(tous.slice(i, i + PROFILS_PAR_PAQUET))).filter((p): p is ProfileRec => !!p)
        for (let j = 0; j < profils.length; j += PROFILS_PAR_TRANCHE) {
          await laSalle()
          await rendreLaMain()
          if (this.ferme) return
          for (const p of profils.slice(j, j + PROFILS_PAR_TRANCHE)) {
            const d = ligues.get(p.id)
            const e = entreeDe(this.deps.profiles.collectionDe(p, { paliers: paliers.get(p.id) ?? {}, bordures: d?.bordures ?? [], achetes: achetes.get(p.id) ?? new Map(), jour: jour.get(p.id) ?? AUCUN_JOUR }), d?.ligue)
            if (!rienAClasser(e)) entrees.set(p.id, e)
          }
        }
      }
      // Une fiche refaite à sa visite pendant le relevé est plus fraîche que la sienne : elle reste.
      const avant = this.releveTenu
      for (const [id, s] of this.siennes) {
        const e = avant?.entrees.get(id)
        if (e && s.le >= debut) entrees.set(id, e)
      }
      const releve: Releve = { le: debut, entrees }
      this.releveTenu = releve
      this.releve = Promise.resolve(releve)
      this.version++
      // Rangé tout de suite, en fond : la visite suivante le trouve fait.
      await rendreLaMain()
      sousLeNom('fond · collectionneurs', () => this.rangement(releve))
      await this.deps.profiles.ecrireLaMeta(CLE_DU_RELEVE, enTexte(releve))
    } finally {
      tache.finir()
    }
  }

  // ── Sa fiche ──────────────────────────────────────────────────────────

  /**
   * Sa fiche refaite, de ce que chaque magasin sait de lui — ses paliers et
   * ses amis d'un lot, ses thèmes, son quiz du jour —, et ses amis. Une base
   * qui se tait garde sa fiche du dernier relevé : la page s'ouvre quand même.
   */
  private async saFiche(profileId: string, releve: Releve | null): Promise<string[]> {
    const tenue = this.siennes.get(profileId)
    if (tenue && this.maintenant() - tenue.le < FICHE_GARDEE_MS) return tenue.amis
    const [p] = await this.deps.profiles.byIds([profileId])
    if (!p) return []
    try {
      const [campagne, achetes, jour, ligues] = await Promise.all([
        this.deps.campagne.collectionneurDe(profileId),
        this.deps.profiles.themesAchetes(profileId),
        this.deps.jour.resumeDe(profileId),
        this.deps.campagne.liguesDeTous(),
      ])
      const d = ligues.get(profileId)
      const e = sousLeNom('collectionneurs · sa fiche', () =>
        entreeDe(this.deps.profiles.collectionDe(p, { paliers: campagne.paliers, bordures: d?.bordures ?? [], achetes: achetes.get(profileId) ?? new Map(), jour }), d?.ligue),
      )
      this.retenir(e, releve)
      this.siennes.set(profileId, { le: this.maintenant(), amis: campagne.amis })
      return campagne.amis
    } catch (err) {
      console.error('[collectionneurs] sa fiche ne se refait pas :', err)
      return []
    }
  }

  /** Sa fiche dans le relevé tenu — s'il n'y en a pas encore, dans celui de demain : rangée, elle ne compte que si elle a changé. */
  private retenir(e: Entree, releve: Releve | null): void {
    const tenu = this.releveTenu ?? releve
    if (!tenu) {
      this.seules.set(e.fiche.id, e)
      return
    }
    const avant = tenu.entrees.get(e.fiche.id)
    if (avant && JSON.stringify(avant) === JSON.stringify(e)) return
    if (rienAClasser(e)) {
      if (!avant) return
      tenu.entrees.delete(e.fiche.id)
    } else tenu.entrees.set(e.fiche.id, e)
    this.version++
  }

  /** Les fiches refaites avant le premier relevé : la page les montre seules, le temps qu'il se fasse. */
  private seules = new Map<string, Entree>()

  private ficheSeule(profileId: string): FicheDeCollectionneur | undefined {
    const e = this.releveTenu?.entrees.get(profileId) ?? this.seules.get(profileId)
    return e && { ...e.fiche, nom: e.nom }
  }

  // ── Le rangement ──────────────────────────────────────────────────────

  /** Un masqué, un suspendu : ni classé, ni montré — sauf à lui-même. */
  private exclu(id: string): boolean {
    return this.deps.jour.estMasque(id) || !!this.deps.profiles.cached(id)?.disabledAt
  }

  /**
   * Les fiches et le classement de chaque catégorie, refaits quand une fiche
   * change, ou quand un masquage, une suspension change qui en est (la règle
   * de tous les classements, invariant 15 ; les homonymes marqués dans
   * l'ordre d'arrivée, invariant 17).
   */
  private rangement(releve: Releve): Rangement {
    const cle = `${this.version}#${this.deps.jour.versionDesExclus()}`
    if (this.range?.cle === cle) return this.range.rangement
    const entrees = [...releve.entrees.values()].filter(e => !this.exclu(e.fiche.id)).sort((a, b) => a.creeLe - b.creeLe || (a.fiche.id < b.fiche.id ? -1 : 1))
    const marques = nomsAffiches(entrees.map(e => ({ id: e.fiche.id, name: e.nom, avatar: e.fiche.avatar, ...(e.fiche.legendaire && { legendaire: e.fiche.legendaire }) })))
    const fiches = new Map(entrees.map(e => [e.fiche.id, { ...e.fiche, nom: marques.get(e.fiche.id) ?? e.nom }]))
    const liste = [...fiches.values()]
    const categories = {} as Record<CategorieDeCollection, CategorieRangee>
    for (const c of CATEGORIES_DE_COLLECTION) {
      const classes = classerLesCollectionneurs(liste, c)
      categories[c] = { classes, position: new Map(classes.map((x, i) => [x.item.id, i])), valeurs: classes.map(x => valeurDansLaCategorie(x.item, c)) }
    }
    const rangement = { fiches, categories }
    this.range = { cle, rangement }
    return rangement
  }
}

function categoriesVides(): Record<CategorieDeCollection, CategorieDuClassement> {
  return Object.fromEntries(CATEGORIES_DE_COLLECTION.map(c => [c, { classes: 0, tete: [], autour: [] }])) as unknown as Record<CategorieDeCollection, CategorieDuClassement>
}
