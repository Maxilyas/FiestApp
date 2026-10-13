// La base entière relue une fois par Opus, par l'API : une seconde relecture,
// indépendante de celle qui a laissé entrer chaque lot. Une passe sur fiche,
// par catégorie et par sous-thème — retirer, corriger, ou douter —, puis les
// doutes vérifiés sur le web, sources à l'appui ; enfin les décisions
// appliquées à la base : une correction garde l'identifiant de sa question
// (une coquille, l'anecdote, la difficulté), un retrait l'en sort — jamais
// une réponse ne change sous le même identifiant (`campagne-base.md`).
//
// Depuis la racine du dépôt :
//   npx tsx credit-api/relire.ts preparer [--limite=300] [--par-fiche=40] [--effort=high] [--nom=r1] [--toutes]
//   NODE_USE_ENV_PROXY=1 npx tsx credit-api/relire.ts avancer [<nom>] [--attendre] [--budget=190]
//   npx tsx credit-api/relire.ts etat [<nom>]
//   npx tsx credit-api/relire.ts appliquer [<nom>] [--forcer]
//
// `preparer` ne reprend pas ce qu'une relecture d'avant a déjà couvert (le
// pilote), sauf `--toutes`. `avancer` fait tout ce qui peut se faire —
// recueillir le lot rendu, envoyer le suivant — et `--attendre` le refait
// jusqu'au bilan.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOSSIER_DE_LA_BASE, entreeDeLaBase, fichierDeCategorie, lireLaBase, lireQuestionDeLaBase, souffleeParSaRacine, type QuestionDeLaBase } from '../server/src/core/baseCampagne'
import { ficheDUneEntree } from '../server/scripts/lots-campagne'
import { CATEGORIES } from '../shared/categories'
import { SOUS_THEMES } from '../shared/etiquettes'
import {
  BUDGET,
  DOSSIER,
  EFFORTS,
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
  type Carnet,
  type Demande,
  type Effort,
  type LotLu,
} from './api'
import { CHAMPS_DE_CLASSEMENT, CHAMPS_DE_CONTENU, EFFORT_DE_RELECTURE, RECHERCHES_PAR_DOUTE, decisionsDe, demandeDeRelecture, demandeDeVerification, verdictDe, type Champs } from './consignes'

/** Ce qu'une fiche porte : une quarantaine de questions d'une même catégorie, rangées par sous-thème — les voisines se relisent ensemble. */
export const QUESTIONS_PAR_FICHE = 40

/** Une demande qui échoue trois fois ne se renvoie plus : la relecture passe outre, et le dit. */
export const ESSAIS_MAX = 3

/** La sortie d'une question relue, la pensée comprise, selon la réflexion : une estimation, que le pilote mesure. */
const SORTIE_PAR_QUESTION: Readonly<Record<Effort, number>> = { low: 80, medium: 150, high: 300, xhigh: 500, max: 800 }

/** Une vérification : sa pensée et son verdict, puis les pages que ses recherches lui font lire, en entrée. */
const SORTIE_PAR_DOUTE = 3000
const ENTREE_DES_RECHERCHES = 25_000

export interface FicheDeRelecture {
  nom: string
  ids: string[]
}

export interface Decision {
  action: 'retirer' | 'corriger' | 'douter' | 'garder'
  champs?: Champs
  motif: string
  sources?: string[]
}

export interface Relecture {
  nom: string
  creee: string
  /** La réflexion du second correcteur, choisie au départ : le pilote dit ce qu'elle coûte. */
  effort: Effort
  fiches: FicheDeRelecture[]
  /** Les fiches dont la première passe a rendu ses décisions. */
  relues: string[]
  /** La première passe, par identifiant : rien pour une question juste. */
  decisions: Record<string, Decision>
  /** La seconde passe : le verdict de chaque doute, sources à l'appui. */
  verifiees: Record<string, Decision>
  /** Les échecs de chaque demande (`p1-<fiche>`, `p2-<id>`) : au-delà de `ESSAIS_MAX`, elle ne repart plus. */
  essais: Record<string, number>
  lots: { id: string; envoye: string; demandes: string[]; recu?: string; cout?: number }[]
  appliquee?: string
}

export interface ContexteDeRelecture {
  /** Où vivent les relectures et le carnet des dépenses. */
  dossier: string
  base: readonly QuestionDeLaBase[]
  api: API
  budget: number
  dire: (ligne: string) => void
}

const fichierDe = (dossier: string, nom: string) => path.join(dossier, `relecture-${nom}.json`)
const journalDe = (dossier: string, nom: string) => path.join(dossier, `relecture-${nom}.journal.md`)

export function sauver(dossier: string, r: Relecture) {
  mkdirSync(dossier, { recursive: true })
  writeFileSync(fichierDe(dossier, r.nom), `${JSON.stringify(r, null, 2)}\n`)
}

function relectures(dossier: string): Relecture[] {
  if (!existsSync(dossier)) return []
  return readdirSync(dossier)
    .filter(f => /^relecture-[A-Za-z0-9]+\.json$/.test(f))
    .map(f => JSON.parse(readFileSync(path.join(dossier, f), 'utf8')) as Relecture)
    .sort((a, b) => b.creee.localeCompare(a.creee))
}

export function charger(dossier: string, nom?: string): Relecture {
  const r = nom ? relectures(dossier).find(x => x.nom === nom) : relectures(dossier)[0]
  if (!r) throw new Error(nom ? `Aucune relecture « ${nom} » dans ${dossier}.` : `Aucune relecture dans ${dossier} : prépares-en une avec « preparer ».`)
  return r
}

/** Un ordre tiré au hasard mais toujours le même : le pilote prend un peu de partout, et se rejoue pareil. */
const tirage = (id: string) => createHash('sha1').update(id).digest('hex')

/**
 * Les fiches d'une relecture : les questions de la base que nulle relecture
 * d'avant n'a couvertes (sauf `toutes`) — ou `limite` d'entre elles, tirées
 * de partout —, par catégorie dans l'ordre du catalogue, puis par sous-thème.
 */
export function preparerLaRelecture(
  ctx: Pick<ContexteDeRelecture, 'dossier' | 'base' | 'dire'>,
  {
    limite,
    parFiche = QUESTIONS_PAR_FICHE,
    nom,
    toutes = false,
    effort = EFFORT_DE_RELECTURE.base,
  }: { limite?: number; parFiche?: number; nom?: string; toutes?: boolean; effort?: Effort } = {},
): Relecture {
  if (!EFFORTS.includes(effort)) throw new Error(`--effort : ${EFFORTS.join(', ')}.`)
  const avant = relectures(ctx.dossier)
  const enCours = avant.find(r => !r.appliquee)
  if (enCours) throw new Error(`« ${enCours.nom} » n'est pas appliquée : mène-la au bout (« avancer », puis « appliquer ${enCours.nom} »).`)
  const libre = (() => {
    for (let i = 1; ; i++) if (!avant.some(r => r.nom === `r${i}`)) return `r${i}`
  })()
  const n = nom ?? libre
  if (!/^[A-Za-z0-9]{1,20}$/.test(n)) throw new Error(`--nom : des lettres et des chiffres seulement (${n}).`)
  if (avant.some(r => r.nom === n)) throw new Error(`« ${n} » existe déjà : choisis un autre --nom.`)
  if (!Number.isInteger(parFiche) || parFiche < 5 || parFiche > 100) throw new Error('--par-fiche : de 5 à 100 questions.')
  const deja = new Set(toutes ? [] : avant.flatMap(r => r.fiches.flatMap(f => f.ids)))
  let vises = ctx.base.filter(q => !deja.has(q.id))
  if (limite !== undefined) {
    if (!Number.isInteger(limite) || limite < 1) throw new Error('--limite : un nombre de questions.')
    vises = [...vises].sort((a, b) => tirage(a.id).localeCompare(tirage(b.id))).slice(0, limite)
  }
  const fiches: FicheDeRelecture[] = []
  for (const c of CATEGORIES) {
    const ordre = SOUS_THEMES[c].map(s => s.cle)
    const siennes = vises.filter(q => q.meta.categorie === c).sort((a, b) => ordre.indexOf(a.meta.sousTheme) - ordre.indexOf(b.meta.sousTheme))
    for (let i = 0; i < siennes.length; i += parFiche) {
      fiches.push({ nom: `f${String(fiches.length + 1).padStart(3, '0')}`, ids: siennes.slice(i, i + parFiche).map(q => q.id) })
    }
  }
  if (fiches.length === 0) throw new Error('Rien à relire : chaque question a déjà sa relecture (--toutes pour la refaire).')
  const r: Relecture = { nom: n, creee: maintenant(), effort, fiches, relues: [], decisions: {}, verifiees: {}, essais: {}, lots: [] }
  sauver(ctx.dossier, r)
  const parId = new Map(ctx.base.map(q => [q.id, q]))
  const prevu = fiches.reduce((s, f) => s + coutPrevu(demandeDeRelecture(`p1-${f.nom}`, ficheDeRelecture(f, parId), 'base', effort), f.ids.length * SORTIE_PAR_QUESTION[effort]), 0)
  ctx.dire(
    `${n} : ${vises.length} questions en ${fiches.length} fiches${deja.size > 0 ? ` (${deja.size} déjà relues, laissées de côté)` : ''}, réflexion ${effort} — la première passe coûtera de l'ordre de ${dollars(prevu)}, les doutes en plus.`,
  )
  return r
}

/**
 * Une question telle que les correcteurs la lisent : la fiche d'un lot
 * (`ficheDUneEntree`), dont la première ligne dit aussi sa catégorie et ses
 * étiquettes — le classement se juge —, et la racine qui souffle sa réponse
 * s'il y en a une.
 */
export function carteDe(q: QuestionDeLaBase): string {
  const m = q.meta
  const [, ...reste] = ficheDUneEntree(q.id, entreeDeLaBase(q)).split('\n')
  const entete = `[${q.id}] ${m.categorie} › ${m.sousTheme} · étiquettes : ${m.etiquettes.join(', ') || 'aucune'} · d${m.difficulte} · ${m.ageMin} ans`
  const racines = souffleeParSaRacine(q)
  return [entete, `  ${q.texte}`, ...reste, ...(racines.length > 0 ? [`  ⚠ racine : ${racines.join(', ')}`] : [])].join('\n')
}

/** La fiche d'aujourd'hui : une question retirée depuis (par le pilote) n'y est plus. */
export function ficheDeRelecture(f: FicheDeRelecture, parId: ReadonlyMap<string, QuestionDeLaBase>): string {
  const q = f.ids.map(id => parId.get(id)).filter((x): x is QuestionDeLaBase => !!x)
  return `${q.map(carteDe).join('\n')}\n`
}

/**
 * Ce qui part ensuite : les fiches pas encore relues ; puis, toutes relues,
 * les doutes pas encore vérifiés. Une demande qui a échoué `ESSAIS_MAX` fois
 * ne repart plus.
 */
export function prochainesDemandes(r: Relecture, parId: ReadonlyMap<string, QuestionDeLaBase>): { demandes: Demande[]; prevu: number; passe: 1 | 2 } {
  const encore = (cle: string) => (r.essais[cle] ?? 0) < ESSAIS_MAX
  const fiches = r.fiches.filter(f => !r.relues.includes(f.nom) && encore(`p1-${f.nom}`))
  // Une fiche dont toutes les questions sont sorties de la base n'a plus rien à relire.
  for (const f of fiches.filter(x => x.ids.every(id => !parId.has(id)))) r.relues.push(f.nom)
  const aRelire = fiches.filter(f => f.ids.some(id => parId.has(id)))
  if (aRelire.length > 0) {
    const demandes = aRelire.map(f => demandeDeRelecture(`p1-${f.nom}`, ficheDeRelecture(f, parId), 'base', r.effort))
    const prevu = demandes.reduce((s, d, i) => s + coutPrevu(d, aRelire[i].ids.length * SORTIE_PAR_QUESTION[r.effort]), 0)
    return { demandes, prevu, passe: 1 }
  }
  const doutes = Object.entries(r.decisions).filter(([id, d]) => d.action === 'douter' && !r.verifiees[id] && parId.has(id) && encore(`p2-${id}`))
  const demandes = doutes.map(([id, d]) => demandeDeVerification(`p2-${id}`, carteDe(parId.get(id)!), d.motif))
  // Les pages lues par les recherches entrent comme une longue consigne : comptées en plus, au prix de l'entrée.
  const prevu = demandes.reduce((s, d) => s + coutPrevu(d, SORTIE_PAR_DOUTE, RECHERCHES_PAR_DOUTE) + (ENTREE_DES_RECHERCHES * 4 * 0.5) / 1e6, 0)
  return { demandes, prevu, passe: 2 }
}

/** Range ce qu'un lot rendu a décidé ; rend ce qu'il a coûté. Une réponse illisible compte pour un échec, et repartira. */
export function recueillir(r: Relecture, lot: Relecture['lots'][number], lu: LotLu, dire: (l: string) => void): number {
  let cout = 0
  for (const cle of lot.demandes) {
    const rendu = lu.resultats.get(cle)
    if (rendu?.message) cout += coutDUnMessage(rendu.message)
    const echec = (pourquoi: string) => {
      r.essais[cle] = (r.essais[cle] ?? 0) + 1
      dire(`  ${cle} : ${pourquoi} (échec ${r.essais[cle]}/${ESSAIS_MAX})`)
    }
    if (!rendu) {
      echec('absente du lot rendu')
      continue
    }
    if (rendu.erreur || !rendu.message) {
      echec(rendu.erreur ?? 'sans réponse')
      continue
    }
    if (cle.startsWith('p1-')) {
      const fiche = r.fiches.find(f => `p1-${f.nom}` === cle)
      if (!fiche) continue
      const lues = decisionsDe(rendu.message, new Set(fiche.ids), { classement: true })
      if (!lues) {
        echec('décisions illisibles')
        continue
      }
      for (const d of lues.decisions) r.decisions[d.ref] = { action: d.action, ...(d.champs ? { champs: d.champs } : {}), motif: d.motif }
      if (lues.ecartees > 0) dire(`  ${cle} : ${lues.ecartees} décision(s) écartée(s) — une référence inconnue, ou une correction sans champ`)
      if (!r.relues.includes(fiche.nom)) r.relues.push(fiche.nom)
    } else if (cle.startsWith('p2-')) {
      const v = verdictDe(rendu.message)
      if (!v) {
        echec('verdict illisible')
        continue
      }
      r.verifiees[cle.slice(3)] = { action: v.action, ...(v.champs ? { champs: v.champs } : {}), motif: v.motif, sources: v.sources }
    }
  }
  return cout
}

export type Etape = 'attente' | 'envoye' | 'fini' | 'bloque'

/** Tout ce qui peut se faire : recueillir le lot rendu, envoyer le suivant — un seul en route à la fois. */
export async function avancer(ctx: ContexteDeRelecture, r: Relecture): Promise<Etape> {
  const carnet = lireLeCarnet(ctx.dossier)
  const sauverTout = () => {
    sauver(ctx.dossier, r)
    ecrireLeCarnet(carnet, ctx.dossier)
  }
  const parId = new Map(ctx.base.map(q => [q.id, q]))
  const enVol = r.lots.find(l => !l.recu)
  if (enVol) {
    const lu = await ctx.api.lire(enVol.id)
    if (!lu.fini) {
      ctx.dire(`${r.nom} : le lot ${enVol.id} n'est pas encore rendu — ${lu.resume}.`)
      return 'attente'
    }
    const cout = recueillir(r, enVol, lu, ctx.dire)
    enVol.recu = maintenant()
    enVol.cout = cout
    const inscrit = carnet.lots.find(l => l.id === enVol.id)
    if (inscrit) Object.assign(inscrit, { recu: enVol.recu, cout })
    sauverTout()
    ctx.dire(`${r.nom} : lot ${enVol.id} rendu, ${dollars(cout)}.`)
  }
  const { demandes, prevu, passe } = prochainesDemandes(r, parId)
  if (demandes.length === 0) {
    sauverTout()
    ctx.dire(bilan(r, carnet))
    const restes = r.fiches.length - r.relues.length + Object.entries(r.decisions).filter(([id, d]) => d.action === 'douter' && !r.verifiees[id] && parId.has(id)).length
    return restes === 0 ? 'fini' : 'bloque'
  }
  verifierLeBudget(carnet, prevu, ctx.budget)
  const id = await ctx.api.envoyer(demandes)
  const envoye = maintenant()
  // Noté sitôt envoyé : un lot dont on perd l'identifiant est payé pour rien.
  r.lots.push({ id, envoye, demandes: demandes.map(d => d.id) })
  carnet.lots.push({ id, pour: `relire ${r.nom}`, envoye, demandes: demandes.length, prevu })
  sauverTout()
  ctx.dire(`${r.nom} : lot ${id} envoyé — ${demandes.length} demande(s) de la passe ${passe}, de l'ordre de ${dollars(prevu)}.`)
  return 'envoye'
}

/** Les champs d'une décision qui sont de son contenu, ou de son classement ; rien s'il n'y en a pas. */
function partDesChamps(champs: Champs | undefined, permis: readonly string[]): Champs | undefined {
  const part = Object.fromEntries(Object.entries(champs ?? {}).filter(([k]) => permis.includes(k)))
  return Object.keys(part).length > 0 ? part : undefined
}

/**
 * Ce que la relecture décide en fin de compte. Un doute se tranche par son
 * verdict ; le reclassement que la première passe y avait joint vaut quoi
 * qu'il dise, sauf un retrait — le classement ne se vérifie pas sur le web.
 * Rien pour ce qu'on garde tel quel, ni pour un doute que personne n'a
 * tranché, hors son reclassement.
 */
export function decisionsFinales(r: Relecture): Map<string, Decision> {
  const finales = new Map<string, Decision>()
  for (const [id, d] of Object.entries(r.decisions)) {
    if (d.action !== 'douter') {
      if (d.action === 'retirer' || d.action === 'corriger') finales.set(id, d)
      continue
    }
    const v = r.verifiees[id]
    const reclasse = partDesChamps(d.champs, CHAMPS_DE_CLASSEMENT)
    if (v?.action === 'retirer') finales.set(id, v)
    else if (v?.action === 'corriger') finales.set(id, { ...v, champs: { ...reclasse, ...partDesChamps(v.champs, CHAMPS_DE_CONTENU) } })
    else if (reclasse) finales.set(id, { action: 'corriger', champs: reclasse, motif: v ? `${d.motif} — vérifié : ${v.motif}` : `${d.motif} — doute pas tranché, seul le classement change`, sources: v?.sources })
  }
  return finales
}

/**
 * Les décisions appliquées aux questions de la base, dans leur ordre. Une
 * correction garde l'identifiant ; celle que le juge refuse, ou qui reprend
 * l'intitulé d'une autre question, retire la sienne — comme l'application des
 * décisions d'un lot (`appliquerLesDecisions`) : la question n'était pas
 * juste telle quelle. Un reclassement se pose ensuite, et celui que le juge
 * refuse (un sous-thème d'une autre catégorie, une étiquette sans la
 * prudence qu'elle demande) s'ignore seul : la question, elle, était juste.
 * Le journal dit chaque changement, avant et après.
 */
export function appliquerALaBase(
  questions: readonly QuestionDeLaBase[],
  finales: ReadonlyMap<string, Decision>,
): { questions: QuestionDeLaBase[]; journal: string[]; retirees: number; corrigees: number; reclassees: number } {
  const parId = new Map(questions.map(q => [q.id, q]))
  const empreintes = new Map(questions.map(q => [q.empreinte, q.id]))
  const sortir = new Set<string>()
  const remplacer = new Map<string, QuestionDeLaBase>()
  const journal: string[] = []
  let corrigees = 0
  let reclassees = 0
  const dire = (q: QuestionDeLaBase) => `[${q.id}] (${q.meta.categorie} › ${q.meta.sousTheme}) « ${q.texte} » → ${q.reponses[q.bonne]}`
  const sources = (d: Decision) => (d.sources && d.sources.length > 0 ? ` (sources : ${d.sources.join(' ; ')})` : '')
  const avantApres = (q: QuestionDeLaBase, champs: Champs) =>
    Object.entries(champs)
      .map(([k, v]) => `${k} : « ${String((entreeDeLaBase(q) as Record<string, unknown>)[k])} » → « ${String(v)} »`)
      .join(' ; ')
  for (const [id, d] of finales) {
    const q = parId.get(id)
    if (!q) {
      journal.push(`- inconnue [${id}] : plus dans la base, rien à faire`)
      continue
    }
    if (d.action === 'retirer') {
      sortir.add(id)
      journal.push(`- retirée ${dire(q)} — ${d.motif}${sources(d)}`)
      continue
    }
    let apres = q
    const contenu = partDesChamps(d.champs, CHAMPS_DE_CONTENU)
    if (contenu) {
      const lu = lireQuestionDeLaBase({ ...entreeDeLaBase(q), ...contenu })
      if ('refus' in lu) {
        sortir.add(id)
        journal.push(`- retirée ${dire(q)} — sa correction (${Object.keys(contenu).join(', ')}) est refusée par le juge : ${lu.refus} — ${d.motif}`)
        continue
      }
      const autre = empreintes.get(lu.question.empreinte)
      if (autre && autre !== id) {
        sortir.add(id)
        journal.push(`- retirée ${dire(q)} — sa correction reprend l'intitulé de [${autre}] — ${d.motif}`)
        continue
      }
      empreintes.delete(q.empreinte)
      empreintes.set(lu.question.empreinte, id)
      apres = lu.question
      corrigees++
      journal.push(`- corrigée ${dire(q)} — ${avantApres(q, contenu)} — ${d.motif}${sources(d)}`)
    }
    const classement = partDesChamps(d.champs, CHAMPS_DE_CLASSEMENT)
    if (classement) {
      const lu = lireQuestionDeLaBase({ ...entreeDeLaBase(apres), ...classement })
      if ('refus' in lu) journal.push(`- reclassement ignoré ${dire(apres)} — ${avantApres(apres, classement)} : refusé par le juge (${lu.refus})`)
      else {
        apres = lu.question
        reclassees++
        journal.push(`- reclassée ${dire(q)} — ${avantApres(q, classement)} — ${d.motif}`)
      }
    }
    if (apres !== q) remplacer.set(id, apres)
  }
  return {
    questions: questions.filter(q => !sortir.has(q.id)).map(q => remplacer.get(q.id) ?? q),
    journal,
    retirees: sortir.size,
    corrigees,
    reclassees,
  }
}

/** Les fichiers de la base, une question par ligne et dans leur ordre : la forme exacte que `ranger` écrit. */
export function ecrireLaBase(dossier: string, questions: readonly QuestionDeLaBase[]) {
  mkdirSync(dossier, { recursive: true })
  for (const c of CATEGORIES) {
    const siennes = questions.filter(q => q.meta.categorie === c)
    const fichier = path.join(dossier, fichierDeCategorie(c))
    if (siennes.length === 0 && !existsSync(fichier)) continue
    writeFileSync(fichier, `[\n${siennes.map(q => JSON.stringify(entreeDeLaBase(q))).join(',\n')}\n]\n`)
  }
}

export function bilan(r: Relecture, carnet: Carnet): string {
  const compte = (m: Record<string, Decision>, a: Decision['action']) => Object.values(m).filter(d => d.action === a).length
  const ids = new Set(r.lots.map(l => l.id))
  const cout = carnet.lots.filter(l => ids.has(l.id)).reduce((s, l) => s + (l.cout ?? 0), 0)
  const { depense, engage } = depenses(carnet)
  const abandonnees = Object.entries(r.essais).filter(([, n]) => n >= ESSAIS_MAX).map(([cle]) => cle)
  const reclassements = Object.values(r.decisions).filter(d => partDesChamps(d.champs, CHAMPS_DE_CLASSEMENT)).length
  return [
    `${r.nom} : ${r.relues.length}/${r.fiches.length} fiches relues, ${r.fiches.reduce((s, f) => s + f.ids.length, 0)} questions.`,
    `Première passe : ${compte(r.decisions, 'retirer')} à retirer, ${compte(r.decisions, 'corriger')} à corriger, ${compte(r.decisions, 'douter')} en doute — dont ${reclassements} à reclasser.`,
    `Doutes vérifiés : ${Object.keys(r.verifiees).length} — ${compte(r.verifiees, 'garder')} gardés, ${compte(r.verifiees, 'corriger')} à corriger, ${compte(r.verifiees, 'retirer')} à retirer.`,
    `Coût de cette relecture : ${dollars(cout)} ; en tout, ${dollars(depense)} dépensés${engage > 0 ? `, ${dollars(engage)} en route` : ''}.`,
    ...(abandonnees.length > 0 ? [`Abandonnées après ${ESSAIS_MAX} échecs : ${abandonnees.join(', ')} — « appliquer --forcer » passe outre.`] : []),
    r.appliquee ? `Appliquée le ${r.appliquee.slice(0, 16).replace('T', ' à ')}.` : `Ensuite : « appliquer ${r.nom} », quand tout est rendu.`,
  ].join('\n')
}

/** Corrige et retire dans la base du dépôt, écrit le journal, et dit quoi commiter. */
export function appliquer(ctx: Pick<ContexteDeRelecture, 'dossier' | 'dire'>, r: Relecture, { forcer = false, dossierDeLaBase = DOSSIER_DE_LA_BASE } = {}) {
  if (r.appliquee) throw new Error(`« ${r.nom} » est déjà appliquée (${r.appliquee}).`)
  const { questions, refusees } = lireLaBase(dossierDeLaBase)
  if (refusees.length > 0) throw new Error(`La base a ${refusees.length} entrée(s) défectueuse(s) : corrige-les avant d'appliquer.`)
  const parId = new Map(questions.map(q => [q.id, q]))
  const nonRelues = r.fiches.filter(f => !r.relues.includes(f.nom)).length
  const doutes = Object.entries(r.decisions).filter(([id, d]) => d.action === 'douter' && !r.verifiees[id] && parId.has(id)).length
  if ((nonRelues > 0 || doutes > 0) && !forcer) {
    throw new Error(`${nonRelues} fiche(s) pas relue(s), ${doutes} doute(s) pas vérifié(s) : « avancer » encore, ou « appliquer --forcer » (un doute non tranché garde sa question).`)
  }
  const fait = appliquerALaBase(questions, decisionsFinales(r))
  ecrireLaBase(dossierDeLaBase, fait.questions)
  const entete = `# Relecture ${r.nom} — ${r.relues.length} fiches, ${fait.retirees} retirée(s), ${fait.corrigees} corrigée(s), ${fait.reclassees} reclassée(s)\n\n`
  writeFileSync(journalDe(ctx.dossier, r.nom), `${entete}${fait.journal.join('\n')}\n`)
  r.appliquee = maintenant()
  sauver(ctx.dossier, r)
  ctx.dire(
    [
      `${r.nom} appliquée : ${fait.retirees} question(s) retirée(s), ${fait.corrigees} corrigée(s), ${fait.reclassees} reclassée(s). La base passe de ${questions.length} à ${fait.questions.length} questions.`,
      `Le journal : ${journalDe(ctx.dossier, r.nom)} — à recopier dans retours/, il dit chaque changement.`,
      `Ensuite : baisse AU_MOINS (server/test/campagne-base.test.ts) à ${fait.questions.length} s'il le faut, en disant pourquoi, lance ce test, et commite server/content/campagne/.`,
    ].join('\n'),
  )
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
  if (commande === 'preparer') {
    const { options } = lireLesOptions(reste, ['limite', 'par-fiche', 'nom', 'toutes', 'effort'])
    const nombre = (cle: string) => (options.has(cle) ? Number(options.get(cle)) : undefined)
    preparerLaRelecture(
      { dossier: DOSSIER, base: base(), dire },
      { limite: nombre('limite'), parFiche: nombre('par-fiche'), nom: options.get('nom'), toutes: options.has('toutes'), effort: options.get('effort') as Effort | undefined },
    )
  } else if (commande === 'avancer') {
    const { mots, options } = lireLesOptions(reste, ['attendre', 'budget'])
    const budget = options.has('budget') ? Number(options.get('budget')) : BUDGET
    const ctx: ContexteDeRelecture = { dossier: DOSSIER, base: base(), api: apiReelle(), budget, dire }
    const lacher = verrouiller(DOSSIER)
    try {
      const debut = Date.now()
      for (;;) {
        const r = charger(DOSSIER, mots[0])
        const etape = await avancer(ctx, r)
        if (etape === 'fini' || etape === 'bloque' || !options.has('attendre')) break
        // Sept heures au plus : un lot rend en vingt-quatre heures au pire, mais presque toujours dans l'heure.
        if (Date.now() - debut > 7 * 3600_000) throw new Error('Sept heures d’attente : relance « avancer --attendre » plus tard.')
        await pause(60_000)
        // Une correction appliquée retire des questions : la base se relit à chaque tour.
        ctx.base = base()
      }
    } finally {
      lacher()
    }
  } else if (commande === 'etat') {
    const { mots } = lireLesOptions(reste, [])
    const r = charger(DOSSIER, mots[0])
    dire(bilan(r, lireLeCarnet(DOSSIER)))
    for (const l of r.lots.filter(x => !x.recu)) dire(`En route : le lot ${l.id}, envoyé le ${l.envoye.slice(0, 16).replace('T', ' à ')}.`)
  } else if (commande === 'appliquer') {
    const { mots, options } = lireLesOptions(reste, ['forcer'])
    appliquer({ dossier: DOSSIER, dire }, charger(DOSSIER, mots[0]), { forcer: options.has('forcer') })
  } else {
    dire('relire.ts preparer [--limite=300] | avancer [<nom>] [--attendre] | etat [<nom>] | appliquer [<nom>] [--forcer] — le détail en tête du script.')
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).catch(e => {
    console.error((e as Error).message)
    process.exitCode = 1
  })
}
