// Les neuf salles du Cabinet et leurs gardiens. Les huit familles des
// rencontres de l'Expédition, huit œuvres chacune, et le Vestibule, les vingt
// neutres. Une salle complète réveille son premier gardien, une salle toute
// dorée le second ; cinq autres gardiens se réveillent ailleurs — le
// Scarabée à la série, le Trou noir au Cabinet entier, les trois de saison à
// leur seule fête (la décision du propriétaire, le 24 octobre 2026).
//
// Les vingt-trois gardiens sont exactement les légendaires à joker
// (`LEGENDAIRES_A_JOKER`, `shared/jokers.ts`) : un gardien réveillé, c'est le
// légendaire gagné, et sa carte-bonus, la plus forte de sa famille. Jamais un
// Divin, ni un légendaire sans joker (invariant 21). Un gardien porte le
// pouvoir de la salle qu'il garde, pas celui de la famille de sa carte dans
// les rencontres — le Sapin y est du Flambeur, et protège ici.

import { JOURS_DU_SCARABEE } from './bareme'
import { OEUVRES } from './oeuvres'
import type { CleDePouvoir } from './pouvoirs'
import type { CleDeSaison } from '../saisons'

export type CleDeSalle = 'erudit' | 'devin' | 'rempart' | 'elan' | 'metamorphe' | 'flambeur' | 'sophiste' | 'temeraire' | 'vestibule'
/** Les huit salles qui sont une famille ; le Vestibule n'en est pas une, chacune de ses œuvres a son pouvoir. */
export type CleDeFamille = Exclude<CleDeSalle, 'vestibule'>

export interface Salle {
  cle: CleDeSalle
  /** « L’Érudit », le nom de sa famille ; « Le Vestibule ». */
  nom: string
  /** « la salle de l’Érudit », « le Vestibule » : dans une phrase. */
  laSalle: string
  /** « de la salle du Devin », « du Vestibule » : « une œuvre rare de la salle du Devin ». */
  deLaSalle: string
  /** « dans la salle de l’Érudit » : « encore 2 œuvres dans la salle de l’Érudit ». */
  dansLaSalle: string
  /** « complète », « complet » : l'accord de la salle. */
  complete: string
  /** La devise de sa famille. */
  devise: string
}

/** Une salle de famille se dit « la salle du Devin » ; le Vestibule, masculin, se dit seul. */
const salleDe = (cle: CleDeSalle, nom: string, du: string, devise: string): Salle =>
  cle === 'vestibule'
    ? { cle, nom, laSalle: 'le Vestibule', deLaSalle: 'du Vestibule', dansLaSalle: 'dans le Vestibule', complete: 'complet', devise }
    : { cle, nom, laSalle: `la salle ${du}`, deLaSalle: `de la salle ${du}`, dansLaSalle: `dans la salle ${du}`, complete: 'complète', devise }

export const SALLES: readonly Salle[] = [
  salleDe('erudit', 'L’Érudit', 'de l’Érudit', 'Je connais mon rayon'),
  salleDe('devin', 'Le Devin', 'du Devin', 'Je lis les signes'),
  salleDe('rempart', 'Le Rempart', 'du Rempart', 'Je tiens bon'),
  salleDe('elan', 'L’Élan', 'de l’Élan', 'Je ne m’arrête plus'),
  salleDe('metamorphe', 'Le Métamorphe', 'du Métamorphe', 'Je change la question'),
  salleDe('flambeur', 'Le Flambeur', 'du Flambeur', 'Je parie sur moi'),
  salleDe('sophiste', 'Le Sophiste', 'du Sophiste', 'Je sème le doute'),
  salleDe('temeraire', 'Le Téméraire', 'du Téméraire', 'Je joue avec le feu'),
  salleDe('vestibule', 'Le Vestibule', '', 'Pour tout le monde'),
]

const SALLE_PAR_CLE = new Map<string, Salle>(SALLES.map(s => [s.cle, s]))

export function salle(cle: unknown): Salle | undefined {
  return typeof cle === 'string' ? SALLE_PAR_CLE.get(cle) : undefined
}

/** Le premier gardien de chaque salle, réveillé quand elle est complète ; le second, quand tous ses cadres sont dorés. */
export const GARDIENS_DES_SALLES: Readonly<Record<CleDeSalle, readonly [premier: string, second: string]>> = {
  erudit: ['lg:chouette', 'lg:lion'],
  devin: ['lg:sphinx', 'lg:oracle'],
  rempart: ['lg:phenix', 'lg:ouroboros'],
  elan: ['lg:tigre', 'lg:comete'],
  metamorphe: ['lg:janus', 'lg:serpent'],
  flambeur: ['lg:dragon', 'lg:renard'],
  sophiste: ['lg:fantome', 'lg:chauve-souris'],
  temeraire: ['lg:salamandre', 'lg:kraken'],
  vestibule: ['lg:coq', 'lg:chimere'],
}

/** Ce qui réveille un gardien qui ne garde pas de salle. */
export type ReveilDUnAutreGardien = { serie: true } | { tout: true } | { saison: CleDeSaison }

export interface AutreGardien {
  legendaire: string
  pouvoir: CleDePouvoir
  reveil: ReveilDUnAutreGardien
  /** Ce qui le réveille, en mots. */
  condition: string
}

/**
 * Les cinq autres. Ceux de saison, la première œuvre gagnée en jouant pendant
 * leur fête, aux dates de `shared/saisons.ts` — sans rattrapage hors de la
 * fête : une fête qui revient chaque année est une bonne raison de revenir.
 */
export const AUTRES_GARDIENS: readonly AutreGardien[] = [
  { legendaire: 'lg:scarabee', pouvoir: 'proteger', reveil: { serie: true }, condition: `${JOURS_DU_SCARABEE} jours de visite ou de chasse d’affilée` },
  { legendaire: 'lg:trou-noir', pouvoir: 'miser', reveil: { tout: true }, condition: `Le Cabinet entier : les ${OEUVRES.length} œuvres` },
  { legendaire: 'lg:citrouille', pouvoir: 'eclairer', reveil: { saison: 'halloween' }, condition: 'Une œuvre gagnée en jouant pendant Halloween' },
  { legendaire: 'lg:sapin', pouvoir: 'proteger', reveil: { saison: 'noel' }, condition: 'Une œuvre gagnée en jouant pendant Noël' },
  { legendaire: 'lg:bouquet', pouvoir: 'temps', reveil: { saison: 'nouvel-an' }, condition: 'Une œuvre gagnée en jouant pendant le Nouvel An' },
]

/** Les vingt-trois, salle par salle, puis les cinq autres. */
export const GARDIENS: readonly string[] = [...Object.values(GARDIENS_DES_SALLES).flat(), ...AUTRES_GARDIENS.map(a => a.legendaire)]
/** Les trois de saison : le Cabinet range leur condition principale (`saison:halloween`), ils n'ont pas de voie à eux. */
export const GARDIENS_DE_SAISON: readonly string[] = AUTRES_GARDIENS.filter(a => 'saison' in a.reveil).map(a => a.legendaire)
/** Les vingt autres, qui gagnent une voie du Cabinet (`cabinet:phenix`) : une voie de plus ne reprend rien à personne. */
export const GARDIENS_DU_CABINET: readonly string[] = GARDIENS.filter(g => !GARDIENS_DE_SAISON.includes(g))

/**
 * Le pouvoir de chaque gardien, à la force 3 : celui de la salle qu'il garde —
 * le Phénix protège comme le Rempart —, au Vestibule le Coq prend son temps et
 * la Chimère change. Une table écrite, que le test relit contre les familles :
 * la famille de la carte du légendaire dans les rencontres ne compte pas.
 */
export const POUVOIR_DES_GARDIENS: Readonly<Record<string, CleDePouvoir>> = {
  'lg:chouette': 'eclairer',
  'lg:lion': 'eclairer',
  'lg:sphinx': 'eclairer',
  'lg:oracle': 'eclairer',
  'lg:phenix': 'proteger',
  'lg:ouroboros': 'proteger',
  'lg:tigre': 'temps',
  'lg:comete': 'temps',
  'lg:janus': 'changer',
  'lg:serpent': 'changer',
  'lg:dragon': 'miser',
  'lg:renard': 'miser',
  'lg:fantome': 'changer',
  'lg:chauve-souris': 'changer',
  'lg:salamandre': 'miser',
  'lg:kraken': 'miser',
  'lg:coq': 'temps',
  'lg:chimere': 'changer',
  'lg:scarabee': 'proteger',
  'lg:trou-noir': 'miser',
  'lg:citrouille': 'eclairer',
  'lg:sapin': 'proteger',
  'lg:bouquet': 'temps',
}

const POUVOIR_PAR_GARDIEN = new Map<string, CleDePouvoir>(Object.entries(POUVOIR_DES_GARDIENS))

/**
 * Le pouvoir d'un gardien ; undefined pour tout le reste. Une clé venue du
 * téléphone se lit ici, jamais par `POUVOIR_DES_GARDIENS[cle]` : un objet
 * répond aussi de son prototype, et `constructor` y passait pour un gardien.
 */
export function pouvoirDuGardien(cle: unknown): CleDePouvoir | undefined {
  return typeof cle === 'string' ? POUVOIR_PAR_GARDIEN.get(cle) : undefined
}

/** La salle qu'un gardien garde ; undefined pour les cinq autres. */
export function salleDuGardien(legendaire: string): CleDeSalle | undefined {
  return SALLES.find(s => GARDIENS_DES_SALLES[s.cle].includes(legendaire))?.cle
}

/** Le préfixe de la voie du Cabinet, sur l'étagère : `cabinet:phenix`. */
export const PREFIXE_DE_LA_VOIE_DU_CABINET = 'cabinet:'

/**
 * Ce que le Cabinet range sur l'étagère quand un gardien se réveille : sa voie
 * (`cabinet:phenix`) pour les vingt, la condition principale de sa saison
 * (`saison:halloween`) pour les trois de saison ; null pour ce qui n'est pas
 * un gardien — un Divin, un légendaire sans joker.
 */
export function voieDuGardien(legendaire: string): string | null {
  if (GARDIENS_DU_CABINET.includes(legendaire)) return PREFIXE_DE_LA_VOIE_DU_CABINET + legendaire.replace(/^lg:/, '')
  const reveil = AUTRES_GARDIENS.find(a => a.legendaire === legendaire)?.reveil
  return reveil && 'saison' in reveil ? `saison:${reveil.saison}` : null
}

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Ce qui réveille un gardien, en mots : « La salle du Rempart complète » ; null pour ce qui n'en est pas un. */
export function conditionDuGardien(legendaire: string): string | null {
  const s = salle(salleDuGardien(legendaire))
  if (s) {
    const [premier] = GARDIENS_DES_SALLES[s.cle]
    return legendaire === premier ? `${majuscule(s.laSalle)} ${s.complete}` : `Tous les cadres ${s.deLaSalle} dorés`
  }
  return AUTRES_GARDIENS.find(a => a.legendaire === legendaire)?.condition ?? null
}
