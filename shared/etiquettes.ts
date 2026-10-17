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
  // le dit déjà —, ni la Belgique, la Suisse ou le Québec : la francophonie.
  {
    famille: "Les pays",
    regle:
      "la question parle de ce pays : ses villes et ses paysages, son histoire (l'antique comprise), ses dirigeants, sa cuisine, ses traditions, ses sports — ou de ce qui en vient quand elle le dit (« écrivain japonais ») ou que le pays est la réponse. Pas sa mythologie, ni sa langue seule, ni ce qui s'y passe par hasard (un film américain tourné à Rome)",
    etiquettes: [
      { cle: "allemagne", nom: "Allemagne", definition: "" },
      { cle: "australie", nom: "Australie", definition: "" },
      { cle: "chine", nom: "Chine", definition: "" },
      { cle: "espagne", nom: "Espagne", definition: "" },
      { cle: "etats-unis", nom: "États-Unis", definition: "" },
      { cle: "grece", nom: "Grèce", definition: "" },
      { cle: "italie", nom: "Italie", definition: "" },
      { cle: "japon", nom: "Japon", definition: "" },
      { cle: "pays-nordiques", nom: "Pays nordiques (Suède, Norvège, Danemark, Finlande, Islande)", definition: "" },
      { cle: "royaume-uni", nom: "Royaume-Uni", definition: "" },
      { cle: "russie", nom: "Russie", definition: "" },
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
