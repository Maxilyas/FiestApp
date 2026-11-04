// L'écran où un profil est né (le lot 6 du QG 2, le 4 novembre 2026 : « d'où
// viennent les profils », la proposition du 3, `retours/2026-11-03/le-qg.md`).
// La page le dit au serveur à l'inscription (`POST /api/joueur/inscription`,
// `origine`), le serveur le garde dans la colonne `origine` de `profiles`, et la
// page des joueurs du QG les compte (`shared/qgJoueurs.ts`). Un nom d'écran,
// rien de plus : ni l'adresse, ni l'espace, ni qui l'a invité.
//
// Sans import : l'entrée d'une soirée le lit, et chaque invité la télécharge.

/**
 * Les écrans où un profil naît : l'entrée d'une soirée (« Garder ma
 * progression »), la soirée elle-même entre deux quiz, la fin de soirée
 * (« Créer mon profil », vers l'accueil), l'accueil, et les pages qui demandent
 * un profil — le quiz du jour, la campagne, les duels, le Cabinet, le salon à
 * ouvrir, un compte d'animateur d'avant (`?next=`). Un écran de plus prend sa
 * ligne ici et son nom au QG (`NOM_DE_L_ORIGINE`).
 */
export const ORIGINES_D_UN_PROFIL = ['entree', 'soiree', 'fin-de-soiree', 'accueil', 'jour', 'campagne', 'duels', 'cabinet', 'salon', 'compte'] as const
export type OrigineDUnProfil = (typeof ORIGINES_D_UN_PROFIL)[number]

/**
 * Un profil né d'une page qui ne le disait pas encore — un téléphone qui garde
 * l'ancienne page en mémoire, un script : le serveur ne devine pas. Un profil
 * d'avant la colonne, lui, n'a rien (NULL) : « d'avant le 4 novembre 2026 ».
 */
export const ORIGINE_INCONNUE = 'inconnue'
export type OrigineLue = OrigineDUnProfil | typeof ORIGINE_INCONNUE

/** L'origine telle que le serveur la garde : un écran connu, sinon `inconnue` — jamais une valeur que le client invente. */
export function lireLOrigine(brut: unknown): OrigineLue {
  return (ORIGINES_D_UN_PROFIL as readonly unknown[]).includes(brut) ? (brut as OrigineDUnProfil) : ORIGINE_INCONNUE
}

/**
 * L'origine d'un profil né sur l'accueil : la page d'où l'on venait, qui l'y a
 * envoyé créer son profil (`?next=/jour`, lu par `pageDeRetour`) ; sinon la fin
 * d'une soirée, dont le lien préremplit le prénom (`?creer=1&prenom=…`) ; sinon
 * l'accueil lui-même.
 */
export function origineDeLAccueil(suite: string, depuisUneFin: boolean): OrigineDUnProfil {
  const chemin = suite.split(/[?#]/)[0]
  const sous = (page: string) => chemin === page || chemin.startsWith(`${page}/`)
  if (sous('/jour')) return 'jour'
  if (sous('/duels')) return 'duels'
  // L'Expédition, partie de la campagne, y renvoyait aussi.
  if (sous('/campagne') || sous('/expedition')) return 'campagne'
  if (sous('/cabinet')) return 'cabinet'
  if (sous('/salon')) return 'salon'
  if (sous('/compte')) return 'compte'
  return depuisUneFin ? 'fin-de-soiree' : 'accueil'
}
