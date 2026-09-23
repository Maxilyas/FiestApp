import type { Finition } from '../../../shared/profil'
import { legendaire as legendaireDe } from '../../../shared/legendaires'
import { divin as divinDe } from '../../../shared/divins'
import { Legendaire } from './Legendaire'
import { Divin } from './Divin'

interface Props {
  /** L'emoji — il ne change jamais : Alice reste le renard. */
  avatar: string
  /** Sa finition, s'il joue avec un profil. Absente = l'emoji nu, comme avant. */
  finition?: Finition
  /** Ce qu'il porte a éclaté pour lui — l'emoji, ou le légendaire : il brille, et lui seul. */
  eclat?: boolean
  /** L'avatar dessiné qu'il porte à la place de l'emoji : un légendaire ou un Divin. */
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
 * médaillon dessiné, à la taille de l'emoji, prend sa place, et la finition
 * devient son cercle — pas un halo de plus autour du sien. Si l'Éclat est
 * tombé sur ce légendaire-là, il porte sa version rare, et ses paillettes.
 *
 * Un Divin prend la place de l'emoji lui aussi, mais seul : ni finition, ni
 * Éclat. Il a sa propre lumière, et ses rayons, ses ailes débordent déjà du
 * cadre : un halo de niveau par-dessus ne pourrait que l'abîmer.
 *
 * Un invité anonyme n'a ni finition ni éclat : il rend exactement ce que la
 * page rendait avant, un emoji et rien d'autre.
 */
export function Avatar({ avatar, finition, eclat, legendaire, className }: Props) {
  const divin = legendaire && divinDe(legendaire) ? legendaire : null
  const porte = !divin && legendaire && legendaireDe(legendaire) ? legendaire : null
  const classes = ['av']
  if (className) classes.push(className)
  if (divin) classes.push('av-divin')
  else if (porte) {
    classes.push('av-legendaire')
    if (eclat) classes.push('av-eclat')
  } else {
    if (finition && finition !== 'mat') classes.push(`av-${finition}`)
    if (eclat) classes.push('av-eclat')
  }
  return (
    <span className={classes.join(' ')}>
      <span className="av-emoji">
        {divin ? <Divin cle={divin} /> : porte ? <Legendaire cle={porte} finition={finition} eclat={eclat} /> : avatar}
      </span>
    </span>
  )
}
