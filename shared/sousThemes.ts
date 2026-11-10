// Les sous-thèmes de chaque catégorie : une liste fermée, que la consigne
// donnée à une IA propose (`server/src/core/etiquetage.ts`), que la relecture
// de ce qu'elle rend exige (`lireEtiquetage`, `shared/etiquettes.ts`), et que
// lisent les chapitres des sentiers, les thèmes et les rubriques de la feuille
// du choix (`shared/sujets.ts`). À part du reste du catalogue des métadonnées :
// la feuille du choix nomme chaque sous-thème, et la page de la campagne n'a
// pas à télécharger pour ça les définitions des étiquettes.
//
// La danse et la santé (le 15 octobre 2026) n'ont qu'un sous-thème par
// catégorie, là où leur savoir vivait déjà — ballet, danses et bal ; sante et
// medecine : chaque sous-thème prend sa part des séries de sa catégorie, et
// six de danse en musique l'auraient faite à moitié dansée. Leurs familles —
// la salsa, les orishas, la rééducation — vivent dans leur inventaire
// (`server/src/core/inventaires.ts`).
//
// La langue française (le 17 octobre 2026) a pris son sous-thème à langue,
// qui mêlait les accords du participe et l'alphabet coréen : langue garde
// les autres langues, les écritures et les codes, francais tout ce qui dit
// le français — son orthographe, sa grammaire, ses mots et leur origine.
// L'anglais et l'espagnol ont pris chacun le leur le même jour : une série
// de Culture générale y gagne des questions de langue, quatre sous-thèmes
// sur douze, et une série de toutes les catégories presque rien.
//
// La plongée et l'équitation (le souhait du propriétaire du 9 novembre
// 2026 : « rajouter deux thèmes », l'un sur « la discipline plongée »,
// l'autre sur l'équitation) ont chacune le leur en Sport : la base n'en
// posait presque rien — une question sur les épreuves équestres de 1956,
// aucune sur la plongée —, et rangées dans glisse ou olympisme, leurs cent
// trente questions en auraient fait plus du tiers. À tour égal, une série de
// Sport leur donnait deux tours sur onze.
//
// Les spécialités (le 10 novembre 2026). Un sous-thème par savoir a un
// revers : chacun prend un tour entier dans sa catégorie, et sept d'entre eux
// sont des savoirs qu'on vient chercher — l'équitation, la plongée, l'anglais,
// l'espagnol, les métiers de la santé, les danses, le ballet. Une série de
// Sport posait de l'équitation ou de la plongée une fois sur six, une de
// Culture générale une langue étrangère ou un métier de la santé une fois
// sur quatre (mesuré sur la base ce jour-là, `tirage-pondere.test.ts`). Les
// sortir du tour, proposé d'abord, le propriétaire l'a refusé — « une sorte
// de "pro rata" afin de garder quand même certaines questions » : elles
// passent une fois quand les autres sous-thèmes de leur catégorie passent
// trois fois (`TOURS_D_UNE_SPECIALITE`), dans une série, un défi, un duel et
// un quiz tout prêt — 7 % d'une série de Sport, 10 % d'une de Culture
// générale. Le pas ne joue qu'entre les sous-thèmes d'une même catégorie :
// choisie pour elle-même — sa rubrique, son thème —, une spécialité n'a
// personne, ou presque, à laisser passer, et la série reste la sienne. La
// langue française et les bals gardent leur tour entier : tout le monde y a
// sa chance.

import type { Categorie } from './categories'

export interface SousTheme {
  cle: string
  nom: string
  /** Un savoir qu'on vient chercher : dans le tour de sa catégorie, il passe moins souvent que les autres (`pasDuSousTheme`). */
  specialite?: true
}

/**
 * Combien de fois les autres sous-thèmes de sa catégorie passent quand une
 * spécialité passe une fois, là où une partie les fait tourner : la série, le
 * défi, les duels (`TourDeRole`, `server/src/core/campagne.ts`) et le quiz
 * tout prêt (`server/src/core/quizToutPret.ts`). Un choix de produit
 * (`docs/reference/baremes.md`).
 */
export const TOURS_D_UNE_SPECIALITE = 3

/** Les sous-thèmes de chaque catégorie : une clé n'existe que dans la sienne. */
export const SOUS_THEMES: Record<Categorie, readonly SousTheme[]> = {
  "Culture générale": [
    { cle: "francais", nom: "Langue française" },
    { cle: "anglais", nom: "Langue anglaise", specialite: true },
    { cle: "espagnol", nom: "Langue espagnole", specialite: true },
    { cle: "langue", nom: "Langues et écritures du monde" },
    { cle: "symboles", nom: "Symboles et institutions" },
    { cle: "quotidien", nom: "Objets et vie quotidienne" },
    { cle: "transports", nom: "Transports" },
    { cle: "mythes", nom: "Mythes et religions" },
    { cle: "societe", nom: "Société, métiers et argent" },
    { cle: "sante", nom: "Métiers de la santé", specialite: true },
    { cle: "mesures", nom: "Mesures et calendrier" },
    { cle: "records", nom: "Records et superlatifs" },
  ],
  "Histoire": [
    { cle: "civilisations", nom: "Civilisations anciennes" },
    { cle: "pouvoirs", nom: "Rois, présidents et régimes" },
    { cle: "guerres", nom: "Guerres et batailles" },
    { cle: "explorations", nom: "Explorations et conquêtes" },
    { cle: "personnages", nom: "Grands personnages" },
    { cle: "vie-autrefois", nom: "Vie d’autrefois" },
    { cle: "faits-divers", nom: "Grands événements et faits marquants" },
  ],
  "Géographie": [
    { cle: "capitales", nom: "Capitales et villes" },
    { cle: "pays", nom: "Pays et frontières" },
    { cle: "drapeaux", nom: "Drapeaux" },
    { cle: "reliefs", nom: "Montagnes, volcans et déserts" },
    { cle: "eaux", nom: "Fleuves, lacs, mers et océans" },
    { cle: "france", nom: "Régions et départements français" },
    { cle: "sites", nom: "Sites et monuments" },
    { cle: "peuples", nom: "Peuples, langues et cultures" },
  ],
  "Sciences": [
    { cle: "espace", nom: "Espace et astronomie" },
    { cle: "terre", nom: "Planète Terre" },
    { cle: "corps", nom: "Corps humain" },
    { cle: "medecine", nom: "Maladies, examens et traitements" },
    { cle: "physique-chimie", nom: "Physique et chimie" },
    { cle: "maths", nom: "Mathématiques et logique" },
    { cle: "techno", nom: "Technologies et informatique" },
    { cle: "savants", nom: "Inventions et savants" },
  ],
  "Nature": [
    { cle: "mammiferes", nom: "Mammifères" },
    { cle: "oiseaux", nom: "Oiseaux" },
    { cle: "aquatique", nom: "Poissons et vie aquatique" },
    { cle: "petites-betes", nom: "Insectes, reptiles et petites bêtes" },
    { cle: "plantes", nom: "Plantes, arbres et champignons" },
    { cle: "disparus", nom: "Dinosaures et espèces disparues" },
    { cle: "ecologie", nom: "Écologie et environnement" },
  ],
  "Cinéma & séries": [
    { cle: "cinema-fr", nom: "Cinéma français" },
    { cle: "cinema-monde", nom: "Cinéma du monde" },
    { cle: "animation", nom: "Animation" },
    { cle: "sagas", nom: "Sagas et super-héros" },
    { cle: "series", nom: "Séries" },
    { cle: "repliques", nom: "Répliques cultes" },
    { cle: "coulisses", nom: "Récompenses et coulisses" },
  ],
  "Musique": [
    { cle: "chanson-fr", nom: "Chanson française" },
    { cle: "pop-rock", nom: "Pop et rock" },
    { cle: "rap-electro", nom: "Rap, R&B et électro" },
    { cle: "classique", nom: "Classique et opéra" },
    { cle: "jazz-monde", nom: "Jazz, blues et musiques du monde" },
    { cle: "danses", nom: "Danses de couple, de rue et du monde", specialite: true },
    { cle: "ecrans", nom: "Musiques de films et comédies musicales" },
    { cle: "instruments", nom: "Instruments et théorie" },
  ],
  "Arts & lettres": [
    { cle: "litterature-fr", nom: "Littérature française" },
    { cle: "litterature-monde", nom: "Littérature du monde" },
    { cle: "poesie-theatre", nom: "Poésie et théâtre" },
    { cle: "ballet", nom: "Ballet et danse de scène", specialite: true },
    { cle: "bd", nom: "Bande dessinée et manga" },
    { cle: "peinture", nom: "Peinture et dessin" },
    { cle: "sculpture-archi", nom: "Sculpture et architecture" },
    { cle: "philo", nom: "Philosophie et idées" },
  ],
  "Sport": [
    { cle: "football", nom: "Football" },
    { cle: "rugby", nom: "Rugby" },
    { cle: "tennis", nom: "Tennis" },
    { cle: "cyclisme", nom: "Cyclisme" },
    { cle: "olympisme", nom: "Jeux olympiques et athlétisme" },
    { cle: "equipes", nom: "Basket, hand, volley et hockey" },
    { cle: "mecaniques", nom: "Sports mécaniques" },
    { cle: "glisse", nom: "Montagne, glisse et voile" },
    { cle: "combat", nom: "Sports de combat" },
    { cle: "equitation", nom: "Équitation et courses hippiques", specialite: true },
    { cle: "plongee", nom: "Plongée et apnée", specialite: true },
  ],
  "Cuisine": [
    { cle: "france", nom: "Spécialités françaises" },
    { cle: "monde", nom: "Cuisines du monde" },
    { cle: "terroir", nom: "Fromages et produits du terroir" },
    { cle: "desserts", nom: "Desserts et pâtisserie" },
    { cle: "ingredients", nom: "Ingrédients et produits bruts" },
    { cle: "boissons", nom: "Vins et boissons" },
    { cle: "techniques", nom: "Techniques et vocabulaire" },
    { cle: "chefs", nom: "Chefs et gastronomie" },
  ],
  "Jeux & pop culture": [
    { cle: "jeux-video", nom: "Jeux vidéo" },
    { cle: "jeux-societe", nom: "Jeux de société et de cartes" },
    { cle: "jouets", nom: "Jouets et enfance" },
    { cle: "tele", nom: "Télévision et émissions" },
    { cle: "internet", nom: "Internet et réseaux sociaux" },
    { cle: "celebrites", nom: "Célébrités" },
    { cle: "mode", nom: "Mode et style" },
  ],
  "Autour de la fête": [
    { cle: "anniversaires", nom: "Anniversaires" },
    { cle: "amour", nom: "Mariage et amour" },
    { cle: "noel", nom: "Noël" },
    { cle: "nouvel-an", nom: "Nouvel An" },
    { cle: "halloween", nom: "Halloween" },
    { cle: "traditions", nom: "Fêtes du monde et traditions" },
    { cle: "bal", nom: "Bals et soirées dansantes" },
    { cle: "cocktails", nom: "Cocktails et apéritifs" },
  ],
}

/** Les spécialités de chaque catégorie, par leur clé — une clé seule ne dit rien : « france » est de la cuisine et de la géographie. */
const SPECIALITES: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  Object.entries(SOUS_THEMES).map(([categorie, liste]) => [categorie, new Set(liste.filter(s => s.specialite).map(s => s.cle))]),
)

/**
 * Le pas d'un sous-thème dans le tour de sa catégorie : ce dont son compte
 * avance chaque fois qu'il passe, le moins avancé passant d'abord. Un pour
 * presque tous ; une spécialité avance de `TOURS_D_UNE_SPECIALITE` — servie
 * une fois, elle attend que les autres l'aient été trois. Un sous-thème que
 * le catalogue ne connaît pas — une base d'essai — avance d'un.
 */
export function pasDuSousTheme(categorie: string, cle: string): number {
  return SPECIALITES.get(categorie)?.has(cle) ? TOURS_D_UNE_SPECIALITE : 1
}

/**
 * Où en est un sous-thème quand une partie commence : à zéro pour presque
 * tous, et pour une spécialité à un tour tiré au sort, de zéro à son pas.
 * Sans ce tirage, son pas ne pèserait rien dans une série de toutes les
 * catégories : elle pose cinq questions de sport, aucun de ses onze
 * sous-thèmes n'y repasse, et l'équitation, à égalité avec les autres au
 * premier tour, y garderait sa place entière ; entrée toujours au dernier,
 * elle n'y viendrait jamais. Tirée, elle n'est du premier tour qu'une partie
 * sur trois.
 */
export function entreeDansLeTour(pas: number, hasard: () => number): number {
  return pas > 1 ? Math.floor(hasard() * pas) : 0
}
