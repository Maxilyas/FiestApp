// Les fonds de carte : ce qu'on voit derrière sa carte quand quelqu'un touche
// son nom. Rien d'autre ne change — ni l'écran commun, ni les classements :
// c'est la carte qu'on ouvre qui change d'allure.
//
// Sept, qui se gagnent sur la durée : la Nuit étoilée à trente jours de
// quiz du jour, l'Aurore boréale au niveau 20, le Kintsugi à dix victoires au
// quiz du jour, le Grand théâtre à vingt-cinq soirées (L'Habitué · Or), le
// Cabinet de curiosités au troisième palier de maître des sentiers du savoir
// (`shared/sentiers.ts` — un palier de maître ne se perd jamais), et deux
// fonds peints, le 5 octobre 2026 : le Triomphe pour un champion du mois, le
// Cadran solaire pour L'Élite · Argent (`shared/jour.ts`, `hf:elite`). Un
// cosmétique : ils ne rapportent rien, et celui qu'on ne mérite plus — une
// soirée retirée de l'historique fait redescendre sous le niveau 20 — cesse
// de se voir sans que rien ne soit réécrit, comme un titre (`fondPorte`).
//
// Et six du trésor, le 14 octobre 2026, peints (`server/scripts/anime/decors.ts`) :
// introuvables en boutique, ils ne sortent que du coffre de la semaine
// (`shared/coffre.ts`), chacun à sa rareté — tirés une fois, ils restent à
// lui (`profile_coffres`), sans règle à relire.

import type { Rarete } from './badges'
import { titresDeChampion } from './jour'

export type CleDeFond =
  | 'nuit'
  | 'aurore'
  | 'kintsugi'
  | 'theatre'
  | 'cabinet'
  | 'triomphe'
  | 'cadran'
  | 'voie-lactee'
  | 'lanternes'
  | 'abysses'
  | 'bibliotheque'
  | 'dragon'
  | 'cite-celeste'

export interface Fond {
  key: CleDeFond
  nom: string
  /** Ce qu'il faut, en quelques mots : « 30 jours de quiz du jour ». */
  regle: string
  /** Un fond du trésor : sa rareté au coffre de la semaine. Il ne se gagne pas autrement. */
  tresor?: Rarete
}

export const FONDS: readonly Fond[] = [
  { key: 'nuit', nom: 'Nuit étoilée', regle: '30 jours de quiz du jour' },
  { key: 'aurore', nom: 'Aurore boréale', regle: 'le niveau 20' },
  { key: 'kintsugi', nom: 'Kintsugi', regle: '10 victoires au quiz du jour' },
  { key: 'theatre', nom: 'Grand théâtre', regle: '25 soirées (L’Habitué · Or)' },
  { key: 'cabinet', nom: 'Cabinet de curiosités', regle: '3 paliers de maître des sentiers' },
  { key: 'triomphe', nom: 'Le Triomphe', regle: 'Champion du mois au quiz du jour' },
  { key: 'cadran', nom: 'Le Cadran solaire', regle: '50 jours dans le premier quart du quiz du jour (L’Élite · Argent)' },
  { key: 'voie-lactee', nom: 'La Voie lactée', regle: 'un coffre de la semaine', tresor: 'rare' },
  { key: 'lanternes', nom: 'Le Jardin des lanternes', regle: 'un coffre de la semaine', tresor: 'rare' },
  { key: 'abysses', nom: 'Les Abysses', regle: 'un coffre de la semaine', tresor: 'epique' },
  { key: 'bibliotheque', nom: 'La Bibliothèque enchantée', regle: 'un coffre de la semaine', tresor: 'epique' },
  { key: 'dragon', nom: 'Le Dragon d’or', regle: 'un coffre de la semaine', tresor: 'legendaire' },
  { key: 'cite-celeste', nom: 'La Cité céleste', regle: 'un coffre de la semaine', tresor: 'legendaire' },
]

/** Les fonds du trésor : ceux qui ne sortent que du coffre de la semaine. */
export const FONDS_DU_TRESOR: readonly Fond[] = FONDS.filter(f => f.tresor)

/** Les paliers de maître qu'il faut pour le Cabinet de curiosités. */
export const MAITRES_DU_CABINET = 3

/** Ce qu'il faut savoir d'un profil pour ses fonds. */
export interface CeQuOuvreUnFond {
  niveau: number
  jour: { joues: number; victoires: number }
  /** Ses récompenses rangées : le Grand théâtre suit L'Habitué · Or, le Triomphe un titre de champion du mois, le Cadran solaire L'Élite · Argent. */
  recompenses: ReadonlyMap<string, number>
  /** Les sentiers dont il est maître (`maitresDe`) : le Cabinet de curiosités. Aucun s'il n'est pas dit. */
  maitres?: number
  /** Ce que ses coffres lui ont donné (`fond:dragon`, `ProfileStore.tresorsOf`) : les fonds du trésor. Aucun s'il n'est pas dit. */
  tresors?: ReadonlySet<string>
}

/** Un fond du trésor est à lui quand un de ses coffres le lui a donné. */
const duTresor = (cle: CleDeFond) => (c: CeQuOuvreUnFond) => c.tresors?.has(`fond:${cle}`) ?? false

const REGLES: Record<CleDeFond, (c: CeQuOuvreUnFond) => boolean> = {
  nuit: c => c.jour.joues >= 30,
  aurore: c => c.niveau >= 20,
  kintsugi: c => c.jour.victoires >= 10,
  theatre: c => (c.recompenses.get('hf:habitue:3') ?? 0) > 0,
  cabinet: c => (c.maitres ?? 0) >= MAITRES_DU_CABINET,
  triomphe: c => titresDeChampion(c.recompenses).length > 0,
  cadran: c => (c.recompenses.get('hf:elite:2') ?? 0) > 0,
  'voie-lactee': duTresor('voie-lactee'),
  lanternes: duTresor('lanternes'),
  abysses: duTresor('abysses'),
  bibliotheque: duTresor('bibliotheque'),
  dragon: duTresor('dragon'),
  'cite-celeste': duTresor('cite-celeste'),
}

export function fond(key: unknown): Fond | undefined {
  return FONDS.find(f => f.key === key)
}

/** Les fonds qu'il peut porter, dans l'ordre du catalogue. */
export function fondsOuverts(c: CeQuOuvreUnFond): CleDeFond[] {
  return FONDS.filter(f => REGLES[f.key](c)).map(f => f.key)
}
