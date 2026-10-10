// Ma collection : tout ce qu'un profil peut gagner, famille par famille — ce
// qu'il a, et sur combien. La tuile du profil et la page de la collection
// lisent le même compte : deux règles auraient fini par dire deux totaux.
//
// Seulement ce qui se gagne. Les vingt-quatre emojis de l'inscription sont à
// tout le monde et ne comptent pas ; les Divins, si : un Divin descendu est à
// lui, et la page ne dit rien de plus que ce qu'il sait déjà — ni jauge ni
// progression vers les autres (invariant 21).

import { PORTRAITS, portraitsOuverts } from './branches'
import { LEGENDAIRES } from './legendaires'
import { DIVINS } from './divins'
import { COLLECTION } from './avatars'
import { THEMES } from './themes'
import { FONDS } from './fonds'
import { GERBES } from './gerbes'
import { PAGES } from './calendrier'
import { FINITIONS, type PublicProfileDetail } from './profil'

export type FamilleDeLaCollection = 'avatars' | 'style' | 'trophees'

/** Une ligne de la collection : les avatars en trois, le style en quatre, les trophées en dix, rangés par où ils se gagnent. */
export type PartieDeLaCollection =
  | 'savoir'
  | 'legendaires'
  | 'emojis'
  | 'themes'
  | 'fonds'
  | 'gerbes'
  | 'finitions'
  | PartieDesTrophees

/** Les lignes des trophées, dans l'ordre de leurs sections (`LIEU_DES_TROPHEES`). */
export type PartieDesTrophees =
  | 'eclats'
  | 'ombres'
  | 'prix'
  | 'paliers'
  | 'jour'
  | 'paliersDuJour'
  | 'campagne'
  | 'paliersDeCampagne'
  | 'ecussons'
  | 'paliersDeToujours'

/**
 * Où se gagne un trophée : sa section dans « Ma collection ». Sept lignes
 * mêlaient deux logiques — « Hauts faits » ne montrait que les soirées,
 * « Paliers » mêlait soirées, quiz du jour et campagne, le défi se rangeait
 * sous la série —, et la partie était « incompréhensible » (un retour du
 * 10 octobre 2026). Chaque trophée se range là où on le gagne.
 */
export type LieuDesTrophees = 'soiree' | 'jour' | 'campagne' | 'partout'

export const LIEU_DES_TROPHEES: Readonly<Record<PartieDesTrophees, LieuDesTrophees>> = {
  eclats: 'soiree',
  ombres: 'soiree',
  prix: 'soiree',
  paliers: 'soiree',
  jour: 'jour',
  paliersDuJour: 'jour',
  campagne: 'campagne',
  paliersDeCampagne: 'campagne',
  ecussons: 'partout',
  paliersDeToujours: 'partout',
}

/**
 * Les paliers de carrière qui comptent partout : le niveau, et les Éclats
 * de la soirée, du quiz du jour et du défi. Les autres, sans origine, ne
 * comptent que les soirées.
 */
const PALIERS_DE_TOUJOURS: ReadonlySet<string> = new Set(['hf:legende', 'hf:eclats'])

export interface Compte {
  acquis: number
  total: number
}

export interface LigneDuCompte extends Compte {
  partie: PartieDeLaCollection
}

export interface FamilleDuCompte extends Compte {
  famille: FamilleDeLaCollection
  parties: LigneDuCompte[]
}

/** Ce que le compte lit d'un profil : sa page au complet, ou ce qu'il en faut. */
export type ProfilDeLaCollection = Pick<
  PublicProfileDetail,
  'niveau' | 'legendaires' | 'divins' | 'ouvertes' | 'hautsFaits' | 'prix' | 'ecussons' | 'fonds' | 'gerbes' | 'boutique' | 'sentiers' | 'calendrier'
>

const eus = (liste: readonly { fois: number }[]) => liste.filter(x => x.fois > 0).length

/**
 * Les dix collections des trophées, telles que leurs lignes les montrent
 * (`TropheesAtlas`), rangées par où elles se gagnent : en soirée — ses
 * hauts faits, ses coups du sort, ses prix, ses paliers —, au quiz du jour,
 * en campagne — la série et le défi —, et partout — les écussons, que tous
 * les modes nourrissent, le niveau et les Éclats.
 */
export function listesDesTrophees(p: Pick<ProfilDeLaCollection, 'hautsFaits' | 'prix' | 'ecussons'>) {
  const soiree = p.hautsFaits.filter(h => h.famille === 'soiree' && !h.origine)
  const carriere = p.hautsFaits.filter(h => h.famille === 'carriere')
  return {
    eclats: soiree.filter(h => h.ton !== 'ombre'),
    ombres: soiree.filter(h => h.ton === 'ombre'),
    prix: p.prix ?? [],
    paliers: carriere.filter(h => !h.origine && !PALIERS_DE_TOUJOURS.has(h.key)),
    duJour: p.hautsFaits.filter(h => h.famille === 'soiree' && h.origine === 'jour'),
    paliersDuJour: carriere.filter(h => h.origine === 'jour'),
    deCampagne: p.hautsFaits.filter(h => h.famille === 'soiree' && h.origine === 'campagne'),
    paliersDeCampagne: carriere.filter(h => h.origine === 'campagne'),
    ecussons: p.ecussons ?? [],
    paliersDeToujours: carriere.filter(h => PALIERS_DE_TOUJOURS.has(h.key)),
  }
}

/** Des paliers de carrière : un par métal. */
const parMetal = (paliers: readonly { fois: number }[]): Compte => ({ acquis: paliers.reduce((s, h) => s + Math.min(3, h.fois), 0), total: paliers.length * 3 })

/**
 * Leur compte : un haut fait décroché, un palier de carrière par métal, un
 * écusson par catégorie, et au quiz du jour ses hauts faits avec les pages
 * de son calendrier.
 */
export function comptesDesTrophees(p: Pick<ProfilDeLaCollection, 'hautsFaits' | 'prix' | 'ecussons' | 'calendrier'>): LigneDuCompte[] {
  const l = listesDesTrophees(p)
  // Le calendrier n'est compté qu'avec lui : un serveur d'avant ne le dit pas.
  const pages = p.calendrier ? { acquis: p.calendrier.pages.length, total: PAGES.length } : { acquis: 0, total: 0 }
  return [
    { partie: 'eclats', acquis: eus(l.eclats), total: l.eclats.length },
    { partie: 'ombres', acquis: eus(l.ombres), total: l.ombres.length },
    { partie: 'prix', acquis: eus(l.prix), total: l.prix.length },
    { partie: 'paliers', ...parMetal(l.paliers) },
    { partie: 'jour', acquis: eus(l.duJour) + pages.acquis, total: l.duJour.length + pages.total },
    { partie: 'paliersDuJour', ...parMetal(l.paliersDuJour) },
    { partie: 'campagne', acquis: eus(l.deCampagne), total: l.deCampagne.length },
    { partie: 'paliersDeCampagne', ...parMetal(l.paliersDeCampagne) },
    { partie: 'ecussons', acquis: l.ecussons.filter(e => e.palier > 0).length, total: l.ecussons.length },
    { partie: 'paliersDeToujours', ...parMetal(l.paliersDeToujours) },
  ]
}

const somme = (parties: LigneDuCompte[]): Compte => ({
  acquis: parties.reduce((s, x) => s + x.acquis, 0),
  total: parties.reduce((s, x) => s + x.total, 0),
})

/**
 * Toute sa collection : trois familles, leurs lignes, et le total. Ce qu'un
 * serveur d'avant ne dit pas (ses fonds, ses gerbes, sa boutique) ne se
 * compte pas : le total n'annonce jamais ce que la page ne saurait montrer.
 */
export function compteDeLaCollection(p: ProfilDeLaCollection): { familles: FamilleDuCompte[]; total: Compte } {
  const avatars: LigneDuCompte[] = [
    { partie: 'savoir', acquis: portraitsOuverts(p.sentiers ?? {}).length, total: PORTRAITS.length },
    { partie: 'legendaires', acquis: p.legendaires.length + p.divins.length, total: LEGENDAIRES.length + DIVINS.length },
    { partie: 'emojis', acquis: COLLECTION.filter(c => p.niveau >= c.niveau).length, total: COLLECTION.length },
  ]
  const style: LigneDuCompte[] = [
    ...(p.boutique ? [{ partie: 'themes' as const, acquis: p.boutique.possedes.length, total: THEMES.length }] : []),
    ...(p.fonds ? [{ partie: 'fonds' as const, acquis: p.fonds.length, total: FONDS.length }] : []),
    ...(p.gerbes ? [{ partie: 'gerbes' as const, acquis: p.gerbes.length, total: GERBES.length }] : []),
    { partie: 'finitions', acquis: p.ouvertes.length, total: FINITIONS.length },
  ]
  const trophees = comptesDesTrophees(p)
  const familles: FamilleDuCompte[] = [
    { famille: 'avatars', ...somme(avatars), parties: avatars },
    { famille: 'style', ...somme(style), parties: style },
    { famille: 'trophees', ...somme(trophees), parties: trophees },
  ]
  return { familles, total: somme(familles.flatMap(f => f.parties)) }
}
