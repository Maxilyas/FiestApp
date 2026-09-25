import { useState } from 'react'
import { Icon } from './Icon'
import { consoleOuvreuse, revenirALaConsole } from '../onglets'
import { showToast } from '../state'

/**
 * « Écran commun », sur les pages de l'animateur. Ouverte depuis la console,
 * la page y ramène (« Revenir à la console ») au lieu d'en ouvrir une
 * seconde dans cet onglet.
 */
export function LienConsole({ className = 'btn btn-ghost' }: { className?: string }) {
  // Lu une fois : la console ne change pas d'onglet pendant qu'on est ici.
  const [ouvreuse] = useState(() => consoleOuvreuse() !== null)
  return (
    <a
      className={className}
      href="/host"
      onClick={e => {
        if (!ouvreuse) return
        e.preventDefault()
        const ok = revenirALaConsole(() =>
          showToast({ kind: 'info', message: 'Ta console est ouverte dans l’onglet d’avant' }),
        )
        // La console a été fermée entre-temps : on l'ouvre ici, il n'y en a plus d'autre.
        if (!ok) window.location.assign('/host')
      }}
    >
      <Icon name="monitor" />
      {ouvreuse ? 'Revenir à la console' : 'Écran commun'}
    </a>
  )
}
