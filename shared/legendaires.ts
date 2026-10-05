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
//
// Le Sphinx, treizième, se gagne au quiz du jour : l'assiduité plutôt que le
// génie — le podium du jour ira toujours aux deux ou trois mêmes. Il a deux
// voies, cent jours joués ou dix sans-faute, et l'une suffit.
//
// Les trois de saison — la Citrouille, le Sapin, le Bouquet final — ne se
// gagnent qu'à leur période (`shared/saisons.ts`) : des jours joués au quiz
// du jour, ou une soirée ces jours-là. Leur condition porte sur une
// récompense de saison (`saison:halloween`), rangée comme les autres.
//
// Depuis le 5 octobre 2026, le quiz du jour et la campagne ont les leurs —
// l'Aigle, l'Ouroboros, la Salamandre… —, et neuf légendaires de soirée y
// ont une seconde voie qui raconte la même histoire : la Chouette au
// sans-faute du jour, le Kraken à la lanterne du jour (`aussi`). Deux
// demandent les trois mondes à la fois, la Chimère et Janus (`toutes`).
// L'Arbre-Monde, qui veut les douze d'origine, en devient plus accessible :
// le propriétaire l'a accepté ce jour-là.

import { clePalier } from './hautsfaits'
import { portrait } from './branches'
import type { CleDeSaison } from './saisons'

/**
 * Ce qui débloque un légendaire : un haut fait qui se regagne, décroché
 * `fois` fois — autant de soirées, de jours ou de séries, puisqu'il ne tombe
 * qu'une fois par soirée, par jour ou par série —, un palier de carrière
 * atteint, ou plusieurs de ces conditions à la fois (`toutes`).
 */
export type Condition =
  | { hautFait: string; fois: number }
  | { hautFait: string; palier: number }
  | { toutes: readonly SimpleCondition[] }

/** Une condition sur un seul haut fait : de quoi composer `toutes`. */
export type SimpleCondition = Exclude<Condition, { toutes: unknown }>

export interface Legendaire {
  key: string
  nom: string
  /** Une ligne, pour la galerie : ce qu'il raconte. */
  legende: string
  condition: Condition
  /** D'autres voies : l'une ou l'autre le débloque. */
  aussi?: readonly Condition[]
  /** Le ton du haut fait qui le débloque : les légendaires de l'ombre se gagnent en jouant mal. */
  ton: 'eclat' | 'ombre'
  /** Un légendaire de saison : il ne se gagne qu'à sa période. */
  saison?: CleDeSaison
}

export const LEGENDAIRES: Legendaire[] = [
  {
    key: 'lg:phenix',
    nom: 'Le Phénix',
    legende: 'Il renaît quand on le croyait fini.',
    condition: { hautFait: 'hf:phenix', fois: 1 },
    aussi: [{ hautFait: 'hf:phenix-du-jour', fois: 1 }],
    ton: 'eclat',
  },
  {
    key: 'lg:dragon',
    nom: 'Le Dragon d’Or',
    legende: 'Trois quiz dans la même soirée : il garde son trésor.',
    condition: { hautFait: 'hf:triple', fois: 1 },
    aussi: [{ hautFait: 'hf:triomphe', fois: 1 }],
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
    aussi: [{ hautFait: 'hf:sans-faute', palier: 2 }],
    ton: 'eclat',
  },
  {
    key: 'lg:tigre',
    nom: 'Le Tigre Foudre',
    legende: 'Le plus rapide, soir après soir.',
    condition: { hautFait: 'hf:foudre', fois: 10 },
    aussi: [{ hautFait: 'hf:eclair-du-jour', fois: 10 }],
    ton: 'eclat',
  },
  {
    key: 'lg:licorne',
    nom: 'La Licorne Astrale',
    legende: 'Seul contre tous, et trois fois raison.',
    condition: { hautFait: 'hf:seul-contre-tous', fois: 3 },
    aussi: [{ hautFait: 'hf:seul-au-monde', fois: 3 }],
    ton: 'eclat',
  },
  {
    key: 'lg:lion',
    nom: 'Le Lion Couronné',
    legende: 'Huit fois premier d’une soirée d’au moins huit joueurs.',
    condition: { hautFait: 'hf:roi', fois: 8 },
    aussi: [{ hautFait: 'hf:champion-du-jour', palier: 3 }],
    ton: 'eclat',
  },
  {
    key: 'lg:renard',
    nom: 'Le Renard Lunaire',
    legende: 'Dix soirées : il connaît la maison.',
    condition: { hautFait: 'hf:habitue', palier: 2 },
    aussi: [{ hautFait: 'hf:assidu', palier: 2 }],
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
    aussi: [{ hautFait: 'hf:lanterne-du-jour', fois: 3 }],
    ton: 'ombre',
  },
  {
    key: 'lg:fantome',
    nom: 'Le Fantôme',
    legende: 'Il passe, il repasse, il ne répond pas.',
    condition: { hautFait: 'hf:somnambule', fois: 6 },
    aussi: [{ hautFait: 'hf:courant-d-air', fois: 6 }],
    ton: 'ombre',
  },
  {
    key: 'lg:trou-noir',
    nom: 'Le Trou Noir',
    legende: 'Sept estimations perdues dans l’espace.',
    condition: { hautFait: 'hf:cosmique', fois: 7 },
    ton: 'ombre',
  },
  {
    key: 'lg:sphinx',
    nom: 'Le Sphinx',
    legende: 'Cent jours de questions, ou dix sans une faute : il a tout vu.',
    condition: { hautFait: 'hf:assidu', palier: 3 },
    aussi: [{ hautFait: 'hf:sans-faute', palier: 3 }],
    ton: 'eclat',
  },
  {
    key: 'lg:citrouille',
    nom: 'La Citrouille',
    legende: 'Creusée une nuit d’Halloween, elle n’a jamais laissé s’éteindre sa bougie.',
    condition: { hautFait: 'saison:halloween', fois: 1 },
    ton: 'eclat',
    saison: 'halloween',
  },
  {
    key: 'lg:sapin',
    nom: 'Le Sapin',
    legende: 'Il a vu passer tous les Noëls, et garde une boule pour chacun.',
    condition: { hautFait: 'saison:noel', fois: 1 },
    ton: 'eclat',
    saison: 'noel',
  },
  {
    key: 'lg:bouquet',
    nom: 'Le Bouquet final',
    legende: 'Minuit sonne, la ville lève les yeux : c’est pour lui que le ciel s’allume.',
    condition: { hautFait: 'saison:nouvel-an', fois: 1 },
    ton: 'eclat',
    saison: 'nouvel-an',
  },
  // ── Le quiz du jour ──
  {
    key: 'lg:aigle',
    nom: 'L’Aigle aux lauriers',
    legende: 'Trente fois couronné au quiz du jour : le laurier lui a donné des ailes.',
    condition: { hautFait: 'hf:laurier', fois: 30 },
    ton: 'eclat',
  },
  {
    key: 'lg:ouroboros',
    nom: 'L’Ouroboros',
    legende: 'Cent jours d’affilée : le cercle ne s’est jamais brisé.',
    condition: { hautFait: 'hf:infatigable', palier: 3 },
    ton: 'eclat',
  },
  {
    key: 'lg:scarabee',
    nom: 'Le Scarabée solaire',
    legende: 'Chaque matin d’un mois entier, il a poussé le soleil.',
    condition: { hautFait: 'hf:mois-complet', fois: 1 },
    ton: 'eclat',
  },
  {
    key: 'lg:coq',
    nom: 'Le Coq de l’aube',
    legende: 'Vingt fois debout avant tout le monde, le quiz déjà joué.',
    condition: { hautFait: 'hf:leve-tot', fois: 20 },
    ton: 'eclat',
  },
  {
    key: 'lg:chauve-souris',
    nom: 'La Chauve-souris',
    legende: 'Dix fois au dernier métro : elle ne joue qu’à minuit moins le quart.',
    condition: { hautFait: 'hf:dernier-metro', fois: 10 },
    ton: 'ombre',
  },
  // ── La campagne ──
  {
    key: 'lg:salamandre',
    nom: 'La Salamandre',
    legende: 'Une seule vie, et neuf bonnes réponses dans le feu.',
    condition: { hautFait: 'hf:funambule', fois: 1 },
    ton: 'eclat',
  },
  {
    key: 'lg:elephant',
    nom: 'L’Éléphant',
    legende: 'Deux mille bonnes réponses en campagne : une mémoire d’éléphant.',
    condition: { hautFait: 'hf:marathonien', palier: 3 },
    ton: 'eclat',
  },
  {
    key: 'lg:serpent',
    nom: 'Le Serpent à plumes',
    legende: 'Trente marches d’une seule série : il a gravi la pyramide.',
    condition: { hautFait: 'hf:grande-serie', fois: 1 },
    ton: 'eclat',
  },
  // ── Les trois mondes ──
  {
    key: 'lg:chimere',
    nom: 'La Chimère',
    legende: 'Lion en soirée, chèvre au quiz du jour, serpent en campagne : les trois à la fois.',
    condition: {
      toutes: [
        { hautFait: 'hf:podium', palier: 1 },
        { hautFait: 'hf:champion-du-jour', palier: 1 },
        { hautFait: 'hf:alpiniste', palier: 3 },
      ],
    },
    ton: 'eclat',
  },
  {
    key: 'lg:janus',
    nom: 'Janus',
    legende: 'Trois fois roi d’une soirée, trois fois vainqueur du jour : deux visages, une couronne.',
    condition: {
      toutes: [
        { hautFait: 'hf:roi', fois: 3 },
        { hautFait: 'hf:laurier', fois: 3 },
      ],
    },
    ton: 'eclat',
  },
]

const PAR_CLE = new Map(LEGENDAIRES.map(l => [l.key, l]))

export function legendaire(key: unknown): Legendaire | undefined {
  return typeof key === 'string' ? PAR_CLE.get(key) : undefined
}

/** Toutes les voies d'un légendaire, la première d'abord. */
export function voiesDe(l: Legendaire): readonly Condition[] {
  return l.aussi ? [l.condition, ...l.aussi] : [l.condition]
}

/** Le haut fait de sa première voie, si elle n'en demande qu'un : ce qu'une ligne en dit d'un mot. Null pour la Chimère. */
export function hautFaitPrincipal(l: Legendaire): string | null {
  return 'toutes' in l.condition ? null : l.condition.hautFait
}

/** Les conditions simples d'une voie : elle-même, ou chacune de celles qu'elle demande à la fois. */
export function partiesDe(c: Condition): readonly SimpleCondition[] {
  return 'toutes' in c ? c.toutes : [c]
}

/**
 * Où en est un profil sur une condition : combien il a, combien il faut.
 * `recompenses` compte ses hauts faits rangés — une clé par haut fait qui se
 * regagne (le nombre de soirées, de jours ou de séries où il l'a décroché),
 * une par palier atteint. Une condition qui en demande plusieurs compte
 * celles qui sont tenues : « 2 sur 3 ».
 */
export function progresSur(c: Condition, recompenses: ReadonlyMap<string, number>): { acquis: number; requis: number } {
  if ('toutes' in c) {
    return { acquis: c.toutes.filter(p => conditionTenue(p, recompenses)).length, requis: c.toutes.length }
  }
  if ('fois' in c) return { acquis: Math.min(c.fois, recompenses.get(c.hautFait) ?? 0), requis: c.fois }
  let atteint = 0
  for (let p = 1; p <= 3; p++) if ((recompenses.get(clePalier(c.hautFait, p)) ?? 0) > 0) atteint = p
  return { acquis: Math.min(c.palier, atteint), requis: c.palier }
}

/**
 * Où en est un profil sur un légendaire, avec la règle du jour — sur la
 * plus avancée de ses voies, s'il en a plusieurs.
 */
export function progresVers(l: Legendaire, recompenses: ReadonlyMap<string, number>): { acquis: number; requis: number } {
  return voieLaPlusAvancee(l, recompenses).progres
}

/** Sa voie la plus avancée vers ce légendaire, et où il en est : la première, à égalité. */
export function voieLaPlusAvancee(
  l: Legendaire,
  recompenses: ReadonlyMap<string, number>,
): { voie: Condition; progres: { acquis: number; requis: number } } {
  let meilleure = { voie: l.condition, progres: progresSur(l.condition, recompenses) }
  for (const voie of l.aussi ?? []) {
    const progres = progresSur(voie, recompenses)
    if (progres.acquis / progres.requis > meilleure.progres.acquis / meilleure.progres.requis) meilleure = { voie, progres }
  }
  return meilleure
}

/** Cette condition est-elle remplie ? */
export function conditionTenue(c: Condition, recompenses: ReadonlyMap<string, number>): boolean {
  if ('toutes' in c) return c.toutes.every(p => conditionTenue(p, recompenses))
  const { acquis, requis } = progresSur(c, recompenses)
  return acquis >= requis
}

/**
 * Les légendaires que ces récompenses, tout juste tombées, viennent
 * d'ouvrir : ceux qu'il a, et qu'il n'aurait pas sans elles. Le Sphinx, au
 * centième jour ou au dixième sans-faute — mais pas une seconde fois quand
 * l'autre voie l'avait déjà ouvert. La page du quiz du jour et la fin d'une
 * série le fêtent, comme la fin de soirée les siens. Une clé tombée compte
 * pour une fois : le dixième Éclair du jour ouvre le Tigre, pas le neuvième.
 */
export function legendairesOuvertsPar(
  tombes: readonly string[],
  recompenses: ReadonlyMap<string, number>,
  acquis?: ReadonlyMap<string, Condition>,
): string[] {
  if (tombes.length === 0) return []
  const avant = new Map(recompenses)
  for (const cle of tombes) {
    const n = (avant.get(cle) ?? 0) - 1
    if (n > 0) avant.set(cle, n)
    else avant.delete(cle)
  }
  const deja = new Set(legendairesDebloques(avant, acquis))
  return legendairesDebloques(recompenses, acquis).filter(cle => !deja.has(cle))
}

/**
 * Ce qui éclate quand l'Éclat tombe sur un profil : le légendaire ou le
 * portrait d'une branche qu'il porte, s'il en porte un — il prend sa version
 * rare —, son emoji sinon. Un Divin n'éclate jamais : sous un Divin, c'est
 * l'emoji qui éclate. Le serveur tire l'Éclat sur cette cible, et chaque
 * écran demande si c'est elle qui brille.
 */
export function cibleEclat(porte: string | null | undefined, emoji: string): string {
  return porte && (legendaire(porte) || portrait(porte)) ? porte : emoji
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
    if (voiesDe(l).some(v => conditionTenue(v, recompenses))) return true
    const avant = acquis?.get(l.key)
    return !!avant && conditionTenue(avant, recompenses)
  }).map(l => l.key)
}
