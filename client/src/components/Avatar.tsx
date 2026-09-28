import type { Finition } from '../../../shared/profil'
import { legendaire as legendaireDe } from '../../../shared/legendaires'
import { divin as divinDe } from '../../../shared/divins'
import { portrait as portraitDe } from '../../../shared/branches'
import { dessinDuPortrait, lumineuse, sortesDe, sortesDesAvatars, useDessins } from './medaillons'

interface Props {
  /** L'emoji — il ne change jamais : Alice reste le renard. */
  avatar: string
  /** Sa finition, s'il joue avec un profil. Absente = l'emoji nu, comme avant. */
  finition?: Finition
  /** Ce qu'il porte a éclaté pour lui — l'emoji, ou le légendaire : il brille, et lui seul. */
  eclat?: boolean
  /** L'avatar dessiné qu'il porte à la place de l'emoji : un légendaire, un Divin, un portrait des branches. */
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
 * Un portrait des branches (`Portrait.tsx`) se porte comme un légendaire :
 * la finition devient son cercle, l'Éclat son ciel rare.
 *
 * Les trois dernières finitions — Prisme, Aurore, Constellation — ont en
 * plus leur lumière (`Lumiere.tsx`), autour de l'emoji comme du médaillon :
 * le Diamant, les Voiles, l'Astrolabe. Elle arrive à la demande, comme les
 * dessins ; en l'attendant, l'emoji garde son halo d'avant.
 *
 * Un invité anonyme n'a ni finition ni éclat : il rend exactement ce que la
 * page rendait avant, un emoji et rien d'autre.
 *
 * Les dessins arrivent à la demande (`medaillons.ts`) : le temps qu'ils
 * arrivent, c'est l'emoji qui tient la place. Les pages les font venir avant
 * d'en avoir besoin, sauf une fois : le premier porteur de médaillon qui
 * entre dans une salle d'anonymes se montre en emoji sur chaque téléphone,
 * le temps d'un aller-retour (~200 ms en 4G), puis en médaillon. Une fois
 * par page, et pas de remède bon marché — attendre retarderait son arrivée
 * chez tout le monde, précharger ferait tout télécharger à chacun.
 */
export function Avatar({ avatar, finition, eclat, legendaire, className }: Props) {
  const divin = legendaire && divinDe(legendaire) ? legendaire : null
  const porte = !divin && legendaire && legendaireDe(legendaire) ? legendaire : null
  const tete = legendaire && portraitDe(legendaire) ? legendaire : null
  const dessins = useDessins(...sortesDesAvatars([{ legendaire, finition }]))
  const { Legendaire, Divin, Portrait, Lumiere } = dessins
  // Son portrait, s'il est arrivé : l'emoji tient la place en attendant.
  const portrait = tete && Portrait && dessinDuPortrait(dessins, tete) ? tete : null
  // La lumière de sa finition, si elle est arrivée — jamais sous un Divin, qui a la sienne.
  const lumiere = !divin && Lumiere ? lumineuse(finition) : null
  const classes = ['av']
  if (className) classes.push(className)
  if (divin) {
    // En attendant son dessin, un Divin reste un emoji nu : ni finition, ni Éclat.
    if (Divin) classes.push('av-divin')
  } else if (porte && Legendaire) {
    classes.push('av-legendaire')
    if (eclat) classes.push('av-eclat')
  } else if (portrait) {
    classes.push('av-portrait')
    if (eclat) classes.push('av-eclat')
  } else {
    if (finition && finition !== 'mat') classes.push(`av-${finition}`)
    if (eclat) classes.push('av-eclat')
  }
  if (lumiere) classes.push('av-lumiere')
  const dedans = (
    <span className="av-emoji">
      {divin && Divin ? (
        <Divin cle={divin} />
      ) : porte && Legendaire ? (
        <Legendaire cle={porte} finition={finition} eclat={eclat} />
      ) : portrait && Portrait ? (
        <Portrait cle={portrait} finition={finition} eclat={eclat} />
      ) : (
        avatar
      )}
    </span>
  )
  return (
    <span className={classes.join(' ')}>
      {lumiere && Lumiere ? (
        <Lumiere finition={lumiere} medaillon={!!((porte && Legendaire) || portrait)}>
          {dedans}
        </Lumiere>
      ) : (
        dedans
      )}
    </span>
  )
}

/**
 * Un médaillon seul, légendaire, Divin ou portrait, hors d'un avatar : la
 * fin de soirée, la carte d'un joueur. En attendant son dessin, sa place est
 * gardée, vide — il n'y a pas d'emoji à montrer à la place d'un médaillon
 * qu'on vient de gagner. Si son dessin n'arrivera plus (`perdus`), c'est à
 * la page de dire autre chose : la carte cache sa galerie, la fin de soirée
 * mène au profil.
 */
export function Dessin({ cle, verrouille }: { cle: string; verrouille?: boolean }) {
  const divin = !!divinDe(cle)
  const portrait = !!portraitDe(cle)
  const dessins = useDessins(...sortesDe([cle]))
  const { Legendaire, Divin, Portrait } = dessins
  if (divin && Divin) return <Divin cle={cle} verrouille={verrouille} />
  if (portrait && Portrait && dessinDuPortrait(dessins, cle)) return <Portrait cle={cle} verrouille={verrouille} />
  if (!divin && !portrait && Legendaire) return <Legendaire cle={cle} verrouille={verrouille} />
  return <span className={divin ? 'dv' : portrait ? 'pt' : 'lg'} aria-hidden="true" />
}
