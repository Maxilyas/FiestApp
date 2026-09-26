// Les saisons : trois légendaires qui ne se gagnent qu'à leur période —
// Halloween, Noël, le Nouvel An. Des jours joués au quiz du jour pendant la
// période, ou une soirée ces jours-là (une soirée qui compte, à deux au
// moins) : l'une des deux suffit.
//
// Une saison gagnée se range comme une récompense (`saison:halloween`) :
// sous le jour qui l'a ouverte pour le quiz du jour, sous la soirée qui l'a
// ouverte sinon — et une soirée retirée de l'historique l'emporte avec elle,
// comme tout ce qu'elle avait fait tomber. Les dates sont celles de Paris :
// celles du quiz du jour (`jourDe`), et de la première question jouée d'une
// soirée (`soireeDesInvites`).

export type CleDeSaison = 'halloween' | 'noel' | 'nouvel-an'

export interface Saison {
  key: CleDeSaison
  nom: string
  /** Le légendaire qu'elle ouvre. */
  legendaire: string
  /** Premier et dernier jour, mois et jour, bornes comprises. Le Nouvel An enjambe l'année. */
  debut: [number, number]
  fin: [number, number]
  /** Les jours de quiz du jour qu'il faut dans la période. */
  jours: number
  /** La période en toutes lettres : « du 25 octobre au 1er novembre ». */
  periode: string
  /** L'emoji de sa ligne de récompense, que rien n'affiche : une étagère se relit des années plus tard. */
  emoji: string
}

export const SAISONS: readonly Saison[] = [
  { key: 'halloween', nom: 'Halloween', legendaire: 'lg:citrouille', debut: [10, 25], fin: [11, 1], jours: 3, periode: 'du 25 octobre au 1er novembre', emoji: '🎃' },
  { key: 'noel', nom: 'Noël', legendaire: 'lg:sapin', debut: [12, 20], fin: [12, 26], jours: 3, periode: 'du 20 au 26 décembre', emoji: '🎄' },
  // Quatre jours seulement, qui enjambent l'année : deux suffisent.
  { key: 'nouvel-an', nom: 'le Nouvel An', legendaire: 'lg:bouquet', debut: [12, 30], fin: [1, 2], jours: 2, periode: 'du 30 décembre au 2 janvier', emoji: '🎆' },
]

/** La clé de récompense d'une saison gagnée : `saison:halloween`. */
export const cleDeSaison = (s: Saison) => `saison:${s.key}`

/** La saison d'une clé de récompense (`saison:noel`), ou d'une clé nue. */
export function saison(cle: unknown): Saison | undefined {
  if (typeof cle !== 'string') return undefined
  const nue = cle.startsWith('saison:') ? cle.slice('saison:'.length) : cle
  return SAISONS.find(s => s.key === nue)
}

const deux = (n: number) => String(n).padStart(2, '0')
const date = (annee: number, [mois, jour]: [number, number]) => `${annee}-${deux(mois)}-${deux(jour)}`

/**
 * La période qui contient ce jour (« 2026-10-31 »), et ses bornes, ou null
 * hors saison. Le Nouvel An du 1er janvier 2027 commence le 30 décembre 2026.
 */
export function periodeDu(jour: string): { saison: Saison; debut: string; fin: string } | null {
  const annee = Number(jour.slice(0, 4))
  if (!Number.isInteger(annee)) return null
  for (const s of SAISONS) {
    const enjambe = s.fin[0] < s.debut[0]
    for (const depart of enjambe ? [annee - 1, annee] : [annee]) {
      const debut = date(depart, s.debut)
      const fin = date(enjambe ? depart + 1 : depart, s.fin)
      if (jour >= debut && jour <= fin) return { saison: s, debut, fin }
    }
  }
  return null
}
