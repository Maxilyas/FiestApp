// La carte d'un joueur : ce qu'on voit en touchant son nom.
//
// Les avatars, les finitions et les badges n'avaient qu'un public, leur
// porteur : personne ne pouvait regarder le profil de quelqu'un d'autre. La
// carte le montre à la salle — son niveau, ses légendaires, ses plus beaux
// hauts faits, sa collection de prix, quelques chiffres —, à côté de ce qu'il
// fait ce soir.
//
// Un invité anonyme a sa carte aussi : sa soirée, et rien qui dise ce qui lui
// manque. Un surnom donné par l'animateur ne touche pas au profil : la carte
// dit les deux, le nom du soir et le prénom du profil.

import type { BadgePorte } from './badges'
import type { Distinctions, Fiche } from './profil'

export interface CarteDeJoueur extends Distinctions {
  /** Le nom qu'il porte ce soir, marque d'homonymie comprise. */
  nom: string
  avatar: string
  ceSoir: {
    points: number
    /** Rang partagé dans la soirée, 0 tant qu'il n'a rien marqué. */
    rang: number
    /** Joueurs qui ont répondu ce soir, pour dire « 3ᵉ sur 12 ». */
    joueurs: number
    /** Toutes ses réponses, QCM et estimations. */
    reponses: number
    /**
     * Les QCM auxquels il a répondu, et ses bonnes réponses : « 1/2 justes ».
     * Une estimation n'est jamais juste — comptée avec les QCM, elle faisait
     * lire « 1/64 justes » à qui en avait joué soixante-deux.
     */
    qcm: number
    justes: number
    /**
     * Les estimations qu'il a proposées, comptées à part, et leur coup d'œil :
     * la part de la salle qu'elles battent ou égalent, null sans estimation
     * mesurée à une autre.
     */
    estimations: number
    coupDOeil: number | null
  }
  /** Son profil, s'il en a un. */
  profil?: {
    /** Le prénom de son profil — il diffère du nom du soir quand l'animateur lui a donné un surnom. */
    prenom: string
    niveau: number
    legendaires: string[]
    /** Les Divins descendus sur lui — sans un mot de ce qui les a fait descendre. */
    divins: string[]
    /**
     * Ses plus beaux hauts faits, trois au plus : exploits et paliers de
     * carrière, les plus rares à décrocher d'abord (`plusBeaux`,
     * `shared/hautsfaits.ts`). Le nom vient d'avant, quand elle rangeait six
     * prix et hauts faits : une page ouverte avant le lit encore.
     */
    vitrine: BadgePorte[]
    /** Combien de hauts faits différents il a décrochés. */
    hautsFaits: number
    /** Le titre qu'il porte sous son prénom : la clé d'un haut fait (`hf:oracle`). Absent s'il n'en porte pas. */
    titre?: string
    /** Son quiz du jour, en une ligne : les jours joués, les victoires. Absent s'il n'y a jamais joué. */
    jour?: { joues: number; victoires: number }
    /**
     * Les prix du palmarès : ils tombent à chaque soirée, et six fois
     * L'Éclair ne disait rien à la salle. C'est la collection qui se montre —
     * combien de prix différents, sur tous ceux qu'une personne peut
     * remporter. Absent d'un serveur d'avant.
     */
    prix?: { eus: number; total: number }
    /**
     * La précision avec sa base, le coup d'œil avec la sienne. La carte ne
     * montre plus la plus longue série, qui a cédé sa case au coup d'œil —
     * elle part encore pour les pages ouvertes avant, qui la lisent.
     */
    fiche: Pick<
      Fiche,
      | 'soirees'
      | 'precision'
      | 'qcm'
      | 'justes'
      | 'coupDOeil'
      | 'estimationsComparees'
      | 'reflexeMoyenMs'
      | 'quizGagnes'
      | 'meilleureSerie'
    >
  }
}
