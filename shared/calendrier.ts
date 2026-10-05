// Le Calendrier des Heures : douze enluminures, une par mois, peintes dans
// l'esprit des Très Riches Heures du duc de Berry — un livre d'heures du XVᵉ
// siècle, dans le domaine public. Chaque mois joué au moins vingt jours au
// quiz du jour ouvre la page de ce mois ; le champion du mois reçoit sa
// version dorée, comme un légendaire sa version rare. Les douze ouvrent le
// thème des Très Riches Heures (`shared/themes.ts`).
//
// Une collection que tout le monde peut finir, pas seulement les meilleurs :
// la régularité, pas le génie. Une page ouverte se range sous le jour qui l'a
// ouverte (`heures:10` sous `#jour:2026-10-24`) : aucune soirée ne la porte,
// et une année de plus la compte deux fois sans rien ouvrir de neuf. Elle ne
// va ni sur l'étagère ni dans le compte des badges : elle a sa page.

import { moisDuChampion } from './jour'

/** Les jours de quiz du jour qu'il faut dans un mois pour ouvrir sa page — une partie commencée compte. */
export const JOURS_POUR_UNE_PAGE = 20

export const PREFIXE_DES_PAGES = 'heures:'

export interface PageDuCalendrier {
  /** Le mois, sur deux chiffres : « 01 » pour janvier. */
  mois: string
  nom: string
  /** Ce que la page montre, en une phrase : son texte de remplacement. */
  scene: string
}

/** Les douze pages, de janvier à décembre : les travaux et les fêtes de chaque mois. */
export const PAGES: readonly PageDuCalendrier[] = [
  { mois: '01', nom: 'Janvier', scene: 'Le banquet des étrennes, la grande salle tendue de tapisseries.' },
  { mois: '02', nom: 'Février', scene: 'La ferme sous la neige, le feu dans l’âtre, les moutons serrés.' },
  { mois: '03', nom: 'Mars', scene: 'Les labours au pied du château, les vignes qu’on taille.' },
  { mois: '04', nom: 'Avril', scene: 'Les fiançailles dans un pré en fleurs, les vergers blancs.' },
  { mois: '05', nom: 'Mai', scene: 'La cavalcade du premier mai, couronnée de feuillages.' },
  { mois: '06', nom: 'Juin', scene: 'La fenaison le long de la rivière, devant les tours de la ville.' },
  { mois: '07', nom: 'Juillet', scene: 'La moisson des blés d’or et la tonte des moutons.' },
  { mois: '08', nom: 'Août', scene: 'La chasse au faucon, et la baignade dans la rivière.' },
  { mois: '09', nom: 'Septembre', scene: 'Les vendanges au pied du château aux toits bleus.' },
  { mois: '10', nom: 'Octobre', scene: 'Les semailles, et l’épouvantail au bord du champ.' },
  { mois: '11', nom: 'Novembre', scene: 'La glandée dans la forêt rousse, les porcs sous les chênes.' },
  { mois: '12', nom: 'Décembre', scene: 'La curée du sanglier, au cœur de la forêt d’hiver.' },
]

/** La clé d'une page ouverte : `heures:10` pour octobre. */
export const cleDeLaPage = (mois: string) => `${PREFIXE_DES_PAGES}${mois}`

/** Le mois d'une clé de page (`heures:10` → `10`), null pour toute autre clé. */
export function moisDeLaPage(cle: string | null | undefined): string | null {
  if (!cle?.startsWith(PREFIXE_DES_PAGES)) return null
  const mois = cle.slice(PREFIXE_DES_PAGES.length)
  return PAGES.some(p => p.mois === mois) ? mois : null
}

/** Les pages qu'il a ouvertes, dans l'ordre de l'année. */
export function pagesOuvertes(recompenses: ReadonlyMap<string, number>): string[] {
  return PAGES.filter(p => (recompenses.get(cleDeLaPage(p.mois)) ?? 0) > 0).map(p => p.mois)
}

/**
 * Les pages dorées : celles des mois dont il a été champion, une année ou
 * l'autre. La dorure se lit sur ses titres de champion (`mois:2026-10`) —
 * rien de plus ne s'écrit —, et elle ne vient qu'avec la page : champion
 * d'octobre sans y avoir joué vingt jours, il n'a pas la page à dorer.
 */
export function pagesDorees(recompenses: ReadonlyMap<string, number>): string[] {
  const champion = new Set<string>()
  for (const [cle, n] of recompenses) {
    const mois = n > 0 ? moisDuChampion(cle) : null
    if (mois) champion.add(mois.slice(5, 7))
  }
  return pagesOuvertes(recompenses).filter(m => champion.has(m))
}
