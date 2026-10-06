import { cleDuJour, type ProfileStore } from '../auth/profiles'
import type { CampagneStore } from './campagne'
import type { JourStore } from './jour'

/**
 * Le barème du solo.
 *
 * Le quiz du jour est ce qu'on joue le plus, puis la campagne ; les soirées
 * sont rares. L'expérience, réglée sur les soirées, laissait celui qui ne
 * faisait que le quiz du jour à une quarantaine de points par jour — vingt-
 * cinq parties pour un seul niveau, au niveau 10 —, et les hauts faits du
 * jour et de la campagne ne payaient rien. Le propriétaire l'a voulu « bien
 * plus généreux » le 6 octobre 2026, pour que ça avance vite en solo (un
 * système de niveaux plus dur, avec ses récompenses, viendra plus tard) :
 *
 * · le quiz du jour paie jusqu'à 200 (`XP_MAX_DU_JOUR`), son podium 75, 45 et
 *   30, et chaque partie commencée jusqu'à 100 de bonus de série
 *   (`xpDeSerie`) ;
 * · une bonne réponse de campagne paie 5, et 10 parmi les vingt premières du
 *   jour (`xpDuJourDeCampagne`) ; un palier de sentier validé en jouant paie
 *   50, 100 s'il ouvre un portrait, 250 pour le maître (`xpDuPalier`) ;
 * · les hauts faits du quiz du jour et de la campagne paient (`xp`), et les
 *   paliers de carrière 50, 100 et 200 (`XP_PALIER`).
 *
 * Tout ce qui s'est déjà joué se recompte à ce barème, une fois, au premier
 * démarrage qui le connaît (`DRAPEAU`) : les parties et les podiums du jour,
 * les lignes de la campagne et des paliers, relus des journaux. Puis les
 * niveaux gelés de l'ancienne courbe se rattrapent
 * (`rattraperLesNiveauxGeles`), et La Légende tombe chez ceux que le barème
 * vient de faire monter. Interrompu, il se rejoue en entier au démarrage
 * suivant : chaque étape se relit des journaux, et écrit la même chose. Une
 * base neuve n'a rien d'avant : le drapeau s'y pose sans rien parcourir.
 */
export const DRAPEAU = 'bareme-du-solo-2026-10-06'

export async function appliquerLeBaremeDuSolo(
  deps: { profiles: ProfileStore; jour: JourStore; campagne: CampagneStore },
  baseNeuve: boolean,
): Promise<{ jour: number; campagne: number; paliers: number; rattrapes: number; legendes: number } | null> {
  if (await deps.profiles.drapeau(DRAPEAU)) return null
  const issue = { jour: 0, campagne: 0, paliers: 0, rattrapes: 0, legendes: 0 }
  if (!baseNeuve) {
    const touches = new Set<string>()
    const noter = (ids: readonly string[]) => {
      for (const id of ids) touches.add(id)
      return ids.length
    }
    issue.jour = noter(await deps.jour.revaloriser())
    issue.campagne = noter(await deps.campagne.revaloriser())
    issue.paliers = noter(await deps.profiles.revaloriserLesPaliers())
    // Après les autres : ce qui manque au niveau gardé se compte sur le total
    // revalorisé, pas sur celui d'avant.
    issue.rattrapes = noter(await deps.profiles.rattraperLesNiveauxGeles())
    const sous = cleDuJour(deps.jour.aujourdhui())
    for (const id of touches) issue.legendes += (await deps.profiles.accorderLaLegende(id, sous)).length
  }
  await deps.profiles.poserDrapeau(DRAPEAU)
  return issue
}
