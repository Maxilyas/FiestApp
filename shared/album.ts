// L'album « Mes avatars » : tous les avatars qui se gagnent, en une seule
// collection rangée par rareté — la maquette 1, choisie par le propriétaire
// le 13 octobre 2026. « Ma collection » les séparait en trois lignes — le
// savoir, les légendaires et les Divins, les emojis de collection —, et les
// gens étaient « confus » (un retour qu'il avait reçu) : on ne savait ni ce
// qu'un portrait valait à côté d'un légendaire, ni où chercher le suivant.
// L'album les range comme les thèmes : une page par rareté, et chaque avatar
// dit où il se gagne.
//
// La rareté dit ce qu'il demande. Le visage d'un sentier et les emojis des
// premiers niveaux sont communs ; plus haut sur le sentier, plus rare ; sa
// forme ultime, au douzième palier, est légendaire — l'égale des trente et un
// légendaires des hauts faits et des fêtes. Les compagnons de la boutique de même, forme
// par forme : celle qu'on achète est commune, la forme ultime légendaire — et
// la métamorphose que l'Éclat lui ouvre, une forme de plus, aussi. La
// luciole aussi, qui se gagnait en expédition (le 20 octobre 2026) : elle
// s'achète comme les autres depuis le 31 octobre 2026, l'Expédition effacée.
// Les Divins ont leur page, et n'y disent rien d'eux :
// ni règle, ni lieu, ni progression (invariant 21).
//
// Depuis le 25 octobre 2026, le Cabinet de curiosités est un lieu de plus :
// vingt gardiens s'y réveillent, les trois de saison à leur fête — la luciole
// y vient en cadeau à la première salle complète, sans que l'album en fasse une
// voie : elle s'achète. L'album le tait tant qu'il est fermé en
// production (`CABINET_EN_PRODUCTION`, le drapeau du code, comme
// `voiesMontrees`) : il mènerait à une page qui n'y répond pas. Chaque lecture
// qui en dépend prend le drapeau (`cabinet`), pour lire l'album tel qu'il
// sera à l'ouverture.
//
// Une dérivation pure de ce que la page du profil reçoit déjà : « Ma
// collection » compte ses avatars par elle (`compteDeLaCollection`), une seule
// règle pour la ligne et pour le total.

import { NOM_RARETE, type Rarete } from './badges'
import { PORTRAITS, brancheDe, deLaBranche, portrait, portraitsOuverts } from './branches'
import { COLLECTION, COLLECTION_HAUTE } from './avatars'
import { DIVINS } from './divins'
import {
  LEGENDAIRES,
  estUneVoieDExpedition,
  legendaire,
  legendaireDeLExpedition,
  legendaireDuCabinet,
  partiesDe,
  voiesMontrees,
  type Legendaire,
  type SimpleCondition,
} from './legendaires'
// Les salles et leurs mots, pour dire ce qui réveille un gardien : l'album vient à la demande, dans « Ma collection »
// et la loge — l'accueil, la soirée et la page du profil ne le tirent pas (`album-des-avatars.test.ts` parcourt leurs
// imports), le Cabinet n'y part pas avec eux.
import { AUTRES_GARDIENS, GARDIENS_DES_SALLES, GARDIENS_DE_SAISON, conditionDuGardien, salle, salleDuGardien } from './cabinet/salles'
import { OEUVRES_DE_DEPART, oeuvresDeLaSalle } from './cabinet/oeuvres'
import { CABINET_EN_PRODUCTION } from './cabinet/ouverture'
import { NOM_PALIER, clePalier, hautFait, origineDe, regleDuPalier } from './hautsfaits'
import { saison } from './saisons'
import { recompensesDe } from './proches'
import { formatNumber } from './typographie'
import { COMPAGNONS, JUSTES_DES_FORMES, PRIX_D_UN_COMPAGNON, avecLui, compagnonDe, formeDeCompagnon, formesOuvertes, type Compagnon } from './compagnons'
import { CHANCE_ECLAT, CHANCE_ECLAT_DU_DEFI, type PublicProfileDetail } from './profil'

/** Les pages de l'album : les cinq raretés des thèmes, et les Divins à part. */
export type RareteDAvatar = Rarete | 'divin'

export const RARETES_D_AVATAR: readonly RareteDAvatar[] = ['commune', 'peucommune', 'rare', 'epique', 'legendaire', 'divin']

export const NOM_DE_RARETE_D_AVATAR: Readonly<Record<RareteDAvatar, string>> = { ...NOM_RARETE, divin: 'Divin' }

/** Le nom d'une gemme sous sa rangée : six tiennent sur un téléphone, abrégées ; le lecteur d'écran entend le nom entier. */
export const NOM_COURT_DE_RARETE_D_AVATAR: Readonly<Record<RareteDAvatar, string>> = {
  commune: 'Commune',
  peucommune: 'Peu com.',
  rare: 'Rare',
  epique: 'Épique',
  legendaire: 'Légend.',
  divin: 'Divin',
}

export type SorteDAvatar = 'legendaire' | 'divin' | 'portrait' | 'compagnon' | 'emoji'

/**
 * Où se gagne un avatar : en soirée, au quiz du jour, en campagne — ses
 * séries, ses défis —, sur les sentiers du savoir, en montant de niveau, à sa
 * saison, ou en boutique — un compagnon, qui grandit ensuite dans sa niche
 * (`niche`), et dont l'Éclat ouvre la métamorphose (`eclat`) —, en expédition,
 * au Cabinet de curiosités. La pastille de sa case, et l'icône de chacune de
 * ses voies.
 */
export type LieuDAvatar = 'soiree' | 'jour' | 'campagne' | 'sentiers' | 'niveau' | 'saison' | 'boutique' | 'niche' | 'eclat' | 'expedition' | 'cabinet'

export interface AvatarDeLAlbum {
  /** `lg:phenix`, `dv:seraphin`, `br:cerf`, `cp:loup-jeune`, ou l'emoji de collection lui-même. */
  cle: string
  sorte: SorteDAvatar
  rarete: RareteDAvatar
  /** Ses lieux, voie après voie, sans doublon : le premier fait sa pastille. Aucun pour un Divin. */
  lieux: readonly LieuDAvatar[]
}

/**
 * La rareté d'un portrait, par son rang dans sa branche : le visage commun,
 * le deuxième peu commun, le geste et la lumière rares, le débord épique, la
 * forme ultime légendaire.
 */
const RARETE_DU_RANG: readonly Rarete[] = ['commune', 'peucommune', 'rare', 'rare', 'epique', 'legendaire']

/**
 * Le lieu d'un haut fait qu'une voie demande — ou d'une récompense de saison,
 * d'un légendaire gardé au bout de l'expédition, d'un gardien réveillé au
 * Cabinet. Oublié ici, `cabinet:phenix` passait pour un haut fait de soirée
 * inconnu, et sa voie se disait « En soirée : « cabinet:phenix » ».
 */
function lieuDuHautFait(cle: string): LieuDAvatar {
  if (saison(cle)) return 'saison'
  if (legendaireDeLExpedition(cle)) return 'expedition'
  if (legendaireDuCabinet(cle)) return 'cabinet'
  const h = hautFait(cle)
  return (h && origineDe(h)) ?? 'soiree'
}

/** Un gardien de saison : le Cabinet range sa condition même (`saison:halloween`) d'une œuvre gagnée en jouant à sa fête. */
const gardienDeSaison = (l: Legendaire) => GARDIENS_DE_SAISON.includes(l.key)

/**
 * Les lieux d'un légendaire, voie après voie, sans doublon. Un gardien de
 * saison n'a pas de voie du Cabinet — c'est sa saison qu'on y range —, mais
 * le Cabinet ouvert, il s'y gagne aussi : son lieu se dit au bout.
 */
export const lieuxDuLegendaire = (l: Legendaire, cabinet: boolean = CABINET_EN_PRODUCTION): LieuDAvatar[] => [
  ...new Set([...voiesMontrees(l, cabinet).flatMap(partiesDe).map(c => lieuDuHautFait(c.hautFait)), ...(cabinet && gardienDeSaison(l) ? (['cabinet'] as const) : [])]),
]

/**
 * L'album dit-il encore la voie de l'Expédition ? Ce qu'en décide
 * `voiesMontrees` pour les légendaires qu'elle garde, et rien d'autre : la
 * luciole, qu'elle amène aussi, ne dit jamais une voie qu'ils taisent. Le jour
 * où son départ ferme et où leur voie se tait, la sienne se tait avec, sans un
 * drapeau de plus à suivre ici. La galerie des compagnons lit la même chose
 * (`venuesDeLaLuciole`, `GalerieDesCompagnons.tsx`).
 */
const laVoieDeLExpeditionSeDit = (cabinet: boolean): boolean => LEGENDAIRES.some(l => voiesMontrees(l, cabinet).some(estUneVoieDExpedition))

/**
 * D'où vient la première forme d'un compagnon : la boutique — la luciole
 * comprise depuis le 31 octobre 2026, l'Expédition qui l'amenait effacée. Un
 * compagnon qui ne s'achèterait pas (`Compagnon.gagne`) dirait son lieu — et,
 * le Cabinet ouvert, le Cabinet d'abord, l'expédition tant que l'album dit sa
 * voie (`cheminDeLaLuciole`, `shared/compagnons.ts`).
 */
const lieuxDeSaVenue = (c: Compagnon, cabinet: boolean): LieuDAvatar[] =>
  c.gagne === 'expedition' && cabinet ? ['cabinet', ...(laVoieDeLExpeditionSeDit(cabinet) ? (['expedition'] as const) : [])] : [c.gagne ?? 'boutique']

const avatar = (cle: string, sorte: SorteDAvatar, rarete: RareteDAvatar, lieux: readonly LieuDAvatar[]): AvatarDeLAlbum => ({ cle, sorte, rarete, lieux })

/**
 * Tout l'album, dans l'ordre du catalogue : les légendaires, les portraits
 * branche après branche, les compagnons forme après forme — leur
 * métamorphose après leur forme ultime, dont elle s'ouvre —, les emojis de
 * collection, les Divins. Pas les vingt-quatre emojis de l'inscription : ils
 * sont à tout le monde. Seuls les lieux dépendent du Cabinet.
 */
function lAlbum(cabinet: boolean): readonly AvatarDeLAlbum[] {
  return [
    ...LEGENDAIRES.map(l => avatar(l.key, 'legendaire', 'legendaire', lieuxDuLegendaire(l, cabinet))),
    ...PORTRAITS.map(p => avatar(p.key, 'portrait', RARETE_DU_RANG[p.rang], ['sentiers'])),
    ...COMPAGNONS.flatMap(c => {
      const vient = lieuxDeSaVenue(c, cabinet)
      return [
        ...c.formes.map(f => avatar(f.key, 'compagnon', f.rarete, f.rang === 0 ? vient : [...vient, 'niche'])),
        ...(c.lumiere ? [avatar(c.lumiere.key, 'compagnon', c.lumiere.rarete, [...vient, 'niche', 'eclat'])] : []),
      ]
    }),
    ...COLLECTION.map(c => avatar(c.emoji, 'emoji', c.niveau < COLLECTION_HAUTE ? 'commune' : 'peucommune', ['niveau'])),
    ...DIVINS.map(d => avatar(d.key, 'divin', 'divin', [])),
  ]
}

/** L'album sous chaque drapeau, bâti une fois : celui du code tout de suite, l'autre à la première lecture qui le demande. */
const ALBUMS = new Map<boolean, { liste: readonly AvatarDeLAlbum[]; parCle: ReadonlyMap<string, AvatarDeLAlbum> }>()
function albumSous(cabinet: boolean) {
  let album = ALBUMS.get(cabinet)
  if (!album) {
    const liste = lAlbum(cabinet)
    ALBUMS.set(cabinet, (album = { liste, parCle: new Map(liste.map(a => [a.cle, a])) }))
  }
  return album
}

export const AVATARS_DE_L_ALBUM: readonly AvatarDeLAlbum[] = albumSous(CABINET_EN_PRODUCTION).liste

/** Un avatar de l'album ; `cabinet` force le drapeau du Cabinet, ce qui ne change que ses lieux. */
export function avatarDeLAlbum(cle: unknown, cabinet: boolean = CABINET_EN_PRODUCTION): AvatarDeLAlbum | undefined {
  return typeof cle === 'string' ? albumSous(cabinet).parCle.get(cle) : undefined
}

const DANS: Record<LieuDAvatar, string> = {
  soiree: 'en soirée',
  jour: 'au quiz du jour',
  campagne: 'en campagne',
  sentiers: 'sur les sentiers',
  niveau: 'en montant de niveau',
  saison: 'à sa saison',
  boutique: 'en boutique',
  niche: 'dans sa niche',
  eclat: 'par l’Éclat',
  expedition: 'en expédition',
  cabinet: 'au Cabinet',
}

/** « a, b et c », « a ou b » : une liste dite, son dernier lien devant le dernier. */
function dite(elements: readonly string[], mot: string, avant = ''): string {
  if (elements.length < 2) return elements[0] ?? ''
  return `${elements.slice(0, -1).join(', ')}${avant} ${mot} ${elements[elements.length - 1]}`
}

/**
 * Où il se gagne, d'une phrase — ce que sa case dit à l'oreille : « en
 * soirée ou au quiz du jour » quand ses voies sont l'une ou l'autre, « en
 * soirée, au quiz du jour et en campagne » quand une seule les demande
 * toutes — et les deux à la fois, voie par voie : « en soirée, au quiz du
 * jour et en campagne, ou en expédition » (la Chimère, depuis la voie de
 * l'expédition : un seul mot pour tous ses lieux disait qu'un seul suffisait) ;
 * un emoji, son niveau ; un légendaire de saison, sa fête ; une forme de
 * compagnon, ses bonnes réponses — sa métamorphose, l'Éclat avec. Rien pour
 * un Divin. `cabinet` force le drapeau du Cabinet, comme `avatarDeLAlbum`.
 */
export function ouIlSeGagne(a: AvatarDeLAlbum, cabinet: boolean = CABINET_EN_PRODUCTION): string {
  if (a.sorte === 'emoji') return `au niveau ${COLLECTION.find(c => c.emoji === a.cle)!.niveau}`
  const f = formeDeCompagnon(a.cle)
  if (f) {
    const c = compagnonDe(f)
    // En boutique, la luciole comprise (le 31 octobre 2026) ; un compagnon qui se gagnerait dirait son lieu.
    const vient = dite(lieuxDeSaVenue(c, cabinet).map(x => DANS[x]), 'ou')
    if (f.metamorphose) return `${vient}, puis à ${JUSTES_DES_FORMES[f.rang]} bonnes réponses ${avecLui(c)} et par l’Éclat`
    return f.rang === 0 ? vient : `${vient}, puis à ${JUSTES_DES_FORMES[f.rang]} bonnes réponses ${avecLui(c)}`
  }
  const l = legendaire(a.cle)
  const s = l?.saison && saison(l.saison)
  if (s) return `pour ${s.nom}`
  if (!l) return dite(a.lieux.map(x => DANS[x]), 'et')
  // Chaque voie, ses lieux liés par « et » ; deux voies au même lieu n'en font qu'une à l'oreille.
  const voies = [...new Set(voiesMontrees(l, cabinet).map(v => dite([...new Set(partiesDe(v).map(c => DANS[lieuDuHautFait(c.hautFait)]))], 'et')))]
  // Une voie de plusieurs lieux se détache des autres, chacune par son « ou » : « …et en campagne, ou en expédition,
  // ou au Cabinet » — « …et en campagne, en expédition, ou au Cabinet », un seul « ou » au bout, rangeait l'expédition
  // parmi les lieux de la première voie.
  return voies.some(v => v.includes(' et ')) ? voies.join(', ou ') : dite(voies, 'ou')
}

/** Ce que l'album lit d'un profil : ce qu'il a. */
export type ProfilDeLAlbum = Pick<PublicProfileDetail, 'niveau' | 'legendaires' | 'divins' | 'sentiers' | 'compagnons'>

/** Les avatars de l'album qui sont à lui. */
export function avatarsALui(p: ProfilDeLAlbum): Set<string> {
  return new Set([
    ...p.legendaires,
    ...(p.divins ?? []).map(d => d.key),
    ...portraitsOuverts(p.sentiers ?? {}),
    ...formesOuvertes(p.compagnons ?? []),
    ...COLLECTION.filter(c => p.niveau >= c.niveau).map(c => c.emoji),
  ])
}

export interface PageDeLAlbum {
  rarete: RareteDAvatar
  /** Ce qu'il a, puis ce qui reste, chacun dans l'ordre du catalogue — ce qu'on a d'abord, comme la maquette. */
  avatars: readonly { avatar: AvatarDeLAlbum; aLui: boolean }[]
  acquis: number
  total: number
}

/**
 * Les six pages de l'album, de la commune aux Divins. `cabinet` force le
 * drapeau du Cabinet : les mêmes avatars, aux mêmes places, seuls leurs lieux
 * changent — la pastille de leur case.
 */
export function pagesDeLAlbum(p: ProfilDeLAlbum, cabinet: boolean = CABINET_EN_PRODUCTION): PageDeLAlbum[] {
  const siens = avatarsALui(p)
  return RARETES_D_AVATAR.map(rarete => {
    const tous = albumSous(cabinet).liste.filter(a => a.rarete === rarete).map(a => ({ avatar: a, aLui: siens.has(a.cle) }))
    const aLui = tous.filter(a => a.aLui)
    return { rarete, avatars: [...aLui, ...tous.filter(a => !a.aLui)], acquis: aLui.length, total: tous.length }
  })
}

/**
 * Ce qu'il peut porter de l'album, rangé comme lui : les pages où il a
 * quelque chose, chacune ses avatars dans l'ordre du catalogue, et ce qui y
 * reste à gagner. La grille de la loge les montre ainsi — elle les rangeait
 * en familles quand l'album les rangeait en raretés.
 */
export function sesPagesDeLAlbum(p: ProfilDeLAlbum): { rarete: RareteDAvatar; avatars: AvatarDeLAlbum[]; reste: number }[] {
  return pagesDeLAlbum(p)
    .filter(page => page.acquis > 0)
    .map(page => ({ rarete: page.rarete, avatars: page.avatars.filter(a => a.aLui).map(a => a.avatar), reste: page.total - page.acquis }))
}

/** Tout l'album, compté : la ligne de « Ma collection », et sa part du total. */
export function compteDeLAlbum(p: ProfilDeLAlbum): { acquis: number; total: number } {
  const siens = avatarsALui(p)
  return { acquis: AVATARS_DE_L_ALBUM.filter(a => siens.has(a.cle)).length, total: AVATARS_DE_L_ALBUM.length }
}

/**
 * La page où l'album s'ouvre : celle de l'avatar qu'il porte — on vient
 * souvent voir ce qui va avec lui —, sinon la première où il reste à
 * gagner : son prochain avatar est sans doute là.
 */
export function pageDuDebut(p: ProfilDeLAlbum & Pick<PublicProfileDetail, 'legendaire' | 'avatar'>): RareteDAvatar {
  const siens = avatarsALui(p)
  const porte = [avatarDeLAlbum(p.legendaire), avatarDeLAlbum(p.avatar)].find(a => a && siens.has(a.cle))
  if (porte) return porte.rarete
  return pagesDeLAlbum(p).find(page => page.acquis < page.total)?.rarete ?? 'legendaire'
}

/**
 * La page du prochain avatar de cette sorte qui lui reste à gagner : la plus
 * basse qui en a encore un. « 69 portraits à gagner : où ? », dans la loge,
 * y mène. Null s'il les a tous.
 */
export function pageDuProchain(p: ProfilDeLAlbum, sorte: SorteDAvatar): RareteDAvatar | null {
  const siens = avatarsALui(p)
  const reste = AVATARS_DE_L_ALBUM.filter(a => a.sorte === sorte && !siens.has(a.cle))
  return RARETES_D_AVATAR.find(r => reste.some(a => a.rarete === r)) ?? null
}

// ── Comment l'obtenir ─────────────────────────────────────────────────────

/**
 * Une étape vers un avatar : ce qu'il faut, où, et où il en est. Une voie en
 * a une, ou plusieurs à tenir à la fois (la Chimère, Janus) ; un avatar a une
 * voie, ou plusieurs dont une seule suffit (le Sphinx, la Licorne…).
 */
export interface EtapeDUneVoie {
  lieu: LieuDAvatar
  /** Ce qu'il faut, avec son lieu : « En soirée : 3 fois « Seul contre tous » », « Au niveau 12 ». */
  titre: string
  /** Sa règle, telle qu'on l'annonce : « Seul de la salle à trouver une question… », « 10 soirées jouées ». */
  regle: string
  /** Il l'a déjà : une étape de la Chimère, un palier passé. */
  tenue: boolean
  /**
   * Où il en est, quand il y a de quoi compter : rien pour ce qu'il suffit
   * de décrocher une fois, ni pour un légendaire de saison — on l'a, ou l'on
   * attend sa période.
   */
  progres: { acquis: number; requis: number; dit: string } | null
}

/** Ce que les voies lisent d'un profil : ce qu'il a, et ses hauts faits — où il en est —, sa boutique — ses compagnons. */
export type ProfilDesVoies = ProfilDeLAlbum & Pick<PublicProfileDetail, 'hautsFaits' | 'boutique'>

const OU: Record<LieuDAvatar, string> = {
  soiree: 'En soirée',
  jour: 'Au quiz du jour',
  campagne: 'En campagne',
  sentiers: 'Sur les sentiers',
  niveau: 'En montant de niveau',
  saison: 'À sa saison',
  boutique: 'En boutique',
  niche: 'Dans sa niche',
  eclat: 'Par l’Éclat',
  expedition: 'En expédition',
  cabinet: 'Au Cabinet',
}

const compte = (acquis: number, requis: number, avant = '') => ({ acquis, requis, dit: `${avant}${formatNumber(acquis)} sur ${formatNumber(requis)}` })

/**
 * Ce que le Cabinet demande pour réveiller un gardien, en mots : sa salle à
 * compléter — le premier —, ou à dorer — le second —, la série, le musée
 * entier. Les chiffres viennent du Cabinet (ses salles, ses œuvres) : une
 * œuvre peinte de plus se compte d'elle-même. La série et le musée entier se
 * disent dans les mots du Cabinet (`conditionDuGardien`) : une série qui
 * compterait autre chose ne laisserait pas l'album dire l'ancienne. Null pour
 * ce qui ne garde rien.
 */
function ceQueDemandeLeCabinet(gardien: string): { quoi: string; regle: string } | null {
  const s = salle(salleDuGardien(gardien))
  if (s) {
    const oeuvres = oeuvresDeLaSalle(s.cle)
    if (GARDIENS_DES_SALLES[s.cle][1] === gardien) return { quoi: `dorer ${s.laSalle}`, regle: `Ses ${oeuvres.length} cadres dorés, chacun en jouant sans faute ou avec la poussière d’or` }
    // Les œuvres de départ sont au Vestibule, à tout le monde sans rien faire : « gagnées en jouant ou achetées » ne
    // les disait pas — leur cartel dit « Offerte à ton arrivée ».
    const offertes = oeuvres.filter(o => OEUVRES_DE_DEPART.includes(o.cle)).length
    const facons = 'gagnées en jouant ou achetées avec la poussière d’or'
    return { quoi: `compléter ${s.laSalle}`, regle: offertes ? `Ses ${oeuvres.length} œuvres : ${offertes} offertes à ton arrivée, les autres ${facons}` : `Ses ${oeuvres.length} œuvres, ${facons}` }
  }
  const reveil = AUTRES_GARDIENS.find(a => a.legendaire === gardien)?.reveil
  const regle = conditionDuGardien(gardien)
  if (reveil && regle && 'serie' in reveil) return { quoi: 'revenir chaque jour', regle }
  if (reveil && regle && 'tout' in reveil) return { quoi: 'compléter tout le musée', regle }
  return null
}

/**
 * Une étape d'un légendaire : un haut fait à décrocher tant de fois, ou un
 * palier de carrière à atteindre — ou une voie rangée, qui n'a pas de jauge.
 * Celle-ci se dit tenue s'il a le légendaire (`tenu`) : une ligne
 * `expedition:<clé>` ou `cabinet:<clé>` n'est pas un haut fait, les hauts
 * faits que la page reçoit ne la portent jamais, et l'étape lue d'eux se
 * disait à faire, le légendaire gardé au bout de l'acte 3 en main.
 */
function etapeDuHautFait(c: SimpleCondition, recompenses: ReadonlyMap<string, number>, valeurs: ReadonlyMap<string, number>, tenu: boolean): EtapeDUneVoie {
  const lieu = lieuDuHautFait(c.hautFait)
  if (lieu === 'expedition') {
    // Pas de jauge : il garde l'acte d'une expédition, ou non — on le garde au bout, une fois.
    return {
      lieu,
      titre: 'En expédition : le garder au bout de l’acte 3',
      regle: 'Quand il garde un acte, va au bout des trois, puis choisis-le parmi les gardiens vaincus',
      tenue: tenu,
      progres: null,
    }
  }
  if (lieu === 'cabinet') {
    // Pas de jauge non plus : l'album ne reçoit pas le musée — la page du Cabinet dit où en est chaque salle.
    const demande = ceQueDemandeLeCabinet(legendaireDuCabinet(c.hautFait)!.key)
    return { lieu, titre: `${OU.cabinet} : ${demande?.quoi ?? 'le réveiller'}`, regle: demande?.regle ?? '', tenue: tenu, progres: null }
  }
  const h = hautFait(c.hautFait)
  const nom = `« ${h?.title ?? c.hautFait} »`
  if ('palier' in c) {
    if (h?.famille !== 'carriere') return { lieu, titre: `${OU[lieu]} : ${nom}`, regle: '', tenue: false, progres: null }
    const seuil = h.paliers[c.palier - 1]
    // Un palier atteint le reste, même si ce qu'il compte a redescendu.
    const tenue = (recompenses.get(clePalier(h.key, c.palier)) ?? 0) > 0
    const acquis = tenue ? seuil : Math.min(seuil, valeurs.get(h.key) ?? 0)
    return { lieu, titre: `${OU[lieu]} : ${nom} · ${NOM_PALIER[c.palier - 1]}`, regle: regleDuPalier(h, c.palier), tenue, progres: seuil > 1 ? compte(acquis, seuil) : null }
  }
  const n = Math.min(c.fois, recompenses.get(c.hautFait) ?? 0)
  return {
    lieu,
    titre: `${OU[lieu]} : ${c.fois > 1 ? `${c.fois} fois ${nom}` : nom}`,
    regle: h?.famille === 'soiree' ? h.rule : '',
    tenue: n >= c.fois,
    progres: c.fois > 1 ? compte(n, c.fois) : null,
  }
}

/**
 * Comment l'obtenir : ses voies, chacune ses étapes — l'une des voies suffit,
 * toutes les étapes d'une voie sont demandées. Un Divin n'en a aucune : ce qui
 * le fait descendre ne quitte jamais le serveur (invariant 21). `cabinet`
 * force le drapeau du Cabinet, comme `voiesMontrees`.
 */
export function voiesDeLAvatar(cle: string, p: ProfilDesVoies, cabinet: boolean = CABINET_EN_PRODUCTION): EtapeDUneVoie[][] {
  const a = avatarDeLAlbum(cle, cabinet)
  if (!a || a.sorte === 'divin') return []
  if (a.sorte === 'emoji') {
    const niveau = COLLECTION.find(c => c.emoji === cle)!.niveau
    return [
      [
        {
          lieu: 'niveau',
          titre: `Au niveau ${niveau}`,
          regle: 'Un emoji de collection à chaque niveau qui n’ouvre pas de finition',
          tenue: p.niveau >= niveau,
          progres: compte(Math.min(p.niveau, niveau), niveau, 'niveau '),
        },
      ],
    ]
  }
  if (a.sorte === 'portrait') {
    const pt = portrait(cle)!
    const b = brancheDe(pt)
    const valides = p.sentiers?.[b.key] ?? 0
    return [
      [
        {
          lieu: 'sentiers',
          titre: `Sur les sentiers : le palier ${pt.palier} du sentier ${deLaBranche(b)}`,
          regle: 'Un portrait tous les deux paliers d’un sentier du savoir, dans la campagne',
          tenue: valides >= pt.palier,
          progres: compte(Math.min(valides, pt.palier), pt.palier, 'palier '),
        },
      ],
    ]
  }
  if (a.sorte === 'compagnon') {
    // L'acheter — la luciole aussi, depuis le 31 octobre 2026 ; un compagnon
    // qui se gagnerait, une voie par lieu (`lieuxDeSaVenue`) —, puis le faire
    // grandir dans sa niche — et, pour sa métamorphose, l'Éclat sur lui.
    const f = formeDeCompagnon(cle)!
    const c = compagnonDe(f)
    const sien = (p.compagnons ?? []).find(x => x.compagnon === c.key)
    const il = c.le === 'la' ? 'elle' : 'il'
    // Sans jauge, et tenue dès qu'il est à lui, par où qu'il soit venu : une salle est complète ou non, une
    // expédition va au bout ou non — une fois suffit.
    const venue = (lieu: LieuDAvatar): EtapeDUneVoie =>
      lieu === 'cabinet'
        ? { lieu, titre: `${OU.cabinet} : compléter une salle`, regle: `Complète une salle de ton musée : ${il} te rejoint, puis grandit avec toi`, tenue: !!sien, progres: null }
        : lieu === 'expedition'
          ? {
              lieu,
              titre: 'En expédition : la Première traversée',
              regle: `Mène une expédition au bout — le troisième gardien vaincu — : ${il} te rejoint, puis grandit avec toi`,
              tenue: !!sien,
              progres: null,
            }
          : { lieu: 'boutique', titre: `En boutique : ${formatNumber(PRIX_D_UN_COMPAGNON)} confettis`, regle: `${c.nom} s’achète à sa première forme, puis grandit avec toi`, tenue: !!sien, progres: null }
    const venues = lieuxDeSaVenue(c, cabinet).map(venue)
    if (f.rang === 0) return venues.map(v => [v])
    const requis = JUSTES_DES_FORMES[f.rang]
    const tenue = !!sien && sien.rang >= f.rang
    const justes = p.boutique?.compagnons?.find(x => x.compagnon === c.key)?.justes ?? 0
    const grandir: EtapeDUneVoie = {
      lieu: 'niche',
      titre: `Dans sa niche : ${formatNumber(requis)} bonnes réponses`,
      regle: 'Celles qui rapportent un confetti, en soirée, au quiz du jour et en campagne',
      tenue,
      // Une forme atteinte le reste, même si ses bonnes réponses ont redescendu.
      progres: sien ? compte(tenue ? requis : Math.min(justes, requis), requis) : null,
    }
    // Chaque voie le fait venir, puis grandir : « ou » entre elles, « et » entre leurs étapes.
    if (!f.metamorphose) return venues.map(v => [v, grandir])
    // Pas de jauge : un tirage, qui tombe sur ce qu'il porte (`cibleEclat`).
    const eclat: EtapeDUneVoie = {
      lieu: 'eclat',
      titre: 'Par l’Éclat : en portant l’une de ses formes',
      regle: `Une chance sur ${CHANCE_ECLAT} par soirée à deux ou quiz du jour, sur ${CHANCE_ECLAT_DU_DEFI} au défi de la semaine`,
      tenue: !!sien?.eclat,
      progres: null,
    }
    return venues.map(v => [v, grandir, eclat])
  }
  const l = legendaire(cle)!
  const s = l.saison && saison(l.saison)
  if (s) {
    // Un légendaire de saison ne se gagne qu'à sa période : sa règle se dit en dates, sans jauge — gardé au bout d'une
    // expédition partie ces jours-là aussi, qui le met en gardien de l'acte 3, quand sa voie se montre (`voiesMontrees`),
    // et, le Cabinet ouvert, d'une œuvre gagnée en jouant ces jours-là : il y range sa saison même, sans voie à lui.
    const facons = [
      `${s.jours} jours de quiz du jour`,
      'une soirée ces jours-là',
      ...(cabinet && gardienDeSaison(l) ? ['une œuvre gagnée en jouant au Cabinet ces jours-là'] : []),
      ...(voiesMontrees(l, cabinet).some(estUneVoieDExpedition) ? ['le garder au bout d’une expédition partie ces jours-là'] : []),
    ]
    return [[{ lieu: 'saison', titre: `Pour ${s.nom}, ${s.periode}`, regle: dite(facons, 'ou', ','), tenue: p.legendaires.includes(l.key), progres: null }]]
  }
  const recompenses = recompensesDe(p.hautsFaits)
  const valeurs = new Map(p.hautsFaits.filter(h => h.famille === 'carriere').map(h => [h.key, h.valeur ?? 0]))
  return voiesMontrees(l, cabinet).map(v => partiesDe(v).map(c => etapeDuHautFait(c, recompenses, valeurs, p.legendaires.includes(l.key))))
}
