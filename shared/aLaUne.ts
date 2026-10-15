// Le bandeau « À la une » de l'accueil (le plan d'action validé avec le
// propriétaire le 14 octobre 2026, la maquette C : un bandeau fin, sous
// l'identité, qui ne repousse pas les gros boutons de jeu) : ce que la
// boutique a de plus beau à lui montrer — un compagnon qu'il n'a pas, un
// thème qui lui manque, celui de la saison d'abord, qui partira avec elle.
//
// Le tirage tourne d'un cran chaque jour, et reste le même toute la journée,
// sur tous ses appareils : un bandeau qui changerait à chaque visite ne
// laisserait rien retenir. Rien de ce qu'il a déjà ; rien du tout s'il a
// tout — l'absence, pas un bandeau vide.

import { COMPAGNONS, type CleDeCompagnon } from './compagnons'
import { enBoutique, THEMES, type BoutiqueDuProfil, type Theme } from './themes'

export type ALaUne = { sorte: 'compagnon'; cle: CleDeCompagnon } | { sorte: 'theme'; cle: string; saison: boolean }

/** Ce que le bandeau montre au plus : au-delà, plus personne ne voit le premier revenir. */
export const A_LA_UNE_MAX = 3

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** Le rang d'un jour de Paris (`2026-10-14`) dans le calendrier : de quoi tourner d'un cran chaque jour. */
function rangDuJour(jour: string): number {
  const [a, m, j] = jour.split('-').map(Number)
  const t = Date.UTC(a || 2000, (m || 1) - 1, j || 1)
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : 0
}

/** La liste tournée de `n` crans : le premier change chaque jour. */
function tournee<T>(liste: readonly T[], n: number): T[] {
  if (liste.length === 0) return []
  const k = ((n % liste.length) + liste.length) % liste.length
  return [...liste.slice(k), ...liste.slice(0, k)]
}

const BEAUX = new Set(['rare', 'epique', 'legendaire'])

/**
 * Ce que l'accueil met à la une ce jour-là, trois au plus, en alternance :
 * un compagnon qu'il n'a pas, un thème — de saison d'abord, puis les plus
 * beaux, rares et au-delà, puis les autres —, puis ce qui reste des deux.
 */
export function aLaUne(boutique: Pick<BoutiqueDuProfil, 'possedes' | 'jour' | 'compagnons'>): ALaUne[] {
  const n = rangDuJour(boutique.jour)
  const adoptes = new Set((boutique.compagnons ?? []).map(c => c.compagnon))
  const compagnons: ALaUne[] = tournee(
    COMPAGNONS.filter(c => !adoptes.has(c.key)),
    n,
  ).map(c => ({ sorte: 'compagnon', cle: c.key }))
  const possedes = new Set(boutique.possedes)
  const aPrendre = THEMES.filter(t => t.rarete !== 'offert' && !possedes.has(t.key) && enBoutique(t, boutique.jour))
  const deSaison = aPrendre.filter(t => t.saison)
  const beaux = aPrendre.filter(t => !t.saison && BEAUX.has(t.rarete))
  const autres = aPrendre.filter(t => !t.saison && !BEAUX.has(t.rarete))
  const themes: ALaUne[] = [...tournee(deSaison, n), ...tournee(beaux, n), ...tournee(autres, n)].map(t => ({ sorte: 'theme', cle: t.key, saison: !!t.saison }))
  const une: ALaUne[] = []
  for (let i = 0; une.length < A_LA_UNE_MAX && (i < compagnons.length || i < themes.length); i++) {
    if (compagnons[i]) une.push(compagnons[i])
    if (une.length < A_LA_UNE_MAX && themes[i]) une.push(themes[i])
  }
  return une
}

/** Le dernier jour d'un thème de saison en boutique : « jusqu'au 1er novembre ». */
export function jusquAuBoutDeSaSaison(t: Theme): string | null {
  if (!t.saison) return null
  const [mois, jour] = t.saison.fin
  return `jusqu’au ${jour === 1 ? '1er' : jour} ${MOIS[mois - 1]}`
}
