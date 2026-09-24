// La console de l'animateur : ce qui règle ses gestes, sans React, pour que
// le serveur, la page et les tests lisent les mêmes chiffres.

/**
 * L'enchaînement automatique : au clic, ou la question suivante 5, 10 ou 20 s
 * après la révélation. Cinq secondes, le temps de lire la bonne réponse, pour
 * le quiz qu'on enchaîne sans le commenter ; dix et vingt, celui de faire
 * rire la salle ; au-delà, on reprend la main — trente secondes ont cédé
 * leur bouton à cinq.
 *
 * Cinq secondes avaient disparu après la première animatrice, qui avait vu la
 * question suivante partir pendant qu'elle parlait : il fallait faire tourner
 * un bouton unique pour revenir au clic, et son clic était arrivé trop tard.
 * « Au clic » est maintenant à l'écran, à un seul geste qui n'attend pas.
 *
 * Un réglage d'animation, pas un barème : il ne touche aucun point.
 */
export const PALIERS_ENCHAINEMENT: readonly (number | null)[] = [null, 5, 10, 20]

/**
 * Le plus long enchaînement que le serveur accepte : jamais moins que le
 * dernier palier, qu'il raccourcirait. Trente secondes, comme depuis le
 * premier enchaînement : une console ouverte avant la mise à jour propose
 * encore l'ancien dernier palier.
 */
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
