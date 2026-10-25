// Une question de la base jouée au plus près : ce qu'elle vise, ou pourquoi
// elle ne s'y prête pas. Le quiz tout prêt y tire ses estimations, `verifier
// --nombres` y juge les questions à nombre d'un lot, et le Filet du Cabinet de
// curiosités y lit les siennes — une seule règle pour les trois.
//
// Sortie de `core/quizToutPret.ts` le 25 octobre 2026, sans rien y changer
// (il la réexporte pour ses lecteurs d'avant) : le Cabinet la lisait par lui,
// et tirait avec le quiz du jour, les profils et les règles des Divins
// (`core/jour.ts`), que rien du Cabinet ne doit importer.
import { MAX_UNIT } from '../../../shared/library'
import { lireNombreEnTete } from '../../../shared/nombres'
import type { QuestionDeLaBase } from './baseCampagne'

/** « Lequel de ces… », « parmi » : un intitulé qui suppose des choix ne se pose pas sans eux. */
const FORMULE_DE_QCM = /\b(parmi|de ces|lequel|laquelle|lesquels|lesquelles|ci-dessous)\b/i

/** L'intitulé suppose-t-il des choix ? Sans eux — une estimation, la piste du Filet —, il ne se pose pas. */
export const supposeDesChoix = (texte: string): boolean => FORMULE_DE_QCM.test(texte)

/**
 * Un numéro ne s'estime pas : 814 n'est pas « presque » le vol 815 de « Lost », ni 74 le département de Paris. Cherché
 * partout dans l'intitulé, pas seulement en tête : « Au rugby à XV, quel numéro de maillot porte l'arrière ? » se jouait
 * au plus près, au quiz tout prêt comme au Filet.
 */
const NUMERO = /\bquel(?:le)?\s+(?:est\s+)?(?:le\s+|l['’])?(?:num[ée]ro|indicatif|code)\b/i

/**
 * Jusqu'où un entier facile se sait par cœur : soixante minutes, vingt-six
 * lettres, onze joueurs, « 6 × 7 » — toute la salle tape le même nombre et
 * finit ex æquo. Il reste un bon QCM.
 */
const PETIT_ENTIER_CONNU = 100

/** Ce qu'un intitulé écrit, aux apostrophes, aux espaces et à la casse près. */
const pourComparer = (texte: string) => texte.toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ')

/**
 * Ce qu'une question de la base vise, jouée en estimation — ou null. Sa
 * bonne réponse doit être ce nombre (`valeur`, que la base donne aussi à une
 * question dont un nombre n'est qu'un détail) ; plus de dix, ou à virgule :
 * « Combien d'anneaux sur le drapeau olympique ? » se devine, ne s'estime
 * pas ; ni un numéro, ni un petit entier qu'une facile fait savoir à tous ;
 * et son intitulé doit se lire sans les choix. Une unité trop longue pour
 * l'écran (`MAX_UNIT` : « images par seconde ») s'efface, si l'intitulé la
 * dit : « Il y a combien de temps les dinosaures ont-ils disparu ? » se
 * jouait avec 66, sans ses « millions d'années » — qui tapait 65 000 000
 * était à des millions de la cible.
 */
export function cibleDeLEstimation(q: QuestionDeLaBase): { target: number; unit: string } | null {
  const lue = lireLEstimation(q)
  return 'cible' in lue ? lue.cible : null
}

/** La même lecture, qui dit pourquoi une question ne se joue pas au plus près : `verifier --nombres` le dit au rédacteur d'une part à nombre. */
export function lireLEstimation(q: QuestionDeLaBase): { cible: { target: number; unit: string } } | { refus: string } {
  const valeur = q.meta.valeur
  if (!valeur) return { refus: 'pas de valeur : la bonne réponse n’est pas un nombre' }
  if (q.reponses.length !== 4) return { refus: 'un vrai ou faux' }
  if (Number.isInteger(valeur.nombre) && valeur.nombre <= 10) return { refus: 'dix ou moins : il se devine, il ne s’estime pas' }
  if (Number.isInteger(valeur.nombre) && valeur.nombre <= PETIT_ENTIER_CONNU && q.meta.difficulte <= 2) {
    return { refus: `un petit entier à la difficulté ${q.meta.difficulte} : tout le monde le sait, la salle finirait ex æquo` }
  }
  if (lireNombreEnTete(q.reponses[q.bonne])?.valeur !== valeur.nombre) return { refus: 'la bonne réponse ne commence pas par la valeur' }
  if (supposeDesChoix(q.texte)) return { refus: 'un intitulé qui suppose des choix (« parmi », « lequel »)' }
  if (NUMERO.test(q.texte)) return { refus: 'un numéro ne s’estime pas' }
  const tient = Array.from(valeur.unite).length <= MAX_UNIT
  if (!tient && !pourComparer(q.texte).includes(pourComparer(valeur.unite))) {
    return { refus: `l’unité « ${valeur.unite} » ne tient pas à l’écran, et l’intitulé ne la dit pas` }
  }
  return { cible: { target: valeur.nombre, unit: tient ? valeur.unite : '' } }
}
