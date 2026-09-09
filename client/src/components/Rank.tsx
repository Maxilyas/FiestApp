/**
 * Le rang dans un classement, à la place des médailles : un chiffre serif,
 * champagne pour le premier, encre pour les deux suivants, atténué ensuite.
 * Deux ex æquo portent le même chiffre — c'est l'appelant qui le calcule.
 */
export function Rank({ n }: { n: number }) {
  return <span className={'lb-rank' + (n >= 1 && n <= 3 ? ` rank-${n}` : '')}>{n}</span>
}
