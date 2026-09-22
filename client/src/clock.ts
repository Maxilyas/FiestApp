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
