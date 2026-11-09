import type { AccountPage } from './routes'

/**
 * Le nom de la page des collectionneurs, partout où il se lit : l'onglet, sa
 * tête, son gros bouton sur « Mon profil ». « Les collectionneurs » d'abord,
 * puis « Classement des collections » (le propriétaire, le 9 novembre 2026 :
 * « quelque chose qui fait plus penser à “Classement des collections” ») —
 * sur deux lignes au gros bouton, en 360 de large, coupé net après
 * « Classement ». L'adresse reste `/collectionneurs`.
 */
export const TITRE_DES_COLLECTIONNEURS = 'Classement des collections'

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
  admin: 'Le QG',
  profil: 'Mon profil',
  jour: 'Le quiz du jour',
  salon: 'Nouveau salon',
  tele: 'La télé',
  boutique: 'La boutique',
  campagne: 'La campagne',
  duels: 'Les duels',
  expedition: 'L’Expédition',
  cabinet: 'Le Cabinet de curiosités',
  collectionneurs: TITRE_DES_COLLECTIONNEURS,
}

export function titreDePage(page: AccountPage): string {
  return `${TITRES[page]} · FiestApp`
}
