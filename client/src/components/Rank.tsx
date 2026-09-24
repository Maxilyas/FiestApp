/**
 * Le rang dans un classement, à la place des médailles : un chiffre serif,
 * champagne pour le premier, encre pour les deux suivants, atténué ensuite.
 * Deux ex æquo portent le même chiffre — c'est l'appelant qui le calcule.
 *
 * Le mot « rang » n'est écrit que pour le lecteur d'écran : à l'œil, la
 * colonne dit ce qu'est le chiffre ; à l'oreille, « 1, Hugo, 0 » ne disait
 * pas lequel des deux nombres était le rang.
 */
export function Rank({ n }: { n: number }) {
  return (
    <span className={'lb-rank' + (n >= 1 && n <= 3 ? ` rank-${n}` : '')}>
      <span className="sr-only">Rang </span>
      {n}
    </span>
  )
}

/** « 0 point », « 1 point », « 2 points » : le pluriel français commence à deux. */
export const motPoints = (n: number) => (Math.abs(n) >= 2 ? 'points' : 'point')

/**
 * Le score d'une ligne de classement, et pour l'oreille ce qu'il compte —
 * le pendant du rang, sans quoi deux nombres nus se suivaient.
 */
export function Score({
  n,
  texte,
  precision,
  className = 'lb-score',
}: {
  n: number
  texte?: string
  precision?: string
  className?: string
}) {
  return (
    <span className={className}>
      {texte ?? n}
      <span className="sr-only">
        {' '}
        {motPoints(n)}
        {precision && ` ${precision}`}
      </span>
    </span>
  )
}
