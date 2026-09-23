import { useEffect } from 'react'

/**
 * Garde l'écran allumé tant que `actif` est vrai.
 *
 * Garder l'écran allumé demande HTTPS (`navigator.wakeLock`) : sur
 * `http://192.168…` et sur les navigateurs qui ne savent pas le faire, on
 * continue sans — ce n'est qu'un confort, et `ConseilVeille` le dit aux
 * invités.
 */
export function useEcranAllume(actif: boolean) {
  useEffect(() => {
    if (!actif) return
    let sentinel: { release: () => Promise<void> } | null = null
    let stopped = false
    const acquire = () => {
      const wakeLock = (navigator as any).wakeLock
      if (!wakeLock) return
      wakeLock
        .request('screen')
        .then((lock: any) => {
          if (stopped) lock.release()
          else sentinel = lock
        })
        .catch(() => {
          // Refusé (onglet en arrière-plan, navigateur sans la fonction) :
          // ce n'est qu'un confort, on continue sans.
        })
    }
    // Revenir sur l'onglet libère le verrou : il faut le redemander.
    const onVisible = () => document.visibilityState === 'visible' && acquire()
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [actif])
}
