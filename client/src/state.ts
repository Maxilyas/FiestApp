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

export interface Profile {
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

// Ce que le téléphone retient est rangé par espace : un invité de deux
// soirées différentes a une identité dans chacune, et le jeton de l'une ne
// vaut rien dans l'autre.
const meKey = (slug: string) => `quizz.me.${slug}`
const profileKey = (slug: string) => `quizz.profile.${slug}`

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
  localStorage.setItem(meKey(slug), JSON.stringify(me))
  setState({ me })
}

/** L'animateur a exclu ce téléphone : il oublie son identité et repart à l'inscription. */
export function forgetMe(slug: string) {
  localStorage.removeItem(meKey(slug))
  localStorage.removeItem(profileKey(slug))
  setState({ me: null, views: {} })
}

export function loadProfile(slug: string): Profile | null {
  return readJson<Profile>(profileKey(slug))
}

export function saveProfile(slug: string, profile: Profile) {
  localStorage.setItem(profileKey(slug), JSON.stringify(profile))
}

let toastTimer: ReturnType<typeof setTimeout> | undefined
export function showToast(toast: Toast) {
  clearTimeout(toastTimer)
  setState({ toast })
  toastTimer = setTimeout(() => setState({ toast: null }), 4000)
}

// Même raison que socket.ts : le store est un singleton, pas hot-remplaçable.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
