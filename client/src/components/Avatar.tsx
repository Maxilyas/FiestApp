import type { Finition } from '../../../shared/profil'
import { legendaire as legendaireDe } from '../../../shared/legendaires'
import { Legendaire } from './Legendaire'

interface Props {
  /** L'emoji — il ne change jamais : Alice reste le renard. */
  avatar: string
  /** Sa finition, s'il joue avec un profil. Absente = l'emoji nu, comme avant. */
  finition?: Finition
  /** Cet emoji-là a éclaté pour lui : il brille, et lui seul. */
  eclat?: boolean
  /** L'avatar légendaire qu'il porte, à la place de l'emoji. */
  legendaire?: string
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
 * Sauf pour qui a gagné un avatar légendaire et choisi de le porter : un
 * médaillon dessiné, à la taille de l'emoji, prend sa place. L'Éclat, lui,
 * tient à un emoji : il ne s'applique pas au légendaire.
 *
 * Un invité anonyme n'a ni finition ni éclat : il rend exactement ce que la
 * page rendait avant, un emoji et rien d'autre.
 */
export function Avatar({ avatar, finition, eclat, legendaire, className }: Props) {
  const porte = legendaire && legendaireDe(legendaire) ? legendaire : null
  const classes = ['av']
  if (className) classes.push(className)
  if (finition && finition !== 'mat') classes.push(`av-${finition}`)
  if (porte) classes.push('av-legendaire')
  else if (eclat) classes.push('av-eclat')
  return (
    <span className={classes.join(' ')}>
      <span className="av-emoji">{porte ? <Legendaire cle={porte} /> : avatar}</span>
    </span>
  )
}
