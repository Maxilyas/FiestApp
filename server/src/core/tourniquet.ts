/**
 * Rendre la main à la boucle, une étape de fond à la fois.
 *
 * Les calculs de fond de la campagne rendaient déjà la main entre deux
 * tranches (`setImmediate`). Mais plusieurs qui attendent la même chose — la
 * base lue au réveil, une mesure neuve — repartent ensemble : leurs rappels,
 * posés pendant le même tour, passent tous dans la même phase, l'un derrière
 * l'autre, sans que la boucle lise rien entre deux. Au réveil, les index de
 * la base, ses familles, la préparation des tirages et la série de référence
 * faisaient ainsi un seul bloc de 130 ms ; un dé tombé sur une mesure
 * périmée, un de 70 — 1,3 s et 0,7 s de serveur figé au dixième de cœur de
 * l'hébergeur (le banc du gel, compilé comme en production, le 19 octobre
 * 2026).
 *
 * `rendreLaMain()` ne laisse repartir qu'une étape par tour de boucle, dans
 * l'ordre où elles l'ont demandé : les requêtes arrivées entre deux sont
 * lues, et le plus long gel n'est plus que la plus longue étape. Une étape
 * qui doit le rester se fait donc d'une traite après son tour, sans `await`
 * au milieu : c'est là qu'elle relit ce qu'une autre a pu faire pendant
 * qu'elle attendait.
 */

const enAttente: (() => void)[] = []
let tourPose = false

function tour(): void {
  const suivante = enAttente.shift()
  // Posé pendant ce tour, le suivant ne passe qu'au tour d'après : la boucle
  // lit ce qui est arrivé entre les deux.
  if (enAttente.length > 0) setImmediate(tour)
  else tourPose = false
  suivante?.()
}

export function rendreLaMain(): Promise<void> {
  return new Promise<void>(reprendre => {
    enAttente.push(reprendre)
    if (!tourPose) {
      tourPose = true
      setImmediate(tour)
    }
  })
}

/**
 * Ce que le serveur relit d'une traite avant de rendre la main, en questions
 * de la base : une dizaine de millisecondes — la lecture de la base
 * (`baseCampagne.ts`), les jumelles (`memeFait.ts`), les tas du Cabinet. Ici,
 * à côté du tourniquet, plutôt qu'avec la base : le Cabinet le lit sans tirer
 * ce qu'elle tire, le quiz du jour compris (`cabinet-catalogue.test.ts`).
 */
export const QUESTIONS_PAR_TRANCHE = 200
