// Les tas où le Cabinet tire ce qu'il pose de la base : ce que chaque jeu sait
// poser, gardé par identité de la liste des jouables (`WeakMap`) — une base qui
// change, une question retirée refont la liste, et ses tas avec elle. Préparés
// une fois par liste (`preparerLesTas`), en fond derrière la page du Cabinet ou
// sous le départ qui trouve une liste neuve — il les attend, et le serveur lit
// les autres requêtes entre deux étapes. Le tireur, lui, prend des tas prêts :
// ce qui lui manquerait encore (une préparation ratée), il le fait d'un bloc,
// deux mille questions par catégorie qu'il lit.
//
// Le Pari et l'Éclair puisent dans le même tas : des QCM de quatre réponses qui
// se lisent en 360 pixels, chrono en marche, et ne se trahissent pas d'eux-mêmes.
// Le Mot mystère, dans les questions dont la bonne réponse est un mot à taper ;
// le Filet, dans celles dont elle est une année ou un nombre à viser. Ce que
// les trois cribles disent d'une question ne dépend que d'elle : leur verdict
// se garde par question (`verdictDe`), et une liste neuve — faite des mêmes
// questions, le matin, à un retrait — ne coûte qu'un filtre.
// Le Détail lit la question qui demande le peintre de chacun de ses tableaux,
// pour son anecdote ; la Frise, les sujets de la base qui font une frise.
import type { QuestionDeLaBase } from '../../baseCampagne'
import { detailsDeLaBase, tableauxDuDetail } from '../../details'
import { cibleDeLEstimation, supposeDesChoix } from '../../estimation'
import type { PorteDeLaCampagne } from '../../porteDeLaCampagne'
import { QUESTIONS_PAR_TRANCHE, rendreLaMain } from '../../tourniquet'
import { contenuDuCabinet, ecritDansLesMots } from '../contenu'
import type { CeQueLesTireursLisent } from './communs'
import { ECART_DES_ANNEES_DE_LA_FRISE, EVENEMENTS_D_UNE_FRISE_A_THEME, INTITULE_MAX_DU_QCM, MARCHES_DE_L_ECLAIR, REPONSE_MAX_DU_QCM } from '../../../../../shared/cabinet/bareme'
import { motsDe } from '../../../../../shared/cabinet/jeux/indices'
import { motDeLaQuestion } from '../../../../../shared/cabinet/jeux/mot'
import { formeDeReponse, niveauDeQuestion, type MesureDUneQuestion } from '../../../../../shared/campagne'
import { CATEGORIES, type Categorie } from '../../../../../shared/categories'
import { choisirLaFriseSansRepli, type EvenementDeLaFrise } from '../../../../../shared/frise'
import { estRemplace, sujetParCle, sujetsDe } from '../../../../../shared/sujets'

/** Les signes d'un texte, un emoji compté pour un : ce qu'on lit, pas ce que JavaScript compte. */
const signes = (texte: string) => [...texte].length

/**
 * Un QCM du Cabinet : quatre réponses — ni un vrai ou faux de la base, que
 * l'Éclair rendrait « Vrai ? », ni un six choix —, un intitulé et des réponses
 * courts, et aucune réponse dite dans l'intitulé, en mots entiers et sans
 * accents (`ecritDansLesMots`, la règle du juge du contenu) : « Quel fleuve
 * traverse Lyon, le Rhône… » se trouverait sans rien savoir, et l'affirmation
 * de l'Éclair se lirait vraie d'office. L'intitulé se découpe une fois pour
 * ses quatre réponses : à chacune, c'était la moitié du crible sur toute la
 * base.
 */
export function estUnQcmDuCabinet(q: Pick<QuestionDeLaBase, 'texte' | 'reponses'>): boolean {
  if (q.reponses.length !== 4 || signes(q.texte) > INTITULE_MAX_DU_QCM) return false
  if (!q.reponses.every(r => signes(r) <= REPONSE_MAX_DU_QCM)) return false
  const mots = motsDe(q.texte)
  return q.reponses.every(r => !ecritDansLesMots(mots, r))
}

/** Ce que le Filet vise d'une question de la base : sa valeur, une année ou un nombre, et l'unité qu'il dit. */
export interface ValeurDuFilet {
  valeur: number
  annee: boolean
  /** L'unité d'une estimation qui tient à l'écran (« km ») ; une année n'en a pas. */
  unite?: string
}

/** Ce que vaut chaque chiffre romain. */
const CHIFFRES_ROMAINS = new Map([...'IVXLCDM'].map((c, i) => [c, [1, 5, 10, 50, 100, 500, 1000][i]]))

/** « MDCCLXXXIX » : 1789 — un chiffre plus petit devant un plus grand se retranche. */
function enChiffresArabes(romain: string): number {
  let total = 0
  for (let i = 0; i < romain.length; i++) {
    const ici = CHIFFRES_ROMAINS.get(romain[i])!
    total += ici < (CHIFFRES_ROMAINS.get(romain[i + 1]) ?? 0) ? -ici : ici
  }
  return total
}

/**
 * Les nombres qu'un intitulé écrit, « 1 450 » compris, et ceux qu'il écrit en
 * chiffres romains : une valeur qu'il dit se lirait sans rien savoir — « Le
 * traité de 1919 fut signé en quelle année ? », « Quel nombre s'écrit MCM en
 * chiffres romains ? ». Un mot en capitales romaines qui n'en est pas un
 * (« XL » d'un calibre, « CD ») n'écarte que la question dont il dirait la
 * valeur.
 */
function nombresEcrits(texte: string): number[] {
  const colles = texte.replace(/(\d)[   ](?=\d{3}(?!\d))/g, '$1')
  const arabes = [...colles.matchAll(/\d+(?:[.,]\d+)?/g)].map(m => Number(m[0].replace(',', '.')))
  const romains = [...texte.matchAll(/(?<![\p{L}\p{N}])[IVXLCDM]+(?![\p{L}\p{N}])/gu)].map(m => enChiffresArabes(m[0]))
  return [...arabes, ...romains]
}

/**
 * L'intitulé demande-t-il une année ? Une réponse de 1000 à 2099 sans unité a
 * la forme d'une année (`formeDeReponse`), sans en être toujours une : « Quel
 * est le plus petit entier qui s'écrit de deux façons comme somme de deux
 * cubes ? » (1729), « 12 en binaire » (1100) se posaient sur une piste
 * d'années, an par an.
 */
const DEMANDE_UNE_ANNEE = /\bann[ée]e\b/i

/**
 * Ce qu'une question de la base pose au Filet, ou null : une année entière —
 * sa bonne réponse ne dit qu'elle (`formeDeReponse`), et l'intitulé la demande
 * — ou une estimation que le quiz tout prêt jouerait au plus près
 * (`cibleDeLEstimation` : ni un numéro, ni un petit entier facile) ; un
 * intitulé qui se lit sans ses choix (`supposeDesChoix`, qu'une estimation
 * juge déjà), et qui ne dit pas la valeur, ni en chiffres arabes ni en
 * romains. Le recul d'une année et le plancher d'une estimation, la règle du
 * jeu les juge au tirage, à l'année du départ (`seTendAuFilet`) : le tas ne
 * dépend pas du jour où il se prépare.
 */
export function valeurDuFilet(q: QuestionDeLaBase): ValeurDuFilet | null {
  if (q.reponses.length !== 4) return null
  const annee = formeDeReponse({ reponses: q.reponses, bonne: q.bonne, valeur: q.meta.valeur }) === 'annee'
  // Une forme d'année que l'intitulé ne demande pas n'est ni une année sûre, ni une estimation : elle ne se pose pas.
  if (annee && (!DEMANDE_UNE_ANNEE.test(q.texte) || supposeDesChoix(q.texte))) return null
  const cible = annee ? null : cibleDeLEstimation(q)
  const valeur = annee ? Number(q.reponses[q.bonne].trim()) : cible?.target
  if (valeur === undefined || nombresEcrits(q.texte).includes(valeur)) return null
  return { valeur, annee, ...(cible?.unit && { unite: cible.unit }) }
}

/** Ce que les jeux de la base savent poser d'une catégorie : ses QCM (le Pari, l'Éclair), ses mots (le Mot mystère), ses valeurs (le Filet). */
interface TasDeLaCategorie {
  qcm: readonly QuestionDeLaBase[]
  mots: readonly QuestionDeLaBase[]
  valeurs: readonly QuestionDeLaBase[]
}

/** Ce que les trois cribles disent d'une question : se pose-t-elle au Pari et à l'Éclair, au Mot mystère, au Filet ? */
interface VerdictDesCribles {
  qcm: boolean
  mot: boolean
  valeur: boolean
}

/**
 * Le verdict de chaque question, gardé par la question même : il ne dépend
 * que d'elle, jamais de la liste où elle est. Une liste de jouables neuve —
 * la réserve du jour chaque matin, un retrait, une base relue — filtre les
 * mêmes objets (`CampagneStore.jouables`) : seule une question corrigée en est
 * un neuf (`appliquerLesCorrections`), qui se juge à son tour. Sans lui, chaque
 * liste neuve repassait la base entière aux cribles — 53 à 153 ms par
 * catégorie, contre 0,3 à 1,1 pour la filtrer (la contre-expertise de
 * sobriété du 25 octobre 2026).
 */
const VERDICTS = new WeakMap<QuestionDeLaBase, VerdictDesCribles>()

function verdictDe(q: QuestionDeLaBase): VerdictDesCribles {
  let v = VERDICTS.get(q)
  if (!v) VERDICTS.set(q, (v = { qcm: estUnQcmDuCabinet(q), mot: motDeLaQuestion(q) !== null, valeur: valeurDuFilet(q) !== null }))
  return v
}

/** Les trois tas de ces questions, d'une seule lecture, chacune par son verdict. */
function tasDes(siennes: readonly QuestionDeLaBase[]): TasDeLaCategorie {
  const qcm: QuestionDeLaBase[] = []
  const mots: QuestionDeLaBase[] = []
  const valeurs: QuestionDeLaBase[] = []
  for (const q of siennes) {
    const v = verdictDe(q)
    if (v.qcm) qcm.push(q)
    if (v.mot) mots.push(q)
    if (v.valeur) valeurs.push(q)
  }
  return { qcm, mots, valeurs }
}

/** Les tas d'une liste de jouables : chaque catégorie préparée une fois. */
const TAS = new WeakMap<readonly QuestionDeLaBase[], Map<Categorie, TasDeLaCategorie>>()

function tasDeLaListe(jouables: readonly QuestionDeLaBase[]): Map<Categorie, TasDeLaCategorie> {
  let parCategorie = TAS.get(jouables)
  if (!parCategorie) TAS.set(jouables, (parCategorie = new Map()))
  return parCategorie
}

/** Les trois tas d'une catégorie, d'une seule lecture de ses questions. */
function tasDeLaCategorie(porte: Pick<PorteDeLaCampagne, 'deLaCategorie'>, jouables: readonly QuestionDeLaBase[], categorie: Categorie): TasDeLaCategorie {
  const parCategorie = tasDeLaListe(jouables)
  let tas = parCategorie.get(categorie)
  if (!tas) parCategorie.set(categorie, (tas = tasDes(porte.deLaCategorie(jouables, categorie))))
  return tas
}

/** Les QCM du Cabinet d'une catégorie, de cette liste de jouables. */
export const qcmDeLaCategorie = (porte: Pick<PorteDeLaCampagne, 'deLaCategorie'>, jouables: readonly QuestionDeLaBase[], categorie: Categorie): readonly QuestionDeLaBase[] =>
  tasDeLaCategorie(porte, jouables, categorie).qcm

/** Les questions d'une catégorie dont la bonne réponse se tape au Mot mystère (`motDeLaQuestion`). */
export const motsDeLaCategorie = (porte: Pick<PorteDeLaCampagne, 'deLaCategorie'>, jouables: readonly QuestionDeLaBase[], categorie: Categorie): readonly QuestionDeLaBase[] =>
  tasDeLaCategorie(porte, jouables, categorie).mots

/** Les questions d'une catégorie qui se visent au Filet (`valeurDuFilet`). */
export const valeursDeLaCategorie = (porte: Pick<PorteDeLaCampagne, 'deLaCategorie'>, jouables: readonly QuestionDeLaBase[], categorie: Categorie): readonly QuestionDeLaBase[] =>
  tasDeLaCategorie(porte, jouables, categorie).valeurs

/** Ce que la porte donne de la base au-delà des QCM : la question d'un tableau, les événements datés. */
export type CeQueLaBaseDonne = Pick<PorteDeLaCampagne, 'parIdDe' | 'evenementsDe'>

/** La porte donne-t-elle de quoi lire la base au-delà des QCM ? Le magasin, toujours ; un essai qui ne tire que des QCM, non. */
export const litLaBase = (porte: CeQueLesTireursLisent): porte is CeQueLesTireursLisent & CeQueLaBaseDonne => porte.parIdDe !== undefined && porte.evenementsDe !== undefined

const QUESTIONS_DES_TABLEAUX = new WeakMap<readonly QuestionDeLaBase[], ReadonlyMap<string, QuestionDeLaBase>>()

/**
 * La question de la base qui demande le peintre de chaque tableau du Détail,
 * par l'identifiant Wikidata du tableau (`detailsDeLaBase`, celle que pose le
 * détail de l'Expédition) : son anecdote fait le « Le savais-tu ? » de la
 * manche. Un tableau sans elle dans cette base — retirée, une base d'essai —
 * se pose quand même : la règle du jeu dit alors ce qu'il est.
 */
export function questionsDesTableaux(porte: Pick<PorteDeLaCampagne, 'parIdDe'>, jouables: readonly QuestionDeLaBase[]): ReadonlyMap<string, QuestionDeLaBase> {
  let parQid = QUESTIONS_DES_TABLEAUX.get(jouables)
  if (!parQid) QUESTIONS_DES_TABLEAUX.set(jouables, (parQid = new Map(detailsDeLaBase(porte.parIdDe(jouables)).map(d => [d.tableau.qid, d.question]))))
  return parQid
}

/** Un sujet de la base qui fait une frise : son nom, que la frise prend pour thème, et ses événements datés. */
export interface SujetDeLaFrise {
  cle: string
  nom: string
  evenements: readonly EvenementDeLaFrise[]
}

const FRISES_DES_SUJETS = new WeakMap<readonly QuestionDeLaBase[], readonly SujetDeLaFrise[]>()

/**
 * Les sujets de la base qui font une frise, de cette liste de jouables : ses
 * événements datés (`evenementsDeLaBase`, gardés par la porte), regroupés par
 * les sujets de leur question (`sujetsDe` — un thème, une époque, un fil rouge,
 * un pays…), sans les époques redécoupées, qui ne se proposent plus nulle part
 * (`estRemplace`). Ne restent que ceux dont sept années tiennent l'écart, par
 * la règle même du tirage (`choisirLaFriseSansRepli`) : « 1900 à 1918 » n'en a
 * qu'une suite, un sujet trop serré aucune. Soixante et un sujets sur la base
 * du 25 octobre 2026 (`cabinet-jeux-images.test.ts` en garde un plancher).
 * Quelques millisecondes par liste : une étape du tourniquet à elle seule.
 */
export function frisesDesSujets(porte: CeQueLaBaseDonne, jouables: readonly QuestionDeLaBase[]): readonly SujetDeLaFrise[] {
  const gardees = FRISES_DES_SUJETS.get(jouables)
  if (gardees) return gardees
  const parId = porte.parIdDe(jouables)
  const parSujet = new Map<string, EvenementDeLaFrise[]>()
  for (const e of porte.evenementsDe(jouables)) {
    const q = parId.get(e.id)
    if (!q) continue
    for (const cle of sujetsDe(q.meta)) {
      if (estRemplace(cle)) continue
      let siens = parSujet.get(cle)
      if (!siens) parSujet.set(cle, (siens = []))
      siens.push(e)
    }
  }
  const sujets = [...parSujet].flatMap(([cle, evenements]): SujetDeLaFrise[] => {
    const sujet = sujetParCle(cle)
    // Qu'une suite tienne l'écart ne dépend pas du hasard : il ne fait que choisir laquelle.
    return sujet && choisirLaFriseSansRepli(evenements, ECART_DES_ANNEES_DE_LA_FRISE, EVENEMENTS_D_UNE_FRISE_A_THEME, () => 0) ? [{ cle, nom: sujet.nom, evenements }] : []
  })
  FRISES_DES_SUJETS.set(jouables, sujets)
  return sujets
}

/**
 * Les QCM qu'un Éclair peut poser, à ses marches (`MARCHES_DE_L_ECLAIR`) : la
 * catégorie de chacun par son identifiant, et combien chaque catégorie en a —
 * d'où l'Éclair compte ce qu'il reste à chacune de jamais vu (`jamaisVues`,
 * `tirages/eclair.ts`).
 */
export interface QcmDeLEclair {
  categorieDe: ReadonlyMap<string, Categorie>
  combien: ReadonlyMap<Categorie, number>
}

type Mesure = ReadonlyMap<string, MesureDUneQuestion>

/**
 * La dernière passe de l'Éclair faite pour chaque liste de jouables, et la
 * mesure qu'elle a lue ; et la mesure de celle qui se fait en fond. La marche
 * d'une question suit la mesure, relue toutes les dix minutes : gardée par
 * mesure seulement, la passe sur ses vingt-cinq mille QCM se refaisait sur le
 * chemin du premier départ qui trouvait la neuve, sous le verrou du profil —
 * de l'ordre de 60 à 150 ms au dixième de cœur de l'hébergeur (la relecture du
 * lot de sobriété, le 26 octobre 2026). Elle se prépare avec les tas, et une
 * mesure neuve se refait en fond : l'ordre des catégories se contente, le
 * temps de quelques tours, des marches d'il y a dix minutes — le tirage, lui,
 * lit toujours la mesure que le départ lui donne (`cabinet-charge.test.ts`
 * compte les mesures lues, tour par tour).
 */
const ECLAIRS = new WeakMap<readonly QuestionDeLaBase[], { mesures: Mesure; qcm: QcmDeLEclair }>()
const ECLAIRS_EN_ROUTE = new WeakMap<readonly QuestionDeLaBase[], Mesure>()

/** Les QCM d'une catégorie qui se posent à ses marches, à cette mesure : rangés dans `categorieDe`, et leur nombre. */
function eclairDeLaCategorie(
  porte: Pick<PorteDeLaCampagne, 'deLaCategorie'>,
  jouables: readonly QuestionDeLaBase[],
  mesures: Mesure,
  categorie: Categorie,
  categorieDe: Map<string, Categorie>,
): number {
  let n = 0
  for (const q of qcmDeLaCategorie(porte, jouables, categorie)) {
    if (!MARCHES_DE_L_ECLAIR.includes(niveauDeQuestion(q.meta.difficulte, mesures.get(q.id)))) continue
    categorieDe.set(q.id, categorie)
    n++
  }
  return n
}

/**
 * La passe de l'Éclair pour cette liste et cette mesure, une catégorie par
 * tour de boucle. Rien si elle est faite, ou en route ; une mesure plus neuve
 * demandée entre-temps l'arrête en chemin, et un tireur qui l'a faite d'un
 * bloc pendant l'attente aussi.
 */
async function preparerLEclair(porte: Pick<PorteDeLaCampagne, 'deLaCategorie'>, jouables: readonly QuestionDeLaBase[], mesures: Mesure): Promise<void> {
  if (ECLAIRS.get(jouables)?.mesures === mesures || ECLAIRS_EN_ROUTE.get(jouables) === mesures) return
  ECLAIRS_EN_ROUTE.set(jouables, mesures)
  try {
    const categorieDe = new Map<string, Categorie>()
    const combien = new Map<Categorie, number>()
    for (const c of CATEGORIES) {
      await rendreLaMain()
      if (ECLAIRS_EN_ROUTE.get(jouables) !== mesures || ECLAIRS.get(jouables)?.mesures === mesures) return
      combien.set(c, eclairDeLaCategorie(porte, jouables, mesures, c, categorieDe))
    }
    ECLAIRS.set(jouables, { mesures, qcm: { categorieDe, combien } })
  } finally {
    if (ECLAIRS_EN_ROUTE.get(jouables) === mesures) ECLAIRS_EN_ROUTE.delete(jouables)
  }
}

/**
 * Les QCM de l'Éclair à ses marches, pour le tireur : la passe de cette
 * mesure si elle est faite ; sinon celle d'une mesure d'avant, et la neuve se
 * refait en fond ; sans passe pour cette liste — un essai qui tire sans
 * préparer, une préparation ratée —, d'un bloc, comme les tas.
 */
export function qcmDeLEclair(porte: Pick<PorteDeLaCampagne, 'deLaCategorie'>, jouables: readonly QuestionDeLaBase[], mesures: Mesure): QcmDeLEclair {
  const faite = ECLAIRS.get(jouables)
  if (faite?.mesures === mesures) return faite.qcm
  if (faite) {
    preparerLEclair(porte, jouables, mesures).catch(e => console.error('[cabinet] passe de l’Éclair non refaite, celle d’avant sert encore :', e))
    return faite.qcm
  }
  const categorieDe = new Map<string, Categorie>()
  const combien = new Map(CATEGORIES.map(c => [c, eclairDeLaCategorie(porte, jouables, mesures, c, categorieDe)]))
  const qcm = { categorieDe, combien }
  ECLAIRS.set(jouables, { mesures, qcm })
  return qcm
}

/**
 * Ce que le Détail et la Frise lisent du disque une fois par processus, dans
 * l'ordre : les tableaux, puis le contenu neuf — ses juges passent sur chaque
 * entrée, une quarantaine de millisecondes. Chacun son tour de boucle
 * (`preparerLesTas`) : à la suite, un bloc de plus sous le premier départ d'un
 * processus.
 */
export const LECTURES_DU_DISQUE: readonly (() => unknown)[] = [tableauxDuDetail, contenuDuCabinet]

/**
 * Les tas d'une liste de jouables, une étape par tour de boucle : la page du
 * Cabinet les lance derrière sa réponse, comme la base de la campagne
 * (`porte.prechauffer`), et le départ qui trouve une liste neuve les attend
 * (`CabinetStore.tasDe`). Chaque catégorie a son tour, et ce qu'elle a de
 * questions encore jamais jugées passe aux cribles par tranches de
 * `QUESTIONS_PAR_TRANCHE`, une par tour : d'un seul tenant, une catégorie de
 * la base livrée — deux à trois mille questions — figeait la boucle 50 à
 * 110 ms, de l'ordre d'une seconde au dixième de cœur de l'hébergeur, douze
 * fois de suite (la revue de sobriété du 25 octobre 2026). Seule la première
 * préparation d'un processus juge ainsi toute la base ; une liste neuve des
 * mêmes questions ne fait plus que les filtrer, une catégorie par tour.
 * Chaque étape relit ce qu'une autre a pu faire pendant qu'elle attendait —
 * le tireur d'un départ, qui juge d'un bloc ce qui lui manque.
 *
 * Après les catégories, l'Éclair à ses marches pour la mesure qu'il y a, une
 * catégorie par tour (`qcmDeLEclair`) ; puis ce que le Détail et la Frise
 * lisent du disque (`lectures`, `LECTURES_DU_DISQUE`), chacun son tour ; puis
 * ce qu'ils lisent de cette base.
 */
export async function preparerLesTas(
  porte: CeQueLesTireursLisent & Partial<Pick<PorteDeLaCampagne, 'mesures'>>,
  jouables: readonly QuestionDeLaBase[],
  lectures: readonly (() => unknown)[] = LECTURES_DU_DISQUE,
): Promise<void> {
  for (const c of CATEGORIES) {
    await rendreLaMain()
    const parCategorie = tasDeLaListe(jouables)
    if (parCategorie.has(c)) continue
    const siennes = porte.deLaCategorie(jouables, c)
    for (let debut = 0; debut < siennes.length; debut += QUESTIONS_PAR_TRANCHE) {
      const fin = Math.min(debut + QUESTIONS_PAR_TRANCHE, siennes.length)
      let aJuger = false
      for (let i = debut; i < fin && !aJuger; i++) aJuger = !VERDICTS.has(siennes[i])
      if (!aJuger) continue
      // La première tranche partage le tour de la catégorie : rien d'autre n'y a été jugé.
      if (debut > 0) await rendreLaMain()
      for (let i = debut; i < fin; i++) verdictDe(siennes[i])
    }
    // Tous ses verdicts tenus : ses tas ne sont plus qu'un filtre — sauf si le tireur les a faits pendant l'attente.
    if (!parCategorie.has(c)) parCategorie.set(c, tasDes(siennes))
  }
  // Une mesure illisible : le tireur fera l'Éclair d'un bloc, comme sans préparation.
  const mesures = await porte.mesures?.().catch(e => (console.warn('[cabinet] mesure illisible, l’Éclair se préparera au départ :', e instanceof Error ? e.message : e), null))
  if (mesures) await preparerLEclair(porte, jouables, mesures)
  for (const lire of lectures) {
    await rendreLaMain()
    lire()
  }
  if (!litLaBase(porte)) return
  await rendreLaMain()
  questionsDesTableaux(porte, jouables)
  await rendreLaMain()
  frisesDesSujets(porte, jouables)
}
