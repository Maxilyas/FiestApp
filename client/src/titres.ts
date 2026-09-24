import type { AccountPage } from './routes'

/**
 * Le titre de l'onglet des pages d'animateur, avant que la page ne pose le
 * sien. Cinq pages s'appelaient toutes « FiestApp » : dans la liste des
 * onglets, ou au lecteur d'écran qui annonce la page, rien ne distinguait
 * « Mes quiz » de « Mon compte ». L'écran commun et le profil le remplacent
 * ensuite par le nom de la soirée ou du joueur.
 */
const TITRES: Record<AccountPage, string> = {
  host: 'Écran commun',
  edit: 'Mes quiz',
  connexion: 'Connexion',
  activer: 'Activer mon espace',
  compte: 'Mon compte',
  admin: 'Les comptes',
  profil: 'Mon profil',
}

export function titreDePage(page: AccountPage): string {
  return `${TITRES[page]} · FiestApp`
}
