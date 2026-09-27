// Le focus d'un écran qui change sous le doigt.
//
// Le bouton touché disparaît avec l'écran qu'il quittait — « Question
// suivante », la réponse choisie —, ou s'éteint à l'échéance : le focus
// tombait sur la page entière. Un lecteur d'écran ne disait rien de la
// question qui s'ouvrait ni du résultat, pendant que le chrono courait, et
// le Tab suivant repartait du haut.

/** Ce que le focus regarde pour savoir s'il s'est perdu. */
type Page = Pick<Document, 'activeElement' | 'body'>

/**
 * S'il s'est perdu — et seulement alors : une boîte ouverte, un champ en
 * cours le gardent —, pose le focus sur la première des `cibles` que
 * l'écran contient, sans défiler. Rend ce qui l'a reçu.
 */
export function rendreLeFocus(ecran: ParentNode | null, cibles: readonly string[], page: Page = document): HTMLElement | null {
  const actif = page.activeElement
  if (actif && actif !== page.body) return null
  for (const selecteur of cibles) {
    const cible = ecran?.querySelector<HTMLElement>(selecteur)
    if (!cible) continue
    // Par programme seulement : ni un arrêt de plus pour le Tab, ni l'anneau
    // du clavier (`styles.css`).
    cible.tabIndex = -1
    cible.focus({ preventScroll: true })
    return cible
  }
  return null
}
