// Le tireur de la Frise : ses trois manches d'un coup — une seule frise, qui
// grandit de l'une à l'autre (`friseEnVagues`, la règle du jeu) —, et jamais
// de rechange : Changer n'y sert pas. Deux sortes de frises : celles à thème,
// écrites pour le Cabinet (`server/content/cabinet/frises.json`), et celles des
// sujets de la base, dont chaque événement est une question datée
// (`frisesDesSujets`), sept tirées par `choisirLaFriseSansRepli` — jamais sous
// l'écart, jamais par `choisirLaFrise`, celle de l'Expédition, qui le
// resserre : la règle refuserait ensuite deux années trop proches.
//
// L'une et l'autre en alternance de fraîcheur : une frise à thème est fraîche
// s'il ne l'a pas rangée ces sept jours (`JOURS_SANS_REDITE`), celle d'un sujet
// si aucune question de ses sept événements n'a été vue ces sept jours — au
// Cabinet, dépliée de sa pièce, ou ailleurs dans la campagne. Fraîches toutes
// deux, le hasard du serveur choisit ; une seule, c'est elle ; aucune, le
// hasard encore, parmi la moins vue de chaque sorte. Un sujet se tire dans un
// ordre battu, le premier qui donne sept événements frais l'emporte : un ou
// deux sujets lus d'ordinaire ; les soixante seulement pour qui a tout vu.
import type { QuestionDeLaBase } from '../../baseCampagne'
import { laMoinsVue } from '../../tirageALaPiece'
import { contenuDuCabinet } from '../contenu'
import { ECART_DES_ANNEES_DE_LA_FRISE, EVENEMENTS_D_UNE_FRISE_A_THEME, VAGUES_DE_LA_FRISE } from '../../../../../shared/cabinet/bareme'
import type { FriseATheme } from '../../../../../shared/cabinet/contenu'
import { friseEnVagues, type FriseAPartager, type FriseTiree } from '../../../../../shared/cabinet/jeux/frise'
import { battre } from '../../../../../shared/cabinet/jeux/outils'
import { idDeLaFriseATheme } from '../../../../../shared/cabinet/pieces'
import { NIVEAUX, niveauDeQuestion } from '../../../../../shared/campagne'
import { choisirLaFriseSansRepli, type EvenementDeLaFrise } from '../../../../../shared/frise'
import { FENETRE_DU_CABINET_MS, type ContexteDuTirage } from './communs'
import { frisesDesSujets, litLaBase } from './tas'

/** Une frise candidate, et si elle est fraîche. */
interface Candidate {
  frise: FriseAPartager
  fraiche: boolean
}

/** Vue ces sept jours : ce qui ne revient qu'en dernier recours. */
const recente = (ctx: ContexteDuTirage, le: number | undefined) => le !== undefined && ctx.maintenant - le < FENETRE_DU_CABINET_MS

/** La dernière fois qu'il a rangé une frise à thème : l'une de ses pièces, une par vague (`cab:frise:t:<frise>:<manche>`). */
function rangeeLe(f: FriseATheme, vues: ContexteDuTirage['vues']): number | undefined {
  let le: number | undefined
  for (let k = 0; k < VAGUES_DE_LA_FRISE.length; k++) {
    const v = vues.get(idDeLaFriseATheme(f.id, k))
    if (v !== undefined && (le === undefined || v > le)) le = v
  }
  return le
}

/** La frise à thème la moins vue : jamais rangée d'abord, au hasard, puis la plus anciennement rangée. */
function aThemeLaMoinsVue(ctx: ContexteDuTirage): Candidate | null {
  const frises = contenuDuCabinet().frises
  const parId = new Map(frises.map(f => [f.id, f]))
  const f = laMoinsVue(frises, x => x.id, { get: id => rangeeLe(parId.get(id)!, ctx.vues) })
  if (!f) return null
  return {
    frise: { sorte: 'theme', cle: f.id, theme: f.theme, evenements: f.evenements.map(e => ({ libelle: e.libelle, annee: e.annee })), savais: f.savais, categorie: f.categorie },
    fraiche: !recente(ctx, rangeeLe(f, ctx.vues)),
  }
}

/** La catégorie la plus présente parmi ses événements — la première dans le temps, à égalité : sa pièce en porte une, que les missions lisent. */
function categorieDe(evenements: readonly EvenementDeLaFrise[]): string {
  const comptes = new Map<string, number>()
  for (const e of evenements) comptes.set(e.categorie, (comptes.get(e.categorie) ?? 0) + 1)
  return evenements.reduce((a, e) => ((comptes.get(e.categorie) ?? 0) > (comptes.get(a) ?? 0) ? e.categorie : a), evenements[0].categorie)
}

/** La marche du milieu de ses sept questions, mesurées : « la marche de son sujet ». */
function niveauDe(evenements: readonly EvenementDeLaFrise[], parId: ReadonlyMap<string, QuestionDeLaBase>, ctx: ContexteDuTirage) {
  const rangs = evenements
    .map(e => parId.get(e.id))
    .filter((q): q is QuestionDeLaBase => q !== undefined)
    .map(q => NIVEAUX.indexOf(niveauDeQuestion(q.meta.difficulte, ctx.mesures.get(q.id))))
    .sort((a, b) => a - b)
  return rangs.length > 0 ? NIVEAUX[rangs[Math.floor(rangs.length / 2)]] : undefined
}

/**
 * La frise d'un sujet qui garde le plus d'événements frais : les sujets dans un
 * ordre battu, chacun sa meilleure suite (`choisirLaFriseSansRepli`, le plus de
 * questions pas vues ces sept jours), le premier tout frais l'emporte. Son
 * « Le savais-tu ? » : l'anecdote de la plus ancienne de ses questions qui en a.
 */
function deSujetLaPlusFraiche(ctx: ContexteDuTirage): Candidate | null {
  if (!litLaBase(ctx.porte)) return null
  const parId = ctx.porte.parIdDe(ctx.jouables)
  const dejaVu = (id: string) => recente(ctx, ctx.vues.get(id))
  let meilleure: { cle: string; nom: string; choisis: EvenementDeLaFrise[]; frais: number } | null = null
  for (const s of battre(frisesDesSujets(ctx.porte, ctx.jouables), ctx.hasard)) {
    const choisis = choisirLaFriseSansRepli(s.evenements, ECART_DES_ANNEES_DE_LA_FRISE, EVENEMENTS_D_UNE_FRISE_A_THEME, ctx.hasard, dejaVu)
    if (!choisis) continue
    const frais = choisis.filter(e => !dejaVu(e.id)).length
    if (!meilleure || frais > meilleure.frais) meilleure = { cle: s.cle, nom: s.nom, choisis, frais }
    if (frais === choisis.length) break
  }
  if (!meilleure) return null
  const { cle, nom, choisis } = meilleure
  const niveau = niveauDe(choisis, parId, ctx)
  return {
    frise: {
      sorte: 'sujet',
      cle,
      theme: nom,
      evenements: choisis.map(e => ({ libelle: e.evenement, annee: e.annee, id: e.id })),
      savais: choisis.map(e => parId.get(e.id)?.anecdote).find((a): a is string => typeof a === 'string' && a !== '') ?? null,
      categorie: categorieDe(choisis),
      ...(niveau && { niveau }),
    },
    fraiche: meilleure.frais === choisis.length,
  }
}

/** Les trois manches d'une Frise : la fraîche des deux sortes, ou l'une au hasard ; null sans aucune frise à poser. */
export function tirerUneFrise(ctx: ContexteDuTirage): FriseTiree[] | null {
  const aTheme = aThemeLaMoinsVue(ctx)
  const deSujet = deSujetLaPlusFraiche(ctx)
  const auHasard = () => (ctx.hasard() < 0.5 ? [aTheme, deSujet] : [deSujet, aTheme])
  const ordre = aTheme && deSujet && aTheme.fraiche !== deSujet.fraiche ? (aTheme.fraiche ? [aTheme, deSujet] : [deSujet, aTheme]) : auHasard()
  // La première qui se partage en vagues : une frise jugée au chargement s'y partage toujours, l'autre reste là s'il le faut.
  for (const c of ordre) {
    const vagues = c && friseEnVagues(c.frise, ctx.hasard)
    if (vagues) return vagues
  }
  return null
}
