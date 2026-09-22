import type { QuizDef, QuizQuestionDef, QuizSummary } from '../../shared/library'
import type { ArchiveSummary } from '../../shared/archive'
import type { PublicAccount, PublicSpace, SpaceSettings } from '../../shared/space'
import type { Finition, PublicProfile, PublicProfileDetail } from '../../shared/profil'

/** Session absente ou périmée : l'appelant renvoie vers la connexion. */
export class UnauthorizedError extends Error {}

/**
 * Une erreur d'API qui porte ce que le serveur a joint au message.
 *
 * Pour l'instant une seule chose y voyage : l'identifiant libre proposé quand
 * celui qu'on voulait est pris. Sans lui, une invitée qui n'y connaît rien
 * resterait devant un refus qu'elle ne sait pas contourner.
 */
export class ApiError extends Error {
  constructor(message: string, readonly suggestion?: string) {
    super(message)
  }
}

/**
 * Toute requête part avec le cookie de session — le navigateur s'en charge —
 * et un en-tête maison que seule cette page peut poser : une page tierce qui
 * tenterait une écriture à notre place serait refusée avant d'être lue.
 */
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', ...init?.headers },
  })
  if (res.status === 401) throw new UnauthorizedError('Connexion requise')
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(
      body.error ?? `Erreur ${res.status}`,
      typeof body.suggestion === 'string' ? body.suggestion : undefined,
    )
  }
  return res.json() as Promise<T>
}

/** Qui est connecté, et son espace. */
export interface Me {
  account: PublicAccount
  space: PublicSpace
}

/** Un lien d'activation : le jeton et sa date limite. */
export interface Activation {
  token: string
  expiresAt: number
}

/** L'adresse à envoyer : le jeton voyage dans le fragment, que le navigateur garde pour lui. */
export const activationUrl = (token: string) => `${window.location.origin}/activer#t=${token}`

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
  /** L'historique des soirées : le lire est public, le retoucher demande d'être connecté. */
  archives: {
    rename: (id: string, title: string) =>
      req<ArchiveSummary>(`/api/soirees/${id}`, { method: 'PUT', body: JSON.stringify({ title }) }),
    remove: (id: string) => req<{ ok: true }>(`/api/soirees/${id}`, { method: 'DELETE' }),
  },
  /** Se connecter, activer son compte, changer de mot de passe. */
  auth: {
    me: () => req<Me>('/api/auth/me'),
    login: (login: string, password: string) =>
      req<Me>('/api/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) }),
    logout: () => req<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
    activate: (token: string, password: string) =>
      req<Me>('/api/auth/activate', { method: 'POST', body: JSON.stringify({ token, password }) }),
    changePassword: (current: string, next: string) =>
      req<{ ok: true }>('/api/auth/password', { method: 'POST', body: JSON.stringify({ current, next }) }),
  },
  /**
   * Le profil d'un joueur récurrent. Rien ici n'est nécessaire pour jouer :
   * l'invité anonyme ne passe par aucune de ces routes et ne perd rien.
   */
  joueur: {
    /** Sans cookie, rend `null` — ce n'est pas une erreur, c'est un invité. */
    /** Sa propre page : le détail complet, étagère à badges et historique. */
    moi: () => req<{ profile: PublicProfileDetail | null }>('/api/joueur/moi'),
    connexion: (login: string, password: string) =>
      req<{ profile: PublicProfile }>('/api/joueur/connexion', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      }),
    /** Rend le code de secours — la seule fois où il existe en clair. */
    inscription: (input: { login: string; password: string; name: string; avatar: string }) =>
      req<{ profile: PublicProfile; recovery: string }>('/api/joueur/inscription', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    deconnexion: () => req<{ ok: true }>('/api/joueur/deconnexion', { method: 'POST' }),
    enregistrer: (patch: { name?: string; avatar?: string; finition?: Finition }) =>
      req<{ profile: PublicProfile }>('/api/joueur/moi', { method: 'PUT', body: JSON.stringify(patch) }),
    motDePasse: (next: string) =>
      req<{ ok: true }>('/api/joueur/mot-de-passe', { method: 'POST', body: JSON.stringify({ next }) }),
    /** Le code de secours se consomme : on en rend un neuf. */
    secours: (login: string, code: string, password: string) =>
      req<{ recovery: string; profile: PublicProfile | null }>('/api/joueur/secours', {
        method: 'POST',
        body: JSON.stringify({ login, code, password }),
      }),
  },
  space: {
    saveSettings: (settings: Partial<SpaceSettings>) =>
      req<{ space: PublicSpace }>('/api/space/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  },
  /** Réservé à l'administrateur : les comptes des autres animateurs. */
  admin: {
    list: () => req<PublicAccount[]>('/api/admin/accounts'),
    create: (input: { login: string; name: string; slug: string }) =>
      req<{ account: PublicAccount; activation: Activation }>('/api/admin/accounts', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    activation: (id: string) =>
      req<{ activation: Activation }>(`/api/admin/accounts/${id}/activation`, { method: 'POST' }),
    disable: (id: string) => req<{ account: PublicAccount }>(`/api/admin/accounts/${id}/disable`, { method: 'POST' }),
    enable: (id: string) => req<{ account: PublicAccount }>(`/api/admin/accounts/${id}/enable`, { method: 'POST' }),
    update: (id: string, patch: { name?: string; slug?: string }) =>
      req<{ account: PublicAccount }>(`/api/admin/accounts/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    /** Un compte désactivé seulement ; tout ce qu'il a laissé part avec lui. */
    remove: (id: string) => req<{ ok: true }>(`/api/admin/accounts/${id}`, { method: 'DELETE' }),
  },
}

/**
 * Qui est connecté, demandé une seule fois par page. Les pages publiques
 * s'en servent pour reconnaître l'animateur de l'espace ; un invité reçoit
 * 401, et c'est le cas normal : null, sans bruit.
 */
let meOnce: Promise<Me | null> | null = null
export function currentMe(): Promise<Me | null> {
  if (!meOnce) meOnce = api.auth.me().catch(() => null)
  return meOnce
}

/**
 * Réduit et recompresse la photo dans le navigateur avant l'envoi : une photo
 * de téléphone fait 4 Mo, on n'en garde que ~100 Ko — la base reste légère et
 * l'affichage instantané sur l'écran commun.
 *
 * WebP d'abord, un quart plus léger que le JPEG à qualité égale. Un navigateur
 * qui ne sait pas l'encoder répond avec un autre format : on repasse alors en
 * JPEG plutôt que d'envoyer un PNG de plusieurs mégaoctets.
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
  const webp = canvas.toDataURL('image/webp', quality)
  if (webp.startsWith('data:image/webp')) return webp
  return canvas.toDataURL('image/jpeg', quality)
}
