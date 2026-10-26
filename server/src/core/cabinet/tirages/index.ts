// Le tirage d'une partie du Cabinet : un tireur par jeu, au serveur — il lit le
// contenu et ce que le joueur a vu —, et tout se tire au départ, réponses
// comprises : les trois manches, puis autant de rechanges que la force de
// Changer (`DepartDUnePartie.tirages`). Une reprise après un redémarrage
// redonne donc la même chose, et la fraîcheur, qui a bougé entre-temps,
// n'entre pas en jeu.
//
// Le hasard est celui du serveur (`Math.random`), jamais la graine de la
// partie : une graine que la page connaîtrait lui dirait ce que la partie va
// poser (invariant 1). « Rien ne revient avant sept jours, d'un jeu à
// l'autre » (`JOURS_SANS_REDITE`) : chaque tireur lit les vues dépliées
// (`vuesDuCabinet`) — une question de l'Éclair ne revient pas au Pari la même
// semaine — et jamais deux fois le même contenu dans une partie, rechanges
// comprises, ni deux jumelles (`Posees`, `core/jumelles.ts`).
import type { QuestionDeLaPartie } from '../../tirageALaPiece'
import { MANCHES_PAR_PARTIE } from '../../../../../shared/cabinet/bareme'
import type { ContenuTire } from '../../../../../shared/cabinet/jeux/index'
import type { QuestionTiree } from '../../../../../shared/cabinet/jeux/outils'
import type { CleDeJeu } from '../../../../../shared/cabinet/jeux/regle'
import { Posees, type ContexteDuTirage } from './communs'
import { tirerUnDetail } from './detail'
import { tirerUnEclair } from './eclair'
import { tirerUneEpingle } from './epingle'
import { tirerUnFilet } from './filet'
import { tirerUneFrise } from './frise'
import { tirerUneFiche } from './indices'
import { tirerUnMot } from './mot'
import { tirerUnPari } from './pari'
import { tirerUneReplique } from './replique'

export { FENETRE_DU_CABINET_MS, Posees, type CeQueLesTireursLisent, type ContexteDuTirage } from './communs'

/**
 * Une question tirée par une partie n'a qu'un cœur (`QuestionDeLaPartie`,
 * `core/tirageALaPiece.ts`) : celle que garde le Cabinet (`QuestionTiree`) est
 * la même, et s'y lie par le typage — chacune s'affecte à l'autre, et elles ont
 * les mêmes champs : un champ ajouté à l'une sans l'autre ne compile plus,
 * plutôt que de se perdre en route vers la pièce que le journal relit.
 * L'affectation seule laissait passer un champ facultatif de plus d'un côté.
 */
type Egales<A, B> = [A] extends [B] ? ([B] extends [A] ? ([keyof A] extends [keyof B] ? ([keyof B] extends [keyof A] ? true : false) : false) : false) : false
type LaMemeQuestion = Egales<QuestionDeLaPartie, QuestionTiree>
export const LA_MEME_QUESTION: LaMemeQuestion = true

/**
 * Un tireur, de trois sortes. Manche par manche : le contenu d'une manche, ou
 * null — rien à poser qui tienne ses règles —, appelé pour les trois manches
 * puis pour chaque rechange. Ou d'un coup, la partie : la Frise, une seule
 * frise qui grandit d'une manche à l'autre, ses trois vagues tirées ensemble —
 * tirées une à une, la deuxième ne saurait rien de la première ; et sans
 * rechange, puisque Changer n'y sert jamais (`JEUX.frise.changeable`) et que
 * la relecture d'un départ de la Frise n'en admet aucune (`lireLeDepart`). Ou
 * le plan entier, rechanges comprises : l'Épingle, dont les trois manches
 * partagent un thème et dont les rechanges viennent d'un autre — tirée manche
 * par manche, une rechange ne saurait pas qu'elle en est une.
 */
export type Tireur =
  | { manche: (ctx: ContexteDuTirage, posees: Posees) => ContenuTire | null }
  | { partie: (ctx: ContexteDuTirage) => readonly ContenuTire[] | null }
  | { plan: (ctx: ContexteDuTirage, rechanges: number) => readonly ContenuTire[] | null }

/**
 * Les tireurs des jeux livrés : un jeu qui n'en a pas ne part pas
 * (`JEUX_PRETS`, que `cabinet-routes.test.ts` compare à cette liste). Un jeu de
 * plus, c'est son module pur, son tireur ici, son écran et ses tests.
 */
export const TIREURS: Readonly<Partial<Record<CleDeJeu, Tireur>>> = {
  pari: { manche: tirerUnPari },
  eclair: { manche: tirerUnEclair },
  detail: { manche: tirerUnDetail },
  frise: { partie: tirerUneFrise },
  mot: { manche: tirerUnMot },
  filet: { manche: tirerUnFilet },
  epingle: { plan: tirerUneEpingle },
  indices: { manche: tirerUneFiche },
  replique: { manche: tirerUneReplique },
}

/**
 * Le plan d'une partie : ses trois manches, puis jusqu'à `rechanges` de plus.
 * Null quand une des trois manches ne se tire pas ; une rechange qui manque
 * s'arrête là — Changer le dira (« Plus de rechange pour cette partie »). Un
 * tireur de partie rend ses trois manches, jamais de rechange ; un tireur de
 * plan, ses trois manches et ce qu'il trouve de rechanges, jamais plus.
 */
export function tirerLePlan(jeu: CleDeJeu, ctx: ContexteDuTirage, rechanges: number): ContenuTire[] | null {
  const tireur = TIREURS[jeu]
  if (!tireur) return null
  if ('partie' in tireur) {
    const plan = tireur.partie(ctx)
    return plan && plan.length === MANCHES_PAR_PARTIE ? [...plan] : null
  }
  if ('plan' in tireur) {
    const plan = tireur.plan(ctx, rechanges)
    return plan && plan.length >= MANCHES_PAR_PARTIE && plan.length <= MANCHES_PAR_PARTIE + rechanges ? [...plan] : null
  }
  const posees = new Posees()
  const plan: ContenuTire[] = []
  for (let k = 0; k < MANCHES_PAR_PARTIE + rechanges; k++) {
    const t = tireur.manche(ctx, posees)
    if (!t) {
      if (k < MANCHES_PAR_PARTIE) return null
      break
    }
    plan.push(t)
  }
  return plan
}

/**
 * Le thème d'un contenu tiré : celui de sa frise — « L'aviation », « Les
 * années 80 » —, celui de son lieu à l'Épingle — « Les grands sièges ». Les
 * autres jeux n'en ont pas. Le cartel d'une œuvre dit celui de la manche qu'il
 * garde (`cartelDe`) : à l'Épingle, une rechange de Changer vient d'un autre
 * thème que les trois manches.
 */
export function themeDuTirage(t: ContenuTire | undefined): string | undefined {
  return t?.jeu === 'frise' ? t.theme : t?.jeu === 'epingle' ? t.lieu.theme : undefined
}

/**
 * Le thème que le départ fige avec son plan (`DepartDUnePartie.theme`) : celui
 * de sa première manche — de toute la frise, des trois lieux de l'Épingle.
 */
export const themeDuPlan = (plan: readonly ContenuTire[]): string | undefined => themeDuTirage(plan[0])
