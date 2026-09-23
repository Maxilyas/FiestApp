import { useSyncExternalStore } from 'react'
import type { PartySnapshot } from '../../shared/types'
import { currentSlug } from './routes'

export interface SessionView {
  sessionId: string
  view: unknown
}

export interface Me {
  playerId: string
  token: string
}

/**
 * Le prénom et l'avatar retenus sur CE téléphone pour CET espace.
 *
 * Rien à voir avec un profil de joueur (`PublicProfile`, côté serveur, avec
 * son niveau et ses badges) : ce n'est qu'une commodité locale, celle qui
 * évite de retaper son prénom après un rafraîchissement. La confusion entre
 * les deux a failli coûter cher — d'où ce nom-là.
 */
export interface ChoixLocal {
  name: string
  avatar: string
}

export interface Toast {
  kind: 'info' | 'error'
  message: string
}

export interface AppState {
  connected: boolean
  snapshot: PartySnapshot | null
  me: Me | null
  views: Record<string, SessionView>
  toast: Toast | null
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/**
 * Écrit sans jamais casser la page. Cookies bloqués, navigateur intégré d'une
 * messagerie, Safari en navigation privée : le stockage peut lever une
 * exception à la moindre écriture. Ce qu'on y range n'est qu'une commodité —
 * se re-présenter après un rafraîchissement — et un invité inscrit doit entrer
 * dans la soirée même si son téléphone refuse de s'en souvenir : sans ce
 * filet, « Rejoindre la soirée » restait grisé pour toujours alors que le
 * serveur l'avait bel et bien inscrit.
 */
function writeSafe(write: (storage: Storage) => void) {
  try {
    write(localStorage)
  } catch {
    // La mémoire seule en moins : un rafraîchissement ramènera à l'entrée.
  }
}

// Ce que le téléphone retient est rangé par espace : un invité de deux
// soirées différentes a une identité dans chacune, et le jeton de l'une ne
// vaut rien dans l'autre.
const meKey = (slug: string) => `quizz.me.${slug}`
// La clé garde son ancien nom : la renommer ferait oublier leur prénom à tous
// les téléphones qui ont déjà joué, et leur ferait repasser par l'entrée.
const choixKey = (slug: string) => `quizz.profile.${slug}`

/** L'invité mémorisé sur ce téléphone pour cet espace, s'il y a joué. */
export function readMe(slug: string): Me | null {
  return readJson<Me>(meKey(slug))
}

const slugAtLoad = currentSlug()

let state: AppState = {
  connected: false,
  snapshot: null,
  me: slugAtLoad ? readMe(slugAtLoad) : null,
  views: {},
  toast: null,
}

const listeners = new Set<() => void>()

export function getState(): AppState {
  return state
}

export function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch }
  listeners.forEach(l => l())
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getState,
  )
}

export function saveMe(slug: string, me: Me) {
  writeSafe(storage => storage.setItem(meKey(slug), JSON.stringify(me)))
  setState({ me })
}

/** L'animateur a exclu ce téléphone : il oublie son identité et repart à l'entrée. */
export function forgetMe(slug: string) {
  writeSafe(storage => {
    storage.removeItem(meKey(slug))
    storage.removeItem(choixKey(slug))
  })
  setState({ me: null, views: {} })
}

/**
 * Ce que ce téléphone a déjà choisi ici.
 *
 * Il sert deux fois : à pré-remplir l'entrée quand ce téléphone doit y
 * repasser — exclu pendant son sommeil, « Nouvelle soirée » : la reconnexion,
 * elle, ne se fait plus qu'au jeton —, et à savoir que l'entrée a déjà été vue
 * dans cet espace — un écran de connexion qu'on repousse deux fois devient un
 * péage.
 */
export function loadChoix(slug: string): ChoixLocal | null {
  return readJson<ChoixLocal>(choixKey(slug))
}

export function saveChoix(slug: string, choix: ChoixLocal) {
  writeSafe(storage => storage.setItem(choixKey(slug), JSON.stringify(choix)))
}

let toastTimer: ReturnType<typeof setTimeout> | undefined
export function showToast(toast: Toast) {
  clearTimeout(toastTimer)
  setState({ toast })
  toastTimer = setTimeout(() => setState({ toast: null }), 4000)
}

// Même raison que socket.ts : le store est un singleton, pas hot-remplaçable.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())

/**
 * Ce téléphone n'est plus personne ici — son jeton ne désigne plus aucun
 * invité (exclu pendant qu'il dormait, « Nouvelle soirée ») — mais il garde
 * le prénom et l'avatar qu'il avait choisis : l'entrée les propose
 * pré-remplis, et l'on repasse par l'écran d'équipe. `forgetMe`, lui, efface
 * aussi ce choix.
 */
export function oublierIdentite(slug: string) {
  try {
    localStorage.removeItem(meKey(slug))
  } catch {
    // Stockage refusé (navigation privée, quota) : oublier en mémoire suffit
    // pour montrer l'entrée tout de suite.
  }
  setState({ me: null, views: {} })
}
