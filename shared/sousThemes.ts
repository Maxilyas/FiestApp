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

import type { Categorie } from './categories'

export interface SousTheme {
  cle: string
  nom: string
}

/** Les sous-thèmes de chaque catégorie : une clé n'existe que dans la sienne. */
export const SOUS_THEMES: Record<Categorie, readonly SousTheme[]> = {
  "Culture générale": [
    { cle: "francais", nom: "Langue française" },
    { cle: "anglais", nom: "Langue anglaise" },
    { cle: "espagnol", nom: "Langue espagnole" },
    { cle: "langue", nom: "Langues et écritures du monde" },
    { cle: "symboles", nom: "Symboles et institutions" },
    { cle: "quotidien", nom: "Objets et vie quotidienne" },
    { cle: "transports", nom: "Transports" },
    { cle: "mythes", nom: "Mythes et religions" },
    { cle: "societe", nom: "Société, métiers et argent" },
    { cle: "sante", nom: "Métiers de la santé" },
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
    { cle: "danses", nom: "Danses de couple, de rue et du monde" },
    { cle: "ecrans", nom: "Musiques de films et comédies musicales" },
    { cle: "instruments", nom: "Instruments et théorie" },
  ],
  "Arts & lettres": [
    { cle: "litterature-fr", nom: "Littérature française" },
    { cle: "litterature-monde", nom: "Littérature du monde" },
    { cle: "poesie-theatre", nom: "Poésie et théâtre" },
    { cle: "ballet", nom: "Ballet et danse de scène" },
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
