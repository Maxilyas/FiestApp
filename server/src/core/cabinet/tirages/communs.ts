// Ce que les tireurs partagent : ce qu'ils lisent (`ContexteDuTirage`), ce que
// la partie a déjà tiré (`Posees`), et le tirage d'une escale
// (`tirerPourUneEscale`, `core/tirageALaPiece.ts`) réglé pour le Cabinet — sa
// fenêtre de sept jours, ce que la partie a déjà posé écarté, ses jumelles
// après les autres —, avec la question telle que la partie la garde.
import type { QuestionDeLaBase } from '../../baseCampagne'
import type { Intitule } from '../../jumelles'
import type { PorteDeLaCampagne } from '../../porteDeLaCampagne'
import { tirerPourUneEscale, versQuestionDeSerie } from '../../tirageALaPiece'
import { JOURS_SANS_REDITE } from '../../../../../shared/cabinet/bareme'
import type { MesureDUneQuestion, Niveau } from '../../../../../shared/campagne'
import type { QuestionTiree } from '../../../../../shared/cabinet/jeux/outils'

/** La fenêtre de fraîcheur du Cabinet : une question vue depuis moins de sept jours ne revient qu'en dernier recours. */
export const FENETRE_DU_CABINET_MS = JOURS_SANS_REDITE * 24 * 3_600_000

/**
 * Ce que les tireurs lisent de la porte : les QCM d'une catégorie (le Pari,
 * l'Éclair) ; les questions par leur identifiant — celle qui demande le peintre
 * d'un tableau du Détail, son anecdote — et les événements datés de la base —
 * les frises des sujets. Sans ces deux-là, un essai qui ne tire que des QCM
 * s'en passe : le Détail dit alors ce qu'est son tableau, la Frise ne tire que
 * ses frises à thème. Le magasin donne toujours la porte entière.
 */
export type CeQueLesTireursLisent = Pick<PorteDeLaCampagne, 'deLaCategorie'> & Partial<Pick<PorteDeLaCampagne, 'parIdDe' | 'evenementsDe'>>

/** Ce qu'un tireur lit : la base jouable, sa mesure, ce que le joueur a vu, et le hasard du serveur. */
export interface ContexteDuTirage {
  porte: CeQueLesTireursLisent
  jouables: readonly QuestionDeLaBase[]
  mesures: ReadonlyMap<string, MesureDUneQuestion>
  /** Ce qu'il a vu, déplié (`vuesDuCabinet`), et quand pour la dernière fois. */
  vues: ReadonlyMap<string, number>
  maintenant: number
  /** Le hasard du tirage : celui du serveur, jamais rejoué d'une graine que la page connaîtrait. */
  hasard: () => number
}

/** Ce que la partie a déjà tiré : ni le même contenu deux fois, ni sa jumelle, et ses catégories tournent. */
export class Posees {
  readonly ids = new Set<string>()
  readonly intitules: Intitule[] = []
  readonly categories: string[] = []
  /**
   * Les titres que le Détail a déjà proposés, leurres compris : un titre montré
   * en leurre à une manche ne revient pas en réponse à la suivante — revu
   * parmi quatre, il se désignerait, ou se croirait faux de l'avoir été.
   */
  readonly titres = new Set<string>()

  prendre(q: QuestionTiree) {
    this.ids.add(q.id)
    this.intitules.push({ texte: q.texte, reponses: q.reponses })
  }
}

/**
 * Des questions de ces tas, à l'une de ces marches mesurées — la première, et
 * celles qui la valent (`aussi`) : entre elles, la fraîcheur départage —, ni
 * déjà posées par la partie, ni un vrai ou faux.
 */
export function tirerDesQuestions(
  ctx: ContexteDuTirage,
  posees: Posees,
  tas: readonly (readonly QuestionDeLaBase[])[],
  marches: readonly Niveau[],
  combien: number,
): { question: QuestionDeLaBase; niveau: Niveau }[] {
  return tirerPourUneEscale(tas, marches[0], combien, {
    sansVraiFaux: true,
    garde: q => !posees.ids.has(q.id),
    vues: ctx.vues,
    mesure: ctx.mesures,
    maintenant: ctx.maintenant,
    posees: posees.intitules,
    fenetreMs: FENETRE_DU_CABINET_MS,
    aussi: marches.slice(1),
  })
}

/** La question telle que la partie la garde : ses réponses mélangées pour elle, sa marche mesurée. */
export const commeLaPartieLaGarde = (t: { question: QuestionDeLaBase; niveau: Niveau }): QuestionTiree => versQuestionDeSerie(t.question, t.niveau)
