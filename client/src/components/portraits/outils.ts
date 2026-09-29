// La forme des portraits des branches (`shared/branches.ts`) pour
// `Portrait.tsx` : des images peintes, une par palier et par branche
// (`server/scripts/anime/portraits.ts`), que chaque module de branche cite —
// écrit par `server/scripts/anime/livrer.ts`, jamais à la main.

export interface DessinDePortrait {
  /**
   * Le disque, du centre (en haut) vers le bord : clair, moyen, sombre. Il
   * reçoit le visage du premier palier, qui n'a pas de décor, et tient la
   * place des autres le temps que leur image arrive.
   */
  fond: [string, string, string]
  image: ImageDePortrait
}

/**
 * Un portrait peint : des fichiers WebP servis sous `/portraits/`, chacun en
 * deux tailles — `[grande, petite]`, 512 et 256 pixels pour les 100 unités
 * du disque —, la petite pour les listes, la grande pour ce qu'on regarde.
 */
export interface ImageDePortrait {
  /**
   * L'illustration, le personnage dans son décor, sur le carré 0 → 100 que
   * le disque découpe. Absente au premier palier : le visage n'a pas de
   * décor, le disque teinté de la branche le reçoit.
   */
  disque?: [string, string]
  /**
   * Le personnage seul, détouré — sa forme fait la silhouette, et c'est lui
   * qui sort du disque aux deux derniers paliers —, dans son cadre.
   */
  perso: [string, string]
}
