// La plaque de nom : la ligne d'un joueur dans un classement, aux couleurs
// d'un thème qu'il possède (`shared/plaques.ts`, la maquette validée le
// 10 novembre 2026). Deux pièces, sans catalogue ni état : la classe que la
// ligne prend, et son motif. Les classements les importent, le quiz du jour
// compris — rien ici ne tire `shared/themes.ts` : la clé seule choisit la
// règle de la feuille (`.plaque-<clé>`, `styles.css`).

/**
 * Les classes qu'une plaque ajoute à sa ligne — rien sans plaque. La clé
 * vient du serveur ; elle n'entre dans une classe que si elle a la forme
 * d'une clé de thème : une feuille d'un client d'avant qui ne la connaît
 * pas laisse la ligne telle qu'elle est.
 */
export function classeDeLaPlaque(plaque: string | null | undefined): string {
  return plaque && /^[a-z]+$/.test(plaque) ? ` plaque plaque-${plaque}` : ''
}

/**
 * Le motif d'une plaque, une pièce de la ligne entre le prénom et ce qui le
 * suit : il prend la place qui reste, et un prénom long le réduit à rien.
 * Jamais un fond sous le texte — les fêlures du Kintsugi passaient sous les
 * lignes et les rendaient illisibles (le retour du 10 novembre 2026).
 */
export function MotifDeLaPlaque({ plaque }: { plaque: string | null | undefined }) {
  return classeDeLaPlaque(plaque) ? <span className="plaque-motif" aria-hidden="true" /> : null
}
