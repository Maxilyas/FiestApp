// Les adresses d'une soirée close, telles qu'on les envoie à ses invités.
//
// Léa (pour le groupe de la coloc) et Marc (pour la lettre de l'agence)
// cherchaient quel lien envoyer, et `/<espace>/souvenir`, le plus simple à
// trouver, changera de soirée dès que la suivante jouera. Ces adresses-là
// sont celles de l'archive : elles ne changent jamais. Rien n'y est exposé
// qui ne soit déjà public — le bilan de chacun l'est déjà, par son lien.

/** Les pages d'une soirée close, à leur adresse d'archive. */
export interface LiensDeSoiree {
  souvenir: string
  bilan: string
  fiches: string
  /** L'historique de l'espace : la liste, pas la soirée. */
  historique: string
}

/** `origine` : `https://fiestapp.example` — sans barre finale. */
export function liensDeSoiree(origine: string, slug: string, soireeId: string): LiensDeSoiree {
  const soiree = `${origine}/${slug}/soirees/${encodeURIComponent(soireeId)}`
  return {
    souvenir: `${soiree}/souvenir`,
    bilan: `${soiree}/bilan`,
    fiches: `${soiree}/bilan/fiches`,
    historique: `${origine}/${slug}/soirees`,
  }
}

/** Le bilan de chaque invité, ouvert sur lui (`#p=…`), dans l'ordre donné. */
export function liensDesBilans(
  origine: string,
  slug: string,
  soireeId: string,
  joueurs: { id: string; nom: string }[],
): { nom: string; url: string }[] {
  const bilan = liensDeSoiree(origine, slug, soireeId).bilan
  return joueurs.map(j => ({ nom: j.nom, url: `${bilan}#p=${encodeURIComponent(j.id)}` }))
}

/** « Camille : https://… », une ligne par invité : ce qu'on colle dans un groupe de messagerie. */
export function texteDesLiens(liens: { nom: string; url: string }[]): string {
  return liens.map(l => `${l.nom} : ${l.url}`).join('\n')
}
