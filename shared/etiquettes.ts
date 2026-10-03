// Le catalogue des métadonnées d'une question : ses sous-thèmes, une liste
// fermée par catégorie, et ses étiquettes, rangées en familles. Une seule
// source pour la consigne qu'on donne à une IA pour étiqueter la réserve
// (`server/src/core/etiquetage.ts`) et pour la relecture de ce qu'elle rend
// (`lireEtiquetage`) : une clé que la consigne ne propose pas est refusée.
//
// Les listes ont été essayées sur les questions du dépôt et sur des
// questions neuves (le 3 octobre 2026) : chaque sous-thème a ses questions,
// et une étiquette ne dit rien qu'un autre champ dise déjà.

import { CATEGORIES } from './categories'
import { tronquer } from './avatars'

export interface SousTheme {
  cle: string
  nom: string
}

/** Les sous-thèmes de chaque catégorie : une clé n'existe que dans la sienne. */
export const SOUS_THEMES: Record<(typeof CATEGORIES)[number], readonly SousTheme[]> = {
  "Culture générale": [
    { cle: "langue", nom: "Langues et écritures" },
    { cle: "symboles", nom: "Symboles et institutions" },
    { cle: "quotidien", nom: "Objets et vie quotidienne" },
    { cle: "transports", nom: "Transports" },
    { cle: "mythes", nom: "Mythes et religions" },
    { cle: "societe", nom: "Société, métiers et argent" },
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
    { cle: "corps", nom: "Corps humain et santé" },
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
    { cle: "ecrans", nom: "Musiques de films et comédies musicales" },
    { cle: "instruments", nom: "Instruments et théorie" },
  ],
  "Arts & lettres": [
    { cle: "litterature-fr", nom: "Littérature française" },
    { cle: "litterature-monde", nom: "Littérature du monde" },
    { cle: "poesie-theatre", nom: "Poésie et théâtre" },
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
    { cle: "cocktails", nom: "Cocktails et apéritifs" },
  ],
}

export interface Etiquette {
  cle: string
  nom: string
  /** Ce qu'elle veut dire, à la lettre — et ce qu'elle ne veut pas dire. Vide : la règle de sa famille vaut. */
  definition: string
}

export interface FamilleDEtiquettes {
  famille: string
  /** Une phrase pour toute la famille, quand ses étiquettes n'ont pas chacune la leur (le calendrier). */
  regle?: string
  etiquettes: readonly Etiquette[]
}

export const ETIQUETTES: readonly FamilleDEtiquettes[] = [
  {
    famille: "Ce que la question a de particulier",
    etiquettes: [
      { cle: "piege", nom: "Piège", definition: "une mauvaise réponse attire beaucoup de monde parce qu'elle semble évidente (Sydney pour l'Australie). Pas un piège : une question seulement difficile" },
      { cle: "idee-recue", nom: "Idée reçue", definition: "la question dément une croyance répandue (les chauves-souris aveugles). Pas une idée reçue : un fait surprenant que personne ne croyait faux (les flamants naissent gris : insolite)" },
      { cle: "insolite", nom: "Insolite", definition: "un fait surprenant, qu'on a envie de raconter. Pas insolite : un fait scolaire (la capitale de l'Italie)" },
      { cle: "record", nom: "Record", definition: "la question demande un superlatif : le plus grand, le plus rapide, le plus ancien. Pas un record : une mesure réglementaire (la longueur d'un marathon), un lieu célèbre, un nombre" },
      { cle: "premiere", nom: "Une première", definition: "la question porte sur la première fois qu'une chose a eu lieu (le premier pas sur la Lune). Pas une première : une inauguration, la sortie d'un produit, le premier modèle d'une gamme" },
      { cle: "citation", nom: "Citation", definition: "la question cite une phrase et demande qui l'a dite, écrite ou chantée" },
      { cle: "surnom", nom: "Surnom", definition: "la question donne un surnom et demande ce qu'il désigne (la Ville Lumière). Pas un surnom : un emblème (le coq), un nom officiel" },
      { cle: "etymologie", nom: "Origine du mot", definition: "la question porte sur l'origine d'un mot ou d'un nom" },
      { cle: "calcul", nom: "Calcul", definition: "il faut faire une opération pour répondre (7 × 8, les secondes d'une journée)" },
    ],
  },
  {
    famille: "Les fils rouges",
    etiquettes: [
      { cle: "femmes", nom: "Pionnières", definition: "une femme qui a marqué son domaine est au cœur de la question" },
      { cle: "enfance", nom: "Souvenirs d’enfance", definition: "dessins animés, jouets, contes, goûters, émissions pour enfants" },
      { cle: "contes-legendes", nom: "Contes et légendes", definition: "contes, légendes, créatures fabuleuses" },
      { cle: "mysteres", nom: "Mystères", definition: "énigmes, disparitions, affaires jamais résolues" },
      { cle: "tresors", nom: "Trésors et vols célèbres", definition: "objets précieux, trésors, casses, faussaires" },
      { cle: "animaux", nom: "Un animal", definition: "un animal est au cœur d'une question qui n'est pas de la catégorie Nature (mascotte, film, expression)" },
      { cle: "invention", nom: "Invention", definition: "qui a inventé quoi, hors de la catégorie Sciences (le sandwich, le Rubik's Cube)" },
      { cle: "outre-mer", nom: "Outre-mer", definition: "les territoires d'outre-mer, leur musique, leur cuisine, leur histoire" },
    ],
  },
  {
    famille: "Prudence",
    etiquettes: [
      { cle: "alcool", nom: "Alcool", definition: "la question parle d'une boisson alcoolisée" },
      { cle: "sexualite", nom: "Sexualité", definition: "la question touche à la sexualité" },
      { cle: "violence", nom: "Violence", definition: "guerres racontées crûment, crimes, faits divers sanglants" },
      { cle: "politique", nom: "Politique actuelle", definition: "partis, élus et débats d'aujourd'hui" },
      { cle: "religion", nom: "Croyances", definition: "ce qui touche à une foi vivante (la mythologie n'en est pas)" },
      { cle: "divulgache", nom: "Divulgâche", definition: "la question révèle la fin d'un film, d'une série, d'un livre" },
    ],
  },
  {
    famille: "Le calendrier",
    regle: "la question nomme cette fête, cette saison ou cet événement, quelle que soit sa catégorie (un bonhomme de neige ne suffit pas pour hiver)",
    etiquettes: [
      { cle: "noel", nom: "Noël", definition: "" },
      { cle: "nouvel-an", nom: "Nouvel An", definition: "" },
      { cle: "saint-valentin", nom: "Saint-Valentin", definition: "" },
      { cle: "paques", nom: "Pâques", definition: "" },
      { cle: "fete-nationale", nom: "14 Juillet", definition: "" },
      { cle: "halloween", nom: "Halloween", definition: "" },
      { cle: "ete", nom: "Été et vacances", definition: "" },
      { cle: "hiver", nom: "Hiver et neige", definition: "" },
      { cle: "rentree", nom: "Rentrée", definition: "" },
      { cle: "coupe-du-monde", nom: "Coupe du monde", definition: "" },
      { cle: "jeux-olympiques", nom: "Jeux olympiques", definition: "" },
      { cle: "tour-de-france", nom: "Tour de France", definition: "" },
      { cle: "eurovision", nom: "Eurovision", definition: "" },
      { cle: "cannes", nom: "Festival de Cannes", definition: "" },
    ],
  },
]
/** Les types d'une entité — ce dont parle la question —, pour la retrouver dans Wikidata. */
export const TYPES_D_ENTITE = ['personne', 'personnage', 'lieu', 'oeuvre', 'organisation', 'groupe', 'espece', 'evenement', 'objet', 'notion'] as const

/** Les raisons de faire relire une question par un humain. */
export const A_RELIRE = ['plusieurs-bonnes-reponses', 'fait-douteux', 'fait-perime', 'leurre-juste', 'formulation-ambigue', 'anecdote-douteuse', 'sensible'] as const

/** Ce qui écarte une question de la base : elle se répond sur sa photo, dépend des présents, ou n'a pas de bonne réponse. */
export const HORS_BASE = ['support', 'personnes', 'sans-reponse'] as const

export const AGES = [6, 10, 14, 18] as const
export const PORTEES = ['france', 'francophonie', 'monde'] as const
const PRECISIONS = ['jour', 'mois', 'annee', 'decennie', 'siecle'] as const
const SITES = ['wikipedia-fr', 'wikipedia-en', 'wikidata'] as const

/** L'explication d'une réponse : une phrase. */
export const MAX_EXPLICATION = 200

export interface MetadonneesDeQuestion {
  categorie: string
  sousTheme: string
  etiquettes: string[]
  /** De 1 (presque tout le monde trouve) à 5 (moins que le hasard) : l'estimation de l'IA, avant la mesure des joueurs. */
  difficulte: number
  ageMin: (typeof AGES)[number]
  date: { valeur: string; precision: (typeof PRECISIONS)[number] } | null
  entites: { nom: string; type: (typeof TYPES_D_ENTITE)[number]; description: string }[]
  portee: (typeof PORTEES)[number]
  valeur: { nombre: number; unite: string } | null
  leurres: string[]
  dureeDeVie: 'stable' | { revoirLe: string }
  explication: string
  source: { titre: string; site: (typeof SITES)[number] } | null
  confiance: 1 | 2 | 3
  aRelire: string[]
}

const PRUDENCE = new Set(ETIQUETTES.find(f => f.famille === 'Prudence')?.etiquettes.map(e => e.cle) ?? [])
const TOUTES = new Set(ETIQUETTES.flatMap(f => f.etiquettes.map(e => e.cle)))

/** Un texte borné — par `tronquer`, qui ne coupe pas un emoji en deux. */
const texte = (x: unknown, max: number) => (typeof x === 'string' ? tronquer(x.trim(), max) : '')
const parmi = <T extends string | number>(liste: readonly T[], x: unknown): T | null => (liste.includes(x as T) ? (x as T) : null)

/**
 * Relit ce qu'une IA rend pour une question : une entrée de la consigne
 * d'étiquetage. Une clé que le catalogue ne connaît pas — un sous-thème
 * d'une autre catégorie, une étiquette inventée — refuse l'entrée entière,
 * comme la consigne l'annonce : mieux vaut une question sans métadonnées
 * que des métadonnées fausses. Les champs libres sont bornés, les règles de
 * prudence appliquées (alcool et sexualité : 18 ans ; violence : 14 ; toute
 * prudence : « sensible » à relire).
 */
export function lireEtiquetage(brut: unknown): { meta: MetadonneesDeQuestion } | { horsBase: (typeof HORS_BASE)[number] } | { refus: string } {
  if (!brut || typeof brut !== 'object') return { refus: 'pas un objet' }
  const b = brut as Record<string, unknown>
  const aRelireBrut = Array.isArray(b.aRelire) ? b.aRelire : []
  if (aRelireBrut.includes('hors-base')) {
    const raison = parmi(HORS_BASE, b.raison)
    return raison ? { horsBase: raison } : { refus: 'hors-base sans raison connue' }
  }
  const categorie = parmi(CATEGORIES, b.categorie)
  if (!categorie) return { refus: `catégorie inconnue : ${String(b.categorie)}` }
  const sousTheme = SOUS_THEMES[categorie].find(s => s.cle === b.sousTheme)?.cle
  if (!sousTheme) return { refus: `sous-thème « ${String(b.sousTheme)} » hors de ${categorie}` }
  const etiquettes = Array.isArray(b.etiquettes) ? [...new Set(b.etiquettes)] : []
  const inconnue = etiquettes.find(e => typeof e !== 'string' || !TOUTES.has(e))
  if (inconnue !== undefined) return { refus: `étiquette inconnue : ${String(inconnue)}` }
  if (etiquettes.length > 3) return { refus: 'plus de trois étiquettes' }
  const difficulte = Number(b.difficulte)
  if (!Number.isInteger(difficulte) || difficulte < 1 || difficulte > 5) return { refus: 'difficulté hors de 1 à 5' }
  let ageMin = parmi(AGES, b.ageMin)
  if (ageMin === null) return { refus: 'âge minimum hors de 6, 10, 14, 18' }
  const portee = parmi(PORTEES, b.portee)
  if (!portee) return { refus: 'portée inconnue' }
  const confiance = parmi([1, 2, 3] as const, b.confiance)
  if (confiance === null) return { refus: 'confiance hors de 1 à 3' }
  const raisons = aRelireBrut.filter((r): r is string => typeof r === 'string' && (A_RELIRE as readonly string[]).includes(r))
  // Les règles de prudence, appliquées plutôt que refusées : l'IA les oublie parfois, la règle ne change pas.
  if (etiquettes.includes('alcool') || etiquettes.includes('sexualite')) ageMin = 18
  else if (etiquettes.includes('violence') && ageMin < 14) ageMin = 14
  if (etiquettes.some(e => PRUDENCE.has(e as string)) && !raisons.includes('sensible')) raisons.push('sensible')

  const d = b.date as Record<string, unknown> | null
  const date =
    d && typeof d === 'object' && typeof d.valeur === 'string' && /^-?\d{1,4}(-\d{2}(-\d{2})?)?$/.test(d.valeur) && parmi(PRECISIONS, d.precision)
      ? { valeur: d.valeur, precision: parmi(PRECISIONS, d.precision)! }
      : null
  const entites = (Array.isArray(b.entites) ? b.entites : [])
    .map(e => e as Record<string, unknown>)
    .filter(e => e && typeof e === 'object' && texte(e.nom, 120) && parmi(TYPES_D_ENTITE, e.type))
    .slice(0, 3)
    .map(e => ({ nom: texte(e.nom, 120), type: parmi(TYPES_D_ENTITE, e.type)!, description: texte(e.description, 120) }))
  const v = b.valeur as Record<string, unknown> | null
  const valeur = v && typeof v === 'object' && Number.isFinite(Number(v.nombre)) ? { nombre: Number(v.nombre), unite: texte(v.unite, 30) } : null
  const leurres = (Array.isArray(b.leurres) ? b.leurres : []).map(l => texte(l, 120)).filter(Boolean).slice(0, 8)
  const dv = b.dureeDeVie as Record<string, unknown> | string
  const dureeDeVie: MetadonneesDeQuestion['dureeDeVie'] =
    dv && typeof dv === 'object' && typeof dv.revoirLe === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dv.revoirLe) ? { revoirLe: dv.revoirLe } : 'stable'
  const s = b.source as Record<string, unknown> | null
  const source = s && typeof s === 'object' && texte(s.titre, 200) && parmi(SITES, s.site) ? { titre: texte(s.titre, 200), site: parmi(SITES, s.site)! } : null
  return {
    meta: {
      categorie,
      sousTheme,
      etiquettes: etiquettes as string[],
      difficulte,
      ageMin,
      date,
      entites,
      portee,
      valeur,
      leurres,
      dureeDeVie,
      explication: texte(b.explication, MAX_EXPLICATION),
      source,
      confiance,
      aRelire: raisons,
    },
  }
}
