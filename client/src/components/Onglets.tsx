import { useRef, type KeyboardEvent } from 'react'
import { Icon, type IconName } from './Icon'

export interface Onglet<T extends string> {
  id: T
  nom: string
  icone?: IconName
  /** Un compte après le nom, plus discret : « 9 / 72 ». */
  compte?: string
}

/** Les touches du motif d'onglets, et l'onglet où chacune mène. */
export function ongletVise(touche: string, i: number, n: number): number | null {
  if (touche === 'ArrowRight') return (i + 1) % n
  if (touche === 'ArrowLeft') return (i - 1 + n) % n
  if (touche === 'Home') return 0
  if (touche === 'End') return n - 1
  return null
}

/**
 * Une rangée d'onglets, au doigt comme au clavier. Un seul arrêt de Tab —
 * l'onglet choisi —, les flèches passent au voisin et le choisissent, Début
 * et Fin vont aux extrémités : le lecteur d'écran annonce « onglet, 1 sur
 * 3 », et l'on essaie les flèches. Chaque onglet était un arrêt de Tab, et
 * les flèches ne faisaient rien. `aria-controls` ne vise que le panneau
 * affiché : ceux des autres onglets ne sont pas dans la page.
 */
export function Onglets<T extends string>({
  onglets,
  actif,
  onChoisir,
  label,
  idOnglet,
  idPanneau,
  className = '',
}: {
  onglets: Onglet<T>[]
  actif: T
  onChoisir: (id: T) => void
  label: string
  idOnglet: (id: T) => string
  idPanneau: (id: T) => string
  className?: string
}) {
  const liste = useRef<HTMLDivElement>(null)
  const touche = (e: KeyboardEvent, i: number) => {
    const j = ongletVise(e.key, i, onglets.length)
    if (j === null) return
    e.preventDefault()
    onChoisir(onglets[j].id)
    liste.current?.querySelectorAll<HTMLElement>('[role="tab"]')[j]?.focus()
  }
  return (
    <div ref={liste} className={('onglets ' + className).trim()} role="tablist" aria-label={label}>
      {onglets.map((o, i) => (
        <button
          key={o.id}
          id={idOnglet(o.id)}
          type="button"
          role="tab"
          aria-selected={actif === o.id}
          aria-controls={actif === o.id ? idPanneau(o.id) : undefined}
          tabIndex={actif === o.id ? 0 : -1}
          className={'onglet' + (actif === o.id ? ' actif' : '')}
          onClick={() => onChoisir(o.id)}
          onKeyDown={e => touche(e, i)}
        >
          {o.icone && <Icon name={o.icone} />}
          {o.nom}
          {o.compte && <span className="onglet-compte">{o.compte}</span>}
        </button>
      ))}
    </div>
  )
}
