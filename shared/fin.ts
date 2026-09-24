// Ce que la soirée annonce : au podium de chaque quiz, et à sa clôture.
//
// Le téléphone ne savait jamais que la soirée était finie : il restait sur
// « En attente du prochain quiz… », et les niveaux gagnés n'étaient qu'un
// toast sur l'écran de leur porteur. Ces messages-là font voir la soirée à
// ceux qui l'ont jouée — et aux autres, sur l'écran commun.

import type { Distinctions, Finition } from './profil'
import type { Ton } from './hautsfaits'
import type { DivinDescendu } from './divins'

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
    niveauAvant: number
    niveauApres: number
    /** Les paliers de carrière tombés ce soir (« Le Bavard · Argent »). */
    paliers: HautFaitAnnonce[]
    /** Les avatars légendaires débloqués ce soir. */
    legendaires: string[]
    /** Les Divins descendus ce soir — presque toujours aucun —, avec leur récit. */
    divins: DivinDescendu[]
    /**
     * Ce qui a éclaté pour lui ce soir, s'il y en a un : un emoji, ou un
     * légendaire (`lg:…`) qui prend sa version rare. Une chance sur quarante —
     * tombé en silence, il passait inaperçu.
     */
    eclat?: string
    /** Les finitions débloquées ce soir. */
    finitions: Finition[]
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
