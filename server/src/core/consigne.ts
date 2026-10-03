// La consigne du quiz du jour : ce qu'on donne à une IA pour qu'elle écrive
// les questions de la réserve — la routine Claude Code qui la remplit toute
// seule (`/api/jour/reserve`), ou l'administrateur qui la colle dans le
// chatbot de son choix (« Copier la consigne pour une IA », à /admin). Une
// seule consigne pour les deux.
//
// Elle décrit le format de « Coller une liste », réduit à ce que la réserve
// accepte (des QCM, sans photo ni extrait) et écrit à partir des bornes de
// l'éditeur : elle ne peut rien promettre que la réserve refuserait, et son
// exemple se relit dans les tests (`jour-reserve.test.ts`).

import { CATEGORIES } from '../../../shared/categories'
import { MAX_ANECDOTE, MAX_ANSWER_TEXT, MAX_TEXT } from '../../../shared/library'
import { QUESTIONS_PAR_JOUR } from '../../../shared/jour'
import type { Niveau } from '../../../shared/campagne'

/**
 * Ce que la réserve vise : trois semaines d'avance. Une routine qui saute
 * un passage ne se voit pas ; l'administration, elle, s'inquiète sous sept
 * jours.
 */
export const JOURS_VISES = 21

/**
 * Au plus par passage. Au-delà, une seule réponse d'IA s'allonge jusqu'à
 * tronquer sa fin, et la relecture se fait moins bien.
 */
export const A_ECRIRE_MAX = 100

/** Ce qu'une IA copiée à la main écrit bien d'un coup, dans une conversation. */
export const A_ECRIRE_A_LA_MAIN = 30

/**
 * Les catégories du quiz du jour : toutes, sauf celle de la fête —
 * « Combien de bougies sur le gâteau ? » n'a pas de sens seul chez soi.
 */
export const CATEGORIES_DU_JOUR = CATEGORIES.filter(c => c !== 'Autour de la fête')

/** Combien de catégories la consigne demande de privilégier : les moins fournies de la réserve. */
const PRIVILEGIEES = 4

/** Ce qu'il reste à écrire pour tenir trois semaines d'avance — rien, si elles y sont. */
export function aEcrirePour(joursDAvance: number): number {
  const manque = (JOURS_VISES - Math.max(0, Math.floor(joursDAvance))) * QUESTIONS_PAR_JOUR
  return Math.max(0, Math.min(A_ECRIRE_MAX, manque))
}

/** Les catégories les moins fournies de la réserve, les premières à remplir. */
export function categoriesAPrivilegier(parCategorie: Readonly<Record<string, number>>): string[] {
  return [...CATEGORIES_DU_JOUR]
    .sort((a, b) => (parCategorie[a] ?? 0) - (parCategorie[b] ?? 0) || CATEGORIES_DU_JOUR.indexOf(a) - CATEGORIES_DU_JOUR.indexOf(b))
    .slice(0, PRIVILEGIEES)
}

/**
 * La difficulté, en nombres. « Un quart de faciles, un quart de
 * difficiles » ne tenait pas : cinquante questions écrites par cette
 * consigne puis étiquetées (le 3 octobre 2026) comptaient trente-deux
 * faciles pour quatre difficiles. Les nombres, à l'essai suivant, n'ont
 * guère fait mieux (trente-sept faciles, quatre difficiles) : une IA qui
 * écrit sans retour juge facile ce qu'elle sait. La cible reste dite en
 * nombres, parce qu'elle se teste ; ce qui la fera tenir, c'est la
 * difficulté mesurée sur les réponses des joueurs, rendue à la consigne.
 */
export function repartitionDesDifficultes(n: number): { faciles: number; moyennes: number; difficiles: number } {
  const quart = Math.round(n / 4)
  return { faciles: quart, moyennes: n - 2 * quart, difficiles: quart }
}

/**
 * Combien de catégories, au moins, en dehors de celles à privilégier : le
 * même essai les avait toutes écrites dans les quatre à privilégier, « les
 * autres restent permises » lu comme une politesse.
 */
const AUTRES_CATEGORIES_AU_MOINS = 4

/** Sous ce nombre de questions mesurées, la consigne ne dit rien de ce que pensent les joueurs. */
export const MESUREES_POUR_DIRE = 10

/**
 * Ce que disent les réponses des joueurs aux dernières questions posées :
 * la difficulté qu'une IA qui écrit sans retour ne sait pas juger — elle
 * trouve facile ce qu'elle sait (`repartitionDesDifficultes`). Rendue à la
 * consigne, avec un avertissement quand les faciles débordent : la cible
 * en veut un quart.
 */
export function ceQueDisentLesJoueurs(mesure: Readonly<Record<Niveau, number>>): string | null {
  const total = mesure.facile + mesure.moyen + mesure.difficile + mesure.expert
  if (total < MESUREES_POUR_DIRE) return null
  const difficiles = mesure.difficile + mesure.expert
  const trop = mesure.facile / total > 0.4
  return (
    `CE QUE DISENT LES JOUEURS — sur les ${total} dernières questions posées, mesurées sur leurs réponses : ${mesure.facile} faciles (plus de 70 % les trouvent), ${mesure.moyen} moyennes, ${difficiles} difficiles (moins de 40 %).` +
    (trop ? ' C’est trop facile : ce qui te semble moyen, presque tous le trouvent. Écris plus difficile que tu ne le crois.' : '')
  )
}

/**
 * L'exemple de la consigne. Une IA suit un exemple mieux qu'une règle : il
 * montre tout ce que la consigne demande — la catégorie, l'étoile, quatre
 * réponses de même nature, une anecdote qui apprend autre chose que la
 * réponse. Ses faits sont sûrs, et il se relit dans les tests.
 */
export const EXEMPLE_DU_JOUR = `# Géographie

Quelle est la capitale de l'Australie ?
* Canberra
Sydney
Melbourne
Perth
Anecdote : Canberra a été bâtie exprès pour devenir la capitale : Sydney et Melbourne se disputaient le titre.

# Nature

Combien de cœurs a une pieuvre ?
Un
Deux
* Trois
Quatre
Anecdote : Deux de ses cœurs irriguent les branchies, le troisième le reste du corps — et son sang est bleu.`

/**
 * La consigne, prête à copier : ce qu'il faut écrire, comment, et ce qui
 * est déjà dans la réserve — une IA ne sait pas ce qu'elle a écrit la
 * semaine dernière, et une question reformulée passerait l'empreinte.
 */
export function consigneDuJour({
  n,
  aPrivilegier,
  deja,
  mesure,
}: {
  n: number
  aPrivilegier: readonly string[]
  deja: readonly string[]
  /** La difficulté mesurée des dernières questions posées (`JourStore.difficultesRecentes`). */
  mesure?: Readonly<Record<Niveau, number>>
}): string {
  const difficulte = repartitionDesDifficultes(n)
  const privilegiees = Math.ceil(n / 2)
  const autres = Math.min(AUTRES_CATEGORIES_AU_MOINS, CATEGORIES_DU_JOUR.length - aPrivilegier.length)
  const lignes = [
    `LE QUIZ DU JOUR DE FIESTAPP — ${n} QUESTIONS À ÉCRIRE`,
    '',
    `Chaque jour, ${QUESTIONS_PAR_JOUR} questions de culture générale, les mêmes pour tous, jouées seul sur son téléphone par des adultes curieux. Après chaque réponse, on découvre la bonne et une anecdote : c'est là qu'on apprend. Écris ${n} questions nouvelles pour la réserve.`,
    '',
    'CE QUI FAIT UNE BONNE QUESTION',
    '- Un fait sûr, qui ne change pas : ni actualité, ni « actuel », ni record qui peut tomber, ni chiffre approximatif.',
    '- Une seule bonne réponse, sans discussion possible. Au moindre doute sur un fait, change de question.',
    "- Quatre réponses courtes, de même nature et toutes plausibles. Jamais la réponse dans l'intitulé, jamais de négation (« Lequel n'est pas… »), ni « Aucune de ces réponses ».",
    '- Une anecdote vraie, en une phrase, qui apprend autre chose que la réponse.',
    `- La difficulté, en nombres : ${difficulte.faciles} faciles, que presque tout le monde trouve (« Quel fleuve traverse Paris ? ») ; ${difficulte.moyennes} moyennes, qu'une personne sur deux trouve (« Quel peintre a peint La Nuit étoilée ? ») ; ${difficulte.difficiles} difficiles, qu'une sur quatre au plus trouve, sans être obscures : en lisant la réponse, on se dit « j'aurais pu le savoir » (« Dans quel pays se trouve le désert d'Atacama ? »). Les faciles viennent toutes seules : écris d'abord les difficiles.`,
    '- Des sujets variés, de France et du monde : jamais deux questions sur le même sujet.',
    "- Pas d'emoji.",
    '',
    ...(() => {
      const dit = mesure && ceQueDisentLesJoueurs(mesure)
      return dit ? [dit, ''] : []
    })(),
    "LE FORMAT — du texte brut, rien d'autre",
    '- Une ligne vide entre deux questions.',
    `- La première ligne d'une question est son intitulé : ${MAX_TEXT} caractères au plus, et le plus court possible.`,
    `- Puis les quatre réponses, une par ligne (${MAX_ANSWER_TEXT} caractères au plus), une étoile * devant la bonne, et une seule.`,
    `- Puis une ligne « Anecdote : » (${MAX_ANECDOTE} caractères au plus).`,
    `- Une ligne « # » suivie d'une catégorie, avant une question, la range avec les suivantes dans cette catégorie, jusqu'à la prochaine ligne « # ». Seulement l'une de celles-ci, écrite telle quelle : ${CATEGORIES_DU_JOUR.join(', ')}.`,
    '- Ni numéros, ni puces, ni gras ; ni introduction, ni conclusion : rien que les questions.',
    '',
    ...(aPrivilegier.length > 0
      ? [
          `CATÉGORIES À PRIVILÉGIER — les moins fournies de la réserve : ${aPrivilegier.join(', ')}. Environ la moitié des questions (${privilegiees} sur ${n}) dans celles-ci ; les ${n - privilegiees} autres réparties entre au moins ${autres} autres catégories de la liste : « à privilégier » ne veut pas dire « seulement ».`,
          '',
        ]
      : []),
    'AVANT DE RENDRE LA LISTE',
    "Relis chaque question comme un correcteur exigeant : la bonne réponse est-elle certaine et la seule possible ? L'anecdote est-elle exacte ? Au moindre doute, remplace la question. Mieux vaut une question simple et sûre qu'une question brillante et fausse.",
  ]
  if (deja.length > 0) {
    lignes.push(
      '',
      "DÉJÀ DANS LA RÉSERVE OU DÉJÀ POSÉES — n'en reprends aucune, même reformulée",
      ...deja.map(t => `- ${t.replace(/\s+/g, ' ').trim()}`),
    )
  }
  lignes.push('', "EXEMPLE — le format seulement : n'en reprends pas les questions", '', EXEMPLE_DU_JOUR, '')
  return lignes.join('\n')
}
