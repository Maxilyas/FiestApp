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
// forme ultime, au douzième palier, est légendaire — l'égale des vingt-six
// légendaires des hauts faits. Les compagnons de la boutique de même, forme
// par forme : celle qu'on achète est commune, la forme ultime légendaire. Les
// Divins ont leur page, et n'y disent rien d'eux : ni règle, ni lieu, ni
// progression (invariant 21).
//
// Une dérivation pure de ce que la page du profil reçoit déjà : « Ma
// collection » compte ses avatars par elle (`compteDeLaCollection`), une seule
// règle pour la ligne et pour le total.

import { NOM_RARETE, type Rarete } from './badges'
import { PORTRAITS, brancheDe, deLaBranche, portrait, portraitsOuverts } from './branches'
import { COLLECTION, COLLECTION_HAUTE } from './avatars'
import { DIVINS } from './divins'
import { LEGENDAIRES, legendaire, partiesDe, voiesDe, type Legendaire, type SimpleCondition } from './legendaires'
import { NOM_PALIER, clePalier, hautFait, origineDe, regleDuPalier } from './hautsfaits'
import { saison } from './saisons'
import { recompensesDe } from './proches'
import { formatNumber } from './typographie'
import { FORMES_DES_COMPAGNONS, JUSTES_DES_FORMES, PRIX_D_UN_COMPAGNON, compagnonDe, enLePortant, formeDeCompagnon, formesOuvertes } from './compagnons'
import type { PublicProfileDetail } from './profil'

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
 * saison, ou en boutique — un compagnon, qui grandit ensuite en le portant
 * (`porte`). La pastille de sa case, et l'icône de chacune de ses voies.
 */
export type LieuDAvatar = 'soiree' | 'jour' | 'campagne' | 'sentiers' | 'niveau' | 'saison' | 'boutique' | 'porte'

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

/** Le lieu d'un haut fait qu'une voie demande — ou d'une récompense de saison. */
function lieuDuHautFait(cle: string): LieuDAvatar {
  if (saison(cle)) return 'saison'
  const h = hautFait(cle)
  return (h && origineDe(h)) ?? 'soiree'
}

const lieuxDuLegendaire = (l: Legendaire): LieuDAvatar[] => [...new Set(voiesDe(l).flatMap(partiesDe).map(c => lieuDuHautFait(c.hautFait)))]

const avatar = (cle: string, sorte: SorteDAvatar, rarete: RareteDAvatar, lieux: readonly LieuDAvatar[]): AvatarDeLAlbum => ({ cle, sorte, rarete, lieux })

/**
 * Tout l'album, dans l'ordre du catalogue : les légendaires, les portraits
 * branche après branche, les compagnons forme après forme, les emojis de
 * collection, les Divins. Pas les vingt-quatre emojis de l'inscription : ils
 * sont à tout le monde.
 */
export const AVATARS_DE_L_ALBUM: readonly AvatarDeLAlbum[] = [
  ...LEGENDAIRES.map(l => avatar(l.key, 'legendaire', 'legendaire', lieuxDuLegendaire(l))),
  ...PORTRAITS.map(p => avatar(p.key, 'portrait', RARETE_DU_RANG[p.rang], ['sentiers'])),
  ...FORMES_DES_COMPAGNONS.map(f => avatar(f.key, 'compagnon', f.rarete, f.rang === 0 ? ['boutique'] : ['boutique', 'porte'])),
  ...COLLECTION.map(c => avatar(c.emoji, 'emoji', c.niveau < COLLECTION_HAUTE ? 'commune' : 'peucommune', ['niveau'])),
  ...DIVINS.map(d => avatar(d.key, 'divin', 'divin', [])),
]

const PAR_CLE = new Map(AVATARS_DE_L_ALBUM.map(a => [a.cle, a]))

export function avatarDeLAlbum(cle: unknown): AvatarDeLAlbum | undefined {
  return typeof cle === 'string' ? PAR_CLE.get(cle) : undefined
}

const DANS: Record<LieuDAvatar, string> = {
  soiree: 'en soirée',
  jour: 'au quiz du jour',
  campagne: 'en campagne',
  sentiers: 'sur les sentiers',
  niveau: 'en montant de niveau',
  saison: 'à sa saison',
  boutique: 'en boutique',
  porte: 'en le portant',
}

/**
 * Où il se gagne, d'une phrase — ce que sa case dit à l'oreille : « en
 * soirée ou au quiz du jour » quand ses voies sont l'une ou l'autre, « en
 * soirée, au quiz du jour et en campagne » quand une seule les demande
 * toutes ; un emoji, son niveau ; un légendaire de saison, sa fête ; une
 * forme de compagnon, ses bonnes réponses. Rien pour un Divin.
 */
export function ouIlSeGagne(a: AvatarDeLAlbum): string {
  if (a.sorte === 'emoji') return `au niveau ${COLLECTION.find(c => c.emoji === a.cle)!.niveau}`
  const f = formeDeCompagnon(a.cle)
  if (f) return f.rang === 0 ? 'en boutique' : `en boutique, puis à ${JUSTES_DES_FORMES[f.rang]} bonnes réponses ${enLePortant(compagnonDe(f))}`
  const l = legendaire(a.cle)
  const s = l?.saison && saison(l.saison)
  if (s) return `pour ${s.nom}`
  const lieux = a.lieux.map(x => DANS[x])
  if (lieux.length < 2) return lieux[0] ?? ''
  const mot = l && voiesDe(l).length > 1 ? 'ou' : 'et'
  return `${lieux.slice(0, -1).join(', ')} ${mot} ${lieux[lieux.length - 1]}`
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

/** Les six pages de l'album, de la commune aux Divins. */
export function pagesDeLAlbum(p: ProfilDeLAlbum): PageDeLAlbum[] {
  const siens = avatarsALui(p)
  return RARETES_D_AVATAR.map(rarete => {
    const tous = AVATARS_DE_L_ALBUM.filter(a => a.rarete === rarete).map(a => ({ avatar: a, aLui: siens.has(a.cle) }))
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
  porte: 'En le portant',
}

const compte = (acquis: number, requis: number, avant = '') => ({ acquis, requis, dit: `${avant}${formatNumber(acquis)} sur ${formatNumber(requis)}` })

/** Une étape d'un légendaire : un haut fait à décrocher tant de fois, ou un palier de carrière à atteindre. */
function etapeDuHautFait(c: SimpleCondition, recompenses: ReadonlyMap<string, number>, valeurs: ReadonlyMap<string, number>): EtapeDUneVoie {
  const h = hautFait(c.hautFait)
  const lieu = lieuDuHautFait(c.hautFait)
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
 * le fait descendre ne quitte jamais le serveur (invariant 21).
 */
export function voiesDeLAvatar(cle: string, p: ProfilDesVoies): EtapeDUneVoie[][] {
  const a = avatarDeLAlbum(cle)
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
    // Une seule voie : l'acheter, puis le faire grandir en le portant.
    const f = formeDeCompagnon(cle)!
    const c = compagnonDe(f)
    const sien = (p.compagnons ?? []).find(x => x.compagnon === c.key)
    const achat: EtapeDUneVoie = {
      lieu: 'boutique',
      titre: `En boutique : ${formatNumber(PRIX_D_UN_COMPAGNON)} confettis`,
      regle: `${c.nom} s’achète à sa première forme, puis grandit avec toi`,
      tenue: !!sien,
      progres: null,
    }
    if (f.rang === 0) return [[achat]]
    const requis = JUSTES_DES_FORMES[f.rang]
    const tenue = !!sien && sien.rang >= f.rang
    const justes = p.boutique?.compagnons?.find(x => x.compagnon === c.key)?.justes ?? 0
    return [
      [
        achat,
        {
          lieu: 'porte',
          titre: `En ${c.le} portant : ${formatNumber(requis)} bonnes réponses`,
          regle: 'Celles qui rapportent un confetti, en soirée, au quiz du jour et en campagne',
          tenue,
          // Une forme atteinte le reste, même si ses bonnes réponses ont redescendu.
          progres: sien ? compte(tenue ? requis : Math.min(justes, requis), requis) : null,
        },
      ],
    ]
  }
  const l = legendaire(cle)!
  const s = l.saison && saison(l.saison)
  if (s) {
    // Un légendaire de saison ne se gagne qu'à sa période : sa règle se dit en dates, sans jauge.
    return [[{ lieu: 'saison', titre: `Pour ${s.nom}, ${s.periode}`, regle: `${s.jours} jours de quiz du jour, ou une soirée ces jours-là`, tenue: p.legendaires.includes(l.key), progres: null }]]
  }
  const recompenses = recompensesDe(p.hautsFaits)
  const valeurs = new Map(p.hautsFaits.filter(h => h.famille === 'carriere').map(h => [h.key, h.valeur ?? 0]))
  return voiesDe(l).map(v => partiesDe(v).map(c => etapeDuHautFait(c, recompenses, valeurs)))
}
