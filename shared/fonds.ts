// Les fonds de carte : ce qu'on voit derrière sa carte quand quelqu'un touche
// son nom. Rien d'autre ne change — ni l'écran commun, ni les classements :
// c'est la carte qu'on ouvre qui change d'allure.
//
// Quatre, qui se gagnent sur la durée : la Nuit étoilée à trente jours de
// quiz du jour, l'Aurore boréale au niveau 20, le Kintsugi à dix victoires au
// quiz du jour, le Grand théâtre à vingt-cinq soirées (L'Habitué · Or). Un
// cosmétique : ils ne rapportent rien, et celui qu'on ne mérite plus — une
// soirée retirée de l'historique fait redescendre sous le niveau 20 — cesse
// de se voir sans que rien ne soit réécrit, comme un titre (`fondPorte`).

export type CleDeFond = 'nuit' | 'aurore' | 'kintsugi' | 'theatre'

export interface Fond {
  key: CleDeFond
  nom: string
  /** Ce qu'il faut, en quelques mots : « 30 jours de quiz du jour ». */
  regle: string
}

export const FONDS: readonly Fond[] = [
  { key: 'nuit', nom: 'Nuit étoilée', regle: '30 jours de quiz du jour' },
  { key: 'aurore', nom: 'Aurore boréale', regle: 'le niveau 20' },
  { key: 'kintsugi', nom: 'Kintsugi', regle: '10 victoires au quiz du jour' },
  { key: 'theatre', nom: 'Grand théâtre', regle: '25 soirées (L’Habitué · Or)' },
]

/** Ce qu'il faut savoir d'un profil pour ses fonds. */
export interface CeQuOuvreUnFond {
  niveau: number
  jour: { joues: number; victoires: number }
  /** Ses récompenses rangées : le Grand théâtre suit L'Habitué · Or. */
  recompenses: ReadonlyMap<string, number>
}

const REGLES: Record<CleDeFond, (c: CeQuOuvreUnFond) => boolean> = {
  nuit: c => c.jour.joues >= 30,
  aurore: c => c.niveau >= 20,
  kintsugi: c => c.jour.victoires >= 10,
  theatre: c => (c.recompenses.get('hf:habitue:3') ?? 0) > 0,
}

export function fond(key: unknown): Fond | undefined {
  return FONDS.find(f => f.key === key)
}

/** Les fonds qu'il peut porter, dans l'ordre du catalogue. */
export function fondsOuverts(c: CeQuOuvreUnFond): CleDeFond[] {
  return FONDS.filter(f => REGLES[f.key](c)).map(f => f.key)
}
