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

/** Deux listes aux mêmes éléments, dans le même ordre, comparés champ à champ. */
export function memesListes<T extends object>(a: readonly T[], b: readonly T[]): boolean {
  return a === b || (a.length === b.length && a.every((x, i) => memesChamps(x, b[i])))
}
