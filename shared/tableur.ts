/**
 * Ce qui part du QG vers un tableur : le CSV qu'on télécharge (`toCsv`,
 * `server/src/core/export.ts`) et le tableau qu'on copie (« Copier », la revue
 * d'expert du 4 novembre 2026, P2.10 — le principe 3 de la proposition du
 * QG 2, dans sa maquette, nulle part dans l'application). Une seule règle de
 * ce qu'un tableur prend pour une formule.
 */

/**
 * Ce par quoi Excel reconnaît une formule. Un invité prénommé
 * « =HYPERLINK(…) » glissait un lien piégé dans le tableau de l'animateur,
 * qui l'ouvre en confiance : c'est lui qui l'a exporté.
 */
export const FORMULE = /^[=+\-@\t\r]/

/** Un nombre tel qu'un tableur français le lit : « -3 », « 12345 », « 0,8 ». */
const NOMBRE = /^-?\d+(?:,\d+)?$/

/**
 * Une cellule copiée d'un tableau de la page : ses espaces resserrés — ni
 * tabulation ni retour, qui casseraient sa ligne —, un nombre écrit à la
 * française (« 12 345 », « −3 ») rendu au tableur qui le lit comme un nombre,
 * et tout le reste qui commence comme une formule précédé d'une apostrophe :
 * il reste du texte. Un nombre ne se désamorce pas : −40 n'est pas une formule.
 */
export function celluleDeTableur(texte: string): string {
  const s = texte.replace(/\s+/g, ' ').trim()
  const nombre = s.replace(/^[−-]/, '-').replace(/(\d) (?=\d{3}(?!\d))/g, '$1')
  if (NOMBRE.test(nombre)) return nombre
  return FORMULE.test(s) ? `'${s}` : s
}

/**
 * Des lignes de cellules en texte tabulé, ce qu'un tableur colle en colonnes
 * — Excel, LibreOffice, Google Sheets, Numbers —, quand un CSV collé tient
 * dans la première.
 */
export function texteTabule(lignes: readonly (readonly string[])[]): string {
  return lignes.map(l => l.map(celluleDeTableur).join('\t')).join('\n') + '\n'
}
