/** « 1ᵉʳ », puis « 2ᵉ », « 3ᵉ »… — le premier n'est pas « 1ᵉ ». */
export const ordinal = (n: number) => (n === 1 ? '1ᵉʳ' : `${n}ᵉ`)

export const formatNumber = (n: number) => n.toLocaleString('fr-FR')

/** Une part en pour cent, « — » tant qu'il n'y a rien à diviser. */
export const pourcent = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)} %`)

/** Une durée au dixième de seconde, à la française : « 2,4 s ». */
export const secondes = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1).replace('.', ',')} s`)
