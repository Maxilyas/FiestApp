// Ce que le build a calculé de chaque question de la base de la campagne, une
// fois pour toutes, et qu'un réveil reprend au lieu de le refaire.
//
// Ses sujets, sa famille, ce que les trois cribles du Cabinet disent d'elle ne
// dépendent que d'elle et du code : le serveur empaqueté les relit avec la base
// vérifiée au build (`preparerLaBase`, `lireLaBasePreparee`). Refaits à chaque
// réveil de l'hébergeur, ils tenaient le dixième de cœur : les cribles du
// Cabinet, 50 à 110 ms par catégorie sur un vrai cœur — une seconde en tout,
// dix au dixième de cœur —, les sujets et les familles des vingt-sept mille
// questions derrière eux.
//
// Gardés par la question même (`WeakMap`) : une question corrigée au QG, un
// ajout de la routine sont des objets neufs, sans préparation — chaque lecteur
// les calcule alors comme avant (`sujetsDeLaQuestion`, `famillesEnTranches`,
// `verdictDe`). Ce module n'importe rien : la base, la campagne et le Cabinet
// le lisent sans se lire l'un l'autre.

/** Ce que le build a calculé d'une question (`preparationDeLaQuestion`, `core/preparationDeLaBase.ts`). */
export interface PreparationDUneQuestion {
  /** Ses sujets et sa rubrique (`sujetsEtRubriqueDe`). */
  sujets: readonly string[]
  /** Sa famille pour la mesure (`familleDeQuestion`) ; null hors des familles mesurées. */
  famille: string | null
  /** Les cribles du Cabinet (`verdictDe`) : 1, un QCM du Pari et de l'Éclair ; 2, un mot du Mot mystère ; 4, une valeur du Filet. */
  cabinet: number
}

const PREPAREES = new WeakMap<object, PreparationDUneQuestion>()

/** Ce que le build a calculé de cette question-là, s'il l'a fait. */
export const preparationDe = (q: object): PreparationDUneQuestion | undefined => PREPAREES.get(q)

/** La préparation d'une question relue avec la base (`lireLaBasePreparee`). */
export function retenirLaPreparation(q: object, p: PreparationDUneQuestion): void {
  PREPAREES.set(q, p)
}

/** Les trois cribles du Cabinet en un nombre (`PreparationDUneQuestion.cabinet`), et l'inverse. */
export const QCM_DU_CABINET = 1
export const MOT_DU_CABINET = 2
export const VALEUR_DU_CABINET = 4
