/**
 * Ce qui reste à taper, dit seulement quand la limite approche.
 *
 * Le champ prénom s'arrêtait à 24 caractères sans rien dire : la lettre
 * tapée de trop disparaissait, et l'invité croyait son clavier en panne.
 */
export function Limite({ valeur, max }: { valeur: string; max: number }) {
  const reste = max - valeur.length
  if (reste > 4) return null
  return (
    <span className="muted small" aria-live="polite">
      {reste <= 0 ? `${max} caractères au plus` : `Encore ${reste} caractère${reste > 1 ? 's' : ''}`}
    </span>
  )
}
