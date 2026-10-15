// Le coffre de la semaine (le plan d'action validé avec le propriétaire le
// 14 octobre 2026, « carte à tampons » ; puis son souhait du même soir :
// « une animation ultra stylée, d'un coffre qui s'ouvre en fin de semaine, et
// on sait si on a un thème, un avatar, une carte… »).
//
// Chaque jour où ses trois missions sont faites pose un tampon sur la carte
// de la semaine (`shared/missions.ts`). Le lundi, le coffre de la semaine
// passée s'ouvre : de bois, d'argent, d'or ou royal selon ses tampons — plus
// de tampons, plus beau coffre —, et il donne un objet tiré à sa rareté :
// des confettis, un thème de la boutique, un compagnon, ou un objet du
// trésor, introuvable en boutique (`shared/tresor.ts`). Jamais ce qu'il a
// déjà. Le tirage se fait une fois, à l'ouverture, et ne se refait jamais
// (`profile_coffres`) : rouvert, le coffre redonne ce qu'il a donné.
//
// Ce fichier reste léger — l'accueil le lit pour dire qu'un coffre attend —
// : les catalogues que le tirage parcourt vivent dans `shared/tresor.ts`.

import type { Rarete } from './badges'

/** Le rang d'un coffre, du plus humble au plus somptueux : chacun son dessin (`components/coffres-peints.ts`). */
export type RangDuCoffre = 'bois' | 'argent' | 'or' | 'royal'

export const RANGS_DU_COFFRE: readonly RangDuCoffre[] = ['bois', 'argent', 'or', 'royal']

/** Les tampons qu'il faut à chaque rang : sept, une semaine sans un jour manqué. */
export const TAMPONS_DU_RANG: Readonly<Record<RangDuCoffre, number>> = { bois: 1, argent: 3, or: 5, royal: 7 }

/** Les tampons d'une semaine — les jours où ses trois missions sont faites. */
export const TAMPONS_PAR_SEMAINE = 7

/** Le coffre que remplissent ces tampons ; aucun sans tampon : une semaine sans mission faite n'en a pas. */
export function rangDuCoffre(tampons: number): RangDuCoffre | null {
  let rang: RangDuCoffre | null = null
  for (const r of RANGS_DU_COFFRE) if (tampons >= TAMPONS_DU_RANG[r]) rang = r
  return rang
}

export const NOM_DU_COFFRE: Readonly<Record<RangDuCoffre, string>> = {
  bois: 'Le coffre de bois',
  argent: 'Le coffre d’argent',
  or: 'Le coffre d’or',
  royal: 'Le coffre royal',
}

/**
 * Les chances de chaque rareté, en pour cent, selon le coffre : un choix de
 * produit (`docs/reference/baremes.md`). Le coffre de bois ne donne jamais
 * de légendaire, le royal jamais de commun. Une rareté où il n'y a plus rien
 * qu'il n'ait déjà descend d'un cran (`tirerLeCoffre`, `shared/tresor.ts`).
 */
export const CHANCES_DU_COFFRE: Readonly<Record<RangDuCoffre, Readonly<Record<Rarete, number>>>> = {
  bois: { commune: 55, peucommune: 30, rare: 12, epique: 3, legendaire: 0 },
  argent: { commune: 30, peucommune: 32, rare: 26, epique: 10, legendaire: 2 },
  or: { commune: 10, peucommune: 25, rare: 37, epique: 21, legendaire: 7 },
  royal: { commune: 0, peucommune: 10, rare: 40, epique: 35, legendaire: 15 },
}

/** Les confettis d'un coffre qui en donne : sa rareté commune, ou ce qui reste quand il a déjà tout le reste. */
export const CONFETTIS_DU_COFFRE: Readonly<Record<RangDuCoffre, number>> = { bois: 60, argent: 90, or: 120, royal: 150 }

/**
 * Ce qu'un coffre donne. Un thème et un compagnon sont ceux de la boutique,
 * offerts ; un fond de carte et une gerbe, ceux du trésor, qui ne se vendent
 * pas (`FONDS`, `GERBES` : marqués `tresor`).
 */
export type ObjetDuTresor =
  | { sorte: 'confettis'; confettis: number }
  | { sorte: 'fond'; cle: string }
  | { sorte: 'gerbe'; cle: string }
  | { sorte: 'theme'; cle: string }
  | { sorte: 'compagnon'; cle: string }

/** La sorte d'un objet du coffre, pour la phrase : « Fond de carte », « Thème ». */
export const NOM_DE_LA_SORTE: Readonly<Record<ObjetDuTresor['sorte'], string>> = {
  confettis: 'Confettis',
  fond: 'Fond de carte',
  gerbe: 'Gerbe',
  theme: 'Thème',
  compagnon: 'Compagnon',
}

/** La clé d'un objet, telle que `profile_coffres.objet` la garde : « fond:dragon », « confettis ». */
export function cleDeLObjet(o: ObjetDuTresor): string {
  return o.sorte === 'confettis' ? 'confettis' : `${o.sorte}:${o.cle}`
}

/** L'objet d'une clé gardée, et ses confettis ; null si la clé ne se lit pas. */
export function lireLObjet(cle: unknown, confettis: number): ObjetDuTresor | null {
  if (cle === 'confettis') return confettis > 0 ? { sorte: 'confettis', confettis } : null
  if (typeof cle !== 'string') return null
  const m = /^(fond|gerbe|theme|compagnon):([\w-]+)$/.exec(cle)
  return m ? { sorte: m[1] as 'fond' | 'gerbe' | 'theme' | 'compagnon', cle: m[2] } : null
}

/** Un coffre qui attend son lundi passé : la semaine de ses tampons, combien, et son rang. */
export interface CoffreEnAttente {
  /** Le lundi de la semaine dont les tampons l'ont rempli (« 2026-10-12 »). */
  semaine: string
  tampons: number
  rang: RangDuCoffre
}

/** Un coffre ouvert : ce qu'il a donné, tel que la scène de l'ouverture le dit. */
export interface CoffreOuvert extends CoffreEnAttente {
  rarete: Rarete
  objet: ObjetDuTresor
  /** « La Voie lactée », « 120 confettis ». */
  nom: string
  /** Ce qu'il fait, en une phrase : « Un fond du trésor, introuvable en boutique… ». */
  detail: string
  ouvertLe: number
}

/** Une semaine bien écrite : un lundi au calendrier (« 2026-10-12 »). */
export function semaineValide(semaine: unknown): semaine is string {
  if (typeof semaine !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(semaine)) return false
  const [a, m, j] = semaine.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, j))
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j && d.getUTCDay() === 1
}
