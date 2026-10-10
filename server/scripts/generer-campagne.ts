// Des milliers de questions pour la base de la campagne, sur l'abonnement
// Claude : le script prépare et range, les agents du dépôt écrivent et
// relisent (`redacteur-campagne`, `relecteur-campagne`, `.claude/agents/`),
// lancés en nombre par une session Claude Code. C'est elle qui consomme, dans
// les limites du forfait : rien ne se paie en plus — l'API d'Anthropic, qui
// rendrait tout d'un coup, se facture à part (le choix du 10 octobre 2026).
//
//   npx tsx scripts/generer-campagne.ts preparer --questions=1000 [--categories=Géographie,Sport] [--par-lot=30] [--nom=g1]
//   npx tsx scripts/generer-campagne.ts suite [<nom>] [--forcer]
//   npx tsx scripts/generer-campagne.ts etat [<nom>]
//
// `preparer` fait le plan — ce qui manque à la base, en lots, en vagues — et
// écrit les consignes de la première vague. `suite` fait chaque fois tout ce
// qui peut se faire — recueillir une vague écrite avec le juge et le
// dédoublonnage du rangement, écrire les consignes de la suivante et les
// fiches de relecture, appliquer les décisions — puis dit les agents à
// lancer, un par lot ou par fiche. Relancée après eux, elle continue ; tout
// relu, elle dit la commande qui range. `--forcer` passe outre un agent qui
// n'a rien rendu : son lot compte pour vide, une fiche sans décisions met ses
// lots de côté, sans relecture.
//
// Tout vit dans le dossier des lots : les lots `<nom>-NN.json`, que
// `base-campagne.ts ranger` prend tels quels, et à côté, dans `<nom>/`, le
// plan, les consignes, les fiches, les décisions, chaque refus.

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { lireLaBase, type QuestionDeLaBase } from '../src/core/baseCampagne'
import { commandeDeLaCategorie, consigneDEcriture, empreintesDesLivres, type QuotaDEcriture } from '../src/core/consigneCampagne'
import { CATEGORIES, categorieDe, type Categorie } from '../../shared/categories'
import { SOUS_THEMES } from '../../shared/etiquettes'
import { DOSSIER_DES_LOTS, TriDesEntrees, appliquerLesDecisions, ecrireLot, ficheDUneEntree, lireLot, lotsEnAttente, type Decision, type SorteDeRefus } from './lots-campagne'

/**
 * Ce qu'un agent écrit d'un coup : un fichier, qu'il vérifie jusqu'à zéro
 * refus — la taille des lots écrits à la main. Plus, et l'agent relit mal ;
 * moins, et la consigne commune, la même pour tous, pèse plus que le lot.
 */
export const QUESTIONS_PAR_LOT = 30

/** Ce qu'un correcteur relit d'une fiche : une centaine de questions, quatre à cinq fois moins à lire que de les écrire. */
export const QUESTIONS_PAR_FICHE = 100

// ── Le plan ─────────────────────────────────────────────────────────────

/** Un lot à écrire : son identifiant — qui nomme son fichier, `<id>.json` —, sa catégorie et sa commande. */
export interface LotPrevu {
  id: string
  categorie: Categorie
  quotas: QuotaDEcriture[]
}

/** Une fiche de relecture : les lots qu'elle couvre, et où son correcteur écrit ses décisions. */
export interface Fiche {
  nom: string
  lots: string[]
}

/** Ce que le recueil d'une vague a trouvé dans ses lots. */
export interface Recueil {
  le: string
  /** Les entrées lues dans les lots écrits. */
  ecrites: number
  /** Celles que le juge et le dédoublonnage ont gardées. */
  acceptees: number
  refus: Partial<Record<SorteDeRefus, number>>
  /** Les lots qu'aucun agent n'a rendus, passés avec `--forcer` : comptés pour vides. */
  manquants: string[]
}

/** Ce que la relecture d'une vague a changé. */
export interface Relecture {
  le: string
  retirees: number
  corrigees: number
  /** Les lots d'une fiche sans décisions, mis de côté dans `<nom>/a-relire/` : rien ne les range par mégarde. */
  aRelire: string[]
  incidents: string[]
}

/**
 * Des lots écrits en même temps, puis relus en même temps. Chaque pas franchi
 * garde ses comptes : rejoué, il les refait au lieu de les ajouter.
 */
export interface Vague {
  lots: LotPrevu[]
  consignes?: string
  recueil?: Recueil
  fiches?: Fiche[]
  relecture?: Relecture
}

export interface Generation {
  nom: string
  creee: string
  demandees: number
  vagues: Vague[]
}

/** Les comptes de toutes les vagues, ensemble. */
export function totaux(g: Generation) {
  const t = { ecrites: 0, acceptees: 0, refus: {} as Partial<Record<SorteDeRefus, number>>, manquants: [] as string[], retirees: 0, corrigees: 0, aRelire: [] as string[], incidents: [] as string[] }
  for (const v of g.vagues) {
    if (v.recueil) {
      t.ecrites += v.recueil.ecrites
      t.acceptees += v.recueil.acceptees
      for (const [s, n] of Object.entries(v.recueil.refus) as [SorteDeRefus, number][]) t.refus[s] = (t.refus[s] ?? 0) + n
      t.manquants.push(...v.recueil.manquants)
    }
    if (v.relecture) {
      t.retirees += v.relecture.retirees
      t.corrigees += v.relecture.corrigees
      t.aRelire.push(...v.relecture.aRelire)
      t.incidents.push(...v.relecture.incidents)
    }
  }
  t.incidents.unshift(...t.manquants.map(id => `${id} : rendu par aucun agent, compté pour vide`))
  return t
}

/** Les questions, réparties également entre les catégories — les premières en prennent une de plus quand le compte ne tombe pas juste. */
export function repartir(total: number, categories: readonly Categorie[]): Map<Categorie, number> {
  return new Map(categories.map((c, i) => [c, Math.floor(total / categories.length) + (i < total % categories.length ? 1 : 0)]))
}

/**
 * Le plan d'une génération : la commande de chaque catégorie, celle de la
 * routine du matin (`commandeDeLaCategorie` : les sous-thèmes et les
 * difficultés qui manquent le plus à la base), découpée en lots d'au plus
 * `parLot` questions et rangée en vagues. Deux lots d'une même vague n'ont
 * jamais un sous-thème en commun : écrits en même temps, ils ne se verraient
 * pas, et poseraient les mêmes faits. Un sous-thème qui demande plus d'un lot
 * en prend un par vague, chacun un peu de chaque difficulté ; la vague
 * suivante s'écrit quand la précédente est recueillie, ses intitulés dans la
 * liste du déjà écrit.
 */
export function planDeLaGeneration(
  existantes: readonly { categorie: string; sousTheme: string; difficulte: number }[],
  { nom, questions, categories = CATEGORIES, parLot = QUESTIONS_PAR_LOT }: { nom: string; questions: number; categories?: readonly Categorie[]; parLot?: number },
): Vague[] {
  const parVague: Omit<LotPrevu, 'id'>[][] = []
  for (const [categorie, n] of repartir(questions, categories)) {
    if (n === 0) continue
    const commande = commandeDeLaCategorie(categorie, existantes.filter(q => q.categorie === categorie), n)
    // Les morceaux de chaque sous-thème, par vague : un sous-thème de t
    // questions en fait ⌈t / parLot⌉, distribués une question à la fois pour
    // que chacun ait un peu de chaque difficulté.
    const morceaux: QuotaDEcriture[][][] = []
    for (const { cle } of SOUS_THEMES[categorie]) {
      const lignes = commande.filter(l => l.cle === cle)
      const t = lignes.reduce((s, l) => s + l.n, 0)
      if (t === 0) continue
      const m = Math.ceil(t / parLot)
      const parts: QuotaDEcriture[][] = Array.from({ length: m }, () => [])
      let k = 0
      for (const l of lignes) {
        for (let i = 0; i < l.n; i++, k++) {
          const part = parts[k % m]
          const meme = part.find(q => q.difficulte === l.difficulte)
          if (meme) meme.n++
          else part.push({ cle, n: 1, difficulte: l.difficulte })
        }
      }
      parts.forEach((p, j) => (morceaux[j] ??= []).push(p))
    }
    // Dans une vague, les morceaux de la catégorie se rangent dans des lots
    // d'au plus `parLot` questions : les plus gros d'abord, chacun dans le
    // premier lot où il tient. Pris dans l'ordre du catalogue, ils laissaient
    // des lots de sept questions — un agent, et sa consigne de vingt mille
    // caractères, pour presque rien.
    morceaux.forEach((deLaVague, j) => {
      const lots = (parVague[j] ??= [])
      const ouverts: { quotas: QuotaDEcriture[]; taille: number }[] = []
      for (const morceau of [...deLaVague].sort((a, b) => totalDe({ quotas: b }) - totalDe({ quotas: a }))) {
        const n = totalDe({ quotas: morceau })
        const lot = ouverts.find(o => o.taille + n <= parLot)
        if (lot) {
          lot.quotas.push(...morceau)
          lot.taille += n
        } else ouverts.push({ quotas: [...morceau], taille: n })
      }
      for (const o of ouverts) lots.push({ categorie, quotas: o.quotas })
    })
  }
  const total = parVague.reduce((s, v) => s + v.length, 0)
  const chiffres = Math.max(2, String(total).length)
  let numero = 0
  return parVague.map(lots => ({ lots: lots.map(l => ({ id: `${nom}-${String(++numero).padStart(chiffres, '0')}`, ...l })) }))
}

/** Les intitulés que les sous-thèmes d'un lot ont déjà — la base, puis les lots en attente : ce qu'il ne doit pas reprendre. */
export function dejaEcrites(l: Pick<LotPrevu, 'categorie' | 'quotas'>, connues: readonly Pick<QuestionDeLaBase, 'texte' | 'meta'>[]): string[] {
  const vises = new Set(l.quotas.map(q => q.cle))
  return connues.filter(q => q.meta.categorie === l.categorie && vises.has(q.meta.sousTheme)).map(q => q.texte)
}

const totalDe = (l: Pick<LotPrevu, 'quotas'>) => l.quotas.reduce((s, q) => s + q.n, 0)
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`

/**
 * Les décisions d'un fichier de relecture qui visent une question de sa fiche
 * et disent quoi faire ; les autres s'écartent. Une référence recopiée sans
 * son `.json`, entre crochets ou avec des espaces, se retrouve.
 */
export function lireLesDecisions(entrees: readonly unknown[], refs: ReadonlySet<string>): { decisions: Decision[]; ecartees: number } {
  const decisions: Decision[] = []
  for (const e of entrees) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue
    const d = e as Record<string, unknown>
    if (typeof d.ref !== 'string') continue
    const nue = d.ref.replace(/[\s[\]]/g, '')
    const ref = refs.has(nue) ? nue : nue.replace(/^([A-Za-z0-9]+-\d+)#/, '$1.json#')
    if (!refs.has(ref)) continue
    const motif = typeof d.motif === 'string' ? { motif: d.motif } : {}
    if (d.action === 'retirer') decisions.push({ ref, action: 'retirer', ...motif })
    else if (d.action === 'corriger' && d.champs && typeof d.champs === 'object' && !Array.isArray(d.champs)) {
      decisions.push({ ref, action: 'corriger', champs: d.champs as Record<string, unknown>, ...motif })
    }
  }
  return { decisions, ecartees: entrees.length - decisions.length }
}

// ── La génération, pas à pas ────────────────────────────────────────────

/** Ce dont la génération a besoin du monde : le dossier des lots, la base du dépôt, les quiz livrés, de quoi parler. */
export interface Contexte {
  dossier: string
  base: readonly QuestionDeLaBase[]
  livres: ReadonlySet<string>
  dire: (ligne: string) => void
}

/** Un agent à lancer : lequel, pour quoi, et sa mission, telle quelle. */
export interface Mission {
  agent: 'redacteur-campagne' | 'relecteur-campagne'
  quoi: string
  mission: string
}

const dossierDe = (ctx: Contexte, nom: string) => path.join(ctx.dossier, nom)
const fichierDuPlan = (ctx: Contexte, nom: string) => path.join(dossierDe(ctx, nom), 'plan.json')
const fichierDuLot = (ctx: Contexte, id: string) => path.join(ctx.dossier, `${id}.json`)
const fichierDeConsigne = (ctx: Contexte, nom: string, id: string) => path.join(dossierDe(ctx, nom), `${id}.consigne.md`)
/** Le lot tel que la vague l'a recueilli, jugé : la relecture repart toujours de lui, et se rejoue sans retirer deux fois. */
const fichierRecueilli = (ctx: Contexte, nom: string, id: string) => path.join(dossierDe(ctx, nom), 'recueillis', `${id}.json`)
const fichierDeFiche = (ctx: Contexte, nom: string, fiche: string) => path.join(dossierDe(ctx, nom), `${fiche}.txt`)
const fichierDeDecisions = (ctx: Contexte, nom: string, fiche: string) => path.join(dossierDe(ctx, nom), `${fiche}.decisions.json`)
const maintenant = () => new Date().toISOString()

export function sauver(ctx: Contexte, g: Generation) {
  mkdirSync(dossierDe(ctx, g.nom), { recursive: true })
  writeFileSync(fichierDuPlan(ctx, g.nom), `${JSON.stringify(g, null, 2)}\n`)
}

/** Les générations du dossier, de la plus récente à la plus ancienne. */
function generations(ctx: Contexte): Generation[] {
  if (!existsSync(ctx.dossier)) return []
  return readdirSync(ctx.dossier)
    .filter(n => existsSync(fichierDuPlan(ctx, n)))
    .map(n => JSON.parse(readFileSync(fichierDuPlan(ctx, n), 'utf8')) as Generation)
    .sort((a, b) => b.creee.localeCompare(a.creee))
}

export function charger(ctx: Contexte, nom?: string): Generation {
  const g = nom ? generations(ctx).find(x => x.nom === nom) : generations(ctx)[0]
  if (!g) throw new Error(nom ? `Aucune génération « ${nom} » dans ${ctx.dossier}.` : `Aucune génération dans ${ctx.dossier} : prépares-en une avec « preparer ».`)
  return g
}

/** Finie : chaque vague écrite, recueillie et relue. */
export const finie = (g: Generation) => g.vagues.every(v => !!v.relecture)

/** Le premier nom libre, g1, g2… : ni son dossier, ni un lot à son nom. */
function nomLibre(dossier: string): string {
  const pris = existsSync(dossier) ? readdirSync(dossier) : []
  for (let i = 1; ; i++) {
    const nom = `g${i}`
    if (!pris.some(f => f === nom || f.startsWith(`${nom}-`) || f.startsWith(`${nom}.`))) return nom
  }
}

/** Ce que la base et les lots en attente ont déjà, sauf les lots nommés : ce qu'une écriture ne doit pas reprendre. */
function enAttente(ctx: Contexte, sauf: ReadonlySet<string> = new Set()) {
  return lotsEnAttente(ctx.dossier, new Set(ctx.base.map(q => q.empreinte)), sauf)
}

export interface OptionsDePreparation {
  questions: number
  categories?: readonly Categorie[]
  parLot?: number
  nom?: string
}

/**
 * Le plan, puis les consignes de sa première vague. Une génération à la fois :
 * deux, écrites en même temps, viseraient les mêmes sous-thèmes — ce qui
 * manque à la base — sans se voir.
 */
export function preparer(ctx: Contexte, o: OptionsDePreparation): { generation: Generation; missions: Mission[] } {
  if (!Number.isInteger(o.questions) || o.questions < 1) throw new Error('--questions=<nombre> : combien de questions écrire, en tout.')
  const parLot = o.parLot ?? QUESTIONS_PAR_LOT
  if (!Number.isInteger(parLot) || parLot < 5 || parLot > 40) throw new Error('--par-lot : de 5 à 40 questions par lot.')
  const enCours = generations(ctx).find(x => !finie(x))
  if (enCours) throw new Error(`« ${enCours.nom} » n'est pas finie : mène-la au bout (« suite ${enCours.nom} »), ou abandonne-la en supprimant ${dossierDe(ctx, enCours.nom)} et ses lots.`)
  mkdirSync(ctx.dossier, { recursive: true })
  const nom = o.nom ?? nomLibre(ctx.dossier)
  if (!/^[A-Za-z0-9]{1,20}$/.test(nom)) throw new Error(`--nom : des lettres et des chiffres seulement, vingt au plus (${nom}).`)
  if (nom !== nomLibre(ctx.dossier) && readdirSync(ctx.dossier).some(f => f === nom || f.startsWith(`${nom}-`) || f.startsWith(`${nom}.`))) {
    throw new Error(`« ${nom} » existe déjà dans ${ctx.dossier} : choisis un autre --nom.`)
  }
  const connues = [...ctx.base, ...enAttente(ctx).map(a => a.question)]
  const g: Generation = {
    nom,
    creee: maintenant(),
    demandees: o.questions,
    vagues: planDeLaGeneration(
      connues.map(q => ({ categorie: q.meta.categorie, sousTheme: q.meta.sousTheme, difficulte: q.meta.difficulte })),
      { nom, questions: o.questions, categories: o.categories, parLot },
    ),
  }
  direLePlan(ctx, g)
  ecrireLesConsignes(ctx, g, 0)
  sauver(ctx, g)
  const missions = g.vagues[0].lots.map(l => missionDEcriture(ctx, g, l))
  direLesMissions(ctx, g, missions)
  return { generation: g, missions }
}

function direLePlan(ctx: Contexte, g: Generation) {
  const lots = g.vagues.flatMap(v => v.lots)
  ctx.dire(`${g.nom} : ${g.demandees} questions, en ${pluriel(lots.length, 'lot')} et ${pluriel(g.vagues.length, 'vague')}.`)
  for (const c of CATEGORIES) {
    const siens = lots.filter(l => l.categorie === c)
    if (siens.length === 0) continue
    const quotas = siens.flatMap(l => l.quotas)
    const parSousTheme = SOUS_THEMES[c].map(s => [s.cle, quotas.filter(q => q.cle === s.cle).reduce((t, q) => t + q.n, 0)] as const).filter(([, n]) => n > 0)
    ctx.dire(`  ${c} : ${siens.reduce((s, l) => s + totalDe(l), 0)} questions, ${pluriel(siens.length, 'lot')} — ${parSousTheme.map(([k, n]) => `${k} ${n}`).join(' · ')}`)
  }
}

/** Les consignes d'une vague, une par lot, avec ce que ses sous-thèmes ont déjà — la base et les lots en attente, les vagues d'avant comprises. */
function ecrireLesConsignes(ctx: Contexte, g: Generation, w: number) {
  const v = g.vagues[w]
  const sauf = new Set(v.lots.map(l => `${l.id}.json`))
  const connues = [...ctx.base, ...enAttente(ctx, sauf).map(a => a.question)]
  mkdirSync(dossierDe(ctx, g.nom), { recursive: true })
  for (const l of v.lots) {
    const consigne = consigneDEcriture(l.categorie, l.quotas, { sorte: 'fichier', fichier: fichierDuLot(ctx, l.id) }, dejaEcrites(l, connues))
    writeFileSync(fichierDeConsigne(ctx, g.nom, l.id), consigne)
  }
  v.consignes = maintenant()
}

function missionDEcriture(ctx: Contexte, g: Generation, l: LotPrevu): Mission {
  return {
    agent: 'redacteur-campagne',
    quoi: `${l.id} · ${l.categorie} · ${totalDe(l)} questions`,
    mission: `Ta consigne est dans ${fichierDeConsigne(ctx, g.nom, l.id)} : lis-la en entier avec Read, écris tes ${totalDe(l)} questions dans ${fichierDuLot(ctx, l.id)}, puis vérifie-les comme elle le dit, jusqu'à zéro refus.`,
  }
}

function missionDeRelecture(ctx: Contexte, g: Generation, f: Fiche, questions: number): Mission {
  return {
    agent: 'relecteur-campagne',
    quoi: `${g.nom}/${f.nom} · ${questions} questions`,
    mission: `Ta fiche est dans ${fichierDeFiche(ctx, g.nom, f.nom)} : relis-la, et écris tes décisions dans ${fichierDeDecisions(ctx, g.nom, f.nom)}.`,
  }
}

/** Un lot qu'un agent a rendu : son fichier existe, et se lit. */
function lotRendu(ctx: Contexte, id: string): unknown[] | null {
  try {
    return lireLot(fichierDuLot(ctx, id))
  } catch {
    return null
  }
}

/**
 * Recueille une vague écrite : chaque entrée passe par le juge et le
 * dédoublonnage du rangement — contre la base, les quiz livrés, les lots en
 * attente et ce que la vague a déjà gardé —, lot après lot dans l'ordre du
 * plan, pour qu'un doublon se tranche toujours pareil. Chaque lot ne garde
 * que ses acceptées ; les refusées se disent, avec leur motif, dans
 * `refus-<vague>.txt`. Ce que chaque agent a vérifié seul, la vague le
 * revérifie ensemble : deux agents ont pu poser le même fait.
 */
function recueillir(ctx: Contexte, g: Generation, w: number) {
  const v = g.vagues[w]
  const sauf = new Set(v.lots.map(l => `${l.id}.json`))
  const tri = new TriDesEntrees(ctx.base, ctx.livres)
  for (const a of enAttente(ctx, sauf)) tri.retenir(a.question, a.ou)
  const recueil: Recueil = { le: maintenant(), ecrites: 0, acceptees: 0, refus: {}, manquants: [] }
  const refus: string[] = []
  mkdirSync(path.join(dossierDe(ctx, g.nom), 'recueillis'), { recursive: true })
  for (const l of v.lots) {
    const entrees = lotRendu(ctx, l.id)
    if (!entrees) recueil.manquants.push(l.id)
    const gardees: unknown[] = []
    recueil.ecrites += entrees?.length ?? 0
    for (const [i, e] of (entrees ?? []).entries()) {
      const jugee = tri.juger(e, `${l.id}.json#${i}`)
      if ('refus' in jugee) {
        recueil.refus[jugee.sorte] = (recueil.refus[jugee.sorte] ?? 0) + 1
        refus.push(`${l.id}.json#${i} « ${String((e as { texte?: unknown })?.texte ?? '').slice(0, 100)} » — ${jugee.refus}`)
      } else gardees.push(e)
    }
    recueil.acceptees += gardees.length
    for (const f of [fichierDuLot(ctx, l.id), fichierRecueilli(ctx, g.nom, l.id)]) {
      if (gardees.length > 0) ecrireLot(f, gardees)
      else rmSync(f, { force: true })
    }
  }
  writeFileSync(path.join(dossierDe(ctx, g.nom), `refus-${w + 1}.txt`), refus.map(r => `${r}\n`).join(''))
  v.recueil = recueil
  ctx.dire(`Vague ${w + 1}/${g.vagues.length} recueillie : ${recueil.acceptees} question(s) gardée(s), ${refus.length} refusée(s) (le détail : ${g.nom}/refus-${w + 1}.txt).`)
}

/** Les fiches de relecture d'une vague recueillie : ses lots, regroupés par centaine de questions. */
function ecrireLesFiches(ctx: Contexte, g: Generation, w: number) {
  const v = g.vagues[w]
  const fiches: Fiche[] = []
  let courante: string[] = []
  let taille = 0
  const fermer = () => {
    if (courante.length > 0) fiches.push({ nom: `fiche-${w + 1}-${fiches.length + 1}`, lots: courante })
    courante = []
    taille = 0
  }
  for (const l of v.lots) {
    const f = fichierRecueilli(ctx, g.nom, l.id)
    if (!existsSync(f)) continue
    const n = lireLot(f).length
    if (taille > 0 && taille + n > QUESTIONS_PAR_FICHE) fermer()
    courante.push(l.id)
    taille += n
  }
  fermer()
  for (const f of fiches) {
    const lignes = f.lots.flatMap(id => lireLot(fichierRecueilli(ctx, g.nom, id)).map((e, i) => ficheDUneEntree(`${id}.json#${i}`, e)))
    writeFileSync(fichierDeFiche(ctx, g.nom, f.nom), `${lignes.join('\n')}\n`)
  }
  v.fiches = fiches
}

const questionsDeLaFiche = (ctx: Contexte, g: Generation, f: Fiche) => f.lots.reduce((s, id) => s + lireLot(fichierRecueilli(ctx, g.nom, id)).length, 0)

/** Les décisions qu'un correcteur a rendues pour une fiche ; null tant qu'il n'a rien écrit qui se lise. */
function decisionsRendues(ctx: Contexte, g: Generation, f: Fiche): { decisions: Decision[]; ecartees: number } | null {
  let brut: unknown
  try {
    brut = JSON.parse(readFileSync(fichierDeDecisions(ctx, g.nom, f.nom), 'utf8'))
  } catch {
    return null
  }
  if (!Array.isArray(brut)) return null
  const refs = new Set(f.lots.flatMap(id => lireLot(fichierRecueilli(ctx, g.nom, id)).map((_, i) => `${id}.json#${i}`)))
  return lireLesDecisions(brut, refs)
}

/**
 * Les décisions d'une vague, appliquées aux lots tels qu'elle les a
 * recueillis — rejouée, elle ne retire pas deux fois. Les lots d'une fiche
 * sans décisions (passée avec `--forcer`) partent dans `<nom>/a-relire/`,
 * hors de portée de `ranger <nom>-*.json` : une question non relue n'entre
 * pas par mégarde.
 */
function appliquerLaRelecture(ctx: Contexte, g: Generation, w: number) {
  const v = g.vagues[w]
  const lots = new Map<string, unknown[]>()
  const decisions: Decision[] = []
  const nonRelus: string[] = []
  const incidents: string[] = []
  for (const f of v.fiches ?? []) {
    const rendues = decisionsRendues(ctx, g, f)
    if (!rendues) {
      incidents.push(`${g.nom}/${f.nom} : aucune décision rendue, ses lots sont mis de côté`)
      nonRelus.push(...f.lots.map(id => `${id}.json`))
      continue
    }
    if (rendues.ecartees > 0) incidents.push(`${g.nom}/${f.nom} : ${rendues.ecartees} décision(s) illisible(s), écartée(s)`)
    for (const id of f.lots) lots.set(`${id}.json`, lireLot(fichierRecueilli(ctx, g.nom, id)))
    decisions.push(...rendues.decisions)
  }
  const fait = appliquerLesDecisions(decisions, lots)
  for (const d of fait.ignorees) incidents.push(`${d.ref} : correction sans champ corrigeable (${Object.keys(d.champs ?? {}).join(', ') || 'aucun'}), ignorée`)
  for (const [nom, entrees] of lots) {
    const apres = fait.lots.get(nom) ?? entrees
    if (apres.length > 0) ecrireLot(path.join(ctx.dossier, nom), apres)
    else rmSync(path.join(ctx.dossier, nom), { force: true })
  }
  const aRelire = path.join(dossierDe(ctx, g.nom), 'a-relire')
  for (const nom of nonRelus) {
    mkdirSync(aRelire, { recursive: true })
    if (existsSync(path.join(ctx.dossier, nom))) renameSync(path.join(ctx.dossier, nom), path.join(aRelire, nom))
  }
  const texteDe = (ref: string) => {
    const [nom, i] = ref.split('#')
    return String((lots.get(nom)?.[Number(i)] as { texte?: unknown } | undefined)?.texte ?? '')
  }
  const ignorees = new Set(fait.ignorees)
  const quoi = (d: Decision) => (d.action === 'retirer' ? 'retirée' : `${ignorees.has(d) ? 'ignorée, sans champ corrigeable' : 'corrigée'} (${Object.keys(d.champs ?? {}).join(', ')})`)
  const journal = decisions.map(d => `${quoi(d)} ${d.ref} « ${texteDe(d.ref)} » — ${d.motif ?? 'sans motif'}`)
  writeFileSync(path.join(dossierDe(ctx, g.nom), `relecture-${w + 1}.txt`), journal.map(l => `${l}\n`).join(''))
  v.relecture = { le: maintenant(), retirees: fait.retirees, corrigees: fait.corrigees, aRelire: nonRelus, incidents }
  ctx.dire(
    `Vague ${w + 1}/${g.vagues.length} relue : ${fait.retirees} question(s) retirée(s), ${fait.corrigees} corrigée(s) (le détail : ${g.nom}/relecture-${w + 1}.txt)${nonRelus.length > 0 ? ` ; ${nonRelus.length} lot(s) sans relecture, mis de côté` : ''}.`,
  )
}

/**
 * Tout ce qui peut se faire, dans l'ordre : recueillir chaque vague écrite,
 * écrire les consignes de la suivante, les fiches de la vague recueillie,
 * appliquer les décisions rendues — puis les agents à lancer : les lots et
 * les fiches qui attendent leur agent. Une vague se relit pendant que la
 * suivante s'écrit. `forcer` passe outre ce qu'aucun agent n'a rendu, mais
 * seulement pour ce qui était déjà demandé avant cet appel.
 */
export function suite(ctx: Contexte, g: Generation, { forcer = false } = {}): Mission[] {
  const missions: Mission[] = []
  const demandes = new Set(g.vagues.filter(v => v.consignes))
  const fichesDemandees = new Set(g.vagues.filter(v => v.fiches))
  for (let w = 0; w < g.vagues.length; w++) {
    const v = g.vagues[w]
    if (!v.consignes) {
      if (w > 0 && !g.vagues[w - 1].recueil) break
      ecrireLesConsignes(ctx, g, w)
      ctx.dire(`Vague ${w + 1}/${g.vagues.length} : ${v.lots.length} consignes écrites.`)
    }
    if (!v.recueil) {
      const manquants = v.lots.filter(l => !lotRendu(ctx, l.id))
      if (manquants.length > 0 && !(forcer && demandes.has(v))) {
        missions.push(...manquants.map(l => missionDEcriture(ctx, g, l)))
        continue
      }
      recueillir(ctx, g, w)
    }
    if (!v.fiches) ecrireLesFiches(ctx, g, w)
    if (!v.relecture) {
      const attendues = v.fiches!.filter(f => !decisionsRendues(ctx, g, f))
      if (attendues.length > 0 && !(forcer && fichesDemandees.has(v))) {
        missions.push(...attendues.map(f => missionDeRelecture(ctx, g, f, questionsDeLaFiche(ctx, g, f))))
        continue
      }
      appliquerLaRelecture(ctx, g, w)
    }
  }
  sauver(ctx, g)
  if (finie(g)) ctx.dire(`\n${bilanDe(g)}`)
  else direLesMissions(ctx, g, missions)
  return missions
}

function direLesMissions(ctx: Contexte, g: Generation, missions: readonly Mission[]) {
  if (missions.length === 0) return ctx.dire(`Rien à lancer : « suite ${g.nom} » avance d'elle-même.`)
  ctx.dire(`\nÀ lancer — un agent par mission, en parallèle (une dizaine à la fois), puis « suite ${g.nom} » :`)
  for (const m of missions) ctx.dire(`  [${m.agent}] ${m.quoi}\n    ${m.mission}`)
}

/** Le bilan d'une génération : ce qui est gardé, ce qui est tombé et pourquoi, et quoi faire ensuite. */
export function bilanDe(g: Generation): string {
  const b = totaux(g)
  const NOMS: Record<SorteDeRefus, string> = { juge: 'par le juge', fait: 'même fait', doublon: 'même intitulé', base: 'déjà dans la base', livre: 'déjà dans un quiz livré' }
  const refus = (Object.entries(b.refus) as [SorteDeRefus, number][]).filter(([, n]) => n > 0)
  const gardees = b.acceptees - b.retirees
  const lignes = [
    `${g.nom} — finie.`,
    `Demandées : ${g.demandees} · écrites : ${b.ecrites} · gardées par le juge : ${b.acceptees}${refus.length > 0 ? ` (refusées : ${refus.map(([s, n]) => `${NOMS[s]} ${n}`).join(', ')})` : ''}.`,
    `Relecture : ${b.retirees} retirée(s), ${b.corrigees} corrigée(s). Gardées en tout : ${gardees}, dans ${g.nom}-*.json.`,
  ]
  if (b.incidents.length > 0) lignes.push(`Incidents (${b.incidents.length}) :`, ...b.incidents.map(i => `  ${i}`))
  if (b.aRelire.length > 0) lignes.push(`Sans relecture, mis de côté dans ${g.nom}/a-relire/ : ${b.aRelire.join(', ')} — relis-les (skill base-campagne), puis remets-les dans le dossier des lots.`)
  if (gardees > 0) {
    lignes.push(
      'Ensuite, depuis server/ :',
      `  npx tsx scripts/base-campagne.ts voisines ../.lots-campagne/${g.nom}-*.json`,
      `  npx tsx scripts/base-campagne.ts ranger ../.lots-campagne/${g.nom}-*.json`,
      '  puis commite server/content/campagne/.',
    )
  }
  return lignes.join('\n')
}

/** Où en est une génération : chaque vague, pas à pas, et ce qui reste à faire. */
export function etat(ctx: Contexte, g: Generation) {
  const lots = g.vagues.flatMap(v => v.lots)
  ctx.dire(`${g.nom}, préparée le ${g.creee.slice(0, 16).replace('T', ' à ')} : ${g.demandees} questions, ${lots.length} lots, ${g.vagues.length} vague(s).`)
  for (const [w, v] of g.vagues.entries()) {
    const ecrits = v.lots.filter(l => existsSync(fichierDuLot(ctx, l.id)) || existsSync(fichierRecueilli(ctx, g.nom, l.id))).length
    const pas = !v.consignes
      ? 'à venir'
      : !v.recueil
        ? `${ecrits}/${v.lots.length} lots écrits`
        : !v.relecture
          ? `recueillie, ${(v.fiches ?? []).filter(f => decisionsRendues(ctx, g, f)).length}/${v.fiches?.length ?? 0} fiches relues`
          : 'relue'
    ctx.dire(`  vague ${w + 1} : ${v.lots.length} lots — ${pas}`)
  }
  ctx.dire(finie(g) ? `\n${bilanDe(g)}` : `Ensuite : « suite ${g.nom} ».`)
}

// ── La ligne de commande ────────────────────────────────────────────────

function lireLesOptions(args: readonly string[], permises: readonly string[]): { mots: string[]; options: Map<string, string> } {
  const options = new Map<string, string>()
  const mots: string[] = []
  for (const a of args) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a)
    if (!m) mots.push(a)
    else if (!permises.includes(m[1])) throw new Error(`Option inconnue : --${m[1]} (${permises.map(k => `--${k}`).join(', ') || 'aucune'}).`)
    else options.set(m[1], m[2] ?? 'oui')
  }
  return { mots, options }
}

function principal(args: readonly string[]) {
  const [commande, ...reste] = args
  const { questions: base, refusees } = lireLaBase()
  if (refusees.length > 0) console.warn(`La base a ${refusees.length} entrée(s) défectueuse(s) : elles ne comptent pas.`)
  const ctx: Contexte = { dossier: DOSSIER_DES_LOTS, base, livres: empreintesDesLivres(), dire: ligne => console.log(ligne) }
  if (commande === 'preparer') {
    const { options } = lireLesOptions(reste, ['questions', 'categories', 'par-lot', 'nom'])
    const categories = options.get('categories')?.split(',').map(nom => {
      const c = categorieDe(nom)
      if (!c) throw new Error(`Catégorie inconnue : ${nom} (${CATEGORIES.join(', ')}).`)
      return c
    })
    preparer(ctx, {
      questions: Number(options.get('questions')),
      categories,
      parLot: options.has('par-lot') ? Number(options.get('par-lot')) : undefined,
      nom: options.get('nom'),
    })
  } else if (commande === 'suite') {
    const { mots, options } = lireLesOptions(reste, ['forcer'])
    suite(ctx, charger(ctx, mots[0]), { forcer: options.has('forcer') })
  } else if (commande === 'etat') {
    const { mots } = lireLesOptions(reste, [])
    etat(ctx, charger(ctx, mots[0]))
  } else {
    console.log('generer-campagne.ts preparer --questions=<n> | suite [<nom>] [--forcer] | etat [<nom>] — le détail en tête du script.')
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    principal(process.argv.slice(2))
  } catch (e) {
    console.error((e as Error).message)
    process.exitCode = 1
  }
}
