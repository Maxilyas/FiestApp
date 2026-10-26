// L'unité d'un nombre, accordée comme on l'écrit en français : au-dessous de
// deux, le singulier — « 1 jour », « 1,5 jour », « 0 jour », comme « 0 pt »
// (`pts`, `shared/typographie.ts`) —, et à deux et au-delà, l'unité telle que
// la base l'écrit, au pluriel. La base n'écrit l'unité d'une valeur qu'une
// fois (`meta.valeur.unite`, « jours »), et le Filet du Cabinet la posait
// derrière chaque nombre de sa piste : « Ton filet : de 1 jours à 17 jours »
// (Camille, à la tablée du 26 octobre 2026).
//
// Pure, sans dictionnaire : un symbole ne s'accorde pas (« km », « °C »,
// « km/h » — un chiffre, un signe, deux lettres au plus), un mot perd son s,
// et ce qui fait autrement est écrit ici. Chaque unité que le Filet pose est
// relue une à une (`cabinet-ecran-neufs.test.ts` ; 278 le 26 octobre 2026) :
// une unité neuve que ces règles ne savent pas dire y rougit, et s'écrit dans
// l'une des deux listes.

/** Les mots dont le singulier garde son s, son x ou son z. */
const QUI_NE_CHANGENT_PAS = new Set([
  'fois', 'mois', 'pays', 'os', 'pas', 'vers', 'cure-dents', 'bois', 'poids', 'prix', 'choix', 'voix', 'croix', 'noix', 'temps',
  'corps', 'bras', 'cas', 'repas', 'avis', 'fils', 'jus', 'nez',
])

/** Les pluriels qui ne s'écrivent pas d'un s de plus : leur singulier. */
const PLURIELS_A_PART: ReadonlyMap<string, string> = new Map([
  ['yeux', 'œil'],
  ['pence', 'penny'],
  ['Länder', 'Land'],
  ['travaux', 'travail'],
])

/** Un mot qui n'est qu'un symbole : un chiffre ou un signe dedans, ou deux lettres au plus (« km », « s », « Hz »). */
const estUnSymbole = (mot: string) => /[^\p{L}'’-]/u.test(mot) || Array.from(mot).length <= 2

/** Un mot au singulier : « jours » → « jour », « tableaux » → « tableau », « maréchaux » → « maréchal ». */
function auSingulier(mot: string): string {
  const aPart = PLURIELS_A_PART.get(mot)
  if (aPart !== undefined) return aPart
  if (estUnSymbole(mot) || QUI_NE_CHANGENT_PAS.has(mot.toLowerCase())) return mot
  if (/(eau|eu|ou)x$/.test(mot)) return mot.slice(0, -1)
  if (mot.endsWith('aux')) return `${mot.slice(0, -3)}al`
  return mot.endsWith('s') ? mot.slice(0, -1) : mot
}

/**
 * L'unité de `n`, accordée : telle quelle à deux et au-delà ; au singulier
 * au-dessous, chaque mot — « grands tours » → « grand tour », « millions °C »
 * → « million °C » —, et seul ce qui compte d'une unité composée : « miles/h »
 * → « mile/h », « km/s » reste « km/s ».
 */
export function uniteAccordee(unite: string, n: number): string {
  if (!Number.isFinite(n) || Math.abs(n) >= 2) return unite
  return unite
    .split(' ')
    .map(mot => {
      const barre = mot.indexOf('/')
      return barre > 0 ? `${auSingulier(mot.slice(0, barre))}${mot.slice(barre)}` : auSingulier(mot)
    })
    .join(' ')
}
