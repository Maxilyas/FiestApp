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
  /**
   * Les secondes qui pressent : cinq d'office, celles d'une question de soirée.
   * Le Cabinet en compte dix — ses manches durent de 25 à 120 secondes, et cinq
   * y arrivaient tard.
   */
  urgence?: number
  /**
   * Le repère d'une durée qu'on dit à part, en ms avant l'échéance : le temps
   * en plus que Prendre son temps donne à une manche du Cabinet, qui ôte le
   * cadre doré. La part de la barre où il court se hachure, bornée d'un trait :
   * une forme, pas une couleur — Camille, daltonienne, perdait son cadre doré
   * sans le voir (la tablée du 26 octobre 2026). La soirée n'en pose pas : son
   * chrono rend ce qu'il rendait.
   */
  repereMs?: number
}

const URGENT_FROM = 5

/**
 * Une ligne fine qui se vide, doublée d'un grand chiffre serif. Sur un
 * vidéoprojecteur, la ligne se lit du fond de la salle bien mieux qu'un
 * chiffre — et elle rend la tension visible sans avoir à compter.
 *
 * Quand le temps presse, la ligne vire au rouge, mais pas seulement : un
 * sablier paraît devant les secondes, la barre s'épaissit et le chiffre
 * s'appuie (`styles.css`). En deutéranopie, le rouge devenait un kaki plus
 * sombre que l'or, et sous « réduire les animations » la pulsation s'arrête :
 * la daltonienne de la tablée du 25 octobre 2026 ne voyait pas l'urgence.
 */
export function TimerBar({ deadline, duration, ticking, frozenMs, urgence = URGENT_FROM, repereMs }: Props) {
  const lastTick = useRef<number>(-1)
  const barre = useRef<HTMLDivElement>(null)
  const paused = frozenMs !== undefined
  const enCours = useSecondesRestantes(deadline, !paused)
  const seconds = frozenMs !== undefined ? Math.ceil(Math.max(0, frozenMs) / 1000) : enCours
  const urgent = seconds <= urgence
  // La barre se vide vers la gauche (`transform-origin: left`) : le temps qui reste au repère en est le bout gauche.
  const repere = repereMs !== undefined && repereMs > 0 ? `${Math.min(100, (100 * repereMs) / Math.max(1, duration * 1000)).toFixed(2)}%` : null

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
      <div className={'timer-track' + (urgent && !paused ? ' urgent' : '') + (paused ? ' paused' : '') + (repere ? ' avec-repere' : '')}>
        <div ref={barre} className="timer-fill" />
        {repere && <div className="timer-repere" style={{ width: repere }} />}
      </div>
      {/* En pause, les secondes restent à côté de l'icône : on sait combien
          il en restera à la reprise. Quand le temps presse, un sablier : une
          forme, que ni la couleur ni le mouvement ne portent seuls. */}
      <span className={'timer-seconds' + (urgent && !paused ? ' urgent' : '') + (paused ? ' paused' : '')}>
        {paused ? <Icon name="pause" /> : urgent && <Icon name="hourglass" />}
        {seconds}
      </span>
    </div>
  )
}
