// L'heure du serveur sur cet écran : l'écart mesuré à la connexion, et le
// `serverNow()` que lisent tous les chronomètres.
//
// Voir `shared/clock.ts` pour le pourquoi et le calcul.
import { bestSample, clockOffset, type ClockSample } from '../../shared/clock'

let kept: ClockSample | null = null
let offset = 0

/** L'heure du serveur, telle que cet écran la lit. */
export function serverNow(): number {
  return Date.now() + offset
}

/** L'écart retenu, en ms — pour l'afficher au besoin. */
export function clockDrift(): number {
  return offset
}

/** Prend une mesure en compte, si elle apprend quelque chose. */
export function applySample(sample: ClockSample) {
  kept = bestSample(kept, sample)
  offset = clockOffset(kept)
}

/**
 * Une nouvelle connexion : les mesures d'avant ne font plus autorité. On garde
 * l'écart connu — mieux vaut la dernière estimation que zéro pendant les
 * quelques centaines de millisecondes de la remesure — mais la prochaine
 * mesure s'imposera, quel qu'ait été son aller-retour.
 */
export function resetClock() {
  kept = null
}

/** Un aller-retour, à l'horloge de ce téléphone. */
export interface AllerRetour {
  sentAt: number
  receivedAt: number
}

/**
 * Quand le préchargement d'une adresse est parti et revenu — celui que le
 * serveur pose dans la page (`shared/depart.ts`) —, à l'horloge de ce
 * téléphone : le Resource Timing le garde, au nom de l'adresse, et
 * l'initiateur `link`. `null` s'il ne se lit pas.
 */
export function tempsDuPrechargement(
  adresse: string,
  perf: Pick<Performance, 'getEntriesByName' | 'timeOrigin'> = performance,
  base: string = window.location.href,
): AllerRetour | null {
  try {
    const entrees = perf.getEntriesByName(new URL(adresse, base).href, 'resource') as PerformanceResourceTiming[]
    const lien = entrees.filter(e => e.initiatorType === 'link').pop()
    if (!lien?.requestStart || !lien.responseStart) return null
    return { sentAt: perf.timeOrigin + lien.requestStart, receivedAt: perf.timeOrigin + lien.responseStart }
  } catch {
    return null
  }
}

/**
 * La mesure d'horloge que porte une réponse du serveur. Arrivée par son
 * `fetch`, son aller-retour se cerne autour de lui (`autour`). Préchargée
 * (`prechargee`), elle était déjà là quand le `fetch` l'a demandée : un
 * aller-retour de zéro, que `bestSample` aurait gardé pour le plus juste,
 * alors que l'heure qu'elle porte date de l'arrivée de la page — décalée
 * d'autant. Elle se lit donc dans le préchargement ; sans lui, pas de
 * mesure : la réponse suivante la fera.
 */
export function mesureDeLaReponse(
  reponse: { maintenant?: number; prechargee?: true },
  autour: AllerRetour,
  prechargement: () => AllerRetour | null,
): ClockSample | null {
  if (typeof reponse.maintenant !== 'number') return null
  const temps = reponse.prechargee ? prechargement() : autour
  return temps ? { serverTime: reponse.maintenant, ...temps } : null
}
