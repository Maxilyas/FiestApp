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
import { CATEGORIES, type Categorie } from '../../../../../shared/categories'
import type { QuestionTiree } from '../../../../../shared/cabinet/jeux/outils'
import { marchesDeLEnjeu, type EnjeuDuTirage } from '../../../../../shared/cabinet/partie'

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
  /**
   * L'heure du serveur à l'arrivée du départ, celle qui le date : son jour de
   * Paris est celui du départ (`DepartDUnePartie.jour`), dont le Filet lit
   * l'année de ses pistes — jamais l'horloge de la machine.
   */
  maintenant: number
  /** Le hasard du tirage : celui du serveur, jamais rejoué d'une graine que la page connaîtrait. */
  hasard: () => number
  /**
   * Ce que l'œuvre visée demande au tirage (`enjeuDuTirage`) : les marches
   * qu'elle ajoute aux jeux de la base, une frise serrée pour une épique. Une
   * partie libre a l'enjeu ordinaire (`ENJEU_ORDINAIRE`).
   */
  enjeu: EnjeuDuTirage
  /**
   * Les mauvaises réponses que la campagne choisit, question par question, et
   * combien de fois (`JournalDesReponses.leurresChoisis`) : l'Éclair propose la
   * plus choisie à une affirmation fausse, plutôt qu'un leurre au hasard.
   */
  leurres: ReadonlyMap<string, ReadonlyMap<string, number>>
  /**
   * Ce qu'une épreuve de traversée a promis sur sa carte : une catégorie de la
   * base (« Histoire »), le thème d'une frise ou d'un lieu (« Rome »), ou au
   * Quiz un sujet ou une rubrique de la base (`animaux`, `sport/football`). Le
   * tireur la cherche d'abord ; sans rien qui tienne ses règles, il tire
   * ailleurs, comme toujours — une épreuve qui ne partirait pas serait pire
   * qu'un thème voisin.
   */
  vise?: { categorie: Categorie | null; theme: string | null; sujet?: string | null }
}

/** Les marches d'un jeu sous l'enjeu de la partie : les siennes, et ce que l'œuvre visée y ajoute. */
export const marchesDuTirage = (ctx: Pick<ContexteDuTirage, 'enjeu'>, marches: readonly Niveau[]): Niveau[] => marchesDeLEnjeu(marches, ctx.enjeu)

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
  /**
   * Les réponses que la partie fait déjà taper ou viser — un mot du Mot
   * mystère, une valeur du Filet : deux questions de la base y mènent parfois
   * au même « VILNIUS », au même 1789, et la révélation d'une manche aurait
   * donné la réponse de la suivante.
   */
  readonly reponses = new Set<string>()

  prendre(q: QuestionTiree) {
    this.ids.add(q.id)
    this.intitules.push({ texte: q.texte, reponses: q.reponses })
  }
}

/**
 * Des questions de ces tas, à l'une de ces marches mesurées — la première, et
 * celles qui la valent (`aussi`) : entre elles, la fraîcheur départage —, ni
 * déjà posées par la partie, ni un vrai ou faux ; et, si le jeu le demande,
 * qui passent sa garde (`garde`) : le Mot mystère n'y prend pas un mot déjà
 * posé, le Filet que ce qui se tend à l'année du départ.
 */
export function tirerDesQuestions(
  ctx: ContexteDuTirage,
  posees: Posees,
  tas: readonly (readonly QuestionDeLaBase[])[],
  marches: readonly Niveau[],
  combien: number,
  garde: (q: QuestionDeLaBase) => boolean = () => true,
): { question: QuestionDeLaBase; niveau: Niveau }[] {
  return tirerPourUneEscale(tas, marches[0], combien, {
    sansVraiFaux: true,
    garde: q => !posees.ids.has(q.id) && garde(q),
    vues: ctx.vues,
    mesure: ctx.mesures,
    maintenant: ctx.maintenant,
    posees: posees.intitules,
    fenetreMs: FENETRE_DU_CABINET_MS,
    aussi: marches.slice(1),
  })
}

/**
 * Une question de ces tas pour une manche : des catégories que la partie n'a
 * pas encore jouées d'abord, puis de toutes — trois manches d'histoire se
 * ressemblent. Null : rien à poser qui passe la garde du jeu.
 */
export function uneQuestionDesCategories(
  ctx: ContexteDuTirage,
  posees: Posees,
  tasDe: (c: Categorie) => readonly QuestionDeLaBase[],
  marches: readonly Niveau[],
  garde?: (q: QuestionDeLaBase) => boolean,
): { question: QuestionDeLaBase; niveau: Niveau } | null {
  // La catégorie qu'une épreuve a promise passe d'abord, même jouée à la manche d'avant : c'est le thème de toute l'épreuve.
  const visee = ctx.vise?.categorie
  const promise = visee ? (tirerDesQuestions(ctx, posees, [tasDe(visee)], marches, 1, garde)[0] ?? null) : null
  if (promise) return promise
  const neuves = CATEGORIES.filter(c => !posees.categories.includes(c))
  return tirerDesQuestions(ctx, posees, neuves.map(tasDe), marches, 1, garde)[0] ?? tirerDesQuestions(ctx, posees, CATEGORIES.map(tasDe), marches, 1, garde)[0] ?? null
}

/** La question telle que la partie la garde : ses réponses mélangées pour elle, sa marche mesurée. */
export const commeLaPartieLaGarde = (t: { question: QuestionDeLaBase; niveau: Niveau }): QuestionTiree => versQuestionDeSerie(t.question, t.niveau)

/**
 * La question d'une affirmation de l'Éclair : ses réponses écrites, mélangées,
 * jamais ses leurres tirés au rang (`reponsesAuRangTire`). L'Éclair n'en
 * montre qu'une, vraie ou fausse — sa place parmi quatre n'y dit rien —, et
 * la fausse est la mauvaise que la campagne choisit le plus parmi celles que
 * la question pose (`affirmationDe`) : tirés au rang, ses leurres ne la
 * portaient plus toujours (`cabinet-jeux-base.test.ts`, le 1er novembre 2026).
 */
export const telleQuElleEstEcrite = (t: { question: QuestionDeLaBase; niveau: Niveau }): QuestionTiree =>
  versQuestionDeSerie(t.question, t.niveau, { telleQuEcrite: true })
