import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import { espacesFines } from '../format'
import { couvrir, horsDeLaBoite, poserUneFenetre, retenirLeFocus } from '../modale'
import { estLEchoDUnDoigt } from '../toucher'

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
  /**
   * Un champ texte : la valeur proposée et son libellé d'aide. `numeric` fait
   * monter le pavé numérique sur un téléphone quand on n'attend qu'un nombre.
   */
  input?: { value: string; placeholder?: string; maxLength?: number; inputMode?: 'numeric' }
  confirmLabel?: string
  cancelLabel?: string
  /** Action qui efface quelque chose : le bouton prend la couleur d'alerte. */
  danger?: boolean
  /**
   * Un second geste, à côté de la confirmation : « Clore la soirée » ou
   * « C'était un essai ». Discret, et d'alerte s'il efface.
   */
  alternative?: { label: string; danger?: boolean }
}

/** Ce que la boîte rend : le geste choisi et la saisie, ou null si on renonce. */
interface Reponse {
  geste: 'confirmer' | 'alternative'
  valeur: string
}

interface Pending {
  id: number
  options: DialogOptions
  resolve: (value: Reponse | null) => void
}

let current: Pending | null = null
let nextId = 1
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(l => l())

function open(options: DialogOptions): Promise<Reponse | null> {
  // Un dialogue déjà ouvert est abandonné : un seul à la fois.
  current?.resolve(null)
  return new Promise(resolve => {
    current = { id: nextId++, options, resolve }
    notify()
  })
}

function close(value: Reponse | null) {
  const pending = current
  current = null
  notify()
  pending?.resolve(value)
}

/**
 * Ferme le dialogue ouvert comme si l'on renonçait : ce qu'il demandait ne se
 * demande plus. Le « Quitter ? » d'une manche du Cabinet, quand la réponse
 * partie d'elle-même à l'échéance vient de la trancher sous lui : laissé
 * ouvert, il cachait la révélation, et « Continuer » aurait voulu reprendre
 * une pause qui n'existait plus.
 */
export function fermerLeDialogue() {
  if (current) close(null)
}

/** Vrai si l'animateur confirme. */
export function confirmDialog(options: DialogOptions): Promise<boolean> {
  return open(options).then(v => v?.geste === 'confirmer')
}

/** La valeur saisie, ou null si on a renoncé. Une saisie vide vaut renoncement. */
export function promptDialog(options: DialogOptions & { input: DialogOptions['input'] }): Promise<string | null> {
  return open(options).then(v => (v?.geste !== 'confirmer' || !v.valeur.trim() ? null : v.valeur.trim()))
}

/**
 * Deux gestes possibles, et la saisie qui accompagne le premier : le geste
 * choisi, ou null si on a renoncé. Une saisie vide vaut renoncement pour la
 * confirmation seulement — l'alternative n'en a pas besoin.
 */
export function choixDialog(
  options: DialogOptions & { alternative: NonNullable<DialogOptions['alternative']> },
): Promise<Reponse | null> {
  return open(options).then(v => {
    if (!v) return null
    if (v.geste === 'alternative') return v
    return options.input && !v.valeur.trim() ? null : { geste: 'confirmer', valeur: v.valeur.trim() }
  })
}

/**
 * Où Tab mène dans la boîte, ou null quand le navigateur y suffit : du
 * dernier arrêt au premier, du premier au dernier en arrière — et d'ailleurs
 * au premier (au dernier en arrière). Le piège ne bouclait que depuis le
 * premier ou le dernier bouton : le focus tombé sur la page sous le doigt
 * (« Quitter » à la révélation d'une manche du Cabinet), Tab partait derrière
 * la fenêtre, et Tab, Tab, Entrée y jouait « Manche suivante » (la tablée du
 * 25 octobre 2026).
 */
export function arretDuTab<T>(arrets: readonly T[], actif: unknown, arriere: boolean): T | null {
  if (arrets.length === 0) return null
  const premier = arrets[0]
  const dernier = arrets[arrets.length - 1]
  if (!arrets.includes(actif as T)) return arriere ? dernier : premier
  if (arriere && actif === premier) return dernier
  if (!arriere && actif === dernier) return premier
  return null
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
  const voile = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLFormElement>(null)

  useEffect(() => {
    // Le clavier arrive dans la boîte, et il y reste : Tab tourne en rond
    // dedans, Échap ferme, et le bouton qui a ouvert le dialogue reprend le
    // focus ensuite. Le reste de la page devient inerte, comme sous une
    // feuille ou la carte d'un joueur (`useModale`) : rien ne l'était, et le
    // lecteur d'écran d'un téléphone, qui ne passe pas par Tab, lisait et
    // touchait la page derrière la fenêtre.
    const fenetre = poserUneFenetre()
    const opener = document.activeElement as HTMLElement | null
    // Le voile, pas la boîte : il reste vivant, et le toucher pour renoncer le ferme encore. Ce que couvre aussi une feuille
    // ouverte dessous le reste tant que l'une des deux est là (`couvrir`).
    const decouvrir = couvrir(voile.current ? horsDeLaBoite(voile.current, document.body) : [])
    const focusable = () =>
      [...(box.current?.querySelectorAll<HTMLElement>('input, button') ?? [])].filter(el => !el.hasAttribute('disabled'))
    const first = focusable()[0]
    first?.focus()
    if (first instanceof HTMLInputElement) first.select()

    const onKey = (e: KeyboardEvent) => {
      // Une fenêtre ouverte sur elle a le clavier.
      if (!fenetre.dessus()) return
      if (e.key === 'Escape') {
        e.preventDefault()
        close(null)
        return
      }
      if (e.key !== 'Tab') return
      const vise = arretDuTab(focusable(), document.activeElement, e.shiftKey)
      if (!vise) return
      e.preventDefault()
      vise.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      fenetre.retirer()
      // Avant de rendre le focus : un bouton inerte ne le prend pas.
      decouvrir()
      opener?.focus?.()
    }
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (options.input && !value.trim()) return
    close({ geste: 'confirmer', valeur: options.input ? value : '' })
  }

  return (
    // Le voile se touche pour renoncer — mais pas sous l'écho du doigt qui vient d'ouvrir le dialogue (`toucher`) : ouvert au
    // lever du doigt, il se refermait aussitôt sous le click que le navigateur fait suivre, et le mousedown d'avant lui
    // emportait son focus (`retenirLeFocus`).
    <div className="dialog-backdrop" ref={voile} onMouseDown={retenirLeFocus} onClick={e => !estLEchoDUnDoigt(e) && close(null)}>
      <form
        ref={box}
        className="card dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
      >
        <h3 id="dialog-title">{espacesFines(options.title)}</h3>
        {options.message && <p className="muted dialog-message">{espacesFines(options.message)}</p>}
        {options.input && (
          <input
            className="input"
            value={value}
            placeholder={options.input.placeholder}
            maxLength={options.input.maxLength}
            inputMode={options.input.inputMode}
            aria-label={options.title}
            onChange={e => setValue(e.target.value)}
          />
        )}
        <div className="row dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={() => close(null)}>
            {options.cancelLabel ?? 'Annuler'}
          </button>
          {options.alternative && (
            <button
              type="button"
              className={'btn ' + (options.alternative.danger ? 'btn-ghost dialog-alternative' : 'btn-ghost')}
              onClick={() => close({ geste: 'alternative', valeur: value })}
            >
              {options.alternative.label}
            </button>
          )}
          <button type="submit" className={'btn ' + (options.danger ? 'btn-danger' : 'btn-primary')}>
            {options.confirmLabel ?? 'Confirmer'}
          </button>
        </div>
      </form>
    </div>
  )
}
