// Le catalogue des métadonnées d'une question : ses sous-thèmes, une liste
// fermée par catégorie (`shared/sousThemes.ts`, à part : la feuille du choix
// les nomme sans télécharger le reste), et ses étiquettes, rangées en
// familles. Une seule source pour la consigne qu'on donne à une IA pour
// étiqueter la réserve (`server/src/core/etiquetage.ts`) et pour la relecture
// de ce qu'elle rend (`lireEtiquetage`) : une clé que la consigne ne propose
// pas est refusée.
//
// Les listes ont été essayées sur les questions du dépôt et sur des
// questions neuves (le 3 octobre 2026) : chaque sous-thème a ses questions,
// et une étiquette ne dit rien qu'un autre champ dise déjà.

import { CATEGORIES } from './categories'
import { tronquer } from './avatars'
import { SOUS_THEMES } from './sousThemes'

export { SOUS_THEMES, type SousTheme } from './sousThemes'

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
      { cle: "danse", nom: "La danse", definition: "une danse, un danseur ou un chorégraphe est au cœur d'une question rangée hors des sous-thèmes ballet, danses et bal (un film, une émission, un tableau, un peuple et sa danse)" },
      { cle: "sante", nom: "La santé", definition: "un soin, une maladie ou un métier de la santé est au cœur d'une question rangée hors des sous-thèmes corps, medecine et sante (un savant qui a soigné, une série d'hôpital, un médecin de roman)" },
      { cle: "francais", nom: "La langue française", definition: "la langue française elle-même est au cœur d'une question rangée hors du sous-thème francais : le sens d'une expression, d'un mot familier ou d'argot, le mot recommandé à la place d'un anglicisme, l'histoire du français (ouvrir le bal, le toubib, courriel, l'ordonnance de Villers-Cotterêts). Pas pour le vocabulaire d'un métier ou d'un art (émincer, crescendo), ni pour la seule origine d'un mot : etymologie le dit" },
      { cle: "anglais", nom: "La langue anglaise", definition: "le sens d'un mot ou d'une expression anglaise est au cœur d'une question rangée hors du sous-thème anglais (happy hour, black tie, love au tennis, LOL). Pas pour un sigle technique (USB, GPS), un titre de film ou de chanson, ni pour la seule origine d'un mot : etymologie le dit" },
      { cle: "espagnol", nom: "La langue espagnole", definition: "le sens d'un mot ou d'une expression espagnole est au cœur d'une question rangée hors du sous-thème espagnol (piña colada, paso doble, Feliz Navidad). Pas pour un titre de film ou de chanson, ni pour la seule origine d'un mot : etymologie le dit" },
      // Le 17 octobre 2026, au soir : trois fils rouges de plus, posés sur la base question par question.
      { cle: "paris", nom: "Paris", definition: "Paris est au cœur de la question — ses monuments, ses musées, ses quartiers, son histoire, ses institutions, ses clubs et ses grands rendez-vous —, ou Paris est la réponse. Pas ce qui s'y passe par hasard (un roman qui s'y déroule, un tableau conservé au Louvre, un traité signé à Paris), ni un nom qui le contient (le Paris-Brest)" },
      { cle: "rois-de-france", nom: "Les rois et reines de France", definition: "un roi ou une reine de France, des Mérovingiens à Louis-Philippe, est au cœur de la question — son règne, sa cour, ses favorites, ses grands ministres, ses châteaux royaux —, ou il est la réponse. Pas les empereurs (Napoléon), ni les rois d'ailleurs, ni un roi cité pour dater autre chose" },
      { cle: "mer", nom: "La mer et les marins", definition: "les navires et la navigation, les marins et les navigateurs, les pirates et les corsaires, les batailles navales, les naufrages, les phares et les ports, la voile et les courses au large. Pas la faune marine (animaux), ni la seule géographie des mers et des océans" },
      // Puis six de plus, dont les dinosaures, partis des animaux pour leur thème : leur étiquette les porte hors de leur sous-thème.
      { cle: "revolution-empire", nom: "La Révolution et l'Empire", definition: "la Révolution française ou le Premier Empire (1789-1815) est au cœur de la question — ses journées, ses figures, ses lois, Napoléon et ses batailles —, ou l'un d'eux est la réponse. Pas Napoléon III, ni les autres révolutions" },
      { cle: "presidents", nom: "Les présidents de la République", definition: "un président de la République française est au cœur de la question — son élection, son mandat, ses mots, l'Élysée —, ou il est la réponse. Pas les présidents d'autres pays, ni un lieu qui porte son nom (l'aéroport Charles-de-Gaulle)" },
      { cle: "aviation", nom: "L'aviation", definition: "les avions et les hélicoptères, les pionniers et les pilotes, les compagnies et les aéroports, les records et les accidents d'avion. Pas l'espace et les fusées (astronomie), ni un avion qui n'est qu'un décor" },
      { cle: "polar", nom: "Le polar et les détectives", definition: "le roman policier et ses enquêteurs, de livre, de film ou de série (Sherlock Holmes, Poirot, Maigret, Columbo), leurs auteurs et leurs énigmes. Pas les vraies affaires criminelles (mysteres), ni les espions" },
      { cle: "marques", nom: "Les marques", definition: "une marque ou une entreprise célèbre est au cœur de la question — son logo, son slogan, son fondateur, l'origine de son nom, ses produits phares —, ou une marque est la réponse. Pas un club de sport ni un média, ni une marque qui n'est qu'un décor" },
      { cle: "dinosaures", nom: "Les dinosaures", definition: "un dinosaure ou une espèce disparue (le mammouth, le dodo) est au cœur d'une question rangée hors du sous-thème disparus (un film, un nom, une expression)" },
      // Le 1er novembre 2026, à la demande du propriétaire : posée sur la base question par question, comme les autres.
      { cle: "seconde-guerre-mondiale", nom: "La Seconde Guerre mondiale", definition: "la guerre de 1939-1945 est au cœur de la question — ses batailles, ses chefs, la Résistance et la collaboration, l'Occupation et la vie quotidienne, la Shoah, la Libération —, ou ce qu'elle a laissé : un film, un livre, une chanson, un lieu de mémoire qui la racontent. Pas une question où elle n'est qu'une date (« né en 1942 »), ni l'après-guerre" },
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
  // Les pays (le 17 octobre 2026, « apporter beaucoup de choix ») : chacun
  // un sujet de la campagne (`shared/sujets.ts`). Pas la France — sa portée
  // le dit déjà —, ni la Belgique ou la Suisse : la francophonie. Le soir
  // même, le Canada, Québec compris, et deux continents, l'Afrique sans
  // l'Égypte et l'Amérique du Sud : un pays qui a son sujet n'entre pas dans
  // celui de son continent, deux sujets ne se recoupent pas.
  {
    famille: "Les pays",
    regle:
      "la question parle de ce pays : ses villes et ses paysages, son histoire (l'antique comprise), ses dirigeants, sa cuisine, ses traditions, ses sports — ou de ce qui en vient quand elle le dit (« écrivain japonais ») ou que le pays est la réponse. Pas sa mythologie, ni sa langue seule, ni ce qui s'y passe par hasard (un film américain tourné à Rome)",
    etiquettes: [
      { cle: "afrique", nom: "Afrique (tous ses pays, sauf l'Égypte, qui a la sienne)", definition: "" },
      { cle: "allemagne", nom: "Allemagne", definition: "" },
      { cle: "amerique-du-sud", nom: "Amérique du Sud (Brésil, Argentine, Chili, Pérou, Colombie… : ni le Mexique, ni les Caraïbes, ni la Guyane française)", definition: "" },
      { cle: "asie-du-sud-est", nom: "Asie du Sud-Est (Thaïlande, Viêt Nam, Cambodge, Indonésie, Philippines… : ni la Chine, ni l'Inde)", definition: "" },
      { cle: "australie", nom: "Australie", definition: "" },
      { cle: "autriche", nom: "Autriche", definition: "" },
      { cle: "canada", nom: "Canada (le Québec compris)", definition: "" },
      { cle: "chine", nom: "Chine", definition: "" },
      { cle: "coree", nom: "Corée (du Sud et du Nord)", definition: "" },
      { cle: "egypte", nom: "Égypte", definition: "" },
      { cle: "espagne", nom: "Espagne", definition: "" },
      { cle: "etats-unis", nom: "États-Unis", definition: "" },
      { cle: "grece", nom: "Grèce", definition: "" },
      { cle: "inde", nom: "Inde", definition: "" },
      { cle: "irlande", nom: "Irlande (l'île entière)", definition: "" },
      { cle: "italie", nom: "Italie", definition: "" },
      { cle: "japon", nom: "Japon", definition: "" },
      { cle: "mexique", nom: "Mexique", definition: "" },
      { cle: "pays-bas", nom: "Pays-Bas", definition: "" },
      { cle: "pays-nordiques", nom: "Pays nordiques (Suède, Norvège, Danemark, Finlande, Islande)", definition: "" },
      { cle: "pologne", nom: "Pologne", definition: "" },
      { cle: "portugal", nom: "Portugal", definition: "" },
      { cle: "royaume-uni", nom: "Royaume-Uni", definition: "" },
      { cle: "russie", nom: "Russie", definition: "" },
      { cle: "turquie", nom: "Turquie", definition: "" },
    ],
  },
  // Les univers (le même jour) : les sagas qui traversent les livres, les
  // films, les jeux et les chansons. Pas Astérix, Tintin, Nintendo ni
  // Pokémon : trois quarts et plus de leurs questions vivaient dans un thème
  // déjà là — la BD, les jeux vidéo —, et le propriétaire ne voulait plus de
  // thèmes qui se recoupent.
  {
    famille: "Les univers",
    etiquettes: [
      { cle: "disney", nom: "Disney et Pixar", definition: "leurs films, leurs personnages, leurs chansons et leurs parcs. Pas Star Wars ni Marvel, qui ont le leur, ni un conte avant que Disney ne l'adapte (Perrault, Grimm, Collodi)" },
      { cle: "harry-potter", nom: "Harry Potter", definition: "les livres de J. K. Rowling, leurs films et leurs suites, leurs personnages et leurs lieux (Poudlard)" },
      { cle: "james-bond", nom: "James Bond", definition: "les romans de Ian Fleming et les films de 007 : leurs acteurs dans le rôle, leurs chansons, leurs méchants, leurs gadgets" },
      { cle: "marvel", nom: "Marvel", definition: "ses super-héros en bande dessinée et au cinéma (les Avengers, Spider-Man, les X-Men). Pas DC (Batman, Superman), ni Thor le dieu nordique" },
      { cle: "seigneur-des-anneaux", nom: "Le Seigneur des anneaux", definition: "la Terre du Milieu de Tolkien — Le Hobbit compris — et ses films" },
      { cle: "star-wars", nom: "Star Wars", definition: "ses films, ses séries, ses personnages, ses planètes et ceux qui l'ont fait (George Lucas, la musique de John Williams pour la saga)" },
      // Le 1er novembre 2026, à la demande du propriétaire : une saga de fans,
      // écrite d'un bloc — la base n'en posait rien. La mythologie égyptienne
      // n'en est pas : Râ et Anubis restent aux mythes, sauf en Goa'uld.
      // Le même jour : deux séries de fans, leurs questions écrites pour elles.
      { cle: "kaamelott", nom: "Kaamelott", definition: "la série d'Alexandre Astier (2005-2009) et ses films (2021 et suivants) : ses personnages, ses répliques, ses acteurs, la quête du Graal telle qu'elle la raconte. Pas la légende arthurienne hors de la série" },
      { cle: "lost", nom: "Lost", definition: "la série « Lost : Les Disparus » (2004-2010) : ses personnages, l'île, ses mystères, ses acteurs et ceux qui l'ont faite. Pas un autre « lost » (Lost in Translation, Lost River)" },
      { cle: "stargate", nom: "Stargate", definition: "le film de 1994, les séries SG-1, Atlantis et Universe, leurs téléfilms, leurs personnages, leurs races et leurs planètes, ceux qui les jouent et les font. Pas les dieux égyptiens ni l'Atlantide des mythes, hors de la saga" },
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
