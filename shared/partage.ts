// Partager un quiz (rapport du 25 septembre 2026, lot 6) : ce que le
// navigateur et le serveur disent pareil — le code et le catalogue.

/** Les caractères d'un code : sans 0 ni O, sans 1, I ni L — ce qu'on confond en le dictant. */
export const ALPHABET_DU_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const LONGUEUR_DU_CODE = 6

/** « K7X2QF » s'écrit « K7X-2QF » : deux groupes de trois, lus d'une traite. */
export function ecrireCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`
}

/**
 * Le code tel qu'on l'a tapé ou collé — minuscules, tiret, espaces, un lien
 * entier —, ou null s'il ne peut pas en être un. Un O tapé pour un 0 ne se
 * corrige pas : aucun des deux n'existe, le code ne les emploie jamais.
 */
export function lireCode(saisie: string): string | null {
  const dans = /recevoir=([^&#\s]+)/i.exec(saisie)?.[1] ?? saisie
  const code = dans.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== LONGUEUR_DU_CODE) return null
  return [...code].every(c => ALPHABET_DU_CODE.includes(c)) ? code : null
}

/** Où en est une copie proposée au catalogue du serveur. */
export type StatutAuCatalogue = 'propose' | 'publie' | 'refuse' | 'retire'

export const STATUTS_AU_CATALOGUE: readonly StatutAuCatalogue[] = ['propose', 'publie', 'refuse', 'retire']

/** Une copie au catalogue, sans ses questions : ce que les listes montrent. */
export interface EntreeDuCatalogue {
  id: string
  titre: string
  /** La phrase de l'auteur : à quoi il sert. */
  description: string
  /** Le nom de l'espace qui l'a proposé — « de Nadia » —, rien de plus. */
  auteur: string
  questionCount: number
  statut: StatutAuCatalogue
  updatedAt: number
}
