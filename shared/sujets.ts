import { CATEGORIES, type Categorie } from './categories'
import type { MetadonneesDeQuestion } from './etiquettes'
import { SOUS_THEMES } from './sousThemes'

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

/** Une rubrique (`RUBRIQUES`) n'a pas de rangée : la feuille du choix la range sous sa catégorie. */
export type FamilleDeSujet = 'epoque' | 'fil' | 'theme' | 'fete' | 'univers' | 'pays' | 'rubrique'

/**
 * Les familles de sujets, dans l'ordre où l'écran les range, chacune sa
 * rangée ; au pluriel, le nom de son onglet parmi les parcours de thème. Les
 * fêtes d'abord (le 17 octobre 2026) : FiestApp en est une, et la plus
 * proche s'y lit sans défiler (`fetesDansLOrdre`). Les univers et les pays
 * après les thèmes, le même jour.
 */
export const FAMILLES_DE_SUJETS: readonly { famille: FamilleDeSujet; nom: string; pluriel: string }[] = [
  { famille: 'fete', nom: 'Une fête', pluriel: 'Fêtes' },
  { famille: 'theme', nom: 'Un thème', pluriel: 'Thèmes' },
  { famille: 'univers', nom: 'Un univers', pluriel: 'Univers' },
  { famille: 'pays', nom: 'Un pays', pluriel: 'Pays' },
  { famille: 'epoque', nom: 'Une époque', pluriel: 'Époques' },
  { famille: 'fil', nom: 'Un fil rouge', pluriel: 'Fils rouges' },
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
  /** … sauf dans ces catégories, où l'étiquette ne la fait pas sienne… */
  etiquettesHors?: readonly Categorie[]
  /** … ou de cette portée… */
  portee?: MetadonneesDeQuestion['portee']
  /** … ou de l'un de ces sous-thèmes de leur catégorie (`SOUS_THEMES`) : un même mot — « france » — n'est pas le même sous-thème d'une catégorie à l'autre. */
  sousThemes?: Readonly<Partial<Record<Categorie, readonly string[]>>>
  /**
   * Une rubrique : la catégorie dont elle est un sous-thème — la feuille du choix la range sous elle. Un sujet
   * qui la porte ne lit qu'un sous-thème de cette catégorie, et tient lieu de sa rubrique (`rubriquesDeLaCategorie`).
   */
  categorie?: Categorie
  /** Une fête : son jour, mois et jour — la feuille du choix range les fêtes de la plus proche à la plus lointaine. */
  jour?: readonly [number, number]
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
  // Les inventions ont laissé l'informatique à son thème (le souhait du
  // propriétaire du 17 octobre 2026 : « modifier des thèmes s'il y en a qui se
  // recoupent ») : ses trois cent cinquante-cinq questions y étaient toutes,
  // la moitié du thème. Restent les savants et l'étiquette — Diesel, le cube
  // de Rubik —, et la rubrique des savants, qu'il tient.
  {
    cle: 'inventions',
    nom: 'Les inventions',
    famille: 'theme',
    description: 'Qui a inventé quoi, et les savants qui ont tout changé',
    sousThemes: { Sciences: ['savants'] },
    etiquettes: ['invention'],
    categorie: 'Sciences',
  },
  // Les contes et légendes ne sont plus qu'ici : les souvenirs d'enfance les
  // lisaient aussi, et la moitié du thème s'y retrouvait — l'Ankou et Baba
  // Yaga ne sont le souvenir d'enfance de personne.
  {
    cle: 'mythes-legendes',
    nom: 'Mythes et légendes',
    famille: 'theme',
    description: 'Dieux, héros, contes et créatures fabuleuses',
    sousThemes: { 'Culture générale': ['mythes'] },
    etiquettes: ['contes-legendes'],
    categorie: 'Culture générale',
  },
  // La Terre et l'espace a laissé l'espace à l'astronomie (le même jour), qui
  // en faisait le tiers : la clé reste, et les parcours commencés avec elle.
  // Pas « La Terre » : sous les sciences, « Planète Terre » n'en est qu'un
  // morceau, et les deux noms se seraient confondus au carnet.
  {
    cle: 'terre-espace',
    nom: 'Volcans et océans',
    famille: 'theme',
    description: 'Séismes, climats, fleuves, déserts et montagnes',
    sousThemes: { Sciences: ['terre'], Géographie: ['eaux', 'reliefs'] },
  },
  // Il ne tient pas la rubrique des Jeux olympiques : l'athlétisme y vit
  // aussi, qui n'est pas un grand rendez-vous, et la Coupe du monde n'y est pas.
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
  // La danse et les métiers de la santé (le souhait du propriétaire du
  // 15 octobre 2026 : « couvrir toutes les danses, et tous les métiers de la
  // médecine et du paramédical ») : un sous-thème neuf dans chaque catégorie
  // où leur savoir vit, l'inventaire de leurs familles à côté
  // (`server/src/core/inventaires.ts`), et l'étiquette pour le reste. Le
  // corps humain est des métiers de la santé : c'est leur socle. Le thème
  // s'appelle « La santé » depuis que le sous-thème de la culture générale se
  // choisit seul : « Les métiers de la santé » et « Métiers de la santé »,
  // deux fois plus petit, se suivaient au carnet.
  {
    cle: 'danse',
    nom: 'La danse',
    famille: 'theme',
    description: 'Du ballet au hip-hop, de la salsa à la Macarena',
    sousThemes: { 'Arts & lettres': ['ballet'], Musique: ['danses'], 'Autour de la fête': ['bal'] },
    etiquettes: ['danse'],
  },
  {
    cle: 'sante',
    nom: 'La santé',
    famille: 'theme',
    description: 'Médecins, soignants, et le corps qu’ils soignent',
    sousThemes: { 'Culture générale': ['sante'], Sciences: ['medecine', 'corps'] },
    // Le métier, pas sa fiction (le retour du propriétaire du 17 octobre
    // 2026) : l'étiquette y mettait « Dr House », « Urgences », Knock et
    // le Médecin malgré lui : une vingtaine de fictions parmi les
    // soixante-dix-sept questions qu'elle ajoutait. Pasteur, la peste noire
    // et le quinquina restent.
    etiquettes: ['sante'],
    etiquettesHors: ['Cinéma & séries', 'Arts & lettres', 'Jeux & pop culture'],
  },
  // L'informatique et l'astronomie (le souhait du propriétaire du 17 octobre
  // 2026) : chacune avait déjà son sous-thème en sciences, deux cent
  // cinquante questions et plus, et chacune en tient la rubrique.
  // L'informatique laisse Internet aux jeux et à la pop culture : ses réseaux
  // sociaux et ses mèmes n'en sont pas.
  {
    cle: 'informatique',
    nom: 'L’informatique',
    famille: 'theme',
    description: 'Ordinateurs, langages, réseaux et ceux qui les ont inventés',
    sousThemes: { Sciences: ['techno'] },
    categorie: 'Sciences',
  },
  {
    cle: 'astronomie',
    nom: 'L’astronomie',
    famille: 'theme',
    description: 'Planètes, étoiles, galaxies et conquête spatiale',
    sousThemes: { Sciences: ['espace'] },
    categorie: 'Sciences',
  },
  // Puis trois de plus le même jour, chacun sur des sous-thèmes que la base
  // tenait déjà à plus de deux cents questions. La BD laisse les sagas au
  // cinéma : Harry Potter et James Bond n'en sont pas. Les monuments prennent
  // la sculpture avec l'architecture — un tiers de son sous-thème, mais la
  // statue de la Liberté, le Sphinx et les moaïs se visitent.
  {
    cle: 'jeux-video',
    nom: 'Les jeux vidéo',
    famille: 'theme',
    description: 'De Pong à Zelda, consoles, héros et studios',
    sousThemes: { 'Jeux & pop culture': ['jeux-video'] },
    categorie: 'Jeux & pop culture',
  },
  {
    cle: 'bd',
    nom: 'La BD et le manga',
    famille: 'theme',
    description: 'Tintin, Astérix, les super-héros et les mangas',
    sousThemes: { 'Arts & lettres': ['bd'] },
    categorie: 'Arts & lettres',
  },
  {
    cle: 'monuments',
    nom: 'Monuments et architecture',
    famille: 'theme',
    description: 'Des pyramides aux gratte-ciel, et les statues qu’on visite',
    sousThemes: { Géographie: ['sites'], 'Arts & lettres': ['sculpture-archi'] },
  },
  // La langue française (le souhait du propriétaire du 17 octobre 2026 :
  // « tout ce qui est lié à la langue française, orthographe, grammaire,
  // étymologie, morphologie ») : un sous-thème neuf, qui a repris à langue
  // tout ce qui parlait du français, un inventaire, et l'étiquette pour une
  // expression rangée ailleurs (ouvrir le bal, le toubib). L'origine d'un mot
  // rangé dans sa catégorie — les noms des dinosaures, des cocktails — reste
  // à « L'origine des mots » : ses six cents questions auraient fait du thème
  // un dictionnaire étymologique, sans une règle d'accord.
  {
    cle: 'francais',
    nom: 'La langue française',
    famille: 'theme',
    description: 'Orthographe, grammaire, expressions et origine des mots',
    sousThemes: { 'Culture générale': ['francais'] },
    etiquettes: ['francais'],
    categorie: 'Culture générale',
  },
  // L'anglais et l'espagnol (le même jour) : la langue vue de France — le mot
  // à traduire, le verbe irrégulier, le faux ami, l'expression —, chacun son
  // sous-thème et son inventaire, et son étiquette pour le mot qu'on croise
  // ailleurs (happy hour, piña colada). La base n'en avait presque rien.
  {
    cle: 'anglais',
    nom: 'L’anglais',
    famille: 'theme',
    description: 'Vocabulaire, verbes irréguliers, faux amis et expressions',
    sousThemes: { 'Culture générale': ['anglais'] },
    etiquettes: ['anglais'],
    categorie: 'Culture générale',
  },
  {
    cle: 'espagnol',
    nom: 'L’espagnol',
    famille: 'theme',
    description: 'Vocabulaire, ser et estar, faux amis et expressions',
    sousThemes: { 'Culture générale': ['espagnol'] },
    etiquettes: ['espagnol'],
    categorie: 'Culture générale',
  },
  // Les fêtes (le 17 octobre 2026) : celles qu'« Autour de la fête » tenait
  // déjà, chacune son sous-thème — plus de deux cents questions — et
  // l'étiquette qui la nomme ailleurs (« Le père Noël est une ordure »).
  // Elles se rangent de la plus proche à la plus lointaine
  // (`fetesDansLOrdre`), et n'ont pas de parcours : le sentier de la fête
  // les monte déjà, chapitre par chapitre (« Noël et Nouvel An »). Chacune
  // tient la rubrique de son sous-thème.
  {
    cle: 'noel',
    nom: 'Noël',
    famille: 'fete',
    description: 'Le Père Noël, le sapin, les marchés et les Noëls du monde',
    sousThemes: { 'Autour de la fête': ['noel'] },
    etiquettes: ['noel'],
    categorie: 'Autour de la fête',
    jour: [12, 25],
  },
  {
    cle: 'nouvel-an',
    nom: 'Le Nouvel An',
    famille: 'fete',
    description: 'Le réveillon, les vœux et la nouvelle année fêtée de Pékin à Téhéran',
    sousThemes: { 'Autour de la fête': ['nouvel-an'] },
    etiquettes: ['nouvel-an'],
    categorie: 'Autour de la fête',
    jour: [12, 31],
  },
  {
    cle: 'halloween',
    nom: 'Halloween',
    famille: 'fete',
    description: 'Fantômes, vampires, sorcières et les fêtes des morts du monde',
    sousThemes: { 'Autour de la fête': ['halloween'] },
    etiquettes: ['halloween'],
    categorie: 'Autour de la fête',
    jour: [10, 31],
  },
  {
    cle: 'amour',
    nom: 'L’amour',
    famille: 'fete',
    description: 'La Saint-Valentin, les mariages et les grandes histoires d’amour',
    sousThemes: { 'Autour de la fête': ['amour'] },
    etiquettes: ['saint-valentin'],
    categorie: 'Autour de la fête',
    jour: [2, 14],
  },
  // Sans jour : chacun le sien. Au bout de la rangée.
  {
    cle: 'anniversaires',
    nom: 'Les anniversaires',
    famille: 'fete',
    description: 'Bougies, signes du zodiaque, noces d’or et centenaires',
    sousThemes: { 'Autour de la fête': ['anniversaires'] },
    categorie: 'Autour de la fête',
  },
  // Les univers (le 17 octobre 2026) : les sagas qui traversent les livres,
  // les films, les jeux et les chansons, chacune son étiquette (`ETIQUETTES`,
  // « Les univers »), posée sur la base comme celle des pays, puis écrite là où
  // il manquait de quoi faire cent questions. Astérix, Tintin, Nintendo et
  // Pokémon tenaient aux trois quarts dans la BD ou les jeux vidéo : des
  // thèmes qui se recoupent, ce que le propriétaire ne voulait plus.
  { cle: 'disney', nom: 'Disney et Pixar', famille: 'univers', description: 'Des princesses aux jouets de Toy Story, les films et les parcs', etiquettes: ['disney'] },
  { cle: 'harry-potter', nom: 'Harry Potter', famille: 'univers', description: 'Poudlard, les sorciers, les livres et les films', etiquettes: ['harry-potter'] },
  { cle: 'james-bond', nom: 'James Bond', famille: 'univers', description: '007, ses films, ses acteurs, ses chansons et ses méchants', etiquettes: ['james-bond'] },
  { cle: 'marvel', nom: 'Marvel', famille: 'univers', description: 'Les Avengers, Spider-Man et les X-Men, en BD et au cinéma', etiquettes: ['marvel'] },
  { cle: 'seigneur-des-anneaux', nom: 'Le Seigneur des anneaux', famille: 'univers', description: 'La Terre du Milieu, de Tolkien à Peter Jackson', etiquettes: ['seigneur-des-anneaux'] },
  { cle: 'star-wars', nom: 'Star Wars', famille: 'univers', description: 'Les Jedi, l’Empire et la Force, au cinéma et au-delà', etiquettes: ['star-wars'] },
  // Les pays (le 17 octobre 2026, « apporter beaucoup de choix ») : une
  // étiquette chacun (`ETIQUETTES`, « Les pays »), posée sur les questions que
  // la base avait déjà, relues une à une — l'Italie de la pizza et de Fellini,
  // pas les chiffres romains ni Jupiter, qui est aux mythes. Ni la France, ni
  // la Belgique ou la Suisse : leurs fils rouges les disent. Le soir même, le
  // Canada, Québec compris, et deux continents — l'Afrique sans l'Égypte, qui
  // a son sujet, l'Amérique du Sud sans le Mexique : deux sujets ne se
  // recoupent pas. Dans l'ordre de l'alphabet : on y cherche un nom.
  { cle: 'afrique', nom: 'L’Afrique', famille: 'pays', description: 'Du Sahara au Cap, ses pays, ses peuples et ses musiques (l’Égypte a la sienne)', etiquettes: ['afrique'] },
  { cle: 'allemagne', nom: 'L’Allemagne', famille: 'pays', description: 'Berlin, la Bavière, Goethe et le Mur', etiquettes: ['allemagne'] },
  { cle: 'amerique-du-sud', nom: 'L’Amérique du Sud', famille: 'pays', description: 'Le Brésil, l’Argentine, les Andes et l’Amazonie', etiquettes: ['amerique-du-sud'] },
  { cle: 'australie', nom: 'L’Australie', famille: 'pays', description: 'Sydney, les kangourous et le bush', etiquettes: ['australie'] },
  { cle: 'canada', nom: 'Le Canada', famille: 'pays', description: 'Le Québec, les Rocheuses, le hockey et le sirop d’érable', etiquettes: ['canada'] },
  { cle: 'chine', nom: 'La Chine', famille: 'pays', description: 'Pékin, la Grande Muraille, les dynasties et le kung-fu', etiquettes: ['chine'] },
  { cle: 'egypte', nom: 'L’Égypte', famille: 'pays', description: 'Les pharaons, les pyramides et le Nil', etiquettes: ['egypte'] },
  { cle: 'espagne', nom: 'L’Espagne', famille: 'pays', description: 'Madrid, Barcelone, le flamenco et la paella', etiquettes: ['espagne'] },
  { cle: 'etats-unis', nom: 'Les États-Unis', famille: 'pays', description: 'New York, Hollywood, les présidents et le Far West', etiquettes: ['etats-unis'] },
  { cle: 'grece', nom: 'La Grèce', famille: 'pays', description: 'Athènes, l’Acropole, les philosophes et les îles', etiquettes: ['grece'] },
  { cle: 'inde', nom: 'L’Inde', famille: 'pays', description: 'Bollywood, le Taj Mahal, Gandhi et le curry', etiquettes: ['inde'] },
  { cle: 'italie', nom: 'L’Italie', famille: 'pays', description: 'Rome, Venise, la pizza et la dolce vita', etiquettes: ['italie'] },
  { cle: 'japon', nom: 'Le Japon', famille: 'pays', description: 'Tokyo, les samouraïs, les sushis et les mangas', etiquettes: ['japon'] },
  { cle: 'mexique', nom: 'Le Mexique', famille: 'pays', description: 'Les Aztèques, les mariachis et Frida Kahlo', etiquettes: ['mexique'] },
  { cle: 'pays-nordiques', nom: 'Les pays nordiques', famille: 'pays', description: 'Les Vikings, les fjords, ABBA et les aurores boréales', etiquettes: ['pays-nordiques'] },
  { cle: 'royaume-uni', nom: 'Le Royaume-Uni', famille: 'pays', description: 'Londres, la Couronne, les Beatles et le thé', etiquettes: ['royaume-uni'] },
  { cle: 'russie', nom: 'La Russie', famille: 'pays', description: 'Moscou, les tsars, l’URSS et le Bolchoï', etiquettes: ['russie'] },
  // Les époques larges redécoupées (le 17 octobre 2026, « apporter beaucoup de
  // choix ») : « Avant 1800 » mêlait les pharaons et Voltaire, « 1900 à 1949 »
  // la Belle Époque et la Libération, « Depuis 2010 » les années 2010 et
  // celles d'après. Chacune des neuves a ses cent questions, ses sept
  // catégories et cinq de chaque marche ; les anciennes attendent à part
  // (`SUJETS_REMPLACES`). Le Grand Siècle finit avec Louis XIV, en 1715.
  { cle: 'antiquite', nom: 'L’Antiquité', famille: 'epoque', description: 'Des pharaons à la chute de Rome', annees: [-100000, 475] },
  { cle: 'moyen-age', nom: 'Le Moyen Âge', famille: 'epoque', description: 'De Clovis à Jeanne d’Arc', annees: [476, 1491] },
  { cle: 'renaissance', nom: 'La Renaissance', famille: 'epoque', description: 'Des grandes découvertes à Shakespeare', annees: [1492, 1609] },
  { cle: 'grand-siecle', nom: 'Le Grand Siècle', famille: 'epoque', description: 'Louis XIV, Versailles, Molière et les mousquetaires', annees: [1610, 1715] },
  { cle: 'lumieres', nom: 'Les Lumières', famille: 'epoque', description: 'De Voltaire à la Révolution', annees: [1716, 1799] },
  { cle: 'xixe', nom: 'Le XIXe siècle', famille: 'epoque', description: 'De Napoléon à la tour Eiffel', annees: [1800, 1899] },
  { cle: '1900-1918', nom: '1900 à 1918', famille: 'epoque', description: 'La Belle Époque et la Grande Guerre', annees: [1900, 1918] },
  { cle: '1919-1938', nom: '1919 à 1938', famille: 'epoque', description: 'Les Années folles et l’entre-deux-guerres', annees: [1919, 1938] },
  { cle: '1939-1949', nom: '1939 à 1949', famille: 'epoque', description: 'La Seconde Guerre mondiale et l’après-guerre', annees: [1939, 1949] },
  { cle: 'annees-50', nom: 'Les années 50', famille: 'epoque', description: 'De 1950 à 1959, dans toutes les catégories', annees: [1950, 1959] },
  { cle: 'annees-60', nom: 'Les années 60', famille: 'epoque', description: 'De 1960 à 1969, dans toutes les catégories', annees: [1960, 1969] },
  { cle: 'annees-70', nom: 'Les années 70', famille: 'epoque', description: 'De 1970 à 1979, dans toutes les catégories', annees: [1970, 1979] },
  { cle: 'annees-80', nom: 'Les années 80', famille: 'epoque', description: 'De 1980 à 1989, dans toutes les catégories', annees: [1980, 1989] },
  { cle: 'annees-90', nom: 'Les années 90', famille: 'epoque', description: 'De 1990 à 1999, dans toutes les catégories', annees: [1990, 1999] },
  { cle: 'annees-2000', nom: 'Les années 2000', famille: 'epoque', description: 'De 2000 à 2009, dans toutes les catégories', annees: [2000, 2009] },
  { cle: 'annees-2010', nom: 'Les années 2010', famille: 'epoque', description: 'De 2010 à 2019, dans toutes les catégories', annees: [2010, 2019] },
  { cle: 'depuis-2020', nom: 'Depuis 2020', famille: 'epoque', description: 'Ce qui s’est passé depuis 2020', annees: [2020, 100000] },
  { cle: 'france', nom: 'La France', famille: 'fil', description: 'Ce qu’on sait d’avoir grandi en France', portee: 'france' },
  // La francophonie (le 17 octobre 2026) : la portée que chaque question porte déjà — ce qu'on sait d'avoir
  // grandi en Belgique, en Suisse, au Québec ou en Afrique francophone —, cinq cents questions de douze catégories.
  { cle: 'francophonie', nom: 'La francophonie', famille: 'fil', description: 'La Belgique, la Suisse, le Québec et l’Afrique francophone', portee: 'francophonie' },
  // Le 17 octobre 2026, au soir (« rajouter ce qui te semble pertinent ») : ce que la base posait sans qu'on puisse
  // le choisir, mesuré sur elle — chacun ses cent questions de sept catégories au moins, et aucun ne tient à moitié
  // dans un autre sujet. L'outre-mer, les citations et le calcul avaient déjà leur étiquette ; Paris, les rois et la
  // mer ont reçu la leur question par question, relues à sa règle comme les pays. Pas les îles : l'outre-mer et
  // les pays-îles s'y seraient retrouvés.
  { cle: 'outre-mer', nom: 'L’outre-mer', famille: 'fil', description: 'Des Antilles à la Polynésie, leurs musiques, leurs saveurs et leur histoire', etiquettes: ['outre-mer'] },
  { cle: 'paris', nom: 'Paris', famille: 'fil', description: 'Ses monuments, ses quartiers, son histoire et ses Parisiens', etiquettes: ['paris'] },
  { cle: 'rois-de-france', nom: 'Les rois et reines de France', famille: 'fil', description: 'De Clovis à Louis-Philippe, leurs règnes et leurs cours', etiquettes: ['rois-de-france'] },
  { cle: 'mer', nom: 'La mer et les marins', famille: 'fil', description: 'Navires, pirates, naufrages et courses au large', etiquettes: ['mer'] },
  { cle: 'pionnieres', nom: 'Pionnières', famille: 'fil', description: 'Des femmes qui ont ouvert la voie', etiquettes: ['femmes'] },
  { cle: 'pieges', nom: 'Les pièges', famille: 'fil', description: 'La réponse évidente est fausse', etiquettes: ['piege'] },
  { cle: 'premieres', nom: 'Les premières fois', famille: 'fil', description: 'Qui l’a fait le premier ?', etiquettes: ['premiere'] },
  // Les records tiennent la rubrique de la culture générale (le 17 octobre 2026) : 192 de ses 222 questions
  // l'étaient déjà, et les trente autres — la plus grande ville de Suisse, le plus petit pays de l'Union — aussi.
  {
    cle: 'records',
    nom: 'Les records',
    famille: 'fil',
    description: 'Le plus grand, le plus rapide, le plus ancien',
    etiquettes: ['record'],
    sousThemes: { 'Culture générale': ['records'] },
    categorie: 'Culture générale',
  },
  { cle: 'surnoms', nom: 'Les surnoms', famille: 'fil', description: 'La Ville Lumière, le Roi-Soleil…', etiquettes: ['surnom'] },
  { cle: 'citations', nom: 'Les citations', famille: 'fil', description: 'Qui a dit, écrit ou chanté cette phrase ?', etiquettes: ['citation'] },
  { cle: 'mots', nom: 'L’origine des mots', famille: 'fil', description: 'D’où viennent les mots et les noms', etiquettes: ['etymologie'] },
  { cle: 'calcul-mental', nom: 'Le calcul mental', famille: 'fil', description: 'Des questions où il faut compter', etiquettes: ['calcul'] },
  { cle: 'insolite', nom: 'L’insolite', famille: 'fil', description: 'Des faits qu’on a envie de raconter, et des idées reçues', etiquettes: ['insolite', 'idee-recue'] },
  // Sans les contes et légendes depuis le 17 octobre 2026 : ils sont aux mythes et légendes (plus haut).
  { cle: 'enfance', nom: 'Souvenirs d’enfance', famille: 'fil', description: 'Dessins animés, jouets, chansons et livres d’enfant', etiquettes: ['enfance'] },
]

/**
 * Les époques larges d'avant leur redécoupage (le 17 octobre 2026). Leur clé
 * se lit encore — un parcours commencé, une partie en route, un choix retenu
 * sur un téléphone — et leurs questions s'y rangent toujours : un parcours
 * commencé se finit, ses étapes validées ne se perdent pas. Hors de `SUJETS`,
 * aucune liste ne les propose plus : ni la feuille du choix, ni le carnet,
 * ni les parcours de qui ne les a pas commencés.
 */
export const SUJETS_REMPLACES: readonly Sujet[] = [
  { cle: 'avant-1800', nom: 'Avant 1800', famille: 'epoque', description: 'Des pharaons aux Lumières', annees: [-100000, 1799] },
  { cle: '1900-1949', nom: '1900 à 1949', famille: 'epoque', description: 'La Belle Époque et les deux guerres', annees: [1900, 1949] },
  { cle: 'depuis-2010', nom: 'Depuis 2010', famille: 'epoque', description: 'Ce qui s’est passé depuis 2010', annees: [2010, 100000] },
]

const REMPLACES: ReadonlySet<string> = new Set(SUJETS_REMPLACES.map(s => s.cle))

/** Un sujet d'avant, qui ne se propose plus (`SUJETS_REMPLACES`). */
export const estRemplace = (cle: unknown): boolean => typeof cle === 'string' && REMPLACES.has(cle)

// Les rubriques : chaque sous-thème seul, choisi sous sa catégorie — « Sport »,
// puis « Football » (le choix du propriétaire du 17 octobre 2026, « apporter
// beaucoup de choix ») : quatre-vingt-seize des quatre-vingt-dix-sept
// sous-thèmes avaient de quoi faire une série, plus de deux cents questions
// chacun, et le joueur n'en choisissait presque aucun. Une rubrique est un
// sujet comme un autre pour la série, la révision, le duel et le quiz tout
// prêt ; elle n'a ni rangée dans l'onglet des thèmes, ni parcours : la
// feuille du choix la range sous sa catégorie, et les sentiers montent déjà
// chaque sous-thème, chapitre par chapitre. Les sujets d'une question ne la
// disent pas (`sujetsDe`) : sa rubrique s'y ajoute (`sujetsEtRubriqueDe`).
// Pas « rayon » : c'est celui de la boutique, et celui des modèles de quiz.
//
// Un sujet qui ne lit qu'un sous-thème en tient la rubrique (`categorie`) :
// « Les jeux vidéo » sous les jeux et la pop culture, à la place de « Jeux
// vidéo ». Les deux posaient les mêmes questions, à quelques étiquettes près,
// et se suivaient au carnet : douze thèmes doublaient ainsi leur rubrique (le
// souhait du propriétaire du 17 octobre 2026 : « modifier des thèmes s'il y en
// a qui se recoupent »). Un seul sujet, deux portes : sa tuile parmi les
// thèmes, sa pastille sous sa catégorie.

/** « Cinéma & séries » → « cinema-series » : le nom d'une catégorie, dans une clé. */
const enCle = (categorie: string) =>
  categorie
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * La clé d'une rubrique : « sport/football ». Sa catégorie la précède — un
 * même sous-thème, « france », n'est pas le même en cuisine et en
 * géographie —, et aucune clé de `SUJETS` n'a de barre : une rubrique n'en
 * prend jamais une.
 */
export const cleDeRubrique = (categorie: string, sousTheme: string): string => `${enCle(categorie)}/${sousTheme}`

/**
 * Sous ce nombre de questions jouables, une rubrique ne se propose pas. Un
 * thème se garde au test de la base livrée (`campagne-sujets.test.ts` : cent
 * questions, cinq à chaque marche) ; une rubrique, à la lecture : « Langues
 * et écritures du monde », cinquante-cinq questions depuis que le français,
 * l'anglais et l'espagnol ont pris les leurs, reviendra d'elle-même quand
 * elle les aura.
 */
export const QUESTIONS_POUR_UNE_RUBRIQUE = 100

/** Les rubriques qu'un sujet tient, par leur clé : « jeux-pop-culture/jeux-video », c'est « jeux-video ». */
const TENUES: ReadonlyMap<string, string> = new Map(
  SUJETS.filter(s => s.categorie).map(s => [cleDeRubrique(s.categorie!, s.sousThemes![s.categorie!]![0]), s.cle]),
)

/** Les rubriques, catégorie par catégorie, dans l'ordre de leurs sous-thèmes — sauf celles qu'un sujet tient. */
export const RUBRIQUES: readonly Sujet[] = CATEGORIES.flatMap(categorie =>
  SOUS_THEMES[categorie]
    .filter(st => !TENUES.has(cleDeRubrique(categorie, st.cle)))
    .map(
      (st): Sujet => ({
        cle: cleDeRubrique(categorie, st.cle),
        nom: st.nom,
        famille: 'rubrique',
        // Sa catégorie, sous son nom : seul, celui d'un sous-thème ne dit pas toujours de quoi — « Techniques et
        // vocabulaire », en cuisine. « Cuisine › Techniques et vocabulaire » redisait son nom sous lui, sur deux lignes.
        description: categorie,
        categorie,
        sousThemes: { [categorie]: [st.cle] } as Partial<Record<Categorie, readonly string[]>>,
      }),
    ),
)

/**
 * Ce que la feuille du choix range sous une catégorie, dans l'ordre de ses
 * sous-thèmes : chaque rubrique, ou le sujet qui en tient lieu — leurs clés.
 */
export const rubriquesDeLaCategorie = (categorie: string): readonly string[] =>
  (SOUS_THEMES[categorie as Categorie] ?? []).map(st => {
    const cle = cleDeRubrique(categorie, st.cle)
    return TENUES.get(cle) ?? cle
  })

/** Tout ce qu'une partie vise au-delà des catégories : les sujets, puis les rubriques. */
export const SUJETS_ET_RUBRIQUES: readonly Sujet[] = [...SUJETS, ...RUBRIQUES]

const PAR_CLE: ReadonlyMap<string, Sujet> = new Map([...SUJETS_ET_RUBRIQUES, ...SUJETS_REMPLACES].map(s => [s.cle, s]))

/** Un sujet ou une rubrique, par sa clé — un sujet remplacé aussi : son nom se lit encore. */
export const sujetParCle = (cle: unknown): Sujet | undefined => (typeof cle === 'string' ? PAR_CLE.get(cle) : undefined)

/** La rubrique de chaque sous-thème, par catégorie : une question la trouve sans refaire sa clé. */
const RUBRIQUE_DU_SOUS_THEME: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map(
  CATEGORIES.map(c => [c, new Map(SOUS_THEMES[c].map(st => [st.cle, cleDeRubrique(c, st.cle)]))]),
)

/**
 * La rubrique d'une question : celle de son sous-thème, dans sa catégorie.
 * Tenue par un sujet, elle ne se sert pas — `sujetParCle` ne la connaît pas —,
 * mais dit encore son sous-thème : la voisine d'une question le garde
 * (`uneAutreQuestion`).
 */
export const rubriqueDe = (meta: Pick<MetadonneesDeQuestion, 'categorie' | 'sousTheme'>): string | null =>
  RUBRIQUE_DU_SOUS_THEME.get(meta.categorie)?.get(meta.sousTheme) ?? null

/**
 * Un sujet monte-t-il en parcours de thème (`shared/sentiersDeSujets.ts`) ?
 * Pas une rubrique, ni une fête : le sentier de leur catégorie monte déjà
 * leur sous-thème, chapitre par chapitre — six étapes de plus n'y
 * apprendraient rien.
 */
export const aUnParcours = (s: Pick<Sujet, 'famille'>): boolean => s.famille !== 'rubrique' && s.famille !== 'fete'

/**
 * Les fêtes, de la plus proche à la plus lointaine — celle du jour d'abord,
 * celle d'hier au bout de l'année —, les fêtes sans jour à la fin : en
 * octobre, Halloween ouvre la rangée, en décembre Noël. Au mois et au jour
 * de l'appareil : un ordre, pas une échéance.
 */
export function fetesDansLOrdre<S extends Pick<Sujet, 'jour'>>(fetes: readonly S[], maintenant: Date): S[] {
  // Trente et un jours par mois : un rang dans l'année, que l'ordre seul lit.
  const rang = (mois: number, jour: number) => (mois - 1) * 31 + jour
  const aujourdhui = rang(maintenant.getMonth() + 1, maintenant.getDate())
  const attente = (f: S) => (f.jour ? (rang(f.jour[0], f.jour[1]) - aujourdhui + 12 * 31) % (12 * 31) : Infinity)
  return [...fetes].sort((a, b) => attente(a) - attente(b))
}

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

/** Ce qu'une question peut être : les sujets, puis les remplacés, qui se lisent encore. */
const LUS: readonly Sujet[] = [...SUJETS, ...SUJETS_REMPLACES]

/**
 * Les sujets rangés par ce qui y fait entrer une question — une étiquette, une
 * portée, un sous-thème de sa catégorie, des années —, chacun par son rang
 * dans `LUS`. Bâti à la première lecture : la page qui n'importe ce module
 * que pour un nom n'en paie rien.
 */
interface IndexDesSujets {
  parEtiquette: Map<string, readonly number[]>
  parPortee: Map<string, readonly number[]>
  /** Par catégorie, puis par sous-thème : « france » n'est pas le même d'une catégorie à l'autre. */
  parSousTheme: Map<string, Map<string, readonly number[]>>
  parAnnees: readonly { rang: number; de: number; a: number }[]
}

let indexDesSujets: IndexDesSujets | null = null

function indexer(): IndexDesSujets {
  const parEtiquette = new Map<string, number[]>()
  const parPortee = new Map<string, number[]>()
  const parSousTheme = new Map<string, Map<string, number[]>>()
  const parAnnees: { rang: number; de: number; a: number }[] = []
  const ranger = (m: Map<string, number[]>, cle: string, rang: number) => {
    const rangs = m.get(cle)
    if (!rangs) m.set(cle, [rang])
    else if (!rangs.includes(rang)) rangs.push(rang)
  }
  LUS.forEach((s, rang) => {
    if (s.annees) parAnnees.push({ rang, de: s.annees[0], a: s.annees[1] })
    for (const e of s.etiquettes ?? []) ranger(parEtiquette, e, rang)
    if (s.portee) ranger(parPortee, s.portee, rang)
    for (const [categorie, sousThemes] of Object.entries(s.sousThemes ?? {})) {
      let siens = parSousTheme.get(categorie)
      if (!siens) parSousTheme.set(categorie, (siens = new Map()))
      for (const st of sousThemes ?? []) ranger(siens, st, rang)
    }
  })
  return { parEtiquette, parPortee, parSousTheme, parAnnees }
}

/** Les rangs trouvés pour la question en cours : `sujetsDe` ne se rappelle pas lui-même, un seul tableau suffit. */
const trouves: number[] = []

/**
 * Les sujets d'une question, par leur clé, dans l'ordre de `SUJETS` — les
 * remplacés au bout (`SUJETS_REMPLACES`). Lus par
 * l'index de ce qui y fait entrer (`IndexDesSujets`) : passer les vingt-sept
 * sujets pour chacune des vingt-quatre mille questions de la base prenait
 * 35 à 60 ms, à chaque réveil, à la première ouverture de la campagne — dix
 * fois plus au dixième de cœur de l'hébergeur (le banc du 16 octobre 2026).
 * `campagne-sujets.test.ts` le compare, question par question, à la règle lue
 * sujet par sujet.
 */
export function sujetsDe(meta: Pick<MetadonneesDeQuestion, 'date' | 'etiquettes' | 'portee' | 'categorie' | 'sousTheme'>): string[] {
  const { parEtiquette, parPortee, parSousTheme, parAnnees } = (indexDesSujets ??= indexer())
  trouves.length = 0
  const ajouter = (rangs: readonly number[] | undefined) => {
    if (rangs) for (const r of rangs) trouves.push(r)
  }
  const annee = anneeDe(meta.date)
  if (annee !== null) for (const e of parAnnees) if (annee >= e.de && annee <= e.a) trouves.push(e.rang)
  for (const etiquette of meta.etiquettes) {
    const rangs = parEtiquette.get(etiquette)
    // Une étiquette ne fait pas sienne une question des catégories qu'elle écarte (`etiquettesHors`) : son sous-thème, si.
    if (rangs) for (const r of rangs) if (!LUS[r].etiquettesHors?.includes(meta.categorie as Categorie)) trouves.push(r)
  }
  ajouter(parPortee.get(meta.portee))
  ajouter(parSousTheme.get(meta.categorie)?.get(meta.sousTheme))
  if (trouves.length === 0) return []
  if (trouves.length === 1) return [LUS[trouves[0]].cle]
  // Chacun une fois : une question des années 80 étiquetée « record » et « insolite » en a deux.
  return [...new Set(trouves)].sort((a, b) => a - b).map(r => LUS[r].cle)
}

/**
 * Les sujets d'une question, puis sa rubrique : tout ce qu'une série, une
 * révision, un duel ou un quiz tout prêt peut viser pour la poser. Une
 * rubrique qu'un sujet tient n'y est pas : il y est déjà.
 */
export function sujetsEtRubriqueDe(meta: Pick<MetadonneesDeQuestion, 'date' | 'etiquettes' | 'portee' | 'categorie' | 'sousTheme'>): string[] {
  const sujets = sujetsDe(meta)
  const rubrique = rubriqueDe(meta)
  return rubrique && !TENUES.has(rubrique) ? [...sujets, rubrique] : sujets
}
