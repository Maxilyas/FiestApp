// La console de l'animateur : ce qui règle ses gestes, sans React, pour que
// le serveur, la page et les tests lisent les mêmes chiffres.

/**
 * L'enchaînement automatique : au clic, ou la question suivante après 10, 20
 * ou 30 s. Cinq et dix secondes ne laissaient pas le temps de commenter une
 * révélation — la première animatrice a vu partir la question suivante
 * pendant qu'elle parlait, et son clic pour reprendre la main est arrivé
 * trop tard. Un réglage d'animation, pas un barème : il ne touche aucun point.
 */
export const PALIERS_ENCHAINEMENT: readonly (number | null)[] = [null, 10, 20, 30]

/** Le plus long enchaînement que le serveur accepte : le dernier palier, pas moins. */
export const ENCHAINEMENT_MAX_S = 30

/**
 * Après un changement de phase, la console ignore les gestes pendant une
 * demi-seconde. Les boutons changent de rôle sous le curseur : un double-clic
 * sur « Révéler » tombait sur « Question suivante » et écourtait la
 * révélation. La visée des commandes (invariant 12) n'y peut rien — le
 * second clic vise bien l'écran qu'il a sous les yeux. Même chose pour une
 * télécommande de présentation qui envoie Entrée deux fois.
 */
export const GARDE_APRES_PHASE_MS = 500

/**
 * Un geste compte-t-il ? `changement` est l'instant du dernier changement de
 * phase, `maintenant` celui du geste, sur la même horloge locale — la
 * demi-seconde se mesure sur la page, pas au serveur.
 */
export function gesteAccepte(changement: number | null, maintenant: number): boolean {
  return changement === null || maintenant - changement >= GARDE_APRES_PHASE_MS
}
