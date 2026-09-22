import { clientDistant, type Client } from '../core/distante'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { hashPassword } from './password'
import { tronquer } from '../../../shared/avatars'
import {
  isValidLogin,
  isValidSlug,
  normalizeLogin,
  normalizeSettings,
  normalizeSlug,
  type PublicAccount,
  type PublicSpace,
  type SpaceSettings,
} from '../../../shared/space'

/**
 * Les comptes des animateurs, leurs sessions et leurs liens d'activation.
 *
 * Tout vit dans la base permanente, avec la bibliothèque et les archives,
 * et tout est aussi en mémoire : une poignée de comptes, quelques sessions
 * ouvertes — relire la base distante à chaque requête et à chaque poignée
 * de main socket coûterait un aller-retour pour rien. Le serveur n'ayant
 * qu'une instance, la mémoire fait foi et les écritures suivent.
 *
 * Des jetons, on ne garde que l'empreinte : une base qui fuit ne livre
 * aucune session utilisable.
 */
export interface AccountRec {
  id: string
  login: string
  name: string
  slug: string
  role: 'admin' | 'host'
  /** Null tant que le compte n'a pas été activé. */
  passwordHash: string | null
  disabledAt: number | null
  createdAt: number
  lastLoginAt: number | null
  settings: SpaceSettings
  /**
   * Le profil joueur de la même personne, s'il s'est rattaché.
   *
   * Un compte reste un ESPACE — c'est son `id` qui cloisonne toute
   * l'application, et il ne bouge pas. Le rattachement dit seulement qui le
   * tient : celui qui se connecte avec ce profil anime cet espace, et joue
   * ses soirées sous le même niveau que partout ailleurs.
   */
  profileId: string | null
}

export interface SessionRec {
  id: string
  accountId: string
  createdAt: number
  expiresAt: number
  lastSeenAt: number
}

const SESSION_MS = 30 * 24 * 3600 * 1000
/** L'expiration glisse à chaque visite, mais on ne l'écrit qu'une fois par heure. */
const SLIDE_EVERY_MS = 3600 * 1000
const ACTIVATION_MS = 7 * 24 * 3600 * 1000

const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

export class AuthStore {
  private client: Client
  private accounts = new Map<string, AccountRec>()
  private sessions = new Map<string, SessionRec>()
  private revokeListeners = new Set<(sessionId: string) => void>()
  private defaultSpace = ''

  constructor(url: string, authToken?: string) {
    this.client = clientDistant(url, authToken)
  }

  async init() {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS accounts (
           id            TEXT PRIMARY KEY,
           login         TEXT NOT NULL UNIQUE,
           name          TEXT NOT NULL,
           slug          TEXT NOT NULL UNIQUE,
           role          TEXT NOT NULL,
           password_hash TEXT,
           disabled_at   INTEGER,
           created_at    INTEGER NOT NULL,
           last_login_at INTEGER,
           settings      TEXT NOT NULL DEFAULT '{}'
         )`,
        `CREATE TABLE IF NOT EXISTS auth_sessions (
           id           TEXT PRIMARY KEY,
           account_id   TEXT NOT NULL,
           created_at   INTEGER NOT NULL,
           expires_at   INTEGER NOT NULL,
           last_seen_at INTEGER NOT NULL,
           user_agent   TEXT NOT NULL DEFAULT ''
         )`,
        `CREATE INDEX IF NOT EXISTS idx_auth_sessions_account ON auth_sessions(account_id)`,
        `CREATE TABLE IF NOT EXISTS activations (
           id         TEXT PRIMARY KEY,
           account_id TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           expires_at INTEGER NOT NULL,
           used_at    INTEGER
         )`,
        `CREATE INDEX IF NOT EXISTS idx_activations_account ON activations(account_id)`,
        `CREATE TABLE IF NOT EXISTS meta (
           key   TEXT PRIMARY KEY,
           value TEXT NOT NULL
         )`,
      ],
      'write',
    )
    const now = Date.now()
    // Le ménage d'abord : ce qui a expiré n'a pas à remonter en mémoire.
    await this.client.batch(
      [
        { sql: 'DELETE FROM auth_sessions WHERE expires_at <= ?', args: [now] },
        { sql: 'DELETE FROM activations WHERE expires_at <= ? OR used_at IS NOT NULL', args: [now] },
      ],
      'write',
    )
    // Le rattachement au profil joueur est arrivé après les comptes : une
    // base d'avant ne l'a pas. libsql n'a pas d'« ADD COLUMN IF NOT EXISTS ».
    try {
      await this.client.execute('ALTER TABLE accounts ADD COLUMN profile_id TEXT')
    } catch {
      // Colonne déjà là : le cas normal après le premier démarrage.
    }
    const accounts = await this.client.execute('SELECT * FROM accounts')
    for (const row of accounts.rows) {
      const account = toAccount(row)
      this.accounts.set(account.id, account)
    }
    const sessions = await this.client.execute('SELECT * FROM auth_sessions')
    for (const row of sessions.rows) {
      this.sessions.set(String(row.id), {
        id: String(row.id),
        accountId: String(row.account_id),
        createdAt: Number(row.created_at),
        expiresAt: Number(row.expires_at),
        lastSeenAt: Number(row.last_seen_at),
      })
    }
  }

  // ── Comptes ─────────────────────────────────────────────────────────────

  byId(id: string): AccountRec | undefined {
    return this.accounts.get(id)
  }

  byLogin(login: string): AccountRec | undefined {
    const clean = normalizeLogin(login)
    for (const a of this.accounts.values()) if (a.login === clean) return a
    return undefined
  }

  /** Le compte derrière un nom d'adresse, tel qu'il a pu être tapé (« Romane » vaut « romane »). */
  bySlug(slug: unknown): AccountRec | undefined {
    const clean = normalizeSlug(slug)
    if (!clean) return undefined
    for (const a of this.accounts.values()) if (a.slug === clean) return a
    return undefined
  }

  /**
   * L'espace que tient ce profil joueur, s'il en tient un.
   *
   * En mémoire, comme tout le reste ici : il y a une poignée de comptes, et
   * cette question se pose à chaque connexion de joueur.
   */
  byProfile(profileId: string): AccountRec | undefined {
    if (!profileId) return undefined
    for (const a of this.accounts.values()) if (a.profileId === profileId) return a
    return undefined
  }

  /**
   * Rattache (ou détache, avec `null`) le profil joueur d'un animateur.
   *
   * Un profil ne tient qu'un espace, et un espace n'a qu'un profil : c'est
   * la même personne des deux côtés, et deux animateurs qui partageraient un
   * profil partageraient aussi leur porte d'entrée.
   */
  async linkProfile(accountId: string, profileId: string | null): Promise<AccountRec> {
    const rec = this.accounts.get(accountId)
    if (!rec) throw new Error('Compte introuvable')
    if (profileId) {
      const autre = this.byProfile(profileId)
      if (autre && autre.id !== accountId) throw new Error('Ce profil anime déjà un autre espace')
    }
    rec.profileId = profileId
    await this.client.execute({
      sql: 'UPDATE accounts SET profile_id = ? WHERE id = ?',
      args: [profileId, accountId],
    })
    return rec
  }

  /** L'espace par défaut — celui de l'administrateur, connu après `ensureDefaultSpace`. */
  get defaultSpaceId(): string {
    return this.defaultSpace
  }

  defaultAccount(): AccountRec | undefined {
    return this.accounts.get(this.defaultSpace)
  }

  /** Tous les comptes, dans l'ordre de création. */
  list(): AccountRec[] {
    return [...this.accounts.values()].sort((a, b) => a.createdAt - b.createdAt)
  }

  count(): number {
    return this.accounts.size
  }

  toPublic(a: AccountRec): PublicAccount {
    return {
      id: a.id,
      login: a.login,
      name: a.name,
      slug: a.slug,
      role: a.role,
      status: a.disabledAt ? 'disabled' : a.passwordHash ? 'active' : 'pending',
      createdAt: a.createdAt,
      lastLoginAt: a.lastLoginAt,
    }
  }

  /** L'espace tel que les pages publiques et les téléphones le voient. */
  publicSpace(a: AccountRec): PublicSpace {
    return { slug: a.slug, name: a.name, ...a.settings }
  }

  /**
   * Crée un compte, sans mot de passe : il s'activera par son lien. Les
   * refus sont des erreurs lisibles, l'administration les affiche telles quelles.
   */
  async create(input: { login: unknown; name: unknown; slug: unknown; role?: 'admin' | 'host' }): Promise<AccountRec> {
    const login = normalizeLogin(input.login)
    const name = tronquer(String(input.name ?? '').trim(), 40)
    const slug = normalizeSlug(input.slug)
    if (!isValidLogin(login)) throw new Error('Identifiant : 2 à 32 caractères, lettres, chiffres, point, tiret')
    if (!name) throw new Error('Il faut un prénom ou un nom')
    if (!isValidSlug(slug)) throw new Error('Nom dans l’adresse : 2 à 24 caractères, lettres, chiffres, tirets — et pas un mot réservé')
    if (this.byLogin(login)) throw new Error('Cet identifiant est déjà pris')
    if (this.bySlug(slug)) throw new Error('Ce nom d’adresse est déjà pris')
    const rec: AccountRec = {
      id: randomUUID(),
      login,
      name,
      slug,
      role: input.role ?? 'host',
      passwordHash: null,
      disabledAt: null,
      createdAt: Date.now(),
      lastLoginAt: null,
      settings: normalizeSettings({}, name),
      profileId: null,
    }
    await this.client.execute({
      sql: `INSERT INTO accounts (id, login, name, slug, role, password_hash, disabled_at, created_at, last_login_at, settings)
            VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?)`,
      args: [rec.id, rec.login, rec.name, rec.slug, rec.role, rec.createdAt, JSON.stringify(rec.settings)],
    })
    this.accounts.set(rec.id, rec)
    return rec
  }

  async setPassword(id: string, password: string): Promise<void> {
    const rec = this.require(id)
    const hash = await hashPassword(password)
    await this.client.execute({ sql: 'UPDATE accounts SET password_hash = ? WHERE id = ?', args: [hash, id] })
    rec.passwordHash = hash
  }

  async touchLogin(id: string): Promise<void> {
    const rec = this.require(id)
    rec.lastLoginAt = Date.now()
    await this.client.execute({ sql: 'UPDATE accounts SET last_login_at = ? WHERE id = ?', args: [rec.lastLoginAt, id] })
  }

  /** Désactiver ferme toutes les sessions ; réactiver ne rouvre rien. */
  async setDisabled(id: string, disabled: boolean): Promise<AccountRec> {
    const rec = this.require(id)
    rec.disabledAt = disabled ? Date.now() : null
    await this.client.execute({ sql: 'UPDATE accounts SET disabled_at = ? WHERE id = ?', args: [rec.disabledAt, id] })
    if (disabled) await this.revokeAllSessions(id)
    return rec
  }

  async update(id: string, patch: { name?: unknown; slug?: unknown }): Promise<AccountRec> {
    const rec = this.require(id)
    if (patch.name !== undefined) {
      const name = tronquer(String(patch.name ?? '').trim(), 40)
      if (!name) throw new Error('Il faut un prénom ou un nom')
      rec.name = name
    }
    if (patch.slug !== undefined) {
      const slug = normalizeSlug(patch.slug)
      if (!isValidSlug(slug)) throw new Error('Nom dans l’adresse : 2 à 24 caractères, lettres, chiffres, tirets — et pas un mot réservé')
      const other = this.bySlug(slug)
      if (other && other.id !== id) throw new Error('Ce nom d’adresse est déjà pris')
      rec.slug = slug
    }
    await this.client.execute({ sql: 'UPDATE accounts SET name = ?, slug = ? WHERE id = ?', args: [rec.name, rec.slug, id] })
    return rec
  }

  async updateSettings(id: string, raw: unknown): Promise<AccountRec> {
    const rec = this.require(id)
    rec.settings = normalizeSettings(raw, rec.name)
    await this.client.execute({ sql: 'UPDATE accounts SET settings = ? WHERE id = ?', args: [JSON.stringify(rec.settings), id] })
    return rec
  }

  /**
   * L'espace par défaut : celui de l'administrateur, créé au tout premier
   * démarrage depuis les variables d'environnement. C'est à lui que sont
   * rattachées les données d'avant les comptes (bibliothèque, archives,
   * soirée en cours). Le mot de passe d'amorçage ne sert qu'à cette
   * création : il se change ensuite depuis « Mon compte ».
   */
  async ensureDefaultSpace(bootstrap: { login: string; password: string; slug: string; name: string }): Promise<string> {
    if (this.accounts.size === 0) {
      const admin = await this.create({ ...bootstrap, role: 'admin' })
      await this.setPassword(admin.id, bootstrap.password)
      await this.setFlag('default_space', admin.id)
      this.defaultSpace = admin.id
      return admin.id
    }
    const flagged = await this.getFlag('default_space')
    if (flagged && this.accounts.has(flagged)) {
      this.defaultSpace = flagged
      return flagged
    }
    const admin = this.list().find(a => a.role === 'admin') ?? this.list()[0]
    await this.setFlag('default_space', admin.id)
    this.defaultSpace = admin.id
    return admin.id
  }

  /**
   * Supprime un compte : ses sessions, ses liens d'activation, sa ligne. À
   * n'appeler qu'une fois ses données effacées (voir `createQuizServer`) :
   * la ligne part en dernier, pour qu'un échec en route laisse un compte sur
   * lequel réessayer plutôt que des données sans maître. L'identifiant et
   * l'adresse redeviennent libres aussitôt.
   */
  async remove(id: string): Promise<void> {
    this.require(id)
    if (id === this.defaultSpace) throw new Error('L’espace par défaut ne se supprime pas')
    await this.revokeAllSessions(id)
    await this.client.batch(
      [
        { sql: 'DELETE FROM activations WHERE account_id = ?', args: [id] },
        { sql: 'DELETE FROM auth_sessions WHERE account_id = ?', args: [id] },
        { sql: 'DELETE FROM accounts WHERE id = ?', args: [id] },
      ],
      'write',
    )
    this.accounts.delete(id)
  }

  // ── Sessions ────────────────────────────────────────────────────────────

  /** Ouvre une session et rend le jeton brut — la seule fois où il existe côté serveur. */
  async createSession(accountId: string, userAgent: string): Promise<string> {
    const token = newToken()
    const now = Date.now()
    const rec: SessionRec = { id: fingerprint(token), accountId, createdAt: now, expiresAt: now + SESSION_MS, lastSeenAt: now }
    await this.client.execute({
      sql: `INSERT INTO auth_sessions (id, account_id, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [rec.id, accountId, now, rec.expiresAt, now, userAgent.slice(0, 200)],
    })
    this.sessions.set(rec.id, rec)
    return token
  }

  /**
   * Le compte derrière un jeton, ou null : inconnu, expiré, compte désactivé.
   * Synchrone — tout est en mémoire — pour servir aussi la poignée de main
   * socket. L'expiration glisse en arrière-plan.
   */
  resolveSession(token: string): { account: AccountRec; session: SessionRec } | null {
    const session = this.sessions.get(fingerprint(token))
    if (!session) return null
    const now = Date.now()
    if (session.expiresAt <= now) {
      this.sessions.delete(session.id)
      this.client.execute({ sql: 'DELETE FROM auth_sessions WHERE id = ?', args: [session.id] }).catch(() => {})
      return null
    }
    const account = this.accounts.get(session.accountId)
    if (!account || account.disabledAt) return null
    if (now - session.lastSeenAt > SLIDE_EVERY_MS) {
      session.lastSeenAt = now
      session.expiresAt = now + SESSION_MS
      this.client
        .execute({
          sql: 'UPDATE auth_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?',
          args: [now, session.expiresAt, session.id],
        })
        .catch(() => {})
    }
    return { account, session }
  }

  async revokeSession(sessionId: string): Promise<void> {
    if (!this.sessions.delete(sessionId)) return
    await this.client.execute({ sql: 'DELETE FROM auth_sessions WHERE id = ?', args: [sessionId] })
    for (const cb of this.revokeListeners) cb(sessionId)
  }

  /** Toutes les sessions d'un compte : changement de mot de passe, désactivation. */
  async revokeAllSessions(accountId: string): Promise<void> {
    const ids = [...this.sessions.values()].filter(s => s.accountId === accountId).map(s => s.id)
    for (const id of ids) this.sessions.delete(id)
    await this.client.execute({ sql: 'DELETE FROM auth_sessions WHERE account_id = ?', args: [accountId] })
    for (const id of ids) for (const cb of this.revokeListeners) cb(id)
  }

  /** Prévenu à chaque session révoquée : les sockets de l'écran commun se coupent. */
  onRevoke(cb: (sessionId: string) => void) {
    this.revokeListeners.add(cb)
  }

  // ── Activations ─────────────────────────────────────────────────────────

  /** Un nouveau lien d'activation ; les précédents ne valent plus rien. */
  async createActivation(accountId: string): Promise<{ token: string; expiresAt: number }> {
    this.require(accountId)
    const token = newToken()
    const now = Date.now()
    const expiresAt = now + ACTIVATION_MS
    await this.client.batch(
      [
        { sql: 'DELETE FROM activations WHERE account_id = ?', args: [accountId] },
        {
          sql: 'INSERT INTO activations (id, account_id, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, NULL)',
          args: [fingerprint(token), accountId, now, expiresAt],
        },
      ],
      'write',
    )
    return { token, expiresAt }
  }

  /**
   * Consomme un lien : le compte qu'il active, ou null s'il est inconnu,
   * périmé ou déjà servi. Une seule requête décide — deux navigateurs qui
   * cliquent en même temps ne l'utilisent pas deux fois.
   */
  async consumeActivation(token: string): Promise<AccountRec | null> {
    if (typeof token !== 'string' || token.length < 20) return null
    const id = fingerprint(token)
    const now = Date.now()
    const res = await this.client.execute({
      sql: 'UPDATE activations SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at > ?',
      args: [now, id, now],
    })
    if (res.rowsAffected !== 1) return null
    const row = await this.client.execute({ sql: 'SELECT account_id FROM activations WHERE id = ?', args: [id] })
    const accountId = row.rows[0] ? String(row.rows[0].account_id) : null
    const account = accountId ? this.accounts.get(accountId) : undefined
    return account && !account.disabledAt ? account : null
  }

  // ── Drapeaux ────────────────────────────────────────────────────────────

  async getFlag(key: string): Promise<string | null> {
    const res = await this.client.execute({ sql: 'SELECT value FROM meta WHERE key = ?', args: [key] })
    return res.rows[0] ? String(res.rows[0].value) : null
  }

  async setFlag(key: string, value: string) {
    await this.client.execute({
      sql: 'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      args: [key, value],
    })
  }

  close() {
    this.client.close()
  }

  private require(id: string): AccountRec {
    const rec = this.accounts.get(id)
    if (!rec) throw new Error('Compte introuvable')
    return rec
  }
}

function toAccount(row: Record<string, unknown>): AccountRec {
  const name = String(row.name)
  let settings: unknown = {}
  try {
    settings = JSON.parse(String(row.settings ?? '{}'))
  } catch {
    settings = {}
  }
  return {
    id: String(row.id),
    login: String(row.login),
    name,
    slug: String(row.slug),
    role: row.role === 'admin' ? 'admin' : 'host',
    passwordHash: row.password_hash === null || row.password_hash === undefined ? null : String(row.password_hash),
    disabledAt: row.disabled_at === null || row.disabled_at === undefined ? null : Number(row.disabled_at),
    createdAt: Number(row.created_at),
    lastLoginAt: row.last_login_at === null || row.last_login_at === undefined ? null : Number(row.last_login_at),
    settings: normalizeSettings(settings, name),
    profileId: row.profile_id === null || row.profile_id === undefined ? null : String(row.profile_id),
  }
}
