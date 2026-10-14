import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { lueur } from './Atlas'

// Les pièces des lignes de « Ma collection » : une jauge fine, et la ligne
// qui se déplie sur place. Les albums, le rayon des compagnons et chaque
// ligne de la collection les partagent.

/** Une jauge fine : où l'on en est, sans un chiffre de plus. */
export function JaugeFine({ part }: { part: number }) {
  return (
    <span className="jauge-fine" aria-hidden="true">
      <span style={{ width: `${Math.round(Math.max(0, Math.min(1, part)) * 100)}%` }} />
    </span>
  )
}

/**
 * Une ligne d'une collection : son emblème, son nom, ce qu'on y trouve, son
 * compte et sa jauge — elle se déplie sur place, sous son nom.
 */
export function LigneDeCollection({
  id,
  emoji,
  nom,
  detail,
  compte,
  part,
  couleur,
  ouverte,
  onToucher,
  children,
}: {
  id?: string
  emoji: string
  nom: string
  detail: string
  compte: string
  part: number
  couleur: string
  ouverte: boolean
  onToucher: () => void
  children: ReactNode
}) {
  return (
    <li id={id} className={'trophee' + (ouverte ? ' trophee-ouvert' : '')} style={lueur(couleur)}>
      <button type="button" className="trophee-ligne" aria-expanded={ouverte} onClick={onToucher}>
        <span className="trophee-emoji" aria-hidden="true">
          {emoji}
        </span>
        <span className="trophee-texte">
          <b>{nom}</b>
          <span className="muted small">{detail}</span>
        </span>
        <span className="trophee-compte">
          {compte}
          <JaugeFine part={part} />
        </span>
        <Icon name="chevron-down" className="trophee-chevron" />
      </button>
      {ouverte && <div className="trophee-contenu">{children}</div>}
    </li>
  )
}
