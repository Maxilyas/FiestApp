interface Props {
  /** Le niveau, ou rien du tout : un invité anonyme ne porte pas de pastille. */
  niveau?: number
  /** Sur l'écran commun, où tout est plus grand et plus loin. */
  big?: boolean
}

/**
 * La pastille de niveau.
 *
 * Elle ne s'affiche que pour qui en a un. Pas de « Niv. 0 » ni de pastille
 * grise pour les autres : la moitié d'une salle sera toujours anonyme, et
 * elle ne doit rien lire qui ressemble à un rang inférieur. L'absence, pas
 * l'infériorité.
 */
export function Niveau({ niveau, big }: Props) {
  if (!niveau) return null
  return (
    <span className={'niveau' + (big ? ' big' : '')} title={`Niveau ${niveau}`}>
      {/* Au milieu d'une ligne de classement, un troisième nombre nu. */}
      <span className="sr-only">niveau </span>
      {niveau}
    </span>
  )
}
