// Ce que le mur dit à la salle, que l'aperçu de l'éditeur reprend mot pour
// mot : l'aperçu écrivait « Chacun tape son estimation », le mur « Tapez votre
// estimation sur votre téléphone » — un aperçu qui ne montre pas le vrai texte
// ne sert à rien.

/** La consigne d'une estimation, au vous de la salle. */
export const consigneEstimation = (unite: string | undefined) =>
  `Tapez votre estimation sur votre téléphone${unite?.trim() ? ` (en ${unite.trim()})` : ''} — le plus proche gagne !`
