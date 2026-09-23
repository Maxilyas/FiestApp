// Les catégories de questions.
//
// Une liste fixe, la même pour tous les animateurs : c'est ce qui permet à la
// carrière d'un joueur de les additionner d'une soirée à l'autre et d'un hôte
// à l'autre — « Cinéma » chez Romane et « cinéma » chez Marc sont la même
// case. L'éditeur la propose sur chaque carte, l'import en liste la lit sur
// une ligne `# Cinéma`, l'écran commun l'affiche au-dessus de la question, et
// le journal la garde : la fiche d'un joueur dit sa réussite par catégorie.
//
// Une question sans catégorie reste une question comme avant : rien n'oblige
// à classer, et les quiz d'avant n'en ont pas.

export const CATEGORIES = [
  'Culture générale',
  'Histoire',
  'Géographie',
  'Sciences',
  'Nature',
  'Cinéma & séries',
  'Musique',
  'Arts & lettres',
  'Sport',
  'Cuisine',
  'Jeux & pop culture',
  'Autour de la fête',
] as const

export type Categorie = (typeof CATEGORIES)[number]

/** Sans accents ni casse ni ponctuation : « cinéma », « CINEMA » et « Cinéma & séries » se retrouvent. */
const cle = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const PAR_CLE = new Map<string, Categorie>(CATEGORIES.map(c => [cle(c), c]))

/**
 * La catégorie que désigne ce texte, ou null. On accepte le début d'un nom —
 * « # Cinéma » pour « Cinéma & séries », « # Jeux » pour « Jeux & pop
 * culture » : à l'import, personne ne recopie la liste au caractère près.
 */
export function categorieDe(texte: unknown): Categorie | null {
  if (typeof texte !== 'string') return null
  const k = cle(texte)
  if (!k) return null
  const exacte = PAR_CLE.get(k)
  if (exacte) return exacte
  for (const [c, nom] of PAR_CLE) if (c.startsWith(k) || c.split(' ')[0] === k.split(' ')[0]) return nom
  return null
}
