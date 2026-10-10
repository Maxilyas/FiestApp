// Les chapitres des sentiers du savoir : les huit premiers paliers d'un
// sentier vont par deux, et chaque paire pose un thème nommé de sa catégorie
// — un ou deux sous-thèmes, rarement trois —, des plus courants aux plus
// pointus ; du neuvième palier au maître, toute la catégorie, comme avant.
// Le propriétaire voulait des sentiers « beaucoup plus orientés sur un thème
// précis », sans que la règle se complique (le 10 octobre 2026) : elle tient
// en une phrase — deux paliers, un thème, puis tout le savoir de la branche.
//
// Un chapitre change ce que le tirage préfère, jamais la difficulté : ses
// questions passent devant celles du reste de la catégorie, à la même marche
// (`tirerUneEpreuve`) ; quand le thème n'en a plus assez de fraîches, le
// reste de la catégorie complète, et la marche ne bouge pas. Chaque
// sous-thème de la catégorie sert dans un chapitre, une seule fois
// (`sentiers-chapitres.test.ts`).

import type { CleDeBranche } from './branches'

/** Deux paliers par chapitre : un palier qui entraîne, un palier à portrait. */
export const PALIERS_PAR_CHAPITRE = 2

/** Les chapitres à thème : les huit premiers paliers. Après, toute la catégorie (`TOUTE_LA_CATEGORIE_DES`). */
export const CHAPITRES_A_THEME = 4

export interface Chapitre {
  /** De 1 à 4. */
  numero: number
  /** Son nom, court : il s'écrit sur le chemin. */
  nom: string
  /** Ses sous-thèmes (`SOUS_THEMES` de la catégorie de la branche). */
  sousThemes: readonly string[]
  /** Ses deux paliers. */
  paliers: readonly [number, number]
}

/** Les quatre chapitres de chaque sentier, dans l'ordre où on les monte. */
const THEMES: Readonly<Record<CleDeBranche, readonly (readonly [string, readonly string[]])[]>> = {
  monde: [
    ['La vie de tous les jours', ['quotidien', 'transports']],
    ['Mots et symboles', ['langue', 'symboles']],
    ['Mythes et religions', ['mythes']],
    ['Chiffres, métiers et records', ['societe', 'mesures', 'records']],
  ],
  mythes: [
    ['Rois et grands personnages', ['pouvoirs', 'personnages']],
    ['Civilisations anciennes', ['civilisations']],
    ['Vie d’autrefois et explorations', ['vie-autrefois', 'explorations']],
    ['Guerres et grands événements', ['guerres', 'faits-divers']],
  ],
  oceans: [
    ['Capitales et villes', ['capitales']],
    ['Pays et drapeaux', ['pays', 'drapeaux']],
    ['Monuments et peuples', ['sites', 'peuples']],
    ['Fleuves, reliefs et régions', ['eaux', 'reliefs', 'france']],
  ],
  espace: [
    ['L’espace et la Terre', ['espace', 'terre']],
    ['Le corps humain', ['corps']],
    ['Savants et technologies', ['savants', 'techno']],
    ['Physique, chimie et maths', ['physique-chimie', 'maths']],
  ],
  foret: [
    ['Mammifères et oiseaux', ['mammiferes', 'oiseaux']],
    ['Plantes et petites bêtes', ['plantes', 'petites-betes']],
    ['La vie aquatique', ['aquatique']],
    ['Espèces disparues et écologie', ['disparus', 'ecologie']],
  ],
  ecran: [
    ['Sagas et animation', ['sagas', 'animation']],
    ['Le cinéma du monde', ['cinema-monde']],
    ['Séries et répliques cultes', ['series', 'repliques']],
    ['Cinéma français et récompenses', ['cinema-fr', 'coulisses']],
  ],
  scene: [
    ['Chanson française et pop', ['chanson-fr', 'pop-rock']],
    ['Instruments et musiques de films', ['instruments', 'ecrans']],
    ['Rap, jazz et musiques du monde', ['rap-electro', 'jazz-monde']],
    ['Classique et opéra', ['classique']],
  ],
  contes: [
    ['BD et peinture', ['bd', 'peinture']],
    ['Littérature, poésie et théâtre', ['litterature-fr', 'poesie-theatre']],
    ['Littérature du monde', ['litterature-monde']],
    ['Architecture et grandes idées', ['sculpture-archi', 'philo']],
  ],
  stade: [
    ['Football et rugby', ['football', 'rugby']],
    ['Jeux olympiques et tennis', ['olympisme', 'tennis']],
    ['Cyclisme et sports collectifs', ['cyclisme', 'equipes']],
    ['Moteurs, glisse et combat', ['mecaniques', 'glisse', 'combat']],
  ],
  brigade: [
    ['Spécialités françaises et desserts', ['france', 'desserts']],
    ['Cuisines du monde et ingrédients', ['monde', 'ingredients']],
    ['Techniques et vocabulaire', ['techniques']],
    ['Fromages, vins et grands chefs', ['terroir', 'boissons', 'chefs']],
  ],
  arcade: [
    ['Jouets et jeux de société', ['jouets', 'jeux-societe']],
    ['Les jeux vidéo', ['jeux-video']],
    ['Mode et célébrités', ['mode', 'celebrites']],
    ['Télé et internet', ['tele', 'internet']],
  ],
  carnaval: [
    ['Noël et Nouvel An', ['noel', 'nouvel-an']],
    ['Halloween et anniversaires', ['halloween', 'anniversaires']],
    ['Mariages et apéritifs', ['amour', 'cocktails']],
    ['Fêtes du monde', ['traditions']],
  ],
}

/** Les chapitres d'un sentier, du premier au quatrième. */
export function chapitresDe(branche: CleDeBranche): Chapitre[] {
  return (THEMES[branche] ?? []).map(([nom, sousThemes], i) => ({
    numero: i + 1,
    nom,
    sousThemes,
    paliers: [i * PALIERS_PAR_CHAPITRE + 1, (i + 1) * PALIERS_PAR_CHAPITRE] as const,
  }))
}

/** Le chapitre d'un palier ; null au-delà du huitième : toute la catégorie. */
export function chapitreDuPalier(branche: CleDeBranche, palier: number): Chapitre | null {
  if (!Number.isInteger(palier) || palier < 1) return null
  return chapitresDe(branche)[Math.ceil(palier / PALIERS_PAR_CHAPITRE) - 1] ?? null
}
