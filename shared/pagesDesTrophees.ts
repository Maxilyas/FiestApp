// Les six pages de l'album des trophées, et celle de chaque trophée — à
// part de l'album (`shared/trophees.ts`) : la fin d'une partie mène à la page
// de ce qu'elle vient de faire tomber sans télécharger tous les catalogues
// que l'album lit (les sentiers, les ligues, le calendrier, les écussons).

import { hautFaitDeSoiree, origineDe, palierDe } from './hautsfaits'

export type PageDesTrophees = 'soiree' | 'jour' | 'campagne' | 'duels' | 'sentiers' | 'partout'

export const PAGES_DES_TROPHEES: readonly PageDesTrophees[] = ['soiree', 'jour', 'campagne', 'duels', 'sentiers', 'partout']

/** Le nom de chaque page, sur son onglet. */
export const NOM_DE_LA_PAGE: Readonly<Record<PageDesTrophees, string>> = {
  soiree: 'Soirée',
  jour: 'Quiz du jour',
  campagne: 'Campagne',
  duels: 'Duels',
  sentiers: 'Sentiers',
  partout: 'Partout',
}

/** La page qu'une adresse nomme (`#collection-trophees-jour`), ou null. */
export function pageDesTropheesNommee(mot: string): PageDesTrophees | null {
  return PAGES_DES_TROPHEES.find(x => x === mot) ?? null
}

/**
 * La page d'un trophée, d'où qu'il vienne — un palier rangé, un haut fait,
 * un prix, une page du calendrier, un titre : où le retrouver dans l'album
 * depuis la fin d'une partie.
 */
export function pageDuTrophee(cle: string): PageDesTrophees {
  const p = palierDe(cle)
  if (p) {
    const h = p.hautFait
    if (h.key === 'hf:legende' || h.key === 'hf:eclats') return 'partout'
    return origineDe(h) ?? 'soiree'
  }
  const h = hautFaitDeSoiree(cle)
  if (h) return origineDe(h) ?? 'soiree'
  if (cle.startsWith('heures:') || cle.startsWith('mois:')) return 'jour'
  if (cle.startsWith('maitre:')) return 'sentiers'
  if (cle.startsWith('ligue:') || cle.startsWith('bordure:')) return 'duels'
  if (cle.startsWith('ecusson:')) return 'partout'
  return 'soiree'
}
