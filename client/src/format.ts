// Un rang s'écrit devant « place » (« 1ʳᵉ place ») : « 1ᵉʳ sur 7 » mettait au
// masculin la victoire de n'importe qui. Voir `shared/typographie.ts`.
export { espacesFines, place, rang } from '../../shared/typographie'

export const formatNumber = (n: number) => n.toLocaleString('fr-FR')

/** Une part en pour cent, « — » tant qu'il n'y a rien à diviser. */
export const pourcent = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`)

/** Une durée au dixième de seconde, à la française : « 2,4 s ». */
export const secondes = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`)
