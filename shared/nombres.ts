/**
 * Un nombre tapé par un humain, lu comme on l'écrit en France.
 *
 * Trois lecteurs le lisaient chacun à sa façon. L'import de l'éditeur savait
 * « 10 935 » ; le téléphone faisait `Number(texte.replace(',', '.'))`, et
 * « 35 000 », tel que la révélation l'affiche, valait NaN — le formulaire se
 * taisait, l'invité croyait avoir répondu ; le champ « Bonne réponse » de
 * l'éditeur relisait son texte en nombre à chaque touche, et la virgule de
 * « 0,8 » disparaissait : la cible devenait 8, sans un mot. Une seule
 * lecture, désormais, pour les trois.
 */

/**
 * Virgule décimale (le point passe aussi), milliers séparés par une espace —
 * simple, insécable, ou fine, celle que les traitements de texte glissent
 * d'office — ou par une apostrophe à la suisse, et signe moins typographique
 * « − », qu'ils substituent au tiret. Le premier lecteur de l'import
 * s'arrêtait au premier groupe de chiffres : « = 10 935 mètres » visait 10,
 * avec « 935 mètres » pour unité, et la révélation affichait « 10 935
 * mètres » — l'air juste — en classant tout le monde sur son écart à 10.
 */
const NOMBRE = /^([+\-−]?)(\d{1,3}(?:[   '’]\d{3})+|\d+)(?:[.,](\d+))?\s*(.*)$/u

/**
 * Ce qui suit le nombre repart sur un chiffre : « 10 93 », « 1,000,000 ».
 * On ne sait pas lire ; on ne devine pas.
 */
const SUITE_AMBIGUE = /^[.,'’]?\d/

/** Le nombre en tête d'un texte, et ce qui le suit ; null s'il ne se lit pas sans ambiguïté. */
export function lireNombreEnTete(texte: string): { valeur: number; reste: string } | null {
  const m = NOMBRE.exec(texte)
  if (!m) return null
  const [, signe, entier, decimales, reste] = m
  if (SUITE_AMBIGUE.test(reste)) return null
  const negatif = signe === '-' || signe === '−'
  const valeur = Number(`${negatif ? '-' : ''}${entier.replace(/\D/g, '')}${decimales ? `.${decimales}` : ''}`)
  return Number.isFinite(valeur) ? { valeur, reste } : null
}

/**
 * Un texte qui n'est qu'un nombre — l'estimation d'un invité, la cible d'un
 * animateur —, ou null. Les blancs se replient : une espace fine glissée par
 * un clavier, deux espaces tapées de suite. Une virgule finale attend sa
 * décimale : « 0, » vaut 0 le temps qu'on tape le 8.
 */
export function lireNombre(texte: string): number | null {
  const net = texte.replace(/\s+/g, ' ').trim().replace(/[.,]$/, '')
  const lu = lireNombreEnTete(net)
  return lu && lu.reste === '' ? lu.valeur : null
}

/** Un entier dans ses bornes : l'arrondi d'abord, les bornes ensuite. */
export function entierBorne(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)))
}

/**
 * Ce que devient un champ d'entier borné (`ChampNombre`) quand on le quitte :
 * le texte lu, arrondi et borné — ou, vide ou illisible, la valeur qu'il
 * avait quand on y est entré. Le champ émet chaque valeur lisible tapée :
 * vider « 20 » passait par « 2 », et quitter le champ vide gardait ce « 2 »
 * émis en route, sans le borner — « Enregistrer » envoyait 2 s.
 */
export function valeurEnQuittant(texte: string, valeurAuFocus: number, min: number, max: number): number {
  return entierBorne(lireNombre(texte) ?? valeurAuFocus, min, max)
}
