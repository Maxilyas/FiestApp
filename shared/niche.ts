// Les réactions de la niche à la révélation (le principe du compagnon, § 2,
// `retours/2026-10-16/compagnon/principe.md`) : ce que le compagnon fait quand
// la réponse se juge — jamais avant, le téléphone ne sait rien d'une réponse
// qu'on vient de toucher (invariant 1). Ravi d'une bonne réponse, qui le
// nourrit ; dépité avec toi d'une ratée, jamais déçu de toi ; une bulle de
// cœurs en plus quand peu l'ont trouvée. Le reste du temps, calme.
//
// Pur et sans catalogue : la page de la soirée l'importe, et l'invité
// anonyme, qui n'a pas de niche, ne doit rien télécharger de plus.
import type { QuizPlayerView } from './games/quiz'
import type { Niveau } from './campagne'
import { ecartEstimation } from './classement'

/**
 * La salle d'une question qui compte (`SEUILS.salleQuestion`, `shared/profil.ts`),
 * recopiée : importer le barème ferait télécharger le catalogue des
 * compagnons à chaque invité. `niche-reactions.test.ts` les compare.
 */
export const SALLE_QUI_COMPTE = 2

/** Ce qu'il fait à la révélation : ravi, dépité avec toi, ou rien. */
export type Verdict = 'juste' | 'ratee' | 'calme'

export interface ReactionALaRevelation {
  verdict: Verdict
  /** Peu l'ont trouvée : une bulle de cœurs, en plus. */
  rare: boolean
  /**
   * Elle le nourrit — elle compte pour sa croissance, comme le serveur la
   * compte (`ProfileStore.compagnonsDe`) : le « +1 » et sa jauge. Une bonne
   * réponse qui ne le fait pas grandir le rend ravi quand même.
   */
  nourri: boolean
}

/**
 * Une bonne réponse « rare » : le quart au plus de ceux qui ont répondu
 * l'ont trouvée, à quatre réponses au moins — à deux ou trois, être le seul
 * ne dit pas grand-chose. Rare, la bulle reste une surprise (« calme, rare,
 * de ton côté ») : un choix de produit (`docs/reference/baremes.md`).
 */
export const PART_RARE = 0.25
export const REPONSES_POUR_UNE_RARE = 4

export function bonneReponseRare(trouvees: number, repondues: number): boolean {
  return repondues >= REPONSES_POUR_UNE_RARE && trouvees > 0 && trouvees <= repondues * PART_RARE
}

/** Au quiz du jour, la part des joueurs du jour qui l'ont trouvée (`RevelationDuJour.trouveePar`, nulle sous trois joueurs). */
export function rareAuQuizDuJour(trouveePar: number | null | undefined): boolean {
  return trouveePar !== null && trouveePar !== undefined && trouveePar <= PART_RARE
}

/**
 * En campagne, personne ne joue la même question en même temps : une experte
 * — que les réponses de tous ont classée tout en haut (`niveauDeQuestion`) —
 * est celle que peu trouvent.
 */
export function rareEnCampagne(niveau: Niveau | undefined): boolean {
  return niveau === 'expert'
}

const CALME: ReactionALaRevelation = { verdict: 'calme', rare: false, nourri: false }

/**
 * Une réponse en solo — le quiz du jour, la campagne, les sentiers, un
 * parcours, l'expédition — : chacune nourrit son compagnon quand elle est
 * juste (leurs journaux le retiennent, règle `journaux-et-miroir.md`).
 * `juste` nul : sans réponse, trop tard, une question annulée — rien.
 */
export function reactionDuSolo(juste: boolean | null, rare = false): ReactionALaRevelation {
  if (juste === null) return CALME
  return juste ? { verdict: 'juste', rare, nourri: true } : { verdict: 'ratee', rare: false, nourri: false }
}

/**
 * La révélation d'une question de soirée, vue de son téléphone, et la taille
 * de la salle. Rien pour qui vient d'arriver, une question annulée, le chef
 * qui anime seulement (rien de lui ne compte), un sondage (ni juste ni faux)
 * ou une question laissée passer — ne rien toucher n'est pas une faute.
 * Une estimation n'est jamais fausse : parmi les plus proches, elle le
 * nourrit, comme au serveur (`progress.ts`) ; pile-poil, elle est rare ;
 * sinon, rien. Seul dans la salle, rien ne le nourrit : une soirée jouée seul
 * ne compte pas (`soireeQuiCompte`).
 */
export function reactionDeLaSoiree(v: QuizPlayerView, participants: number): ReactionALaRevelation {
  if (v.phase !== 'reveal' || v.horsClassement || v.justArrived || v.cancelled) return CALME
  const compte = participants >= SALLE_QUI_COMPTE
  if (v.kind === 'number') {
    if (v.yourGuess === null || v.yourGuess === undefined || v.target === undefined || !v.parmiLesProches) return CALME
    return { verdict: 'juste', rare: ecartEstimation(v.yourGuess, v.target) === 0, nourri: compte }
  }
  if (v.variante === 'sondage') return CALME
  const variante = v.variante === 'plusieurs' || v.variante === 'ordre'
  if (variante ? !v.yourChoices?.length : v.yourChoice === null) return CALME
  const juste = variante ? v.yourCorrect === true : v.yourChoice === v.correct
  if (!juste) return { verdict: 'ratee', rare: false, nourri: false }
  const d = v.laQuestion
  return { verdict: 'juste', rare: !!d && bonneReponseRare(d.trouvees, d.repondues), nourri: compte }
}
