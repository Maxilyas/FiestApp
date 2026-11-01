// Ce que les défis de tes cartes et les épreuves de maître laissent sur le
// profil, lu sans la traversée : leurs clés sur l'étagère, leurs noms, et ce
// qu'ils rapportent (`shared/cabinet/defis.ts` dit comment ils se gagnent).
// Léger exprès : le solde des confettis (`ProfileStore.boutiqueEtDons`), les
// titres (`nomDuTitre`, `shared/sentiers.ts`), la loge et les gerbes le
// lisent, et rien de la traversée — ni la carte, ni le pli — n'a à descendre
// avec eux. Il n'importe que le barème (`bareme.ts`, qui n'importe que des
// types) et des types.
//
// Un sceau se range sous `#cabinet`, comme un gardien réveillé et le légendaire
// choisi au bout d'une traversée, et sous le préfixe des voies du Cabinet
// (`cabinet:`) : l'étagère et le compte des badges l'écartent d'office
// (`PREFIXES_DES_VOIES_RANGEES`) — ce n'est pas un trophée de soirée —, et la
// ligne ne se reprend jamais (invariant 22).

import { ARGENTS_POUR_LA_GERBE, CONFETTIS_D_UN_RANG, ORS_POUR_LE_LEGENDAIRE } from './bareme'
import type { CleDeCarte } from './traversee'

/** Un rang : 1 le Bronze, 2 l'Argent, 3 l'Or. */
export type RangDUnDefi = 1 | 2 | 3
export const RANGS: readonly RangDUnDefi[] = [1, 2, 3]
/** Le nom d'un rang, à l'écran — les mots des récompenses : Bronze · Argent · Or, et rien d'autre. */
export const RANGS_DITS: Readonly<Record<RangDUnDefi, string>> = { 1: 'Bronze', 2: 'Argent', 3: 'Or' }

/**
 * Le nom du défi de chaque carte, que l'Or fait porter comme un titre : écrit ici, une seule fois, dans l'ordre
 * des cartes (`CARTES`, `traversee.ts` — `cabinet-defis.test.ts` les compare).
 */
export const NOMS_DES_DEFIS: Readonly<Record<CleDeCarte, string>> = {
  'coup-d-oeil': 'L’Œil nu',
  echange: 'L’Obstiné',
  'quitte-ou-double': 'Le Flambeur',
  concentration: 'Le Sang-Froid',
  parade: 'Sans filet',
  cagnotte: 'Le Trésorier',
  panacee: 'L’Increvable',
  pourboire: 'L’Avare',
  'coup-de-grace': 'L’Exécuteur',
  'second-souffle': 'Le Revenant',
}
const CARTES_DES_DEFIS = Object.keys(NOMS_DES_DEFIS) as CleDeCarte[]
const estUneCarte = (x: string): x is CleDeCarte => (CARTES_DES_DEFIS as readonly string[]).includes(x)

/** Les préfixes de ce qui se range : un rang d'un défi (`cabinet:defi:cagnotte:2`), une épreuve de maître (`cabinet:maitrise:dragon`). */
export const PREFIXE_DES_DEFIS = 'cabinet:defi:'
export const PREFIXE_DES_MAITRISES = 'cabinet:maitrise:'
export const cleDuRang = (carte: CleDeCarte, rang: RangDUnDefi): string => `${PREFIXE_DES_DEFIS}${carte}:${rang}`
export const cleDeLaMaitrise = (gardien: string): string => `${PREFIXE_DES_MAITRISES}${gardien.replace(/^lg:/, '')}`

/** Un rang lu d'une clé : sa carte et son rang ; null : une autre clé, ou une clé abîmée. */
export function rangDeLaCle(cle: string): { carte: CleDeCarte; rang: RangDUnDefi } | null {
  if (!cle.startsWith(PREFIXE_DES_DEFIS)) return null
  const [carte, rang, ...reste] = cle.slice(PREFIXE_DES_DEFIS.length).split(':')
  const n = Number(rang)
  return reste.length === 0 && estUneCarte(carte) && (n === 1 || n === 2 || n === 3) ? { carte, rang: n } : null
}

/** Le gardien d'une épreuve de maître lue d'une clé (`lg:dragon`) ; null : une autre clé. */
export const gardienDeLaMaitrise = (cle: string): string | null => (cle.startsWith(PREFIXE_DES_MAITRISES) && cle.length > PREFIXE_DES_MAITRISES.length ? `lg:${cle.slice(PREFIXE_DES_MAITRISES.length)}` : null)

/** Ce qu'un profil tient : le rang de chaque carte (0 à 3), et les gardiens qu'il a vaincus en maître. */
export interface DefisTenus {
  rangs: Readonly<Record<CleDeCarte, 0 | RangDUnDefi>>
  maitrises: readonly string[]
}

/** Les défis qu'un profil tient, d'après les clés de son étagère — une clé inconnue ou abîmée se tait. */
export function defisTenus(cles: Iterable<string>): DefisTenus {
  const rangs = Object.fromEntries(CARTES_DES_DEFIS.map(c => [c, 0])) as Record<CleDeCarte, 0 | RangDUnDefi>
  const maitrises: string[] = []
  for (const cle of cles) {
    const r = rangDeLaCle(cle)
    if (r && r.rang > rangs[r.carte]) rangs[r.carte] = r.rang
    const g = gardienDeLaMaitrise(cle)
    if (g && !maitrises.includes(g)) maitrises.push(g)
  }
  return { rangs, maitrises }
}

/** Combien de défis il tient à ce rang au moins : les cinq Argent de la gerbe, les dix Or du légendaire. */
export const defisAuMoins = (t: Pick<DefisTenus, 'rangs'>, rang: RangDUnDefi): number => CARTES_DES_DEFIS.filter(c => t.rangs[c] >= rang).length

/**
 * Les confettis des défis : chaque rang tenu, une fois — le Bronze, puis l'Argent en plus (`CONFETTIS_D_UN_RANG`).
 * Relus à chaque lecture du solde, comme toute source (`boutiqueEtDons`) : un rang compte s'il est rangé, jamais
 * autant de fois que de lignes.
 */
export function confettisDesDefis(recompenses: ReadonlyMap<string, number>): number {
  let n = 0
  for (const [cle, fois] of recompenses) {
    const r = fois > 0 ? rangDeLaCle(cle) : null
    if (r) n += CONFETTIS_D_UN_RANG[r.rang - 1]
  }
  return n
}

/** Le titre qu'un défi tenu à l'Or fait porter — sa clé même : « Le Trésorier ». Null : pas un Or. */
export function nomDuTitreDuDefi(cle: string): string | null {
  const r = rangDeLaCle(cle)
  return r && r.rang === 3 ? NOMS_DES_DEFIS[r.carte] : null
}

/** Les titres qu'il peut porter, ses défis tenus à l'Or, dans l'ordre des cartes. */
export const titresDesDefis = (t: Pick<DefisTenus, 'rangs'>): string[] => CARTES_DES_DEFIS.filter(c => t.rangs[c] === 3).map(c => cleDuRang(c, 3))

/** La gerbe du Cabinet tombe-t-elle : assez de défis tenus à l'Argent. */
export const gerbeDesDefis = (t: Pick<DefisTenus, 'rangs'>): boolean => defisAuMoins(t, 2) >= ARGENTS_POUR_LA_GERBE
/** Le légendaire du Cabinet tombe-t-il : tous les défis tenus à l'Or. */
export const legendaireDesDefis = (t: Pick<DefisTenus, 'rangs'>): boolean => defisAuMoins(t, 3) >= ORS_POUR_LE_LEGENDAIRE
