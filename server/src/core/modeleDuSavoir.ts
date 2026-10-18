// Le modèle du savoir : ce que les réponses de campagne disent de chaque
// joueur et de chaque question, ajustés ensemble (le choix du propriétaire du
// 13 octobre 2026, après « est-ce que l'automate pourrait apprendre du niveau
// des personnes et s'adapter en continu ? »).
//
// La chance qu'un joueur trouve une question : logistique(force + écart −
// difficulté) — sa force, toutes catégories ; son écart dans la catégorie de
// la question, autour de sa force ; la difficulté de la question, en logit.
// C'est le modèle de Rasch, avec une force par catégorie.
//
// Pourquoi ensemble : la part de joueurs qui trouvent une question
// (`tauxLisse`) ne dit pas qui l'a jouée. Une série s'arrête à la troisième
// faute, et seuls les forts atteignent les expertes : elles passent pour
// plus faciles qu'elles ne sont — de 0,5 à 0,7 en logit sur des joueurs
// simulés qui revoient les questions, quand le modèle s'en tient à 0,1. La
// force de qui a répondu corrige la difficulté, et la difficulté de ce qu'il
// a trouvé corrige sa force.
//
// Seule la première réponse de chacun à chaque question compte : revue, une
// question a déjà montré sa correction, et la retrouver ne dit plus ce qu'on
// savait.
//
// Automate le lit (le dé, `core/campagne.ts`), et la page des sentiers, pour
// dire à chacun sa chance de valider le palier qui l'attend
// (`chanceDeLEpreuve`, le 15 octobre 2026). Les marches des séries, des
// sentiers et du quiz tout prêt, elles, gardent `tauxLisse`, sur laquelle
// leurs mélanges et leurs seuils ont été calibrés — le choix du 13 octobre
// 2026, à revoir après mesure. Rien ne s'écrit : tout se dérive du journal
// des réponses, et se refait (`CampagneStore`).

import { CATEGORIES } from '../../../shared/categories'
import { NIVEAUX, QUESTIONS_PAR_MARCHE, QUESTIONS_PAR_SERIE, REPONSES_FICTIVES, TAUX_A_PRIORI, VIES, tauxLisse, type MesureDUneQuestion, type Niveau } from '../../../shared/campagne'
import { SCORE_DE_REFERENCE } from '../../../shared/duels'
import { chanceDeValider, type Melange } from '../../../shared/sentiers'

/**
 * L'écart type des forces, en logit, autour de celle du joueur de la cote de
 * départ : l'a priori de qui n'a presque rien répondu. Une série — une
 * quinzaine de réponses — en dit déjà trois fois plus que lui.
 */
export const ECART_DES_FORCES = 1

/**
 * L'écart type d'une catégorie autour de sa force : ce qui sépare un
 * cinéphile de sa culture générale. Il faut une vingtaine de réponses dans
 * la catégorie pour que l'écart mesuré compte pour moitié : trois questions
 * de sport ratées ne font pas un joueur fâché avec le sport.
 */
export const ECART_DES_CATEGORIES = 0.5

/**
 * Ce qu'une difficulté estimée à l'écriture peut se tromper, en bloc :
 * l'écart type du décalage que l'ajustement apprend pour toutes les questions
 * d'une même difficulté (`ModeleDuSavoir.decalages`). Une question que
 * personne n'a jouée part de l'a priori de sa difficulté (`TAUX_A_PRIORI`),
 * décalé de ce que ses semblables ont montré. Sans lui, les 5 restaient
 * trouvées par un joueur sur dix quand les habitués en trouvaient quatre :
 * sur les premières réponses de la production du 8 au 15 octobre 2026, le
 * modèle ajusté avant le 8 leur annonçait 15 %, et 42 % ont été trouvées —
 * le palier de maître se disait perdu d'avance quand un essai sur trois le
 * validait. Le décalage appris : −1,15 aux 5, −0,29 aux 4, +0,23 aux 2.
 */
export const ECART_DES_ESTIMATIONS = 1

/**
 * La difficulté estimée qui tient l'échelle : son décalage reste nul. Sans
 * point fixe, forces et difficultés glissaient ensemble d'un même pas, et
 * l'ajustement ne finissait plus en soixante passes ; la 3, la plus jouée,
 * le fixe, et il finit en vingt-six.
 */
const DIFFICULTE_QUI_TIENT_L_ECHELLE = 3

/** Une force, un écart ou une difficulté au-delà : la chance vaut 0 ou 1 à un millième près, et rien ne s'y joue plus. */
const BORNE = 8

/** Le plus grand pas de Newton : une réponse isolée, presque certaine, ne lance pas une force à l'infini. */
const PAS_MAX = 1

/** L'ajustement s'arrête quand plus rien ne bouge d'un millième. */
const PRECISION = 1e-3

/** Au plus, ses passes : de quoi partir de rien ; reparti du modèle d'avant, il en faut quelques-unes. */
const PASSES_MAX = 60

/**
 * Ce que l'ajustement calcule d'une traite avant de rendre la main : vingt
 * mille chances, une fraction de milliseconde ici, quelques-unes au dixième
 * de cœur de l'hébergeur — d'un bloc, cent mille réponses tiendraient le
 * serveur une seconde, et aucune soirée ne recevrait rien.
 */
export const CHANCES_PAR_TRANCHE = 20_000

/** Les questions qu'il range d'une traite avant de rendre la main : leur a priori, leur catégorie, leur place. */
const QUESTIONS_PAR_TRANCHE = 2_000

const C = CATEGORIES.length
/** Les difficultés estimées à l'écriture, de 1 à 5. */
const DIFFICULTES = 5
const INDICE_DE_CATEGORIE = new Map<string, number>(CATEGORIES.map((c, i) => [c, i]))

/** La place d'une catégorie dans `CATEGORIES`, ou −1 : une question hors des douze n'a pas d'écart où se ranger. */
export const indiceDeCategorie = (categorie: string): number => INDICE_DE_CATEGORIE.get(categorie) ?? -1

/** La chance de trouver, d'une force nette (force + écart − difficulté). */
export const chance = (x: number): number => 1 / (1 + Math.exp(-x))

const borne = (x: number) => Math.max(-BORNE, Math.min(BORNE, x))
const pasBorne = (x: number) => Math.max(-PAS_MAX, Math.min(PAS_MAX, x))
const logit = (p: number) => Math.log(p / (1 - p))

/**
 * La difficulté d'une question avant toute réponse : celle que son a priori
 * (`TAUX_A_PRIORI`) prête au joueur de force nulle, et ce qu'elle pèse — les
 * vingt réponses fictives de `tauxLisse`, traduites en logit : une part
 * estimée sur n réponses s'y lit à une précision de n·p·(1 − p).
 */
export function difficulteAPriori(difficulte: number): { moyenne: number; precision: number } {
  const p = TAUX_A_PRIORI[difficulte] ?? TAUX_A_PRIORI[3]
  return { moyenne: -logit(p), precision: REPONSES_FICTIVES * p * (1 - p) }
}

/**
 * La difficulté d'une question que le modèle ne connaît pas encore — avant
 * le premier ajustement, ou ajoutée depuis : celle que dit la part lissée de
 * ceux qui l'ont trouvée (`tauxLisse`), partie de sa famille comme au tirage,
 * sur la même échelle.
 */
export function difficulteSansModele(difficulte: number, mesure?: MesureDUneQuestion): number {
  const p = Math.min(0.995, Math.max(0.005, tauxLisse(difficulte, mesure?.justes, mesure?.total, mesure?.depart)))
  return borne(-logit(p))
}

/** Ce que le modèle sait d'un joueur. */
export interface ForceDUnJoueur {
  /** Sa force, toutes catégories. */
  force: number
  /** Son écart dans chaque catégorie, dans l'ordre de `CATEGORIES` : zéro là où il n'a rien répondu. */
  ecarts: readonly number[]
  /** Les réponses qui l'ont mesurée : aucune, et c'est le joueur de la cote de départ. */
  reponses: number
}

export interface ModeleDuSavoir {
  /** La difficulté de chaque question de la base, en logit : la force qu'il faut pour la trouver une fois sur deux. */
  difficultes: ReadonlyMap<string, number>
  /** Ce qu'il a mesuré de chaque joueur : l'ajustement suivant en repart. */
  forces: ReadonlyMap<string, ForceDUnJoueur>
  /**
   * Ce que vaut vraiment chaque difficulté estimée, de 1 à 5, en logit autour
   * de son a priori (`ECART_DES_ESTIMATIONS`) : nul pour la 3, qui tient
   * l'échelle.
   */
  decalages: readonly number[]
  /** Les réponses qui l'ont ajusté. */
  reponses: number
  passes: number
}

export interface EntreeDuModele {
  /** Chaque question qu'il mesure : sa catégorie, et sa difficulté estimée à l'écriture (de 1 à 5). */
  questions: ReadonlyMap<string, { categorie: string; difficulte: number }>
  /** La première réponse de chaque joueur à chaque question qu'il a vue : juste ou non. */
  joueurs: ReadonlyMap<string, ReadonlyMap<string, boolean>>
  /** La force de qui n'a encore rien répondu : celle du joueur de la cote de départ (`SerieDeReference.forceDeDepart`). */
  forceDeDepart: number
  /** Le modèle d'avant : l'ajustement repart de ce qu'il savait, et converge en quelques passes. */
  depart?: ModeleDuSavoir | null
}

/**
 * Tout ce qu'un ajustement tient en mémoire, en tableaux : onze mille
 * questions et cent mille réponses en objets, c'était autant de cases à
 * suivre pour le ramasse-miettes à chaque passe.
 */
interface Etat {
  /** Par question. */
  difficultes: Float64Array
  categories: Int8Array
  /** Par joueur, et par joueur et catégorie. */
  forces: Float64Array
  ecarts: Float64Array
  /** Les réponses du joueur p, de `debut[p]` à `debut[p + 1]` : leur question, juste (1) ou non (0). */
  debut: Int32Array
  quelles: Int32Array
  justes: Uint8Array
  forceDeDepart: number
}

/** De quoi calculer les pas d'une catégorie : un seul pas de joueur à la fois s'en sert, sans rendre la main au milieu. */
const penteParCategorie = new Float64Array(C)
const courbureParCategorie = new Float64Array(C)

/**
 * Un pas de Newton sur la force du joueur `p`, puis sur ses écarts — les
 * difficultés tenues —, chacun tiré vers son a priori. Rend le plus grand
 * pas fait.
 */
function pasDuJoueur(e: Etat, p: number): number {
  const de = e.debut[p]
  const a = e.debut[p + 1]
  const o = p * C
  let pente = (e.forceDeDepart - e.forces[p]) / ECART_DES_FORCES ** 2
  let courbure = 1 / ECART_DES_FORCES ** 2
  for (let i = de; i < a; i++) {
    const q = e.quelles[i]
    const s = chance(e.forces[p] + e.ecarts[o + e.categories[q]] - e.difficultes[q])
    pente += e.justes[i] - s
    courbure += s * (1 - s)
  }
  const pasDeForce = pasBorne(pente / courbure)
  e.forces[p] = borne(e.forces[p] + pasDeForce)
  let plusGrand = Math.abs(pasDeForce)
  for (let c = 0; c < C; c++) {
    penteParCategorie[c] = -e.ecarts[o + c] / ECART_DES_CATEGORIES ** 2
    courbureParCategorie[c] = 1 / ECART_DES_CATEGORIES ** 2
  }
  for (let i = de; i < a; i++) {
    const q = e.quelles[i]
    const c = e.categories[q]
    const s = chance(e.forces[p] + e.ecarts[o + c] - e.difficultes[q])
    penteParCategorie[c] += e.justes[i] - s
    courbureParCategorie[c] += s * (1 - s)
  }
  for (let c = 0; c < C; c++) {
    const pas = pasBorne(penteParCategorie[c] / courbureParCategorie[c])
    e.ecarts[o + c] = borne(e.ecarts[o + c] + pas)
    plusGrand = Math.max(plusGrand, Math.abs(pas))
  }
  return plusGrand
}

/**
 * L'ajustement de tout le modèle — chaque `yield` est un endroit où rendre
 * la main (`ajusterSansBloquer`). Par passes : chaque joueur, les
 * difficultés tenues ; puis chaque question, les forces tenues — un pas de
 * Newton chacun, jusqu'à ce que plus rien ne bouge. L'a priori de chacun
 * tient ceux qui ont peu répondu, et ce que personne n'a vu : un joueur qui a
 * tout trouvé a une force finie, une question que personne n'a jouée garde
 * son estimation d'écriture.
 */
export function* ajustement(entree: EntreeDuModele): Generator<void, ModeleDuSavoir> {
  const Q = entree.questions.size
  const ids: string[] = []
  const indice = new Map<string, number>()
  const moyennes = new Float64Array(Q)
  const precisions = new Float64Array(Q)
  const e: Etat = {
    difficultes: new Float64Array(Q),
    categories: new Int8Array(Q),
    forces: new Float64Array(entree.joueurs.size),
    ecarts: new Float64Array(entree.joueurs.size * C),
    debut: new Int32Array(entree.joueurs.size + 1),
    quelles: new Int32Array(0),
    justes: new Uint8Array(0),
    forceDeDepart: entree.forceDeDepart,
  }
  // La difficulté estimée de chaque question, de 0 à 4 (−1 hors de 1 à 5), et
  // ce que chacune vaut vraiment : reparti de l'ajustement d'avant.
  const niveaux = new Int8Array(Q)
  const decalages = Float64Array.from({ length: DIFFICULTES }, (_, l) => entree.depart?.decalages[l] ?? 0)
  // Onze mille questions à ranger : une douzaine de millisecondes d'un bloc.
  for (const [id, { categorie, difficulte }] of entree.questions) {
    const q = ids.length
    ids.push(id)
    indice.set(id, q)
    const a = difficulteAPriori(difficulte)
    moyennes[q] = a.moyenne
    precisions[q] = a.precision
    e.categories[q] = indiceDeCategorie(categorie)
    niveaux[q] = Number.isInteger(difficulte) && difficulte >= 1 && difficulte <= DIFFICULTES ? difficulte - 1 : -1
    e.difficultes[q] = entree.depart?.difficultes.get(id) ?? a.moyenne + (niveaux[q] >= 0 ? decalages[niveaux[q]] : 0)
    if ((q + 1) % QUESTIONS_PAR_TRANCHE === 0) yield
  }
  // Les réponses, joueur par joueur. Une question que la base n'a plus, ou
  // hors des douze catégories, n'a ni difficulté ni écart où se ranger. Les
  // ranger tient aussi le serveur : deux cent mille réponses, cent
  // millisecondes d'un bloc.
  const joueurs = [...entree.joueurs.keys()]
  let N = 0
  for (const reponses of entree.joueurs.values()) N += reponses.size
  e.quelles = new Int32Array(N)
  e.justes = new Uint8Array(N)
  let k = 0
  let rangees = 0
  for (let p = 0; p < joueurs.length; p++) {
    e.debut[p] = k
    const reponses = entree.joueurs.get(joueurs[p])!
    for (const [id, juste] of reponses) {
      const q = indice.get(id)
      if (q === undefined || e.categories[q] < 0) continue
      e.quelles[k] = q
      e.justes[k] = juste ? 1 : 0
      k++
    }
    const avant = entree.depart?.forces.get(joueurs[p])
    e.forces[p] = avant?.force ?? entree.forceDeDepart
    if (avant) for (let c = 0; c < C; c++) e.ecarts[p * C + c] = avant.ecarts[c] ?? 0
    rangees += reponses.size
    if (rangees >= CHANCES_PAR_TRANCHE) {
      rangees = 0
      yield
    }
  }
  e.debut[joueurs.length] = k
  e.quelles = e.quelles.subarray(0, k)
  e.justes = e.justes.subarray(0, k)
  N = k
  yield

  const pentes = new Float64Array(Q)
  const courbures = new Float64Array(Q)
  const pentesDesNiveaux = new Float64Array(DIFFICULTES)
  const courburesDesNiveaux = new Float64Array(DIFFICULTES)
  const pasDesNiveaux = new Float64Array(DIFFICULTES)
  let passes = 0
  let calculees = 0
  while (passes < PASSES_MAX) {
    let plusGrand = 0
    for (let p = 0; p < joueurs.length; p++) {
      plusGrand = Math.max(plusGrand, pasDuJoueur(e, p))
      calculees += 2 * (e.debut[p + 1] - e.debut[p])
      if (calculees >= CHANCES_PAR_TRANCHE) {
        calculees = 0
        yield
      }
    }
    // Ce que disent les réponses seules : l'a priori de chacune vient après le pas de sa difficulté estimée.
    pentes.fill(0)
    courbures.fill(0)
    for (let p = 0; p < joueurs.length; p++) {
      const o = p * C
      for (let i = e.debut[p]; i < e.debut[p + 1]; i++) {
        const q = e.quelles[i]
        const s = chance(e.forces[p] + e.ecarts[o + e.categories[q]] - e.difficultes[q])
        // Une bonne réponse la dit plus facile : sa difficulté descend.
        pentes[q] += s - e.justes[i]
        courbures[q] += s * (1 - s)
      }
      calculees += e.debut[p + 1] - e.debut[p]
      if (calculees >= CHANCES_PAR_TRANCHE) {
        calculees = 0
        yield
      }
    }
    // Chaque difficulté estimée, d'un pas de bloc : toutes ses questions et
    // son décalage ensemble, tirés vers zéro (`ECART_DES_ESTIMATIONS`). Les
    // jamais jouées suivent leurs semblables ; l'a priori de chaque question
    // ne bouge pas avec, il n'y pèse rien.
    pentesDesNiveaux.fill(0)
    courburesDesNiveaux.fill(0)
    for (let q = 0; q < Q; q++) {
      const l = niveaux[q]
      if (l < 0) continue
      pentesDesNiveaux[l] += pentes[q]
      courburesDesNiveaux[l] += courbures[q]
    }
    for (let l = 0; l < DIFFICULTES; l++) {
      pasDesNiveaux[l] = l === DIFFICULTE_QUI_TIENT_L_ECHELLE - 1 ? 0 : pasBorne((pentesDesNiveaux[l] - decalages[l] / ECART_DES_ESTIMATIONS ** 2) / (courburesDesNiveaux[l] + 1 / ECART_DES_ESTIMATIONS ** 2))
      decalages[l] += pasDesNiveaux[l]
      plusGrand = Math.max(plusGrand, Math.abs(pasDesNiveaux[l]))
    }
    for (let q = 0; q < Q; q++) {
      const l = niveaux[q]
      const bloc = l >= 0 ? pasDesNiveaux[l] : 0
      if (bloc !== 0) {
        e.difficultes[q] = borne(e.difficultes[q] + bloc)
        // Ses réponses voient le pas de bloc au premier ordre : déplacée d'autant, sa pente baisse d'autant de courbure.
        pentes[q] -= courbures[q] * bloc
      }
      const moyenne = moyennes[q] + (l >= 0 ? decalages[l] : 0)
      const pas = pasBorne((pentes[q] + precisions[q] * (moyenne - e.difficultes[q])) / (courbures[q] + precisions[q]))
      e.difficultes[q] = borne(e.difficultes[q] + pas)
      plusGrand = Math.max(plusGrand, Math.abs(pas))
    }
    passes++
    if (plusGrand < PRECISION) break
  }

  const difficultes = new Map<string, number>()
  for (let q = 0; q < Q; q++) difficultes.set(ids[q], e.difficultes[q])
  const forces = new Map<string, ForceDUnJoueur>()
  joueurs.forEach((joueur, p) => {
    forces.set(joueur, { force: e.forces[p], ecarts: Array.from(e.ecarts.subarray(p * C, (p + 1) * C)), reponses: e.debut[p + 1] - e.debut[p] })
  })
  return { difficultes, forces, decalages: Array.from(decalages), reponses: N, passes }
}

/** L'ajustement d'une traite : pour les scripts et les épreuves. */
export function ajusterLeModele(entree: EntreeDuModele): ModeleDuSavoir {
  const calcul = ajustement(entree)
  for (;;) {
    const pas = calcul.next()
    if (pas.done) return pas.value
  }
}

/**
 * Le même, qui rend la main entre deux tranches : le serveur le refait en
 * fond, pendant que des soirées se jouent. `arrete` l'interrompt — le
 * serveur qui s'éteint ne finit pas un calcul que personne ne lira.
 */
export async function ajusterSansBloquer(entree: EntreeDuModele, arrete: () => boolean = () => false): Promise<ModeleDuSavoir | null> {
  const calcul = ajustement(entree)
  for (;;) {
    const pas = calcul.next()
    if (pas.done) return pas.value
    await new Promise<void>(rendre => setImmediate(rendre))
    if (arrete()) return null
  }
}

/** Au plus, les pas d'un seul joueur : il converge en une dizaine. */
const PAS_D_UN_JOUEUR = 50

/**
 * Sa force, ses difficultés tenues : celles du modèle, ou de la part qui les
 * a trouvées pour une question qu'il ne connaît pas (`difficulte`). Relue au
 * dé, de toutes ses premières réponses — la série qu'il vient de finir
 * comprise : le modèle, refait en fond, ne l'a peut-être pas encore vue.
 * Sans réponse — ou sur des questions que la base n'a plus —, c'est le
 * joueur de la cote de départ.
 */
export function forceDuJoueur(
  premieres: ReadonlyMap<string, boolean>,
  question: (id: string) => { difficulte: number; categorie: string } | undefined,
  forceDeDepart: number,
  /** D'où partir : une force déjà proche — celle du modèle — converge en deux ou trois pas au lieu d'une dizaine. Le résultat n'en dépend pas. */
  depart?: Pick<ForceDUnJoueur, 'force' | 'ecarts'>,
): ForceDUnJoueur {
  const difficultes: number[] = []
  const categories: number[] = []
  const justes: number[] = []
  for (const [id, juste] of premieres) {
    const q = question(id)
    const c = q ? indiceDeCategorie(q.categorie) : -1
    if (!q || c < 0) continue
    difficultes.push(q.difficulte)
    categories.push(c)
    justes.push(juste ? 1 : 0)
  }
  const n = justes.length
  // Sans une réponse, le joueur de la cote de départ, d'où qu'on parte.
  const d = n > 0 ? depart : undefined
  const e: Etat = {
    difficultes: Float64Array.from(difficultes),
    categories: Int8Array.from(categories),
    forces: Float64Array.of(d?.force ?? forceDeDepart),
    ecarts: Float64Array.from({ length: C }, (_, c) => d?.ecarts[c] ?? 0),
    debut: Int32Array.of(0, n),
    // Chaque réponse a sa propre question : ses difficultés, dans l'ordre.
    quelles: Int32Array.from({ length: n }, (_, i) => i),
    justes: Uint8Array.from(justes),
    forceDeDepart,
  }
  for (let i = 0; i < PAS_D_UN_JOUEUR && n > 0; i++) if (pasDuJoueur(e, 0) < PRECISION) break
  return { force: e.forces[0], ecarts: Array.from(e.ecarts), reponses: n }
}

// ── La série qu'on lui tire, en moyenne ─────────────────────────────────────

/**
 * Le score qu'on attend, en moyenne, de ces chances place par place : les
 * bonnes réponses données avant la dernière faute (`VIES`). On suit,
 * question après question, la probabilité d'y arriver avec zéro, une ou deux
 * fautes. La force d'un essai se cherche à coups de dizaines de ces calculs :
 * aucun tableau neuf par question.
 */
export function scoreAttendu(chances: readonly number[]): number {
  const enJeu = new Float64Array(VIES)
  enJeu[0] = 1
  let attendu = 0
  for (const c of chances) {
    let vivant = 0
    for (let f = 0; f < VIES; f++) vivant += enJeu[f]
    attendu += vivant * c
    // De la dernière faute à la première : chacune garde ceux qui trouvent, et reçoit ceux d'avant qui se trompent.
    for (let f = VIES - 1; f > 0; f--) enJeu[f] = enJeu[f] * c + enJeu[f - 1] * (1 - c)
    enJeu[0] *= c
  }
  return attendu
}

/**
 * Ce qu'une série tirée pour lui pose, en moyenne : la marche de chaque
 * place, dans l'ordre de `tirerUneSerie` — cinq de chaque, de la facile à
 * l'experte, puis le reste en repartant de l'experte —, et, dans chaque
 * marche, ce qu'en tient chaque catégorie, à parts égales : le tirage les
 * fait passer à tour de rôle (`TourDeRole`).
 */
export interface SerieDeReference {
  places: readonly Niveau[]
  /** Par marche : chaque catégorie qui en a, et quelques difficultés qui la résument (ses quantiles). */
  marches: Readonly<Record<Niveau, readonly { categorie: number; difficultes: Float64Array }[]>>
  /** La force du joueur de la cote de départ : celle qui finit cette série, en moyenne, sur `SCORE_DE_REFERENCE` bonnes réponses. */
  forceDeDepart: number
}

/**
 * Les difficultés qui résument une catégorie d'une marche : ses quantiles.
 * La moyenne des chances sur huit vaut presque celle sur toutes — un millier
 * de questions par marche, recomptées à chaque essai d'une force.
 */
const QUANTILES = 8

/** Les écarts de qui n'en a aucun : le joueur de la cote de départ, ou un joueur qu'on prend sans ses catégories. */
export const AUCUN_ECART: readonly number[] = new Array<number>(C).fill(0)

/**
 * La série de référence : les jouables, leur marche (`marcheDe`, celle du
 * tirage), et leur difficulté au modèle (`difficulteDe`) — chacune reçoit
 * aussi la place de la question dans `jouables` : la préparation du tirage
 * sait déjà la marche de chacune (`CampagneStore.referencePour`).
 */
export function serieDeReference<T extends { meta: { categorie: string } }>(
  jouables: readonly T[],
  marcheDe: (q: T, i: number) => Niveau,
  difficulteDe: (q: T, i: number) => number,
): SerieDeReference {
  // Chaque groupe — une marche, une catégorie — dans un tableau de nombres,
  // trié d'un coup : des listes triées par une fonction de comparaison
  // prenaient la moitié des 10 à 13 ms que la série de référence coûtait à
  // chaque mesure neuve, toutes les dix minutes d'activité (le banc du
  // 17 octobre 2026). Les catégories d'une marche gardent l'ordre où elles
  // paraissent : les chances de la série s'y somment dans cet ordre.
  const nombre = jouables.length
  const marcheDeChaque = new Uint8Array(nombre)
  const categorieDeChaque = new Int8Array(nombre)
  const difficulteDeChaque = new Float64Array(nombre)
  const compte: Record<Niveau, number> = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
  const tailles = new Int32Array(NIVEAUX.length * C)
  const categoriesDeLaMarche: number[][] = NIVEAUX.map(() => [])
  for (let i = 0; i < nombre; i++) {
    const q = jouables[i]
    const niveau = marcheDe(q, i)
    compte[niveau]++
    const c = indiceDeCategorie(q.meta.categorie)
    categorieDeChaque[i] = c
    if (c < 0) continue
    const m = NIVEAUX.indexOf(niveau)
    marcheDeChaque[i] = m
    difficulteDeChaque[i] = difficulteDe(q, i)
    if (tailles[m * C + c]++ === 0) categoriesDeLaMarche[m].push(c)
  }
  const groupes: Float64Array[] = []
  const remplis = new Int32Array(NIVEAUX.length * C)
  for (let i = 0; i < nombre; i++) {
    const c = categorieDeChaque[i]
    if (c < 0) continue
    const g = marcheDeChaque[i] * C + c
    ;(groupes[g] ??= new Float64Array(tailles[g]))[remplis[g]++] = difficulteDeChaque[i]
  }
  const marches = {} as Record<Niveau, { categorie: number; difficultes: Float64Array }[]>
  NIVEAUX.forEach((niveau, m) => {
    marches[niveau] = categoriesDeLaMarche[m].map(categorie => {
      const liste = groupes[m * C + categorie].sort()
      const k = Math.min(QUANTILES, liste.length)
      return { categorie, difficultes: Float64Array.from({ length: k }, (_, i) => liste[Math.floor(((i + 0.5) / k) * liste.length)]) }
    })
  })
  // Les places, comme `tirerUneSerie` les remplit : une marche trop courte
  // donne ce qu'elle a, et le reste repart de l'experte.
  const places: Niveau[] = []
  const pris: Record<Niveau, number> = { facile: 0, moyen: 0, difficile: 0, expert: 0 }
  const prendre = (n: Niveau, combien: number) => {
    const k = Math.max(0, Math.min(combien, compte[n] - pris[n], QUESTIONS_PAR_SERIE - places.length))
    for (let i = 0; i < k; i++) places.push(n)
    pris[n] += k
  }
  for (const n of NIVEAUX) prendre(n, QUESTIONS_PAR_MARCHE)
  for (const n of [...NIVEAUX].reverse()) prendre(n, Infinity)
  const reference: SerieDeReference = { places, marches, forceDeDepart: 0 }
  return { ...reference, forceDeDepart: forcePourLeNiveau(SCORE_DE_REFERENCE, AUCUN_ECART, reference) }
}

/** Ses chances à chaque place de la série de référence, à cette force et ces écarts. */
export function chancesDeReference(force: number, ecarts: readonly number[], reference: SerieDeReference): number[] {
  const parMarche = {} as Record<Niveau, number>
  for (const n of NIVEAUX) {
    const groupes = reference.marches[n]
    let somme = 0
    for (const g of groupes) {
      const net = force + (ecarts[g.categorie] ?? 0)
      let s = 0
      for (const d of g.difficultes) s += chance(net - d)
      somme += s / g.difficultes.length
    }
    parMarche[n] = groupes.length > 0 ? somme / groupes.length : 0
  }
  return reference.places.map(n => parMarche[n])
}

/** Le score qu'il ferait en moyenne sur une série tirée pour lui : son niveau, en bonnes réponses. */
export const scoreDeReference = (force: number, ecarts: readonly number[], reference: SerieDeReference): number =>
  scoreAttendu(chancesDeReference(force, ecarts, reference))

/**
 * La force qui fait ce niveau, en moyenne, sur la série de référence, avec
 * ces écarts : cherchée par dichotomie — le score monte avec la force.
 */
export function forcePourLeNiveau(niveau: number, ecarts: readonly number[], reference: SerieDeReference): number {
  let [bas, haut] = [-12, 12]
  for (let i = 0; i < 40; i++) {
    const milieu = (bas + haut) / 2
    if (scoreDeReference(milieu, ecarts, reference) < niveau) bas = milieu
    else haut = milieu
  }
  return (bas + haut) / 2
}

/** Ses chances sur les questions d'une série, à cette force et ces écarts : chacune sa difficulté et sa catégorie. */
export function chancesSurLaSerie(questions: readonly { difficulte: number; categorie: string }[], force: number, ecarts: readonly number[]): number[] {
  return questions.map(q => chance(force + (ecarts[indiceDeCategorie(q.categorie)] ?? 0) - q.difficulte))
}

// ── Sa chance de valider un palier ──────────────────────────────────────────

/**
 * L'écart type de sa force nette d'une épreuve à l'autre, en logit : sa
 * forme du jour, et le chapitre que l'épreuve tire — on peut savoir le
 * football et pas le cyclisme, et sa force dans le sport n'en dit que la
 * moyenne. Sans elle, la chance d'une épreuve était trop sûre d'elle aux
 * deux bouts : sur les épreuves de la production du 8 au 15 octobre 2026,
 * celles annoncées sous 20 % se validaient une fois sur trois, celles
 * au-dessus de 70 % quatre fois sur cinq. Avec elle, chaque tranche tient à
 * quelques points près, et la perte (log) des 215 épreuves passe de 0,71 à
 * 0,56 ; de 0,6 à 1, elle ne bouge presque plus.
 */
export const FORME_D_UNE_EPREUVE = 0.7

/** Sept nœuds de Gauss–Hermite, et leurs poids : la forme du jour, intégrée. */
const NOEUDS_DE_LA_FORME = [-2.651961356835233, -1.673551628767471, -0.816287882858965, 0, 0.816287882858965, 1.673551628767471, 2.651961356835233]
const POIDS_DE_LA_FORME = [0.000971781245099519, 0.054515582819127, 0.425607252610128, 0.810264617556807, 0.425607252610128, 0.054515582819127, 0.000971781245099519]

/**
 * Sa chance moyenne sur une marche d'une catégorie : sur les difficultés qui
 * la résument (`SerieDeReference.marches`). Une marche que la catégorie n'a
 * pas se lit sur celles des autres — et une catégorie hors des douze (−1),
 * sur toutes : la chance qu'une escale de l'expédition annonce sur un gardien
 * de toutes les catégories (`CampagneStore.chancesDeLExpedition`).
 */
export function chanceSurLaMarche(reference: SerieDeReference, niveau: Niveau, categorie: number, net: number): number {
  const groupes = reference.marches[niveau]
  const sien = groupes.find(g => g.categorie === categorie)
  const lus = sien ? [sien] : groupes
  if (lus.length === 0) return 0
  let somme = 0
  for (const g of lus) {
    let s = 0
    for (const d of g.difficultes) s += chance(net - d)
    somme += s / g.difficultes.length
  }
  return somme / lus.length
}

/**
 * Sa chance de valider du premier coup une épreuve de ce mélange et de ce
 * seuil, dans une catégorie (son indice dans `CATEGORIES`), à sa force nette
 * — sa force et son écart dans la catégorie : à chaque marche, sa chance sur
 * les difficultés qui la résument, puis la loi de la somme
 * (`chanceDeValider`), sa forme du jour intégrée (`FORME_D_UNE_EPREUVE`).
 * La page des sentiers la dit à chacun (`CampagneStore.chancesPourLui`).
 */
export function chanceDeLEpreuve(reference: SerieDeReference, categorie: number, net: number, melange: Melange, seuil: number): number {
  let somme = 0
  for (let k = 0; k < NOEUDS_DE_LA_FORME.length; k++) {
    const forme = net + FORME_D_UNE_EPREUVE * Math.SQRT2 * NOEUDS_DE_LA_FORME[k]
    const taux = {} as Record<Niveau, number>
    for (const n of NIVEAUX) taux[n] = chanceSurLaMarche(reference, n, categorie, forme)
    somme += POIDS_DE_LA_FORME[k] * chanceDeValider(melange, seuil, taux)
  }
  return Math.min(1, Math.max(0, somme / Math.sqrt(Math.PI)))
}
