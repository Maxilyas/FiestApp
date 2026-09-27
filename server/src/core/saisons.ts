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
 * Le calendrier des soirées : la saison d'un jour. Une soirée se date à
 * l'horloge de la machine, que rien ne règle — pas même le banc des tests :
 * du 25 octobre au 1er novembre, du 20 au 26 décembre et du 30 décembre au
 * 2 janvier, chaque soirée close à deux dans une épreuve ouvrait donc son
 * légendaire de saison, et celles qui comptent ce qui tombe à la clôture
 * (`cloture.test.ts`, `soiree.test.ts`) voyaient une Citrouille de trop : la
 * CI de toutes les PR rougissait dix-neuf jours par an. Le banc et le smoke
 * le ferment, comme ils neutralisent l'Éclat (`ProfileStore.tirageEclat`) ;
 * `saisons.test.ts`, qui date ses soirées lui-même, le rouvre.
 */
export const calendrierDesSoirees: { periodeDu: typeof periodeDu } = { periodeDu }

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
  const periode = calendrierDesSoirees.periodeDu(jourDe(premiere))
  if (!periode) return []
  const s = periode.saison
  return gains
    .filter(g => soireeQuiCompte(g.gain))
    .map(g => ({ profileId: g.profileId, badge: cleDeSaison(s), emoji: s.emoji, title: `Saison : ${s.nom}` }))
}
