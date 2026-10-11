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
