// Ma collection : tout ce qu'un profil peut gagner, famille par famille — ce
// qu'il a, et sur combien. La tuile du profil et la page de la collection
// lisent le même compte : deux règles auraient fini par dire deux totaux.
//
// Seulement ce qui se gagne. Les vingt-quatre emojis de l'inscription sont à
// tout le monde et ne comptent pas ; les Divins, si : un Divin descendu est à
// lui, et la page ne dit rien de plus que ce qu'il sait déjà — ni jauge ni
// progression vers les autres (invariant 21).

import { compteDeLAlbum } from './album'
import { compteDesTrophees, type ProfilDeLAlbumDesTrophees } from './trophees'
import { THEMES } from './themes'
import { FONDS } from './fonds'
import { GERBES } from './gerbes'
import { FINITIONS, type PublicProfileDetail } from './profil'

/**
 * Les trois familles, dans l'ordre de la page : deux albums — les avatars,
 * les trophées —, puis le style. Les trophées passaient derrière le style
 * en dix lignes ; un album, comme les avatars, les range à côté d'eux (la
 * maquette 1, le 13 octobre 2026).
 */
export type FamilleDeLaCollection = 'avatars' | 'trophees' | 'style'

/**
 * Une ligne de la collection : les avatars en un album (`shared/album.ts`),
 * les trophées en un autre (`shared/trophees.ts`), le style en quatre.
 */
export type PartieDeLaCollection = 'avatars' | 'trophees' | 'themes' | 'fonds' | 'gerbes' | 'finitions'

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
export type ProfilDeLaCollection = Pick<PublicProfileDetail, 'niveau' | 'legendaires' | 'divins' | 'ouvertes' | 'fonds' | 'gerbes' | 'boutique' | 'sentiers'> &
  ProfilDeLAlbumDesTrophees

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
  // Un album pour chacun : trois lignes d'avatars rendaient les gens
  // « confus », dix lignes de trophées aussi (le 13 octobre 2026).
  const avatars: LigneDuCompte[] = [{ partie: 'avatars', ...compteDeLAlbum(p) }]
  const trophees: LigneDuCompte[] = [{ partie: 'trophees', ...compteDesTrophees(p) }]
  const style: LigneDuCompte[] = [
    ...(p.boutique ? [{ partie: 'themes' as const, acquis: p.boutique.possedes.length, total: THEMES.length }] : []),
    ...(p.fonds ? [{ partie: 'fonds' as const, acquis: p.fonds.length, total: FONDS.length }] : []),
    ...(p.gerbes ? [{ partie: 'gerbes' as const, acquis: p.gerbes.length, total: GERBES.length }] : []),
    { partie: 'finitions', acquis: p.ouvertes.length, total: FINITIONS.length },
  ]
  const familles: FamilleDuCompte[] = [
    { famille: 'avatars', ...somme(avatars), parties: avatars },
    { famille: 'trophees', ...somme(trophees), parties: trophees },
    { famille: 'style', ...somme(style), parties: style },
  ]
  return { familles, total: somme(familles.flatMap(f => f.parties)) }
}
