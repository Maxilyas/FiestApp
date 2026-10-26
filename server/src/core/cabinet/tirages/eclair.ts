// Le tireur de l'Éclair : cinq QCM d'une même catégorie — la pièce a une
// catégorie, que les missions lisent —, faciles ou moyens, chacun récrit en
// affirmation par la règle du jeu (`affirmationDe`) avec le hasard du tirage :
// sa bonne réponse une fois sur deux, sinon une des mauvaises.
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
import type { QuestionDeLaBase } from '../../baseCampagne'
import { AFFIRMATIONS_DE_L_ECLAIR, MARCHES_DE_L_ECLAIR } from '../../../../../shared/cabinet/bareme'
import { niveauDeQuestion, type MesureDUneQuestion } from '../../../../../shared/campagne'
import { CATEGORIES, type Categorie } from '../../../../../shared/categories'
import { affirmationDe, type AffirmationTiree, type EclairTire } from '../../../../../shared/cabinet/jeux/eclair'
import { battre } from '../../../../../shared/cabinet/jeux/outils'
import { commeLaPartieLaGarde, tirerDesQuestions } from './communs'
import type { ContexteDuTirage, Posees } from './communs'
import { qcmDeLaCategorie } from './tas'

/** Les QCM qu'un Éclair peut poser, à ses marches : la catégorie de chacun par son identifiant, et combien chaque catégorie en a. */
interface QcmDeLEclair {
  categorieDe: ReadonlyMap<string, Categorie>
  combien: ReadonlyMap<Categorie, number>
}

/**
 * Ses QCM à ses marches, pour cette liste de jouables et cette mesure : une
 * passe sur les tas, une fois par mesure — elle change toutes les dix minutes,
 * la marche d'une question avec elle —, gardée ensuite par l'identité des
 * deux (`WeakMap`).
 */
const QCM_DE_L_ECLAIR = new WeakMap<readonly QuestionDeLaBase[], WeakMap<ReadonlyMap<string, MesureDUneQuestion>, QcmDeLEclair>>()

function qcmDeLEclair(ctx: ContexteDuTirage): QcmDeLEclair {
  let parMesure = QCM_DE_L_ECLAIR.get(ctx.jouables)
  if (!parMesure) QCM_DE_L_ECLAIR.set(ctx.jouables, (parMesure = new WeakMap()))
  let lus = parMesure.get(ctx.mesures)
  if (!lus) {
    const categorieDe = new Map<string, Categorie>()
    const combien = new Map<Categorie, number>()
    for (const c of CATEGORIES) {
      let n = 0
      for (const q of qcmDeLaCategorie(ctx.porte, ctx.jouables, c)) {
        if (!MARCHES_DE_L_ECLAIR.includes(niveauDeQuestion(q.meta.difficulte, ctx.mesures.get(q.id)))) continue
        categorieDe.set(q.id, c)
        n++
      }
      combien.set(c, n)
    }
    parMesure.set(ctx.mesures, (lus = { categorieDe, combien }))
  }
  return lus
}

/**
 * Ce qu'il reste à chaque catégorie de QCM jamais vus, à ses marches : ce
 * qu'elle a, moins ce qu'il en a vu — une passe sur ses vues, jamais sur les
 * tas, qu'un joueur neuf ne paie donc pas. « Jamais vu » comme le tirage
 * l'entend (`fraicheurDe`) : vu une fois, même il y a un an, ce n'est plus
 * l'arrêt de sa lecture.
 */
function jamaisVues(ctx: ContexteDuTirage): Map<Categorie, number> {
  const { categorieDe, combien } = qcmDeLEclair(ctx)
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
