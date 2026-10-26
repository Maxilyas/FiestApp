// Le tireur du Détail : un tableau des cent de `server/content/details/`
// (`tableauxDuDetail`, ses quatre cadrages découpés d'avance), le jamais vu
// d'abord, puis le plus anciennement vu (`laMoinsVue`) ; ses trois voisins en
// années et l'ordre des quatre titres, par la règle du jeu (`detailTire`), au
// hasard du serveur. Vu, c'est l'avoir eu au Cabinet (`cab:tableau:<QID>`) ou
// avoir répondu à l'une des questions de la base qui le nomment — « Qui a
// peint… ? », son musée : son titre y était écrit.
//
// Ses voisins sont de sa fraîcheur : jamais vus avec un jamais vu, vus avec un
// vu, tant qu'il y en a quatre. Seul le bon s'écrit vu : un leurre qu'une
// révélation d'avant avait nommé ne pouvait pas être le bon tant que le
// catalogue gardait des jamais vus, et qui s'en souvenait l'écartait — 78 % de
// bonnes réponses à sa trentième partie, sans regarder l'image (la
// contre-expertise de la tablée du 25 octobre 2026).
//
// Dans une partie, jamais deux fois le même tableau, rechanges comprises, et
// jamais en réponse un titre déjà proposé, leurre compris (`Posees.titres`) ;
// les leurres ne reprennent pas un tableau déjà posé. Sa catégorie est celle
// de tous les tableaux (`CATEGORIE_DU_DETAIL`, que l'Expédition pose aussi) :
// les missions la lisent.
import { tableauxDuDetail, type TableauDuDetail } from '../../details'
import { laMoinsVue } from '../../tirageALaPiece'
import { CATEGORIE_DU_DETAIL } from '../../../../../shared/expedition'
import { detailTire, type DetailTire } from '../../../../../shared/cabinet/jeux/detail'
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

export function tirerUnDetail(ctx: ContexteDuTirage, posees: Posees): DetailTire | null {
  const tableaux = tableauxDuDetail()
  const libres = tableaux.filter(t => !posees.ids.has(idDuTableau(t.qid)))
  // Un titre déjà montré ne revient pas en réponse — tant qu'il en reste : cent tableaux, six au plus dans un plan.
  const neufs = libres.filter(t => !posees.titres.has(t.titre))
  const parQid = new Map(tableaux.map(t => [t.qid, t]))
  const choisi = laMoinsVue(neufs.length > 0 ? neufs : libres, t => t.qid, { get: qid => vuLe(parQid.get(qid)!, ctx.vues) })
  if (!choisi) return null
  const question = litLaBase(ctx.porte) ? questionsDesTableaux(ctx.porte, ctx.jouables).get(choisi.qid) : undefined
  const o = { anecdote: question?.anecdote ?? null, categorie: CATEGORIE_DU_DETAIL }
  const vu = (x: TableauDuDetail) => vuLe(x, ctx.vues) !== undefined
  const leSienVu = vu(choisi)
  const deSaFraicheur = libres.filter(x => vu(x) === leSienVu)
  // Moins de quatre titres de sa fraîcheur (`detailTire` rend null sans tirer au hasard) : ses voisins parmi tous.
  const t = detailTire(choisi, deSaFraicheur, ctx.hasard, o) ?? detailTire(choisi, libres, ctx.hasard, o)
  if (!t) return null
  posees.ids.add(idDuTableau(choisi.qid))
  for (const x of t.titres) posees.titres.add(x.titre)
  return t
}
