// Les six pages de l'album des trophées, et celle de chaque trophée — à
// part de l'album (`shared/trophees.ts`) : la fin d'une partie mène à la page
// de ce qu'elle vient de faire tomber sans télécharger tous les catalogues
// que l'album lit (les sentiers, les ligues, le calendrier, les écussons).

import { hautFaitDeSoiree, origineDe, palierDe } from './hautsfaits'

export type PageDesTrophees = 'soiree' | 'jour' | 'campagne' | 'duels' | 'sentiers' | 'cabinet' | 'partout'

/**
 * Les sept pages, dans l'ordre des onglets. Le Cabinet de curiosités a la sienne depuis le 1er novembre 2026 (« est-ce
 * que l'on voit quelque part dans la collection, album des trophées, une section cabinets ? », le propriétaire) : les
 * défis de ses cartes, ses épreuves de maître, et L'Explorateur, rangé jusque-là en campagne.
 */
export const PAGES_DES_TROPHEES: readonly PageDesTrophees[] = ['soiree', 'jour', 'campagne', 'duels', 'sentiers', 'cabinet', 'partout']

/**
 * Les pistes qui se gagnent au Cabinet : leurs paliers tombent comme ceux de la campagne (`deCampagne`), mais ce
 * qu'elles comptent se fait au Cabinet — leur page, et l'écran où aller les gagner (`ouJouer`).
 */
export const PISTES_DU_CABINET: ReadonlySet<string> = new Set(['hf:explorateur'])

/** Le nom de chaque page, sur son onglet. */
export const NOM_DE_LA_PAGE: Readonly<Record<PageDesTrophees, string>> = {
  soiree: 'Soirée',
  jour: 'Quiz du jour',
  campagne: 'Campagne',
  duels: 'Duels',
  sentiers: 'Sentiers',
  cabinet: 'Cabinet',
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
  // Un défi d'une carte, une épreuve de maître : leurs clés vivent sous le préfixe des voies du Cabinet.
  if (cle.startsWith('cabinet:')) return 'cabinet'
  const p = palierDe(cle)
  if (p) {
    const h = p.hautFait
    if (h.key === 'hf:legende' || h.key === 'hf:eclats') return 'partout'
    if (PISTES_DU_CABINET.has(h.key)) return 'cabinet'
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
