// Les tas où le Cabinet tire ses questions de la base : ce que chaque jeu sait
// poser, catégorie par catégorie, gardé par identité de la liste des jouables
// (`WeakMap`) — une base qui change, une question retirée refont la liste, et
// ses tas avec elle. Préparés une fois par liste (`preparerLesTas`), une
// catégorie par tour de boucle (`rendreLaMain`), en fond derrière la page du
// Cabinet ou sous le départ qui trouve une liste neuve — il les attend, et le
// serveur lit les autres requêtes entre deux catégories. Le tireur, lui, prend
// des tas prêts : ce qui lui manquerait encore (une préparation ratée), il le
// passe au crible d'un bloc, deux mille questions par catégorie qu'il lit.
//
// Le Pari et l'Éclair puisent dans le même tas : des QCM de quatre réponses qui
// se lisent en 360 pixels, chrono en marche, et ne se trahissent pas d'eux-mêmes.
import type { QuestionDeLaBase } from '../../baseCampagne'
import type { PorteDeLaCampagne } from '../../porteDeLaCampagne'
import { rendreLaMain } from '../../tourniquet'
import { ecritDans } from '../contenu'
import { INTITULE_MAX_DU_QCM, REPONSE_MAX_DU_QCM } from '../../../../../shared/cabinet/bareme'
import { CATEGORIES, type Categorie } from '../../../../../shared/categories'

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

/**
 * Les tas d'une liste de jouables, une catégorie par tour de boucle : la page
 * du Cabinet les lance derrière sa réponse, comme la base de la campagne
 * (`porte.prechauffer`), et le départ qui trouve une liste neuve les attend
 * (`CabinetStore.tasDe`). Une étape lourde passe son tour avant de calculer,
 * puis relit ce qu'une autre a pu faire pendant qu'elle attendait.
 */
export async function preparerLesTas(porte: Pick<PorteDeLaCampagne, 'deLaCategorie'>, jouables: readonly QuestionDeLaBase[]): Promise<void> {
  for (const c of CATEGORIES) {
    await rendreLaMain()
    qcmDeLaCategorie(porte, jouables, c)
  }
}
