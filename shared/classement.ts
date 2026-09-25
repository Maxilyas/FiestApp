// Le classement : une seule règle, pour tous les écrans et toutes les pages.
//
// Il y en avait cinq. Le podium du quiz départageait les ex æquo par
// identifiant technique, le souvenir par ordre d'arrivée, l'écran commun par
// ordre alphabétique ; le souvenir couronnait le premier à avoir marqué quand
// le bilan couronnait le premier de l'alphabet, et l'expérience de la victoire
// suivait le souvenir. Deux invités à 300 points ne savaient donc pas lequel
// des deux avait gagné — ni même s'ils avaient gagné.
//
// Désormais :
// · le rang est partagé : 1 + le nombre de concurrents strictement devant.
//   Deux premiers ex æquo, puis un troisième — pas de deuxième ;
// · des ex æquo en tête sont TOUS vainqueurs ;
// · l'ordre dans lequel on écrit des ex æquo n'est qu'un ordre d'affichage :
//   le nom tel qu'on l'affiche (« Camille » avant « Camille (2) »), puis
//   l'identifiant. Il ne décide de rien, mais il ne bouge pas d'un
//   rafraîchissement à l'autre, et la soirée en cours se lit comme son
//   archive — l'ordre d'arrivée, lui, n'est pas celui du registre en mémoire
//   après un redémarrage.
//
// Pur et partagé : le serveur l'applique au souvenir, au bilan, aux prix et à
// l'expérience, l'écran commun à ses podiums.

/** Le rang partagé d'une valeur : 1 + le nombre de valeurs strictement meilleures. */
export function rangPartage(valeur: number, valeurs: Iterable<number>): number {
  let devant = 0
  for (const v of valeurs) if (v > valeur) devant++
  return devant + 1
}

/** Le nombre de décimales avec lequel un nombre s'écrit : 7,9 en a une, 1994 aucune, 1,5e-7 huit. */
export function decimales(x: number): number {
  const m = /^-?\d+(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(x))
  if (!m) return 0
  return Math.max(0, (m[1]?.length ?? 0) - Number(m[2] ?? 0))
}

/**
 * L'écart d'une estimation à la bonne réponse, tel qu'on le lit sur ce qu'on
 * a tapé — c'est lui qui dit si deux estimations sont ex æquo.
 *
 * En virgule flottante, 0,9 − 0,8 et 0,8 − 0,7 ne valent pas la même chose
 * (0,0999…98 contre 0,1000…09) : deux invités à égale distance de la réponse
 * n'étaient pas à égalité, et le barème au rang payait l'un 200 points et
 * l'autre 30. L'écart s'arrondit donc à la précision de ce qu'on a écrit — la
 * plus fine des deux nombres, douze décimales au plus.
 */
export function ecartEstimation(valeur: number, cible: number): number {
  const precision = Math.min(12, Math.max(decimales(valeur), decimales(cible)))
  return Number(Math.abs(valeur - cible).toFixed(precision))
}

const comparerIds = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/**
 * L'ordre d'affichage de deux ex æquo : le nom affiché, à la française, puis
 * l'identifiant — deux homonymes sur deux avatars différents portent le même
 * nom, et ne doivent pas permuter pour autant.
 */
export function ordreDAffichage<T>(nom: (t: T) => string, id: (t: T) => string): (a: T, b: T) => number {
  return (a, b) => nom(a).localeCompare(nom(b), 'fr') || comparerIds(id(a), id(b))
}

/** L'ordre d'un classement : la valeur, de la plus haute à la plus basse, puis l'ordre d'affichage. */
export function ordreDeClassement<T>(
  valeur: (t: T) => number,
  nom: (t: T) => string,
  id: (t: T) => string,
): (a: T, b: T) => number {
  const affichage = ordreDAffichage(nom, id)
  return (a, b) => valeur(b) - valeur(a) || affichage(a, b)
}

export interface Classe<T> {
  item: T
  rang: number
}

/** Trie dans l'ordre commun, et donne à chacun son rang partagé. */
export function classer<T>(
  items: readonly T[],
  valeur: (t: T) => number,
  nom: (t: T) => string,
  id: (t: T) => string,
): Classe<T>[] {
  const tries = [...items].sort(ordreDeClassement(valeur, nom, id))
  let rang = 0
  return tries.map((item, i) => {
    // Trié du plus haut au plus bas : le rang ne change qu'avec la valeur.
    if (i === 0 || valeur(item) !== valeur(tries[i - 1])) rang = i + 1
    return { item, rang }
  })
}

/**
 * Le rang partagé d'une valeur parmi des valeurs déjà rangées du plus haut au
 * plus bas : la règle de `rangPartage`, lue par dichotomie. Le rang d'avant
 * la question se cherche pour chaque téléphone de la salle : compté en
 * parcourant toutes les valeurs, il coûtait un tour de salle par téléphone.
 */
export function rangDansLesTries(valeur: number, tries: readonly number[]): number {
  let bas = 0
  let haut = tries.length
  while (bas < haut) {
    const milieu = (bas + haut) >> 1
    if (tries[milieu] > valeur) bas = milieu + 1
    else haut = milieu
  }
  return bas + 1
}

/**
 * Les groupes d'ex æquo d'un classement rangé par `classer` : pour chaque
 * position, la première et la dernière de son groupe. Le plus proche devant
 * soi est juste avant son groupe, le plus proche derrière juste après — un ex
 * æquo n'est ni devant ni derrière, et « à 0 point de Léa » ne dit rien.
 */
export function groupesDExAequo<T>(classes: readonly Classe<T>[]): { premier: number[]; dernier: number[] } {
  const n = classes.length
  const premier = new Array<number>(n)
  const dernier = new Array<number>(n)
  for (let i = 0; i < n; i++) premier[i] = i > 0 && classes[i].rang === classes[i - 1].rang ? premier[i - 1] : i
  for (let i = n - 1; i >= 0; i--) dernier[i] = i < n - 1 && classes[i + 1].rang === classes[i].rang ? dernier[i + 1] : i
  return { premier, dernier }
}

/**
 * Les vainqueurs : tous ceux qui partagent la première place, dans l'ordre
 * d'affichage. Personne quand le meilleur n'a rien marqué — un quiz où tout
 * le monde finit à zéro n'a pas de vainqueur.
 */
export function vainqueurs<T>(
  items: readonly T[],
  valeur: (t: T) => number,
  nom: (t: T) => string,
  id: (t: T) => string,
): T[] {
  return classer(items, valeur, nom, id)
    .filter(c => c.rang === 1 && valeur(c.item) > 0)
    .map(c => c.item)
}

/** Des ex æquo dits à la française : « Alice », « Alice et Zoé », « Alice, Bruno et Zoé ». */
export function enumerer(noms: readonly string[]): string {
  if (noms.length <= 1) return noms[0] ?? ''
  return `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
}
