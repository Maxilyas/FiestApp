// Le tireur du Filet : une question de la base qui se vise — une année
// entière, ou une estimation que le quiz tout prêt jouerait au plus près
// (`valeurDuFilet`, `tas.ts`) —, facile ou moyenne, mesurée, difficile aussi
// quand l'enjeu le demande (`marchesDuTirage`) ; et sa piste,
// tirée au départ du hasard du serveur (`pisteDuFilet`, la règle du jeu) :
// la réponse n'importe où entre ses bornes, jamais au milieu d'office, et
// jamais d'une graine que la page connaîtrait — sa place s'en déduirait.
//
// L'année d'une piste d'années est celle du jour de Paris du départ
// (`anneeDuDepart`, de l'heure qui date le départ, `ContexteDuTirage.maintenant`),
// jamais l'horloge de la machine : une piste s'arrête à elle, et une année trop
// récente pour s'y poser sans se trahir ne se tire pas (`seTendAuFilet`). Le
// tas, lui, se prépare sans le jour : la garde du tirage relit la règle à
// l'année du départ, et une question que la piste refuserait se remplace par
// une autre — la nuit du 31 décembre, une année de plus devient posable.
//
// Jamais deux fois la même valeur dans une partie, rechanges comprises : la
// révélation d'une manche aurait donné la suivante. Les manches tournent sur
// les catégories.
import type { QuestionDeLaBase } from '../../baseCampagne'
import { MARCHES_DU_FILET } from '../../../../../shared/cabinet/bareme'
import { pisteDuFilet, seTendAuFilet, type FiletTire } from '../../../../../shared/cabinet/jeux/filet'
import { anneeDuDepart } from '../../../../../shared/cabinet/partie'
import { jourDe } from '../../../../../shared/jour'
import { commeLaPartieLaGarde, marchesDuTirage, uneQuestionDesCategories } from './communs'
import type { ContexteDuTirage, Posees } from './communs'
import { valeurDuFilet, valeursDeLaCategorie } from './tas'

export function tirerUnFilet(ctx: ContexteDuTirage, posees: Posees): FiletTire | null {
  const annee = anneeDuDepart({ jour: jourDe(ctx.maintenant) })
  const marches = marchesDuTirage(ctx, MARCHES_DU_FILET)
  const ecartees = new Set<string>()
  const seVise = (q: QuestionDeLaBase) => {
    const v = valeurDuFilet(q)
    return v !== null && seTendAuFilet(v.valeur, v.annee, annee) && !posees.reponses.has(String(v.valeur)) && !ecartees.has(q.id)
  }
  // Une question écartée à chaque tour : le tirage finit, sur une piste ou sur rien.
  for (;;) {
    const tiree = uneQuestionDesCategories(ctx, posees, c => valeursDeLaCategorie(ctx.porte, ctx.jouables, c), marches, seVise)
    if (!tiree) return null
    const v = valeurDuFilet(tiree.question)
    const piste = v && pisteDuFilet(v.valeur, v.annee, ctx.hasard, annee)
    // La garde l'a jugée posable, à la même règle : une piste nulle dirait que l'une a changé sans l'autre. Elle se remplace.
    if (!v || !piste) {
      ecartees.add(tiree.question.id)
      continue
    }
    const question = commeLaPartieLaGarde(tiree)
    posees.prendre(question)
    posees.reponses.add(String(v.valeur))
    posees.categories.push(tiree.question.meta.categorie)
    return { jeu: 'filet', question, valeur: v.valeur, annee: v.annee, ...(v.unite !== undefined && { unite: v.unite }), piste }
  }
}
