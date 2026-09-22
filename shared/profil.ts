// Le profil d'un joueur récurrent : son niveau, ses finitions d'avatar, le
// barème d'expérience d'une soirée.
//
// Les badges, eux, vivent dans `shared/badges.ts`.
//
// Tout ce qui est ici est pur et partagé : le serveur calcule, le client
// affiche, et le test de bout en bout vérifie la courbe sans lancer de
// serveur. Rien de ce fichier ne touche à une base.
//
// ── La règle qui gouverne tout ────────────────────────────────────────────
//
// Un profil ne donne JAMAIS un avantage de jeu : pas de point bonus, pas de
// temps en plus, pas de question plus facile. La moitié d'une salle sera
// toujours anonyme, et une soirée où les inscrits marquent plus n'est plus
// une soirée. Un profil donne de l'expérience, un niveau, des finitions et
// une mémoire — du prestige et de la durée, jamais de la performance.

import type { BadgePorte } from './badges'

// ── Niveaux ───────────────────────────────────────────────────────────────

/**
 * Le pas de la courbe de niveau. Plus il est petit, plus on monte vite.
 *
 * À 12, une soirée ordinaire (trois quiz, une trentaine de questions, environ
 * 115 points d'expérience) fait passer deux ou trois niveaux au début, puis le
 * rythme se calme : niveau 5 en deux soirées, niveau 10 en huit, niveau 20 en
 * une trentaine. Les premiers niveaux tombent dans la soirée même — c'est ce
 * qui donne envie de revenir — et le niveau 20 reste une légende du cercle.
 */
export const XP_PAR_PALIER = 12

/** Le niveau que vaut cette expérience. Le premier niveau est 1, jamais 0. */
export function niveauPour(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / XP_PAR_PALIER)) + 1
}

/** L'expérience totale qu'il faut avoir atteint pour ce niveau. */
export function xpDuNiveau(niveau: number): number {
  return Math.max(0, niveau - 1) ** 2 * XP_PAR_PALIER
}

/** Où en est la barre : ce qui est acquis dans le niveau courant, et ce qu'il y faut. */
export function progression(xp: number): { niveau: number; acquis: number; requis: number } {
  const niveau = niveauPour(xp)
  const bas = xpDuNiveau(niveau)
  return { niveau, acquis: Math.max(0, xp) - bas, requis: xpDuNiveau(niveau + 1) - bas }
}

// ── Finitions d'avatar ────────────────────────────────────────────────────
//
// L'emoji ne change jamais : Alice reste le renard. Ce qui change, c'est sa
// finition. Aucun nouvel objet à dessiner, ça tient à l'échelle du
// vidéoprojecteur, et l'identité visuelle de chacun est préservée.

export const FINITIONS = ['mat', 'argent', 'or', 'holo', 'prisme'] as const
export type Finition = (typeof FINITIONS)[number]

/** Le niveau à partir duquel chaque finition se choisit. */
export const NIVEAU_FINITION: Record<Finition, number> = {
  mat: 1,
  argent: 3,
  or: 6,
  holo: 10,
  prisme: 15,
}

/** Comment on annonce une finition à celui qui vient de la débloquer. */
export const NOM_FINITION: Record<Finition, string> = {
  mat: 'Mat',
  argent: 'Argent',
  or: 'Or',
  holo: 'Holo',
  prisme: 'Prisme',
}

/** Celles qu'on peut porter à ce niveau. Rester en Mat au niveau 15 se remarque aussi. */
export function finitionsOuvertes(niveau: number): Finition[] {
  return FINITIONS.filter(f => niveau >= NIVEAU_FINITION[f])
}

/** Borne ce qui arrive du navigateur : une finition qu'on n'a pas vaut « mat ». */
export function finitionValide(raw: unknown, niveau: number): Finition {
  const trouvee = FINITIONS.find(f => f === raw)
  return trouvee && niveau >= NIVEAU_FINITION[trouvee] ? trouvee : 'mat'
}

// ── L'Éclat ───────────────────────────────────────────────────────────────

/**
 * Une chance sur autant, par soirée jouée, qu'un des avatars d'un profil
 * « s'éclate » — définitivement, et pour cet emoji-là seulement.
 *
 * Les finitions se gagnent au temps ; l'Éclat, non. On ne peut ni l'acheter
 * ni l'accélérer, seulement venir jouer. C'est ce qui en fait un avatar
 * vraiment unique : ton renard brille, celui du voisin non.
 */
export const CHANCE_ECLAT = 40

// ── Barème d'expérience ───────────────────────────────────────────────────
//
// L'expérience récompense d'abord d'être venu et d'avoir joué, la justesse
// seulement ensuite : sinon le niveau ne mesurerait que le niveau de culture
// générale, et les soirées entre amis n'ont pas ce goût-là.

export const XP = {
  /** Être venu. C'est la base, et c'est volontairement la plus grosse part. */
  presence: 50,
  /** Par question à laquelle on a répondu, juste ou non. */
  parReponse: 1,
  /** Par bonne réponse — un peu de mérite, pas trop. */
  parBonneReponse: 2,
  /** Podium de la soirée, toutes parties confondues. */
  podium: [60, 40, 25],
  /** Par quiz de la soirée remporté. */
  vainqueurDeQuiz: 15,
} as const

/** Le détail d'un gain de soirée — conservé tel quel, pour qu'on puisse l'expliquer. */
export interface GainSoiree {
  presence: number
  reponses: number
  justesse: number
  podium: number
  quiz: number
}

export function totalGain(g: GainSoiree): number {
  return g.presence + g.reponses + g.justesse + g.podium + g.quiz
}

/**
 * Le décompte brut d'une soirée, conservé à côté du gain.
 *
 * On pourrait le redéduire du gain en divisant par le barème — mais alors,
 * retoucher le barème un jour rendrait faux tout ce qui a été écrit avant.
 * Les chiffres bruts, eux, ne périment pas : ce sont eux que les badges de
 * carrière additionnent.
 */
export interface ReleveSoiree {
  reponses: number
  justes: number
  /** Son rang final sur la soirée ; 0 s'il n'a pas marqué. */
  rang: number
  /** Quiz de la soirée remportés. */
  quiz: number
}

/**
 * Ce qu'un profil ajoute à une ligne d'écran — classement, podium, pastille.
 *
 * Les trois champs sont facultatifs et restent ABSENTS pour un invité
 * anonyme : ni « Niv. 0 », ni pastille grise, ni finition neutre. Une salle
 * est toujours à moitié anonyme, et elle ne doit rien lire qui ressemble à un
 * rang inférieur. L'absence, pas l'infériorité.
 */
export interface Distinctions {
  niveau?: number
  finition?: Finition
  eclat?: boolean
}

/**
 * Recopie les distinctions d'un joueur sur une ligne d'affichage, en n'y
 * posant que ce qui existe — une ligne d'anonyme reste nue, et l'instantané
 * qui part à toute la salle n'en porte pas le poids.
 */
export function distinctions(source: Distinctions | undefined | null): Distinctions {
  if (!source) return {}
  return {
    ...(source.niveau !== undefined && { niveau: source.niveau }),
    ...(source.finition && { finition: source.finition }),
    ...(source.eclat && { eclat: true }),
  }
}

/**
 * Le profil tel que les écrans le voient. Jamais de haché, jamais de jeton.
 *
 * Volontairement léger : il voyage dans l'accusé de réception d'une
 * inscription à une soirée, donc à chaque téléphone qui arrive. L'étagère à
 * badges et l'historique, eux, ne partent que sur demande — voir
 * `PublicProfileDetail`.
 */
export interface PublicProfile {
  id: string
  login: string
  name: string
  avatar: string
  finition: Finition
  xp: number
  niveau: number
  /** Ce qui est acquis dans le niveau courant, et ce qu'il y faut. */
  acquis: number
  requis: number
  /** Les finitions qu'il peut porter. */
  ouvertes: Finition[]
  /** Les emojis qui ont éclaté pour lui. */
  eclats: string[]
  /** Combien de badges il porte — le détail se demande à part. */
  badges: number
}

/** Une soirée jouée, telle que la page profil la relit. */
export interface SoireeJouee {
  soireeId: string
  /** Le nom de l'espace où elle s'est jouée (« chez Bob »), quand on le retrouve. */
  chez: string | null
  xp: number
  gain: GainSoiree
  releve: ReleveSoiree
  at: number
}

/** Le profil au complet, pour sa propre page — et pour elle seule. */
export interface PublicProfileDetail extends PublicProfile {
  vitrine: BadgePorte[]
  soirees: SoireeJouee[]
}
