import { useSyncExternalStore } from 'react'
import type { PartySnapshot } from '../../shared/types'

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

let state: AppState = {
  connected: false,
  snapshot: null,
  me: readJson<Me>('quizz.me'),
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

export function saveMe(me: Me) {
  localStorage.setItem('quizz.me', JSON.stringify(me))
  setState({ me })
}

export function loadProfile(): Profile | null {
  return readJson<Profile>('quizz.profile')
}

export function saveProfile(profile: Profile) {
  localStorage.setItem('quizz.profile', JSON.stringify(profile))
}

let toastTimer: ReturnType<typeof setTimeout> | undefined
export function showToast(toast: Toast) {
  clearTimeout(toastTimer)
  setState({ toast })
  toastTimer = setTimeout(() => setState({ toast: null }), 4000)
}

// Même raison que socket.ts : le store est un singleton, pas hot-remplaçable.
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload())
