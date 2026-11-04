/**
 * Ce que vit ce téléphone (le QG 2, lot 9) : le temps que la page a mis à
 * paraître (LCP), le pire temps de réponse au doigt (une approche de l'INP),
 * ce qui a sauté (CLS) et les erreurs du client — mesurés ici, envoyés une
 * fois quand la page se cache, sans cookie ni rien qui nomme le joueur : la
 * page se lit au serveur dans son adresse (`pageMesuree`), un salon s'y dit
 * « une soirée ». Un téléphone sur quatre seulement : `main.tsx` tire au sort,
 * et ce fichier ne vient qu'à lui, après la page. Rien n'y importe : le moins
 * de code possible pour qui mesure.
 */

type Appareil = 'android' | 'iphone' | 'ordinateur' | 'autre'

/** La sorte d'appareil, rien de plus : ni le navigateur, ni sa version. */
function sorteDAppareil(): Appareil {
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  // Un iPad récent se dit Macintosh : ses doigts le trahissent.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'iphone'
  if (/windows|macintosh|linux|cros/i.test(ua)) return 'ordinateur'
  return 'autre'
}

const sait = (type: string) => {
  try {
    return PerformanceObserver.supportedEntryTypes?.includes(type) ?? false
  } catch {
    return false
  }
}

const observer = (type: string, f: (e: PerformanceEntry) => void, options: Record<string, unknown> = {}) => {
  if (!sait(type)) return
  try {
    new PerformanceObserver(liste => liste.getEntries().forEach(f)).observe({ type, buffered: true, ...options } as PerformanceObserverInit)
  } catch {
    // Un navigateur qui ne sait pas : sa mesure reste nulle.
  }
}

export function mesurerCettePage() {
  let lcp: number | null = null
  let inp: number | null = null
  let cls: number | null = sait('layout-shift') ? 0 : null
  let erreurs = 0
  let parti = false
  observer('largest-contentful-paint', e => {
    lcp = e.startTime
  })
  observer('layout-shift', e => {
    const saut = e as PerformanceEntry & { value: number; hadRecentInput: boolean }
    // Un saut qui suit le doigt est voulu : il ne compte pas.
    if (!saut.hadRecentInput && cls !== null) cls += saut.value
  })
  observer(
    'event',
    e => {
      const geste = e as PerformanceEntry & { interactionId?: number }
      if (geste.interactionId) inp = Math.max(inp ?? 0, e.duration)
    },
    { durationThreshold: 40 },
  )
  addEventListener('error', () => erreurs++)
  addEventListener('unhandledrejection', () => erreurs++)
  const envoyer = () => {
    if (parti) return
    parti = true
    try {
      let installee = false
      try {
        installee = matchMedia('(display-mode: standalone)').matches
      } catch {
        // Rien à dire de l'installation.
      }
      void fetch('/api/mesures', {
        method: 'POST',
        keepalive: true,
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz' },
        body: JSON.stringify({ chemin: location.pathname, lcp, inp, cls, erreurs, appareil: sorteDAppareil(), installee }),
      }).catch(() => {})
    } catch {
      // Une page qui se ferme sans pouvoir envoyer : la mesure se perd, rien d'autre.
    }
  }
  // Quand la page se cache — l'onglet quitté, l'écran éteint, une autre page —, le dernier moment sûr pour envoyer.
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') envoyer()
  })
  addEventListener('pagehide', envoyer)
}
