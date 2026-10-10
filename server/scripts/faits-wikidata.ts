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
// Le pilote de trois cents questions, le même soir : 299 écrites en douze
// lots sans un refus du juge, pour 650 jetons de rédacteur par question, puis
// toutes relues, pour 490 de correcteur — 1 140 en tout, la moitié d'une
// question écrite de mémoire et relue. Le correcteur en a retiré trois, des
// vainqueurs de 2026 qu'il ne connaît pas encore, et corrigé quatorze : sept
// phrases écrites de mémoire, dont deux sur la foi d'une description de
// Wikidata (Patty Jenkins, « réalisatrice et scénariste », n'a pas écrit
// « Wonder Woman »), trois dates fausses sur Wikidata, un musée d'avant 1949,
// trois difficultés. Un lot sur trois relu en aurait laissé passer les deux
// tiers : chaque lot se relit.
//
//   NODE_USE_ENV_PROXY=1 npx tsx scripts/faits-wikidata.ts extraire [<famille> …] [--max-sujets=600]
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
import { tronquer } from '../../shared/avatars'
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
  /** Le nom qu'on affiche : le titre de son article sur Wikipédia en français, sans sa parenthèse — sinon son libellé. */
  nom: string
  /** Son libellé français sur Wikidata, que l'index des libellés retrouve : la recherche des homonymes passe par lui. */
  libelle?: string
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
export function choisirLeurres(
  reponse: EntiteWd,
  vivier: readonly EntiteWd[],
  o: {
    ecart: number
    exclus?: ReadonlySet<string>
    /** Combien de fois chaque leurre s'est déjà affiché dans la famille : Tarantino, Clooney et Ben Stiller revenaient à toutes les questions de films de leur génération. */
    affiches?: ReadonlyMap<string, number>
  },
): string[] | null {
  const annees = reponse.annees ?? []
  if (annees.length === 0) return null
  const famille = nomDeFamille(reponse.nom)
  const pays = new Set(reponse.pays ?? [])
  const candidats = vivier
    .filter(e => e.qid !== reponse.qid && !o.exclus?.has(e.qid) && (e.annees?.length ?? 0) > 0)
    .filter(e => plat(e.nom) !== plat(reponse.nom) && (!famille || nomDeFamille(e.nom) !== famille))
    .map(e => ({ e, d: Math.min(...e.annees!.flatMap(a => annees.map(b => Math.abs(a - b)))) }))
    .filter(({ d }) => d <= o.ecart)
    // L'année d'abord ; le même pays vaut quinze ans ; un peu de notoriété départage — un leurre que personne ne connaît
    // ne trompe personne ; chaque affichage déjà fait coûte quatre ans, pour que la famille ne repose pas les trois mêmes.
    .map(({ e, d }) => ({ e, score: d + ((e.pays ?? []).some(p => pays.has(p)) ? 0 : 15) - Math.min(e.liens, 150) / 15 + 4 * (o.affiches?.get(e.nom) ?? 0) }))
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
export function difficulteAPriori(
  sorte: 'sujet' | 'palmares',
  vues: { sujet: number; reponse: number; leurres: readonly number[] },
  o: { echelle?: number; moinsSuivi?: boolean } = {},
): number {
  const l = (v: number) => Math.log10(1 + Math.max(0, v))
  // Connaître l'œuvre ne suffit pas : il faut en connaître l'auteur — le Pentagone est célèbre, George Bergstrom
  // ne l'est pas. La question est aussi connue que le moins connu des deux, à l'échelle de sa famille : un film est
  // bien plus lu qu'un tableau, et Get Out, à trois cents vues par jour, n'est pas une question que tout le monde réussit.
  const connu = (sorte === 'palmares' ? vues.reponse / 4 : Math.min(vues.sujet, vues.reponse)) * (o.echelle ?? 1)
  // Les seuils, relus sur les tableaux : la Joconde (800 vues par jour) en 1, Le Jardin des délices (240) en 2, Des glaneuses (100) en 3.
  let d = connu >= 600 ? 1 : connu >= 200 ? 2 : connu >= 70 ? 3 : connu >= 25 ? 4 : 5
  if (sorte === 'sujet' && vues.leurres.length > 0) {
    const ecart = l(vues.reponse) - vues.leurres.reduce((s, v) => s + l(v), 0) / vues.leurres.length
    if (ecart >= 1) d--
    else if (ecart <= -0.5) d++
  }
  // Le Tour d'Italie et le Tour d'Espagne se suivent moins, en France, que le Tour de France.
  if (o.moinsSuivi) d++
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
  const anecdote = p?.a?.trim()
  return {
    ...entree,
    texte: guillemets((p?.t ?? f.texte).trim()),
    anecdote: anecdote ? guillemets(anecdote) : null,
    explication: tronquer(guillemets((p?.x ?? '').trim()), MAX_EXPLICATION),
  }
}

/**
 * Les guillemets d'un titre, avec une espace à l'intérieur, comme les 2 452
 * de la base : au pilote du 10 octobre 2026, un rédacteur sur douze les
 * collait («Anora»), et le juge ne le voit pas.
 */
export const guillemets = (s: string): string => s.replace(/«\s*/g, '« ').replace(/\s*»/g, ' »')

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
L'année et les descriptions entre parenthèses viennent de Wikidata, qui se trompe parfois : l'année d'un livre ou d'un tableau peut être celle d'une édition, d'une traduction ou d'une estimation, et « réalisatrice et scénariste » ne dit pas qu'elle a écrit ce film-là. N'en écris que ce que tu sais juste ; sinon, l'époque suffit.
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
  /** Ce que valent ses vues au regard de celles des tableaux, sur quoi les seuils de difficulté se sont réglés : un film est bien plus lu. */
  echelle?: number
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
 * Les titres ambigus d'une famille : ceux qu'une autre œuvre porte aussi,
 * d'un autre auteur, et assez connue pour qu'on y pense — quatre langues au
 * moins, et le quart de celles du sujet. « La Naissance de Vénus » est de
 * Botticelli et de Bouguereau ; « Autoportrait », de tout le monde. Les
 * versions d'un même auteur ne le sont pas — il y a plusieurs Cri, une seule
 * réponse —, ni les copies anonymes d'un chef-d'œuvre : compter tous les
 * homonymes écartait la Joconde. Un auteur inconnu compte pour un autre
 * auteur : dans le doute, le titre est ambigu.
 */
export function titresAmbigus(
  sujets: readonly { qid: string; nom: string; auteur: string; liens: number }[],
  lignes: readonly { item: string; l: string; a?: string; n: number }[],
): Set<string> {
  const parTitre = new Map<string, { item: string; a?: string; n: number }[]>()
  for (const l of lignes) {
    const titre = plat(l.l)
    const memes = parTitre.get(titre) ?? parTitre.set(titre, []).get(titre)!
    memes.push(l)
  }
  const ambigus = new Set<string>()
  for (const s of sujets) {
    const titre = plat(s.nom)
    const autres = (parTitre.get(titre) ?? []).filter(l => qidDe(l.item) !== s.qid && (l.a === undefined || qidDe(l.a) !== s.auteur))
    if (autres.some(l => l.n >= Math.max(4, s.liens / 4))) ambigus.add(titre)
  }
  return ambigus
}

/**
 * Les titres des sujets que d'autres œuvres de la classe portent aussi, d'un
 * autre auteur — cherchés par leur titre exact, que l'index des libellés rend
 * d'un coup, quelle que soit leur notoriété. Balayer toute la classe dépassait
 * les soixante secondes du service pour les romans : la réponse arrivait
 * coupée, une trace d'erreur à la place de la fin.
 */
async function homonymesDe(wd: Wikidata, motif: string, prop: string, faits: readonly FaitBrut[]): Promise<Set<string>> {
  const titres = [...new Set(faits.flatMap(f => [f.sujet.libelle ?? f.sujet.nom, f.sujet.nom]))]
  const lignes: { item: string; l: string; a?: string; n: number }[] = []
  for (let i = 0; i < titres.length; i += 200) {
    const lot = await wd.sparql(
      `SELECT ?item ?l ?a ?n WHERE { VALUES ?l { ${titres.slice(i, i + 200).map(t => `${JSON.stringify(t)}@fr`).join(' ')} } ?item rdfs:label ?l . ${motif} ?item wikibase:sitelinks ?n . OPTIONAL { ?item wdt:${prop} ?a } }`,
    )
    lignes.push(...lot.map(l => ({ item: l.item, l: l.l, a: l.a, n: Number(l.n) })))
  }
  // Sous son libellé comme sous le titre qu'on affichera : l'un ou l'autre peut être celui d'une autre œuvre.
  return titresAmbigus(
    faits.flatMap(f => [...new Set([f.sujet.libelle ?? f.sujet.nom, f.sujet.nom])].map(nom => ({ qid: f.sujet.qid, nom, auteur: f.reponse.qid, liens: f.sujet.liens }))),
    lignes,
  )
}

/**
 * Les sujets dont l'auteur porte une réserve — « attribué à », « vers »,
 * « probablement » (P1480, P5102, P1773) : leurs leurres pourraient être
 * justes, et la réponse se discute.
 */
async function attributionsDouteuses(wd: Wikidata, qids: readonly string[], prop: string): Promise<Set<string>> {
  const douteux = new Set<string>()
  for (let i = 0; i < qids.length; i += 300) {
    const lignes = await wd.sparql(
      `SELECT DISTINCT ?item WHERE { VALUES ?item { ${qids.slice(i, i + 300).map(q => `wd:${q}`).join(' ')} } ?item p:${prop} ?st . { ?st pq:P1480 [] } UNION { ?st pq:P5102 [] } UNION { ?st pq:P1773 [] } }`,
    )
    for (const l of lignes) {
      const q = qidDe(l.item)
      if (q) douteux.add(q)
    }
  }
  return douteux
}

/**
 * Les faits d'une famille « une œuvre, son auteur » : les sujets assez
 * traduits, dont un seul auteur répond — deux réalisateurs, c'est un fait qui
 * se discute —, un auteur admis (`auteur` : un écrivain de métier, une
 * personne plutôt qu'une agence) ; et le vivier des leurres, ceux qui signent
 * au moins `oeuvresMin` de ces sujets — les auteurs connus d'œuvres connues.
 * « Métier : peintre » y mettait Johan Huizinga, historien, et l'impératrice
 * Dagmar ; et balayer toute la classe pour le dresser dépassait les soixante
 * secondes du service.
 */
async function oeuvresEtAuteurs(
  wd: Wikidata,
  o: { motif: string; prop: string; liensMin: number; oeuvresMin: number; date: string; pays?: string; indice?: string; auteur?: { prop: string; valeurs: readonly string[] } },
): Promise<Extraction> {
  const sujetsBruts = await wd.sparql(`SELECT DISTINCT ?item WHERE { ${o.motif} ?item wikibase:sitelinks ?n . FILTER(?n >= ${o.liensMin}) }`)
  const qids = sujetsBruts.map(l => qidDe(l.item)).filter((q): q is string => q !== null)
  const reponses = await wd.valeurs(qids, o.prop)
  const douteux = await attributionsDouteuses(wd, qids, o.prop)
  const seuls = qids.filter(q => !douteux.has(q) && (reponses.get(q) ?? []).length === 1 && /^Q\d+$/.test(reponses.get(q)![0].v))
  const auteurs = [...new Set(seuls.map(q => reponses.get(q)![0].v))]
  // Un auteur qui n'est pas admis (un groupe, un anonyme, Moïse pour La Genèse) ne répond pas : son fait se discute.
  const qualites = o.auteur ? await wd.valeurs(auteurs, o.auteur.prop) : null
  const admis = new Set(auteurs.filter(a => !qualites || (qualites.get(a) ?? []).some(v => o.auteur!.valeurs.includes(v.v))))
  const uniques = seuls.filter(q => admis.has(reponses.get(q)![0].v))
  const parAuteur = new Map<string, number>()
  for (const q of uniques) parAuteur.set(reponses.get(q)![0].v, (parAuteur.get(reponses.get(q)![0].v) ?? 0) + 1)
  const vivier = [...parAuteur].filter(([, k]) => k >= o.oeuvresMin).map(([a]) => a)
  const sujets = await wd.entites(uniques)
  const dates = await wd.valeurs(uniques, o.date)
  const pays = o.pays ? await wd.valeurs(uniques, o.pays) : new Map<string, Valeur[]>()
  const indices = o.indice ? await wd.valeurs(uniques, o.indice, { periodes: true }) : new Map<string, Valeur[]>()
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
      indices: [valeurActuelle(indices.get(q) ?? [])?.l].filter((l): l is string => !!l),
      francais: (pays.get(q) ?? []).some(v => v.v === FRANCE) || (reponse.pays ?? []).includes(FRANCE),
    })
  }
  const homonymes = await homonymesDe(wd, o.motif, o.prop, faits)
  return { faits, vivier: vivier.map(a => gens.get(a)).filter((e): e is EntiteWd => !!e), homonymes }
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
      oeuvresEtAuteurs(wd, { motif: '?item wdt:P31 wd:Q3305213 .', prop: 'P170', liensMin: 12, oeuvresMin: 2, date: 'P571', indice: 'P195' }),
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
    echelle: 0.5,
    sorte: 'sujet',
    extraire: wd =>
      oeuvresEtAuteurs(wd, { motif: '?item wdt:P31 wd:Q11424 .', prop: 'P57', liensMin: 40, oeuvresMin: 2, date: 'P577', pays: 'P495' }),
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
        oeuvresMin: 2,
        date: 'P577',
        pays: 'P495',
        auteur: { prop: 'P106', valeurs: ['Q36180', 'Q6625963', 'Q49757', 'Q214917', 'Q4964182'] },
      }),
  },
  // Pas d'édifices : sur Wikidata, « architecte » nomme souvent l'auteur d'une partie — Viollet-le-Duc pour la statue de
  // la Liberté, Stéphen Sauvestre pour la tour Eiffel, l'auteur de la façade pour Sainte-Marie-Majeure. Des faits qui
  // trompent, essayés et écartés le 10 octobre 2026.
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
export function fichesDeLaFamille(
  fam: Famille,
  x: Extraction,
  vues: ReadonlyMap<string, number>,
  aujourdhui = new Date(),
): { fiches: FicheDeFait[]; ecartes: Record<string, number> } {
  const ecartes: Record<string, number> = {}
  const ecarter = (motif: string) => (ecartes[motif] = (ecartes[motif] ?? 0) + 1)
  const vuesDe = (e: EntiteWd | undefined) => (e?.titre ? (vues.get(e.titre) ?? 0) : 0)
  const parNom = new Map(x.vivier.map(e => [e.nom, e]))
  const tries = [...x.faits].sort((a, b) => vuesDe(b.sujet) - vuesDe(a.sujet) || a.sujet.qid.localeCompare(b.sujet.qid))
  const parReponse = new Map<string, number>()
  const dejaAffiches = new Map<string, number>()
  const fiches: FicheDeFait[] = []
  for (const f of tries) {
    if (!f.sujet.titre || !f.reponse.titre) { ecarter('sans article sur Wikipédia en français'); continue }
    // Un fait de l'année ne se relit pas : le correcteur ne le connaît pas encore, et Wikidata le retouche encore — au
    // pilote du 10 octobre 2026, les vainqueurs 2026 du Tour, du Giro et de la Vuelta, écrits pour rien, ont été retirés.
    if (f.annee !== null && f.annee >= aujourdhui.getFullYear()) { ecarter("de l'année, trop frais pour être relu"); continue }
    if (x.homonymes.has(plat(f.sujet.nom)) || (f.sujet.libelle && x.homonymes.has(plat(f.sujet.libelle)))) { ecarter('titre porté par plusieurs sujets'); continue }
    if ((fam.sorte === 'palmares' ? vuesDe(f.reponse) : vuesDe(f.sujet)) < fam.vuesMin) { ecarter('trop peu lu en France'); continue }
    if ((parReponse.get(f.reponse.qid) ?? 0) >= fam.parReponse) { ecarter('plafond par réponse'); continue }
    const leurres = choisirLeurres(f.reponse, x.vivier, { ecart: fam.ecart, affiches: dejaAffiches })
    if (!leurres) { ecarter('moins de six leurres'); continue }
    parReponse.set(f.reponse.qid, (parReponse.get(f.reponse.qid) ?? 0) + 1)
    const affiches = leurres.slice(0, 3)
    for (const nom of affiches) dejaAffiches.set(nom, (dejaAffiches.get(nom) ?? 0) + 1)
    const difficulte = difficulteAPriori(
      fam.sorte,
      { sujet: vuesDe(f.sujet), reponse: vuesDe(f.reponse), leurres: affiches.map(nom => vuesDe(parNom.get(nom))) },
      { echelle: fam.echelle, moinsSuivi: fam.sorte === 'palmares' && !f.francais },
    )
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
        { nom: f.sujet.nom, type: fam.typeSujet, description: tronquer(f.sujet.description ?? fam.descriptionSujet, 120) },
        { nom: f.reponse.nom, type: 'personne', description: tronquer(f.reponse.description ?? '', 120) },
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

/** Une valeur d'une propriété : l'objet (un identifiant, une date, un texte), son libellé, la précision d'une date, et depuis quand et jusqu'à quand elle vaut. */
export interface Valeur {
  v: string
  l?: string
  prec?: number
  debut?: string
  fin?: string
}

/**
 * La valeur d'aujourd'hui d'une propriété qui a une histoire, comme la
 * collection d'un tableau : celles qui ont pris fin sont passées, et des
 * autres la plus récente ; sans date pour les départager, aucune. « La
 * Madeleine à la veilleuse » avait le musée Wallraf-Richartz depuis 1941, le
 * Central Collecting Point de Munich en 1946, le Louvre depuis 1949, et le
 * rédacteur en avait fait « une version à Cologne ».
 */
export function valeurActuelle(vs: readonly Valeur[]): Valeur | null {
  const ouvertes = vs.filter(v => !v.fin)
  if (ouvertes.length <= 1) return ouvertes[0] ?? null
  const debuts = ouvertes.map(v => (v.debut ? anneeDe(v.debut) : null))
  if (debuts.some(a => a === null)) return null
  const dernier = Math.max(...(debuts as number[]))
  return debuts.filter(a => a === dernier).length === 1 ? ouvertes[debuts.indexOf(dernier)] : null
}

const UA = 'FiestApp/1.0 (https://github.com/Maxilyas/FiestApp ; questions de quiz)'
/** Les jours sur lesquels se mesurent les vues : trente, et l'API en rend deux fois plus d'articles par réponse qu'à soixante. */
const JOURS_DE_VUES = 30

/**
 * La médiane des vues de chaque jour, pas leur moyenne : une série tirée
 * d'« À l'est d'Éden » est sortie le 1er octobre 2026, et le roman, lu trois
 * cents fois par jour, l'a été treize mille — sa moyenne sur trente jours en
 * faisait un livre que tout le monde connaît, en difficulté 1. Une médiane ne
 * bouge qu'à un pic de plus de la moitié des jours.
 */
export function mediane(jours: readonly number[]): number {
  if (jours.length === 0) return 0
  const tries = [...jours].sort((a, b) => a - b)
  const m = tries.length >> 1
  return Math.round(tries.length % 2 === 1 ? tries[m] : (tries[m - 1] + tries[m]) / 2)
}
const attendre = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
/** Une réponse que le serveur a refusée pour de bon (400, 404…) : la redemander ne la changerait pas. */
class ErreurHttp extends Error {}
/**
 * Les caractères de contrôle, que JSON refuse bruts dans une chaîne — une
 * tabulation dans une description de Wikidata, le 10 octobre 2026. Entre deux
 * éléments, une espace vaut un saut de ligne ; une séquence échappée (« \n »)
 * n'en contient aucun : les remplacer tous ne change rien d'autre.
 */
const CONTROLES = /[\u0000-\u001F]/g

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

  constructor(
    private readonly dossier: string,
    /** Entre deux requêtes de vues : deux secondes, sinon Wikipédia répond 429 à l'adresse partagée du cloud. */
    private readonly pause = 2_000,
  ) {
    this.cache = path.join(dossier, 'cache')
    mkdirSync(this.cache, { recursive: true })
  }

  private async demander(url: string, init: RequestInit = {}): Promise<unknown> {
    for (let essai = 1; ; essai++) {
      try {
        const r = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(90_000) })
        // Lu dans la même reprise : une réponse longue se coupe aussi en route (« terminated »), une fois les en-têtes passés.
        // Un libellé de Wikidata porte parfois un caractère de contrôle brut, que JSON refuse : les romans ne s'extrayaient pas.
        if (r.ok) return JSON.parse((await r.text()).replace(CONTROLES, ' '))
        const corps = (await r.text()).slice(0, 300)
        // Wikipédia limite fort une adresse partagée, comme celle du cloud : on attend ce qu'il dit, et de plus en plus, jusqu'à deux minutes.
        if ((r.status === 429 && essai < 10) || (r.status >= 500 && essai < 6)) {
          await attendre(Math.min(120, Math.max(Number(r.headers.get('retry-after')) || 0, 2 ** essai)) * 1000)
          continue
        }
        throw new ErreurHttp(`${url.slice(0, 80)}… : ${r.status} ${corps}`)
      } catch (e) {
        // Refusée, ou illisible même nettoyée : la même requête rendrait la même chose.
        if (e instanceof ErreurHttp || e instanceof SyntaxError) throw e
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
        // Le titre de l'article plutôt que le libellé : sur Wikidata, Michel-Ange s'appelait « Michel-Ange Buronarroti » le
        // 10 octobre 2026, et le leurre s'affichait ainsi ; « Le Parrain (film) » se dit « Le Parrain ».
        const nom = l.t ? l.t.replace(/\s*\([^()]*\)\s*$/, '') : l.l
        if (q && nom && !out.has(q)) out.set(q, { qid: q, nom, libelle: l.l, description: l.d ?? null, titre: l.t ?? null, liens: Number(l.n) })
      }
    }
    return out
  }

  /**
   * Les valeurs d'une propriété, hors rang déprécié, par lots : l'objet, son
   * libellé en français, la précision d'une date — et, demandées, ses dates
   * de début et de fin (`periodes`), que seules les propriétés qui ont une
   * histoire demandent : la requête change, et avec elle sa place au cache.
   */
  async valeurs(qids: readonly string[], prop: string, o: { periodes?: boolean } = {}): Promise<Map<string, Valeur[]>> {
    const out = new Map<string, Valeur[]>()
    const valides = qids.filter(q => /^Q\d+$/.test(q))
    for (let i = 0; i < valides.length; i += 300) {
      const lignes = await this.sparql(`SELECT ?item ?v ?l ?prec${o.periodes ? ' ?debut ?fin' : ''} WHERE {
  VALUES ?item { ${valides.slice(i, i + 300).map(q => `wd:${q}`).join(' ')} }
  ?item p:${prop} ?st . ?st ps:${prop} ?v . FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }
  OPTIONAL { ?st psv:${prop} ?vn . ?vn wikibase:timePrecision ?prec }
  OPTIONAL { ?v rdfs:label ?l FILTER(lang(?l) = 'fr') }${o.periodes ? '\n  OPTIONAL { ?st pq:P580 ?debut } OPTIONAL { ?st pq:P582 ?fin }' : ''}
}`)
      for (const l of lignes) {
        const q = qidDe(l.item)
        if (!q) continue
        const v = qidDe(l.v) ?? l.v
        const liste = out.get(q) ?? out.set(q, []).get(q)!
        if (!liste.some(x => x.v === v)) liste.push({ v, l: l.l, prec: l.prec ? Number(l.prec) : undefined, debut: l.debut, fin: l.fin })
      }
    }
    return out
  }

  /**
   * Les vues d'un jour ordinaire, la médiane de trente jours, d'articles de
   * Wikipédia en français, redirections suivies : « Tres de mayo » redirige
   * vers « El tres de mayo de 1808 en Madrid », et l'API des vues par article
   * comptait 38 vues par mois à la redirection. Gardées trente jours — dans
   * un fichier à part de celui des moyennes d'avant, qu'aucune ne se relise.
   */
  async vues(titres: readonly string[]): Promise<Map<string, number>> {
    const fichier = path.join(this.dossier, 'vues-medianes.json')
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
          parTitre.set(p.title, mediane(Object.values(p.pageviews).filter((v): v is number => typeof v === 'number')))
        }
        if (!d.continue) break
        suite = d.continue
        await attendre(this.pause)
      }
      const le = new Date().toISOString()
      for (const t of lot) {
        let cible = t
        for (let saut = 0; saut < 3 && vers.has(cible); saut++) cible = vers.get(cible)!
        gardees[t] = { le, vues: parTitre.get(cible) ?? 0 }
      }
      writeFileSync(fichier, JSON.stringify(gardees))
      await attendre(this.pause)
    }
    return new Map(titres.map(t => [t, gardees[t]?.vues ?? 0]))
  }
}

// ── Les commandes ───────────────────────────────────────────────────────

const fichierDesFiches = (cle: string) => path.join(DOSSIER_DES_FAITS, `${cle}.json`)

async function extraire(cles: readonly string[], maxSujets = Infinity) {
  const wd = new Wikidata(DOSSIER_DES_FAITS)
  const inconnue = cles.find(c => !FAMILLES.some(f => f.cle === c))
  if (inconnue) throw new Error(`Famille inconnue : ${inconnue} (${FAMILLES.map(f => f.cle).join(', ')}).`)
  // Dans l'ordre demandé : les familles légères d'abord, les films — des milliers de vues à lire — à la fin.
  for (const fam of cles.length === 0 ? FAMILLES : cles.map(c => FAMILLES.find(f => f.cle === c)!)) {
    console.log(`→ ${fam.cle} : ${fam.nom}`)
    const brute = await fam.extraire(wd)
    // Les vues se lisent à un ou deux articles par seconde depuis une adresse partagée : `--max-sujets` borne une
    // extraction pressée aux sujets les plus traduits — ceux qui ont le plus de chances d'être connus.
    const x = { ...brute, faits: [...brute.faits].sort((a, b) => b.sujet.liens - a.sujet.liens).slice(0, maxSujets) }
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
  console.log(`\nPuis : base-campagne.ts fiche sur chaque lot, un relecteur-campagne par fiche, appliquer, voisines, ranger.`)
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
  if (commande === 'extraire') await extraire(mots, options.has('max-sujets') ? Number(options.get('max-sujets')) : undefined)
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
