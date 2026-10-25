// Ce qui, au journal des réponses de la campagne, n'est pas une question de
// la base : un rébus de l'expédition, une frise, et tout ce que le Cabinet de
// curiosités tire d'ailleurs — un lieu de l'Épingle, une fiche des Indices,
// une réplique, un tableau du Détail, les cinq affirmations de l'Éclair, une
// frise. Ni carnet — une révision ne saurait pas le reposer, et « À revoir »,
// sur l'accueil, le compterait chaque jour (`compterARevoir` ne lit que les
// retraits) —, ni signalement — le QG n'aurait ni version à relire ni
// réponse à corriger.
//
// Une seule liste, que lisent les trois endroits qui en ont besoin : le
// carnet du journal en mémoire (`JournalDesReponses.auCarnet`), le même en
// SQL (`CampagneStore.suivisDeLaBase`) et le signalement
// (`CampagneStore.signaler`). Chacun recopiait ses préfixes : le Cabinet en
// apportait un troisième, et trois oublis possibles — oublié des deux côtés
// du carnet, que `journal-des-reponses.test.ts` compare, il ne se serait pas
// vu.
//
// La lecture du journal ne dépend pas de la liste : le carnet écarte ces
// identifiants quand il replie une réponse, pas quand la base la lit. Un
// préfixe de plus ne change donc pas le texte de la lecture, ni la version
// des tranches gardées (`VERSION_DES_TRANCHES`) : aucun réveil ne relit tout.
//
// N'importe que trois constantes : le journal des réponses le lit sans tirer
// le Cabinet.

import { PREFIXE_DU_REBUS } from './curiosites'
import { PREFIXE_DE_LA_FRISE } from './frise'
import { PREFIXE_DU_CABINET } from './cabinet/pieces'

/**
 * Les préfixes de ce qui n'est pas une question de la base. Un préfixe neuf
 * s'ajoute ici, avec sa phrase dans `REFUS_DU_SIGNALEMENT` (le typage la
 * réclame) ; il s'écrit en minuscules, finit par un deux-points et ne
 * commence aucun autre — `hors-de-la-base.test.ts` y veille.
 */
export const PREFIXES_HORS_DE_LA_BASE = [PREFIXE_DU_REBUS, PREFIXE_DE_LA_FRISE, PREFIXE_DU_CABINET] as const

export type PrefixeHorsDeLaBase = (typeof PREFIXES_HORS_DE_LA_BASE)[number]

/** Le préfixe hors de la base que porte cet identifiant ; null : une question de la base. */
function prefixeDe(id: string): PrefixeHorsDeLaBase | null {
  for (const p of PREFIXES_HORS_DE_LA_BASE) if (id.startsWith(p)) return p
  return null
}

/** Ni carnet ni signalement : l'identifiant n'est pas celui d'une question de la base. */
export const horsDeLaBase = (id: string): boolean => prefixeDe(id) !== null

/**
 * La même règle en SQL, pour la colonne qu'on lui donne :
 * `r.reserve_id NOT LIKE 'rebus:%' AND …`. Les préfixes s'écrivent tels quels
 * dans le texte de la requête — ni guillemet, ni joker de `LIKE` (`%`, `_`).
 * `LIKE` ignore la casse là où `startsWith` la distingue : sans conséquence,
 * aucun identifiant de la base n'ayant de deux-points (`[a-z0-9]{8}`,
 * `lireQuestionDeLaBase`).
 */
export const sqlDansLaBase = (colonne: string): string => PREFIXES_HORS_DE_LA_BASE.map(p => `${colonne} NOT LIKE '${p}%'`).join(' AND ')

/**
 * Ce que dit le refus d'un signalement, préfixe par préfixe. Les deux
 * premières phrases sont celles d'avant le Cabinet, mot pour mot : des tests
 * et la référence de l'API les citent. Les questions de la base qu'un jeu du
 * Cabinet pose (le Pari, le Mot mystère, le Filet) gardent leur identifiant,
 * et se signalent.
 */
export const REFUS_DU_SIGNALEMENT: Readonly<Record<PrefixeHorsDeLaBase, string>> = {
  // Un rébus (la version 12 de l'expédition) : des emojis et un mot à composer, écrits pour elle.
  [PREFIXE_DU_REBUS]: 'Un rébus ne se signale pas : seules les questions de la campagne le peuvent',
  // Une frise (la version 13) : des questions récrites en une ligne chacune, aucune n'est celle qu'il a jouée.
  [PREFIXE_DE_LA_FRISE]: 'Une frise ne se signale pas : seules les questions de la campagne le peuvent',
  // Le contenu neuf du Cabinet n'a pas encore de correction au QG, et l'Éclair récrit ses cinq questions.
  [PREFIXE_DU_CABINET]: 'Ce jeu du Cabinet ne se signale pas : seules les questions de la campagne le peuvent',
}

/** Le refus du signalement de cette pièce, en mots ; null : une question de la base, qui se signale. */
export function refusDuSignalement(id: string): string | null {
  const p = prefixeDe(id)
  // Lue par le préfixe trouvé dans la liste, jamais par l'identifiant : une clé du prototype ne vaut rien ici.
  return p === null ? null : REFUS_DU_SIGNALEMENT[p]
}
