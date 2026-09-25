// Ce que le mur dit à la salle, que l'aperçu de l'éditeur reprend mot pour
// mot : l'aperçu écrivait « Chacun tape son estimation », le mur « Tapez votre
// estimation sur votre téléphone » — un aperçu qui ne montre pas le vrai texte
// ne sert à rien.

import type { Variante } from '../../../../shared/library'

/**
 * La consigne d'une estimation, au vous de la salle. En direct, la bonne
 * réponse n'existe pas encore : elle se mesure après.
 */
export const consigneEstimation = (unite: string | undefined, enDirect?: boolean) =>
  `Tapez votre estimation sur votre téléphone${unite?.trim() ? ` (en ${unite.trim()})` : ''} — ${enDirect ? 'on mesure après, et ' : ''}le plus proche gagne !`

/** La consigne d'un QCM qui n'en est pas tout à fait un. */
export const CONSIGNE_DES_VARIANTES: Record<Variante, string> = {
  plusieurs: 'Plusieurs bonnes réponses : trouvez-les toutes',
  ordre: 'Remettez-les dans l’ordre sur votre téléphone',
  sondage: 'Votez sur votre téléphone : qui, dans la salle ?',
}
