// Les saisons d'une soirée : Halloween, Noël, le Nouvel An (`shared/saisons.ts`).
//
// Une soirée jouée pendant l'une d'elles ouvre son légendaire à chaque profil
// qui y a joué — une soirée qui compte, à deux au moins (`soireeQuiCompte`) :
// seul devant son téléphone, une question le soir d'Halloween suffisait
// sinon. Dérivation pure, lue à la clôture et au recalcul de l'historique :
// une soirée datée hors saison, ou retirée de l'historique, n'en range rien.

import { jourDe } from '../../../shared/jour'
import { soireeQuiCompte, type GainSoiree } from '../../../shared/profil'
import { cleDeSaison, periodeDu } from '../../../shared/saisons'
import type { PrixDeSoiree } from '../auth/profiles'

/**
 * Les récompenses de saison d'une soirée, profil par profil. Elle se date à
 * sa première question jouée, comme son nom (`soireeDesInvites`) : l'heure
 * de Paris, que le quiz du jour suit aussi.
 */
export function laureatsDeSaison(
  answers: readonly { answered: boolean; createdAt: number }[],
  gains: readonly { profileId: string; gain: GainSoiree }[],
): PrixDeSoiree[] {
  // Une boucle, pas `Math.min(...)` : le journal d'une grande soirée se
  // compte en dizaines de milliers de lignes.
  let premiere = Infinity
  for (const a of answers) if (a.answered && a.createdAt < premiere) premiere = a.createdAt
  if (premiere === Infinity) return []
  const periode = periodeDu(jourDe(premiere))
  if (!periode) return []
  const s = periode.saison
  return gains
    .filter(g => soireeQuiCompte(g.gain))
    .map(g => ({ profileId: g.profileId, badge: cleDeSaison(s), emoji: s.emoji, title: `Saison : ${s.nom}` }))
}
