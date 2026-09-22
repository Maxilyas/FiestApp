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
