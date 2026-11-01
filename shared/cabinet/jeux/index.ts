// Le registre des dix jeux du Cabinet : chaque règle sous sa clé, et les
// types de ce que chacun tire, joue, montre et révèle. Exhaustif par le
// typage — un jeu de plus que `CleDeJeu` nomme sans sa règle, ou une règle
// sans l'un de ses types, ne compile pas (D12) ; un jeu de plus, c'est un
// module, son tireur, son composant, ses tests et sa ligne ici.
//
// Le pli (`shared/cabinet/partie.ts`) lit la règle du jeu de sa partie, que
// son départ nomme ; la vue du serveur et la page lisent les unions — ce que
// montre une manche, ce que révèle un verdict, ce qu'un départ fige —, la
// page en `import type` seulement : elle ne juge rien (invariant 1).

import type { CleDeJeu, RegleDuJeu } from './regle'
import { REGLE_DU_DETAIL, type DetailMontre, type DetailRevele, type DetailTire, type EtatDuDetail, type GesteDuDetail } from './detail'
import { REGLE_DE_L_ECLAIR, type EclairMontre, type EclairRevele, type EclairTire, type EtatDeLEclair, type GesteDeLEclair } from './eclair'
import { REGLE_DE_L_EPINGLE, type EpingleMontree, type EpingleRevelee, type EpingleTiree, type EtatDeLEpingle, type GesteDeLEpingle } from './epingle'
import { REGLE_DU_FILET, type EtatDuFilet, type FiletMontre, type FiletRevele, type FiletTire, type GesteDuFilet } from './filet'
import { REGLE_DE_LA_FRISE, type EtatDeLaFrise, type FriseMontree, type FriseRevelee, type FriseTiree, type GesteDeLaFrise } from './frise'
import { REGLE_DES_INDICES, type EtatDesIndices, type GesteDesIndices, type IndicesMontres, type IndicesReveles, type IndicesTires } from './indices'
import { REGLE_DU_MOT, type EtatDuMot, type GesteDuMot, type MotMontre, type MotRevele, type MotTire } from './mot'
import { REGLE_DU_PARI, type EtatDuPari, type GesteDuPari, type PariMontre, type PariRevele, type PariTire } from './pari'
import { REGLE_DU_QUIZ, type EtatDuQuiz, type GesteDuQuiz, type QuizMontre, type QuizRevele, type QuizTire } from './quiz'
import { REGLE_DE_LA_REPLIQUE, type EtatDeLaReplique, type GesteDeLaReplique, type RepliqueMontree, type RepliqueRevelee, type RepliqueTiree } from './replique'

/** Ce que chaque jeu tire au départ, l'état d'une de ses manches, ses gestes, ce qu'il montre et ce qu'il révèle. */
export interface TypesDesJeux {
  epingle: { tiree: EpingleTiree; etat: EtatDeLEpingle; geste: GesteDeLEpingle; montree: EpingleMontree; revelee: EpingleRevelee }
  frise: { tiree: FriseTiree; etat: EtatDeLaFrise; geste: GesteDeLaFrise; montree: FriseMontree; revelee: FriseRevelee }
  mot: { tiree: MotTire; etat: EtatDuMot; geste: GesteDuMot; montree: MotMontre; revelee: MotRevele }
  detail: { tiree: DetailTire; etat: EtatDuDetail; geste: GesteDuDetail; montree: DetailMontre; revelee: DetailRevele }
  filet: { tiree: FiletTire; etat: EtatDuFilet; geste: GesteDuFilet; montree: FiletMontre; revelee: FiletRevele }
  pari: { tiree: PariTire; etat: EtatDuPari; geste: GesteDuPari; montree: PariMontre; revelee: PariRevele }
  eclair: { tiree: EclairTire; etat: EtatDeLEclair; geste: GesteDeLEclair; montree: EclairMontre; revelee: EclairRevele }
  indices: { tiree: IndicesTires; etat: EtatDesIndices; geste: GesteDesIndices; montree: IndicesMontres; revelee: IndicesReveles }
  replique: { tiree: RepliqueTiree; etat: EtatDeLaReplique; geste: GesteDeLaReplique; montree: RepliqueMontree; revelee: RepliqueRevelee }
  quiz: { tiree: QuizTire; etat: EtatDuQuiz; geste: GesteDuQuiz; montree: QuizMontre; revelee: QuizRevele }
}

/** La règle d'un jeu, à ses types. */
export type RegleDe<J extends CleDeJeu> = RegleDuJeu<TypesDesJeux[J]['tiree'], TypesDesJeux[J]['etat'], TypesDesJeux[J]['geste'], TypesDesJeux[J]['montree'], TypesDesJeux[J]['revelee']>

/** Les dix règles, chacune sous sa clé. */
export const REGLES: { readonly [J in CleDeJeu]: RegleDe<J> } = {
  epingle: REGLE_DE_L_EPINGLE,
  frise: REGLE_DE_LA_FRISE,
  mot: REGLE_DU_MOT,
  detail: REGLE_DU_DETAIL,
  filet: REGLE_DU_FILET,
  pari: REGLE_DU_PARI,
  eclair: REGLE_DE_L_ECLAIR,
  indices: REGLE_DES_INDICES,
  replique: REGLE_DE_LA_REPLIQUE,
  quiz: REGLE_DU_QUIZ,
}

/**
 * Ce qu'un départ fige d'une manche ou d'une rechange : l'union des dix
 * tirages, chacun marqué de son jeu (`jeu`). Il garde la réponse : il ne part
 * jamais au téléphone.
 */
export type ContenuTire = TypesDesJeux[CleDeJeu]['tiree']
/** Ce que la page reçoit d'une manche en cours : l'union des dix, sans la réponse. */
export type MancheMontree = TypesDesJeux[CleDeJeu]['montree']
/** Ce que la page reçoit d'une manche tranchée : la réponse entière et « Le savais-tu ? ». */
export type RevelationDUneManche = TypesDesJeux[CleDeJeu]['revelee']

/**
 * La règle d'un jeu, ses types effacés : le pli la lit pour le jeu que son
 * départ nomme, et ne passe à chacune que ce que `lireLeDepart` a relu pour
 * ce jeu-là (`ContenuTire`, marqué de son jeu), ce qu'elle a elle-même ouvert
 * et ce que son `lireLeGeste` a rendu. Le typage par jeu ne survit pas à une
 * clé lue d'un départ : c'est cette discipline qui le remplace.
 */
export type RegleEffacee = RegleDuJeu<unknown, unknown, { quoi: string }, unknown, unknown>

/** La règle d'un jeu, pour le pli. */
export function regleDe(jeu: CleDeJeu): RegleEffacee {
  return REGLES[jeu] as unknown as RegleEffacee
}
