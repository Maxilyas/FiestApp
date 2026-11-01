// Les saisons — les fêtes de l'année : chacune un légendaire qui ne se gagne
// qu'à sa période. Halloween, Noël, le Nouvel An d'abord ; depuis le
// 1er novembre 2026, la Saint-Valentin, Pâques, la Fête de la musique, l'été
// et la rentrée — une fête tous les deux mois, plutôt que trois tassées
// d'octobre à janvier (le choix du propriétaire, sur la maquette des fêtes).
// Des jours joués au quiz du jour pendant la période, ou une soirée ces
// jours-là (une soirée qui compte, à deux au moins) : l'une des deux suffit.
// Depuis le 18 octobre 2026, pour les trois premières, une troisième : le
// garder au bout d'une expédition partie ces jours-là, qui le met en gardien
// de l'acte 3 (`calendrierDesExpeditions`, `shared/expedition.ts`) — et une
// œuvre gagnée au Cabinet de curiosités pendant la fête (`AUTRES_GARDIENS`).
// Les cinq venues ensuite n'ont ni joker ni gardien : elles se fêtent au quiz
// du jour et en soirée.
//
// Une saison gagnée se range comme une récompense (`saison:halloween`) :
// sous le jour qui l'a ouverte pour le quiz du jour, sous la soirée qui l'a
// ouverte sinon — et une soirée retirée de l'historique l'emporte avec elle,
// comme tout ce qu'elle avait fait tomber. Les dates sont celles de Paris :
// celles du quiz du jour (`jourDe`), et de la première question jouée d'une
// soirée (`soireeDesInvites`). Chaque année fêtée laisse aussi son timbre
// (`shared/timbres.ts`).

export type CleDeSaison = 'halloween' | 'noel' | 'nouvel-an' | 'saint-valentin' | 'paques' | 'musique' | 'ete' | 'rentree'

interface SaisonCommune {
  key: CleDeSaison
  /** Son nom dans une phrase : « Halloween », « le Nouvel An », « la Saint-Valentin ». */
  nom: string
  /** Son nom en titre, sans article : « Nouvel An », « Saint-Valentin » — un timbre, une case. */
  court: string
  /** Le légendaire qu'elle ouvre. */
  legendaire: string
  /** Les jours de quiz du jour qu'il faut dans la période. */
  jours: number
  /** La période en toutes lettres : « du 25 octobre au 1er novembre ». */
  periode: string
  /** L'emoji de sa ligne de récompense, que rien n'affiche : une étagère se relit des années plus tard. */
  emoji: string
  /**
   * Sa première année — le millésime de sa première période (`millesimeDe`) :
   * une fête ajoutée ne compte qu'à partir de là. Sans elle, le recalcul de
   * l'historique (`VERSION_BAREME`) aurait ouvert son légendaire aux soirées
   * jouées ces jours-là avant qu'elle existe, d'un coup et sans que personne
   * sache pourquoi. Absente : depuis toujours.
   */
  depuis?: number
}

/**
 * Une saison, à dates fixes — premier et dernier jour, mois et jour, bornes
 * comprises ; le Nouvel An enjambe l'année — ou autour du dimanche de Pâques,
 * qui suit la lune : tant de jours avant, tant après.
 */
export type Saison = SaisonCommune & ({ debut: [number, number]; fin: [number, number] } | { autourDePaques: [avant: number, apres: number] })

export const SAISONS: readonly Saison[] = [
  { key: 'halloween', nom: 'Halloween', court: 'Halloween', legendaire: 'lg:citrouille', debut: [10, 25], fin: [11, 1], jours: 3, periode: 'du 25 octobre au 1er novembre', emoji: '🎃' },
  { key: 'noel', nom: 'Noël', court: 'Noël', legendaire: 'lg:sapin', debut: [12, 20], fin: [12, 26], jours: 3, periode: 'du 20 au 26 décembre', emoji: '🎄' },
  // Quatre jours seulement, qui enjambent l'année : deux suffisent.
  { key: 'nouvel-an', nom: 'le Nouvel An', court: 'Nouvel An', legendaire: 'lg:bouquet', debut: [12, 30], fin: [1, 2], jours: 2, periode: 'du 30 décembre au 2 janvier', emoji: '🎆' },
  // Les cinq du 1er novembre 2026, à partir de 2027 : aucune n'a encore eu
  // lieu depuis qu'elles existent. Les courtes demandent deux jours, l'été —
  // un mois de vacances — cinq, la rentrée — sa semaine — trois.
  {
    key: 'saint-valentin',
    nom: 'la Saint-Valentin',
    court: 'Saint-Valentin',
    legendaire: 'lg:rose',
    debut: [2, 12],
    fin: [2, 15],
    jours: 2,
    periode: 'du 12 au 15 février',
    emoji: '💘',
    depuis: 2027,
  },
  // Du vendredi saint au lundi de Pâques : entre le 20 mars et le 26 avril selon l'année.
  { key: 'paques', nom: 'Pâques', court: 'Pâques', legendaire: 'lg:oeuf', autourDePaques: [2, 1], jours: 2, periode: 'du vendredi saint au lundi de Pâques', emoji: '🐣', depuis: 2027 },
  {
    key: 'musique',
    nom: 'la Fête de la musique',
    court: 'Fête de la musique',
    legendaire: 'lg:gramophone',
    debut: [6, 19],
    fin: [6, 22],
    jours: 2,
    periode: 'du 19 au 22 juin',
    emoji: '🎸',
    depuis: 2027,
  },
  { key: 'ete', nom: 'l’été', court: 'L’été', legendaire: 'lg:coquillage', debut: [7, 14], fin: [8, 15], jours: 5, periode: 'du 14 juillet au 15 août', emoji: '🌞', depuis: 2027 },
  { key: 'rentree', nom: 'la rentrée', court: 'La rentrée', legendaire: 'lg:cartable', debut: [9, 1], fin: [9, 7], jours: 3, periode: 'du 1er au 7 septembre', emoji: '🎒', depuis: 2027 },
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
 * Un jour (« 2027-03-28 ») plus tant de jours. Compté en UTC : un jour n'est
 * qu'une date, et une heure d'été ne la décale pas.
 */
function plusJours(jour: string, n: number): string {
  const [a, m, j] = jour.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10)
}

/**
 * Le dimanche de Pâques d'une année du calendrier grégorien (« 2027-03-28 ») :
 * l'algorithme de Meeus, Jones et Butcher — le premier dimanche après la
 * pleine lune qui suit l'équinoxe de printemps, tel que l'Église le compte.
 */
export function paquesDe(annee: number): string {
  const a = annee % 19
  const b = Math.floor(annee / 100)
  const c = annee % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31)
  const jour = ((h + l - 7 * m + 114) % 31) + 1
  return date(annee, [mois, jour])
}

/** Les bornes de sa période qui commence l'année `annee`, bornes comprises : « 2026-12-30 » → « 2027-01-02 ». */
export function bornesDe(s: Saison, annee: number): { debut: string; fin: string } {
  if ('autourDePaques' in s) {
    const paques = paquesDe(annee)
    return { debut: plusJours(paques, -s.autourDePaques[0]), fin: plusJours(paques, s.autourDePaques[1]) }
  }
  const enjambe = s.fin[0] < s.debut[0]
  return { debut: date(annee, s.debut), fin: date(enjambe ? annee + 1 : annee, s.fin) }
}

/**
 * Le millésime d'une période : l'année de son dernier jour. Le Nouvel An du
 * 30 décembre 2026 au 2 janvier 2027 est celui de 2027 — son timbre aussi.
 */
export const millesimeDe = (fin: string) => Number(fin.slice(0, 4))

/** La période d'une saison dont c'est le millésime : celle du Nouvel An 2027 commence en 2026. */
export function periodeDuMillesime(s: Saison, millesime: number): { debut: string; fin: string } {
  const b = bornesDe(s, millesime)
  return millesimeDe(b.fin) === millesime ? b : bornesDe(s, millesime - 1)
}

/** Fêtée cette année-là : elle existait déjà (`depuis`). */
export const fetee = (s: Saison, millesime: number) => millesime >= (s.depuis ?? -Infinity)

/**
 * La période qui contient ce jour (« 2026-10-31 »), et ses bornes — son
 * millésime se lit de sa fin (`millesimeDe`) —, ou null hors saison, et hors
 * de toute année où elle n'existait pas encore (`depuis`). Le Nouvel An du
 * 1er janvier 2027 commence le 30 décembre 2026.
 */
export function periodeDu(jour: string): { saison: Saison; debut: string; fin: string } | null {
  const annee = Number(jour.slice(0, 4))
  if (!Number.isInteger(annee)) return null
  for (const s of SAISONS) {
    // Une période qui a commencé l'an dernier peut finir cette année : le Nouvel An.
    for (const depart of [annee - 1, annee]) {
      const { debut, fin } = bornesDe(s, depart)
      if (jour >= debut && jour <= fin && fetee(s, millesimeDe(fin))) return { saison: s, debut, fin }
    }
  }
  return null
}
