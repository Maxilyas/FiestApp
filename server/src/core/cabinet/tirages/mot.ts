// Le tireur du Mot mystère : une question de la base dont la bonne réponse se
// tape — un seul mot de cinq à sept lettres, que l'intitulé ne dit pas, par la
// règle même du jeu (`motDeLaQuestion`) —, facile ou moyenne, mesurée, jamais
// la difficulté écrite — difficile aussi quand l'enjeu le demande
// (`marchesDuTirage`) ; ses lettres et ce qu'elle écrit (« Vilnius »), tirés
// avec elle au départ. Jamais un mot déjà posé dans la partie, rechanges
// comprises : deux questions de la base mènent parfois au même mot, et la
// révélation de l'une aurait donné l'autre. Les manches tournent sur les
// catégories.
import { MARCHES_DU_MOT } from '../../../../../shared/cabinet/bareme'
import { motDeLaQuestion, type MotTire } from '../../../../../shared/cabinet/jeux/mot'
import { commeLaPartieLaGarde, marchesDuTirage, uneQuestionDesCategories } from './communs'
import type { ContexteDuTirage, Posees } from './communs'
import { motsDeLaCategorie } from './tas'

export function tirerUnMot(ctx: ContexteDuTirage, posees: Posees): MotTire | null {
  const neuf = (q: Parameters<typeof motDeLaQuestion>[0]) => {
    const m = motDeLaQuestion(q)
    return m !== null && !posees.reponses.has(m.lettres)
  }
  const tiree = uneQuestionDesCategories(ctx, posees, c => motsDeLaCategorie(ctx.porte, ctx.jouables, c), marchesDuTirage(ctx, MARCHES_DU_MOT), neuf)
  if (!tiree) return null
  // Telle que la partie la garde, ses réponses mélangées : sa bonne réponse est la même, le mot aussi.
  const question = commeLaPartieLaGarde(tiree)
  const mot = motDeLaQuestion(question)
  if (!mot) return null
  posees.prendre(question)
  posees.reponses.add(mot.lettres)
  posees.categories.push(tiree.question.meta.categorie)
  return { jeu: 'mot', question, lettres: mot.lettres, affiche: mot.affiche }
}
