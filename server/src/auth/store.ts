import type { InStatement } from '@libsql/client'
import { ajouterColonne, clientDistant, type Client } from '../core/distante'
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
 * qu'une instance, c'est la mémoire qu'on lit.
 *
 * Mais c'est la base qu'on écrit d'abord, et la mémoire ne suit qu'une fois
 * l'écriture faite. Dans l'autre ordre, une écriture que Turso refusait
 * laissait la route dire « Erreur serveur » pendant que le changement valait
 * quand même — un rattachement ouvrait la console, une adresse renommée
 * menait à l'espace — jusqu'au prochain redémarrage, qui le défaisait sans
 * un mot. Une révocation refusée, elle, ne se retentait même plus : la
 * mémoire l'avait déjà oubliée, et la session ressuscitait au réveil.
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
  /**
   * Le profil qui a ouvert cette console, quand c'est sa porte qui a servi
   * (`ouvrirConsole`) ; null pour le mot de passe du compte. C'est ce qui
   * permet de refermer ses consoles à lui, et à lui seul : quand il se
   * déconnecte, et partout quand son mot de passe change ou qu'il perd
   * l'espace.
   */
  profileId: string | null
}

const SESSION_MS = 30 * 24 * 3600 * 1000
/** L'expiration glisse à chaque visite, mais on ne l'écrit qu'une fois par heure. */
const SLIDE_EVERY_MS = 3600 * 1000
const ACTIVATION_MS = 7 * 24 * 3600 * 1000

const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

/**
 * La base a le dernier mot sur l'unicité. La mémoire ne suit qu'après
 * l'écriture : deux demandes simultanées — un double clic sur « Créer le
 * compte », deux renommages croisés — passent ensemble la vérification en
 * mémoire, et la base refuse la seconde. Ce refus doit se lire comme si elle
 * était arrivée après, pas « Erreur serveur » pour un compte bel et bien créé.
 */
function siDoublon(e: unknown): never {
  const message = String((e as { message?: unknown } | null)?.message ?? '')
  if (message.includes('UNIQUE constraint failed: accounts.login')) throw new Error('Cet identifiant est déjà pris')
  if (message.includes('UNIQUE constraint failed: accounts.slug')) throw new Error('Ce nom d’adresse est déjà pris')
  throw e
}

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
           user_agent   TEXT NOT NULL DEFAULT '',
           profile_id   TEXT
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
    // Le rattachement au profil joueur est arrivé après les comptes, et le
    // profil qui ouvre une console après lui : une base d'avant ne les a pas.
    await ajouterColonne(this.client, 'accounts', 'profile_id', 'TEXT')
    await ajouterColonne(this.client, 'auth_sessions', 'profile_id', 'TEXT')
    // La porte du profil ouvrait déjà la console avant que la session retienne
    // qui l'avait ouverte, et se déconnecter de son profil fermait alors la
    // console de ce navigateur dès que l'espace lui était rattaché. Sans
    // étiquette, ces consoles-là passaient pour ouvertes avec le mot de passe
    // du compte : « ce n'est pas moi », tapé sur un téléphone prêté, laissait
    // la soirée pilotable par le suivant. Celles d'un espace rattaché suivent
    // donc son profil, une fois pour toutes — le drapeau empêche d'attribuer
    // au profil, plus tard, une console du mot de passe du compte. Le prix :
    // une télé ouverte avant avec ce mot de passe-là se referme aussi quand le
    // profil change de secret. Une reconnexion, une fois.
    if ((await this.getFlag('sessions_profil')) === null) {
      await this.client.batch(
        [
          `UPDATE auth_sessions SET profile_id = (SELECT a.profile_id FROM accounts a WHERE a.id = auth_sessions.account_id)
           WHERE profile_id IS NULL`,
          { sql: `INSERT INTO meta (key, value) VALUES ('sessions_profil', ?) ON CONFLICT(key) DO NOTHING`, args: [String(now)] },
        ],
        'write',
      )
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
        profileId: row.profile_id === null || row.profile_id === undefined ? null : String(row.profile_id),
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
   *
   * Le profil qui perd l'espace — détaché, ou remplacé par un autre — en
   * perd aussi les consoles qu'il avait ouvertes. Les laisser, c'était
   * laisser trente jours dedans qui avait appris son mot de passe, alors que
   * détacher est justement le geste de qui en doute, ou de qui passe la main.
   * Sauf `garder`, la console d'où l'on fait le geste : mettre quelqu'un à la
   * porte de la page où il vient de cliquer l'enfermerait dehors s'il a
   * oublié le mot de passe du compte.
   */
  async linkProfile(accountId: string, profileId: string | null, garder?: string): Promise<AccountRec> {
    const rec = this.accounts.get(accountId)
    if (!rec) throw new Error('Compte introuvable')
    const pris = 'Ce profil anime déjà un autre espace'
    if (profileId) {
      const autre = this.byProfile(profileId)
      if (autre && autre.id !== accountId) throw new Error(pris)
    }
    const ancien = rec.profileId && rec.profileId !== profileId ? rec.profileId : null
    const fermees = ancien
      ? [...this.sessions.values()].filter(s => s.accountId === accountId && s.profileId === ancien && s.id !== garder)
      : []
    // La base tranche aussi : la mémoire ne suit qu'après l'écriture, et deux
    // rattachements du même profil à deux espaces passeraient ensemble la
    // vérification du dessus. Les consoles tombent dans la même transaction,
    // et seulement si le lien a bien changé : un détachement écrit à moitié
    // laisserait l'intrus dedans, sans rien à refaire pour l'en sortir — un
    // second essai ne trouverait plus de profil à détacher.
    const [lien] = await this.client.batch(
      [
        {
          sql: `UPDATE accounts SET profile_id = ? WHERE id = ?
                AND (? IS NULL OR NOT EXISTS (SELECT 1 FROM accounts WHERE profile_id = ? AND id <> ?))`,
          args: [profileId, accountId, profileId, profileId, accountId],
        },
        ...(ancien
          ? [
              {
                sql: `DELETE FROM auth_sessions WHERE account_id = ? AND profile_id = ? AND id IS NOT ?
                      AND EXISTS (SELECT 1 FROM accounts WHERE id = ? AND profile_id IS NOT ?)`,
                args: [accountId, ancien, garder ?? null, accountId, ancien],
              },
            ]
          : []),
      ],
      'write',
    )
    if (lien.rowsAffected === 0) throw new Error(profileId ? pris : 'Compte introuvable')
    rec.profileId = profileId
    for (const s of fermees) this.sessions.delete(s.id)
    for (const s of fermees) for (const cb of this.revokeListeners) cb(s.id)
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
    await this.client
      .execute({
        sql: `INSERT INTO accounts (id, login, name, slug, role, password_hash, disabled_at, created_at, last_login_at, settings)
              VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?)`,
        args: [rec.id, rec.login, rec.name, rec.slug, rec.role, rec.createdAt, JSON.stringify(rec.settings)],
      })
      .catch(siDoublon)
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
    const now = Date.now()
    await this.client.execute({ sql: 'UPDATE accounts SET last_login_at = ? WHERE id = ?', args: [now, id] })
    rec.lastLoginAt = now
  }

  /** Désactiver ferme toutes les sessions ; réactiver ne rouvre rien. */
  async setDisabled(id: string, disabled: boolean): Promise<AccountRec> {
    const rec = this.require(id)
    const disabledAt = disabled ? Date.now() : null
    await this.client.execute({ sql: 'UPDATE accounts SET disabled_at = ? WHERE id = ?', args: [disabledAt, id] })
    rec.disabledAt = disabledAt
    if (disabled) await this.revokeAllSessions(id)
    return rec
  }

  async update(id: string, patch: { name?: unknown; slug?: unknown }): Promise<AccountRec> {
    const rec = this.require(id)
    // Seules les colonnes demandées s'écrivent : la mémoire ne suit qu'après
    // coup, et deux retouches croisées ne doivent pas s'écraser l'une l'autre.
    const champs: { name?: string; slug?: string } = {}
    if (patch.name !== undefined) {
      const name = tronquer(String(patch.name ?? '').trim(), 40)
      if (!name) throw new Error('Il faut un prénom ou un nom')
      champs.name = name
    }
    if (patch.slug !== undefined) {
      const slug = normalizeSlug(patch.slug)
      if (!isValidSlug(slug)) throw new Error('Nom dans l’adresse : 2 à 24 caractères, lettres, chiffres, tirets — et pas un mot réservé')
      const other = this.bySlug(slug)
      if (other && other.id !== id) throw new Error('Ce nom d’adresse est déjà pris')
      champs.slug = slug
    }
    const colonnes = Object.keys(champs) as (keyof typeof champs)[]
    if (colonnes.length === 0) return rec
    await this.client
      .execute({
        sql: `UPDATE accounts SET ${colonnes.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
        args: [...colonnes.map(c => champs[c]!), id],
      })
      .catch(siDoublon)
    Object.assign(rec, champs)
    return rec
  }

  async updateSettings(id: string, raw: unknown): Promise<AccountRec> {
    const rec = this.require(id)
    const settings = normalizeSettings(raw, rec.name)
    await this.client.execute({ sql: 'UPDATE accounts SET settings = ? WHERE id = ?', args: [JSON.stringify(settings), id] })
    rec.settings = settings
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
  async createSession(accountId: string, userAgent: string, profileId: string | null = null): Promise<string> {
    const token = newToken()
    const now = Date.now()
    const rec: SessionRec = {
      id: fingerprint(token),
      accountId,
      createdAt: now,
      expiresAt: now + SESSION_MS,
      lastSeenAt: now,
      profileId,
    }
    await this.client.execute({
      sql: `INSERT INTO auth_sessions (id, account_id, created_at, expires_at, last_seen_at, user_agent, profile_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [rec.id, accountId, now, rec.expiresAt, now, userAgent.slice(0, 200), profileId],
    })
    this.sessions.set(rec.id, rec)
    return token
  }

  /**
   * Le compte derrière un jeton, ou null : inconnu, expiré, compte désactivé.
   * Synchrone — tout est en mémoire — pour servir aussi la poignée de main
   * socket. L'expiration glisse en arrière-plan.
   *
   * Seul endroit où la mémoire passe devant la base, et exprès : une session
   * expirée qui resterait en base est effacée au démarrage suivant, et une
   * expiration qui n'aurait pas glissé en base ne fait, au pire, que
   * redemander le mot de passe un peu plus tôt.
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
    if (!this.sessions.has(sessionId)) return
    await this.client.execute({ sql: 'DELETE FROM auth_sessions WHERE id = ?', args: [sessionId] })
    // Une révocation simultanée de la même session a pu passer entre-temps :
    // elle a déjà prévenu les écrans.
    if (!this.sessions.delete(sessionId)) return
    for (const cb of this.revokeListeners) cb(sessionId)
  }

  /** Toutes les sessions d'un compte : changement de mot de passe, désactivation. */
  async revokeAllSessions(accountId: string): Promise<void> {
    await this.retirerSessions(s => s.accountId === accountId, {
      sql: 'DELETE FROM auth_sessions WHERE account_id = ?',
      args: [accountId],
    })
  }

  /**
   * Les consoles que ce profil a ouvertes, sur tous les appareils : son mot
   * de passe vient de changer, ou son code de secours de servir. Celles du
   * mot de passe du compte restent — l'écran commun de la fête ne s'éteint
   * pas parce que l'animateur a changé son mot de passe de joueur.
   */
  async revokeProfileSessions(profileId: string): Promise<void> {
    await this.retirerSessions(s => s.profileId === profileId, {
      sql: 'DELETE FROM auth_sessions WHERE profile_id = ?',
      args: [profileId],
    })
  }

  /**
   * Retire des sessions — en base d'abord, en mémoire ensuite — puis coupe
   * les écrans qu'elles avaient ouverts. La mémoire ne perd que celles
   * qu'elle connaissait AVANT d'écrire : une session ouverte pendant
   * l'aller-retour, oubliée ici mais restée en base, ressusciterait au réveil.
   */
  private async retirerSessions(visees: (s: SessionRec) => boolean, suppression: InStatement): Promise<void> {
    const ids = [...this.sessions.values()].filter(visees).map(s => s.id)
    await this.client.execute(suppression)
    for (const id of ids) this.sessions.delete(id)
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
