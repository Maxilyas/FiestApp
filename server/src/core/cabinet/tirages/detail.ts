// Le tireur du Détail : une fenêtre de quatre tableaux consécutifs dans le
// temps, parmi les cent de `server/content/details/` (`tableauxDuDetail`, ses
// quatre cadrages découpés d'avance) — la jamais vue d'abord, puis la plus
// anciennement vue (`laFenetreLaMoinsVue`) —, et le bon au hasard parmi ses
// quatre, par la règle du jeu (`detailDUneFenetre`), au hasard du serveur. Vu,
// c'est l'avoir eu au Cabinet (`cab:tableau:<QID>`) ou avoir répondu à l'une
// des questions de la base qui le nomment — « Qui a peint… ? », son musée : son
// titre y était écrit.
//
// La fraîcheur choisit la fenêtre, jamais le bon : seul le bon s'écrit vu, et
// tiré le moins vu, il était le titre des quatre qu'on avait vu il y a le plus
// longtemps — 78 % de bonnes réponses à la trentième partie pour qui se
// souvenait des tableaux nommés (la tablée du 25 octobre 2026), 100 % dès que
// les cent étaient révélés pour qui notait leur ordre (la relecture du
// 26 octobre). Une fenêtre se dit vue dès que l'un des siens l'est : ses quatre
// sont jamais vus tant que quatre jamais vus se suivent dans le temps, puis
// vus il y a le plus longtemps possible, et rien de vu ces sept jours ne
// revient tant qu'une fenêtre n'en a pas. Prise dans le catalogue entier, et
// non dans les seuls jamais vus — à la fin d'un tour, leurs quatre titres
// s'écartaient d'un siècle et demi —, elle garde ses époques voisines d'un
// bout à l'autre.
//
// Dans une partie, jamais deux fois le même tableau, rechanges comprises, et
// jamais un titre déjà proposé, ni en réponse ni en leurre (`Posees.titres`) :
// revenu en leurre seulement, il se serait écarté de lui-même. Sa catégorie
// est celle de tous les tableaux (`CATEGORIE_DU_DETAIL`, que l'Expédition pose
// aussi) : les missions la lisent.
import { tableauxDuDetail, type TableauDuDetail } from '../../details'
import { CATEGORIE_DU_DETAIL } from '../../../../../shared/expedition'
import { detailDUneFenetre, fenetresDuDetail, type DetailTire } from '../../../../../shared/cabinet/jeux/detail'
import { auHasard } from '../../../../../shared/cabinet/jeux/outils'
import { idDuTableau } from '../../../../../shared/cabinet/pieces'
import type { ContexteDuTirage, Posees } from './communs'
import { litLaBase, questionsDesTableaux } from './tas'

/** La dernière fois qu'il l'a vu : au Cabinet, ou par une question de la base qui le nomme. Jamais : undefined. */
function vuLe(t: TableauDuDetail, vues: ContexteDuTirage['vues']): number | undefined {
  let le = vues.get(idDuTableau(t.qid))
  for (const id of t.questions) {
    const v = vues.get(id)
    if (v !== undefined && (le === undefined || v > le)) le = v
  }
  return le
}

/**
 * La fenêtre la moins vue de ces tableaux : jamais vue d'abord, sinon la plus
 * anciennement vue — à la dernière fois que l'un de ses quatre l'a été ; à
 * égalité, au hasard du serveur. Aucune sous quatre titres.
 */
function laFenetreLaMoinsVue(
  candidats: readonly TableauDuDetail[],
  vus: ReadonlyMap<string, number | undefined>,
  hasard: () => number,
): TableauDuDetail[] | undefined {
  let laPlusAncienne = Number.POSITIVE_INFINITY
  let ex: TableauDuDetail[][] = []
  for (const f of fenetresDuDetail(candidats)) {
    const vueLe = Math.max(...f.map(t => vus.get(t.qid) ?? Number.NEGATIVE_INFINITY))
    if (vueLe < laPlusAncienne) {
      laPlusAncienne = vueLe
      ex = [f]
    } else if (vueLe === laPlusAncienne) ex.push(f)
  }
  return ex.length > 0 ? auHasard(ex, hasard) : undefined
}

export function tirerUnDetail(ctx: ContexteDuTirage, posees: Posees): DetailTire | null {
  const tableaux = tableauxDuDetail()
  const libres = tableaux.filter(t => !posees.ids.has(idDuTableau(t.qid)))
  // Un titre déjà montré ne revient pas — tant qu'il en reste : cent tableaux, six manches au plus dans un plan.
  const neufs = libres.filter(t => !posees.titres.has(t.titre))
  const vus = new Map(tableaux.map(t => [t.qid, vuLe(t, ctx.vues)]))
  const fenetre = laFenetreLaMoinsVue(neufs, vus, ctx.hasard) ?? laFenetreLaMoinsVue(libres, vus, ctx.hasard)
  if (!fenetre) return null
  const lesQuestions = litLaBase(ctx.porte) ? questionsDesTableaux(ctx.porte, ctx.jouables) : undefined
  const t = detailDUneFenetre(fenetre, ctx.hasard, { anecdoteDe: qid => lesQuestions?.get(qid)?.anecdote ?? null, categorie: CATEGORIE_DU_DETAIL })
  posees.ids.add(idDuTableau(t.tableau.qid))
  for (const x of t.titres) posees.titres.add(x.titre)
  return t
}
