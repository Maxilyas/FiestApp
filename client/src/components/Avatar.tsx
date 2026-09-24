import type { ReactNode } from 'react'
import type { Finition } from '../../../shared/profil'
import { legendaire as legendaireDe } from '../../../shared/legendaires'
import { divin as divinDe } from '../../../shared/divins'
import { useDessins } from './medaillons'

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
 *
 * Les dessins arrivent à la demande (`medaillons.ts`) : le temps qu'ils
 * arrivent, c'est l'emoji qui tient la place. Les pages les font venir avant
 * d'en avoir besoin, et ce repli ne se voit presque jamais.
 */
export function Avatar({ avatar, finition, eclat, legendaire, className }: Props) {
  const divin = legendaire && divinDe(legendaire) ? legendaire : null
  const porte = !divin && legendaire && legendaireDe(legendaire) ? legendaire : null
  const { Legendaire, Divin } = useDessins(!!(divin || porte))
  const classes = ['av']
  if (className) classes.push(className)
  if (divin) {
    // En attendant son dessin, un Divin reste un emoji nu : ni finition, ni Éclat.
    if (Divin) classes.push('av-divin')
  } else if (porte && Legendaire) {
    classes.push('av-legendaire')
    if (eclat) classes.push('av-eclat')
  } else {
    if (finition && finition !== 'mat') classes.push(`av-${finition}`)
    if (eclat) classes.push('av-eclat')
  }
  return (
    <span className={classes.join(' ')}>
      <span className="av-emoji">
        {divin && Divin ? (
          <Divin cle={divin} />
        ) : porte && Legendaire ? (
          <Legendaire cle={porte} finition={finition} eclat={eclat} />
        ) : (
          avatar
        )}
      </span>
    </span>
  )
}

/**
 * Un médaillon seul, légendaire ou Divin, hors d'un avatar : la fin de
 * soirée, la carte d'un joueur. En attendant son dessin, sa place est
 * gardée, vide — il n'y a pas d'emoji à montrer à la place d'un médaillon
 * qu'on vient de gagner. Si les dessins n'arriveront plus (`echec`, pour
 * toute la page), c'est `repli` qui prend la place : sinon un cercle vide.
 */
export function Dessin({ cle, repli }: { cle: string; repli?: ReactNode }) {
  const divin = !!divinDe(cle)
  const { Legendaire, Divin, echec } = useDessins(true)
  if (divin && Divin) return <Divin cle={cle} />
  if (!divin && Legendaire) return <Legendaire cle={cle} />
  if (echec && repli) return <>{repli}</>
  return <span className={divin ? 'dv' : 'lg'} aria-hidden="true" />
}
