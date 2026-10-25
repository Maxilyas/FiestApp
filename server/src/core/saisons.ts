// Les saisons côté serveur : Halloween, Noël, le Nouvel An (`shared/saisons.ts`),
// lues par trois modes — les soirées, les expéditions, le Cabinet de
// curiosités —, chacun par son calendrier : un test qui rouvre l'un ne doit
// pas rouvrir les autres.
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
 * le ferment, comme le smoke neutralise l'Éclat (`ProfileStore.tirageEclat`
 * — sous le banc, chaque fichier qui compte au point près le fait lui-même) ;
 * `saisons.test.ts`, qui date ses soirées lui-même, le rouvre.
 */
export const calendrierDesSoirees: { periodeDu: typeof periodeDu } = { periodeDu }

/**
 * Le calendrier des expéditions : la saison d'un départ, à l'heure de Paris
 * (le 18 octobre 2026) — sa fête plus souvent sur les cartes
 * (`PART_DE_LA_FETE`), son légendaire en gardien de l'acte 3. Le banc et le
 * smoke le ferment comme celui des soirées : du 25 octobre au 1er novembre,
 * chaque expédition des tests aurait mis la Citrouille au bout de l'acte 3.
 * `expedition-saison.test.ts` le rouvre.
 */
export const calendrierDesExpeditions: { periodeDu: typeof periodeDu } = { periodeDu }

/**
 * Le calendrier du Cabinet de curiosités : la saison d'une œuvre gagnée en
 * jouant, au jour de Paris du départ de sa partie — comme sa case et sa
 * poussière, même close à la page du lendemain —, et la première de la fête
 * réveille son gardien (la Citrouille, le Sapin, le Bouquet). Un achat ni une
 * dorure ne le lisent jamais. Le sien,
 * pas celui des expéditions : il survivra à leur départ fermé, et un test
 * qui rouvre l'un ne doit pas réveiller l'autre. Le banc et le smoke le
 * ferment avec les deux autres — Halloween commence le 25 octobre 2026, et
 * sans eux, chaque épreuve qui gagne une œuvre ces jours-là réveillerait la
 * Citrouille ; un test qui date ses parties lui-même le rouvre.
 */
export const calendrierDuCabinet: { periodeDu: typeof periodeDu } = { periodeDu }

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
