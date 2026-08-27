import type { QuizDef, QuizQuestionDef, QuizSummary } from '../../shared/library'

/** La clé d'accès animateur, partagée avec l'écran commun. */
export function hostKey(): string {
  return localStorage.getItem('quizz.hostKey') ?? ''
}

export function setHostKey(key: string) {
  localStorage.setItem('quizz.hostKey', key)
}

/** Clé refusée : l'appelant doit réafficher le formulaire de clé. */
export class UnauthorizedError extends Error {}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-quizz-key': hostKey(), ...init?.headers },
  })
  if (res.status === 401) throw new UnauthorizedError('Clé incorrecte')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Erreur ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  list: () => req<QuizSummary[]>('/api/quizzes'),
  get: (id: string) => req<QuizDef>(`/api/quizzes/${id}`),
  create: (title: string) =>
    req<QuizDef>('/api/quizzes', { method: 'POST', body: JSON.stringify({ title }) }),
  save: (id: string, title: string, questions: QuizQuestionDef[]) =>
    req<QuizDef>(`/api/quizzes/${id}`, { method: 'PUT', body: JSON.stringify({ title, questions }) }),
  remove: (id: string) => req<{ ok: true }>(`/api/quizzes/${id}`, { method: 'DELETE' }),
  duplicate: (id: string) => req<QuizDef>(`/api/quizzes/${id}/duplicate`, { method: 'POST' }),
  uploadImage: (dataUrl: string) =>
    req<{ url: string }>('/api/images', { method: 'POST', body: JSON.stringify({ dataUrl }) }),
}

/**
 * Réduit et recompresse la photo dans le navigateur avant l'envoi : une photo
 * de téléphone fait 4 Mo, on n'en garde que ~150 Ko — la base reste légère et
 * l'affichage instantané sur l'écran commun.
 */
export async function compressImage(file: File, maxSide = 1280, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossible de préparer la photo')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}
