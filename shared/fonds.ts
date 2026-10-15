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
//
// Et douze des savoirs, le 15 octobre 2026, peints aussi : un par catégorie
// de questions, les seuls qui s'achètent (`PRIX_D_UN_FOND`) — la boutique
// n'avait rien pour la carte, et les missions du jour font entrer bien plus
// de confettis qu'avant. Achetés, ils restent à lui (`profile_fonds`) ; ni
// une piste ni le coffre ne les donnent, et le trésor ne se vend pas.

import type { Rarete } from './badges'
import type { Categorie } from './categories'
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
  | 'musee'
  | 'egypte'
  | 'navigateurs'
  | 'foudre'
  | 'savane'
  | 'salle-obscure'
  | 'jazz'
  | 'vitrail'
  | 'terre-battue'
  | 'epices'
  | 'table-de-jeux'
  | 'annees-folles'

export interface Fond {
  key: CleDeFond
  nom: string
  /** Ce qu'il faut, en quelques mots : « 30 jours de quiz du jour ». */
  regle: string
  /** Un fond du trésor : sa rareté au coffre de la semaine. Il ne se gagne pas autrement. */
  tresor?: Rarete
  /** Un fond des savoirs : la catégorie qu'il habille. Il s'achète en boutique (`PRIX_D_UN_FOND`), et rien d'autre ne le donne. */
  savoir?: Categorie
}

/**
 * Le prix d'un fond des savoirs, le même pour les douze : on choisit celui
 * de sa catégorie, pas une rareté. Celui d'un thème peu commun — un fond ne
 * se voit qu'à qui ouvre sa carte, un thème habille tout le téléphone.
 */
export const PRIX_D_UN_FOND = 250

/** Ce que demande un fond des savoirs, dans une phrase : « Ce fond se gagne d'abord : 250 confettis en boutique ». */
const EN_BOUTIQUE = `${PRIX_D_UN_FOND} confettis en boutique`

export const FONDS: readonly Fond[] = [
  { key: 'nuit', nom: 'Nuit étoilée', regle: '30 jours de quiz du jour' },
  { key: 'aurore', nom: 'Aurore boréale', regle: 'le niveau 20' },
  { key: 'kintsugi', nom: 'Kintsugi', regle: '10 victoires au quiz du jour' },
  { key: 'theatre', nom: 'Grand théâtre', regle: '25 soirées (L’Habitué · Or)' },
  { key: 'cabinet', nom: 'Cabinet de curiosités', regle: '3 paliers de maître des sentiers' },
  { key: 'triomphe', nom: 'Le Triomphe', regle: 'Champion du mois au quiz du jour' },
  { key: 'cadran', nom: 'Le Cadran solaire', regle: '50 jours dans le premier quart du quiz du jour (L’Élite · Argent)' },
  // Les douze des savoirs, dans l'ordre des catégories.
  { key: 'musee', nom: 'Le Musée de nuit', regle: EN_BOUTIQUE, savoir: 'Culture générale' },
  { key: 'egypte', nom: 'Le Temple d’Égypte', regle: EN_BOUTIQUE, savoir: 'Histoire' },
  { key: 'navigateurs', nom: 'La Carte des navigateurs', regle: EN_BOUTIQUE, savoir: 'Géographie' },
  { key: 'foudre', nom: 'Le Laboratoire de la foudre', regle: EN_BOUTIQUE, savoir: 'Sciences' },
  { key: 'savane', nom: 'La Savane au crépuscule', regle: EN_BOUTIQUE, savoir: 'Nature' },
  { key: 'salle-obscure', nom: 'La Salle obscure', regle: EN_BOUTIQUE, savoir: 'Cinéma & séries' },
  { key: 'jazz', nom: 'Le Club de jazz', regle: EN_BOUTIQUE, savoir: 'Musique' },
  { key: 'vitrail', nom: 'Le Vitrail', regle: EN_BOUTIQUE, savoir: 'Arts & lettres' },
  { key: 'terre-battue', nom: 'La Terre battue', regle: EN_BOUTIQUE, savoir: 'Sport' },
  { key: 'epices', nom: 'Le Marché aux épices', regle: EN_BOUTIQUE, savoir: 'Cuisine' },
  { key: 'table-de-jeux', nom: 'La Table de jeux', regle: EN_BOUTIQUE, savoir: 'Jeux & pop culture' },
  { key: 'annees-folles', nom: 'Les Années folles', regle: EN_BOUTIQUE, savoir: 'Autour de la fête' },
  { key: 'voie-lactee', nom: 'La Voie lactée', regle: 'un coffre de la semaine', tresor: 'rare' },
  { key: 'lanternes', nom: 'Le Jardin des lanternes', regle: 'un coffre de la semaine', tresor: 'rare' },
  { key: 'abysses', nom: 'Les Abysses', regle: 'un coffre de la semaine', tresor: 'epique' },
  { key: 'bibliotheque', nom: 'La Bibliothèque enchantée', regle: 'un coffre de la semaine', tresor: 'epique' },
  { key: 'dragon', nom: 'Le Dragon d’or', regle: 'un coffre de la semaine', tresor: 'legendaire' },
  { key: 'cite-celeste', nom: 'La Cité céleste', regle: 'un coffre de la semaine', tresor: 'legendaire' },
]

/** Les fonds du trésor : ceux qui ne sortent que du coffre de la semaine. */
export const FONDS_DU_TRESOR: readonly Fond[] = FONDS.filter(f => f.tresor)

/** Les fonds des savoirs : ceux que la boutique vend, un par catégorie. */
export const FONDS_EN_BOUTIQUE: readonly Fond[] = FONDS.filter(f => f.savoir)

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
  /** Les fonds des savoirs qu'il a achetés (`ProfileStore.fondsAchetesOf`). Aucun s'il n'est pas dit. */
  achetes?: ReadonlySet<string>
}

/** Un fond du trésor est à lui quand un de ses coffres le lui a donné. */
const duTresor = (cle: CleDeFond) => (c: CeQuOuvreUnFond) => c.tresors?.has(`fond:${cle}`) ?? false

/** Un fond des savoirs est à lui quand il l'a acheté. */
const achete = (cle: CleDeFond) => (c: CeQuOuvreUnFond) => c.achetes?.has(cle) ?? false

const REGLES: Record<CleDeFond, (c: CeQuOuvreUnFond) => boolean> = {
  nuit: c => c.jour.joues >= 30,
  aurore: c => c.niveau >= 20,
  kintsugi: c => c.jour.victoires >= 10,
  theatre: c => (c.recompenses.get('hf:habitue:3') ?? 0) > 0,
  cabinet: c => (c.maitres ?? 0) >= MAITRES_DU_CABINET,
  triomphe: c => titresDeChampion(c.recompenses).length > 0,
  cadran: c => (c.recompenses.get('hf:elite:2') ?? 0) > 0,
  musee: achete('musee'),
  egypte: achete('egypte'),
  navigateurs: achete('navigateurs'),
  foudre: achete('foudre'),
  savane: achete('savane'),
  'salle-obscure': achete('salle-obscure'),
  jazz: achete('jazz'),
  vitrail: achete('vitrail'),
  'terre-battue': achete('terre-battue'),
  epices: achete('epices'),
  'table-de-jeux': achete('table-de-jeux'),
  'annees-folles': achete('annees-folles'),
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
