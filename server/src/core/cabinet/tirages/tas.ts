// Les tas où le Cabinet tire ce qu'il pose de la base : ce que chaque jeu sait
// poser, gardé par identité de la liste des jouables (`WeakMap`) — une base qui
// change, une question retirée refont la liste, et ses tas avec elle. Préparés
// une fois par liste (`preparerLesTas`), une étape par tour de boucle
// (`rendreLaMain`), en fond derrière la page du Cabinet ou sous le départ qui
// trouve une liste neuve — il les attend, et le serveur lit les autres
// requêtes entre deux étapes. Le tireur, lui, prend des tas prêts : ce qui lui
// manquerait encore (une préparation ratée), il le fait d'un bloc, deux mille
// questions par catégorie qu'il lit.
//
// Le Pari et l'Éclair puisent dans le même tas : des QCM de quatre réponses qui
// se lisent en 360 pixels, chrono en marche, et ne se trahissent pas d'eux-mêmes.
// Le Détail lit la question qui demande le peintre de chacun de ses tableaux,
// pour son anecdote ; la Frise, les sujets de la base qui font une frise.
import type { QuestionDeLaBase } from '../../baseCampagne'
import { detailsDeLaBase, tableauxDuDetail } from '../../details'
import type { PorteDeLaCampagne } from '../../porteDeLaCampagne'
import { rendreLaMain } from '../../tourniquet'
import { contenuDuCabinet, ecritDans } from '../contenu'
import type { CeQueLesTireursLisent } from './communs'
import { ECART_DES_ANNEES_DE_LA_FRISE, EVENEMENTS_D_UNE_FRISE_A_THEME, INTITULE_MAX_DU_QCM, REPONSE_MAX_DU_QCM } from '../../../../../shared/cabinet/bareme'
import { CATEGORIES, type Categorie } from '../../../../../shared/categories'
import { choisirLaFriseSansRepli, type EvenementDeLaFrise } from '../../../../../shared/frise'
import { estRemplace, sujetParCle, sujetsDe } from '../../../../../shared/sujets'

/** Les signes d'un texte, un emoji compté pour un : ce qu'on lit, pas ce que JavaScript compte. */
const signes = (texte: string) => [...texte].length

/**
 * Un QCM du Cabinet : quatre réponses — ni un vrai ou faux de la base, que
 * l'Éclair rendrait « Vrai ? », ni un six choix —, un intitulé et des réponses
 * courts, et aucune réponse dite dans l'intitulé, en mots entiers et sans
 * accents (`ecritDans`) : « Quel fleuve traverse Lyon, le Rhône… » se
 * trouverait sans rien savoir, et l'affirmation de l'Éclair se lirait vraie
 * d'office.
 */
export function estUnQcmDuCabinet(q: Pick<QuestionDeLaBase, 'texte' | 'reponses'>): boolean {
  if (q.reponses.length !== 4 || signes(q.texte) > INTITULE_MAX_DU_QCM) return false
  return q.reponses.every(r => signes(r) <= REPONSE_MAX_DU_QCM && !ecritDans(q.texte, r))
}

/** Les tas d'une liste de jouables : chaque catégorie préparée une fois. */
const TAS = new WeakMap<readonly QuestionDeLaBase[], Map<Categorie, readonly QuestionDeLaBase[]>>()

/** Les QCM du Cabinet d'une catégorie, de cette liste de jouables. */
export function qcmDeLaCategorie(porte: Pick<PorteDeLaCampagne, 'deLaCategorie'>, jouables: readonly QuestionDeLaBase[], categorie: Categorie): readonly QuestionDeLaBase[] {
  let parCategorie = TAS.get(jouables)
  if (!parCategorie) TAS.set(jouables, (parCategorie = new Map()))
  let tas = parCategorie.get(categorie)
  if (!tas) parCategorie.set(categorie, (tas = porte.deLaCategorie(jouables, categorie).filter(estUnQcmDuCabinet)))
  return tas
}

/** Les QCM de toutes les catégories, en morceaux : le tirage d'une escale les lit comme un seul tas. */
export function qcmDeToutes(porte: Pick<PorteDeLaCampagne, 'deLaCategorie'>, jouables: readonly QuestionDeLaBase[]): (readonly QuestionDeLaBase[])[] {
  return CATEGORIES.map(c => qcmDeLaCategorie(porte, jouables, c))
}

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
 * Les tas d'une liste de jouables, une étape par tour de boucle : la page du
 * Cabinet les lance derrière sa réponse, comme la base de la campagne
 * (`porte.prechauffer`), et le départ qui trouve une liste neuve les attend
 * (`CabinetStore.tasDe`). Une étape lourde passe son tour avant de calculer,
 * puis relit ce qu'une autre a pu faire pendant qu'elle attendait. Après les
 * catégories : ce que le Détail et la Frise lisent du disque une fois par
 * processus — les tableaux, le contenu neuf —, puis ce qu'ils lisent de cette
 * base.
 */
export async function preparerLesTas(porte: CeQueLesTireursLisent, jouables: readonly QuestionDeLaBase[]): Promise<void> {
  for (const c of CATEGORIES) {
    await rendreLaMain()
    qcmDeLaCategorie(porte, jouables, c)
  }
  await rendreLaMain()
  tableauxDuDetail()
  contenuDuCabinet()
  if (!litLaBase(porte)) return
  await rendreLaMain()
  questionsDesTableaux(porte, jouables)
  await rendreLaMain()
  frisesDesSujets(porte, jouables)
}
