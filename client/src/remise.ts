/**
 * L'identifiant d'une remise de prix : ce que le serveur reconnaît pour ne la
 * faire qu'une fois (`host:awardTeam`).
 *
 * Rien ne rendait « Attribuer » inerte avant l'instantané : un double clic
 * remettait le prix deux fois. Un second clic sur le même prix — un double
 * clic, ou le clic retouché parce que rien ne bougeait — reprend donc
 * l'identifiant du premier : c'est le même geste. « Redonner » en tire un
 * neuf, une fois la remise montrée par l'instantané et lue — pas dans la
 * même seconde.
 */
export interface RemiseEnRoute {
  id: string
  /** À qui, et combien : un autre nombre de points est un autre geste. */
  quoi: string
  /** L'heure du clic. */
  a: number
  /** Les prix remis tels que l'instantané les montrait au clic. */
  vus: string
}

/** Deux clics dans cette fenêtre font un double clic, quoi que l'instantané ait dit entre-temps. */
export const DOUBLE_CLIC_MS = 2000

export function remiseDuClic(
  avant: RemiseEnRoute | undefined,
  clic: { quoi: string; vus: string; maintenant: number },
  tirer: () => string = tirerRemise,
): RemiseEnRoute {
  const memeGeste =
    !!avant && avant.quoi === clic.quoi && (avant.vus === clic.vus || clic.maintenant - avant.a < DOUBLE_CLIC_MS)
  return memeGeste ? avant : { id: tirer(), quoi: clic.quoi, a: clic.maintenant, vus: clic.vus }
}

/**
 * Sans `crypto.randomUUID` : il n'existe que sur une page servie en https, et
 * la soirée se joue souvent sur le wifi de la maison, en http.
 */
export function tirerRemise(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
