import { ajouterColonne, clientDistant, type Client } from '../core/distante'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { hashPassword, verifyPassword } from './password'
import { cleanAvatar, cleanName, DEFAULT_AVATAR } from '../../../shared/avatars'
import {
  CHANCE_ECLAT,
  carriereDe,
  choixDeFinition,
  ficheDe,
  finitionPortee,
  finitionsOuvertes,
  gainVide,
  niveauPour,
  progression,
  releveVide,
  XP,
  type Carriere,
  type FinitionChoisie,
  type GainSoiree,
  type PublicProfile,
  type PublicProfileDetail,
  type ReleveSoiree,
} from '../../../shared/profil'
import { rareteDe, type BadgePorte } from '../../../shared/badges'
import {
  HAUTS_FAITS_DE_CARRIERE,
  HAUTS_FAITS_DE_SOIREE,
  clePalier,
  palierDe,
  paliersAtteints,
  titreDePalier,
  XP_PALIER,
  type HautFaitVu,
} from '../../../shared/hautsfaits'
import { cibleEclat, legendaire, legendairesDebloques } from '../../../shared/legendaires'
import { divin } from '../../../shared/divins'
import { isValidLogin, normalizeLogin } from '../../../shared/space'
import { divinsDebloques, raconter } from '../core/divins'

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
 *
 * Comme pour les comptes, la base s'écrit d'abord et la mémoire suit : un
 * mot de passe que Turso refusait ouvrait quand même le profil jusqu'au
 * redémarrage, et un code de secours s'y consommait sans que le neuf ait
 * été montré à personne.
 */
export interface ProfileRec {
  id: string
  login: string
  name: string
  avatar: string
  /** Ce qu'il a choisi de porter : `auto` porte toujours la plus belle finition qu'il a. */
  finition: FinitionChoisie
  /**
   * L'avatar dessiné qu'il porte à la place de son emoji, s'il en porte un :
   * un légendaire (`lg:…`) ou un Divin (`dv:…`). Une seule colonne : on ne
   * porte jamais qu'un avatar à la fois.
   */
  legendaire: string | null
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

/**
 * Une récompense de soirée et son lauréat — un profil, jamais un invité
 * anonyme : un prix (L'Éclair, Le Cancre…) ou un haut fait de soirée.
 */
export interface PrixDeSoiree {
  profileId: string
  badge: string
  emoji: string
  title: string
}

/**
 * La ligne d'expérience qui porte les paliers de carrière. Un palier ne tombe
 * qu'une fois, sur toute la carrière : son expérience ne peut pas vivre dans
 * la ligne d'une soirée, que chaque crédit remplace. Elle a donc la sienne,
 * recalculée à chaque palier décerné — et l'historique des soirées l'ignore.
 */
export const LIGNE_PALIERS = '#paliers'

/**
 * La version du barème qui a écrit une ligne d'expérience : 2 depuis le
 * barème au mérite, 3 depuis qu'il paie dès deux joueurs et que l'animateur
 * gagne chez lui, 4 depuis les Divins — l'expérience n'a pas bougé, mais
 * les soirées d'avant doivent se relire pour qu'un Divin y descende aussi.
 * Une ligne d'une version d'avant se relit au démarrage (`recalcul.ts`) —
 * son format, lui, n'a pas changé depuis la 2.
 */
export const VERSION_BAREME = 4

/** La première version dont les lignes portent le relevé complet. */
const VERSION_RELEVE_COMPLET = 2

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
 * Relit le détail d'une soirée.
 *
 * Trois générations de lignes : les toutes premières ne portaient que le gain
 * de l'ancien barème (présence, réponses, justesse, podium, quiz) ; les
 * suivantes y ajoutaient un relevé de quatre chiffres ; celles du barème au
 * mérite (`v` ≥ 2) portent le relevé complet. Une ligne d'avant se relit en
 * relevé complet, les chiffres qu'elle n'avait pas à zéro — mieux que de
 * perdre une soirée de carrière.
 *
 * Le format se reconnaît à `v ≥ 2`, pas à la version du jour : quand le
 * barème change, une ligne de la veille lue comme « l'ancien barème » perdait
 * ses catégories, ses séries — et l'Éclat, qui se décide sur son gain, se
 * tirait une seconde fois.
 */
export function decodeDetail(raw: string): { v: number; gain: GainSoiree; releve: ReleveSoiree } {
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { v: 0, gain: gainVide(), releve: releveVide() }
  }
  if (typeof parsed?.v === 'number' && parsed.v >= VERSION_RELEVE_COMPLET) {
    return {
      v: parsed.v,
      gain: { ...gainVide(), ...parsed.gain },
      releve: { ...releveVide(), ...parsed.releve, categories: { ...(parsed.releve?.categories ?? {}) } },
    }
  }
  // L'ancien barème : 1 par réponse, 2 par bonne réponse, 60/40/25 pour le
  // podium, 15 par quiz gagné.
  const ancien = parsed?.gain ?? parsed ?? {}
  const vieux = parsed?.releve
  const releve = releveVide()
  releve.reponses = Number(vieux?.reponses ?? ancien.reponses ?? 0)
  releve.qcm = releve.reponses
  releve.questions = releve.reponses
  releve.justes = Number(vieux?.justes ?? Math.round(Number(ancien.justesse ?? 0) / 2))
  releve.rang = Number(vieux?.rang ?? (Number(ancien.podium) > 0 ? [60, 40, 25].indexOf(Number(ancien.podium)) + 1 : 0))
  releve.quizGagnes = Number(vieux?.quiz ?? Math.round(Number(ancien.quiz ?? 0) / 15))
  return { v: 1, gain: gainVide(), releve }
}

/**
 * Une ligne de l'ancien barème, revalorisée au nouveau quand on n'a plus de
 * quoi la recalculer — sa soirée n'est pas dans l'historique. On ne garde
 * que ce que le relevé dit encore : ses réponses et ses bonnes réponses. La
 * présence et les podiums de l'ancien barème s'en vont.
 */
export function revaloriser(releve: ReleveSoiree): { gain: GainSoiree; xp: number } {
  const gain = gainVide()
  gain.reponses = releve.reponses * XP.reponse
  gain.justesse = releve.justes * XP.juste
  return { gain, xp: gain.reponses + gain.justesse }
}

export class ProfileStore {
  private client: Client
  private profiles = new Map<string, ProfileRec>()
  private sessions = new Map<string, ProfileSessionRec>()
  /** Les emojis éclatés, par profil — chargés avec le profil. */
  private eclats = new Map<string, Set<string>>()
  /**
   * Ses récompenses rangées, par profil : chaque clé d'étagère et le nombre de
   * soirées où elle est tombée. Chargées avec le profil, tenues à jour à
   * chaque écriture : les avatars légendaires qu'il a débloqués s'en
   * déduisent, et l'instantané qui part à toute la salle les lit sans
   * aller-retour.
   */
  private recompenses = new Map<string, Map<string, number>>()

  constructor(url: string, authToken?: string) {
    this.client = clientDistant(url, authToken)
  }

  async init() {
    await this.client.batch(
      [
        `CREATE TABLE IF NOT EXISTS profiles (
           id            TEXT PRIMARY KEY,
           login         TEXT NOT NULL UNIQUE,
           name          TEXT NOT NULL,
           avatar        TEXT NOT NULL,
           finition      TEXT NOT NULL DEFAULT 'auto',
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
    // L'avatar légendaire porté est arrivé avec les hauts faits : une base
    // d'avant n'a pas la colonne. Une panne ici arrête le démarrage, plutôt
    // que de laisser tourner un serveur qui écrirait dans une colonne absente.
    await ajouterColonne(this.client, 'profiles', 'legendaire', 'TEXT')
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

  /**
   * Un identifiant libre, proche de celui qu'on voulait : « camille » pris,
   * on propose « camille2 ».
   *
   * Sans ça, une invitée qui n'y connaît rien reste debout dans le noir
   * devant un refus qu'elle ne sait pas contourner — et le chemin le plus
   * court devient alors « tant pis, je joue sans compte ». Rend une chaîne
   * vide si rien de propre ne se trouve : l'appelant s'en passe.
   */
  async suggestLogin(souhaite: unknown): Promise<string> {
    // On retire un suffixe de chiffres déjà présent : « camille2 » pris, on
    // propose « camille3 », pas « camille22 ».
    const base = normalizeLogin(souhaite).replace(/\d+$/, '').slice(0, 28)
    if (!base) return ''
    for (let n = 2; n <= 99; n++) {
      const essai = `${base}${n}`
      if (isValidLogin(essai) && !(await this.byLogin(essai))) return essai
    }
    return ''
  }

  /** Les emojis qui ont éclaté pour ce profil. */
  eclatsOf(id: string): string[] {
    return [...(this.eclats.get(id) ?? [])]
  }

  /** Ses récompenses rangées : chaque clé d'étagère, et le nombre de soirées où elle est tombée. */
  recompensesOf(id: string): ReadonlyMap<string, number> {
    return this.recompenses.get(id) ?? new Map()
  }

  /** Les avatars légendaires que ce profil a débloqués. */
  legendairesOf(id: string): string[] {
    return legendairesDebloques(this.recompensesOf(id))
  }

  /** Les Divins descendus sur ce profil — la liste, jamais ce qui les a fait descendre. */
  divinsOf(id: string): string[] {
    return divinsDebloques(this.recompensesOf(id))
  }

  /**
   * L'avatar dessiné qu'il porte, s'il l'a vraiment : un légendaire ou un
   * Divin rendu avec sa soirée (exclusion, essai effacé) ne se porte plus.
   */
  legendairePorte(p: ProfileRec): string | null {
    if (!p.legendaire) return null
    const a = divin(p.legendaire) ? this.divinsOf(p.id) : this.legendairesOf(p.id)
    return a.includes(p.legendaire) ? p.legendaire : null
  }

  toPublic(p: ProfileRec): PublicProfile {
    const { niveau, acquis, requis } = progression(p.xp)
    return {
      id: p.id,
      login: p.login,
      name: p.name,
      avatar: p.avatar,
      // La finition qu'on voit sur lui : celle qu'il a épinglée s'il peut
      // encore la porter, la plus belle qu'il a sinon.
      finition: finitionPortee(p.finition, niveau),
      finitionChoisie: choixDeFinition(p.finition, niveau),
      xp: p.xp,
      niveau,
      acquis,
      requis,
      ouvertes: finitionsOuvertes(niveau),
      eclats: this.eclatsOf(p.id),
      // Un Divin ne se compte pas : un « 4 badges » devenu « 5 » sans rien
      // de neuf sur l'étagère dirait qu'il s'est passé quelque chose.
      badges: [...(this.recompenses.get(p.id)?.keys() ?? [])].filter(k => !k.startsWith('dv:')).length,
      legendaire: this.legendairePorte(p),
      legendaires: this.legendairesOf(p.id),
      divins: raconter(this.divinsOf(p.id)),
    }
  }

  /**
   * Le profil au complet, pour sa propre page : l'étagère, l'historique, la
   * fiche de carrière et tous les hauts faits, gagnés ou non. Cela coûte
   * quelques requêtes, et n'a donc rien à faire dans l'accusé de réception
   * que reçoit chaque téléphone qui rejoint une soirée.
   */
  async toDetail(
    p: ProfileRec,
    espace?: (spaceId: string) => { nom: string; slug: string } | null,
  ): Promise<PublicProfileDetail> {
    const [vitrine, soirees] = await Promise.all([this.badgesOf(p.id), this.historiqueOf(p.id)])
    const carriere = carriereDe(soirees, { eclats: this.eclatsOf(p.id).length, niveau: niveauPour(p.xp) })
    return {
      ...this.toPublic(p),
      vitrine,
      soirees: soirees.map(s => {
        const chez = espace?.(s.spaceId) ?? null
        return {
          soireeId: s.soireeId,
          chez: chez?.nom ?? null,
          slug: chez?.slug ?? null,
          xp: s.xp,
          gain: s.gain,
          releve: s.releve,
          at: s.at,
        }
      }),
      fiche: ficheDe(carriere),
      categories: carriere.categories,
      hautsFaits: await this.hautsFaitsVus(p.id, carriere, vitrine),
    }
  }

  /**
   * Tout le catalogue des hauts faits, vu par ce profil : ceux de soirée avec
   * le nombre de fois, ceux de carrière avec leur palier et leur jauge. Ce
   * qu'on n'a pas encore se montre aussi — savoir ce qui vient donne envie de
   * revenir.
   */
  private async hautsFaitsVus(id: string, carriere: Carriere, vitrine: BadgePorte[]): Promise<HautFaitVu[]> {
    const recompenses = this.recompensesOf(id)
    const rarete = new Map(vitrine.map(b => [b.key, b]))
    const soiree: HautFaitVu[] = HAUTS_FAITS_DE_SOIREE.map(h => {
      const porte = rarete.get(h.key)
      return {
        key: h.key,
        famille: 'soiree',
        emoji: h.emoji,
        title: h.title,
        rule: h.rule,
        ton: h.ton,
        fois: recompenses.get(h.key) ?? 0,
        ...(porte && { rarete: porte.rarete, porteurs: porte.porteurs }),
      }
    })
    const carrieres: HautFaitVu[] = HAUTS_FAITS_DE_CARRIERE.map(h => {
      const valeur = h.valeur(carriere)
      let palier = 0
      for (let i = 1; i <= 3; i++) if ((recompenses.get(clePalier(h.key, i)) ?? 0) > 0) palier = i
      const porte = palier > 0 ? rarete.get(clePalier(h.key, palier)) : undefined
      return {
        key: h.key,
        famille: 'carriere',
        emoji: h.emoji,
        title: h.title,
        rule: h.mesure,
        ruleUne: h.mesureUne,
        ton: 'eclat',
        fois: palier,
        valeur,
        prochain: palier < 3 ? h.paliers[palier] : null,
        ...(porte && { rarete: porte.rarete, porteurs: porte.porteurs }),
      }
    })
    return [...soiree, ...carrieres]
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
      finition: 'auto',
      legendaire: null,
      passwordHash: await hashPassword(input.password),
      recoveryHash: await hashPassword(normalizeRecovery(recovery)),
      xp: 0,
      createdAt: Date.now(),
      lastSeenAt: null,
      disabledAt: null,
    }
    await this.client
      .execute({
        sql: `INSERT INTO profiles (id, login, name, avatar, finition, password_hash, recovery_hash, xp, created_at, last_seen_at, disabled_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL)`,
        args: [rec.id, rec.login, rec.name, rec.avatar, rec.finition, rec.passwordHash, rec.recoveryHash, rec.createdAt],
      })
      .catch(e => {
        // Deux hachages séparent la vérification du dessus de cette écriture :
        // deux inscriptions simultanées au même identifiant — un envoi
        // retenté par un réseau hésitant — y passent ensemble, et la base
        // refuse la seconde. Elle doit lire « déjà pris », pas « Erreur serveur ».
        if (String((e as { message?: unknown } | null)?.message ?? '').includes('UNIQUE constraint failed: profiles.login')) {
          throw new Error('Cet identifiant est déjà pris')
        }
        throw e
      })
    this.profiles.set(rec.id, rec)
    this.eclats.set(rec.id, new Set())
    this.recompenses.set(rec.id, new Map())
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
    const passwordHash = await hashPassword(password)
    await this.client.execute({
      sql: 'UPDATE profiles SET password_hash = ? WHERE id = ?',
      args: [passwordHash, id],
    })
    rec.passwordHash = passwordHash
  }

  /** Réinitialise par le code de secours. Le code est consommé : on en rend un neuf. */
  async useRecovery(login: unknown, code: unknown, password: string, fallbackHash: string): Promise<string | null> {
    const found = await this.byLogin(login)
    const ok = await verifyPassword(normalizeRecovery(code), found?.recoveryHash ?? fallbackHash)
    if (!found || !ok) return null
    const recovery = newRecoveryCode()
    const passwordHash = await hashPassword(password)
    const recoveryHash = await hashPassword(normalizeRecovery(recovery))
    await this.client.execute({
      sql: 'UPDATE profiles SET password_hash = ?, recovery_hash = ? WHERE id = ?',
      args: [passwordHash, recoveryHash, found.id],
    })
    found.passwordHash = passwordHash
    found.recoveryHash = recoveryHash
    // Un mot de passe changé ferme les sessions ouvertes ailleurs.
    await this.revokeAll(found.id)
    return recovery
  }

  /**
   * Change ce qu'un joueur choisit lui-même : son prénom, son emoji, sa
   * finition, son avatar légendaire ou divin.
   *
   * Choisir un emoji ôte le légendaire : on porte l'un ou l'autre. Un
   * légendaire ou un Divin qu'on n'a pas débloqué est refusé en clair — la
   * page ne le propose pas, seul un appel forgé l'enverrait.
   */
  async update(
    id: string,
    patch: { name?: unknown; avatar?: unknown; finition?: unknown; legendaire?: unknown },
  ): Promise<ProfileRec> {
    const rec = await this.require(id)
    // Seules les colonnes demandées s'écrivent : la mémoire ne suit qu'après
    // coup, et un prénom changé sur le téléphone pendant que la tablette
    // change l'emoji ne doit pas revenir en arrière.
    const champs: Partial<Pick<ProfileRec, 'name' | 'avatar' | 'finition' | 'legendaire'>> = {}
    if (patch.name !== undefined) {
      const name = cleanName(patch.name)
      if (!name) throw new Error('Il faut un prénom')
      champs.name = name
    }
    if (patch.avatar !== undefined) {
      champs.avatar = cleanAvatar(patch.avatar)
      champs.legendaire = null
    }
    if (patch.finition !== undefined) champs.finition = choixDeFinition(patch.finition, niveauPour(rec.xp))
    if (patch.legendaire !== undefined) {
      if (patch.legendaire === null || patch.legendaire === '') champs.legendaire = null
      else if (legendaire(patch.legendaire) && this.legendairesOf(id).includes(String(patch.legendaire))) {
        champs.legendaire = String(patch.legendaire)
      } else if (divin(patch.legendaire) && this.divinsOf(id).includes(String(patch.legendaire))) {
        champs.legendaire = String(patch.legendaire)
      } else if (divin(patch.legendaire)) throw new Error('Ce Divin n’est pas encore descendu sur toi')
      else throw new Error('Cet avatar légendaire n’est pas encore à toi')
    }
    const colonnes = Object.keys(champs) as (keyof typeof champs)[]
    if (colonnes.length === 0) return rec
    await this.client.execute({
      sql: `UPDATE profiles SET ${colonnes.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      args: [...colonnes.map(c => champs[c]!), id],
    })
    Object.assign(rec, champs)
    return rec
  }

  async touchSeen(id: string): Promise<void> {
    const rec = this.profiles.get(id)
    if (!rec) return
    const now = Date.now()
    await this.client.execute({ sql: 'UPDATE profiles SET last_seen_at = ? WHERE id = ?', args: [now, id] })
    rec.lastSeenAt = now
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
   *
   * La mémoire y passe devant la base, exprès et sans risque : une session
   * expirée restée en base s'efface au démarrage suivant, et une expiration
   * qui n'aurait pas glissé en base ne fait que redemander le mot de passe.
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
    // Oubliée en mémoire avant d'être effacée en base, une session que Turso
    // refusait d'effacer ne se retentait plus : elle revenait au réveil.
    if (!this.sessions.has(id)) return
    await this.client.execute({ sql: 'DELETE FROM profile_sessions WHERE id = ?', args: [id] })
    this.sessions.delete(id)
  }

  async revokeAll(profileId: string): Promise<void> {
    // Celles qu'on connaît avant d'écrire, et celles-là seulement : une
    // session ouverte pendant l'aller-retour, oubliée ici mais restée en
    // base, ressusciterait au réveil.
    const ids = [...this.sessions.values()].filter(s => s.profileId === profileId).map(s => s.id)
    await this.client.execute({ sql: 'DELETE FROM profile_sessions WHERE profile_id = ?', args: [profileId] })
    for (const id of ids) this.sessions.delete(id)
  }

  // ── Expérience et éclats ────────────────────────────────────────────────

  /**
   * Crédite (ou recrédite) une soirée. La ligne est remplacée, jamais
   * ajoutée : la soirée se recrédite après chaque quiz puis à sa clôture, et
   * le total doit rester celui du journal, pas celui des passages. Le total
   * du profil est ensuite recalculé de toutes ses lignes.
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
        JSON.stringify({ v: VERSION_BAREME, gain: input.gain, releve: input.releve }),
        Date.now(),
      ],
    })
    return this.recalculerTotal(input.profileId)
  }

  /** Le total d'un profil, recalculé de toutes ses lignes — en base, puis en mémoire. */
  private async recalculerTotal(profileId: string): Promise<number> {
    const [, apres] = await this.client.batch(
      [
        {
          sql: 'UPDATE profiles SET xp = (SELECT COALESCE(SUM(xp), 0) FROM profile_xp WHERE profile_id = ?) WHERE id = ?',
          args: [profileId, profileId],
        },
        { sql: 'SELECT xp FROM profiles WHERE id = ?', args: [profileId] },
      ],
      'write',
    )
    const total = Number(apres.rows[0]?.xp ?? 0)
    const rec = this.profiles.get(profileId)
    if (rec) rec.xp = total
    return total
  }

  /**
   * Reprend à un profil ce qu'une soirée lui avait crédité : sa ligne
   * d'expérience, l'Éclat tiré sous son nom, et ce qu'elle avait rangé sur
   * son étagère. Le total se recalcule sur ce qui reste, dans la même
   * transaction — le profil n'est jamais lu entre les deux. Un Éclat tiré
   * lors d'une autre soirée reste : il n'a rien à voir avec celle-ci. Rend
   * le nouveau total.
   */
  async retirerSoiree(profileId: string, soireeId: string): Promise<number> {
    const [eclats] = await this.client.batch(
      [
        { sql: 'SELECT avatar FROM profile_eclats WHERE profile_id = ? AND soiree_id = ?', args: [profileId, soireeId] },
        { sql: 'DELETE FROM profile_eclats WHERE profile_id = ? AND soiree_id = ?', args: [profileId, soireeId] },
        { sql: 'DELETE FROM profile_xp WHERE profile_id = ? AND soiree_id = ?', args: [profileId, soireeId] },
        { sql: 'DELETE FROM profile_badges WHERE profile_id = ? AND soiree_id = ?', args: [profileId, soireeId] },
      ],
      'write',
    )
    for (const r of eclats.rows) this.eclats.get(profileId)?.delete(String(r.avatar))
    this.porteurs = null
    await this.ecrireXpDesPaliers(profileId)
    await this.recompterRecompenses([profileId])
    return this.recalculerTotal(profileId)
  }

  /**
   * Efface tout ce qu'une soirée avait crédité, à tous ses profils : c'était
   * un essai, ou on la retire de l'historique. Expérience, Éclats, prix,
   * hauts faits — et les paliers de carrière qu'elle avait fait tomber : une
   * soirée qui n'a pas eu lieu ne laisse rien derrière elle. Rend les profils
   * touchés.
   */
  async retirerSoireeEntiere(soireeId: string, spaceId: string): Promise<string[]> {
    const [xp, badges, eclats] = await this.client.batch(
      [
        { sql: 'SELECT DISTINCT profile_id FROM profile_xp WHERE soiree_id = ? AND space_id = ?', args: [soireeId, spaceId] },
        { sql: 'SELECT DISTINCT profile_id FROM profile_badges WHERE soiree_id = ? AND space_id = ?', args: [soireeId, spaceId] },
        { sql: 'SELECT profile_id, avatar FROM profile_eclats WHERE soiree_id = ?', args: [soireeId] },
        { sql: 'DELETE FROM profile_xp WHERE soiree_id = ? AND space_id = ?', args: [soireeId, spaceId] },
        { sql: 'DELETE FROM profile_badges WHERE soiree_id = ? AND space_id = ?', args: [soireeId, spaceId] },
        // Les Éclats ne portent pas l'espace : l'identifiant d'une soirée
        // (sa date et une empreinte de l'heure) suffit à la désigner.
        { sql: 'DELETE FROM profile_eclats WHERE soiree_id = ?', args: [soireeId] },
      ],
      'write',
    )
    const touches = new Set([...xp.rows, ...badges.rows, ...eclats.rows].map(r => String(r.profile_id)))
    for (const r of eclats.rows) this.eclats.get(String(r.profile_id))?.delete(String(r.avatar))
    this.porteurs = null
    for (const id of touches) await this.ecrireXpDesPaliers(id)
    await this.recompterRecompenses([...touches])
    for (const id of touches) await this.recalculerTotal(id)
    return [...touches]
  }

  /** Cette soirée a-t-elle déjà été créditée à ce profil ? */
  /**
   * Ce que cette soirée avait déjà crédité à ce profil, s'il y a une ligne —
   * de quoi savoir si l'Éclat s'y est déjà tiré.
   */
  async creditPrecedent(profileId: string, soireeId: string): Promise<{ xp: number; gain: GainSoiree } | null> {
    const rows = await this.client.execute({
      sql: 'SELECT xp, detail FROM profile_xp WHERE profile_id = ? AND soiree_id = ? LIMIT 1',
      args: [profileId, soireeId],
    })
    const r = rows.rows[0]
    return r ? { xp: Number(r.xp), gain: decodeDetail(String(r.detail)).gain } : null
  }

  /**
   * Ce qui éclatera si l'Éclat tombe sur ce profil ce soir : le légendaire
   * qu'il porte, ou l'emoji qu'il a joué (`cibleEclat`).
   */
  cibleEclatDe(profileId: string, emoji: string): string {
    const p = this.profiles.get(profileId)
    return cibleEclat(p ? this.legendairePorte(p) : null, emoji)
  }

  /**
   * Ce qui a éclaté pour ce profil pendant cette soirée, s'il y en a un — la
   * fin de soirée l'annonce : tombé en silence, un Éclat passait inaperçu, et
   * plus encore sous un légendaire.
   */
  async eclatDeLaSoiree(profileId: string, soireeId: string): Promise<string | null> {
    const res = await this.client.execute({
      sql: 'SELECT avatar FROM profile_eclats WHERE profile_id = ? AND soiree_id = ? ORDER BY created_at LIMIT 1',
      args: [profileId, soireeId],
    })
    return res.rows.length > 0 ? String(res.rows[0].avatar) : null
  }

  /**
   * Fait éclater un emoji ou un légendaire pour ce profil, définitivement.
   * Rend faux s'il brillait déjà — le tirage est alors tombé dans le vide, et
   * c'est très bien : l'Éclat est une surprise, pas une récompense due.
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

  // ── L'étagère ───────────────────────────────────────────────────────────
  //
  // Une ligne par récompense ET par soirée où elle est tombée : la clé rend
  // la consolidation idempotente, et compter les lignes donne gratuitement
  // le nombre de fois. Trois sortes de lignes s'y côtoient :
  //   · les prix de soirée (`eclair`, `cancre`…), ceux du palmarès ;
  //   · les hauts faits de soirée (`hf:phenix`…), qui se regagnent ;
  //   · les paliers de carrière (`hf:bavard:2`), qui ne tombent qu'une fois.
  // L'emoji et le titre sont recopiés dans chaque ligne : une étagère se
  // relit des années plus tard, même si un titre a changé entre-temps.

  /**
   * Range les récompenses d'une soirée — prix et hauts faits —, en
   * REMPLAÇANT celles qu'un passage précédent de la même soirée avait rangées.
   *
   * Le retrait vise toute la soirée, pas seulement ses invités du moment : un
   * invité exclu n'a plus de réponses au journal, et le prix qu'il portait est
   * retombé sur quelqu'un d'autre. Les paliers de carrière, eux, ne se
   * reprennent pas ici — ils récompensent une habitude, pas une soirée.
   */
  async remplacerRecompensesDeSoiree(soireeId: string, spaceId: string, laureats: PrixDeSoiree[]): Promise<void> {
    const now = Date.now()
    const deSoiree = `space_id = ? AND soiree_id = ? AND badge NOT GLOB 'hf:*:[123]' AND badge NOT LIKE 'carriere:%'`
    const [avant] = await this.client.batch(
      [
        { sql: `SELECT DISTINCT profile_id FROM profile_badges WHERE ${deSoiree}`, args: [spaceId, soireeId] },
        { sql: `DELETE FROM profile_badges WHERE ${deSoiree}`, args: [spaceId, soireeId] },
        ...laureats.map(l => ({
          sql: `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(profile_id, badge, soiree_id) DO NOTHING`,
          args: [l.profileId, l.badge, soireeId, spaceId, l.emoji, l.title, now],
        })),
      ],
      'write',
    )
    this.porteurs = null
    await this.recompterRecompenses([...new Set([...avant.rows.map(r => String(r.profile_id)), ...laureats.map(l => l.profileId)])])
  }

  /**
   * Décerne les paliers de carrière que ce profil vient d'atteindre, sous le
   * nom de la soirée qui les a fait tomber, et crédite leur expérience. Rend
   * ceux qui sont nouveaux — il n'y a qu'à la première fois qu'ils comptent.
   */
  async accorderPaliers(profileId: string, soireeId: string, spaceId: string): Promise<string[]> {
    const carriere = await this.careerOf(profileId)
    const deja = this.recompensesOf(profileId)
    const neufs = paliersAtteints(carriere).filter(cle => !deja.has(cle))
    if (neufs.length === 0) return []
    const now = Date.now()
    await this.client.batch(
      neufs.map(cle => {
        const { hautFait, palier } = palierDe(cle)!
        return {
          sql: `INSERT INTO profile_badges (profile_id, badge, soiree_id, space_id, emoji, title, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(profile_id, badge, soiree_id) DO NOTHING`,
          args: [profileId, cle, soireeId, spaceId, hautFait.emoji, titreDePalier(hautFait, palier), now],
        }
      }),
      'write',
    )
    this.porteurs = null
    await this.recompterRecompenses([profileId])
    await this.ecrireXpDesPaliers(profileId)
    await this.recalculerTotal(profileId)
    return neufs
  }

  /**
   * La ligne d'expérience des paliers de carrière, recalculée de ceux qu'il
   * porte (voir `LIGNE_PALIERS`). Effacée quand il n'en porte plus aucun.
   */
  private async ecrireXpDesPaliers(profileId: string): Promise<void> {
    const res = await this.client.execute({
      sql: `SELECT badge FROM profile_badges WHERE profile_id = ? AND badge GLOB 'hf:*:[123]'`,
      args: [profileId],
    })
    const cles = [...new Set(res.rows.map(r => String(r.badge)))]
    const xp = cles.reduce((n, cle) => n + (palierDe(cle) ? XP_PALIER[palierDe(cle)!.palier - 1] : 0), 0)
    if (xp === 0) {
      await this.client.execute({
        sql: 'DELETE FROM profile_xp WHERE profile_id = ? AND soiree_id = ?',
        args: [profileId, LIGNE_PALIERS],
      })
      return
    }
    await this.client.execute({
      sql: `INSERT INTO profile_xp (profile_id, soiree_id, space_id, xp, detail, created_at)
            VALUES (?, ?, '', ?, ?, ?)
            ON CONFLICT(profile_id, soiree_id) DO UPDATE SET xp = excluded.xp, detail = excluded.detail`,
      args: [profileId, LIGNE_PALIERS, xp, JSON.stringify({ v: VERSION_BAREME, paliers: cles }), Date.now()],
    })
  }

  /**
   * Remet d'aplomb les récompenses gardées en mémoire pour ces profils.
   *
   * Elles partent dans l'accusé de chaque téléphone qui se présente à une
   * soirée (le nombre de badges, les légendaires débloqués), et dans
   * l'instantané de toute la salle (le légendaire porté) : on les relit
   * après chaque écriture plutôt que de compter sur une relecture qui ne
   * viendrait jamais.
   */
  private async recompterRecompenses(profileIds: string[]): Promise<void> {
    if (profileIds.length === 0) return
    const res = await this.client.execute({
      sql: `SELECT profile_id, badge, COUNT(*) AS n FROM profile_badges
            WHERE profile_id IN (${profileIds.map(() => '?').join(', ')}) GROUP BY profile_id, badge`,
      args: profileIds,
    })
    const parProfil = new Map<string, Map<string, number>>(profileIds.map(id => [id, new Map()]))
    for (const r of res.rows) parProfil.get(String(r.profile_id))?.set(String(r.badge), Number(r.n))
    for (const [id, m] of parProfil) this.recompenses.set(id, m)
  }

  /**
   * L'étagère d'un profil : chaque badge, le nombre de fois qu'il est tombé,
   * et ce que sa rareté vaut dans la population du moment.
   */
  async badgesOf(profileId: string): Promise<BadgePorte[]> {
    // Les Divins n'y sont pas : ils ont leur galerie, et une étagère qui
    // dirait « tombé le 12 mars » raconterait ce qu'on a fait ce soir-là.
    const rows = await this.client.execute({
      sql: `SELECT badge, emoji, title, COUNT(*) AS fois, MAX(created_at) AS dernier
            FROM profile_badges WHERE profile_id = ? AND badge NOT LIKE 'dv:%'
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
      sql: `SELECT soiree_id, space_id, xp, detail, created_at FROM profile_xp
            WHERE profile_id = ? AND soiree_id <> ? ORDER BY created_at DESC`,
      args: [profileId, LIGNE_PALIERS],
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

  /** Ce qu'un profil a accumulé sur toutes ses soirées — sa fiche, et la base des paliers de carrière. */
  async careerOf(profileId: string): Promise<Carriere> {
    const soirees = await this.historiqueOf(profileId)
    const rec = await this.byId(profileId)
    return carriereDe(soirees, { eclats: this.eclatsOf(profileId).length, niveau: niveauPour(rec?.xp ?? 0) })
  }

  // ── Le recalcul ─────────────────────────────────────────────────────────

  /**
   * Les lignes d'expérience écrites avec un barème d'avant — et combien
   * d'anciens badges de carrière traînent encore. C'est ce qui décide du
   * recalcul au démarrage (`server/src/core/recalcul.ts`).
   */
  async aRecalculer(): Promise<{ lignes: { profileId: string; soireeId: string; spaceId: string; detail: string }[]; anciensBadges: number }> {
    const [lignes, badges] = await Promise.all([
      this.client.execute({
        sql: `SELECT profile_id, soiree_id, space_id, detail FROM profile_xp WHERE detail NOT LIKE ?`,
        args: [`{"v":${VERSION_BAREME},%`],
      }),
      this.client.execute(`SELECT COUNT(*) AS n FROM profile_badges WHERE badge LIKE 'carriere:%'`),
    ])
    return {
      lignes: lignes.rows.map(r => ({
        profileId: String(r.profile_id),
        soireeId: String(r.soiree_id),
        spaceId: String(r.space_id),
        detail: String(r.detail),
      })),
      anciensBadges: Number(badges.rows[0]?.n ?? 0),
    }
  }

  /**
   * Retire les badges de l'ancien catalogue de carrière (« Le Fidèle »,
   * « Le Pilier »…) : les paliers de carrière les reprennent sous leurs
   * nouveaux noms, et le recalcul les redécerne. Rend les profils touchés.
   */
  async oublierAnciensBadgesDeCarriere(): Promise<string[]> {
    const [avant] = await this.client.batch(
      [
        `SELECT DISTINCT profile_id FROM profile_badges WHERE badge LIKE 'carriere:%'`,
        `DELETE FROM profile_badges WHERE badge LIKE 'carriere:%'`,
      ],
      'write',
    )
    const touches = avant.rows.map(r => String(r.profile_id))
    this.porteurs = null
    await this.recompterRecompenses(touches)
    return touches
  }

  /**
   * Remet au barème du jour une ligne qu'aucun recalcul ne sait relire : celle
   * des paliers, ou celle d'une soirée absente de l'historique — la soirée en
   * cours, qui se recréditera à son prochain quiz. Son expérience ne bouge
   * pas, seule sa version : restée à l'ancienne, elle se serait retrouvée « à
   * recalculer » à chaque démarrage, et tout l'historique avec elle.
   */
  async remettreAuBareme(profileId: string, soireeId: string): Promise<void> {
    if (soireeId === LIGNE_PALIERS) {
      await this.ecrireXpDesPaliers(profileId)
      await this.recalculerTotal(profileId)
      return
    }
    const rows = await this.client.execute({
      sql: 'SELECT detail FROM profile_xp WHERE profile_id = ? AND soiree_id = ?',
      args: [profileId, soireeId],
    })
    const r = rows.rows[0]
    if (!r) return
    const { gain, releve } = decodeDetail(String(r.detail))
    await this.client.execute({
      sql: 'UPDATE profile_xp SET detail = ? WHERE profile_id = ? AND soiree_id = ?',
      args: [JSON.stringify({ v: VERSION_BAREME, gain, releve }), profileId, soireeId],
    })
  }

  /** Les profils qui ont au moins une ligne d'expérience, c'est-à-dire qui ont joué. */
  async profilsAvecExperience(): Promise<string[]> {
    const res = await this.client.execute('SELECT DISTINCT profile_id FROM profile_xp')
    return res.rows.map(r => String(r.profile_id))
  }

  /**
   * Referme la connexion à la base permanente, comme les quatre autres
   * magasins. Le serveur qui s'arrêtait l'oubliait : la base restait ouverte
   * jusqu'à la sortie du processus, et chaque redémarrage d'un test en
   * laissait une de plus derrière lui.
   */
  close() {
    this.client.close()
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
      // Borné à la lecture : `auto`, ou une finition qu'il a. L'ancienne
      // valeur par défaut, `mat`, se lit `auto` — personne ne l'avait choisie,
      // c'est ce qu'on donnait à tout le monde.
      finition: r.finition === 'mat' ? 'auto' : choixDeFinition(r.finition, niveauPour(Number(r.xp ?? 0))),
      legendaire: typeof r.legendaire === 'string' && r.legendaire ? r.legendaire : null,
      passwordHash: String(r.password_hash),
      recoveryHash: String(r.recovery_hash),
      xp: Number(r.xp ?? 0),
      createdAt: Number(r.created_at),
      lastSeenAt: r.last_seen_at === null || r.last_seen_at === undefined ? null : Number(r.last_seen_at),
      disabledAt: r.disabled_at === null || r.disabled_at === undefined ? null : Number(r.disabled_at),
    }
    this.profiles.set(rec.id, rec)
    // Les éclats et les récompenses arrivent avec le profil : ils partent
    // dans l'accusé d'inscription à une soirée, qui est synchrone, et dans
    // l'instantané de toute la salle.
    if (!this.eclats.has(rec.id)) {
      const eclats = await this.client.execute({ sql: 'SELECT avatar FROM profile_eclats WHERE profile_id = ?', args: [rec.id] })
      this.eclats.set(rec.id, new Set(eclats.rows.map(e => String(e.avatar))))
      await this.recompterRecompenses([rec.id])
    }
    return rec.disabledAt ? null : rec
  }
}
