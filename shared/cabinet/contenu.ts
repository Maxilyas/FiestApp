// Le contenu neuf du Cabinet, ce que la base de la campagne n'a pas : les
// lieux datés de l'Épingle, les fiches « Qui suis-je ? » des Indices, les
// répliques, les frises à thème. Écrit et relu par des agents, rangé dans
// `server/content/cabinet/` — hors de `client/public`, puisque chaque entrée
// porte sa réponse (invariant 1) —, une entrée par ligne, chacune passée à son
// juge au chargement du serveur.
//
// Ici, la forme d'une entrée et ses bornes : le juge du serveur et le script
// qui range les lots écrits les lisent, sans les recopier. Un identifiant de
// contenu s'écrit en `[a-z0-9-]`, sans deux-points : le code pose le préfixe
// (`PREFIXE_DU_CABINET`, `shared/cabinet/pieces.ts`).

import type { Categorie } from '../categories'

/** Un lieu de l'Épingle : un récit, une question « Où ? », et la réponse — ses coordonnées, sa commune, son département. */
export interface Lieu {
  id: string
  /** « Les grands sièges » : une partie joue trois lieux d'un même thème. */
  theme: string
  /** « L'Hôtel-Dieu de Beaune » : il peut se dire dans le récit et dans la question. */
  nom: string
  /** La commune et le département : jamais dans le récit ni dans la question — ils seraient la réponse. */
  commune: string
  departement: string
  lat: number
  lon: number
  /** L'année, pour les murs et la frise personnelle (« 52 av. J.-C. » vaut −52). */
  annee: number
  /** La date telle qu'elle se dit à l'écran : « 1443 », « 52 av. J.-C. ». */
  date: string
  recit: string
  question: string
  /** « Le savais-tu ? » de la révélation. */
  savais: string
  categorie: Categorie
}

/** Une fiche des Indices : cinq indices, du plus obscur au plus évident, et la réponse. */
export interface Fiche {
  id: string
  /** « Jules César », dit à la révélation. */
  reponse: string
  /** Les mots qu'une réponse doit contenir, l'un au moins — `cesar` : sans eux, « un roi » trouverait tout le monde. */
  cles: readonly string[]
  indices: readonly string[]
  savais: string
  categorie: Categorie
}

/** Une réplique : le mot qui manque, puis qui l'a dite. */
export interface Replique {
  id: string
  /** Ce qui précède le trou, puis ce qui le suit : « Tu me fends le » … « ! ». */
  avant: string
  mot: string
  apres: string
  /** Trois mots qui pourraient aller dans le trou, et ne sont pas le bon. */
  leurres: readonly string[]
  qui: string
  /** Deux autres personnes, plausibles. */
  autres: readonly string[]
  /** « Marius, 1931 (César, pendant la partie de cartes) ». */
  source: string
  savais: string
  categorie: Categorie
}

/** Un événement d'une frise à thème : il ne dit jamais quand (`refusDuLibelle`, `shared/frise.ts`). */
export interface EvenementDUneFriseATheme {
  libelle: string
  annee: number
}

/** Une frise à thème : sept événements à ranger en trois vagues, autour d'un thème. */
export interface FriseATheme {
  id: string
  /** « L'aviation ». */
  theme: string
  evenements: readonly EvenementDUneFriseATheme[]
  savais: string
  categorie: Categorie
}

// ── Les bornes, que le juge du serveur applique à chaque entrée ───────────
// En 360 pixels, chrono en marche : ce qui dépasse ne se lit plus à temps.

/** Le récit d'un lieu, sa question, et « Le savais-tu ? », en signes. */
export const RECIT_MAX = 200
export const QUESTION_MAX = 80
export const SAVAIS_MAX = 180
/** Les indices d'une fiche, et la longueur de chacun. */
export const INDICES_D_UNE_FICHE = 5
export const INDICE_MAX = 110
/** Les clés d'une fiche : une à trois, en minuscules sans accents, de trois lettres au moins (`arc` en est une). */
export const CLES_MAX = 3
export const FORME_D_UNE_CLE = /^[a-z]{3,}$/
/** Une réplique se lit d'un coup : tant de mots au plus, trou compris. */
export const MOTS_D_UNE_REPLIQUE_MAX = 15
export const LEURRES_D_UNE_REPLIQUE = 3
export const AUTRES_D_UNE_REPLIQUE = 2
/** Les événements d'une frise à thème : autant que ses trois vagues en posent (`VAGUES_DE_LA_FRISE`). */
export const EVENEMENTS_D_UNE_FRISE_A_THEME = 7
/** Ce qu'un identifiant de contenu peut être : le code pose `cab:` devant. */
export const FORME_D_UN_IDENTIFIANT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
