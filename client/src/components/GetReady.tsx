import { useEffect, useRef, useState } from 'react'
import { sound } from '../sound'

/**
 * Le 3… 2… 1… avant une question. Le `key` sur le chiffre force React à
 * remonter l'élément à chaque seconde : l'animation CSS rejoue, et le chiffre
 * « claque » au lieu de changer discrètement.
 */
export function GetReady({ deadline, sounds, label }: { deadline: number; sounds?: boolean; label: string }) {
  const [now, setNow] = useState(() => Date.now())
  const lastTick = useRef<number>(-1)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [])

  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))

  useEffect(() => {
    if (!sounds || seconds <= 0 || lastTick.current === seconds) return
    lastTick.current = seconds
    sound.countdownTick(seconds)
  }, [sounds, seconds])

  return (
    <div className="getready">
      <span className="getready-emoji">🚦</span>
      <p>{label}</p>
      <div key={seconds} className="big-count">
        {seconds > 0 ? seconds : 'GO !'}
      </div>
    </div>
  )
}
