import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { ongletVise } from './Onglets'

// Les gemmes : les onglets de ce qui se range par rareté — l'album des
// avatars de « Ma collection » et la grille des avatars de la loge, les
// mêmes : la loge les rangeait en familles (légendaires, portraits,
// compagnons, emojis) quand l'album les rangeait en raretés, et l'on passait
// de l'un à l'autre sans s'y retrouver (le 13 octobre 2026). Les onglets de
// toute l'application : un seul arrêt de Tab, les flèches passent à la
// voisine.

export interface UneGemme<T extends string> {
  id: T
  /** Son nom sous la gemme, abrégé : six tiennent sur un téléphone. */
  court: string
  /** Ce que le lecteur d'écran entend : le nom entier et son compte. */
  label: string
  /** Son compte, sous son nom : « 3/41 » dans l'album, « 3 » dans la loge. */
  compte: string
  /** Sa couleur (`--gemme`). */
  style: CSSProperties
  /** Les Divins : une opale irisée. */
  divin?: boolean
}

export function Gemmes<T extends string>({
  gemmes,
  choisie,
  onChoisir,
  label,
  idDe,
  panneau,
  className,
}: {
  gemmes: readonly UneGemme<T>[]
  choisie: T
  onChoisir: (id: T) => void
  label: string
  /** L'identifiant de l'onglet, que son panneau nomme (`aria-labelledby`). */
  idDe: (id: T) => string
  /** L'identifiant du panneau qu'il commande. */
  panneau: string
  className: string
}) {
  const liste = useRef<HTMLDivElement>(null)
  const touche = (e: KeyboardEvent, i: number) => {
    const j = ongletVise(e.key, i, gemmes.length)
    if (j === null) return
    e.preventDefault()
    onChoisir(gemmes[j].id)
    liste.current?.querySelectorAll<HTMLElement>('[role="tab"]')[j]?.focus()
  }
  return (
    <div ref={liste} className={`gemmes ${className}`} role="tablist" aria-label={label}>
      {gemmes.map((g, i) => (
        <button
          key={g.id}
          id={idDe(g.id)}
          type="button"
          role="tab"
          aria-selected={choisie === g.id}
          aria-controls={choisie === g.id ? panneau : undefined}
          aria-label={g.label}
          tabIndex={choisie === g.id ? 0 : -1}
          className={'gemme' + (g.divin ? ' gemme-divin' : '')}
          style={g.style}
          onClick={() => onChoisir(g.id)}
          onKeyDown={e => touche(e, i)}
        >
          <i aria-hidden="true" />
          <span aria-hidden="true">{g.court}</span>
          <b aria-hidden="true">{g.compte}</b>
        </button>
      ))}
    </div>
  )
}
