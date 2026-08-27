import { useEffect, useState } from 'react'

/** Compte à rebours local basé sur un deadline (epoch ms) fourni par le serveur. */
export function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))
  return <span className={'countdown' + (seconds <= 5 ? ' urgent' : '')}>{seconds}</span>
}
