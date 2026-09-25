/**
 * Deux objets aux mêmes champs, comparés un à un, sans descendre plus bas.
 *
 * L'instantané arrive neuf à chaque message : chaque joueur y est un objet
 * neuf, même quand rien n'a changé pour lui. Comparés par identité, une
 * arrivée redessinait les deux listes de la salle entière ; comparés champ à
 * champ, seule la ligne qui a changé se redessine.
 */
export function memesChamps<T extends object>(a: T, b: T): boolean {
  if (a === b) return true
  const ka = Object.keys(a) as (keyof T)[]
  if (ka.length !== Object.keys(b).length) return false
  return ka.every(k => a[k] === b[k])
}

/**
 * Les props d'une puce de la salle d'attente, avant et après un instantané :
 * vrai quand rien de ce qu'elle montre n'a changé. De ses équipes, elle ne lit
 * que l'identifiant, le nom et l'emoji (son menu « Changer d'équipe ») :
 * comparées champ à champ, elles différaient à chaque instantané —
 * l'effectif, le total, la moyenne et les prix bougent à chaque arrivée —, et
 * toutes les puces se redessinaient dès qu'il y avait des équipes.
 */
export function memesPuces<P extends object>(
  a: { p: P; teams: readonly { id: string; name: string; emoji: string }[] },
  b: { p: P; teams: readonly { id: string; name: string; emoji: string }[] },
): boolean {
  return (
    memesChamps(a.p, b.p) &&
    (a.teams === b.teams ||
      (a.teams.length === b.teams.length &&
        a.teams.every((t, i) => t.id === b.teams[i].id && t.name === b.teams[i].name && t.emoji === b.teams[i].emoji)))
  )
}
