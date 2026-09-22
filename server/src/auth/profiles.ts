import { createClient, type Client } from '@libsql/client'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { hashPassword, verifyPassword } from './password'
import { cleanAvatar, cleanName, DEFAULT_AVATAR } from '../../../shared/avatars'
import {
  CHANCE_ECLAT,
  finitionValide,
  finitionsOuvertes,
  niveauPour,
  progression,
  XP,
  type Finition,
  type GainSoiree,
  type PublicProfile,
  type PublicProfileDetail,
  type ReleveSoiree,
} from '../../../shared/profil'
import {
  BADGES_CARRIERE,
  rareteDe,
  type BadgePorte,
  type Carriere,
} from '../../../shared/badges'
import { isValidLogin, normalizeLogin } from '../../../shared/space'

/**
 * Les profils des joueurs récurrents, leurs sessions, leur expérience et
 * leurs éclats.
 *
 * Tout vit dans la base permanente, avec les comptes et les archives — la
 * base locale de la soirée est jetable, et « Nouvelle soirée » la vide. Un
 * profil traverse donc les soirées, et les animateurs : c'est tout l'intérêt.
 *
 * ── Ce qui diffère d'`AuthStore`, et pourquoi ────────────────────────────
 *
 * `AuthStore` garde tous les comptes en mémoire : il y en a une poignée. Les
 * profils, eux, peuvent se compter par milliers — on ne les charge donc pas
 * tous. Seules les sessions montent en mémoire (c'est le chemin chaud : une
 * résolution par inscription à une soirée), et un profil s'y range la
 * première fois qu'on le lit. Une soirée en touche au plus quelques
 * dizaines, pas la base entière.
 */
export interface ProfileRec {
  id: string
  login: string
  name: string
  avatar: string
  finition: Finition
  passwordHash: string
  /** Le code de secours, haché lui aussi : la base qui fuit ne rend personne. */
  recoveryHash: string
  xp: number
  createdAt: number
  lastSeenAt: number | null
  disabledAt: number | null
}

interface ProfileSessionRec {
  id: string
  profileId: string
  expiresAt: number
  lastSeenAt: number
}

/** Un an : un invité ne doit pas avoir à se reconnecter d'une fête à l'autre. */
const SESSION_MS = 365 * 24 * 3600 * 1000
const SLIDE_EVERY_MS = 7 * 24 * 3600 * 1000

const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex')
const newToken = () => randomBytes(32).toString('base64url')

/**
 * L'alphabet du code de secours : ni I, ni L, ni O, ni U — on le recopie à la
 * main depuis une capture d'écran, et ces quatre-là se confondent avec 1, 0
 * et V. Seize caractères font quatre-vingts bits, largement de quoi.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'

function newRecoveryCode(): string {
  const bytes = randomBytes(16)
  const chars = [...bytes].map(b => ALPHABET[b % ALPHABET.length])
  return [0, 4, 8, 12].map(i => chars.slice(i, i + 4).join('')).join('-')
}

/** Ce que l'utilisateur tape, tel qu'on le compare : sans tirets ni casse. */
const normalizeRecovery = (raw: unknown) =>
  String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Relit le détail d'une soirée. Les toutes premières lignes écrites ne
 * portaient que le gain : on en redéduit alors le relevé par le barème, ce
 * qui vaut mieux que de perdre une soirée de carrière.
 */
function decodeDetail(raw: string): { gain: GainSoiree; releve: ReleveSoiree } {
  const vide: GainSoiree = { presence: 0, reponses: 0, justesse: 0, podium: 0, quiz: 0 }
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { gain: vide, releve: { reponses: 0, justes: 0, rang: 0, quiz: 0 } }
  }
  const gain: GainSoiree = { ...vide, ...(parsed?.gain ?? parsed) }
  const releve: ReleveSoiree = parsed?.releve ?? {
    reponses: Math.round(gain.reponses / XP.parReponse),
    justes: Math.round(gain.justesse / XP.parBonneReponse),
    rang: gain.podium > 0 ? (XP.podium as readonly number[]).indexOf(gain.podium) + 1 : 0,
    quiz: Math.round(gain.quiz / XP.vainqueurDeQuiz),
  }
  return { gain, releve }
}

export class ProfileStore {
  private client: Client
  private profiles = new Map<string, ProfileRec>()
  private sessions = new Map<string, ProfileSessionRec>()
  /** Les emojis éclatés, par profil — chargés avec le profil. */
  private eclats = new Map<string, Set<string>>()

  constructor(url: string, authToken?: string) {
    this.client = createClient({ url, authToken })
  }

  async init() {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS profiles (
           id            TEXT PRIMARY KEY,
           login         TEXT NOT NULL UNIQUE,
           name          TEXT NOT NULL,
           avatar        TEXT NOT NULL,
           finition      TEXT NOT NULL DEFAULT 'mat',
           password_hash TEXT NOT NULL,
           recovery_hash TEXT NOT NULL,
           xp            INTEGER NOT NULL DEFAULT 0,
           created_at    INTEGER NOT NULL,
           last_seen_at  INTEGER,
           disabled_at   INTEGER
         )`,
        `CREATE TABLE IF NOT EXISTS profile_sessions (
           id           TEXT PRIMARY KEY,
           profile_id   TEXT NOT NULL,
           created_at   INTEGER NOT NULL,
           expires_at   INTEGER NOT NULL,
           last_seen_at INTEGER NOT NULL,
           user_agent   TEXT NOT NULL DEFAULT ''
         )`,
        `CREATE INDEX IF NOT EXISTS idx_profile_sessions_profile ON profile_sessions(profile_id)`,
        // Une ligne par profil et par soirée. La clé primaire rend la
        // consolidation idempotente : archiver deux fois la même soirée
        // recalcule au lieu de créditer deux fois.
        `CREATE TABLE IF NOT EXISTS profile_xp (
           profile_id TEXT NOT NULL,
           soiree_id  TEXT NOT NULL,
           space_id   TEXT NOT NULL,
           xp         INTEGER NOT NULL,
           detail     TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (profile_id, soiree_id)
         )`,
        // Une ligne par badge ET par soirée où il est tombé : la clé rend la
        // consolidation idempotente, et compter les lignes donne gratuitement
        // le nombre de fois où un prix a été décroché.
        `CREATE TABLE IF NOT EXISTS profile_badges (
           profile_id TEXT NOT NULL,
           badge      TEXT NOT NULL,
           soiree_id  TEXT NOT NULL,
           space_id   TEXT NOT NULL,
           emoji      TEXT NOT NULL,
           title      TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (profile_id, badge, soiree_id)
         )`,
        `CREATE INDEX IF NOT EXISTS idx_profile_badges_badge ON profile_badges(badge)`,
        `CREATE TABLE IF NOT EXISTS profile_eclats (
           profile_id TEXT NOT NULL,
           avatar     TEXT NOT NULL,
           soiree_id  TEXT NOT NULL,
           created_at INTEGER NOT NULL,
           PRIMARY KEY (profile_id, avatar)
         )`,
      ],
      'write',
    )
    const now = Date.now()
    await this.client.execute({ sql: 'DELETE FROM profile_sessions WHERE expires_at <= ?', args: [now] })
    // Les sessions seules montent en mémoire : la poignée de main d'un socket
    // ne peut pas attendre un aller-retour vers la base distante.
    const rows = await this.client.execute('SELECT id, profile_id, expires_at, last_seen_at FROM profile_sessions')
    for (const r of rows.rows) {
      this.sessions.set(String(r.id), {
        id: String(r.id),
        profileId: String(r.profile_id),
        expiresAt: Number(r.expires_at),
        lastSeenAt: Number(r.last_seen_at),
      })
    }
  }

  // ── Lecture ─────────────────────────────────────────────────────────────

  /** Le profil s'il est déjà en mémoire — sans aller-retour. */
  cached(id: string): ProfileRec | undefined {
    return this.profiles.get(id)
  }

  /** Le profil, chargé au besoin. Null s'il n'existe pas ou s'il est fermé. */
  async byId(id: string): Promise<ProfileRec | null> {
    const known = this.profiles.get(id)
    if (known) return known.disabledAt ? null : known
    const rows = await this.client.execute({ sql: 'SELECT * FROM profiles WHERE id = ?', args: [id] })
    return this.remember(rows.rows[0])
  }

  async byLogin(login: unknown): Promise<ProfileRec | null> {
    const clean = normalizeLogin(login)
    if (!clean) return null
    for (const p of this.profiles.values()) if (p.login === clean) return p.disabledAt ? null : p
    const rows = await this.client.execute({ sql: 'SELECT * FROM profiles WHERE login = ?', args: [clean] })
    return this.remember(rows.rows[0])
  }

  /** Les emojis qui ont éclaté pour ce profil. */
  eclatsOf(id: string): string[] {
    return [...(this.eclats.get(id) ?? [])]
  }

  /** Combien de badges chaque profil porte — lu avec lui, gardé avec lui. */
  private badgeCount = new Map<string, number>()

  toPublic(p: ProfileRec): PublicProfile {
    const { niveau, acquis, requis } = progression(p.xp)
    return {
      id: p.id,
      login: p.login,
      name: p.name,
      avatar: p.avatar,
      // Un profil dont le niveau aurait baissé (barème retouché) ne garde pas
      // une finition qu'il ne peut plus porter.
      finition: finitionValide(p.finition, niveau),
      xp: p.xp,
      niveau,
      acquis,
      requis,
      ouvertes: finitionsOuvertes(niveau),
      eclats: this.eclatsOf(p.id),
      badges: this.badgeCount.get(p.id) ?? 0,
    }
  }

  /**
   * Le profil au complet, pour sa propre page : l'étagère et l'historique en
   * plus. Ces deux-là coûtent deux requêtes, et n'ont donc rien à faire dans
   * l'accusé de réception que reçoit chaque téléphone qui rejoint une soirée.
   */
  async toDetail(p: ProfileRec, nomDEspace?: (spaceId: string) => string | null): Promise<PublicProfileDetail> {
    const [vitrine, soirees] = await Promise.all([this.badgesOf(p.id), this.historiqueOf(p.id)])
    this.badgeCount.set(p.id, vitrine.length)
    return {
      ...this.toPublic(p),
      vitrine,
      soirees: soirees.map(s => ({
        soireeId: s.soireeId,
        chez: nomDEspace?.(s.spaceId) ?? null,
        xp: s.xp,
        gain: s.gain,
        releve: s.releve,
        at: s.at,
      })),
    }
  }

  // ── Inscription, connexion ──────────────────────────────────────────────

  /**
   * Crée un profil et rend le code de secours — la seule fois où il existe en
   * clair. Sans adresse e-mail : un profil est un bonus, pas une nécessité, et
   * le chemin anonyme reste ouvert à qui perd le sien.
   */
  async register(input: {
    login: unknown
    password: string
    name: unknown
    avatar: unknown
  }): Promise<{ profile: ProfileRec; recovery: string }> {
    const login = normalizeLogin(input.login)
    if (!isValidLogin(login)) {
      throw new Error('Identifiant : 2 à 32 caractères, lettres, chiffres, point, tiret')
    }
    const name = cleanName(input.name)
    if (!name) throw new Error('Il faut un prénom')
    if (await this.byLogin(login)) throw new Error('Cet identifiant est déjà pris')
    const recovery = newRecoveryCode()
    const rec: ProfileRec = {
      id: randomUUID(),
      login,
      name,
      avatar: input.avatar ? cleanAvatar(input.avatar) : DEFAULT_AVATAR,
      finition: 'mat',
      passwordHash: await hashPassword(input.password),
      recoveryHash: await hashPassword(normalizeRecovery(recovery)),
      xp: 0,
      createdAt: Date.now(),
      lastSeenAt: null,
      disabledAt: null,
    }
    await this.client.execute({
      sql: `INSERT INTO profiles (id, login, name, avatar, finition, password_hash, recovery_hash, xp, created_at, last_seen_at, disabled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL)`,
      args: [rec.id, rec.login, rec.name, rec.avatar, rec.finition, rec.passwordHash, rec.recoveryHash, rec.createdAt],
    })
    this.profiles.set(rec.id, rec)
    this.eclats.set(rec.id, new Set())
    this.badgeCount.set(rec.id, 0)
    return { profile: rec, recovery }
  }

  /**
   * Le profil derrière un identifiant et un mot de passe, ou null. Un
   * identifiant inconnu coûte le même temps qu'un mot de passe faux : rien,
   * pas même la durée, ne dit si le profil existe.
   */
  async verify(login: unknown, password: string, fallbackHash: string): Promise<ProfileRec | null> {
    const found = await this.byLogin(login)
    const ok = await verifyPassword(password, found?.passwordHash ?? fallbackHash)
    return found && ok ? found : null
  }

  async setPassword(id: string, password: string): Promise<void> {
    const rec = await this.require(id)
    rec.passwordHash = await hashPassword(password)
    await this.client.execute({
      sql: 'UPDATE profiles SET password_hash = ? WHERE id = ?',
      args: [rec.passwordHash, id],
    })
  }

  /** Réinitialise par le code de secours. Le code est consommé : on en rend un neuf. */
  async useRecovery(login: unknown, code: unknown, password: string, fallbackHash: string): Promise<string | null> {
    const found = await this.byLogin(login)
    const ok = await verifyPassword(normalizeRecovery(code), found?.recoveryHash ?? fallbackHash)
    if (!found || !ok) return null
    const recovery = newRecoveryCode()
    found.passwordHash = await hashPassword(password)
    found.recoveryHash = await hashPassword(normalizeRecovery(recovery))
    await this.client.execute({
      sql: 'UPDATE profiles SET password_hash = ?, recovery_hash = ? WHERE id = ?',
      args: [found.passwordHash, found.recoveryHash, found.id],
    })
    // Un mot de passe changé ferme les sessions ouvertes ailleurs.
    await this.revokeAll(found.id)
    return recovery
  }

  /** Change ce qu'un joueur choisit lui-même : son prénom, son emoji, sa finition. */
  async update(id: string, patch: { name?: unknown; avatar?: unknown; finition?: unknown }): Promise<ProfileRec> {
    const rec = await this.require(id)
    if (patch.name !== undefined) {
      const name = cleanName(patch.name)
      if (!name) throw new Error('Il faut un prénom')
      rec.name = name
    }
    if (patch.avatar !== undefined) rec.avatar = cleanAvatar(patch.avatar)
    if (patch.finition !== undefined) rec.finition = finitionValide(patch.finition, niveauPour(rec.xp))
    await this.client.execute({
      sql: 'UPDATE profiles SET name = ?, avatar = ?, finition = ? WHERE id = ?',
      args: [rec.name, rec.avatar, rec.finition, id],
    })
    return rec
  }

  async touchSeen(id: string): Promise<void> {
    const rec = this.profiles.get(id)
    if (!rec) return
    rec.lastSeenAt = Date.now()
    await this.client.execute({ sql: 'UPDATE profiles SET last_seen_at = ? WHERE id = ?', args: [rec.lastSeenAt, id] })
  }

  // ── Sessions ────────────────────────────────────────────────────────────

  async createSession(profileId: string, userAgent: string): Promise<string> {
    const token = newToken()
    const now = Date.now()
    const rec: ProfileSessionRec = {
      id: fingerprint(token),
      profileId,
      expiresAt: now + SESSION_MS,
      lastSeenAt: now,
    }
    await this.client.execute({
      sql: `INSERT INTO profile_sessions (id, profile_id, created_at, expires_at, last_seen_at, user_agent)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [rec.id, profileId, now, rec.expiresAt, now, userAgent.slice(0, 200)],
    })
    this.sessions.set(rec.id, rec)
    return token
  }

  /**
   * L'identifiant du profil derrière un jeton, sans toucher à la base :
   * synchrone, pour que la poignée de main d'un socket n'attende pas. Le
   * profil lui-même se charge ensuite, avec `byId`.
   */
  sessionProfileId(token: string): string | null {
    const session = this.sessions.get(fingerprint(token))
    if (!session) return null
    const now = Date.now()
    if (session.expiresAt <= now) {
      this.sessions.delete(session.id)
      this.client.execute({ sql: 'DELETE FROM profile_sessions WHERE id = ?', args: [session.id] }).catch(() => {})
      return null
    }
    if (now - session.lastSeenAt > SLIDE_EVERY_MS) {
      session.lastSeenAt = now
      session.expiresAt = now + SESSION_MS
      this.client
        .execute({
          sql: 'UPDATE profile_sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?',
          args: [now, session.expiresAt, session.id],
        })
        .catch(() => {})
    }
    return session.profileId
  }

  /** Le profil derrière un jeton, chargé au besoin. */
  async bySession(token: string): Promise<ProfileRec | null> {
    const id = this.sessionProfileId(token)
    return id ? this.byId(id) : null
  }

  async revokeSession(token: string): Promise<void> {
    const id = fingerprint(token)
    if (!this.sessions.delete(id)) return
    await this.client.execute({ sql: 'DELETE FROM profile_sessions WHERE id = ?', args: [id] })
  }

  async revokeAll(profileId: string): Promise<void> {
    for (const [id, s] of this.sessions) if (s.profileId === profileId) this.sessions.delete(id)
    await this.client.execute({ sql: 'DELETE FROM profile_sessions WHERE profile_id = ?', args: [profileId] })
  }

  // ── Expérience et éclats ────────────────────────────────────────────────

  /**
   * Crédite (ou recrédite) une soirée. La ligne est remplacée, jamais
   * ajoutée : un animateur peut ranger sa soirée dans l'historique plusieurs
   * fois, et le total doit rester celui du journal, pas celui des passages.
   * Le total du profil est ensuite recalculé de toutes ses soirées.
   */
  async creditSoiree(input: {
    profileId: string
    soireeId: string
    spaceId: string
    gain: GainSoiree
    releve: ReleveSoiree
    xp: number
  }): Promise<number> {
    await this.client.execute({
      sql: `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(profile_id, soiree_id) DO UPDATE SET xp = excluded.xp, detail = excluded.detail`,
      args: [
        input.profileId,
        input.soireeId,
        input.spaceId,
        input.xp,
        JSON.stringify({ gain: input.gain, releve: input.releve }),
        Date.now(),
      ],
    })
    const sum = await this.client.execute({
      sql: 'SELECT COALESCE(SUM(xp), 0) AS total FROM profile_xp WHERE profile_id = ?',
      args: [input.profileId],
    })
    const total = Number(sum.rows[0]?.total ?? 0)
    await this.client.execute({ sql: 'UPDATE profiles SET xp = ? WHERE id = ?', args: [total, input.profileId] })
    const rec = this.profiles.get(input.profileId)
    if (rec) rec.xp = total
    return total
  }

  /** Cette soirée a-t-elle déjà été créditée à ce profil ? */
  async alreadyCredited(profileId: string, soireeId: string): Promise<boolean> {
    const rows = await this.client.execute({
      sql: 'SELECT 1 FROM profile_xp WHERE profile_id = ? AND soiree_id = ? LIMIT 1',
      args: [profileId, soireeId],
    })
    return rows.rows.length > 0
  }

  /**
   * Fait éclater un emoji pour ce profil, définitivement. Rend faux s'il
   * brillait déjà — le tirage est alors tombé dans le vide, et c'est très
   * bien : l'Éclat est une surprise, pas une récompense due.
   */
  async grantEclat(profileId: string, avatar: string, soireeId: string): Promise<boolean> {
    const deja = this.eclats.get(profileId)
    if (deja?.has(avatar)) return false
    const res = await this.client.execute({
      sql: `INSERT INTO profile_eclats (profile_id, avatar, soiree_id, created_at)
            VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, avatar) DO NOTHING`,
      args: [profileId, avatar, soireeId, Date.now()],
    })
    if (res.rowsAffected === 0) return false
    deja?.add(avatar)
    return true
  }

  /** Le tirage de l'Éclat : une chance sur `CHANCE_ECLAT`, une fois par soirée. */
  static tirageEclat(hasard: () => number = Math.random): boolean {
    return hasard() * CHANCE_ECLAT < 1
  }

  // ── Badges ──────────────────────────────────────────────────────────────

  /**
   * Décerne un badge pour une soirée. L'emoji et le titre sont recopiés dans
   * la ligne : une étagère se relit des années plus tard, et un prix qui
   * changerait de nom entre-temps ne doit pas rendre illisible ce qui a été
   * gagné sous l'ancien. Rend faux s'il était déjà décroché ce soir-là.
   */
  async grantBadge(input: {
    profileId: string
    badge: string
    emoji: string
    title: string
    soireeId: string
    spaceId: string
  }): Promise<boolean> {
    const res = await this.client.execute({
      sql: `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(profile_id, badge, soiree_id) DO NOTHING`,
      args: [input.profileId, input.badge, input.soireeId, input.spaceId, input.emoji, input.title, Date.now()],
    })
    if (res.rowsAffected > 0) {
      this.porteurs = null
      this.badgeCount.delete(input.profileId)
    }
    return res.rowsAffected > 0
  }

  /** Les clés déjà décrochées par ce profil — pour ne pas redonner un badge de carrière. */
  async badgeKeys(profileId: string): Promise<Set<string>> {
    const rows = await this.client.execute({
      sql: 'SELECT DISTINCT badge FROM profile_badges WHERE profile_id = ?',
      args: [profileId],
    })
    return new Set(rows.rows.map(r => String(r.badge)))
  }

  /**
   * L'étagère d'un profil : chaque badge, le nombre de fois qu'il est tombé,
   * et ce que sa rareté vaut dans la population du moment.
   */
  async badgesOf(profileId: string): Promise<BadgePorte[]> {
    const rows = await this.client.execute({
      sql: `SELECT badge, emoji, title, COUNT(*) AS fois, MAX(created_at) AS dernier
            FROM profile_badges WHERE profile_id = ?
            GROUP BY badge, emoji, title ORDER BY dernier DESC`,
      args: [profileId],
    })
    const { porteurs, profils } = await this.populationBadges()
    return rows.rows.map(r => {
      const key = String(r.badge)
      const n = porteurs.get(key) ?? 1
      return {
        key,
        emoji: String(r.emoji),
        title: String(r.title),
        fois: Number(r.fois),
        dernier: Number(r.dernier),
        porteurs: n,
        rarete: rareteDe(n, profils),
      }
    })
  }

  /**
   * Combien de profils portent chaque badge, et combien il y a de profils en
   * tout. La rareté se calcule, elle ne se décrète pas — mais elle bouge
   * lentement : on la garde une minute plutôt que de la recompter à chaque
   * ouverture d'une page.
   */
  private porteurs: { at: number; porteurs: Map<string, number>; profils: number } | null = null

  private async populationBadges(): Promise<{ porteurs: Map<string, number>; profils: number }> {
    const frais = this.porteurs && Date.now() - this.porteurs.at < 60_000
    if (frais && this.porteurs) return this.porteurs
    const [compte, parBadge] = await Promise.all([
      this.client.execute('SELECT COUNT(*) AS n FROM profiles WHERE disabled_at IS NULL'),
      this.client.execute(
        'SELECT badge, COUNT(DISTINCT profile_id) AS n FROM profile_badges GROUP BY badge',
      ),
    ])
    const porteurs = new Map<string, number>()
    for (const r of parBadge.rows) porteurs.set(String(r.badge), Number(r.n))
    this.porteurs = { at: Date.now(), porteurs, profils: Number(compte.rows[0]?.n ?? 0) }
    return this.porteurs
  }

  // ── Carrière et historique ──────────────────────────────────────────────

  /** Toutes les soirées d'un profil, de la plus récente à la plus ancienne. */
  async historiqueOf(profileId: string): Promise<
    { soireeId: string; spaceId: string; xp: number; gain: GainSoiree; releve: ReleveSoiree; at: number }[]
  > {
    const rows = await this.client.execute({
      sql: 'SELECT soiree_id, space_id, xp, detail, created_at FROM profile_xp WHERE profile_id = ? ORDER BY created_at DESC',
      args: [profileId],
    })
    return rows.rows.map(r => {
      const { gain, releve } = decodeDetail(String(r.detail))
      return {
        soireeId: String(r.soiree_id),
        spaceId: String(r.space_id),
        xp: Number(r.xp),
        gain,
        releve,
        at: Number(r.created_at),
      }
    })
  }

  /** Ce qu'un profil a accumulé sur toutes ses soirées — la base des badges de carrière. */
  async careerOf(profileId: string): Promise<Carriere> {
    const soirees = await this.historiqueOf(profileId)
    const rec = await this.byId(profileId)
    return soirees.reduce<Carriere>(
      (c, s) => ({
        soirees: c.soirees + 1,
        reponses: c.reponses + s.releve.reponses,
        justes: c.justes + s.releve.justes,
        podiums: c.podiums + (s.gain.podium > 0 ? 1 : 0),
        quiz: c.quiz + s.releve.quiz,
        eclats: c.eclats,
        niveau: c.niveau,
      }),
      {
        soirees: 0,
        reponses: 0,
        justes: 0,
        podiums: 0,
        quiz: 0,
        eclats: this.eclatsOf(profileId).length,
        niveau: niveauPour(rec?.xp ?? 0),
      },
    )
  }

  /**
   * Décerne les badges de carrière que ce profil vient d'atteindre. Rend ceux
   * qui sont nouveaux — il n'y a qu'à la première fois qu'ils comptent.
   */
  async grantCareerBadges(profileId: string, soireeId: string, spaceId: string): Promise<string[]> {
    const carriere = await this.careerOf(profileId)
    const deja = await this.badgeKeys(profileId)
    const neufs: string[] = []
    for (const b of BADGES_CARRIERE) {
      if (deja.has(b.key) || !b.atteint(carriere)) continue
      if (await this.grantBadge({ profileId, badge: b.key, emoji: b.emoji, title: b.title, soireeId, spaceId })) {
        neufs.push(b.key)
      }
    }
    return neufs
  }

  // ── Internes ────────────────────────────────────────────────────────────

  private async require(id: string): Promise<ProfileRec> {
    const rec = await this.byId(id)
    if (!rec) throw new Error('Profil introuvable')
    return rec
  }

  /** Range une ligne de base en mémoire, avec ses éclats. */
  private async remember(row: unknown): Promise<ProfileRec | null> {
    if (!row) return null
    const r = row as Record<string, unknown>
    const rec: ProfileRec = {
      id: String(r.id),
      login: String(r.login),
      name: String(r.name),
      avatar: String(r.avatar),
      finition: finitionValide(r.finition, niveauPour(Number(r.xp ?? 0))),
      passwordHash: String(r.password_hash),
      recoveryHash: String(r.recovery_hash),
      xp: Number(r.xp ?? 0),
      createdAt: Number(r.created_at),
      lastSeenAt: r.last_seen_at === null || r.last_seen_at === undefined ? null : Number(r.last_seen_at),
      disabledAt: r.disabled_at === null || r.disabled_at === undefined ? null : Number(r.disabled_at),
    }
    this.profiles.set(rec.id, rec)
    // Les éclats et le nombre de badges arrivent avec le profil : ils partent
    // dans l'accusé d'inscription à une soirée, qui est synchrone.
    if (!this.eclats.has(rec.id)) {
      const [eclats, badges] = await Promise.all([
        this.client.execute({ sql: 'SELECT avatar FROM profile_eclats WHERE profile_id = ?', args: [rec.id] }),
        this.client.execute({
          sql: 'SELECT COUNT(DISTINCT badge) AS n FROM profile_badges WHERE profile_id = ?',
          args: [rec.id],
        }),
      ])
      this.eclats.set(rec.id, new Set(eclats.rows.map(e => String(e.avatar))))
      this.badgeCount.set(rec.id, Number(badges.rows[0]?.n ?? 0))
    }
    return rec.disabledAt ? null : rec
  }
}
