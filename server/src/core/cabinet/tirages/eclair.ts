// Le tireur de l'Éclair : cinq QCM d'une même catégorie — la pièce a une
// catégorie, que les missions lisent —, faciles ou moyens, difficiles aussi
// quand l'enjeu le demande (`marchesDuTirage`), chacun récrit en affirmation
// par la règle du jeu (`affirmationDe`) avec le hasard du tirage : sa bonne
// réponse une fois sur deux, sinon la mauvaise que la campagne choisit le plus
// (`ContexteDuTirage.leurres`).
//
// La catégorie se choisit par ce qu'il lui reste de jamais vu, avant le
// hasard : une catégorie qui a encore de quoi poser ses cinq affirmations à
// neuf passe devant celles qu'il a épuisées, puis, parmi elles, celles que la
// partie n'a pas encore jouées. Tirée au hasard parmi les douze, une
// catégorie épuisée faisait parcourir tout son tas à chacune des cinq places
// du tirage (`tirerPourUneEscale` ne s'arrête qu'à une question jamais vue) —
// 7 658 questions examinées par départ pour un fidèle, contre 25 pour un
// joueur neuf — et posait cinq affirmations déjà vues quand d'autres
// catégories l'attendaient (la revue de sobriété du 25 octobre 2026).
import { AFFIRMATIONS_DE_L_ECLAIR, MARCHES_DE_L_ECLAIR } from '../../../../../shared/cabinet/bareme'
import { CATEGORIES, type Categorie } from '../../../../../shared/categories'
import { affirmationDe, type AffirmationTiree, type EclairTire } from '../../../../../shared/cabinet/jeux/eclair'
import { battre } from '../../../../../shared/cabinet/jeux/outils'
import { commeLaPartieLaGarde, marchesDuTirage, tirerDesQuestions } from './communs'
import type { ContexteDuTirage, Posees } from './communs'
import { qcmDeLaCategorie, qcmDeLEclair } from './tas'

/**
 * Ce qu'il reste à chaque catégorie de QCM jamais vus, à ses marches : ce
 * qu'elle a, moins ce qu'il en a vu — une passe sur ses vues, jamais sur les
 * tas, qu'un joueur neuf ne paie donc pas ; ses QCM à ses marches, la passe
 * que les tas préparent et qu'une mesure neuve refait en fond
 * (`qcmDeLEclair`). « Jamais vu » comme le tirage l'entend (`fraicheurDe`) :
 * vu une fois, même il y a un an, ce n'est plus l'arrêt de sa lecture.
 */
function jamaisVues(ctx: ContexteDuTirage): Map<Categorie, number> {
  const { categorieDe, combien } = qcmDeLEclair(ctx.porte, ctx.jouables, ctx.mesures)
  const restent = new Map(combien)
  for (const id of ctx.vues.keys()) {
    const c = categorieDe.get(id)
    if (c !== undefined) restent.set(c, restent.get(c)! - 1)
  }
  return restent
}

export function tirerUnEclair(ctx: ContexteDuTirage, posees: Posees): EclairTire | null {
  const assez = CATEGORIES.filter(c => qcmDeLaCategorie(ctx.porte, ctx.jouables, c).length >= AFFIRMATIONS_DE_L_ECLAIR)
  const restent = jamaisVues(ctx)
  const reste = (c: Categorie) => restent.get(c) ?? 0
  const neuves = assez.filter(c => reste(c) >= AFFIRMATIONS_DE_L_ECLAIR)
  const epuisees = assez.filter(c => reste(c) < AFFIRMATIONS_DE_L_ECLAIR)
  const jouee = (c: Categorie) => posees.categories.includes(c)
  // Battues comme avant, celles que la partie n'a pas encore jouées d'abord : un joueur neuf — tout est neuf — tire au même
  // hasard qu'avant. Les épuisées, battues aussi, puis la moins épuisée d'abord (un tri stable garde le hasard des égales).
  const lesPlusFraiches = (cs: Categorie[]) => cs.sort((a, b) => reste(b) - reste(a))
  const ordre = [
    ...battre(neuves.filter(c => !jouee(c)), ctx.hasard),
    ...battre(neuves.filter(jouee), ctx.hasard),
    ...lesPlusFraiches(battre(epuisees.filter(c => !jouee(c)), ctx.hasard)),
    ...lesPlusFraiches(battre(epuisees.filter(jouee), ctx.hasard)),
  ]
  // Difficiles aussi sous un enjeu qui le demande : l'ordre des catégories se lit encore aux marches du jeu, il ne fait que
  // départager — une catégorie riche en difficiles jamais vues n'en passe pas devant.
  const marches = marchesDuTirage(ctx, MARCHES_DE_L_ECLAIR)
  for (const categorie of ordre) {
    const tirees = tirerDesQuestions(ctx, posees, [qcmDeLaCategorie(ctx.porte, ctx.jouables, categorie)], marches, AFFIRMATIONS_DE_L_ECLAIR)
    if (tirees.length < AFFIRMATIONS_DE_L_ECLAIR) continue
    // Le leurre que la campagne choisit le plus, plutôt qu'un au hasard (`affirmationDe`).
    const affirmations = tirees.map(t => affirmationDe(commeLaPartieLaGarde(t), ctx.hasard, ctx.leurres.get(t.question.id)))
    if (affirmations.some(a => a === null)) continue
    const toutes = affirmations as AffirmationTiree[]
    for (const a of toutes) posees.prendre(a.question)
    posees.categories.push(categorie)
    return { jeu: 'eclair', affirmations: toutes }
  }
  return null
}
