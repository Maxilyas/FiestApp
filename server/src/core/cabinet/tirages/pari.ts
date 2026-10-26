// Le tireur du Pari : une question facile ou moyenne — mesurée, jamais la
// difficulté écrite ; difficile aussi pour une épique ou pour dorer, la marche
// suit l'enjeu —, et sa seconde, difficile ou experte et toujours plus haute
// que la première, de la même catégorie,
// tirée au départ avec elle : rien ne se tire à « Parier », et une reprise
// redonne la même (D4). Les trois manches tournent sur les catégories.
import { MARCHES_DU_PARI } from '../../../../../shared/cabinet/bareme'
import { NIVEAUX } from '../../../../../shared/campagne'
import type { Categorie } from '../../../../../shared/categories'
import type { PariTire } from '../../../../../shared/cabinet/jeux/pari'
import { commeLaPartieLaGarde, marchesDuTirage, tirerDesQuestions, uneQuestionDesCategories } from './communs'
import type { ContexteDuTirage, Posees } from './communs'
import { qcmDeLaCategorie } from './tas'

export function tirerUnPari(ctx: ContexteDuTirage, posees: Posees): PariTire | null {
  const tasDe = (c: Categorie) => qcmDeLaCategorie(ctx.porte, ctx.jouables, c)
  const premiere = uneQuestionDesCategories(ctx, posees, tasDe, marchesDuTirage(ctx, MARCHES_DU_PARI.question))
  if (!premiere) return null
  const q1 = commeLaPartieLaGarde(premiere)
  posees.prendre(q1)
  const categorie = premiere.question.meta.categorie as Categorie
  // Plus difficile que la première, toujours — « parie-les sur une question plus difficile » : une première difficile,
  // que l'enjeu d'une épique ou d'une dorure peut tirer, ne se parie que sur une experte. Facile ou moyenne, rien ne change.
  const plusHautes = MARCHES_DU_PARI.pari.filter(m => NIVEAUX.indexOf(m) > NIVEAUX.indexOf(premiere.niveau))
  const [seconde] = tirerDesQuestions(ctx, posees, [tasDe(categorie)], plusHautes.length > 0 ? plusHautes : MARCHES_DU_PARI.pari, 1)
  if (!seconde) return null
  const q2 = commeLaPartieLaGarde(seconde)
  posees.prendre(q2)
  posees.categories.push(categorie)
  return { jeu: 'pari', q1, q2 }
}
