// Ce que la soirée annonce : au podium de chaque quiz, et à sa clôture.
//
// Le téléphone ne savait jamais que la soirée était finie : il restait sur
// « En attente du prochain quiz… », et les niveaux gagnés n'étaient qu'un
// toast sur l'écran de leur porteur. Ces messages-là font voir la soirée à
// ceux qui l'ont jouée — et aux autres, sur l'écran commun.

import type { Distinctions, Finition } from './profil'
import type { Ton } from './hautsfaits'
import type { DivinDescendu } from './divins'
import type { PartySnapshot } from './types'
import type { ConfettisDeLaFin } from './themes'

/** Un haut fait tel qu'on l'annonce. */
export interface HautFaitAnnonce {
  key: string
  emoji: string
  title: string
  ton: Ton
}

/** Un prix du palmarès, tel que la fin de soirée le rappelle à son lauréat. */
export interface PrixAnnonce {
  key: string
  emoji: string
  title: string
  /** Le chiffre qui le justifie (« 2,4 s de moyenne »). */
  detail: string
}

/**
 * Un record personnel battu ce soir : sa plus longue série de bonnes
 * réponses, ses bonnes réponses d'une soirée, sa précision sur une soirée de
 * vingt QCM au moins (`server/src/core/objectifs.ts`).
 */
export interface RecordBattu {
  key: 'serie' | 'justes' | 'precision'
  /** Ce soir, et le record d'avant — une précision en part : 0,82. */
  valeur: number
  avant: number
  /** Une précision : sur combien de QCM, ce soir. */
  sur?: number
}

/**
 * Un objectif qui a avancé ce soir, et dont il approche : un avatar
 * légendaire (`lg:…`) ou le prochain palier d'un haut fait de carrière
 * (`hf:bavard:2`). Ce qu'on compte se lit dans le catalogue : des fois pour
 * un haut fait de soirée, la mesure du haut fait pour un palier.
 */
export interface Approche {
  key: string
  acquis: number
  requis: number
  /** Ce que la soirée y a ajouté. */
  ceSoir: number
}

/** Où relire la soirée close : son historique, dans l'espace. */
export interface SoireeClose {
  id: string
  titre: string
  slug: string
}

/**
 * Ce qu'un téléphone apprend à la clôture : sa soirée, en une page.
 *
 * Un invité anonyme la reçoit aussi — son rang, ses points, ses hauts faits
 * du soir. Seul le bloc `profil` lui manque : l'absence, pas l'infériorité.
 */
export interface FinDeSoiree extends Distinctions {
  soiree: SoireeClose
  /**
   * Son identifiant de joueur dans l'archive : « Mon bilan » s'ouvre sur lui
   * (`#p=…`) au lieu de demander « Qui es-tu ? ». Il est déjà public dans le
   * bilan. Absent d'un serveur d'avant.
   */
  joueurId?: string
  nom: string
  avatar: string
  rang: number
  points: number
  /** Joueurs qui ont répondu ce soir-là — lui compris ou non. */
  joueurs: number
  /**
   * A-t-il répondu au moins une fois ? Le rang seul ne le dit pas : il vaut 0
   * à 0 point, et Bob, deux réponses fausses, lisait « Tu n'as pas joué ce
   * soir » au-dessus de « Le Cancre Magnifique ». Absent d'un serveur d'avant.
   */
  aJoue?: boolean
  /**
   * Il animait, hors classement (« J'anime seulement ») : rien de lui ne
   * comptait, et sa fin lui disait « Tu n'as pas joué ce soir », comme à un
   * retardataire (la remarque du propriétaire du 3 octobre 2026). Absent d'un
   * serveur d'avant, et de qui jouait.
   */
  anime?: true
  /**
   * Les prix du palmarès qu'il remporte (« L'Éclair ») : Jeanne cherchait le
   * sien sur sa fin de soirée. Absent d'un serveur d'avant.
   */
  prix?: PrixAnnonce[]
  /** Ce qu'il a fait de remarquable ce soir. */
  hautsFaits: HautFaitAnnonce[]
  /** Ce que la soirée rapporte à son profil, s'il en a un. */
  profil?: {
    /** L'expérience de la soirée entière, paliers compris. */
    xp: number
    /**
     * La part des paliers de carrière dans `xp`. « Mes soirées » ne compte
     * que le reste — les paliers ont leur ligne à part —, et la fin doit dire
     * les deux : elle annonçait +24 quand la liste en montrait 4. Absent
     * d'une fin d'avant : zéro.
     */
    xpPaliers?: number
    niveauAvant: number
    niveauApres: number
    /** Les paliers de carrière tombés ce soir (« Le Bavard · Argent »). */
    paliers: HautFaitAnnonce[]
    /** Les avatars légendaires débloqués ce soir. */
    legendaires: string[]
    /** Les Divins descendus ce soir — presque toujours aucun —, avec leur récit. */
    divins: DivinDescendu[]
    /**
     * Les portraits des branches que ses bonnes réponses de ce soir ont
     * ouverts (`shared/branches.ts`) — presque chaque soirée en ouvre un.
     * Absent d'une fin d'avant, ou si aucun ne s'est ouvert.
     */
    portraits?: string[]
    /**
     * Ce qui a éclaté pour lui ce soir, s'il y en a un : un emoji, ou un
     * avatar dessiné (`lg:…`, `br:…`) qui prend sa version rare. Une chance
     * sur quarante — tombé en silence, il passait inaperçu.
     */
    eclat?: string
    /** Les finitions débloquées ce soir. */
    finitions: Finition[]
    /**
     * Ce qui se voit même quand rien ne tombe : ses records battus ce soir,
     * et deux objectifs au plus qui ont avancé et dont il approche. Entre la
     * quatrième et la dixième soirée, la fin ne disait presque rien d'autre
     * que l'expérience. Absents d'une fin d'avant.
     */
    records?: RecordBattu[]
    approches?: Approche[]
    /**
     * Sa collection de prix, s'il en a remporté un ce soir : ceux qui y
     * entrent pour la première fois, et combien il en a sur combien.
     */
    collection?: { nouveaux: string[]; eus: number; total: number }
    /**
     * Le quiz du jour, qu'elle ne mentionnait jamais : sa série, que la
     * soirée vient d'allonger, et s'il a déjà joué celui d'aujourd'hui.
     * Absent d'une fin d'avant, ou si la base du jour s'est tue.
     */
    jour?: { serie: number; aJoue: boolean }
    /**
     * Les confettis de ce soir — une bonne réponse, un confetti —, son solde
     * et le thème qu'il vise (`shared/themes.ts`). Absents d'une fin d'avant,
     * ou d'une soirée qui n'en a rapporté aucun.
     */
    confettis?: ConfettisDeLaFin
  }
}

/** Une ligne d'annonce sur l'écran commun : qui, avec ce qu'il porte. */
export interface Figure extends Distinctions {
  nom: string
  avatar: string
}

/** Ce que l'écran commun annonce à la clôture. */
export interface ClotureDeSoiree {
  soiree: SoireeClose
  podium: (Figure & { points: number; rang: number })[]
  /**
   * L'équipe ou les équipes qui l'emportent, points d'équipe prix compris :
   * le verdict de l'historique, dit à la salle. Absent d'un serveur d'avant,
   * vide d'une soirée sans équipes.
   */
  equipes?: { nom: string; emoji: string; points: number }[]
  /** Les hauts faits de la soirée, invité par invité. */
  hautsFaits: (Figure & { faits: HautFaitAnnonce[] })[]
  /** Les avatars légendaires débloqués ce soir. */
  legendaires: (Figure & { gagne: string })[]
  /** Les Divins descendus ce soir : toute la salle doit le voir. */
  divins: (Figure & { gagne: string })[]
  /** Les Éclats de la soirée : l'emoji ou le légendaire qui a éclaté, pour qui. */
  eclats: (Figure & { eclate: string })[]
  /** Les montées de niveau de la soirée. */
  montees: (Figure & { avant: number; apres: number })[]
}

/** Au podium d'un quiz : ce que le téléphone vient de gagner. */
export interface GainAnnonce {
  xp: number
  niveauAvant: number
  niveauApres: number
  /** Les finitions débloquées par cette montée — portées d'office. */
  finitions: Finition[]
}

/** Au podium d'un quiz : les montées de niveau, pour l'écran commun. */
export interface ProgresDeQuiz {
  montees: (Figure & { avant: number; apres: number })[]
}

/**
 * La ligne sous le prénom, à la fin de soirée : son rang s'il en a un, sinon
 * ce qu'on sait de lui — joué pour rien, pas joué, ou rien du tout (une fin
 * d'un serveur d'avant, qui ne disait pas s'il avait joué).
 */
export type LigneDeRang =
  | { cas: 'rang'; rang: number; joueurs: number; points: number }
  | { cas: 'zero'; joueurs: number }
  | { cas: 'absent'; joueurs: number }
  | { cas: 'neutre'; joueurs: number }
  | { cas: 'anime'; joueurs: number }

export function ligneDeRang(fin: Pick<FinDeSoiree, 'rang' | 'points' | 'joueurs' | 'aJoue' | 'anime'>): LigneDeRang {
  if (fin.anime) return { cas: 'anime', joueurs: fin.joueurs }
  if (fin.rang > 0) return { cas: 'rang', rang: fin.rang, joueurs: fin.joueurs, points: fin.points }
  if (fin.aJoue === true) return { cas: 'zero', joueurs: fin.joueurs }
  if (fin.aJoue === false) return { cas: 'absent', joueurs: fin.joueurs }
  return { cas: 'neutre', joueurs: fin.joueurs }
}

/** « 3 joueurs », « 1 joueur ». */
export const nJoueurs = (n: number) => `${n} joueur${n > 1 ? 's' : ''}`

/**
 * La soirée suivante a-t-elle commencé dans l'espace ? Un invité s'y est
 * inscrit, ou un quiz s'y joue — ce qui, au serveur, rend la salle d'attente
 * aux écrans restés sur la clôture (`soireeCommence`). La fin de soirée ne
 * propose de la rejoindre qu'alors : son bouton, toujours là, menait à une
 * soirée qui n'existait pas encore, et c'était le seul geste pour la quitter.
 */
export function suivanteCommencee(salle: Pick<PartySnapshot, 'players' | 'session'> | null): boolean {
  return !!salle && (salle.players.length > 0 || !!salle.session)
}

// ── La fin gardée sur le téléphone ──────────────────────────────────────

/**
 * Ce que le téléphone range de sa fin de soirée : tout, sauf le récit d'un
 * Divin. Il reste au seul porteur, au moment où il descend (invariant 21) —
 * rangé dans le navigateur, il se relisait pendant des heures sur un
 * téléphone prêté.
 */
export function finAGarder(fin: FinDeSoiree): FinDeSoiree {
  if (!fin.profil) return fin
  return { ...fin, profil: { ...fin.profil, divins: fin.profil.divins.map(d => ({ key: d.key, ton: d.ton, legende: '' })) } }
}

/**
 * Le chargement de la page de l'espace est-il un retour — un rechargement,
 * le retour du navigateur depuis le bilan que la fin venait d'ouvrir — ou
 * une arrivée — un lien, le QR, une adresse tapée, « Jouer depuis cet
 * appareil » à la console ? Ce que le navigateur en dit (Navigation Timing :
 * `reload`, `back_forward`, `navigate`…), ou, d'un navigateur d'avant, son
 * ancien chiffre (1 : recharger, 2 : revenir). Muet, c'est une arrivée.
 *
 * Qui revient retrouve sa fin de soirée ; qui arrive vient jouer : elle ne
 * l'arrête plus, l'entrée la propose en une ligne. Rouverte à chaque
 * chargement, elle attendait l'animateur qui rouvrait la soirée sur son
 * téléphone depuis sa console, et ne partait que par « Rejoindre la soirée
 * suivante ».
 */
export function estUnRetour(chargement: string | number | undefined): boolean {
  return chargement === 'reload' || chargement === 'back_forward' || chargement === 1 || chargement === 2
}

const estObjet = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const textes = (o: Record<string, unknown>, ...cles: string[]) => cles.every(c => typeof o[c] === 'string')
const nombres = (o: Record<string, unknown>, ...cles: string[]) => cles.every(c => typeof o[c] === 'number')
const optionnel = (x: unknown, type: 'string' | 'boolean') => x === undefined || typeof x === type
const listeDe = (x: unknown, lisible: (e: unknown) => boolean) => Array.isArray(x) && x.every(lisible)

/** Une soirée close lisible : de quoi en faire des liens. */
export function soireeCloseLisible(x: unknown): x is SoireeClose {
  return estObjet(x) && textes(x, 'id', 'titre', 'slug')
}

/**
 * Une fin de soirée gardée, relue avant qu'on la rouvre. Une fin rangée par
 * une autre version de la page (un déploiement dans les douze heures) avait
 * une autre forme, et la page restait sur « Oups » jusqu'à ce qu'elle
 * expire : ce qu'on ne sait pas lire ne se rouvre pas. Tout ce que
 * `FinDeSoiree` lit sans le vérifier y passe.
 */
export function finLisible(x: unknown): x is FinDeSoiree {
  if (!estObjet(x) || !soireeCloseLisible(x.soiree)) return false
  if (!textes(x, 'nom', 'avatar') || !nombres(x, 'rang', 'points', 'joueurs')) return false
  if (!optionnel(x.joueurId, 'string') || !optionnel(x.aJoue, 'boolean') || !(x.anime === undefined || x.anime === true)) return false
  const annonce = (e: unknown) => estObjet(e) && textes(e, 'key', 'emoji', 'title')
  if (!listeDe(x.hautsFaits, e => annonce(e) && textes(e as Record<string, unknown>, 'ton'))) return false
  if (x.prix !== undefined && !listeDe(x.prix, e => annonce(e) && textes(e as Record<string, unknown>, 'detail'))) {
    return false
  }
  if (x.profil === undefined) return true
  const p = x.profil
  return (
    estObjet(p) &&
    nombres(p, 'xp', 'niveauAvant', 'niveauApres') &&
    listeDe(p.paliers, e => annonce(e) && textes(e as Record<string, unknown>, 'ton')) &&
    listeDe(p.legendaires, e => typeof e === 'string') &&
    listeDe(p.divins, e => estObjet(e) && textes(e, 'key', 'ton')) &&
    (p.portraits === undefined || listeDe(p.portraits, e => typeof e === 'string')) &&
    listeDe(p.finitions, e => typeof e === 'string') &&
    optionnel(p.eclat, 'string') &&
    (p.records === undefined || listeDe(p.records, e => estObjet(e) && textes(e, 'key') && nombres(e, 'valeur', 'avant'))) &&
    (p.approches === undefined || listeDe(p.approches, e => estObjet(e) && textes(e, 'key') && nombres(e, 'acquis', 'requis', 'ceSoir'))) &&
    (p.collection === undefined ||
      (estObjet(p.collection) && nombres(p.collection, 'eus', 'total') && listeDe(p.collection.nouveaux, e => typeof e === 'string'))) &&
    (p.jour === undefined || (estObjet(p.jour) && nombres(p.jour, 'serie') && typeof p.jour.aJoue === 'boolean'))
  )
}
