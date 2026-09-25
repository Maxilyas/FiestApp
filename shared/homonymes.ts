// Les prénoms tels qu'on les affiche quand plusieurs invités se ressemblent.
//
// Pur et partagé : la soirée en cours et une soirée archivée passent par la
// même fonction, donc ce qu'on améliore ici profite aussi aux souvenirs déjà
// rangés. Rien de ce fichier ne touche à une base.

/** Un prénom comparable : sans casse, sans accents, sans espaces en trop. */
export function sansAccent(texte: string): string {
  return texte.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** Le minimum pour distinguer une ligne d'écran d'une autre. */
export interface Homonymable {
  id: string
  name: string
  avatar: string
}

/**
 * Les prénoms à afficher, pour les seuls invités qu'un homonyme rend ambigus.
 *
 * À cinquante invités, deux Camille sont une certitude — et on ne peut ni
 * refuser la seconde (un profil serait refoulé à cause du prénom d'un autre)
 * ni la renommer d'office. Alors on ne touche à rien : le prénom n'a pas
 * besoin d'être unique, c'est la **ligne projetée** qui doit être lisible, et
 * une ligne, c'est un avatar autant qu'un prénom. Deux Camille sur deux
 * animaux différents ne gênent donc personne.
 *
 * Seule la paire (prénom, avatar) partagée pose vraiment problème : là, le
 * premier arrivé garde son prénom nu et les suivants reçoivent « (2) »,
 * « (3) ». Rien n'est écrit en base : la marque disparaît d'elle-même quand
 * l'homonyme s'en va, ou quand l'animateur renomme.
 *
 * L'ordre d'entrée doit être celui de l'arrivée — la marque reste ainsi
 * stable quand un troisième homonyme se présente.
 */
export function nomsAffiches(joueurs: readonly Homonymable[]): Map<string, string> {
  const rangs = new Map<string, number>()
  const marques = new Map<string, string>()
  for (const joueur of joueurs) {
    // Le caractère nul sépare les deux parts : sans lui, « ab » + « c » et
    // « a » + « bc » feraient la même clé.
    const cle = `${sansAccent(joueur.name)}\u0000${joueur.avatar}`
    const rang = (rangs.get(cle) ?? 0) + 1
    rangs.set(cle, rang)
    // La table ne porte que ce qui change : le premier n'y est pas, et
    // l'immense majorité des soirées la rendent vide.
    if (rang > 1) marques.set(joueur.id, `${joueur.name} (${rang})`)
  }
  return marques
}

/**
 * Le prénom à écrire : la marque d'homonymie quand il y en a une, le prénom
 * nu sinon.
 *
 * Les dérivations (souvenir, bilan, statistiques) recopient les prénoms dans
 * leurs propres lignes : elles passent par ici, sans quoi le mur annoncerait
 * « Camille » là où le classement affiche « Camille (2) ».
 */
export function nomAffiche(joueur: { name: string; nomAffiche?: string }): string {
  return joueur.nomAffiche ?? joueur.name
}

/**
 * Le prénom affiché en deux parts : ce qui peut se couper, et la marque qui
 * ne se coupe jamais.
 *
 * Une pastille étroite coupait « Camille (2) » en « Camil… » : la marque
 * partait la première, et c'est la seule chose qui distingue deux invités
 * identiques. Couper le prénom seul garde « Cam… (2) » lisible là où
 * l'animateur fait les équipes.
 */
export function partsDuNom(joueur: { name: string; nomAffiche?: string }): { prenom: string; marque: string } {
  const affiche = nomAffiche(joueur)
  if (affiche !== joueur.name && affiche.startsWith(joueur.name)) {
    return { prenom: joueur.name, marque: affiche.slice(joueur.name.length) }
  }
  return { prenom: affiche, marque: '' }
}
