/** « 1ᵉʳ », puis « 2ᵉ », « 3ᵉ »… — le premier n'est pas « 1ᵉ ». */
export const ordinal = (n: number) => (n === 1 ? '1ᵉʳ' : `${n}ᵉ`)

export const formatNumber = (n: number) => n.toLocaleString('fr-FR')
