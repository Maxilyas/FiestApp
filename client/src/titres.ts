import type { AccountPage } from './routes'

/**
 * Le titre de l'onglet des pages d'animateur, avant que la page ne pose le
 * sien. Cinq pages s'appelaient toutes « FiestApp » : dans la liste des
 * onglets, ou au lecteur d'écran qui annonce la page, rien ne distinguait
 * « Mes quiz » de « Mon compte ». L'écran commun et le profil le remplacent
 * ensuite par le nom de la soirée ou du joueur.
 */
// Les mots de la page elle-même : « Espace animateur » au-dessus de la
// connexion, « Activer mon compte » sur le bouton de l'activation, « Mon
// compte » dans la console et la navigation.
const TITRES: Record<AccountPage, string> = {
  host: 'Écran commun',
  edit: 'Mes quiz',
  connexion: 'Espace animateur',
  activer: 'Activer mon compte',
  compte: 'Mon compte',
  admin: 'Les comptes',
  profil: 'Mon profil',
  jour: 'Le quiz du jour',
}

export function titreDePage(page: AccountPage): string {
  return `${TITRES[page]} · FiestApp`
}
