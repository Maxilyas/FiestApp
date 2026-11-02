// La pierre du niveau : au-delà du 25, plus aucune finition ne s'ouvrait, et
// les plus assidus, bientôt au niveau 30 en production, n'avaient plus rien
// qui dise leur avance (le souhait du propriétaire du 1er novembre 2026, de
// les récompenser). Dès le 30, la pastille de niveau — dans les classements,
// la salle d'attente, au mur de l'écran commun — et la gemme de sa carte
// prennent la pierre de leur dizaine.
//
// Les couleurs sont celles des raretés de l'album, que chacun a déjà
// appris à lire : bleue la rare, violette l'épique, ambrée la légendaire
// (`client/src/gemmes.ts`). Une convention, comme le rouge des messages :
// aucun thème ne la repeint (`pierres.test.ts`).
//
// Un fichier à lui, sans import : la soirée le télécharge avec sa pastille,
// pour chaque invité, l'anonyme compris.

/** Le niveau d'où chaque pierre se porte, du plus bas au plus haut. Un choix de produit (`docs/reference/baremes.md`). */
export const PIERRES_DU_NIVEAU = [
  { niveau: 30, pierre: 'saphir' },
  { niveau: 40, pierre: 'amethyste' },
  { niveau: 50, pierre: 'ambre' },
] as const

export type PierreDuNiveau = (typeof PIERRES_DU_NIVEAU)[number]['pierre']

/** Son nom dans une phrase : « Ta pastille de niveau se pare du saphir. » */
export const DE_LA_PIERRE: Readonly<Record<PierreDuNiveau, string>> = {
  saphir: 'du saphir',
  amethyste: 'de l’améthyste',
  ambre: 'de l’ambre',
}

/**
 * La pierre que porte ce niveau, ou rien en dessous du 30 — et rien pour un
 * invité anonyme, qui n'a pas de niveau (invariant 8 : l'absence, pas
 * l'infériorité).
 */
export function pierreDuNiveau(niveau: number | null | undefined): PierreDuNiveau | null {
  if (!niveau) return null
  let pierre: PierreDuNiveau | null = null
  for (const p of PIERRES_DU_NIVEAU) if (niveau >= p.niveau) pierre = p.pierre
  return pierre
}

/** La pierre qu'une montée de niveau vient d'ouvrir, s'il y en a une : la plus haute passée. */
export function pierreGagnee(avant: number | null | undefined, apres: number): PierreDuNiveau | null {
  const neuve = pierreDuNiveau(apres)
  return neuve && neuve !== pierreDuNiveau(avant) ? neuve : null
}
