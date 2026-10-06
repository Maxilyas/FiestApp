// Les écussons de savoir : une catégorie maîtrisée, au bronze, à l'argent,
// à l'or.
//
// Ils comptent les bonnes réponses d'une catégorie dans tous les modes de
// jeu — en soirée, au quiz du jour, en campagne (séries, épreuves des
// sentiers, défi de la semaine) —, aux QCM seulement : une estimation n'est
// jamais « juste ». Jusqu'au 6 octobre 2026, la campagne n'y comptait pas :
// qui gravissait le sentier de la forêt jusqu'à son maître n'avait pas
// l'écusson de la Nature. C'est ce qu'on sait, pas ce qu'on a gagné : ils ne
// rapportent aucune expérience, et ne se perdent qu'avec les réponses qui
// les avaient faits (une soirée retirée de l'historique). Une dérivation
// pure de ce que chaque mode compte déjà : rien ne s'écrit.
//
// La carte en montre trois, les plus hauts ; la page du profil, les douze,
// avec ce qui manque au suivant.

import { CATEGORIES } from './categories'

/** Les bonnes réponses qu'il faut dans une catégorie : le bronze, l'argent, l'or. */
export const SEUILS_ECUSSON = [20, 75, 200] as const

export const NOM_ECUSSON = ['', 'Bronze', 'Argent', 'Or'] as const

export interface Ecusson {
  categorie: string
  /** Ses bonnes réponses dans la catégorie, tous modes de jeu ensemble. */
  justes: number
  /** 0 tant que le bronze n'est pas atteint ; 1, 2, 3 : bronze, argent, or. */
  palier: 0 | 1 | 2 | 3
}

/** Le palier que valent tant de bonnes réponses. */
export function palierEcusson(justes: number): 0 | 1 | 2 | 3 {
  return SEUILS_ECUSSON.filter(s => justes >= s).length as 0 | 1 | 2 | 3
}

/** Les bonnes réponses qu'il faut pour le palier suivant ; null à l'or. */
export function prochainSeuil(palier: 0 | 1 | 2 | 3): number | null {
  return palier < 3 ? SEUILS_ECUSSON[palier as 0 | 1 | 2] : null
}

/** Ses questions et ses bonnes réponses, catégorie par catégorie. */
export type ParCategorie = Record<string, { questions: number; justes: number }>

/**
 * Ses questions et ses bonnes réponses par catégorie, chaque mode de jeu
 * additionné — la carrière des soirées qui comptent (`Carriere.categories`),
 * le quiz du jour, la campagne : ce que « Ma carrière » montre catégorie
 * par catégorie, et ce qui fait ses écussons, sur sa page comme sur sa
 * carte. Une copie : la carrière qu'on a lue ne bouge pas.
 */
export function additionnerCategories(...sources: Readonly<ParCategorie>[]): ParCategorie {
  const total: ParCategorie = {}
  for (const source of sources) {
    for (const [categorie, { questions, justes }] of Object.entries(source)) {
      const t = (total[categorie] ??= { questions: 0, justes: 0 })
      t.questions += questions
      t.justes += justes
    }
  }
  return total
}

/**
 * Ce qu'un mode de jeu hors des soirées — le quiz du jour, la campagne —
 * sait de lui : ses questions et ses bonnes réponses par catégorie (ses
 * écussons, « Ma carrière »), et la base de sa précision : ses QCM
 * répondus, et justes, toutes ses questions comprises, classées ou non.
 */
export interface Savoir {
  categories: ParCategorie
  qcm: number
  justes: number
}

/** Les savoirs de plusieurs modes, additionnés. */
export function additionnerSavoirs(...savoirs: readonly Savoir[]): Savoir {
  return {
    categories: additionnerCategories(...savoirs.map(s => s.categories)),
    qcm: savoirs.reduce((n, s) => n + s.qcm, 0),
    justes: savoirs.reduce((n, s) => n + s.justes, 0),
  }
}

/**
 * Un savoir lu en base, une ligne par catégorie — celle des questions sans
 * catégorie comprise : elle ne fait aucun écusson, mais ses QCM comptent
 * pour la précision. `repondues` : ses QCM répondus — une question laissée
 * sans réponse est posée, pas ratée, comme en soirée.
 */
export function savoirDesLignes(lignes: readonly Record<string, unknown>[]): Savoir {
  const savoir: Savoir = { categories: {}, qcm: 0, justes: 0 }
  for (const r of lignes) {
    const justes = Number(r.justes ?? 0)
    savoir.qcm += Number(r.repondues ?? 0)
    savoir.justes += justes
    if (r.categorie != null) savoir.categories[String(r.categorie)] = { questions: Number(r.questions ?? 0), justes }
  }
  return savoir
}

/**
 * Ses bonnes réponses par catégorie, sources additionnées. Les écussons
 * comptent ici, et nulle part ailleurs. Les avatars des branches s'y
 * ouvraient aussi, sur les soirées et le quiz du jour, jusqu'aux sentiers du
 * savoir (`shared/sentiers.ts`) : la reprise l'a relu une dernière fois
 * (`core/repriseDesPortraits.ts`).
 */
export function justesParCategorie(...sources: Readonly<Record<string, { justes: number }>>[]): Record<string, number> {
  return Object.fromEntries(CATEGORIES.map(c => [c, sources.reduce((n, s) => n + (s[c]?.justes ?? 0), 0)]))
}

/**
 * Ses écussons, catégorie par catégorie, dans l'ordre de la liste fixe : les
 * bonnes réponses de chaque source s'additionnent — les soirées, le quiz du
 * jour, la campagne.
 */
export function ecussonsDe(...sources: Readonly<Record<string, { justes: number }>>[]): Ecusson[] {
  const justes = justesParCategorie(...sources)
  return CATEGORIES.map(categorie => ({ categorie, justes: justes[categorie], palier: palierEcusson(justes[categorie]) }))
}

/**
 * Les plus beaux, pour la carte : le plus haut palier d'abord, puis le plus
 * de bonnes réponses ; à égalité, l'ordre de la liste fixe. Un écusson qu'il
 * n'a pas ne s'y montre jamais.
 */
export function plusBeauxEcussons(ecussons: readonly Ecusson[], n = 3): Ecusson[] {
  const rang = (e: Ecusson) => (CATEGORIES as readonly string[]).indexOf(e.categorie)
  return ecussons
    .filter(e => e.palier > 0)
    .sort((a, b) => b.palier - a.palier || b.justes - a.justes || rang(a) - rang(b))
    .slice(0, n)
}
