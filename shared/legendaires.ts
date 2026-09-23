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
//
// Un légendaire se mérite sur la durée. Tombés d'un seul haut fait, la
// plupart se gagnaient dès la première soirée : au format de la maison — deux
// quiz de cinquante questions, une douzaine de joueurs —, le plus rapide
// avait sa Foudre à chaque quiz, le premier son Lion au premier soir. Les
// seuils sont donc calés pour qu'il faille environ vingt quiz au premier de
// la bande qui le décroche, les autres mettant plus longtemps
// (`server/scripts/calibrage.ts` le mesure, sur le vrai code des hauts
// faits). Le Renard y était déjà, avec ses dix soirées ; le Phénix, la
// Chouette, la Licorne et le Kraken demandaient déjà davantage, et le Dragon
// ne se gagne qu'une soirée de trois quiz au moins. Ceux-là n'ont pas bougé.
// Ce qui était gagné avant reste gagné : voir `legendairesDebloques`.

import { clePalier } from './hautsfaits'

/**
 * Ce qui débloque un légendaire : un haut fait de soirée décroché `fois`
 * fois — autant de soirées, puisqu'il ne tombe qu'une fois par soirée —, ou
 * un palier de carrière atteint.
 */
export type Condition = { hautFait: string; fois: number } | { hautFait: string; palier: number }

export interface Legendaire {
  key: string
  nom: string
  /** Une ligne, pour la galerie : ce qu'il raconte. */
  legende: string
  condition: Condition
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
    condition: { hautFait: 'hf:oracle', fois: 8 },
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
    legende: 'Le plus rapide, soir après soir.',
    condition: { hautFait: 'hf:foudre', fois: 10 },
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
    legende: 'Huit fois premier d’une soirée d’au moins huit joueurs.',
    condition: { hautFait: 'hf:roi', fois: 8 },
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
    legende: 'Quatre cents fois parmi les plus rapides.',
    condition: { hautFait: 'hf:reflexe', palier: 3 },
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
    condition: { hautFait: 'hf:somnambule', fois: 6 },
    ton: 'ombre',
  },
  {
    key: 'lg:trou-noir',
    nom: 'Le Trou Noir',
    legende: 'Sept estimations perdues dans l’espace.',
    condition: { hautFait: 'hf:cosmique', fois: 7 },
    ton: 'ombre',
  },
]

const PAR_CLE = new Map(LEGENDAIRES.map(l => [l.key, l]))

export function legendaire(key: unknown): Legendaire | undefined {
  return typeof key === 'string' ? PAR_CLE.get(key) : undefined
}

/**
 * Où en est un profil sur une condition : combien il a, combien il faut.
 * `recompenses` compte ses hauts faits rangés — une clé par haut fait de
 * soirée (le nombre de soirées où il l'a décroché), une par palier atteint.
 */
function progresSur(c: Condition, recompenses: ReadonlyMap<string, number>): { acquis: number; requis: number } {
  if ('fois' in c) return { acquis: Math.min(c.fois, recompenses.get(c.hautFait) ?? 0), requis: c.fois }
  let atteint = 0
  for (let p = 1; p <= 3; p++) if ((recompenses.get(clePalier(c.hautFait, p)) ?? 0) > 0) atteint = p
  return { acquis: Math.min(c.palier, atteint), requis: c.palier }
}

/** Où en est un profil sur un légendaire, avec la règle du jour. */
export function progresVers(l: Legendaire, recompenses: ReadonlyMap<string, number>): { acquis: number; requis: number } {
  return progresSur(l.condition, recompenses)
}

/** Cette condition est-elle remplie ? */
export function conditionTenue(c: Condition, recompenses: ReadonlyMap<string, number>): boolean {
  const { acquis, requis } = progresSur(c, recompenses)
  return acquis >= requis
}

/**
 * Ce qui éclate quand l'Éclat tombe sur un profil : le légendaire qu'il
 * porte, s'il en porte un — il prend sa version rare —, son emoji sinon.
 * Un Divin n'éclate jamais : sous un Divin, c'est l'emoji qui éclate. Le
 * serveur tire l'Éclat sur cette cible, et chaque écran demande si c'est
 * elle qui brille.
 */
export function cibleEclat(porte: string | null | undefined, emoji: string): string {
  return porte && legendaire(porte) ? porte : emoji
}

/**
 * Les légendaires qu'un profil a débloqués : ceux dont il remplit la règle
 * du jour, et ceux qu'il avait gagnés avant qu'elle se durcisse.
 *
 * `acquis` retient, pour chacun de ceux-là, la règle sous laquelle il
 * l'avait : il le garde tant qu'elle tient. Durcir un seuil ne reprend donc
 * rien à personne — mais une soirée retirée de l'historique (essai effacé,
 * soirée supprimée) emporte encore ce qu'elle avait fait tomber, comme avant.
 */
export function legendairesDebloques(
  recompenses: ReadonlyMap<string, number>,
  acquis?: ReadonlyMap<string, Condition>,
): string[] {
  return LEGENDAIRES.filter(l => {
    if (conditionTenue(l.condition, recompenses)) return true
    const avant = acquis?.get(l.key)
    return !!avant && conditionTenue(avant, recompenses)
  }).map(l => l.key)
}
