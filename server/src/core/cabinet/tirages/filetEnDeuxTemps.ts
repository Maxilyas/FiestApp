// Le tireur du Filet en deux temps (`shared/cabinet/jeux/filetEnDeuxTemps.ts` ; le cahier des charges,
// `retours/2026-11-09/le-nouveau-filet.md`) : une question du contenu du Filet (`server/content/cabinet/filet.json` —
// le vivier classé une question à la fois, la note du panel, un indice jugé à l'aveugle), tirée à l'acte de l'épreuve
// plutôt qu'à une marche : l'acte I parmi ce que chaque Français sait placer, ou que le panel donne à 50 % et plus —
// le levier le plus fort, « des questions que chacun connaisse », le propriétaire, au matin du 9 novembre 2026 —,
// l'acte II de 25 à 49, l'acte III sous 25 (`acteDuFilet`). Ce qui se calcule n'y entre pas : « les grammes d'un
// kilogramme » se trouvent sans rien savoir.
//
// Ce qui se tire se tire ici, du hasard du serveur (`ctx.hasard`), jamais de la graine que la page ne voit pas : la
// place de la réponse parmi ses quatre époques — avec les poids de l'acte, calculés sur les années qu'il pose à l'année
// du départ (`poidsDesPlaces`) : au hasard parmi les places qui restent, « toujours la dernière époque » gagnait 29 % —,
// les deux époques que l'aide retirerait, et les repères, époque d'abord (`reperesDuFilet`). L'année est celle du jour
// de Paris du départ, jamais l'horloge de la machine.
//
// Jamais deux fois la même valeur dans une partie, rechanges comprises — la révélation d'une manche aurait donné la
// suivante —, et les manches tournent sur les catégories. Sans rien à l'acte — un thème promis qui n'en a pas, un acte
// épuisé —, il tire à tous les actes : une épreuve qui ne partirait pas serait pire qu'une question d'un autre acte.
import type { QuestionDeLaBase } from '../../baseCampagne'
import { NIVEAUX, type Niveau } from '../../../../../shared/campagne'
import { CATEGORIES, type Categorie } from '../../../../../shared/categories'
import type { QuestionDuFilet, RepereCommun } from '../../../../../shared/cabinet/contenu'
import {
  acteDuFilet,
  categoriesDuFilet,
  placesPossibles,
  poidsDesPlaces,
  reperesDuFilet,
  seTendEnDeuxTemps,
  tirageEnDeuxTemps,
  tirerLaPlace,
  tranchesDuFilet,
  type FiletEnDeuxTempsTire,
  type RepereDuFilet,
} from '../../../../../shared/cabinet/jeux/filetEnDeuxTemps'
import { anneeDuDepart } from '../../../../../shared/cabinet/partie'
import { jourDe } from '../../../../../shared/jour'
import { contenuDuCabinet } from '../contenu'
import { commeLaPartieLaGarde, uneQuestionDesCategories, type ContexteDuTirage, type Posees } from './communs'
import { valeurDuFilet, valeursDeLaCategorie } from './tas'

/** Toutes les marches : l'acte trie, pas la marche mesurée (`acteDuFilet`). */
const TOUTES_LES_MARCHES: readonly Niveau[] = NIVEAUX

/** Le contenu du Filet, par identifiant : lu une fois par processus, rangé une fois. */
const PAR_IDENTIFIANT = new WeakMap<readonly QuestionDuFilet[], ReadonlyMap<string, QuestionDuFilet>>()
function parIdentifiant(filet: readonly QuestionDuFilet[]): ReadonlyMap<string, QuestionDuFilet> {
  let m = PAR_IDENTIFIANT.get(filet)
  if (!m) PAR_IDENTIFIANT.set(filet, (m = new Map(filet.map(q => [q.id, q]))))
  return m
}

/**
 * Les poids des places de chaque acte, à l'année du départ : calculés sur les années que l'acte pose — l'acte I est
 * plein d'années récentes, que l'avenir force à droite —, une fois par liste de jouables et par année. Lus dans les tas
 * des valeurs, déjà prêts pour le tirage (`valeursDeLaCategorie`) : jamais les vingt-cinq mille jouables au crible sur
 * le chemin d'un départ (règle `cabinet.md`).
 */
const POIDS = new WeakMap<readonly QuestionDeLaBase[], Map<string, Record<number, number[]>>>()
function poidsDeLActe(ctx: Pick<ContexteDuTirage, 'porte' | 'jouables'>, filet: ReadonlyMap<string, QuestionDuFilet>, acte: number, annee: number): Record<number, number[]> {
  let parActe = POIDS.get(ctx.jouables)
  if (!parActe) POIDS.set(ctx.jouables, (parActe = new Map()))
  const cle = `${acte}|${annee}`
  let poids = parActe.get(cle)
  if (!poids) {
    const annees: number[] = []
    for (const c of CATEGORIES)
      for (const q of valeursDeLaCategorie(ctx.porte, ctx.jouables, c)) {
        const e = filet.get(q.id)
        const v = e && acteDuFilet(e) === acte ? valeurDuFilet(q) : null
        if (v?.annee && seTendEnDeuxTemps(v.valeur, true, annee)) annees.push(v.valeur)
      }
    parActe.set(cle, (poids = poidsDesPlaces(annees, annee)))
  }
  return poids
}

/**
 * Les catégories où chaque acte a de quoi tirer une épreuve, à l'année du départ (`categoriesDuFilet`) : la carte d'une
 * traversée n'en promet pas d'autre au Filet. Les questions sont celles que le tireur pose (`posable`, plus bas), lues
 * dans les tas des valeurs, une fois par liste de jouables et par année.
 */
const CATEGORIES_DU_FILET = new WeakMap<readonly QuestionDeLaBase[], Map<number, Categorie[][]>>()
export function categoriesDuFiletALAnnee(ctx: Pick<ContexteDuTirage, 'porte' | 'jouables'>, annee: number): Categorie[][] {
  let parAnnee = CATEGORIES_DU_FILET.get(ctx.jouables)
  if (!parAnnee) CATEGORIES_DU_FILET.set(ctx.jouables, (parAnnee = new Map()))
  let categories = parAnnee.get(annee)
  if (!categories) {
    const filet = parIdentifiant(contenuDuCabinet().filet)
    const questions: { categorie: Categorie; acte: number; valeur: number }[] = []
    for (const categorie of CATEGORIES)
      for (const q of valeursDeLaCategorie(ctx.porte, ctx.jouables, categorie)) {
        const e = filet.get(q.id)
        const v = e ? valeurDuFilet(q) : null
        if (e && v && seTendEnDeuxTemps(v.valeur, v.annee, annee)) questions.push({ categorie, acte: acteDuFilet(e), valeur: v.valeur })
      }
    parAnnee.set(annee, (categories = categoriesDuFilet(questions)))
  }
  return categories
}

/** Une unité telle qu'elle se compare : sans capitale, et ses deux écritures de la base pour une (« minutes » et « min »). */
const SYNONYMES: Readonly<Record<string, string>> = { minutes: 'min', minute: 'min', mètres: 'm', mètre: 'm' }
const uniteComparee = (u: string) => SYNONYMES[u.toLowerCase()] ?? u.toLowerCase()

/** Les repères communs d'une question : des années pour une année, de la même unité pour une grandeur — une tour Eiffel ne se pose pas sur des grammes. */
function reperesCommuns(reperes: readonly RepereCommun[], annee: boolean, unite: string | undefined): RepereDuFilet[] {
  const u = unite === undefined ? null : uniteComparee(unite)
  return reperes.filter(r => (annee ? r.unite === null : r.unite !== null && uniteComparee(r.unite) === u)).map(r => ({ valeur: r.valeur, texte: r.texte }))
}

export function tirerUnFiletEnDeuxTemps(ctx: ContexteDuTirage, posees: Posees): FiletEnDeuxTempsTire | null {
  const annee = anneeDuDepart({ jour: jourDe(ctx.maintenant) })
  const contenu = contenuDuCabinet()
  const filet = parIdentifiant(contenu.filet)
  const acte = ctx.vise?.acte ?? 0
  const ecartees = new Set<string>()
  const posable = (q: QuestionDeLaBase, aLActe: boolean) => {
    const e = filet.get(q.id)
    if (!e || (aLActe && acteDuFilet(e) !== acte) || ecartees.has(q.id)) return false
    const v = valeurDuFilet(q)
    return v !== null && seTendEnDeuxTemps(v.valeur, v.annee, annee) && !posees.reponses.has(String(v.valeur))
  }
  const tas = (c: Parameters<typeof valeursDeLaCategorie>[2]) => valeursDeLaCategorie(ctx.porte, ctx.jouables, c)
  // Une question écartée à chaque tour : le tirage finit, sur une manche ou sur rien.
  for (;;) {
    const tiree =
      uneQuestionDesCategories(ctx, posees, tas, TOUTES_LES_MARCHES, q => posable(q, true)) ??
      uneQuestionDesCategories(ctx, posees, tas, TOUTES_LES_MARCHES, q => posable(q, false))
    if (!tiree) return null
    const q = tiree.question
    const v = valeurDuFilet(q)
    const e = filet.get(q.id)
    const place = v && tirerLaPlace(placesPossibles(v.valeur, v.annee, annee), ctx.hasard, v.annee ? poidsDeLActe(ctx, filet, e ? acteDuFilet(e) : acte, annee) : undefined)
    const cadre = v && place !== null ? tranchesDuFilet(v.valeur, v.annee, place, annee) : null
    if (!v || !e || place === null || !cadre) {
      ecartees.add(q.id)
      continue
    }
    const question = commeLaPartieLaGarde(tiree)
    const reperes = reperesDuFilet({ texte: q.texte, valeur: v.valeur, annee: v.annee, tranches: cadre.tranches }, { siens: [], communs: reperesCommuns(contenu.reperes, v.annee, v.unite) }, ctx.hasard)
    const t = tirageEnDeuxTemps({ question, valeur: v.valeur, annee: v.annee, ...(v.unite !== undefined && { unite: v.unite }), place, anneeDuDepart: annee, reperes, indice: e.indice }, ctx.hasard)
    if (!t) {
      ecartees.add(q.id)
      continue
    }
    posees.prendre(question)
    posees.reponses.add(String(v.valeur))
    posees.categories.push(q.meta.categorie)
    return t
  }
}
