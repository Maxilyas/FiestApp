// Les plaques de nom : la ligne d'un joueur dans les classements, aux
// couleurs d'un thème qu'il possède (le choix du propriétaire du 10 novembre
// 2026, la maquette `retours/2026-11-10/plaques/`). Un thème n'habillait que
// le téléphone de qui le porte : la production en comptait six de vendus,
// pour seize compagnons, et trente-deux profils sur quarante et un restés en
// Velours — on achète ce que les autres voient. La plaque est la part d'un
// thème qui se voit : chaque thème vient avec la sienne, au même prix, et
// qui en possédait un a reçu la sienne sans rien faire.
//
// Rien ne s'achète à part, et rien ne se compte à part : une plaque n'est ni
// un article de la boutique, ni une pièce de la collection — c'est son thème.
// Ce fichier n'en garde que les règles, pures ; ses couleurs vivent dans la
// feuille (`.plaque-<clé>`, `client/src/styles.css`), que `plaques.test.ts`
// compare aux jetons de chaque thème.

import { THEMES, campDuTheme, theme } from './themes'

/** Il n'en veut aucune : sa ligne reste celle de tous. */
export const AUCUNE_PLAQUE = 'aucune'

/**
 * Ce qu'il a choisi : `auto` — la plaque du thème qu'il porte, d'office —,
 * `aucune`, ou la clé d'un thème qu'il possède.
 */
export type ChoixDePlaque = string

/**
 * Le thème dont on peut porter la plaque : tous, sauf Velours — le thème de
 * tous n'a pas de plaque, sa ligne est celle d'aujourd'hui.
 */
export function plaqueDuTheme(cle: unknown): string | null {
  const t = theme(typeof cle === 'string' ? cle : null)
  return t && t.key !== 'velours' ? t.key : null
}

/** Le choix tel que la colonne le garde (`profiles.plaque`) : null, `auto`. */
export function choixDePlaque(brut: string | null | undefined): ChoixDePlaque {
  if (brut === AUCUNE_PLAQUE) return AUCUNE_PLAQUE
  return plaqueDuTheme(brut) ?? 'auto'
}

/**
 * La plaque qu'on voit sur sa ligne : celle qu'il a choisie ; sans choix,
 * celle du thème qu'il porte — comme la gerbe de tous (`GERBE_PAR_DEFAUT`,
 * le choix du 10 octobre 2026) : une pièce qui ne se montre qu'une fois
 * choisie dans la loge ne se montrait chez personne — ; aucune s'il l'a
 * demandé, ou sous le Velours.
 */
export function plaquePortee(choix: string | null | undefined, themePorte: string | null | undefined): string | null {
  const c = choixDePlaque(choix)
  if (c === AUCUNE_PLAQUE) return null
  return c === 'auto' ? plaqueDuTheme(themePorte) : c
}

/** Les plaques qu'il peut porter : une par thème qu'il possède, dans l'ordre du catalogue — l'Ivoire, offert, est à tous. */
export function plaquesOuvertes(possedes: readonly string[]): string[] {
  return possedes.filter(k => plaqueDuTheme(k) !== null)
}

/**
 * Une plaque du catalogue : celle d'un thème, ou, pour un thème à deux camps
 * (les Deux Bannières), celle de chaque camp — `bannieres-royaume` —, à ses
 * couleurs et à son emblème : on voit de quel camp il est.
 */
export interface PlaqueDuCatalogue {
  cle: string
  theme: string
  camp: string | null
}

/** Toutes les plaques, dans l'ordre du catalogue — sans le Velours, qui n'en a pas. */
export const PLAQUES: readonly PlaqueDuCatalogue[] = THEMES.filter(t => t.key !== 'velours').flatMap((t): PlaqueDuCatalogue[] =>
  t.camps ? t.camps.map(c => ({ cle: `${t.key}-${c.key}`, theme: t.key, camp: c.key })) : [{ cle: t.key, theme: t.key, camp: null }],
)

/**
 * La plaque d'un thème à camps porte le camp qu'il a choisi (`profiles.camp`,
 * le premier d'office) : `bannieres` devient `bannieres-clans`. Les autres
 * restent telles quelles. Ce que le serveur dit sur chaque ligne de classement
 * (`ProfileStore.plaqueDe`) — le choix, lui, garde la clé du thème.
 */
export function plaqueAvecSonCamp(plaque: string | null, camp: unknown): string | null {
  const c = plaque ? campDuTheme(theme(plaque), camp) : null
  return c ? `${plaque}-${c.key}` : plaque
}

/** Le nom d'une plaque, tel qu'on le dit : « Kintsugi », « Les Deux Bannières · Le Royaume ». */
export function nomDeLaPlaque(cle: string): string {
  const p = PLAQUES.find(x => x.cle === cle)
  const t = theme(p?.theme ?? cle)
  const c = p?.camp ? t?.camps?.find(x => x.key === p.camp) : undefined
  return t ? (c ? `${t.nom} · ${c.nom}` : t.nom) : ''
}

/** Le thème d'une plaque : `bannieres-royaume`, les Deux Bannières. */
export function themeDeLaPlaque(cle: string): string {
  return PLAQUES.find(p => p.cle === cle)?.theme ?? cle
}
