// Les adresses des duels (`/duels`, `shared/duels.ts`) : leur page, un défi
// entre amis par son lien, sa préparation. À part et sans rien importer : la
// campagne, qui en joue les parties, les écrit sans faire venir le code des
// duels (`Duels.tsx`, chargé à la demande).

/** La page des duels : sa cote, sa ligue, le classement, ses défis entre amis. */
export const PAGE_DES_DUELS = '/duels'

/** Un défi entre amis, dans la page des duels : son lien (`#duel-K7M2QX`). */
export const adresseDuDuel = (code: string) => `#duel-${code}`

/** Là où l'on prépare un défi entre amis (`LancerUnDefi`, chargé à la demande). */
export const ADRESSE_DU_LANCEMENT = '#defier'

/**
 * Sa préparation contre quelqu'un (`#defier-<id>`) : « Défier » sur la carte
 * d'un joueur y mène, d'où qu'elle s'ouvre — l'accueil, le quiz du jour, un
 * défi —, et un rechargement garde celui qu'on défie.
 */
export const adresseDuLancementContre = (profileId: string) => `${ADRESSE_DU_LANCEMENT}-${encodeURIComponent(profileId)}`

/** L'adresse prépare-t-elle un duel — contre quelqu'un ou non ? */
export const estLeLancement = (hash: string) => hash === ADRESSE_DU_LANCEMENT || hash.startsWith(`${ADRESSE_DU_LANCEMENT}-`)

/** Celui que l'adresse défie (`#defier-<id>`), ou null. */
export function profilDuLancement(hash: string): string | null {
  if (!hash.startsWith(`${ADRESSE_DU_LANCEMENT}-`)) return null
  try {
    return decodeURIComponent(hash.slice(ADRESSE_DU_LANCEMENT.length + 1)) || null
  } catch {
    // Un fragment mal formé ne défie personne : la préparation s'ouvre libre.
    return null
  }
}
