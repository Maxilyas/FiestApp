import { useEffect, useRef } from 'react'
import { useSecondesRestantes } from '../decompte'
import { sound } from '../sound'
import { Icon } from './Icon'

/**
 * Le 3… 2… 1… avant une question. Le `key` sur le chiffre force React à
 * remonter l'élément à chaque seconde : l'animation CSS rejoue, et le chiffre
 * « claque » au lieu de changer discrètement.
 */
export function GetReady({ deadline, sounds, label }: { deadline: number; sounds?: boolean; label: string }) {
  // À l'heure du serveur : le 3-2-1 doit tomber en même temps sur la TV et
  // sur cinquante téléphones dont les horloges ne s'accordent pas. Un réveil
  // par seconde, pas dix : seul le chiffre change.
  const seconds = useSecondesRestantes(deadline)
  const lastTick = useRef<number>(-1)

  useEffect(() => {
    if (!sounds || seconds <= 0 || lastTick.current === seconds) return
    lastTick.current = seconds
    sound.countdownTick(seconds)
  }, [sounds, seconds])

  return (
    <div className="getready">
      <span className="getready-icon">
        <Icon name="timer" />
      </span>
      <p>{label}</p>
      <div key={seconds} className="big-count">
        {seconds > 0 ? seconds : 'GO !'}
      </div>
    </div>
  )
}
