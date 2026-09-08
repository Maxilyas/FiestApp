import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'

/**
 * Boîtes de confirmation et de saisie de l'application.
 *
 * Elles remplacent `window.confirm` et `window.prompt` : ceux-là s'affichent
 * avec l'habillage du navigateur devant cinquante personnes, et selon le
 * navigateur, un dialogue natif fait sortir du plein écran. Ici, c'est une
 * carte de l'application, fermée par Échap, avec le clavier qui reste dedans.
 */
export interface DialogOptions {
  title: string
  message?: string
  /** Un champ texte : la valeur proposée et son libellé d'aide. */
  input?: { value: string; placeholder?: string; maxLength?: number }
  confirmLabel?: string
  cancelLabel?: string
  /** Action qui efface quelque chose : le bouton prend la couleur d'alerte. */
  danger?: boolean
}

interface Pending {
  id: number
  options: DialogOptions
  resolve: (value: string | null) => void
}

let current: Pending | null = null
let nextId = 1
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(l => l())

function open(options: DialogOptions): Promise<string | null> {
  // Un dialogue déjà ouvert est abandonné : un seul à la fois.
  current?.resolve(null)
  return new Promise(resolve => {
    current = { id: nextId++, options, resolve }
    notify()
  })
}

function close(value: string | null) {
  const pending = current
  current = null
  notify()
  pending?.resolve(value)
}

/** Vrai si l'animateur confirme. */
export function confirmDialog(options: DialogOptions): Promise<boolean> {
  return open(options).then(v => v !== null)
}

/** La valeur saisie, ou null si on a renoncé. Une saisie vide vaut renoncement. */
export function promptDialog(options: DialogOptions & { input: DialogOptions['input'] }): Promise<string | null> {
  return open(options).then(v => (v === null || !v.trim() ? null : v.trim()))
}

/** À monter une fois par page : c'est lui qui affiche le dialogue en cours. */
export function DialogHost() {
  const pending = useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
  if (!pending) return null
  return <DialogBox key={pending.id} pending={pending} />
}

function DialogBox({ pending }: { pending: Pending }) {
  const { options } = pending
  const [value, setValue] = useState(options.input?.value ?? '')
  const box = useRef<HTMLFormElement>(null)

  useEffect(() => {
    // Le clavier arrive dans la boîte, et il y reste : Tab tourne en rond
    // dedans, Échap ferme, et le bouton qui a ouvert le dialogue reprend le
    // focus ensuite.
    const opener = document.activeElement as HTMLElement | null
    const focusable = () =>
      [...(box.current?.querySelectorAll<HTMLElement>('input, button') ?? [])].filter(el => !el.hasAttribute('disabled'))
    const first = focusable()[0]
    first?.focus()
    if (first instanceof HTMLInputElement) first.select()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(null)
        return
      }
      if (e.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const head = items[0]
      const tail = items[items.length - 1]
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault()
        tail.focus()
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault()
        head.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (options.input && !value.trim()) return
    close(options.input ? value : '')
  }

  return (
    <div className="dialog-backdrop" onClick={() => close(null)}>
      <form
        ref={box}
        className="card dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 id="dialog-title">{options.title}</h3>
        {options.message && <p className="muted dialog-message">{options.message}</p>}
        {options.input && (
          <input
            className="input"
            value={value}
            placeholder={options.input.placeholder}
            maxLength={options.input.maxLength}
            aria-label={options.title}
            onChange={e => setValue(e.target.value)}
          />
        )}
        <div className="row dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={() => close(null)}>
            {options.cancelLabel ?? 'Annuler'}
          </button>
          <button type="submit" className={'btn ' + (options.danger ? 'btn-danger' : 'btn-primary')}>
            {options.confirmLabel ?? 'Confirmer'}
          </button>
        </div>
      </form>
    </div>
  )
}
