/**
 * Un calcul en tranches : un générateur qui cède (`yield`) entre deux tranches
 * et rend son résultat à la fin.
 *
 * Au dixième de cœur de l'hébergeur, le processeur arrive par tranches de dix
 * millisecondes sur cent : un calcul d'une traite de vingt-cinq mille
 * questions — les familles de la mesure, la préparation d'un tirage, la série
 * de référence — y gelait la boucle une demi-seconde à deux secondes, et la
 * salle avec (le relevé des gels de la production, le 2 novembre 2026). Le
 * serveur mène donc ces calculs une tranche par tour de boucle quand personne
 * ne les attend d'un bloc (`enTranches`, `server/src/core/tourniquet.ts`), et
 * d'une traite là où un chemin synchrone en a besoin tout de suite
 * (`dUneTraite`) : un seul code pour les deux, le résultat ne dépend pas de la
 * façon de le mener.
 */
export type CalculEnTranches<T> = Generator<void, T, void>

/**
 * Combien de questions un calcul en tranches passe d'une traite : deux à trois
 * millisecondes sur un vrai cœur (le banc du 2 novembre 2026,
 * `retours/2026-11-02/reproductions/gels-rejoues.ts`), une dizaine au
 * processeur de l'hébergeur, trois fois plus lent — de quoi rester sous la
 * centaine de millisecondes de gel au dixième de cœur.
 */
export const QUESTIONS_D_UNE_TRANCHE = 2500

/** Le calcul d'une traite : un chemin synchrone qui ne peut pas attendre. */
export function dUneTraite<T>(calcul: CalculEnTranches<T>): T {
  for (;;) {
    const r = calcul.next()
    if (r.done) return r.value
  }
}
