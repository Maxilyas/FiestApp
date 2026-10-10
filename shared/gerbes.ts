// Les gerbes : ce qui éclate sur son téléphone à une bonne réponse — en
// soirée, au quiz du jour, en campagne, sur les sentiers, au défi de la
// semaine. Un emplacement de plus pour les petites récompenses (le 5
// octobre 2026) : chaque gerbe se gagne par un haut fait ou un palier du
// quiz du jour ou de la campagne, se choisit dans « Mon thème », et ne se
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

/**
 * L'allure d'une gerbe : combien de particules, de quelle taille, en combien
 * de temps. Les dix avaient les mêmes — dix-huit particules, la même taille,
 * la même durée —, et ne différaient que par leurs emojis : un ballon
 * filait aussi vite qu'une étincelle (le 10 octobre 2026, « les gerbes, à
 * améliorer »). Assez de particules pour une fête, jamais de quoi charger
 * un petit téléphone.
 */
export interface AllureDeGerbe {
  nombre: number
  /** La taille d'une particule, en multiple de la base : de… à… */
  taille: readonly [number, number]
  /** Le temps d'une particule, en secondes : de… à… */
  duree: readonly [number, number]
}

export const ALLURE_PAR_DEFAUT: AllureDeGerbe = { nombre: 18, taille: [0.8, 1.5], duree: [1.3, 2.1] }

export interface Gerbe {
  key: CleDeGerbe
  nom: string
  /** Ce qu'il faut pour l'avoir, à la suite de « Elle se gagne avec ». */
  regle: string
  par: CeQuiOuvreUneGerbe
  /** Ce qui vole : un ou plusieurs emojis, répartis entre les particules. */
  particules: readonly string[]
  /**
   * Leur mouvement : elles jaillissent d'en bas et retombent, tombent du
   * haut en se balançant, ou montent et s'envolent.
   */
  mouvement: 'jaillit' | 'tombe' | 'monte'
  /** Son allure à elle ; sans elle, celle de tous (`ALLURE_PAR_DEFAUT`). */
  allure?: AllureDeGerbe
}

export const GERBES: readonly Gerbe[] = [
  {
    key: 'confettis',
    nom: 'Les confettis',
    regle: 'un profil',
    par: { profil: true },
    particules: ['🎊', '🎉'],
    mouvement: 'jaillit',
    allure: { nombre: 22, taille: [0.8, 1.5], duree: [1.3, 2.1] },
  },
  {
    key: 'etoiles',
    nom: 'La pluie d’étoiles',
    regle: 'Le Sans-Faute, au quiz du jour',
    par: { palier: 'hf:sans-faute', au: 1 },
    particules: ['⭐', '🌟', '✨'],
    mouvement: 'tombe',
    allure: { nombre: 20, taille: [0.6, 1.3], duree: [2, 2.9] },
  },
  {
    key: 'etincelles',
    nom: 'Les étincelles',
    regle: 'l’Éclair du jour',
    par: { hautFait: 'hf:eclair-du-jour', fois: 1 },
    particules: ['⚡', '✨'],
    mouvement: 'jaillit',
    allure: { nombre: 26, taille: [0.55, 1.05], duree: [0.9, 1.4] },
  },
  {
    key: 'ballons',
    nom: 'Les ballons',
    regle: 'une victoire au quiz du jour',
    par: { hautFait: 'hf:laurier', fois: 1 },
    particules: ['🎈'],
    mouvement: 'monte',
    allure: { nombre: 9, taille: [1.5, 2.2], duree: [2.6, 3.4] },
  },
  {
    key: 'petales',
    nom: 'Les pétales',
    regle: 'sept jours de série (L’Infatigable)',
    par: { palier: 'hf:infatigable', au: 1 },
    particules: ['🌸', '💮'],
    mouvement: 'tombe',
    allure: { nombre: 18, taille: [0.8, 1.3], duree: [2.4, 3.2] },
  },
  {
    key: 'feuilles',
    nom: 'Les feuilles d’automne',
    regle: 'dix bonnes réponses dans une série (L’Alpiniste)',
    par: { palier: 'hf:alpiniste', au: 1 },
    particules: ['🍂', '🍁'],
    mouvement: 'tombe',
    allure: { nombre: 16, taille: [0.9, 1.5], duree: [2.2, 3] },
  },
  {
    key: 'pixels',
    nom: 'Les pixels',
    regle: '250 bonnes réponses en campagne (Le Marathonien)',
    par: { palier: 'hf:marathonien', au: 1 },
    particules: ['👾', '🟨', '🟦', '🟥'],
    mouvement: 'jaillit',
    allure: { nombre: 28, taille: [0.55, 1], duree: [1.1, 1.6] },
  },
  {
    key: 'colombes',
    nom: 'Les colombes',
    regle: 'le Funambule, en campagne',
    par: { hautFait: 'hf:funambule', fois: 1 },
    particules: ['🕊️'],
    mouvement: 'monte',
    allure: { nombre: 7, taille: [1.5, 2.1], duree: [2.4, 3.2] },
  },
  {
    key: 'flammes',
    nom: 'Les flammes',
    regle: 'trente jours de série (L’Infatigable · Argent)',
    par: { palier: 'hf:infatigable', au: 2 },
    particules: ['🔥'],
    mouvement: 'monte',
    allure: { nombre: 16, taille: [1, 1.6], duree: [1.4, 2] },
  },
  {
    key: 'trophees',
    nom: 'Les trophées',
    regle: 'le défi de la semaine, gagné',
    par: { hautFait: 'hf:defi', fois: 1 },
    particules: ['🏆', '🥇'],
    mouvement: 'jaillit',
    allure: { nombre: 12, taille: [1.2, 1.8], duree: [1.5, 2.2] },
  },
]

/**
 * La gerbe de tout profil qui n'en a pas choisi : les confettis, ouverts à
 * tous. Rien n'éclatait tant qu'on n'était pas allé en choisir une dans
 * « Mon thème » — presque personne ne l'avait jamais vue (le choix du
 * 10 octobre 2026). Qui n'en veut pas le dit (`AUCUNE_GERBE`).
 */
export const GERBE_PAR_DEFAUT: CleDeGerbe = 'confettis'

/** Ce que range le profil qui ne veut aucune gerbe : sans gerbe choisie, c'est celle de tous. */
export const AUCUNE_GERBE = 'aucune'

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
