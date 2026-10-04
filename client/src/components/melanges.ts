import type { Niveau } from '../../../shared/campagne'
import type { Melange } from '../../../shared/sentiers'

/** L'initiale de chaque niveau : « 13 M · 3 D », pour les lignes serrées de l'administration. */
const INITIALE: Record<Niveau, string> = { facile: 'F', moyen: 'M', difficile: 'D', expert: 'E' }

/** « 13 M · 3 D » : le mélange d'un palier, en court. */
export function texteDuMelangeCourt(m: Melange): string {
  return (Object.entries(m) as [Niveau, number][])
    .filter(([, n]) => n > 0)
    .map(([niveau, n]) => `${n} ${INITIALE[niveau]}`)
    .join(' · ')
}
