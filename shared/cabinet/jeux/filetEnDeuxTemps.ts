// Le Filet en deux temps — le nouveau Filet (`retours/2026-11-09/le-nouveau-filet.md`, sa maquette jouable
// `maquette-filet/`, sa tablée `la-tablee-du-filet.md`) : une année ou une grandeur de la base, et quatre époques —
// quatre ordres de grandeur — en frise. Il choisit la sienne, puis vise la valeur sur la piste de cette époque, où le
// curseur se pose au milieu. Sur les 169 lancers réels du 1er au 8 novembre 2026, le Filet d'avant (`filet.ts`) se
// jouait au hasard : le grand filet laissé au milieu sans lire la question réussissait 45 % des manches, les joueurs
// 43 %. Ici, au hasard, la bonne époque une fois sur quatre.
//
// La distance juge d'abord — ★★★ à un douzième de l'époque, ★★ à un quart, même dans l'époque d'à côté quand la
// réponse touche sa borne —, puis ★ pour la bonne époque. Deux aides, une fois chacune par manche (« Deux époques de
// moins », « Un indice »), retirent chacune une étoile, jamais un cœur : elles abaissaient d'abord un plafond, et qui
// ne visait qu'une étoile ne payait rien (Claire, à la tablée). Éclairer en offre une : la zone dorée du Filet d'avant
// ne servait à personne.
//
// Tout ce qui se tire se fige au tirage, du hasard du serveur : les quatre époques et la place de la réponse parmi
// elles, les deux époques que l'aide retirerait, les repères, l'indice, les anneaux, le prix d'une aide. La règle n'a
// ni hasard ni barème à relire : une partie commencée se juge comme elle a été tirée, un chiffre changé ne vaut que
// pour les parties qui commencent — sans version du départ —, et le Filet d'avant juge les parties d'avant, que leur
// tirage désigne (`deuxTemps` absent).
//
// Rien ne part au téléphone avant le verdict qui dise où est la réponse (invariant 1) : ni la valeur, ni la bonne
// époque, ni les époques que l'aide retirerait ; l'indice, une fois pris.

import {
  ANNEAUX_DES_EPOQUES,
  ANNEAUX_DES_GRANDEURS,
  ANNEE_MIN_DU_FILET,
  CRANS_D_UNE_TRANCHE,
  CRAN_LE_PLUS_FIN,
  DUREES_DES_JEUX,
  EPOQUES_DU_FILET,
  ETOILES_D_UNE_AIDE,
  LETTRES_D_UN_MOT_DU_SUJET,
  ORDRES_DE_GRANDEUR,
  PANEL_DE_L_ACTE_II,
  PANEL_DE_L_ACTE_III,
  RECUL_DES_ANNEES_DU_FILET,
  REPERES_DU_FILET,
  REPERES_SIENS_DU_FILET,
  REPERE_A_LA_REPONSE,
  TRANCHES_DU_FILET,
  TRANCHES_RETIREES,
  VALEURS_D_UN_THEME_DU_FILET,
  VALEUR_MIN_DU_FILET,
} from '../bareme'
import { CATEGORIES, type Categorie } from '../../categories'
import { decimales, ecartEstimation } from '../../classement'
import type { QuestionDuFilet } from '../contenu'
import { GESTE_A_JUGER, SANS_REPONSE, auHasard, battre, champsDuGeste, estUnIndex, naturelDe, pieceDeLaQuestion, reponseEnvoyee, rienAEclairer, type QuestionTiree } from './outils'
import { justeDeLaPiece, type RegleDuJeu, type VerdictDUneManche } from './regle'

// ── Ce qui se tire ────────────────────────────────────────────────────────

/** Une époque d'une année, ou un ordre de grandeur : ses bornes comprises, et le cran de sa piste. */
export interface TrancheDuFilet {
  de: number
  a: number
  /** Le cran du curseur et des boutons − et + : un an ; 5 de 300 à 1 000, 10 de 1 000 à 3 000… */
  pas: number
}

/** Un repère de la frise : une date ou une grandeur que tout le monde connaît, ou la sienne — une année qu'il a déjà su placer. */
export interface RepereDuFilet {
  valeur: number
  /** « La tour Eiffel », « La chute du mur de Berlin ». */
  texte: string
  sien?: true
}

/** Ce que le filet prend autour du curseur : en années pour une année, en pour cent de la réponse pour une grandeur. */
export interface AnneauxDuFilet {
  trois: number
  deux: number
}

export type CleDAideDuFilet = 'epoques' | 'indice'
/** Les deux aides, dans l'ordre où la page les montre : Éclairer en vise une par son rang (le champ `affirmation`, comme au Quiz). */
export const AIDES_DU_FILET: readonly CleDAideDuFilet[] = ['epoques', 'indice']

/** La question de la base, sa valeur, et tout ce que le serveur a tiré au départ : il ne part jamais au téléphone. */
export interface FiletEnDeuxTempsTire {
  jeu: 'filet'
  /** Ce qui désigne la règle : un tirage du Filet d'avant n'en a pas. */
  deuxTemps: true
  question: QuestionTiree
  valeur: number
  annee: boolean
  unite?: string
  /** Les quatre époques, ou ordres de grandeur, de gauche à droite. */
  tranches: readonly TrancheDuFilet[]
  /** Celle de la réponse — deux pour une grandeur pile sur une borne : elle est des deux tranches qui la bordent. */
  bonnes: readonly number[]
  anneaux: AnneauxDuFilet
  /** Les époques que « Deux époques de moins » retire, tirées au départ parmi les mauvaises. */
  retirables: readonly number[]
  /** Deux au plus, tirés sans regarder où est la réponse (`reperesDuFilet`). */
  reperes: readonly RepereDuFilet[]
  /** Une phrase qui mène à la tranche, jamais à la valeur ; null : la question n'en a pas d'honnête, et l'aide ne se propose pas. */
  indice: string | null
  /** Ce qu'une aide payée retire (`ETOILES_D_UNE_AIDE`), figé au départ. */
  prixDUneAide: number
}

/** Une aide prise : payée — une étoile de moins —, ou offerte par Éclairer. */
export interface AidePrise {
  cle: CleDAideDuFilet
  offerte: boolean
}

/** Ce que le serveur sait avant le lancer : les aides prises. L'époque touchée et le curseur, la page les tient. */
export interface EtatDuFiletEnDeuxTemps {
  aides: readonly AidePrise[]
}

/** Le lancer : l'époque choisie et la valeur visée dans sa piste. */
export interface LancerEnDeuxTemps {
  epoque: number
  x: number
}

/** Le lancer — ou rien, l'envoi de l'échéance d'une page sans époque choisie —, ou une aide payée. */
export type GesteDuFiletEnDeuxTemps = { quoi: 'repondre'; lancer: LancerEnDeuxTemps | null } | { quoi: 'aide'; aide: CleDAideDuFilet }

/** Une aide, telle que la manche la montre : prise ou non, et comment. */
export interface AideMontree {
  cle: CleDAideDuFilet
  prise: 'payee' | 'offerte' | null
}

export interface FiletEnDeuxTempsMontre {
  jeu: 'filet'
  deuxTemps: true
  categorie: string | null
  /** L'intitulé, sans ses réponses : l'une d'elles est la valeur. */
  texte: string
  annee: boolean
  unite?: string
  tranches: TrancheDuFilet[]
  anneaux: AnneauxDuFilet
  reperes: RepereDuFilet[]
  /** Les aides que la question propose — sans indice honnête, « Un indice » n'y est pas. */
  aides: AideMontree[]
  prixDUneAide: number
  /** Les époques retirées, une fois « Deux époques de moins » prise ; vide avant. */
  retirees: number[]
  /** L'indice, une fois pris ; null avant. */
  indice: string | null
}

export interface FiletEnDeuxTempsRevele {
  jeu: 'filet'
  deuxTemps: true
  /** « Pile dedans », « Tout près », « La bonne époque », « À côté », « Le temps a filé ». */
  titre: string
  /** Ce que valait le lancer : la distance, sinon la bonne époque. */
  avantLesAides: 0 | 1 | 2 | 3
  /** Ce que ses aides en ont pris. */
  payees: number
  /** Ce que la manche rapporte : l'un moins l'autre. */
  etoiles: number
  valeur: number
  /** La bonne réponse telle que la base l'écrit (« 1 845 km »). */
  reponse: string
  annee: boolean
  unite?: string
  tranches: TrancheDuFilet[]
  bonnes: number[]
  anneaux: AnneauxDuFilet
  lancer: LancerEnDeuxTemps | null
  /** L'écart du lancer : en années, ou en pour cent de la réponse au dixième ; null sans lancer. */
  ecart: number | null
  /** D'où viennent les étoiles : la bonne époque, ★★ à la distance, ★★★. */
  criteres: { epoque: boolean; deux: boolean; trois: boolean }
  aides: AidePrise[]
  retirees: number[]
  indice: string | null
  reperes: RepereDuFilet[]
  texte: string
  savais: string | null
}

// ── Les époques et les ordres de grandeur ─────────────────────────────────

const RANGS = Array.from({ length: TRANCHES_DU_FILET }, (_, i) => i)

/** La largeur des époques d'une année : celle de son temps — on date plus grossièrement ce qui est loin. */
export function largeurDesEpoques(annee: number): number {
  return (EPOQUES_DU_FILET.find(([depuis]) => annee >= depuis) ?? EPOQUES_DU_FILET[EPOQUES_DU_FILET.length - 1])[1]
}

/** La borne d'ordre de grandeur de rang `k` : 1, 3, 10, 30, 100… pour k = 0, 1, 2, 3, 4… */
export function borneDeGrandeur(k: number): number {
  const n = ORDRES_DE_GRANDEUR.length
  const decade = Math.floor(k / n)
  return ORDRES_DE_GRANDEUR[k - decade * n] * 10 ** decade
}

/** Le rang de la plus haute borne qui ne dépasse pas la valeur : l'ordre de grandeur où elle commence. */
function rangDeGrandeur(valeur: number): number {
  let k = 0
  while (borneDeGrandeur(k + 1) <= valeur) k++
  return k
}

/**
 * Où l'époque de la réponse peut se placer parmi les quatre, de gauche à droite : une année, sans qu'aucune époque ne
 * passe dans l'avenir — une réponse de 2000 à 2024 ne peut être que dans la quatrième, une de 1975 à 1999 que dans
 * les deux dernières ; une grandeur, sans qu'une tranche ne descende sous un. Vide : le Filet ne la pose pas. Le
 * tireur y tire la place, une année avec des poids (`poidsDesPlaces`) : au hasard parmi celles qui restent, elle se
 * devinait — « toujours la dernière époque » gagnait 29 % des manches, 25 % au hasard pur.
 */
export function placesPossibles(valeur: number, annee: boolean, anneeDuDepart: number): number[] {
  if (annee) {
    const largeur = largeurDesEpoques(valeur)
    const sienne = Math.floor(valeur / largeur) * largeur
    return RANGS.filter(i => sienne - i * largeur + TRANCHES_DU_FILET * largeur - 1 <= anneeDuDepart)
  }
  if (!(valeur >= borneDeGrandeur(0))) return []
  const k = rangDeGrandeur(valeur)
  return RANGS.filter(i => k - i >= 0)
}

/** Un nombre rond — 1, 2 ou 5 fois une puissance de dix — au moins égal à celui-ci. */
function rondAuDessus(x: number): number {
  for (let p = 10 ** Math.floor(Math.log10(x)); ; p *= 10) {
    for (const r of [1, 2, 5]) if (r * p >= x - 1e-12) return Number((r * p).toPrecision(12))
  }
}

/**
 * Le cran de la piste d'une tranche de grandeur : rond, en deux cents crans au plus, jamais plus fin qu'un pour une
 * réponse entière, qu'un dixième sinon. La piste est régulière : logarithmique dans la première maquette, son milieu
 * de 300 à 1 000 tombait vers 550 quand Claire visait 650, et « + » restait coincé à 1380 — deux crans écrivaient le
 * même nombre. Le rapport reste dans les tranches, qui croissent par trois ; dedans, on vise en unités.
 */
function cranDUneGrandeur(de: number, a: number, entiere: boolean): number {
  return Math.max(entiere ? CRAN_LE_PLUS_FIN.entiere : CRAN_LE_PLUS_FIN.decimale, rondAuDessus((a - de) / CRANS_D_UNE_TRANCHE))
}

/**
 * Les quatre tranches d'une réponse, la sienne à cette place, celles qui la contiennent, et les anneaux du filet —
 * figés au tirage. Une grandeur pile sur une borne est des deux tranches qui la bordent : 10 000 m² se range de 3 000
 * à 10 000 comme de 10 000 à 30 000 (« dans quelle case ? », Huguette). Null : pas à cette place.
 */
export function tranchesDuFilet(valeur: number, annee: boolean, place: number, anneeDuDepart: number): Pick<FiletEnDeuxTempsTire, 'tranches' | 'bonnes' | 'anneaux'> | null {
  if (!placesPossibles(valeur, annee, anneeDuDepart).includes(place)) return null
  if (annee) {
    const largeur = largeurDesEpoques(valeur)
    const debut = Math.floor(valeur / largeur) * largeur - place * largeur
    return {
      tranches: RANGS.map(k => ({ de: debut + k * largeur, a: debut + (k + 1) * largeur - 1, pas: CRAN_LE_PLUS_FIN.entiere })),
      bonnes: [place],
      anneaux: { trois: Math.floor(largeur / ANNEAUX_DES_EPOQUES.trois), deux: Math.floor(largeur / ANNEAUX_DES_EPOQUES.deux) },
    }
  }
  const premiere = rangDeGrandeur(valeur) - place
  const entiere = Number.isInteger(valeur)
  const tranches = RANGS.map(j => {
    const de = borneDeGrandeur(premiere + j)
    const a = borneDeGrandeur(premiere + j + 1)
    return { de, a, pas: cranDUneGrandeur(de, a, entiere) }
  })
  return { tranches, bonnes: place > 0 && valeur === tranches[place].de ? [place - 1, place] : [place], anneaux: { ...ANNEAUX_DES_GRANDEURS } }
}

/**
 * Ce que le Filet en deux temps pose : une année entière dès `ANNEE_MIN_DU_FILET` et avec `RECUL_DES_ANNEES_DU_FILET`
 * ans de recul — 46 au Filet d'avant, qui écartaient la moitié des années que chaque Français sait placer, 1981,
 * 1998 —, une grandeur dès `VALEUR_MIN_DU_FILET`. `anneeDuDepart` : l'année du jour de Paris du départ, que le tireur
 * lit à l'heure du serveur — jamais l'horloge ici.
 */
export function seTendEnDeuxTemps(valeur: number, annee: boolean, anneeDuDepart: number): boolean {
  if (!annee) return Number.isFinite(valeur) && valeur >= VALEUR_MIN_DU_FILET
  return (
    Number.isInteger(valeur) &&
    valeur >= ANNEE_MIN_DU_FILET &&
    valeur <= anneeDuDepart - RECUL_DES_ANNEES_DU_FILET &&
    placesPossibles(valeur, true, anneeDuDepart).length > 0
  )
}

/**
 * Le premier acte où une question se pose, de zéro à deux, ou null — le Filet ne la pose plus : l'acte I, ce que chaque
 * Français sait placer, et rien d'autre — le levier le plus fort, « des questions que chacun connaisse » (le
 * propriétaire, au matin du 9 novembre 2026) : sur les vrais lancers, elles se placent à 2 % près sept fois plus
 * souvent que les autres ; l'acte II, ce que le panel donne à 50 % et plus ; l'acte III, de 25 à 49 ; sous 25, « les
 * loteries » du cahier, plus rien.
 *
 * Décalé d'un cran le 12 novembre 2026 (« c'est toujours trop dur, des questions trop difficiles », le retour rapporté
 * par le propriétaire) : l'acte I prenait aussi le panel à 50 % ; l'acte II, de 25 à 49 — en production, du 10 au
 * 12 novembre, dix manches ratées sur quinze, la bonne époque une fois sur trois ; l'acte III, les loteries
 * (`retours/2026-11-12/le-filet-en-deux-ecrans.md`).
 */
export function acteDuFilet(q: Pick<QuestionDuFilet, 'chacun' | 'panel'>): 0 | 1 | 2 | null {
  if (q.chacun) return 0
  if (q.panel >= PANEL_DE_L_ACTE_II) return 1
  return q.panel >= PANEL_DE_L_ACTE_III ? 2 : null
}

/**
 * Une question se pose-t-elle à cet acte ? Au sien, et à l'acte II ce que l'acte I pose aussi : chaque acte a pris le
 * réservoir de celui d'avant, et l'acte II celui de l'acte I tout entier. Au-delà de ce que chaque Français sait placer,
 * la note du panel ne trie presque rien — sur les lancers du 1er au 8 novembre rejoués en deux temps, 84 % de manches
 * réussies pour ce classement, une sur deux pour le panel à 50 % et plus comme pour celui de 25 à 49
 * (`retours/2026-11-12/reproductions/le-filet-en-production.ts actes`) : sans elles, l'acte II serait resté aussi dur.
 */
export function sePoseALActe(q: Pick<QuestionDuFilet, 'chacun' | 'panel'>, acte: number): boolean {
  const sien = acteDuFilet(q)
  return sien !== null && (sien === acte || (sien === 0 && acte === 1))
}

/**
 * Les catégories où chaque acte a de quoi tirer une épreuve du Filet : au moins `VALEURS_D_UN_THEME_DU_FILET` valeurs
 * distinctes — le tireur n'en pose jamais deux fois la même dans une partie —, parmi les questions que le Filet pose à
 * l'année du départ. La carte d'une traversée n'en promet pas d'autre (`ThemesDuContenu.filet`) : une épreuve qui
 * promettait la Nature à l'acte I, où elle n'avait que deux questions, en jouait une autre.
 */
export function categoriesDuFilet(questions: Iterable<{ categorie: string; acte: number; valeur: number }>): Categorie[][] {
  const valeurs = Array.from({ length: 3 }, () => new Map<string, Set<number>>())
  for (const q of questions) {
    const parCategorie = valeurs[q.acte]
    if (!parCategorie) continue
    let siennes = parCategorie.get(q.categorie)
    if (!siennes) parCategorie.set(q.categorie, (siennes = new Set()))
    siennes.add(q.valeur)
  }
  return valeurs.map(parCategorie => CATEGORIES.filter(c => (parCategorie.get(c)?.size ?? 0) >= VALEURS_D_UN_THEME_DU_FILET))
}

// ── La place de la réponse ────────────────────────────────────────────────

/**
 * Les poids des places d'une année, selon le nombre de places qui lui restent (de 1 à 4) : calculés sur les années
 * qu'un acte pose, pour que chaque place reçoive un quart des réponses — les anciennes vont moins souvent dans la
 * dernière époque, autant que les récentes y vont d'office. L'ajustement proportionnel itératif : chaque place
 * ramenée à un quart, puis chaque réponse à sa probabilité entière, jusqu'à ce que les deux tiennent. Quand les
 * réponses forcées dépassent le quart, aucun poids ne referme tout : la place forcée garde ce qu'elle a
 * (`reproductions/place-de-la-reponse.mts`, le cahier, décision 10).
 */
export function poidsDesPlaces(annees: readonly number[], anneeDuDepart: number): Record<number, number[]> {
  const parNombre = new Map<number, number>()
  for (const v of annees) {
    const m = placesPossibles(v, true, anneeDuDepart).length
    if (m > 0) parNombre.set(m, (parNombre.get(m) ?? 0) + 1)
  }
  const total = [...parNombre.values()].reduce((a, b) => a + b, 0)
  const poids: Record<number, number[]> = {}
  for (let m = 1; m <= TRANCHES_DU_FILET; m++) poids[m] = RANGS.map(i => (i >= TRANCHES_DU_FILET - m ? 1 / m : 0))
  if (total === 0) return poids
  const groupes = [...parNombre].map(([m, n]) => ({ m, part: n / total }))
  for (let tour = 0; tour < 500; tour++) {
    for (const i of RANGS) {
      const masse = groupes.reduce((s, g) => s + g.part * poids[g.m][i], 0)
      if (masse > 0) for (const g of groupes) poids[g.m][i] *= 1 / TRANCHES_DU_FILET / masse
    }
    for (const g of groupes) {
      const t = poids[g.m].reduce((a, b) => a + b, 0)
      poids[g.m] = poids[g.m].map(x => x / t)
    }
  }
  return poids
}

/**
 * La place d'une réponse, tirée du hasard du tireur : une année avec les poids de son acte — sans poids, au hasard
 * parmi les places qui restent, comme une grandeur. Null : aucune place.
 */
export function tirerLaPlace(places: readonly number[], hasard: () => number, poids?: Record<number, readonly number[]>): number | null {
  if (places.length === 0) return null
  const p = poids?.[places.length]
  if (!p) return places[Math.min(places.length - 1, Math.floor(hasard() * places.length))]
  let x = hasard() * places.reduce((s, i) => s + (p[i] ?? 0), 0)
  for (const i of places) {
    x -= p[i] ?? 0
    if (x < 0) return i
  }
  return places[places.length - 1]
}

// ── Les repères ───────────────────────────────────────────────────────────

/** Les mots d'un texte, sans accents ni capitales, d'au moins tant de lettres : ceux qui disent son sujet. */
function motsDuSujet(texte: string): string[] {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z]+/)
    .filter(m => m.length >= LETTRES_D_UN_MOT_DU_SUJET)
}

/**
 * Les repères d'une frise, tirés sans regarder où est la réponse : un par époque au plus (`REPERES_DU_FILET`), que sa
 * ligne porte à l'écran — un des siens d'abord, une année qu'il a déjà su placer, puis des dates que tout le monde
 * connaît —, rangés de gauche à droite. Deux en tout jusqu'au 12 novembre 2026 : choisis parmi ceux qui s'écartaient de
 * la réponse, ils tombaient rarement dans sa case, et deux repères dans deux époques valaient « Deux époques de moins »
 * gratuit (Claire, au premier tour de la tablée du 9) ; tenus à un quart d'époque d'elle, ils disaient où elle n'était
 * pas — « avec 1870 sur la piste, elle ne pouvait être qu'entre 1850 et 1863 » (Claire, au troisième). Jamais du même
 * sujet que la question, jamais la réponse elle-même : « 1969 · Le premier pas sur la Lune » pour une question sur la
 * Lune.
 *
 * Un repère par époque fait d'une ligne sans repère un signe : si le sujet de la question en écarte tous ceux d'une
 * époque qui en avait — « La mort de Louis XIV », le seul de 1700 à 1749, pour qui demande l'année de sa mort —, la
 * ligne muette serait celle de la réponse. Aucune époque n'en montre alors : seuls les siens restent, qui ne disent
 * rien d'elle. Une époque sans repère au contenu, elle, ne dit rien non plus.
 *
 * Les candidats viennent du tireur — les siens, du journal ; les autres, du contenu du Cabinet, de la même unité pour
 * une grandeur —, le hasard aussi.
 */
export function reperesDuFilet(
  q: { texte: string; valeur: number; annee: boolean; tranches: readonly TrancheDuFilet[] },
  candidats: { siens: readonly RepereDuFilet[]; communs: readonly RepereDuFilet[] },
  hasard: () => number,
): RepereDuFilet[] {
  const sujet = new Set(motsDuSujet(q.texte))
  const permis = (r: RepereDuFilet) =>
    (q.annee ? r.valeur !== q.valeur : Math.abs(r.valeur / q.valeur - 1) >= REPERE_A_LA_REPONSE) && !motsDuSujet(r.texte).some(m => sujet.has(m))
  const trancheDe = (x: number) => q.tranches.findIndex(t => x >= t.de && x <= t.a)
  const pris: { repere: RepereDuFilet; tranche: number }[] = []
  for (const r of battre(candidats.siens.filter(permis), hasard)) {
    if (pris.length >= REPERES_SIENS_DU_FILET) break
    const tranche = trancheDe(r.valeur)
    if (tranche >= 0) pris.push({ repere: { ...r, sien: true }, tranche })
  }
  const dans = (r: RepereDuFilet, tranche: number) => r.valeur >= q.tranches[tranche].de && r.valeur <= q.tranches[tranche].a
  // Le sujet de la question a-t-il vidé une époque de ses repères ? Aucun commun ne vient alors (plus haut).
  const videe = RANGS.some(tranche => candidats.communs.some(r => dans(r, tranche)) && !candidats.communs.some(r => dans(r, tranche) && permis(r)))
  for (const tranche of battre(RANGS, hasard)) {
    if (videe || pris.length >= REPERES_DU_FILET) break
    if (pris.some(p => p.tranche === tranche)) continue
    // Un repère pile sur une borne (30 cm, entre 10–30 et 30–100) est des deux tranches : il ne se tire qu'une fois.
    const ici = candidats.communs.filter(r => permis(r) && dans(r, tranche) && !pris.some(p => p.repere.valeur === r.valeur))
    if (ici.length > 0) {
      const r = auHasard(ici, hasard)
      pris.push({ repere: { valeur: r.valeur, texte: r.texte }, tranche })
    }
  }
  return pris.map(p => p.repere).sort((a, b) => a.valeur - b.valeur)
}

// ── Le tirage ─────────────────────────────────────────────────────────────

/**
 * Le tirage d'une question à cette place : ses tranches, les époques que l'aide retirerait — du hasard du tireur,
 * celui du serveur, jamais de la graine : la page ne le rejoue pas —, ses repères et son indice tels que le tireur les
 * a choisis, et le prix d'une aide. Null : le Filet ne la pose pas, ou pas à cette place.
 */
export function tirageEnDeuxTemps(
  o: {
    question: QuestionTiree
    valeur: number
    annee: boolean
    unite?: string
    place: number
    anneeDuDepart: number
    reperes: readonly RepereDuFilet[]
    indice: string | null
  },
  hasard: () => number,
): FiletEnDeuxTempsTire | null {
  if (!seTendEnDeuxTemps(o.valeur, o.annee, o.anneeDuDepart)) return null
  const cadre = tranchesDuFilet(o.valeur, o.annee, o.place, o.anneeDuDepart)
  if (!cadre) return null
  const retirables = battre(
    RANGS.filter(i => !cadre.bonnes.includes(i)),
    hasard,
  )
    .slice(0, TRANCHES_RETIREES)
    .sort((a, b) => a - b)
  return {
    jeu: 'filet',
    deuxTemps: true,
    question: o.question,
    valeur: o.valeur,
    annee: o.annee,
    ...(o.unite !== undefined && { unite: o.unite }),
    ...cadre,
    retirables,
    reperes: o.reperes.map(r => ({ ...r })),
    indice: o.indice,
    prixDUneAide: ETOILES_D_UNE_AIDE,
  }
}

// ── La piste ──────────────────────────────────────────────────────────────

/** Les crans d'une tranche : de sa borne basse (0) à sa borne haute. */
export const cransDe = (t: TrancheDuFilet): number => Math.round((t.a - t.de) / t.pas)

/** La valeur au cran `i`, bornée à la tranche — écrite comme elle se lit, sans le reste d'une virgule flottante. */
export const valeurAuCran = (t: TrancheDuFilet, i: number): number => Number((t.de + Math.max(0, Math.min(cransDe(t), Math.round(i))) * t.pas).toFixed(decimales(t.pas)))

/** Le cran le plus proche d'une valeur. */
export const cranDe = (t: TrancheDuFilet, x: number): number => Math.max(0, Math.min(cransDe(t), Math.round((x - t.de) / t.pas)))

/**
 * Où le curseur se pose dès qu'une époque est touchée : en son milieu — le propriétaire, au matin du 9 novembre 2026,
 * « elle devrait se placer directement au milieu ». Il n'en donne pas plus que le toucher au milieu, le premier geste
 * de qui ne sait pas, des quatre joueurs de la tablée, au premier tour.
 */
export const milieuDeLaTranche = (t: TrancheDuFilet): number => valeurAuCran(t, cransDe(t) / 2)

/**
 * Trois chiffres qui comptent, un dixième sous cent — un entier pour une piste d'entiers, comme ses crans —, arrondis
 * vers l'intérieur : ce que la phrase promet, la règle le tient (« de 70,8 à 79,7 » pour des syllabes, non).
 */
function versLInterieur(v: number, haut: boolean, entiere: boolean): number {
  let p = v < 100 ? 0.1 : 10 ** (Math.floor(Math.log10(v)) - 2)
  if (entiere) p = Math.max(1, p)
  return Number(((haut ? Math.floor(v / p + 1e-9) : Math.ceil(v / p - 1e-9)) * p).toFixed(decimales(p)))
}

/**
 * Les réponses qu'un lancer à `x` prendrait à ★★★ et à ★★ : le filet se dit en nombres autour du curseur — « ★★★
 * 1960–1964 · ★★ 1956–1968 » —, la règle se lit aussi sur la piste (Claire, à la tablée). Une année : à tant d'années ;
 * une grandeur, les réponses `a` à 6 % ou 25 % d'elles-mêmes de `x` — de x / 1,06 à x / 0,94 —, arrondies vers
 * l'intérieur : la phrase ne promet jamais plus que la règle. Rien de la réponse : la page le calcule de ce qu'elle a.
 */
export function ceQueCouvreLeFilet(
  m: Pick<FiletEnDeuxTempsMontre, 'annee' | 'anneaux'>,
  x: number,
  entiere: boolean,
): { trois: { de: number; a: number }; deux: { de: number; a: number } } {
  if (m.annee) return { trois: { de: x - m.anneaux.trois, a: x + m.anneaux.trois }, deux: { de: x - m.anneaux.deux, a: x + m.anneaux.deux } }
  const anneau = (pc: number) => ({ de: versLInterieur(x / (1 + pc / 100), false, entiere), a: versLInterieur(x / (1 - pc / 100), true, entiere) })
  return { trois: anneau(m.anneaux.trois), deux: anneau(m.anneaux.deux) }
}

// ── Le jugement ───────────────────────────────────────────────────────────

/**
 * L'écart d'une grandeur à la réponse, en pour cent d'elle, au dixième : tel que l'écran l'écrit, et que le jugement
 * le lit. La maquette jugeait d'abord en rapport et écrivait l'écart arrondi : « Ton écart 24 % » sous « À 25 % près :
 * non » (Huguette, 190 g pour 250 g). 17 pour 16 : 6,3 %, pas ★★★. La différence passe par `ecartEstimation`
 * (invariant 15) : la virgule flottante ne départage pas un bord.
 */
export function ecartEnPourCent(x: number, valeur: number): number {
  return Math.round((1000 * ecartEstimation(x, valeur)) / valeur) / 10
}

/** L'écart d'un lancer, comme les anneaux le comptent : en années, ou en pour cent de la réponse. */
const ecartDuLancer = (t: Pick<FiletEnDeuxTempsTire, 'annee' | 'valeur'>, x: number): number => (t.annee ? ecartEstimation(x, t.valeur) : ecartEnPourCent(x, t.valeur))

/**
 * Ce que vaut un lancer, avant les aides : la distance d'abord — ★★★ ou ★★ dans les anneaux, même dans l'époque d'à
 * côté : une réponse posée près d'une borne, de l'autre côté, garde ses étoiles —, sinon ★ pour la bonne époque.
 */
export function etoilesDuLancer(t: Pick<FiletEnDeuxTempsTire, 'annee' | 'valeur' | 'anneaux' | 'bonnes'>, lancer: LancerEnDeuxTemps | null): 0 | 1 | 2 | 3 {
  if (!lancer) return 0
  const ecart = ecartDuLancer(t, lancer.x)
  if (ecart <= t.anneaux.trois) return 3
  if (ecart <= t.anneaux.deux) return 2
  return t.bonnes.includes(lancer.epoque) ? 1 : 0
}

/** Ce que les aides payées coûtent : une étoile chacune — une aide offerte, rien. */
const prixDesAides = (t: FiletEnDeuxTempsTire, e: EtatDuFiletEnDeuxTemps): number => e.aides.filter(a => !a.offerte).length * t.prixDUneAide

// ── Les aides ─────────────────────────────────────────────────────────────

export const AIDE_DEJA_PRISE = 'Cette aide a déjà servi dans cette manche'
export const SANS_INDICE = 'Cette question n’a pas d’indice'
export const CHOISIS_TON_AIDE = 'Choisis l’aide que ta carte t’offre'

/** Les aides que la question propose : sans indice honnête — l'énoncé donne déjà l'époque —, l'autre seule. */
const aidesProposees = (t: FiletEnDeuxTempsTire): CleDAideDuFilet[] => AIDES_DU_FILET.filter(a => a !== 'indice' || t.indice !== null)
const prise = (e: EtatDuFiletEnDeuxTemps, cle: CleDAideDuFilet): AidePrise | undefined => e.aides.find(a => a.cle === cle)

/** Prendre une aide : son refus en mots, ou l'état d'après — payée, ou offerte par Éclairer. */
function prendre(t: FiletEnDeuxTempsTire, e: EtatDuFiletEnDeuxTemps, cle: CleDAideDuFilet, offerte: boolean): EtatDuFiletEnDeuxTemps | string {
  if (prise(e, cle)) return AIDE_DEJA_PRISE
  if (!aidesProposees(t).includes(cle)) return SANS_INDICE
  return { aides: [...e.aides, { cle, offerte }] }
}

// ── La pièce ──────────────────────────────────────────────────────────────

/** Les lettres des aides dans une `composee` : minuscule payée, capitale offerte. */
const LETTRES_DES_AIDES: Readonly<Record<CleDAideDuFilet, string>> = { epoques: 'e', indice: 'i' }

/**
 * « 1962|2 », « 1962|2|Ie » : le curseur, l'époque, puis les aides dans l'ordre où il les a prises — le journal le
 * garde, la révélation le relit, et les siens ne se font qu'une année placée sans aide. Sans lancer, « .|.|e » s'il a
 * pris une aide ; sans rien, null.
 */
function composeeDu(lancer: LancerEnDeuxTemps | null, aides: readonly AidePrise[]): string | null {
  const dites = aides.map(a => (a.offerte ? LETTRES_DES_AIDES[a.cle].toUpperCase() : LETTRES_DES_AIDES[a.cle])).join('')
  if (!lancer && !dites) return null
  const tete = lancer ? `${lancer.x}|${lancer.epoque}` : `${SANS_REPONSE}|${SANS_REPONSE}`
  return dites ? `${tete}|${dites}` : tete
}

/** Le lancer d'une `composee`, écrite par `composeeDu` — jamais tapée par un humain : elle se relit telle que `String` l'a écrite. */
export function lancerDeLaComposee(composee: string | null | undefined): LancerEnDeuxTemps | null {
  const [x, epoque] = (composee ?? '').split('|')
  const n = Number(x)
  const i = Number(epoque)
  return composee && x !== SANS_REPONSE && Number.isFinite(n) && Number.isInteger(i) && i >= 0 && i < TRANCHES_DU_FILET ? { x: n, epoque: i } : null
}

/** Son unité, si elle en a une : une année n'en dit aucune. */
const sonUnite = (t: FiletEnDeuxTempsTire) => (t.unite === undefined ? {} : { unite: t.unite })

/** Le titre d'une révélation, de ce que valait le lancer. */
function titreDuVerdict(t: FiletEnDeuxTempsTire, lancer: LancerEnDeuxTemps | null, avant: number): string {
  if (!lancer) return 'Le temps a filé'
  if (avant === 3) return 'Pile dedans'
  if (avant === 2) return 'Tout près'
  if (avant === 1) return t.annee ? 'La bonne époque' : 'Le bon ordre de grandeur'
  return 'À côté'
}

// ── La règle ──────────────────────────────────────────────────────────────

export const REGLE_DU_FILET_EN_DEUX_TEMPS: RegleDuJeu<FiletEnDeuxTempsTire, EtatDuFiletEnDeuxTemps, GesteDuFiletEnDeuxTemps, FiletEnDeuxTempsMontre, FiletEnDeuxTempsRevele> = {
  cle: 'filet',
  etapes: 1,
  // Soixante secondes depuis le 12 novembre 2026 (`DUREES_DES_JEUX`) : deux décisions et un indice à lire. À 45, une
  // manche sur cinq allait jusqu'à l'échéance en production — les deux où l'indice avait été pris comprises.
  dureeMs: () => DUREES_DES_JEUX.filet * 1000,

  ouvrir: () => ({ aides: [] }),

  lireLeGeste(brut, t) {
    const g = champsDuGeste(brut)
    if (!g) return null
    if (g.quoi === 'aide') return (AIDES_DU_FILET as readonly unknown[]).includes(g.aide) ? { quoi: 'aide', aide: g.aide as CleDAideDuFilet } : null
    if (g.quoi !== 'repondre') return null
    const r = reponseEnvoyee(g, 'filet')
    if (r === undefined) return { quoi: 'repondre', lancer: null }
    if (r === null) return null
    const { epoque, x } = r
    if (!estUnIndex(epoque, t.tranches.length) || typeof x !== 'number' || !Number.isFinite(x)) return null
    // Le curseur vit dans la piste de l'époque choisie : la page ne peut pas en sortir.
    if (x < t.tranches[epoque].de || x > t.tranches[epoque].a) return null
    return { quoi: 'repondre', lancer: { epoque, x } }
  },

  // Une aide ne tranche pas ; seul le lancer — `repondre` — le fait : la règle commune suffit (`trancheLaManche`).
  apresLeGeste: (t, e, g) => (g.quoi === 'aide' ? prendre(t, e, g.aide, false) : GESTE_A_JUGER),

  juger(t, e, reponse) {
    const lancer = typeof reponse === 'object' && reponse.quoi === 'repondre' ? reponse.lancer : null
    const avant = etoilesDuLancer(t, lancer)
    // Les aides ne prennent que ce que le lancer valait : ratée, la manche coûte son cœur comme toujours, et jamais
    // à cause d'elles ; réussie, elle le garde même quand elles ont tout pris.
    const payees = Math.min(avant, prixDesAides(t, e))
    // Juste dès ★★ à la distance, ce que le lancer valait : une aide n'est pas un pouvoir, et le journal dit ce qu'il a su placer.
    const juste = justeDeLaPiece(avant, 'filet') === true
    const verdict: VerdictDUneManche = {
      naturel: naturelDe(avant - payees),
      pieces: [{ juste, choix: lancer ? (juste ? 0 : -1) : null, composee: composeeDu(lancer, e.aides) }],
    }
    return payees > 0 ? { ...verdict, payees } : verdict
  },

  eclairer(t, e, _hasard, cible) {
    // Rien à souffler se dit d'abord, quelle que soit la cible : le pli y lit si Éclairer sert encore (`eclairerSertEncore`).
    if (aidesProposees(t).every(a => prise(e, a))) return rienAEclairer('filet')
    if (cible === undefined || !estUnIndex(cible, AIDES_DU_FILET.length)) return CHOISIS_TON_AIDE
    return prendre(t, e, AIDES_DU_FILET[cible], true)
  },

  montrer(t, e) {
    return {
      jeu: 'filet',
      deuxTemps: true,
      categorie: t.question.categorie,
      texte: t.question.texte,
      annee: t.annee,
      ...sonUnite(t),
      tranches: t.tranches.map(x => ({ ...x })),
      anneaux: { ...t.anneaux },
      reperes: t.reperes.map(r => ({ ...r })),
      aides: aidesProposees(t).map((cle): AideMontree => {
        const a = prise(e, cle)
        return { cle, prise: !a ? null : a.offerte ? 'offerte' : 'payee' }
      }),
      prixDUneAide: t.prixDUneAide,
      retirees: prise(e, 'epoques') ? [...t.retirables] : [],
      indice: prise(e, 'indice') ? t.indice : null,
    }
  },

  reveler(t, e, v) {
    const lancer = lancerDeLaComposee(v.pieces[0]?.composee)
    const avant = etoilesDuLancer(t, lancer)
    const ecart = lancer ? ecartDuLancer(t, lancer.x) : null
    return {
      jeu: 'filet',
      deuxTemps: true,
      titre: titreDuVerdict(t, lancer, avant),
      avantLesAides: avant,
      payees: v.payees ?? 0,
      etoiles: v.naturel,
      valeur: t.valeur,
      reponse: t.question.reponses[t.question.bonne],
      annee: t.annee,
      ...sonUnite(t),
      tranches: t.tranches.map(x => ({ ...x })),
      bonnes: [...t.bonnes],
      anneaux: { ...t.anneaux },
      lancer,
      ecart,
      criteres: {
        epoque: lancer !== null && t.bonnes.includes(lancer.epoque),
        deux: ecart !== null && ecart <= t.anneaux.deux,
        trois: ecart !== null && ecart <= t.anneaux.trois,
      },
      aides: e.aides.map(a => ({ ...a })),
      retirees: prise(e, 'epoques') ? [...t.retirables] : [],
      indice: prise(e, 'indice') ? t.indice : null,
      reperes: t.reperes.map(r => ({ ...r })),
      texte: t.question.texte,
      savais: t.question.anecdote,
    }
  },

  piece: (t, _e, _v, i) => pieceDeLaQuestion(t.question, { jeu: 'filet', manche: i.manche, tirage: i.tirage }, 'filet'),

  cartel: t => ({ sujet: t.question.texte, reponse: t.question.reponses[t.question.bonne], anecdote: t.question.anecdote }),
}
