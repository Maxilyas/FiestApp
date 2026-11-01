// Le tireur du Quiz : quatre QCM d'un même thème, à la marche de l'acte (ou
// faciles et moyens hors d'une traversée, `MARCHES_DU_QUIZ`), tels que la
// partie les garde — leurs réponses mélangées pour elle (`commeLaPartieLaGarde`).
//
// Le thème est celui que la carte a promis : le sujet ou la rubrique de la base
// (`ContexteDuTirage.vise.sujet`, rangés par `qcmDuSujet`), sinon la catégorie
// (`vise.categorie`). Sans quatre questions qui tiennent ses règles — jamais
// posées par la partie, ni vues la semaine si d'autres attendent —, il tire
// ailleurs, comme les autres tireurs : une catégorie que la partie n'a pas
// encore jouée, puis toutes. La manche dit le thème qu'elle a trouvé
// (`QuizTire.theme`), jamais celui qu'elle n'a pas pu tenir.
import { MARCHES_DU_QUIZ, QUESTIONS_DU_QUIZ } from '../../../../../shared/cabinet/bareme'
import { battre } from '../../../../../shared/cabinet/jeux/outils'
import type { QuizTire } from '../../../../../shared/cabinet/jeux/quiz'
import { CATEGORIES } from '../../../../../shared/categories'
import { sujetParCle } from '../../../../../shared/sujets'
import type { QuestionDeLaBase } from '../../baseCampagne'
import { commeLaPartieLaGarde, marchesDuTirage, tirerDesQuestions } from './communs'
import type { ContexteDuTirage, Posees } from './communs'
import { qcmDeLaCategorie, qcmDuSujet } from './tas'

export function tirerUnQuiz(ctx: ContexteDuTirage, posees: Posees): QuizTire | null {
  const marches = marchesDuTirage(ctx, MARCHES_DU_QUIZ)
  const dans = (tas: readonly QuestionDeLaBase[], theme: string): QuizTire | null => {
    if (tas.length < QUESTIONS_DU_QUIZ) return null
    const tirees = tirerDesQuestions(ctx, posees, [tas], marches, QUESTIONS_DU_QUIZ)
    if (tirees.length < QUESTIONS_DU_QUIZ) return null
    const questions = tirees.map(commeLaPartieLaGarde)
    for (const q of questions) posees.prendre(q)
    return { jeu: 'quiz', theme, questions }
  }
  // Le sujet que l'épreuve a promis, d'abord : c'est le thème des trois manches.
  const sujet = ctx.vise?.sujet ? sujetParCle(ctx.vise.sujet) : undefined
  const duSujet = sujet ? dans(qcmDuSujet(ctx.porte, ctx.jouables, sujet.cle), sujet.nom) : null
  if (duSujet) return duSujet
  // Puis la catégorie promise, même jouée à la manche d'avant ; puis celles que la partie n'a pas encore jouées, puis toutes.
  const visee = ctx.vise?.categorie
  const ordre = [
    ...(visee ? [visee] : []),
    ...battre(
      CATEGORIES.filter(c => c !== visee && !posees.categories.includes(c)),
      ctx.hasard,
    ),
    ...battre(
      CATEGORIES.filter(c => c !== visee && posees.categories.includes(c)),
      ctx.hasard,
    ),
  ]
  for (const categorie of ordre) {
    const t = dans(qcmDeLaCategorie(ctx.porte, ctx.jouables, categorie), categorie)
    if (!t) continue
    posees.categories.push(categorie)
    return t
  }
  return null
}
