import { useEffect, useRef, useState } from 'react'
import { sound } from '../sound'

interface Props {
  /** Fin de la question (epoch ms), fourni par le serveur. */
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
 * Barre de temps qui se vide, doublée du nombre de secondes. Sur un
 * vidéoprojecteur, une barre se lit du fond de la salle bien mieux qu'un
 * chiffre — et elle rend la tension visible sans avoir à compter.
 */
export function TimerBar({ deadline, duration, ticking, frozenMs }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const lastTick = useRef<number>(-1)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [])

  const paused = frozenMs !== undefined
  const remainingMs = paused ? Math.max(0, frozenMs) : Math.max(0, deadline - now)
  const seconds = Math.ceil(remainingMs / 1000)
  const ratio = Math.max(0, Math.min(1, remainingMs / (duration * 1000)))
  const urgent = seconds <= URGENT_FROM

  // Un bip par seconde sur la fin, jamais deux fois la même seconde.
  useEffect(() => {
    if (paused || !ticking || !urgent || seconds <= 0 || lastTick.current === seconds) return
    lastTick.current = seconds
    sound.tick()
  }, [paused, ticking, urgent, seconds])

  return (
    <div className="timer">
      <div className={'timer-track' + (urgent && !paused ? ' urgent' : '') + (paused ? ' paused' : '')}>
        <div className="timer-fill" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className={'timer-seconds' + (urgent && !paused ? ' urgent' : '')}>
        {paused ? '⏸' : seconds}
      </span>
    </div>
  )
}
