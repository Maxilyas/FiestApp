// Les cruches : mesurer une quantité qu'aucun récipient ne mesure, en versant de
// l'un dans l'autre. On ne verse jamais « un peu » : jusqu'à vider l'un ou
// remplir l'autre. Tartaglia en pose au XVIe siècle, Bachet en 1612, Dudeney en
// fait un chapitre entier. Le moule en tire aussi sans fin : deux cruches, une
// fontaine, une quantité — et il ne garde que celles qui se résolvent, au nombre
// de gestes que la profondeur demande.
import { alea, parmi, plusCourt, type Fiche, type Moule, type Niveau } from '../socle'

export interface Vase {
  nom: string
  cap: number
  /** Comment le but le nomme : « la mesure de cinq ». */
  dans?: string
}
export interface FicheDeCruches extends Fiche {
  moule: 'cruches'
  vases: readonly Vase[]
  /** Ce que chacun contient au départ. */
  plein: readonly number[]
  /** On peut remplir et vider à volonté. */
  fontaine: boolean
  /** Une quantité à tenir dans un vase, ou ce que chacun doit contenir (null : peu importe). */
  cible: { un: number } | { tous: readonly (number | null)[] }
  /** L'unité qu'on verse : « pinte ». */
  mesure?: string
}
export interface EtatDeCruches { n: number[] }
export type CoupDeCruches = { verse: [number, number] } | { remplit: number } | { vide: number }

const atteint = (f: FicheDeCruches, n: readonly number[]) => ('un' in f.cible ? n.includes(f.cible.un) : f.cible.tous.every((v, i) => v == null || n[i] === v))
const rang = (f: FicheDeCruches, i: unknown): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < f.vases.length

/** Le but, dit en une phrase au-dessus des cruches. */
export function butDesCruches(f: FicheDeCruches): string {
  if ('un' in f.cible) return `Le but : ${f.cible.un} ${f.cible.un > 1 ? (f.mesure || 'mesure') + 's' : f.mesure || 'mesure'} dans l’une d’elles.`
  const tous = f.cible.tous
  return `Le but : ${f.vases.map((v, i) => (tous[i] == null ? null : `${tous[i]} dans ${v.dans || v.nom.toLowerCase()}`)).filter(Boolean).join(', ')}.`
}

export const cruches: Moule<FicheDeCruches, EtatDeCruches, CoupDeCruches> = {
  cle: 'cruches',
  nom: 'Les cruches',
  socle: 'chemin',
  unite: ['geste', 'gestes'],
  depart: f => ({ n: f.plein.slice() }),
  signature: e => e.n.join(','),
  coups(f, e) {
    const r: CoupDeCruches[] = []
    f.vases.forEach((v, i) => {
      if (f.fontaine && e.n[i]! < v.cap) r.push({ remplit: i })
      if (f.fontaine && e.n[i]! > 0) r.push({ vide: i })
      f.vases.forEach((w, j) => { if (i !== j && e.n[i]! > 0 && e.n[j]! < w.cap) r.push({ verse: [i, j] }) })
    })
    return r
  },
  jouer(f, e, coup) {
    // Le coup vient d'un téléphone : un nombre ou un texte à sa place faisait lever `in`, et la route avec.
    if (typeof coup !== 'object' || coup === null) return { refus: 'Touche une cruche, puis celle où verser.' }
    const n = e.n.slice()
    if ('remplit' in coup) {
      if (!f.fontaine || !rang(f, coup.remplit)) return { refus: 'Il n’y a pas de fontaine ici.' }
      if (n[coup.remplit] === f.vases[coup.remplit]!.cap) return { refus: 'Elle est déjà pleine.' }
      n[coup.remplit] = f.vases[coup.remplit]!.cap
    } else if ('vide' in coup) {
      if (!f.fontaine || !rang(f, coup.vide)) return { refus: 'On ne perd pas une goutte ici.' }
      if (!n[coup.vide]) return { refus: 'Elle est déjà vide.' }
      n[coup.vide] = 0
    } else if ('verse' in coup && Array.isArray(coup.verse) && rang(f, coup.verse[0]) && rang(f, coup.verse[1]) && coup.verse[0] !== coup.verse[1]) {
      const [i, j] = coup.verse
      const passe = Math.min(n[i]!, f.vases[j]!.cap - n[j]!)
      if (!n[i]) return { refus: 'Il n’y a rien à verser.' }
      if (!passe) return { refus: 'Celle-là est déjà pleine.' }
      n[i]! -= passe
      n[j]! += passe
    } else return { refus: 'Touche une cruche, puis celle où verser.' }
    return { etat: { n } }
  },
  fini: (f, e) => (atteint(f, e.n) ? { gagne: true } : null),
  // Deux cruches premières entre elles mesurent toute quantité : le tirage n'a plus qu'à choisir combien de gestes il veut.
  tirer(graine, niveau) {
    const hasard = alea(graine)
    const voulus = GESTES_DU_NIVEAU[niveau]
    const candidates: FicheDeCruches[] = []
    for (const [a, b] of PAIRES) {
      for (let cible = 1; cible < b; cible++) {
        if (cible === a) continue
        const f = tiree(a, b, cible, niveau)
        const r = plusCourt(cruches, f)
        if (r && r.coups >= voulus[0] && r.coups <= voulus[1]) candidates.push(f)
      }
    }
    return parmi(hasard, candidates)
  },
}

/** Des paires de cruches premières entre elles : toute quantité s'y mesure. */
const PAIRES: readonly (readonly [number, number])[] = [[3, 5], [4, 7], [3, 7], [5, 7], [4, 9], [5, 8], [7, 9], [5, 9], [7, 10], [8, 11], [7, 12], [9, 11], [5, 12]]
/** Combien de gestes demande une énigme tirée, niveau par niveau : un choix de produit, mesuré par le parcours. */
export const GESTES_DU_NIVEAU: Record<Niveau, readonly [number, number]> = { 1: [4, 6], 2: [6, 8], 3: [8, 10], 4: [10, 14], 5: [14, 30] }
const tiree = (a: number, b: number, cible: number, niveau: Niveau): FicheDeCruches => ({
  id: `cruches-${a}-${b}-${cible}`, moule: 'cruches', niveau, tiree: true,
  titre: `${b} et ${a} font ${cible}`,
  source: 'Tirée par le programme, sur le modèle de Bachet (1612)',
  recit: [`Une fontaine, une cruche de ${b} mesures, une autre de ${a}. Aucune marque sur leurs flancs.`, `Il m’en faut ${cible}, pas une goutte de plus.`],
  regle: 'Touche une cruche, puis celle où verser.',
  vases: [{ nom: 'La grande', cap: b }, { nom: 'La petite', cap: a }], plein: [0, 0], fontaine: true, cible: { un: cible },
})

export const CRUCHES: readonly FicheDeCruches[] = [
  {
    id: 'fontaine-5-3', moule: 'cruches', niveau: 2,
    titre: 'La fontaine et les deux cruches',
    source: 'Tradition, d’après les problèmes de mesure de Tartaglia (XVIe siècle)',
    recit: [
      'Une fontaine, une cruche de cinq mesures, une autre de trois. Aucune marque sur leurs flancs.',
      'Il m’en faut quatre, pas une goutte de plus.',
    ],
    regle: 'Touche une cruche, puis celle où verser.',
    vases: [{ nom: 'La grande', cap: 5 }, { nom: 'La petite', cap: 3 }], plein: [0, 0], fontaine: true, cible: { un: 4 },
  },
  // Dudeney donne onze transvasements : le parcours les retrouve (`puits-enigmes.test.ts`).
  {
    id: 'dudeney-365', moule: 'cruches', niveau: 5,
    titre: 'Le nouveau problème des mesures',
    source: 'H. E. Dudeney, Amusements in Mathematics, n° 365, 1917',
    recit: [
      'Un marchand a deux jarres de dix pintes, pleines de vin, et deux mesures vides : une de cinq, une de quatre.',
      'Il veut exactement trois pintes dans chacune des deux mesures.',
      'Ni fontaine, ni vin perdu : on ne fait que verser.',
    ],
    regle: 'Touche un récipient, puis celui où verser.',
    mesure: 'pinte',
    vases: [
      { nom: 'Jarre', cap: 10, dans: 'une jarre' }, { nom: 'Jarre', cap: 10, dans: 'l’autre' },
      { nom: 'Mesure', cap: 5, dans: 'la mesure de cinq' }, { nom: 'Mesure', cap: 4, dans: 'la mesure de quatre' },
    ],
    plein: [10, 10, 0, 0], fontaine: false, cible: { tous: [null, null, 3, 3] },
  },
]
