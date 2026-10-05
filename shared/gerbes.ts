// Les gerbes : ce qui éclate sur son téléphone à une bonne réponse — en
// soirée, au quiz du jour, en campagne, sur les sentiers, au défi de la
// semaine. Un emplacement de plus pour les petites récompenses (le 5
// octobre 2026) : chaque gerbe se gagne par un haut fait ou un palier du
// quiz du jour ou de la campagne, se choisit dans « Mon style », et ne se
// voit que sur son propre téléphone. Ni la salle ni l'écran commun n'en
// savent rien : aucun avantage de jeu, et rien pour l'anonyme (invariant 8).
//
// Ses particules sont des emojis, tous antérieurs à Unicode 13
// (`emojis.test.ts`) : un téléphone les dessine sans rien télécharger.

/** La clé d'une gerbe, gardée dans son profil (`profiles.gerbe`). */
export type CleDeGerbe = 'confettis' | 'etoiles' | 'etincelles' | 'ballons' | 'petales' | 'feuilles' | 'pixels' | 'colombes' | 'flammes' | 'trophees'

/**
 * Ce qui ouvre une gerbe : un profil, tout simplement ; un haut fait gagné
 * tant de fois ; un palier atteint — ou un plus haut, qui le vaut.
 */
export type CeQuiOuvreUneGerbe = { profil: true } | { hautFait: string; fois: number } | { palier: string; au: 1 | 2 | 3 }

export interface Gerbe {
  key: CleDeGerbe
  nom: string
  /** Ce qu'il faut pour l'avoir, à la suite de « Elle se gagne avec ». */
  regle: string
  par: CeQuiOuvreUneGerbe
  /** Ce qui vole : un ou plusieurs emojis, tirés au hasard pour chaque particule. */
  particules: readonly string[]
  /**
   * Leur mouvement : elles jaillissent d'en bas et retombent, tombent du
   * haut en se balançant, ou montent et s'envolent.
   */
  mouvement: 'jaillit' | 'tombe' | 'monte'
}

export const GERBES: readonly Gerbe[] = [
  { key: 'confettis', nom: 'Les confettis', regle: 'un profil', par: { profil: true }, particules: ['🎊', '🎉'], mouvement: 'jaillit' },
  {
    key: 'etoiles',
    nom: 'La pluie d’étoiles',
    regle: 'Le Sans-Faute, au quiz du jour',
    par: { palier: 'hf:sans-faute', au: 1 },
    particules: ['⭐', '🌟', '✨'],
    mouvement: 'tombe',
  },
  {
    key: 'etincelles',
    nom: 'Les étincelles',
    regle: 'l’Éclair du jour',
    par: { hautFait: 'hf:eclair-du-jour', fois: 1 },
    particules: ['⚡', '✨'],
    mouvement: 'jaillit',
  },
  { key: 'ballons', nom: 'Les ballons', regle: 'une victoire au quiz du jour', par: { hautFait: 'hf:laurier', fois: 1 }, particules: ['🎈'], mouvement: 'monte' },
  {
    key: 'petales',
    nom: 'Les pétales',
    regle: 'sept jours de série (L’Infatigable)',
    par: { palier: 'hf:infatigable', au: 1 },
    particules: ['🌸', '💮'],
    mouvement: 'tombe',
  },
  {
    key: 'feuilles',
    nom: 'Les feuilles d’automne',
    regle: 'dix bonnes réponses dans une série (L’Alpiniste)',
    par: { palier: 'hf:alpiniste', au: 1 },
    particules: ['🍂', '🍁'],
    mouvement: 'tombe',
  },
  {
    key: 'pixels',
    nom: 'Les pixels',
    regle: '250 bonnes réponses en campagne (Le Marathonien)',
    par: { palier: 'hf:marathonien', au: 1 },
    particules: ['👾', '🟨', '🟦', '🟥'],
    mouvement: 'jaillit',
  },
  { key: 'colombes', nom: 'Les colombes', regle: 'le Funambule, en campagne', par: { hautFait: 'hf:funambule', fois: 1 }, particules: ['🕊️'], mouvement: 'monte' },
  {
    key: 'flammes',
    nom: 'Les flammes',
    regle: 'trente jours de série (L’Infatigable · Argent)',
    par: { palier: 'hf:infatigable', au: 2 },
    particules: ['🔥'],
    mouvement: 'monte',
  },
  { key: 'trophees', nom: 'Les trophées', regle: 'le défi de la semaine, gagné', par: { hautFait: 'hf:defi', fois: 1 }, particules: ['🏆', '🥇'], mouvement: 'jaillit' },
]

const PAR_CLE = new Map(GERBES.map(g => [g.key, g]))

/** La gerbe d'une clé, si elle existe encore. */
export function gerbe(cle: unknown): Gerbe | undefined {
  return typeof cle === 'string' ? PAR_CLE.get(cle as CleDeGerbe) : undefined
}

/** Cette gerbe est-elle à lui, au vu de ses récompenses (clé rangée → nombre de fois) ? */
export function gerbeOuverte(g: Gerbe, recompenses: ReadonlyMap<string, number>): boolean {
  const par = g.par
  if ('profil' in par) return true
  if ('hautFait' in par) return (recompenses.get(par.hautFait) ?? 0) >= par.fois
  // Un palier plus haut vaut le sien : la soirée qui avait fait tomber le
  // bronze, retirée, laisse l'argent — et la gerbe avec.
  return ([1, 2, 3] as const).some(p => p >= par.au && (recompenses.get(`${par.palier}:${p}`) ?? 0) > 0)
}

/** Les gerbes qu'il peut porter, dans l'ordre du catalogue. */
export function gerbesOuvertes(recompenses: ReadonlyMap<string, number>): CleDeGerbe[] {
  return GERBES.filter(g => gerbeOuverte(g, recompenses)).map(g => g.key)
}
