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
import type { CalculEnTranches } from '../../../shared/tranches'

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
 * Un calcul en tranches (`CalculEnTranches`, `shared/tranches.ts`) mené en
 * fond : chaque tranche à son tour de boucle (`rendreLaMain`), la première
 * aussi. Les étapes lourdes de la campagne passaient chacune d'une traite —
 * les familles de la mesure, la préparation d'un tirage, la série de
 * référence, huit à trente millisecondes sur un vrai cœur — : au dixième de
 * cœur de l'hébergeur, le plus long gel restait la plus longue étape, une
 * demi-seconde à deux secondes en production (le 2 novembre 2026). Il n'est
 * plus que la plus longue tranche.
 */
export async function enTranches<T>(calcul: CalculEnTranches<T>): Promise<T> {
  for (;;) {
    await rendreLaMain()
    const r = calcul.next()
    if (r.done) return r.value
  }
}

/** Au plus, ce qu'une étape de fond attend la salle : une question laissée ouverte ne l'arrête pas pour la soirée. */
export const SALLE_ATTENDUE_MAX_MS = 3 * 60_000
/** Combien de fois par seconde elle regarde si la question est passée. */
const SALLE_REGARDEE_MS = 250

/**
 * Le travail que personne n'attend — le modèle du savoir refait en fond, les
 * tirages préparés derrière une mesure neuve — laisse passer une soirée : tant
 * qu'une question attend ses réponses (`enJeu`), il ne reprend pas. Au dixième
 * de cœur de l'hébergeur, il prenait le processeur dont la salle avait besoin
 * — 28,5 s pour le modèle refait au démarrage du 2 novembre 2026, 5,6 s pour
 * le suivant —, et la boucle qu'il fait tourner une tranche à la fois retarde
 * d'autant chaque réponse et le chronomètre de la question. Il reprend à la
 * révélation, et au plus tard au bout de `SALLE_ATTENDUE_MAX_MS`. Jamais sur le
 * chemin d'une requête : elle attendrait la fin de la question.
 */
export async function laisserPasserLaSalle(
  enJeu: (() => boolean) | undefined,
  arrete: () => boolean = () => false,
  /** La tâche qui attend, mise en pause le temps de la question : elle n'est d'aucun gel de la salle (`core/gels.ts`). */
  tache?: { suspendre(): void; reprendre(): void },
): Promise<void> {
  if (!enJeu || !enJeu()) return
  tache?.suspendre()
  try {
    const fin = Date.now() + SALLE_ATTENDUE_MAX_MS
    while (enJeu() && !arrete() && Date.now() < fin) await new Promise(r => setTimeout(r, SALLE_REGARDEE_MS))
  } finally {
    tache?.reprendre()
  }
}

/**
 * Ce que le serveur relit d'une traite avant de rendre la main, en questions
 * de la base — la lecture de la base (`baseCampagne.ts`), les jumelles
 * (`memeFait.ts`), les tas du Cabinet — : une à deux millisecondes sur un vrai
 * cœur. Deux cents jusqu'au 2 novembre 2026, une dizaine de millisecondes : au
 * banc bridé au dixième de cœur, la première préparation des tas du Cabinet
 * gelait la boucle jusqu'à 0,8 s, un calcul coupé par la bride coûtant
 * plusieurs fois son prix (`retours/2026-11-02/reproductions/gels-rejoues.ts`).
 * Ici, à côté du tourniquet, plutôt qu'avec la base : le Cabinet le lit sans
 * tirer ce qu'elle tire, le quiz du jour compris (`cabinet-catalogue.test.ts`).
 */
export const QUESTIONS_PAR_TRANCHE = 50
