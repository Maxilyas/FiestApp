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
import { tirerUnEclair } from './eclair'
import { tirerUnPari } from './pari'

export { FENETRE_DU_CABINET_MS, Posees, type ContexteDuTirage } from './communs'

/**
 * Une question tirée par une partie n'a qu'un cœur (`QuestionDeLaPartie`,
 * `core/tirageALaPiece.ts`) : celle que garde le Cabinet (`QuestionTiree`) est
 * la même, et s'y lie par le typage, dans les deux sens — un champ ajouté à
 * l'une sans l'autre ne compile plus, plutôt que de se perdre en route vers la
 * pièce que le journal relit.
 */
type LaMemeQuestion = [QuestionDeLaPartie] extends [QuestionTiree] ? ([QuestionTiree] extends [QuestionDeLaPartie] ? true : false) : false
export const LA_MEME_QUESTION: LaMemeQuestion = true

/** Un tireur : le contenu d'une manche, ou null — rien à poser qui tienne ses règles. */
export type Tireur = (ctx: ContexteDuTirage, posees: Posees) => ContenuTire | null

/**
 * Les tireurs des jeux livrés : un jeu qui n'en a pas ne part pas
 * (`JEUX_PRETS`, que `cabinet-routes.test.ts` compare à cette liste). Un jeu de
 * plus, c'est son module pur, son tireur ici, son écran et ses tests.
 */
export const TIREURS: Readonly<Partial<Record<CleDeJeu, Tireur>>> = {
  pari: tirerUnPari,
  eclair: tirerUnEclair,
}

/**
 * Le plan d'une partie : ses trois manches, puis jusqu'à `rechanges` de plus.
 * Null quand une des trois manches ne se tire pas ; une rechange qui manque
 * s'arrête là — Changer le dira (« Plus de rechange pour cette partie »).
 */
export function tirerLePlan(jeu: CleDeJeu, ctx: ContexteDuTirage, rechanges: number): ContenuTire[] | null {
  const tireur = TIREURS[jeu]
  if (!tireur) return null
  const posees = new Posees()
  const plan: ContenuTire[] = []
  for (let k = 0; k < MANCHES_PAR_PARTIE + rechanges; k++) {
    const t = tireur(ctx, posees)
    if (!t) {
      if (k < MANCHES_PAR_PARTIE) return null
      break
    }
    plan.push(t)
  }
  return plan
}
