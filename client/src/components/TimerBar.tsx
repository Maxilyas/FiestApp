import { useEffect, useLayoutEffect, useRef } from 'react'
import { serverNow } from '../clock'
import { useSecondesRestantes } from '../decompte'
import { sound } from '../sound'
import { Icon } from './Icon'

interface Props {
  /**
   * Fin de la question (epoch ms), fourni par le serveur — et lu à SON heure :
   * une horloge de téléphone qui dérive afficherait du temps qui n'existe plus.
   */
  deadline: number
  /** Durée totale allouée, en secondes. */
  duration: number
  /** Le tic-tac des dernières secondes (écran commun uniquement). */
  ticking?: boolean
  /** Chronomètre figé par l'animateur : temps restant en ms, plus rien ne bouge. */
  frozenMs?: number
}

const URGENT_FROM = 5

/**
 * Une ligne fine qui se vide, doublée d'un grand chiffre serif. Sur un
 * vidéoprojecteur, la ligne se lit du fond de la salle bien mieux qu'un
 * chiffre — et elle rend la tension visible sans avoir à compter.
 */
export function TimerBar({ deadline, duration, ticking, frozenMs }: Props) {
  const lastTick = useRef<number>(-1)
  const barre = useRef<HTMLDivElement>(null)
  const paused = frozenMs !== undefined
  const enCours = useSecondesRestantes(deadline, !paused)
  const seconds = frozenMs !== undefined ? Math.ceil(Math.max(0, frozenMs) / 1000) : enCours
  const urgent = seconds <= URGENT_FROM

  // La barre ne change jamais de largeur : elle se vide par `scaleX`, en une
  // seule animation que le compositeur joue sans réveiller la page. Réécrire
  // `width` tous les dixièmes, sous une transition qui ne s'arrêtait jamais,
  // refaisait la mise en page soixante fois par seconde pendant toute la
  // question, sur chaque téléphone et sur la télé. L'animation repart à
  // chaque seconde, de là où l'heure du serveur dit qu'elle en est : une
  // horloge resynchronisée entre-temps ne décale la barre que d'une seconde
  // au plus. En pause, elle reste où elle est, sans animation.
  useLayoutEffect(() => {
    const el = barre.current
    if (!el) return
    const total = Math.max(1, duration * 1000)
    const reste = Math.max(0, frozenMs ?? deadline - serverNow())
    const depart = Math.min(1, reste / total)
    el.style.transform = `scaleX(${depart})`
    if (frozenMs !== undefined || reste <= 0 || typeof el.animate !== 'function') return
    const vidage = el.animate([{ transform: `scaleX(${depart})` }, { transform: 'scaleX(0)' }], {
      duration: reste,
      easing: 'linear',
      fill: 'forwards',
    })
    return () => vidage.cancel()
  }, [deadline, duration, frozenMs, seconds])

  // Un bip par seconde sur la fin, jamais deux fois la même seconde.
  useEffect(() => {
    if (paused || !ticking || !urgent || seconds <= 0 || lastTick.current === seconds) return
    lastTick.current = seconds
    sound.tick()
  }, [paused, ticking, urgent, seconds])

  return (
    // `aria-live="off"` : un lecteur d'écran n'a pas à annoncer chaque dixième
    // de seconde, mais il sait qu'il s'agit d'un chronomètre s'il s'y arrête.
    <div
      className="timer"
      role="timer"
      aria-live="off"
      aria-label={paused ? 'Chronomètre en pause' : `${seconds} secondes restantes`}
    >
      <div className={'timer-track' + (urgent && !paused ? ' urgent' : '') + (paused ? ' paused' : '')}>
        <div ref={barre} className="timer-fill" />
      </div>
      <span className={'timer-seconds' + (urgent && !paused ? ' urgent' : '')}>
        {paused ? <Icon name="pause" /> : seconds}
      </span>
    </div>
  )
}
