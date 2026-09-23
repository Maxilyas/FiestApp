// La carte d'un joueur : ce qu'on voit en touchant son nom.
//
// Les avatars, les finitions et les badges n'avaient qu'un public, leur
// porteur : personne ne pouvait regarder le profil de quelqu'un d'autre. La
// carte le montre à la salle — son niveau, ses légendaires, ses prix les plus
// rares, quelques chiffres —, à côté de ce qu'il fait ce soir.
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
    reponses: number
    justes: number
  }
  /** Son profil, s'il en a un. */
  profil?: {
    /** Le prénom de son profil — il diffère du nom du soir quand l'animateur lui a donné un surnom. */
    prenom: string
    niveau: number
    legendaires: string[]
    /** Les Divins descendus sur lui — sans un mot de ce qui les a fait descendre. */
    divins: string[]
    /** Ses prix et hauts faits les plus rares, six au plus. */
    vitrine: BadgePorte[]
    /** Combien de hauts faits différents il a décrochés. */
    hautsFaits: number
    fiche: Pick<Fiche, 'soirees' | 'precision' | 'reflexeMoyenMs' | 'quizGagnes' | 'meilleureSerie'>
  }
}
