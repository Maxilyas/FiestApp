import type { Express, NextFunction, Request, Response } from 'express'
import type { AccountRec, AuthStore } from './store'
import { Budget } from '../core/budget'

/**
 * La session d'un animateur, côté HTTP : un cookie que le navigateur garde
 * pour lui (`httpOnly`), n'envoie qu'en HTTPS en ligne (`Secure`) et
 * n'attache pas aux requêtes venues d'un autre site (`SameSite=Lax`).
 * Les scripts de la page ne le voient pas ; un lien piégé ne l'emporte pas.
 */
export const COOKIE = 'qz_session'
const SESSION_MAX_AGE_MS = 30 * 24 * 3600 * 1000
/** Ce à quoi ressemble un jeton de session : rien d'autre n'atteint la base. */
const TOKEN = /^[A-Za-z0-9_-]{20,128}$/

/** Les cookies d'un en-tête. Le format est simple, on n'en lit qu'un : pas de dépendance. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const key = part.slice(0, i).trim()
    const value = part.slice(i + 1).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(value)
    } catch {
      out[key] = value
    }
  }
  return out
}

export function readSessionToken(cookieHeader: string | undefined): string | null {
  const value = parseCookies(cookieHeader)[COOKIE]
  return value && TOKEN.test(value) ? value : null
}

export function setSessionCookie(res: Response, token: string, secure: boolean) {
  res.cookie(COOKIE, token, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE_MS })
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' })
}

/**
 * La session d'un joueur : un second cookie, distinct de celui de
 * l'animateur. C'est délibéré — un animateur peut être connecté aux deux en
 * même temps, dans le même navigateur, et piloter sa soirée depuis la TV tout
 * en y jouant depuis son téléphone.
 *
 * Un an, parce qu'un invité ne doit pas avoir à se reconnecter d'une fête à
 * l'autre — c'est précisément ce qui ferait renoncer à avoir un profil.
 */
export const PLAYER_COOKIE = 'qz_joueur'
const PLAYER_MAX_AGE_MS = 365 * 24 * 3600 * 1000

export function readPlayerToken(cookieHeader: string | undefined): string | null {
  const value = parseCookies(cookieHeader)[PLAYER_COOKIE]
  return value && TOKEN.test(value) ? value : null
}

export function setPlayerCookie(res: Response, token: string, secure: boolean) {
  res.cookie(PLAYER_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: PLAYER_MAX_AGE_MS,
  })
}

export function clearPlayerCookie(res: Response) {
  res.clearCookie(PLAYER_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' })
}

/** L'adresse du client — derrière le proxy de l'hébergeur si `trust proxy` est posé. */
export const clientIp = (req: Request): string => req.ip || req.socket.remoteAddress || ''

/**
 * Contre les requêtes forgées depuis un autre site : toute écriture doit
 * porter un en-tête que seule notre page envoie (un formulaire ou une page
 * tierce ne peut pas l'ajouter sans une pré-vérification que le serveur ne
 * répond jamais), et en ligne, venir de notre origine.
 */
export function csrfGuard(opts: { online: boolean; publicOrigin: string | null }) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next()
    if (req.header('x-requested-with') !== 'quizz') return res.status(403).json({ error: 'Requête refusée' })
    const origin = req.header('origin')
    if (opts.online && opts.publicOrigin && origin && origin !== opts.publicOrigin) {
      return res.status(403).json({ error: 'Requête refusée' })
    }
    next()
  }
}

/** Ce que les routes trouvent dans `res.locals` derrière `requireAccount`. */
export interface AuthedLocals {
  account: AccountRec
  sessionId: string
}

/** La porte : sans session valable, 401 et rien d'autre. */
export function requireAccount(auth: AuthStore) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', 'no-store')
    const token = readSessionToken(req.header('cookie'))
    const found = token ? auth.resolveSession(token) : null
    if (!found) return res.status(401).json({ error: 'Connexion requise' })
    res.locals.account = found.account
    res.locals.sessionId = found.session.id
    next()
  }
}

export function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  if ((res.locals as Partial<AuthedLocals>).account?.role !== 'admin') {
    return res.status(403).json({ error: 'Réservé à l’administrateur' })
  }
  next()
}

export const accountOf = (res: Response): AccountRec => (res.locals as AuthedLocals).account
export const sessionOf = (res: Response): string => (res.locals as AuthedLocals).sessionId

/**
 * La limite des essais de connexion : par adresse (une rafale de vingt, puis
 * vingt par minute) et par identifiant visé (cinq échecs et le compte se
 * ferme un quart d'heure, d'où que viennent les essais). Pas d'exemption
 * pour l'adresse locale : le test de bout en bout doit pouvoir la déclencher.
 *
 * Une seule par serveur, que toutes les portes se partagent : voir
 * `loginBudgetOf`.
 */
export class LoginBudget {
  private byIp = new Budget(20, 20)
  private locks = new Map<string, { failures: number; until: number }>()

  /**
   * Un essai depuis cette adresse, contre ce secret-là s'il est nommé. Sans
   * clé, seule la réserve de l'adresse compte : c'est le cas d'un jeton trop
   * long pour être deviné, qu'aucun verrou ne protégerait mieux — et qu'un
   * verrou rendrait inutilisable à qui s'est trompé de lien cinq fois.
   */
  allow(ip: string, key?: string): boolean {
    if (!this.byIp.take(ip)) return false
    if (key === undefined) return true
    const lock = this.locks.get(key)
    return !lock || lock.until <= Date.now()
  }

  failed(login: string) {
    const lock = this.locks.get(login) ?? { failures: 0, until: 0 }
    lock.failures++
    if (lock.failures >= 5) {
      lock.until = Date.now() + 15 * 60_000
      lock.failures = 0
    }
    this.locks.set(login, lock)
    if (this.locks.size > 2000) {
      const now = Date.now()
      for (const [key, l] of this.locks) if (l.until <= now && l.failures === 0) this.locks.delete(key)
    }
  }

  succeeded(login: string) {
    this.locks.delete(login)
  }
}

const budgets = new WeakMap<Express, LoginBudget>()

/**
 * La réserve d'essais d'un serveur, commune à toutes ses portes.
 *
 * Le mot de passe du compte, celui du profil rattaché et le code de secours
 * ouvrent la même console (`ouvrirConsole`, dans `profileRoutes.ts`) : avec
 * une réserve par routeur, qui alternait les portes avait deux fois plus
 * d'essais. Elle est rangée par application plutôt que dans le module : les
 * tests font tourner plusieurs serveurs dans le même processus, et les essais
 * de l'un n'ont pas à fermer la porte de l'autre.
 */
export function loginBudgetOf(app: Express): LoginBudget {
  let budget = budgets.get(app)
  if (!budget) {
    budget = new LoginBudget()
    budgets.set(app, budget)
  }
  return budget
}
