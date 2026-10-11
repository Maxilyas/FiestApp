import type { Categorie } from './categories'
import type { MetadonneesDeQuestion } from './etiquettes'

// Les sujets de la campagne : une série sur un fil qui traverse les douze
// catégories — une époque, la France, les pionnières —, tirée des
// métadonnées que chaque question de la base porte depuis son écriture (sa
// date, ses étiquettes, sa portée) : pas une question de plus à écrire. Un
// retour de joueur du 10 octobre 2026 voulait jouer « au-delà des douze
// catégories ». Chacun a au moins cent questions dans la base, de quoi
// monter les quatre marches ; une époque et un fil rouge, des questions de
// sept catégories ou plus.
//
// Puis les thèmes (le souhait du propriétaire du 11 octobre 2026 : « prévoir
// pour l'avenir de rajouter des thèmes ») : un sujet nommé — les animaux,
// les inventions —, lu sur les sous-thèmes de ses catégories et, au-delà,
// sur une étiquette que toutes les catégories portent (un animal au cinéma,
// une invention en cuisine). Un thème peut tenir presque tout entier dans
// une catégorie : il a son nom, pas l'obligation de les traverser. En
// ajouter un tient en une ligne de `SUJETS` et une icône
// (`client/src/iconeDuSujet.ts`) ; `campagne-sujets.test.ts` dit s'il a de
// quoi faire une série, et `generer-campagne.ts preparer --theme=<clé>`
// écrit ce qui lui manque.

export type FamilleDeSujet = 'epoque' | 'fil' | 'theme'

/** Les familles de sujets, dans l'ordre où l'écran les range, chacune sa rangée. */
export const FAMILLES_DE_SUJETS: readonly { famille: FamilleDeSujet; nom: string }[] = [
  { famille: 'theme', nom: 'Un thème' },
  { famille: 'epoque', nom: 'Une époque' },
  { famille: 'fil', nom: 'Un fil rouge' },
]

export interface Sujet {
  cle: string
  nom: string
  /** Une époque, un fil rouge ou un thème : l'écran les range chacun dans sa rangée (`FAMILLES_DE_SUJETS`). */
  famille: FamilleDeSujet
  /** Ce qu'on y croise, en quelques mots. */
  description: string
  /** Ses questions : datées entre ces deux années, bornes comprises… */
  annees?: readonly [number, number]
  /** … ou qui portent l'une de ces étiquettes… */
  etiquettes?: readonly string[]
  /** … ou de cette portée… */
  portee?: MetadonneesDeQuestion['portee']
  /** … ou de l'un de ces sous-thèmes de leur catégorie (`SOUS_THEMES`) : un même mot — « france » — n'est pas le même sous-thème d'une catégorie à l'autre. */
  sousThemes?: Readonly<Partial<Record<Categorie, readonly string[]>>>
}

export const SUJETS: readonly Sujet[] = [
  {
    cle: 'animaux',
    nom: 'Les animaux',
    famille: 'theme',
    description: 'Des mammifères aux dinosaures, et ceux du cinéma',
    sousThemes: { Nature: ['mammiferes', 'oiseaux', 'aquatique', 'petites-betes', 'disparus'] },
    etiquettes: ['animaux'],
  },
  {
    cle: 'inventions',
    nom: 'Les inventions',
    famille: 'theme',
    description: 'Qui a inventé quoi, et les savants qui ont tout changé',
    sousThemes: { Sciences: ['savants', 'techno'] },
    etiquettes: ['invention'],
  },
  {
    cle: 'mythes-legendes',
    nom: 'Mythes et légendes',
    famille: 'theme',
    description: 'Dieux, héros, contes et créatures fabuleuses',
    sousThemes: { 'Culture générale': ['mythes'] },
    etiquettes: ['contes-legendes'],
  },
  {
    cle: 'terre-espace',
    nom: 'La Terre et l’espace',
    famille: 'theme',
    description: 'Planètes, volcans, fleuves et montagnes',
    sousThemes: { Sciences: ['espace', 'terre'], Géographie: ['eaux', 'reliefs'] },
  },
  {
    cle: 'grands-rendez-vous',
    nom: 'Les grands rendez-vous du sport',
    famille: 'theme',
    description: 'Jeux olympiques, Coupe du monde, Tour de France',
    sousThemes: { Sport: ['olympisme'] },
    etiquettes: ['jeux-olympiques', 'coupe-du-monde', 'tour-de-france'],
  },
  // Les séries vivent au cinéma, la télévision dans les jeux et la pop
  // culture : deux catégories pour un seul écran, celui du salon.
  {
    cle: 'petit-ecran',
    nom: 'Le petit écran',
    famille: 'theme',
    description: 'Séries cultes, jeux télévisés et émissions de toujours',
    sousThemes: { 'Cinéma & séries': ['series'], 'Jeux & pop culture': ['tele'] },
  },
  { cle: 'avant-1800', nom: 'Avant 1800', famille: 'epoque', description: 'Des pharaons aux Lumières', annees: [-100000, 1799] },
  { cle: 'xixe', nom: 'Le XIXe siècle', famille: 'epoque', description: 'De Napoléon à la tour Eiffel', annees: [1800, 1899] },
  { cle: '1900-1949', nom: '1900 à 1949', famille: 'epoque', description: 'La Belle Époque et les deux guerres', annees: [1900, 1949] },
  { cle: 'annees-50', nom: 'Les années 50', famille: 'epoque', description: 'De 1950 à 1959, dans toutes les catégories', annees: [1950, 1959] },
  { cle: 'annees-60', nom: 'Les années 60', famille: 'epoque', description: 'De 1960 à 1969, dans toutes les catégories', annees: [1960, 1969] },
  { cle: 'annees-70', nom: 'Les années 70', famille: 'epoque', description: 'De 1970 à 1979, dans toutes les catégories', annees: [1970, 1979] },
  { cle: 'annees-80', nom: 'Les années 80', famille: 'epoque', description: 'De 1980 à 1989, dans toutes les catégories', annees: [1980, 1989] },
  { cle: 'annees-90', nom: 'Les années 90', famille: 'epoque', description: 'De 1990 à 1999, dans toutes les catégories', annees: [1990, 1999] },
  { cle: 'annees-2000', nom: 'Les années 2000', famille: 'epoque', description: 'De 2000 à 2009, dans toutes les catégories', annees: [2000, 2009] },
  { cle: 'depuis-2010', nom: 'Depuis 2010', famille: 'epoque', description: 'Ce qui s’est passé depuis 2010', annees: [2010, 100000] },
  { cle: 'france', nom: 'La France', famille: 'fil', description: 'Ce qu’on sait d’avoir grandi en France', portee: 'france' },
  { cle: 'pionnieres', nom: 'Pionnières', famille: 'fil', description: 'Des femmes qui ont ouvert la voie', etiquettes: ['femmes'] },
  { cle: 'pieges', nom: 'Les pièges', famille: 'fil', description: 'La réponse évidente est fausse', etiquettes: ['piege'] },
  { cle: 'premieres', nom: 'Les premières fois', famille: 'fil', description: 'Qui l’a fait le premier ?', etiquettes: ['premiere'] },
  { cle: 'records', nom: 'Les records', famille: 'fil', description: 'Le plus grand, le plus rapide, le plus ancien', etiquettes: ['record'] },
  { cle: 'surnoms', nom: 'Les surnoms', famille: 'fil', description: 'La Ville Lumière, le Roi-Soleil…', etiquettes: ['surnom'] },
  { cle: 'mots', nom: 'L’origine des mots', famille: 'fil', description: 'D’où viennent les mots et les noms', etiquettes: ['etymologie'] },
  { cle: 'insolite', nom: 'L’insolite', famille: 'fil', description: 'Des faits qu’on a envie de raconter, et des idées reçues', etiquettes: ['insolite', 'idee-recue'] },
  { cle: 'enfance', nom: 'Souvenirs d’enfance', famille: 'fil', description: 'Dessins animés, jouets, contes et légendes', etiquettes: ['enfance', 'contes-legendes'] },
]

export const sujetParCle = (cle: unknown): Sujet | undefined => SUJETS.find(s => s.cle === cle)

/**
 * L'année d'une question datée. Au siècle près, elle ne range rien : « 1801 »
 * dit tout le XIXe, et l'aurait mis dans l'époque de sa première année. Une
 * décennie s'écrit par la sienne (« 1980 », les années 80) : elle y tombe.
 */
export function anneeDe(date: MetadonneesDeQuestion['date']): number | null {
  if (!date || date.precision === 'siecle') return null
  const lue = /^-?\d+/.exec(date.valeur)
  return lue ? Number(lue[0]) : null
}

/** Les sujets d'une question, par leur clé : son année se lit une fois pour toutes les époques. */
export function sujetsDe(meta: Pick<MetadonneesDeQuestion, 'date' | 'etiquettes' | 'portee' | 'categorie' | 'sousTheme'>): string[] {
  const annee = anneeDe(meta.date)
  return SUJETS.filter(
    s =>
      (s.annees && annee !== null && annee >= s.annees[0] && annee <= s.annees[1]) ||
      (s.etiquettes && s.etiquettes.some(e => meta.etiquettes.includes(e))) ||
      (s.portee && meta.portee === s.portee) ||
      (s.sousThemes && !!s.sousThemes[meta.categorie as Categorie]?.includes(meta.sousTheme)),
  ).map(s => s.cle)
}
