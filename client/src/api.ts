import type { QuizDef, QuizQuestionDef, QuizSummary } from '../../shared/library'
import type { ArchiveSummary } from '../../shared/archive'
import type { PublicAccount, PublicSpace, SpaceSettings } from '../../shared/space'
import type { FinitionChoisie, PublicProfile, PublicProfileDetail } from '../../shared/profil'
import { MOTIFS, echecPassager, motifEchec, motifHttp, statutPassager } from '../../shared/erreurs'
import { enAttendantLeReveil, type Attente } from '../../shared/reveil'

/**
 * Une erreur d'API qui porte ce que le serveur a joint au message.
 *
 * Pour l'instant une seule chose y voyage : l'identifiant libre proposé quand
 * celui qu'on voulait est pris. Sans lui, une invitée qui n'y connaît rien
 * resterait devant un refus qu'elle ne sait pas contourner.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly suggestion?: string,
    /** Un échec qui passe tout seul — l'hébergeur qui se réveille : une écriture peut l'attendre (`auReveil`). */
    readonly passager = false,
  ) {
    super(message)
  }
}

/**
 * Session absente ou périmée — ou identifiants refusés : l'appelant renvoie
 * vers la connexion. Le message est celui du serveur, qui sait faire la
 * différence entre les deux.
 */
export class UnauthorizedError extends ApiError {}

/**
 * Le quiz a été enregistré ailleurs depuis que les modifications en cours
 * sont parties — l'autre appareil. `updatedAt` : la version qu'il a laissée,
 * d'où repartir pour garder la sienne quand même.
 */
export class ConflitError extends ApiError {
  constructor(
    message: string,
    readonly updatedAt: number,
  ) {
    super(message)
  }
}

/**
 * Ce qu'on montre d'un échec : le motif du serveur, ou l'un des nôtres, qui
 * disent quoi faire. Jamais le texte d'une exception du navigateur — il est
 * en anglais, et il ne dit rien à un invité.
 */
export const motifDe = (e: unknown): string => (e instanceof ApiError ? e.message : MOTIFS.imprevu)

/**
 * Au-delà, la requête est abandonnée. Sans délai, un réseau qui avale les
 * paquets sans rien refuser laissait « Me connecter » grisé pendant des
 * minutes, et l'invité ne savait pas qu'il pouvait réessayer. Large quand
 * même : la 4G d'une salle bondée, et un hébergeur qui se réveille.
 */
const DELAI_REQUETE_MS = 20_000

/** Le corps lu comme du JSON — `undefined` s'il n'en est pas. */
function lireJson(texte: string): unknown {
  try {
    return JSON.parse(texte)
  } catch {
    return undefined
  }
}

/**
 * Toute requête part avec le cookie de session — le navigateur s'en charge —
 * et un en-tête maison que seule cette page peut poser : une page tierce qui
 * tenterait une écriture à notre place serait refusée avant d'être lue.
 *
 * Ce qu'elle lève se montre tel quel à l'invité : un message du serveur, ou
 * l'un des `MOTIFS` — jamais le texte anglais du navigateur.
 */
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const abandon = new AbortController()
  const minuteur = setTimeout(() => abandon.abort(), DELAI_REQUETE_MS)
  let res: Response
  let texte: string
  try {
    res = await fetch(path, {
      ...init,
      signal: abandon.signal,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'quizz', ...init?.headers },
    })
    // Le corps se lit sous le même délai : une réponse qui arrive au
    // compte-gouttes n'est pas une réponse.
    texte = await res.text()
  } catch (e) {
    throw new ApiError(motifEchec(e), undefined, echecPassager(e))
  } finally {
    clearTimeout(minuteur)
  }
  const corps = lireJson(texte)
  // Le motif du serveur d'abord : un mot de passe faux n'est pas une session
  // expirée, et le dire « Connexion requise » faisait chercher ailleurs.
  if (res.status === 401) throw new UnauthorizedError(motifHttp(401, corps))
  const conflit = (corps as { conflit?: { updatedAt?: unknown } } | undefined)?.conflit
  if (res.status === 409 && typeof conflit?.updatedAt === 'number') {
    throw new ConflitError(motifHttp(409, corps), conflit.updatedAt)
  }
  if (!res.ok) {
    const suggestion = (corps as { suggestion?: unknown } | undefined)?.suggestion
    throw new ApiError(
      motifHttp(res.status, corps),
      typeof suggestion === 'string' ? suggestion : undefined,
      statutPassager(res.status),
    )
  }
  if (corps === undefined) throw new ApiError(MOTIFS.illisible)
  return corps as T
}

/** Qui est connecté, son espace, et le profil joueur qu'il y a rattaché. */
export interface Me {
  account: PublicAccount
  space: PublicSpace
  profil?: PublicProfile | null
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
  create: (title: string, questions?: unknown[]) =>
    req<QuizDef>('/api/quizzes', { method: 'POST', body: JSON.stringify({ title, questions }) }),
  /**
   * `base` : la version d'où partent les modifications — le serveur refuse
   * (`ConflitError`) si le quiz a été enregistré ailleurs depuis. `jeton` :
   * le même pour tous les essais d'un même « Enregistrer », pour qu'un essai
   * rejoué au réveil n'entre pas en conflit avec celui qui était passé.
   * `essai` : son numéro, qui croît d'un essai à l'autre — un essai abandonné
   * qui n'arrive qu'après le suivant ne réécrit pas son ancien texte.
   */
  save: (id: string, title: string, questions: QuizQuestionDef[], base?: number, jeton?: string, essai?: number) =>
    req<QuizDef>(`/api/quizzes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title, questions, base, jeton, essai }),
    }),
  remove: (id: string) => req<{ ok: true }>(`/api/quizzes/${id}`, { method: 'DELETE' }),
  duplicate: (id: string) => req<QuizDef>(`/api/quizzes/${id}/duplicate`, { method: 'POST' }),
  /** Les quiz livrés avec l'application, et la copie de l'un d'eux dans son espace. */
  modeles: () => req<{ id: string; title: string; questionCount: number }[]>('/api/modeles'),
  partirDe: (modele: string) => req<QuizDef>(`/api/modeles/${encodeURIComponent(modele)}`, { method: 'POST' }),
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
    /** Ce qu'ouvre un lien d'activation, sans le consommer. */
    lireActivation: (token: string) =>
      req<{ login: string; name: string; slug: string; etat: 'valide' | 'servi' | 'perime' }>('/api/auth/activation', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
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
    /**
     * Sa propre page : le détail complet, étagère à badges et historique.
     * Sans cookie, rend `null` — ce n'est pas une erreur, c'est un invité.
     * `espace` est la soirée qu'anime ce profil, s'il en anime une.
     */
    moi: () => req<{ profile: PublicProfileDetail | null; espace: PublicSpace | null }>('/api/joueur/moi'),
    connexion: (login: string, password: string) =>
      req<{ profile: PublicProfile; espace: PublicSpace | null }>('/api/joueur/connexion', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      }),
    /** Rend le code de secours — la seule fois où il existe en clair. */
    inscription: (input: { login: string; password: string; name: string; avatar: string }) =>
      req<{ profile: PublicProfile; espace: PublicSpace | null; recovery: string }>('/api/joueur/inscription', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    /**
     * Rouvre la console de l'espace rattaché. La session d'animateur dure
     * trente jours, celle du joueur un an : il faut pouvoir la rouvrir sans
     * retaper quoi que ce soit.
     */
    console: () => req<{ espace: PublicSpace }>('/api/joueur/console', { method: 'POST' }),
    deconnexion: () => req<{ ok: true }>('/api/joueur/deconnexion', { method: 'POST' }),
    enregistrer: (patch: { name?: string; avatar?: string; finition?: FinitionChoisie; legendaire?: string | null }) =>
      req<{ profile: PublicProfile }>('/api/joueur/moi', { method: 'PUT', body: JSON.stringify(patch) }),
    /**
     * Changer son mot de passe : il faut l'actuel, ou le code de secours pour
     * qui l'a oublié. La session seule ne suffit pas — un téléphone se prête
     * en soirée. Par le code, la réponse porte le neuf : c'est la seule fois
     * où il existe en clair, et la page doit le montrer.
     */
    motDePasse: (preuve: { current?: string; code?: string; next: string }) =>
      req<{ ok: true; recovery?: string }>('/api/joueur/mot-de-passe', { method: 'POST', body: JSON.stringify(preuve) }),
    /** Le code de secours se consomme : on en rend un neuf. */
    secours: (login: string, code: string, password: string) =>
      req<{ recovery: string; profile: PublicProfile | null; espace?: PublicSpace | null }>('/api/joueur/secours', {
        method: 'POST',
        body: JSON.stringify({ login, code, password }),
      }),
  },
  space: {
    saveSettings: (settings: Partial<SpaceSettings>) =>
      req<{ space: PublicSpace }>('/api/space/settings', { method: 'PUT', body: JSON.stringify(settings) }),
    /** Rattache son profil joueur à son espace : il faut prouver les deux. */
    lierProfil: (login: string, password: string) =>
      req<{ profil: PublicProfile }>('/api/space/profil', {
        method: 'POST',
        body: JSON.stringify({ login, password }),
      }),
    detacherProfil: () => req<{ profil: null }>('/api/space/profil', { method: 'DELETE' }),
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
 * Un appel qui attend le réveil de l'hébergeur au lieu d'échouer au bout de
 * vingt secondes — voir `shared/reveil.ts`. Seulement pour ce qu'on peut
 * rejouer sans dommage : un essai abandonné a pu arriver quand même.
 */
export function auReveil<T>(appel: () => Promise<T>, attente: Omit<Attente, 'passager'> = {}): Promise<T> {
  return enAttendantLeReveil(appel, { ...attente, passager: e => e instanceof ApiError && e.passager })
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
