// La plaque de nom : la part d'un thème que les autres voient, aux
// classements (`shared/plaques.ts`). Deux pièces, sans catalogue ni état : les
// classes que la ligne prend, et son emblème. Les classements les importent,
// le quiz du jour compris — rien ici ne tire `shared/themes.ts` : la clé seule
// choisit la règle de la feuille (`.plaque-<clé>`, `styles.css`).
//
// Depuis le 18 novembre 2026 (la maquette posée sur le vrai classement de la
// production, `retours/2026-11-18/plaques/`), deux formes : partout, le
// paraphe — la ligne de tous, un trait de plume sous le prénom et son
// emblème — ; au podium, la vitrine — la ligne entière à ses couleurs. Dix
// plaques entières sur les dix premières du mois faisaient une mosaïque.

/**
 * Les places du podium, où la plaque se montre entière — ex æquo compris : un
 * rang se lit par `shared/classement.ts`, tous ceux qui partagent le troisième
 * sont troisièmes (invariant 15). Un choix de produit (`baremes.md`).
 */
export const PLACES_EN_VITRINE = 3

/** Sa plaque se montre entière : il est sur le podium. */
export function enVitrine(rang: number | undefined): boolean {
  return rang !== undefined && rang >= 1 && rang <= PLACES_EN_VITRINE
}

/**
 * Les classes qu'une plaque ajoute à sa ligne — rien sans plaque ; `vitrine`
 * au podium, quand la ligne dit son rang. La clé vient du serveur ; elle
 * n'entre dans une classe que si elle a la forme d'une clé de thème : une
 * feuille d'un client d'avant qui ne la connaît pas laisse la ligne telle
 * qu'elle est.
 */
export function classeDeLaPlaque(plaque: string | null | undefined, rang?: number): string {
  if (!plaque || !/^[a-z]+$/.test(plaque)) return ''
  return ` plaque plaque-${plaque}` + (enVitrine(rang) ? ' vitrine' : '')
}

/**
 * L'emblème d'une plaque, une pièce de la ligne juste après le prénom : il
 * cède avant lui, et pousse la suite au bout de la ligne. Jamais un fond sous
 * le texte — les fêlures du Kintsugi passaient sous les lignes et les
 * rendaient illisibles (le retour du 10 novembre 2026).
 */
export function EmblemeDeLaPlaque({ plaque }: { plaque: string | null | undefined }) {
  return classeDeLaPlaque(plaque) ? <span className="plaque-embleme" aria-hidden="true" /> : null
}
