import type { ReactNode } from 'react'

/**
 * Le nom de la soirée, tel que le serveur l'a glissé dans la page d'un
 * invité (`server/src/core/page.ts`) — lu avant qu'aucun script de la route
 * ne soit arrivé. Absent partout ailleurs, et pour une adresse inconnue.
 */
function lire(nom: string): string {
  return document.querySelector(`meta[name="${nom}"]`)?.getAttribute('content') ?? ''
}
const eyebrow = lire('soiree-eyebrow')
const headline = lire('soiree-headline')

/**
 * L'attente d'un invité, entre le scan et l'écran d'entrée : l'en-tête de
 * l'entrée, à sa place et dans sa typographie, et « On arrive… » dessous.
 * C'était une seconde de « Chargement… » sur un écran noir — celle où l'on se
 * demande si le QR a marché. Le repli des routes (`main.tsx`) et l'attente de
 * la soirée (`AttenteConnexion`) la montrent à l'identique : rien ne bouge
 * de l'une à l'autre. Sans nom connu, chacun garde son texte d'avant.
 */
export function Patience({ texte, suite }: { texte: ReactNode; suite?: ReactNode }) {
  if (!headline) {
    return (
      <div className="center-page">
        <div className="attente" role="status">
          {texte}
          {suite}
        </div>
      </div>
    )
  }
  return (
    // Le même en-tête resserré que l'entrée (`JoinHead` dans `.join.entree`) :
    // l'écran d'entrée arrive dessous, sans que le nom ne bouge.
    <div className="join entree">
      <div className="join-head">
        <span className="join-eyebrow">{eyebrow}</span>
        <h1 className={'join-title' + (headline.length > 12 ? ' compact' : '')}>{headline}</h1>
      </div>
      <div className="attente" role="status">
        <p className="muted">On arrive…</p>
        {suite}
      </div>
    </div>
  )
}
