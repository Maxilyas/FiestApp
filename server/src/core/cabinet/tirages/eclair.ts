// Le tireur de l'Éclair : cinq QCM d'une même catégorie — la pièce a une
// catégorie, que les missions lisent —, faciles ou moyens, chacun récrit en
// affirmation par la règle du jeu (`affirmationDe`) avec le hasard du tirage :
// sa bonne réponse une fois sur deux, sinon une des mauvaises. Les
// catégories que la partie n'a pas encore jouées passent d'abord.
import { AFFIRMATIONS_DE_L_ECLAIR, MARCHES_DE_L_ECLAIR } from '../../../../../shared/cabinet/bareme'
import { CATEGORIES } from '../../../../../shared/categories'
import { affirmationDe, type AffirmationTiree, type EclairTire } from '../../../../../shared/cabinet/jeux/eclair'
import { battre } from '../../../../../shared/cabinet/jeux/outils'
import { commeLaPartieLaGarde, tirerDesQuestions } from './communs'
import type { ContexteDuTirage, Posees } from './communs'
import { qcmDeLaCategorie } from './tas'

export function tirerUnEclair(ctx: ContexteDuTirage, posees: Posees): EclairTire | null {
  const assez = CATEGORIES.filter(c => qcmDeLaCategorie(ctx.porte, ctx.jouables, c).length >= AFFIRMATIONS_DE_L_ECLAIR)
  const ordre = [...battre(assez.filter(c => !posees.categories.includes(c)), ctx.hasard), ...battre(assez.filter(c => posees.categories.includes(c)), ctx.hasard)]
  for (const categorie of ordre) {
    const tirees = tirerDesQuestions(ctx, posees, [qcmDeLaCategorie(ctx.porte, ctx.jouables, categorie)], MARCHES_DE_L_ECLAIR, AFFIRMATIONS_DE_L_ECLAIR)
    if (tirees.length < AFFIRMATIONS_DE_L_ECLAIR) continue
    const affirmations = tirees.map(t => affirmationDe(commeLaPartieLaGarde(t), ctx.hasard))
    if (affirmations.some(a => a === null)) continue
    const toutes = affirmations as AffirmationTiree[]
    for (const a of toutes) posees.prendre(a.question)
    posees.categories.push(categorie)
    return { jeu: 'eclair', affirmations: toutes }
  }
  return null
}
