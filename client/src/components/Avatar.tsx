import type { Finition } from '../../../shared/profil'

interface Props {
  /** L'emoji — il ne change jamais : Alice reste le renard. */
  avatar: string
  /** Sa finition, s'il joue avec un profil. Absente = l'emoji nu, comme avant. */
  finition?: Finition
  /** Cet emoji-là a éclaté pour lui : il brille, et lui seul. */
  eclat?: boolean
  /** La classe de taille du contexte (`lb-avatar`, `podium-avatar`…). */
  className?: string
}

/**
 * L'avatar d'un joueur, avec ce que son profil lui a gagné.
 *
 * Le parti pris : **l'emoji ne change jamais**. Ce qui change, c'est la
 * finition autour — un halo, une couronne, un voile irisé. Aucun nouvel objet
 * à dessiner, ça tient à l'échelle d'un vidéoprojecteur, et chacun garde
 * l'animal auquel la salle l'associe.
 *
 * Un invité anonyme n'a ni finition ni éclat : il rend exactement ce que la
 * page rendait avant, un emoji et rien d'autre.
 */
export function Avatar({ avatar, finition, eclat, className }: Props) {
  const classes = ['av']
  if (className) classes.push(className)
  if (finition && finition !== 'mat') classes.push(`av-${finition}`)
  if (eclat) classes.push('av-eclat')
  return (
    <span className={classes.join(' ')}>
      <span className="av-emoji">{avatar}</span>
    </span>
  )
}
