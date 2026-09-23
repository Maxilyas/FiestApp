// Les avatars légendaires : des avatars dessinés, qui ne se gagnent que par
// un haut fait précis.
//
// L'emoji d'un invité est à tout le monde : vingt-quatre animaux, choisis en
// une seconde. Un légendaire, non. Il se débloque en accomplissant quelque
// chose — un sans-faute, une remontée, trois quiz d'affilée… ou trois
// lanternes rouges : le bas du classement a les siens. On ne peut ni
// l'acheter ni l'accélérer, et la page profil montre les autres en
// silhouette, avec leur règle : on sait ce qu'on veut avant de l'avoir.
//
// Le dessin vit côté client (`client/src/components/Legendaire.tsx`) ; ici,
// le catalogue et la règle, purs et partagés — le serveur vérifie qu'on porte
// un légendaire qu'on a, la page profil montre ce qui manque.

import { clePalier } from './hautsfaits'

export interface Legendaire {
  key: string
  nom: string
  /** Une ligne, pour la galerie : ce qu'il raconte. */
  legende: string
  /**
   * Ce qui le débloque : un haut fait de soirée décroché `fois` fois, ou un
   * palier de carrière atteint.
   */
  condition: { hautFait: string; fois: number } | { hautFait: string; palier: number }
  /** Le ton du haut fait qui le débloque : les légendaires de l'ombre se gagnent en jouant mal. */
  ton: 'eclat' | 'ombre'
}

export const LEGENDAIRES: Legendaire[] = [
  {
    key: 'lg:phenix',
    nom: 'Le Phénix',
    legende: 'Il renaît quand on le croyait fini.',
    condition: { hautFait: 'hf:phenix', fois: 1 },
    ton: 'eclat',
  },
  {
    key: 'lg:dragon',
    nom: 'Le Dragon d’Or',
    legende: 'Trois quiz dans la même soirée : il garde son trésor.',
    condition: { hautFait: 'hf:triple', fois: 1 },
    ton: 'eclat',
  },
  {
    key: 'lg:oracle',
    nom: 'L’Oracle',
    legende: 'Il voit le chiffre avant qu’on le dise.',
    condition: { hautFait: 'hf:oracle', fois: 1 },
    ton: 'eclat',
  },
  {
    key: 'lg:chouette',
    nom: 'La Chouette d’Argent',
    legende: 'Pas une erreur de tout le quiz.',
    condition: { hautFait: 'hf:grand-chelem', fois: 1 },
    ton: 'eclat',
  },
  {
    key: 'lg:tigre',
    nom: 'Le Tigre Foudre',
    legende: 'Le plus rapide, trois fois dans le même quiz.',
    condition: { hautFait: 'hf:foudre', fois: 1 },
    ton: 'eclat',
  },
  {
    key: 'lg:licorne',
    nom: 'La Licorne Astrale',
    legende: 'Seul contre tous, et trois fois raison.',
    condition: { hautFait: 'hf:seul-contre-tous', fois: 3 },
    ton: 'eclat',
  },
  {
    key: 'lg:lion',
    nom: 'Le Lion Couronné',
    legende: 'Premier d’une soirée d’au moins huit joueurs.',
    condition: { hautFait: 'hf:roi', fois: 1 },
    ton: 'eclat',
  },
  {
    key: 'lg:renard',
    nom: 'Le Renard Lunaire',
    legende: 'Dix soirées : il connaît la maison.',
    condition: { hautFait: 'hf:habitue', palier: 2 },
    ton: 'eclat',
  },
  {
    key: 'lg:comete',
    nom: 'La Comète',
    legende: 'Cent fois parmi les plus rapides.',
    condition: { hautFait: 'hf:reflexe', palier: 2 },
    ton: 'eclat',
  },
  {
    key: 'lg:kraken',
    nom: 'Le Kraken',
    legende: 'Trois lanternes rouges : il remonte des abysses.',
    condition: { hautFait: 'hf:lanterne-rouge', fois: 3 },
    ton: 'ombre',
  },
  {
    key: 'lg:fantome',
    nom: 'Le Fantôme',
    legende: 'Il passe, il repasse, il ne répond pas.',
    condition: { hautFait: 'hf:somnambule', fois: 2 },
    ton: 'ombre',
  },
  {
    key: 'lg:trou-noir',
    nom: 'Le Trou Noir',
    legende: 'Trois estimations perdues dans l’espace.',
    condition: { hautFait: 'hf:cosmique', fois: 3 },
    ton: 'ombre',
  },
]

const PAR_CLE = new Map(LEGENDAIRES.map(l => [l.key, l]))

export function legendaire(key: unknown): Legendaire | undefined {
  return typeof key === 'string' ? PAR_CLE.get(key) : undefined
}

/**
 * Où en est un profil sur un légendaire : combien il a, combien il faut.
 * `recompenses` compte ses hauts faits rangés — une clé par haut fait de
 * soirée (le nombre de soirées où il l'a décroché), une par palier atteint.
 */
export function progresVers(l: Legendaire, recompenses: ReadonlyMap<string, number>): { acquis: number; requis: number } {
  const c = l.condition
  if ('fois' in c) return { acquis: Math.min(c.fois, recompenses.get(c.hautFait) ?? 0), requis: c.fois }
  let atteint = 0
  for (let p = 1; p <= 3; p++) if ((recompenses.get(clePalier(c.hautFait, p)) ?? 0) > 0) atteint = p
  return { acquis: Math.min(c.palier, atteint), requis: c.palier }
}

/** Les légendaires qu'un profil a débloqués. */
export function legendairesDebloques(recompenses: ReadonlyMap<string, number>): string[] {
  return LEGENDAIRES.filter(l => {
    const { acquis, requis } = progresVers(l, recompenses)
    return acquis >= requis
  }).map(l => l.key)
}
