// Des faits sûrs pour la base de la campagne, tirés de Wikidata (CC0) : la
// bonne réponse, les leurres, la date, les entités, la source et une
// difficulté a priori — tout ce qu'un rédacteur écrivait de mémoire, sauf ses
// phrases. Le pilote du 10 octobre 2026 : trente questions de peinture
// écrites sur des faits fournis ont coûté 19 458 jetons au rédacteur, contre
// 53 505 pour trente autres écrites de mémoire, sans un refus du juge ni une
// question retirée par le correcteur — et surtout des difficultés 4 et 5, ce
// qui manque à la base. De mémoire, deux rédacteurs retombent vite sur les
// mêmes faits célèbres ; ici, le fait est neuf avant qu'on écrive un mot.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/faits-wikidata.ts extraire [<famille> …]
//   npx tsx scripts/faits-wikidata.ts lots --questions=300 [--familles=tableaux,films] [--par-lot=30] [--nom=wd1]
//   npx tsx scripts/faits-wikidata.ts fusionner <nom>-NN
//   npx tsx scripts/faits-wikidata.ts familles
//
// `extraire` interroge Wikidata (query.wikidata.org) et les vues de Wikipédia
// en français (fr.wikipedia.org), puis range les fiches de chaque famille
// dans `.faits-wikidata/`, à côté du dépôt, que git ignore. `lots` choisit des
// fiches que la base n'a pas — le juge du rangement, sur l'intitulé du
// gabarit —, les répartit en lots d'une seule famille et écrit leurs
// consignes ; un agent `redacteur-campagne` par lot écrit l'intitulé,
// l'anecdote et l'explication de chaque fiche, rien d'autre ; `fusionner`, le
// vérificateur que sa consigne lui donne, en fait un lot ordinaire,
// `<nom>-NN.json`, que `fiche`, `appliquer`, `voisines` et `ranger`
// (`base-campagne.ts`) prennent tels quels.
//
// Dans le cloud, le réseau passe par un proxy que le `fetch` de Node ne suit
// que sous `NODE_USE_ENV_PROXY=1` : sans, il ne trouve même pas l'hôte.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SERVEUR } from '../src/racine'
import { lireLaBase, lireQuestionDeLaBase, nomDeFamille } from '../src/core/baseCampagne'
import { CIBLE_DES_DIFFICULTES, TEXTE_CONSEILLE, empreintesDesLivres } from '../src/core/consigneCampagne'
import type { Categorie } from '../../shared/categories'
import { MAX_EXPLICATION, type MetadonneesDeQuestion } from '../../shared/etiquettes'
import { MAX_ANECDOTE } from '../../shared/library'
import { DOSSIER_DES_LOTS, FICHIER_DE_LOT, TriDesEntrees, ecrireLot, lireLot, lotsEnAttente } from './lots-campagne'

/** Les fiches extraites et le cache des requêtes : à côté du dépôt, comme les lots — régénérables, jamais committés. */
export const DOSSIER_DES_FAITS = path.join(SERVEUR, '..', '.faits-wikidata')

// ── Les fiches ──────────────────────────────────────────────────────────

/** Une entité de Wikidata, telle qu'une fiche s'en sert. */
export interface EntiteWd {
  qid: string
  nom: string
  description: string | null
  /** Son article sur Wikipédia en français : la source de la question, et ses vues. */
  titre: string | null
  /** Ses articles dans toutes les langues : la notoriété dans le monde. */
  liens: number
  /** Les années qui situent une personne parmi les leurres : sa naissance, ou ses victoires. */
  annees?: number[]
  pays?: string[]
  femme?: boolean
}

/** Un fait brut : un sujet, sa réponse, et ce qui aide à écrire sans trahir. */
export interface FaitBrut {
  sujet: EntiteWd
  reponse: EntiteWd
  /** L'année du sujet : sa création, sa sortie, son édition. */
  annee: number | null
  /** Pour le rédacteur : un musée, un lieu, une course — jamais la réponse. */
  indices: string[]
  /** Le sujet est français : sous-thème et portée en dépendent. */
  francais: boolean
}

/** Une entrée de la base sans ce que le rédacteur écrit — l'anecdote, l'explication ; l'intitulé y est celui du gabarit. */
type EntreeSansPhrases = { texte: string; reponses: string[]; bonne: number } & Omit<MetadonneesDeQuestion, 'explication'>

/** Une fiche : l'entrée sans ses phrases, et de quoi la retrouver. */
export type FicheDeFait = EntreeSansPhrases & {
  famille: string
  /** Le sujet et la réponse dans Wikidata. */
  qids: [string, string]
  /** Ce que demande la question, dit au rédacteur. */
  demande: string
  indices: string[]
  /** Les vues par jour sur Wikipédia en français, du sujet et de la réponse : la difficulté s'en déduit. */
  vues: { sujet: number; reponse: number }
}

/** Ce que le rédacteur rend pour une fiche ; `t` à null l'écarte — un fait qui lui semble faux, un sujet ambigu —, avec son motif. */
export interface Phrases {
  ref: number
  t: string | null
  a?: string | null
  x?: string | null
  motif?: string
}

/** Sans accents ni casse : deux noms se comparent ainsi. */
const plat = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/**
 * Les leurres d'une réponse, du plus vraisemblable au moins vraisemblable :
 * des entités du même vivier — des peintres pour un peintre —, les plus
 * proches par l'année (sa naissance, ou ses victoires), du même pays d'abord,
 * connues de préférence. Jamais la réponse, ni ce qui répond aussi au sujet
 * (`exclus`), ni qui porte son nom de famille : Théo van Gogh n'est pas un
 * leurre honnête pour Vincent, ni Brueghel le Jeune pour l'Ancien. Null sous
 * six : le juge en veut six à huit.
 */
export function choisirLeurres(reponse: EntiteWd, vivier: readonly EntiteWd[], o: { ecart: number; exclus?: ReadonlySet<string> }): string[] | null {
  const annees = reponse.annees ?? []
  if (annees.length === 0) return null
  const famille = nomDeFamille(reponse.nom)
  const pays = new Set(reponse.pays ?? [])
  const candidats = vivier
    .filter(e => e.qid !== reponse.qid && !o.exclus?.has(e.qid) && (e.annees?.length ?? 0) > 0)
    .filter(e => plat(e.nom) !== plat(reponse.nom) && (!famille || nomDeFamille(e.nom) !== famille))
    .map(e => ({ e, d: Math.min(...e.annees!.flatMap(a => annees.map(b => Math.abs(a - b)))) }))
    .filter(({ d }) => d <= o.ecart)
    // L'année d'abord ; le même pays vaut quinze ans ; un peu de notoriété départage — un leurre que personne ne connaît ne trompe personne.
    .map(({ e, d }) => ({ e, score: d + ((e.pays ?? []).some(p => pays.has(p)) ? 0 : 15) - Math.min(e.liens, 150) / 15 }))
    .sort((a, b) => a.score - b.score || a.e.nom.localeCompare(b.e.nom))
  const leurres: string[] = []
  for (const { e } of candidats) {
    if (!leurres.some(l => plat(l) === plat(e.nom))) leurres.push(e.nom)
    if (leurres.length === 7) break
  }
  return leurres.length >= 6 ? leurres : null
}

/**
 * La difficulté a priori d'une fiche, de 1 à 5. La part des joueurs qui
 * connaissent le sujet se lit dans ses vues sur Wikipédia en français : les
 * langues de Wikidata n'y suffisent pas — sur cent trois tableaux, elles ne
 * sont corrélées qu'à 0,59 aux vues françaises. Une réponse bien plus lue que
 * ses leurres se devine : Monet parmi trois peintres moins célèbres rend
 * facile « Femmes au jardin », que peu de gens connaissent. Un palmarès se
 * joue sur le vainqueur, et se souvenir de l'année est plus dur que de
 * connaître le champion. Les réponses des joueurs corrigent ensuite
 * (`tauxLisse`, `niveauDeQuestion`).
 */
export function difficulteAPriori(sorte: 'sujet' | 'palmares', vues: { sujet: number; reponse: number; leurres: readonly number[] }): number {
  const l = (v: number) => Math.log10(1 + Math.max(0, v))
  const connu = sorte === 'palmares' ? vues.reponse / 4 : vues.sujet
  // Les seuils, relus sur les tableaux : la Joconde (800 vues par jour) en 1, Le Jardin des délices (240) en 2, Des glaneuses (100) en 3.
  let d = connu >= 600 ? 1 : connu >= 200 ? 2 : connu >= 70 ? 3 : connu >= 25 ? 4 : 5
  if (sorte === 'sujet' && vues.leurres.length > 0) {
    const ecart = l(vues.reponse) - vues.leurres.reduce((s, v) => s + l(v), 0) / vues.leurres.length
    if (ecart >= 0.8) d--
    else if (ecart <= -0.5) d++
  }
  return Math.min(5, Math.max(1, d))
}

/**
 * L'entrée de la base qu'une fiche devient avec ses phrases : l'intitulé,
 * l'anecdote et l'explication du rédacteur ; la réponse, les leurres et tout
 * le reste viennent de la fiche, qu'il ne peut pas changer. Sans phrases,
 * l'intitulé du gabarit — ce que le juge relit pour écarter ce que la base a
 * déjà. Null quand le rédacteur l'a écartée (`t` à null).
 */
export function entreeDeLaFiche(f: FicheDeFait, p?: Phrases): Record<string, unknown> | null {
  if (p && p.t === null) return null
  const { famille: _f, qids: _q, demande: _d, indices: _i, vues: _v, ...entree } = f
  return { ...entree, texte: (p?.t ?? f.texte).trim(), anecdote: p?.a?.trim() || null, explication: (p?.x ?? '').trim().slice(0, MAX_EXPLICATION) }
}

/** Une fiche telle que la consigne la montre : le fait, les réponses affichées, ce qui aide. */
export function ligneDeFiche(ref: number, f: FicheDeFait): string {
  const [sujet, reponse] = f.entites
  const autres = f.reponses.filter((_, i) => i !== f.bonne).join(', ')
  const date = f.date ? ` | année : ${f.date.valeur}` : ''
  const indices = f.indices.length > 0 ? ` | indices : ${f.indices.join(' ; ')}` : ''
  return `${ref} | ${sujet.nom}${sujet.description ? ` (${sujet.description})` : ''} | réponse : ${f.reponses[f.bonne]}${reponse?.description ? ` (${reponse.description})` : ''}${date}${indices} | mauvaises réponses affichées : ${autres} | difficulté : ${f.difficulte}`
}

/**
 * La consigne d'un lot de fiches : ce que le rédacteur écrit, le format, et
 * comment se vérifier. Courte — la moitié de celle d'un lot écrit de mémoire
 * (10 000 caractères contre 23 000 au pilote) : ni le format complet de la
 * base, ni les intitulés déjà écrits, puisque le fait est neuf et que ses
 * métadonnées sont faites.
 */
export function consigneDesFaits(fiches: readonly FicheDeFait[], o: { phrases: string; verifier: string }): string {
  const demandes = [...new Set(fiches.map(f => f.demande))]
  return `FIESTAPP — ÉCRIRE DES QUESTIONS À PARTIR DE FAITS VÉRIFIÉS

FiestApp est un quiz joué sur téléphone par des francophones, surtout des adultes en France. Sa campagne solo pose des questions de plus en plus difficiles ; après chaque réponse, le joueur lit une anecdote : c'est là qu'il apprend.

Chaque fiche plus bas donne un fait tiré de Wikidata : un sujet, la bonne réponse, son année, et les trois mauvaises réponses déjà choisies. Tu n'as ni à chercher le fait, ni à choisir les réponses, ni à les changer : tu écris seulement les phrases. Chaque question demande ${demandes.join(' ; ')}.

Pour chaque fiche, écris :
- t : l'intitulé. Il demande exactement le fait de la fiche, et se comprend seul. Tu peux l'enrichir d'un indice qui ne trahit pas la réponse — l'époque, le sujet, un lieu —, mais jamais le nom de la bonne réponse, ni une partie de ce nom (un surnom, un titre qui le contient), ni ce qui la désigne seule. ${TEXTE_CONSEILLE} caractères au plus, une espace avant « ? ». Un titre d'œuvre s'écrit entre « ».
- a : l'anecdote, une ou deux phrases (${MAX_ANECDOTE} caractères au plus), vraie, qui apprend autre chose que la réponse. Aucun nom, chiffre ou date dont tu ne sois pas certain ; si tu n'as rien de certain à raconter, écris null.
- x : l'explication, une phrase (${MAX_EXPLICATION} caractères au plus) qui dit pourquoi la bonne réponse est la bonne, sans répéter l'anecdote.
Si un fait te semble faux, ou le sujet ambigu (deux œuvres du même nom), écris "t": null et dis pourquoi dans "motif" : la fiche sera écartée.
Le français soigné : accents, majuscules, apostrophes droites ('), une espace avant ? ! : ;. Pas d'emoji.

LE FORMAT — un seul fichier, un tableau JSON, une entrée par fiche, rien d'autre :
[{"ref": 1, "t": "…", "a": "…", "x": "…"}, …]

COMMENT TRAVAILLER
1. Écris tout d'un seul coup dans ${o.phrases}.
2. Lance : ${o.verifier} — il fusionne tes phrases avec les fiches et passe le lot au juge de la base ; corrige chaque REFUS (« ref N », ta fiche N) et chaque AVERTISSEMENT, et relance jusqu'à zéro refus. Une fiche dont le fait est déjà dans la base s'écarte : "t": null, motif « déjà dans la base ».
3. N'écris rien d'autre que ce fichier : d'autres agents écrivent les lots voisins, et un correcteur relira.

LES FICHES
${fiches.map((f, i) => ligneDeFiche(i + 1, f)).join('\n')}
`
}

// ── Les familles ────────────────────────────────────────────────────────

/** Ce qu'une famille de faits dit d'elle-même, et comment elle s'extrait. */
export interface Famille {
  cle: string
  nom: string
  categorie: Categorie
  sousTheme: (f: FaitBrut) => string
  /** L'intitulé que le script écrit seul : le rédacteur le réécrit, le juge s'en sert pour écarter ce que la base a déjà. */
  gabarit: (f: FaitBrut) => string
  /** Ce que demande la question, pour la consigne. */
  demande: string
  typeSujet: 'oeuvre' | 'lieu' | 'evenement'
  descriptionSujet: string
  /** Les leurres se cherchent à tant d'années au plus de la réponse. */
  ecart: number
  /** Au plus tant de fiches par réponse : vingt-sept Caravage feraient une famille monotone. */
  parReponse: number
  /** Sous ce nombre de vues par jour sur Wikipédia en français, le sujet est trop obscur pour la France. */
  vuesMin: number
  sorte: 'sujet' | 'palmares'
  extraire: (wd: Wikidata) => Promise<Extraction>
}

/** Ce qu'une famille tire de Wikidata : ses faits, le vivier de ses leurres, et les noms que plusieurs sujets portent. */
export interface Extraction {
  faits: FaitBrut[]
  vivier: EntiteWd[]
  homonymes: ReadonlySet<string>
}

const FRANCE = 'Q142'
const FEMME = 'Q6581072'

/** Les personnes d'un vivier, avec leur naissance — ou les années qu'on leur donne —, leurs nationalités et leur genre. */
async function personnes(wd: Wikidata, qids: readonly string[], annees?: ReadonlyMap<string, number[]>): Promise<Map<string, EntiteWd>> {
  const entites = await wd.entites(qids)
  const naissances = annees ? null : await wd.valeurs(qids, 'P569')
  const nationalites = await wd.valeurs(qids, 'P27')
  const genres = await wd.valeurs(qids, 'P21')
  for (const [q, e] of entites) {
    e.annees = annees?.get(q) ?? (naissances?.get(q) ?? []).map(v => anneeDe(v.v)).filter((a): a is number => a !== null).slice(0, 1)
    e.pays = (nationalites.get(q) ?? []).map(v => v.v)
    e.femme = (genres.get(q) ?? []).some(v => v.v === FEMME)
  }
  return entites
}

/**
 * Les titres ambigus : portés par des sujets d'auteurs différents —
 * « La Naissance de Vénus », de Botticelli et de Bouguereau ; « Autoportrait ».
 * Les versions d'un même auteur ne le sont pas : il y a plusieurs Cri et
 * plusieurs Tournesols, et une seule réponse. Compter les seuls titres
 * écartait 231 tableaux, dont les plus connus. Un sujet sans auteur connu
 * compte pour un auteur de plus : dans le doute, le titre est ambigu.
 */
export function titresAmbigus(lignes: readonly { item: string; l: string; a?: string }[]): Set<string> {
  const auteurs = new Map<string, Set<string>>()
  for (const { item, l, a } of lignes) {
    const titre = plat(l)
    const deja = auteurs.get(titre) ?? auteurs.set(titre, new Set()).get(titre)!
    deja.add(a ?? `inconnu:${item}`)
  }
  return new Set([...auteurs].filter(([, a]) => a.size > 1).map(([titre]) => titre))
}

async function homonymesDe(wd: Wikidata, motif: string, prop: string, liensMin: number): Promise<Set<string>> {
  const lignes = await wd.sparql(
    `SELECT ?item ?l ?a WHERE { ${motif} ?item wikibase:sitelinks ?n . FILTER(?n >= ${liensMin}) ?item rdfs:label ?l FILTER(lang(?l) = 'fr') OPTIONAL { ?item wdt:${prop} ?a } }`,
  )
  return titresAmbigus(lignes.map(l => ({ item: l.item, l: l.l, a: l.a })))
}

/**
 * Les faits d'une famille « une œuvre, son auteur » : les sujets assez
 * traduits, dont un seul auteur répond — deux réalisateurs, c'est un fait qui
 * se discute —, et le vivier des leurres : ceux qui ont signé assez d'œuvres
 * de la classe. « Métier : peintre » y mettait Johan Huizinga, historien, et
 * l'impératrice Dagmar.
 */
async function oeuvresEtAuteurs(
  wd: Wikidata,
  o: { motif: string; prop: string; liensMin: number; vivierLiensMin: number; oeuvresMin: number; homonymesLiensMin: number; date: string; pays?: string; indice?: string; auteur?: string },
): Promise<Extraction> {
  const sujetsBruts = await wd.sparql(`SELECT DISTINCT ?item WHERE { ${o.motif} ?item wikibase:sitelinks ?n . FILTER(?n >= ${o.liensMin}) }`)
  const qids = sujetsBruts.map(l => qidDe(l.item)).filter((q): q is string => q !== null)
  const reponses = await wd.valeurs(qids, o.prop)
  const toutes = await wd.sparql(`SELECT ?item ?a WHERE { ${o.motif} ?item wikibase:sitelinks ?n . FILTER(?n >= ${o.vivierLiensMin}) ?item wdt:${o.prop} ?a . ${o.auteur ?? ''} }`)
  const parAuteur = new Map<string, number>()
  for (const l of toutes) {
    const a = qidDe(l.a)
    if (a) parAuteur.set(a, (parAuteur.get(a) ?? 0) + 1)
  }
  const vivier = [...parAuteur].filter(([, k]) => k >= o.oeuvresMin).map(([a]) => a)
  // Un auteur qui n'est pas du vivier (un groupe, un anonyme, Moïse pour La Genèse) ne répond pas : son fait se discute.
  const uniques = qids.filter(q => (reponses.get(q) ?? []).length === 1 && parAuteur.has(reponses.get(q)![0].v))
  const sujets = await wd.entites(uniques)
  const dates = await wd.valeurs(uniques, o.date)
  const pays = o.pays ? await wd.valeurs(uniques, o.pays) : new Map<string, Valeur[]>()
  const indices = o.indice ? await wd.valeurs(uniques, o.indice) : new Map<string, Valeur[]>()
  const gens = await personnes(wd, [...new Set([...vivier, ...uniques.map(q => reponses.get(q)![0].v)])])
  const faits: FaitBrut[] = []
  for (const q of uniques) {
    const sujet = sujets.get(q)
    const reponse = gens.get(reponses.get(q)![0].v)
    if (!sujet || !reponse) continue
    const annees = (dates.get(q) ?? []).filter(v => (v.prec ?? 0) >= 9).map(v => anneeDe(v.v)).filter((a): a is number => a !== null)
    faits.push({
      sujet,
      reponse,
      annee: annees.length > 0 ? Math.min(...annees) : null,
      indices: (indices.get(q) ?? []).map(v => v.l).filter((l): l is string => !!l).slice(0, 2),
      francais: (pays.get(q) ?? []).some(v => v.v === FRANCE) || (reponse.pays ?? []).includes(FRANCE),
    })
  }
  return { faits, vivier: vivier.map(a => gens.get(a)).filter((e): e is EntiteWd => !!e), homonymes: await homonymesDe(wd, o.motif, o.prop, o.homonymesLiensMin) }
}

/** Le Tour de France, le Tour d'Italie, le Tour d'Espagne — avec l'article qu'on leur donne dans une phrase. */
const COURSES: Readonly<Record<string, string>> = { Q33881: 'le Tour de France', Q33861: "le Tour d'Italie", Q33937: "le Tour d'Espagne" }

/**
 * Les vainqueurs du classement général des trois grands tours. Sur
 * Wikidata, chaque édition porte plusieurs « vainqueurs » — points,
 * montagne, équipes — et seul le qualificatif « résultat : vainqueur du
 * classement général » (P2501, Q20882667) dit le bon. Les leurres sont
 * d'autres vainqueurs de grands tours, à quelques années près : certainement
 * faux, jamais absurdes.
 */
async function grandsTours(wd: Wikidata): Promise<Extraction> {
  const lignes = await wd.sparql(`SELECT ?ed ?course ?v ?an WHERE {
  VALUES ?course { ${Object.keys(COURSES).map(q => `wd:${q}`).join(' ')} }
  ?ed wdt:P31 ?course ; p:P1346 ?st . ?st ps:P1346 ?v ; pq:P2501 wd:Q20882667 .
  OPTIONAL { ?ed wdt:P585 ?d } OPTIONAL { ?ed wdt:P580 ?d2 }
  BIND(YEAR(COALESCE(?d, ?d2)) AS ?an)
}`)
  const parEdition = new Map<string, { course: string; vainqueurs: Set<string>; annee: number | null }>()
  for (const l of lignes) {
    const [ed, v, course] = [qidDe(l.ed), qidDe(l.v), qidDe(l.course)]
    if (!ed || !v || !course) continue
    const e = parEdition.get(ed) ?? parEdition.set(ed, { course, vainqueurs: new Set(), annee: l.an ? Number(l.an) : null }).get(ed)!
    e.vainqueurs.add(v)
  }
  // Leurs années de victoire situent les coureurs entre eux : leur naissance dirait moins bien qui courait ensemble.
  const victoires = new Map<string, number[]>()
  for (const e of parEdition.values()) for (const v of e.vainqueurs) if (e.annee) victoires.set(v, [...(victoires.get(v) ?? []), e.annee])
  const editions = await wd.entites([...parEdition.keys()])
  const gens = await personnes(wd, [...victoires.keys()], victoires)
  const faits: FaitBrut[] = []
  for (const [ed, e] of parEdition) {
    // Un titre retiré pour dopage laisse deux vainqueurs, ou aucun : le fait se discute, il ne s'écrit pas.
    if (e.vainqueurs.size !== 1 || !e.annee) continue
    const sujet = editions.get(ed)
    const reponse = gens.get([...e.vainqueurs][0])
    if (sujet && reponse) faits.push({ sujet, reponse, annee: e.annee, indices: [COURSES[e.course]], francais: e.course === 'Q33881' })
  }
  return { faits, vivier: [...gens.values()], homonymes: new Set() }
}

export const FAMILLES: readonly Famille[] = [
  {
    cle: 'tableaux',
    nom: 'Un tableau, son peintre',
    categorie: 'Arts & lettres',
    sousTheme: () => 'peinture',
    gabarit: f => `Qui a peint « ${f.sujet.nom} » ?`,
    demande: 'qui a peint le tableau',
    typeSujet: 'oeuvre',
    descriptionSujet: 'tableau',
    ecart: 60,
    parReponse: 4,
    vuesMin: 12,
    sorte: 'sujet',
    extraire: wd =>
      oeuvresEtAuteurs(wd, { motif: '?item wdt:P31 wd:Q3305213 .', prop: 'P170', liensMin: 12, vivierLiensMin: 4, oeuvresMin: 3, homonymesLiensMin: 4, date: 'P571', indice: 'P195' }),
  },
  {
    cle: 'films',
    nom: 'Un film, son réalisateur',
    categorie: 'Cinéma & séries',
    sousTheme: f => (f.francais ? 'cinema-fr' : 'cinema-monde'),
    gabarit: f => `Qui a réalisé « ${f.sujet.nom} » ?`,
    demande: 'qui a réalisé le film',
    typeSujet: 'oeuvre',
    descriptionSujet: 'film',
    ecart: 25,
    parReponse: 3,
    vuesMin: 25,
    sorte: 'sujet',
    extraire: wd =>
      oeuvresEtAuteurs(wd, { motif: '?item wdt:P31 wd:Q11424 .', prop: 'P57', liensMin: 40, vivierLiensMin: 20, oeuvresMin: 3, homonymesLiensMin: 10, date: 'P577', pays: 'P495' }),
  },
  {
    cle: 'romans',
    nom: 'Un livre, son auteur',
    categorie: 'Arts & lettres',
    sousTheme: f => (f.francais ? 'litterature-fr' : 'litterature-monde'),
    gabarit: f => `Qui a écrit « ${f.sujet.nom} » ?`,
    demande: "qui a écrit l'œuvre",
    typeSujet: 'oeuvre',
    descriptionSujet: 'œuvre littéraire',
    ecart: 40,
    parReponse: 3,
    vuesMin: 12,
    sorte: 'sujet',
    // Des écrivains de métier — écrivain, romancier, poète, dramaturge, philosophe : « La Genèse → Moïse » et « Nouveau Testament → AA.VV. » sortaient des seuls livres.
    extraire: wd =>
      oeuvresEtAuteurs(wd, {
        motif: 'VALUES ?classe { wd:Q7725634 wd:Q8261 } ?item wdt:P31 ?classe .',
        prop: 'P50',
        liensMin: 15,
        vivierLiensMin: 10,
        oeuvresMin: 3,
        homonymesLiensMin: 8,
        date: 'P577',
        pays: 'P495',
        auteur: 'VALUES ?metier { wd:Q36180 wd:Q6625963 wd:Q49757 wd:Q214917 wd:Q4964182 } ?a wdt:P106 ?metier .',
      }),
  },
  {
    cle: 'edifices',
    nom: 'Un édifice, son architecte',
    categorie: 'Arts & lettres',
    sousTheme: () => 'sculpture-archi',
    gabarit: f => `Quel architecte a conçu « ${f.sujet.nom} » ?`,
    demande: "quel architecte a conçu l'édifice",
    typeSujet: 'lieu',
    descriptionSujet: 'édifice',
    ecart: 40,
    parReponse: 3,
    vuesMin: 12,
    sorte: 'sujet',
    // Un architecte en personne : une agence ne se devine pas, et ses associés changent d'un projet à l'autre.
    extraire: wd =>
      oeuvresEtAuteurs(wd, { motif: '?item wdt:P84 [] .', prop: 'P84', liensMin: 25, vivierLiensMin: 10, oeuvresMin: 2, homonymesLiensMin: 10, date: 'P571', pays: 'P17', indice: 'P131', auteur: '?a wdt:P31 wd:Q5 .' }),
  },
  {
    cle: 'grands-tours',
    nom: 'Un grand tour, son vainqueur',
    categorie: 'Sport',
    sousTheme: () => 'cyclisme',
    gabarit: f => `En ${f.annee}, qui remporte ${f.indices[0] ?? 'la course'} ?`,
    demande: "qui a remporté le classement général de l'édition (son année est sur la fiche)",
    typeSujet: 'evenement',
    descriptionSujet: 'édition d’un grand tour cycliste',
    ecart: 8,
    parReponse: 3,
    vuesMin: 15,
    sorte: 'palmares',
    extraire: grandsTours,
  },
]

/**
 * Les fiches d'une famille : ses faits, sans homonyme, avec un article sur
 * Wikipédia en français pour le sujet et la réponse, assez lus en France —
 * les plus lus d'abord —, au plus `parReponse` par réponse, avec leurs
 * leurres et leur difficulté a priori.
 */
export function fichesDeLaFamille(fam: Famille, x: Extraction, vues: ReadonlyMap<string, number>): { fiches: FicheDeFait[]; ecartes: Record<string, number> } {
  const ecartes: Record<string, number> = {}
  const ecarter = (motif: string) => (ecartes[motif] = (ecartes[motif] ?? 0) + 1)
  const vuesDe = (e: EntiteWd | undefined) => (e?.titre ? (vues.get(e.titre) ?? 0) : 0)
  const parNom = new Map(x.vivier.map(e => [e.nom, e]))
  const tries = [...x.faits].sort((a, b) => vuesDe(b.sujet) - vuesDe(a.sujet) || a.sujet.qid.localeCompare(b.sujet.qid))
  const parReponse = new Map<string, number>()
  const fiches: FicheDeFait[] = []
  for (const f of tries) {
    if (!f.sujet.titre || !f.reponse.titre) { ecarter('sans article sur Wikipédia en français'); continue }
    if (x.homonymes.has(plat(f.sujet.nom))) { ecarter('titre porté par plusieurs sujets'); continue }
    if ((fam.sorte === 'palmares' ? vuesDe(f.reponse) : vuesDe(f.sujet)) < fam.vuesMin) { ecarter('trop peu lu en France'); continue }
    if ((parReponse.get(f.reponse.qid) ?? 0) >= fam.parReponse) { ecarter('plafond par réponse'); continue }
    const leurres = choisirLeurres(f.reponse, x.vivier, { ecart: fam.ecart })
    if (!leurres) { ecarter('moins de six leurres'); continue }
    parReponse.set(f.reponse.qid, (parReponse.get(f.reponse.qid) ?? 0) + 1)
    const affiches = leurres.slice(0, 3)
    const difficulte = difficulteAPriori(fam.sorte, { sujet: vuesDe(f.sujet), reponse: vuesDe(f.reponse), leurres: affiches.map(nom => vuesDe(parNom.get(nom))) })
    // La bonne réponse à une place tirée du sujet, pas du hasard : une extraction refaite rend les mêmes fiches.
    const bonne = parseInt(createHash('sha1').update(f.sujet.qid).digest('hex').slice(0, 8), 16) % 4
    const reponses = [...affiches]
    reponses.splice(bonne, 0, f.reponse.nom)
    fiches.push({
      famille: fam.cle,
      qids: [f.sujet.qid, f.reponse.qid],
      demande: fam.demande,
      indices: f.indices,
      vues: { sujet: vuesDe(f.sujet), reponse: vuesDe(f.reponse) },
      texte: fam.gabarit(f),
      reponses,
      bonne,
      categorie: fam.categorie,
      sousTheme: fam.sousTheme(f),
      etiquettes: f.reponse.femme ? ['femmes'] : [],
      difficulte,
      ageMin: 10,
      date: f.annee !== null ? { valeur: String(f.annee), precision: 'annee' } : null,
      entites: [
        { nom: f.sujet.nom, type: fam.typeSujet, description: (f.sujet.description ?? fam.descriptionSujet).slice(0, 120) },
        { nom: f.reponse.nom, type: 'personne', description: (f.reponse.description ?? '').slice(0, 120) },
      ],
      // Un sujet français peu lu ailleurs que chez nous : la portée « france », celle d'un tiers des questions de la base.
      portee: fam.sorte === 'sujet' && f.francais && f.sujet.liens < 40 ? 'france' : 'monde',
      valeur: null,
      leurres,
      dureeDeVie: 'stable',
      source: { titre: f.sujet.titre, site: 'wikipedia-fr' },
      confiance: 3,
      aRelire: [],
    })
  }
  return { fiches, ecartes }
}

// ── Les lots ────────────────────────────────────────────────────────────

/** Ce qu'un agent écrit d'un coup : trente fiches, comme un lot écrit de mémoire. */
export const FICHES_PAR_LOT = 30

/**
 * Le choix des fiches d'une génération : celles que le juge du rangement
 * accepte sous l'intitulé du gabarit — ni dans la base, ni dans un lot en
 * attente, ni le même fait qu'une autre (`TriDesEntrees`) —, autant par
 * famille, les difficultés au plus près de ce vers quoi la base grandit
 * (`CIBLE_DES_DIFFICULTES`). Rendues par lots d'une seule famille : la
 * consigne dit une seule question.
 */
export function choisirLesFiches(parFamille: ReadonlyMap<string, readonly FicheDeFait[]>, tri: TriDesEntrees, o: { questions: number; parLot: number }): FicheDeFait[][] {
  const familles = [...parFamille.keys()].filter(f => (parFamille.get(f)?.length ?? 0) > 0)
  const lots: FicheDeFait[][] = []
  familles.forEach((cle, i) => {
    const part = Math.floor(o.questions / familles.length) + (i < o.questions % familles.length ? 1 : 0)
    const acceptees = parFamille.get(cle)!.filter(f => 'question' in tri.juger(entreeDeLaFiche(f), `${cle} ${f.qids.join('/')}`))
    // Chaque marche reçoit sa part de la cible, la plus lue d'abord ; ce qu'une marche n'a pas, les autres le prennent.
    const prises = new Set<FicheDeFait>()
    for (const d of [5, 4, 3, 2, 1]) for (const f of acceptees.filter(f => f.difficulte === d).slice(0, Math.round(part * (CIBLE_DES_DIFFICULTES[d] ?? 0)))) prises.add(f)
    for (const f of acceptees) if (prises.size < part) prises.add(f)
    const retenues = [...prises].slice(0, part)
    for (let j = 0; j < retenues.length; j += o.parLot) lots.push(retenues.slice(j, j + o.parLot))
  })
  return lots
}

/** Les fichiers d'un lot de fiches : ses fiches et les phrases du rédacteur dans le dossier de sa génération, le lot fusionné à côté des autres. */
export function fichiersDuLot(racine: string, id: string) {
  const dossier = path.join(racine, id.replace(/-\d+$/, ''))
  return { dossier, faits: path.join(dossier, `${id}.faits.json`), consigne: path.join(dossier, `${id}.consigne.md`), phrases: path.join(dossier, `${id}.phrases.json`), lot: path.join(racine, `${id}.json`) }
}

/**
 * Le vérificateur du rédacteur : ses phrases fusionnées avec les fiches, en
 * un lot ordinaire que le juge du rangement relit — contre la base et les
 * quiz livrés, comme `verifier`. Rend le nombre de refus.
 */
export function fusionner(id: string, o: { racine?: string; dire?: (ligne: string) => void } = {}): number {
  if (!FICHIER_DE_LOT.test(`${id}.json`)) throw new Error(`Un lot se nomme <nom>-NN : ${id}`)
  const dire = o.dire ?? (ligne => console.log(ligne))
  const f = fichiersDuLot(o.racine ?? DOSSIER_DES_LOTS, id)
  const fiches: FicheDeFait[] = JSON.parse(readFileSync(f.faits, 'utf8'))
  if (!existsSync(f.phrases)) throw new Error(`Pas encore de phrases : ${f.phrases}`)
  const parRef = new Map((lireLot(f.phrases) as Phrases[]).map(p => [Number(p.ref), p]))
  const tri = new TriDesEntrees(lireLaBase().questions, empreintesDesLivres())
  const entrees: Record<string, unknown>[] = []
  let refus = 0
  let ecartees = 0
  fiches.forEach((fiche, i) => {
    const ref = `ref ${i + 1}`
    const p = parRef.get(i + 1)
    if (!p) {
      refus++
      return dire(`✗ REFUS ${ref} — pas de phrases pour cette fiche`)
    }
    const entree = entreeDeLaFiche(fiche, p)
    if (!entree) {
      ecartees++
      return dire(`écartée : ${ref} (${fiche.entites[0]?.nom}) — ${p.motif ?? 'sans motif'}`)
    }
    const texte = String(entree.texte)
    const jugee = tri.juger(entree, `${id}.json#${entrees.length}`)
    if ('refus' in jugee) {
      refus++
      dire(`✗ REFUS ${ref} « ${texte.slice(0, 90)} » — ${jugee.refus}`)
    } else {
      if (!entree.explication) dire(`! AVERTISSEMENT ${ref} — pas d'explication`)
      if (Array.from(texte).length > TEXTE_CONSEILLE) dire(`! AVERTISSEMENT ${ref} — intitulé de ${Array.from(texte).length} caractères : ${TEXTE_CONSEILLE} au plus de préférence`)
    }
    entrees.push(entree)
  })
  ecrireLot(f.lot, entrees)
  dire(`${entrees.length - refus} question(s) acceptée(s), ${refus} refus, ${ecartees} fiche(s) écartée(s) — ${f.lot}.`)
  return refus
}

// ── Wikidata et Wikipédia ───────────────────────────────────────────────

/** Une valeur d'une propriété : l'objet (un identifiant, une date, un texte), son libellé, et la précision d'une date. */
export interface Valeur {
  v: string
  l?: string
  prec?: number
}

const UA = 'FiestApp/1.0 (https://github.com/Maxilyas/FiestApp ; questions de quiz)'
/** Les jours sur lesquels se moyennent les vues : trente, et l'API en rend deux fois plus d'articles par réponse qu'à soixante. */
const JOURS_DE_VUES = 30
const attendre = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
/** Une réponse que le serveur a refusée pour de bon (400, 404…) : la redemander ne la changerait pas. */
class ErreurHttp extends Error {}

export const qidDe = (uri: string | undefined): string | null => /\/entity\/(Q\d+)$/.exec(uri ?? '')?.[1] ?? null

/** L'année d'une date de Wikidata (« +1985-07-21T00:00:00Z », « -0027-… ») ; null pour une valeur inconnue. */
export function anneeDe(v: string): number | null {
  const m = /^([+-]?)0*(\d{1,4})-/.exec(v)
  return m ? (m[1] === '-' ? -Number(m[2]) : Number(m[2])) : null
}

/**
 * Les deux portes : le service de requêtes de Wikidata, qui coupe à soixante
 * secondes — d'où des requêtes en deux temps, les sujets puis leurs détails
 * par lots —, et l'API de Wikipédia en français, qui rend les vues de
 * cinquante articles d'un coup. Toutes deux répondent 429 à qui se presse :
 * on attend ce qu'elles disent, une requête à la fois. Tout se garde sur le
 * disque : une extraction reprise ne redemande rien.
 */
export class Wikidata {
  private readonly cache: string

  constructor(private readonly dossier: string) {
    this.cache = path.join(dossier, 'cache')
    mkdirSync(this.cache, { recursive: true })
  }

  private async demander(url: string, init: RequestInit = {}): Promise<unknown> {
    for (let essai = 1; ; essai++) {
      try {
        const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(90_000) })
        // Lu dans la même reprise : une réponse longue se coupe aussi en route (« terminated »), une fois les en-têtes passés.
        if (r.ok) return await r.json()
        const corps = (await r.text()).slice(0, 300)
        if ((r.status === 429 || r.status >= 500) && essai < 6) {
          await attendre(Math.max(1, Number(r.headers.get('retry-after')) || 5 * essai) * 1000)
          continue
        }
        throw new ErreurHttp(`${url.slice(0, 80)}… : ${r.status} ${corps}`)
      } catch (e) {
        if (e instanceof ErreurHttp) throw e
        if ((e as { cause?: { code?: string } }).cause?.code === 'ENOTFOUND' && process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
          throw new Error('Le réseau passe par un proxy que fetch ne suit pas seul : relance avec NODE_USE_ENV_PROXY=1 devant la commande.')
        }
        if (essai >= 5) throw e
        await attendre(5_000 * essai)
      }
    }
  }

  async sparql(requete: string): Promise<Record<string, string>[]> {
    const fichier = path.join(this.cache, `${createHash('sha1').update(requete).digest('hex').slice(0, 20)}.json`)
    if (existsSync(fichier)) return JSON.parse(readFileSync(fichier, 'utf8'))
    const d = (await this.demander('https://query.wikidata.org/sparql', {
      method: 'POST',
      headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ query: requete }).toString(),
    })) as { results: { bindings: Record<string, { value: string }>[] } }
    const lignes = d.results.bindings.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])))
    writeFileSync(fichier, JSON.stringify(lignes))
    return lignes
  }

  /** Libellé et description en français, article sur Wikipédia en français, nombre de langues — par lots de trois cents. */
  async entites(qids: readonly string[]): Promise<Map<string, EntiteWd>> {
    const out = new Map<string, EntiteWd>()
    const valides = qids.filter(q => /^Q\d+$/.test(q))
    for (let i = 0; i < valides.length; i += 300) {
      const lignes = await this.sparql(`SELECT ?item ?n ?l ?d ?t WHERE {
  VALUES ?item { ${valides.slice(i, i + 300).map(q => `wd:${q}`).join(' ')} }
  ?item wikibase:sitelinks ?n .
  OPTIONAL { ?item rdfs:label ?l FILTER(lang(?l) = 'fr') }
  OPTIONAL { ?item schema:description ?d FILTER(lang(?d) = 'fr') }
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://fr.wikipedia.org/> ; schema:name ?t }
}`)
      for (const l of lignes) {
        const q = qidDe(l.item)
        if (q && l.l && !out.has(q)) out.set(q, { qid: q, nom: l.l, description: l.d ?? null, titre: l.t ?? null, liens: Number(l.n) })
      }
    }
    return out
  }

  /** Les valeurs d'une propriété, hors rang déprécié, par lots : l'objet, son libellé en français, la précision d'une date. */
  async valeurs(qids: readonly string[], prop: string): Promise<Map<string, Valeur[]>> {
    const out = new Map<string, Valeur[]>()
    const valides = qids.filter(q => /^Q\d+$/.test(q))
    for (let i = 0; i < valides.length; i += 300) {
      const lignes = await this.sparql(`SELECT ?item ?v ?l ?prec WHERE {
  VALUES ?item { ${valides.slice(i, i + 300).map(q => `wd:${q}`).join(' ')} }
  ?item p:${prop} ?st . ?st ps:${prop} ?v . FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }
  OPTIONAL { ?st psv:${prop} ?vn . ?vn wikibase:timePrecision ?prec }
  OPTIONAL { ?v rdfs:label ?l FILTER(lang(?l) = 'fr') }
}`)
      for (const l of lignes) {
        const q = qidDe(l.item)
        if (!q) continue
        const v = qidDe(l.v) ?? l.v
        const liste = out.get(q) ?? out.set(q, []).get(q)!
        if (!liste.some(x => x.v === v)) liste.push({ v, l: l.l, prec: l.prec ? Number(l.prec) : undefined })
      }
    }
    return out
  }

  /**
   * Les vues par jour, en moyenne sur trente jours, d'articles de
   * Wikipédia en français, redirections suivies : « Tres de mayo » redirige
   * vers « El tres de mayo de 1808 en Madrid », et l'API des vues par article
   * comptait 38 vues par mois à la redirection. Gardées trente jours.
   */
  async vues(titres: readonly string[]): Promise<Map<string, number>> {
    const fichier = path.join(this.dossier, 'vues.json')
    const gardees: Record<string, { le: string; vues: number }> = existsSync(fichier) ? JSON.parse(readFileSync(fichier, 'utf8')) : {}
    const fraiche = (le: string) => Date.now() - Date.parse(le) < 30 * 86_400_000
    const manquants = [...new Set(titres)].filter(t => !gardees[t] || !fraiche(gardees[t].le))
    for (let i = 0; i < manquants.length; i += 50) {
      const lot = manquants.slice(i, i + 50)
      const vers = new Map<string, string>()
      const parTitre = new Map<string, number>()
      // Les vues arrivent par morceaux : chaque réponse en couvre une partie et dit où reprendre (`pvipcontinue`) —
      // sans la suite, Salvador Dalí avait zéro lecteur.
      let suite: Record<string, string> = {}
      for (let page = 0; page < 20; page++) {
        const d = (await this.demander(
          `https://fr.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', prop: 'pageviews', titles: lot.join('|'), format: 'json', formatversion: '2', redirects: '1', pvipdays: String(JOURS_DE_VUES), ...suite })}`,
        )) as {
          continue?: Record<string, string>
          query?: { pages?: { title: string; pageviews?: Record<string, number | null> }[]; normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[] }
        }
        for (const n of [...(d.query?.normalized ?? []), ...(d.query?.redirects ?? [])]) vers.set(n.from, n.to)
        for (const p of d.query?.pages ?? []) {
          if (!p.pageviews) continue
          const jours = Object.values(p.pageviews).filter((v): v is number => typeof v === 'number')
          parTitre.set(p.title, jours.length > 0 ? Math.round(jours.reduce((s, v) => s + v, 0) / jours.length) : 0)
        }
        if (!d.continue) break
        suite = d.continue
        await attendre(1_000)
      }
      const le = new Date().toISOString()
      for (const t of lot) {
        let cible = t
        for (let saut = 0; saut < 3 && vers.has(cible); saut++) cible = vers.get(cible)!
        gardees[t] = { le, vues: parTitre.get(cible) ?? 0 }
      }
      writeFileSync(fichier, JSON.stringify(gardees))
      await attendre(1_000)
    }
    return new Map(titres.map(t => [t, gardees[t]?.vues ?? 0]))
  }
}

// ── Les commandes ───────────────────────────────────────────────────────

const fichierDesFiches = (cle: string) => path.join(DOSSIER_DES_FAITS, `${cle}.json`)

async function extraire(cles: readonly string[]) {
  const wd = new Wikidata(DOSSIER_DES_FAITS)
  const inconnue = cles.find(c => !FAMILLES.some(f => f.cle === c))
  if (inconnue) throw new Error(`Famille inconnue : ${inconnue} (${FAMILLES.map(f => f.cle).join(', ')}).`)
  // Dans l'ordre demandé : les familles légères d'abord, les films — des milliers de vues à lire — à la fin.
  for (const fam of cles.length === 0 ? FAMILLES : cles.map(c => FAMILLES.find(f => f.cle === c)!)) {
    console.log(`→ ${fam.cle} : ${fam.nom}`)
    const x = await fam.extraire(wd)
    // Les vues des sujets et des réponses d'abord, puis celles des seuls leurres affichés : tout le vivier, c'était
    // deux fois plus de titres, et l'API de Wikipédia en rend trois ou quatre par seconde.
    const titres = x.faits.flatMap(f => [f.sujet.titre, f.reponse.titre]).filter((t): t is string => !!t)
    const vues = new Map(await wd.vues(titres))
    const parNom = new Map(x.vivier.map(e => [e.nom, e.titre]))
    const affiches = fichesDeLaFamille(fam, x, vues).fiches.flatMap(f => f.reponses.filter((_, i) => i !== f.bonne).map(nom => parNom.get(nom)))
    for (const [t, v] of await wd.vues(affiches.filter((t): t is string => !!t))) vues.set(t, v)
    const { fiches, ecartes } = fichesDeLaFamille(fam, x, vues)
    writeFileSync(fichierDesFiches(fam.cle), `[\n${fiches.map(f => JSON.stringify(f)).join(',\n')}\n]\n`)
    const marches = [1, 2, 3, 4, 5].map(d => `${d}: ${fiches.filter(f => f.difficulte === d).length}`).join(' · ')
    console.log(`  ${x.faits.length} faits, ${fiches.length} fiches (difficulté ${marches}) ; écartés : ${Object.entries(ecartes).map(([m, k]) => `${m} ${k}`).join(', ') || 'aucun'}`)
  }
}

function lireLesFiches(cle: string): FicheDeFait[] {
  const f = fichierDesFiches(cle)
  if (!existsSync(f)) throw new Error(`Pas de fiches pour ${cle} : lance d'abord « extraire ${cle} ».`)
  return JSON.parse(readFileSync(f, 'utf8'))
}

function preparerLesLots(o: { questions: number; familles: string[]; parLot: number; nom: string }) {
  if (!/^[A-Za-z0-9]+$/.test(o.nom)) throw new Error(`Le nom d'une génération ne prend que des lettres et des chiffres : ${o.nom}`)
  const inconnue = o.familles.find(c => !FAMILLES.some(f => f.cle === c))
  if (inconnue) throw new Error(`Famille inconnue : ${inconnue} (${FAMILLES.map(f => f.cle).join(', ')}).`)
  const dossier = path.join(DOSSIER_DES_LOTS, o.nom)
  if (existsSync(dossier)) throw new Error(`${dossier} existe déjà : une génération par nom.`)
  const { questions: base } = lireLaBase()
  const tri = new TriDesEntrees(base, empreintesDesLivres())
  // Ce qui attend déjà : les lots fusionnés, et les fiches d'une génération pas encore écrite — deux générations ne se doublent pas.
  for (const e of lotsEnAttente(DOSSIER_DES_LOTS, new Set(base.map(q => q.empreinte)))) tri.retenir(e.question, e.ou)
  for (const g of existsSync(DOSSIER_DES_LOTS) ? readdirSync(DOSSIER_DES_LOTS, { withFileTypes: true }).filter(d => d.isDirectory()) : []) {
    for (const nom of readdirSync(path.join(DOSSIER_DES_LOTS, g.name)).filter(n => n.endsWith('.faits.json'))) {
      for (const fiche of JSON.parse(readFileSync(path.join(DOSSIER_DES_LOTS, g.name, nom), 'utf8')) as FicheDeFait[]) {
        const lu = lireQuestionDeLaBase(entreeDeLaFiche(fiche), { sansId: true })
        if ('question' in lu) tri.retenir(lu.question, `${g.name}/${nom}`)
      }
    }
  }
  const lots = choisirLesFiches(new Map(o.familles.map(cle => [cle, lireLesFiches(cle)])), tri, { questions: o.questions, parLot: o.parLot })
  mkdirSync(dossier, { recursive: true })
  const missions = lots.map((fiches, i) => {
    const id = `${o.nom}-${String(i + 1).padStart(2, '0')}`
    const f = fichiersDuLot(DOSSIER_DES_LOTS, id)
    writeFileSync(f.faits, `[\n${fiches.map(x => JSON.stringify(x)).join(',\n')}\n]\n`)
    writeFileSync(f.consigne, consigneDesFaits(fiches, { phrases: f.phrases, verifier: `cd ${SERVEUR} && npx tsx scripts/faits-wikidata.ts fusionner ${id}` }))
    return `- redacteur-campagne (${fiches[0].famille}) : Ta consigne est dans ${f.consigne} : lis-la en entier avec Read, écris les phrases de ses ${fiches.length} fiches dans ${f.phrases}, puis vérifie-les comme elle le dit, jusqu'à zéro refus.`
  })
  console.log(`${lots.reduce((s, l) => s + l.length, 0)} fiches en ${lots.length} lots, dans ${dossier}. Un agent par lot :\n${missions.join('\n')}`)
  console.log(`\nPuis : base-campagne.ts fiche sur un lot sur trois de chaque famille, un relecteur-campagne par fiche, appliquer, voisines, ranger.`)
}

function lireLesOptions(args: readonly string[]) {
  const options = new Map<string, string>()
  const mots: string[] = []
  for (const a of args) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a)
    if (m) options.set(m[1], m[2] ?? '')
    else mots.push(a)
  }
  return { mots, options }
}

async function principal(args: readonly string[]) {
  const [commande, ...reste] = args
  const { mots, options } = lireLesOptions(reste)
  if (commande === 'extraire') await extraire(mots)
  else if (commande === 'lots') {
    preparerLesLots({
      questions: Number(options.get('questions') ?? 300),
      familles: options.get('familles')?.split(',') ?? FAMILLES.map(f => f.cle),
      parLot: Number(options.get('par-lot') ?? FICHES_PAR_LOT),
      nom: options.get('nom') ?? 'wd1',
    })
  } else if (commande === 'fusionner') {
    if (fusionner(mots[0] ?? '') > 0) process.exitCode = 1
  } else if (commande === 'familles') {
    for (const f of FAMILLES) {
      const n = existsSync(fichierDesFiches(f.cle)) ? `${lireLesFiches(f.cle).length} fiches` : 'pas encore extraite'
      console.log(`${f.cle.padEnd(14)} ${f.nom} (${f.categorie}) — ${n}`)
    }
  } else {
    console.log('faits-wikidata.ts extraire [<famille> …] | lots --questions=<n> [--familles=…] [--par-lot=30] [--nom=wd1] | fusionner <nom>-NN | familles — le détail en tête du script.')
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).catch(e => {
    console.error((e as Error).message)
    process.exitCode = 1
  })
}
