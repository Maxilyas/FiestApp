// Les avatars divins : cinq dessins au-dessus des légendaires.
//
// Un légendaire se gagne par un haut fait, et la page profil dit lequel : on
// sait ce qu'on veut avant de l'avoir. Un Divin, non. Ce qui le fait
// descendre n'est écrit nulle part où un téléphone pourrait le lire : ce
// module part dans le paquet du navigateur, il ne porte donc que de quoi
// dessiner et nommer. La règle vit dans `server/src/core/divins.ts` — et la
// légende aussi : « Plus vite que tous, à chaque question », lue dans le
// code de la page, en dirait presque autant que la règle. Le serveur ne la
// raconte qu'à celui sur qui le Divin est descendu.
//
// Comme le reste du profil, un Divin ne donne AUCUN avantage de jeu.

export interface Divin {
  key: string
  nom: string
}

export const DIVINS: Divin[] = [
  { key: 'dv:helios', nom: 'Hélios' },
  { key: 'dv:seraphin', nom: 'Le Séraphin' },
  { key: 'dv:lotus', nom: 'Le Lotus Sacré' },
  { key: 'dv:arbre', nom: 'L’Arbre-Monde' },
  { key: 'dv:dechu', nom: 'L’Ange Déchu' },
]

const PAR_CLE = new Map(DIVINS.map(d => [d.key, d]))

export function divin(key: unknown): Divin | undefined {
  return typeof key === 'string' ? PAR_CLE.get(key) : undefined
}

/**
 * Un Divin descendu, tel que le serveur le raconte à celui qui l'a : ce
 * qu'il a fallu faire, dit à qui vient de le faire.
 */
export interface DivinDescendu {
  key: string
  legende: string
  /** Un Divin de l'ombre se gagne en tombant. */
  ton: 'eclat' | 'ombre'
}
