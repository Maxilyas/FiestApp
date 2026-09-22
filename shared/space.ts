// Un espace = un compte : son nom dans l'adresse, ses réglages de soirée.
// Partagé : le serveur valide, le client route et affiche.

/** Le nom dans l'adresse : minuscules, chiffres, tirets. Court, il se dicte. */
export const SLUG = /^[a-z0-9-]{2,24}$/
/** L'identifiant de connexion d'un animateur. */
export const LOGIN = /^[a-z0-9._-]{2,32}$/

/**
 * Les premiers segments d'adresse que l'application utilise elle-même : un
 * espace qui s'appellerait « host » masquerait l'écran commun.
 */
export const RESERVED_SLUGS = new Set([
  'host',
  'edit',
  'compte',
  'admin',
  'connexion',
  'activer',
  'joueur',
  'profil',
  'deconnexion',
  'stats',
  'souvenir',
  'bilan',
  'soirees',
  's',
  'api',
  'media',
  'assets',
  'fonts',
  'healthz',
  'socket.io',
  'manifest.webmanifest',
  'icone.svg',
  'recap.json',
  'bilan.json',
  'soirees.json',
  'index.html',
])

/** « Les Salseras ! » → « les-salseras » : accents retirés, espaces en tirets. */
export function normalizeSlug(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
}

export function isValidSlug(slug: string): boolean {
  return SLUG.test(slug) && !RESERVED_SLUGS.has(slug)
}

export function normalizeLogin(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .slice(0, 32)
}

export function isValidLogin(login: string): boolean {
  return LOGIN.test(login)
}

/** Ce qu'un espace dit de sa soirée aux invités et sur ses pages. */
export interface SpaceSettings {
  /** « Les 30 ans de Romane » : le titre des pages souvenir et bilan, et de l'écran commun. */
  title: string
  /** « Les trente ans de » : la ligne au-dessus du grand titre, à l'inscription. */
  eyebrow: string
  /** « Romane » : le grand titre, à l'inscription. */
  headline: string
  /** « 19 septembre 2026 » : la date, telle qu'on l'écrit. Vide si on ne veut rien. */
  dateLine: string
  /** Inscriptions au-delà desquelles la soirée est déclarée complète. */
  maxPlayers: number
}

export const DEFAULT_MAX_PLAYERS = 150
/** Au-delà, l'instance gratuite de l'hébergeur ne suit plus. */
export const MAX_PLAYERS_CEILING = 500

/** Les réglages d'un espace tout neuf : le prénom de l'animateur fait le titre (« La soirée de / Bob »). */
export function defaultSettings(name: string): SpaceSettings {
  return {
    title: `La soirée de ${name}`,
    eyebrow: 'La soirée de',
    headline: name,
    dateLine: '',
    maxPlayers: DEFAULT_MAX_PLAYERS,
  }
}

/** Borne ce qui arrive du navigateur, et comble ce qui manque. */
export function normalizeSettings(raw: unknown, name: string): SpaceSettings {
  const d = defaultSettings(name)
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const text = (v: unknown, fallback: string, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback
  const n = Number(r.maxPlayers)
  return {
    title: text(r.title, d.title, 80),
    eyebrow: text(r.eyebrow, d.eyebrow, 60),
    headline: text(r.headline, d.headline, 40),
    dateLine: typeof r.dateLine === 'string' ? r.dateLine.trim().slice(0, 60) : '',
    maxPlayers: Number.isFinite(n) ? Math.min(MAX_PLAYERS_CEILING, Math.max(2, Math.round(n))) : d.maxPlayers,
  }
}

/** L'espace tel que les pages publiques et les téléphones le voient. */
export interface PublicSpace extends SpaceSettings {
  slug: string
  name: string
}

/** Un compte tel que l'administration et la page « Mon compte » le voient. */
export interface PublicAccount {
  id: string
  login: string
  name: string
  slug: string
  role: 'admin' | 'host'
  /** En attente d'activation, actif, ou désactivé par l'administrateur. */
  status: 'pending' | 'active' | 'disabled'
  createdAt: number
  lastLoginAt: number | null
}
