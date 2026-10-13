// Des questions neuves pour la base, une fois, par l'API : la génération du
// dépôt (`server/scripts/generer-campagne.ts`) telle quelle — son plan, ses
// vagues, son recueil avec le juge et le dédoublonnage, ses fiches de
// relecture, ses décisions —, mais ses missions parties en lot au lieu
// d'agents. Opus relit, comme l'agent du dépôt ; il écrit aussi, sauf
// `--redacteur=sonnet` (l'agent rédacteur est Sonnet pour ménager le forfait,
// le crédit n'a pas cette contrainte).
//
// Le rédacteur n'a pas d'outil : il écrit d'un coup, comme la routine du
// matin, puis le juge relit son lot ; ce qu'il refuse repart chez lui avec
// son motif, deux tours au plus (`CORRECTIONS_MAX`), au lieu de la boucle
// « vérifier, corriger » de l'agent. Ce qui reste refusé, le recueil de la
// vague l'écarte avec son motif, comme d'un lot d'agent.
//
// Depuis la racine du dépôt :
//   npx tsx credit-api/generer.ts preparer --questions=3000 [--categories=Géographie,Sport] [--par-lot=30] [--redacteur=sonnet] [--nom=a1]
//   npx tsx credit-api/generer.ts preparer --nombres=600 [--categories=…] [--redacteur=sonnet] [--nom=n1]     des questions à nombre, pour les estimations
//   NODE_USE_ENV_PROXY=1 npx tsx credit-api/generer.ts avancer [<nom>] [--attendre] [--budget=190] [--forcer]
//   npx tsx credit-api/generer.ts etat [<nom>]
// puis, depuis server/, comme toute génération : base-campagne.ts voisines, puis ranger.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase, type QuestionDeLaBase } from '../server/src/core/baseCampagne'
import { empreintesDesLivres, type QuotaDEcriture } from '../server/src/core/consigneCampagne'
import { lireLEstimation } from '../server/src/core/quizToutPret'
import {
  QUESTIONS_PAR_LOT,
  charger,
  dejaEcrites,
  etat,
  finie,
  planDeLaGeneration,
  preparer,
  repartir,
  sauver,
  suite,
  type Contexte,
  type Generation,
  type LotPrevu,
} from '../server/scripts/generer-campagne'
import { DOSSIER_DES_LOTS, TriDesEntrees, ecrireLot, lotsEnAttente } from '../server/scripts/lots-campagne'
import { CATEGORIES, categorieDe, type Categorie } from '../shared/categories'
import { SOUS_THEMES } from '../shared/etiquettes'
import {
  BUDGET,
  DOSSIER,
  MODELES,
  apiReelle,
  coutDUnMessage,
  coutPrevu,
  depenses,
  dollars,
  ecrireLeCarnet,
  lireLeCarnet,
  lireLesOptions,
  maintenant,
  pause,
  verifierLeBudget,
  verrouiller,
  type API,
  type Demande,
  type LotLu,
} from './api'
import { SORTIE_PAR_QUESTION, SORTIE_PAR_QUESTION_RELUE, decisionsDe, demandeDEcriture, demandeDeCorrection, demandeDeRelecture, questionsDe, type LotAEcrire } from './consignes'

/** Les tours de correction d'un lot, après son écriture : au-delà, le recueil écarte ce qui reste refusé. */
export const CORRECTIONS_MAX = 2

/** Une demande qui échoue trois fois ne repart plus : `--forcer` compte son lot pour vide. */
export const ESSAIS_MAX = 3

/** Ce que l'API sait d'une génération, à côté de son plan : ses lots envoyés, où ranger ce qu'ils rendent. */
export interface EtatDeLAPI {
  nom: string
  /** Une part à nombre : la consigne le dit, et une question qui ne se jouerait pas au plus près repart en correction. */
  nombres: boolean
  /** Le modèle qui écrit, choisi au départ : ses corrections passent par lui aussi. */
  redacteur: string
  lots: { id: string; envoye: string; demandes: string[]; recu?: string; cout?: number }[]
  /** Où écrire ce que chaque demande rend : le lot (`e-…`), ou la fiche relue et ses décisions (`r-…`). */
  cibles: Record<string, { lot?: string; fiche?: string; decisions?: string }>
  /** Le dernier tour d'écriture de chaque lot : 0 le premier, puis ses corrections. */
  tours: Record<string, number>
  essais: Record<string, number>
}

export interface ContexteDeGeneration extends Contexte {
  api: API
  budget: number
  /** Où vivent l'état de l'API, les brouillons et le carnet des dépenses. */
  dossierApi: string
}

const fichierDeLEtat = (dossierApi: string, nom: string) => path.join(dossierApi, `generation-${nom}.json`)
const dossierDesBrouillons = (dossierApi: string, nom: string) => path.join(dossierApi, `generation-${nom}`)
const fichierDuBrouillon = (dossierApi: string, nom: string, lot: string) => path.join(dossierDesBrouillons(dossierApi, nom), `${lot}.json`)

export function sauverLEtat(dossierApi: string, e: EtatDeLAPI) {
  mkdirSync(dossierApi, { recursive: true })
  writeFileSync(fichierDeLEtat(dossierApi, e.nom), `${JSON.stringify(e, null, 2)}\n`)
}

export function chargerLEtat(dossierApi: string, nom: string): EtatDeLAPI {
  const f = fichierDeLEtat(dossierApi, nom)
  if (!existsSync(f)) throw new Error(`« ${nom} » n'a pas été préparée par credit-api/generer.ts : son état manque (${f}).`)
  return JSON.parse(readFileSync(f, 'utf8')) as EtatDeLAPI
}

/** Les lots écrits qui attendent encore une correction, ou leur rendu pour de bon. */
function brouillons(dossierApi: string, nom: string): string[] {
  const d = dossierDesBrouillons(dossierApi, nom)
  return existsSync(d) ? readdirSync(d).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort() : []
}

const lireBrouillon = (dossierApi: string, nom: string, lot: string) => JSON.parse(readFileSync(fichierDuBrouillon(dossierApi, nom, lot), 'utf8')) as unknown[]

function ecrireBrouillon(dossierApi: string, nom: string, lot: string, entrees: readonly unknown[]) {
  mkdirSync(dossierDesBrouillons(dossierApi, nom), { recursive: true })
  writeFileSync(fichierDuBrouillon(dossierApi, nom, lot), `${JSON.stringify(entrees)}\n`)
}

/** Un lot du plan, et sa vague. */
function lotDuPlan(g: Generation, id: string): { l: LotPrevu; w: number } {
  for (const [w, v] of g.vagues.entries()) {
    const l = v.lots.find(x => x.id === id)
    if (l) return { l, w }
  }
  throw new Error(`${id} : aucun lot de ce nom dans ${g.nom}.`)
}

/**
 * Ce que les lots en attente posent, hors ceux de la vague : ce qu'un lot de
 * la vague ne doit pas reprendre — ce que la consigne d'un agent liste, et
 * ce que le recueil refuserait. Lu une fois par vague et par appel.
 */
function memoireDesVagues(ctx: Contexte, g: Generation) {
  const lues = new Map<number, QuestionDeLaBase[]>()
  const dansLaBase = new Set(ctx.base.map(q => q.empreinte))
  return (w: number) => {
    if (!lues.has(w)) lues.set(w, lotsEnAttente(ctx.dossier, dansLaBase, new Set(g.vagues[w].lots.map(l => `${l.id}.json`))).map(a => a.question))
    return lues.get(w)!
  }
}

/** Ce qu'on demande au rédacteur d'un lot : sa part, et ce que ses sous-thèmes ont déjà — la base et les lots en attente. */
function lotAEcrire(ctx: Contexte, l: LotPrevu, enAttente: readonly QuestionDeLaBase[], nombres: boolean): LotAEcrire {
  return { categorie: l.categorie, quotas: l.quotas, deja: dejaEcrites(l, [...ctx.base, ...enAttente]), nombres }
}

/**
 * Ce que le juge refuse d'un lot, comme le recueil le refusera : le juge de la
 * base, puis ce que la base, les quiz livrés, les lots en attente ou le lot
 * lui-même posent déjà. Une part à nombre refuse aussi ce qui ne se jouerait
 * pas au plus près : c'est pour cela qu'on l'a commandée.
 */
export function refusDuLot(ctx: Contexte, enAttente: readonly QuestionDeLaBase[], entrees: readonly unknown[], nombres: boolean): { i: number; motif: string }[] {
  const tri = new TriDesEntrees(ctx.base, ctx.livres)
  for (const q of enAttente) tri.retenir(q, 'un lot en attente')
  const refus: { i: number; motif: string }[] = []
  entrees.forEach((e, i) => {
    const jugee = tri.juger(e, `la question ${i + 1} de ton lot`)
    if ('refus' in jugee) return refus.push({ i, motif: jugee.refus })
    if (nombres) {
      const estimation = lireLEstimation(jugee.question)
      if ('refus' in estimation) refus.push({ i, motif: `ne se jouera pas au plus près : ${estimation.refus}` })
    }
  })
  return refus
}

const LOT_DE_LA_MISSION = /écris tes \d+ questions dans (\S+\.json)/
const FICHE_DE_LA_MISSION = /Ta fiche est dans (\S+\.txt) : relis-la, et écris tes décisions dans (\S+\.json)\./
const refsDeLaFiche = (texte: string) => new Set([...texte.matchAll(/^\[([^\]]+)\]/gm)].map(m => m[1]))

/** Range ce qu'un lot rendu a écrit ou décidé ; rend ce qu'il a coûté. Une réponse illisible compte pour un échec, et repartira. */
function recueillirLeLot(ctx: ContexteDeGeneration, g: Generation, e: EtatDeLAPI, lot: EtatDeLAPI['lots'][number], lu: LotLu, enAttente: (w: number) => QuestionDeLaBase[]): number {
  let cout = 0
  for (const cle of lot.demandes) {
    const rendu = lu.resultats.get(cle)
    if (rendu?.message) cout += coutDUnMessage(rendu.message)
    const echec = (pourquoi: string) => {
      e.essais[cle] = (e.essais[cle] ?? 0) + 1
      ctx.dire(`  ${cle} : ${pourquoi} (échec ${e.essais[cle]}/${ESSAIS_MAX})`)
    }
    if (!rendu) {
      echec('absente du lot rendu')
      continue
    }
    if (rendu.erreur || !rendu.message) {
      echec(rendu.erreur ?? 'sans réponse')
      continue
    }
    const ecriture = /^e-(.+)$/.exec(cle)
    const correction = /^c(\d+)-(.+)$/.exec(cle)
    if (ecriture || correction) {
      const id = ecriture ? ecriture[1] : correction![2]
      const questions = questionsDe(rendu.message)
      if (!questions) {
        echec('pas de tableau JSON')
        continue
      }
      if (ecriture) {
        ecrireBrouillon(ctx.dossierApi, e.nom, id, questions)
        e.tours[id] = 0
      } else if (existsSync(fichierDuBrouillon(ctx.dossierApi, e.nom, id))) {
        // Ce que le juge gardait du lot, puis les remplaçantes : elles se jugeront avec lui au tour suivant.
        const actuelles = lireBrouillon(ctx.dossierApi, e.nom, id)
        const refus = new Set(refusDuLot(ctx, enAttente(lotDuPlan(g, id).w), actuelles, e.nombres).map(r => r.i))
        ecrireBrouillon(ctx.dossierApi, e.nom, id, [...actuelles.filter((_, i) => !refus.has(i)), ...questions])
        e.tours[id] = Number(correction![1])
      }
    } else if (cle.startsWith('r-')) {
      const cible = e.cibles[cle]
      if (!cible?.fiche || !cible.decisions) continue
      const lues = decisionsDe(rendu.message, refsDeLaFiche(readFileSync(cible.fiche, 'utf8')))
      if (!lues) {
        echec('décisions illisibles')
        continue
      }
      // Le fichier que l'agent correcteur aurait écrit : `suite` le lit et l'applique.
      writeFileSync(cible.decisions, `${JSON.stringify(lues.decisions, null, 2)}\n`)
    }
  }
  return cout
}

export type Etape = 'attente' | 'envoye' | 'fini' | 'bloque'

/** Ce que `suite` dit pour des agents, qu'on tait : les missions partent en lot. */
const POUR_LES_AGENTS = /^\s*\[(redacteur|relecteur)-campagne\]|^\s{4}Ta (consigne|fiche) est dans|À lancer — |Rien à lancer/

/**
 * Tout ce qui peut se faire, un lot en route à la fois : recueillir le lot
 * rendu ; rendre pour de bon les lots que le juge accepte (ou qui ont fini
 * leurs tours), renvoyer les autres en correction ; laisser `suite` recueillir,
 * écrire ses fiches et appliquer ses décisions ; envoyer ses missions.
 * `forcer` rend les brouillons tels quels et passe outre ce qu'aucun lot n'a
 * rendu, comme `suite --forcer`.
 */
export async function avancerLaGeneration(ctx: ContexteDeGeneration, g: Generation, e: EtatDeLAPI, { forcer = false } = {}): Promise<Etape> {
  const carnet = lireLeCarnet(ctx.dossierApi)
  const sauverTout = () => {
    sauverLEtat(ctx.dossierApi, e)
    ecrireLeCarnet(carnet, ctx.dossierApi)
  }
  let enAttente = memoireDesVagues(ctx, g)
  const enVol = e.lots.find(l => !l.recu)
  if (enVol) {
    const lu = await ctx.api.lire(enVol.id)
    if (!lu.fini) {
      ctx.dire(`${g.nom} : le lot ${enVol.id} n'est pas encore rendu — ${lu.resume}.`)
      return 'attente'
    }
    const cout = recueillirLeLot(ctx, g, e, enVol, lu, enAttente)
    enVol.recu = maintenant()
    enVol.cout = cout
    const inscrit = carnet.lots.find(l => l.id === enVol.id)
    if (inscrit) Object.assign(inscrit, { recu: enVol.recu, cout })
    sauverTout()
    ctx.dire(`${g.nom} : lot ${enVol.id} rendu, ${dollars(cout)}.`)
  }

  const demandes: Demande[] = []
  const prevus: number[] = []
  for (const id of brouillons(ctx.dossierApi, e.nom)) {
    const { l, w } = lotDuPlan(g, id)
    const entrees = lireBrouillon(ctx.dossierApi, e.nom, id)
    const refus = refusDuLot(ctx, enAttente(w), entrees, e.nombres)
    const tour = e.tours[id] ?? 0
    const cle = `c${tour + 1}-${id}`
    if (!forcer && refus.length > 0 && tour < CORRECTIONS_MAX && (e.essais[cle] ?? 0) < ESSAIS_MAX) {
      const refuses = new Set(refus.map(r => r.i))
      const gardees = entrees.filter((_, i) => !refuses.has(i)).map(x => String((x as { texte?: unknown })?.texte ?? ''))
      const refusees = refus.map(r => {
        const x = (entrees[r.i] ?? {}) as Record<string, unknown>
        return { texte: String(x.texte ?? '(illisible)'), sousTheme: String(x.sousTheme ?? '?'), difficulte: x.difficulte, motif: r.motif }
      })
      const d = demandeDeCorrection(cle, lotAEcrire(ctx, l, enAttente(w), e.nombres), gardees, refusees, e.redacteur)
      demandes.push(d)
      prevus.push(coutPrevu(d, refusees.length * SORTIE_PAR_QUESTION))
      continue
    }
    const lot = e.cibles[`e-${id}`]?.lot
    if (!lot) throw new Error(`${id} : on ne sait plus où écrire son lot.`)
    ecrireLot(lot, entrees)
    rmSync(fichierDuBrouillon(ctx.dossierApi, e.nom, id))
    ctx.dire(`  ${id} : ${entrees.length - refus.length}/${entrees.length} gardées par le juge${refus.length > 0 ? ` — le recueil écartera les ${refus.length} autres, avec leur motif` : ''}.`)
  }
  sauverTout()

  // Les lots rendus changent ce qui attend : relu après eux.
  enAttente = memoireDesVagues(ctx, g)
  const dites: string[] = []
  const missions = suite({ ...ctx, dire: l => dites.push(l) }, g, { forcer })
  for (const l of dites) if (!POUR_LES_AGENTS.test(l)) ctx.dire(l)
  const enCorrection = new Set(brouillons(ctx.dossierApi, e.nom))
  const abandonnees: string[] = []
  for (const m of missions) {
    if (m.agent === 'redacteur-campagne') {
      const id = m.quoi.split(' · ')[0]
      if (enCorrection.has(id)) continue
      const cle = `e-${id}`
      if ((e.essais[cle] ?? 0) >= ESSAIS_MAX) {
        abandonnees.push(cle)
        continue
      }
      const lot = LOT_DE_LA_MISSION.exec(m.mission)?.[1]
      if (!lot) throw new Error(`Une mission de rédaction ne se lit plus : ${m.mission}`)
      const { l, w } = lotDuPlan(g, id)
      const d = demandeDEcriture(cle, lotAEcrire(ctx, l, enAttente(w), e.nombres), e.redacteur)
      e.cibles[cle] = { lot }
      demandes.push(d)
      prevus.push(coutPrevu(d, l.quotas.reduce((s, q) => s + q.n, 0) * SORTIE_PAR_QUESTION))
    } else {
      const lue = FICHE_DE_LA_MISSION.exec(m.mission)
      if (!lue) throw new Error(`Une mission de relecture ne se lit plus : ${m.mission}`)
      const [, fiche, decisions] = lue
      const cle = `r-${path.basename(fiche, '.txt')}`
      if ((e.essais[cle] ?? 0) >= ESSAIS_MAX) {
        abandonnees.push(cle)
        continue
      }
      const texte = readFileSync(fiche, 'utf8')
      const d = demandeDeRelecture(cle, texte, 'lots')
      e.cibles[cle] = { fiche, decisions }
      demandes.push(d)
      prevus.push(coutPrevu(d, refsDeLaFiche(texte).size * SORTIE_PAR_QUESTION_RELUE))
    }
  }
  if (demandes.length === 0) {
    sauverTout()
    if (finie(g)) return 'fini'
    ctx.dire(
      abandonnees.length > 0
        ? `${g.nom} : abandonnées après ${ESSAIS_MAX} échecs — ${abandonnees.join(', ')}. « avancer --forcer » compte leurs lots pour vides et met de côté les fiches sans décisions.`
        : `${g.nom} : rien à envoyer.`,
    )
    return 'bloque'
  }
  const prevu = prevus.reduce((s, x) => s + x, 0)
  verifierLeBudget(carnet, prevu, ctx.budget)
  const id = await ctx.api.envoyer(demandes)
  const envoye = maintenant()
  // Noté sitôt envoyé : un lot dont on perd l'identifiant est payé pour rien.
  e.lots.push({ id, envoye, demandes: demandes.map(d => d.id) })
  carnet.lots.push({ id, pour: `generer ${g.nom}`, envoye, demandes: demandes.length, prevu })
  sauverTout()
  const compte = (prefixe: RegExp) => demandes.filter(d => prefixe.test(d.id)).length
  ctx.dire(`${g.nom} : lot ${id} envoyé — ${compte(/^e-/)} écriture(s), ${compte(/^c\d+-/)} correction(s), ${compte(/^r-/)} relecture(s), de l'ordre de ${dollars(prevu)}.`)
  return 'envoye'
}

/**
 * Une part à nombre, répartie entre les catégories, dans les sous-thèmes où
 * un nombre se pose déjà naturellement — trois questions au moins s'y jouent
 * au plus près —, les plus fournis d'abord ; tous, si une catégorie n'en a
 * aucun. La difficulté, c'est la consigne des nombres qui la dit : surtout
 * des 2, ce qui manquait le plus (le 13 octobre 2026, neuf estimations de
 * difficulté 1 et 137 de difficulté 2 sur 647).
 */
export function commandeDesNombres(base: readonly QuestionDeLaBase[], total: number, categories: readonly Categorie[] = CATEGORIES): Map<Categorie, QuotaDEcriture[]> {
  const jouables = base.filter(q => !('refus' in lireLEstimation(q)))
  const commandes = new Map<Categorie, QuotaDEcriture[]>()
  for (const [c, n] of repartir(total, categories)) {
    if (n === 0) continue
    const catalogue = SOUS_THEMES[c].map(s => s.cle)
    const comptes = catalogue.map(cle => ({ cle, n: jouables.filter(q => q.meta.categorie === c && q.meta.sousTheme === cle).length }))
    const naturels = comptes.filter(x => x.n >= 3).sort((a, b) => b.n - a.n)
    const vises = naturels.length > 0 ? naturels : comptes
    const quotas = new Map<string, number>()
    for (let i = 0; i < n; i++) quotas.set(vises[i % vises.length].cle, (quotas.get(vises[i % vises.length].cle) ?? 0) + 1)
    commandes.set(
      c,
      [...quotas].map(([cle, k]) => ({ cle, n: k })).sort((a, b) => catalogue.indexOf(a.cle) - catalogue.indexOf(b.cle)),
    )
  }
  return commandes
}

/** Le premier nom libre de la forme `<lettre>1`, `<lettre>2`… : ni son dossier, ni un lot à son nom. */
function nomLibre(dossier: string, lettre: string): string {
  const pris = existsSync(dossier) ? readdirSync(dossier) : []
  for (let i = 1; ; i++) {
    const nom = `${lettre}${i}`
    if (!pris.some(f => f === nom || f.startsWith(`${nom}-`) || f.startsWith(`${nom}.`))) return nom
  }
}

export interface OptionsDeGeneration {
  questions?: number
  nombres?: number
  categories?: readonly Categorie[]
  parLot?: number
  nom?: string
  /** Qui écrit : Opus par défaut, Sonnet pour moitié prix. */
  redacteur?: string
}

/**
 * Le plan, par `generer-campagne.ts` : `questions` à parts égales, là où la
 * base manque le plus (sa `preparer`) ; ou `nombres`, une part à nombre
 * (`commandeDesNombres`), sur le même plan en vagues. Puis l'état de l'API,
 * et ce que la génération coûtera, de l'ordre de.
 */
export function preparerLaGeneration(ctx: Omit<ContexteDeGeneration, 'api' | 'budget'>, o: OptionsDeGeneration): { g: Generation; e: EtatDeLAPI; prevu: number } {
  if ((o.questions === undefined) === (o.nombres === undefined)) throw new Error('--questions=<n> ou --nombres=<n> : l’un des deux.')
  let g: Generation
  if (o.questions !== undefined) {
    const dites: string[] = []
    g = preparer({ ...ctx, dire: l => dites.push(l) }, { questions: o.questions, categories: o.categories, parLot: o.parLot, nom: o.nom }).generation
    for (const l of dites) if (!POUR_LES_AGENTS.test(l)) ctx.dire(l)
  } else {
    const n = o.nombres!
    if (!Number.isInteger(n) || n < 1) throw new Error('--nombres=<n> : combien de questions à nombre.')
    let derniere: Generation | null = null
    try {
      derniere = charger(ctx)
    } catch {
      derniere = null
    }
    if (derniere && !finie(derniere)) throw new Error(`« ${derniere.nom} » n'est pas finie : mène-la au bout d'abord — deux générations viseraient les mêmes sous-thèmes.`)
    mkdirSync(ctx.dossier, { recursive: true })
    const nom = o.nom ?? nomLibre(ctx.dossier, 'n')
    if (!/^[A-Za-z0-9]{1,20}$/.test(nom)) throw new Error(`--nom : des lettres et des chiffres seulement (${nom}).`)
    if (readdirSync(ctx.dossier).some(f => f === nom || f.startsWith(`${nom}-`) || f.startsWith(`${nom}.`))) throw new Error(`« ${nom} » existe déjà dans ${ctx.dossier} : choisis un autre --nom.`)
    const lues = [...ctx.base, ...lotsEnAttente(ctx.dossier, new Set(ctx.base.map(q => q.empreinte))).map(a => a.question)]
    const connues = lues.map(q => ({ categorie: q.meta.categorie, sousTheme: q.meta.sousTheme, difficulte: q.meta.difficulte }))
    const commandes = commandeDesNombres(ctx.base, n, o.categories)
    g = { nom, creee: maintenant(), demandees: n, vagues: planDeLaGeneration(connues, { nom, questions: n, commandes, parLot: o.parLot ?? QUESTIONS_PAR_LOT }) }
    sauver(ctx, g)
    ctx.dire(`${nom} : ${n} questions à nombre, en ${g.vagues.flatMap(v => v.lots).length} lots et ${g.vagues.length} vague(s).`)
    for (const [c, quotas] of commandes) ctx.dire(`  ${c} : ${quotas.map(q => `${q.cle} ${q.n}`).join(' · ')}`)
  }
  const redacteur = o.redacteur ?? MODELES.opus
  if (!Object.values(MODELES).includes(redacteur as (typeof MODELES)[keyof typeof MODELES])) throw new Error(`--redacteur : opus ou sonnet (${redacteur}).`)
  const e: EtatDeLAPI = { nom: g.nom, nombres: o.nombres !== undefined, redacteur, lots: [], cibles: {}, tours: {}, essais: {} }
  sauverLEtat(ctx.dossierApi, e)
  // De l'ordre de : le premier lot, rapporté à toutes les questions, un tour de correction sur six, et la relecture.
  const premier = g.vagues[0].lots[0]
  const taille = premier.quotas.reduce((s, q) => s + q.n, 0)
  const ecriture = coutPrevu(demandeDEcriture('e-estimation', lotAEcrire(ctx, premier, [], e.nombres), redacteur), taille * SORTIE_PAR_QUESTION) / taille
  const relecture = coutPrevu(demandeDeRelecture('r-estimation', 'x'.repeat(450 * 100), 'lots'), 100 * SORTIE_PAR_QUESTION_RELUE) / 100
  const prevu = g.demandees * (ecriture * (1 + 1 / 6) + relecture)
  ctx.dire(
    `De l'ordre de ${dollars(prevu)} pour ${g.demandees} questions (${dollars((prevu / g.demandees) * 1000)} les mille), écrites par ${redacteur}, corrections et relecture comprises.`,
  )
  return { g, e, prevu }
}

// ── La ligne de commande ────────────────────────────────────────────────

async function principal(args: readonly string[]) {
  const [commande, ...reste] = args
  const dire = (l: string) => console.log(l)
  const base = () => {
    const { questions, refusees } = lireLaBase()
    if (refusees.length > 0) throw new Error(`La base a ${refusees.length} entrée(s) défectueuse(s) : corrige-les d'abord.`)
    return questions
  }
  const contexte = (): Omit<ContexteDeGeneration, 'api' | 'budget'> => ({ dossier: DOSSIER_DES_LOTS, base: base(), livres: empreintesDesLivres(), dire, dossierApi: DOSSIER })
  if (commande === 'preparer') {
    const { options } = lireLesOptions(reste, ['questions', 'nombres', 'categories', 'par-lot', 'nom', 'redacteur'])
    const nombre = (cle: string) => (options.has(cle) ? Number(options.get(cle)) : undefined)
    const categories = options.get('categories')?.split(',').map(nom => {
      const c = categorieDe(nom)
      if (!c) throw new Error(`Catégorie inconnue : ${nom} (${CATEGORIES.join(', ')}).`)
      return c
    })
    const qui = options.get('redacteur')
    const redacteur = qui === undefined ? undefined : (MODELES as Record<string, string>)[qui] ?? qui
    preparerLaGeneration(contexte(), { questions: nombre('questions'), nombres: nombre('nombres'), categories, parLot: nombre('par-lot'), nom: options.get('nom'), redacteur })
  } else if (commande === 'avancer') {
    const { mots, options } = lireLesOptions(reste, ['attendre', 'budget', 'forcer'])
    const budget = options.has('budget') ? Number(options.get('budget')) : BUDGET
    const api = apiReelle()
    const lacher = verrouiller(DOSSIER)
    try {
      const debut = Date.now()
      for (;;) {
        const ctx: ContexteDeGeneration = { ...contexte(), api, budget }
        const g = charger(ctx, mots[0])
        const etape = await avancerLaGeneration(ctx, g, chargerLEtat(DOSSIER, g.nom), { forcer: options.has('forcer') })
        if (etape === 'fini' || etape === 'bloque' || !options.has('attendre')) break
        if (Date.now() - debut > 7 * 3600_000) throw new Error('Sept heures d’attente : relance « avancer --attendre » plus tard.')
        await pause(60_000)
      }
    } finally {
      lacher()
    }
  } else if (commande === 'etat') {
    const { mots } = lireLesOptions(reste, [])
    const ctx = contexte()
    const g = charger(ctx, mots[0])
    etat(ctx, g)
    const e = chargerLEtat(DOSSIER, g.nom)
    const carnet = lireLeCarnet(DOSSIER)
    const siens = new Set(e.lots.map(l => l.id))
    const cout = carnet.lots.filter(l => siens.has(l.id)).reduce((s, l) => s + (l.cout ?? 0), 0)
    const { depense, engage } = depenses(carnet)
    dire(`Par l'API : ${e.lots.length} lot(s), ${dollars(cout)} pour ${g.nom} ; en tout, ${dollars(depense)} dépensés${engage > 0 ? `, ${dollars(engage)} en route` : ''}. Brouillons en correction : ${brouillons(DOSSIER, g.nom).join(', ') || 'aucun'}.`)
  } else {
    dire('generer.ts preparer --questions=<n> | preparer --nombres=<n> | avancer [<nom>] [--attendre] [--forcer] | etat [<nom>] — le détail en tête du script.')
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).catch(e => {
    console.error((e as Error).message)
    process.exitCode = 1
  })
}
