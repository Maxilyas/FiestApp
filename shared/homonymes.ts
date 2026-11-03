// Les prénoms tels qu'on les affiche quand plusieurs invités se ressemblent.
//
// Pur et partagé : la soirée en cours et une soirée archivée passent par la
// même fonction, donc ce qu'on améliore ici profite aussi aux souvenirs déjà
// rangés. Rien de ce fichier ne touche à une base.

/** Un prénom comparable : sans casse, sans accents, sans espaces en trop. */
export function sansAccent(texte: string): string {
  return texte.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/**
 * Les prénoms déjà rendus comparables, pour les marques : une soirée les
 * refait sur toute la salle à chaque arrivée, et la normalisation de chaque
 * prénom en faisait l'essentiel — 66 ms sur les 1,25 s de processeur d'une
 * salle de 300 arrivée d'un coup (le banc du 3 novembre 2026). Des prénoms
 * seulement : `sansAccent` lit aussi les intitulés de la campagne, qu'un
 * cache garderait par milliers.
 */
const prenomsComparables = new Map<string, string>()
const PRENOMS_GARDES = 2_000

function prenomComparable(prenom: string): string {
  let comparable = prenomsComparables.get(prenom)
  if (comparable === undefined) {
    if (prenomsComparables.size >= PRENOMS_GARDES) prenomsComparables.clear()
    comparable = sansAccent(prenom)
    prenomsComparables.set(prenom, comparable)
  }
  return comparable
}

/** Le minimum pour distinguer une ligne d'écran d'une autre. */
export interface Homonymable {
  id: string
  name: string
  avatar: string
  /**
   * Le dessin qu'il porte à la place de l'emoji — légendaire, Divin,
   * portrait, compagnon —, s'il en porte un : c'est lui que la ligne montre.
   */
  legendaire?: string | null
}

/**
 * Ce que la ligne d'un joueur montre, tel que les marques le comparent : le
 * dessin qu'il porte, sinon son emoji. Ni la finition, ni l'Éclat, ni la
 * bordure : trop discrets au fond de la salle pour distinguer deux lignes,
 * et ils bougent avec la progression — la marque changerait de tête en
 * pleine soirée.
 */
export function visageDe(joueur: Pick<Homonymable, 'avatar' | 'legendaire'>): string {
  return joueur.legendaire || joueur.avatar
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
 * L'avatar comparé est celui qu'on voit (`visageDe`) : deux Camille sous le
 * même Phénix se ressemblent, quels que soient leurs emojis d'en dessous —
 * comparés seuls, ils les laissaient identiques sur le vidéoprojecteur, et
 * marquaient celle qu'un légendaire distinguait déjà.
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
    const cle = `${prenomComparable(joueur.name)}\u0000${visageDe(joueur)}`
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

/**
 * La même coupe, pour un prénom déjà marqué : les lignes d'un podium ou d'un
 * classement le reçoivent d'un bloc (`ViewContext.playerName`), sans le
 * prénom nu à côté. La marque se reconnaît à sa forme — celle que
 * `nomsAffiches` écrit, « (2) » et au-delà. Un prénom qui s'écrit vraiment
 * « Jo (2) » se coupe de même : sa fin reste visible, rien de plus.
 */
export function partsDuNomAffiche(affiche: string): { prenom: string; marque: string } {
  const m = /^(.*\S)( \((?:[2-9]|[1-9]\d+)\))$/su.exec(affiche)
  return m ? { prenom: m[1], marque: m[2] } : { prenom: affiche, marque: '' }
}
